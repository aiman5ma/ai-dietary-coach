import { useCallback, useEffect, useState } from "react";

// Read a JSON-encoded value from localStorage, or fall back to `fallback`
// if the key is missing, the value is malformed, or storage is unavailable.
function readFromStorage(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(
      `useLocalStorage: failed to parse "${key}" from localStorage. Using initial value.`,
      err,
    );
    return fallback;
  }
}

/**
 * useLocalStorage(key, initialValue)
 *
 * Drop-in replacement for `useState` that persists the value to
 * `window.localStorage` under `key`. JSON-encodes on write, JSON-decodes
 * on read, and gracefully recovers from parse errors or unavailable
 * storage (e.g. private mode, server-side render).
 *
 * The setter accepts a value or an updater function, just like useState.
 * Cross-tab updates to the same key sync into the hook automatically.
 */
export default function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => readFromStorage(key, initialValue));

  // Persist on every change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn(
        `useLocalStorage: failed to write "${key}" to localStorage.`,
        err,
      );
    }
  }, [key, value]);

  // Sync changes from other tabs/windows.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onStorage(event) {
      if (event.key !== key) return;
      if (event.storageArea && event.storageArea !== window.localStorage) return;
      if (event.newValue === null) return;
      try {
        setValue(JSON.parse(event.newValue));
      } catch {
        /* ignore malformed cross-tab values */
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const setStoredValue = useCallback((next) => {
    setValue((prev) => (typeof next === "function" ? next(prev) : next));
  }, []);

  return [value, setStoredValue];
}

export { useLocalStorage };
