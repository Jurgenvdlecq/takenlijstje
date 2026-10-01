/**
 * Bakken van de afvalkalender (W-03, BR-47): alleen restafval, papier en PMD,
 * altijd in deze vaste volgorde (UX_SPEC §13.3, TECHNICAL_DESIGN §18.1.4).
 */
export const WASTE_STREAMS = ["rest", "papier", "pmd"] as const;
export type WasteStream = (typeof WASTE_STREAMS)[number];

export const STREAM_LABELS: Record<WasteStream, string> = { rest: "Restafval", papier: "Papier", pmd: "PMD" };

/** Een soort zoals de gemeentebron hem beschrijft (endpoint B) */
export interface StreamDef {
  id: string;
  title: string;
  menuTitle?: string | null;
  icon?: string | null;
}

const BY_ICON: Record<string, WasteStream> = {
  "zak-grijs-rest": "rest",
  "doos-karton-papier": "papier",
  "petfles-blik-drankpak_pmd": "pmd",
};

/** Welke bak hoort bij deze soort? GFT, grofvuil, kerstbomen, textiel en onbekend → null (AC-196). */
export function classifyStream(def: StreamDef): WasteStream | null {
  const icon = def.icon?.trim().toLowerCase();
  if (icon && icon in BY_ICON) return BY_ICON[icon];
  const text = `${def.title ?? ""} ${def.menuTitle ?? ""}`.toLowerCase();
  if (/grof|gft|kerst|textiel/.test(text)) return null;
  if (/\bpmd\b|plastic/.test(text)) return "pmd";
  if (/papier/.test(text)) return "papier";
  if (/\brest/.test(text)) return "rest";
  return null;
}

/** Uniek en in de vaste volgorde rest, papier, pmd */
export function sortStreams(streams: Iterable<string>): WasteStream[] {
  const set = new Set(streams);
  return WASTE_STREAMS.filter((s) => set.has(s));
}

export function isWasteStream(value: string): value is WasteStream {
  return (WASTE_STREAMS as readonly string[]).includes(value);
}
