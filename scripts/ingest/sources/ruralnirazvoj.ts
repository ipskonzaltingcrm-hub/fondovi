import * as cheerio from "cheerio";
import type { CallStatus, RawCall, SourceAdapter } from "../types";
import { httpGet } from "../util";

/* ------------------------------------------------------------------ */
/*  ruralnirazvoj.hr — Strateški plan ZPP 2023.–2027. (APPRRR).         */
/*  Statični HTML; svaka stavka ima naslov, link, status, datum         */
/*  otvaranja i eksplicitan rok ("Kraj prijave").                       */
/* ------------------------------------------------------------------ */

const BASE = "https://ruralnirazvoj.hr/natjecaji/";
const MAX_PAGES = 6; // 12 stavki/str → do ~72 najnovijih poziva

function mapStatus(cls: string, text: string): CallStatus | undefined {
  const c = (cls + " " + text).toLowerCase();
  if (c.includes("opened") || c.includes("otvoren")) return "otvoren";
  if (c.includes("closed") || c.includes("zatvoren")) return "zatvoren";
  return undefined; // pusti da se izvede iz roka
}

function parsePage(html: string): RawCall[] {
  const $ = cheerio.load(html);
  const out: RawCall[] = [];

  $("article.tender__item").each((_, el) => {
    const $el = $(el);
    const a = $el.find("h2.tender-title a").first();
    const naslov = a.text().trim();
    const url = a.attr("href")?.trim();
    if (!naslov || !url) return;

    // stabilni id = zadnji segment putanje
    const externalId =
      url.replace(/\/+$/, "").split("/").pop() || naslov;

    const btn = $el.find("span.btn").first();
    const status = mapStatus(btn.attr("class") || "", btn.text());

    let datumObjave: string | null = null;
    let rokPrijave: string | null = null;
    $el.find(".tender-date").each((__, d) => {
      const $d = $(d);
      const label = $d.find("strong").text().toLowerCase();
      // tekst bez <strong> labela
      const val = $d.clone().children().remove().end().text().trim();
      if (label.includes("datum prijave")) datumObjave = val;
      else if (label.includes("kraj prijave")) rokPrijave = val;
    });

    out.push({ externalId, naslov, url, status, datumObjave, rokPrijave });
  });

  return out;
}

async function fetchCalls(): Promise<RawCall[]> {
  const bySlug = new Map<string, RawCall>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? BASE : `${BASE}?tab=spzpp&page_spzpp=${page}`;
    const res = await httpGet(url);
    if (!res.ok) {
      if (page === 1) throw new Error(`HTTP ${res.status} za ${url}`);
      break; // nema više stranica
    }
    const items = parsePage(await res.text());
    if (items.length === 0) break;
    for (const it of items) bySlug.set(it.externalId || it.url, it);
    // pristojna pauza između zahtjeva
    await new Promise((r) => setTimeout(r, 400));
  }

  return [...bySlug.values()];
}

export const ruralnirazvoj: SourceAdapter = {
  slug: "ruralnirazvoj",
  naziv: "ruralnirazvoj.hr / APPRRR",
  url: BASE,
  tip: "HTML",
  prioritet: "jezgra",
  egress: "hr", // HR portal — geoblokira strane IP-eve → vrti se na Vercelu (fra1)
  defaults: {
    level: "nacionalna",
    davatelj: "APPRRR / Ministarstvo poljoprivrede",
    program: "Strateški plan ZPP 2023.–2027.",
    sektori: ["Poljoprivreda i ruralni razvoj"],
  },
  fetchCalls,
};
