"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useFlash } from "@/components/crm/overlay";
import { Field, Notice, inputClass } from "@/components/crm/ui";
import { saveEmailSettings, saveMyEmailPrefs, sendMyReminderNow, sendTestEmail } from "@/lib/crm/actions/email";
import type { EmailSettings } from "@/lib/crm/email-jobs";
import { fmtDateTime } from "@/lib/crm/format";
import type { EmailLogRow } from "./settings-view";

const VRSTA: Record<string, string> = { ponuda: "Ponuda", tjedni_pregled: "Tjedni pregled", podsjetnik: "Podsjetnik", test: "Probni" };
const STATUS_TONE: Record<string, "success" | "danger" | "neutral" | "info" | "warning"> = {
  poslano: "neutral",
  dostavljeno: "info",
  otvoreno: "success",
  kliknuto: "success",
  odbijeno: "danger",
  prituzba: "warning",
  greska: "danger",
};

export function EmailSettingsCard({
  settings,
  hasKey,
  myReminders,
  myEmail,
  isAdmin,
  log,
  showLog,
}: {
  settings: EmailSettings;
  hasKey: boolean;
  myReminders: boolean;
  myEmail: string;
  isAdmin: boolean;
  log: EmailLogRow[];
  showLog: boolean;
}) {
  const router = useRouter();
  const [s, setS] = React.useState<EmailSettings>(settings);
  const [pending, start] = React.useTransition();
  const { show, node } = useFlash();
  const act = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      show(r as never);
      if (r.ok) router.refresh();
    });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {node}
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-brand-ink" />
          <h2 className="flex-1 font-display font-semibold">E-mail iz aplikacije</h2>
          <Badge tone={hasKey ? (settings.enabled ? "success" : "neutral") : "warning"}>{hasKey ? (settings.enabled ? "uključeno" : "isključeno") : "nije spojeno"}</Badge>
        </div>
        <p className="text-sm text-muted">
          Šalje se isključivo s poddomene <b>radar.ips-konzalting.hr</b> (Resend) — poslovna pošta na ips-konzalting.hr (Microsoft 365) se ne dira.
        </p>
        {!hasKey && <Notice tone="warning">U Vercel → Settings → Environment Variables upišite RESEND_API_KEY (ključ iz Resenda) i ponovno objavite aplikaciju.</Notice>}
        {isAdmin ? (
          <>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} /> Automatski e-mailovi uključeni
            </label>
            <div className="space-y-1.5 pl-6 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={s.podsjetnici_tim} onChange={(e) => setS({ ...s, podsjetnici_tim: e.target.checked })} /> Dnevni podsjetnik timu (radnim danom u
                7:00): kasni zadaci, zadaci za danas, rokovi projekata, ponude pred istekom, prioritetni natječaji
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={s.tjedni_pregled} onChange={(e) => setS({ ...s, tjedni_pregled: e.target.checked })} /> Tjedni pregled natječaja korisnicima EU
                Radara (ponedjeljak u 8:00): novi natječaji za njihove klijente i rokovi uskoro, s poveznicom za odjavu
              </label>
            </div>
            <Field label="Koliko dana unaprijed javljati rokove (projekti, prioritetni natječaji)">
              <input
                type="number"
                min={1}
                max={30}
                className={inputClass}
                value={s.dani_unaprijed}
                onChange={(e) => setS({ ...s, dani_unaprijed: Number(e.target.value) })}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={pending} onClick={() => act(() => saveEmailSettings(s))}>
                Spremi
              </Button>
              <Button size="sm" variant="secondary" disabled={pending || !hasKey} onClick={() => act(() => sendTestEmail())}>
                Pošalji probni e-mail meni
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm">
            Dnevni podsjetnik timu: <b>{settings.enabled && settings.podsjetnici_tim ? "uključen" : "isključen"}</b> · tjedni pregled korisnicima:{" "}
            <b>{settings.enabled && settings.tjedni_pregled ? "uključen" : "isključen"}</b>
          </p>
        )}
        <p className="text-xs text-muted">Ponude se iz CRM-a šalju gumbom „Pošalji“ na ponudi (radi i kad su automatski e-mailovi isključeni, ako je ključ postavljen).</p>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="font-display font-semibold">Moje e-mail obavijesti</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={myReminders} disabled={pending} onChange={(e) => act(() => saveMyEmailPrefs({ podsjetnici: e.target.checked }))} /> Primam dnevni
          podsjetnik na {myEmail}
        </label>
        <Button size="sm" variant="secondary" disabled={pending || !hasKey} onClick={() => act(() => sendMyReminderNow())}>
          Pošalji mi današnji podsjetnik sada
        </Button>
        <p className="text-xs text-muted">Probno slanje ne utječe na redovni podsjetnik u 7:00.</p>
      </Card>

      {showLog && (
        <Card className="overflow-hidden lg:col-span-2">
          <h2 className="border-b border-border px-4 py-3 font-display font-semibold">Dnevnik e-mailova (zadnjih 50)</h2>
          {log.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">Još nije poslan nijedan e-mail.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {log.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                  <span className="w-32 text-xs text-muted">{fmtDateTime(l.at)}</span>
                  <Badge tone="neutral">{VRSTA[l.vrsta] ?? l.vrsta}</Badge>
                  <span className="min-w-0 flex-1 truncate">
                    {l.to_email} · {l.subject}
                    {l.error && <span className="text-danger"> — {l.error}</span>}
                  </span>
                  <Badge tone={STATUS_TONE[l.status] ?? "neutral"}>{l.status}</Badge>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-border px-4 py-2.5 text-xs text-muted">
            Status „dostavljeno / otvoreno / odbijeno“ stiže kad je u Resendu postavljen webhook na /api/email/webhook (i RESEND_WEBHOOK_SECRET u Vercelu).
          </p>
        </Card>
      )}
    </div>
  );
}
