"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Otvaranje javne poveznice ponude (ne broji se kad je otvori član tima). */
export async function markOfferViewed(token: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: p } = await supabase.from("profiles").select("staff_role").eq("id", user.id).maybeSingle();
    if (p?.staff_role) return;
  }
  await createAdminClient().rpc("crm_offer_viewed", { p_token: token });
}
