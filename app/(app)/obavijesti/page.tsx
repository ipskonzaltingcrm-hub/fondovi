import { Bell } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Placeholder } from "@/components/layout/placeholder";
import { createClient } from "@/lib/supabase/server";
import { InboxList, type InboxItem } from "./inbox-list";

export const metadata = { title: "Obavijesti" };

/** Poruke tima IPS Konzaltinga korisniku (iz EU Radar CRM-a → Poruke i newsletter). */
export default async function ObavijestiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("crm_message_deliveries")
    .select("message_id,created_at,read_at,message:crm_messages(naslov,tekst,link,vrsta)")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(100);
  const items: InboxItem[] = (data ?? []).map((d) => {
    const m = (Array.isArray(d.message) ? d.message[0] : d.message) as { naslov: string; tekst: string; link: string | null; vrsta: string } | null;
    return { id: d.message_id, at: d.created_at, read: !!d.read_at, naslov: m?.naslov ?? "", tekst: m?.tekst ?? "", link: m?.link ?? null, vrsta: m?.vrsta ?? "obavijest" };
  });

  return (
    <div>
      <PageHeader title="Obavijesti" description="Poruke tima IPS Konzaltinga: novi natječaji za vas, podsjetnici i novosti." />
      {items.length === 0 ? (
        <Placeholder icon={Bell} title="Još nema obavijesti" text="Ovdje će stizati obavijesti o novim natječajima prema vašem profilu i podsjetnici na rokove." />
      ) : (
        <InboxList items={items} />
      )}
    </div>
  );
}
