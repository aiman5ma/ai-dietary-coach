import { useLanguage } from "../context/LanguageContext.jsx";
import { MEAL_IDS, MEAL_LABEL } from "../utils/meals.js";

export default function MealPicker({ value, onChange, disabled = false }) {
  const { t } = useLanguage();

  return (
    <div
      role="radiogroup"
      aria-label={t("tracker.mealLabel")}
      className="grid grid-cols-2 gap-1.5 sm:grid-cols-4"
    >
      {MEAL_IDS.map((id) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(id)}
            className={[
              "btn-press rounded-xl border px-2 py-2 text-xs font-semibold transition-colors",
              selected
                ? "border-[var(--accent-green)]/40 bg-[var(--accent-green)]/15 text-[var(--accent-green)]"
                : "border-[var(--border)] bg-black/[0.03] text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:bg-white/[0.05]",
              disabled ? "cursor-default opacity-70" : "",
            ].join(" ")}
          >
            {t(MEAL_LABEL[id])}
          </button>
        );
      })}
    </div>
  );
}
