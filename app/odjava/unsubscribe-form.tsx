"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { unsubscribe } from "./actions";

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, setState] = React.useState<{ done: boolean; error?: string; email?: string } | null>(null);
  const [pending, start] = React.useTransition();
  if (state?.done)
    return (
      <p className="mt-4 rounded-md border border-border bg-surface p-4 text-sm">
        Odjavljeni ste{state.email ? <> (<b>{state.email}</b>)</> : null}. Više nećete primati tjedni pregled natječaja. Ponovno ga možete uključiti u Postavkama EU
        Radara.
      </p>
    );
  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-muted">Potvrdite da više ne želite primati tjedni pregled natječaja e-mailom.</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => start(async () => setState(await unsubscribe(token, false)))}>
          Odjavi tjedni pregled
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => start(async () => setState(await unsubscribe(token, true)))}>
          Odjavi sve e-mail obavijesti
        </Button>
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </div>
  );
}
