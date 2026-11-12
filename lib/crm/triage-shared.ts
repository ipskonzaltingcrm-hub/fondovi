/** Postavke AI trijaže natječaja (bez SDK-a — sigurno i za klijentski kod). */
export type TriageSettings = { enabled: boolean; profile: string; keywords: string[]; limit_usd: number };

export const DEFAULT_TRIAGE: TriageSettings = { enabled: false, profile: "", keywords: [], limit_usd: 15 };

export type TriageRun = {
  id: string;
  trigger: "raspored" | "rucno";
  status: "u_tijeku" | "ok" | "greska";
  started_at: string;
  finished_at: string | null;
  assessed: number;
  relevant: number;
  cost_usd: number;
  error: string | null;
  ingest: { inserted?: number; updated?: number; sources?: number } | null;
};
