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

// ------------------------------------------------------------------ Faza 3

export type OfferStatus = "nacrt" | "poslana" | "prihvacena" | "odbijena" | "istekla";
export const OFFER_STATUS: Record<OfferStatus, { label: string; tone: Tone }> = {
  nacrt: { label: "Nacrt", tone: "neutral" },
  poslana: { label: "Poslana", tone: "info" },
  prihvacena: { label: "Prihvaćena", tone: "success" },
  odbijena: { label: "Odbijena", tone: "danger" },
  istekla: { label: "Istekla", tone: "outline" },
};

export const SERVICE_KATEGORIJA: Record<string, string> = {
  pretplata: "Pretplata EU Radar",
  priprema: "Priprema projekata",
  vodjenje: "Vođenje projekata",
  strategija: "Strategije (JLS)",
  savjetovanje: "Savjetovanje",
  ostalo: "Ostalo",
};
export const JEDINICA: Record<string, string> = {
  kom: "kom",
  mjesec: "mjesec",
  godina: "godina",
  sat: "sat",
  postotak: "% investicije",
};

export type JlsStatus = "nije_kontaktiran" | "mail_poslan" | "odgovorio" | "sastanak" | "ponuda" | "ugovor" | "odbio";
export const JLS_STATUS: Record<JlsStatus, { label: string; tone: Tone }> = {
  nije_kontaktiran: { label: "Nije kontaktiran", tone: "neutral" },
  mail_poslan: { label: "Mail poslan", tone: "info" },
  odgovorio: { label: "Odgovorio", tone: "warning" },
  sastanak: { label: "Sastanak", tone: "brand" },
  ponuda: { label: "Ponuda poslana", tone: "brand" },
  ugovor: { label: "Ugovor", tone: "success" },
  odbio: { label: "Odbio", tone: "outline" },
};
export const JLS_FUNNEL: JlsStatus[] = ["nije_kontaktiran", "mail_poslan", "odgovorio", "sastanak", "ponuda", "ugovor"];

export type JlsDraftStatus = "nacrt" | "poslano" | "odgovorio" | "sastanak" | "odbaceno";
export const JLS_DRAFT_STATUS: Record<JlsDraftStatus, { label: string; tone: Tone }> = {
  nacrt: { label: "Nacrt", tone: "neutral" },
  poslano: { label: "Poslano", tone: "info" },
  odgovorio: { label: "Odgovorio", tone: "warning" },
  sastanak: { label: "Sastanak dogovoren", tone: "success" },
  odbaceno: { label: "Odbačeno", tone: "outline" },
};

/** Predlošci e-mailova za JLS prodaju ({jls}, {kontakt}, {natjecaj}, {potpis}). Tekstove potvrđuje vlasnica. */
export const JLS_TEMPLATES: { key: string; label: string; naslov: string; tekst: string }[] = [
  {
    key: "predstavljanje",
    label: "Predstavljanje EU Radara",
    naslov: "EU Radar — svi natječaji za {jls} na jednom mjestu",
    tekst:
      "Poštovani {kontakt},\n\nIPS Konzalting razvio je EU Radar — servis koji svakodnevno prati EU i nacionalne natječaje i za {jls} izdvaja one na koje se možete prijaviti, s rokovima i podsjetnicima.\n\nRado bismo vam u 20 minuta pokazali koje natječaje trenutno imate otvorene i kako vam možemo pomoći s pripremom prijava.\n\nMožemo li dogovoriti kratak sastanak (uživo ili online)?\n\nLijep pozdrav,\n{potpis}",
  },
  {
    key: "podsjetnik",
    label: "Podsjetnik (7+ dana bez odgovora)",
    naslov: "Podsjetnik: EU Radar za {jls}",
    tekst:
      "Poštovani {kontakt},\n\nnadovezujem se na prošli e-mail o EU Radaru. Za {jls} trenutno pratimo nekoliko otvorenih natječaja s rokovima u idućim tjednima — rado ću vam poslati pregled bez obveze.\n\nLijep pozdrav,\n{potpis}",
  },
  {
    key: "natjecaj",
    label: "Konkretan natječaj (signal)",
    naslov: "Natječaj za {jls}: {natjecaj}",
    tekst:
      "Poštovani {kontakt},\n\nobjavljen je natječaj „{natjecaj}“ na koji se {jls} može prijaviti. Možemo preuzeti pripremu prijave i dokumentacije.\n\nŽelite li da vam pošaljemo sažetak uvjeta i procjenu?\n\nLijep pozdrav,\n{potpis}",
  },
  {
    key: "proracun",
    label: "Proračun za iduću godinu",
    naslov: "Planiranje EU projekata u proračunu — {jls}",
    tekst:
      "Poštovani {kontakt},\n\nuoči prijedloga proračuna za iduću godinu predlažemo da u proračun planirate stavke za pripremu EU projekata i praćenje natječaja (EU Radar). Na taj način možete reagirati čim se natječaj otvori.\n\nRado ćemo pripremiti ponudu prilagođenu vašem proračunu.\n\nLijep pozdrav,\n{potpis}",
  },
];

/** Pokazatelji prodaje (Prodajni monitoring / official). */
export type MetricKey =
  | "preuzeti" | "doneseni" | "novi" | "upitnik" | "pozivi" | "ponude_poslane" | "ponude_ugovorene" | "ugovoreno" | "stara" | "total";
export const METRICS: { key: MetricKey; label: string; money?: boolean }[] = [
  { key: "total", label: "Ukupno ugovoreno (€)", money: true },
  { key: "ugovoreno", label: "Ugovoreno (€)", money: true },
  { key: "stara", label: "„Stara“ provedba (€)", money: true },
  { key: "ponude_ugovorene", label: "Ponude ugovorene / potpisane" },
  { key: "ponude_poslane", label: "Ponude poslane" },
  { key: "pozivi", label: "Prodajni pozivi / sastanci" },
  { key: "upitnik", label: "Upitnik leadovi" },
  { key: "doneseni", label: "Donijeti leadovi" },
  { key: "preuzeti", label: "Preuzeti leadovi" },
  { key: "novi", label: "Novi leadovi u CRM (ukupno)" },
];
/** Redoslijed redova u Prodajnom officialu (kao vlasničina Excel tablica). */
export const OFFICIAL_ROWS: MetricKey[] = [
  "preuzeti", "doneseni", "novi", "upitnik", "pozivi", "ponude_poslane", "ponude_ugovorene", "ugovoreno", "stara", "total",
];
