import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const EUR = new Intl.NumberFormat("hr-HR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatEur(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return EUR.format(value);
}

export function formatRange(min?: number | null, max?: number | null) {
  if (!min && !max) return "—";
  if (min && max && min !== max) return `${formatEur(min)} – ${formatEur(max)}`;
  return formatEur(max ?? min);
}

const DATE = new Intl.DateTimeFormat("hr-HR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return DATE.format(new Date(iso));
}

/** Dana do roka (negativno = isteklo). `today` radi determinizma u prototipu. */
export function daysUntil(iso?: string | null, today = new Date("2026-11-07")) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - today.getTime();
  return Math.ceil(ms / 86_400_000);
}
