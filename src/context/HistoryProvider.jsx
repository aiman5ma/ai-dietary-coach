import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "./AuthContext.jsx";
import { HistoryContext } from "./historyContext.js";
import {
  clearBmiHistory,
  clearFoods,
  getBMIHistory,
  getFoods,
  subscribeBmi,
  subscribeFoods,
} from "../lib/storage.js";

function readLocal(key) {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Shared food and BMI history. Guests stay on localStorage.
 * Signed-in users load the same lists from Supabase through storage.js.
 */
export default function HistoryProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [foodLog, setFoodLog] = useState(() => (user ? [] : readLocal("dietary_food_log")));
  const [bmiHistory, setBmiHistory] = useState(() => (user ? [] : readLocal("dietary_bmi_history")));
  const [historyLoading, setHistoryLoading] = useState(() => Boolean(user));
  const [historyError, setHistoryError] = useState("");
  const [isHistoryOpen, setHistoryOpen] = useState(false);

  const reload = useCallback(async () => {
    const [foods, bmi] = await Promise.all([getFoods(), getBMIHistory()]);
    setFoodLog(Array.isArray(foods) ? foods : []);
    setBmiHistory(Array.isArray(bmi) ? bmi : []);
  }, []);

  useEffect(() => {
    if (authLoading) return undefined;
    let active = true;

    async function load() {
      await Promise.resolve();
      if (!active) return;
      setHistoryLoading(true);
      setHistoryError("");
      try {
        await reload();
      } catch {
        if (active) setHistoryError("storage.loadFailed");
      } finally {
        if (active) setHistoryLoading(false);
      }
    }

    void load();
    const stopFoods = subscribeFoods(() => {
      getFoods().then((foods) => {
        if (active) setFoodLog(Array.isArray(foods) ? foods : []);
      }).catch(() => {});
    });
    const stopBmi = subscribeBmi(() => {
      getBMIHistory().then((bmi) => {
        if (active) setBmiHistory(Array.isArray(bmi) ? bmi : []);
      }).catch(() => {});
    });
    return () => {
      active = false;
      stopFoods();
      stopBmi();
    };
  }, [authLoading, user, reload]);

  const openHistory = useCallback(() => setHistoryOpen(true), []);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);

  const clearFood = useCallback(async () => {
    const next = await clearFoods();
    setFoodLog(next);
  }, []);
  const clearBmi = useCallback(async () => {
    const next = await clearBmiHistory();
    setBmiHistory(next);
  }, []);

  const value = useMemo(
    () => ({
      foodLog,
      bmiHistory,
      historyLoading,
      historyError,
      reloadHistory: reload,
      clearFood,
      clearBmi,
      isHistoryOpen,
      openHistory,
      closeHistory,
    }),
    [
      foodLog,
      bmiHistory,
      historyLoading,
      historyError,
      reload,
      clearFood,
      clearBmi,
      isHistoryOpen,
      openHistory,
      closeHistory,
    ],
  );

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}
