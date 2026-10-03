import { ExternalLink, KeyRound, Leaf, Terminal } from "lucide-react";

import { useLanguage } from "../context/LanguageContext.jsx";

const ENV_FILE_SNIPPET = `# .env  (project root)
VITE_OPENAI_API_KEY=sk-...your-key-here...`;

const COMMAND_SNIPPET = `cp .env.example .env
# then add your key and restart:
npm run dev`;

function CodeBlock({ children, label }) {
  return (
    <div dir="ltr" className="overflow-hidden rounded-xl border border-[var(--border)] bg-black/40 text-left">
      {label ? (
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          <Terminal className="h-3 w-3" aria-hidden="true" />
          {label}
        </div>
      ) : null}
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[12px] leading-relaxed text-[var(--text-primary)]">
        {children}
      </pre>
    </div>
  );
}

/**
 * Full-page setup screen shown when `VITE_OPENAI_API_KEY` is missing.
 * Replaces the entire app shell, so users see a clear "next steps" view
 * instead of broken AI features.
 */
export default function ApiKeySetup() {
  const { t } = useLanguage();

  return (
    <div className="relative min-h-dvh bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/3 h-[420px] w-[420px] rounded-full bg-[var(--accent-green)]/10 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[380px] w-[380px] rounded-full bg-[#3b82f6]/10 blur-3xl" />
      </div>

      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-10 sm:px-8 sm:py-14">
        <header className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-green)]/15 ring-1 ring-[var(--accent-green)]/30">
            <Leaf
              className="h-[18px] w-[18px] text-[var(--accent-green)]"
              strokeWidth={2.25}
              aria-hidden="true"
            />
          </span>
          <div className="leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal">
              {t("app.tagline")}
            </p>
            <p className="font-sans text-[15px] font-bold text-[var(--text-primary)]">
              {t("app.name")}
            </p>
          </div>
        </header>

        <section className="fade-in-up mt-10 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.25)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.55)] sm:p-8">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-green)]/10 ring-1 ring-[var(--accent-green)]/30">
            <KeyRound
              className="h-6 w-6 text-[var(--accent-green)]"
              aria-hidden="true"
              strokeWidth={2}
            />
          </span>

          <h1 className="mt-5 text-2xl font-bold text-[var(--text-primary)] sm:text-[28px]">
            {t("setup.title")}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
            {t("setup.intro")}
          </p>

          <ol className="mt-6 space-y-4 text-sm text-[var(--text-primary)]">
            <li className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--accent-green)]/15 text-[11px] font-bold text-[var(--accent-green)]">
                1
              </span>
              <div className="flex-1">
                <p className="font-semibold">{t("setup.step1Title")}</p>
                <p className="mt-0.5 text-[var(--text-secondary)]">
                  {t("setup.step1Body")}
                </p>
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-press mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-green)] px-3 py-1.5 text-xs font-semibold text-[var(--on-accent)] dark:text-[#f0f6fc] transition-colors hover:bg-[var(--accent-green)]/90"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("setup.step1Link")}
                </a>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--accent-green)]/15 text-[11px] font-bold text-[var(--accent-green)]">
                2
              </span>
              <div className="flex-1">
                <p className="font-semibold">{t("setup.step2Title")}</p>
                <CodeBlock label={t("setup.terminal")}>{COMMAND_SNIPPET}</CodeBlock>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--accent-green)]/15 text-[11px] font-bold text-[var(--accent-green)]">
                3
              </span>
              <div className="flex-1">
                <p className="font-semibold">{t("setup.step3Title")}</p>
                <p className="mt-0.5 text-[var(--text-secondary)]">
                  {t("setup.step3Body")}
                </p>
                <div className="mt-2">
                  <CodeBlock label=".env">{ENV_FILE_SNIPPET}</CodeBlock>
                </div>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--accent-green)]/15 text-[11px] font-bold text-[var(--accent-green)]">
                4
              </span>
              <div className="flex-1">
                <p className="font-semibold">{t("setup.step4Title")}</p>
                <p className="mt-0.5 text-[var(--text-secondary)]">
                  {t("setup.step4Body")}
                </p>
              </div>
            </li>
          </ol>

          <div className="mt-6 rounded-xl border border-[var(--border)] bg-black/[0.03] dark:bg-white/[0.05] p-3.5 text-xs text-[var(--text-secondary)]">
            <p>
              <span className="font-semibold text-[var(--text-primary)]">{t("setup.headsUp")}</span>{" "}
              {t("setup.headsUpBody")}
            </p>
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-[var(--text-secondary)]">
          {t("setup.footer")}
        </p>
      </main>
    </div>
  );
}
