/** Datumi CRM-a u zoni Europe/Zagreb, kao "YYYY-MM-DD" (isti oblik kao Postgres `date`). */

const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zagreb", year: "numeric", month: "2-digit", day: "2-digit" });

export function todayZg(now: Date = new Date()): string {
  return ymd.format(now);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Ponedjeljak tjedna kojem dan pripada. */
export function weekStart(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(day, -dow);
}

export function dayOfWeek(day: string): number {
  return (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
}

const dayFmt = new Intl.DateTimeFormat("hr-HR", { day: "numeric", month: "numeric", timeZone: "UTC" });
const longFmt = new Intl.DateTimeFormat("hr-HR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Zagreb" });
const monthFmt = new Intl.DateTimeFormat("hr-HR", { month: "long", year: "numeric", timeZone: "UTC" });
const wdFmt = new Intl.DateTimeFormat("hr-HR", { weekday: "short", timeZone: "UTC" });

/** "12. 11." */
export function fmtDay(day: string | null | undefined): string {
  return day ? dayFmt.format(new Date(`${day}T12:00:00Z`)) : "—";
}
export function fmtWeekday(day: string): string {
  return wdFmt.format(new Date(`${day}T12:00:00Z`));
}
export function fmtLongToday(now: Date = new Date()): string {
  return longFmt.format(now);
}
export function fmtMonth(day: string): string {
  return monthFmt.format(new Date(`${day}T12:00:00Z`));
}

export type DueGroup = "kasni" | "danas" | "sutra" | "tjedan" | "kasnije" | "bez" | "gotovo";
export const DUE_GROUP_LABEL: Record<DueGroup, string> = {
  kasni: "Kasni",
  danas: "Danas",
  sutra: "Sutra",
  tjedan: "Ovaj tjedan",
  kasnije: "Kasnije",
  bez: "Bez roka",
  gotovo: "Dovršeno",
};
export const DUE_GROUP_ORDER: DueGroup[] = ["kasni", "danas", "sutra", "tjedan", "kasnije", "bez", "gotovo"];

export function dueGroup(rok: string | null, done: boolean, today: string): DueGroup {
  if (done) return "gotovo";
  if (!rok) return "bez";
  if (rok < today) return "kasni";
  if (rok === today) return "danas";
  if (rok === addDays(today, 1)) return "sutra";
  if (rok <= addDays(weekStart(today), 6)) return "tjedan";
  return "kasnije";
}

/** Rok koji odgovara stupcu Kanbana (za premještanje povlačenjem). */
export function rokForGroup(g: DueGroup, today: string): string | null | undefined {
  switch (g) {
    case "danas":
      return today;
    case "sutra":
      return addDays(today, 1);
    case "tjedan": {
      const end = addDays(weekStart(today), 6);
      const d2 = addDays(today, 2);
      return d2 <= end ? d2 : end;
    }
    case "kasnije":
      return addDays(weekStart(today), 7);
    case "bez":
      return null;
    default:
      return undefined; // kasni / gotovo — ne može se premjestiti
  }
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86400000);
}
