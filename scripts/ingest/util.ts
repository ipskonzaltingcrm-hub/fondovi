import { createHash } from "node:crypto";
import type { CallRow, CallStatus, RawCall, SourceAdapter } from "./types";

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
  // HR: dd.mm.yyyy. ili dd/mm/yyyy
  const hr = s.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
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
  const slug = `${adapter.slug}-${slugify(merged.externalId || merged.naslov)}`;

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
    prihvatljivi: merged.prihvatljivi ?? [],
    sektori: merged.sektori ?? [],
    sazetak: merged.sazetak ?? null,
    izvor: adapter.naziv,
    url: merged.url,
  };
  return { ...base, content_hash: contentHash(base) };
}

/** Jednostavan fetch s timeoutom i pristojnim User-Agentom. */
export async function httpGet(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init?.timeoutMs ?? 20000);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "user-agent": "EU-Radar-Ingest/1.0 (+https://fondovi.ips-konzalting.hr)",
        accept: "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
        ...(init?.headers || {}),
      },
    });
  } finally {
    clearTimeout(t);
  }
}
