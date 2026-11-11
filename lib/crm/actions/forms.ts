"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCrmMe, dbMessage, type ActionResult } from "@/lib/crm/session";

export type FormInput = { naziv: string; uvod?: string | null; owner?: string | null; create_task: boolean; active: boolean };

export async function saveForm(id: string | null, f: FormInput): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me?.isAdmin) return { ok: false, error: "Upitnike uređuju administratori." };
  if (!f.naziv?.trim()) return { ok: false, error: "Upišite naziv upitnika." };
  const row = { naziv: f.naziv.trim(), uvod: f.uvod?.trim() || null, owner: f.owner || null, create_task: f.create_task, active: f.active };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("crm_forms").update(row).eq("id", id)
    : await supabase.from("crm_forms").insert(row);
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/crm/upitnici");
  return { ok: true, message: "Upitnik je spremljen." };
}

/** Nova javna poveznica (stara prestaje raditi) — kad je poveznica procurila. */
export async function rotateFormToken(id: string): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me?.isAdmin) return { ok: false, error: "Upitnike uređuju administratori." };
  const supabase = await createClient();
  const { error } = await supabase.from("crm_forms").update({ token: randomBytes(32).toString("hex") }).eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/crm/upitnici");
  return { ok: true, message: "Nova poveznica je spremna; stara više ne radi." };
}
