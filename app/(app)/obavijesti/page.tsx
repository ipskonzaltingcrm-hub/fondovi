import { Bell } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Placeholder } from "@/components/layout/placeholder";

export const metadata = { title: "Obavijesti" };

export default function ObavijestiPage() {
  return (
    <div>
      <PageHeader
        title="Obavijesti"
        description="Email obavijesti o novim pozivima i rokovima koji istječu."
      />
      <Placeholder
        icon={Bell}
        title="Obavijesti dolaze u Fazi 4"
        text="Email obavijesti po spremljenim filtrima, upozorenja na rokove i tjedni digest."
      />
    </div>
  );
}
