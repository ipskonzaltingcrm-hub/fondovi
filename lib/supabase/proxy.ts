import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Javne rute — ne zahtijevaju prijavu. (/api ima vlastitu zaštitu, npr. CRON_SECRET.) */
const PUBLIC_PREFIXES = ["/login", "/auth", "/api", "/upitnik", "/pitaj", "/ponuda", "/odjava"];

/**
 * Osvježava Supabase sesiju (kolačiće) na svakom zahtjevu i štiti rute.
 * Poziva se iz proxy.ts (Next 16 ex-middleware).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // VAŽNO: getUser() između createServerClient i povratka — osvježava token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  // Neprijavljen korisnik na zaštićenoj ruti → /login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Zadrži i query (npr. token pozivnice u /crm/pozivnica?token=…).
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // Prijavljen korisnik na /login → ?next (samo lokalna putanja) ili /dashboard
  if (user && pathname === "/login") {
    const next = request.nextUrl.searchParams.get("next");
    const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    return NextResponse.redirect(new URL(target, request.url));
  }

  return response;
}
