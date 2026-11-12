import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { createClient } from "@/lib/supabase/server";
import { getCrmMe } from "@/lib/crm/session";
import { TwoFactor } from "./two-factor";

export const metadata = { title: "Dvofaktorska prijava" };

/** Provjera koda iz aplikacije (kad član ima 2FA) ili obavezno postavljanje (kad je 2FA obavezna za tim). */
export default async function TwoFaPage() {
  const me = await getCrmMe();
  if (!me) redirect("/crm/bez-pristupa");
  const supabase = await createClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needsCode = aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4">
        <Logo />
        <TwoFactor mode={needsCode ? "challenge" : "setup"} />
      </div>
    </div>
  );
}
