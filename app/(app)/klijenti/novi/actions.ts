"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/č|ć/g, "c")
    .replace(/ž/g, "z")
    .replace(/đ/g, "d")
    .replace(/š/g, "s")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export type KlijentFormState = { error?: string };

/** Kreira novog klijenta (tenant + profil). Samo superadmin. */
export async function createKlijent(
  _prev: KlijentFormState,
  formData: FormData,
): Promise<KlijentFormState> {
  // 1) Provjeri da je prijavljeni korisnik superadmin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_superadmin) {
    return { error: "Samo superadmin može dodavati klijente." };
  }

  // 2) Pročitaj formu
  const tipKlijenta = String(formData.get("tipKlijenta") || "jls");
  const naziv = String(formData.get("naziv") || "").trim();
  if (!naziv) return { error: "Naziv je obavezan." };

  const tip = tipKlijenta === "jls" ? String(formData.get("tip") || "opcina") : null;
  const zupanija = String(formData.get("zupanija") || "").trim() || null;
  const velicina =
    tipKlijenta === "poduzece"
      ? String(formData.get("velicina") || "").trim() || null
      : null;
  const stanovnikaRaw = Number(formData.get("stanovnika"));
  const stanovnika =
    tipKlijenta === "jls" && Number.isFinite(stanovnikaRaw) && stanovnikaRaw > 0
      ? Math.floor(stanovnikaRaw)
      : null;
  const ruralno = tipKlijenta === "jls" && formData.get("ruralno") === "on";
  const kontakt = String(formData.get("kontakt") || "").trim() || null;
  const status = String(formData.get("status") || "trial");
  const sektori = formData.getAll("sektori").map(String).filter(Boolean);

  // 3) Upis (service-role, iza provjere superadmina)
  const admin = createAdminClient();
  const slug = `${slugify(naziv)}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: tenant, error: te } = await admin
    .from("tenants")
    .insert({ slug, naziv, tip: "jls", status })
    .select("id")
    .single();
  if (te) return { error: `Tenant: ${te.message}` };

  const { error: pe } = await admin.from("jls_profiles").insert({
    tenant_id: tenant.id,
    slug,
    naziv,
    klijent_tip: tipKlijenta,
    tip,
    zupanija,
    stanovnika,
    ruralno,
    lag: null,
    velicina,
    sektori_interesa: sektori,
    kontakt_osoba: kontakt,
    status,
  });
  if (pe) return { error: `Profil: ${pe.message}` };

  revalidatePath("/klijenti");
  redirect("/klijenti");
}
