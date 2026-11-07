import { Settings } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Placeholder } from "@/components/layout/placeholder";

export const metadata = { title: "Postavke" };

export default function PostavkePage() {
  return (
    <div>
      <PageHeader
        title="Postavke"
        description="Organizacija, korisnici i integracije."
      />
      <Placeholder
        icon={Settings}
        title="Postavke dolaze u Fazi 1 i 3"
        text="Upravljanje tenantom, korisnicima i ulogama, timski filtri i pristup."
      />
    </div>
  );
}
