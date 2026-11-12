import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { getSettings } from "@/lib/crm/data";
import { hasApiKey } from "@/lib/crm/chatbot";
import { hasEmailKey } from "@/lib/email";
import { DEFAULT_EMAIL, type EmailSettings } from "@/lib/crm/email-jobs";
import { SettingsView, type EmailLogRow } from "./settings-view";
import { EmailSettingsCard } from "./email-settings";

export const metadata = { title: "Postavke" };

export default async function PostavkePage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const [settings, { data: rows }, { data: prefs }, { data: log }] = await Promise.all([
    getSettings(),
    supabase.from("crm_settings").select("key,value").in("key", ["registration", "security", "chatbot", "email"]),
    supabase.from("crm_email_prefs").select("podsjetnici").eq("user_id", me.id).maybeSingle(),
    me.role !== "suradnik"
      ? supabase.from("crm_email_log").select("id,at,vrsta,to_email,subject,status,error").order("at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
  ]);
  const map = Object.fromEntries((rows ?? []).map((r) => [r.key as string, r.value as Record<string, unknown>]));
  const email: EmailSettings = { ...DEFAULT_EMAIL, ...((map.email as Partial<EmailSettings>) ?? {}) };
  return (
    <>
      <PageHeader title="Postavke" description="Podaci tvrtke, sigurnost, e-mail i integracije na jednom mjestu, s poveznicama na kartice u kojima se pojedine postavke uređuju." />
      <div className="space-y-4">
        <SettingsView
          company={settings.company}
          registration={(map.registration?.mode as string) ?? "otvorena"}
          mfaRequired={!!map.security?.mfa_required}
          chatbotEnabled={!!map.chatbot?.enabled}
          integrations={{
            claude: hasApiKey(),
            serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            email: hasEmailKey(),
            emailEnabled: email.enabled,
          }}
          me={{ isAdmin: me.isAdmin, isSuperadmin: me.isSuperadmin }}
        />
        <EmailSettingsCard
          settings={email}
          hasKey={hasEmailKey()}
          myReminders={prefs?.podsjetnici !== false}
          myEmail={me.email}
          isAdmin={me.isAdmin}
          log={(log ?? []) as EmailLogRow[]}
          showLog={me.role !== "suradnik"}
        />
      </div>
    </>
  );
}
