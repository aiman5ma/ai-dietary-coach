import {
  deleteDailyLogEntry,
  getBMIHistory as getBmiRows,
  getDailyLog as getDailyRows,
  getFoodLog,
  getProfile as getProfileRow,
  saveBMIHistory,
  saveDailyLog,
  saveFoodLog,
  saveProfile as saveProfileRow,
} from "./db.js";
import { supabase } from "./supabase.js";
import { addDailyFood, clearDailyFood, ensureTodayLog, removeDailyFood, todayDateKey } from "../utils/dailyLog.js";

const FOOD_KEY = "dietary_food_log";
const BMI_KEY = "dietary_bmi_history";
const MEAL_HISTORY_KEY = "dietary_meal_history";
const MEAL_HISTORY_LIMIT = 50;
const DAILY_KEY = "dietary_daily_log";
const DAILY_DATE_KEY = "dietary_daily_log_date";
const PROFILE_KEY = "dietary_profile";
const OTHER_PREFIX = "other:";
const FOOD_EVENT = "dietary-food-log-change";
const BMI_EVENT = "dietary-bmi-history-change";

const CONDITION_IDS = [
  "diabetes",
  "hypertension",
  "cholesterol",
  "celiac",
  "lactose",
  "nuts",
  "seafood",
  "vegetarian",
  "vegan",
];

let storageUser = null;

/** Keeps this module aligned with the user from useAuth. */
export function setStorageUser(user) {
  storageUser = user ?? null;
}

function currentUser() {
  return storageUser;
}

function readArray(key) {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeArray(key, list) {
  window.localStorage.setItem(key, JSON.stringify(list));
}

function dispatch(name) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name));
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function emptyProfile() {
  return {
    fullName: "",
    age: null,
    sex: "",
    heightCm: null,
    weightKg: null,
    activityLevel: "",
    goal: "",
    conditions: [],
    otherConditions: "",
  };
}

function allergiesFrom(conditions, otherConditions) {
  const list = [];
  const source = Array.isArray(conditions) ? conditions : [];
  for (const id of source) {
    if (CONDITION_IDS.includes(id) && !list.includes(id)) list.push(id);
  }
  const other = typeof otherConditions === "string" ? otherConditions.trim() : "";
  if (other) list.push(`${OTHER_PREFIX}${other}`);
  return list;
}

function profileFromAllergies(allergies) {
  const conditions = [];
  let otherConditions = "";
  if (!Array.isArray(allergies)) return { conditions, otherConditions };
  for (const item of allergies) {
    if (typeof item !== "string") continue;
    if (item.startsWith(OTHER_PREFIX)) otherConditions = item.slice(OTHER_PREFIX.length);
    else if (CONDITION_IDS.includes(item) && !conditions.includes(item)) conditions.push(item);
  }
  return { conditions, otherConditions };
}

function profileToRow(userId, data) {
  const source = data && typeof data === "object" ? data : {};
  if (source.full_name != null || source.height_cm != null || Array.isArray(source.allergies)) {
    return { ...source, id: userId };
  }
  const parsed = profileFromAllergies(source.allergies);
  const conditions = Array.isArray(source.conditions) ? source.conditions : parsed.conditions;
  return {
    id: userId,
    full_name: String(source.fullName || "").trim() || null,
    age: source.age == null || source.age === "" ? null : Number(source.age),
    sex: source.sex || null,
    height_cm: source.heightCm == null || source.heightCm === "" ? null : Number(source.heightCm),
    weight_kg: source.weightKg == null || source.weightKg === "" ? null : Number(source.weightKg),
    activity_level: source.activityLevel || null,
    goal: source.goal || null,
    allergies: allergiesFrom(conditions, source.otherConditions || parsed.otherConditions),
  };
}

function profileFromRow(row, user) {
  if (!row) {
    const metaName = user?.user_metadata?.full_name;
    return {
      ...emptyProfile(),
      fullName: typeof metaName === "string" ? metaName.trim() : "",
    };
  }
  const parsed = profileFromAllergies(row.allergies);
  const metaName = user?.user_metadata?.full_name;
  return {
    fullName: String(row.full_name || (typeof metaName === "string" ? metaName : "")).trim(),
    age: row.age == null ? null : Number(row.age),
    sex: row.sex === "male" || row.sex === "female" ? row.sex : "",
    heightCm: row.height_cm == null ? null : Number(row.height_cm),
    weightKg: row.weight_kg == null ? null : Number(row.weight_kg),
    activityLevel: row.activity_level || "",
    goal: row.goal || "",
    conditions: parsed.conditions,
    otherConditions: parsed.otherConditions,
  };
}

function readGuestProfile() {
  if (typeof window === "undefined") return emptyProfile();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROFILE_KEY) || "null");
    return parsed && typeof parsed === "object" ? parsed : emptyProfile();
  } catch {
    return emptyProfile();
  }
}

function foodToRow(userId, entry) {
  const stamp = entry?.date || entry?.timestamp || Date.now();
  return {
    user_id: userId,
    food_name: entry?.foodName || entry?.name || "",
    weight_grams: Number(entry?.weightGrams) || null,
    calories: Number(entry?.calories) || 0,
    protein: Number(entry?.protein) || 0,
    carbs: Number(entry?.carbs) || 0,
    fat: Number(entry?.fat) || 0,
    fiber: Number(entry?.fiber) || 0,
    sugar: Number(entry?.sugar) || 0,
    note: JSON.stringify(entry),
    logged_at: new Date(stamp).toISOString(),
  };
}

function foodFromRow(row) {
  const embedded = parseJson(row?.note);
  if (embedded?.foodName || embedded?.name) {
    return { ...embedded, id: row.id, date: row.logged_at || embedded.date };
  }
  return {
    id: row.id,
    foodName: row.food_name || "",
    weightGrams: row.weight_grams,
    calories: Number(row.calories) || 0,
    protein: Number(row.protein) || 0,
    carbs: Number(row.carbs) || 0,
    fat: Number(row.fat) || 0,
    fiber: Number(row.fiber) || 0,
    sugar: Number(row.sugar) || 0,
    note: typeof row.note === "string" ? row.note : "",
    date: row.logged_at,
  };
}

function dailyToRow(userId, entry) {
  const stamp = entry?.timestamp || entry?.date || Date.now();
  const when = new Date(stamp);
  return {
    user_id: userId,
    log_date: todayDateKey(Number.isNaN(when.getTime()) ? new Date() : when),
    food_name: entry?.foodName || "",
    calories: Number(entry?.calories) || 0,
    protein: Number(entry?.protein) || 0,
    carbs: Number(entry?.carbs) || 0,
    fat: Number(entry?.fat) || 0,
    fiber: Number(entry?.fiber) || 0,
    sugar: Number(entry?.sugar) || 0,
    source: entry?.source || "manual",
    meal: entry?.meal || null,
    note: JSON.stringify(entry),
  };
}

function dailyFromRow(row) {
  const embedded = parseJson(row?.note);
  if (embedded?.foodName) return { ...embedded, id: row.id };
  return {
    id: row.id,
    foodName: row.food_name || "",
    calories: Number(row.calories) || 0,
    protein: Number(row.protein) || 0,
    carbs: Number(row.carbs) || 0,
    fat: Number(row.fat) || 0,
    fiber: Number(row.fiber) || 0,
    sugar: Number(row.sugar) || 0,
    source: row.source || "manual",
    meal: row.meal || "",
    timestamp: row.logged_at || row.created_at || row.log_date,
  };
}

function bmiToRow(userId, entry) {
  const stamp = entry?.date || Date.now();
  return {
    user_id: userId,
    bmi: entry.bmi,
    category: entry.category,
    height_cm: entry.heightCm,
    weight_kg: entry.weightKg,
    age: entry.age,
    sex: entry.sex,
    activity_level: entry.activityLevel,
    goal: entry.goal,
    diet_plan: { entry },
    recorded_at: new Date(stamp).toISOString(),
  };
}

function bmiFromRow(row) {
  let plan = row?.diet_plan;
  if (typeof plan === "string") plan = parseJson(plan);
  if (plan?.entry) {
    return { ...plan.entry, id: row.id, date: row.recorded_at || plan.entry.date };
  }
  return {
    id: row.id,
    bmi: Number(row.bmi),
    category: row.category || "",
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    age: row.age,
    sex: row.sex,
    activityLevel: row.activity_level || "",
    goal: row.goal || "",
    dietPlan: plan,
    date: row.recorded_at,
  };
}

function profileHasData(profile) {
  if (!profile || typeof profile !== "object") return false;
  return Boolean(
    profile.fullName ||
      profile.full_name ||
      profile.age ||
      profile.heightCm ||
      profile.height_cm ||
      profile.weightKg ||
      profile.weight_kg ||
      profile.sex ||
      (Array.isArray(profile.conditions) && profile.conditions.length) ||
      (Array.isArray(profile.allergies) && profile.allergies.length) ||
      profile.otherConditions,
  );
}

export async function logFood(entry) {
  const user = currentUser();
  if (!user) {
    const next = [entry, ...readArray(FOOD_KEY)];
    writeArray(FOOD_KEY, next);
    dispatch(FOOD_EVENT);
    return entry;
  }
  const row = await saveFoodLog(foodToRow(user.id, entry));
  const saved = foodFromRow(row);
  dispatch(FOOD_EVENT);
  return saved;
}

export async function getFoods() {
  const user = currentUser();
  if (!user) return readArray(FOOD_KEY);
  const rows = await getFoodLog(user.id);
  return rows.map(foodFromRow);
}

export async function logBMI(entry) {
  const user = currentUser();
  if (!user) {
    const next = [entry, ...readArray(BMI_KEY)];
    writeArray(BMI_KEY, next);
    dispatch(BMI_EVENT);
    return entry;
  }
  const row = await saveBMIHistory(bmiToRow(user.id, entry));
  const saved = bmiFromRow(row);
  dispatch(BMI_EVENT);
  return saved;
}

export async function getBMIHistory() {
  const user = currentUser();
  if (!user) return readArray(BMI_KEY);
  const rows = await getBmiRows(user.id);
  return rows.map(bmiFromRow);
}

function tidyMealName(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text
    .replace(/\s*[,،]?\s*\d+(?:[.,]\d+)?\s*(?:g|غ|grams?|جرام|ml|مل|kcal|سعرة)\b.*$/i, "")
    .trim();
}

/** Meal titles and ingredient names from one saved or generated diet plan. */
export function extractMealNames(plan) {
  let source = plan;
  if (typeof source === "string") source = parseJson(source);
  if (!source || typeof source !== "object") return [];
  const names = [];
  const meals = Array.isArray(source.meals) ? source.meals : [];
  for (const meal of meals) {
    if (meal?.title) names.push(meal.title);
    const options = Array.isArray(meal?.options) ? meal.options : [];
    if (!options.length && meal?.detail) names.push(meal.detail);
    for (const option of options) {
      if (option?.title) names.push(option.title);
      const items = Array.isArray(option?.items) ? option.items : [];
      for (const item of items) {
        if (item?.name) names.push(item.name);
      }
    }
  }
  return names;
}

function capMealNames(names) {
  const cleaned = [];
  for (const name of names || []) {
    const tidy = tidyMealName(name);
    if (tidy) cleaned.push(tidy);
  }
  const seen = new Set();
  const newestFirst = [];
  for (let index = cleaned.length - 1; index >= 0; index -= 1) {
    const key = cleaned[index].toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    newestFirst.push(cleaned[index]);
  }
  return newestFirst.reverse().slice(-MEAL_HISTORY_LIMIT);
}

function readStoredMeals() {
  return readArray(MEAL_HISTORY_KEY).filter((item) => typeof item === "string");
}

function writeStoredMeals(names) {
  writeArray(MEAL_HISTORY_KEY, capMealNames(names));
}

/**
 * Last five saved diet plans, plus the running meal list.
 * Logged-in users read plans from Supabase. Guests read localStorage.
 */
export async function getPreviousMealHistory(userId) {
  const user = currentUser();
  const id = user?.id || (typeof userId === "string" ? userId : "");
  let entries;
  try {
    if (user?.id) {
      const rows = await getBmiRows(id || user.id);
      entries = (rows || []).slice(0, 5).map(bmiFromRow);
    } else {
      entries = readArray(BMI_KEY).slice(0, 5);
    }
  } catch {
    entries = user ? [] : readArray(BMI_KEY).slice(0, 5);
  }
  const fromPlans = [];
  for (const entry of entries) fromPlans.push(...extractMealNames(entry?.dietPlan));
  return capMealNames([...readStoredMeals(), ...fromPlans]);
}

/** Append meal names and keep the newest 50. */
export function rememberMealHistory(names) {
  const next = capMealNames([...readStoredMeals(), ...(Array.isArray(names) ? names : [])]);
  writeStoredMeals(next);
  return next;
}

export async function logDaily(entry) {
  const user = currentUser();
  if (!user) return addDailyFood(entry);
  const row = await saveDailyLog(dailyToRow(user.id, entry));
  const saved = dailyFromRow(row);
  dispatch("dietary-daily-log-change");
  return saved;
}

export async function getDailyLog(date = todayDateKey()) {
  const user = currentUser();
  if (!user) return ensureTodayLog();
  const rows = await getDailyRows(user.id, date);
  return rows.map(dailyFromRow);
}

export async function deleteDaily(id) {
  const user = currentUser();
  if (!user) return removeDailyFood(id);
  await deleteDailyLogEntry(id);
  dispatch("dietary-daily-log-change");
  return null;
}

export async function clearDaily(date = todayDateKey()) {
  const user = currentUser();
  if (!user) return clearDailyFood();
  const rows = await getDailyRows(user.id, date);
  await Promise.all(rows.map((row) => deleteDailyLogEntry(row.id)));
  dispatch("dietary-daily-log-change");
  return [];
}

export async function saveProfile(data) {
  const user = currentUser();
  if (!user) {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
    return data;
  }
  const row = await saveProfileRow(profileToRow(user.id, data));
  return profileFromRow(row, user);
}

export async function getProfile() {
  const user = currentUser();
  if (!user) return readGuestProfile();
  const row = await getProfileRow(user.id);
  return profileFromRow(row, user);
}

export function subscribeFoods(listener) {
  if (typeof window === "undefined") return () => {};
  const onChange = () => listener();
  window.addEventListener(FOOD_EVENT, onChange);
  return () => window.removeEventListener(FOOD_EVENT, onChange);
}

export function subscribeBmi(listener) {
  if (typeof window === "undefined") return () => {};
  const onChange = () => listener();
  window.addEventListener(BMI_EVENT, onChange);
  return () => window.removeEventListener(BMI_EVENT, onChange);
}

let migrationTask = null;

export function migrateLocalData(user) {
  if (!user?.id) return Promise.resolve({ migrated: false });
  if (migrationTask) return migrationTask;
  migrationTask = runMigration(user).finally(() => {
    migrationTask = null;
  });
  return migrationTask;
}

async function uploadList(key, list, save) {
  if (!list.length) return false;
  const remaining = [...list];
  while (remaining.length) {
    await save(remaining[0]);
    remaining.shift();
    if (remaining.length) writeArray(key, remaining);
    else window.localStorage.removeItem(key);
  }
  return true;
}

async function runMigration(user) {
  const foods = readArray(FOOD_KEY);
  const bmi = readArray(BMI_KEY);
  const daily = readArray(DAILY_KEY);
  const profile = readGuestProfile();
  const hasProfile = profileHasData(profile);
  if (!foods.length && !bmi.length && !daily.length && !hasProfile) return { migrated: false };

  let migrated = false;
  try {
    if (await uploadList(FOOD_KEY, foods, (entry) => saveFoodLog(foodToRow(user.id, entry)))) {
      migrated = true;
    }
  } catch {
    /* leave the remaining local rows in place */
  }
  try {
    if (await uploadList(BMI_KEY, bmi, (entry) => saveBMIHistory(bmiToRow(user.id, entry)))) {
      migrated = true;
    }
  } catch {
    /* leave the remaining local rows in place */
  }
  try {
    if (await uploadList(DAILY_KEY, daily, (entry) => saveDailyLog(dailyToRow(user.id, entry)))) {
      window.localStorage.removeItem(DAILY_DATE_KEY);
      migrated = true;
    }
  } catch {
    /* leave the remaining local rows in place */
  }
  if (hasProfile) {
    try {
      await saveProfileRow(profileToRow(user.id, profile));
      window.localStorage.removeItem(PROFILE_KEY);
      migrated = true;
    } catch {
      /* keep the local profile */
    }
  }
  return { migrated };
}

export async function clearFoods() {
  const user = currentUser();
  if (!user) {
    writeArray(FOOD_KEY, []);
    dispatch(FOOD_EVENT);
    return [];
  }
  if (!supabase) return [];
  const { error } = await supabase.from("food_log").delete().eq("user_id", user.id);
  if (error) throw error;
  dispatch(FOOD_EVENT);
  return [];
}

export async function clearBmiHistory() {
  const user = currentUser();
  if (!user) {
    writeArray(BMI_KEY, []);
    dispatch(BMI_EVENT);
    return [];
  }
  if (!supabase) return [];
  const { error } = await supabase.from("bmi_history").delete().eq("user_id", user.id);
  if (error) throw error;
  dispatch(BMI_EVENT);
  return [];
}
