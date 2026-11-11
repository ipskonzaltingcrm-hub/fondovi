"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function acceptPortalInvite(token: string, _prev: { error?: string } | null): Promise<{ error?: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crm_portal_accept", { p_token: token });
  if (error) return { error: error.message || "Prihvaćanje nije uspjelo." };
  const { data: j } = await supabase.from("jls_profiles").select("slug").eq("id", data as string).maybeSingle();
  redirect(j?.slug ? `/klijenti/${j.slug}` : "/dashboard");
}
