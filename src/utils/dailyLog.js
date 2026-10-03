const LOG_KEY = "dietary_daily_log";
const DATE_KEY = "dietary_daily_log_date";
const ARCHIVE_KEY = "dietary_daily_log_archive";
const BMI_KEY = "dietary_bmi_history";
const DAILY_LOG_EVENT = "dietary-daily-log-change";

export function todayDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readArray(key) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readStoredDate() {
  if (typeof window === "undefined") return "";
  const raw = window.localStorage.getItem(DATE_KEY);
  if (!raw) return "";
  if (raw.startsWith('"')) {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "string" ? parsed : "";
    } catch {
      return raw;
    }
  }
  return raw;
}

function totalsFor(entries) {
  return entries.reduce(
    (acc, entry) => {
      acc.calories += Number(entry?.calories) || 0;
      acc.protein += Number(entry?.protein) || 0;
      acc.carbs += Number(entry?.carbs) || 0;
      acc.fat += Number(entry?.fat) || 0;
      acc.fiber += Number(entry?.fiber) || 0;
      acc.sugar += Number(entry?.sugar) || 0;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 },
  );
}

function archiveDay(dateKey, entries) {
  if (!dateKey || !entries.length || typeof window === "undefined") return;
  const archive = readArray(ARCHIVE_KEY);
  archive.unshift({
    date: dateKey,
    ...totalsFor(entries),
    count: entries.length,
  });
  window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
}

function writeLog(entries, dateKey) {
  window.localStorage.setItem(LOG_KEY, JSON.stringify(entries));
  window.localStorage.setItem(DATE_KEY, dateKey);
  window.dispatchEvent(new CustomEvent(DAILY_LOG_EVENT));
}

/** Roll the log forward when the stored day is no longer today. */
export function ensureTodayLog() {
  if (typeof window === "undefined") return [];
  const today = todayDateKey();
  const stored = readStoredDate();
  let entries = readArray(LOG_KEY);
  if (stored && stored !== today) {
    archiveDay(stored, entries);
    entries = [];
    writeLog(entries, today);
  } else if (stored !== today) {
    writeLog(entries, today);
  }
  return entries;
}

export function addDailyFood(entry) {
  const next = [entry, ...ensureTodayLog()];
  writeLog(next, todayDateKey());
  return next;
}

export function removeDailyFood(id) {
  const next = ensureTodayLog().filter((entry) => entry?.id !== id);
  writeLog(next, todayDateKey());
  return next;
}

export function clearDailyFood() {
  writeLog([], todayDateKey());
  return [];
}

/** Today's calorie total, or null when nothing is logged. */
export function readTodayCalories() {
  const entries = ensureTodayLog();
  if (!entries.length) return null;
  return Math.round(entries.reduce((sum, entry) => sum + (Number(entry?.calories) || 0), 0));
}

export function subscribeDailyLog(listener) {
  if (typeof window === "undefined") return () => {};
  const onChange = () => listener();
  window.addEventListener(DAILY_LOG_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(DAILY_LOG_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** Newest BMI history entry's calorie target, plus macro targets when saved. */
export function readCalorieTarget() {
  const history = readArray(BMI_KEY);
  const newest = [...history].sort((a, b) => {
    const aTime = new Date(a?.date ?? a?.timestamp ?? 0).getTime();
    const bTime = new Date(b?.date ?? b?.timestamp ?? 0).getTime();
    return bTime - aTime;
  })[0];
  const calorieTarget = Number(newest?.calorieTarget);
  if (!Number.isFinite(calorieTarget) || calorieTarget <= 0) return null;
  const plan = newest?.dietPlan;
  return {
    calorieTarget,
    goal: typeof newest?.goal === "string" ? newest.goal : null,
    protein: positive(plan?.proteinGrams),
    carbs: positive(plan?.carbGrams),
    fat: positive(plan?.fatGrams),
  };
}
