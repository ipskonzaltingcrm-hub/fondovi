import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role klijent za ingestion. Zaobilazi RLS — koristi se ISKLJUČIVO u
 * serverskom/CI kontekstu (nikad u pregledniku). Ključ dolazi iz env varijabli.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Nedostaje NEXT_PUBLIC_SUPABASE_URL (ili SUPABASE_URL).");
  if (!key) throw new Error("Nedostaje SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
