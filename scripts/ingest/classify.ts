import type { ApplicantType } from "./types";

/* ------------------------------------------------------------------ */
/*  Klasifikacija poziva — iz teksta (naslov+sažetak+program) i izvora  */
/*  izvodi `sektori` (rječnik usklađen s jls_profiles.sektori_interesa) */
/*  i `prihvatljivi` (koji tipovi prijavitelja). Heuristika — za točnu  */
/*  prihvatljivost uvijek vrijedi tekst samog poziva.                   */
/* ------------------------------------------------------------------ */

type SektorRule = { sektor: string; re: RegExp };

// Ciljni sektori = vokabular JLS profila (da matching ima preklapanje).
// Rječnik je HR + EN (EU/SEDIA pozivi su na engleskom).
const SEKTOR_RULES: SektorRule[] = [
  { sektor: "Energetika", re: /energ|obnovljiv|solarn|fotonapon|sun[čc]an|elektran|grijanj|toplinsk|renewable|solar|photovoltaic|\bheating\b/i },
  { sektor: "Zgrade", re: /zgrad|energetsk\w*\s*obnov|obnova zgrad|javnih zgrada|building\s*renovation|renovation\s*of\s*building/i },
  { sektor: "Okoliš", re: /okoli[šs]|zelen|klimat|klimo|otpad|recikl|zaštit\w*\s*prirod|biolo[šs]k\w*\s*raznolik|emisij|dekarboniz|onečiš|environment|climat|\bwaste\b|recycl|biodiversity|emission|decarbon|pollution|circular\s*econom/i },
  { sektor: "Komunalno", re: /komunaln|vodoopskrb|kanalizacij|vodovod|otpadn\w*\s*vod|javn\w*\s*povr[šs]in|groblj|water\s*supply|sewage|wastewater|utilit/i },
  { sektor: "Promet", re: /promet|cest|mobilnost|bicikl|[žz]eljezn|javni prijevoz|transport|mobility|cycling|\brail\b|\broad\b/i },
  { sektor: "Digitalizacija", re: /digital|informatizacij|e-uslug|pametn\w*\s*grad|\bICT\b|informacijsk|kibernet|smart\s*cit|cyber/i },
  { sektor: "Obrazovanje", re: /obrazovanj|[šs]kol|vrti[ćc]|odgoj|učenik|cjelo[žz]ivotn|education|\bschool|training|\bskills\b/i },
  { sektor: "Socijalna skrb", re: /socijaln|skrb|zdravstv|starij\w*\s*osob|ranjiv|dom za|dnevni boravak|besku[ćc]ni|\bsocial\b|health|\bcare\b|elderly|vulnerable/i },
  { sektor: "Turizam", re: /turiz|turisti[čc]|touris/i },
  { sektor: "Ribarstvo", re: /ribar|akvakultur|ribolov|ribl|fisher|aquacultur/i },
  { sektor: "More", re: /pomorstv|lu[čc]k|\bluka\b|obaln|priobaln|oto[čc]|\bmore\b|maritime|coastal|\bport\b|\bisland|marine/i },
  { sektor: "Ruralni razvoj", re: /rural|poljoprivred|\bLAG\b|LEADER|\bselo\b|\bOPG\b|vinograd|sto[čc]ar|agricultur|\bfarm/i },
  { sektor: "Urbani razvoj", re: /urban|integrirana teritorijaln|\bITP\b|aglomeracij|revitalizacij|gradsk\w*\s*područj|cities\s*mission|regeneration/i },
];

export function classifySektori(text: string): string[] {
  const out = new Set<string>();
  for (const r of SEKTOR_RULES) if (r.re.test(text)) out.add(r.sektor);
  return [...out];
}

// Zadani prihvatljivi po izvoru (fallback kad tekst ne kaže izravno tko smije).
// Odražava tipičnu publiku izvora: JLS, poduzeća (tvrtka), institucije (ustanova), udruge.
const SOURCE_DEFAULTS: Record<string, ApplicantType[]> = {
  "eu-funding-tenders": ["grad", "opcina", "zupanija", "tvrtka", "ustanova"], // EU pozivi široko otvoreni
  fzoeu: ["grad", "opcina", "zupanija", "tvrtka"],
  eufondovi: ["grad", "opcina", "zupanija", "tvrtka", "ustanova"], // PKK=SME, ITP=JLS, istraživanje
  esf: ["grad", "opcina", "zupanija", "ustanova", "ngo", "tvrtka"],
  "interreg-si-hr": ["grad", "opcina", "zupanija", "ustanova", "ngo", "tvrtka"],
  hamagbicro: ["tvrtka"], // agencija za malo gospodarstvo
  hrzz: ["ustanova"], // znanstvene institucije
  ruralnirazvoj: ["tvrtka"],
  euribarstvo: ["tvrtka"],
};
const GENERIC_DEFAULT: ApplicantType[] = ["grad", "opcina", "zupanija"];

export function classifyApplicants(text: string, sourceSlug: string): ApplicantType[] {
  const out = new Set<ApplicantType>();
  const t = text.toLowerCase();

  // --- Eksplicitne naznake prijavitelja (HR + EN) ---
  // JLS / lokalne vlasti
  if (
    /jedinic\w*\s*lokaln|\bjls\b|lokaln\w*\s*(i\s*podru[čc]n\w*\s*)?samouprav|jlp\(?r?\)?s|local\s*authorit|municipalit|\bcities\b|local\s*government/.test(t)
  ) {
    out.add("grad");
    out.add("opcina");
    out.add("zupanija");
  }
  if (/op[ćc]in/.test(t)) out.add("opcina");
  if (/[žz]upanij|\bregions?\b/.test(t)) out.add("zupanija");
  if (/\bgradov|grad\w*\s*i\s*op[ćc]in|\btown\b/.test(t)) out.add("grad");
  if (/\blag\b|leader/.test(t)) out.add("lag");
  // Institucije / istraživanje
  if (
    /javn\w*\s*ustanov|\bustanov|[šs]kol|vrti[ćc]|dom zdravlja|bolnic|fakultet|sveu[čc]ili[šs]|institut|universit|research\s*(organi|infrastructur|institut|centre|center|perform)|academic|higher\s*education/.test(t)
  )
    out.add("ustanova");
  // Poduzeća (SME + velika)
  if (
    /poduzetni|tvrtk|\bobrt|\bmsp\b|mikro|srednj\w*\s*poduze|gospodarstven|poslovn\w*\s*subjekt|\bopg\b|poljoprivrednic|\bsme\b|small\s*and\s*medium|enterprise|\bbusiness|\bcompan|start-?up|entrepreneur|\bindustr/.test(t)
  )
    out.add("tvrtka");
  // Udruge / civilno društvo
  if (/udrug|nevladin|neprofitn|\bocd\b|organizacij\w*\s*civilnog|\bNGOs?\b|non-?profit|civil\s*society/i.test(text))
    out.add("ngo");

  // Ruralni/ribarstvo: općine/LAG samo za infrastrukturu/ruralna područja
  if (sourceSlug === "ruralnirazvoj" && /infrastruktur|ruraln\w*\s*podru[čc]j|komunaln|\bselo\b|op[ćc]in|\blag\b|javn\w*\s*(zgrad|objekt|povr)/.test(t)) {
    out.add("opcina");
    out.add("lag");
  }
  if (sourceSlug === "euribarstvo" && /lu[čc]k|infrastruktur|op[ćc]in|javn/.test(t)) {
    out.add("opcina");
  }

  // Fallback kad ništa nije prepoznato → zadano po izvoru
  if (out.size === 0) {
    for (const a of SOURCE_DEFAULTS[sourceSlug] ?? GENERIC_DEFAULT) out.add(a);
  }

  return [...out];
}
