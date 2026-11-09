import type { SourceAdapter } from "../types";
import { ruralnirazvoj } from "./ruralnirazvoj";
import { sedia } from "./sedia";
import { fzoeu } from "./fzoeu";
import { eufondovi } from "./eufondovi";
import { esf } from "./esf";
import { euribarstvo } from "./euribarstvo";
import { interregSiHr } from "./interreg-si-hr";

/* ------------------------------------------------------------------ */
/*  Registar izvora. Dodavanje novog izvora = nova datoteka adaptera   */
/*  (npr. ./fzoeu.ts) + uvoz ovdje. Svaki `slug` se poklapa sa         */
/*  sources.slug u bazi.                                               */
/* ------------------------------------------------------------------ */

export const adapters: SourceAdapter[] = [
  // EU — globalno dostupno (GitHub Actions)
  sedia, // egress: global
  // HR portali — vrte se preko Vercela (fra1)
  ruralnirazvoj,
  fzoeu,
  eufondovi,
  esf,
  euribarstvo,
  interregSiHr,
];
