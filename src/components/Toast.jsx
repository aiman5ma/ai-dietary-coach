import { useEffect } from "react";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";

import { useLanguage } from "../context/LanguageContext.jsx";

const VARIANTS = {
  success: {
    Icon: CheckCircle,
    bubble:
      "border border-[var(--accent-green)]/30 bg-[var(--accent-green)]/15 text-[var(--accent-green)]",
    iconClass: "text-[var(--accent-green)]",
  },
  error: {
    Icon: AlertCircle,
    bubble: "border border-red-500/30 bg-red-500/15 text-red-200",
    iconClass: "text-red-300",
  },
  info: {
    Icon: Info,
    bubble: "border border-[#3b82f6]/30 bg-[#3b82f6]/15 text-[#bfdbfe]",
    iconClass: "text-[#60a5fa]",
  },
};

/**
 * Top-center toast notification.
 *   - Slides down on appear, slides up on dismiss
 *   - Auto-dismisses after `duration` (default 3000ms)
 *   - `type` controls color: "success" | "error" | "info"
 *
 * Controlled via `visible` + `onDismiss` so the parent owns the lifecycle.
 */
export default function Toast({
  message,
  type = "success",
  visible,
  onDismiss,
  duration = 3000,
  showClose = false,
}) {
  useEffect(() => {
    if (!visible) return undefined;
    const id = setTimeout(() => onDismiss?.(), duration);
    return () => clearTimeout(id);
  }, [visible, duration, onDismiss]);

  const { t } = useLanguage();
  const variant = VARIANTS[type] || VARIANTS.info;
  const Icon = variant.Icon;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      className={[
        "fixed left-1/2 top-4 z-[60] -translate-x-1/2 transition-all duration-300 ease-out",
        visible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-3 opacity-0",
      ].join(" ")}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div
        className={[
          "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-[0_8px_30px_rgba(0,0,0,0.35)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md",
          variant.bubble,
        ].join(" ")}
      >
        <Icon
          className={`h-4 w-4 shrink-0 ${variant.iconClass}`}
          aria-hidden="true"
        />
        <span className="max-w-[60vw] truncate sm:max-w-sm">{message}</span>
        {showClose ? (
          <button
            type="button"
            onClick={() => onDismiss?.()}
            aria-label={t("common.dismiss")}
            className="ms-1 grid h-5 w-5 place-items-center rounded-full text-current/70 transition-colors hover:bg-black/[0.06] hover:text-current dark:hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
