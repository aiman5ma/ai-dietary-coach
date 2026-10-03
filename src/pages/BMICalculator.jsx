import { useEffect, useId, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Loader2,
  RotateCcw,
  Scale,
  Sparkles,
} from "lucide-react";

import BMIGauge from "../components/BMIGauge.jsx";
import Toast from "../components/Toast.jsx";
import { getBMIAdvice } from "../api/openai.js";
import { useHistory } from "../context/historyContext.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import {
  ACTIVITY_LEVELS,
  calculateBMI,
  calculateBMR,
  calculateTDEE,
  calorieTargetForGoal,
  cmToFeetInches,
  feetInchesToCm,
  generateId,
  getBMICategory,
  kgToLbs,
  lbsToKg,
} from "../utils/bmi.js";

const REFERENCE_ROWS = [
  { key: "underweight", category: "Underweight", rangeKey: "bmi.rangeUnderweight", color: "#3b82f6" },
  { key: "normal", category: "Normal", rangeKey: "bmi.rangeNormal", color: "var(--accent-green)" },
  { key: "overweight", category: "Overweight", rangeKey: "bmi.rangeOverweight", color: "#f97316" },
  { key: "obese", category: "Obese", rangeKey: "bmi.rangeObese", color: "#ef4444" },
];

const CATEGORY_KEYS = {
  Underweight: "underweight",
  Normal: "normal",
  Overweight: "overweight",
  Obese: "obese",
};

const SEX_OPTIONS = [
  { id: "male", labelKey: "bmi.sexMale" },
  { id: "female", labelKey: "bmi.sexFemale" },
];

const GOAL_OPTIONS = [
  { id: "loss", labelKey: "bmi.goalLoss", hintKey: "bmi.targetLossHint" },
  { id: "maintain", labelKey: "bmi.goalMaintain", hintKey: "bmi.targetMaintainHint" },
  { id: "gain", labelKey: "bmi.goalGain", hintKey: "bmi.targetGainHint" },
];

const ACTIVITY_LABEL_KEYS = {
  sedentary: "bmi.activitySedentary",
  light: "bmi.activityLight",
  moderate: "bmi.activityModerate",
  very: "bmi.activityVery",
  extra: "bmi.activityExtra",
};

const SLOT_LABEL_KEYS = {
  breakfast: "bmi.breakfast",
  lunch: "bmi.lunch",
  dinner: "bmi.dinner",
  snack: "bmi.snack",
};

const labelClass =
  "text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal";

const round1 = (n) => Math.round(n * 10) / 10;

function formatKcal(value) {
  return Math.round(Number(value)).toLocaleString("en-US");
}

function formatHeightDisplay(display, t) {
  if (!display) return "";
  if (display.unit === "ft") return `${display.feet}′ ${display.inches}″`;
  return `${display.cm} ${t("common.centimeters")}`;
}

function formatWeightDisplay(display, t) {
  if (!display) return "";
  const unit = display.unit === "lbs" ? t("common.pounds") : t("common.kilograms");
  return `${display.value} ${unit}`;
}

function planToText(plan, result, t) {
  if (!plan) return "";
  const lines = [];
  if (plan.intro) lines.push(plan.intro, "");
  lines.push(
    `${t("bmi.tdee")}: ${formatKcal(result.tdee)} ${t("bmi.kcal")}`,
    `${t("bmi.calorieTarget")}: ${formatKcal(result.calorieTarget)} ${t("bmi.kcal")}`,
  );
  if (plan.proteinGrams != null && plan.carbGrams != null && plan.fatGrams != null) {
    lines.push(
      `${t("nutrition.protein")}: ${plan.proteinGrams} ${t("common.grams")}`,
      `${t("nutrition.carbs")}: ${plan.carbGrams} ${t("common.grams")}`,
      `${t("nutrition.fat")}: ${plan.fatGrams} ${t("common.grams")}`,
    );
  }
  if (plan.mealsPerDay) lines.push("", t("bmi.mealsPerDay", { count: plan.mealsPerDay }));
  if (plan.meals.length) {
    lines.push("", t("bmi.exampleMeals"));
    plan.meals.forEach((meal) => {
      const slot = SLOT_LABEL_KEYS[meal.slot] ? t(SLOT_LABEL_KEYS[meal.slot]) : meal.slot;
      const calories =
        meal.calories == null ? "" : ` (${t("bmi.approxCalories", { calories: formatKcal(meal.calories) })})`;
      lines.push(`${slot}: ${meal.title}${calories}`);
      if (meal.detail) lines.push(meal.detail);
    });
  }
  if (plan.prioritize.length) {
    lines.push("", t("bmi.prioritize"));
    plan.prioritize.forEach((item) => lines.push(`- ${item}`));
  }
  if (plan.limit.length) {
    lines.push("", t("bmi.limit"));
    plan.limit.forEach((item) => lines.push(`- ${item}`));
  }
  if (plan.guidance.length) {
    lines.push("", t("bmi.guidance"));
    plan.guidance.forEach((item) => lines.push(`- ${item}`));
  }
  return lines.join("\n").trim();
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-black/[0.03] dark:bg-white/[0.05] px-3 py-3 sm:px-4">
      <p className={`${labelClass}`}>{label}</p>
      <p className="mt-1 truncate text-base font-bold tabular-nums text-[var(--text-primary)] sm:text-xl">
        {value}
      </p>
      {hint ? (
        <p className="truncate text-[11px] text-[var(--text-secondary)]">{hint}</p>
      ) : null}
    </div>
  );
}

function UnitToggle({ value, options, onChange, ariaLabel }) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex overflow-hidden rounded-lg border border-[var(--border)] bg-black/[0.04] dark:bg-white/[0.06] text-[11px] font-semibold uppercase tracking-wider rtl:normal-case rtl:tracking-normal"
    >
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={isActive}
            className={[
              "btn-press px-2.5 py-1 transition-colors",
              isActive
                ? "bg-[var(--accent-green)]/15 text-[var(--accent-green)]"
                : "text-[var(--text-secondary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] hover:text-[var(--text-primary)]",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function ChoiceGroup({ label, value, options, onChange, columnsClass }) {
  return (
    <div className="min-w-0">
      <span className={labelClass}>{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className={columnsClass || "mt-2 grid grid-cols-2 gap-2"}
      >
        {options.map((opt) => {
          const isActive = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(opt.id)}
              className={[
                "btn-press rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors",
                isActive
                  ? "border-[var(--accent-green)]/40 bg-[var(--accent-green)]/15 text-[var(--accent-green)]"
                  : "border-[var(--border)] bg-black/[0.04] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NumberField({
  id,
  value,
  onChange,
  suffix,
  ariaLabel,
  min,
  max,
  step,
  placeholder,
  inputRef,
  flush = false,
}) {
  return (
    <div
      className={`${flush ? "" : "mt-2"} flex items-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-black/[0.04] dark:bg-white/[0.06] focus-within:border-[var(--accent-green)]/50`}
    >
      <input
        ref={inputRef}
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={onChange}
        className="w-full bg-transparent px-4 py-3 text-base text-[var(--text-primary)] [appearance:textfield] placeholder:text-[var(--text-secondary)]/70 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {suffix ? (
        <span className="grid place-items-center border-s border-[var(--border)] px-3 text-sm font-semibold text-[var(--accent-green)]">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

export default function BMICalculator() {
  const { t, lang } = useLanguage();
  const heightCmId = useId();
  const heightFtId = useId();
  const heightInId = useId();
  const weightId = useId();
  const ageId = useId();
  const activityId = useId();

  const [heightUnit, setHeightUnit] = useState("cm");
  const [heightCm, setHeightCm] = useState("170");
  const [heightFeet, setHeightFeet] = useState("5");
  const [heightInches, setHeightInches] = useState("7");

  const [weightUnit, setWeightUnit] = useState("kg");
  const [weightValue, setWeightValue] = useState("70");

  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [activity, setActivity] = useState("sedentary");
  const [goal, setGoal] = useState("maintain");

  const [result, setResult] = useState(null);
  const [plan, setPlan] = useState(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceError, setAdviceError] = useState("");

  const [errorKey, setErrorKey] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });

  const { addBmiEntry } = useHistory();

  const abortRef = useRef(null);
  const resultsRef = useRef(null);
  const ageRef = useRef(null);
  const heightRef = useRef(null);
  const weightRef = useRef(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!result) return undefined;
    const node = resultsRef.current;
    if (!node) return undefined;
    const id = requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [result]);

  function showToast(message, type = "success") {
    setToast({ visible: true, message, type });
  }
  function dismissToast() {
    setToast((current) => ({ ...current, visible: false }));
  }

  function changeHeightUnit(next) {
    if (next === heightUnit) return;
    if (next === "ft") {
      const cm = Number(heightCm);
      if (Number.isFinite(cm) && cm > 0) {
        const { feet, inches } = cmToFeetInches(cm);
        setHeightFeet(String(feet));
        setHeightInches(String(inches));
      }
    } else {
      const f = Number(heightFeet);
      const i = Number(heightInches);
      if ((Number.isFinite(f) && f >= 0) || (Number.isFinite(i) && i >= 0)) {
        const cm = feetInchesToCm(f || 0, i || 0);
        setHeightCm(String(Math.round(cm)));
      }
    }
    setHeightUnit(next);
    setErrorKey("");
  }

  function changeWeightUnit(next) {
    if (next === weightUnit) return;
    const n = Number(weightValue);
    if (Number.isFinite(n) && n > 0) {
      const converted = next === "kg" ? lbsToKg(n) : kgToLbs(n);
      setWeightValue(String(round1(converted)));
    }
    setWeightUnit(next);
    setErrorKey("");
  }

  function getHeightCm() {
    if (heightUnit === "cm") {
      const n = Number(heightCm);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    const f = Number(heightFeet) || 0;
    const i = Number(heightInches) || 0;
    if (f < 0 || i < 0) return null;
    const cm = feetInchesToCm(f, i);
    return cm > 0 ? cm : null;
  }

  function getWeightKg() {
    const n = Number(weightValue);
    if (!Number.isFinite(n) || n <= 0) return null;
    return weightUnit === "kg" ? n : lbsToKg(n);
  }

  function heightDisplayValue() {
    if (heightUnit === "cm") return { unit: "cm", cm: Math.round(Number(heightCm)) };
    return {
      unit: "ft",
      feet: Math.max(0, Math.floor(Number(heightFeet) || 0)),
      inches: Math.max(0, Math.round(Number(heightInches) || 0)),
    };
  }

  function weightDisplayValue() {
    return { unit: weightUnit, value: round1(Number(weightValue)) };
  }

  function formatHeightLong(cm) {
    if (heightUnit === "cm") return `${Math.round(Number(heightCm))} ${t("common.centimeters")}`;
    const f = Math.max(0, Math.floor(Number(heightFeet) || 0));
    const i = Math.max(0, Math.round(Number(heightInches) || 0));
    return `${f}′ ${i}″ · ${Math.round(cm)} ${t("common.centimeters")}`;
  }

  function formatWeightLong(kg) {
    const n = Number(weightValue);
    if (!Number.isFinite(n)) return "";
    if (weightUnit === "kg") return `${round1(n)} ${t("common.kilograms")}`;
    return `${round1(n)} ${t("common.pounds")} · ${round1(kg)} ${t("common.kilograms")}`;
  }

  async function fetchAdvice(snapshot) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAdviceLoading(true);
    setAdviceError("");
    setPlan(null);

    try {
      const nextPlan = await getBMIAdvice(
        {
          bmi: snapshot.bmi,
          category: snapshot.category,
          heightCm: snapshot.heightCm,
          weightKg: snapshot.weightKg,
          age: snapshot.age,
          sex: snapshot.sex,
          activityLevel: snapshot.activityLevel,
          goal: snapshot.goal,
          bmr: snapshot.bmr,
          tdee: snapshot.tdee,
          calorieTarget: snapshot.calorieTarget,
        },
        lang,
        { signal: controller.signal },
      );
      setPlan(nextPlan);
    } catch (err) {
      if (err?.name === "AbortError") return;
      setAdviceError(err?.message || "");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setAdviceLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const cm = getHeightCm();
    const kg = getWeightKg();
    const years = Number(age);

    if (cm === null) {
      setErrorKey("bmi.heightRequired");
      heightRef.current?.focus();
      return;
    }
    if (kg === null) {
      setErrorKey("bmi.weightRequired");
      weightRef.current?.focus();
      return;
    }
    if (!Number.isInteger(years) || years < 10 || years > 100) {
      setErrorKey("bmi.ageRequired");
      ageRef.current?.focus();
      return;
    }
    if (sex !== "male" && sex !== "female") {
      setErrorKey("bmi.sexRequired");
      return;
    }
    if (!ACTIVITY_LABEL_KEYS[activity]) {
      setErrorKey("bmi.activity");
      return;
    }
    if (!GOAL_OPTIONS.some((option) => option.id === goal)) {
      setErrorKey("bmi.goal");
      return;
    }

    setErrorKey("");
    setIsSaved(false);

    const bmi = calculateBMI(cm, kg);
    const cat = getBMICategory(bmi);
    const bmr = calculateBMR({ weightKg: kg, heightCm: cm, age: years, sex });
    const tdee = calculateTDEE(bmr, activity);
    const calorieTarget = calorieTargetForGoal(tdee, goal);

    const next = {
      id: generateId(),
      bmi,
      category: cat.category,
      categoryKey: CATEGORY_KEYS[cat.category],
      color: cat.color,
      heightCm: cm,
      weightKg: kg,
      heightDisplay: heightDisplayValue(),
      weightDisplay: weightDisplayValue(),
      heightLabel: formatHeightLong(cm),
      weightLabel: formatWeightLong(kg),
      age: years,
      sex,
      activityLevel: activity,
      goal,
      bmr,
      tdee,
      calorieTarget,
      language: lang,
    };
    setResult(next);
    fetchAdvice(next);
  }

  function handleRetryAdvice() {
    if (result) fetchAdvice(result);
  }

  async function handleCopyAdvice() {
    if (!plan || !result) return;
    try {
      await navigator.clipboard.writeText(planToText(plan, result, t));
      showToast(t("bmi.copied"), "success");
    } catch {
      showToast(t("bmi.copyFailed"), "error");
    }
  }

  function handleSave() {
    if (!result || isSaved || adviceLoading) return;
    const entry = {
      id: result.id,
      bmi: result.bmi,
      category: result.category,
      heightCm: result.heightCm,
      weightKg: result.weightKg,
      heightLabel: result.heightLabel,
      weightLabel: result.weightLabel,
      age: result.age,
      sex: result.sex,
      activityLevel: result.activityLevel,
      goal: result.goal,
      bmr: Math.round(result.bmr),
      tdee: result.tdee,
      calorieTarget: result.calorieTarget,
      advice: plan ? planToText(plan, result, t) : "",
      dietPlan: plan,
      date: Date.now(),
    };
    addBmiEntry(entry);
    setIsSaved(true);
    showToast(t("bmi.savedToast"), "success");
  }

  const sexChoices = SEX_OPTIONS.map((option) => ({
    ...option,
    label: t(option.labelKey),
  }));
  const goalChoices = GOAL_OPTIONS.map((option) => ({
    ...option,
    label: t(option.labelKey),
  }));

  return (
    <div className="relative text-left rtl:text-right">
      <header className="mb-6 sm:mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-green)] rtl:normal-case rtl:tracking-normal">
          {t("bmi.eyebrow")}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
          {t("bmi.title")}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)] sm:text-base">
          {t("bmi.subtitle")}
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.25)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.55)] backdrop-blur-md sm:p-6"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={labelClass}>{t("bmi.height")}</span>
              <UnitToggle
                ariaLabel={t("bmi.heightUnit")}
                value={heightUnit}
                onChange={changeHeightUnit}
                options={[
                  { value: "cm", label: t("common.centimeters") },
                  { value: "ft", label: t("common.feetInches") },
                ]}
              />
            </div>

            {heightUnit === "cm" ? (
              <NumberField
                id={heightCmId}
                inputRef={heightRef}
                value={heightCm}
                onChange={(e) => {
                  setHeightCm(e.target.value);
                  setErrorKey("");
                }}
                suffix={t("common.centimeters")}
                step="0.1"
                min="0"
                ariaLabel={t("bmi.height")}
              />
            ) : (
              <div className="mt-2 flex gap-2">
                <div className="min-w-0 flex-1">
                  <NumberField
                    id={heightFtId}
                    inputRef={heightRef}
                    flush
                    value={heightFeet}
                    onChange={(e) => {
                      setHeightFeet(e.target.value);
                      setErrorKey("");
                    }}
                    suffix={t("common.feet")}
                    step="1"
                    min="0"
                    ariaLabel={t("bmi.feetLabel")}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <NumberField
                    id={heightInId}
                    flush
                    value={heightInches}
                    onChange={(e) => {
                      setHeightInches(e.target.value);
                      setErrorKey("");
                    }}
                    suffix={t("common.inches")}
                    step="1"
                    min="0"
                    max="11"
                    ariaLabel={t("bmi.inchesLabel")}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={labelClass}>{t("bmi.weight")}</span>
              <UnitToggle
                ariaLabel={t("bmi.weightUnit")}
                value={weightUnit}
                onChange={changeWeightUnit}
                options={[
                  { value: "kg", label: t("common.kilograms") },
                  { value: "lbs", label: t("common.pounds") },
                ]}
              />
            </div>
            <NumberField
              id={weightId}
              inputRef={weightRef}
              value={weightValue}
              onChange={(e) => {
                setWeightValue(e.target.value);
                setErrorKey("");
              }}
              suffix={weightUnit === "kg" ? t("common.kilograms") : t("common.pounds")}
              step="0.1"
              min="0"
              ariaLabel={t("bmi.weight")}
            />
          </div>

          <div className="min-w-0">
            <label htmlFor={ageId} className={labelClass}>
              {t("bmi.age")}
            </label>
            <NumberField
              id={ageId}
              inputRef={ageRef}
              value={age}
              onChange={(e) => {
                setAge(e.target.value);
                setErrorKey("");
              }}
              suffix={t("bmi.ageUnit")}
              placeholder={t("bmi.agePlaceholder")}
              step="1"
              min="10"
              max="100"
              ariaLabel={t("bmi.age")}
            />
          </div>

          <ChoiceGroup
            label={t("bmi.sex")}
            value={sex}
            options={sexChoices}
            onChange={(next) => {
              setSex(next);
              setErrorKey("");
            }}
          />
        </div>

        <div className="mt-5">
          <label htmlFor={activityId} className={labelClass}>
            {t("bmi.activity")}
          </label>
          <select
            id={activityId}
            value={activity}
            onChange={(e) => {
              setActivity(e.target.value);
              setErrorKey("");
            }}
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-black/[0.04] dark:bg-white/[0.06] px-4 py-3 text-base text-[var(--text-primary)] focus:border-[var(--accent-green)]/50 focus:outline-none"
          >
            {ACTIVITY_LEVELS.map((level) => (
              <option key={level.id} value={level.id}>
                {t(ACTIVITY_LABEL_KEYS[level.id])}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5">
          <ChoiceGroup
            label={t("bmi.goal")}
            value={goal}
            options={goalChoices}
            columnsClass="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3"
            onChange={(next) => {
              setGoal(next);
              setErrorKey("");
            }}
          />
        </div>

        <button
          type="submit"
          className="btn-press mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-green)] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[var(--on-accent)] dark:text-[#f0f6fc] transition-colors hover:bg-[var(--accent-green)]/90 active:bg-[var(--accent-green)]/80 rtl:normal-case rtl:tracking-normal"
        >
          <Scale className="h-4 w-4" aria-hidden="true" />
          {t("bmi.calculate")}
        </button>
      </form>

      {errorKey ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm"
        >
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-red-400"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-red-300">{t("common.checkInputs")}</p>
            <p className="mt-0.5 break-words text-red-200/80">{t(errorKey)}</p>
          </div>
        </div>
      ) : null}

      <div ref={resultsRef}>
        {result ? (
          <ResultsSection
            result={result}
            plan={plan}
            adviceLoading={adviceLoading}
            adviceError={adviceError}
            isSaved={isSaved}
            onRetryAdvice={handleRetryAdvice}
            onSave={handleSave}
            onCopyAdvice={handleCopyAdvice}
          />
        ) : null}
      </div>

      <ReferenceTable activeCategory={result?.category} />

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onDismiss={dismissToast}
      />
    </div>
  );
}

function ResultsSection({
  result,
  plan,
  adviceLoading,
  adviceError,
  isSaved,
  onRetryAdvice,
  onSave,
  onCopyAdvice,
}) {
  const { t } = useLanguage();
  const categoryLabel = t(`bmi.${result.categoryKey}`);
  const goalOption = GOAL_OPTIONS.find((option) => option.id === result.goal);

  return (
    <section key={result.id} className="fade-in-up mt-6">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.25)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.55)] backdrop-blur-md sm:p-6">
        <div className="flex flex-col items-center gap-3">
          <BMIGauge
            bmi={result.bmi}
            category={categoryLabel}
            color={result.color}
            label={t("bmi.gaugeLabel", { bmi: result.bmi.toFixed(1) })}
          />
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider rtl:normal-case rtl:tracking-normal"
            style={{
              backgroundColor: `${result.color}1f`,
              color: result.color,
            }}
          >
            {categoryLabel}
          </span>
          <p className="max-w-md text-center text-sm text-[var(--text-secondary)]">
            {t(`bmi.${result.categoryKey}Description`)}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3 [@media(min-width:380px)]:grid-cols-3">
          <StatCard label={t("bmi.height")} value={formatHeightDisplay(result.heightDisplay, t)} />
          <StatCard label={t("bmi.weight")} value={formatWeightDisplay(result.weightDisplay, t)} />
          <StatCard label={t("nav.bmi")} value={result.bmi.toFixed(1)} hint={categoryLabel} />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--accent-green)]/35 bg-[var(--accent-green)]/10 p-5 shadow-[0_8px_30px_rgba(45,158,95,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.45)] sm:p-6">
        <h2 className={`${labelClass} text-[var(--text-primary)]`}>{t("bmi.dailyCalories")}</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 min-[420px]:gap-3">
          <StatCard
            label={t("bmi.tdee")}
            value={`${formatKcal(result.tdee)} ${t("bmi.kcal")}`}
            hint={t("bmi.tdeeHint")}
          />
          <StatCard
            label={t("bmi.calorieTarget")}
            value={`${formatKcal(result.calorieTarget)} ${t("bmi.kcal")}`}
            hint={goalOption ? t(goalOption.hintKey) : ""}
          />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.25)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.55)] backdrop-blur-md sm:p-6">
        <div className="border-s-2 border-[var(--accent-green)] ps-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles
                className="h-4 w-4 shrink-0 text-[var(--accent-green)]"
                aria-hidden="true"
              />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-primary)] rtl:normal-case rtl:tracking-normal">
                {t("bmi.planTitle")}
              </h2>
            </div>
            {plan && !adviceLoading && !adviceError ? (
              <button
                type="button"
                onClick={onCopyAdvice}
                aria-label={t("bmi.copyAdvice")}
                className="btn-press inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.08] hover:text-[var(--text-primary)]"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{t("common.copy")}</span>
              </button>
            ) : null}
          </div>

          <div className="mt-3 min-h-[3.5rem] text-sm leading-relaxed text-[var(--text-primary)]/90">
            {adviceLoading ? (
              <div
                className="flex items-center gap-2 text-[var(--text-secondary)]"
                aria-live="polite"
              >
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t("bmi.planLoading")}
              </div>
            ) : adviceError ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-red-300/90">{adviceError || t("bmi.adviceFailed")}</p>
                <button
                  type="button"
                  onClick={onRetryAdvice}
                  className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/10"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("common.tryAgain")}
                </button>
              </div>
            ) : plan ? (
              <DietPlan plan={plan} />
            ) : (
              <p className="text-[var(--text-secondary)]">{t("bmi.noAdvice")}</p>
            )}
          </div>
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaved || adviceLoading}
            aria-pressed={isSaved}
            className={[
              "btn-press inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-200 sm:w-auto",
              isSaved
                ? "cursor-default border border-[var(--accent-green)]/30 bg-[var(--accent-green)]/15 text-[var(--accent-green)]"
                : "bg-[var(--accent-green)] text-[var(--on-accent)] dark:text-[#f0f6fc] hover:bg-[var(--accent-green)]/90 active:bg-[var(--accent-green)]/80",
              adviceLoading ? "cursor-wait opacity-70" : "",
            ].join(" ")}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            <span>{isSaved ? t("common.saved") : t("common.saveToHistory")}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function DietPlan({ plan }) {
  const { t } = useLanguage();
  const hasMacros =
    plan.proteinGrams != null && plan.carbGrams != null && plan.fatGrams != null;

  return (
    <div>
      {plan.intro ? <p className="whitespace-pre-wrap">{plan.intro}</p> : null}
      {plan.mealsPerDay ? (
        <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
          {t("bmi.mealsPerDay", { count: plan.mealsPerDay })}
        </p>
      ) : null}

      {hasMacros ? (
        <PlanBlock title={t("bmi.macroTargets")}>
          <dl className="grid grid-cols-3 gap-2">
            <MacroStat label={t("nutrition.protein")} grams={plan.proteinGrams} />
            <MacroStat label={t("nutrition.carbs")} grams={plan.carbGrams} />
            <MacroStat label={t("nutrition.fat")} grams={plan.fatGrams} />
          </dl>
        </PlanBlock>
      ) : null}

      {plan.meals.length ? (
        <PlanBlock title={t("bmi.exampleMeals")}>
          <ul className="flex flex-col gap-2">
            {plan.meals.map((meal, index) => {
              const slotLabel = SLOT_LABEL_KEYS[meal.slot] ? t(SLOT_LABEL_KEYS[meal.slot]) : "";
              return (
                <li
                  key={`${meal.slot}-${index}`}
                  className="rounded-xl border border-[var(--border)] bg-black/[0.03] dark:bg-white/[0.05] px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {slotLabel ? (
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-green)] rtl:normal-case rtl:tracking-normal">
                          {slotLabel}
                        </p>
                      ) : null}
                      {meal.title ? (
                        <p className="font-semibold text-[var(--text-primary)]">{meal.title}</p>
                      ) : null}
                    </div>
                    {meal.calories != null ? (
                      <p className="shrink-0 text-sm font-bold tabular-nums text-[var(--accent-green)]">
                        {t("bmi.approxCalories", { calories: formatKcal(meal.calories) })}
                      </p>
                    ) : null}
                  </div>
                  {meal.detail ? (
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{meal.detail}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </PlanBlock>
      ) : null}

      {plan.prioritize.length || plan.limit.length ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {plan.prioritize.length ? (
            <FoodList title={t("bmi.prioritize")} items={plan.prioritize} tone="good" />
          ) : null}
          {plan.limit.length ? (
            <FoodList title={t("bmi.limit")} items={plan.limit} tone="limit" />
          ) : null}
        </div>
      ) : null}

      {plan.guidance.length ? (
        <PlanBlock title={t("bmi.guidance")}>
          <ul className="flex flex-col gap-2">
            {plan.guidance.map((item, index) => (
              <li
                key={`${index}-${item}`}
                className="rounded-xl border border-[var(--border)] bg-black/[0.03] dark:bg-white/[0.05] px-3 py-2.5 text-sm"
              >
                {item}
              </li>
            ))}
          </ul>
        </PlanBlock>
      ) : null}
    </div>
  );
}

function PlanBlock({ title, children }) {
  return (
    <div className="mt-5">
      <h3 className={labelClass}>{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function MacroStat({ label, grams }) {
  const { t } = useLanguage();
  return (
    <div className="rounded-xl border border-[var(--border)] bg-black/[0.03] dark:bg-white/[0.05] px-2 py-2.5 text-center">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-bold tabular-nums text-[var(--text-primary)]">
        {grams} {t("common.grams")}
      </dd>
    </div>
  );
}

function FoodList({ title, items, tone }) {
  const toneClass =
    tone === "good"
      ? "border-[var(--accent-green)]/25 bg-[var(--accent-green)]/10"
      : "border-orange-500/25 bg-orange-500/10";
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <h3 className={labelClass}>{title}</h3>
      <ul className="mt-2 flex list-disc flex-col gap-1 ps-4 text-sm">
        {items.map((item, index) => (
          <li key={`${index}-${item}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ReferenceTable({ activeCategory }) {
  const { t } = useLanguage();
  return (
    <section className="mt-8">
      <h2 className={labelClass}>{t("bmi.reference")}</h2>
      <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] backdrop-blur-md">
        <table className="w-full text-left text-sm rtl:text-right">
          <thead className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal">
            <tr>
              <th className="px-4 py-2.5 font-semibold">{t("bmi.category")}</th>
              <th className="px-4 py-2.5 font-semibold">{t("bmi.range")}</th>
            </tr>
          </thead>
          <tbody>
            {REFERENCE_ROWS.map(({ key, category, rangeKey, color }, i) => {
              const isActive = activeCategory === category;
              return (
                <tr
                  key={category}
                  className={i > 0 ? "border-t border-[var(--border)]" : ""}
                  style={isActive ? { backgroundColor: `${color}14` } : undefined}
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      <span
                        className="font-medium"
                        style={{ color: isActive ? color : "var(--text-primary)" }}
                      >
                        {t(`bmi.${key}`)}
                      </span>
                      {isActive ? (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider rtl:normal-case rtl:tracking-normal"
                          style={{ backgroundColor: `${color}26`, color }}
                        >
                          {t("common.you")}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[var(--text-secondary)]">
                    {t(rangeKey)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
