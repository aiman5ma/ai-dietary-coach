import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Loader2, RotateCcw, Zap } from "lucide-react";

import FoodCard from "../components/FoodCard.jsx";
import FoodCardSkeleton from "../components/FoodCardSkeleton.jsx";
import Toast from "../components/Toast.jsx";
import { analyzeNutrition } from "../api/openai.js";
import { useHistory } from "../context/historyContext.js";
import { generateId } from "../utils/bmi.js";

const OZ_TO_GRAMS = 28.3495;

const QUICK_SUGGESTIONS = [
  { emoji: "🍗", name: "Chicken Breast" },
  { emoji: "🍚", name: "White Rice" },
  { emoji: "🥑", name: "Avocado" },
  { emoji: "🥚", name: "Egg" },
  { emoji: "🍌", name: "Banana" },
  { emoji: "🥦", name: "Broccoli" },
];

const round1 = (n) => Math.round(n * 10) / 10;

function gramsFromInput(value, unit) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return unit === "oz" ? n * OZ_TO_GRAMS : n;
}

function formatWeightLabel(value, unit) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (unit === "oz") {
    const grams = Math.round(n * OZ_TO_GRAMS);
    return `${round1(n)} oz · ${grams} g`;
  }
  return `${Math.round(n)} g`;
}

export default function NutritionAnalyzer() {
  const foodId = useId();
  const weightId = useId();

  const [foodName, setFoodName] = useState("");
  const [weightStr, setWeightStr] = useState("100");
  const [unit, setUnit] = useState("g");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [isSaved, setIsSaved] = useState(false);

  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });

  // Last submitted analysis params, kept in state so the retry button
  // can render conditionally (refs can't be read during render).
  const [lastRequest, setLastRequest] = useState(null);

  const { addFoodEntry } = useHistory();

  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const resultsRef = useRef(null);

  // Cancel any in-flight request on unmount.
  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  // Auto-scroll to results when they appear (or when a skeleton appears).
  useEffect(() => {
    if (!loading && !result) return;
    const node = resultsRef.current;
    if (!node) return;
    // Defer until paint so the section is in the DOM at its final position.
    const id = requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [loading, result]);

  function showToast(message, type = "success") {
    setToast({ visible: true, message, type });
  }
  function dismissToast() {
    setToast((t) => ({ ...t, visible: false }));
  }

  function toggleUnit() {
    setUnit((u) => {
      const next = u === "g" ? "oz" : "g";
      const num = parseFloat(weightStr);
      if (Number.isFinite(num) && num > 0) {
        const grams = u === "g" ? num : num * OZ_TO_GRAMS;
        const converted = next === "g" ? grams : grams / OZ_TO_GRAMS;
        setWeightStr(String(round1(converted)));
      }
      return next;
    });
  }

  async function runAnalyze({ name, grams, label }) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError("");
    setIsSaved(false);
    setResult(null);

    try {
      const data = await analyzeNutrition(name, grams, {
        signal: controller.signal,
      });
      setResult({
        id: generateId(),
        foodName: name,
        weightLabel: label,
        weightGrams: grams,
        ...data,
      });
    } catch (err) {
      if (err?.name === "AbortError") return;
      setError(err?.message || "Something went wrong. Please try again.");
      showToast(err?.message || "Something went wrong.", "error");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = foodName.trim();
    const grams = gramsFromInput(weightStr, unit);
    if (!trimmed) {
      setError("Please enter a food name.");
      inputRef.current?.focus();
      return;
    }
    if (grams === null) {
      setError("Please enter a weight greater than zero.");
      return;
    }
    const label = formatWeightLabel(weightStr, unit);
    const req = { name: trimmed, grams: Math.round(grams), label };
    setLastRequest(req);
    runAnalyze(req);
  }

  function handleRetry() {
    if (lastRequest) runAnalyze(lastRequest);
  }

  function handleChip(name) {
    setFoodName(name);
    setError("");
    inputRef.current?.focus();
  }

  function handleSave() {
    if (!result || isSaved) return;
    const entry = {
      id: result.id,
      foodName: result.foodName,
      weight: result.weightLabel,
      weightGrams: result.weightGrams,
      calories: Number(result.calories) || 0,
      protein: Number(result.protein) || 0,
      carbs: Number(result.carbs) || 0,
      fat: Number(result.fat) || 0,
      fiber: Number(result.fiber) || 0,
      sugar: Number(result.sugar) || 0,
      note: result.note || "",
      date: Date.now(),
    };
    addFoodEntry(entry);
    setIsSaved(true);
    showToast("Saved to your food log", "success");
  }

  return (
    <div className="relative">
      <header className="mb-6 sm:mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-green)]">
          Nutrition
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
          Nutrition Analyzer
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)] sm:text-base">
          Enter any food to get instant nutritional insights.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.25)] sm:p-6"
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0">
            <label
              htmlFor={foodId}
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
            >
              Food name
            </label>
            <input
              id={foodId}
              ref={inputRef}
              type="text"
              autoComplete="off"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="e.g. Grilled Chicken Breast, Brown Rice, Banana..."
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-black/[0.04] px-4 py-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:border-[var(--accent-green)]/50 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor={weightId}
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
            >
              Weight
            </label>
            <div className="mt-2 flex items-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-black/[0.04] focus-within:border-[var(--accent-green)]/50">
              <input
                id={weightId}
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={weightStr}
                onChange={(e) => setWeightStr(e.target.value)}
                className="w-full bg-transparent px-3 py-3 text-base text-[var(--text-primary)] [appearance:textfield] focus:outline-none sm:w-28 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={toggleUnit}
                aria-label={`Switch unit. Currently ${unit}.`}
                className="btn-press border-l border-[var(--border)] px-3 text-sm font-semibold text-[var(--accent-green)] transition-colors hover:bg-[var(--accent-green)]/10"
              >
                {unit}
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-press mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-green)] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[var(--bg-primary)] transition-colors hover:bg-[var(--accent-green)]/90 active:bg-[var(--accent-green)]/80 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Analyzing...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" aria-hidden="true" />
              Analyze
            </>
          )}
        </button>
      </form>

      {error && !loading ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm"
        >
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-red-400"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-red-300">Something went wrong</p>
            <p className="mt-0.5 break-words text-red-200/80">{error}</p>
            {lastRequest ? (
              <button
                type="button"
                onClick={handleRetry}
                className="btn-press mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/10"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Try again
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div ref={resultsRef}>
        {loading ? (
          <section className="mt-6">
            <FoodCardSkeleton />
          </section>
        ) : null}

        {result && !error && !loading ? (
          <section className="mt-6">
            <FoodCard
              key={result.id}
              foodName={result.foodName}
              weight={result.weightLabel}
              calories={result.calories}
              protein={result.protein}
              carbs={result.carbs}
              fat={result.fat}
              fiber={result.fiber}
              sugar={result.sugar}
              aiNote={result.note}
              onSave={handleSave}
              isSaved={isSaved}
            />
          </section>
        ) : null}
      </div>

      {!result && !loading && !error ? (
        <section className="mt-6" aria-label="Quick suggestions">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Quick suggestions
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_SUGGESTIONS.map(({ emoji, name }) => (
              <button
                key={name}
                type="button"
                onClick={() => handleChip(name)}
                className="btn-press inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] backdrop-blur-md transition-colors hover:border-[var(--accent-green)]/40 hover:bg-[var(--accent-green)]/10"
              >
                <span aria-hidden="true">{emoji}</span>
                <span>{name}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onDismiss={dismissToast}
      />
    </div>
  );
}
