// OpenAI integration for AI Dietary Coach.
//
// Public API:
//   - analyzeNutrition(foodName, weightGrams, options?)
//   - getBMIAdvice(bmi, category, heightCm, weightKg, options?)
//   - analyzePhoto(base64ImageString, mimeType, options?)
//   - chatWithNutritionist(messagesArray, options?)
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

export async function analyzeNutrition(foodName, weightGrams, options = {}) {
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

"note" must be exactly two sentences offering a useful insight about this food (health benefit, dietary consideration, or a practical tip).`;

  const content = await callOpenAI(
    {
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a precise nutrition database. Always respond with valid JSON only, no markdown.",
        },
        { role: "user", content: userPrompt },
      ],
    },
    options,
  );

  return parseJsonResponse(content, "nutrition");
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) BMI advice (plain text)
// ─────────────────────────────────────────────────────────────────────────────

export async function getBMIAdvice(bmi, category, heightCm, weightKg, options = {}) {
  if (!Number.isFinite(Number(bmi))) throw new Error("bmi must be a number.");
  if (!category || typeof category !== "string") {
    throw new Error("category is required.");
  }

  const userPrompt = `My BMI is ${bmi} (${category}). Height: ${heightCm} cm. Weight: ${weightKg} kg.

Give me 3-4 sentences of friendly, personalized advice. Be encouraging and practical: acknowledge what's going well or what to focus on, suggest one or two concrete habits, and end with a positive note. Plain text only — no markdown, no bullets, no headings. Speak directly to me using "you".`;

  const content = await callOpenAI(
    {
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content:
            "You are Coach Nova, a warm and supportive certified nutritionist and dietary coach. Provide brief, personalized advice in plain text only.",
        },
        { role: "user", content: userPrompt },
      ],
    },
    options,
  );

  return content.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) Photo → food + nutrition (vision)
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzePhoto(base64ImageString, mimeType, options = {}) {
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

"description" must be exactly two sentences describing the food and its nutritional profile. If the image does not clearly show food, set "foodName" to "Unknown", use 0 for all numeric fields, and explain in "description".`;

  const content = await callOpenAI(
    {
      model: "gpt-4o",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a food recognition and nutrition expert. Always respond with valid JSON only.",
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

// ─────────────────────────────────────────────────────────────────────────────
// 4) Chat with Coach Nova
// ─────────────────────────────────────────────────────────────────────────────

const COACH_NOVA_SYSTEM_PROMPT =
  "You are a certified nutritionist and dietary coach named Coach Nova. Be warm, clear, and supportive. Use bullet points and structure when helpful. Keep responses concise but complete.";

export async function chatWithNutritionist(messagesArray, options = {}) {
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
        { role: "system", content: COACH_NOVA_SYSTEM_PROMPT },
        ...cleaned,
      ],
    },
    options,
  );

  return content.trim();
}
