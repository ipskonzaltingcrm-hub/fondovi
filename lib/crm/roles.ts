export type StaffRole = "superadmin" | "admin" | "konzultant" | "suradnik";

export const ROLE_LABEL: Record<StaffRole, string> = {
  superadmin: "Superadmin",
  admin: "Administrator",
  konzultant: "Konzultant",
  suradnik: "Suradnik",
};

export const ROLE_TONE: Record<StaffRole, "brand" | "info" | "success" | "neutral"> = {
  superadmin: "brand",
  admin: "info",
  konzultant: "success",
  suradnik: "neutral",
};

/** Uloge koje se mogu dodijeliti pozivnicom / uređivanjem (superadmin je samo vlasnica). */
export const ASSIGNABLE_ROLES: StaffRole[] = ["admin", "konzultant", "suradnik"];

/** Što koja uloga smije — prikaz u kartici Tim i uloge (provodi se u bazi, ne samo u sučelju). */
export const ROLE_PERMISSIONS: { what: string; roles: Record<StaffRole, boolean> }[] = [
  { what: "Rad s leadovima, klijentima, zadacima i natječajima", roles: { superadmin: true, admin: true, konzultant: true, suradnik: true } },
  { what: "Vidi sve zapise tima (suradnik samo svoje i dodijeljene)", roles: { superadmin: true, admin: true, konzultant: true, suradnik: false } },
  { what: "Ponude, prodaja, EU Filter — uređivanje", roles: { superadmin: true, admin: true, konzultant: true, suradnik: false } },
  { what: "Pozivanje članova, uloge, deaktivacija", roles: { superadmin: true, admin: true, konzultant: false, suradnik: false } },
  { what: "Dnevnik izmjena, Sigurnost tima, Fiksni troškovi, Trošak AI-ja", roles: { superadmin: true, admin: true, konzultant: false, suradnik: false } },
  { what: "Dodjela uloge administratora", roles: { superadmin: true, admin: false, konzultant: false, suradnik: false } },
];
