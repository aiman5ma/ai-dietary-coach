// Admin-only API. The browser never sees SUPABASE_SERVICE_ROLE_KEY.
// Callers prove who they are with a Supabase access token. The service
// role client is created only after that user is listed in public.admins.

import { Buffer } from "node:buffer";
import { createClient } from "@supabase/supabase-js";

export const config = { maxDuration: 30 };

const ALLOWED_SITE_ORIGINS = ["https://ai-dietary-coach.vercel.app"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FEATURES = ["text", "image", "chat", "plan"];
const ACTIVITIES = new Set(["sedentary", "light", "moderate", "very", "extra"]);
const GOALS = new Set(["loss", "maintain", "gain"]);
const SEXES = new Set(["male", "female"]);
const MAX_BODY_BYTES = 100_000;
const DATA_TABLES = ["profiles", "food_log", "bmi_history", "daily_log"];

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function fail(res, status, code, message) {
  send(res, status, { error: { code, message } });
}

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function headerValue(value) {
  if (Array.isArray(value)) return value[0] || "";
  return typeof value === "string" ? value : "";
}

function requestOrigin(req) {
  const origin = headerValue(req.headers?.origin).trim();
  if (origin) return origin;
  const referer = headerValue(req.headers?.referer || req.headers?.referrer).trim();
  if (!referer) return "";
  try {
    return new URL(referer).origin;
  } catch {
    return "";
  }
}

function isAllowedOrigin(origin) {
  if (ALLOWED_SITE_ORIGINS.includes(origin)) return true;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return true;
    return (
      url.protocol === "https:" &&
      (host === "ai-dietary-coach.vercel.app" ||
        (host.startsWith("ai-dietary-coach-") && host.endsWith(".vercel.app")))
    );
  } catch {
    return false;
  }
}

function bearerToken(req) {
  const header = headerValue(req.headers?.authorization);
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : "";
}

function queryValue(req, name) {
  try {
    return new URL(req.url || "/", "http://localhost").searchParams.get(name) || "";
  } catch {
    return "";
  }
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
        reject(httpError(413, "INVALID_INPUT", "Request is too large."));
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
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  const raw = await readRawBody(req);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw httpError(400, "INVALID_INPUT", "Invalid JSON body.");
  }
}

function serviceClient() {
  const url = String(process.env.SUPABASE_URL || "").trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function currentUser(supabase, req) {
  const token = bearerToken(req);
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user;
}

async function userIsAdmin(supabase, userId) {
  const { data, error } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw httpError(500, "UNAVAILABLE", "Could not check admin access.");
  return Boolean(data?.user_id);
}

function requireUuid(value) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!UUID_RE.test(id)) throw httpError(400, "INVALID_INPUT", "userId must be a UUID.");
  return id;
}

async function selectAll(supabase, table, columns, apply) {
  const rows = [];
  const size = 1000;
  for (let from = 0; from < 50000; from += size) {
    let query = supabase.from(table).select(columns).order("id", { ascending: true }).range(from, from + size - 1);
    if (apply) query = apply(query);
    const { data, error } = await query;
    if (error) throw httpError(500, "UNAVAILABLE", error.message || "Could not read admin data.");
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < size) break;
  }
  return rows;
}

function dayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function lastDays(count) {
  const days = [];
  const now = new Date();
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
    days.push(day.toISOString().slice(0, 10));
  }
  return days;
}

function displayName(user, profile) {
  const fromProfile = typeof profile?.full_name === "string" ? profile.full_name.trim() : "";
  if (fromProfile) return fromProfile;
  const meta = user?.user_metadata || {};
  const fromMeta = typeof meta.full_name === "string" ? meta.full_name : meta.name;
  return typeof fromMeta === "string" ? fromMeta.trim() : "";
}

async function listAuthUsers(supabase) {
  const users = [];
  for (let page = 1; page <= 25; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw httpError(500, "UNAVAILABLE", error.message || "Could not list users.");
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < 200) break;
  }
  return users;
}

async function stats(supabase) {
  const days = lastDays(30);
  const since = `${days[0]}T00:00:00.000Z`;
  const [users, profiles, bmiRows, foodRows, dailyRows, usageRows] = await Promise.all([
    listAuthUsers(supabase),
    selectAll(supabase, "profiles", "id, goal, allergies"),
    selectAll(supabase, "bmi_history", "user_id, category, recorded_at"),
    selectAll(supabase, "food_log", "food_name"),
    selectAll(supabase, "daily_log", "food_name"),
    selectAll(supabase, "usage_log", "created_at, feature, is_guest", (query) =>
      query.gte("created_at", since),
    ),
  ]);

  const newCounts = new Map(days.map((day) => [day, 0]));
  for (const user of users) {
    const day = dayKey(user.created_at);
    if (newCounts.has(day)) newCounts.set(day, newCounts.get(day) + 1);
  }

  const usage = days.map((day) => ({
    date: day,
    text: 0,
    image: 0,
    chat: 0,
    plan: 0,
    guest: 0,
    registered: 0,
  }));
  const usageByDay = new Map(usage.map((row) => [row.date, row]));
  for (const row of usageRows) {
    const bucket = usageByDay.get(dayKey(row.created_at));
    if (!bucket) continue;
    if (FEATURES.includes(row.feature)) bucket[row.feature] += 1;
    if (row.is_guest) bucket.guest += 1;
    else bucket.registered += 1;
  }

  const goals = new Map();
  const allergies = new Map();
  for (const profile of profiles) {
    const goal = GOALS.has(profile.goal) ? profile.goal : "unset";
    goals.set(goal, (goals.get(goal) || 0) + 1);
    const items = Array.isArray(profile.allergies) ? profile.allergies : [];
    for (const item of items) {
      const label = String(item || "").trim().replace(/^other:/i, "").trim();
      if (!label) continue;
      const key = label.toLocaleLowerCase();
      const current = allergies.get(key) || { name: label, count: 0 };
      current.count += 1;
      allergies.set(key, current);
    }
  }

  const latestBmi = new Map();
  for (const row of bmiRows) {
    if (!row.user_id || !row.category) continue;
    const previous = latestBmi.get(row.user_id);
    if (!previous || String(row.recorded_at || "") > String(previous.recorded_at || "")) {
      latestBmi.set(row.user_id, row);
    }
  }
  const bmiCategories = new Map();
  for (const row of latestBmi.values()) {
    const name = String(row.category).trim();
    if (!name) continue;
    bmiCategories.set(name, (bmiCategories.get(name) || 0) + 1);
  }

  const foods = new Map();
  for (const row of [...foodRows, ...dailyRows]) {
    const label = String(row.food_name || "").trim();
    if (!label) continue;
    const key = label.toLocaleLowerCase();
    const current = foods.get(key) || { name: label, count: 0 };
    current.count += 1;
    foods.set(key, current);
  }

  const languages = new Map();
  for (const user of users) {
    const meta = user.user_metadata || {};
    const raw = String(meta.language || meta.lang || meta.locale || "").toLowerCase();
    const language = raw.startsWith("ar") ? "ar" : raw.startsWith("en") ? "en" : "";
    if (!language) continue;
    languages.set(language, (languages.get(language) || 0) + 1);
  }

  const top = (map) =>
    [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 8);

  return {
    totalUsers: users.length,
    newUsers: days.map((date) => ({ date, count: newCounts.get(date) || 0 })),
    aiUsage: usage,
    goals: [...goals.entries()].map(([goal, count]) => ({ goal, count })),
    bmiCategories: [...bmiCategories.entries()].map(([category, count]) => ({ category, count })),
    topAllergies: top(allergies),
    topFoods: top(foods),
    language: {
      available: languages.size > 0,
      counts: [...languages.entries()].map(([language, count]) => ({ language, count })),
    },
  };
}

async function listUsers(supabase, body) {
  const page = body.page == null ? 1 : Number(body.page);
  const pageSize = body.pageSize == null ? 20 : Number(body.pageSize);
  if (!Number.isInteger(page) || page < 1 || page > 10000) {
    throw httpError(400, "INVALID_INPUT", "page must be a positive integer.");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    throw httpError(400, "INVALID_INPUT", "pageSize must be from 1 to 50.");
  }
  const query = body.query == null ? "" : String(body.query).trim();
  if (query.length > 100) throw httpError(400, "INVALID_INPUT", "Search is too long.");

  const [users, profiles, foodRows, bmiRows] = await Promise.all([
    listAuthUsers(supabase),
    selectAll(supabase, "profiles", "id, full_name"),
    selectAll(supabase, "food_log", "user_id"),
    selectAll(supabase, "bmi_history", "user_id"),
  ]);
  const profileById = new Map(profiles.map((row) => [row.id, row]));
  const foodCounts = new Map();
  const bmiCounts = new Map();
  for (const row of foodRows) foodCounts.set(row.user_id, (foodCounts.get(row.user_id) || 0) + 1);
  for (const row of bmiRows) bmiCounts.set(row.user_id, (bmiCounts.get(row.user_id) || 0) + 1);

  const needle = query.toLocaleLowerCase();
  const filtered = users
    .map((user) => {
      const profile = profileById.get(user.id);
      return {
        id: user.id,
        email: user.email || "",
        name: displayName(user, profile),
        createdAt: user.created_at || null,
        lastSignInAt: user.last_sign_in_at || null,
        foodCount: foodCounts.get(user.id) || 0,
        bmiCount: bmiCounts.get(user.id) || 0,
      };
    })
    .filter((user) => {
      if (!needle) return true;
      return user.email.toLocaleLowerCase().includes(needle) || user.name.toLocaleLowerCase().includes(needle);
    })
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  const start = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    total: filtered.length,
    users: filtered.slice(start, start + pageSize),
  };
}

async function recentRows(supabase, table, columns, userId, orderColumn) {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq("user_id", userId)
    .order(orderColumn, { ascending: false })
    .limit(30);
  if (error) throw httpError(500, "UNAVAILABLE", error.message || "Could not read user records.");
  return data || [];
}

function publicProfile(row) {
  if (!row) return null;
  return {
    full_name: row.full_name || "",
    age: row.age ?? null,
    sex: row.sex || "",
    height_cm: row.height_cm ?? null,
    weight_kg: row.weight_kg ?? null,
    activity_level: row.activity_level || "",
    goal: row.goal || "",
    allergies: Array.isArray(row.allergies) ? row.allergies : [],
    updated_at: row.updated_at || null,
  };
}

async function getUser(supabase, body) {
  const id = requireUuid(body.userId);
  const { data, error } = await supabase.auth.admin.getUserById(id);
  if (error || !data?.user) throw httpError(404, "NOT_FOUND", "User not found.");
  const user = data.user;
  const [{ data: profile, error: profileError }, foodLog, bmiHistory, dailyLog] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, age, sex, height_cm, weight_kg, activity_level, goal, allergies, updated_at")
      .eq("id", id)
      .maybeSingle(),
    recentRows(supabase, "food_log", "id, food_name, calories, protein, carbs, fat, logged_at", id, "logged_at"),
    recentRows(supabase, "bmi_history", "id, bmi, category, goal, recorded_at, diet_plan", id, "recorded_at"),
    recentRows(supabase, "daily_log", "id, log_date, food_name, calories, meal, logged_at", id, "logged_at"),
  ]);
  if (profileError) throw httpError(500, "UNAVAILABLE", profileError.message || "Could not read the profile.");
  return {
    user: {
      id: user.id,
      email: user.email || "",
      name: displayName(user, profile),
      createdAt: user.created_at || null,
      lastSignInAt: user.last_sign_in_at || null,
    },
    profile: publicProfile(profile),
    foodLog,
    bmiHistory: bmiHistory.map(({ diet_plan, ...row }) => ({
      ...row,
      hasDietPlan: Boolean(diet_plan),
    })),
    dailyLog,
  };
}

function cleanProfile(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw httpError(400, "INVALID_INPUT", "profile is required.");
  }
  const patch = {};
  if ("full_name" in input) {
    if (input.full_name != null && typeof input.full_name !== "string") {
      throw httpError(400, "INVALID_INPUT", "full_name must be text.");
    }
    const name = String(input.full_name || "").trim();
    if (name.length > 120) throw httpError(400, "INVALID_INPUT", "full_name is too long.");
    patch.full_name = name || null;
  }
  if ("age" in input) {
    if (input.age == null || input.age === "") patch.age = null;
    else {
      const age = Number(input.age);
      if (!Number.isInteger(age) || age < 10 || age > 100) {
        throw httpError(400, "INVALID_INPUT", "age must be between 10 and 100.");
      }
      patch.age = age;
    }
  }
  if ("sex" in input) {
    const sex = input.sex == null ? "" : String(input.sex).trim();
    if (sex && !SEXES.has(sex)) throw httpError(400, "INVALID_INPUT", "sex must be male or female.");
    patch.sex = sex || null;
  }
  if ("height_cm" in input) patch.height_cm = boundedNumber(input.height_cm, "height_cm", 50, 272);
  if ("weight_kg" in input) patch.weight_kg = boundedNumber(input.weight_kg, "weight_kg", 20, 400);
  if ("activity_level" in input) {
    const activity = input.activity_level == null ? "" : String(input.activity_level).trim();
    if (activity && !ACTIVITIES.has(activity)) throw httpError(400, "INVALID_INPUT", "activity_level is not valid.");
    patch.activity_level = activity || null;
  }
  if ("goal" in input) {
    const goal = input.goal == null ? "" : String(input.goal).trim();
    if (goal && !GOALS.has(goal)) throw httpError(400, "INVALID_INPUT", "goal is not valid.");
    patch.goal = goal || null;
  }
  if ("allergies" in input) {
    if (!Array.isArray(input.allergies)) throw httpError(400, "INVALID_INPUT", "allergies must be a list.");
    if (input.allergies.length > 40) throw httpError(400, "INVALID_INPUT", "Too many allergies.");
    const allergies = [];
    for (const item of input.allergies) {
      if (typeof item !== "string") throw httpError(400, "INVALID_INPUT", "Each allergy must be text.");
      const text = item.trim();
      if (!text) continue;
      if (text.length > 80) throw httpError(400, "INVALID_INPUT", "An allergy is too long.");
      if (!allergies.includes(text)) allergies.push(text);
    }
    patch.allergies = allergies;
  }
  if (!Object.keys(patch).length) throw httpError(400, "INVALID_INPUT", "No profile fields to update.");
  return patch;
}

function boundedNumber(value, name, min, max) {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw httpError(400, "INVALID_INPUT", `${name} must be between ${min} and ${max}.`);
  }
  return Math.round(number * 10) / 10;
}

async function updateUser(supabase, body) {
  const id = requireUuid(body.userId);
  const { data, error } = await supabase.auth.admin.getUserById(id);
  if (error || !data?.user) throw httpError(404, "NOT_FOUND", "User not found.");
  const patch = cleanProfile(body.profile);
  const { error: updateError } = await supabase.from("profiles").upsert(
    { id, ...patch, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (updateError) throw httpError(500, "UNAVAILABLE", updateError.message || "Could not update the profile.");
  return { ok: true };
}

async function assertDeletable(supabase, actorId, targetId) {
  const id = requireUuid(targetId);
  if (id === actorId) {
    throw httpError(403, "CANNOT_DELETE_SELF", "An admin cannot delete their own account.");
  }
  if (await userIsAdmin(supabase, id)) {
    throw httpError(403, "CANNOT_DELETE_ADMIN", "An admin cannot delete another admin.");
  }
  return id;
}

async function deleteRows(supabase, userId) {
  for (const table of DATA_TABLES) {
    const column = table === "profiles" ? "id" : "user_id";
    const { error } = await supabase.from(table).delete().eq(column, userId);
    if (error) throw httpError(500, "UNAVAILABLE", error.message || "Could not delete user data.");
  }
}

async function deleteUserData(supabase, actorId, body) {
  const id = await assertDeletable(supabase, actorId, body.userId);
  await deleteRows(supabase, id);
  return { ok: true };
}

async function deleteUserAccount(supabase, actorId, body) {
  const id = await assertDeletable(supabase, actorId, body.userId);
  const { data, error } = await supabase.auth.admin.getUserById(id);
  if (error || !data?.user) throw httpError(404, "NOT_FOUND", "User not found.");
  await deleteRows(supabase, id);
  const { error: deleteError } = await supabase.auth.admin.deleteUser(id);
  if (deleteError) throw httpError(500, "UNAVAILABLE", deleteError.message || "Could not delete the account.");
  return { ok: true };
}

export default async function handler(req, res) {
  const method = String(req.method || "GET").toUpperCase();
  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const origin = requestOrigin(req);
  if ((origin && !isAllowedOrigin(origin)) || (method === "POST" && !origin)) {
    return fail(res, 403, "FORBIDDEN", "This admin action is not allowed from that site.");
  }
  if (method !== "GET" && method !== "POST") {
    return fail(res, 405, "METHOD", "Use GET or POST.");
  }

  const supabase = serviceClient();
  if (!supabase) return fail(res, 500, "UNAVAILABLE", "Admin service is not configured.");

  let user;
  try {
    user = await currentUser(supabase, req);
  } catch {
    return fail(res, 401, "UNAUTHORIZED", "Sign in again.");
  }

  if (method === "GET") {
    if (queryValue(req, "action") !== "whoami") {
      return fail(res, 400, "INVALID_INPUT", "Unknown action.");
    }
    if (!user) return send(res, 200, { isAdmin: false });
    try {
      return send(res, 200, { isAdmin: await userIsAdmin(supabase, user.id) });
    } catch (error) {
      return fail(res, error.status || 500, error.code || "UNAVAILABLE", error.message);
    }
  }

  if (!user) return fail(res, 401, "UNAUTHORIZED", "Sign in again.");
  try {
    if (!(await userIsAdmin(supabase, user.id))) {
      return fail(res, 403, "NOT_ADMIN", "You are not an admin.");
    }
    const body = await readJsonBody(req);
    const action = typeof body?.action === "string" ? body.action : "";
    if (action === "stats") return send(res, 200, await stats(supabase));
    if (action === "listUsers") return send(res, 200, await listUsers(supabase, body));
    if (action === "getUser") return send(res, 200, await getUser(supabase, body));
    if (action === "updateUser") return send(res, 200, await updateUser(supabase, body));
    if (action === "deleteUserData") return send(res, 200, await deleteUserData(supabase, user.id, body));
    if (action === "deleteUserAccount") return send(res, 200, await deleteUserAccount(supabase, user.id, body));
    return fail(res, 400, "INVALID_INPUT", "Unknown action.");
  } catch (error) {
    return fail(res, error.status || 500, error.code || "UNAVAILABLE", error.message || "The admin action failed.");
  }
}
