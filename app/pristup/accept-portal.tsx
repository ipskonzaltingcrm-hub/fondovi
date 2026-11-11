"use client";

import * as React from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { acceptPortalInvite } from "./actions";

export function AcceptPortal({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptPortalInvite.bind(null, token), null as { error?: string } | null);
  return (
    <form action={action} className="mt-6 space-y-3">
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Prihvaćam…" : "Prihvati pozivnicu"}
      </Button>
      {state?.error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
    </form>
  );
}
