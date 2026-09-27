import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export function isSupabaseConfigured(): boolean {
  if (!url || !anonKey) return false;
  if (url.includes("YOUR_PROJECT_REF")) return false;
  if (anonKey.includes("YOUR_SUPABASE_ANON_KEY")) return false;
  if (anonKey.includes("PASTE_ANON")) return false;
  if (url === "http://localhost" || url === "http://localhost/") return false;
  return true;
}

function createSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    console.error(
      [
        "Supabase is not configured.",
        "Copy frontend/.env.example → frontend/.env and set:",
        "  VITE_SUPABASE_URL=https://<project-ref>.supabase.co",
        "  VITE_SUPABASE_ANON_KEY=<anon public key>",
        "From Supabase Dashboard → Project Settings → API.",
        "Then restart `npm run dev`.",
      ].join("\n"),
    );
  }

  return createClient(url || "http://127.0.0.1:54321", anonKey || "missing-anon-key");
}

export const supabase = createSupabase();
