import * as cheerio from "cheerio";
import type { CallStatus, RawCall, SourceAdapter } from "../types";
import { httpGet, shortHash } from "../util";

/* ------------------------------------------------------------------ */
/*  esf.hr — ULJP / ESF+ (Učinkoviti ljudski potencijali).             */
/*  Statični WordPress HTML; svaka stavka je <article.post-listing>     */
/*  s naslovom, linkom, sažetkom i oznakom stanja (.meta-state).        */
/*  Rok NIJE u zasebnom polju nego u sažetku: "Status: otvoren od       */
/*  <datumObjave> do <rokPrijave> …" — "do" je rok prijave.             */
/* ------------------------------------------------------------------ */

const LIST = "https://www.esf.hr/natjecaji/";

function mapStatus(text: string): CallStatus | undefined {
  const t = text.toLowerCase();
  if (t.includes("otvoren")) return "otvoren";
  if (t.includes("zatvoren")) return "zatvoren";
  return undefined; // pusti da se izvede iz roka
}

// Iz sažetka izvuci period: "… otvoren od <od> do <do> …"
function parsePeriod(summary: string): { od: string | null; rok: string | null } {
  const DATE = "\\d{1,2}\\s*\\.\\s*\\d{1,2}\\s*\\.\\s*\\d{4}";
  const m = summary.match(
    new RegExp(`od\\s+(${DATE})\\.?\\s+do\\s+(${DATE})`, "i"),
  );
  if (!m) return { od: null, rok: null };
  return { od: m[1].trim(), rok: m[2].trim() };
}

async function fetchCalls(): Promise<RawCall[]> {
  const res = await httpGet(LIST);
  if (!res.ok) throw new Error(`esf.hr HTTP ${res.status}`);
  const $ = cheerio.load(await res.text());
  const bySlug = new Map<string, RawCall>();

  $("article.post-listing").each((_, el) => {
    const $el = $(el);
    const a = $el.find("h3.title a").first();
    const naslov = a.text().trim();
    const url = a.attr("href")?.trim();
    if (!naslov || !url) return;

    // stabilni + JEDINSTVEN id: segment skraćen + hash URL-a (spriječi koliziju
    // slug-a kod vrlo dugih, sličnih naslova).
    const seg = url.replace(/\/+$/, "").split("/").pop() || naslov;
    const externalId = `${seg.slice(0, 48)}-${shortHash(url)}`;

    const status = mapStatus($el.find(".meta-state").first().text());

    const summary = $el.find(".summary").text();
    const { od, rok } = parsePeriod(summary);

    bySlug.set(externalId, {
      externalId,
      naslov,
      url,
      status,
      datumObjave: od,
      rokPrijave: rok,
    });
  });

  return [...bySlug.values()];
}

export const esf: SourceAdapter = {
  slug: "esf",
  naziv: "esf.hr — ULJP / ESF+",
  url: LIST,
  tip: "HTML",
  prioritet: "jezgra",
  egress: "hr", // HR portal — geoblokira strane IP-eve → Vercel (fra1)
  defaults: {
    level: "nacionalna",
    davatelj: "esf.hr / ESF+",
    program: "Učinkoviti ljudski potencijali (ESF+)",
  },
  fetchCalls,
};
