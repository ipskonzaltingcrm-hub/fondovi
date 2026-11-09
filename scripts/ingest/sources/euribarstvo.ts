import * as cheerio from "cheerio";
import type { CallStatus, RawCall, SourceAdapter } from "../types";
import { httpGet, shortHash } from "../util";

/* ------------------------------------------------------------------ */
/*  euribarstvo.hr — EFPRA (Europski fond za pomorstvo, ribarstvo i     */
/*  akvakulturu). Statična HTML lista pravilnika i natječaja.           */
/*  Svaka stavka (div.natjecaji-post) ima naslov+link (h4 a), status    */
/*  ("Otvoren natječaj" / "Natječaj zatvoren") te datum otvaranja i     */
/*  zatvaranja za prijavu. Otvoreni pravilnici se na vrhu ponavljaju    */
/*  pa dedupliciramo po externalId (zadnji segment URL-a).              */
/* ------------------------------------------------------------------ */

const LIST = "https://euribarstvo.hr/pravilnici-i-natjecaji/";

function mapStatus(text: string): CallStatus | undefined {
  const t = text.toLowerCase();
  if (t.includes("zatvoren")) return "zatvoren";
  if (t.includes("otvoren")) return "otvoren";
  return undefined; // pusti da se izvede iz roka
}

/** "Datum otvaranja za prijavu: 05.09.2024" → "05.09.2024" */
function dateValue(text: string): string | null {
  const idx = text.indexOf(":");
  const val = (idx >= 0 ? text.slice(idx + 1) : text).trim();
  return val || null;
}

async function fetchCalls(): Promise<RawCall[]> {
  const res = await httpGet(LIST);
  if (!res.ok) throw new Error(`euribarstvo HTTP ${res.status}`);
  const $ = cheerio.load(await res.text());
  const bySlug = new Map<string, RawCall>();

  $("div.natjecaji-post").each((_, el) => {
    const $el = $(el);
    const a = $el.find("h4 a").first();
    const naslov = a.text().trim();
    const url = a.attr("href")?.trim();
    if (!naslov || !url) return;

    // stabilni + JEDINSTVEN id: segment skraćen + hash URL-a (segmenti su dugi
    // i dijele prefiks → spriječi slug-koliziju).
    const seg = url.replace(/\/+$/, "").split("/").pop() || naslov;
    const externalId = `${seg.slice(0, 48)}-${shortHash(url)}`;

    const statusText = $el
      .find(".status-natjecaja .box > div:not(.date_title)")
      .first()
      .text();

    let datumObjave: string | null = null;
    let rokPrijave: string | null = null;
    $el.find(".date_title").each((__, d) => {
      const t = $(d).text();
      const low = t.toLowerCase();
      if (low.includes("otvaranja")) datumObjave = dateValue(t);
      else if (low.includes("zatvaranja")) rokPrijave = dateValue(t);
    });

    bySlug.set(externalId, {
      externalId,
      naslov,
      url,
      status: mapStatus(statusText),
      datumObjave,
      rokPrijave,
    });
  });

  return [...bySlug.values()];
}

export const euribarstvo: SourceAdapter = {
  slug: "euribarstvo",
  naziv: "euribarstvo.hr / EFPRA",
  url: LIST,
  tip: "HTML",
  prioritet: "dodatni",
  egress: "hr", // HR portal — vrti se na Vercelu (fra1)
  defaults: {
    level: "nacionalna",
    davatelj: "euribarstvo.hr / EFPRA",
    program:
      "Europski fond za pomorstvo, ribarstvo i akvakulturu (EFPRA)",
  },
  fetchCalls,
};
