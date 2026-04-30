import { useEffect, useRef, useState } from "react";

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Animate a number from 0 to `target` over `duration` ms using
 * requestAnimationFrame and an ease-out-cubic curve. The hook restarts
 * cleanly whenever `target` changes, and respects user motion preferences
 * (skips straight to the target when reduced-motion is on).
 *
 * Returns the current intermediate value (NOT yet rounded — caller can
 * format it however they like).
 */
export default function useCountUp(target, duration = 800) {
  const finalValue = Number.isFinite(Number(target)) ? Number(target) : 0;

  const [value, setValue] = useState(() =>
    prefersReducedMotion() ? finalValue : 0,
  );

  const startRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const effectiveDuration =
      prefersReducedMotion() || duration <= 0 ? 0 : duration;

    startRef.current = null;
    cancelAnimationFrame(rafRef.current);

    function step(ts) {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t =
        effectiveDuration > 0 ? Math.min(1, elapsed / effectiveDuration) : 1;
      setValue(finalValue * easeOutCubic(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    }

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [finalValue, duration]);

  return value;
}

export { useCountUp };
