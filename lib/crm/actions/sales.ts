"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCrmMe, dbMessage, type ActionResult } from "@/lib/crm/session";

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const int = (v: unknown) => {
  const n = num(v);
  return n == null ? null : Math.max(0, Math.round(n));
};

export type SaleInput = {
  member?: string | null;
  service_id?: string | null;
  usluga: string;
  jls_profile_id?: string | null;
  iznos: string | number;
  datum: string;
  vrsta: "nova" | "stara";
  napomena?: string | null;
};

/** Brzi unos prodaje izvan ponude. */
export async function addSale(s: SaleInput): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me) return { ok: false, error: "Nemate pristup CRM-u." };
  if (me.role === "suradnik") return { ok: false, error: "Prodaju upisuju konzultanti i administratori." };
  const iznos = num(s.iznos);
  if (!s.usluga?.trim()) return { ok: false, error: "Upišite uslugu." };
  if (iznos == null || iznos < 0) return { ok: false, error: "Upišite iznos bez PDV-a." };
  const supabase = await createClient();
  const { error } = await supabase.from("crm_sales").insert({
    member: me.isAdmin ? s.member || me.id : me.id,
    service_id: s.service_id || null,
    usluga: s.usluga.trim(),
    jls_profile_id: s.jls_profile_id || null,
    iznos,
    datum: s.datum,
    vrsta: s.vrsta,
    napomena: s.napomena?.trim() || null,
  });
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/crm", "layout");
  return { ok: true, message: "Prodaja je upisana." };
}

export async function deleteSale(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error, count } = await supabase.from("crm_sales").delete({ count: "exact" }).eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  if (!count) return { ok: false, error: "Prodaju briše autor ili administrator." };
  revalidatePath("/crm", "layout");
  return { ok: true, message: "Stavka prodaje je obrisana." };
}

export type WeekEntryInput = {
  week_start: string;
  member?: string | null;
  preuzeti?: string | number | null;
  doneseni?: string | number | null;
  pozivi?: string | number | null;
  ponude_poslane?: string | number | null;
  ponude_ugovorene?: string | number | null;
  stara_provedba?: string | number | null;
  napomena?: string | null;
};

/** Tjedni unos (ponedjeljkom): brojke za sastanak koje za taj tjedan zamjenjuju brojače iz CRM-a. */
export async function saveWeekEntry(w: WeekEntryInput): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me) return { ok: false, error: "Nemate pristup CRM-u." };
  const supabase = await createClient();
  const { error } = await supabase.from("crm_week_entries").upsert({
    week_start: w.week_start,
    member: me.isAdmin ? w.member || me.id : me.id,
    preuzeti: int(w.preuzeti),
    doneseni: int(w.doneseni),
    pozivi: int(w.pozivi),
    ponude_poslane: int(w.ponude_poslane),
    ponude_ugovorene: int(w.ponude_ugovorene),
    stara_provedba: num(w.stara_provedba),
    napomena: w.napomena?.trim() || null,
  });
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/crm", "layout");
  return { ok: true, message: "Tjedni unos je spremljen." };
}

export async function deleteWeekEntry(week_start: string, member: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_week_entries").delete().eq("week_start", week_start).eq("member", member);
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/crm", "layout");
  return { ok: true, message: "Tjedni unos je uklonjen — vrijede brojke iz CRM-a." };
}

/** Mjesečni cilj (tim: member = null). Samo administratori. */
export async function saveTarget(mjesec: string, member: string | null, iznos: string | number | null): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me?.isAdmin) return { ok: false, error: "Ciljeve postavljaju administratori." };
  const supabase = await createClient();
  const n = num(iznos);
  if (n == null) {
    let q = supabase.from("crm_sales_targets").delete().eq("mjesec", mjesec);
    q = member ? q.eq("member", member) : q.is("member", null);
    const { error } = await q;
    if (error) return { ok: false, error: dbMessage(error) };
  } else {
    const { error } = await supabase.from("crm_sales_targets").upsert({ mjesec, member, iznos: n }, { onConflict: "mjesec,member" });
    if (error) return { ok: false, error: dbMessage(error) };
  }
  revalidatePath("/crm", "layout");
  return { ok: true, message: "Cilj je spremljen." };
}

/** Izvoz se bilježi u Dnevnik izmjena. */
export async function logExport(entity: string, label: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("crm_log", { p_action: "izvoz", p_entity: entity, p_entity_id: null, p_label: label });
}
