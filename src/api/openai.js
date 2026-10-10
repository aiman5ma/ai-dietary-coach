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

const CONDITION_EN = Object.freeze({
  diabetes: "Diabetes",
  hypertension: "Hypertension",
  cholesterol: "High cholesterol",
  celiac: "Celiac disease (gluten)",
  lactose: "Lactose intolerance",
  nuts: "Nut allergy",
  seafood: "Seafood allergy",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
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

function cleanPlanText(value) {
  return String(value ?? "")
    .replace(/[\u2014\u2013]/g, ", ")
    .replace(/\s-{2,}\s/g, ", ")
    .replace(/-{2,}/g, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ", ")
    .trim();
}

function macroCalories(grams, perGram, given) {
  const explicit = asRounded(given);
  if (explicit != null) return explicit;
  const amount = asRounded(grams);
  return amount == null ? null : amount * perGram;
}

function normalizeItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = cleanPlanText(raw.name);
  if (!name) return null;
  return {
    name,
    grams: asRounded(raw.grams),
    calories: asRounded(raw.calories),
  };
}

function normalizeOption(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  const labels = ["A", "B", "C"];
  const given = String(raw.id || raw.label || "")
    .trim()
    .toUpperCase();
  const id = labels.includes(given) ? given : labels[index] || "A";
  let items = Array.isArray(raw.items) ? raw.items.map(normalizeItem).filter(Boolean) : [];
  const legacyDetail = cleanPlanText(raw.detail);
  if (!items.length && legacyDetail) {
    items = [{ name: legacyDetail, grams: null, calories: asRounded(raw.calories) }];
  }
  const title = cleanPlanText(raw.title);
  const preparation = cleanPlanText(raw.preparation);
  if (!title && !items.length && !preparation) return null;
  return {
    id,
    title,
    items,
    totalCalories: asRounded(raw.totalCalories ?? raw.calories),
    preparation,
  };
}

function normalizeMeals(rawMeals) {
  if (!Array.isArray(rawMeals)) return [];
  return rawMeals
    .map((meal) => {
      if (!meal || typeof meal !== "object") return null;
      const slot = String(meal.slot || "")
        .trim()
        .toLowerCase();
      const source = Array.isArray(meal.options) && meal.options.length ? meal.options : [meal];
      const options = source.map(normalizeOption).filter(Boolean).slice(0, 3);
      if (!options.length) return null;
      return { slot, options };
    })
    .filter(Boolean);
}

function normalizeDietPlan(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Diet plan response was empty.");
  }

  const meals = normalizeMeals(raw.meals);
  const proteinGrams = asRounded(raw.proteinGrams);
  const carbGrams = asRounded(raw.carbGrams);
  const fatGrams = asRounded(raw.fatGrams);

  const plan = {
    intro: cleanPlanText(raw.intro),
    proteinGrams,
    proteinCalories: macroCalories(proteinGrams, 4, raw.proteinCalories),
    carbGrams,
    carbCalories: macroCalories(carbGrams, 4, raw.carbCalories),
    fatGrams,
    fatCalories: macroCalories(fatGrams, 9, raw.fatCalories),
    mealsPerDay: asRounded(raw.mealsPerDay) || (meals.length ? 5 : null),
    meals,
    eatFreely: asStringList(raw.eatFreely).map(cleanPlanText).filter(Boolean),
    prioritize: asStringList(raw.prioritize).map(cleanPlanText).filter(Boolean),
    limit: asStringList(raw.limit).map(cleanPlanText).filter(Boolean),
    avoid: asStringList(raw.avoid).map(cleanPlanText).filter(Boolean),
    weeklyTips: asStringList(raw.weeklyTips || raw.guidance).map(cleanPlanText).filter(Boolean),
    guidance: asStringList(raw.guidance).map(cleanPlanText).filter(Boolean),
    hydrationMl: asRounded(raw.hydrationMl),
    hydrationNote: cleanPlanText(raw.hydrationNote),
    allergyNote: cleanPlanText(raw.allergyNote),
  };

  const hasBody =
    plan.intro ||
    plan.meals.length > 0 ||
    plan.eatFreely.length > 0 ||
    plan.prioritize.length > 0 ||
    plan.limit.length > 0 ||
    plan.avoid.length > 0 ||
    plan.weeklyTips.length > 0 ||
    plan.guidance.length > 0 ||
    plan.hydrationNote;
  if (!hasBody) throw new Error("Diet plan response was empty.");
  return plan;
}

/**
 * Request a structured diet plan for one user profile.
 *
 * `profile` must include age, sex, activityLevel, goal, bmi, tdee,
 * calorieTarget, heightCm, and weightKg. `lang` is "ar" or "en" and is read on each call.
 * `previousMeals` lists meals and ingredients this person already received.
 * `options.signal` cancels the request.
 * Returns a normalized plan object (not prose).
 */
export async function getBMIAdvice(profile, lang = "ar", previousMeals = [], options = {}) {
  let avoidedMeals = [];
  let requestOptions = options;
  if (Array.isArray(previousMeals)) {
    avoidedMeals = previousMeals.filter((item) => typeof item === "string" && item.trim());
  } else if (previousMeals && typeof previousMeals === "object") {
    requestOptions = previousMeals;
    avoidedMeals = Array.isArray(previousMeals.previousMeals)
      ? previousMeals.previousMeals.filter((item) => typeof item === "string" && item.trim())
      : [];
  }
  if (!requestOptions || typeof requestOptions !== "object") requestOptions = {};
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
  const conditionIds = [
    ...(Array.isArray(profile.conditions) ? profile.conditions : []),
    ...(Array.isArray(profile.allergies) ? profile.allergies : []),
  ].filter((id, index, list) => typeof id === "string" && id && list.indexOf(id) === index);
  const otherConditions =
    typeof profile.otherConditions === "string" ? profile.otherConditions.trim() : "";
  const conditionText = [
    ...conditionIds.map((id) => CONDITION_EN[id] || id),
    ...(otherConditions ? [`Other: ${otherConditions}`] : []),
  ];
  const allergyBlock = conditionText.length ? conditionText.join("; ") : "None reported.";
  const waterMl = Math.round(weightKg * 35);

  const userPrompt = `Write a highly detailed diet plan for THIS person only. Use the exact figures below. Do not substitute round numbers or a generic adult template.

Language for every free-text field: ${languageName}.
Sex: ${sex}
Age: ${Math.round(age)} years
Height: ${Math.round(heightCm)} cm
Weight: ${weightKg} kg
BMI: ${bmi} (${profile.category})
Activity level: ${profile.activityLevel}, ${activity}
BMR (Mifflin-St Jeor): ${Math.round(bmr)} kcal
TDEE: ${Math.round(tdee)} kcal
Goal: ${goal}
Daily calorie target: ${Math.round(calorieTarget)} kcal (${goalDelta})
Allergies and conditions: ${allergyBlock}
Suggested water target: ${waterMl} ml per day (35 ml per kg).

Respond with ONLY a JSON object in this exact shape. Every free-text value must be in ${languageName}:
{
  "intro": string,
  "proteinGrams": number,
  "proteinCalories": number,
  "carbGrams": number,
  "carbCalories": number,
  "fatGrams": number,
  "fatCalories": number,
  "mealsPerDay": 5,
  "meals": [
    {
      "slot": "breakfast" | "morningSnack" | "lunch" | "afternoonSnack" | "dinner",
      "options": [
        {
          "id": "A" | "B" | "C",
          "title": string,
          "items": [{ "name": string, "grams": number, "calories": number }],
          "totalCalories": number,
          "preparation": string
        }
      ]
    }
  ],
  "eatFreely": [string],
  "limit": [string],
  "avoid": [string],
  "weeklyTips": [string],
  "hydrationMl": number,
  "hydrationNote": string,
  "allergyNote": string
}

Rules:
- intro is 2–3 sentences addressed to "you". It must state the exact age, sex, activity description, BMI category, goal, TDEE (${Math.round(tdee)}), and calorie target (${Math.round(calorieTarget)}).
- proteinGrams, carbGrams, and fatGrams are daily gram targets for ${weightKg} kg at ${Math.round(calorieTarget)} kcal. Scale protein to this body weight and goal (higher when losing or gaining). proteinCalories = proteinGrams × 4, carbCalories = carbGrams × 4, fatCalories = fatGrams × 9. Those three calorie amounts must add up to about ${Math.round(calorieTarget)}.
- mealsPerDay is exactly 5. meals has exactly these slots, in order: breakfast, morningSnack, lunch, afternoonSnack, dinner.
- Each meal has exactly 3 options, id "A", "B", and "C". Options are alternatives, not foods eaten together. One option from each of the 5 meals should land near ${Math.round(calorieTarget)} kcal. Do not add every option together.
- Each option lists every food in items with an exact grams weight and that item's calories. totalCalories is the sum of that option's item calories. preparation is one sentence on how to prepare it.
- eatFreely is 4 foods this person can eat freely for this goal. limit is 4 foods to cut back. Do not swap these lists between weight loss and weight gain.
- The avoid list must be DIRECTLY related to this user's specific health conditions and goal ONLY.
- If the user has no health conditions, the avoid list should only contain foods that genuinely contradict their goal (for example, for weight loss: high-calorie junk food, sugary drinks, fried fast food).
- NEVER suggest avoiding seafood unless the user specifically has a seafood allergy.
- NEVER suggest avoiding canned food as a general rule.
- NEVER mention alcohol, toxins, or poisonous foods. These are obvious and irrelevant.
- NEVER suggest avoiding spicy food unless the user has a digestive condition.
- The avoid list must be specific and practical, containing a maximum of 5 items that are genuinely relevant to THIS user's profile.
- The foods to avoid section must only contain items that are realistic temptations for someone with this user's goal and conditions. Do not include obvious harmful substances or foods with no connection to the user's situation.
- weeklyTips is exactly 3 short tips for varying meals across the week.
- hydrationMl is ${waterMl}. hydrationNote explains that amount from this body weight in one or two sentences.
- If allergies and conditions are "None reported.", set allergyNote to an empty string. Otherwise, every meal option must avoid those foods, and allergyNote must name the conditions, the foods to skip, and safe alternatives available in Saudi Arabia.

VARIETY RULES:
- No ingredient should appear more than once across all 3 options of the same meal.
- No protein source should repeat across Breakfast, Lunch, and Dinner options on the same day.
- Options A, B, and C for each meal must be completely different in concept, not just different quantities of the same food (e.g. do not give "chicken rice", "chicken with vegetables", "grilled chicken" as 3 options — they all center on chicken).
- Each meal option must represent a different cuisine style or food category where possible (e.g. one option could be traditional Saudi, one Mediterranean, one light/modern).
- Morning snack and afternoon snack must differ: one fruit-based, one protein-based or grain-based, and the three options inside each snack must still be different foods.

SPECIFICITY RULES:
- Every food item name includes the food and its exact gram weight is in grams (for example cooked rice at 150 grams, not just rice).
- Sauces, oils, and condiments are their own items, with grams or milliliters in the name and calories in the calories field (for example olive oil, 5 ml, 45 calories).
- Drinks are their own items with a quantity (water, tea, and similar).
- Write every name, title, preparation, and note in ${languageName}.
- When naming meal options, NEVER label them by nationality or region. Do not write 'فطور سعودي' or 'وجبة مصرية' or 'طبق لبناني'. Just write the meal name directly, for example: 'فول بالزيت والليمون مع بيض مسلوق' instead of 'فطور سعودي تقليدي'. The meal name should describe what the food actually is.

SAUDI CONTEXT:
- Prioritize foods commonly available in Saudi supermarkets.
- Include traditional Saudi dishes as at least one option per main meal (e.g. kabsa, shawarma, fool, tameez).
- Avoid exotic ingredients that are hard to find locally.

Be creative and surprising with your meal choices. Explore diverse cuisines including Saudi, Levantine, Egyptian, Mediterranean, and healthy international options.

STRICT NO-REPETITION CHECK:
- Before finalizing your response, review all meal options and confirm that no main protein, grain, or vegetable ingredient is repeated more than twice across all meals and options combined. If you find repetition, replace the repeated item with a different food.
- Do NOT use standalone dashes (-- or ---) anywhere, and do not use em dashes.
- No markdown, no headings inside strings, no extra keys.${
    avoidedMeals.length
      ? `

CRITICAL ANTI-REPETITION RULE:
The following meals and ingredients were suggested in previous sessions for this user.
You are STRICTLY FORBIDDEN from suggesting any of these again:
${avoidedMeals.join(", ")}
If you accidentally include any of these, your response will be rejected.
You must suggest completely new and different meals that this user has never received before.`
      : ""
  }`;

  const content = await callOpenAI(
    {
      model: "gpt-4o-mini",
      temperature: 0.9,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${languageDirective(lang)}\nYou are Coach Nova, a certified nutritionist. You write detailed diet plans that can only fit the specific person described, including their allergies and conditions. Always respond with valid JSON only, no markdown, and never use standalone dashes.`,
        },
        { role: "user", content: userPrompt },
      ],
    },
    requestOptions,
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
