const dt = new Intl.DateTimeFormat("hr-HR", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Zagreb",
});
const d = new Intl.DateTimeFormat("hr-HR", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "Europe/Zagreb",
});

export function fmtDateTime(iso: string | null | undefined): string {
  return iso ? dt.format(new Date(iso)) : "—";
}

export function fmtDate(iso: string | null | undefined): string {
  return iso ? d.format(new Date(iso)) : "—";
}

/** "prije 5 min", "prije 3 h", "jučer", inače datum. */
export function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return "nikad";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "upravo";
  if (min < 60) return `prije ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `prije ${h} h`;
  const days = Math.round(h / 24);
  if (days === 1) return "jučer";
  if (days < 7) return `prije ${days} dana`;
  return fmtDate(iso);
}

/** Kratak opis preglednika/uređaja iz User-Agenta. */
export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Nepoznat uređaj";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Preglednik";
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}

export function initials(name: string): string {
  const parts = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
