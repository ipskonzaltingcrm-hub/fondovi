import Link from "next/link";
import {
  Users,
  MapPin,
  Sprout,
  ArrowUpRight,
  Plus,
  Building2,
  Factory,
  FlaskConical,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getCalls, getJlsProfiles } from "@/lib/data";
import { matchesForJls } from "@/lib/domain";
import type { Jls, KlijentTip } from "@/lib/types";

export const metadata = { title: "Klijenti" };

const TIP_META: Record<
  KlijentTip,
  { label: string; icon: typeof Building2; naslov: string; opis: string }
> = {
  jls: {
    label: "JLS",
    icon: Building2,
    naslov: "Jedinice lokalne samouprave",
    opis: "Gradovi, općine i županije",
  },
  poduzece: {
    label: "Poduzeće",
    icon: Factory,
    naslov: "Poduzeća",
    opis: "Mala, srednja i velika poduzeća",
  },
  institucija: {
    label: "Institucija",
    icon: FlaskConical,
    naslov: "Znanstveno-istraživačke institucije",
    opis: "Fakulteti i instituti",
  },
};

const REDOSLIJED: KlijentTip[] = ["jls", "poduzece", "institucija"];

export default async function KlijentiPage() {
  const [klijenti, calls] = await Promise.all([getJlsProfiles(), getCalls()]);

  const poTipu = new Map<KlijentTip, Jls[]>();
  for (const k of klijenti) {
    const arr = poTipu.get(k.tipKlijenta) ?? [];
    arr.push(k);
    poTipu.set(k.tipKlijenta, arr);
  }

  return (
    <div>
      <PageHeader
        title="Klijenti"
        description="Pretplatnici — JLS, poduzeća i istraživačke institucije. Za svakog vidite na koje se natječaje može prijaviti."
      >
        <ButtonLink href="/klijenti/novi" variant="primary">
          <Plus className="h-4 w-4" /> Dodaj klijenta
        </ButtonLink>
      </PageHeader>

      {REDOSLIJED.filter((t) => poTipu.get(t)?.length).map((tip) => {
        const meta = TIP_META[tip];
        const Icon = meta.icon;
        return (
          <section key={tip} className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <Icon className="h-4 w-4 text-brand-ink" />
              <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-2">
                {meta.naslov}
              </h2>
              <span className="text-xs text-muted-2">
                · {poTipu.get(tip)!.length}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {poTipu.get(tip)!.map((k) => {
                const otvoreni = matchesForJls(calls, k).filter(
                  (m) => m.call.status === "otvoren",
                ).length;
                return <KlijentCard key={k.id} k={k} otvoreni={otvoreni} />;
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function KlijentCard({ k, otvoreni }: { k: Jls; otvoreni: number }) {
  const meta = TIP_META[k.tipKlijenta];
  return (
    <Card className="group relative p-5 transition-all hover:border-brand hover:shadow-md hover:shadow-black/[0.06]">
      <Link
        href={`/klijenti/${k.id}`}
        className="absolute inset-0 z-10 rounded-lg"
        aria-label={k.naziv}
      />
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-soft font-display text-base font-bold text-brand-ink">
          {k.naziv.replace(/[^A-Za-zČĆŽŠĐ ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "–"}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone="brand">{meta.label}</Badge>
          <Badge
            tone={
              k.status === "aktivan"
                ? "success"
                : k.status === "trial"
                  ? "warning"
                  : "neutral"
            }
          >
            {k.status}
          </Badge>
        </div>
      </div>

      <h3 className="mt-3 font-display text-base font-semibold tracking-tight">
        {k.naziv}
      </h3>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {k.zupanija && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {k.zupanija}
          </span>
        )}
        {k.tipKlijenta === "jls" && k.stanovnika > 0 && (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span className="tabular">{k.stanovnika.toLocaleString("hr-HR")}</span>
          </span>
        )}
        {k.tipKlijenta === "jls" && k.ruralno && (
          <span className="inline-flex items-center gap-1 text-brand-ink">
            <Sprout className="h-3 w-3" /> ruralno
          </span>
        )}
        {k.tipKlijenta === "poduzece" && k.velicina && (
          <span className="capitalize">{k.velicina} poduzeće</span>
        )}
        {k.tipKlijenta === "institucija" && <span>{meta.opis}</span>}
      </div>

      <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
        <div>
          <div className="font-display text-2xl font-bold leading-none tabular text-brand-ink">
            {otvoreni}
          </div>
          <div className="mt-1 text-xs text-muted">otvorenih prilika</div>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted group-hover:text-brand-ink">
          Otvori profil <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Card>
  );
}
