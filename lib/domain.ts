import type {
  ApplicantType,
  CallLevel,
  CallStatus,
  FundingCall,
  Jls,
} from "./types";
import { calls, jlsList } from "./mock-data";
import { daysUntil } from "./utils";

export const levelLabel: Record<CallLevel, string> = {
  lokalna: "Lokalna",
  regionalna: "Regionalna",
  nacionalna: "Nacionalna",
  eu: "EU",
};

export const statusLabel: Record<CallStatus, string> = {
  najava: "Najava",
  otvoren: "Otvoren",
  zatvoren: "Zatvoren",
};

export const applicantLabel: Record<ApplicantType, string> = {
  grad: "Gradovi",
  opcina: "Općine",
  zupanija: "Županije",
  lag: "LAG-ovi",
  ustanova: "Ustanove",
  tvrtka: "Tvrtke",
  ngo: "Udruge",
};

/** Izvedeni status roka za bojenje/sortiranje. */
export function deadlineState(call: FundingCall): {
  kind: "istekao" | "hitno" | "uskoro" | "otvoreno" | "najava";
  days: number | null;
  label: string;
} {
  if (call.status === "najava")
    return { kind: "najava", days: null, label: "Najava — rok nije objavljen" };
  const d = daysUntil(call.rokPrijave);
  if (d === null) return { kind: "otvoreno", days: null, label: "—" };
  if (d < 0) return { kind: "istekao", days: d, label: "Rok istekao" };
  if (d <= 7) return { kind: "hitno", days: d, label: `Još ${d} d` };
  if (d <= 21) return { kind: "uskoro", days: d, label: `Još ${d} d` };
  return { kind: "otvoreno", days: d, label: `Još ${d} d` };
}

export function getCall(id: string): FundingCall | undefined {
  return calls.find((c) => c.id === id);
}

export function getJls(id: string): Jls | undefined {
  return jlsList.find((j) => j.id === id);
}

export interface MatchResult {
  call: FundingCall;
  score: number; // 0–100
  eligible: boolean;
  reasons: string[];
}

/**
 * Matching poziva prema profilu JLS-a.
 * U Fazi 5 nadograđuje se AI-klasifikacijom; ovdje deterministička pravila.
 */
export function matchCall(call: FundingCall, jls: Jls): MatchResult {
  const reasons: string[] = [];
  let score = 0;

  const eligible = call.prihvatljivi.includes(jls.tip);
  if (eligible) {
    score += 45;
    reasons.push(`${jls.tip === "grad" ? "Grad" : jls.tip === "opcina" ? "Općina" : "Županija"} je prihvatljiv prijavitelj`);
  } else {
    reasons.push("Ovaj tip JLS-a nije na popisu prihvatljivih prijavitelja");
  }

  const overlap = call.sektori.filter((s) => jls.sektoriInteresa.includes(s));
  if (overlap.length) {
    score += Math.min(30, overlap.length * 15);
    reasons.push(`Poklapanje sektora: ${overlap.join(", ")}`);
  }

  if (jls.ruralno && (call.prihvatljivi.includes("lag") || call.sektori.includes("Ruralni razvoj"))) {
    score += 12;
    reasons.push("Ruralni JLS — prikladno za LAG/ruralne mjere");
  }

  const ds = deadlineState(call);
  if (call.status === "otvoren") {
    score += 10;
    if (ds.kind === "hitno") reasons.push("Otvoren, ali rok uskoro ističe");
  } else if (call.status === "najava") {
    score += 4;
    reasons.push("Najava — pripremiti se unaprijed");
  } else {
    score = Math.min(score, 25);
    reasons.push("Poziv je zatvoren");
  }

  return {
    call,
    score: Math.min(100, score),
    eligible,
    reasons,
  };
}

/** Rangirani pozivi za zadani JLS (najrelevantniji prvi). */
export function matchesForJls(jls: Jls): MatchResult[] {
  return calls
    .map((c) => matchCall(c, jls))
    .filter((m) => m.eligible)
    .sort((a, b) => b.score - a.score);
}

/** Agregatni brojevi za dashboard. */
export function dashboardStats() {
  const otvoreni = calls.filter((c) => c.status === "otvoren");
  const najave = calls.filter((c) => c.status === "najava");
  const hitni = otvoreni.filter((c) => {
    const d = daysUntil(c.rokPrijave);
    return d !== null && d >= 0 && d <= 14;
  });
  const alokacija = otvoreni.reduce((sum, c) => sum + (c.ukupnaAlokacija ?? 0), 0);
  return {
    otvoreniBroj: otvoreni.length,
    najaveBroj: najave.length,
    hitniBroj: hitni.length,
    ukupnaAlokacija: alokacija,
    jlsBroj: jlsList.length,
  };
}
