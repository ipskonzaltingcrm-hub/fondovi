import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { CLIENT_COLS, LEAD_COLS, getTeam, type ClientRow, type Lead } from "@/lib/crm/data";
import { one } from "@/lib/crm/clients-util";
import { autoRelevance, clientCandidate, evaluate, leadCandidate } from "@/lib/crm/matching";
import { LEAD_OPEN, type Relevance } from "@/lib/crm/options";
import { addDays, todayZg } from "@/lib/crm/dates";
import { getSources } from "@/lib/data";
import type { FundingCall } from "@/lib/types";
import { DEFAULT_TRIAGE, type TriageRun, type TriageSettings } from "@/lib/crm/triage-shared";
import { CallsView, type CallItem } from "./calls-view";

export const metadata = { title: "Natječaji" };
// „Provjeri sada“ u pozadini čeka prikupljanje (do ~60 s).
export const maxDuration = 60;

type Row = {
  id: string;
  slug: string;
  naslov: string;
  davatelj: string;
  program: string;
  level: FundingCall["level"];
  status: FundingCall["status"];
  datum_objave: string | null;
  rok_prijave: string | null;
  iznos_min: number | null;
  iznos_max: number | null;
  ukupna_alokacija: number | null;
  intenzitet: string | null;
  prihvatljivi: FundingCall["prihvatljivi"];
  sektori: string[];
  sazetak: string | null;
  izvor: string | null;
  url: string;
  created_at: string;
  updated_at: string;
};

export default async function NatjecajiPage({ searchParams }: PageProps<"/crm/natjecaji">) {
  const me = await requireStaff();
  const sp = await searchParams;
  const today = todayZg();
  const supabase = await createClient();
  const since = addDays(today, -400);
  const [{ data: calls }, { data: meta }, { data: reads }, { data: clients }, { data: leads }, team, sources, { data: aiRows }, { data: triageRow }, { data: runs }] = await Promise.all([
    supabase
      .from("calls")
      .select(
        "id,slug,naslov,davatelj,program,level,status,datum_objave,rok_prijave,iznos_min,iznos_max,ukupna_alokacija,intenzitet,prihvatljivi,sektori,sazetak,izvor,url,created_at,updated_at",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("crm_call_meta").select("call_id,relevance,prioritet,archived_at,napomena"),
    supabase.from("crm_call_reads").select("call_id").eq("user_id", me.id),
    supabase.from("jls_profiles").select(CLIENT_COLS),
    supabase.from("crm_leads").select(LEAD_COLS).is("archived_at", null).in("status", LEAD_OPEN),
    getTeam(),
    getSources(),
    supabase.from("crm_call_ai").select("call_id,relevance,score,reason,sazetak,assessed_at"),
    supabase.from("crm_settings").select("value").eq("key", "call_triage").maybeSingle(),
    supabase.from("crm_triage_runs").select("id,trigger,status,started_at,finished_at,assessed,relevant,cost_usd,error,ingest").order("started_at", { ascending: false }).limit(5),
  ]);
  const aiBy = new Map((aiRows ?? []).map((a) => [a.call_id as string, a]));
  const triage = { ...DEFAULT_TRIAGE, ...((triageRow?.value as Partial<TriageSettings>) ?? {}) };
  await supabase.rpc("crm_mark_seen", { p_key: "natjecaji" });

  const metaBy = new Map((meta ?? []).map((m) => [m.call_id as string, m]));
  const readSet = new Set((reads ?? []).map((r) => r.call_id as string));
  const candC = ((clients ?? []) as unknown as ClientRow[]).map((c) => clientCandidate({ ...c, crm: one(c.crm) }));
  const candL = ((leads ?? []) as Lead[]).map(leadCandidate);

  const items: CallItem[] = ((calls ?? []) as Row[]).map((r) => {
    const fc: FundingCall = {
      id: r.slug,
      naslov: r.naslov,
      davatelj: r.davatelj,
      program: r.program,
      level: r.level,
      status: r.status,
      datumObjave: r.datum_objave ?? r.created_at,
      rokPrijave: r.rok_prijave,
      iznosMin: r.iznos_min,
      iznosMax: r.iznos_max,
      ukupnaAlokacija: r.ukupna_alokacija,
      intenzitet: r.intenzitet ?? "",
      prihvatljivi: r.prihvatljivi ?? [],
      sektori: r.sektori ?? [],
      sazetak: r.sazetak ?? "",
      izvor: r.izvor ?? "",
      url: r.url,
      azurirano: r.updated_at,
    };
    const matches = [...candC, ...candL]
      .map((c) => ({ c, e: evaluate(fc, c.jls) }))
      .filter((x) => x.e.verdict !== "nije")
      .sort((a, b) => b.e.score - a.e.score)
      .map((x) => ({ kind: x.c.kind, id: x.c.id, naziv: x.c.naziv, owner: x.c.owner, label: x.c.label, score: x.e.score, verdict: x.e.verdict }));
    const clientsEl = matches.filter((m) => m.kind === "klijent");
    const auto = autoRelevance(clientsEl.length, clientsEl[0]?.score ?? 0, matches.length - clientsEl.length);
    const m = metaBy.get(r.id);
    const ai = aiBy.get(r.id);
    const relevance = (m?.relevance as Relevance | null) ?? (ai?.relevance as Relevance | undefined) ?? auto;
    const expired = r.rok_prijave != null && r.rok_prijave < today;
    return {
      id: r.id,
      slug: r.slug,
      naslov: r.naslov,
      davatelj: r.davatelj,
      program: r.program,
      status: r.status,
      rok: r.rok_prijave,
      createdAt: r.created_at,
      iznosMin: r.iznos_min,
      iznosMax: r.iznos_max,
      alokacija: r.ukupna_alokacija,
      intenzitet: r.intenzitet,
      prihvatljivi: r.prihvatljivi ?? [],
      sektori: r.sektori ?? [],
      sazetak: r.sazetak,
      url: r.url,
      izvor: r.izvor,
      relevance,
      autoRelevance: auto,
      manual: !!m?.relevance,
      ai: ai
        ? { relevance: ai.relevance as Relevance, score: ai.score as number, reason: (ai.reason as string | null) ?? null, sazetak: (ai.sazetak as string | null) ?? null, at: ai.assessed_at as string }
        : null,
      prioritet: !!m?.prioritet || (relevance === "visoka" && r.status !== "zatvoren" && !expired),
      manualPrioritet: !!m?.prioritet,
      archived: !!m?.archived_at,
      napomena: m?.napomena ?? null,
      read: readSet.has(r.id),
      open: r.status !== "zatvoren" && !expired,
      matches,
    };
  });

  return (
    <>
      <PageHeader
        title="Natječaji"
        description="Natječaji koje EU Radar prikuplja iz izvora, s timskom procjenom, prioritetima i popisom prihvatljivih klijenata i leadova. Iz natječaja se jednim klikom rade zadaci „Nazovi“."
      />
      <CallsView
        items={items}
        team={team}
        sources={sources}
        me={{ id: me.id, role: me.role, isAdmin: me.isAdmin }}
        triage={{ settings: triage, runs: (runs ?? []) as TriageRun[], hasKey: !!process.env.ANTHROPIC_API_KEY }}
        today={today}
        openId={typeof sp.natjecaj === "string" ? sp.natjecaj : null}
      />
    </>
  );
}
