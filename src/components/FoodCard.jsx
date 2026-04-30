import { Bookmark, Check, Flame, Sparkles } from "lucide-react";

import MacroBar from "./MacroBar.jsx";
import useCountUp from "../hooks/useCountUp.js";

const MACRO_PILLS = [
  { key: "protein", label: "Protein", color: "#3b82f6" }, // blue
  { key: "carbs", label: "Carbs", color: "#f97316" },     // orange
  { key: "fat", label: "Fat", color: "#eab308" },         // yellow
  { key: "fiber", label: "Fiber", color: "var(--text-secondary)" },     // gray
];

function MacroPill({ label, color, grams }) {
  const animated = useCountUp(grams, 800);
  const value = Math.round(animated);
  return (
    <div
      className="flex flex-col gap-0.5 rounded-xl border border-[var(--border)] bg-black/[0.03] px-3 py-2"
      style={{ boxShadow: `inset 3px 0 0 ${color}` }}
    >
      <span
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color }}
      >
        {label}
      </span>
      <span className="text-base font-semibold text-[var(--text-primary)] tabular-nums">
        {value}
        <span className="ml-0.5 text-xs font-normal text-[var(--text-secondary)]">g</span>
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
  thumbnailSrc,
  thumbnailAlt,
}) {
  const animatedCalories = useCountUp(calories, 800);
  const macroGrams = { protein, carbs, fat, fiber };

  return (
    <article
      aria-label={`Nutrition for ${foodName}`}
      className="fade-in-up rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.25)] sm:p-6"
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
          <span className="text-xs font-medium text-[var(--text-secondary)]">kcal</span>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {MACRO_PILLS.map(({ key, label, color }) => (
          <MacroPill
            key={key}
            label={label}
            color={color}
            grams={macroGrams[key]}
          />
        ))}
      </div>

      <div className="mt-5">
        <MacroBar protein={protein} carbs={carbs} fat={fat} />
      </div>

      {aiNote ? (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-black/[0.03] p-3.5">
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
            {isSaved ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Bookmark className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{isSaved ? "Saved" : "Save to Log"}</span>
          </button>
        </div>
      ) : null}
    </article>
  );
}
