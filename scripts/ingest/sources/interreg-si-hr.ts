import * as cheerio from "cheerio";
import type { RawCall, SourceAdapter } from "../types";
import { httpGet } from "../util";

/* ------------------------------------------------------------------ */
/*  Interreg Slovenija–Hrvatska 2021.–2027. (si-hr.eu).                 */
/*  Program se vodi pod putanjom /2127/; HR stranica "Otvoreni poziv"   */
/*  (call-for-projects) je rubrika s javnim pozivima. Program ima dva   */
/*  stalna otvorena poziva: Standardni projekti i Mali projekti,        */
/*  prikazani kao "content box" kartice (Avada/Fusion tema).            */
/*  Rok/datum nisu na listi (nalaze se u razpisnoj dokumentaciji/PDF),  */
/*  pa ostaju null → status se izvodi iz roka (otvoren).                */
/* ------------------------------------------------------------------ */

const ORIGIN = "https://www.si-hr.eu";
// HR rubrika s javnim pozivima (dvojezičan sajt: koristimo /hr/).
const LIST = `${ORIGIN}/2127/hr/call-for-projects/`;

/** Apsolutiziraj href i forsiraj https. */
function absUrl(href: string): string | null {
  const h = href.trim();
  if (!h || h.startsWith("#") || h.startsWith("javascript:")) return null;
  try {
    const u = new URL(h, LIST);
    u.protocol = "https:";
    return u.toString();
  } catch {
    return null;
  }
}

/** Stabilni id = zadnji neprazni segment putanje. */
function lastSegment(url: string): string {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || url;
  } catch {
    return url.replace(/\/+$/, "").split("/").pop() || url;
  }
}

async function fetchCalls(): Promise<RawCall[]> {
  const res = await httpGet(LIST, { retries: 2 });
  if (!res.ok) throw new Error(`Interreg SI-HR HTTP ${res.status} za ${LIST}`);

  const $ = cheerio.load(await res.text());
  // Sadržaj je u <main>; fallback na <body> (npr. maintenance stranica).
  const $main = $("main");
  const scope = $main.length ? $main : $("body");
  const bySlug = new Map<string, RawCall>();

  const add = (href: string | undefined, naslov: string) => {
    const title = naslov.replace(/\s+/g, " ").trim();
    const url = href ? absUrl(href) : null;
    if (!title || !url) return;
    const externalId = lastSegment(url);
    if (bySlug.has(externalId)) return;
    bySlug.set(externalId, {
      externalId,
      naslov: title,
      url,
      status: undefined, // lista nema status → izvodi se iz roka
      datumObjave: null,
      rokPrijave: null, // rok je u razpisnoj dokumentaciji (PDF), nije na listi
    });
  };

  // Primarno: "content box" kartice poziva (Avada/Fusion).
  $("a.fusion-column-anchor", scope).each((_, el) => {
    const $a = $(el);
    const col = $a.closest(".fusion-layout-column");
    const naslov = col.find(".content-box-heading").first().text();
    add($a.attr("href"), naslov);
  });

  // Fallback: ako tema/markup promijeni, pokupi poveznice iz sadržaja
  // koje vode na pod-stranice poziva (regular/small-scale projects i sl.).
  if (bySlug.size === 0) {
    const content = scope.find(".post-content").length
      ? scope.find(".post-content")
      : scope;
    content.find("a[href]").each((_, el) => {
      const $a = $(el);
      const href = $a.attr("href") || "";
      // samo pod-stranice unutar programa /2127/, bez navigacije/autora/preuzimanja
      if (!/\/2127\//.test(href)) return;
      if (/\/(author|download|category|tag|page)\//i.test(href)) return;
      if (/\.(pdf|docx?|pptx?|xlsx?|zip)(\?|$)/i.test(href)) return;
      if (/call-for-projects\/?$/i.test(href)) return; // sama rubrika
      const naslov = $a.text() || $a.attr("title") || "";
      if (naslov.replace(/\s+/g, " ").trim().length < 4) return;
      add(href, naslov);
    });
  }

  return [...bySlug.values()];
}

export const interregSiHr: SourceAdapter = {
  slug: "interreg-si-hr",
  naziv: "Interreg SI-HR",
  url: LIST,
  tip: "HTML",
  prioritet: "jezgra",
  egress: "hr", // dvojezični HR/SLO portal — HR/EU IP (Vercel fra1)
  defaults: {
    level: "eu",
    davatelj: "Interreg SI-HR",
    program: "Interreg Slovenija–Hrvatska 2021.–2027.",
  },
  fetchCalls,
};
