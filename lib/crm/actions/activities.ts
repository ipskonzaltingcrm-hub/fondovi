"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dbMessage, type ActionResult } from "@/lib/crm/session";
import type { Activity } from "@/lib/crm/data";
import type { ActivityVrsta } from "@/lib/crm/options";

export type ActivityTarget = { lead_id?: string | null; jls_profile_id?: string | null; task_id?: string | null; project_id?: string | null };

/** Ručni upis u povijest (poziv, bilješka, e-mail, sastanak, komentar zadatka). */
export async function addActivity(target: ActivityTarget, vrsta: ActivityVrsta, body: string): Promise<ActionResult> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Upišite tekst." };
  const supabase = await createClient();
  const { error } = await supabase.from("crm_activities").insert({
    vrsta,
    body: text,
    lead_id: target.lead_id ?? null,
    jls_profile_id: target.jls_profile_id ?? null,
    task_id: target.task_id ?? null,
    ...(target.project_id ? { project_id: target.project_id } : {}),
  });
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/crm", "layout");
  return { ok: true, message: "Upisano u povijest." };
}

/** Povijest zapisa (za bočne panele koji se otvaraju u pregledniku). */
export async function loadActivities(target: ActivityTarget): Promise<Activity[]> {
  const supabase = await createClient();
  let q = supabase
    .from("crm_activities")
    .select("id,at,actor_name,vrsta,body,lead_id,jls_profile_id,task_id")
    .order("at", { ascending: false })
    .limit(200);
  if (target.project_id) q = q.eq("project_id", target.project_id);
  else if (target.lead_id) q = q.eq("lead_id", target.lead_id);
  else if (target.task_id) q = q.eq("task_id", target.task_id);
  else if (target.jls_profile_id) q = q.eq("jls_profile_id", target.jls_profile_id);
  else return [];
  const { data } = await q;
  return (data ?? []) as Activity[];
}
