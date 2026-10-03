import { Bookmark, Check, Flame, Sparkles } from "lucide-react";

import { useLanguage } from "../context/LanguageContext.jsx";
import MacroBar from "./MacroBar.jsx";
import MealPicker from "./MealPicker.jsx";
import useCountUp from "../hooks/useCountUp.js";

const MACRO_PILLS = [
  { key: "protein", labelKey: "nutrition.protein", color: "#3b82f6" },
  { key: "carbs", labelKey: "nutrition.carbs", color: "#f97316" },
  { key: "fat", labelKey: "nutrition.fat", color: "#eab308" },
  { key: "fiber", labelKey: "nutrition.fiber", color: "var(--text-secondary)" },
];

function MacroPill({ label, color, grams }) {
  const { t } = useLanguage();
  const animated = useCountUp(grams, 800);
  const value = Math.round(animated);
  return (
    <div
      className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-[var(--border)] bg-black/[0.03] px-3 py-2 dark:bg-white/[0.05]"
      style={{ borderInlineStart: `3px solid ${color}` }}
    >
      <span
        className="break-words text-[10px] font-semibold uppercase tracking-wider rtl:normal-case rtl:tracking-normal"
        style={{ color }}
      >
        {label}
      </span>
      <span className="text-base font-semibold tabular-nums text-[var(--text-primary)]">
        {value}
        <span className="ms-0.5 text-xs font-normal text-[var(--text-secondary)]">
          {t("common.grams")}
        </span>
      </span>
    </div>
  );
}

export default function FoodCard({
  foodName,
  weight,
  calories,
  protein = 0,
  carbs = 0,
  fat = 0,
  fiber = 0,
  // eslint-disable-next-line no-unused-vars
  sugar = 0,
  aiNote,
  onSave,
  isSaved = false,
  meal,
  onMealChange,
  thumbnailSrc,
  thumbnailAlt,
}) {
  const { t } = useLanguage();
  const animatedCalories = useCountUp(calories, 800);
  const macroGrams = { protein, carbs, fat, fiber };

  return (
    <article
      aria-label={t("nutrition.cardLabel", { food: foodName || "" })}
      className="fade-in-up rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.25)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.55)] sm:p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt={thumbnailAlt || foodName || ""}
              className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-[var(--border)]"
            />
          ) : null}
          <div className="min-w-0">
            <h3 className="break-words text-lg font-semibold text-[var(--text-primary)] sm:text-xl">
              {foodName}
            </h3>
            {weight ? (
              <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{weight}</p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-baseline gap-1.5 rounded-xl bg-[var(--accent-green)]/10 px-3 py-2 ring-1 ring-[var(--accent-green)]/25">
          <Flame
            className="h-4 w-4 self-center text-[var(--accent-green)]"
            aria-hidden="true"
          />
          <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums sm:text-[28px]">
            {Math.round(animatedCalories)}
          </span>
          <span className="text-xs font-medium text-[var(--text-secondary)]">{t("history.kcal")}</span>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {MACRO_PILLS.map(({ key, labelKey, color }) => (
          <MacroPill
            key={key}
            label={t(labelKey)}
            color={color}
            grams={macroGrams[key]}
          />
        ))}
      </div>

      <div className="mt-5">
        <MacroBar protein={protein} carbs={carbs} fat={fat} />
      </div>

      {aiNote ? (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-black/[0.03] dark:bg-white/[0.05] p-3.5">
          <Sparkles
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-green)]"
            aria-hidden="true"
          />
          <p className="text-sm italic leading-relaxed text-[var(--text-primary)]/90">
            {aiNote}
          </p>
        </div>
      ) : null}

      {onSave ? (
        <div className="mt-5 flex flex-col gap-3">
          {onMealChange ? (
            <MealPicker value={meal} onChange={onMealChange} disabled={isSaved} />
          ) : null}
          <div>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaved}
            aria-pressed={isSaved}
            className={[
              "btn-press inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-200 sm:w-auto",
              isSaved
                ? "cursor-default border border-[var(--accent-green)]/30 bg-[var(--accent-green)]/15 text-[var(--accent-green)]"
                : "bg-[var(--accent-green)] text-[var(--on-accent)] dark:text-[#f0f6fc] hover:bg-[var(--accent-green)]/90 active:bg-[var(--accent-green)]/80",
            ].join(" ")}
          >
            {isSaved ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Bookmark className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{isSaved ? t("common.saved") : t("common.saveToLog")}</span>
          </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
