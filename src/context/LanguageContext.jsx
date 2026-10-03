import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

import { translations } from "../i18n/translations.js";

const STORAGE_KEY = "dietary_language";

const LanguageContext = createContext(null);

function readStoredLanguage() {
  if (typeof window === "undefined") return "ar";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "ar" || stored === "en") return stored;
  } catch {
    /* private mode or blocked storage — fall through to the default */
  }
  return "ar";
}

function lookup(lang, key) {
  const value = String(key)
    .split(".")
    .reduce((node, part) => {
      if (
        node &&
        typeof node === "object" &&
        Object.prototype.hasOwnProperty.call(node, part)
      ) {
        return node[part];
      }
      return undefined;
    }, translations[lang]);
  return typeof value === "string" ? value : undefined;
}

function translate(lang, key, vars) {
  const value = lookup(lang, key) ?? lookup("en", key) ?? key;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

function applyDocumentLanguage(lang) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === "ar" ? "rtl" : "ltr";
  document.title =
    lookup(lang, "app.name") ??
    (lang === "ar" ? "المدرب الغذائي الذكي" : "AI Dietary Coach");
}

/**
 * Owns the active language and keeps `<html lang dir>` plus
 * localStorage["dietary_language"] in sync. Arabic is the default.
 */
export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readStoredLanguage);

  const setLang = useCallback((next) => {
    if (next !== "ar" && next !== "en") return;
    setLangState(next);
  }, []);

  const t = useCallback(
    (key, vars) => translate(lang, key, vars),
    [lang],
  );

  const isRTL = lang === "ar";

  useLayoutEffect(() => {
    applyDocumentLanguage(lang);
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore unavailable storage */
    }
  }, [lang]);

  const value = useMemo(
    () => ({ lang, setLang, t, isRTL }),
    [lang, setLang, t, isRTL],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

/**
 * { lang, setLang, t, isRTL }
 * `t(key)` returns the string for the active language.
 * `isRTL` is true when lang === "ar".
 */
// Hook is exported beside its provider so the app has one language import.
// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used inside a <LanguageProvider />.");
  }
  return ctx;
}
