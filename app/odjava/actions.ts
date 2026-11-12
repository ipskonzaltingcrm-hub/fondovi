"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function unsubscribe(token: string, all: boolean): Promise<{ done: boolean; error?: string; email?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { done: false, error: "Poveznica nije ispravna." };
  const { data, error } = await createAdminClient().rpc("crm_email_unsubscribe", { p_token: token, p_all: all });
  if (error) return { done: false, error: "Odjava trenutno nije uspjela. Pokušajte ponovno." };
  if (data === null) return { done: false, error: "Poveznica nije ispravna ili je istekla." };
  return { done: true, email: (data as string) || undefined };
}
