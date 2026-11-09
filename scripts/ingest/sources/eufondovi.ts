import type { RawCall, SourceAdapter } from "../types";
import { httpGet } from "../util";

/* ------------------------------------------------------------------ */
/*  eufondovi.gov.hr — WordPress (REST API).                           */
/*  Pozivi su obični `post`-ovi izmiješani s vijestima, pa filtriramo  */
/*  po naslovu: zadržavamo samo postove koji jasno označavaju poziv    */
/*  ("poziv" / "natječaj"), a odbacujemo vijesti (dodjela ugovora,     */
/*  obavijesti, izmjene) ako naslov ne ukazuje na novi poziv.          */
/*  Rok prijave nije pouzdan u WP postu → ostaje null (status se       */
/*  izvede iz roka → "otvoren").                                       */
/* ------------------------------------------------------------------ */

const ORIGIN = "https://eufondovi.gov.hr";
const REST =
  `${ORIGIN}/wp-json/wp/v2/posts?per_page=50&_fields=id,date,link,title,excerpt`;

type WpPost = {
  id: number;
  date?: string;
  link?: string;
  title?: { rendered?: string };
  excerpt?: { rendered?: string };
};

/** Dekodiraj česte HTML entitete i skini HTML tagove. */
function cleanHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&#8217;|&#8216;|&#039;|&#39;/g, "'")
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&#8211;|&#8212;/g, "–")
    .replace(/&#8230;/g, "…")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

// Riječi koje označavaju vijest/popratnu objavu (ne novi poziv), čak i kad
// naslov sadrži "poziv" (npr. "...u okviru Poziva ...").
const VIJEST = [
  "obavijest",
  "izmjen", // izmjene / izmjena
  "dopun", // dopune / dopuna
  "odluka o", // odluka o financiranju / odluci
  "odluci",
  "rezultat",
  "odobren", // odobreni projekti (rezultati)
  "dodjel", // dodjela ugovora / bespovratnih sredstava (odluka)
  "potpis", // potpisivanje ugovora
  "radionic", // informativna radionica
  "webinar",
  "produljenj", // produljenje roka (izmjena)
  "pojašnjenj", // pojašnjenja / pitanja i odgovori
  "ispravak",
];

/** Naslov jasno označava NOVI poziv/natječaj (a ne popratnu vijest). */
function izgledaKaoPoziv(naslov: string): boolean {
  const t = naslov.toLowerCase();
  // Mora sadržavati ključnu riječ poziva/natječaja.
  if (!/\bpoziv\w*|\bnatječaj\w*|\bnatjecaj\w*/.test(t)) return false;
  // Odbaci popratne objave/vijesti koje spominju "poziv" samo usput.
  if (VIJEST.some((w) => t.includes(w))) return false;
  return true;
}

async function fetchCalls(): Promise<RawCall[]> {
  const res = await httpGet(REST, { retries: 2 });
  if (!res.ok) throw new Error(`eufondovi HTTP ${res.status}`);

  const posts = (await res.json()) as WpPost[];
  if (!Array.isArray(posts)) throw new Error("eufondovi: neočekivan JSON (nije niz)");

  const out: RawCall[] = [];
  for (const p of posts) {
    const naslov = cleanHtml(p.title?.rendered || "");
    if (!naslov) continue;
    if (!izgledaKaoPoziv(naslov)) continue;

    const url = (p.link || "").trim();
    if (!url) continue;

    const sazetak = p.excerpt?.rendered ? cleanHtml(p.excerpt.rendered) : null;

    out.push({
      externalId: String(p.id),
      naslov,
      url,
      datumObjave: p.date || null, // WP ISO datum; parseDate normalizira
      rokPrijave: null, // nije pouzdan u WP postu
      status: undefined, // neka se izvede iz roka → "otvoren"
      sazetak: sazetak || null,
    });
  }

  return out;
}

export const eufondovi: SourceAdapter = {
  slug: "eufondovi",
  naziv: "eufondovi.gov.hr — Pozivi",
  url: REST,
  tip: "API",
  prioritet: "jezgra",
  egress: "hr",
  defaults: {
    level: "nacionalna",
    davatelj: "eufondovi.gov.hr",
    program: "EU fondovi 2021.–2027.",
  },
  fetchCalls,
};
