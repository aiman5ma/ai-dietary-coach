import { useId, useState } from "react";
import { Leaf, LogIn, UserRound } from "lucide-react";

import { LanguageToggle, ThemeToggle } from "../components/Navbar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LandingPage() {
  const { t, isRTL } = useLanguage();
  const { login, continueAsGuest } = useAuth();
  const emailId = useId();
  const passwordId = useId();

  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorKey, setErrorKey] = useState("");

  function handleLogin(e) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setErrorKey("landing.emailRequired");
      return;
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      setErrorKey("landing.emailInvalid");
      return;
    }
    if (!password) {
      setErrorKey("landing.passwordRequired");
      return;
    }
    login(trimmed);
  }

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="relative min-h-dvh bg-[var(--bg-primary)] text-left text-[var(--text-primary)] rtl:text-right dark:bg-[#0d1117] dark:text-[#f0f6fc]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/3 h-[420px] w-[420px] rounded-full bg-[var(--accent-green)]/10 blur-3xl rtl:left-auto rtl:right-1/3" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[380px] w-[380px] rounded-full bg-[#3b82f6]/10 blur-3xl rtl:left-[-120px] rtl:right-auto" />
      </div>

      <header className="flex items-center justify-end gap-2 px-4 py-4 sm:px-8">
        <ThemeToggle />
        <LanguageToggle />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-col items-center px-4 pb-16 pt-6 sm:pt-10">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--accent-green)]/15 ring-1 ring-[var(--accent-green)]/30">
          <Leaf
            className="h-8 w-8 text-[var(--accent-green)]"
            strokeWidth={2.25}
            aria-hidden="true"
          />
        </span>
        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal">
          {t("app.tagline")}
        </p>
        <h1 className="mt-1 text-center font-sans text-2xl font-bold leading-snug text-[var(--text-primary)] sm:text-3xl">
          {t("app.name")}
        </h1>
        <p className="mt-2 text-center text-sm text-[var(--text-secondary)] sm:text-base">
          {t("landing.subtitle")}
        </p>

        <section className="fade-in-up mt-8 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.25)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(22,27,34,0.95)] dark:text-[#f0f6fc] dark:shadow-[0_8px_30px_rgba(0,0,0,0.55)] sm:p-6">
          {showLogin ? (
            <form onSubmit={handleLogin} noValidate className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor={emailId}
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal"
                >
                  {t("landing.email")}
                </label>
                <input
                  id={emailId}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorKey("");
                  }}
                  placeholder={t("landing.emailPlaceholder")}
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-black/[0.04] dark:bg-white/[0.06] px-4 py-3 text-left text-base text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:border-[var(--accent-green)]/50 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor={passwordId}
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal"
                >
                  {t("landing.password")}
                </label>
                <input
                  id={passwordId}
                  type="password"
                  autoComplete="current-password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorKey("");
                  }}
                  placeholder={t("landing.passwordPlaceholder")}
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-black/[0.04] dark:bg-white/[0.06] px-4 py-3 text-left text-base text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:border-[var(--accent-green)]/50 focus:outline-none"
                />
              </div>

              {errorKey ? (
                <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                  {t(errorKey)}
                </p>
              ) : null}

              <button
                type="submit"
                className="btn-press inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-green)] px-5 py-3 text-sm font-bold text-[var(--on-accent)] dark:text-[#f0f6fc] transition-colors hover:bg-[var(--accent-green)]/90 active:bg-[var(--accent-green)]/80"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                {t("landing.submit")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogin(false);
                  setErrorKey("");
                }}
                className="btn-press inline-flex w-full items-center justify-center rounded-xl px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.08] hover:text-[var(--text-primary)]"
              >
                {t("landing.back")}
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setShowLogin(true)}
                className="btn-press inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-green)] px-5 py-3 text-sm font-bold text-[var(--on-accent)] dark:text-[#f0f6fc] transition-colors hover:bg-[var(--accent-green)]/90 active:bg-[var(--accent-green)]/80"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                {t("landing.login")}
              </button>
              <button
                type="button"
                onClick={continueAsGuest}
                className="btn-press inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-black/[0.03] dark:bg-white/[0.05] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"
              >
                <UserRound className="h-4 w-4" aria-hidden="true" />
                {t("landing.guest")}
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
