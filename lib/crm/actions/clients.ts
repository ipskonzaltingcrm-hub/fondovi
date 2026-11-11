"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dbMessage, type ActionResult } from "@/lib/crm/session";

export type ClientInput = {
  naziv: string;
  klijent_tip: "jls" | "poduzece" | "institucija";
  tip?: string | null;
  zupanija?: string | null;
  stanovnika?: string | number | null;
  ruralno?: boolean;
  velicina?: string | null;
  sektori?: string[];
  kontakt_osoba?: string | null;
  status: "aktivan" | "trial" | "pauziran";
  owner?: string | null;
  oib?: string | null;
  email?: string | null;
  telefon?: string | null;
  adresa?: string | null;
  web?: string | null;
  napomena?: string | null;
};

/** Novi klijent (id = null) ili izmjena; RPC provjerava ulogu i sinkronizira EU Radar (tenant + profil). */
export async function saveClient(id: string | null, input: ClientInput): Promise<ActionResult> {
  if (!input.naziv?.trim()) return { ok: false, error: "Naziv klijenta je obavezan." };
  const supabase = await createClient();
  const payload = {
    ...input,
    stanovnika: input.stanovnika ? String(input.stanovnika) : "",
    ruralno: !!input.ruralno,
    owner: input.owner || "",
  };
  const { data, error } = await supabase.rpc("crm_save_client", { p_id: id, p: payload });
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/crm", "layout");
  revalidatePath("/klijenti");
  return { ok: true, message: id ? "Klijent je spremljen." : "Klijent je otvoren u CRM-u i u EU Radaru.", data: data as string };
}

export type ContactInput = { ime: string; uloga?: string | null; email?: string | null; telefon?: string | null; primarni?: boolean };

export async function saveContact(clientId: string, contactId: string | null, input: ContactInput): Promise<ActionResult> {
  const ime = input.ime?.trim();
  if (!ime) return { ok: false, error: "Upišite ime kontakta." };
  const row = {
    ime,
    uloga: input.uloga?.trim() || null,
    email: input.email?.trim() || null,
    telefon: input.telefon?.trim() || null,
    primarni: !!input.primarni,
  };
  const supabase = await createClient();
  const { error } = contactId
    ? await supabase.from("crm_contacts").update(row).eq("id", contactId)
    : await supabase.from("crm_contacts").insert({ ...row, jls_profile_id: clientId });
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath(`/crm/klijenti/${clientId}`);
  return { ok: true, message: "Kontakt je spremljen." };
}

export async function setPrimaryContact(clientId: string, contactId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_contacts").update({ primarni: true }).eq("id", contactId);
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath(`/crm/klijenti/${clientId}`);
  return { ok: true };
}

export async function removeContact(clientId: string, contactId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_contacts").delete().eq("id", contactId);
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath(`/crm/klijenti/${clientId}`);
  return { ok: true, message: "Kontakt je uklonjen." };
}
