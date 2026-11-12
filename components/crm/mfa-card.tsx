"use client";

import * as React from "react";
import { ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice, inputClass } from "./ui";
import { createClient } from "@/lib/supabase/client";

type Factor = { id: string; friendly_name?: string; factor_type: string; status: string; created_at: string };

/** Dvofaktorska prijava (TOTP aplikacija: Microsoft/Google Authenticator…) preko Supabase MFA. */
export function MfaCard({ onEnrolled }: { onEnrolled?: () => void }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [factors, setFactors] = React.useState<Factor[] | null>(null);
  const [enroll, setEnroll] = React.useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) setError(error.message);
    setFactors(((data?.all ?? []) as Factor[]).filter((f) => f.factor_type === "totp"));
  }, [supabase]);
  React.useEffect(() => {
    let alive = true;
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (!alive) return;
      if (error) setError(error.message);
      setFactors(((data?.all ?? []) as Factor[]).filter((f) => f.factor_type === "totp"));
    });
    return () => {
      alive = false;
    };
  }, [supabase]);

  async function start() {
    setError(null);
    setBusy(true);
    // Ostaci nedovršenih prijava (neverificirani) brišu se da enroll ne padne na istom imenu.
    for (const f of factors ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `EU Radar CRM ${new Date().toLocaleDateString("hr-HR")}` });
    setBusy(false);
    if (error) return setError(error.message);
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verify() {
    if (!enroll) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.trim() });
    setBusy(false);
    if (error) return setError("Kod nije ispravan. Pokušajte s novim kodom iz aplikacije.");
    setEnroll(null);
    setCode("");
    await load();
    onEnrolled?.();
  }

  async function remove(id: string) {
    if (!confirm("Isključiti dvofaktorsku prijavu za ovaj račun?")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) setError(error.message.includes("aal2") ? "Za isključivanje se najprije prijavite s kodom iz aplikacije (odjavite se i prijavite ponovno)." : error.message);
    await load();
  }

  const verified = (factors ?? []).filter((f) => f.status === "verified");
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-brand-ink" />
        <h2 className="flex-1 font-display font-semibold">Dvofaktorska prijava (2FA)</h2>
        {verified.length > 0 && <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">Uključena</span>}
      </div>
      <p className="mb-3 text-sm text-muted">Uz kod s e-maila traži se i šesteroznamenkasti kod iz aplikacije na mobitelu (Microsoft Authenticator, Google Authenticator…).</p>
      {factors === null ? (
        <p className="text-sm text-muted">Učitavam…</p>
      ) : enroll ? (
        <div className="space-y-3">
          <p className="text-sm">1. U aplikaciji dodajte račun skeniranjem koda:</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enroll.qr} alt="QR kod za aplikaciju" className="h-44 w-44 rounded-md bg-white p-2" />
          <p className="text-xs text-muted">
            Ili ručno upišite ključ: <code className="break-all">{enroll.secret}</code>
          </p>
          <p className="text-sm">2. Upišite kod koji aplikacija pokazuje:</p>
          <div className="flex gap-2">
            <input className={inputClass} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
            <Button size="sm" disabled={busy || code.length !== 6} onClick={() => void verify()}>
              Potvrdi
            </Button>
          </div>
        </div>
      ) : verified.length ? (
        <ul className="space-y-1 text-sm">
          {verified.map((f) => (
            <li key={f.id} className="flex items-center gap-2">
              <span className="flex-1">{f.friendly_name ?? "Aplikacija"}</span>
              <Button size="sm" variant="ghost" onClick={() => void remove(f.id)}>
                <Trash2 className="h-4 w-4" /> Isključi
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <Button size="sm" disabled={busy} onClick={() => void start()}>
          Uključi 2FA
        </Button>
      )}
      {error && (
        <div className="mt-3">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
    </Card>
  );
}
