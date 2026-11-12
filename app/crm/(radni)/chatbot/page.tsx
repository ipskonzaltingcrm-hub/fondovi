import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { requestOrigin, requireStaff } from "@/lib/crm/session";
import { hasApiKey } from "@/lib/crm/chatbot";
import { DEFAULT_SETTINGS, type ChatBrain, type ChatSettings } from "@/lib/crm/chatbot-shared";
import { ChatbotView, type Conversation, type ChatMessage } from "./chatbot-view";

export const metadata = { title: "Chatbot brain" };

export default async function ChatbotPage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [{ data: settings }, { data: convs }, { data: msgs }] = await Promise.all([
    supabase.from("crm_settings").select("key,value").in("key", ["chatbot", "chatbot_brain"]),
    supabase
      .from("crm_chat_conversations")
      .select("id,created_at,last_at,izvor,test,pitanja,cost_usd,kontakt,lead_id,reviewed_at")
      .order("last_at", { ascending: false })
      .limit(300),
    supabase.from("crm_chat_messages").select("conversation_id,role,content,at").order("id").limit(5000),
  ]);
  const map = Object.fromEntries((settings ?? []).map((r) => [r.key as string, r.value]));
  return (
    <>
      <PageHeader
        title="Chatbot brain"
        description="Javni AI asistent EU Radara: upute, postavke, razgovori i zahtjevi za kontakt. Kad posjetitelj ostavi kontakt, u CRM-u nastaje lead sa zadatkom „Nazovi“."
      />
      <ChatbotView
        settings={{ ...DEFAULT_SETTINGS, ...((map.chatbot as Partial<ChatSettings>) ?? {}) }}
        brain={{ o_nama: "", usluge: "", cijene: "", ton: "", pravila: "", kontakt: "", faq: "", dodatno: "", ...((map.chatbot_brain as Partial<ChatBrain>) ?? {}) }}
        conversations={(convs ?? []) as Conversation[]}
        messages={(msgs ?? []) as ChatMessage[]}
        hasKey={hasApiKey()}
        isAdmin={me.isAdmin}
        origin={await requestOrigin()}
        monthStart={monthStart.toISOString()}
      />
    </>
  );
}
