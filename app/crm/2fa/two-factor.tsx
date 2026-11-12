"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MfaCard } from "@/components/crm/mfa-card";
import { inputClass } from "@/components/crm/ui";
import { createClient } from "@/lib/supabase/client";

export function TwoFactor({ mode }: { mode: "challenge" | "setup" }) {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function verify() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    const f = data?.totp?.find((x) => x.status === "verified");
    if (!f) {
      setBusy(false);
      return setError("Nema postavljene aplikacije za 2FA.");
    }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: f.id, code: code.trim() });
    setBusy(false);
    if (error) return setError("Kod nije ispravan.");
    router.replace("/crm");
    router.refresh();
  }

  if (mode === "setup") {
    return (
      <div className="space-y-3">
        <Card className="p-4 text-sm">
          <b>Dvofaktorska prijava je obavezna za tim.</b> Postavite aplikaciju za kodove da biste nastavili u CRM.
        </Card>
        <MfaCard
          onEnrolled={() => {
            router.replace("/crm");
            router.refresh();
          }}
        />
        <form action="/auth/signout" method="post" className="text-center">
          <button className="text-sm text-muted hover:underline">Odjava</button>
        </form>
      </div>
    );
  }
  return (
    <Card className="space-y-3 p-6">
      <h1 className="font-display text-xl font-bold">Kod iz aplikacije</h1>
      <p className="text-sm text-muted">Upišite šesteroznamenkasti kod iz aplikacije za autentifikaciju.</p>
      <input
        autoFocus
        className={inputClass}
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => e.key === "Enter" && code.length === 6 && void verify()}
        placeholder="123456"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button className="w-full" disabled={busy || code.length !== 6} onClick={() => void verify()}>
        Potvrdi
      </Button>
      <form action="/auth/signout" method="post" className="text-center">
        <button className="text-sm text-muted hover:underline">Odjava</button>
      </form>
    </Card>
  );
}
