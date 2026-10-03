import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  ImageUp,
  Loader2,
  Replace,
  RotateCcw,
  Scan,
  Sparkles,
  Upload,
} from "lucide-react";

import FoodCard from "../components/FoodCard.jsx";
import FoodCardSkeleton from "../components/FoodCardSkeleton.jsx";
import { mealForNow } from "../utils/meals.js";
import Toast from "../components/Toast.jsx";
import { analyzePhoto } from "../api/openai.js";
import { useHistory } from "../context/historyContext.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { generateId } from "../utils/bmi.js";
import { addDailyFood } from "../utils/dailyLog.js";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function withTimestamp(fields) {
  return { ...fields, date: Date.now() };
}

const EXAMPLES = [
  { emoji: "🍕", labelKey: "scanner.exampleRestaurant" },
  { emoji: "📦", labelKey: "scanner.examplePackaged" },
  { emoji: "🥗", labelKey: "scanner.exampleHome" },
];

function readError(key) {
  const err = new Error(key);
  err.i18nKey = key;
  return err;
}

/**
 * Read a File as a base64-encoded string.
 * Resolves with `{ base64, mimeType }` (no `data:...;base64,` prefix in `base64`).
 */
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    if (!(file instanceof Blob)) {
      reject(readError("scanner.expectedFile"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      const match = /^data:([^;,]+);base64,(.*)$/.exec(raw);
      if (!match) {
        reject(readError("scanner.encodeFailed"));
        return;
      }
      resolve({ base64: match[2], mimeType: match[1] });
    };
    reader.onerror = () =>
      reject(readError("scanner.readFileFailed"));
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function errorText(error, t) {
  if (!error) return "";
  if (error.key) return t(error.key, error.vars);
  return error.message || "";
}

export default function PhotoScanner() {
  const { t, lang } = useLanguage();
  const [photo, setPhoto] = useState(null); // { base64, mimeType, dataUri, name, size }
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [meal, setMeal] = useState("lunch");
  const [isDragging, setIsDragging] = useState(false);

  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const { addFoodEntry } = useHistory();

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const abortRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  // Auto-scroll to results when they appear (or when loading skeleton appears).
  useEffect(() => {
    if (!loading && !result) return;
    const node = resultsRef.current;
    if (!node) return;
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

  async function selectFile(file) {
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      const next = { key: "scanner.notImage" };
      setError(next);
      showToast(t(next.key), "error");
      return;
    }
    if (file.size > MAX_BYTES) {
      const next = { key: "scanner.tooLarge", vars: { size: formatFileSize(file.size) } };
      setError(next);
      showToast(t(next.key, next.vars), "error");
      return;
    }

    setError(null);
    setResult(null);
    setIsSaved(false);

    try {
      const { base64, mimeType } = await readFileAsBase64(file);
      setPhoto({
        base64,
        mimeType,
        dataUri: `data:${mimeType};base64,${base64}`,
        name: file.name,
        size: file.size,
      });
    } catch (err) {
      const key = err?.i18nKey || "scanner.readFailed";
      setError({ key });
    }
  }

  function handleFileInput(e) {
    const file = e.target.files?.[0];
    if (file) selectFile(file);
    // Reset so picking the same file again still triggers onChange.
    e.target.value = "";
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!isDragging) setIsDragging(true);
  }

  function handleDragLeave(e) {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) selectFile(file);
  }

  function clearPhoto() {
    setPhoto(null);
    setResult(null);
    setError(null);
    setIsSaved(false);
  }

  async function runScan() {
    if (!photo) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setResult(null);
    setIsSaved(false);

    try {
      const data = await analyzePhoto(photo.base64, photo.mimeType, lang, {
        signal: controller.signal,
      });
      setMeal(mealForNow());
      setResult({
        id: generateId(),
        photoDataUri: photo.dataUri,
        photoName: photo.name,
        ...data,
      });
    } catch (err) {
      if (err?.name === "AbortError") return;
      const next = err?.message
        ? { message: err.message }
        : { key: "scanner.scanFailed" };
      setError(next);
      showToast(errorText(next, t), "error");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  }

  function handleSave() {
    if (!result || isSaved) return;
    const entry = withTimestamp({
      id: result.id,
      type: "photo",
      foodName: result.foodName,
      weight: t("scanner.serving"),
      calories: Number(result.calories) || 0,
      protein: Number(result.protein) || 0,
      carbs: Number(result.carbs) || 0,
      fat: Number(result.fat) || 0,
      fiber: Number(result.fiber) || 0,
      sugar: Number(result.sugar) || 0,
      note: result.description || "",
    });
    addFoodEntry(entry);
    addDailyFood({
      id: entry.id,
      timestamp: entry.date,
      foodName: entry.foodName,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      fiber: entry.fiber,
      sugar: entry.sugar,
      source: "scanner",
      meal,
    });
    setIsSaved(true);
    showToast(t("scanner.savedToast"), "success");
  }

  return (
    <div className="relative text-start">
      <header className="mb-6 sm:mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-green)] rtl:normal-case rtl:tracking-normal">
          {t("scanner.eyebrow")}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
          {t("scanner.title")}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)] sm:text-base">
          {t("scanner.subtitle")}
        </p>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInput}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileInput}
        className="hidden"
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          "rounded-2xl border-2 border-dashed bg-[var(--bg-card)] p-5 backdrop-blur-md transition-all sm:p-6",
          isDragging
            ? "border-[var(--accent-green)]/70 bg-[var(--accent-green)]/5"
            : "border-[var(--border)]",
        ].join(" ")}
      >
        {photo ? (
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-xl bg-black/40 ring-1 ring-[var(--border)]">
              <img
                src={photo.dataUri}
                alt={photo.name || t("scanner.selectedAlt")}
                className="aspect-[4/3] w-full object-cover"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
              <span className="truncate">
                {photo.name}
                {photo.size ? ` · ${formatFileSize(photo.size)}` : ""}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"
                >
                  <Replace className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("scanner.changePhoto")}
                </button>
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="btn-press inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-black/[0.04] hover:text-[var(--text-primary)] dark:hover:bg-white/[0.08]"
                >
                  {t("scanner.remove")}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={runScan}
              disabled={loading}
              className="btn-press inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-green)] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-green)]/90 active:bg-[var(--accent-green)]/80 disabled:cursor-not-allowed disabled:opacity-70 rtl:normal-case rtl:tracking-normal dark:text-[#f0f6fc]"
            >
              {loading ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  {t("scanner.analyzing")}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {t("scanner.scan")}
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6 text-center sm:py-10">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--accent-green)]/10 ring-1 ring-[var(--accent-green)]/25">
              <Camera
                className="h-7 w-7 text-[var(--accent-green)]"
                aria-hidden="true"
                strokeWidth={2}
              />
            </span>

            <div>
              <p className="text-base font-semibold text-[var(--text-primary)] sm:text-lg">
                {t("scanner.dropTitle")}
              </p>
              <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                {t("scanner.dropHint")}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-press inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-green)] px-4 py-2.5 text-sm font-semibold text-[var(--on-accent)] dark:text-[#f0f6fc] transition-colors hover:bg-[var(--accent-green)]/90 active:bg-[var(--accent-green)]/80"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                {t("scanner.choosePhoto")}
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="btn-press inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-black/[0.04] dark:bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.08] md:hidden"
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                {t("scanner.takePhoto")}
              </button>
            </div>

            <p className="max-w-md text-xs text-[var(--text-secondary)]">
              {t("scanner.bestResults")}
            </p>

            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLES.map(({ emoji, labelKey }) => (
                <span
                  key={labelKey}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] backdrop-blur-md"
                >
                  <span aria-hidden="true">{emoji}</span>
                  <span>{t(labelKey)}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

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
            <p className="font-semibold text-red-300">{t("scanner.errorTitle")}</p>
            <p className="mt-0.5 break-words text-red-200/80">{errorText(error, t)}</p>
            {photo ? (
              <button
                type="button"
                onClick={runScan}
                className="btn-press mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/10"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                {t("common.tryAgain")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div ref={resultsRef}>
        {loading && !result ? (
          <section className="mt-6 space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 text-sm text-[var(--text-secondary)] backdrop-blur-md">
              <Scan
                className="h-5 w-5 animate-pulse text-[var(--accent-green)]"
                aria-hidden="true"
              />
              <span>{t("scanner.identifying")}</span>
            </div>
            <FoodCardSkeleton withThumbnail />
          </section>
        ) : null}

        {result && !error && !loading ? (
          <section className="mt-6">
            <FoodCard
              key={result.id}
              foodName={result.foodName}
              weight={t("scanner.serving")}
              calories={result.calories}
              protein={result.protein}
              carbs={result.carbs}
              fat={result.fat}
              fiber={result.fiber}
              sugar={result.sugar}
              aiNote={result.description}
              onSave={handleSave}
              isSaved={isSaved}
              meal={meal}
              onMealChange={setMeal}
              thumbnailSrc={result.photoDataUri}
              thumbnailAlt={result.foodName}
            />
          </section>
        ) : null}
      </div>

      {!photo && !loading && !result ? (
        <section className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-black/[0.03] dark:bg-white/[0.05] p-4 text-sm text-[var(--text-secondary)]">
          <ImageUp
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-green)]/80"
            aria-hidden="true"
          />
          <p>{t("scanner.tip")}</p>
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
