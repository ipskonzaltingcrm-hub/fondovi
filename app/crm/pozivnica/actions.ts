"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dbMessage } from "@/lib/crm/session";

export type AcceptState = { error?: string };

/** Prihvaća pozivnicu u tim (provjera e-maila, roka i statusa je u bazi: crm_accept_invitation). */
export async function acceptInvitation(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { error: "Poveznica pozivnice nije potpuna." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("crm_accept_invitation", { p_token: token });
  if (error) return { error: dbMessage(error) };
  redirect("/crm");
}
