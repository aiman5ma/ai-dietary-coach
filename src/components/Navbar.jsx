import { NavLink } from "react-router-dom";
import { Camera, Leaf, MessageCircle, Salad, Scale } from "lucide-react";

const NAV_ITEMS = [
  { to: "/", end: true, label: "Nutrition", Icon: Salad },
  { to: "/bmi", label: "BMI", Icon: Scale },
  { to: "/scanner", label: "Scanner", Icon: Camera },
  { to: "/chat", label: "Chat", Icon: MessageCircle },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-green)]/15 ring-1 ring-[var(--accent-green)]/30">
        <Leaf className="h-[18px] w-[18px] text-[var(--accent-green)]" strokeWidth={2.25} />
      </span>
      <div className="leading-tight">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
          AI Coach
        </p>
        <h1 className="font-sans text-[15px] font-bold text-[var(--text-primary)]">
          AI Dietary Coach
        </h1>
      </div>
    </div>
  );
}

const sidebarItemClasses = ({ isActive }) =>
  [
    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
    isActive
      ? "bg-[var(--accent-green)]/10 text-[var(--accent-green)]"
      : "text-[var(--text-secondary)] hover:bg-black/[0.04] hover:text-[var(--text-primary)]",
  ].join(" ");

const bottomItemClasses = ({ isActive }) =>
  [
    "relative flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-colors duration-200",
    isActive
      ? "bg-[var(--accent-green)]/10 text-[var(--accent-green)]"
      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
  ].join(" ");

export default function Navbar() {
  return (
    <>
      {/* Desktop sidebar (>= md) */}
      <aside
        aria-label="Primary navigation"
        className="fixed left-0 top-0 z-40 hidden h-dvh w-60 flex-col gap-6 border-r border-[var(--border)] bg-[var(--bg-card)] px-5 py-7 backdrop-blur-md md:flex"
      >
        <Logo />

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, end, label, Icon }) => (
            <NavLink key={to} to={to} end={end} className={sidebarItemClasses}>
              <Icon
                className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-105"
                strokeWidth={2}
                aria-hidden="true"
              />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-xl border border-[var(--border)] bg-black/[0.03] p-3">
          <p className="font-body text-xs leading-relaxed text-[var(--text-secondary)]">
            Powered by <span className="text-[var(--text-primary)]">OpenAI</span>. Track macros,
            scan meals, and chat with{" "}
            <span className="text-[var(--accent-green)]">Coach Nova</span>.
          </p>
        </div>
      </aside>

      {/* Mobile bottom nav (< md) */}
      <nav
        aria-label="Primary navigation"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-[var(--bg-card)] backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto grid max-w-md grid-cols-4 gap-1 px-2 py-2">
          {NAV_ITEMS.map(({ to, end, label, Icon }) => (
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
                      className="h-[22px] w-[22px]"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span>{label}</span>
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
