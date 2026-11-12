import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { EmailPrefs } from "./email-prefs";

export const metadata = { title: "Postavke" };

export default async function PostavkePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: prefs } = user
    ? await supabase.from("crm_email_prefs").select("tjedni_pregled").eq("user_id", user.id).maybeSingle()
    : { data: null };
  return (
    <div>
      <PageHeader title="Postavke" description="Vaše obavijesti e-mailom." />
      <EmailPrefs weekly={prefs?.tjedni_pregled !== false} email={user?.email ?? ""} />
    </div>
  );
}
