"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCrmMe, dbMessage, type ActionResult } from "@/lib/crm/session";
import type { OfferItem, OfferRate, CompanyInfo } from "@/lib/crm/data";
import type { OfferStatus } from "@/lib/crm/options";

function refresh(id?: string) {
  revalidatePath("/crm", "layout");
  if (id) revalidatePath(`/crm/ponude/${id}`);
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export type NewOfferInput = { predmet: string; jls_profile_id?: string | null; lead_id?: string | null; project_id?: string | null };

/** Novi nacrt ponude (s popisa, leada, klijenta ili projekta). Vraća id. */
export async function createOffer(input: NewOfferInput): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me) return { ok: false, error: "Nemate pristup CRM-u." };
  if (!input.predmet?.trim()) return { ok: false, error: "Upišite predmet ponude." };
  if (!input.jls_profile_id && !input.lead_id) return { ok: false, error: "Odaberite klijenta ili lead." };
  const supabase = await createClient();
  const vrijedi = new Date();
  vrijedi.setDate(vrijedi.getDate() + 30);
  const { data, error } = await supabase
    .from("crm_offers")
    .insert({
      predmet: input.predmet.trim(),
      jls_profile_id: input.jls_profile_id || null,
      lead_id: input.lead_id || null,
      project_id: input.project_id || null,
      owner: me.id,
      vrijedi_do: vrijedi.toISOString().slice(0, 10),
    })
    .select("id,broj")
    .single();
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: `Nacrt ${data.broj} je otvoren.`, data: data.id };
}

export type OfferHeader = {
  predmet: string;
  jls_profile_id?: string | null;
  lead_id?: string | null;
  project_id?: string | null;
  owner?: string | null;
  datum: string;
  vrijedi_do?: string | null;
  visina_investicije?: string | number | null;
  rate: OfferRate[];
  napomene?: string | null;
};

/** Sprema zaglavlje i stavke nacrta (stavke se zamjenjuju; dopušteno samo dok je ponuda nacrt — provjera u bazi). */
export async function saveOffer(id: string, h: OfferHeader, items: OfferItem[]): Promise<ActionResult> {
  if (!h.predmet?.trim()) return { ok: false, error: "Upišite predmet ponude." };
  if (!h.jls_profile_id && !h.lead_id) return { ok: false, error: "Odaberite klijenta ili lead." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_offers")
    .update({
      predmet: h.predmet.trim(),
      jls_profile_id: h.jls_profile_id || null,
      lead_id: h.lead_id || null,
      project_id: h.project_id || null,
      owner: h.owner || null,
      datum: h.datum,
      vrijedi_do: h.vrijedi_do || null,
      visina_investicije: num(h.visina_investicije),
      rate: (h.rate ?? []).filter((r) => r.opis?.trim()).map((r) => ({ opis: r.opis.trim(), iznos: num(r.iznos) })),
      napomene: h.napomene?.trim() || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };

  const clean = items
    .filter((i) => i.naziv?.trim())
    .map((i, idx) => ({
      offer_id: id,
      service_id: i.service_id || null,
      naziv: i.naziv.trim(),
      opis: i.opis?.trim() || null,
      kolicina: num(i.kolicina) ?? 1,
      jedinica: i.jedinica || "kom",
      cijena: num(i.cijena) ?? 0,
      postotak: num(i.postotak),
      pdv: num(i.pdv) ?? 25,
      position: idx + 1,
    }));
  const del = await supabase.from("crm_offer_items").delete().eq("offer_id", id);
  if (del.error) return { ok: false, error: dbMessage(del.error) };
  if (clean.length) {
    const ins = await supabase.from("crm_offer_items").insert(clean);
    if (ins.error) return { ok: false, error: dbMessage(ins.error) };
  }
  refresh(id);
  return { ok: true, message: "Ponuda je spremljena." };
}

export async function setOfferStatus(id: string, status: OfferStatus, razlog?: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("crm_set_offer_status", { p_id: id, p_status: status, p_razlog: razlog ?? null });
  if (error) return { ok: false, error: dbMessage(error) };
  refresh(id);
  const msg: Record<OfferStatus, string> = {
    nacrt: "Ponuda je vraćena u nacrt.",
    poslana: "Ponuda je označena kao poslana.",
    prihvacena: "Ponuda je prihvaćena i upisana u prodaju.",
    odbijena: "Ponuda je označena kao odbijena.",
    istekla: "Ponuda je označena kao istekla.",
  };
  return { ok: true, message: msg[status] };
}

export async function archiveOffer(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_offers").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh(id);
  return { ok: true, message: "Nacrt je arhiviran." };
}

/** Kopija kao novi nacrt (s istim stavkama). */
export async function duplicateOffer(id: string): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me) return { ok: false, error: "Nemate pristup CRM-u." };
  const supabase = await createClient();
  const { data: o } = await supabase
    .from("crm_offers")
    .select("predmet,jls_profile_id,lead_id,project_id,visina_investicije,rate,napomene")
    .eq("id", id)
    .maybeSingle();
  if (!o) return { ok: false, error: "Ponuda ne postoji." };
  const { data: items } = await supabase
    .from("crm_offer_items")
    .select("service_id,naziv,opis,kolicina,jedinica,cijena,postotak,pdv,position")
    .eq("offer_id", id);
  const vrijedi = new Date();
  vrijedi.setDate(vrijedi.getDate() + 30);
  const { data: n, error } = await supabase
    .from("crm_offers")
    .insert({ ...o, owner: me.id, vrijedi_do: vrijedi.toISOString().slice(0, 10) })
    .select("id,broj")
    .single();
  if (error) return { ok: false, error: dbMessage(error) };
  if (items?.length) {
    const ins = await supabase.from("crm_offer_items").insert(items.map((i) => ({ ...i, offer_id: n.id })));
    if (ins.error) return { ok: false, error: dbMessage(ins.error) };
  }
  refresh();
  return { ok: true, message: `Kopija ${n.broj} je otvorena.`, data: n.id };
}

// ------------------------------------------------------------------ Cjenik i postavke (administratori)

export type ServiceInput = {
  naziv: string;
  opis?: string | null;
  kategorija: string;
  jedinica: string;
  cijena?: string | number | null;
  postotak?: string | number | null;
  pdv?: string | number | null;
  aktivan: boolean;
};

export async function saveService(id: string | null, s: ServiceInput): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me?.isAdmin) return { ok: false, error: "Cjenik uređuju administratori." };
  if (!s.naziv?.trim()) return { ok: false, error: "Upišite naziv usluge." };
  const row = {
    naziv: s.naziv.trim(),
    opis: s.opis?.trim() || null,
    kategorija: s.kategorija,
    jedinica: s.jedinica,
    cijena: s.jedinica === "postotak" ? null : num(s.cijena),
    postotak: s.jedinica === "postotak" ? num(s.postotak) : null,
    pdv: num(s.pdv) ?? 25,
    aktivan: s.aktivan,
  };
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("crm_services").update(row).eq("id", id);
    if (error) return { ok: false, error: dbMessage(error) };
  } else {
    const { data: last } = await supabase.from("crm_services").select("position").order("position", { ascending: false }).limit(1);
    const { error } = await supabase.from("crm_services").insert({ ...row, position: (last?.[0]?.position ?? 0) + 1 });
    if (error) return { ok: false, error: dbMessage(error) };
  }
  revalidatePath("/crm/ponude", "layout");
  return { ok: true, message: "Usluga je spremljena." };
}

export async function saveSetting(key: "company" | "offer_terms" | "jls_budget_deadline", value: unknown): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me?.isAdmin) return { ok: false, error: "Postavke uređuju administratori." };
  const supabase = await createClient();
  const { error } = await supabase.from("crm_settings").update({ value }).eq("key", key);
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/crm", "layout");
  return { ok: true, message: "Spremljeno." };
}

export async function saveCompany(c: CompanyInfo): Promise<ActionResult> {
  return saveSetting("company", c);
}
