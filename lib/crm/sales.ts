import { addDays, weekStart } from "./dates";
import type { MetricKey } from "./options";

/** Događaj iz crm_sales_events (lead, poziv, ponuda, prodaja, tjedni unos). */
export type SalesEvent = {
  kind: string;
  member: string | null;
  at: string;
  iznos: number | null;
  ref: string | null;
  label: string | null;
  meta: Record<string, unknown> | null;
};

export type Detail = { label: string; href: string | null; iznos: number | null; id?: string; createdBy?: string | null; sale?: boolean };
export type Cell = Record<MetricKey, number> & { details: Partial<Record<MetricKey, Detail[]>>; manual: boolean };

const COUNT_KIND: Partial<Record<string, MetricKey>> = {
  lead_novi: "novi",
  lead_preuzet: "preuzeti",
  lead_donesen: "doneseni",
  lead_upitnik: "upitnik",
  poziv: "pozivi",
  ponuda_poslana: "ponude_poslane",
  ponuda_ugovorena: "ponude_ugovorene",
};
const OVERRIDABLE: [MetricKey, string][] = [
  ["preuzeti", "preuzeti"],
  ["doneseni", "doneseni"],
  ["pozivi", "pozivi"],
  ["ponude_poslane", "ponude_poslane"],
  ["ponude_ugovorene", "ponude_ugovorene"],
];

export function emptyCell(): Cell {
  return { preuzeti: 0, doneseni: 0, novi: 0, upitnik: 0, pozivi: 0, ponude_poslane: 0, ponude_ugovorene: 0, ugovoreno: 0, stara: 0, total: 0, details: {}, manual: false };
}

function hrefFor(e: SalesEvent): string | null {
  const m = (e.meta ?? {}) as Record<string, string | null>;
  if (e.kind.startsWith("lead_")) return e.ref ? `/crm/leadovi?lead=${e.ref}` : null;
  if (e.kind === "poziv") return m.lead_id ? `/crm/leadovi?lead=${m.lead_id}` : m.jls_profile_id ? `/crm/klijenti/${m.jls_profile_id}` : null;
  if (e.kind.startsWith("ponuda_")) return e.ref ? `/crm/ponude/${e.ref}` : null;
  if (e.kind === "ugovoreno" || e.kind === "stara") return m.offer_id ? `/crm/ponude/${m.offer_id}` : m.jls_profile_id ? `/crm/klijenti/${m.jls_profile_id}` : null;
  return null;
}

/** Tjedan (ponedjeljak) pripada mjesecu svog četvrtka. */
export function weekMonth(ws: string): string {
  return addDays(ws, 3).slice(0, 7);
}

/**
 * Pokazatelji po (članu, tjednu). Ključ člana "" = bez vlasnika. Tjedni unos zamjenjuje brojače za taj tjedan i člana.
 */
export function byMemberWeek(events: SalesEvent[]): Map<string, Map<string, Cell>> {
  const out = new Map<string, Map<string, Cell>>();
  const cell = (member: string | null, ws: string) => {
    const k = member ?? "";
    if (!out.has(k)) out.set(k, new Map());
    const m = out.get(k)!;
    if (!m.has(ws)) m.set(ws, emptyCell());
    return m.get(ws)!;
  };
  const push = (c: Cell, key: MetricKey, d: Detail) => {
    (c.details[key] ??= []).push(d);
  };
  for (const e of events) {
    if (e.kind === "tjedni") continue;
    const ws = weekStart(e.at);
    const c = cell(e.member, ws);
    const metric = COUNT_KIND[e.kind];
    if (metric) {
      c[metric] += 1;
      push(c, metric, { label: e.label ?? "", href: hrefFor(e), iznos: e.iznos });
    } else if (e.kind === "ugovoreno" || e.kind === "stara") {
      const key: MetricKey = e.kind;
      c[key] += Number(e.iznos ?? 0);
      push(c, key, {
        label: e.label ?? "",
        href: hrefFor(e),
        iznos: Number(e.iznos ?? 0),
        id: e.ref ?? undefined,
        createdBy: (e.meta?.created_by as string | null) ?? null,
        sale: true,
      });
    }
  }
  for (const e of events) {
    if (e.kind !== "tjedni" || !e.member) continue;
    const w = (e.meta ?? {}) as Record<string, number | string | null>;
    const c = cell(e.member, e.at);
    c.manual = true;
    for (const [key, col] of OVERRIDABLE) {
      if (w[col] != null) {
        c[key] = Number(w[col]);
        c.details[key] = [{ label: "Tjedni unos (zamjenjuje brojač iz CRM-a)", href: null, iznos: null }];
      }
    }
    if (w.stara_provedba != null) {
      c.stara += Number(w.stara_provedba);
      push(c, "stara", { label: `Tjedni unos${w.napomena ? `: ${w.napomena}` : ""}`, href: null, iznos: Number(w.stara_provedba) });
    }
  }
  for (const m of out.values()) for (const c of m.values()) c.total = c.ugovoreno + c.stara;
  return out;
}

/** Zbroj ćelija (za mjesece, ukupno, tim). */
export function sumCells(cells: (Cell | undefined)[]): Cell {
  const s = emptyCell();
  for (const c of cells) {
    if (!c) continue;
    for (const k of Object.keys(s) as (keyof Cell)[]) {
      if (k === "details" || k === "manual") continue;
      (s[k] as number) += c[k] as number;
    }
    for (const [k, list] of Object.entries(c.details)) (s.details[k as MetricKey] ??= []).push(...(list ?? []));
    s.manual ||= c.manual;
  }
  return s;
}

/** Zadnjih n tjedana (ponedjeljci), najstariji prvi. */
export function lastWeeks(today: string, n: number): string[] {
  const cur = weekStart(today);
  return Array.from({ length: n }, (_, i) => addDays(cur, -7 * (n - 1 - i)));
}

/** Tjedni (ponedjeljci) koji pripadaju mjesecu (po četvrtku). */
export function weeksOfMonth(month: string): string[] {
  const first = `${month}-01`;
  let ws = weekStart(first);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    if (weekMonth(ws) === month) out.push(ws);
    ws = addDays(ws, 7);
  }
  return out;
}

export function isoWeekNo(ws: string): number {
  const d = new Date(`${addDays(ws, 3)}T12:00:00Z`);
  const y = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(y, 0, 4, 12));
  const w1 = new Date(jan4);
  w1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  return 1 + Math.round((d.getTime() - w1.getTime()) / (7 * 86400000));
}

export const eurFmt = new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
