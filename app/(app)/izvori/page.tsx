import { Plus, ExternalLink, CircleCheck, CircleAlert, CirclePause } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSources } from "@/lib/data";

export const metadata = { title: "Izvori" };

const statusMeta = {
  aktivan: { tone: "success" as const, icon: CircleCheck, label: "Aktivan" },
  greska: { tone: "danger" as const, icon: CircleAlert, label: "Greška" },
  pauziran: { tone: "neutral" as const, icon: CirclePause, label: "Pauziran" },
};

export default async function IzvoriPage() {
  const sources = await getSources();
  const fmt = new Intl.DateTimeFormat("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div>
      <PageHeader
        title="Izvori"
        description="Službeni portali koje radar prati. Ingestion se u produkciji vrti po rasporedu (GitHub Actions, svakih 6 h)."
      >
        <Button variant="primary">
          <Plus className="h-4 w-4" /> Dodaj izvor
        </Button>
      </PageHeader>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wider text-muted-2">
                <th className="px-5 py-3 font-semibold">Izvor</th>
                <th className="px-5 py-3 font-semibold">Tip</th>
                <th className="px-5 py-3 font-semibold">Prioritet</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Zadnje povlačenje</th>
                <th className="px-5 py-3 text-right font-semibold">Poziva</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sources.map((s) => {
                const sm = statusMeta[s.status];
                const Icon = sm.icon;
                return (
                  <tr key={s.id} className="transition-colors hover:bg-surface-2">
                    <td className="px-5 py-3.5">
                      <div className="font-medium">{s.naziv}</div>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand-ink"
                      >
                        {s.url.replace(/^https?:\/\//, "")}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-muted">
                        {s.tip}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={s.prioritet === "jezgra" ? "brand" : "outline"}>
                        {s.prioritet}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon
                          className={
                            s.status === "aktivan"
                              ? "h-4 w-4 text-success"
                              : s.status === "greska"
                                ? "h-4 w-4 text-danger"
                                : "h-4 w-4 text-muted-2"
                          }
                        />
                        {sm.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 tabular text-muted">
                      {fmt.format(new Date(s.zadnjePovlacenje))}
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium tabular">
                      {s.pozivaUkupno}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-4 text-xs text-muted-2">
        Napomena: izvori se čitaju iz baze. Automatski parseri i raspored
        povlačenja dolaze u Fazi 2.
      </p>
    </div>
  );
}
