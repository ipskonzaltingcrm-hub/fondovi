import { Logo } from "@/components/layout/logo";
import { createClient } from "@/lib/supabase/server";
import { AcceptPortal } from "./accept-portal";

export const metadata = { title: "Pozivnica" };

const STATUS_TEXT: Record<string, string> = {
  opozvana: "Ova pozivnica je opozvana. Zatražite novu od tima IPS Konzaltinga.",
  iskoristena: "Ova pozivnica je već iskorištena.",
  istekla: "Ova pozivnica je istekla. Zatražite novu od tima IPS Konzaltinga.",
};

/** Pozivnica korisniku klijenta (iz CRM-a → Korisnici portala). Ruta je zaštićena: bez prijave vodi na prijavu i vraća ovamo. */
export default async function PristupPage({ searchParams }: PageProps<"/pristup">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = token ? await supabase.rpc("crm_portal_invite_info", { p_token: token }) : { data: null };
  const info = data as { email: string; naziv: string; status: string } | null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
        <Logo className="mb-6" />
        {!info ? (
          <p className="text-sm">Pozivnica ne postoji. Provjerite poveznicu.</p>
        ) : (
          <>
            <h1 className="font-display text-xl font-bold">Pristup EU Radaru za {info.naziv}</h1>
            <p className="mt-2 text-sm text-muted">
              Pozivnica je poslana na <b>{info.email}</b>. Prijavljeni ste kao <b>{user?.email}</b>.
            </p>
            {info.status !== "vrijedi" ? (
              <p className="mt-4 rounded-md bg-warning-soft px-3 py-2 text-sm">{STATUS_TEXT[info.status]}</p>
            ) : (
              <AcceptPortal token={token} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
