import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { KlijentForm } from "@/components/klijenti/klijent-form";

export const metadata = { title: "Novi klijent" };

export default function NoviKlijentPage() {
  return (
    <div>
      <Link
        href="/klijenti"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Natrag na klijente
      </Link>

      <PageHeader
        title="Novi klijent"
        description="Dodajte pretplatnika — JLS, poduzeće ili istraživačku instituciju. Profil određuje na koje se natječaje može prijaviti."
      />

      <Card className="p-6">
        <KlijentForm />
      </Card>
    </div>
  );
}
