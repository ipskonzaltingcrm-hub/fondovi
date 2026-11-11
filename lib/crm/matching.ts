import type { FundingCall, Jls } from "@/lib/types";
import { matchCall } from "@/lib/domain";
import type { ClientRow, Lead } from "./data";
import { toJls } from "./clients-util";
import type { Relevance } from "./options";

/** Zajednički model "kandidata" za natječaj: klijent ili otvoreni lead (EU Filter, Natječaji). */
export type Candidate = {
  kind: "klijent" | "lead";
  id: string;
  naziv: string;
  owner: string | null;
  label: string; // "Općina · Zadarska"
  jls: Jls;
};

export function clientCandidate(c: ClientRow): Candidate {
  return {
    kind: "klijent",
    id: c.id,
    naziv: c.naziv,
    owner: c.crm?.owner ?? null,
    label: [c.klijent_tip === "jls" ? c.tip ?? "jls" : c.klijent_tip, c.zupanija].filter(Boolean).join(" · "),
    jls: toJls(c),
  };
}

export function leadCandidate(l: Lead): Candidate {
  return {
    kind: "lead",
    id: l.id,
    naziv: `L-${l.broj} ${l.naziv}`,
    owner: l.owner,
    label: [l.klijent_tip === "jls" ? l.jls_tip ?? "jls" : l.klijent_tip, l.zupanija].filter(Boolean).join(" · "),
    jls: {
      id: l.id,
      naziv: l.naziv,
      tipKlijenta: l.klijent_tip,
      tip: l.klijent_tip === "jls" ? l.jls_tip ?? "opcina" : null,
      zupanija: l.zupanija ?? "",
      stanovnika: 0,
      ruralno: false,
      lag: null,
      velicina: null,
      sektoriInteresa: l.sektori ?? [],
      kontaktOsoba: l.kontakt_ime ?? "",
      status: "trial",
    },
  };
}

export type Verdict = "prihvatljiv" | "provjeriti" | "nije";
export const VERDICT: Record<Verdict, { label: string; tone: "success" | "warning" | "outline" }> = {
  prihvatljiv: { label: "Prihvatljiv", tone: "success" },
  provjeriti: { label: "Provjeriti", tone: "warning" },
  nije: { label: "Nije", tone: "outline" },
};

export type Check = { ok: boolean | null; text: string };

/** Provjera kandidata za natječaj po uvjetima (✓ / ✗ / ?). */
export function evaluate(call: FundingCall, jls: Jls): { verdict: Verdict; score: number; checks: Check[] } {
  const m = matchCall(call, jls);
  const sectorOverlap = call.sektori.filter((s) => jls.sektoriInteresa.includes(s));
  const checks: Check[] = [
    { ok: m.eligible, text: m.eligible ? "Vrsta prijavitelja je prihvatljiva" : "Vrsta prijavitelja nije na popisu prihvatljivih" },
    call.sektori.length === 0
      ? { ok: null, text: "Natječaj nema označene sektore" }
      : jls.sektoriInteresa.length === 0
        ? { ok: null, text: "Profil nema upisane sektore interesa" }
        : { ok: sectorOverlap.length > 0, text: sectorOverlap.length ? `Sektor: ${sectorOverlap.join(", ")}` : "Nema poklapanja sektora" },
    call.status === "zatvoren"
      ? { ok: false, text: "Natječaj je zatvoren" }
      : call.status === "najava"
        ? { ok: null, text: "Najava — rok još nije objavljen" }
        : { ok: true, text: "Natječaj je otvoren" },
  ];
  const verdict: Verdict = !m.eligible || call.status === "zatvoren" ? "nije" : m.score >= 55 && sectorOverlap.length > 0 ? "prihvatljiv" : "provjeriti";
  return { verdict, score: m.score, checks };
}

/** Automatska relevantnost natječaja za tim (kad je tim nije ručno postavio). */
export function autoRelevance(eligibleClients: number, bestScore: number, eligibleLeads: number): Relevance {
  if (eligibleClients > 0 && bestScore >= 70) return "visoka";
  if (eligibleClients > 0 || eligibleLeads > 0) return "srednja";
  return "niska";
}
