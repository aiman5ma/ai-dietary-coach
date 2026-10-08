import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { saveProfile, getProfile } from "../lib/db.js";
import { migrateLocalData, setStorageUser } from "../lib/storage.js";
import { supabase } from "../lib/supabase.js";

const GUEST_KEY = "dietary_guest";

function readGuest() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(GUEST_KEY) === "true";
}

async function ensureProfile(userId, fullName) {
  const existing = await getProfile(userId);
  if (existing) return;
  await saveProfile({ id: userId, full_name: fullName });
}

const AuthContext = createContext(null);

/**
 * Supabase session plus the existing one-tap guest flag.
 * A signed-in user wins over a guest. Guest mode never calls Supabase.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(readGuest);
  const [loading, setLoading] = useState(() => Boolean(supabase));

  useEffect(() => {
    if (!supabase) return undefined;

    let active = true;
    let generation = 0;

    async function applySession(nextSession) {
      const token = ++generation;
      const nextUser = nextSession?.user ?? null;
      setStorageUser(nextUser);
      if (nextUser) {
        try {
          const result = await migrateLocalData(nextUser);
          if (result.migrated) sessionStorage.setItem("dietary_migration_toast", "1");
        } catch {
          /* keep local copies when the upload fails */
        }
        const fullName = nextUser.user_metadata?.full_name;
        if (typeof fullName === "string" && fullName.trim()) {
          ensureProfile(nextUser.id, fullName.trim()).catch(() => {});
        }
      }
      if (!active || token !== generation) return;
      setSession(nextSession);
      setUser(nextUser);
      if (nextUser) {
        window.localStorage.removeItem(GUEST_KEY);
        setIsGuest(false);
      }
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session ?? null).catch(() => {
        if (active) setLoading(false);
      });
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      queueMicrotask(() => {
        applySession(nextSession).catch(() => {
          if (active) setLoading(false);
        });
      });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const continueAsGuest = useCallback(() => {
    window.localStorage.setItem(GUEST_KEY, "true");
    setIsGuest(true);
  }, []);

  const signOut = useCallback(async () => {
    window.localStorage.removeItem(GUEST_KEY);
    setStorageUser(null);
    setIsGuest(false);
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      isGuest,
      signOut,
      loading,
      continueAsGuest,
    }),
    [user, session, isGuest, signOut, loading, continueAsGuest],
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
