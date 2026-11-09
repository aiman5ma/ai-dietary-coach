import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";

import ChatMessage from "../components/ChatMessage.jsx";
import { chatWithNutritionist } from "../api/openai.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { generateId } from "../utils/bmi.js";

const SUGGESTION_KEYS = [
  "chat.suggestionProtein",
  "chat.suggestionCalories",
  "chat.suggestionFasting",
  "chat.suggestionFiber",
];

const MAX_TEXTAREA_PX = 120; // ~ 4 rows at 24px line-height + padding.

// Subtle dotted background for the messages area.
const DOT_PATTERN_STYLE = {
  backgroundImage:
    "radial-gradient(var(--dot) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
};

function CoachAvatar({ size = "md" }) {
  const dim =
    size === "sm" ? "h-8 w-8" : size === "lg" ? "h-14 w-14" : "h-10 w-10";
  const icon =
    size === "sm" ? "h-4 w-4" : size === "lg" ? "h-7 w-7" : "h-5 w-5";
  return (
    <span
      className={`${dim} relative grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--accent-green)] to-[#16a34a] shadow-[0_4px_18px_rgba(34,197,94,0.35)] dark:shadow-[0_4px_18px_rgba(0,0,0,0.45)]`}
    >
      <Bot className={`${icon} text-[var(--on-accent)] dark:text-[#f0f6fc]`} aria-hidden="true" />
    </span>
  );
}

function TypingIndicator() {
  const { t } = useLanguage();
  return (
    <div className="flex w-full justify-start">
      <div className="flex max-w-[85%] flex-col items-start gap-1 sm:max-w-[75%]">
        <div className="flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--accent-green)]/15 ring-1 ring-[var(--accent-green)]/30">
            <Bot className="h-3 w-3 text-[var(--accent-green)]" aria-hidden="true" />
          </span>
          <span>{t("chat.name")}</span>
        </div>
        <div className="rounded-2xl rounded-ss-md border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent-green)]"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent-green)]"
              style={{ animationDelay: "120ms" }}
            />
            <span
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent-green)]"
              style={{ animationDelay: "240ms" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemError({ content, onRetry }) {
  const { t } = useLanguage();
  return (
    <div className="flex w-full justify-center">
      <div className="flex max-w-md items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200/90">
        <AlertCircle
          className="mt-0.5 h-4 w-4 shrink-0 text-red-400"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="break-words">{content}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-red-500/30 px-2 py-0.5 font-medium text-red-200 transition-colors hover:bg-red-500/10"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              {t("common.tryAgain")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onSelect, disabled }) {
  const { t } = useLanguage();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-4 py-8 text-center">
      <CoachAvatar size="lg" />
      <div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
          {t("chat.greeting")}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
          {t("chat.intro")}
        </p>
      </div>

      <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {SUGGESTION_KEYS.map((key) => {
          const question = t(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(question)}
              disabled={disabled}
              className="btn-press group rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-3 text-start text-sm text-[var(--text-primary)] backdrop-blur-md transition-colors hover:border-[var(--accent-green)]/40 hover:bg-[var(--accent-green)]/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="inline-block text-[var(--accent-green)] rtl:-scale-x-100">
                →
              </span>
              <span className="ms-2">{question}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function NutritionChat() {
  const { t, lang } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const messagesRef = useRef(null);
  const textareaRef = useRef(null);
  const abortRef = useRef(null);
  const confirmTimerRef = useRef(null);
  const lastUserPromptRef = useRef(null);

  // Cleanup on unmount.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    },
    [],
  );

  // Auto-scroll to bottom whenever the message list grows or while
  // the typing indicator is visible.
  useEffect(() => {
    const node = messagesRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function adjustTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }

  function handleInputChange(e) {
    setInput(e.target.value);
    // Defer measurement until React commits the new value.
    requestAnimationFrame(adjustTextarea);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  async function sendMessage(rawText) {
    const text = String(rawText || "").trim();
    if (!text || loading) return;

    const userMsg = {
      id: generateId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    lastUserPromptRef.current = text;

    // Optimistically append the user turn and clear the input.
    const conversation = [...messages, userMsg];
    setMessages(conversation);
    setInput("");
    requestAnimationFrame(adjustTextarea);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      // Send only well-formed user/assistant turns to the API.
      const apiMessages = conversation
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map(({ role, content }) => ({ role, content }));

      const reply = await chatWithNutritionist(apiMessages, lang, {
        signal: controller.signal,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content: reply,
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      if (err?.name === "AbortError") return;
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "system",
          content: err?.message || t("chat.unreachable"),
          timestamp: Date.now(),
        },
      ]);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  }

  function handleSuggestion(text) {
    void sendMessage(text);
  }

  function handleRetryLast() {
    const last = lastUserPromptRef.current;
    if (!last || loading) return;
    // Drop any trailing system error so the retry replaces it.
    setMessages((prev) => {
      const trimmed = [...prev];
      while (trimmed.length && trimmed[trimmed.length - 1].role === "system") {
        trimmed.pop();
      }
      return trimmed;
    });
    void sendMessage(last);
  }

  function startClear() {
    if (loading) return;
    if (messages.length === 0) return;
    setConfirmingClear(true);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(
      () => setConfirmingClear(false),
      4000,
    );
  }

  function cancelClear() {
    setConfirmingClear(false);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
  }

  function confirmClear() {
    abortRef.current?.abort();
    setMessages([]);
    setConfirmingClear(false);
    setLoading(false);
    setInput("");
    lastUserPromptRef.current = null;
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    requestAnimationFrame(() => {
      adjustTextarea();
      textareaRef.current?.focus();
    });
  }

  const isEmpty = messages.length === 0 && !loading;
  const canSend = input.trim().length > 0 && !loading;

  // Identify the trailing system error (if any) so we can offer retry.
  const lastIsError =
    messages.length > 0 &&
    messages[messages.length - 1].role === "system";

  return (
    <section
      aria-label={t("chat.region")}
      className="flex h-[calc(100dvh-252px)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.25)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(22,27,34,0.95)] dark:text-[#f0f6fc] dark:shadow-[0_8px_30px_rgba(0,0,0,0.55)] md:h-[calc(100dvh-136px)]"
    >
      <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <CoachAvatar />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-[var(--text-primary)] sm:text-base">
                {t("chat.name")}
              </h2>
              <span
                className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-green)]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--accent-green)] rtl:normal-case rtl:tracking-normal"
                aria-label={t("chat.online")}
              >
                <span className="relative grid h-1.5 w-1.5 place-items-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent-green)] opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent-green)]" />
                </span>
                {t("chat.online")}
              </span>
            </div>
            <p className="truncate text-xs text-[var(--text-secondary)]">{t("chat.role")}</p>
          </div>
        </div>

        {confirmingClear ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-black/[0.04] dark:bg-white/[0.06] px-2 py-1">
            <span className="hidden text-[11px] font-medium text-[var(--text-secondary)] sm:inline">
              {t("chat.clearPrompt")}
            </span>
            <button
              type="button"
              onClick={cancelClear}
              className="rounded-md px-2 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-black/[0.04] hover:text-[var(--text-primary)] dark:hover:bg-white/[0.08]"
            >
              {t("chat.cancel")}
            </button>
            <button
              type="button"
              onClick={confirmClear}
              className="rounded-md bg-red-500/15 px-2 py-1 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/25"
            >
              {t("chat.confirmClear")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startClear}
            disabled={messages.length === 0 || loading}
            className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.08] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--text-secondary)]"
            aria-label={t("chat.clear")}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{t("chat.clear")}</span>
          </button>
        )}
      </header>

      <div
        ref={messagesRef}
        className="flex-1 overflow-y-auto"
        style={DOT_PATTERN_STYLE}
      >
        {isEmpty ? (
          <EmptyState onSelect={handleSuggestion} disabled={loading} />
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-5 sm:px-6">
            {messages.map((m) =>
              m.role === "system" ? (
                <SystemError
                  key={m.id}
                  content={m.content}
                  onRetry={
                    !loading && m === messages[messages.length - 1]
                      ? handleRetryLast
                      : null
                  }
                />
              ) : (
                <ChatMessage
                  key={m.id}
                  role={m.role}
                  content={m.content}
                  timestamp={m.timestamp}
                />
              ),
            )}
            {loading ? <TypingIndicator /> : null}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
        className="border-t border-[var(--border)] bg-[var(--bg-card)] px-3 py-3 backdrop-blur-md sm:px-4"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-black/[0.04] dark:bg-white/[0.06] px-2 py-1.5 focus-within:border-[var(--accent-green)]/50">
          <label htmlFor="chat-input" className="sr-only">
            {t("chat.inputLabel")}
          </label>
          <textarea
            id="chat-input"
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={t("chat.placeholder")}
            className="max-h-[120px] min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-base text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label={t("chat.send")}
            className={[
              "btn-press grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors",
              canSend
                ? "bg-[var(--accent-green)] text-[var(--on-accent)] dark:text-[#f0f6fc] hover:bg-[var(--accent-green)]/90 active:bg-[var(--accent-green)]/80"
                : "bg-black/[0.04] dark:bg-white/[0.06] text-[var(--text-secondary)]",
            ].join(" ")}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1.5 px-2 text-[10px] text-[var(--text-secondary)]">
          {lastIsError ? t("chat.retryHint") : t("chat.sendHint")}
        </p>
      </form>
    </section>
  );
}
