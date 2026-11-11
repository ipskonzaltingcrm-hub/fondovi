import type { Lead } from "./data";

/** Koga zvati prvog: otvoreni leadovi po trijaži (50 % prihvatljivost · 25 % dokumentacija · 25 % financije). */
export function callQueue(leads: Lead[]): Lead[] {
  return leads
    .filter((l) => !l.archived_at && (l.status === "novi" || l.status === "kontaktiran" || l.status === "u_razgovoru"))
    .sort((a, b) => (b.trijaza ?? -1) - (a.trijaza ?? -1) || a.created_at.localeCompare(b.created_at));
}
