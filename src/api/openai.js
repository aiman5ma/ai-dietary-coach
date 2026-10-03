// OpenAI integration for AI Dietary Coach.
//
// Public API:
//   - analyzeNutrition(foodName, weightGrams, lang, options?)
//   - getBMIAdvice(profile, lang, options?)
//   - analyzePhoto(base64ImageString, mimeType, lang, options?)
//   - getDailySummary(foodEntries, userGoal, calorieTarget, lang, options?)
//   - chatWithNutritionist(messagesArray, lang, options?)
//   - isApiKeyConfigured()
//
// All network calls use the native fetch API (no axios) and read the
// API key from `import.meta.env.VITE_OPENAI_API_KEY`. Each function
// accepts an optional `{ signal }` AbortSignal so callers can cancel
// in-flight requests.

const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const PLACEHOLDER_KEY = "your_openai_api_key_here";

function getApiKey() {
  const key = import.meta.env?.VITE_OPENAI_API_KEY;
  if (typeof key !== "string" || key.trim() === "" || key === PLACEHOLDER_KEY) {
    throw new Error(
      "Missing OpenAI API key. Add VITE_OPENAI_API_KEY to your .env file and restart the dev server.",
    );
  }
  return key.trim();
}

/**
 * Returns true when a usable API key is present in the environment.
 * Use this to render an in-app setup screen instead of crashing.
 */
export function isApiKeyConfigured() {
  const key = import.meta.env?.VITE_OPENAI_API_KEY;
  return typeof key === "string" && key.trim() !== "" && key !== PLACEHOLDER_KEY;
}

async function callOpenAI(body, { signal } = {}) {
  const apiKey = getApiKey();

  let response;
  try {
    response = await fetch(CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new Error(
      `Network error contacting OpenAI: ${err?.message || err}`,
      { cause: err },
    );
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.json();
      detail = errBody?.error?.message || JSON.stringify(errBody);
    } catch {
      try {
        detail = await response.text();
      } catch {
        /* ignore */
      }
    }
    throw new Error(
      `OpenAI request failed (${response.status} ${response.statusText})${
        detail ? `: ${detail}` : ""
      }`,
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("OpenAI returned a malformed response.");
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new Error("OpenAI response was empty.");
  }
  return content;
}

function normalizeLang(lang) {
  return lang === "en" ? "en" : "ar";
}

function languageDirective(lang) {
  return normalizeLang(lang) === "en"
    ? "Respond in English."
    : "You must respond entirely in Arabic (العربية). Do not use any English words in your response except for scientific or medical terms that have no Arabic equivalent.";
}

function jsonTextLanguageLine(lang) {
  const languageName = normalizeLang(lang) === "en" ? "English" : "Arabic";
  return `Return ONLY a valid JSON object. The values for text fields like 'note' and 'description' must be written in ${languageName}. Do not translate the JSON keys themselves.`;
}

function parseJsonResponse(content, label) {
  // Strip accidental code fences if the model ignores instructions.
  let trimmed = content.trim();
  if (trimmed.startsWith("```")) {
    trimmed = trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(
      `Could not parse ${label} response as JSON. Raw output: ${content.slice(0, 200)}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) Nutrition analysis from text
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeNutrition(foodName, weightGrams, lang = "ar", options = {}) {
  if (typeof foodName !== "string" || foodName.trim() === "") {
    throw new Error("foodName is required.");
  }
  const grams = Number(weightGrams);
  if (!Number.isFinite(grams) || grams <= 0) {
    throw new Error("weightGrams must be a positive number.");
  }

  const userPrompt = `Provide nutritional values for ${grams}g of "${foodName.trim()}".

Respond with ONLY a JSON object in this exact shape (numbers only, grams for macros, no units inside values):
{
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fiber": number,
  "sugar": number,
  "note": string
}

"note" must be exactly two sentences offering a useful insight about this food (health benefit, dietary consideration, or a practical tip).
${jsonTextLanguageLine(lang)}`;

  const content = await callOpenAI(
    {
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${languageDirective(lang)}\nYou are a precise nutrition database. Always respond with valid JSON only, no markdown.`,
        },
        { role: "user", content: userPrompt },
      ],
    },
    options,
  );

  return parseJsonResponse(content, "nutrition");
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) Personalized diet plan from BMI + energy needs
// ─────────────────────────────────────────────────────────────────────────────

const ACTIVITY_EN = Object.freeze({
  sedentary: "Sedentary (little or no exercise)",
  light: "Lightly active (1–3 days/week)",
  moderate: "Moderately active (3–5 days/week)",
  very: "Very active (6–7 days/week)",
  extra: "Extra active (physical job or 2x training/day)",
});

const GOAL_EN = Object.freeze({
  loss: "Weight loss (eat at TDEE − 500)",
  maintain: "Maintenance (eat at TDEE)",
  gain: "Weight gain (eat at TDEE + 300)",
});

const SEX_EN = Object.freeze({
  male: "male",
  female: "female",
});

function requireFinite(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${label} must be a number.`);
  return n;
}

function asRounded(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function asStringList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeDietPlan(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Diet plan response was empty.");
  }

  const meals = Array.isArray(raw.meals)
    ? raw.meals
        .map((meal) => {
          if (!meal || typeof meal !== "object") return null;
          const slot = String(meal.slot || "")
            .trim()
            .toLowerCase();
          const title = String(meal.title || "").trim();
          const detail = String(meal.detail || "").trim();
          const calories = asRounded(meal.calories);
          if (!title && !detail) return null;
          return { slot, title, detail, calories };
        })
        .filter(Boolean)
    : [];

  const plan = {
    intro: String(raw.intro || "").trim(),
    proteinGrams: asRounded(raw.proteinGrams),
    carbGrams: asRounded(raw.carbGrams),
    fatGrams: asRounded(raw.fatGrams),
    mealsPerDay: asRounded(raw.mealsPerDay),
    meals,
    prioritize: asStringList(raw.prioritize),
    limit: asStringList(raw.limit),
    guidance: asStringList(raw.guidance),
  };

  const hasBody =
    plan.intro ||
    plan.meals.length > 0 ||
    plan.prioritize.length > 0 ||
    plan.limit.length > 0 ||
    plan.guidance.length > 0;
  if (!hasBody) throw new Error("Diet plan response was empty.");
  return plan;
}

/**
 * Request a structured diet plan for one user profile.
 *
 * `profile` must include age, sex, activityLevel, goal, bmi, tdee,
 * calorieTarget, heightCm, and weightKg. `lang` is "ar" or "en" and is read on each call.
 * `options.signal` cancels the request.
 * Returns a normalized plan object (not prose).
 */
export async function getBMIAdvice(profile, lang = "ar", options = {}) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error("profile is required.");
  }

  const bmi = requireFinite(profile.bmi, "bmi");
  const heightCm = requireFinite(profile.heightCm, "heightCm");
  const weightKg = requireFinite(profile.weightKg, "weightKg");
  const age = requireFinite(profile.age, "age");
  const tdee = requireFinite(profile.tdee, "tdee");
  const calorieTarget = requireFinite(profile.calorieTarget, "calorieTarget");
  const bmr = requireFinite(profile.bmr, "bmr");

  if (!profile.category || typeof profile.category !== "string") {
    throw new Error("category is required.");
  }
  const sex = SEX_EN[profile.sex];
  const activity = ACTIVITY_EN[profile.activityLevel];
  const goal = GOAL_EN[profile.goal];
  if (!sex) throw new Error("sex must be male or female.");
  if (!activity) throw new Error("activityLevel is not recognized.");
  if (!goal) throw new Error("goal is not recognized.");

  const languageName = normalizeLang(lang) === "en" ? "English" : "Arabic";
  const goalDelta =
    profile.goal === "loss" ? "TDEE − 500" : profile.goal === "gain" ? "TDEE + 300" : "TDEE";

  const userPrompt = `Write a detailed diet plan for THIS person only. Use the exact figures below. Do not substitute round numbers or a generic adult template.

Language for every free-text field: ${languageName}.
Sex: ${sex}
Age: ${Math.round(age)} years
Height: ${Math.round(heightCm)} cm
Weight: ${weightKg} kg
BMI: ${bmi} (${profile.category})
Activity level: ${profile.activityLevel} — ${activity}
BMR (Mifflin-St Jeor): ${Math.round(bmr)} kcal
TDEE: ${Math.round(tdee)} kcal
Goal: ${goal}
Daily calorie target: ${Math.round(calorieTarget)} kcal (${goalDelta})

Respond with ONLY a JSON object in this exact shape:
{
  "intro": string,
  "proteinGrams": number,
  "carbGrams": number,
  "fatGrams": number,
  "mealsPerDay": number,
  "meals": [
    { "slot": "breakfast" | "lunch" | "dinner" | "snack", "title": string, "detail": string, "calories": number }
  ],
  "prioritize": [string],
  "limit": [string],
  "guidance": [string]
}

Rules:
- intro is 2–3 sentences addressed to "you". It must state the exact age, sex, activity description, BMI category, goal, TDEE (${Math.round(tdee)}), and calorie target (${Math.round(calorieTarget)}).
- proteinGrams, carbGrams, and fatGrams are daily gram targets for ${weightKg} kg at ${Math.round(calorieTarget)} kcal. Scale protein to this body weight and goal (higher when losing or gaining). Fat and carbs must fit the calorie target (protein×4 + carbs×4 + fat×9 ≈ ${Math.round(calorieTarget)}).
- mealsPerDay is 3, 4, or 5, chosen for this goal and activity.
- meals covers breakfast, lunch, dinner, and at least one snack when mealsPerDay is 4 or 5. Each item names a concrete meal, a short reason it fits this goal, and an approximate calorie count. The meal calories together should land near ${Math.round(calorieTarget)}.
- slot must stay one of: breakfast, lunch, dinner, snack. title and detail are in ${languageName}.
- prioritize is 4 foods or food groups to eat more of for this goal. limit is 4 foods or patterns to cut back for this goal. Do not swap the lists between weight loss and weight gain.
- guidance is exactly 3 short tips, in this order: meal timing, hydration, portion size. Each tip must reference a number from this profile (calorie target, body weight, age, or training frequency).
- No markdown, no headings inside strings, no extra keys.`;

  const content = await callOpenAI(
    {
      model: "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${languageDirective(lang)}\nYou are Coach Nova, a certified nutritionist. You write detailed diet plans that can only fit the specific person described. Always respond with valid JSON only, no markdown.`,
        },
        { role: "user", content: userPrompt },
      ],
    },
    options,
  );

  return normalizeDietPlan(parseJsonResponse(content, "diet plan"));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) Photo → food + nutrition (vision)
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzePhoto(base64ImageString, mimeType, lang = "ar", options = {}) {
  if (typeof base64ImageString !== "string" || base64ImageString.length === 0) {
    throw new Error("base64ImageString is required.");
  }
  if (typeof mimeType !== "string" || mimeType.length === 0) {
    throw new Error("mimeType is required (e.g. 'image/jpeg').");
  }

  // Accept both raw base64 and pre-formed data URIs.
  const dataUri = base64ImageString.startsWith("data:")
    ? base64ImageString
    : `data:${mimeType};base64,${base64ImageString}`;

  const instructions = `Identify the food in the image and estimate its nutrition for a typical single serving.

Respond with ONLY a JSON object in this exact shape (numbers only, grams for macros, no units inside values):
{
  "foodName": string,
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fiber": number,
  "sugar": number,
  "description": string
}

"description" must be exactly two sentences describing the food and its nutritional profile. If the image does not clearly show food, set "foodName" to "Unknown", use 0 for all numeric fields, and explain in "description".
${jsonTextLanguageLine(lang)}`;

  const content = await callOpenAI(
    {
      model: "gpt-4o",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${languageDirective(lang)}\nYou are a food recognition and nutrition expert. Always respond with valid JSON only.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: instructions },
            {
              type: "image_url",
              image_url: { url: dataUri, detail: "auto" },
            },
          ],
        },
      ],
    },
    options,
  );

  return parseJsonResponse(content, "photo");
}

function cleanSummaryText(value) {
  return String(value || "")
    .replace(/^\s*[-–—]{2,}\s*$/gm, "")
    .replace(/[—–]/g, ", ")
    .replace(/\s*--+\s*/g, ", ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeDailySummary(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Daily summary response was empty.");
  }
  const summary = {
    overall: cleanSummaryText(raw.overall),
    positives: asStringList(raw.positives).map(cleanSummaryText).filter(Boolean),
    improvements: asStringList(raw.improvements).map(cleanSummaryText).filter(Boolean),
    macroBalance: cleanSummaryText(raw.macroBalance),
    nextMeal: cleanSummaryText(raw.nextMeal),
  };
  const hasBody =
    summary.overall ||
    summary.positives.length > 0 ||
    summary.improvements.length > 0 ||
    summary.macroBalance ||
    summary.nextMeal;
  if (!hasBody) throw new Error("Daily summary response was empty.");
  return summary;
}

/**
 * Assess today's logged foods against the user's goal and calorie target.
 *
 * `lang` is "ar" or "en" and is read on each call. `options.signal` cancels the request.
 * Returns { overall, positives, improvements, macroBalance, nextMeal }.
 */
export async function getDailySummary(foodEntries, userGoal, calorieTarget, lang = "ar", options = {}) {
  if (!Array.isArray(foodEntries) || foodEntries.length === 0) {
    throw new Error("foodEntries must contain at least one item.");
  }

  const foods = foodEntries.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`foodEntries[${index}] is invalid.`);
    }
    const name = String(entry.name ?? entry.foodName ?? "").trim();
    if (!name) throw new Error(`foodEntries[${index}] needs a name.`);
    return {
      name,
      calories: Number(entry.calories) || 0,
      protein: Number(entry.protein) || 0,
      carbs: Number(entry.carbs) || 0,
      fat: Number(entry.fat) || 0,
    };
  });

  const languageCode = normalizeLang(lang);
  const languageName = languageCode === "en" ? "English" : "Arabic";
  const goalText =
    GOAL_EN[userGoal] ||
    (typeof userGoal === "string" && userGoal.trim() ? userGoal.trim() : "Not set");
  const targetNumber = Number(calorieTarget);
  const targetText =
    Number.isFinite(targetNumber) && targetNumber > 0
      ? `${Math.round(targetNumber)} kcal`
      : "Not set";

  const totals = foods.reduce(
    (sum, food) => ({
      calories: sum.calories + food.calories,
      protein: sum.protein + food.protein,
      carbs: sum.carbs + food.carbs,
      fat: sum.fat + food.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const focus =
    foods.length === 1
      ? "Only one food is logged. Assess that single item on its own. Do not invent other meals the user did not eat."
      : `${foods.length} foods are logged. Assess the day as a whole.`;

  const userPrompt = `Review today's food log for this person and write a short meal summary.

Respond in ${languageName} (language code: ${languageCode}). Every string in the JSON must be in ${languageName}.
Goal: ${goalText}
Calorie target: ${targetText}
Foods:
${JSON.stringify(foods)}
Totals: ${Math.round(totals.calories)} kcal, protein ${Math.round(totals.protein)} g, carbs ${Math.round(totals.carbs)} g, fat ${Math.round(totals.fat)} g.
${focus}

Respond with ONLY a JSON object in this exact shape:
{
  "overall": string,
  "positives": [string],
  "improvements": [string],
  "macroBalance": string,
  "nextMeal": string
}

Rules:
- overall is one paragraph assessing today's eating against the goal and calorie target.
- positives lists what the user did well today (1 to 3 short items).
- improvements lists specific, practical suggestions (1 to 3 short items).
- macroBalance is one sentence on whether the protein, carb, and fat balance fits the goal.
- nextMeal is one specific suggestion for what to eat next, based on what is still missing today.
- Never use standalone dashes (-- or ---) as separators or decorative elements. Never use em-dashes or double-hyphens inside any string.
- No markdown, no headings inside strings, no extra keys.`;

  const content = await callOpenAI(
    {
      model: "gpt-4o-mini",
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${languageDirective(lang)}\nYou are Coach Nova, a certified nutritionist. Always respond with valid JSON only, no markdown. Write every string in ${languageName}. Never use standalone dashes (-- or ---) or em-dashes.`,
        },
        { role: "user", content: userPrompt },
      ],
    },
    options,
  );

  return normalizeDailySummary(parseJsonResponse(content, "daily summary"));
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) Chat with Coach Nova
// ─────────────────────────────────────────────────────────────────────────────

function coachSystemPrompt(lang) {
  const persona =
    normalizeLang(lang) === "en"
      ? "You are Coach Nova, a professional nutrition coach. Always respond in English. Never use standalone dashes (-- or ---) in your responses."
      : "أنتِ Coach Nova، مدربة تغذية محترفة. تتحدثين دائماً بالعربية الفصحى السهلة. لا تستخدمي شرطات مزدوجة (-- أو ---) في ردودك.";

  return `${languageDirective(lang)}
${persona}

Format every reply with proper markdown:
- Use ## for headings
- Use - for bullet points
- Use **bold** for emphasis
- Put a blank line between sections

Never use standalone dashes (-- or ---) as separators or decorative elements. Never use em-dashes or double-hyphens as section dividers.`;
}

export async function chatWithNutritionist(messagesArray, lang = "ar", options = {}) {
  if (!Array.isArray(messagesArray)) {
    throw new Error("messagesArray must be an array of {role, content} messages.");
  }

  // Defensively keep only valid user/assistant turns; our system prompt always wins.
  const cleaned = messagesArray.filter(
    (m) =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.length > 0,
  );

  if (cleaned.length === 0) {
    throw new Error("messagesArray must contain at least one user message.");
  }

  const content = await callOpenAI(
    {
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: coachSystemPrompt(lang) },
        ...cleaned,
      ],
    },
    options,
  );

  return content.trim();
}
