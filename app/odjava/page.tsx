import { Logo } from "@/components/layout/logo";
import { UnsubscribeForm } from "./unsubscribe-form";

export const metadata = { title: "Odjava od e-mailova", robots: { index: false, follow: false } };

/** Odjava od tjednog pregleda natječaja (poveznica iz e-maila) — bez prijave, potvrda gumbom. */
export default async function OdjavaPage({ searchParams }: PageProps<"/odjava">) {
  const sp = await searchParams;
  const t = typeof sp.t === "string" && /^[0-9a-f-]{36}$/i.test(sp.t) ? sp.t : null;
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-12">
        <Logo className="mb-8" />
        <h1 className="font-display text-2xl font-bold tracking-tight">Odjava od e-mailova EU Radara</h1>
        {t ? (
          <UnsubscribeForm token={t} />
        ) : (
          <p className="mt-4 text-sm text-muted">Poveznica nije ispravna. Obavijesti možete isključiti i nakon prijave, u Postavkama EU Radara.</p>
        )}
      </div>
    </div>
  );
}
