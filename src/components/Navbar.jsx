import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Camera, Flame, Globe, Leaf, LogOut, MessageCircle, Moon, Salad, Scale, Sun } from "lucide-react";

import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { readTodayCalories, subscribeDailyLog } from "../utils/dailyLog.js";

const NAV_ITEMS = [
  { to: "/", end: true, labelKey: "nav.nutrition", Icon: Salad },
  { to: "/bmi", labelKey: "nav.bmi", Icon: Scale },
  { to: "/scanner", labelKey: "nav.scanner", Icon: Camera },
  { to: "/chat", labelKey: "nav.chat", Icon: MessageCircle },
  { to: "/tracker", labelKey: "nav.tracker", Icon: Flame },
];

function useTodayCalories() {
  const [calories, setCalories] = useState(() => readTodayCalories());
  useEffect(() => subscribeDailyLog(() => setCalories(readTodayCalories())), []);
  return calories;
}

function Logo() {
  const { t } = useLanguage();
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-green)]/15 ring-1 ring-[var(--accent-green)]/30">
        <Leaf className="h-[18px] w-[18px] text-[var(--accent-green)]" strokeWidth={2.25} />
      </span>
      <div className="min-w-0 leading-tight text-left rtl:text-right">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal">
          {t("app.tagline")}
        </p>
        <h1 className="font-sans text-[15px] font-bold leading-snug text-[var(--text-primary)]">
          {t("app.name")}
        </h1>
      </div>
    </div>
  );
}

export function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";
  const label = isDark ? t("theme.switchToLight") : t("theme.switchToDark");
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={isDark}
      className={[
        "btn-press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-black/[0.03] text-[var(--text-primary)] transition-colors hover:bg-black/[0.04] dark:border-[rgba(255,255,255,0.08)] dark:bg-white/[0.05] dark:text-[#f0f6fc] dark:hover:bg-white/[0.08]",
        className,
      ].join(" ")}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export function LanguageToggle({ className = "" }) {
  const { lang, setLang, t } = useLanguage();
  const nextLang = lang === "ar" ? "en" : "ar";
  const label = lang === "ar" ? t("language.english") : t("language.arabic");
  const ariaLabel =
    lang === "ar" ? t("language.switchToEnglish") : t("language.switchToArabic");

  return (
    <button
      type="button"
      onClick={() => setLang(nextLang)}
      aria-label={ariaLabel}
      className={[
        "btn-press inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-black/[0.03] dark:bg-white/[0.05] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.08]",
        className,
      ].join(" ")}
    >
      <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function LogoutButton({ compact = false, className = "" }) {
  const { t } = useLanguage();
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const label = session?.kind === "guest" ? t("nav.exit") : t("nav.logout");

  return (
    <button
      type="button"
      onClick={() => {
        logout();
        navigate("/", { replace: true });
      }}
      aria-label={label}
      className={[
        "btn-press inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-black/[0.03] dark:bg-white/[0.05] text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.08]",
        compact ? "h-10 w-10 px-0" : "px-3 py-2",
        className,
      ].join(" ")}
    >
      <LogOut className="h-4 w-4 shrink-0 rtl:-scale-x-100" aria-hidden="true" />
      {compact ? <span className="sr-only">{label}</span> : <span>{label}</span>}
    </button>
  );
}

const sidebarItemClasses = ({ isActive }) =>
  [
    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors duration-200 rtl:text-right",
    isActive
      ? "bg-[var(--accent-green)]/10 text-[var(--accent-green)]"
      : "text-[var(--text-secondary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] hover:text-[var(--text-primary)]",
  ].join(" ");

const bottomItemClasses = ({ isActive }) =>
  [
    "relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[10px] font-medium leading-tight transition-colors duration-200",
    isActive
      ? "bg-[var(--accent-green)]/10 text-[var(--accent-green)]"
      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
  ].join(" ");

export default function Navbar() {
  const { t, lang } = useLanguage();
  const todayKcal = useTodayCalories();
  const locale = lang === "ar" ? "ar" : "en";
  const calorieBadge = todayKcal == null ? null : Math.round(todayKcal).toLocaleString(locale);

  return (
    <>
      {/* Mobile header (< md) */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-left backdrop-blur-md rtl:text-right dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(22,27,34,0.95)] dark:text-[#f0f6fc] md:hidden"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <Logo />
        <div className="flex shrink-0 items-center gap-2">
          <LogoutButton compact />
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </header>

      {/* Desktop sidebar (>= md) */}
      <aside
        aria-label={t("nav.primary")}
        className="fixed left-0 top-0 z-40 hidden h-dvh w-60 flex-col gap-6 border-r border-[var(--border)] bg-[var(--bg-card)] px-5 py-7 text-left backdrop-blur-md rtl:left-auto rtl:right-0 rtl:border-l rtl:border-r-0 rtl:text-right dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(22,27,34,0.95)] dark:text-[#f0f6fc] md:flex"
      >
        <div className="flex items-start justify-between gap-2">
          <Logo />
          <ThemeToggle />
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, end, labelKey, Icon }) => (
            <NavLink key={to} to={to} end={end} className={sidebarItemClasses}>
              <Icon
                className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-105"
                strokeWidth={2}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">{t(labelKey)}</span>
              {to === "/tracker" && calorieBadge ? (
                <span className="ms-auto shrink-0 rounded-full bg-[var(--accent-green)]/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--accent-green)]">
                  {calorieBadge}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <LanguageToggle className="w-full" />

        <div className="mt-auto flex flex-col gap-3">
          <LogoutButton className="w-full" />
          <div className="rounded-xl border border-[var(--border)] bg-black/[0.03] dark:bg-white/[0.05] p-3">
            <p className="font-body text-xs leading-relaxed text-[var(--text-secondary)]">
              {t("nav.poweredBy")}{" "}
              <span className="text-[var(--text-primary)]">OpenAI</span>
              {". "}
              {t("nav.sidebarAction")}{" "}
              <span className="text-[var(--accent-green)]">{t("nav.coachName")}</span>
              {"."}
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav (< md) */}
      <nav
        aria-label={t("nav.primary")}
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-[var(--bg-card)] backdrop-blur-md dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(22,27,34,0.95)] dark:text-[#f0f6fc] md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto grid max-w-md grid-cols-5 gap-0.5 px-1.5 py-1.5">
          {NAV_ITEMS.map(({ to, end, labelKey, Icon }) => (
            <li key={to}>
              <NavLink to={to} end={end} className={bottomItemClasses}>
                {({ isActive }) => (
                  <>
                    <span
                      aria-hidden="true"
                      className={[
                        "absolute top-1 h-1 w-1 rounded-full bg-[var(--accent-green)] transition-opacity duration-200",
                        isActive ? "opacity-100" : "opacity-0",
                      ].join(" ")}
                    />
                    <Icon
                      className="h-5 w-5"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    {to === "/tracker" && calorieBadge ? (
                      <span className="text-[9px] font-bold tabular-nums leading-none text-[var(--accent-green)]">
                        {calorieBadge}
                      </span>
                    ) : null}
                    <span className="line-clamp-2 w-full text-center">{t(labelKey)}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
