import { createContext, useCallback, useContext, useMemo, useState } from "react";

const USER_KEY = "dietary_user";
const GUEST_KEY = "dietary_guest";

function readSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.email === "string" && parsed.email.trim()) {
        return { kind: "user", email: parsed.email.trim() };
      }
    }
    if (window.localStorage.getItem(GUEST_KEY) === "true") {
      return { kind: "guest" };
    }
  } catch {
    /* malformed storage — treat as signed out */
  }
  return null;
}

const AuthContext = createContext(null);

/**
 * Mock session for the landing page. A signed-in user is stored as JSON
 * under `dietary_user` (email only — the password is never saved).
 * A guest is a `dietary_guest=true` flag. Either one unlocks the app.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession);

  const login = useCallback((email) => {
    const next = { email: String(email).trim(), loggedInAt: Date.now() };
    window.localStorage.setItem(USER_KEY, JSON.stringify(next));
    window.localStorage.removeItem(GUEST_KEY);
    setSession({ kind: "user", email: next.email });
  }, []);

  const continueAsGuest = useCallback(() => {
    window.localStorage.setItem(GUEST_KEY, "true");
    window.localStorage.removeItem(USER_KEY);
    setSession({ kind: "guest" });
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(USER_KEY);
    window.localStorage.removeItem(GUEST_KEY);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      isAuthed: session !== null,
      login,
      continueAsGuest,
      logout,
    }),
    [session, login, continueAsGuest, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook is exported beside its provider so login and logout share one import.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an <AuthProvider />.");
  }
  return ctx;
}
