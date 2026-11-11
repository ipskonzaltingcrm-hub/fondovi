import Link from "next/link";
import { Lock } from "lucide-react";
import { LogoMark } from "@/components/layout/logo";

export const metadata = { title: "Nemate pristup · EU Radar CRM" };

/** Prijavljeni korisnik koji nije (ili više nije) član tima. */
export default function BezPristupa() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <LogoMark className="mx-auto h-10 w-10" />
        <div className="mx-auto mt-5 flex h-10 w-10 items-center justify-center rounded-full bg-surface-2">
          <Lock className="h-5 w-5 text-muted-2" />
        </div>
        <h1 className="mt-4 font-display text-xl font-bold">EU Radar CRM je samo za tim</h1>
        <p className="mt-2 text-sm text-muted">
          Vaš račun nije član tima ili je deaktiviran. Ako ste dobili pozivnicu, otvorite poveznicu iz pozivnice
          dok ste prijavljeni adresom na koju je poslana.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-contrast hover:bg-brand-deep"
          >
            Otvori EU Radar
          </Link>
          <form action="/auth/signout" method="post">
            <button className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm hover:bg-surface-2">
              Odjava
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
