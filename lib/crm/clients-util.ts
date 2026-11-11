import type { Jls } from "@/lib/types";
import type { ClientRow } from "./data";

/** CRM red klijenta → EU Radar profil (za matching natječaja iz lib/domain). */
export function toJls(c: ClientRow): Jls {
  return {
    id: c.slug,
    naziv: c.naziv,
    tipKlijenta: c.klijent_tip,
    tip: c.tip,
    zupanija: c.zupanija ?? "",
    stanovnika: c.stanovnika ?? 0,
    ruralno: c.ruralno,
    lag: null,
    velicina: c.velicina,
    sektoriInteresa: c.sektori_interesa ?? [],
    kontaktOsoba: c.kontakt_osoba ?? "",
    status: c.status,
  };
}

/** Supabase vraća 1:1 vezu kao objekt ili niz — normaliziraj. */
export function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}
