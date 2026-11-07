"use client";

import * as React from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { CallCard } from "./call-card";
import { levelLabel, statusLabel } from "@/lib/domain";
import type {
  ApplicantType,
  CallLevel,
  CallStatus,
  FundingCall,
} from "@/lib/types";
import { daysUntil } from "@/lib/utils";
import { cn } from "@/lib/utils";

type SortKey = "rok" | "novo" | "alokacija";

const statusOptions: (CallStatus | "svi")[] = ["svi", "otvoren", "najava", "zatvoren"];
const levelOptions: (CallLevel | "sve")[] = ["sve", "lokalna", "regionalna", "nacionalna", "eu"];
const applicantOptions: { value: ApplicantType | "svi"; label: string }[] = [
  { value: "svi", label: "Svi prijavitelji" },
  { value: "grad", label: "Gradovi" },
  { value: "opcina", label: "Općine" },
  { value: "zupanija", label: "Županije" },
];

export function CallsExplorer({
  calls,
  initialQuery = "",
}: {
  calls: FundingCall[];
  initialQuery?: string;
}) {
  const [q, setQ] = React.useState(initialQuery);
  const [status, setStatus] = React.useState<CallStatus | "svi">("svi");
  const [level, setLevel] = React.useState<CallLevel | "sve">("sve");
  const [applicant, setApplicant] = React.useState<ApplicantType | "svi">("svi");
  const [sort, setSort] = React.useState<SortKey>("rok");

  const filtered = React.useMemo(() => {
    const text = q.trim().toLowerCase();
    let list = calls.filter((c) => {
      if (status !== "svi" && c.status !== status) return false;
      if (level !== "sve" && c.level !== level) return false;
      if (applicant !== "svi" && !c.prihvatljivi.includes(applicant)) return false;
      if (text) {
        const hay = `${c.naslov} ${c.davatelj} ${c.program} ${c.sazetak} ${c.sektori.join(" ")}`.toLowerCase();
        if (!hay.includes(text)) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sort === "alokacija")
        return (b.ukupnaAlokacija ?? 0) - (a.ukupnaAlokacija ?? 0);
      if (sort === "novo")
        return +new Date(b.datumObjave) - +new Date(a.datumObjave);
      // rok: otvoreni s najbližim rokom prvo, pa najave, pa zatvoreni
      const rank = (c: FundingCall) =>
        c.status === "otvoren" ? 0 : c.status === "najava" ? 1 : 2;
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      const da = daysUntil(a.rokPrijave) ?? 9999;
      const db = daysUntil(b.rokPrijave) ?? 9999;
      return da - db;
    });
    return list;
  }, [calls, q, status, level, applicant, sort]);

  const hasFilters = status !== "svi" || level !== "sve" || applicant !== "svi" || q !== "";

  return (
    <div>
      <div className="mb-5 rounded-lg border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted">
            <SlidersHorizontal className="h-4 w-4" />
            Filtri
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pretraga…"
            className="h-9 min-w-[160px] flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-2 focus:border-brand focus:ring-2 focus:ring-ring/30"
          />

          <Segmented
            value={status}
            onChange={setStatus}
            options={statusOptions.map((s) => ({
              value: s,
              label: s === "svi" ? "Svi" : statusLabel[s],
            }))}
          />

          <select
            value={applicant}
            onChange={(e) => setApplicant(e.target.value as ApplicantType | "svi")}
            className="h-9 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-brand"
          >
            {applicantOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-9 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-brand"
          >
            <option value="rok">Sortiraj: rok</option>
            <option value="novo">Sortiraj: najnovije</option>
            <option value="alokacija">Sortiraj: alokacija</option>
          </select>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {levelOptions.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                level === l
                  ? "border-brand bg-brand-soft text-brand-ink"
                  : "border-border text-muted hover:bg-surface-2",
              )}
            >
              {l === "sve" ? "Sve razine" : levelLabel[l]}
            </button>
          ))}
          {hasFilters && (
            <button
              onClick={() => {
                setQ("");
                setStatus("svi");
                setLevel("sve");
                setApplicant("svi");
              }}
              className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-muted hover:bg-surface-2"
            >
              <X className="h-3.5 w-3.5" /> Očisti
            </button>
          )}
        </div>
      </div>

      <div className="mb-3 text-sm text-muted">
        <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
        {filtered.length === 1 ? "natječaj" : "natječaja"}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong p-12 text-center">
          <p className="font-medium">Nema rezultata</p>
          <p className="mt-1 text-sm text-muted">
            Prilagodi filtre ili pretragu.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((c) => (
            <CallCard key={c.id} call={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-background p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
            value === o.value
              ? "bg-brand text-brand-contrast"
              : "text-muted hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
