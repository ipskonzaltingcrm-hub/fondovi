"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import { saveMyEmailPrefs } from "@/lib/crm/actions/email";

export function EmailPrefs({ weekly, email }: { weekly: boolean; email: string }) {
  const router = useRouter();
  const [on, setOn] = React.useState(weekly);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <Card className="max-w-xl space-y-3 p-5">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-brand-ink" />
        <h2 className="font-display font-semibold">Tjedni pregled natječaja</h2>
      </div>
      <p className="text-sm text-muted">
        Svakog ponedjeljka ujutro šaljemo pregled novih natječaja za vaše profile i natječaja kojima rok uskoro ističe{email ? ` na ${email}` : ""}.
      </p>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={on}
          disabled={pending}
          onChange={(e) => {
            const v = e.target.checked;
            setOn(v);
            start(async () => {
              const r = await saveMyEmailPrefs({ tjedni_pregled: v });
              setMsg(r.ok ? (v ? "Tjedni pregled je uključen." : "Tjedni pregled je isključen.") : r.error);
              router.refresh();
            });
          }}
        />
        Želim primati tjedni pregled e-mailom
      </label>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </Card>
  );
}
