"use client";

import * as React from "react";
import Link from "next/link";
import { Copy, ExternalLink, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer, useFlash } from "@/components/crm/overlay";
import { Empty, Field, Notice, Stat, Tabs, inputClass, textareaClass } from "@/components/crm/ui";
import { deleteChat, markChatReviewed, saveChatBrain, saveChatSettings } from "@/lib/crm/actions/system";
import { BRAIN_FIELDS, type ChatBrain, type ChatSettings } from "@/lib/crm/chatbot-shared";
import { fmtDateTime } from "@/lib/crm/format";
import { cn } from "@/lib/utils";

export type Conversation = {
  id: string;
  created_at: string;
  last_at: string;
  izvor: string | null;
  test: boolean;
  pitanja: number;
  cost_usd: number;
  kontakt: { ime?: string; telefon?: string; email?: string } | null;
  lead_id: string | null;
  reviewed_at: string | null;
};
export type ChatMessage = { conversation_id: string; role: "user" | "assistant"; content: string; at: string };
type Tab = "upute" | "razgovori" | "postavke" | "ugradnja";
const usd = new Intl.NumberFormat("hr-HR", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export function ChatbotView({
  settings,
  brain,
  conversations,
  messages,
  hasKey,
  isAdmin,
  origin,
  monthStart,
}: {
  settings: ChatSettings;
  brain: ChatBrain;
  conversations: Conversation[];
  messages: ChatMessage[];
  hasKey: boolean;
  isAdmin: boolean;
  origin: string;
  monthStart: string;
}) {
  const [tab, setTab] = React.useState<Tab>("razgovori");
  const [filter, setFilter] = React.useState<"svi" | "kontakt" | "testni">("kontakt");
  const [open, setOpen] = React.useState<string | null>(null);
  const [s, setS] = React.useState(settings);
  const [b, setB] = React.useState(brain);
  const [pending, start] = React.useTransition();
  const { show, node } = useFlash();

  const month = conversations.filter((c) => c.created_at >= monthStart && !c.test);
  const cost = conversations.filter((c) => c.created_at >= monthStart).reduce((a, c) => a + Number(c.cost_usd), 0);
  const contacts = conversations.filter((c) => c.kontakt && !c.test);
  const unreviewed = contacts.filter((c) => !c.reviewed_at).length;
  const perConv = month.length ? (month.reduce((a, c) => a + c.pitanja, 0) / month.length).toFixed(1) : "—";
  const rows = conversations.filter((c) => (filter === "kontakt" ? c.kontakt && !c.test : filter === "testni" ? c.test : !c.test));
  const sel = conversations.find((c) => c.id === open) ?? null;
  const state = !hasKey ? "Čeka Claude API ključ" : settings.enabled ? "Chatbot je uključen" : "Chatbot je isključen";

  return (
    <div className="space-y-4">
      {node}
      <Notice tone={hasKey && settings.enabled ? "success" : "warning"}>
        <b>{state}.</b>{" "}
        {!hasKey
          ? "Na Vercelu (i lokalno u .env.local) treba dodati varijablu ANTHROPIC_API_KEY. Do tada posjetitelji vide samo obrazac za kontakt."
          : !settings.enabled
            ? "Uključi ga u Postavkama kad su upute spremne. Testni razgovor radi i dok je isključen."
            : "Model Claude Sonnet 5 (napor „low“, kao u IPS Hubu), s alatom za pretragu natječaja iz EU Radara."}
      </Notice>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Razgovori ovaj mjesec" value={month.length} />
        <Stat label="Zahtjevi za kontakt" value={contacts.length} hint={`${unreviewed} nepregledanih`} />
        <Stat label="Trošak ovaj mjesec" value={usd.format(cost)} hint={`limit ${usd.format(settings.limit_usd)}`} />
        <Stat label="Pitanja po razgovoru" value={perConv} />
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: "razgovori", label: "Razgovori", count: unreviewed || undefined },
          { value: "upute", label: "Upute (brain)" },
          { value: "postavke", label: "Postavke" },
          { value: "ugradnja", label: "Ugradnja i test" },
        ]}
      />

      {tab === "razgovori" && (
        <>
          <div className="flex gap-1">
            {(
              [
                ["kontakt", "Zahtjevi za kontakt"],
                ["svi", "Svi"],
                ["testni", "Testni"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={cn("rounded-md px-3 py-1 text-sm", filter === k ? "bg-brand text-brand-contrast" : "text-muted hover:bg-surface-2")}>
                {l}
              </button>
            ))}
          </div>
          {rows.length === 0 ? (
            <Empty title="Nema razgovora" />
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-border">
                {rows.map((c) => {
                  const first = messages.find((m) => m.conversation_id === c.id && m.role === "user");
                  return (
                    <li key={c.id}>
                      <button
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2/60"
                        onClick={() => {
                          setOpen(c.id);
                          if (c.kontakt && !c.reviewed_at) void markChatReviewed(c.id);
                        }}
                      >
                        {c.kontakt && !c.reviewed_at && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{c.kontakt?.ime ?? first?.content ?? "(bez pitanja)"}</div>
                          <div className="text-xs text-muted">
                            {fmtDateTime(c.last_at)} · {c.pitanja} pitanja · izvor {c.izvor ?? "—"}
                          </div>
                        </div>
                        {c.kontakt && <Badge tone="success">Kontakt</Badge>}
                        {c.test && <Badge tone="neutral">Test</Badge>}
                        <span className="text-xs tabular text-muted">{usd.format(Number(c.cost_usd))}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>
      )}

      {tab === "upute" && (
        <Card className="space-y-3 p-4">
          {!isAdmin && <Notice>Upute uređuju administratori; ovdje su samo za čitanje.</Notice>}
          {BRAIN_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              <textarea
                rows={f.key === "dodatno" ? 10 : 3}
                className={textareaClass}
                disabled={!isAdmin}
                value={b[f.key]}
                onChange={(e) => setB({ ...b, [f.key]: e.target.value })}
              />
            </Field>
          ))}
          {isAdmin && (
            <Button size="sm" disabled={pending} onClick={() => start(async () => show(await saveChatBrain(b)))}>
              Spremi upute
            </Button>
          )}
          <p className="text-xs text-muted">Upute vrijede od sljedeće poruke. Dokumente (PDF) zasad zalijepi kao tekst u „Dodatno znanje“.</p>
        </Card>
      )}

      {tab === "postavke" && (
        <Card className="space-y-3 p-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" disabled={!isAdmin} checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} /> Chatbot je uključen (javno)
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ime asistenta">
              <input className={inputClass} disabled={!isAdmin} value={s.ime} onChange={(e) => setS({ ...s, ime: e.target.value })} />
            </Field>
            <Field label="Mjesečni limit troška (USD)" hint="Kad se dosegne, posjetitelj dobiva samo obrazac za kontakt.">
              <input type="number" className={inputClass} disabled={!isAdmin} value={s.limit_usd} onChange={(e) => setS({ ...s, limit_usd: Number(e.target.value) })} />
            </Field>
            <Field label="Najviše pitanja po razgovoru">
              <input type="number" className={inputClass} disabled={!isAdmin} value={s.max_pitanja} onChange={(e) => setS({ ...s, max_pitanja: Number(e.target.value) })} />
            </Field>
            <Field label="Kontakt se nudi od pitanja br.">
              <input type="number" className={inputClass} disabled={!isAdmin} value={s.kontakt_od} onChange={(e) => setS({ ...s, kontakt_od: Number(e.target.value) })} />
            </Field>
            <Field label="Pozdrav" className="sm:col-span-2">
              <textarea rows={2} className={textareaClass} disabled={!isAdmin} value={s.pozdrav} onChange={(e) => setS({ ...s, pozdrav: e.target.value })} />
            </Field>
          </div>
          {isAdmin && (
            <Button size="sm" disabled={pending} onClick={() => start(async () => show(await saveChatSettings(s)))}>
              Spremi postavke
            </Button>
          )}
          <p className="text-xs text-muted">Zaštita: najviše 20 novih razgovora po IP adresi na sat. Kontakt stvara lead (izvor „AI asistent“) i zadatak „Nazovi“ vlasniku.</p>
        </Card>
      )}

      {tab === "ugradnja" && (
        <Card className="space-y-4 p-4 text-sm">
          <div>
            <div className="mb-1 font-medium">Javna stranica</div>
            <CopyLine value={`${origin}/pitaj`} notify={show} />
            <p className="mt-1 text-xs text-muted">Za praćenje izvora dodaj npr. <code>?izvor=facebook</code> ili <code>?izvor=linkedin</code>.</p>
          </div>
          <div>
            <div className="mb-1 font-medium">Ugradnja na web (iframe)</div>
            <CopyLine
              value={`<iframe src="${origin}/pitaj?embed=1&izvor=web" style="width:380px;height:560px;border:0;border-radius:12px" title="EU Radar asistent"></iframe>`}
              notify={show}
            />
          </div>
          <div>
            <div className="mb-1 font-medium">Testni razgovor (ne stvara lead, radi i kad je chatbot isključen)</div>
            <a href="/pitaj?test=1" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-ink hover:underline">
              <ExternalLink className="h-4 w-4" /> Otvori testni chat
            </a>
          </div>
        </Card>
      )}

      {sel && (
        <Drawer
          open
          onClose={() => setOpen(null)}
          title={sel.kontakt?.ime ?? "Razgovor"}
          subtitle={`${fmtDateTime(sel.created_at)} · ${sel.pitanja} pitanja · ${usd.format(Number(sel.cost_usd))}${sel.test ? " · test" : ""}`}
          actions={
            isAdmin ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  confirm("Trajno obrisati razgovor?") &&
                  start(async () => {
                    const r = await deleteChat(sel.id);
                    show(r);
                    if (r.ok) setOpen(null);
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : undefined
          }
        >
          {sel.kontakt && (
            <div className="mb-4 rounded-lg border border-success/30 bg-success-soft p-3 text-sm">
              <div className="font-medium">Kontakt: {sel.kontakt.ime}</div>
              <div>{[sel.kontakt.telefon, sel.kontakt.email].filter(Boolean).join(" · ")}</div>
              {sel.lead_id && (
                <Link href={`/crm/leadovi?lead=${sel.lead_id}`} className="mt-1 inline-block font-medium text-brand-ink hover:underline">
                  Otvori lead →
                </Link>
              )}
            </div>
          )}
          <div className="space-y-2">
            {messages
              .filter((m) => m.conversation_id === sel.id)
              .map((m, i) => (
                <div key={i} className={cn("max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm", m.role === "user" ? "ml-auto bg-brand text-brand-contrast" : "bg-surface-2")}>
                  {m.content}
                </div>
              ))}
          </div>
        </Drawer>
      )}
    </div>
  );
}

function CopyLine({ value, notify }: { value: string; notify: (r: { ok: boolean; message?: string }) => void }) {
  return (
    <div className="flex gap-2">
      <input readOnly className={cn(inputClass, "font-mono text-xs")} value={value} />
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          void navigator.clipboard.writeText(value);
          notify({ ok: true, message: "Kopirano." });
        }}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}
