"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { acceptInvitation, type AcceptState } from "./actions";

export function AcceptForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(acceptInvitation, {});
  return (
    <form action={action} className="mt-5 space-y-3">
      <input type="hidden" name="token" value={token} />
      {state.error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-brand-contrast hover:bg-brand-deep disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Prihvati pozivnicu
      </button>
    </form>
  );
}
