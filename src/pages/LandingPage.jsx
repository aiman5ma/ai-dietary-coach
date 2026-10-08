import { useId, useState } from "react";
import { Leaf, Loader2, LogIn, UserPlus, UserRound } from "lucide-react";

import { LanguageToggle, ThemeToggle } from "../components/Navbar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { saveProfile } from "../lib/db.js";
import { supabase } from "../lib/supabase.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function authErrorKey(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();

  if (
    code === "user_not_found" ||
    message.includes("user not found") ||
    message.includes("email not found")
  ) {
    return "landing.emailNotFound";
  }
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "landing.wrongPassword";
  }
  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    message.includes("already registered") ||
    message.includes("already been registered")
  ) {
    return "landing.emailExists";
  }
  if (
    code === "weak_password" ||
    message.includes("weak password") ||
    message.includes("at least 6") ||
    message.includes("password should be")
  ) {
    return "landing.weakPassword";
  }
  if (
    code === "email_address_invalid" ||
    (message.includes("email address") && message.includes("invalid"))
  ) {
    return "landing.emailInvalid";
  }
  if (
    code === "over_email_send_rate_limit" ||
    message.includes("email rate limit")
  ) {
    return "landing.emailRateLimit";
  }
  return "landing.authFailed";
}

const fieldClass =
  "mt-2 w-full rounded-xl border border-[var(--border)] bg-black/[0.04] px-4 py-3 text-left text-base text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:border-[var(--accent-green)]/50 focus:outline-none dark:bg-white/[0.06]";

const labelClass =
  "block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal";

export default function LandingPage() {
  const { t, isRTL } = useLanguage();
  const { continueAsGuest } = useAuth();
  const emailId = useId();
  const passwordId = useId();
  const nameId = useId();
  const confirmId = useId();

  const [tab, setTab] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorKey, setErrorKey] = useState("");
  const [infoKey, setInfoKey] = useState("");
  const [busy, setBusy] = useState(false);

  function clearMessages() {
    setErrorKey("");
    setInfoKey("");
  }

  function switchTab(next) {
    setTab(next);
    clearMessages();
  }

  function validateEmailAndPassword() {
    const trimmed = email.trim();
    if (!trimmed) {
      setErrorKey("landing.emailRequired");
      return null;
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      setErrorKey("landing.emailInvalid");
      return null;
    }
    if (!password) {
      setErrorKey("landing.passwordRequired");
      return null;
    }
    return trimmed;
  }

  async function handleLogin(event) {
    event.preventDefault();
    clearMessages();
    const trimmed = validateEmailAndPassword();
    if (!trimmed) return;
    if (!supabase) {
      setErrorKey("landing.authUnavailable");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (error) setErrorKey(authErrorKey(error));
    } catch (error) {
      setErrorKey(authErrorKey(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(event) {
    event.preventDefault();
    clearMessages();
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setErrorKey("landing.nameRequired");
      return;
    }
    const trimmed = validateEmailAndPassword();
    if (!trimmed) return;
    if (password.length < 6) {
      setErrorKey("landing.weakPassword");
      return;
    }
    if (password !== confirmPassword) {
      setErrorKey("landing.passwordMismatch");
      return;
    }
    if (!supabase) {
      setErrorKey("landing.authUnavailable");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmed,
        password,
        options: { data: { full_name: trimmedName } },
      });
      if (error) {
        setErrorKey(authErrorKey(error));
        return;
      }
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setErrorKey("landing.emailExists");
        return;
      }
      if (data.session && data.user) {
        await saveProfile({ id: data.user.id, full_name: trimmedName });
        return;
      }
      setInfoKey("landing.checkEmail");
    } catch (error) {
      setErrorKey(authErrorKey(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    clearMessages();
    const trimmed = email.trim();
    if (!trimmed) {
      setErrorKey("landing.emailRequired");
      return;
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      setErrorKey("landing.emailInvalid");
      return;
    }
    if (!supabase) {
      setErrorKey("landing.authUnavailable");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed);
      if (error) {
        setErrorKey(authErrorKey(error));
        return;
      }
      setInfoKey("landing.resetSent");
    } catch (error) {
      setErrorKey(authErrorKey(error));
    } finally {
      setBusy(false);
    }
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

        <section className="fade-in-up mt-8 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur-md dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(22,27,34,0.95)] dark:text-[#f0f6fc] dark:shadow-[0_8px_30px_rgba(0,0,0,0.55)] sm:p-6">
          <div
            role="tablist"
            aria-label={t("landing.login")}
            className="grid grid-cols-2 gap-1 rounded-xl bg-black/[0.04] p-1 dark:bg-white/[0.05]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "login"}
              onClick={() => switchTab("login")}
              className={[
                "btn-press rounded-lg px-3 py-2 text-sm font-semibold",
                tab === "login"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm dark:bg-[rgba(22,27,34,0.95)]"
                  : "text-[var(--text-secondary)]",
              ].join(" ")}
            >
              {t("landing.login")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "signup"}
              onClick={() => switchTab("signup")}
              className={[
                "btn-press rounded-lg px-3 py-2 text-sm font-semibold",
                tab === "signup"
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm dark:bg-[rgba(22,27,34,0.95)]"
                  : "text-[var(--text-secondary)]",
              ].join(" ")}
            >
              {t("landing.createAccount")}
            </button>
          </div>

          <form
            onSubmit={tab === "login" ? handleLogin : handleSignUp}
            noValidate
            className="mt-4 flex flex-col gap-4"
          >
            {tab === "signup" ? (
              <div>
                <label htmlFor={nameId} className={labelClass}>
                  {t("landing.fullName")}
                </label>
                <input
                  id={nameId}
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => {
                    setFullName(event.target.value);
                    clearMessages();
                  }}
                  placeholder={t("landing.fullNamePlaceholder")}
                  className={fieldClass}
                />
              </div>
            ) : null}

            <div>
              <label htmlFor={emailId} className={labelClass}>
                {t("landing.email")}
              </label>
              <input
                id={emailId}
                type="email"
                inputMode="email"
                autoComplete="email"
                dir="ltr"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearMessages();
                }}
                placeholder={t("landing.emailPlaceholder")}
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor={passwordId} className={labelClass}>
                {t("landing.password")}
              </label>
              <input
                id={passwordId}
                type="password"
                autoComplete={tab === "login" ? "current-password" : "new-password"}
                dir="ltr"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearMessages();
                }}
                placeholder={t("landing.passwordPlaceholder")}
                className={fieldClass}
              />
              {tab === "login" ? (
                <button
                  type="button"
                  onClick={() => void handleForgotPassword()}
                  disabled={busy}
                  className="mt-2 text-xs font-semibold text-[var(--accent-green)] disabled:opacity-60"
                >
                  {t("landing.forgotPassword")}
                </button>
              ) : null}
            </div>

            {tab === "signup" ? (
              <div>
                <label htmlFor={confirmId} className={labelClass}>
                  {t("landing.confirmPassword")}
                </label>
                <input
                  id={confirmId}
                  type="password"
                  autoComplete="new-password"
                  dir="ltr"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    clearMessages();
                  }}
                  placeholder={t("landing.confirmPasswordPlaceholder")}
                  className={fieldClass}
                />
              </div>
            ) : null}

            {errorKey ? (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                {t(errorKey)}
              </p>
            ) : null}
            {infoKey ? (
              <p role="status" className="text-sm text-[var(--accent-green)]">
                {t(infoKey)}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="btn-press inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-green)] px-5 py-3 text-sm font-bold text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-green)]/90 active:bg-[var(--accent-green)]/80 disabled:opacity-60 dark:text-[#f0f6fc]"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : tab === "login" ? (
                <LogIn className="h-4 w-4" aria-hidden="true" />
              ) : (
                <UserPlus className="h-4 w-4" aria-hidden="true" />
              )}
              {busy
                ? t("common.loading")
                : tab === "login"
                  ? t("landing.submit")
                  : t("landing.createAccount")}
            </button>
          </form>

          <button
            type="button"
            onClick={continueAsGuest}
            className="btn-press mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-black/[0.03] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-black/[0.04] dark:bg-white/[0.05] dark:hover:bg-white/[0.08]"
          >
            <UserRound className="h-4 w-4" aria-hidden="true" />
            {t("landing.guest")}
          </button>
        </section>
      </main>
    </div>
  );
}
