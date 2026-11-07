import Link from "next/link";
import { Users, MapPin, Sprout, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { jlsList } from "@/lib/mock-data";
import { matchesForJls } from "@/lib/domain";

export const metadata = { title: "Klijenti (JLS)" };

export default function KlijentiPage() {
  return (
    <div>
      <PageHeader
        title="Klijenti (JLS)"
        description="Pretplaćene jedinice lokalne samouprave. Za svaku vidite na koje se natječaje može prijaviti — spremno za razgovor."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {jlsList.map((jls) => {
          const matches = matchesForJls(jls);
          const otvoreni = matches.filter((m) => m.call.status === "otvoren");
          return (
            <Card
              key={jls.id}
              className="group relative p-5 transition-all hover:border-brand hover:shadow-md hover:shadow-black/[0.06]"
            >
              <Link
                href={`/klijenti/${jls.id}`}
                className="absolute inset-0 z-10 rounded-lg"
                aria-label={jls.naziv}
              />
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-soft font-display text-base font-bold text-brand-ink">
                  {jls.naziv.split(" ").slice(-1)[0].slice(0, 2).toUpperCase()}
                </div>
                <Badge
                  tone={
                    jls.status === "aktivan"
                      ? "success"
                      : jls.status === "trial"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {jls.status}
                </Badge>
              </div>

              <h3 className="mt-3 font-display text-base font-semibold tracking-tight">
                {jls.naziv}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {jls.zupanija}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span className="tabular">
                    {jls.stanovnika.toLocaleString("hr-HR")}
                  </span>
                </span>
                {jls.ruralno && (
                  <span className="inline-flex items-center gap-1 text-brand-ink">
                    <Sprout className="h-3 w-3" /> ruralno
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
                <div>
                  <div className="font-display text-2xl font-bold leading-none tabular text-brand-ink">
                    {otvoreni.length}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    otvorenih prilika
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted group-hover:text-brand-ink">
                  Otvori profil{" "}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
