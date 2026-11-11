import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin,full_name,staff_role,staff_active,portal_blocked_at")
    .eq("id", user.id)
    .maybeSingle();
  // Korisnik kojeg je tim blokirao (CRM → Korisnici portala) ne koristi aplikaciju.
  if (profile?.portal_blocked_at && !profile.staff_role && !profile.is_superadmin) redirect("/blokiran");

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          userEmail={user.email ?? ""}
          isSuperadmin={profile?.is_superadmin ?? false}
          isStaff={Boolean(profile?.staff_role && profile.staff_active)}
        />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-6xl animate-fade-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
