import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, requestOrigin } from "@/lib/crm/session";
import type { StaffRole } from "@/lib/crm/roles";
import { TeamView, type Invitation, type Member } from "./team-view";

export const metadata = { title: "Tim i uloge" };

export default async function TimPage({ searchParams }: PageProps<"/crm/tim">) {
  const me = await requireStaff();
  const sp = await searchParams;
  const rawId = Array.isArray(sp.id) ? sp.id[0] : sp.id;
  const selectedId = rawId === "ja" ? me.id : (rawId ?? null);

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("profiles")
    .select("id,email,full_name,short_name,job_title,phone,staff_role,staff_active,staff_since")
    .not("staff_role", "is", null)
    .order("staff_active", { ascending: false })
    .order("full_name");

  const members: Member[] = (rows ?? []).map((r) => ({
    id: r.id,
    email: r.email ?? "",
    name: r.full_name || r.email || "",
    shortName: r.short_name,
    jobTitle: r.job_title,
    phone: r.phone,
    role: r.staff_role as StaffRole,
    active: r.staff_active,
    since: r.staff_since,
  }));

  let invitations: Invitation[] = [];
  if (me.isAdmin) {
    const { data: inv } = await supabase
      .from("crm_invitations")
      .select("id,email,full_name,role,token,created_at,expires_at,created_by")
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    const names = new Map(members.map((m) => [m.id, m.name]));
    invitations = (inv ?? []).map((i) => ({
      id: i.id,
      email: i.email,
      name: i.full_name,
      role: i.role as StaffRole,
      token: i.token,
      createdAt: i.created_at,
      expiresAt: i.expires_at,
      expired: new Date(i.expires_at) < new Date(),
      invitedBy: (i.created_by && names.get(i.created_by)) || "—",
    }));
  }

  return (
    <>
      <PageHeader
        title="Tim i uloge"
        description="Članovi tima EU Radar CRM-a, pozivnice i ovlasti. Prava se provode u bazi, ne samo skrivanjem u izborniku."
      />
      <TeamView
        me={{ id: me.id, role: me.role, isAdmin: me.isAdmin, isSuperadmin: me.isSuperadmin }}
        members={members}
        invitations={invitations}
        selectedId={selectedId}
        origin={await requestOrigin()}
      />
    </>
  );
}
