import Link from "next/link";
import { LogoMark } from "@/components/layout/logo";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL, type StaffRole } from "@/lib/crm/roles";
import { fmtDateTime } from "@/lib/crm/format";
import { AcceptForm } from "./accept-form";

export const metadata = { title: "Pozivnica · EU Radar CRM" };

type Info = { email: string; full_name: string | null; role: StaffRole; status: string; expires_at: string };

const STATUS_TEXT: Record<string, string> = {
  opozvana: "Ova pozivnica je opozvana. Zatražite novu od administratora.",
  iskoristena: "Ova pozivnica je već iskorištena.",
  istekla: "Ova pozivnica je istekla. Zatražite novu od administratora.",
};

export default async function PozivnicaPage({ searchParams }: PageProps<"/crm/pozivnica">) {
  const raw = (await searchParams).token;
  const token = Array.isArray(raw) ? raw[0] : (raw ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = token ? await supabase.rpc("crm_invitation_info", { p_token: token }) : { data: null };
  const info = (Array.isArray(data) ? data[0] : null) as Info | null;
  const sameEmail = info && user?.email && info.email.toLowerCase() === user.email.toLowerCase();

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-9 w-9" />
          <span className="font-display text-base font-bold">
            <span className="text-brand-ink">EU</span> Radar CRM
          </span>
        </div>

        {!info ? (
          <>
            <h1 className="mt-6 font-display text-xl font-bold">Pozivnica nije pronađena</h1>
            <p className="mt-2 text-sm text-muted">Provjerite jeste li otvorili cijelu poveznicu iz pozivnice.</p>
          </>
        ) : (
          <>
            <h1 className="mt-6 font-display text-xl font-bold">Pozivnica u tim</h1>
            <p className="mt-2 text-sm text-muted">
              {info.full_name ? `${info.full_name}, pozvani` : "Pozvani"} ste u tim EU Radar CRM-a kao{" "}
              <b className="text-foreground">{ROLE_LABEL[info.role]}</b>.
            </p>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md bg-surface-2 p-3 text-sm">
              <dt className="text-muted-2">Adresa</dt>
              <dd className="font-medium">{info.email}</dd>
              <dt className="text-muted-2">Vrijedi do</dt>
              <dd>{fmtDateTime(info.expires_at)}</dd>
            </dl>

            {info.status !== "vrijedi" ? (
              <p className="mt-4 rounded-md bg-warning-soft px-3 py-2 text-sm">{STATUS_TEXT[info.status]}</p>
            ) : !sameEmail ? (
              <div className="mt-4 space-y-3 text-sm">
                <p className="rounded-md bg-warning-soft px-3 py-2">
                  Prijavljeni ste kao <b>{user?.email}</b>, a pozivnica glasi na <b>{info.email}</b>. Odjavite se i
                  prijavite adresom iz pozivnice.
                </p>
                <form action="/auth/signout" method="post">
                  <button className="h-9 rounded-md border border-border px-4 hover:bg-surface-2">Odjava</button>
                </form>
              </div>
            ) : (
              <AcceptForm token={token} />
            )}
          </>
        )}

        <p className="mt-6 text-center text-xs text-muted-2">
          <Link href="/dashboard" className="hover:underline">
            Natrag na EU Radar
          </Link>
        </p>
      </div>
    </div>
  );
}
