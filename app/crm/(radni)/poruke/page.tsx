import { PageHeader } from "@/components/layout/page-header";
import { Empty } from "@/components/crm/ui";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { CLIENT_COLS, type ClientRow } from "@/lib/crm/data";
import { one } from "@/lib/crm/clients-util";
import { clientCandidate, evaluate } from "@/lib/crm/matching";
import { getCallBySlug } from "@/lib/data";
import { MessagesView, type Message } from "./messages-view";

export const metadata = { title: "Poruke i newsletter" };

export default async function PorukePage({ searchParams }: PageProps<"/crm/poruke">) {
  const me = await requireStaff();
  if (me.role === "suradnik") {
    return (
      <>
        <PageHeader title="Poruke i newsletter" />
        <Empty title="Poruke korisnicima EU Radara šalju konzultanti i administratori" />
      </>
    );
  }
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: msgs }, { data: clients }, { data: reads }] = await Promise.all([
    supabase.from("crm_messages").select("*").is("archived_at", null).order("created_at", { ascending: false }),
    supabase.from("jls_profiles").select(CLIENT_COLS).order("naziv"),
    supabase.from("crm_message_deliveries").select("message_id,read_at"),
  ]);
  const readStats = new Map<string, { n: number; read: number }>();
  for (const r of reads ?? []) {
    const s = readStats.get(r.message_id) ?? { n: 0, read: 0 };
    s.n += 1;
    if (r.read_at) s.read += 1;
    readStats.set(r.message_id, s);
  }

  // Obavijest o natječaju (iz kartice Natječaji): publika = klijenti koji su prihvatljivi.
  let preset: { naslov: string; tekst: string; link: string; call_id: string; ids: string[] } | null = null;
  if (typeof sp.natjecaj === "string") {
    const { data: call } = await supabase.from("calls").select("id,slug,naslov").eq("id", sp.natjecaj).maybeSingle();
    if (call) {
      const fc = await getCallBySlug(call.slug as string);
      const rows = ((clients ?? []) as unknown as ClientRow[]).map((c) => ({ ...c, crm: one(c.crm) }));
      const ids = fc ? rows.filter((c) => evaluate(fc, clientCandidate(c).jls).verdict !== "nije").map((c) => c.id) : [];
      preset = {
        naslov: `Novi natječaj: ${call.naslov}`,
        tekst: fc ? `${fc.davatelj}${fc.rokPrijave ? ` · rok prijave ${fc.rokPrijave.split("-").reverse().join(". ")}.` : ""}\n\n${fc.sazetak}` : "",
        link: `/pozivi/${call.slug}`,
        call_id: call.id as string,
        ids,
      };
    }
  }

  return (
    <>
      <PageHeader
        title="Poruke i newsletter"
        description="Obavijesti korisnicima EU Radara: stižu u aplikaciju (Obavijesti). Za e-mail iz vlastite pošte izvezi adrese primatelja."
      />
      <MessagesView
        messages={((msgs ?? []) as Message[]).map((m) => ({ ...m, reads: readStats.get(m.id) ?? { n: 0, read: 0 } }))}
        clients={((clients ?? []) as unknown as ClientRow[]).map((c) => ({ id: c.id, naziv: c.naziv }))}
        preset={preset}
      />
    </>
  );
}
