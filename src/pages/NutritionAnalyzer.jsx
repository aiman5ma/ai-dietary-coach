import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Plus, RotateCcw, X, Zap } from "lucide-react";

import FoodCard from "../components/FoodCard.jsx";
import FoodCardSkeleton from "../components/FoodCardSkeleton.jsx";
import MealPicker from "../components/MealPicker.jsx";
import { mealForNow } from "../utils/meals.js";
import Toast from "../components/Toast.jsx";
import { analyzeNutrition } from "../api/openai.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { getFoods, logDaily, logFood } from "../lib/storage.js";
import { generateId } from "../utils/bmi.js";

const OZ_TO_GRAMS = 28.3495;

const QUICK_SUGGESTIONS = [
  { emoji: "🍗", key: "nutrition.chickenBreast" },
  { emoji: "🍚", key: "nutrition.whiteRice" },
  { emoji: "🥑", key: "nutrition.avocado" },
  { emoji: "🥚", key: "nutrition.egg" },
  { emoji: "🍌", key: "nutrition.banana" },
  { emoji: "🥦", key: "nutrition.broccoli" },
];

const TOTAL_FIELDS = [
  { key: "calories", labelKey: "nutrition.calories", unitKey: "history.kcal" },
  { key: "protein", labelKey: "nutrition.protein", unitKey: "common.grams" },
  { key: "carbs", labelKey: "nutrition.carbs", unitKey: "common.grams" },
  { key: "fat", labelKey: "nutrition.fat", unitKey: "common.grams" },
  { key: "fiber", labelKey: "nutrition.fiber", unitKey: "common.grams" },
  { key: "sugar", labelKey: "nutrition.sugar", unitKey: "common.grams" },
];

const round1 = (n) => Math.round(n * 10) / 10;

function createItem() {
  return { id: generateId(), name: "", weightStr: "100", unit: "g" };
}

function gramsFromInput(value, unit) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return unit === "oz" ? n * OZ_TO_GRAMS : n;
}

function formatWeightLabel(value, unit, t) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (unit === "oz") {
    const grams = Math.round(n * OZ_TO_GRAMS);
    return `${round1(n)} ${t("common.ounces")} · ${grams} ${t("common.grams")}`;
  }
  return `${Math.round(n)} ${t("common.grams")}`;
}

function withTimestamp(fields) {
  return { ...fields, date: Date.now() };
}

function errorText(error, t) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error.key) return t(error.key, error.vars);
  return error.message || "";
}

function sumField(items, key) {
  return items.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
}

function RemoveButton({ disabled, onClick }) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={t("nutrition.removeFood")}
      className="btn-press grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.08] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <X className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function FoodRow({
  item,
  index,
  canRemove,
  disabled,
  nameRef,
  weightRef,
  onNameChange,
  onWeightChange,
  onToggleUnit,
  onRemove,
}) {
  const { t } = useLanguage();
  const nameId = `food-name-${item.id}`;
  const weightId = `food-weight-${item.id}`;

  return (
    <li className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-left shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-md rtl:text-right sm:p-5">
      {canRemove ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal">
            {t("nutrition.itemLabel", { index: index + 1 })}
          </p>
          <RemoveButton disabled={disabled} onClick={onRemove} />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={nameId}
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal"
            >
              {t("nutrition.foodName")}
            </label>
            {canRemove ? null : (
              <RemoveButton disabled onClick={onRemove} />
            )}
          </div>
          <input
            id={nameId}
            ref={nameRef}
            type="text"
            autoComplete="off"
            value={item.name}
            disabled={disabled}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t("nutrition.foodPlaceholder")}
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-black/[0.04] dark:bg-white/[0.06] px-4 py-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:border-[var(--accent-green)]/50 focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor={weightId}
            className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal"
          >
            {t("nutrition.weight")}
          </label>
          <div className="mt-2 flex items-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-black/[0.04] dark:bg-white/[0.06] focus-within:border-[var(--accent-green)]/50">
            <input
              id={weightId}
              ref={weightRef}
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={item.weightStr}
              disabled={disabled}
              onChange={(e) => onWeightChange(e.target.value)}
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base text-[var(--text-primary)] [appearance:textfield] focus:outline-none sm:w-28 sm:flex-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={onToggleUnit}
              disabled={disabled}
              aria-label={t("nutrition.switchUnit", {
                unit: item.unit === "oz" ? t("common.ounces") : t("common.grams"),
              })}
              className="btn-press shrink-0 border-s border-[var(--border)] px-3 text-sm font-semibold text-[var(--accent-green)] transition-colors hover:bg-[var(--accent-green)]/10 disabled:opacity-60"
            >
              {item.unit === "oz" ? t("common.ounces") : t("common.grams")}
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function CombinedTotals({ results, isSaved, saving, onSave, meal, onMealChange }) {
  const { t } = useLanguage();
  const totals = {
    calories: sumField(results, "calories"),
    protein: sumField(results, "protein"),
    carbs: sumField(results, "carbs"),
    fat: sumField(results, "fat"),
    fiber: sumField(results, "fiber"),
    sugar: sumField(results, "sugar"),
  };

  return (
    <section className="rounded-2xl border border-[var(--accent-green)]/35 bg-[var(--accent-green)]/10 p-5 text-left shadow-[0_8px_30px_rgba(45,158,95,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.45)] rtl:text-right sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center rounded-full bg-[var(--accent-green)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--on-accent)] dark:text-[#f0f6fc] rtl:normal-case rtl:tracking-normal">
            {t("nutrition.totalBadge")}
          </span>
          <h2 className="mt-2 text-lg font-bold text-[var(--text-primary)] sm:text-xl">
            {t("nutrition.combinedTitle")}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {results.map((item) => item.foodName).join(" · ")}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {TOTAL_FIELDS.map(({ key, labelKey, unitKey }) => (
          <div
            key={key}
            className="rounded-xl border border-[var(--accent-green)]/20 bg-[var(--bg-card)] px-3 py-2.5"
          >
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal">
              {t(labelKey)}
            </dt>
            <dd className="mt-1 text-lg font-bold tabular-nums text-[var(--text-primary)]">
              {Math.round(totals[key])}
              <span className="ms-0.5 text-xs font-normal text-[var(--text-secondary)]">
                {t(unitKey)}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex flex-col gap-3">
        {onMealChange ? (
          <MealPicker value={meal} onChange={onMealChange} disabled={isSaved || saving} />
        ) : null}
        <div>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaved || saving}
          aria-pressed={isSaved}
          className={[
            "btn-press inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-200 sm:w-auto",
            isSaved
              ? "cursor-default border border-[var(--accent-green)]/30 bg-[var(--accent-green)]/15 text-[var(--accent-green)]"
              : "bg-[var(--accent-green)] text-[var(--on-accent)] dark:text-[#f0f6fc] hover:bg-[var(--accent-green)]/90 active:bg-[var(--accent-green)]/80",
          ].join(" ")}
        >
          {isSaved ? t("common.saved") : saving ? t("common.loading") : t("common.saveToLog")}
        </button>
        </div>
      </div>
    </section>
  );
}

export default function NutritionAnalyzer() {
  const { t, lang } = useLanguage();
  const [items, setItems] = useState(() => [createItem()]);
  const [loading, setLoading] = useState(false);
  const [loadingCount, setLoadingCount] = useState(0);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [meal, setMeal] = useState("lunch");
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const [lastRequest, setLastRequest] = useState(null);

  const nameRefs = useRef(new Map());
  const weightRefs = useRef(new Map());
  const abortRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!loading && !results?.length) return;
    const node = resultsRef.current;
    if (!node) return;
    const id = requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [loading, results]);

  function showToast(message, type = "success") {
    setToast({ visible: true, message, type });
  }
  function dismissToast() {
    setToast((current) => ({ ...current, visible: false }));
  }

  function updateItem(id, patch) {
    setError("");
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function toggleUnit(id) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = item.unit === "g" ? "oz" : "g";
        const num = parseFloat(item.weightStr);
        let weightStr = item.weightStr;
        if (Number.isFinite(num) && num > 0) {
          const grams = item.unit === "g" ? num : num * OZ_TO_GRAMS;
          const converted = next === "g" ? grams : grams / OZ_TO_GRAMS;
          weightStr = String(round1(converted));
        }
        return { ...item, unit: next, weightStr };
      }),
    );
  }

  function addItem() {
    setError("");
    setItems((prev) => [...prev, createItem()]);
  }

  function removeItem(id) {
    setError("");
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item.id !== id)));
  }

  async function runAnalyze(requests) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setLoadingCount(requests.length);
    setError("");
    setIsSaved(false);
    setResults(null);

    try {
      const analyzed = await Promise.all(
        requests.map(async (req) => {
          const data = await analyzeNutrition(req.name, req.grams, lang, {
            signal: controller.signal,
          });
          return {
            id: generateId(),
            foodName: req.name,
            weightAmount: req.amount,
            weightUnit: req.unit,
            weightGrams: req.grams,
            ...data,
          };
        }),
      );
      if (controller.signal.aborted) return;
      setMeal(mealForNow());
      setResults(analyzed);
    } catch (err) {
      if (err?.name === "AbortError" || controller.signal.aborted) return;
      const message = err?.message || t("common.somethingWrongRetry");
      setError(message);
      showToast(message, "error");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const single = items.length === 1;
    const requests = [];

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const name = item.name.trim();
      const grams = gramsFromInput(item.weightStr, item.unit);
      if (!name) {
        setError(
          single
            ? { key: "nutrition.foodNameRequired" }
            : { key: "nutrition.rowFoodNameRequired", vars: { index: i + 1 } },
        );
        nameRefs.current.get(item.id)?.focus();
        return;
      }
      if (grams === null) {
        setError(
          single
            ? { key: "nutrition.weightRequired" }
            : { key: "nutrition.rowWeightRequired", vars: { index: i + 1 } },
        );
        weightRefs.current.get(item.id)?.focus();
        return;
      }
      requests.push({
        name,
        grams: Math.round(grams),
        amount: item.weightStr,
        unit: item.unit,
      });
    }

    setLastRequest(requests);
    runAnalyze(requests);
  }

  function handleRetry() {
    if (lastRequest) runAnalyze(lastRequest);
  }

  function handleChip(name) {
    setError("");
    setItems((prev) => {
      const emptyIndex = prev.findIndex((item) => !item.name.trim());
      const index = prev.length === 1 || emptyIndex === -1 ? 0 : emptyIndex;
      const next = prev.map((item, i) => (i === index ? { ...item, name } : item));
      const focusId = next[index].id;
      requestAnimationFrame(() => {
        nameRefs.current.get(focusId)?.focus();
      });
      return next;
    });
  }

  function resultWeight(result) {
    if (result?.weightAmount != null && result?.weightUnit) {
      return formatWeightLabel(result.weightAmount, result.weightUnit, t);
    }
    return result?.weightLabel || "";
  }

  async function handleSave() {
    if (!results?.length || isSaved || saving) return;
    setSaving(true);

    const entry =
      results.length === 1
        ? withTimestamp({
            id: results[0].id,
            foodName: results[0].foodName,
            weight: resultWeight(results[0]),
            weightGrams: results[0].weightGrams,
            calories: Number(results[0].calories) || 0,
            protein: Number(results[0].protein) || 0,
            carbs: Number(results[0].carbs) || 0,
            fat: Number(results[0].fat) || 0,
            fiber: Number(results[0].fiber) || 0,
            sugar: Number(results[0].sugar) || 0,
            note: results[0].note || "",
          })
        : withTimestamp({
            id: generateId(),
            foodName: results.map((result) => result.foodName).join(", "),
            weight: results.map((result) => resultWeight(result)).join(", "),
            weightGrams: results.reduce((sum, result) => sum + (Number(result.weightGrams) || 0), 0),
            calories: sumField(results, "calories"),
            protein: sumField(results, "protein"),
            carbs: sumField(results, "carbs"),
            fat: sumField(results, "fat"),
            fiber: sumField(results, "fiber"),
            sugar: sumField(results, "sugar"),
            note: "",
            foods: results.map((result) => ({
              id: result.id,
              foodName: result.foodName,
              weight: resultWeight(result),
              weightGrams: result.weightGrams,
              calories: Number(result.calories) || 0,
              protein: Number(result.protein) || 0,
              carbs: Number(result.carbs) || 0,
              fat: Number(result.fat) || 0,
              fiber: Number(result.fiber) || 0,
              sugar: Number(result.sugar) || 0,
              note: result.note || "",
            })),
          });

    try {
      await logFood(entry);
      await getFoods();
      await logDaily({
        id: entry.id,
        timestamp: entry.date,
        foodName: entry.foodName,
        calories: Number(entry.calories) || 0,
        protein: Number(entry.protein) || 0,
        carbs: Number(entry.carbs) || 0,
        fat: Number(entry.fat) || 0,
        fiber: Number(entry.fiber) || 0,
        sugar: Number(entry.sugar) || 0,
        source: "analyzed",
        meal,
      });
      setIsSaved(true);
      showToast(t("nutrition.savedToast"), "success");
    } catch {
      showToast(t("storage.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  }

  const showSuggestions = !results?.length && !loading && !error;

  return (
    <div className="relative text-left rtl:text-right">
      <header className="mb-6 sm:mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-green)] rtl:normal-case rtl:tracking-normal">
          {t("nutrition.eyebrow")}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
          {t("nutrition.title")}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)] sm:text-base">
          {t("nutrition.subtitle")}
        </p>
      </header>

      <form onSubmit={handleSubmit} noValidate>
        <ul className="flex flex-col gap-3">
          {items.map((item, index) => (
            <FoodRow
              key={item.id}
              item={item}
              index={index}
              canRemove={items.length > 1}
              disabled={loading}
              nameRef={(node) => {
                if (node) nameRefs.current.set(item.id, node);
                else nameRefs.current.delete(item.id);
              }}
              weightRef={(node) => {
                if (node) weightRefs.current.set(item.id, node);
                else weightRefs.current.delete(item.id);
              }}
              onNameChange={(name) => updateItem(item.id, { name })}
              onWeightChange={(weightStr) => updateItem(item.id, { weightStr })}
              onToggleUnit={() => toggleUnit(item.id)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </ul>

        <button
          type="button"
          onClick={addItem}
          disabled={loading}
          className="btn-press mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--accent-green)]/40 hover:bg-[var(--accent-green)]/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("nutrition.addFood")}
        </button>

        <button
          type="submit"
          disabled={loading}
          className="btn-press mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-green)] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[var(--on-accent)] dark:text-[#f0f6fc] transition-colors hover:bg-[var(--accent-green)]/90 active:bg-[var(--accent-green)]/80 disabled:cursor-not-allowed disabled:opacity-70 rtl:normal-case rtl:tracking-normal"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t("nutrition.analyzing")}
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" aria-hidden="true" />
              {t("nutrition.analyze")}
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
            <p className="font-semibold text-red-300">{t("nutrition.errorTitle")}</p>
            <p className="mt-0.5 break-words text-red-200/80">{errorText(error, t)}</p>
            {lastRequest ? (
              <button
                type="button"
                onClick={handleRetry}
                className="btn-press mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/10"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                {t("common.tryAgain")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        ref={resultsRef}
        className={loading || results?.length ? "mt-6 flex flex-col gap-4" : undefined}
      >
        {loading
          ? Array.from({ length: Math.max(loadingCount, 1) }, (_, i) => (
              <FoodCardSkeleton key={i} />
            ))
          : null}

        {results?.length && !error && !loading
          ? results.map((result) => (
              <FoodCard
                key={result.id}
                foodName={result.foodName}
                weight={resultWeight(result)}
                calories={result.calories}
                protein={result.protein}
                carbs={result.carbs}
                fat={result.fat}
                fiber={result.fiber}
                sugar={result.sugar}
                aiNote={result.note}
                onSave={results.length === 1 ? handleSave : undefined}
                isSaved={isSaved}
                saving={saving}
                meal={meal}
                onMealChange={results.length === 1 ? setMeal : undefined}
              />
            ))
          : null}

        {results && results.length > 1 && !error && !loading ? (
          <CombinedTotals
            results={results}
            isSaved={isSaved}
            saving={saving}
            onSave={handleSave}
            meal={meal}
            onMealChange={setMeal}
          />
        ) : null}
      </div>

      {showSuggestions ? (
        <section className="mt-6" aria-label={t("nutrition.quickSuggestions")}>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal">
            {t("nutrition.quickSuggestions")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_SUGGESTIONS.map(({ emoji, key }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleChip(t(key))}
                className="btn-press inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] backdrop-blur-md transition-colors hover:border-[var(--accent-green)]/40 hover:bg-[var(--accent-green)]/10"
              >
                <span aria-hidden="true">{emoji}</span>
                <span>{t(key)}</span>
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
