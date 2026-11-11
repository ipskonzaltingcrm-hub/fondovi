"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCrmMe, dbMessage, type ActionResult } from "@/lib/crm/session";

/** Odjavljuje sve moje ostale prijave (ovaj preglednik ostaje prijavljen). */
export async function signOutOthers(): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me) return { ok: false, error: "Nemate pristup CRM-u." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/crm/sigurnost");
  return { ok: true, message: "Ostali uređaji su odjavljeni." };
}

/** Administrator odjavljuje člana sa svih uređaja (provjere u bazi: crm_sign_out_member). */
export async function signOutMember(id: string): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me?.isAdmin) return { ok: false, error: "Članove odjavljuje samo administrator." };
  if (id === me.id) return { ok: false, error: "Za sebe koristite „Odjavi ostale uređaje“." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("crm_sign_out_member", { p_id: id });
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/crm/sigurnost");
  return { ok: true, message: "Član je odjavljen sa svih uređaja." };
}
