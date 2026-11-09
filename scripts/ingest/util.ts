import { createHash } from "node:crypto";
import type { CallRow, CallStatus, RawCall, SourceAdapter } from "./types";
import { classifyApplicants, classifySektori } from "./classify";

/** Hrvatski-friendly slugify: č/ć→c, ž→z, đ→d, š→s, ostalo u a-z0-9 + crtice. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/č|ć/g, "c")
    .replace(/ž/g, "z")
    .replace(/đ/g, "d")
    .replace(/š/g, "s")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Parsiraj datum iz čestih HR/ISO formata → 'YYYY-MM-DD' ili null. */
export function parseDate(input?: string | null): string | null {
  if (!input) return null;
  const s = String(input).trim();
  // ISO (možda s vremenom)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // HR: dd.mm.yyyy. ili dd/mm/yyyy (toleriraj razmake: "13. 10. 2026")
  const hr = s.match(/(\d{1,2})\s*[.\/]\s*(\d{1,2})\s*[.\/]\s*(\d{4})/);
  if (hr) {
    const d = hr[1].padStart(2, "0");
    const m = hr[2].padStart(2, "0");
    return `${hr[3]}-${m}-${d}`;
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

/** Status iz roka ako adapter nije eksplicitno dao. */
export function statusFromDeadline(
  rok: string | null,
  datumObjave: string | null,
  today = new Date().toISOString().slice(0, 10),
): CallStatus {
  if (datumObjave && datumObjave > today) return "najava";
  if (rok && rok < today) return "zatvoren";
  return "otvoren";
}

const HASH_FIELDS: (keyof CallRow)[] = [
  "naslov",
  "davatelj",
  "program",
  "level",
  "status",
  "datum_objave",
  "rok_prijave",
  "iznos_min",
  "iznos_max",
  "ukupna_alokacija",
  "intenzitet",
  "prihvatljivi",
  "sektori",
  "sazetak",
  "url",
];

/** Kratki (6-znak) hash — za jedinstvene externalId-eve kad su URL-segmenti dugi/slični. */
export function shortHash(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 6);
}

export function contentHash(row: Omit<CallRow, "content_hash" | "source_id">): string {
  const payload = HASH_FIELDS.map((f) => JSON.stringify((row as never)[f] ?? null)).join("|");
  return createHash("sha1").update(payload).digest("hex");
}

/** RawCall + adapter → CallRow (bez source_id; dodaje se u run.ts). */
export function toCallRow(adapter: SourceAdapter, raw: RawCall): Omit<CallRow, "source_id"> {
  const merged: RawCall = { ...adapter.defaults, ...raw };
  const datum_objave = parseDate(merged.datumObjave);
  const rok_prijave = parseDate(merged.rokPrijave);
  const status = merged.status ?? statusFromDeadline(rok_prijave, datum_objave);
  // Slug = izvor + čitljivi ključ. NAPOMENA: slugify reže na 80 znakova, pa dva
  // poziva s gotovo identičnim dugim ključem teoretski mogu kolidirati (rijetko;
  // uočeno samo u esf arhivi). Shemu ne mijenjamo da ne razbijemo postojeće slugove.
  const slug = `${adapter.slug}-${slugify(merged.externalId || merged.naslov)}`;

  // Klasifikacija: sektori + prihvatljivi iz teksta (+ izvora). Adapter-zadane
  // vrijednosti imaju prednost; inače se izvode heuristički.
  const klasText = `${merged.naslov} ${merged.sazetak ?? ""} ${merged.program ?? ""}`;
  const sektori = [
    ...new Set([...(merged.sektori ?? []), ...classifySektori(klasText)]),
  ];
  const prihvatljivi =
    merged.prihvatljivi && merged.prihvatljivi.length
      ? merged.prihvatljivi
      : classifyApplicants(klasText, adapter.slug);

  const base: Omit<CallRow, "source_id" | "content_hash"> = {
    slug,
    naslov: merged.naslov.trim(),
    davatelj: (merged.davatelj || adapter.naziv).trim(),
    program: (merged.program || "").trim(),
    level: merged.level || "nacionalna",
    status,
    datum_objave,
    rok_prijave,
    iznos_min: merged.iznosMin ?? null,
    iznos_max: merged.iznosMax ?? null,
    ukupna_alokacija: merged.ukupnaAlokacija ?? null,
    intenzitet: merged.intenzitet ?? null,
    prihvatljivi,
    sektori,
    sazetak: merged.sazetak ?? null,
    izvor: adapter.naziv,
    url: merged.url,
  };
  return { ...base, content_hash: contentHash(base) };
}

// Pošten, prepoznatljiv User-Agent (scraper se ne pretvara da je preglednik).
const INGEST_UA =
  "EU-Radar-Ingest/1.0 (+https://fondovi.ips-konzalting.hr; kontakt: ams@ips-konzalting.hr)";

async function fetchOnce(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init?.timeoutMs ?? 15000);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "user-agent": INGEST_UA,
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
        "accept-language": "hr-HR,hr;q=0.9,en;q=0.8",
        // Zatvori vezu nakon odgovora — sprječava undici "keep-alive" assert
        // na serverima koji neuredno gase vezu.
        connection: "close",
        ...(init?.headers || {}),
      },
    });
  } finally {
    clearTimeout(t);
  }
}

/** Fetch s timeoutom, pregledničkim UA i do 3 pokušaja (backoff). */
export async function httpGet(
  url: string,
  init?: RequestInit & { timeoutMs?: number; retries?: number },
): Promise<Response> {
  const retries = init?.retries ?? 1;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchOnce(url, init);
      // 5xx/429 → pokušaj ponovno; ostalo vrati odmah
      if (res.status >= 500 || res.status === 429) {
        lastErr = new Error(`HTTP ${res.status}`);
      } else {
        return res;
      }
    } catch (e) {
      lastErr = e;
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
