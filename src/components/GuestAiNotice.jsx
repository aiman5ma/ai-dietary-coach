import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

/**
 * Guests can browse the app. AI features require a signed-in account.
 * Both languages are shown together so the request to sign in is clear
 * whichever language the guest is reading.
 */
export default function GuestAiNotice() {
  const { isGuest, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  if (!isGuest) return null;

  return (
    <div
      role="status"
      className="mb-4 rounded-xl border border-[var(--accent-green)]/30 bg-[var(--accent-green)]/10 px-4 py-3 text-sm text-[var(--text-primary)]"
    >
      <p className="font-semibold">{t("ai.guestTitle")}</p>
      <p className="mt-1 leading-relaxed text-[var(--text-secondary)]">{t("ai.guestBodyEn")}</p>
      <p dir="rtl" className="mt-1 text-right leading-relaxed text-[var(--text-secondary)]">
        {t("ai.guestBodyAr")}
      </p>
      <button
        type="button"
        onClick={() => {
          void signOut().finally(() => navigate("/", { replace: true }));
        }}
        className="btn-press mt-3 inline-flex items-center rounded-lg bg-[var(--accent-green)] px-3 py-1.5 text-xs font-semibold text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-green)]/90 dark:text-[#f0f6fc]"
      >
        {t("ai.guestSignIn")}
      </button>
    </div>
  );
}
