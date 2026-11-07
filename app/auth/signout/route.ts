import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Odjava: briše sesiju i vraća na /login. */
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
