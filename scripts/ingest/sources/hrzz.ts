import * as cheerio from "cheerio";
import type { RawCall, SourceAdapter } from "../types";
import { httpGet, shortHash } from "../util";

/* ------------------------------------------------------------------ */
/*  HRZZ — Hrvatska zaklada za znanost. Stranica "Otvoreni natječaji"  */
/*  (statični HTML). Pozivi su ElementsKit accordion kartice: naslov   */
/*  togglera je kratka šifra natječaja (npr. "IPDE-2026-12"), a puni   */
/*  opis + datumi su u tijelu kartice (ugniježđeni Elementor sadržaj). */
/*  Nema zasebnih URL-ova po pozivu → url = stranica + sidro togglera  */
/*  (#collapse-…, stabilno između zahtjeva). Nema eksplicitnog statusa */
/*  po stavci (sve su na stranici otvorenih) → status se izvodi iz roka */
/*  u toCallRow. Datumi su u HR dugom obliku ("20. listopada 2026") pa  */
/*  ih parsiramo ovdje (util.parseDate ne zna hrvatske nazive mjeseci). */
/* ------------------------------------------------------------------ */

const LIST = "https://hrzz.hr/prijava/otvoreni-natjecaji/";

const HR_MONTHS: Record<string, number> = {
  siječnja: 1, veljače: 2, ožujka: 3, travnja: 4, svibnja: 5, lipnja: 6,
  srpnja: 7, kolovoza: 8, rujna: 9, listopada: 10, studenog: 11,
  studenoga: 11, prosinca: 12,
};

// Datum u HR dugom ("20. listopada 2026") ili numeričkom ("20. 10. 2026") obliku.
const MONTH_ALT = Object.keys(HR_MONTHS).join("|");
const DATE_PAT = `\\d{1,2}\\.\\s*(?:${MONTH_ALT}|\\d{1,2}\\.)\\s*\\d{4}`;

const pad = (n: number) => String(n).padStart(2, "0");

/** "20. listopada 2026" | "20. 10. 2026" → "YYYY-MM-DD" ili null. */
function hrDateToIso(raw: string): string | null {
  const named = raw.match(
    new RegExp(`(\\d{1,2})\\.\\s*(${MONTH_ALT})\\s*(\\d{4})`, "i"),
  );
  if (named) {
    const m = HR_MONTHS[named[2].toLowerCase()];
    if (m) return `${named[3]}-${pad(m)}-${pad(Number(named[1]))}`;
  }
  const num = raw.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (num) return `${num[3]}-${pad(Number(num[2]))}-${pad(Number(num[1]))}`;
  return null;
}

/** Nađi prvi datum koji slijedi zadanu oznaku (unutar ~40 znakova). */
function labeledDate(text: string, label: string): string | null {
  const m = text.match(new RegExp(`(?:${label})[^0-9]{0,40}?(${DATE_PAT})`, "i"));
  return m ? hrDateToIso(m[1]) : null;
}

/** Puni opisni naslov iz tijela kartice (uvijek sadrži šifru natječaja). */
function extractTitle(
  $: cheerio.CheerioAPI,
  body: ReturnType<cheerio.CheerioAPI>,
  code: string,
): string {
  const codeBase = (code.split("-")[0] || code).toLowerCase();
  const has = (t: string) => t.toLowerCase().includes(codeBase);
  const clean = (t: string) => t.replace(/\s+/g, " ").trim();
  const collect = (sel: string, min: number, max: number) =>
    body
      .find(sel)
      .map((_, x) => clean($(x).text()))
      .get()
      .filter((t) => t.length >= min && t.length <= max);

  const headings = collect("h1,h2,h3,h4,h5,h6", 10, 180);
  const shortPs = collect("p", 12, 120).filter(
    (t) => !t.endsWith(":") && !/\.pdf|\.docx/i.test(t) && !/^[–-]/.test(t),
  );
  const strongs = collect("strong,b", 12, 180).filter((t) => !t.endsWith(":"));

  return (
    headings.find(has) ??
    shortPs.find(has) ??
    strongs.find(has) ??
    headings[0] ??
    strongs[0] ??
    code
  );
}

async function fetchCalls(): Promise<RawCall[]> {
  const res = await httpGet(LIST);
  if (!res.ok) throw new Error(`HRZZ HTTP ${res.status}`);
  const $ = cheerio.load(await res.text());
  const bySlug = new Map<string, RawCall>();

  $(".elementskit-card").each((_, el) => {
    const $el = $(el);
    const code = $el.find(".ekit-accordion-title").first().text().trim();
    const body = $el.find(".elementskit-card-body").first();
    if (!body.length) return;

    const naslov = extractTitle($, body, code || "");
    if (!naslov) return;

    // Nema zasebnog URL-a po pozivu → stranica + sidro togglera (#collapse-…).
    const anchor = $el.find("a.ekit-accordion--toggler").first().attr("href") || "";
    const url = anchor.startsWith("#") ? `${LIST}${anchor}` : LIST;

    // Stabilan + jedinstven id: šifra natječaja (npr. "IPDE-2026-12");
    // ako je nema, skraćeni hash URL-a.
    const externalId = code || shortHash(url);

    // Datumi iz slobodnog teksta (label-anchored, konzervativno).
    const txt = body.text().replace(/\s+/g, " ").trim();
    const datumObjave =
      labeledDate(txt, "datum raspisivanja natječaja|otvaranje natječaja|raspisan|objavilo je") ??
      null;
    const rokPrijave =
      labeledDate(txt, "rok za (?:podnošenje|predaju|prijavu)|mora se podnijeti do|rok prijave") ??
      null;

    bySlug.set(externalId, {
      externalId,
      naslov,
      url,
      status: undefined, // nema eksplicitne oznake po stavci → izvedi iz roka
      datumObjave,
      rokPrijave,
    });
  });

  return [...bySlug.values()];
}

export const hrzz: SourceAdapter = {
  slug: "hrzz",
  naziv: "Hrvatska zaklada za znanost (HRZZ)",
  url: LIST,
  tip: "HTML",
  prioritet: "jezgra",
  egress: "hr", // HR portal — vrti se na Vercelu (fra1)
  defaults: {
    level: "nacionalna",
    davatelj: "Hrvatska zaklada za znanost (HRZZ)",
    program: "Znanstveno-istraživački projekti",
  },
  fetchCalls,
};
