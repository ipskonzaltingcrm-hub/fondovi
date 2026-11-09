import * as cheerio from "cheerio";
import type { CallStatus, RawCall, SourceAdapter } from "../types";
import { httpGet, shortHash } from "../util";

/* ------------------------------------------------------------------ */
/*  HAMAG-BICRO — Hrvatska agencija za malo gospodarstvo, inovacije i   */
/*  investicije. Stranica "Otvoreni natječaji" (WordPress/ffb tema).    */
/*  Svaka stavka (article.news-v1) ima kategoriju, naslov+link i datum  */
/*  objave (hrvatski naziv mjeseca, npr. "3. rujna 2026."). Status nije */
/*  eksplicitan — lista su OTVORENI natječaji, pa je status "otvoren"   */
/*  (iznimka: "najava ..." → "najava"). Rok prijave nije u listi.       */
/*  Dio linkova vodi na eufondovi.gov.hr (/poziv/?id=...) — ti dijele   */
/*  isti zadnji segment pa se externalId dopunjava shortHash-om URL-a.  */
/* ------------------------------------------------------------------ */

const BASE = "https://hamagbicro.hr/otvoreni-natjecaji/";
const MAX_PAGES = 6;

// Hrvatski nazivi mjeseci (genitiv) → broj mjeseca.
const MJESECI: Record<string, string> = {
  siječnja: "01", sijecnja: "01",
  veljače: "02", veljace: "02",
  ožujka: "03", ozujka: "03",
  travnja: "04",
  svibnja: "05",
  lipnja: "06",
  srpnja: "07",
  kolovoza: "08",
  rujna: "09",
  listopada: "10",
  studenoga: "11", studenog: "11",
  prosinca: "12",
};

/** "3. rujna 2026." → "2026-09-03" (ili null ako ne prepozna). */
function parseCroDate(text: string): string | null {
  const m = text
    .trim()
    .toLowerCase()
    .match(/(\d{1,2})\.\s*([a-zčćžšđ]+)\s*(\d{4})/i);
  if (!m) return null;
  const mm = MJESECI[m[2]];
  if (!mm) return null;
  return `${m[3]}-${mm}-${m[1].padStart(2, "0")}`;
}

/** Lista je "otvoreni natječaji"; najavu prepoznaj iz naslova. */
function mapStatus(naslov: string): CallStatus {
  return /\bnajav/i.test(naslov) ? "najava" : "otvoren";
}

function parsePage(html: string): RawCall[] {
  const $ = cheerio.load(html);
  const out: RawCall[] = [];

  $("article.news-v1").each((_, el) => {
    const $el = $(el);
    const a = $el.find("h3.news-v1-heading-title a").first();
    const naslov = a.text().trim();
    const href = a.attr("href")?.trim();
    if (!naslov || !href) return;

    // Očisti URL (makni #new_tab fragment theme-a).
    const url = href.split("#")[0];

    // Zadnji segment putanje; eufondovi.gov.hr dijeli segment "poziv".
    let seg = "";
    try {
      const path = new URL(url).pathname.replace(/\/+$/, "");
      seg = path.split("/").pop() || "";
    } catch {
      seg = url.replace(/\/+$/, "").split("/").pop() || "";
    }

    const datumObjave = parseCroDate($el.find(".ffb-date-5-1").first().text());

    out.push({
      externalId: seg || null, // privremeno; dedup + hash u fetchCalls
      naslov,
      url,
      status: mapStatus(naslov),
      datumObjave,
      rokPrijave: null, // nije u listi (u dokumentaciji poziva)
    });
  });

  return out;
}

async function fetchCalls(): Promise<RawCall[]> {
  const raws: RawCall[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? BASE : `${BASE}page/${page}/`;
    const res = await httpGet(url);
    if (!res.ok) {
      if (page === 1) throw new Error(`HAMAG-BICRO HTTP ${res.status} za ${url}`);
      break; // nema više stranica
    }
    const items = parsePage(await res.text());
    if (items.length === 0) break;
    raws.push(...items);
    await new Promise((r) => setTimeout(r, 400)); // pristojna pauza
  }

  // Jedinstven externalId: ako zadnji segment nije jedinstven (npr. "poziv"
  // za eufondovi.gov.hr) ili ga nema → dopuni shortHash-om URL-a.
  const freq = new Map<string, number>();
  for (const r of raws) {
    const seg = r.externalId || "";
    freq.set(seg, (freq.get(seg) || 0) + 1);
  }

  const bySlug = new Map<string, RawCall>();
  for (const r of raws) {
    const seg = r.externalId || "";
    const externalId = !seg || (freq.get(seg) || 0) > 1 ? `${seg}-${shortHash(r.url)}` : seg;
    bySlug.set(externalId, { ...r, externalId });
  }

  return [...bySlug.values()];
}

export const hamagbicro: SourceAdapter = {
  slug: "hamagbicro",
  naziv: "HAMAG-BICRO",
  url: BASE,
  tip: "HTML",
  prioritet: "jezgra",
  egress: "hr", // HR portal — vrti se na Vercelu (fra1)
  defaults: {
    level: "nacionalna",
    davatelj: "HAMAG-BICRO",
    program: "",
  },
  fetchCalls,
};
