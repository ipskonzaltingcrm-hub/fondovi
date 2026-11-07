"use client";

import * as React from "react";
import { Mail, ArrowRight, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<"idle" | "slanje" | "poslano" | "greska">("idle");
  const [message, setMessage] = React.useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("slanje");
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (error) {
      setState("greska");
      setMessage(error.message);
    } else {
      setState("poslano");
    }
  }

  if (state === "poslano") {
    return (
      <div className="rounded-lg border border-border bg-surface-2 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h3 className="font-display text-base font-semibold">Provjerite email</h3>
        <p className="mt-1.5 text-sm text-muted">
          Poslali smo poveznicu za prijavu na{" "}
          <span className="font-medium text-foreground">{email}</span>. Otvorite je
          na ovom uređaju da dovršite prijavu.
        </p>
        <button
          onClick={() => setState("idle")}
          className="mt-4 text-sm font-medium text-brand-ink hover:underline"
        >
          Pošalji ponovno ili promijeni email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-7 space-y-4">
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

      {state === "greska" && (
        <p className="flex items-start gap-1.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {message || "Prijava nije uspjela. Pokušajte ponovno."}
        </p>
      )}

      <button
        type="submit"
        disabled={state === "slanje"}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-brand-contrast transition-colors hover:bg-brand-ink disabled:opacity-60"
      >
        {state === "slanje" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Šaljem…
          </>
        ) : (
          <>
            Pošalji poveznicu za prijavu <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
