"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Briefcase, Search, ChevronDown, LogOut, ShieldCheck, User } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

export function Topbar({
  userEmail,
  isSuperadmin,
  isStaff = false,
}: {
  userEmail: string;
  isSuperadmin: boolean;
  isStaff?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);

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
            className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm hover:bg-surface-2"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
              {isSuperadmin ? (
                <ShieldCheck className="h-3.5 w-3.5" />
              ) : (
                <User className="h-3.5 w-3.5" />
              )}
            </span>
            <span className="hidden max-w-[160px] truncate font-medium sm:inline">
              {userEmail}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-2" />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 z-20 mt-1.5 w-64 rounded-lg border border-border bg-surface p-1.5 shadow-lg shadow-black/10">
                <div className="px-2.5 py-2">
                  <div className="truncate text-sm font-medium">{userEmail}</div>
                  <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-2">
                    {isSuperadmin ? (
                      <>
                        <ShieldCheck className="h-3 w-3 text-brand-ink" /> Superadmin
                        (IPS)
                      </>
                    ) : (
                      "Korisnik"
                    )}
                  </div>
                </div>
                <div className="my-1 h-px bg-border" />
                {isStaff && (
                  <Link
                    href="/crm"
                    className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-surface-2"
                  >
                    <Briefcase className="h-4 w-4 text-muted-2" /> Otvori CRM
                  </Link>
                )}
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
