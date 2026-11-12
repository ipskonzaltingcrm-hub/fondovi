import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_TRIAGE, type TriageSettings } from "./triage-shared";

/**
 * AI trijaža natječaja (Faza 6), po uzoru na IPS Hub: model čita svaki novi natječaj iz baze EU Radara i procjenjuje
 * relevantnost prema opisu (profilu) koji uređuje administrator. Ručna procjena tima (crm_call_meta) uvijek ima prednost.
 * Koristi se samo na serveru, sa service-role klijentom (/api/cron/crm).
 */

export { DEFAULT_TRIAGE, type TriageSettings } from "./triage-shared";

// Kao procjena u IPS Hubu: Claude Opus 5.5; napor „low“ jer je ovo klasifikacija već izvučenih podataka (ne čitanje cijelih stranica).
export const TRIAGE_MODEL = "claude-opus-5-5";
// USD po milijun tokena: ulaz, izlaz, čitanje i upis predmemorije.
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };
const BATCH = 8;

export function hasApiKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function loadTriageSettings(admin: SupabaseClient): Promise<TriageSettings> {
  const { data } = await admin.from("crm_settings").select("value").eq("key", "call_triage").maybeSingle();
  return { ...DEFAULT_TRIAGE, ...((data?.value as Partial<TriageSettings>) ?? {}) };
}

type CallRow = {
  id: string;
  naslov: string;
  davatelj: string;
  program: string;
  level: string;
  status: string;
  rok_prijave: string | null;
  iznos_min: number | null;
  iznos_max: number | null;
  ukupna_alokacija: number | null;
  prihvatljivi: string[] | null;
  sektori: string[] | null;
  sazetak: string | null;
  izvor: string | null;
  url: string;
};

const APPLICANTS = ["grad", "opcina", "zupanija", "lag", "ustanova", "tvrtka", "ngo"] as const;

function inputHash(c: CallRow): string {
  return createHash("sha1")
    .update([c.naslov, c.sazetak ?? "", c.rok_prijave ?? "", c.status, c.program, c.iznos_max ?? ""].join("|"))
    .digest("hex");
}

/** Stabilan sustavski tekst (bez datuma) — predmemorija ostaje valjana između serija. */
function systemPrompt(s: TriageSettings): string {
  const kw = s.keywords.length ? `\n\nKljučne riječi koje posebno zanimaju tim: ${s.keywords.join(", ")}.` : "";
  return (
    `Ti si analitičar natječaja za bespovratna sredstva u konzultantskoj tvrtki IPS Konzalting (Hrvatska). ` +
    `Za svaki natječaj iz popisa procijeni koliko je relevantan za tvrtku i njezine klijente prema profilu ispod.\n\n` +
    `## Profil (što je relevantno)\n${s.profile.trim()}${kw}\n\n` +
    `## Ocjene\n` +
    `- visoka: otvoren ili najavljen natječaj/javni poziv za bespovratna sredstva na koji se klijenti iz profila mogu prijaviti.\n` +
    `- srednja: uska publika, mali iznosi, izmjene ili ispravci postojećeg poziva, ili djelomično poklapanje s profilom.\n` +
    `- niska: informativni dani, rezultati, pravilnici, savjetovanja i slične objave bez novog poziva.\n` +
    `- nebitno: zapošljavanje, javna nabava, objave koje nisu natječaji za potpore ili su izvan profila.\n` +
    `Zatvoren natječaj ili natječaj kojem je rok prošao nikad nije „visoka“.\n\n` +
    `Za svaki natječaj vrati: i (redni broj iz popisa), relevance, score (0–100, koliko je vrijedan timu), reason (jedna kratka rečenica ` +
    `na hrvatskom zašto), sazetak (1–2 rečenice na hrvatskom: tko se može prijaviti, za što, koliko i do kada — samo iz danog teksta) ` +
    `i prihvatljivi (koje vrste prijavitelja smiju: grad, opcina, zupanija, lag, ustanova, tvrtka, ngo; prazno ako tekst to ne kaže). ` +
    `Ne izmišljaj iznose, rokove ni prijavitelje.`
  );
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["i", "relevance", "score", "reason", "sazetak", "prihvatljivi"],
        properties: {
          i: { type: "integer" },
          relevance: { type: "string", enum: ["visoka", "srednja", "niska", "nebitno"] },
          score: { type: "integer" },
          reason: { type: "string" },
          sazetak: { type: "string" },
          prihvatljivi: { type: "array", items: { type: "string", enum: [...APPLICANTS] } },
        },
      },
    },
  },
} as const;

type Assessment = { i: number; relevance: "visoka" | "srednja" | "niska" | "nebitno"; score: number; reason: string; sazetak: string; prihvatljivi: string[] };

const eur = (n: number | null) => (n == null ? "" : `${Math.round(Number(n)).toLocaleString("hr-HR")} €`);

function describe(c: CallRow, idx: number): string {
  const iznos = [c.iznos_min != null && `od ${eur(c.iznos_min)}`, c.iznos_max != null && `do ${eur(c.iznos_max)}`].filter(Boolean).join(" ");
  return [
    `${idx}. ${c.naslov}`,
    `   Davatelj: ${c.davatelj} · Program: ${c.program} · Razina: ${c.level} · Status: ${c.status} · Rok: ${c.rok_prijave ?? "nije naveden"}`,
    iznos || c.ukupna_alokacija ? `   Iznos potpore: ${iznos || "—"}${c.ukupna_alokacija ? ` · Ukupna alokacija: ${eur(c.ukupna_alokacija)}` : ""}` : "",
    c.prihvatljivi?.length ? `   Prihvatljivi (heuristika): ${c.prihvatljivi.join(", ")}` : "",
    c.sektori?.length ? `   Sektori: ${c.sektori.join(", ")}` : "",
    `   Izvor: ${c.izvor ?? "—"} · ${c.url}`,
    c.sazetak ? `   Tekst: ${c.sazetak.replace(/\s+/g, " ").slice(0, 1500)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function monthCostUsd(admin: SupabaseClient, modul: string): Promise<number> {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { data } = await admin.from("crm_ai_usage").select("cost_usd").eq("modul", modul).gte("at", from);
  return (data ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);
}

/** Natječaji koji čekaju procjenu: noviji od 90 dana, nisu zatvoreni, nisu procijenjeni (ili im se tekst promijenio). */
export async function pendingCalls(admin: SupabaseClient, today: string): Promise<CallRow[]> {
  const since = new Date(Date.now() - 90 * 86400_000).toISOString();
  const { data: calls } = await admin
    .from("calls")
    .select("id,naslov,davatelj,program,level,status,rok_prijave,iznos_min,iznos_max,ukupna_alokacija,prihvatljivi,sektori,sazetak,izvor,url")
    .gte("created_at", since)
    .neq("status", "zatvoren")
    .or(`rok_prijave.is.null,rok_prijave.gte.${today}`)
    .order("created_at", { ascending: false })
    .limit(400);
  const list = (calls ?? []) as CallRow[];
  if (!list.length) return [];
  const { data: done } = await admin.from("crm_call_ai").select("call_id,input_hash").in("call_id", list.map((c) => c.id));
  const hashBy = new Map((done ?? []).map((d) => [d.call_id as string, d.input_hash as string | null]));
  return list.filter((c) => hashBy.get(c.id) !== inputHash(c));
}

export type TriageBatchResult = { assessed: number; relevant: number; cost: number; error?: string };

/** Jedna serija (do 8 natječaja) u jednom pozivu modela. Upisuje procjene i trošak. */
export async function assessBatch(admin: SupabaseClient, s: TriageSettings, calls: CallRow[], runId: string | null, today: string): Promise<TriageBatchResult> {
  const batch = calls.slice(0, BATCH);
  if (!batch.length) return { assessed: 0, relevant: 0, cost: 0 };
  const client = new Anthropic({ maxRetries: 3 });
  const user = `Današnji datum: ${today}\n\nNatječaji za procjenu (${batch.length}):\n\n${batch.map((c, k) => describe(c, k + 1)).join("\n\n")}`;
  let res;
  try {
    res = await client.beta.messages.create({
      model: TRIAGE_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: systemPrompt(s), cache_control: { type: "ephemeral" } }],
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> } },
      messages: [{ role: "user", content: user }],
    });
  } catch (e) {
    return { assessed: 0, relevant: 0, cost: 0, error: e instanceof Error ? e.message : String(e) };
  }

  const u = res.usage;
  const cost =
    ((u.input_tokens ?? 0) * PRICE.input +
      (u.output_tokens ?? 0) * PRICE.output +
      (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite) /
    1_000_000;
  await admin.from("crm_ai_usage").insert({
    modul: "trijaza",
    opis: `AI procjena ${batch.length} natječaja`,
    model: res.model ?? TRIAGE_MODEL,
    input_tokens: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
    output_tokens: u.output_tokens ?? 0,
    cost_usd: Number(cost.toFixed(6)),
    ref: runId,
  });

  if (res.stop_reason === "refusal") return { assessed: 0, relevant: 0, cost, error: "Model je odbio procjenu ove serije." };
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  let parsed: { items: Assessment[] };
  try {
    parsed = JSON.parse(text) as { items: Assessment[] };
  } catch {
    return { assessed: 0, relevant: 0, cost, error: res.stop_reason === "max_tokens" ? "Odgovor je prekinut (max_tokens)." : "Neispravan odgovor modela." };
  }

  const rows = parsed.items
    .filter((a) => a.i >= 1 && a.i <= batch.length)
    .map((a) => {
      const c = batch[a.i - 1];
      const closed = c.status === "zatvoren" || (c.rok_prijave != null && c.rok_prijave < today);
      const relevance = closed && a.relevance === "visoka" ? "srednja" : a.relevance;
      return {
        call_id: c.id,
        relevance,
        score: Math.max(0, Math.min(100, Math.round(a.score))),
        reason: a.reason.slice(0, 500),
        sazetak: a.sazetak.slice(0, 1200),
        prihvatljivi: a.prihvatljivi.filter((p) => (APPLICANTS as readonly string[]).includes(p)),
        model: res.model ?? TRIAGE_MODEL,
        input_hash: inputHash(c),
        run_id: runId,
        assessed_at: new Date().toISOString(),
      };
    });
  if (rows.length) {
    const { error } = await admin.from("crm_call_ai").upsert(rows);
    if (error) return { assessed: 0, relevant: 0, cost, error: error.message };
  }
  return { assessed: rows.length, relevant: rows.filter((r) => r.relevance === "visoka").length, cost };
}

/**
 * Trijaža u vremenskom okviru (Vercel funkcija ima ~60 s): serije dok ne istekne budžet vremena ili novca.
 * Vraća i je li ostalo neprocijenjenih natječaja (za nastavak u sljedećem pozivu).
 */
export async function runTriage(
  admin: SupabaseClient,
  today: string,
  opts: { runId: string | null; budgetMs: number },
): Promise<TriageBatchResult & { remaining: number; skipped?: string }> {
  const s = await loadTriageSettings(admin);
  if (!s.enabled) return { assessed: 0, relevant: 0, cost: 0, remaining: 0, skipped: "AI procjena je isključena." };
  if (!hasApiKey()) return { assessed: 0, relevant: 0, cost: 0, remaining: 0, skipped: "Nema ANTHROPIC_API_KEY." };
  const start = Date.now();
  let pending = await pendingCalls(admin, today);
  const total: TriageBatchResult = { assessed: 0, relevant: 0, cost: 0 };
  while (pending.length && Date.now() - start < opts.budgetMs) {
    if ((await monthCostUsd(admin, "trijaza")) >= s.limit_usd) {
      return { ...total, remaining: pending.length, skipped: `Dosegnut mjesečni limit troška (${s.limit_usd} USD).` };
    }
    const r = await assessBatch(admin, s, pending, opts.runId, today);
    total.assessed += r.assessed;
    total.relevant += r.relevant;
    total.cost += r.cost;
    if (r.error) return { ...total, remaining: pending.length, error: r.error };
    const doneIds = new Set(pending.slice(0, BATCH).map((c) => c.id));
    pending = pending.filter((c) => !doneIds.has(c.id));
  }
  return { ...total, remaining: pending.length };
}
