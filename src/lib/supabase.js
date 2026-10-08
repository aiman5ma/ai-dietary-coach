import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  typeof supabaseUrl === "string" &&
  supabaseUrl.trim() !== "" &&
  typeof supabaseAnonKey === "string" &&
  supabaseAnonKey.trim() !== ""
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
