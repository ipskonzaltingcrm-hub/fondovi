import { PageHeader } from "@/components/layout/page-header";
import { CallsExplorer } from "@/components/pozivi/calls-explorer";
import { calls } from "@/lib/mock-data";

export const metadata = { title: "Natječaji" };

export default async function PoziviPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <div>
      <PageHeader
        title="Natječaji"
        description="Svi pozivi za bespovratna sredstva i poticaje relevantni za JLS — lokalna, regionalna, nacionalna i EU razina."
      />
      <CallsExplorer calls={calls} initialQuery={q ?? ""} />
    </div>
  );
}
