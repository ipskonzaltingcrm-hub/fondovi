"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useFlash } from "@/components/crm/overlay";
import { Field, Notice, inputClass } from "@/components/crm/ui";
import { saveCompany } from "@/lib/crm/actions/offers";
import { setMfaRequired } from "@/lib/crm/actions/system";
import type { CompanyInfo } from "@/lib/crm/data";

const WHERE: { what: string; href: string; where: string }[] = [
  { what: "Članovi tima, uloge i pozivnice", href: "/crm/tim", where: "Tim i uloge" },
  { what: "Dvofaktorska prijava, uređaji, odjava ostalih", href: "/crm/sigurnost", where: "Sigurnost" },
  { what: "Registracija na EU Radar (otvorena / uz pozivnicu), blokade, pretplate", href: "/crm/korisnici-portala", where: "Korisnici portala" },
  { what: "Chatbot: uključenost, upute, limit troška", href: "/crm/chatbot", where: "Chatbot brain" },
  { what: "Cjenik, opći uvjeti, podaci tvrtke za PDF", href: "/crm/ponude", where: "Ponude" },
  { what: "Mjesečni ciljevi prodaje", href: "/crm/prodaja", where: "Prodajni monitoring → Ciljevi" },
  { what: "Javni upitnici i poveznice", href: "/crm/upitnici", where: "Upitnici" },
  { what: "Rok proračuna JLS-ova, predlošci e-mailova", href: "/crm/jls-prodaja", where: "JLS prodaja" },
  { what: "Izvori natječaja (prikupljanje)", href: "/izvori", where: "EU Radar → Izvori" },
];

function Status({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <span className={ok ? "inline-flex items-center gap-1 text-success" : "inline-flex items-center gap-1 text-warning"}>
      {ok ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />} {ok ? yes : no}
    </span>
  );
}

export function SettingsView({
  company,
  registration,
  mfaRequired,
  chatbotEnabled,
  integrations,
  me,
}: {
  company: CompanyInfo;
  registration: string;
  mfaRequired: boolean;
  chatbotEnabled: boolean;
  integrations: { claude: boolean; serviceRole: boolean };
  me: { isAdmin: boolean; isSuperadmin: boolean };
}) {
  const [c, setC] = React.useState<CompanyInfo>(() => ({
    naziv: company.naziv ?? "",
    oib: company.oib ?? "",
    adresa: company.adresa ?? "",
    iban: company.iban ?? "",
    email: company.email ?? "",
    telefon: company.telefon ?? "",
    web: company.web ?? "",
  }));
  const [pending, start] = React.useTransition();
  const { show, node } = useFlash();
  const fields: [keyof CompanyInfo, string][] = [
    ["naziv", "Naziv"],
    ["oib", "OIB"],
    ["adresa", "Adresa"],
    ["iban", "IBAN"],
    ["email", "E-mail"],
    ["telefon", "Telefon"],
    ["web", "Web"],
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {node}
      <Card className="p-4">
        <h2 className="mb-3 font-display font-semibold">Tvrtka</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map(([k, l]) => (
            <Field key={k} label={l} className={k === "naziv" || k === "adresa" ? "sm:col-span-2" : undefined}>
              <input className={inputClass} disabled={!me.isAdmin} value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} />
            </Field>
          ))}
        </div>
        {me.isAdmin && (
          <Button size="sm" className="mt-3" disabled={pending} onClick={() => start(async () => show(await saveCompany(c)))}>
            Spremi
          </Button>
        )}
        <p className="mt-2 text-xs text-muted">Koristi se u zaglavlju i podnožju PDF-a ponude.</p>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="font-display font-semibold">Sigurnost i pristup</h2>
        <div className="text-sm">
          Registracija na EU Radar: <b>{registration === "pozivnica" ? "samo uz pozivnicu" : "otvorena svima"}</b>{" "}
          <Link href="/crm/korisnici-portala" className="text-brand-ink hover:underline">
            promijeni
          </Link>
        </div>
        <div className="text-sm">
          Dvofaktorska prijava za tim: <b>{mfaRequired ? "obavezna" : "neobavezna"}</b>
        </div>
        {me.isSuperadmin ? (
          <Button
            size="sm"
            variant={mfaRequired ? "secondary" : "primary"}
            disabled={pending}
            onClick={() =>
              confirm(
                mfaRequired
                  ? "Ukinuti obaveznu 2FA za tim?"
                  : "Uključiti obaveznu 2FA? Svaki član bez 2FA morat će je postaviti pri sljedećem ulasku u CRM. Prije toga postavite svoju u Sigurnosti.",
              ) && start(async () => show(await setMfaRequired(!mfaRequired)))
            }
          >
            {mfaRequired ? "Ukini obaveznu 2FA" : "Uključi obaveznu 2FA za tim"}
          </Button>
        ) : (
          <Notice>Obaveznu 2FA uključuje superadmin.</Notice>
        )}
      </Card>

      <Card className="space-y-2 p-4">
        <h2 className="font-display font-semibold">Integracije</h2>
        <div className="flex justify-between text-sm">
          <span>Supabase (baza, prijava)</span>
          <Status ok yes="Spojeno" no="" />
        </div>
        <div className="flex justify-between text-sm">
          <span>Serverski ključ (service role)</span>
          <Status ok={integrations.serviceRole} yes="Postavljen" no="Nedostaje" />
        </div>
        <div className="flex justify-between text-sm">
          <span>Claude API (chatbot)</span>
          <Status ok={integrations.claude} yes={chatbotEnabled ? "Spojeno, chatbot uključen" : "Spojeno, chatbot isključen"} no="Nema ključa (ANTHROPIC_API_KEY)" />
        </div>
        <div className="flex justify-between text-sm">
          <span>E-mail iz aplikacije (newsletter, podsjetnici)</span>
          <Status ok={false} yes="" no="Nije spojeno (poruke idu u aplikaciju)" />
        </div>
        <div className="flex justify-between text-sm">
          <span>Plaćanje karticom</span>
          <Status ok={false} yes="" no="Nije spojeno (uplate se evidentiraju ručno)" />
        </div>
        <p className="text-xs text-muted">Ključevi se upisuju u Vercel → Settings → Environment Variables (nikad u kod ni u CRM).</p>
      </Card>

      <Card className="p-4">
        <h2 className="mb-2 font-display font-semibold">Gdje su ostale postavke</h2>
        <ul className="divide-y divide-border text-sm">
          {WHERE.map((w) => (
            <li key={w.href}>
              <Link href={w.href} className="flex items-center gap-2 py-2 hover:text-brand-ink">
                <span className="flex-1">{w.what}</span>
                <span className="text-xs text-muted">{w.where}</span>
                <ArrowRight className="h-4 w-4 text-muted-2" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
