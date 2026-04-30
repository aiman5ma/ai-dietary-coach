import { useCallback, useMemo, useState } from "react";

import useLocalStorage from "../hooks/useLocalStorage.js";
import {
  BMI_HISTORY_KEY,
  FOOD_LOG_KEY,
  HistoryContext,
} from "./historyContext.js";

/**
 * Provider that owns the food-log + BMI-history lists (persisted to
 * localStorage) and the open/close state of the global HistoryPanel.
 *
 * Place once near the root of the tree (App.jsx). Pages and the Layout
 * read from it via the `useHistory()` hook.
 */
export default function HistoryProvider({ children }) {
  const [foodLog, setFoodLog] = useLocalStorage(FOOD_LOG_KEY, []);
  const [bmiHistory, setBmiHistory] = useLocalStorage(BMI_HISTORY_KEY, []);
  const [isHistoryOpen, setHistoryOpen] = useState(false);

  const openHistory = useCallback(() => setHistoryOpen(true), []);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);

  const addFoodEntry = useCallback(
    (entry) =>
      setFoodLog((prev) => [entry, ...(Array.isArray(prev) ? prev : [])]),
    [setFoodLog],
  );
  const addBmiEntry = useCallback(
    (entry) =>
      setBmiHistory((prev) => [entry, ...(Array.isArray(prev) ? prev : [])]),
    [setBmiHistory],
  );
  const clearFood = useCallback(() => setFoodLog([]), [setFoodLog]);
  const clearBmi = useCallback(() => setBmiHistory([]), [setBmiHistory]);

  const value = useMemo(
    () => ({
      foodLog,
      bmiHistory,
      addFoodEntry,
      addBmiEntry,
      clearFood,
      clearBmi,
      isHistoryOpen,
      openHistory,
      closeHistory,
    }),
    [
      foodLog,
      bmiHistory,
      addFoodEntry,
      addBmiEntry,
      clearFood,
      clearBmi,
      isHistoryOpen,
      openHistory,
      closeHistory,
    ],
  );

  return (
    <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
  );
}
