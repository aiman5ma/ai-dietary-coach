import { createContext, useContext } from "react";

// Persistent storage keys. Both lists are kept under stable, descriptive
// names so multiple apps in the same origin never collide.
export const FOOD_LOG_KEY = "dietary_food_log";
export const BMI_HISTORY_KEY = "dietary_bmi_history";

export const HistoryContext = createContext(null);

/**
 * Read-write access to the shared history state. Throws a clear error
 * when called outside of a `<HistoryProvider />`.
 */
export function useHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) {
    throw new Error("useHistory must be used inside a <HistoryProvider />.");
  }
  return ctx;
}
