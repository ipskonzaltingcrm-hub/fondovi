"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCrmMe, dbMessage, requestOrigin, type ActionResult } from "@/lib/crm/session";
import { ASSIGNABLE_ROLES, type StaffRole } from "@/lib/crm/roles";

/** Pozivnica u tim: vraća poveznicu koju administrator kopira i pošalje (e-mail se ne šalje automatski). */
export async function inviteMember(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me?.isAdmin) return { ok: false, error: "Članove tima pozivaju samo administratori." };

  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "") as StaffRole;
  if (!ASSIGNABLE_ROLES.includes(role)) return { ok: false, error: "Odaberite ulogu." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crm_invite", { p_email: email, p_role: role, p_full_name: name });
  if (error) return { ok: false, error: dbMessage(error) };

  revalidatePath("/crm/tim");
  return {
    ok: true,
    message: `Pozivnica za ${email} je spremna. Kopirajte poveznicu i pošaljite je osobno (vrijedi 7 dana).`,
    data: `${await requestOrigin()}/crm/pozivnica?token=${data as string}`,
  };
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me?.isAdmin) return { ok: false, error: "Pozivnice opoziva samo administrator." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("crm_revoke_invitation", { p_id: id });
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/crm/tim");
  return { ok: true, message: "Pozivnica je opozvana." };
}

/** Uređivanje člana: osobni podaci (svoj profil) ili uloga i status (administrator, provjere u bazi). */
export async function updateMember(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me) return { ok: false, error: "Nemate pristup CRM-u." };

  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "") as StaffRole;
  const active = formData.get("active") === "on" || formData.get("active") === "true";

  const supabase = await createClient();
  const { error } = await supabase.rpc("crm_update_member", {
    p_id: id,
    p_role: role,
    p_active: active,
    p_full_name: String(formData.get("full_name") ?? ""),
    p_short_name: String(formData.get("short_name") ?? ""),
    p_job_title: String(formData.get("job_title") ?? ""),
    p_phone: String(formData.get("phone") ?? ""),
  });
  if (error) return { ok: false, error: dbMessage(error) };

  revalidatePath("/crm", "layout");
  return { ok: true, message: "Spremljeno." };
}
