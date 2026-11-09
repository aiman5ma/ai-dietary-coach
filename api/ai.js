// Server-side OpenAI proxy. The browser never sees OPENAI_API_KEY.
//
// POST /api/ai
//   Authorization: Bearer <supabase access token>
//   { kind: "text" | "image", messages, temperature?, response_format? }
//
// The model and max_tokens are chosen here. Clients cannot override them.

import { Buffer } from "node:buffer";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const TEXT_MODEL = "gpt-4o-mini";
const IMAGE_MODEL = "gpt-4o";
const TEXT_MAX_TOKENS = 500;
const IMAGE_MAX_TOKENS = 600;
const MAX_MESSAGES = 20;
const MAX_TEXT_CHARS = 20_000;
const MAX_TOTAL_TEXT_CHARS = 60_000;
const MAX_IMAGE_CHARS = 3_600_000;
const MAX_BODY_BYTES = 4_500_000;
const MAX_TOKEN_CHARS = 8_192;

export const config = {
  maxDuration: 30,
};

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function fail(res, status, message) {
  send(res, status, { error: { message } });
}

function headerValue(value) {
  if (Array.isArray(value)) return value[0] || "";
  return typeof value === "string" ? value : "";
}

function bearerToken(req) {
  const header = headerValue(req.headers?.authorization);
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  const token = match?.[1] || "";
  if (!token || token.length > MAX_TOKEN_CHARS) return "";
  return token;
}

function readRawBody(req) {
  if (typeof req.body === "string") return Promise.resolve(req.body);
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body.toString("utf8"));
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        const error = new Error("BODY_TOO_LARGE");
        error.code = "BODY_TOO_LARGE";
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  const raw = await readRawBody(req);
  if (!raw) return {};
  return JSON.parse(raw);
}

async function requireUser(token) {
  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = String(process.env.SUPABASE_ANON_KEY || "").trim();
  if (!supabaseUrl || !anonKey) {
    const error = new Error("CONFIG");
    error.code = "CONFIG";
    throw error;
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  if (!user || typeof user.id !== "string" || user.id.length === 0) return null;
  return user;
}

function sanitizeMessages(kind, messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return { error: `messages must contain 1 to ${MAX_MESSAGES} items.` };
  }

  const sanitized = [];
  let textChars = 0;
  let imageChars = 0;
  let imageCount = 0;

  for (const message of messages) {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      return { error: "Invalid message." };
    }
    const role = message.role;
    if (role !== "system" && role !== "user" && role !== "assistant") {
      return { error: "Invalid message role." };
    }

    if (typeof message.content === "string") {
      if (message.content.length > MAX_TEXT_CHARS) return { error: "Message is too long." };
      textChars += message.content.length;
      if (textChars > MAX_TOTAL_TEXT_CHARS) return { error: "Messages are too long." };
      sanitized.push({ role, content: message.content });
      continue;
    }

    if (!Array.isArray(message.content)) return { error: "Invalid message content." };
    if (kind !== "image") return { error: "Images are only allowed when kind is image." };

    const parts = [];
    for (const part of message.content) {
      if (!part || typeof part !== "object") return { error: "Invalid message content." };
      if (part.type === "text") {
        if (typeof part.text !== "string" || part.text.length > MAX_TEXT_CHARS) {
          return { error: "Message is too long." };
        }
        textChars += part.text.length;
        if (textChars > MAX_TOTAL_TEXT_CHARS) return { error: "Messages are too long." };
        parts.push({ type: "text", text: part.text });
        continue;
      }
      if (part.type === "image_url") {
        const url = part.image_url?.url;
        if (typeof url !== "string" || !url.startsWith("data:image/")) {
          return { error: "Image must be a data URL." };
        }
        imageCount += 1;
        if (imageCount > 1) return { error: "Only one image is allowed." };
        imageChars += url.length;
        if (imageChars > MAX_IMAGE_CHARS) {
          return { error: "Image is too large.", status: 413 };
        }
        const requested = part.image_url?.detail;
        const detail = requested === "low" || requested === "high" || requested === "auto" ? requested : "auto";
        parts.push({ type: "image_url", image_url: { url, detail } });
        continue;
      }
      return { error: "Unsupported message content." };
    }
    sanitized.push({ role, content: parts });
  }

  if (kind === "image" && imageCount !== 1) {
    return { error: "Image requests must include one image." };
  }
  return { messages: sanitized };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return fail(res, 405, "Method not allowed.");
  }

  const token = bearerToken(req);
  if (!token) return fail(res, 401, "Unauthorized");

  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return fail(res, 500, "AI service is not configured.");

  let user;
  try {
    user = await requireUser(token);
  } catch (error) {
    if (error?.code === "CONFIG") return fail(res, 500, "AI service is not configured.");
    return fail(res, 502, "Could not verify the session.");
  }
  if (!user) return fail(res, 401, "Unauthorized");

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    if (error?.code === "BODY_TOO_LARGE") return fail(res, 413, "Request is too large.");
    return fail(res, 400, "Invalid JSON body.");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fail(res, 400, "Invalid JSON body.");
  }

  const kind = payload.kind;
  if (kind !== "text" && kind !== "image") {
    return fail(res, 400, 'kind must be "text" or "image".');
  }

  const cleaned = sanitizeMessages(kind, payload.messages);
  if (cleaned.error) return fail(res, cleaned.status || 400, cleaned.error);

  let temperature = 0.4;
  if (typeof payload.temperature === "number" && Number.isFinite(payload.temperature)) {
    temperature = Math.min(1, Math.max(0, payload.temperature));
  }

  const openaiBody = {
    model: kind === "image" ? IMAGE_MODEL : TEXT_MODEL,
    max_tokens: kind === "image" ? IMAGE_MAX_TOKENS : TEXT_MAX_TOKENS,
    temperature,
    messages: cleaned.messages,
  };
  if (payload.response_format?.type === "json_object") {
    openaiBody.response_format = { type: "json_object" };
  }

  let openaiResponse;
  try {
    openaiResponse = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(openaiBody),
    });
  } catch {
    return fail(res, 502, "The AI service could not be reached.");
  }

  const text = await openaiResponse.text();
  res.statusCode = openaiResponse.status;
  res.setHeader("Content-Type", "application/json");
  res.end(text || JSON.stringify({ error: { message: "Empty response from the AI service." } }));
}
