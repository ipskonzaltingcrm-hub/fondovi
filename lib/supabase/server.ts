import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Supabase klijent za server (RSC / route handlers), vezan na kolačiće sesije. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll pozvan iz RSC-a — zanemarivo ako postoji middleware za refresh.
          }
        },
      },
    },
  );
}
