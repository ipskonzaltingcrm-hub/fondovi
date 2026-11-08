"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Building2,
  Radio,
  Bell,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Pregled", icon: LayoutDashboard },
  { href: "/pozivi", label: "Natječaji", icon: Megaphone },
  { href: "/klijenti", label: "Klijenti (JLS)", icon: Building2 },
  { href: "/izvori", label: "Izvori", icon: Radio, admin: true },
];

const secondary = [
  { href: "/obavijesti", label: "Obavijesti", icon: Bell },
  { href: "/postavke", label: "Postavke", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="hidden w-[260px] shrink-0 border-r border-border bg-surface md:flex md:flex-col">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-2">
          Radar
        </p>
        {nav.map((item) => (
          <NavLink key={item.href} {...item} active={isActive(item.href)} />
        ))}

        <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-muted-2">
          Osobno
        </p>
        {secondary.map((item) => (
          <NavLink key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-contrast">
            AM
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">ams@ips-konzalting.hr</div>
            <div className="flex items-center gap-1 text-xs text-brand-ink">
              <ShieldCheck className="h-3 w-3" /> Superadmin
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  admin,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  admin?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-brand text-brand-contrast shadow-sm"
          : "text-muted hover:bg-surface-2 hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0",
          active ? "text-brand-contrast" : "text-muted-2 group-hover:text-foreground",
        )}
      />
      <span className="flex-1">{label}</span>
      {admin && (
        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-2">
          admin
        </span>
      )}
    </Link>
  );
}
