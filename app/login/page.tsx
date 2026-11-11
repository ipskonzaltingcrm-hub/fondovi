import { Radar, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Prijava" };

const points = [
  "Svi EU i nacionalni natječaji za JLS na jednom mjestu",
  "Automatsko praćenje rokova i novih poziva",
  "Po svakom JLS-u: na koje se natječaje može prijaviti",
];

/** Dopušta samo lokalnu putanju (sprječava otvoreno preusmjeravanje na tuđe domene). */
function safeNext(v: string | string[] | undefined): string {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNext((await searchParams).next);
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex"
        style={{ background: "linear-gradient(150deg, #0b1f4d 0%, #0a1430 55%, #070c1c 100%)" }}
      >
        <div className="bg-grid absolute inset-0 opacity-40" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-2.5 text-white">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
              <Radar className="h-5 w-5 text-brand-contrast" />
            </div>
            <span className="font-display text-base font-bold">
              EU <span className="text-brand-bright">Radar</span>
            </span>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight">
            Nijedan natječaj za vaše gradove i općine više neće proći neopaženo.
          </h1>
          <ul className="mt-7 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-white/80">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-bright" />
                <span className="text-sm">{p}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs text-white/40">
          © {new Date().getFullYear()} IPS Konzalting · fondovi.ips-konzalting.hr
        </div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Prijava
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            Unesite službeni email vaše organizacije.
          </p>

          <LoginForm next={next} />

          <p className="mt-4 text-center text-xs text-muted-2">
            Bez lozinke — na email dobivate jednokratni kod za prijavu.
          </p>
        </div>
      </div>
    </div>
  );
}
