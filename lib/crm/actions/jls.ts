"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCrmMe, dbMessage, type ActionResult } from "@/lib/crm/session";
import { JLS_STATUS, JLS_DRAFT_STATUS, type JlsDraftStatus, type JlsStatus } from "@/lib/crm/options";

async function admin() {
  const me = await getCrmMe();
  return me?.isAdmin ? me : null;
}
const NO = { ok: false as const, error: "JLS prodaju vode administratori." };

function refresh() {
  revalidatePath("/crm/jls-prodaja");
}

export type TargetInput = {
  naziv: string;
  tip: "opcina" | "grad" | "zupanija";
  zupanija?: string | null;
  segment?: "A" | "B" | "C" | "" | null;
  bodovi?: string | number | null;
  lag?: string | null;
  stanovnika?: string | number | null;
  kontakt_osoba?: string | null;
  email?: string | null;
  telefon?: string | null;
  napomena?: string | null;
};

function clean(t: TargetInput) {
  const n = (v: unknown) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)));
  const s = (v?: string | null) => v?.trim() || null;
  if (!t.naziv?.trim()) throw new Error("Upišite naziv JLS-a.");
  return {
    naziv: t.naziv.trim(),
    tip: ["opcina", "grad", "zupanija"].includes(t.tip) ? t.tip : "opcina",
    zupanija: s(t.zupanija),
    segment: t.segment || null,
    bodovi: n(t.bodovi),
    lag: s(t.lag),
    stanovnika: n(t.stanovnika),
    kontakt_osoba: s(t.kontakt_osoba),
    email: s(t.email),
    telefon: s(t.telefon),
    napomena: s(t.napomena),
  };
}

export async function saveTarget(id: string | null, t: TargetInput): Promise<ActionResult> {
  if (!(await admin())) return NO;
  let row;
  try {
    row = clean(t);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = id ? await supabase.from("crm_jls_targets").update(row).eq("id", id) : await supabase.from("crm_jls_targets").insert(row);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: "JLS je spremljen." };
}

/** Uvoz ciljne skupine: redak po JLS-u, polja odvojena točkom-zarezom ili tabom:
 *  naziv; tip (općina/grad/županija); županija; e-mail; kontakt osoba; telefon; segment; bodovi */
export async function importTargets(text: string): Promise<ActionResult> {
  if (!(await admin())) return NO;
  const tipMap: Record<string, "opcina" | "grad" | "zupanija"> = { općina: "opcina", opcina: "opcina", grad: "grad", županija: "zupanija", zupanija: "zupanija" };
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/\t|;/).map((x) => x.trim()))
    .filter((c) => c[0] && !/^naziv$/i.test(c[0]))
    .map((c) => {
      const seg = (c[6] ?? "").toUpperCase();
      return clean({
        naziv: c[0],
        tip: tipMap[(c[1] ?? "").toLowerCase()] ?? "opcina",
        zupanija: c[2],
        email: c[3],
        kontakt_osoba: c[4],
        telefon: c[5],
        segment: seg === "A" || seg === "B" || seg === "C" ? seg : null,
        bodovi: c[7],
      });
    });
  if (!rows.length) return { ok: false, error: "Nema redaka za uvoz." };
  if (rows.length > 1000) return { ok: false, error: "Najviše 1000 redaka odjednom." };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("crm_jls_targets").select("naziv");
  const have = new Set((existing ?? []).map((e) => (e.naziv as string).toLowerCase()));
  const fresh = rows.filter((r) => !have.has(r.naziv.toLowerCase()));
  if (fresh.length) {
    const { error } = await supabase.from("crm_jls_targets").insert(fresh);
    if (error) return { ok: false, error: dbMessage(error) };
  }
  refresh();
  return { ok: true, message: `Uvezeno ${fresh.length}, preskočeno (već postoji) ${rows.length - fresh.length}.` };
}

export async function setTargetStatus(id: string, status: JlsStatus): Promise<ActionResult> {
  if (!(await admin())) return NO;
  if (!(status in JLS_STATUS)) return { ok: false, error: "Nepoznat status." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_jls_targets")
    .update({ status, zadnji_kontakt: new Date().toISOString().slice(0, 10) })
    .eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true };
}

export async function createDraft(targetId: string, predlozak: string | null, naslov: string, tekst: string): Promise<ActionResult> {
  if (!(await admin())) return NO;
  if (!naslov.trim() || !tekst.trim()) return { ok: false, error: "Upišite naslov i tekst." };
  const supabase = await createClient();
  const { error } = await supabase.from("crm_jls_drafts").insert({ target_id: targetId, predlozak, naslov: naslov.trim(), tekst: tekst.trim() });
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: "Nacrt je spremljen." };
}

export async function saveDraft(id: string, naslov: string, tekst: string): Promise<ActionResult> {
  if (!(await admin())) return NO;
  const supabase = await createClient();
  const { error } = await supabase.from("crm_jls_drafts").update({ naslov: naslov.trim(), tekst: tekst.trim() }).eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: "Nacrt je spremljen." };
}

export async function setDraftStatus(id: string, status: JlsDraftStatus): Promise<ActionResult> {
  if (!(await admin())) return NO;
  if (!(status in JLS_DRAFT_STATUS)) return { ok: false, error: "Nepoznat status." };
  const supabase = await createClient();
  const { error } = await supabase.from("crm_jls_drafts").update({ status }).eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: `Nacrt: ${JLS_DRAFT_STATUS[status].label}` };
}

export async function addSignal(targetId: string | null, naslov: string, opis: string, url: string): Promise<ActionResult> {
  if (!(await admin())) return NO;
  if (!naslov.trim()) return { ok: false, error: "Upišite signal." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_jls_signals")
    .insert({ target_id: targetId || null, naslov: naslov.trim(), opis: opis.trim() || null, url: url.trim() || null });
  if (error) return { ok: false, error: dbMessage(error) };
  refresh();
  return { ok: true, message: "Signal je upisan." };
}

export async function addTargetNote(targetId: string, vrsta: "poziv" | "sastanak" | "biljeska" | "email", body: string): Promise<ActionResult> {
  if (!(await admin())) return NO;
  if (!body.trim()) return { ok: false, error: "Upišite tekst." };
  const supabase = await createClient();
  const { error } = await supabase.from("crm_activities").insert({ vrsta, body: body.trim(), jls_target_id: targetId });
  if (error) return { ok: false, error: dbMessage(error) };
  await supabase.from("crm_jls_targets").update({ zadnji_kontakt: new Date().toISOString().slice(0, 10) }).eq("id", targetId);
  refresh();
  return { ok: true, message: "Upisano u povijest." };
}

export async function convertTarget(id: string): Promise<ActionResult> {
  if (!(await admin())) return NO;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crm_jls_convert", { p_id: id });
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/crm", "layout");
  return { ok: true, message: "JLS je otvoren kao klijent (i u EU Radaru).", data: data as string };
}

export async function logJlsExport(n: number): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("crm_log", { p_action: "izvoz", p_entity: "crm_jls_targets", p_entity_id: null, p_label: `Ciljna skupina (${n} JLS-ova), CSV` });
}
