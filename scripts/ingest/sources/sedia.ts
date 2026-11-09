import type { CallStatus, RawCall, SourceAdapter } from "../types";

/* ------------------------------------------------------------------ */
/*  EU Funding & Tenders (SEDIA) — javni JSON search API.              */
/*  Filtrirano na JLS-relevantno (lokalne vlasti/gradovi/regije) da     */
/*  se ne zatrpa baza EU istraživačkim pozivima.                        */
/* ------------------------------------------------------------------ */

const API = "https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA";
// Suzi na pozive relevantne za jedinice lokalne/regionalne samouprave.
const TEXT = '"local authorities" OR municipalities OR cities OR "local government"';
const PAGE_SIZE = 100;
const MAX_PAGES = 4;

// status šifre → naš enum
const STATUS: Record<string, CallStatus> = {
  "31094501": "najava", // Forthcoming
  "31094502": "otvoren", // Open
  "31094503": "zatvoren", // Closed
};

type Link = { startDate?: string; endDate?: string; url?: string };

function first<T>(a: T[] | undefined): T | undefined {
  return a && a.length ? a[0] : undefined;
}

function parseLinks(raw: string[] | undefined): Link[] {
  if (!raw) return [];
  const out: Link[] = [];
  for (const s of raw) {
    try {
      const v = JSON.parse(s);
      if (Array.isArray(v)) out.push(...v);
      else out.push(v);
    } catch {
      /* ignoriraj nevaljan link */
    }
  }
  return out;
}

function epochToDate(ms?: string): string | null {
  const n = Number(ms);
  if (!ms || !Number.isFinite(n) || n <= 0) return null;
  return new Date(n).toISOString().slice(0, 10);
}

async function fetchPage(page: number): Promise<any[]> {
  const url = `${API}&text=${encodeURIComponent(TEXT)}&pageSize=${PAGE_SIZE}&pageNumber=${page}`;
  const query = {
    bool: {
      must: [
        { terms: { type: ["1"] } }, // 1 = grants (pozivi)
        { terms: { status: ["31094501", "31094502"] } }, // forthcoming + open
      ],
    },
  };
  const form = new FormData();
  // NAPOMENA: NE dodavati 'languages' part — ruši API u HTTP 500.
  form.append("query", new Blob([JSON.stringify(query)], { type: "application/json" }));

  // 'connection: close' sprječava undici assert kod ponovne upotrebe veze (SEDIA zatvara keep-alive).
  const res = await fetch(url, {
    method: "POST",
    body: form,
    headers: { connection: "close" },
  });
  if (!res.ok) throw new Error(`SEDIA HTTP ${res.status}`);
  const j: any = await res.json();
  return (j.results as any[]) || [];
}

async function fetchCalls(): Promise<RawCall[]> {
  // Dedupe po callIdentifier; naslov preferiraj na engleskom.
  const byId = new Map<string, RawCall & { _lang?: string }>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const results = await fetchPage(page);
    if (results.length === 0) break;

    for (const r of results) {
      const m = r.metadata || {};
      const id = first<string>(m.callIdentifier);
      if (!id) continue;

      const lang = first<string>(m.language);
      const title = first<string>(m.callTitle) || r.summary || id;
      const existing = byId.get(id);

      if (existing) {
        // ako stigne engleska verzija, uzmi ljepši naslov
        if (lang === "en" && existing._lang !== "en") {
          existing.naslov = title;
          existing._lang = "en";
        }
        continue;
      }

      const links = parseLinks(m.links);
      const starts = links.map((l) => Number(l.startDate)).filter((n) => n > 0);
      const ends = links.map((l) => Number(l.endDate)).filter((n) => n > 0);
      const status = STATUS[first<string>(m.status) || ""] ?? undefined;

      byId.set(id, {
        externalId: id,
        naslov: title,
        url: `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${id}`,
        status,
        datumObjave: starts.length ? epochToDate(String(Math.min(...starts))) : null,
        rokPrijave: ends.length ? epochToDate(String(Math.max(...ends))) : null,
        _lang: lang,
      });
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  // makni internu oznaku jezika
  return [...byId.values()].map(({ _lang, ...rest }) => rest);
}

export const sedia: SourceAdapter = {
  slug: "eu-funding-tenders",
  naziv: "EU Funding & Tenders (SEDIA)",
  url: "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-search",
  tip: "API",
  prioritet: "jezgra",
  egress: "global", // globalni EU API — GitHub Actions ga doseže
  defaults: {
    level: "eu",
    davatelj: "Europska komisija",
    program: "EU Funding & Tenders",
  },
  fetchCalls,
};
