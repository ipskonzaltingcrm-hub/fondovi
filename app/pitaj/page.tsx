import { Logo } from "@/components/layout/logo";
import { ChatBox } from "./chat-box";

export const metadata = { title: "Pitaj EU Radar" };

/** Javni AI asistent (bez prijave). ?izvor= bilježi odakle je posjetitelj došao; ?test=1 je testni razgovor tima. */
export default async function PitajPage({ searchParams }: PageProps<"/pitaj">) {
  const sp = await searchParams;
  const izvor = typeof sp.izvor === "string" ? sp.izvor.slice(0, 50) : "web";
  const embed = sp.embed === "1";
  return (
    <div className={embed ? "h-screen bg-background" : "min-h-screen bg-background"}>
      <div className={embed ? "flex h-full flex-col" : "mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8"}>
        {!embed && <Logo className="mb-6" />}
        <ChatBox izvor={izvor} test={sp.test === "1"} embed={embed} />
      </div>
    </div>
  );
}
