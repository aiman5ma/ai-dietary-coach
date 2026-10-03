import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Flame, History, Loader2, Plus, Scale, Sparkles, Trash2, UtensilsCrossed, X } from "lucide-react";

import MacroBar from "../components/MacroBar.jsx";
import MealPicker from "../components/MealPicker.jsx";
import { MEAL_IDS, mealForNow, mealLabelKey } from "../utils/meals.js";
import { getDailySummary } from "../api/openai.js";
import { useHistory } from "../context/historyContext.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { generateId } from "../utils/bmi.js";
import {
  addDailyFood,
  clearDailyFood,
  ensureTodayLog,
  readCalorieTarget,
  removeDailyFood,
} from "../utils/dailyLog.js";

const SOURCE_META = {
  analyzed: {
    key: "tracker.sourceAnalyzed",
    className: "bg-sky-500/10 text-sky-800 dark:text-sky-300",
  },
  scanner: {
    key: "tracker.sourceScanner",
    className: "bg-violet-500/10 text-violet-800 dark:text-violet-300",
  },
  manual: {
    key: "tracker.sourceManual",
    className: "bg-[var(--accent-green)]/10 text-[var(--accent-green)]",
  },
};

function sourceMeta(source) {
  if (source === "scanner" || source === "photo") return SOURCE_META.scanner;
  if (source === "analyzed") return SOURCE_META.analyzed;
  return SOURCE_META.manual;
}

function recentFoods(log, limit = 10) {
  const seen = new Set();
  const items = [];
  const list = Array.isArray(log) ? log : [];
  for (const entry of list) {
    const children =
      Array.isArray(entry?.foods) && entry.foods.length > 0 ? entry.foods : [entry];
    const source = entry?.type === "photo" ? "scanner" : "analyzed";
    for (const food of children) {
      const foodName = String(food?.foodName || "").trim();
      if (!foodName) continue;
      const key = foodName.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        foodName,
        calories: Number(food.calories) || 0,
        protein: Number(food.protein) || 0,
        carbs: Number(food.carbs) || 0,
        fat: Number(food.fat) || 0,
        fiber: Number(food.fiber) || 0,
        sugar: Number(food.sugar) || 0,
        source,
      });
      if (items.length >= limit) return items;
    }
  }
  return items;
}

function emptyDraft(meal = "breakfast") {
  return {
    foodName: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    fiber: "",
    sugar: "",
    meal,
  };
}

const MACRO_FIELDS = [
  { key: "protein", labelKey: "nutrition.protein" },
  { key: "carbs", labelKey: "nutrition.carbs" },
  { key: "fat", labelKey: "nutrition.fat" },
  { key: "fiber", labelKey: "nutrition.fiber" },
];

function round(value) {
  return Math.round(Number(value) || 0);
}

function withTimestamp(fields) {
  return { ...fields, timestamp: Date.now() };
}

function sumKey(entries, key) {
  return entries.reduce((sum, entry) => sum + (Number(entry?.[key]) || 0), 0);
}

function macroGoals(target) {
  const kcal = target.calorieTarget;
  return {
    protein: target.protein ?? Math.round((kcal * 0.3) / 4),
    carbs: target.carbs ?? Math.round((kcal * 0.4) / 4),
    fat: target.fat ?? Math.round((kcal * 0.3) / 9),
    fiber: Math.max(25, Math.round((kcal / 1000) * 14)),
  };
}

function progressTone(consumed, target) {
  if (!target || consumed <= 0) return "#2d9e5f";
  const ratio = consumed / target;
  if (ratio > 1) return "#ef4444";
  if (ratio >= 0.9) return "#f59e0b";
  return "#2d9e5f";
}

function GoalRing({ consumed, target, color }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const ratio = target > 0 ? Math.min(consumed / target, 1) : 0;
  const dash = ratio * circumference;
  return (
    <svg viewBox="0 0 140 140" className="h-40 w-40" aria-hidden="true">
      <circle
        cx="70"
        cy="70"
        r={radius}
        fill="none"
        stroke="var(--gauge-track)"
        strokeWidth="12"
      />
      <circle
        cx="70"
        cy="70"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference - dash}`}
        transform="rotate(-90 70 70)"
      />
    </svg>
  );
}

function SummaryCard({ summary, t }) {
  return (
    <div className="mt-4 flex flex-col gap-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur-md dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(22,27,34,0.95)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.55)]">
      {summary.overall ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal">
            {t("tracker.summaryOverall")}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-primary)]">{summary.overall}</p>
        </div>
      ) : null}

      {summary.positives.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal">
            {t("tracker.summaryPositives")}
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {summary.positives.map((item, index) => (
              <li key={`${index}-${item}`} className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--accent-green)]/15 text-[var(--accent-green)]">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.improvements.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal">
            {t("tracker.summaryImprovements")}
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {summary.improvements.map((item, index) => (
              <li key={`${index}-${item}`} className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500"
                  aria-hidden="true"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.macroBalance ? (
        <p className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
          <Scale className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-green)]" aria-hidden="true" />
          <span>
            <span className="font-semibold">{t("tracker.summaryMacro")}: </span>
            {summary.macroBalance}
          </span>
        </p>
      ) : null}

      {summary.nextMeal ? (
        <div className="rounded-xl border border-[var(--accent-green)]/30 bg-[var(--accent-green)]/10 px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent-green)] rtl:normal-case rtl:tracking-normal">
            <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
            {t("tracker.summaryNext")}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-primary)]">{summary.nextMeal}</p>
        </div>
      ) : null}
    </div>
  );
}

function MacroCard({ label, grams, goal, unit }) {
  const width = goal > 0 ? Math.min(100, (grams / goal) * 100) : 0;
  const over = goal > 0 && grams > goal;
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-black/[0.03] px-3 py-3 dark:bg-white/[0.05]">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums text-[var(--text-primary)]">
        {round(grams)}
        <span className="ms-1 text-xs font-normal text-[var(--text-secondary)]">{unit}</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${width}%`,
            backgroundColor: over ? "#ef4444" : "var(--accent-green)",
          }}
        />
      </div>
    </div>
  );
}

function FoodEntry({ entry, locale, t, onDelete }) {
  const source = sourceMeta(entry.source);
  const time = entry.timestamp
    ? new Date(entry.timestamp).toLocaleTimeString(locale === "ar" ? "ar-EG-u-nu-arab" : "en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  return (
    <li className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-3 dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(22,27,34,0.95)]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[var(--text-primary)]">{entry.foodName}</p>
          {time ? <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{time}</p> : null}
          <span
            className={[
              "mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
              source.className,
            ].join(" ")}
          >
            {t(source.key)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <p className="text-end text-lg font-bold tabular-nums text-[var(--text-primary)]">
            {round(entry.calories)}
            <span className="ms-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal">
              {t("history.kcal")}
            </span>
          </p>
          <button
            type="button"
            onClick={() => onDelete(entry.id)}
            aria-label={t("tracker.delete")}
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-secondary)] hover:bg-black/[0.04] hover:text-[#ef4444] dark:hover:bg-white/[0.08]"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="mt-3">
        <MacroBar compact protein={entry.protein} carbs={entry.carbs} fat={entry.fat} />
      </div>
    </li>
  );
}

export default function CalorieTracker() {
  const { t, lang } = useLanguage();
  const { foodLog } = useHistory();
  const [entries, setEntries] = useState(() => ensureTodayLog());
  const [target] = useState(() => readCalorieTarget());
  const [showForm, setShowForm] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [formError, setFormError] = useState("");
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const summaryAbort = useRef(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyMeal, setHistoryMeal] = useState("lunch");
  const [draft, setDraft] = useState(() => emptyDraft());
  const formRef = useRef(null);

  const consumed = sumKey(entries, "calories");
  const goals = useMemo(() => (target ? macroGoals(target) : null), [target]);
  const tone = progressTone(consumed, target?.calorieTarget || 0);
  const remaining = target ? target.calorieTarget - consumed : 0;
  const locale = lang === "ar" ? "ar" : "en";
  const historyItems = useMemo(() => recentFoods(foodLog), [foodLog]);

  useEffect(() => {
    const abort = summaryAbort;
    return () => abort.current?.abort();
  }, []);

  useEffect(() => {
    if (!historyOpen) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setHistoryOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [historyOpen]);

  function clearSummary() {
    summaryAbort.current?.abort();
    setSummary(null);
    setSummaryError("");
    setSummaryLoading(false);
  }

  function updateDraft(key, value) {
    setFormError("");
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function resetDraft(meal = "breakfast") {
    setDraft(emptyDraft(meal));
    setFormError("");
  }

  function openHistoryPanel() {
    setHistoryMeal(mealForNow());
    setHistoryOpen(true);
  }

  function addFromHistory(food) {
    const next = addDailyFood(
      withTimestamp({
        id: generateId(),
        foodName: food.foodName,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        fiber: food.fiber,
        sugar: food.sugar,
        source: food.source,
        meal: MEAL_IDS.includes(historyMeal) ? historyMeal : "snack",
      }),
    );
    setEntries(next);
    clearSummary();
  }

  function openForm(meal) {
    setFormError("");
    setConfirmingClear(false);
    setDraft((current) => ({ ...current, meal: meal || mealForNow() }));
    setShowForm(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ block: "center" });
    });
  }

  function handleAdd(event) {
    event.preventDefault();
    const foodName = draft.foodName.trim();
    const calories = Number(draft.calories);
    if (!foodName) {
      setFormError("tracker.nameRequired");
      return;
    }
    if (!Number.isFinite(calories) || calories <= 0) {
      setFormError("tracker.caloriesRequired");
      return;
    }
    const optional = (key) => {
      const number = Number(draft[key]);
      return Number.isFinite(number) && number > 0 ? number : 0;
    };
    const next = addDailyFood(
      withTimestamp({
        id: generateId(),
        foodName,
        calories,
        protein: optional("protein"),
        carbs: optional("carbs"),
        fat: optional("fat"),
        fiber: optional("fiber"),
        sugar: optional("sugar"),
        source: "manual",
        meal: MEAL_IDS.includes(draft.meal) ? draft.meal : "snack",
      }),
    );
    setEntries(next);
    resetDraft(draft.meal);
    setShowForm(false);
    clearSummary();
  }

  function handleDelete(id) {
    setEntries(removeDailyFood(id));
    clearSummary();
  }

  function handleClear() {
    setEntries(clearDailyFood());
    setConfirmingClear(false);
    clearSummary();
  }

  async function handleSummary() {
    if (entries.length === 0 || summaryLoading) return;
    summaryAbort.current?.abort();
    const controller = new AbortController();
    summaryAbort.current = controller;
    setSummaryLoading(true);
    setSummaryError("");
    try {
      const result = await getDailySummary(
        entries,
        target?.goal ?? null,
        target?.calorieTarget ?? null,
        lang,
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setSummary(result);
    } catch (err) {
      if (err?.name === "AbortError" || controller.signal.aborted) return;
      setSummary(null);
      setSummaryError("tracker.summaryError");
    } finally {
      if (!controller.signal.aborted) setSummaryLoading(false);
    }
  }

  return (
    <div className="relative text-start">
      <header className="mb-6 sm:mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-green)] rtl:normal-case rtl:tracking-normal">
          {t("tracker.eyebrow")}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
          {t("tracker.title")}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)] sm:text-base">
          {t("tracker.subtitle")}
        </p>
      </header>

      {target ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur-md dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(22,27,34,0.95)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.55)] sm:p-6">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {t("tracker.goalTitle")}
          </h2>
          <div className="mt-4 flex flex-col items-center">
            <div className="relative grid place-items-center">
              <GoalRing
                consumed={consumed}
                target={target.calorieTarget}
                color={tone}
              />
              <div className="absolute text-center">
                <Flame className="mx-auto h-5 w-5" style={{ color: tone }} aria-hidden="true" />
                <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                  {round(consumed).toLocaleString(locale)}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm font-semibold tabular-nums text-[var(--text-primary)]">
              {t("tracker.consumedOf", {
                consumed: round(consumed).toLocaleString(locale),
                target: round(target.calorieTarget).toLocaleString(locale),
              })}
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {remaining >= 0
                ? t("tracker.remaining", { count: round(remaining).toLocaleString(locale) })
                : t("tracker.overBy", { count: round(Math.abs(remaining)).toLocaleString(locale) })}
            </p>
          </div>

          {goals ? (
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {MACRO_FIELDS.map(({ key, labelKey }) => (
                <MacroCard
                  key={key}
                  label={t(labelKey)}
                  grams={sumKey(entries, key)}
                  goal={goals[key]}
                  unit={t("common.grams")}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] p-6 text-center backdrop-blur-md dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(22,27,34,0.95)]">
          <p className="text-sm leading-relaxed text-[var(--text-primary)]">
            {t("tracker.needBmi")}
          </p>
          <Link
            to="/bmi"
            className="btn-press mt-4 inline-flex items-center justify-center rounded-xl bg-[var(--accent-green)] px-5 py-2.5 text-sm font-semibold text-[var(--on-accent)] dark:text-[#f0f6fc]"
          >
            {t("tracker.goToBmi")}
          </Link>
        </section>
      )}

      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {t("tracker.foodLog")}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openHistoryPanel}
              className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-black/[0.03] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] dark:bg-white/[0.05]"
            >
              <History className="h-4 w-4" aria-hidden="true" />
              {t("tracker.fromHistory")}
            </button>
            {!showForm ? (
            <button
              type="button"
              onClick={() => openForm()}
              className="btn-press inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-black/[0.03] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] dark:bg-white/[0.05]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("tracker.addManual")}
            </button>
          ) : null}
          </div>
        </div>

        {showForm ? (
          <form
            ref={formRef}
            onSubmit={handleAdd}
            className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(22,27,34,0.95)]"
          >
            <MealPicker value={draft.meal} onChange={(meal) => updateDraft("meal", meal)} />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                {t("tracker.foodName")}
                <input
                  type="text"
                  value={draft.foodName}
                  onChange={(event) => updateDraft("foodName", event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-black/[0.04] px-3 py-2.5 text-base text-[var(--text-primary)] focus:border-[var(--accent-green)]/50 focus:outline-none dark:bg-white/[0.06]"
                />
              </label>
              <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                {t("tracker.calories")}
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  value={draft.calories}
                  onChange={(event) => updateDraft("calories", event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-black/[0.04] px-3 py-2.5 text-base text-[var(--text-primary)] focus:border-[var(--accent-green)]/50 focus:outline-none dark:bg-white/[0.06]"
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-[var(--text-secondary)]">{t("tracker.optionalMacros")}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MACRO_FIELDS.map(({ key, labelKey }) => (
                <label key={key} className="block text-[10px] font-semibold text-[var(--text-secondary)]">
                  {t(labelKey)}
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    value={draft[key]}
                    onChange={(event) => updateDraft(key, event.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-black/[0.04] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-green)]/50 focus:outline-none dark:bg-white/[0.06]"
                  />
                </label>
              ))}
            </div>
            {formError ? (
              <p className="mt-3 text-sm text-red-700 dark:text-red-300">{t(formError)}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="submit"
                className="btn-press inline-flex items-center justify-center rounded-xl bg-[var(--accent-green)] px-4 py-2.5 text-sm font-semibold text-[var(--on-accent)] dark:text-[#f0f6fc]"
              >
                {t("tracker.add")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetDraft(draft.meal);
                }}
                className="btn-press inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)]"
              >
                {t("common.cancel")}
              </button>
            </div>
          </form>
        ) : null}

        <div className="mt-4 flex flex-col gap-5">
          {MEAL_IDS.map((mealId) => {
            const items = entries
              .filter((entry) => entry.meal === mealId)
              .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            const subtotal = sumKey(items, "calories");
            const label = t(mealLabelKey(mealId));
            return (
              <section key={mealId} aria-label={label}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{label}</h3>
                  {items.length > 0 ? (
                    <p className="text-sm font-semibold tabular-nums text-[var(--text-secondary)]">
                      {round(subtotal).toLocaleString(locale)}
                      <span className="ms-1 text-[10px] font-semibold uppercase tracking-wider rtl:normal-case rtl:tracking-normal">
                        {t("history.kcal")}
                      </span>
                    </p>
                  ) : null}
                </div>
                {items.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => openForm(mealId)}
                    aria-label={t("tracker.addToMeal", { meal: label })}
                    className="btn-press mt-2 flex w-full items-center justify-center rounded-xl border border-dashed border-[var(--border)] px-3 py-4 text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-green)]/40 hover:text-[var(--accent-green)]"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {items.map((entry) => (
                      <FoodEntry
                        key={entry.id}
                        entry={entry}
                        locale={locale}
                        t={t}
                        onDelete={handleDelete}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
          {entries.some((entry) => !MEAL_IDS.includes(entry.meal)) ? (
            <section aria-label={t("tracker.mealOther")}>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {t("tracker.mealOther")}
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {entries
                  .filter((entry) => !MEAL_IDS.includes(entry.meal))
                  .map((entry) => (
                    <FoodEntry
                      key={entry.id}
                      entry={entry}
                      locale={locale}
                      t={t}
                      onDelete={handleDelete}
                    />
                  ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end">
          {confirmingClear ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-black/[0.03] px-3 py-2 dark:bg-white/[0.05]">
              <span className="text-xs text-[var(--text-secondary)]">{t("tracker.clearPrompt")}</span>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--text-secondary)]"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg bg-red-500/15 px-2 py-1 text-xs font-semibold text-red-700 dark:text-red-300"
              >
                {t("tracker.confirmClear")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              disabled={entries.length === 0}
              className="btn-press inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[#ef4444] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t("tracker.clear")}
            </button>
          )}
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleSummary}
            disabled={entries.length === 0 || summaryLoading}
            aria-busy={summaryLoading}
            className="btn-press inline-flex items-center gap-2 rounded-xl bg-[var(--accent-green)] px-4 py-2.5 text-sm font-semibold text-[var(--on-accent)] disabled:cursor-not-allowed disabled:opacity-40 dark:text-[#f0f6fc]"
          >
            {summaryLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {summaryLoading ? t("tracker.summaryLoading") : t("tracker.smartSummary")}
          </button>
          {summaryError ? (
            <p className="mt-3 text-sm text-red-700 dark:text-red-300">{t(summaryError)}</p>
          ) : null}
          {summary ? <SummaryCard summary={summary} t={t} /> : null}
        </div>
      </section>

      {historyOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label={t("common.close")}
            onClick={() => setHistoryOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("tracker.historyTitle")}
            className="relative z-10 flex max-h-[80dvh] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.25)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(22,27,34,0.95)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.55)]"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                {t("tracker.historyTitle")}
              </h2>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                aria-label={t("common.close")}
                className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-secondary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-3">
              <MealPicker value={historyMeal} onChange={setHistoryMeal} />
            </div>
            {historyItems.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                {t("tracker.historyEmpty")}
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2 overflow-y-auto">
                {historyItems.map((food) => (
                  <li
                    key={food.foodName}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-black/[0.03] px-3 py-2.5 dark:bg-white/[0.05]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--text-primary)]">
                        {food.foodName}
                      </p>
                      <p className="text-xs tabular-nums text-[var(--text-secondary)]">
                        {round(food.calories).toLocaleString(locale)} {t("history.kcal")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addFromHistory(food)}
                      aria-label={t("tracker.historyAdd", { food: food.foodName })}
                      className="btn-press grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent-green)] text-[var(--on-accent)] dark:text-[#f0f6fc]"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
