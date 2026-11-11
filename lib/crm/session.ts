import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { StaffRole } from "./roles";

export type CrmMe = {
  id: string;
  email: string;
  name: string;
  shortName: string | null;
  role: StaffRole;
  isAdmin: boolean;
  isSuperadmin: boolean;
};

/**
 * Prijavljeni član tima (ili null ako korisnik nije u timu / je deaktiviran).
 * Keširano po zahtjevu (React cache) — layout i stranice dijele jedan upit.
 */
export const getCrmMe = cache(async (): Promise<CrmMe | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: p } = await supabase
    .from("profiles")
    .select("id,email,full_name,short_name,staff_role,staff_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!p?.staff_role || !p.staff_active) return null;

  const role = p.staff_role as StaffRole;
  return {
    id: p.id,
    email: p.email ?? user.email ?? "",
    name: p.full_name || p.email || "",
    shortName: p.short_name,
    role,
    isAdmin: role === "superadmin" || role === "admin",
    isSuperadmin: role === "superadmin",
  };
});

/** Za stranice CRM-a: član tima ili preusmjeravanje. */
export async function requireStaff(): Promise<CrmMe> {
  const me = await getCrmMe();
  if (!me) redirect("/crm/bez-pristupa");
  return me;
}

/** Javna adresa aplikacije iz zahtjeva (za poveznice pozivnica). */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Rezultat server akcije (poruka greške prikazuje se korisniku). */
export type ActionResult = { ok: true; message?: string; data?: string } | { ok: false; error: string };

/** Poruka iz baze (raise exception … je na hrvatskom) ili općenita poruka. */
export function dbMessage(error: { message?: string } | null | undefined): string {
  const m = error?.message?.trim();
  return m || "Nešto nije u redu. Pokušajte ponovno.";
}
