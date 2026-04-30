// Pulsing placeholder shown while a nutrition / scan request is in flight.
// Mirrors the rough shape of <FoodCard /> so the layout doesn't jump when
// real results arrive.
export default function FoodCardSkeleton({ withThumbnail = false }) {
  return (
    <div
      role="status"
      aria-label="Loading nutrition information"
      aria-busy="true"
      className="fade-in-up rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.25)] sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {withThumbnail ? (
            <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-black/[0.06]" />
          ) : null}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-5 w-2/3 animate-pulse rounded bg-black/[0.08]" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-black/[0.05]" />
          </div>
        </div>
        <div className="h-12 w-24 shrink-0 animate-pulse rounded-xl bg-[var(--accent-green)]/10" />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[58px] animate-pulse rounded-xl bg-black/[0.05]"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>

      <div className="mt-5 space-y-3">
        <div className="h-3 w-full animate-pulse rounded-full bg-black/[0.06]" />
        <div className="grid grid-cols-3 gap-2">
          <div className="h-3 animate-pulse rounded bg-black/[0.05]" />
          <div className="h-3 animate-pulse rounded bg-black/[0.05]" />
          <div className="h-3 animate-pulse rounded bg-black/[0.05]" />
        </div>
      </div>

      <div className="mt-5 space-y-2 rounded-xl border border-[var(--border)] bg-black/[0.03] p-3.5">
        <div className="h-3 w-5/6 animate-pulse rounded bg-black/[0.06]" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-black/[0.06]" />
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  );
}
