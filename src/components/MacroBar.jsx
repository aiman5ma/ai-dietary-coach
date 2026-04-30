// Horizontal macro split bar with a small legend underneath.
// Segment widths are proportional to grams; the bar gracefully renders
// an empty track when all macros are zero or unknown.

const COLORS = {
  protein: "#3b82f6", // accent-blue
  carbs: "#f97316",   // accent-orange
  fat: "#eab308",     // accent-yellow
};

const LABELS = {
  protein: "Protein",
  carbs: "Carbs",
  fat: "Fat",
};

export default function MacroBar({ protein = 0, carbs = 0, fat = 0 }) {
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
        className="flex h-3 w-full overflow-hidden rounded-full bg-black/[0.06]"
        role="img"
        aria-label={`Macro split: ${Math.round(p)}g protein, ${Math.round(c)}g carbs, ${Math.round(f)}g fat`}
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

      <ul className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {segments.map(({ key, value }) => (
          <li key={key} className="flex items-center gap-2 min-w-0">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: COLORS[key] }}
              aria-hidden="true"
            />
            <span className="truncate text-[var(--text-secondary)]">{LABELS[key]}</span>
            <span className="ml-auto font-medium text-[var(--text-primary)] tabular-nums">
              {Math.round(value)}g
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
