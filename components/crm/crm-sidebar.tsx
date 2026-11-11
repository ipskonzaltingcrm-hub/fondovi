"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { crmNavFor } from "@/lib/crm/nav";
import { LogoMark } from "@/components/layout/logo";
import { cn } from "@/lib/utils";

export function CrmSidebar({
  isAdmin,
  isSuperadmin,
  counts = {},
}: {
  isAdmin: boolean;
  isSuperadmin: boolean;
  counts?: Partial<Record<"leadovi" | "hot" | "zadaci" | "natjecaji" | "korisnici", number>>;
}) {
  const pathname = usePathname();
  const groups = crmNavFor(isAdmin, isSuperadmin);

  function isActive(href: string) {
    if (href === "/crm") return pathname === "/crm";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="hidden w-[248px] shrink-0 border-r border-border bg-surface md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <LogoMark className="h-8 w-8" />
        <div className="leading-tight">
          <div className="font-display text-[15px] font-bold tracking-tight">
            <span className="text-brand-ink">EU</span> Radar <span className="text-brand-ink">CRM</span>
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-2">
            IPS Konzalting
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-2">
              {g.label}
            </p>
            {g.items.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-[7px] text-sm font-medium transition-colors",
                    active
                      ? "bg-brand text-brand-contrast shadow-sm"
                      : item.live
                        ? "text-muted hover:bg-surface-2 hover:text-foreground"
                        : "text-muted-2 hover:bg-surface-2 hover:text-muted",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-[17px] w-[17px] shrink-0",
                      active ? "text-brand-contrast" : "text-muted-2 group-hover:text-foreground",
                    )}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.count && (counts[item.count] ?? 0) > 0 && (
                    <span
                      className={cn(
                        "min-w-5 rounded-full px-1.5 py-px text-center text-[11px] font-semibold tabular",
                        active ? "bg-brand-contrast/20 text-brand-contrast" : item.count === "zadaci" ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand-ink",
                      )}
                      title={item.count === "zadaci" ? "Moji otvoreni zadaci s rokom danas ili ranije" : "Novo od tvog zadnjeg posjeta"}
                    >
                      {counts[item.count]}
                    </span>
                  )}
                  {!item.live && item.href !== "/crm" && (
                    <span
                      className={cn(
                        "rounded px-1.5 py-px text-[10px] font-semibold tabular",
                        active ? "bg-brand-contrast/15 text-brand-contrast" : "bg-surface-2 text-muted-2",
                      )}
                      title={`Stiže u Fazi ${item.phase}`}
                    >
                      F{item.phase}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
