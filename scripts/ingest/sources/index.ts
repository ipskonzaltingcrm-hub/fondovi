import type { SourceAdapter } from "../types";

/* ------------------------------------------------------------------ */
/*  Registar izvora. Dodavanje novog izvora = nova datoteka adaptera   */
/*  (npr. ./fzoeu.ts) + uvoz ovdje. Svaki `slug` se poklapa sa         */
/*  sources.slug u bazi.                                               */
/* ------------------------------------------------------------------ */

export const adapters: SourceAdapter[] = [
  // npr. fzoeu, eufondovi, esf, apprrr, eu-funding-tenders — dodaje se nakon recona.
];
