"use client";

import * as React from "react";
import { Phone, StickyNote, Mail, Users, MessageSquare, GitCommitHorizontal, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { textareaClass } from "./ui";
import { addActivity, type ActivityTarget } from "@/lib/crm/actions/activities";
import { ACTIVITY_MANUAL, ACTIVITY_VRSTA, type ActivityVrsta } from "@/lib/crm/options";
import type { Activity } from "@/lib/crm/data";
import { fmtDateTime } from "@/lib/crm/format";
import { cn } from "@/lib/utils";

const ICON: Record<ActivityVrsta, React.ComponentType<{ className?: string }>> = {
  poziv: Phone,
  biljeska: StickyNote,
  email: Mail,
  sastanak: Users,
  komentar: MessageSquare,
  promjena: GitCommitHorizontal,
  zadatak: CheckCircle2,
};

/** Povijest zapisa s obrascem za ručni upis (poziv / bilješka / e-mail / sastanak, ili komentar zadatka). */
export function ActivityFeed({
  target,
  items,
  onAdded,
  mode = "zapis",
  initialVrsta = "biljeska",
}: {
  target: ActivityTarget;
  items: Activity[];
  onAdded?: () => void;
  mode?: "zapis" | "komentar";
  initialVrsta?: ActivityVrsta;
}) {
  const [vrsta, setVrsta] = React.useState<ActivityVrsta>(mode === "komentar" ? "komentar" : initialVrsta);
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const r = await addActivity(target, vrsta, body);
      if (!r.ok) setError(r.error);
      else {
        setBody("");
        onAdded?.();
      }
    });
  }

  return (
    <div>
      <div className="rounded-lg border border-border bg-surface-2/40 p-3">
        {mode === "zapis" && (
          <div className="mb-2 flex flex-wrap gap-1">
            {ACTIVITY_MANUAL.map((v) => {
              const Icon = ICON[v];
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVrsta(v)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
                    vrsta === v ? "bg-brand text-brand-contrast" : "bg-surface text-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {ACTIVITY_VRSTA[v]}
                </button>
              );
            })}
          </div>
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder={
            mode === "komentar" ? "Dodaj komentar…" : vrsta === "poziv" ? "Što je dogovoreno u pozivu?" : "Upiši bilješku…"
          }
          className={textareaClass}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && body.trim()) submit();
          }}
        />
        <div className="mt-2 flex items-center gap-2">
          {error && <span className="flex-1 text-xs text-danger">{error}</span>}
          <Button size="sm" className="ml-auto" disabled={pending || !body.trim()} onClick={submit}>
            {pending ? "Spremam…" : mode === "komentar" ? "Komentiraj" : "Zabilježi"}
          </Button>
        </div>
      </div>

      <ol className="mt-4 space-y-3">
        {items.length === 0 && <li className="text-sm text-muted">Još nema zapisa.</li>}
        {items.map((a) => {
          const Icon = ICON[a.vrsta] ?? StickyNote;
          const auto = a.vrsta === "promjena";
          return (
            <li key={a.id} className="flex gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  auto ? "bg-surface-2 text-muted-2" : "bg-brand-soft text-brand-ink",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-2">
                  {ACTIVITY_VRSTA[a.vrsta]} · {a.actor_name ?? "Sustav"} · {fmtDateTime(a.at)}
                </div>
                <div className={cn("whitespace-pre-wrap text-sm", auto && "text-muted")}>{a.body}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
