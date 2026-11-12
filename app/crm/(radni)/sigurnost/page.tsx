import { PageHeader } from "@/components/layout/page-header";
import { MfaCard } from "@/components/crm/mfa-card";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import type { StaffRole } from "@/lib/crm/roles";
import { SecurityView, type SessionRow, type TeamRow } from "./security-view";

export const metadata = { title: "Sigurnost" };

export default async function SigurnostPage({ searchParams }: PageProps<"/crm/sigurnost">) {
  const me = await requireStaff();
  const sp = await searchParams;
  const clan = (Array.isArray(sp.clan) ? sp.clan[0] : sp.clan) ?? null;
  const supabase = await createClient();

  const { data: mine } = await supabase.rpc("crm_session_list", { p_user: null });

  let team: TeamRow[] = [];
  let memberSessions: SessionRow[] | null = null;
  if (me.isAdmin) {
    const { data } = await supabase.rpc("crm_team_security");
    team = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.user_id as string,
      name: (r.full_name as string) || (r.email as string),
      email: r.email as string,
      role: r.staff_role as StaffRole,
      active: r.staff_active as boolean,
      lastSeen: (r.last_seen as string) ?? null,
      activeSessions: (r.active_sessions as number) ?? 0,
    }));
    if (clan && clan !== me.id) {
      const { data: s } = await supabase.rpc("crm_session_list", { p_user: clan });
      memberSessions = (s ?? []) as SessionRow[];
    }
  }

  return (
    <>
      <PageHeader
        title="Sigurnost"
        description="Dvofaktorska prijava, uređaji na kojima su otvorene tvoje prijave i tko se iz tima kada prijavio."
      />
      <div className="mb-4">
        <MfaCard />
      </div>
      <SecurityView
        me={{ id: me.id, isAdmin: me.isAdmin, isSuperadmin: me.isSuperadmin }}
        mine={(mine ?? []) as SessionRow[]}
        team={team}
        selectedMember={clan && clan !== me.id ? (team.find((t) => t.id === clan) ?? null) : null}
        memberSessions={memberSessions}
      />
    </>
  );
}
