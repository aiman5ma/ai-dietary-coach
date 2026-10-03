import { useLocation } from "react-router-dom";
import { History } from "lucide-react";

import HistoryPanel from "./HistoryPanel.jsx";
import Navbar from "./Navbar.jsx";
import { useHistory } from "../context/historyContext.js";
import { useLanguage } from "../context/LanguageContext.jsx";

function HistoryButton({ onClick }) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-press inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] backdrop-blur-md transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"
    >
      <History className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">{t("history.view")}</span>
      <span className="sr-only sm:hidden">{t("history.viewShort")}</span>
    </button>
  );
}

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const {
    foodLog,
    bmiHistory,
    isHistoryOpen,
    openHistory,
    closeHistory,
    clearFood,
    clearBmi,
  } = useHistory();
  const { isRTL } = useLanguage();

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="relative min-h-dvh bg-[var(--bg-primary)] text-left text-[var(--text-primary)] rtl:text-right dark:bg-[#0d1117] dark:text-[#f0f6fc]"
    >
      {/* Soft ambient glow accents (decorative, non-interactive) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/3 h-[420px] w-[420px] rounded-full bg-[var(--accent-green)]/10 blur-3xl rtl:left-auto rtl:right-1/3" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[380px] w-[380px] rounded-full bg-[#3b82f6]/10 blur-3xl rtl:left-[-120px] rtl:right-auto" />
      </div>

      <Navbar />

      <main className="md:pl-60 rtl:md:pl-0 rtl:md:pr-60">
        <div
          key={pathname}
          className="fade-in-up mx-auto w-full max-w-5xl px-4 pb-28 pt-6 text-left md:px-8 md:pb-10 md:pt-10 rtl:text-right"
        >
          {/* Layout-level top action bar — always visible. */}
          <div className="mb-4 flex h-9 items-center justify-end sm:mb-5">
            <HistoryButton onClick={openHistory} />
          </div>

          {children}
        </div>
      </main>

      <HistoryPanel
        isOpen={isHistoryOpen}
        onClose={closeHistory}
        foodLog={foodLog}
        bmiHistory={bmiHistory}
        onClearFood={clearFood}
        onClearBMI={clearBmi}
      />
    </div>
  );
}
