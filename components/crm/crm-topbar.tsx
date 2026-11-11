"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Radar, ShieldCheck, UserRound } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ROLE_LABEL, type StaffRole } from "@/lib/crm/roles";
import { initials } from "@/lib/crm/format";

export function CrmTopbar({ name, email, role }: { name: string; email: string; role: StaffRole }) {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur md:px-6">
      <div className="text-sm text-muted-2 md:hidden">
        <span className="font-display font-bold text-foreground">EU Radar CRM</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/dashboard"
          className="hidden items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-foreground sm:inline-flex"
          title="Otvori aplikaciju EU Radar (strana za klijente)"
        >
          <Radar className="h-4 w-4" /> EU Radar
        </Link>
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-sm hover:bg-surface-2"
            aria-expanded={open}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-brand-contrast">
              {initials(name)}
            </span>
            <span className="hidden max-w-[160px] truncate font-medium sm:inline">{name}</span>
            <ChevronDown className="h-4 w-4 text-muted-2" />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 z-20 mt-1.5 w-64 rounded-lg border border-border bg-surface p-1.5 shadow-lg shadow-black/10">
                <div className="px-2.5 py-2">
                  <div className="truncate text-sm font-medium">{name}</div>
                  <div className="truncate text-xs text-muted-2">{email}</div>
                  <div className="mt-1 inline-flex items-center gap-1 text-xs text-brand-ink">
                    <ShieldCheck className="h-3 w-3" /> {ROLE_LABEL[role]}
                  </div>
                </div>
                <div className="my-1 h-px bg-border" />
                <Link
                  href="/crm/tim?id=ja"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-surface-2"
                >
                  <UserRound className="h-4 w-4 text-muted-2" /> Moj profil
                </Link>
                <Link
                  href="/crm/sigurnost"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-surface-2"
                >
                  <ShieldCheck className="h-4 w-4 text-muted-2" /> Sigurnost
                </Link>
                <div className="my-1 h-px bg-border" />
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-danger hover:bg-danger-soft"
                  >
                    <LogOut className="h-4 w-4" /> Odjava
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
