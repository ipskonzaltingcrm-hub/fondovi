import { notFound } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { createClient } from "@/lib/supabase/server";
import { PublicForm } from "./public-form";

export const metadata = { title: "Upitnik" };

/** Javni upitnik (lead magnet): bez prijave; predaja stvara lead u EU Radar CRM-u. */
export default async function UpitnikPage({ params }: PageProps<"/upitnik/[token]">) {
  const { token } = await params;
  if (!/^[0-9a-f]{32,128}$/i.test(token)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("crm_form_info", { p_token: token });
  const info = data as { naziv: string; uvod: string | null; active: boolean } | null;
  if (!info) notFound();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Logo className="mb-8" />
        <h1 className="font-display text-3xl font-bold tracking-tight">{info.naziv}</h1>
        {info.uvod && <p className="mt-2 text-muted">{info.uvod}</p>}
        {info.active ? (
          <PublicForm token={token} />
        ) : (
          <p className="mt-8 rounded-md border border-border bg-surface p-4 text-sm">Ovaj upitnik trenutno nije dostupan.</p>
        )}
        <p className="mt-10 text-xs text-muted-2">EU Radar · IPS Konzalting. Podatke koristimo isključivo za odgovor na vaš upit.</p>
      </div>
    </div>
  );
}
