"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dbMessage, type ActionResult } from "@/lib/crm/session";

export type Audience = { type: "svi" | "clanovi" | "aktivni" | "probni" | "bez_klijenta" | "testni" | "klijenti"; ids?: string[] };
export type MessageInput = { naslov: string; tekst: string; link?: string | null; vrsta?: string; call_id?: string | null; audience: Audience };

function refresh() {
  revalidatePath("/crm/poruke");
}

export async function saveMessage(id: string | null, m: MessageInput): Promise<ActionResult> {
  if (!m.naslov?.trim()) return { ok: false, error: "Upišite naslov." };
  const link = m.link?.trim() || null;
  if (link && !/^(\/|https?:\/\/)/.test(link)) return { ok: false, error: "Poveznica mora početi s / ili https://." };
  const row = {
    naslov: m.naslov.trim(),
    tekst: m.tekst?.trim() ?? "",
    link,
    vrsta: m.vrsta ?? "obavijest",
    call_id: m.call_id || null,
    audience: m.audience,
  };
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("crm_messages").update(row).eq("id", id);
    if (error) return { ok: false, error: dbMessage(error) };
    refresh();
    return { ok: true, message: "Poruka je spremljena.", data: id };
  }
  const { data, error } = await supabase.from("crm_messages").insert(row).select("id").single();
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: "Nacrt poruke je spremljen.", data: data.id };
}

/** Broj i adrese primatelja (za potvrdu slanja i izvoz adresa za e-mail iz vlastite pošte). */
export async function previewRecipients(audience: Audience): Promise<{ count: number; emails: string[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crm_message_recipients", { p_audience: audience });
  if (error) return { count: 0, emails: [], error: dbMessage(error) };
  const rows = (data ?? []) as { user_id: string; email: string | null }[];
  return { count: rows.length, emails: rows.map((r) => r.email).filter((e): e is string => !!e) };
}

export async function sendMessage(id: string, test: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crm_send_message", { p_id: id, p_test: test });
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return {
    ok: true,
    message: test ? `Probno poslano testnim korisnicima: ${data as number}.` : `Poslano: ${data as number} primatelja vidi poruku u EU Radaru (Obavijesti).`,
  };
}

export async function archiveMessage(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_messages").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: "Poruka je arhivirana." };
}

/** Korisnik EU Radara označava poruku pročitanom. */
export async function markMessageRead(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("crm_mark_message_read", { p_id: id });
  revalidatePath("/obavijesti");
}
