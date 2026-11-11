"use server";

import { createClient } from "@/lib/supabase/server";

export type SubmitState = { ok: boolean; error?: string; matches?: number } | null;

/** Predaja javnog upitnika: RPC crm_form_submit (provjere, duplikati, vlasnik, zadatak „Nazovi u 24 h“, broj natječaja). */
export async function submitForm(token: string, _prev: SubmitState, fd: FormData): Promise<SubmitState> {
  const payload = {
    naziv: String(fd.get("naziv") ?? ""),
    klijent_tip: String(fd.get("klijent_tip") ?? "poduzece"),
    jls_tip: String(fd.get("jls_tip") ?? ""),
    zupanija: String(fd.get("zupanija") ?? ""),
    sektori: fd.getAll("sektori").map(String).slice(0, 20),
    kontakt_ime: String(fd.get("kontakt_ime") ?? ""),
    email: String(fd.get("email") ?? ""),
    telefon: String(fd.get("telefon") ?? ""),
    poruka: String(fd.get("poruka") ?? ""),
    privola: fd.get("privola") === "on",
    website: String(fd.get("website") ?? ""), // honeypot
  };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crm_form_submit", { p_token: token, p: payload });
  const res = data as { ok: boolean; error?: string; matches?: number } | null;
  if (error || !res?.ok) return { ok: false, error: res?.error ?? "Slanje nije uspjelo. Pokušajte ponovno." };
  return { ok: true, matches: res.matches ?? 0 };
}
