import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// These two values are safe to expose in the browser (the anon key is meant
// to be public; Row Level Security in Postgres is what actually protects data).
export const isConfigured = Boolean(url && key);
export const supabase = isConfigured ? createClient(url, key) : null;
