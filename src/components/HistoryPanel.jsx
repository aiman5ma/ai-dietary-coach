import { useEffect, useState } from "react";
import { Activity, Apple, Trash2, Utensils, X } from "lucide-react";

const TABS = [
  { id: "food", label: "Food Log", Icon: Utensils },
  { id: "bmi", label: "BMI History", Icon: Activity },
];

const CATEGORY_COLORS = {
  Underweight: "#3b82f6",
  Normal: "var(--accent-green)",
  Overweight: "#f97316",
  Obese: "#ef4444",
};

function entryDate(entry) {
  return entry?.date ?? entry?.timestamp ?? entry?.createdAt ?? null;
}

function formatDate(value) {
  if (value == null) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `Today, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

function sortNewestFirst(list) {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const aT = new Date(entryDate(a) || 0).getTime();
    const bT = new Date(entryDate(b) || 0).getTime();
    return bT - aT;
  });
}

function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] px-4 py-10 text-center">
      <Icon className="h-6 w-6 text-[var(--text-secondary)]" aria-hidden="true" />
      <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="text-xs text-[var(--text-secondary)]">{hint}</p>
    </div>
  );
}

function FoodEntry({ entry }) {
  const calories = Math.round(Number(entry?.calories) || 0);
  const name = entry?.foodName || entry?.name || "Unknown food";
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-black/[0.03] px-3.5 py-3 transition-colors hover:bg-black/[0.05]">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{name}</p>
        <p className="text-xs text-[var(--text-secondary)]">{formatDate(entryDate(entry))}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-[var(--accent-green)] tabular-nums">{calories}</p>
        <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">kcal</p>
      </div>
    </li>
  );
}

function BMIEntry({ entry }) {
  const value = Number(entry?.bmi);
  const display = Number.isFinite(value) ? value.toFixed(1) : "—";
  const category = entry?.category || "—";
  const color = CATEGORY_COLORS[category] || "var(--text-secondary)";
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-black/[0.03] px-3.5 py-3 transition-colors hover:bg-black/[0.05]">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-black/[0.05] text-sm font-bold tabular-nums text-[var(--text-primary)]">
          {display}
        </div>
        <div className="min-w-0">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ backgroundColor: `${color}1f`, color }}
          >
            {category}
          </span>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {formatDate(entryDate(entry))}
          </p>
        </div>
      </div>
    </li>
  );
}

export default function HistoryPanel({
  isOpen,
  onClose,
  foodLog = [],
  bmiHistory = [],
  onClearFood,
  onClearBMI,
}) {
  const [activeTab, setActiveTab] = useState("food");

  // Close on Escape while open.
  useEffect(() => {
    if (!isOpen) return undefined;
    function onKey(e) {
      if (e.key === "Escape" && typeof onClose === "function") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Lock body scroll while drawer is open so the page underneath doesn't move.
  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const sortedFood = sortNewestFirst(foodLog);
  const sortedBmi = sortNewestFirst(bmiHistory);
  const showFood = activeTab === "food";
  const activeCount = showFood ? sortedFood.length : sortedBmi.length;

  return (
    <div
      aria-hidden={!isOpen}
      className={[
        "fixed inset-0 z-50",
        isOpen ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
    >
      <div
        onClick={onClose}
        className={[
          "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0",
        ].join(" ")}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="History"
        className={[
          "absolute right-0 top-0 flex h-dvh w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--bg-card)] shadow-2xl backdrop-blur-md transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              History
            </p>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Your activity
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close history"
            className="grid h-9 w-9 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-black/[0.04] hover:text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div
          role="tablist"
          aria-label="History tabs"
          className="flex gap-1 border-b border-[var(--border)] px-3 py-2"
        >
          {TABS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(id)}
                className={[
                  "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--accent-green)]/10 text-[var(--accent-green)]"
                    : "text-[var(--text-secondary)] hover:bg-black/[0.04] hover:text-[var(--text-primary)]",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-5 pt-4">
            <p className="text-xs text-[var(--text-secondary)]">
              {activeCount} {activeCount === 1 ? "entry" : "entries"}
            </p>
            <button
              type="button"
              onClick={showFood ? onClearFood : onClearBMI}
              disabled={activeCount === 0}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-black/[0.04] hover:text-[#ef4444] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--text-secondary)]"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Clear all
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-5 pt-3">
            {showFood ? (
              sortedFood.length === 0 ? (
                <EmptyState
                  icon={Apple}
                  title="No saved meals yet"
                  hint="Analyze a food and tap Save to Log to start your history."
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {sortedFood.map((entry, i) => (
                    <FoodEntry key={entry?.id ?? i} entry={entry} />
                  ))}
                </ul>
              )
            ) : sortedBmi.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No BMI history"
                hint="Calculate your BMI to see it tracked here over time."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {sortedBmi.map((entry, i) => (
                  <BMIEntry key={entry?.id ?? i} entry={entry} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
