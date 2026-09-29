/**
 * Afvalsoorten van de gemeentebron → de drie bakken van de afvalkalender
 * (TECHNICAL_DESIGN §18.1.4, tabel uit P0; AC-196). Puur.
 */

export const WASTE_STREAMS = ["rest", "papier", "pmd"] as const;
export type WasteStream = (typeof WASTE_STREAMS)[number];

/** Gesorteerde, unieke ISO-datums per bak */
export type WastePickups = Record<WasteStream, string[]>;

export const EMPTY_PICKUPS: WastePickups = { rest: [], papier: [], pmd: [] };

export interface StreamInfo {
  icon?: string | null;
  title?: string | null;
  menu_title?: string | null;
}

const BY_ICON: Record<string, WasteStream | null> = {
  "zak-grijs-rest": "rest",
  "doos-karton-papier": "papier",
  "petfles-blik-drankpak_pmd": "pmd",
  "appel-gft": null,
  "kerstboom-zonder-kruis": null,
};

/** Welke bak hoort bij deze soort? `null` = geen van de drie (GFT, kerstbomen, onbekend). */
export function classifyStream(stream: StreamInfo): WasteStream | null {
  const icon = stream.icon ?? "";
  if (icon in BY_ICON) return BY_ICON[icon];

  // Onbekend icon: terugvallen op een trefwoord in de titel
  const text = `${stream.title ?? ""} ${stream.menu_title ?? ""}`.toLowerCase();
  if (/grof|gft|kerst|textiel/.test(text)) return null;
  if (text.includes("rest")) return "rest";
  if (text.includes("papier")) return "papier";
  if (text.includes("pmd") || text.includes("plastic")) return "pmd";
  return null;
}

/** Bakken in de vaste volgorde restafval, papier, PMD (UX §13.3) */
export function sortStreams(streams: Iterable<WasteStream>): WasteStream[] {
  const set = new Set(streams);
  return WASTE_STREAMS.filter((s) => set.has(s));
}

export function isWasteStream(value: string): value is WasteStream {
  return (WASTE_STREAMS as readonly string[]).includes(value);
}

/** Maakt van losse datums per bak een nette, gesorteerde en ontdubbelde stand. */
export function normalizePickups(input: Partial<Record<WasteStream, Iterable<string>>>): WastePickups {
  const result: WastePickups = { rest: [], papier: [], pmd: [] };
  for (const stream of WASTE_STREAMS) {
    result[stream] = [...new Set(input[stream] ?? [])].sort();
  }
  return result;
}
