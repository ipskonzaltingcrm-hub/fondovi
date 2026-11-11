"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCrmMe, dbMessage, type ActionResult } from "@/lib/crm/session";
import { LEAD_IZVOR, LEAD_STATUS_MANUAL, KLIJENT_TIP, type LeadIzvor, type LeadStatus, type KlijentTip, type HotStage, HOT_STAGES } from "@/lib/crm/options";
import { TASK_COLS, type Task, type Activity } from "@/lib/crm/data";

export type LeadInput = {
  naziv: string;
  klijent_tip: KlijentTip;
  jls_tip?: "grad" | "opcina" | "zupanija" | null;
  kontakt_ime?: string | null;
  email?: string | null;
  telefon?: string | null;
  oib?: string | null;
  zupanija?: string | null;
  izvor: LeadIzvor;
  interes?: string | null;
  sektori?: string[];
  napomena?: string | null;
  owner?: string | null;
};

function clean(i: LeadInput) {
  const naziv = i.naziv?.trim();
  if (!naziv) throw new Error("Upišite naziv (organizacija ili ime).");
  if (!(i.klijent_tip in KLIJENT_TIP)) throw new Error("Odaberite vrstu klijenta.");
  if (!(i.izvor in LEAD_IZVOR)) throw new Error("Odaberite izvor.");
  const t = (s?: string | null) => s?.trim() || null;
  return {
    naziv,
    klijent_tip: i.klijent_tip,
    jls_tip: i.klijent_tip === "jls" ? i.jls_tip || "opcina" : null,
    kontakt_ime: t(i.kontakt_ime),
    email: t(i.email),
    telefon: t(i.telefon),
    oib: t(i.oib),
    zupanija: t(i.zupanija),
    izvor: i.izvor,
    interes: t(i.interes),
    sektori: i.sektori ?? [],
    napomena: t(i.napomena),
    owner: i.owner || null,
  };
}

function refresh() {
  revalidatePath("/crm", "layout");
}

export async function createLead(input: LeadInput): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me) return { ok: false, error: "Nemate pristup CRM-u." };
  let row;
  try {
    row = clean(input);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_leads")
    .insert({ ...row, owner: row.owner ?? me.id })
    .select("id,broj")
    .single();
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: `Lead L-${data.broj} je spremljen.`, data: data.id };
}

export async function updateLead(id: string, input: LeadInput): Promise<ActionResult> {
  let row;
  try {
    row = clean(input);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("crm_leads").update(row).eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: "Podaci leada su spremljeni." };
}

export async function setLeadStatus(id: string, status: LeadStatus, razlog?: string): Promise<ActionResult> {
  if (!LEAD_STATUS_MANUAL.includes(status)) return { ok: false, error: "Nepoznat status." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_leads")
    .update({ status, razlog_gubitka: status === "izgubljen" ? razlog?.trim() || null : null })
    .eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true };
}

export async function assignLead(id: string, owner: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_leads").update({ owner }).eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true };
}

export async function setTriage(
  id: string,
  t: { prihvatljivost: number | null; dokumentacija: number | null; financije: number | null },
): Promise<ActionResult> {
  const v = (n: number | null) => (n == null ? null : Math.max(0, Math.min(100, Math.round(n))));
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_leads")
    .update({ t_prihvatljivost: v(t.prihvatljivost), t_dokumentacija: v(t.dokumentacija), t_financije: v(t.financije) })
    .eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: "Trijaža je spremljena." };
}

export async function archiveLead(id: string, archived = true): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_leads")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: archived ? "Lead je arhiviran." : "Lead je vraćen iz arhive." };
}

/** Pretvorba u klijenta: novi klijent EU Radara ili povezivanje s postojećim. Vraća id klijenta. */
export async function convertLead(id: string, existingClientId: string | null, status: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crm_convert_lead", {
    p_lead: id,
    p_existing: existingClientId,
    p_status: status,
  });
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return {
    ok: true,
    message: existingClientId ? "Lead je povezan s klijentom." : "Klijent je otvoren u CRM-u i u EU Radaru.",
    data: data as string,
  };
}

// ------------------------------------------------------------------ Hot leadovi

export async function setHotLead(id: string, groupId: string | null, note?: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: cur } = await supabase.from("crm_leads").select("hot_at").eq("id", id).maybeSingle();
  const patch: Record<string, unknown> = { hot_group_id: groupId, hot_at: cur?.hot_at ?? new Date().toISOString() };
  if (note !== undefined) patch.hot_note = note?.trim() || null;
  const { error } = await supabase.from("crm_leads").update(patch).eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: "Hot lead je spremljen." };
}

export async function unsetHotLead(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_leads").update({ hot_at: null }).eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: "Lead je maknut iz hot leadova." };
}

/** Hot pregled (samo superadmin): boja semafora i bilješka. */
export async function saveHotCell(id: string, stage: HotStage | null, note: string): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me?.isSuperadmin) return { ok: false, error: "Hot pregled uređuje samo superadmin." };
  if (stage && !(stage in HOT_STAGES)) return { ok: false, error: "Nepoznata boja." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_leads")
    .update({ hot_stage: stage, hot_note: note.trim() || null })
    .eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true };
}

export type LeadSearchHit = { id: string; broj: number; naziv: string; kontakt_ime: string | null; hot: boolean };

/** Pretraga leadova za dodavanje u hot (ime, L-broj, mobitel, e-mail). */
export async function searchLeads(q: string): Promise<LeadSearchHit[]> {
  const s = q.trim();
  if (s.length < 2) return [];
  const supabase = await createClient();
  let query = supabase
    .from("crm_leads")
    .select("id,broj,naziv,kontakt_ime,hot_at")
    .is("archived_at", null)
    .limit(12);
  const m = s.match(/^l-?(\d+)$/i);
  if (m) query = query.eq("broj", Number(m[1]));
  else {
    const like = `%${s.replace(/[%,()]/g, " ")}%`;
    query = query.or(`naziv.ilike.${like},kontakt_ime.ilike.${like},email.ilike.${like},telefon.ilike.${like}`);
  }
  const { data } = await query;
  return (data ?? []).map((l) => ({ id: l.id, broj: l.broj, naziv: l.naziv, kontakt_ime: l.kontakt_ime, hot: !!l.hot_at }));
}

/** Detalj za bočni panel leada: povijest i zadaci. */
export async function loadLeadDetail(id: string): Promise<{ activities: Activity[]; tasks: Task[] }> {
  const supabase = await createClient();
  const [a, t] = await Promise.all([
    supabase
      .from("crm_activities")
      .select("id,at,actor_name,vrsta,body,lead_id,jls_profile_id,task_id")
      .eq("lead_id", id)
      .order("at", { ascending: false })
      .limit(200),
    supabase.from("crm_tasks").select(TASK_COLS).eq("lead_id", id).is("archived_at", null).order("rok", { nullsFirst: false }),
  ]);
  await supabase.rpc("crm_log", { p_action: "pregled", p_entity: "crm_leads", p_entity_id: id, p_label: null });
  return { activities: (a.data ?? []) as Activity[], tasks: (t.data ?? []) as unknown as Task[] };
}
