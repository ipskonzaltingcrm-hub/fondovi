/** Postavke i polja uputa chatbota — dijeli se između servera i sučelja (bez SDK-a). */

export type ChatSettings = {
  enabled: boolean;
  ime: string;
  pozdrav: string;
  max_pitanja: number;
  kontakt_od: number;
  limit_usd: number;
};
export type ChatBrain = Record<"o_nama" | "usluge" | "cijene" | "ton" | "pravila" | "kontakt" | "faq" | "dodatno", string>;

export const BRAIN_FIELDS: { key: keyof ChatBrain; label: string; hint: string }[] = [
  { key: "o_nama", label: "O nama", hint: "Tko je IPS Konzalting, što je EU Radar, iskustvo, reference." },
  { key: "usluge", label: "Usluge", hint: "Pretplata na EU Radar, priprema i vođenje EU projekata, strategije za JLS…" },
  { key: "cijene", label: "Cijene", hint: "Što smije reći o cijenama (ili uputiti na ponudu)." },
  { key: "ton", label: "Ton i stil", hint: "Npr. ljubazno, kratko, persiranje, bez žargona." },
  { key: "pravila", label: "Pravila", hint: "Što nikad ne smije: obećavati odobrenje projekta, pravni savjet…" },
  { key: "kontakt", label: "Kontakt i sljedeći korak", hint: "Kad i kako ponuditi razgovor s konzultantom." },
  { key: "faq", label: "Česta pitanja", hint: "Pitanje → odgovor, po jedno u retku." },
  { key: "dodatno", label: "Dodatno znanje", hint: "Zalijepi izvatke iz pravilnika, cjenika, uputa (tekst)." },
];

export const DEFAULT_SETTINGS: ChatSettings = {
  enabled: false,
  ime: "Ana",
  pozdrav: "Bok! Ja sam Ana, AI asistentica EU Radara. Pitajte me o natječajima i bespovratnim sredstvima.",
  max_pitanja: 12,
  kontakt_od: 4,
  limit_usd: 20,
};
