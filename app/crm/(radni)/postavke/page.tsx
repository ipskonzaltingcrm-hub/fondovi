import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { getSettings } from "@/lib/crm/data";
import { hasApiKey } from "@/lib/crm/chatbot";
import { SettingsView } from "./settings-view";

export const metadata = { title: "Postavke" };

export default async function PostavkePage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const [settings, { data: rows }] = await Promise.all([
    getSettings(),
    supabase.from("crm_settings").select("key,value").in("key", ["registration", "security", "chatbot"]),
  ]);
  const map = Object.fromEntries((rows ?? []).map((r) => [r.key as string, r.value as Record<string, unknown>]));
  return (
    <>
      <PageHeader title="Postavke" description="Podaci tvrtke, sigurnost i integracije na jednom mjestu, s poveznicama na kartice u kojima se pojedine postavke uređuju." />
      <SettingsView
        company={settings.company}
        registration={(map.registration?.mode as string) ?? "otvorena"}
        mfaRequired={!!map.security?.mfa_required}
        chatbotEnabled={!!map.chatbot?.enabled}
        integrations={{
          claude: hasApiKey(),
          serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        }}
        me={{ isAdmin: me.isAdmin, isSuperadmin: me.isSuperadmin }}
      />
    </>
  );
}
