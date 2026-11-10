import { PageHeader } from "@/components/layout/page-header";
import { CallsExplorer } from "@/components/pozivi/calls-explorer";
import { getCalls } from "@/lib/data";

export const metadata = { title: "Natječaji" };

export default async function PoziviPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const calls = await getCalls();

  return (
    <div>
      <PageHeader
        title="Natječaji"
        description="Svi pozivi za bespovratna sredstva i poticaje za JLS, poduzeća i istraživačke institucije — lokalna, regionalna, nacionalna i EU razina."
      />
      <CallsExplorer calls={calls} initialQuery={q ?? ""} />
    </div>
  );
}
