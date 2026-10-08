import { supabase } from "./supabase.js";

function assertNoError(error) {
  if (error) throw error;
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
  assertNoError(error);
  return data;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  assertNoError(error);
  return data;
}

export async function saveFoodLog(entry) {
  const { data, error } = await supabase.from("food_log").insert(entry).select().single();
  assertNoError(error);
  return data;
}

export async function getFoodLog(userId) {
  const { data, error } = await supabase
    .from("food_log")
    .select("*")
    .eq("user_id", userId)
    .order("logged_at", { ascending: false });
  assertNoError(error);
  return data ?? [];
}

export async function saveBMIHistory(entry) {
  const dietPlan = entry?.diet_plan;
  const row = {
    ...entry,
    diet_plan:
      dietPlan != null && typeof dietPlan !== "string" ? JSON.stringify(dietPlan) : dietPlan,
  };
  const { data, error } = await supabase.from("bmi_history").insert(row).select().single();
  assertNoError(error);
  return data;
}

export async function getBMIHistory(userId) {
  const { data, error } = await supabase
    .from("bmi_history")
    .select("*")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false });
  assertNoError(error);
  return data ?? [];
}

export async function saveDailyLog(entry) {
  const { data, error } = await supabase.from("daily_log").insert(entry).select().single();
  assertNoError(error);
  return data;
}

export async function getDailyLog(userId, date) {
  const { data, error } = await supabase
    .from("daily_log")
    .select("*")
    .eq("user_id", userId)
    .eq("log_date", date)
    .order("id", { ascending: false });
  assertNoError(error);
  return data ?? [];
}

export async function deleteDailyLogEntry(id) {
  const { error } = await supabase.from("daily_log").delete().eq("id", id);
  assertNoError(error);
}
