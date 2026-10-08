import { useEffect, useId, useState } from "react";
import { Loader2, UserRound } from "lucide-react";

import Toast from "../components/Toast.jsx";
import { useProfile } from "../context/ProfileContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { getProfile, saveProfile } from "../lib/storage.js";
import {
  ACTIVITY_LEVELS,
  cmToFeetInches,
  feetInchesToCm,
  kgToLbs,
  lbsToKg,
} from "../utils/bmi.js";

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

const ACTIVITY_LABEL_KEYS = {
  sedentary: "bmi.activitySedentary",
  light: "bmi.activityLight",
  moderate: "bmi.activityModerate",
  very: "bmi.activityVery",
  extra: "bmi.activityExtra",
};

const GOAL_OPTIONS = [
  { id: "loss", labelKey: "bmi.goalLoss" },
  { id: "maintain", labelKey: "bmi.goalMaintain" },
  { id: "gain", labelKey: "bmi.goalGain" },
];

const labelClass =
  "text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal";

const round1 = (n) => Math.round(n * 10) / 10;

function formFromProfile(profile) {
  return {
    fullName: profile.fullName || "",
    age: profile.age == null ? "" : String(profile.age),
    sex: profile.sex || "",
    heightUnit: "cm",
    heightCm: profile.heightCm == null ? "" : String(profile.heightCm),
    heightFeet: "",
    heightInches: "",
    weightUnit: "kg",
    weightValue: profile.weightKg == null ? "" : String(profile.weightKg),
    activityLevel: profile.activityLevel || "",
    goal: profile.goal || "",
    conditions: Array.isArray(profile.conditions) ? profile.conditions : [],
    otherConditions: profile.otherConditions || "",
  };
}

function heightCmFromForm(form) {
  if (form.heightUnit === "cm") {
    if (form.heightCm === "") return null;
    const n = Number(form.heightCm);
    return Number.isFinite(n) ? n : Number.NaN;
  }
  if (form.heightFeet === "" && form.heightInches === "") return null;
  const feet = Number(form.heightFeet) || 0;
  const inches = Number(form.heightInches) || 0;
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return Number.NaN;
  return feetInchesToCm(feet, inches);
}

function weightKgFromForm(form) {
  if (form.weightValue === "") return null;
  const n = Number(form.weightValue);
  if (!Number.isFinite(n)) return Number.NaN;
  return form.weightUnit === "lbs" ? lbsToKg(n) : n;
}

function validationKey(form) {
  if (form.age !== "") {
    const age = Number(form.age);
    if (!Number.isInteger(age) || age < 10 || age > 100) return "profile.ageInvalid";
  }
  const height = heightCmFromForm(form);
  if (Number.isNaN(height) || (height != null && (height < 50 || height > 300))) {
    return "profile.heightInvalid";
  }
  const weight = weightKgFromForm(form);
  if (Number.isNaN(weight) || (weight != null && (weight < 20 || weight > 400))) {
    return "profile.weightInvalid";
  }
  return "";
}

function canonicalFromForm(form) {
  const height = heightCmFromForm(form);
  const weight = weightKgFromForm(form);
  return {
    fullName: form.fullName.trim(),
    age: form.age === "" ? null : Number(form.age),
    sex: form.sex,
    heightCm: height == null ? null : round1(height),
    weightKg: weight == null ? null : round1(weight),
    activityLevel: form.activityLevel,
    goal: form.goal,
    conditions: form.conditions,
    otherConditions: form.otherConditions.trim(),
  };
}

function UnitToggle({ value, options, onChange, ariaLabel }) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex overflow-hidden rounded-lg border border-[var(--border)] bg-black/[0.04] text-[11px] font-semibold uppercase tracking-wider dark:bg-white/[0.06] rtl:normal-case rtl:tracking-normal"
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
                : "text-[var(--text-secondary)] hover:bg-black/[0.04] hover:text-[var(--text-primary)] dark:hover:bg-white/[0.08]",
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
                  : "border-[var(--border)] bg-black/[0.04] text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:bg-white/[0.06]",
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

function NumberField({ id, value, onChange, suffix, ariaLabel, min, max, step, flush = false }) {
  return (
    <div
      className={`${flush ? "" : "mt-2"} flex items-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-black/[0.04] focus-within:border-[var(--accent-green)]/50 dark:bg-white/[0.06]`}
    >
      <input
        id={id}
        type="number"
        inputMode="decimal"
        dir="ltr"
        step={step}
        min={min}
        max={max}
        value={value}
        aria-label={ariaLabel}
        onChange={onChange}
        className="w-full bg-transparent px-4 py-3 text-left text-base text-[var(--text-primary)] [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {suffix ? (
        <span className="grid place-items-center border-s border-[var(--border)] px-3 text-sm font-semibold text-[var(--accent-green)]">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

function ProfileForm({ initial, onSave }) {
  const { t } = useLanguage();
  const nameId = useId();
  const ageId = useId();
  const activityId = useId();
  const otherId = useId();
  const [form, setForm] = useState(() => formFromProfile(initial));
  const [errorKey, setErrorKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "", type: "success" });

  function patch(partial) {
    setForm((current) => ({ ...current, ...partial }));
    setErrorKey("");
  }

  function changeHeightUnit(next) {
    if (next === form.heightUnit) return;
    if (next === "ft") {
      const cm = Number(form.heightCm);
      if (Number.isFinite(cm) && cm > 0) {
        const converted = cmToFeetInches(cm);
        patch({
          heightUnit: next,
          heightFeet: String(converted.feet),
          heightInches: String(converted.inches),
        });
        return;
      }
    } else {
      const feet = Number(form.heightFeet);
      const inches = Number(form.heightInches);
      if ((Number.isFinite(feet) && feet > 0) || (Number.isFinite(inches) && inches > 0)) {
        patch({
          heightUnit: next,
          heightCm: String(Math.round(feetInchesToCm(feet || 0, inches || 0))),
        });
        return;
      }
    }
    patch({ heightUnit: next });
  }

  function changeWeightUnit(next) {
    if (next === form.weightUnit) return;
    const n = Number(form.weightValue);
    if (Number.isFinite(n) && n > 0) {
      const converted = next === "kg" ? lbsToKg(n) : kgToLbs(n);
      patch({ weightUnit: next, weightValue: String(round1(converted)) });
      return;
    }
    patch({ weightUnit: next });
  }

  function toggleCondition(id) {
    const next = form.conditions.includes(id)
      ? form.conditions.filter((item) => item !== id)
      : [...form.conditions, id];
    patch({ conditions: next });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const key = validationKey(form);
    if (key) {
      setErrorKey(key);
      return;
    }
    setSaving(true);
    setErrorKey("");
    try {
      await onSave(canonicalFromForm(form));
      setToast({ visible: true, message: t("profile.saved"), type: "success" });
    } catch {
      setErrorKey("profile.saveFailed");
    } finally {
      setSaving(false);
    }
  }

  const sexOptions = [
    { id: "male", label: t("bmi.sexMale") },
    { id: "female", label: t("bmi.sexFemale") },
  ];
  const goalOptions = GOAL_OPTIONS.map((option) => ({
    id: option.id,
    label: t(option.labelKey),
  }));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 backdrop-blur-md sm:p-5">
        <h2 className="text-base font-bold text-[var(--text-primary)]">{t("profile.personal")}</h2>

        <div className="mt-4">
          <label htmlFor={nameId} className={labelClass}>
            {t("landing.fullName")}
          </label>
          <input
            id={nameId}
            type="text"
            value={form.fullName}
            onChange={(event) => patch({ fullName: event.target.value })}
            placeholder={t("landing.fullNamePlaceholder")}
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-black/[0.04] px-4 py-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:border-[var(--accent-green)]/50 focus:outline-none dark:bg-white/[0.06]"
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={ageId} className={labelClass}>
              {t("bmi.age")}
            </label>
            <NumberField
              id={ageId}
              value={form.age}
              onChange={(event) => patch({ age: event.target.value })}
              suffix={t("bmi.ageUnit")}
              min="10"
              max="100"
              step="1"
              ariaLabel={t("bmi.age")}
            />
          </div>
          <ChoiceGroup
            label={t("bmi.sex")}
            value={form.sex}
            options={sexOptions}
            onChange={(sex) => patch({ sex })}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={labelClass}>{t("bmi.height")}</span>
              <UnitToggle
                ariaLabel={t("bmi.heightUnit")}
                value={form.heightUnit}
                onChange={changeHeightUnit}
                options={[
                  { value: "cm", label: t("common.centimeters") },
                  { value: "ft", label: t("common.feet") },
                ]}
              />
            </div>
            {form.heightUnit === "cm" ? (
              <NumberField
                value={form.heightCm}
                onChange={(event) => patch({ heightCm: event.target.value })}
                suffix={t("common.centimeters")}
                min="0"
                step="1"
                ariaLabel={t("bmi.height")}
              />
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <NumberField
                  flush
                  value={form.heightFeet}
                  onChange={(event) => patch({ heightFeet: event.target.value })}
                  suffix={t("common.feet")}
                  min="0"
                  max="8"
                  step="1"
                  ariaLabel={t("bmi.feetLabel")}
                />
                <NumberField
                  flush
                  value={form.heightInches}
                  onChange={(event) => patch({ heightInches: event.target.value })}
                  suffix={t("common.inches")}
                  min="0"
                  max="11"
                  step="1"
                  ariaLabel={t("bmi.inchesLabel")}
                />
              </div>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={labelClass}>{t("bmi.weight")}</span>
              <UnitToggle
                ariaLabel={t("bmi.weightUnit")}
                value={form.weightUnit}
                onChange={changeWeightUnit}
                options={[
                  { value: "kg", label: t("common.kilograms") },
                  { value: "lbs", label: t("common.pounds") },
                ]}
              />
            </div>
            <NumberField
              value={form.weightValue}
              onChange={(event) => patch({ weightValue: event.target.value })}
              suffix={form.weightUnit === "kg" ? t("common.kilograms") : t("common.pounds")}
              min="0"
              step="0.1"
              ariaLabel={t("bmi.weight")}
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor={activityId} className={labelClass}>
            {t("bmi.activity")}
          </label>
          <select
            id={activityId}
            value={form.activityLevel}
            onChange={(event) => patch({ activityLevel: event.target.value })}
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-black/[0.04] px-4 py-3 text-base text-[var(--text-primary)] focus:border-[var(--accent-green)]/50 focus:outline-none dark:bg-white/[0.06]"
          >
            <option value="">{t("profile.select")}</option>
            {ACTIVITY_LEVELS.map((level) => (
              <option key={level.id} value={level.id}>
                {t(ACTIVITY_LABEL_KEYS[level.id])}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4">
          <ChoiceGroup
            label={t("bmi.goal")}
            value={form.goal}
            options={goalOptions}
            columnsClass="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3"
            onChange={(goal) => patch({ goal: form.goal === goal ? "" : goal })}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 backdrop-blur-md sm:p-5">
        <h2 className="text-base font-bold text-[var(--text-primary)]">{t("profile.health")}</h2>
        <p className="mt-3 rounded-xl border border-[var(--accent-green)]/25 bg-[var(--accent-green)]/10 px-3 py-2.5 text-sm leading-relaxed text-[var(--text-secondary)]">
          {t("profile.privacyNote")}
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {CONDITION_IDS.map((id) => {
            const checked = form.conditions.includes(id);
            return (
              <li key={id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] bg-black/[0.03] px-3 py-2.5 text-sm text-[var(--text-primary)] dark:bg-white/[0.04]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCondition(id)}
                    className="h-4 w-4 shrink-0 accent-[var(--accent-green)]"
                  />
                  <span>{t(`profile.${id}`)}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="mt-4">
          <label htmlFor={otherId} className={labelClass}>
            {t("profile.other")}
          </label>
          <textarea
            id={otherId}
            rows={3}
            value={form.otherConditions}
            onChange={(event) => patch({ otherConditions: event.target.value })}
            placeholder={t("profile.otherPlaceholder")}
            className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-black/[0.04] px-4 py-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:border-[var(--accent-green)]/50 focus:outline-none dark:bg-white/[0.06]"
          />
        </div>
      </section>

      {errorKey ? (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
          {t(errorKey)}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="btn-press inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-green)] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-green)]/90 disabled:opacity-70 dark:text-[#f0f6fc] rtl:normal-case rtl:tracking-normal"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <UserRound className="h-4 w-4" aria-hidden="true" />
        )}
        {saving ? t("common.loading") : t("profile.save")}
      </button>

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onDismiss={() => setToast((current) => ({ ...current, visible: false }))}
      />
    </form>
  );
}

export default function ProfilePage() {
  const { t } = useLanguage();
  const { replaceProfile } = useProfile();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      setError("");
      try {
        const next = await getProfile();
        if (!active) return;
        setProfile(next);
        replaceProfile(next);
      } catch {
        if (active) setError("storage.loadFailed");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [replaceProfile]);

  async function onSave(data) {
    const saved = await saveProfile(data);
    setProfile(saved);
    replaceProfile(saved);
    return saved;
  }

  return (
    <div className="relative text-left rtl:text-right">
      <header className="mb-6 sm:mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-green)] rtl:normal-case rtl:tracking-normal">
          {t("profile.eyebrow")}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
          {t("profile.title")}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)] sm:text-base">
          {t("profile.subtitle")}
        </p>
      </header>

      {loading ? (
        <div className="grid min-h-40 place-items-center text-[var(--text-secondary)]">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-green)]" aria-label={t("common.loading")} />
        </div>
      ) : error && !profile ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          {t(error)}
        </p>
      ) : (
        <ProfileForm initial={profile} onSave={onSave} />
      )}
    </div>
  );
}
