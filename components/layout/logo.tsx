import { cn } from "@/lib/utils";

/* Jedna 5-kraka zvjezdica (EU), centrirana u ishodištu, ~1.7 radijusa. */
const STAR_PATH =
  "M0,-1.7 L0.5,-0.52 1.62,-0.52 0.66,0.2 1,1.37 0,0.66 -1,1.37 -0.66,0.2 -1.62,-0.52 -0.5,-0.52 Z";
const STARS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * 30 * Math.PI) / 180;
  const r = 12.4;
  return { x: 16 + r * Math.sin(a), y: 16 - r * Math.cos(a) };
});

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("h-7 w-7", className)}
      aria-hidden
    >
      {/* EU plavi badge */}
      <rect width="32" height="32" rx="8" fill="#0b1f4d" />
      {/* Prsten od 12 zlatnih zvjezdica */}
      {STARS.map((s, i) => (
        <path
          key={i}
          d={STAR_PATH}
          transform={`translate(${s.x.toFixed(2)} ${s.y.toFixed(2)})`}
          fill="var(--brand)"
        />
      ))}
      {/* Radar: koncentrični lukovi + sweep + centar */}
      <circle cx="16" cy="16" r="7" stroke="var(--brand)" strokeOpacity="0.35" strokeWidth="1" />
      <circle cx="16" cy="16" r="4" stroke="var(--brand)" strokeOpacity="0.5" strokeWidth="1" />
      <path d="M16 16 L16 9 A7 7 0 0 1 22 12.6 Z" fill="var(--brand)" fillOpacity="0.9" />
      <circle cx="16" cy="16" r="1.5" fill="var(--brand)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <div className="leading-none">
        <div className="font-display text-[15px] font-bold tracking-tight">
          <span className="text-brand">EU</span> Radar
        </div>
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-2">
          IPS Konzalting
        </div>
      </div>
    </div>
  );
}
