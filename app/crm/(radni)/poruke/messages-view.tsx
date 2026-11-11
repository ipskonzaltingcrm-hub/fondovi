"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, Copy, FlaskConical, Pencil, Plus, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal, useFlash } from "@/components/crm/overlay";
import { Empty, Field, Notice, inputClass, textareaClass } from "@/components/crm/ui";
import { archiveMessage, previewRecipients, saveMessage, sendMessage, type Audience, type MessageInput } from "@/lib/crm/actions/messages";
import { fmtDateTime } from "@/lib/crm/format";
import { cn } from "@/lib/utils";

export type Message = {
  id: string;
  naslov: string;
  tekst: string;
  link: string | null;
  vrsta: "obavijest" | "natjecaj" | "podsjetnik";
  call_id: string | null;
  audience: Audience;
  status: "nacrt" | "poslano";
  sent_at: string | null;
  recipients: number;
  created_at: string;
  reads: { n: number; read: number };
};

const AUDIENCE: Record<Audience["type"], string> = {
  svi: "Svi korisnici EU Radara",
  clanovi: "Korisnici dodijeljeni klijentu",
  aktivni: "Pretplatnici (aktivni klijenti)",
  probni: "Probni klijenti",
  bez_klijenta: "Registrirani bez klijenta",
  testni: "Samo testni korisnici",
  klijenti: "Odabrani klijenti",
};

export function MessagesView({
  messages,
  clients,
  preset,
}: {
  messages: Message[];
  clients: { id: string; naziv: string }[];
  preset: { naslov: string; tekst: string; link: string; call_id: string; ids: string[] } | null;
}) {
  const router = useRouter();
  const [edit, setEdit] = React.useState<Message | "nova" | null>(preset ? "nova" : null);
  const [pending, start] = React.useTransition();
  const { show, node } = useFlash();

  async function exportEmails(a: Audience) {
    const r = await previewRecipients(a);
    if (r.error) return show({ ok: false, error: r.error });
    await navigator.clipboard.writeText(r.emails.join("; "));
    show({ ok: true, message: `Kopirano ${r.emails.length} adresa — zalijepi u polje „Bcc“ u svojoj pošti.` });
  }

  return (
    <div className="space-y-4">
      {node}
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setEdit("nova")}>
          <Plus className="h-4 w-4" /> Nova poruka
        </Button>
      </div>
      <Notice>
        Poruke stižu korisnicima u aplikaciju EU Radar (Obavijesti). Automatski e-mailovi (podsjetnici, newsletter) nisu spojeni — za e-mail kopiraj adrese
        primatelja i pošalji iz svoje pošte (Bcc).
      </Notice>
      {messages.length === 0 ? (
        <Empty title="Još nema poruka" />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {messages.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{m.naslov}</div>
                  <div className="text-xs text-muted">
                    {AUDIENCE[m.audience.type] ?? m.audience.type}
                    {m.audience.type === "klijenti" && m.audience.ids ? ` (${m.audience.ids.length})` : ""}
                    {m.vrsta === "natjecaj" ? " · obavijest o natječaju" : ""} · {fmtDateTime(m.sent_at ?? m.created_at)}
                  </div>
                </div>
                {m.status === "poslano" ? (
                  <Badge tone="success">
                    Poslano · {m.recipients} · pročitalo {m.reads.read}
                  </Badge>
                ) : (
                  <Badge tone="neutral">Nacrt</Badge>
                )}
                <div className="flex gap-1">
                  {m.status === "nacrt" && (
                    <Button size="sm" variant="ghost" onClick={() => setEdit(m)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" title="Kopiraj adrese primatelja (Bcc)" onClick={() => void exportEmails(m.audience)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" disabled={pending} title="Arhiviraj" onClick={() => start(async () => show(await archiveMessage(m.id)))}>
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {edit && (
        <MessageEditor
          message={edit === "nova" ? null : edit}
          preset={edit === "nova" ? preset : null}
          clients={clients}
          onClose={() => {
            setEdit(null);
            if (preset) router.replace("/crm/poruke");
          }}
          notify={show}
        />
      )}
    </div>
  );
}

function MessageEditor({
  message,
  preset,
  clients,
  onClose,
  notify,
}: {
  message: Message | null;
  preset: { naslov: string; tekst: string; link: string; call_id: string; ids: string[] } | null;
  clients: { id: string; naziv: string }[];
  onClose: () => void;
  notify: (r: { ok: boolean; message?: string; error?: string }) => void;
}) {
  const [id, setId] = React.useState<string | null>(message?.id ?? null);
  const [f, setF] = React.useState<MessageInput>({
    naslov: message?.naslov ?? preset?.naslov ?? "",
    tekst: message?.tekst ?? preset?.tekst ?? "",
    link: message?.link ?? preset?.link ?? "",
    vrsta: message?.vrsta ?? (preset ? "natjecaj" : "obavijest"),
    call_id: message?.call_id ?? preset?.call_id ?? null,
    audience: message?.audience ?? (preset ? { type: "klijenti", ids: preset.ids } : { type: "svi" }),
  });
  const [count, setCount] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const audKey = JSON.stringify(f.audience);

  React.useEffect(() => {
    let alive = true;
    previewRecipients(JSON.parse(audKey) as Audience).then((r) => alive && setCount(r.count));
    return () => {
      alive = false;
    };
  }, [audKey]);

  async function persist(): Promise<string | null> {
    const r = await saveMessage(id, f);
    if (!r.ok) {
      setError(r.error);
      return null;
    }
    setId(r.data ?? id);
    return r.data ?? id;
  }

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-2xl"
      title={message ? "Uredi poruku" : preset ? "Obavijest o natječaju" : "Nova poruka"}
      footer={
        <>
          <Button variant="ghost" size="sm" className="mr-auto" onClick={onClose}>
            Zatvori
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const saved = await persist();
                if (saved) notify({ ok: true, message: "Nacrt je spremljen." });
              })
            }
          >
            Spremi nacrt
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const saved = await persist();
                if (saved) notify(await sendMessage(saved, true));
              })
            }
          >
            <FlaskConical className="h-4 w-4" /> Probno
          </Button>
          <Button
            size="sm"
            disabled={pending || !count}
            onClick={() => {
              if (!confirm(`Poslati poruku ${count} primatelja? Nakon slanja se ne mijenja.`)) return;
              start(async () => {
                const saved = await persist();
                if (!saved) return;
                const r = await sendMessage(saved, false);
                notify(r);
                if (r.ok) onClose();
              });
            }}
          >
            <Send className="h-4 w-4" /> Pošalji {count != null ? `(${count})` : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Naslov">
          <input className={inputClass} value={f.naslov} onChange={(e) => setF({ ...f, naslov: e.target.value })} />
        </Field>
        <Field label="Tekst">
          <textarea rows={6} className={textareaClass} value={f.tekst} onChange={(e) => setF({ ...f, tekst: e.target.value })} />
        </Field>
        <Field label="Klik vodi na (neobavezno)" hint="npr. /pozivi/… ili https://…">
          <input className={inputClass} value={f.link ?? ""} onChange={(e) => setF({ ...f, link: e.target.value })} />
        </Field>
        <Field label="Kome">
          <select
            className={inputClass}
            value={f.audience.type}
            onChange={(e) => setF({ ...f, audience: { type: e.target.value as Audience["type"], ids: e.target.value === "klijenti" ? f.audience.ids ?? [] : undefined } })}
          >
            {Object.entries(AUDIENCE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        {f.audience.type === "klijenti" && (
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
            {clients.map((c) => {
              const on = f.audience.ids?.includes(c.id);
              return (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!on}
                    onChange={() =>
                      setF({
                        ...f,
                        audience: { type: "klijenti", ids: on ? (f.audience.ids ?? []).filter((x) => x !== c.id) : [...(f.audience.ids ?? []), c.id] },
                      })
                    }
                  />
                  {c.naziv}
                </label>
              );
            })}
          </div>
        )}
        <p className={cn("text-sm", count === 0 ? "text-warning" : "text-muted")}>
          Primatelja: <b>{count ?? "…"}</b>
          {count === 0 && " — nitko od korisnika ne odgovara ovoj publici (korisnici moraju biti dodijeljeni klijentu)."}
        </p>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Modal>
  );
}
