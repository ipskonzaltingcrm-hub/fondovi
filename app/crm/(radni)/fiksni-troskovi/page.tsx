import { PageHeader } from "@/components/layout/page-header";
import { Empty } from "@/components/crm/ui";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { FixedCostsView, type FixedCost } from "./fixed-costs-view";

export const metadata = { title: "Fiksni troškovi" };

export default async function FiksniTroskoviPage() {
  const me = await requireStaff();
  if (!me.isAdmin) {
    return (
      <>
        <PageHeader title="Fiksni troškovi" />
        <Empty title="Ovu karticu vide samo administratori" />
      </>
    );
  }
  const supabase = await createClient();
  const { data } = await supabase.from("crm_fixed_costs").select("*").order("kategorija").order("naziv");
  return (
    <>
      <PageHeader title="Fiksni troškovi" description="Ponavljajući operativni troškovi poslovanja (najam, softver, knjigovodstvo…), preračunati na mjesec i godinu." />
      <FixedCostsView costs={(data ?? []) as FixedCost[]} />
    </>
  );
}
