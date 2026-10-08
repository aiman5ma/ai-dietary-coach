import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "./AuthContext.jsx";
import { getProfile as readProfile, saveProfile as persistProfile } from "../lib/storage.js";
import { ACTIVITY_LEVELS } from "../utils/bmi.js";

const OTHER_PREFIX = "other:";

const CONDITION_IDS = Object.freeze([
  "diabetes",
  "hypertension",
  "cholesterol",
  "celiac",
  "lactose",
  "nuts",
  "seafood",
  "vegetarian",
  "vegan",
]);

const ACTIVITY_IDS = new Set(ACTIVITY_LEVELS.map((level) => level.id));
const GOAL_IDS = new Set(["loss", "maintain", "gain"]);

function emptyProfile() {
  return {
    fullName: "",
    age: null,
    sex: "",
    heightCm: null,
    weightKg: null,
    activityLevel: "",
    goal: "",
    conditions: [],
    otherConditions: "",
  };
}

function asText(value) {
  return typeof value === "string" ? value : "";
}

function asNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function allergiesToFields(allergies) {
  const conditions = [];
  let otherConditions = "";
  if (!Array.isArray(allergies)) return { conditions, otherConditions };
  for (const item of allergies) {
    if (typeof item !== "string") continue;
    if (item.startsWith(OTHER_PREFIX)) {
      otherConditions = item.slice(OTHER_PREFIX.length);
    } else if (CONDITION_IDS.includes(item) && !conditions.includes(item)) {
      conditions.push(item);
    }
  }
  return { conditions, otherConditions };
}

function normalizeProfile(raw, user) {
  const source = raw && typeof raw === "object" ? raw : {};
  const fromAllergies = allergiesToFields(source.allergies);
  const listed = Array.isArray(source.conditions) ? source.conditions : fromAllergies.conditions;
  const conditions = listed.filter(
    (id, index) => CONDITION_IDS.includes(id) && listed.indexOf(id) === index,
  );
  const metaName = user?.user_metadata?.full_name;
  const sex = source.sex === "male" || source.sex === "female" ? source.sex : "";
  const activityLevel = ACTIVITY_IDS.has(source.activityLevel)
    ? source.activityLevel
    : ACTIVITY_IDS.has(source.activity_level)
      ? source.activity_level
      : "";
  const goal = GOAL_IDS.has(source.goal) ? source.goal : "";
  return {
    fullName: asText(source.fullName || source.full_name || (typeof metaName === "string" ? metaName : "")).trim(),
    age: asNumber(source.age),
    sex,
    heightCm: asNumber(source.heightCm ?? source.height_cm),
    weightKg: asNumber(source.weightKg ?? source.weight_kg),
    activityLevel,
    goal,
    conditions,
    otherConditions: asText(source.otherConditions || fromAllergies.otherConditions).trim(),
  };
}

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const { user, isGuest, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return undefined;
    let active = true;

    async function load() {
      await Promise.resolve();
      let next = emptyProfile();
      if (user || isGuest) {
        try {
          next = normalizeProfile(await readProfile(), user);
        } catch {
          next = normalizeProfile(null, user);
        }
      }
      if (!active) return;
      setProfile(next);
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [authLoading, user, isGuest]);

  const saveProfile = useCallback(
    async (next) => {
      const normalized = normalizeProfile(next, user);
      const saved = normalizeProfile(await persistProfile(normalized), user);
      setProfile(saved);
      return saved;
    },
    [user],
  );

  const replaceProfile = useCallback((next) => {
    setProfile(normalizeProfile(next, user));
  }, [user]);

  const value = useMemo(
    () => ({ profile, loading, saveProfile, replaceProfile }),
    [profile, loading, saveProfile, replaceProfile],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

// Hook is exported beside its provider so every page can read the same profile.
// eslint-disable-next-line react-refresh/only-export-components
export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used inside a <ProfileProvider />.");
  }
  return ctx;
}
