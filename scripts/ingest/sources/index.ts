import type { SourceAdapter } from "../types";
import { ruralnirazvoj } from "./ruralnirazvoj";

/* ------------------------------------------------------------------ */
/*  Registar izvora. Dodavanje novog izvora = nova datoteka adaptera   */
/*  (npr. ./fzoeu.ts) + uvoz ovdje. Svaki `slug` se poklapa sa         */
/*  sources.slug u bazi.                                               */
/* ------------------------------------------------------------------ */

export const adapters: SourceAdapter[] = [
  ruralnirazvoj,
  // sljedeći: eu-funding-tenders (SEDIA), fzoeu, eufondovi …
];
