"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCrmMe, dbMessage, type ActionResult } from "@/lib/crm/session";
import type { ChatBrain, ChatSettings } from "@/lib/crm/chatbot-shared";

async function adminOnly() {
  const me = await getCrmMe();
  return me?.isAdmin ? me : null;
}
const NO = { ok: false as const, error: "Ovo uređuju administratori." };

async function setSetting(key: string, value: unknown): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("crm_settings").update({ value }).eq("key", key);
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/crm", "layout");
  return { ok: true, message: "Spremljeno." };
}

// ------------------------------------------------------------------ Chatbot

export async function saveChatSettings(s: ChatSettings): Promise<ActionResult> {
  if (!(await adminOnly())) return NO;
  const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, Math.round(Number(n) || a)));
  return setSetting("chatbot", {
    enabled: !!s.enabled,
    ime: (s.ime || "Ana").trim().slice(0, 40),
    pozdrav: (s.pozdrav || "").trim().slice(0, 500),
    max_pitanja: clamp(s.max_pitanja, 1, 50),
    kontakt_od: clamp(s.kontakt_od, 1, 50),
    limit_usd: Math.max(0, Math.min(1000, Number(s.limit_usd) || 0)),
  });
}

export async function saveChatBrain(b: ChatBrain): Promise<ActionResult> {
  if (!(await adminOnly())) return NO;
  const clean = Object.fromEntries(Object.entries(b).map(([k, v]) => [k, String(v ?? "").slice(0, k === "dodatno" ? 200_000 : 20_000)]));
  return setSetting("chatbot_brain", clean);
}

export async function markChatReviewed(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("crm_chat_mark_reviewed", { p_conv: id });
  revalidatePath("/crm", "layout");
}

export async function deleteChat(id: string): Promise<ActionResult> {
  if (!(await adminOnly())) return NO;
  const supabase = await createClient();
  const { error } = await supabase.from("crm_chat_conversations").delete().eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/crm/chatbot");
  return { ok: true, message: "Razgovor je obrisan." };
}

// ------------------------------------------------------------------ Fiksni troškovi

export type FixedCostInput = {
  naziv: string;
  kategorija: string;
  dobavljac?: string | null;
  iznos: string | number;
  ucestalost: "mjesecno" | "kvartalno" | "polugodisnje" | "godisnje";
  od?: string | null;
  do?: string | null;
  dan_placanja?: string | number | null;
  napomena?: string | null;
};

export async function saveFixedCost(id: string | null, c: FixedCostInput): Promise<ActionResult> {
  if (!(await adminOnly())) return NO;
  const iznos = Number(String(c.iznos).replace(",", "."));
  if (!c.naziv?.trim()) return { ok: false, error: "Upišite naziv troška." };
  if (!Number.isFinite(iznos) || iznos < 0) return { ok: false, error: "Upišite iznos." };
  const dan = c.dan_placanja === "" || c.dan_placanja == null ? null : Math.round(Number(c.dan_placanja));
  const row = {
    naziv: c.naziv.trim(),
    kategorija: c.kategorija || "ostalo",
    dobavljac: c.dobavljac?.trim() || null,
    iznos,
    ucestalost: c.ucestalost,
    od: c.od || null,
    do: c.do || null,
    dan_placanja: dan && dan >= 1 && dan <= 31 ? dan : null,
    napomena: c.napomena?.trim() || null,
  };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("crm_fixed_costs").update(row).eq("id", id) : await supabase.from("crm_fixed_costs").insert(row);
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/crm/fiksni-troskovi");
  return { ok: true, message: "Trošak je spremljen." };
}

export async function archiveFixedCost(id: string, archived: boolean): Promise<ActionResult> {
  if (!(await adminOnly())) return NO;
  const supabase = await createClient();
  const { error } = await supabase.from("crm_fixed_costs").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id);
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/crm/fiksni-troskovi");
  return { ok: true, message: archived ? "Trošak je uklonjen (arhiva)." : "Trošak je vraćen." };
}

// ------------------------------------------------------------------ Trošak AI-ja i sigurnost

export async function saveClaudeCredit(usd: string | number | null): Promise<ActionResult> {
  if (!(await adminOnly())) return NO;
  const n = usd === "" || usd == null ? null : Number(String(usd).replace(",", "."));
  return setSetting("claude_credit", { usd: n != null && Number.isFinite(n) ? n : null, updated: new Date().toISOString() });
}

export async function setMfaRequired(required: boolean): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me?.isSuperadmin) return { ok: false, error: "Obaveznu 2FA uključuje superadmin." };
  return setSetting("security", { mfa_required: required });
}
