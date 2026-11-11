/** Šifrarnici CRM-a (Faza 1): leadovi, zadaci, hot semafor, klijenti. Vrijednosti = provjere u bazi (0008). */

export type Tone = "neutral" | "brand" | "info" | "warning" | "danger" | "success" | "outline";

export type LeadStatus = "novi" | "kontaktiran" | "u_razgovoru" | "ponuda" | "pretvoren" | "izgubljen";
export const LEAD_STATUS: Record<LeadStatus, { label: string; tone: Tone }> = {
  novi: { label: "Novi", tone: "info" },
  kontaktiran: { label: "Kontaktiran", tone: "neutral" },
  u_razgovoru: { label: "U razgovoru", tone: "warning" },
  ponuda: { label: "Ponuda", tone: "brand" },
  pretvoren: { label: "Klijent", tone: "success" },
  izgubljen: { label: "Izgubljen", tone: "outline" },
};
/** Statusi koje korisnik bira ručno ("pretvoren" nastaje samo pretvorbom). */
export const LEAD_STATUS_MANUAL: LeadStatus[] = ["novi", "kontaktiran", "u_razgovoru", "ponuda", "izgubljen"];
export const LEAD_OPEN: LeadStatus[] = ["novi", "kontaktiran", "u_razgovoru", "ponuda"];

export type LeadIzvor = "web" | "preporuka" | "telefon" | "email" | "sajam" | "linkedin" | "eu_radar" | "partner" | "ostalo";
export const LEAD_IZVOR: Record<LeadIzvor, string> = {
  eu_radar: "Registracija na EU Radar",
  web: "Web stranica",
  preporuka: "Preporuka",
  telefon: "Telefonski upit",
  email: "E-mail upit",
  sajam: "Sajam / događaj",
  linkedin: "LinkedIn",
  partner: "Partner",
  ostalo: "Ostalo",
};

export type KlijentTip = "jls" | "poduzece" | "institucija";
export const KLIJENT_TIP: Record<KlijentTip, string> = {
  jls: "JLS",
  poduzece: "Poduzeće",
  institucija: "Institucija",
};
export const JLS_TIP: Record<"grad" | "opcina" | "zupanija", string> = {
  opcina: "Općina",
  grad: "Grad",
  zupanija: "Županija",
};

export type ClientStatus = "aktivan" | "trial" | "pauziran";
export const CLIENT_STATUS: Record<ClientStatus, { label: string; tone: Tone }> = {
  aktivan: { label: "Aktivan", tone: "success" },
  trial: { label: "Probni", tone: "warning" },
  pauziran: { label: "Pauziran", tone: "neutral" },
};

export const ZUPANIJE = [
  "Grad Zagreb", "Zagrebačka", "Krapinsko-zagorska", "Sisačko-moslavačka", "Karlovačka", "Varaždinska",
  "Koprivničko-križevačka", "Bjelovarsko-bilogorska", "Primorsko-goranska", "Ličko-senjska",
  "Virovitičko-podravska", "Požeško-slavonska", "Brodsko-posavska", "Zadarska", "Osječko-baranjska",
  "Šibensko-kninska", "Vukovarsko-srijemska", "Splitsko-dalmatinska", "Istarska", "Dubrovačko-neretvanska",
  "Međimurska",
];

export type TaskVrsta = "poziv" | "dokument" | "ponuda" | "sastanak" | "odobrenje" | "objava" | "ostalo";
export const TASK_VRSTA: Record<TaskVrsta, string> = {
  poziv: "Poziv",
  dokument: "Dokument",
  ponuda: "Ponuda",
  sastanak: "Sastanak",
  odobrenje: "Odobrenje",
  objava: "Objava",
  ostalo: "Ostalo",
};

export type Prioritet = "nizak" | "srednji" | "visok";
export const PRIORITET: Record<Prioritet, { label: string; tone: Tone }> = {
  visok: { label: "Visok", tone: "danger" },
  srednji: { label: "Srednji", tone: "neutral" },
  nizak: { label: "Nizak", tone: "outline" },
};

export type HotStage = "zeleno" | "zuto" | "crveno" | "sivo";
/** Semafor Hot pregleda; redoslijed u ćeliji: zeleno → žuto → crveno → bez boje → sivo. */
export const HOT_STAGES: Record<HotStage, { label: string; dot: string; cell: string; order: number }> = {
  zeleno: { label: "Ponuda / dogovoreno", dot: "bg-success", cell: "bg-success-soft", order: 0 },
  zuto: { label: "U razgovoru / razmišlja", dot: "bg-warning", cell: "bg-warning-soft", order: 1 },
  crveno: { label: "Nazvati / čeka naš korak", dot: "bg-danger", cell: "bg-danger-soft", order: 2 },
  sivo: { label: "Odustao / nije zainteresiran", dot: "bg-muted-2", cell: "bg-surface-2 text-muted-2", order: 4 },
};
export const HOT_NO_STAGE_ORDER = 3;

export type ActivityVrsta = "poziv" | "biljeska" | "email" | "sastanak" | "komentar" | "promjena" | "zadatak";
export const ACTIVITY_VRSTA: Record<ActivityVrsta, string> = {
  poziv: "Poziv",
  biljeska: "Bilješka",
  email: "E-mail",
  sastanak: "Sastanak",
  komentar: "Komentar",
  promjena: "Promjena",
  zadatak: "Zadatak",
};
/** Vrste koje član tima upisuje ručno. */
export const ACTIVITY_MANUAL: ActivityVrsta[] = ["poziv", "biljeska", "email", "sastanak"];

/** Sektori kao u EU Radaru (components/klijenti/klijent-form.tsx, scripts/ingest/classify.ts) — za matching natječaja. */
export const SEKTORI = [
  "Energetika", "Zgrade", "Okoliš", "Komunalno", "Promet", "Digitalizacija", "Obrazovanje", "Socijalna skrb",
  "Turizam", "Ribarstvo", "More", "Ruralni razvoj", "Urbani razvoj",
];

export function leadNo(broj: number): string {
  return `L-${broj}`;
}
