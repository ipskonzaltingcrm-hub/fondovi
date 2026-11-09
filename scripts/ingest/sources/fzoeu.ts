import * as cheerio from "cheerio";
import type { CallStatus, RawCall, SourceAdapter } from "../types";
import { httpGet } from "../util";

/* ------------------------------------------------------------------ */
/*  FZOEU — nacionalni javni pozivi i natječaji.                        */
/*  Akordeon lista; svaka stavka ima status, naslov, datum "Otvoren:"   */
/*  i link na detalj (nid). NAPOMENA: rok prijave NIJE u listi (u PDF-u  */
/*  poziva), pa ostaje prazan — status/datum objave ipak dohvaćamo.     */
/* ------------------------------------------------------------------ */

const LIST = "https://www.fzoeu.hr/hr/nacionalni-javni-pozivi-i-natjecaji/1367";
const ORIGIN = "https://www.fzoeu.hr";

function mapStatus(text: string): CallStatus | undefined {
  const t = text.toLowerCase();
  if (t.includes("najav")) return "najava";
  if (t.includes("zatvoren")) return "zatvoren"; // uklj. "privremeno zatvoren"
  if (t.includes("otvoren")) return "otvoren";
  return undefined;
}

async function fetchCalls(): Promise<RawCall[]> {
  const res = await httpGet(LIST);
  if (!res.ok) throw new Error(`FZOEU HTTP ${res.status}`);
  const $ = cheerio.load(await res.text());
  const out: RawCall[] = [];

  $("li.accordion-header-natjecaji").each((_, el) => {
    const $h = $(el);
    const statusText = $h.find("[class*='status'] span").first().text();
    const naslov = $h.find("> div > div:not([class])").first().text().trim();
    if (!naslov) return;

    // Skriveni dio (sljedeći <li>) nosi datum + link na detalj (nid).
    const $body = $h.next("li.accordion-hidden");
    const href = $body.find("a[href*='natjecaj/']").attr("href") || "";
    const nid = href.match(/nid=(\d+)/)?.[1];
    if (!nid) return;

    // "Otvoren: <strong>05.11.2026.</strong>"
    const datumObjave = $body.find("strong").first().text().trim() || null;

    out.push({
      externalId: nid,
      naslov,
      url: `${ORIGIN}${href}`,
      status: mapStatus(statusText),
      datumObjave,
      rokPrijave: null, // nije u listi (u PDF-u poziva)
    });
  });

  return out;
}

export const fzoeu: SourceAdapter = {
  slug: "fzoeu",
  naziv: "FZOEU — nacionalni javni pozivi",
  url: LIST,
  tip: "HTML",
  prioritet: "jezgra",
  egress: "hr", // HR portal — geoblokira strane IP-eve → Vercel (fra1)
  defaults: {
    level: "nacionalna",
    davatelj: "Fond za zaštitu okoliša i energetsku učinkovitost (FZOEU)",
    program: "Nacionalni javni pozivi i natječaji",
  },
  fetchCalls,
};
