"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronsUpDown, Check } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

const tenants = [
  { id: "ips", naziv: "IPS Konzalting", role: "Operator" },
  { id: "koprivnica", naziv: "Grad Koprivnica", role: "Pretplatnik" },
  { id: "nedelisce", naziv: "Općina Nedelišće", role: "Pretplatnik" },
];

export function Topbar() {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [tenant, setTenant] = React.useState(tenants[0]);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur md:px-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/pozivi${q ? `?q=${encodeURIComponent(q)}` : ""}`);
        }}
        className="relative flex-1 max-w-md"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pretraži natječaje, davatelje, programe…"
          className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-2 focus:border-brand focus:ring-2 focus:ring-ring/30"
        />
      </form>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-2"
          >
            <span className="hidden text-muted sm:inline">Tenant:</span>
            <span className="font-medium">{tenant.naziv}</span>
            <ChevronsUpDown className="h-4 w-4 text-muted-2" />
          </button>
          {open && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-1.5 w-60 rounded-lg border border-border bg-surface p-1.5 shadow-lg shadow-black/10">
                {tenants.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTenant(t);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-2",
                      t.id === tenant.id && "bg-surface-2",
                    )}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{t.naziv}</div>
                      <div className="text-xs text-muted-2">{t.role}</div>
                    </div>
                    {t.id === tenant.id && (
                      <Check className="h-4 w-4 text-brand-ink" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
