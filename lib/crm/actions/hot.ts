"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCrmMe, dbMessage, type ActionResult } from "@/lib/crm/session";

export type HotGroupInput = { naziv: string; sifra?: string | null; podnaslov?: string | null; call_id?: string | null };

function refresh() {
  revalidatePath("/crm", "layout");
}

export async function createHotGroup(input: HotGroupInput): Promise<ActionResult> {
  const naziv = input.naziv?.trim();
  if (!naziv) return { ok: false, error: "Upišite šifru ili naziv natječaja." };
  const supabase = await createClient();
  const { data: last } = await supabase.from("crm_hot_groups").select("position").order("position", { ascending: false }).limit(1);
  const { data, error } = await supabase
    .from("crm_hot_groups")
    .insert({
      naziv,
      sifra: input.sifra?.trim() || null,
      podnaslov: input.podnaslov?.trim() || null,
      call_id: input.call_id || null,
      position: (last?.[0]?.position ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: "Natječaj je dodan.", data: data.id };
}

export async function updateHotGroup(id: string, input: HotGroupInput): Promise<ActionResult> {
  const naziv = input.naziv?.trim();
  if (!naziv) return { ok: false, error: "Upišite šifru ili naziv natječaja." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_hot_groups")
    .update({ naziv, sifra: input.sifra?.trim() || null, podnaslov: input.podnaslov?.trim() || null, call_id: input.call_id || null })
    .eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: "Kartica je spremljena." };
}

export async function deleteHotGroup(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error, count } = await supabase.from("crm_hot_groups").delete({ count: "exact" }).eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  if (!count) return { ok: false, error: "Natječaje brišu konzultanti i administratori." };
  refresh();
  return { ok: true, message: "Natječaj je obrisan; njegovi leadovi su u „Bez natječaja“." };
}

/** Hot pregled (samo superadmin): rok prijave i kratka oznaka uz rok. */
export async function saveHotDeadline(id: string, deadline: string | null, note: string): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me?.isSuperadmin) return { ok: false, error: "Hot pregled uređuje samo superadmin." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_hot_groups")
    .update({ deadline_on: deadline || null, deadline_note: note.trim().slice(0, 40) || null })
    .eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true };
}

/** Izbornik: brojka "novo od zadnjeg posjeta" se poništava kad član otvori karticu. */
export async function markSeen(key: "leadovi" | "hot"): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("crm_mark_seen", { p_key: key });
}
