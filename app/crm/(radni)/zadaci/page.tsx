import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { TASK_COLS, getTaskRefs, type Task } from "@/lib/crm/data";
import { addDays, todayZg } from "@/lib/crm/dates";
import { TasksView } from "./tasks-view";

export const metadata = { title: "Zadaci" };

/** Dovršeni zadaci prikazuju se 60 dana; stariji ostaju u povijesti zapisa. */
const DONE_WINDOW_DAYS = 60;

export default async function ZadaciPage({ searchParams }: PageProps<"/crm/zadaci">) {
  const me = await requireStaff();
  const sp = await searchParams;
  const today = todayZg();
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_tasks")
    .select(TASK_COLS)
    .is("archived_at", null)
    .or(`done_at.is.null,done_at.gte.${addDays(today, -DONE_WINDOW_DAYS)}`)
    .order("rok", { ascending: true, nullsFirst: false })
    .limit(2000);
  const refs = await getTaskRefs();
  const open = typeof sp.zadatak === "string" ? sp.zadatak : null;

  return (
    <>
      <PageHeader
        title="Zadaci"
        description="Zadaci s rokom i vlasnikom, povezani s leadom, klijentom ili natječajem iz EU Radara."
      />
      <TasksView
        tasks={(data ?? []) as unknown as Task[]}
        refs={refs}
        me={{ id: me.id, role: me.role }}
        today={today}
        openId={open}
      />
    </>
  );
}
