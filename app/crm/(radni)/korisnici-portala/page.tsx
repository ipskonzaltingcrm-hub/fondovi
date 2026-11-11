import { PageHeader } from "@/components/layout/page-header";
import { Empty } from "@/components/crm/ui";
import { createClient } from "@/lib/supabase/server";
import { requestOrigin, requireStaff } from "@/lib/crm/session";
import { getServices } from "@/lib/crm/data";
import { todayZg } from "@/lib/crm/dates";
import { PortalView, type Invite, type Payment, type PortalUser, type Subscription, type ClientLite } from "./portal-view";

export const metadata = { title: "Korisnici portala" };

export default async function KorisniciPortalaPage() {
  const me = await requireStaff();
  if (me.role === "suradnik") {
    return (
      <>
        <PageHeader title="Korisnici portala" />
        <Empty title="Korisnike EU Radara vode konzultanti i administratori" />
      </>
    );
  }
  const supabase = await createClient();
  const [{ data: users }, { data: clients }, { data: subs }, { data: pays }, { data: invites }, { data: reg }, services] = await Promise.all([
    supabase.rpc("crm_portal_users"),
    supabase.from("jls_profiles").select("id,naziv,klijent_tip,status").order("naziv"),
    supabase.from("crm_subscriptions").select("id,jls_profile_id,service_id,paket,od,do,iznos,status,napomena,created_at").order("do", { ascending: false }),
    supabase.from("crm_payments").select("id,jls_profile_id,subscription_id,iznos,datum,nacin,napomena,created_at").order("datum", { ascending: false }).limit(300),
    supabase
      .from("crm_portal_invites")
      .select("id,email,jls_profile_id,role,token,created_at,expires_at,accepted_at,revoked_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("crm_settings").select("value").eq("key", "registration").maybeSingle(),
    getServices(),
  ]);
  await supabase.rpc("crm_mark_seen", { p_key: "korisnici" });

  return (
    <>
      <PageHeader
        title="Korisnici portala"
        description="Korisnici aplikacije EU Radar: pristup klijentima, pozivnice, pretplate i uplate te kontrola registracije."
      />
      <PortalView
        users={(users ?? []) as PortalUser[]}
        clients={(clients ?? []) as ClientLite[]}
        subscriptions={(subs ?? []) as Subscription[]}
        payments={(pays ?? []) as Payment[]}
        invites={(invites ?? []) as Invite[]}
        registration={((reg?.value as { mode?: string } | null)?.mode ?? "otvorena") as "otvorena" | "pozivnica"}
        services={services.filter((s) => s.kategorija === "pretplata" && s.aktivan)}
        isAdmin={me.isAdmin}
        origin={await requestOrigin()}
        today={todayZg()}
      />
    </>
  );
}
