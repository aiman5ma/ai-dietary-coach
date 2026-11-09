import { supabase } from "./supabase.js";

function logSupabaseError(error, action) {
  const message = error?.message || String(error);
  console.error(`[supabase] ${action}: ${message}`, error);
}

/** PostgREST uses PGRST116 when `.single()` finds zero rows. That is an empty account, not a failure. */
function isNoRows(error) {
  if (!error || error.code !== "PGRST116") return false;
  return /0 rows/i.test(`${error.details || ""} ${error.message || ""}`);
}

function readResult(data, error, action, empty) {
  if (isNoRows(error)) return empty;
  if (error) {
    logSupabaseError(error, action);
    throw error;
  }
  return data ?? empty;
}

function writeResult(data, error, action) {
  if (error) {
    logSupabaseError(error, action);
    throw error;
  }
  return data;
}

export async function saveProfile(profileData) {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        ...profileData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select()
    .single();
  return writeResult(data, error, "saveProfile");
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return readResult(data, error, "getProfile", null);
}

export async function saveFoodLog(entry) {
  const { data, error } = await supabase.from("food_log").insert(entry).select().single();
  return writeResult(data, error, "saveFoodLog");
}

export async function getFoodLog(userId) {
  const { data, error } = await supabase
    .from("food_log")
    .select("*")
    .eq("user_id", userId)
    .order("logged_at", { ascending: false });
  const rows = readResult(data, error, "getFoodLog", []);
  return Array.isArray(rows) ? rows : [];
}

export async function saveBMIHistory(entry) {
  const dietPlan = entry?.diet_plan;
  const row = {
    ...entry,
    diet_plan:
      dietPlan != null && typeof dietPlan !== "string" ? JSON.stringify(dietPlan) : dietPlan,
  };
  const { data, error } = await supabase.from("bmi_history").insert(row).select().single();
  return writeResult(data, error, "saveBMIHistory");
}

export async function getBMIHistory(userId) {
  const { data, error } = await supabase
    .from("bmi_history")
    .select("*")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false });
  const rows = readResult(data, error, "getBMIHistory", []);
  return Array.isArray(rows) ? rows : [];
}

export async function saveDailyLog(entry) {
  const { data, error } = await supabase.from("daily_log").insert(entry).select().single();
  return writeResult(data, error, "saveDailyLog");
}

export async function getDailyLog(userId, date) {
  const { data, error } = await supabase
    .from("daily_log")
    .select("*")
    .eq("user_id", userId)
    .eq("log_date", date)
    .order("id", { ascending: false });
  const rows = readResult(data, error, "getDailyLog", []);
  return Array.isArray(rows) ? rows : [];
}

export async function deleteDailyLogEntry(id) {
  const { error } = await supabase.from("daily_log").delete().eq("id", id);
  if (error) {
    logSupabaseError(error, "deleteDailyLogEntry");
    throw error;
  }
}
