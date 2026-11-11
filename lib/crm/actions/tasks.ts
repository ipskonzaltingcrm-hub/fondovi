"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCrmMe, dbMessage, type ActionResult } from "@/lib/crm/session";
import { TASK_VRSTA, PRIORITET, type Prioritet, type TaskVrsta } from "@/lib/crm/options";

export type TaskInput = {
  naslov: string;
  opis?: string | null;
  vrsta?: TaskVrsta;
  prioritet?: Prioritet;
  rok?: string | null;
  vrijeme?: string | null;
  owner?: string | null;
  lead_id?: string | null;
  jls_profile_id?: string | null;
  call_id?: string | null;
  project_id?: string | null;
};

function clean(input: TaskInput) {
  const naslov = input.naslov?.trim();
  if (!naslov) throw new Error("Upišite zadatak.");
  return {
    naslov,
    opis: input.opis?.trim() || null,
    vrsta: input.vrsta && input.vrsta in TASK_VRSTA ? input.vrsta : "ostalo",
    prioritet: input.prioritet && input.prioritet in PRIORITET ? input.prioritet : "srednji",
    rok: input.rok || null,
    vrijeme: input.vrijeme || null,
    owner: input.owner || null,
    lead_id: input.lead_id || null,
    jls_profile_id: input.jls_profile_id || null,
    call_id: input.call_id || null,
    project_id: input.project_id || null,
  };
}

function refresh() {
  revalidatePath("/crm", "layout");
}

export async function createTask(input: TaskInput): Promise<ActionResult> {
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
    .from("crm_tasks")
    .insert({ ...row, owner: row.owner ?? me.id })
    .select("id")
    .single();
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: "Zadatak je spremljen.", data: data.id };
}

export async function updateTask(id: string, input: TaskInput): Promise<ActionResult> {
  let row;
  try {
    row = clean(input);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("crm_tasks").update(row).eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: "Zadatak je spremljen." };
}

export async function setTaskDone(id: string, done: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_tasks")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true };
}

export async function rescheduleTask(id: string, rok: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_tasks").update({ rok }).eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true };
}

export async function archiveTask(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_tasks")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: "Zadatak je arhiviran." };
}
