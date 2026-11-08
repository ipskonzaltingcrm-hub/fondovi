"use client";

import * as React from "react";
import {
  Mail,
  ArrowRight,
  Loader2,
  AlertCircle,
  KeyRound,
  ArrowLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Step = "email" | "kod";

export function LoginForm() {
  const [step, setStep] = React.useState<Step>("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  // 1) Pošalji 6-znamenkasti kod na email
  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setBusy(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: value,
      options: {
        shouldCreateUser: true,
        // Poveznica ostaje kao rezerva; glavni način je kod iz maila.
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    setBusy(false);
    if (error) {
      setError(error.message);
    } else {
      setStep("kod");
    }
  }

  // 2) Provjeri kod i prijavi se
  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    const token = code.trim();
    if (token.length < 6) return;
    setBusy(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    });

    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    // Puna navigacija da proxy vidi novu sesiju iz kolačića.
    window.location.href = "/dashboard";
  }

  /* ---------------------------- Korak 2: unos koda ---------------------------- */
  if (step === "kod") {
    return (
      <form onSubmit={verifyCode} className="mt-7 space-y-4">
        <div className="rounded-lg border border-border bg-surface-2 p-4 text-sm text-muted">
          Poslali smo <span className="font-medium text-foreground">6-znamenkasti kod</span> na{" "}
          <span className="font-medium text-foreground">{email}</span>. Upišite ga
          ispod. (Provjerite i spam/neželjenu poštu.)
        </div>

        <div>
          <label htmlFor="code" className="mb-1.5 block text-sm font-medium">
            Kod za prijavu
          </label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              autoFocus
              className="h-11 w-full rounded-md border border-border bg-background pl-9 pr-3 text-lg tracking-[0.3em] tabular outline-none placeholder:tracking-normal placeholder:text-muted-2 focus:border-brand focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>

        {error && (
          <p className="flex items-start gap-1.5 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error || "Kod nije ispravan ili je istekao. Zatražite novi."}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || code.length < 6}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-brand-contrast transition-colors hover:bg-brand-ink disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Provjeravam…
            </>
          ) : (
            <>
              Prijavi se <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setStep("email");
            setCode("");
            setError("");
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Natrag / promijeni email
        </button>
      </form>
    );
  }

  /* --------------------------- Korak 1: unos emaila --------------------------- */
  return (
    <form onSubmit={sendCode} className="mt-7 space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Email
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ime@grad-primjer.hr"
            className="h-11 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-2 focus:border-brand focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </div>

      {error && (
        <p className="flex items-start gap-1.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error || "Slanje nije uspjelo. Pokušajte ponovno."}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-brand-contrast transition-colors hover:bg-brand-ink disabled:opacity-60"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Šaljem…
          </>
        ) : (
          <>
            Pošalji kod za prijavu <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
