import type { SourceAdapter } from "../types";
import { ruralnirazvoj } from "./ruralnirazvoj";
import { sedia } from "./sedia";

/* ------------------------------------------------------------------ */
/*  Registar izvora. Dodavanje novog izvora = nova datoteka adaptera   */
/*  (npr. ./fzoeu.ts) + uvoz ovdje. Svaki `slug` se poklapa sa         */
/*  sources.slug u bazi.                                               */
/* ------------------------------------------------------------------ */

export const adapters: SourceAdapter[] = [
  sedia, // egress: global (GitHub)
  ruralnirazvoj, // egress: hr (Vercel fra1)
  // sljedeći: fzoeu, eufondovi …
];
