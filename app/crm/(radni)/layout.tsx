import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CrmSidebar } from "@/components/crm/crm-sidebar";
import { CrmTopbar } from "@/components/crm/crm-topbar";
import { requireStaff } from "@/lib/crm/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: { default: "EU Radar CRM", template: "%s · EU Radar CRM" },
};

export default async function CrmLayout({ children }: LayoutProps<"/crm">) {
  const me = await requireStaff();

  // Dvofaktorska prijava: tko ima 2FA mora upisati kod; kad je 2FA obavezna, tko je nema mora je postaviti.
  const supa = await createClient();
  const [{ data: aal }, { data: sec }] = await Promise.all([
    supa.auth.mfa.getAuthenticatorAssuranceLevel(),
    supa.from("crm_settings").select("value").eq("key", "security").maybeSingle(),
  ]);
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") redirect("/crm/2fa");
  if ((sec?.value as { mfa_required?: boolean } | null)?.mfa_required && aal?.nextLevel !== "aal2") redirect("/crm/2fa");

  // Evidencija prijava tima (prva pojava sesije = nova prijava; bilježi se i u Dnevnik).
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  const supabase = await createClient();
  const [, { data: counts }] = await Promise.all([
    supabase.rpc("crm_touch_session", { p_ip: ip, p_user_agent: h.get("user-agent") ?? "" }),
    supabase.rpc("crm_nav_counts"),
  ]);

  return (
    <div className="flex min-h-screen w-full">
      <CrmSidebar isAdmin={me.isAdmin} isSuperadmin={me.isSuperadmin} counts={(counts ?? {}) as Record<string, number>} />
      <div className="flex min-w-0 flex-1 flex-col">
        <CrmTopbar name={me.name} email={me.email} role={me.role} />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-6xl animate-fade-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
