import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "https://mdpvjnervypcmdlzcvob.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kcHZqbmVydnlwY21kbHpjdm9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MzE5NzcsImV4cCI6MjA4NzQwNzk3N30.kpZYLUuEIx6wQu8ChSpyI9lTP5cWhTix_O1pCAT_aBA";

export const isSupabaseConfigured = true;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
