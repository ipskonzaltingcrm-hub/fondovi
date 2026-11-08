/* ------------------------------------------------------------------ */
/*  Ingestion — zajednički tipovi (standalone, bez ovisnosti o app-u). */
/*  Enumi se moraju poklapati s DB enumima iz 0001_init.sql.           */
/* ------------------------------------------------------------------ */

export type CallLevel = "lokalna" | "regionalna" | "nacionalna" | "eu";
export type CallStatus = "najava" | "otvoren" | "zatvoren";
export type ApplicantType =
  | "grad"
  | "opcina"
  | "zupanija"
  | "lag"
  | "ustanova"
  | "tvrtka"
  | "ngo";

/** Sirovi poziv kakav adapter vrati prije normalizacije. */
export type RawCall = {
  /** Stabilni identifikator s izvora (npr. ID posta); ako ga nema, koristi se naslov. */
  externalId?: string | null;
  naslov: string;
  url: string;
  davatelj?: string | null;
  program?: string | null;
  level?: CallLevel;
  status?: CallStatus;
  /** ISO datum (YYYY-MM-DD) ili null. */
  datumObjave?: string | null;
  rokPrijave?: string | null;
  iznosMin?: number | null;
  iznosMax?: number | null;
  ukupnaAlokacija?: number | null;
  intenzitet?: string | null;
  prihvatljivi?: ApplicantType[];
  sektori?: string[];
  sazetak?: string | null;
};

/** Adapter za jedan izvor. `slug` se mora poklapati sa `sources.slug` u bazi. */
export type SourceAdapter = {
  slug: string;
  naziv: string;
  url: string;
  tip?: "HTML" | "RSS" | "API";
  prioritet?: "jezgra" | "dodatni";
  /** Zadane vrijednosti za sve pozive iz ovog izvora (npr. davatelj, level). */
  defaults?: Partial<RawCall>;
  fetchCalls(): Promise<RawCall[]>;
};

/** Redak spreman za upis u `calls`. */
export type CallRow = {
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
  prihvatljivi: ApplicantType[];
  sektori: string[];
  sazetak: string | null;
  izvor: string;
  url: string;
  source_id: string | null;
  content_hash: string;
};
