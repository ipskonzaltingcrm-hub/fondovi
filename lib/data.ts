import { createClient } from "@/lib/supabase/server";
import type {
  ApplicantType,
  CallLevel,
  CallStatus,
  FundingCall,
  IngestSource,
  Jls,
  JlsType,
} from "./types";

/* ------------------------------------------------------------------ */
/*  Sloj podataka (server) — čita iz Supabase, mapira u domenske tipove. */
/*  RLS vrijedi: globalni katalog je čitljiv svim prijavljenima,         */
/*  per-tenant tablice samo članovima / superadminu.                     */
/* ------------------------------------------------------------------ */

type CallRow = {
  slug: string;
  naslov: string;
  davatelj: string;
  program: string;
  level: CallLevel;
  status: CallStatus;
  datum_objave: string | null;
  rok_prijave: string | null;
  iznos_min: number | null;
  iznos_max: number | null;
  ukupna_alokacija: number | null;
  intenzitet: string | null;
  prihvatljivi: ApplicantType[] | null;
  sektori: string[] | null;
  sazetak: string | null;
  izvor: string | null;
  url: string;
  updated_at: string;
};

type JlsRow = {
  slug: string;
  naziv: string;
  tip: JlsType;
  zupanija: string | null;
  stanovnika: number | null;
  ruralno: boolean;
  lag: string | null;
  sektori_interesa: string[] | null;
  kontakt_osoba: string | null;
  status: "aktivan" | "trial" | "pauziran";
};

type SourceRow = {
  slug: string;
  naziv: string;
  url: string;
  tip: "HTML" | "RSS" | "API";
  status: "aktivan" | "greska" | "pauziran";
  zadnje_povlacenje: string | null;
  poziva_ukupno: number;
  prioritet: "jezgra" | "dodatni";
};

const CALL_COLS =
  "slug,naslov,davatelj,program,level,status,datum_objave,rok_prijave,iznos_min,iznos_max,ukupna_alokacija,intenzitet,prihvatljivi,sektori,sazetak,izvor,url,updated_at";

function mapCall(r: CallRow): FundingCall {
  return {
    id: r.slug,
    naslov: r.naslov,
    davatelj: r.davatelj,
    program: r.program,
    level: r.level,
    status: r.status,
    datumObjave: r.datum_objave ?? r.updated_at,
    rokPrijave: r.rok_prijave,
    iznosMin: r.iznos_min,
    iznosMax: r.iznos_max,
    ukupnaAlokacija: r.ukupna_alokacija,
    intenzitet: r.intenzitet ?? "",
    prihvatljivi: r.prihvatljivi ?? [],
    sektori: r.sektori ?? [],
    sazetak: r.sazetak ?? "",
    izvor: r.izvor ?? "",
    url: r.url,
    azurirano: r.updated_at,
  };
}

function mapJls(r: JlsRow): Jls {
  return {
    id: r.slug,
    naziv: r.naziv,
    tip: r.tip,
    zupanija: r.zupanija ?? "",
    stanovnika: r.stanovnika ?? 0,
    ruralno: r.ruralno,
    lag: r.lag,
    sektoriInteresa: r.sektori_interesa ?? [],
    kontaktOsoba: r.kontakt_osoba ?? "",
    status: r.status,
  };
}

function mapSource(r: SourceRow): IngestSource {
  return {
    id: r.slug,
    naziv: r.naziv,
    url: r.url,
    tip: r.tip,
    status: r.status,
    zadnjePovlacenje: r.zadnje_povlacenje ?? new Date().toISOString(),
    pozivaUkupno: r.poziva_ukupno,
    prioritet: r.prioritet,
  };
}

/** Svi pozivi iz globalnog kataloga (najnoviji prvo). */
export async function getCalls(): Promise<FundingCall[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calls")
    .select(CALL_COLS)
    .order("datum_objave", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`getCalls: ${error.message}`);
  return (data as CallRow[]).map(mapCall);
}

/** Jedan poziv po slug-u (koristi se kao URL id). */
export async function getCallBySlug(slug: string): Promise<FundingCall | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calls")
    .select(CALL_COLS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`getCallBySlug: ${error.message}`);
  return data ? mapCall(data as CallRow) : null;
}

/** JLS profili vidljivi prijavljenom korisniku (RLS: članstvo ili superadmin). */
export async function getJlsProfiles(): Promise<Jls[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jls_profiles")
    .select(
      "slug,naziv,tip,zupanija,stanovnika,ruralno,lag,sektori_interesa,kontakt_osoba,status",
    )
    .order("naziv", { ascending: true });
  if (error) throw new Error(`getJlsProfiles: ${error.message}`);
  return (data as JlsRow[]).map(mapJls);
}

/** Jedan JLS profil po slug-u. */
export async function getJlsBySlug(slug: string): Promise<Jls | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jls_profiles")
    .select(
      "slug,naziv,tip,zupanija,stanovnika,ruralno,lag,sektori_interesa,kontakt_osoba,status",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`getJlsBySlug: ${error.message}`);
  return data ? mapJls(data as JlsRow) : null;
}

/** Praćeni izvori (globalni katalog). */
export async function getSources(): Promise<IngestSource[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sources")
    .select(
      "slug,naziv,url,tip,status,zadnje_povlacenje,poziva_ukupno,prioritet",
    )
    .order("prioritet", { ascending: true })
    .order("naziv", { ascending: true });
  if (error) throw new Error(`getSources: ${error.message}`);
  return (data as SourceRow[]).map(mapSource);
}
