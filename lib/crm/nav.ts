import {
  LayoutDashboard,
  CheckSquare,
  Flame,
  Grid3x3,
  Inbox,
  Castle,
  Building2,
  FileText,
  ClipboardList,
  Bot,
  Smartphone,
  MailPlus,
  Table2,
  TrendingUp,
  Landmark,
  Filter,
  FolderKanban,
  Users,
  ShieldCheck,
  History,
  Receipt,
  Wallet,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type CrmNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Faza plana u kojoj kartica dobiva sadržaj (0 = gotovo u temelju). */
  phase: number;
  /** Kartica već radi (inače je u izborniku kao "uskoro"). */
  live?: boolean;
  adminOnly?: boolean;
  superadminOnly?: boolean;
  /** Što kartica radi — prikaz na početnoj i na stranici "uskoro". */
  summary: string;
};
export type CrmNavGroup = { label: string; items: CrmNavItem[] };

/** Izbornik EU Radar CRM-a: 23 kartice po uzoru na IPS Hub, prilagođene EU Radaru. */
export const crmNav: CrmNavGroup[] = [
  {
    label: "Prodaja",
    items: [
      { href: "/crm", label: "Moj dan", icon: LayoutDashboard, phase: 1, summary: "Pokazatelji, koga zvati, moji zadaci i rokovi natječaja na jednom mjestu." },
      { href: "/crm/zadaci", label: "Zadaci", icon: CheckSquare, phase: 1, summary: "Zadaci s rokom i vlasnikom, vezani uz klijenta, lead ili natječaj." },
      { href: "/crm/hot-leadovi", label: "Hot leadovi", icon: Flame, phase: 1, summary: "Najperspektivniji leadovi složeni po natječaju iz EU Radara." },
      { href: "/crm/hot-pregled", label: "Hot pregled", icon: Grid3x3, phase: 1, superadminOnly: true, summary: "Tablica hot leadova po natječaju sa semaforom." },
      { href: "/crm/leadovi", label: "Leadovi", icon: Inbox, phase: 1, summary: "Potencijalni pretplatnici (JLS, poduzeća, institucije) i registracije s EU Radara." },
      { href: "/crm/jls-prodaja", label: "JLS prodaja", icon: Castle, phase: 3, adminOnly: true, summary: "Prodaja pretplate općinama, gradovima i županijama: ciljna skupina, nacrti, signali." },
      { href: "/crm/klijenti", label: "Klijenti", icon: Building2, phase: 1, summary: "Pretplatnici EU Radara — isti zapis kao klijent u aplikaciji, s 360° karticom." },
      { href: "/crm/ponude", label: "Ponude", icon: FileText, phase: 3, summary: "Paketi pretplate i usluge pripreme projekata; PDF i slanje e-mailom." },
      { href: "/crm/upitnici", label: "Upitnici", icon: ClipboardList, phase: 3, summary: "Forme na EU Radaru („provjeri na što se možeš prijaviti“) koje stvaraju leadove." },
    ],
  },
  {
    label: "EU Radar portal",
    items: [
      { href: "/crm/chatbot", label: "Chatbot brain", icon: Bot, phase: 5, summary: "AI asistent u EU Radaru: upute, dokumenti, razgovori, kontakt → lead." },
      { href: "/crm/korisnici-portala", label: "Korisnici portala", icon: Smartphone, phase: 4, summary: "Korisnici EU Radara: pretplate, pozivnice, uplate, kontrola registracije." },
      { href: "/crm/poruke", label: "Poruke i newsletter", icon: MailPlus, phase: 4, summary: "Obavijesti pretplatnicima: novi natječaji po profilu, podsjetnici na rokove." },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { href: "/crm/prodajni-official", label: "Prodajni official", icon: Table2, phase: 3, summary: "Tjedna tablica pokazatelja po članu tima." },
      { href: "/crm/prodaja", label: "Prodajni monitoring", icon: TrendingUp, phase: 3, summary: "Prodaja pretplata i usluga po članu, tjedno i mjesečno." },
    ],
  },
  {
    label: "Natječaji",
    items: [
      { href: "/crm/natjecaji", label: "Natječaji", icon: Landmark, phase: 2, summary: "CRM pogled na natječaje EU Radara: izvori, prihvatljivi klijenti → zadaci." },
      { href: "/crm/eu-filter", label: "EU Filter", icon: Filter, phase: 2, summary: "Provjera prihvatljivosti klijenta po programima i uvjetima." },
      { href: "/crm/projekti", label: "Projekti i prijave", icon: FolderKanban, phase: 2, summary: "Prijave klijenata od pripreme do isplate: faze, checklista, rokovi." },
    ],
  },
  {
    label: "Sustav",
    items: [
      { href: "/crm/tim", label: "Tim i uloge", icon: Users, phase: 0, live: true, summary: "Članovi tima, pozivnice, uloge i ovlasti." },
      { href: "/crm/sigurnost", label: "Sigurnost", icon: ShieldCheck, phase: 0, live: true, summary: "Moje prijave i uređaji; nadzor prijava tima za administratore." },
      { href: "/crm/dnevnik", label: "Dnevnik izmjena", icon: History, phase: 0, live: true, adminOnly: true, summary: "Tko je što pregledao, mijenjao i izvezao." },
      { href: "/crm/fiksni-troskovi", label: "Fiksni troškovi", icon: Receipt, phase: 5, adminOnly: true, summary: "Ponavljajući troškovi poslovanja." },
      { href: "/crm/trosak-ai", label: "Trošak AI-ja", icon: Wallet, phase: 5, adminOnly: true, summary: "Potrošnja na Claude API po modulu." },
      { href: "/crm/postavke", label: "Postavke", icon: Settings, phase: 5, summary: "Prave postavke CRM-a i EU Radara na jednom mjestu." },
    ],
  },
];

export const PHASE_LABEL: Record<number, string> = {
  0: "Faza 0 · Temelj",
  1: "Faza 1 · Prodajna jezgra",
  2: "Faza 2 · Natječaji u CRM-u",
  3: "Faza 3 · Ponude i prodaja",
  4: "Faza 4 · Pretplatnici EU Radara",
  5: "Faza 5 · AI i sustav",
};

/** Izbornik za ulogu: stavke samo za administratore/superadmina skrivene su ostalima. */
export function crmNavFor(isAdmin: boolean, isSuperadmin: boolean): CrmNavGroup[] {
  return crmNav
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => (i.superadminOnly ? isSuperadmin : i.adminOnly ? isAdmin : true)),
    }))
    .filter((g) => g.items.length > 0);
}

export function findNavItem(href: string): CrmNavItem | undefined {
  return crmNav.flatMap((g) => g.items).find((i) => i.href === href);
}
