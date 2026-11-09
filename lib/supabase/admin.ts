import { createClient } from "@supabase/supabase-js";

/**
 * Service-role klijent za serverske akcije (npr. superadmin dodaje klijenta).
 * Zaobilazi RLS — koristi se ISKLJUČIVO na serveru, iza provjere superadmina.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Nedostaje NEXT_PUBLIC_SUPABASE_URL.");
  if (!key) throw new Error("Nedostaje SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
