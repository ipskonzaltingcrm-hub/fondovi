import { notFound } from "next/navigation";
import { Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { findNavItem, PHASE_LABEL } from "@/lib/crm/nav";
import { requireStaff } from "@/lib/crm/session";

/** Kartice iz izbornika koje još nisu izgrađene: opis i faza u kojoj stižu. */
export default async function UskoroPage({ params }: PageProps<"/crm/[...kartica]">) {
  const me = await requireStaff();
  const { kartica } = await params;
  const item = findNavItem(`/crm/${kartica.join("/")}`);
  if (!item || item.live) notFound();
  if ((item.adminOnly && !me.isAdmin) || (item.superadminOnly && !me.isSuperadmin)) notFound();

  const Icon = item.icon;
  return (
    <>
      <PageHeader title={item.label} description={item.summary} />
      <Card className="flex items-start gap-4 p-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted-2">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <Badge tone="neutral">
            <Clock className="h-3 w-3" /> {PHASE_LABEL[item.phase]}
          </Badge>
          <p className="mt-2 text-sm text-muted">
            Ova kartica je u planu i dobiva sadržaj u navedenoj fazi. Svaka faza završava pregledom s vlasnicom prije
            nastavka.
          </p>
        </div>
      </Card>
    </>
  );
}
