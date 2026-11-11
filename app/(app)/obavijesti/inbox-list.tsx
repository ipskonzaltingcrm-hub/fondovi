"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Bell, Landmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { markMessageRead } from "@/lib/crm/actions/messages";
import { cn } from "@/lib/utils";

export type InboxItem = { id: string; at: string; read: boolean; naslov: string; tekst: string; link: string | null; vrsta: string };

const fmt = new Intl.DateTimeFormat("hr-HR", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zagreb" });

export function InboxList({ items }: { items: InboxItem[] }) {
  const [open, setOpen] = React.useState<string | null>(null);
  const [readLocal, setReadLocal] = React.useState<Set<string>>(new Set());
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-border">
        {items.map((i) => {
          const read = i.read || readLocal.has(i.id);
          const Icon = i.vrsta === "natjecaj" ? Landmark : Bell;
          return (
            <li key={i.id}>
              <button
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2/60"
                onClick={() => {
                  setOpen(open === i.id ? null : i.id);
                  if (!read) {
                    setReadLocal((s) => new Set(s).add(i.id));
                    void markMessageRead(i.id);
                  }
                }}
              >
                <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", read ? "bg-surface-2 text-muted-2" : "bg-brand-soft text-brand-ink")}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className={cn("text-sm", !read && "font-semibold")}>{i.naslov}</div>
                  <div className="text-xs text-muted">{fmt.format(new Date(i.at))}</div>
                  {open === i.id && (
                    <div className="mt-2 space-y-2">
                      {i.tekst && <p className="whitespace-pre-wrap text-sm">{i.tekst}</p>}
                      {i.link && (
                        <Link
                          href={i.link}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-sm font-medium text-brand-ink hover:underline"
                        >
                          Otvori <ArrowRight className="h-4 w-4" />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
                {!read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" />}
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
