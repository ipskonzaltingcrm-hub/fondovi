"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCrmMe, dbMessage, type ActionResult } from "@/lib/crm/session";
import { CHECKLIST_TEMPLATES, PROJECT_FAZA, type ProjectFaza } from "@/lib/crm/options";

export type ProjectInput = {
  naziv: string;
  jls_profile_id?: string | null;
  lead_id?: string | null;
  call_id?: string | null;
  program?: string | null;
  owner?: string | null;
  faza?: ProjectFaza;
  rok_prijave?: string | null;
  iznos_projekta?: string | number | null;
  iznos_potpore?: string | number | null;
  napomena?: string | null;
};

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function clean(i: ProjectInput) {
  const naziv = i.naziv?.trim();
  if (!naziv) throw new Error("Upišite naziv projekta.");
  if (!i.jls_profile_id && !i.lead_id) throw new Error("Odaberite klijenta ili lead.");
  if (i.faza && !(i.faza in PROJECT_FAZA)) throw new Error("Nepoznata faza.");
  return {
    naziv,
    jls_profile_id: i.jls_profile_id || null,
    lead_id: i.lead_id || null,
    call_id: i.call_id || null,
    program: i.program?.trim() || null,
    owner: i.owner || null,
    faza: i.faza ?? "priprema",
    rok_prijave: i.rok_prijave || null,
    iznos_projekta: num(i.iznos_projekta),
    iznos_potpore: num(i.iznos_potpore),
    napomena: i.napomena?.trim() || null,
  };
}

function refresh(id?: string) {
  revalidatePath("/crm", "layout");
  if (id) revalidatePath(`/crm/projekti/${id}`);
}

export async function saveProject(id: string | null, input: ProjectInput): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me) return { ok: false, error: "Nemate pristup CRM-u." };
  let row;
  try {
    row = clean(input);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("crm_projects").update(row).eq("id", id);
    if (error) return { ok: false, error: dbMessage(error) };
    refresh(id);
    return { ok: true, message: "Projekt je spremljen.", data: id };
  }
  if (me.role === "suradnik") return { ok: false, error: "Projekte otvaraju konzultanti i administratori." };
  const { data, error } = await supabase
    .from("crm_projects")
    .insert({ ...row, owner: row.owner ?? me.id })
    .select("id,broj")
    .single();
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: `Projekt PR-${data.broj} je otvoren.`, data: data.id };
}

export async function setProjectPhase(id: string, faza: ProjectFaza): Promise<ActionResult> {
  if (!(faza in PROJECT_FAZA)) return { ok: false, error: "Nepoznata faza." };
  const supabase = await createClient();
  const { error, count } = await supabase.from("crm_projects").update({ faza }, { count: "exact" }).eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  if (!count) return { ok: false, error: "Projekt uređuju konzultanti, administratori i vlasnik projekta." };
  refresh(id);
  return { ok: true, message: `Faza: ${PROJECT_FAZA[faza].label}` };
}

export async function archiveProject(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("crm_projects")
    .update({ archived_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  if (!count) return { ok: false, error: "Nemate ovlast za ovaj projekt." };
  refresh(id);
  return { ok: true, message: "Projekt je arhiviran." };
}

export async function deleteProject(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error, count } = await supabase.from("crm_projects").delete({ count: "exact" }).eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  if (!count) return { ok: false, error: "Projekt briše samo superadmin." };
  refresh();
  return { ok: true, message: "Projekt je obrisan." };
}

// ------------------------------------------------------------------ Checklista

export async function applyChecklistTemplate(projectId: string, key: string): Promise<ActionResult> {
  const t = CHECKLIST_TEMPLATES.find((x) => x.key === key);
  if (!t) return { ok: false, error: "Nepoznat predložak." };
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("crm_project_items")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1);
  const start = (last?.[0]?.position ?? 0) + 1;
  const { error } = await supabase
    .from("crm_project_items")
    .insert(t.items.map((it, i) => ({ project_id: projectId, naziv: it.naziv, grupa: it.grupa, position: start + i })));
  if (error) return { ok: false, error: dbMessage(error) };
  refresh(projectId);
  return { ok: true, message: `Dodan predložak „${t.label}“.` };
}

export async function addChecklistItem(projectId: string, naziv: string, grupa: string | null): Promise<ActionResult> {
  if (!naziv.trim()) return { ok: false, error: "Upišite stavku." };
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("crm_project_items")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1);
  const { error } = await supabase
    .from("crm_project_items")
    .insert({ project_id: projectId, naziv: naziv.trim(), grupa: grupa?.trim() || null, position: (last?.[0]?.position ?? 0) + 1 });
  if (error) return { ok: false, error: dbMessage(error) };
  refresh(projectId);
  return { ok: true };
}

export async function toggleChecklistItem(projectId: string, itemId: string, done: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_project_items")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", itemId);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh(projectId);
  return { ok: true };
}

export async function removeChecklistItem(projectId: string, itemId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_project_items").delete().eq("id", itemId);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh(projectId);
  return { ok: true };
}
