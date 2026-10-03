import { Bot } from "lucide-react";

import { useLanguage } from "../context/LanguageContext.jsx";

function formatTime(value, lang) {
  if (value == null) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(lang === "ar" ? "ar" : "en", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// Lines that are only a separator (---, ——, --), not a bullet or a hyphenated word.
const DASH_ONLY_LINE = /^\s*[-–—]{2,}\s*$/;

function cleanAssistantText(content) {
  const lines = String(content ?? "").split("\n");
  const kept = [];
  let previousBlank = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    if (DASH_ONLY_LINE.test(line)) continue;

    if (line.trim() === "") {
      if (previousBlank || kept.length === 0) continue;
      previousBlank = true;
      kept.push("");
      continue;
    }

    previousBlank = false;
    kept.push(line);
  }

  while (kept.length > 0 && kept[kept.length - 1] === "") kept.pop();
  return kept.join("\n");
}

// Replace **bold** segments with <strong>. Plain strings are returned
// alongside React nodes so React can render them in order.
function renderInline(text, keyPrefix) {
  const parts = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let i = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <strong key={`${keyPrefix}-b-${i++}`} className="font-semibold">
        {match[1]}
      </strong>,
    );
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// Lightweight markdown renderer:
//   • blank lines split paragraphs
//   • ## headings become heading elements
//   • lines starting with `- ` or `* ` become bullet items
//   • inline `**bold**` becomes <strong>
//   • line breaks inside a paragraph become <br>
function renderContent(content) {
  const text = String(content ?? "");
  if (!text.trim()) return null;

  const lines = text.split("\n");
  const blocks = [];
  let paragraph = [];
  let bullets = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: "p", lines: paragraph });
      paragraph = [];
    }
  };
  const flushBullets = () => {
    if (bullets.length) {
      blocks.push({ kind: "ul", items: bullets });
      bullets = [];
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const heading = line.match(/^\s*(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushBullets();
      blocks.push({ kind: "h", level: heading[1].length, text: heading[2] });
    } else if (bullet) {
      flushParagraph();
      bullets.push(bullet[1]);
    } else if (line.trim() === "") {
      flushParagraph();
      flushBullets();
    } else {
      flushBullets();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushBullets();

  return blocks.map((block, i) => {
    if (block.kind === "h") {
      const Tag = block.level >= 3 ? "h4" : "h3";
      return (
        <Tag
          key={`h-${i}`}
          className="text-sm font-semibold leading-snug text-[var(--text-primary)] [&:not(:first-child)]:mt-3"
        >
          {renderInline(block.text, `h-${i}`)}
        </Tag>
      );
    }
    if (block.kind === "ul") {
      return (
        <ul
          key={`ul-${i}`}
          className="my-1 ms-4 list-disc space-y-1 marker:text-current/60"
        >
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item, `ul-${i}-${j}`)}</li>
          ))}
        </ul>
      );
    }
    return (
      <p
        key={`p-${i}`}
        className="leading-relaxed [&:not(:first-child)]:mt-2"
      >
        {block.lines.map((line, j) => (
          <span key={j}>
            {renderInline(line, `p-${i}-${j}`)}
            {j < block.lines.length - 1 ? <br /> : null}
          </span>
        ))}
      </p>
    );
  });
}

export default function ChatMessage({ role, content, timestamp }) {
  const { t, lang } = useLanguage();
  const isUser = role === "user";
  const time = formatTime(timestamp, lang);
  const body = renderContent(isUser ? content : cleanAssistantText(content));

  if (isUser) {
    return (
      <div className="group flex w-full justify-end">
        <div className="flex max-w-[85%] flex-col items-end gap-1 sm:max-w-[75%]">
          <div className="rounded-2xl rounded-ee-md bg-[var(--accent-green)] px-4 py-2.5 text-[var(--on-accent)] shadow-sm dark:text-[#f0f6fc]">
            <div className="text-sm font-medium">{body}</div>
          </div>
          {time ? (
            <span className="px-1 text-[10px] font-medium text-[var(--text-secondary)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {time}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex w-full justify-start">
      <div className="flex max-w-[85%] flex-col items-start gap-1 sm:max-w-[75%]">
        <div className="flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] rtl:normal-case rtl:tracking-normal">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--accent-green)]/15 ring-1 ring-[var(--accent-green)]/30">
            <Bot className="h-3 w-3 text-[var(--accent-green)]" aria-hidden="true" />
          </span>
          <span>{t("chat.name")}</span>
        </div>
        <div className="rounded-2xl rounded-ss-md border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-[var(--text-primary)] backdrop-blur-md dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(22,27,34,0.95)] dark:text-[#f0f6fc] dark:shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
          <div className="text-sm">{body}</div>
        </div>
        {time ? (
          <span className="px-1 text-[10px] font-medium text-[var(--text-secondary)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {time}
          </span>
        ) : null}
      </div>
    </div>
  );
}
