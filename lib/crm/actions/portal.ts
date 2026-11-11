"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCrmMe, dbMessage, requestOrigin, type ActionResult } from "@/lib/crm/session";

function refresh() {
  revalidatePath("/crm", "layout");
}

export async function setMembership(userId: string, jlsId: string, role: "tenant_admin" | "member" | "viewer" | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("crm_portal_set_membership", { p_user: userId, p_jls: jlsId, p_role: role });
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  revalidatePath("/klijenti");
  return { ok: true, message: role ? "Pristup klijentu je dodijeljen." : "Pristup klijentu je uklonjen." };
}

export async function setPortalMeta(userId: string, oznaka: string, napomena: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("crm_portal_set_meta", { p_user: userId, p_oznaka: oznaka, p_napomena: napomena });
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: "Spremljeno." };
}

export async function blockPortalUser(userId: string, block: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("crm_portal_block", { p_user: userId, p_block: block });
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: block ? "Korisnik je blokiran i odjavljen." : "Blokada je uklonjena." };
}

/** Pozivnica korisniku klijenta: vraća poveznicu koju član tima sam pošalje (CRM ne šalje e-mail). */
export async function invitePortalUser(email: string, jlsId: string, role: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crm_portal_invite", { p_email: email, p_jls: jlsId, p_role: role });
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return {
    ok: true,
    message: `Pozivnica za ${email} je spremna (vrijedi 14 dana). Kopiraj poveznicu i pošalji je osobno.`,
    data: `${await requestOrigin()}/pristup?token=${data as string}`,
  };
}

export async function revokePortalInvite(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("crm_portal_revoke_invite", { p_id: id });
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: "Pozivnica je opozvana." };
}

export async function setRegistrationMode(mode: "otvorena" | "pozivnica"): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me?.isAdmin) return { ok: false, error: "Registraciju uređuju administratori." };
  const supabase = await createClient();
  const { error } = await supabase.from("crm_settings").update({ value: { mode } }).eq("key", "registration");
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return {
    ok: true,
    message: mode === "pozivnica" ? "Registracija je sada moguća samo uz pozivnicu." : "Registracija je otvorena svima.",
  };
}

export type PaymentInput = { jls: string; iznos: string | number; datum: string; nacin: string; service: string | null; mjeseci: number; napomena: string };

export async function recordPayment(p: PaymentInput): Promise<ActionResult> {
  const iznos = Number(String(p.iznos).replace(",", "."));
  const supabase = await createClient();
  const { error } = await supabase.rpc("crm_record_payment", {
    p_jls: p.jls,
    p_iznos: iznos,
    p_datum: p.datum,
    p_nacin: p.nacin,
    p_service: p.service || null,
    p_mjeseci: p.mjeseci,
    p_napomena: p.napomena,
  });
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: "Uplata je evidentirana: pretplata, prodaja i zadatak „Izdaj račun“." };
}

export async function cancelSubscription(id: string, pauziraj: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("crm_cancel_subscription", { p_id: id, p_pauziraj: pauziraj });
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: pauziraj ? "Pretplata je otkazana, pristup je pauziran." : "Pretplata je otkazana." };
}
