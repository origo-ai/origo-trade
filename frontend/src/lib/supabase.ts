import { createClient } from "@supabase/supabase-js";

const readConfiguredEnv = (value?: string) => {
  const normalized = value?.trim();
  if (!normalized) return null;
  if (normalized.includes("your-project-id.supabase.co")) return null;
  if (normalized.includes("your_supabase_")) return null;
  return normalized;
};

const supabaseUrl = readConfiguredEnv(import.meta.env.VITE_SUPABASE_URL);
const supabaseKey =
  readConfiguredEnv(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ??
  readConfiguredEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
