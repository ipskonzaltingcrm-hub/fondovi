import { PageHeader } from "@/components/layout/page-header";
import { Empty } from "@/components/crm/ui";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { todayZg } from "@/lib/crm/dates";
import { AiCostView, type UsageRow } from "./ai-cost-view";

export const metadata = { title: "Trošak AI-ja" };

export default async function TrosakAiPage() {
  const me = await requireStaff();
  if (!me.isAdmin) {
    return (
      <>
        <PageHeader title="Trošak AI-ja" />
        <Empty title="Ovu karticu vide samo administratori" />
      </>
    );
  }
  const supabase = await createClient();
  const [{ data }, { data: credit }] = await Promise.all([
    supabase.from("crm_ai_usage").select("id,at,modul,opis,model,input_tokens,output_tokens,cost_usd,ref").order("at", { ascending: false }).limit(5000),
    supabase.from("crm_settings").select("value").eq("key", "claude_credit").maybeSingle(),
  ]);
  return (
    <>
      <PageHeader title="Trošak AI-ja" description="Potrošnja na Claude API (USD) po modulu i po stavci. Zasad AI koristi samo chatbot; novi moduli upisuju se ovdje automatski." />
      <AiCostView cur={todayZg().slice(0, 7)} rows={(data ?? []) as UsageRow[]} credit={((credit?.value as { usd?: number | null } | null)?.usd ?? null) as number | null} />
    </>
  );
}
