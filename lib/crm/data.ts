import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ClientStatus, HotStage, KlijentTip, LeadIzvor, LeadStatus, Prioritet, TaskVrsta, ActivityVrsta } from "./options";

/** Učitavanje podataka CRM-a (server). Sve ide kroz RLS prijavljenog člana. */

export type TeamMember = { id: string; name: string; short: string | null; active: boolean };

export const getTeam = cache(async (): Promise<TeamMember[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,email,full_name,short_name,staff_active")
    .not("staff_role", "is", null)
    .order("full_name");
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.full_name || p.email || "—",
    short: p.short_name,
    active: p.staff_active,
  }));
});

export type Lead = {
  id: string;
  broj: number;
  naziv: string;
  klijent_tip: KlijentTip;
  jls_tip: "grad" | "opcina" | "zupanija" | null;
  kontakt_ime: string | null;
  email: string | null;
  telefon: string | null;
  oib: string | null;
  zupanija: string | null;
  izvor: LeadIzvor;
  interes: string | null;
  sektori: string[];
  status: LeadStatus;
  razlog_gubitka: string | null;
  owner: string | null;
  t_prihvatljivost: number | null;
  t_dokumentacija: number | null;
  t_financije: number | null;
  trijaza: number | null;
  napomena: string | null;
  hot_at: string | null;
  hot_group_id: string | null;
  hot_note: string | null;
  hot_stage: HotStage | null;
  hot_position: number;
  jls_profile_id: string | null;
  converted_at: string | null;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  last_activity_at: string;
};
export const LEAD_COLS =
  "id,broj,naziv,klijent_tip,jls_tip,kontakt_ime,email,telefon,oib,zupanija,izvor,interes,sektori,status,razlog_gubitka,owner,t_prihvatljivost,t_dokumentacija,t_financije,trijaza,napomena,hot_at,hot_group_id,hot_note,hot_stage,hot_position,jls_profile_id,converted_at,archived_at,created_by,created_at,last_activity_at";

export type Task = {
  id: string;
  naslov: string;
  opis: string | null;
  vrsta: TaskVrsta;
  prioritet: Prioritet;
  rok: string | null;
  vrijeme: string | null;
  owner: string | null;
  lead_id: string | null;
  jls_profile_id: string | null;
  call_id: string | null;
  project_id: string | null;
  done_at: string | null;
  created_by: string | null;
  created_at: string;
  project?: { broj: number; naziv: string } | null;
  lead?: { broj: number; naziv: string } | null;
  client?: { naziv: string } | null;
  call?: { naslov: string; slug: string } | null;
};
export const TASK_COLS =
  "id,naslov,opis,vrsta,prioritet,rok,vrijeme,owner,lead_id,jls_profile_id,call_id,project_id,done_at,created_by,created_at,lead:crm_leads(broj,naziv),client:jls_profiles(naziv),call:calls(naslov,slug),project:crm_projects(broj,naziv)";

export type Activity = {
  id: number;
  at: string;
  actor_name: string | null;
  vrsta: ActivityVrsta;
  body: string;
  lead_id: string | null;
  jls_profile_id: string | null;
  task_id: string | null;
  project_id?: string | null;
};

export type HotGroup = {
  id: string;
  naziv: string;
  sifra: string | null;
  podnaslov: string | null;
  call_id: string | null;
  deadline_on: string | null;
  deadline_note: string | null;
  position: number;
  call?: { naslov: string; slug: string; rok_prijave: string | null; status: string } | null;
};
export const HOT_GROUP_COLS =
  "id,naziv,sifra,podnaslov,call_id,deadline_on,deadline_note,position,call:calls(naslov,slug,rok_prijave,status)";

export type ClientRow = {
  id: string;
  slug: string;
  naziv: string;
  klijent_tip: KlijentTip;
  tip: "grad" | "opcina" | "zupanija" | null;
  zupanija: string | null;
  stanovnika: number | null;
  ruralno: boolean;
  velicina: string | null;
  sektori_interesa: string[];
  kontakt_osoba: string | null;
  status: ClientStatus;
  created_at: string;
  crm: { owner: string | null; oib: string | null; email: string | null; telefon: string | null; adresa: string | null; web: string | null; napomena: string | null } | null;
};
export const CLIENT_COLS =
  "id,slug,naziv,klijent_tip,tip,zupanija,stanovnika,ruralno,velicina,sektori_interesa,kontakt_osoba,status,created_at,crm:crm_clients(owner,oib,email,telefon,adresa,web,napomena)";

export type CallOption = { id: string; naslov: string; program: string; rok_prijave: string | null; status: string };

/** Otvoreni natječaji i najave (za vezu zadatka / hot grupe na natječaj iz EU Radara). */
export const getCallOptions = cache(async (): Promise<CallOption[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("calls")
    .select("id,naslov,program,rok_prijave,status")
    .neq("status", "zatvoren")
    .order("rok_prijave", { ascending: true, nullsFirst: false })
    .limit(300);
  return (data ?? []) as CallOption[];
});

export type ClientOption = { id: string; naziv: string };
export const getClientOptions = cache(async (): Promise<ClientOption[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("jls_profiles").select("id,naziv").order("naziv");
  return (data ?? []) as ClientOption[];
});

export type LeadOption = { id: string; broj: number; naziv: string };
export const getLeadOptions = cache(async (): Promise<LeadOption[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_leads")
    .select("id,broj,naziv")
    .is("archived_at", null)
    .not("status", "in", "(pretvoren,izgubljen)")
    .order("broj", { ascending: false })
    .limit(500);
  return (data ?? []) as LeadOption[];
});

/** Zajednički šifrarnici za obrasce zadataka. */
export async function getTaskRefs() {
  const [team, leads, clients, calls, projects] = await Promise.all([getTeam(), getLeadOptions(), getClientOptions(), getCallOptions(), getProjectOptions()]);
  return { team: team.filter((t) => t.active), leads, clients, calls, projects };
}
export type TaskRefs = Awaited<ReturnType<typeof getTaskRefs>>;

// ------------------------------------------------------------------ Faza 2

export type ProjectRow = {
  id: string;
  broj: number;
  naziv: string;
  jls_profile_id: string | null;
  lead_id: string | null;
  call_id: string | null;
  program: string | null;
  owner: string | null;
  faza: import("./options").ProjectFaza;
  rok_prijave: string | null;
  iznos_projekta: number | null;
  iznos_potpore: number | null;
  predano_at: string | null;
  odluka_at: string | null;
  napomena: string | null;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  client?: { naziv: string } | null;
  lead?: { broj: number; naziv: string } | null;
  call?: { naslov: string; slug: string; rok_prijave: string | null } | null;
  items?: { done_at: string | null }[];
};
export const PROJECT_COLS =
  "id,broj,naziv,jls_profile_id,lead_id,call_id,program,owner,faza,rok_prijave,iznos_projekta,iznos_potpore,predano_at,odluka_at,napomena,archived_at,created_by,created_at,client:jls_profiles(naziv),lead:crm_leads(broj,naziv),call:calls(naslov,slug,rok_prijave),items:crm_project_items(done_at)";

export type ProjectOption = { id: string; broj: number; naziv: string };
export const getProjectOptions = cache(async (): Promise<ProjectOption[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_projects")
    .select("id,broj,naziv")
    .is("archived_at", null)
    .order("broj", { ascending: false })
    .limit(300);
  return (data ?? []) as ProjectOption[];
});
