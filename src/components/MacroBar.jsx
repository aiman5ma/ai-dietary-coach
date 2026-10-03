import { useLanguage } from "../context/LanguageContext.jsx";

const COLORS = {
  protein: "#3b82f6",
  carbs: "#f97316",
  fat: "#eab308",
};

const LABEL_KEYS = {
  protein: "nutrition.protein",
  carbs: "nutrition.carbs",
  fat: "nutrition.fat",
};

export default function MacroBar({ protein = 0, carbs = 0, fat = 0, compact = false }) {
  const { t } = useLanguage();
  const p = Math.max(0, Number(protein) || 0);
  const c = Math.max(0, Number(carbs) || 0);
  const f = Math.max(0, Number(fat) || 0);
  const total = p + c + f;

  const segments = [
    { key: "protein", value: p },
    { key: "carbs", value: c },
    { key: "fat", value: f },
  ].map((s) => ({ ...s, pct: total > 0 ? (s.value / total) * 100 : 0 }));

  return (
    <div className="w-full">
      <div
        className={[
          "flex w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]",
          compact ? "h-1.5" : "h-3",
        ].join(" ")}
        role="img"
        aria-label={t("nutrition.macroSplit", {
          protein: Math.round(p),
          carbs: Math.round(c),
          fat: Math.round(f),
        })}
      >
        {total === 0
          ? null
          : segments.map(({ key, pct }) =>
              pct > 0 ? (
                <div
                  key={key}
                  className="h-full transition-[width] duration-500 ease-out"
                  style={{ width: `${pct}%`, backgroundColor: COLORS[key] }}
                />
              ) : null,
            )}
      </div>

      {compact ? null : (
      <ul className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {segments.map(({ key, value }) => (
          <li key={key} className="flex min-w-0 items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: COLORS[key] }}
              aria-hidden="true"
            />
            <span className="truncate text-[var(--text-secondary)]">{t(LABEL_KEYS[key])}</span>
            <span className="ms-auto font-medium tabular-nums text-[var(--text-primary)]">
              {Math.round(value)} {t("common.grams")}
            </span>
          </li>
        ))}
      </ul>
      )}
    </div>
  );
}
