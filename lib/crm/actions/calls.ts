"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCrmMe, dbMessage, type ActionResult } from "@/lib/crm/session";
import { RELEVANCE, type Relevance } from "@/lib/crm/options";

export type CallMetaPatch = { relevance?: Relevance | null; prioritet?: boolean; archived?: boolean; napomena?: string | null };

/** Timska procjena natječaja (konzultant i više; provjera i u bazi). */
export async function setCallMeta(callId: string, patch: CallMetaPatch): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me) return { ok: false, error: "Nemate pristup CRM-u." };
  if (me.role === "suradnik") return { ok: false, error: "Procjenu natječaja mijenjaju konzultanti i administratori." };
  if (patch.relevance && !(patch.relevance in RELEVANCE)) return { ok: false, error: "Nepoznata procjena." };
  const supabase = await createClient();
  const { data: cur } = await supabase.from("crm_call_meta").select("*").eq("call_id", callId).maybeSingle();
  const row = {
    call_id: callId,
    relevance: patch.relevance !== undefined ? patch.relevance : cur?.relevance ?? null,
    prioritet: patch.prioritet !== undefined ? patch.prioritet : cur?.prioritet ?? false,
    archived_at: patch.archived !== undefined ? (patch.archived ? new Date().toISOString() : null) : cur?.archived_at ?? null,
    napomena: patch.napomena !== undefined ? patch.napomena?.trim() || null : cur?.napomena ?? null,
  };
  const { error } = await supabase.from("crm_call_meta").upsert(row);
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/crm", "layout");
  return { ok: true, message: "Procjena je spremljena." };
}

export async function markCallsRead(ids: string[]): Promise<ActionResult> {
  if (!ids.length) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.rpc("crm_mark_calls_read", { p_ids: ids });
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/crm/natjecaji");
  return { ok: true };
}

export async function markCallUnread(id: string): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me) return { ok: false, error: "Nemate pristup CRM-u." };
  const supabase = await createClient();
  const { error } = await supabase.from("crm_call_reads").delete().eq("call_id", id).eq("user_id", me.id);
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/crm/natjecaji");
  return { ok: true };
}

export type CallTaskTarget = { kind: "klijent" | "lead"; id: string; naziv: string; owner: string | null };

/** "Napravi N zadataka Nazovi": po jedan zadatak za svakog odabranog klijenta / lead; vlasnik zadatka = vlasnik zapisa. */
export async function createCallTasks(
  callId: string,
  callTitle: string,
  targets: CallTaskTarget[],
  rok: string | null,
): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me) return { ok: false, error: "Nemate pristup CRM-u." };
  if (!targets.length) return { ok: false, error: "Odaberite barem jednog klijenta ili lead." };
  const short = callTitle.length > 70 ? callTitle.slice(0, 70) + "…" : callTitle;
  const rows = targets.map((t) => ({
    naslov: `Nazovi: ${t.naziv} — ${short}`,
    vrsta: "poziv",
    prioritet: "srednji",
    rok,
    owner: t.owner ?? me.id,
    call_id: callId,
    lead_id: t.kind === "lead" ? t.id : null,
    jls_profile_id: t.kind === "klijent" ? t.id : null,
  }));
  const supabase = await createClient();
  const { error } = await supabase.from("crm_tasks").insert(rows);
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/crm", "layout");
  return { ok: true, message: `Napravljeno zadataka: ${rows.length}.` };
}

// ------------------------------------------------------------------ Rekla-kazala

export type HearsayInput = {
  program: string;
  izjava: string;
  izvor?: string | null;
  datum?: string | null;
  poveznica?: string | null;
  call_id?: string | null;
};

export async function saveHearsay(id: string | null, input: HearsayInput): Promise<ActionResult> {
  if (!input.program?.trim() || !input.izjava?.trim()) return { ok: false, error: "Upišite program i izjavu." };
  const row = {
    program: input.program.trim(),
    izjava: input.izjava.trim(),
    izvor: input.izvor?.trim() || null,
    datum: input.datum || null,
    poveznica: input.poveznica?.trim() || null,
    call_id: input.call_id || null,
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("crm_hearsay").update(row).eq("id", id)
    : await supabase.from("crm_hearsay").insert(row);
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/crm/eu-filter");
  return { ok: true, message: "Spremljeno." };
}

export async function setHearsayStatus(id: string, status: "otvoreno" | "pregledano"): Promise<ActionResult> {
  const supabase = await createClient();
  const { error, count } = await supabase.from("crm_hearsay").update({ status }, { count: "exact" }).eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  if (!count) return { ok: false, error: "Rekla-kazala uređuju konzultanti i administratori." };
  revalidatePath("/crm/eu-filter");
  return { ok: true };
}
