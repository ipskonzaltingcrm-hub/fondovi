import { Logo } from "@/components/layout/logo";

export const metadata = { title: "Pristup je onemogućen" };

export default function BlokiranPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <Logo className="mb-6 justify-center" />
        <h1 className="font-display text-xl font-bold">Pristup je onemogućen</h1>
        <p className="mt-2 text-sm text-muted">Vaš pristup EU Radaru trenutno nije aktivan. Za pomoć se javite timu IPS Konzaltinga.</p>
        <form action="/auth/signout" method="post" className="mt-6">
          <button type="submit" className="text-sm font-medium text-brand-ink hover:underline">
            Odjava
          </button>
        </form>
      </div>
    </div>
  );
}
