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

// ------------------------------------------------------------------ Faza 2

export type Relevance = "visoka" | "srednja" | "niska" | "nebitno";
export const RELEVANCE: Record<Relevance, { label: string; tone: Tone }> = {
  visoka: { label: "Visoka", tone: "success" },
  srednja: { label: "Srednja", tone: "warning" },
  niska: { label: "Niska", tone: "neutral" },
  nebitno: { label: "Nebitno", tone: "outline" },
};

export type ProjectFaza =
  | "priprema" | "dokumentacija" | "predano" | "evaluacija" | "odobreno" | "isplata" | "zavrseno" | "odbijeno" | "odustalo";
export const PROJECT_FAZA: Record<ProjectFaza, { label: string; tone: Tone }> = {
  priprema: { label: "Priprema", tone: "info" },
  dokumentacija: { label: "Dokumentacija", tone: "info" },
  predano: { label: "Predano", tone: "brand" },
  evaluacija: { label: "Evaluacija", tone: "warning" },
  odobreno: { label: "Odobreno", tone: "success" },
  isplata: { label: "Isplata", tone: "success" },
  zavrseno: { label: "Završeno", tone: "neutral" },
  odbijeno: { label: "Odbijeno", tone: "danger" },
  odustalo: { label: "Klijent odustao", tone: "outline" },
};
/** Traka faza (glavni tok); odbijeno / odustalo su izlazi iz toka. */
export const PROJECT_FLOW: ProjectFaza[] = ["priprema", "dokumentacija", "predano", "evaluacija", "odobreno", "isplata", "zavrseno"];
export const PROJECT_ACTIVE: ProjectFaza[] = ["priprema", "dokumentacija", "predano", "evaluacija", "odobreno", "isplata"];

/** Predlošci checkliste dokumentacije (prijedlozi — vlasnica ih može zamijeniti stvarnim popisima). */
export const CHECKLIST_TEMPLATES: { key: string; label: string; items: { grupa: string; naziv: string }[] }[] = [
  {
    key: "jls",
    label: "EU projekt JLS-a (infrastruktura)",
    items: [
      { grupa: "Priprema", naziv: "Odluka predstavničkog tijela o prijavi" },
      { grupa: "Priprema", naziv: "Usklađenost sa strategijom / planom razvoja" },
      { grupa: "Priprema", naziv: "Idejni / glavni projekt" },
      { grupa: "Priprema", naziv: "Građevinska dozvola ili potvrda glavnog projekta" },
      { grupa: "Priprema", naziv: "Troškovnik i procjena vrijednosti" },
      { grupa: "Prijava", naziv: "Prijavni obrazac" },
      { grupa: "Prijava", naziv: "Izjava o partnerstvu (ako je primjenjivo)" },
      { grupa: "Prijava", naziv: "Izjava o osiguranom vlastitom udjelu (proračun)" },
      { grupa: "Prijava", naziv: "Dokaz o vlasništvu / pravu korištenja" },
      { grupa: "Predaja", naziv: "Kontrola prihvatljivosti i potpisi" },
      { grupa: "Predaja", naziv: "Predaja u sustav (eFondovi / AGRONET / e-mail)" },
    ],
  },
  {
    key: "poduzece",
    label: "Bespovratna potpora poduzeću",
    items: [
      { grupa: "Priprema", naziv: "GFI za zadnje dvije godine" },
      { grupa: "Priprema", naziv: "Izjava o MSP statusu" },
      { grupa: "Priprema", naziv: "Izjava o potporama male vrijednosti (de minimis)" },
      { grupa: "Priprema", naziv: "Ponude / predračuni za ulaganje" },
      { grupa: "Priprema", naziv: "Potvrda Porezne uprave o nepostojanju duga" },
      { grupa: "Prijava", naziv: "Poslovni plan / opis projekta" },
      { grupa: "Prijava", naziv: "Prijavni obrazac i proračun" },
      { grupa: "Predaja", naziv: "Kontrola prihvatljivosti i potpisi" },
      { grupa: "Predaja", naziv: "Predaja u sustav" },
    ],
  },
  {
    key: "isplata",
    label: "Zahtjev za isplatu",
    items: [
      { grupa: "Dokazi", naziv: "Računi i dokazi o plaćanju" },
      { grupa: "Dokazi", naziv: "Izvadci s računa" },
      { grupa: "Dokazi", naziv: "Fotodokumentacija / zapisnik o primopredaji" },
      { grupa: "Dokazi", naziv: "Dokaz o vidljivosti (EU oznake)" },
      { grupa: "Zahtjev", naziv: "Obrazac zahtjeva za isplatu" },
      { grupa: "Zahtjev", naziv: "Izvješće o provedbi" },
      { grupa: "Zahtjev", naziv: "Predaja zahtjeva" },
    ],
  },
];
