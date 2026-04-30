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
import {
  calculateBMI,
  cmToFeetInches,
  feetInchesToCm,
  generateId,
  getBMICategory,
  kgToLbs,
  lbsToKg,
} from "../utils/bmi.js";

const REFERENCE_ROWS = [
  { category: "Underweight", range: "Below 18.5", color: "#3b82f6" },
  { category: "Normal", range: "18.5 – 24.9", color: "var(--accent-green)" },
  { category: "Overweight", range: "25.0 – 29.9", color: "#f97316" },
  { category: "Obese", range: "30.0 and above", color: "#ef4444" },
];

const round1 = (n) => Math.round(n * 10) / 10;

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-black/[0.03] px-3 py-3 sm:px-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
        {label}
      </p>
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
      className="inline-flex overflow-hidden rounded-lg border border-[var(--border)] bg-black/[0.04] text-[11px] font-semibold uppercase tracking-wider"
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
                : "text-[var(--text-secondary)] hover:bg-black/[0.04] hover:text-[var(--text-primary)]",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function BMICalculator() {
  const heightCmId = useId();
  const heightFtId = useId();
  const heightInId = useId();
  const weightId = useId();

  const [heightUnit, setHeightUnit] = useState("cm");
  const [heightCm, setHeightCm] = useState("170");
  const [heightFeet, setHeightFeet] = useState("5");
  const [heightInches, setHeightInches] = useState("7");

  const [weightUnit, setWeightUnit] = useState("kg");
  const [weightValue, setWeightValue] = useState("70");

  const [result, setResult] = useState(null);
  const [advice, setAdvice] = useState("");
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceError, setAdviceError] = useState("");

  const [error, setError] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });

  const { addBmiEntry } = useHistory();

  const abortRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  // Auto-scroll to results when a calculation produces a result.
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
    setToast((t) => ({ ...t, visible: false }));
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
  }

  function changeWeightUnit(next) {
    if (next === weightUnit) return;
    const n = Number(weightValue);
    if (Number.isFinite(n) && n > 0) {
      const converted = next === "kg" ? lbsToKg(n) : kgToLbs(n);
      setWeightValue(String(round1(converted)));
    }
    setWeightUnit(next);
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

  // Short, single-value labels for the on-screen stat cards.
  function formatHeightShort() {
    if (heightUnit === "cm") return `${Math.round(Number(heightCm))} cm`;
    const f = Math.max(0, Math.floor(Number(heightFeet) || 0));
    const i = Math.max(0, Math.round(Number(heightInches) || 0));
    return `${f}′ ${i}″`;
  }

  function formatWeightShort() {
    const n = Number(weightValue);
    if (!Number.isFinite(n)) return "";
    return `${round1(n)} ${weightUnit}`;
  }

  // Long labels (with conversion) used for saved history entries.
  function formatHeightLong(cm) {
    if (heightUnit === "cm") return `${Math.round(Number(heightCm))} cm`;
    const f = Math.max(0, Math.floor(Number(heightFeet) || 0));
    const i = Math.max(0, Math.round(Number(heightInches) || 0));
    return `${f}′ ${i}″ · ${Math.round(cm)} cm`;
  }

  function formatWeightLong(kg) {
    const n = Number(weightValue);
    if (!Number.isFinite(n)) return "";
    if (weightUnit === "kg") return `${round1(n)} kg`;
    return `${round1(n)} lbs · ${round1(kg)} kg`;
  }

  async function fetchAdvice(snapshot) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAdviceLoading(true);
    setAdviceError("");
    setAdvice("");

    try {
      const text = await getBMIAdvice(
        snapshot.bmi,
        snapshot.category,
        Math.round(snapshot.heightCm),
        round1(snapshot.weightKg),
        { signal: controller.signal },
      );
      setAdvice(text);
    } catch (err) {
      if (err?.name === "AbortError") return;
      setAdviceError(err?.message || "Could not load personalized advice.");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setAdviceLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const cm = getHeightCm();
    const kg = getWeightKg();

    if (cm === null) {
      setError("Please enter a valid height.");
      return;
    }
    if (kg === null) {
      setError("Please enter a valid weight.");
      return;
    }

    setError("");
    setIsSaved(false);

    const bmi = calculateBMI(cm, kg);
    const cat = getBMICategory(bmi);

    const next = {
      id: generateId(),
      bmi,
      category: cat.category,
      color: cat.color,
      description: cat.description,
      heightCm: cm,
      weightKg: kg,
      heightShort: formatHeightShort(),
      weightShort: formatWeightShort(),
      heightLabel: formatHeightLong(cm),
      weightLabel: formatWeightLong(kg),
    };
    setResult(next);
    fetchAdvice(next);
  }

  function handleRetryAdvice() {
    if (result) fetchAdvice(result);
  }

  async function handleCopyAdvice() {
    if (!advice) return;
    try {
      await navigator.clipboard.writeText(advice);
      showToast("Copied!", "success");
    } catch {
      showToast("Couldn't copy to clipboard", "error");
    }
  }

  function handleSave() {
    if (!result || isSaved) return;
    const entry = {
      id: result.id,
      bmi: result.bmi,
      category: result.category,
      heightCm: result.heightCm,
      weightKg: result.weightKg,
      heightLabel: result.heightLabel,
      weightLabel: result.weightLabel,
      advice: advice || "",
      date: Date.now(),
    };
    addBmiEntry(entry);
    setIsSaved(true);
    showToast("Saved to your BMI history", "success");
  }

  return (
    <div className="relative">
      <header className="mb-6 sm:mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-green)]">
          Health
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
          BMI Calculator
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)] sm:text-base">
          Know your body, get personalized guidance.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.25)] sm:p-6"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Height
              </span>
              <UnitToggle
                ariaLabel="Height unit"
                value={heightUnit}
                onChange={changeHeightUnit}
                options={[
                  { value: "cm", label: "cm" },
                  { value: "ft", label: "ft / in" },
                ]}
              />
            </div>

            {heightUnit === "cm" ? (
              <div className="mt-2 flex items-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-black/[0.04] focus-within:border-[var(--accent-green)]/50">
                <input
                  id={heightCmId}
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="w-full bg-transparent px-4 py-3 text-base text-[var(--text-primary)] [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="grid place-items-center border-l border-[var(--border)] px-3 text-sm font-semibold text-[var(--accent-green)]">
                  cm
                </span>
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <div className="flex flex-1 items-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-black/[0.04] focus-within:border-[var(--accent-green)]/50">
                  <input
                    id={heightFtId}
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    value={heightFeet}
                    onChange={(e) => setHeightFeet(e.target.value)}
                    aria-label="Feet"
                    className="w-full bg-transparent px-4 py-3 text-base text-[var(--text-primary)] [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="grid place-items-center border-l border-[var(--border)] px-3 text-sm font-semibold text-[var(--accent-green)]">
                    ft
                  </span>
                </div>
                <div className="flex flex-1 items-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-black/[0.04] focus-within:border-[var(--accent-green)]/50">
                  <input
                    id={heightInId}
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    max="11"
                    value={heightInches}
                    onChange={(e) => setHeightInches(e.target.value)}
                    aria-label="Inches"
                    className="w-full bg-transparent px-4 py-3 text-base text-[var(--text-primary)] [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="grid place-items-center border-l border-[var(--border)] px-3 text-sm font-semibold text-[var(--accent-green)]">
                    in
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Weight
              </span>
              <UnitToggle
                ariaLabel="Weight unit"
                value={weightUnit}
                onChange={changeWeightUnit}
                options={[
                  { value: "kg", label: "kg" },
                  { value: "lbs", label: "lbs" },
                ]}
              />
            </div>

            <div className="mt-2 flex items-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-black/[0.04] focus-within:border-[var(--accent-green)]/50">
              <input
                id={weightId}
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
                className="w-full bg-transparent px-4 py-3 text-base text-[var(--text-primary)] [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="grid place-items-center border-l border-[var(--border)] px-3 text-sm font-semibold text-[var(--accent-green)]">
                {weightUnit}
              </span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="btn-press mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-green)] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[var(--bg-primary)] transition-colors hover:bg-[var(--accent-green)]/90 active:bg-[var(--accent-green)]/80"
        >
          <Scale className="h-4 w-4" aria-hidden="true" />
          Calculate
        </button>
      </form>

      {error ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm"
        >
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-red-400"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-red-300">Check your inputs</p>
            <p className="mt-0.5 break-words text-red-200/80">{error}</p>
          </div>
        </div>
      ) : null}

      <div ref={resultsRef}>
        {result ? (
          <ResultsSection
            result={result}
            advice={advice}
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
  advice,
  adviceLoading,
  adviceError,
  isSaved,
  onRetryAdvice,
  onSave,
  onCopyAdvice,
}) {
  return (
    <section key={result.id} className="fade-in-up mt-6">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.25)] sm:p-6">
        <div className="flex flex-col items-center gap-3">
          <BMIGauge
            bmi={result.bmi}
            category={result.category}
            color={result.color}
          />
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: `${result.color}1f`,
              color: result.color,
            }}
          >
            {result.category}
          </span>
          <p className="max-w-md text-center text-sm text-[var(--text-secondary)]">
            {result.description}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3 [@media(min-width:380px)]:grid-cols-3">
          <StatCard label="Height" value={result.heightShort} />
          <StatCard label="Weight" value={result.weightShort} />
          <StatCard
            label="BMI"
            value={result.bmi.toFixed(1)}
            hint={result.category}
          />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.25)] sm:p-6">
        <div className="border-l-2 border-[var(--accent-green)] pl-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles
                className="h-4 w-4 text-[var(--accent-green)]"
                aria-hidden="true"
              />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                Personalized Advice
              </h2>
            </div>
            {advice && !adviceLoading && !adviceError ? (
              <button
                type="button"
                onClick={onCopyAdvice}
                aria-label="Copy advice to clipboard"
                className="btn-press inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-black/[0.04] hover:text-[var(--text-primary)]"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Copy</span>
              </button>
            ) : null}
          </div>

          <div className="mt-3 min-h-[3.5rem] text-sm leading-relaxed text-[var(--text-primary)]/90">
            {adviceLoading ? (
              <div
                className="flex items-center gap-2 text-[var(--text-secondary)]"
                aria-live="polite"
              >
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Coach Nova is thinking...
              </div>
            ) : adviceError ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-red-300/90">{adviceError}</p>
                <button
                  type="button"
                  onClick={onRetryAdvice}
                  className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/10"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : advice ? (
              <p className="whitespace-pre-wrap">{advice}</p>
            ) : (
              <p className="text-[var(--text-secondary)]">No advice yet.</p>
            )}
          </div>
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaved}
            aria-pressed={isSaved}
            className={[
              "btn-press inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-200 sm:w-auto",
              isSaved
                ? "cursor-default border border-[var(--accent-green)]/30 bg-[var(--accent-green)]/15 text-[var(--accent-green)]"
                : "bg-[var(--accent-green)] text-[var(--bg-primary)] hover:bg-[var(--accent-green)]/90 active:bg-[var(--accent-green)]/80",
            ].join(" ")}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            <span>{isSaved ? "Saved" : "Save to History"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function ReferenceTable({ activeCategory }) {
  return (
    <section className="mt-8">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
        BMI reference
      </h2>
      <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] backdrop-blur-md">
        <table className="w-full text-left text-sm">
          <thead className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Category</th>
              <th className="px-4 py-2.5 font-semibold">BMI range</th>
            </tr>
          </thead>
          <tbody>
            {REFERENCE_ROWS.map(({ category, range, color }, i) => {
              const isActive = activeCategory === category;
              return (
                <tr
                  key={category}
                  className={i > 0 ? "border-t border-[var(--border)]" : ""}
                  style={
                    isActive ? { backgroundColor: `${color}14` } : undefined
                  }
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
                        {category}
                      </span>
                      {isActive ? (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                          style={{ backgroundColor: `${color}26`, color }}
                        >
                          You
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[var(--text-secondary)]">
                    {range}
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
