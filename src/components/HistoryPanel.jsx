import { useEffect, useState } from "react";
import { Activity, Apple, Trash2, Utensils, X } from "lucide-react";

import { useLanguage } from "../context/LanguageContext.jsx";

const TABS = [
  { id: "food", labelKey: "history.foodLog", Icon: Utensils },
  { id: "bmi", labelKey: "history.bmiHistory", Icon: Activity },
];

const CATEGORY_COLORS = {
  Underweight: "#3b82f6",
  Normal: "var(--accent-green)",
  Overweight: "#f97316",
  Obese: "#ef4444",
};

const CATEGORY_KEYS = {
  Underweight: "bmi.underweight",
  Normal: "bmi.normal",
  Overweight: "bmi.overweight",
  Obese: "bmi.obese",
};

function entryDate(entry) {
  return entry?.date ?? entry?.timestamp ?? entry?.createdAt ?? null;
}

function formatDate(value, t, lang) {
  if (value == null) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const locale = lang === "ar" ? "ar" : "en";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return t("history.today", {
      time: d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }),
    });
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(locale, {
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

function foodCountLabel(entry, t) {
  const count = Array.isArray(entry?.foods) ? entry.foods.length : 0;
  if (count < 2) return "";
  return t("history.foodCount", { count });
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
  const { t, lang } = useLanguage();
  const calories = Math.round(Number(entry?.calories) || 0);
  const name = entry?.foodName || entry?.name || t("history.unknownFood");
  const countLabel = foodCountLabel(entry, t);
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-black/[0.03] px-3.5 py-3 transition-colors hover:bg-black/[0.05] dark:bg-white/[0.05] dark:hover:bg-white/[0.08]">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{name}</p>
        <p className="text-xs text-[var(--text-secondary)]">
          {formatDate(entryDate(entry), t, lang)}
          {countLabel ? ` · ${countLabel}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-end">
        <p className="text-sm font-bold tabular-nums text-[var(--accent-green)]">{calories}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal">
          {t("history.kcal")}
        </p>
      </div>
    </li>
  );
}

function BMIEntry({ entry }) {
  const { t, lang } = useLanguage();
  const value = Number(entry?.bmi);
  const display = Number.isFinite(value) ? value.toFixed(1) : "—";
  const category = entry?.category || "";
  const color = CATEGORY_COLORS[category] || "var(--text-secondary)";
  const categoryLabel = CATEGORY_KEYS[category] ? t(CATEGORY_KEYS[category]) : category || "—";
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-black/[0.03] px-3.5 py-3 transition-colors hover:bg-black/[0.05] dark:bg-white/[0.05] dark:hover:bg-white/[0.08]">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-black/[0.05] text-sm font-bold tabular-nums text-[var(--text-primary)] dark:bg-white/[0.07]">
          {display}
        </div>
        <div className="min-w-0">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rtl:normal-case rtl:tracking-normal"
            style={{ backgroundColor: `${color}1f`, color }}
          >
            {categoryLabel}
          </span>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {formatDate(entryDate(entry), t, lang)}
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
  const { t, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState("food");

  useEffect(() => {
    if (!isOpen) return undefined;
    function onKey(e) {
      if (e.key === "Escape" && typeof onClose === "function") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

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
  const countLabel =
    activeCount === 1
      ? t("history.entrySingular", { count: activeCount })
      : t("history.entryPlural", { count: activeCount });

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
        aria-label={t("history.title")}
        className={[
          "absolute top-0 flex h-dvh w-full max-w-md flex-col border-[var(--border)] bg-[var(--bg-card)] shadow-2xl backdrop-blur-md transition-transform duration-300 ease-out dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(22,27,34,0.98)] dark:text-[#f0f6fc]",
          isRTL ? "left-0 border-r" : "right-0 border-l",
          isOpen ? "translate-x-0" : isRTL ? "-translate-x-full" : "translate-x-full",
        ].join(" ")}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0 text-start">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal">
              {t("history.title")}
            </p>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {t("history.activity")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("history.close")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-black/[0.04] hover:text-[var(--text-primary)] dark:hover:bg-white/[0.08]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div
          role="tablist"
          aria-label={t("history.tabs")}
          className="flex gap-1 border-b border-[var(--border)] px-3 py-2"
        >
          {TABS.map(({ id, labelKey, Icon }) => {
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
                    : "text-[var(--text-secondary)] hover:bg-black/[0.04] hover:text-[var(--text-primary)] dark:hover:bg-white/[0.08]",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{t(labelKey)}</span>
              </button>
            );
          })}
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-3 px-5 pt-4">
            <p className="text-xs text-[var(--text-secondary)]">{countLabel}</p>
            <button
              type="button"
              onClick={showFood ? onClearFood : onClearBMI}
              disabled={activeCount === 0}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-black/[0.04] hover:text-[#ef4444] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--text-secondary)] dark:hover:bg-white/[0.08]"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t("history.clearAll")}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-5 pt-3">
            {showFood ? (
              sortedFood.length === 0 ? (
                <EmptyState
                  icon={Apple}
                  title={t("history.emptyFoodTitle")}
                  hint={t("history.emptyFoodHint")}
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
                title={t("history.emptyBmiTitle")}
                hint={t("history.emptyBmiHint")}
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
