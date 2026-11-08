import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("h-7 w-7", className)}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="var(--brand)" />
      <circle cx="16" cy="16" r="10" stroke="var(--brand-contrast)" strokeOpacity="0.35" strokeWidth="1.3" />
      <circle cx="16" cy="16" r="6" stroke="var(--brand-contrast)" strokeOpacity="0.55" strokeWidth="1.3" />
      <path
        d="M16 16 L16 5 A11 11 0 0 1 25 11 Z"
        fill="var(--brand-contrast)"
        fillOpacity="0.9"
      />
      <circle cx="16" cy="16" r="2" fill="var(--brand-contrast)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <div className="leading-none">
        <div className="font-display text-[15px] font-bold tracking-tight">
          EU <span className="text-brand-ink">Radar</span>
        </div>
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-2">
          IPS Konzalting
        </div>
      </div>
    </div>
  );
}
