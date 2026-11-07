import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next 16: "proxy" je bivši middleware. Ovdje osvježavamo Supabase sesiju
// i štitimo rute (preusmjeravanje na /login za neprijavljene).
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Pokreni na svemu osim Next internih datoteka i statičkih resursa.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
