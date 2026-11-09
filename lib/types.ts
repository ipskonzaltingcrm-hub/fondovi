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

export interface FundingCall {
  id: string;
  naslov: string;
  davatelj: string;
  program: string;
  level: CallLevel;
  status: CallStatus;
  datumObjave: string; // ISO
  rokPrijave: string | null; // ISO
  iznosMin: number | null;
  iznosMax: number | null;
  ukupnaAlokacija: number | null;
  intenzitet: string; // npr. "do 85%"
  prihvatljivi: ApplicantType[];
  sektori: string[];
  sazetak: string;
  izvor: string;
  url: string;
  azurirano: string; // ISO
}

export type JlsType = "grad" | "opcina" | "zupanija";

/** Vrsta klijenta/pretplatnika. */
export type KlijentTip = "jls" | "poduzece" | "institucija";

/**
 * Profil klijenta (povijesno "Jls"). Pokriva tri vrste pretplatnika:
 * JLS (grad/općina/županija), poduzeća i znanstveno-istraživačke institucije.
 */
export interface Jls {
  id: string;
  naziv: string;
  tipKlijenta: KlijentTip;
  /** JLS-podtip (grad/općina/županija); null za poduzeća/institucije. */
  tip: JlsType | null;
  zupanija: string;
  stanovnika: number;
  ruralno: boolean;
  lag: string | null;
  /** Veličina poduzeća (mikro/malo/srednje/veliko); null inače. */
  velicina: string | null;
  sektoriInteresa: string[];
  kontaktOsoba: string;
  status: "aktivan" | "trial" | "pauziran";
}

export interface IngestSource {
  id: string;
  naziv: string;
  url: string;
  tip: "HTML" | "RSS" | "API";
  status: "aktivan" | "greska" | "pauziran";
  zadnjePovlacenje: string; // ISO
  pozivaUkupno: number;
  prioritet: "jezgra" | "dodatni";
}
