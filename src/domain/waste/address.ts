/**
 * Adres voor de afvalkalender (W-03, BR-48; TECHNICAL_DESIGN §18.1.5). Puur:
 * normaliseren, controleren en kiezen uit de kandidaten van de gemeente. De app
 * kiest bij meerdere adressen op één nummer nooit zelf (AC-187).
 */
export const POSTCODE_RE = /^[1-9][0-9]{3}[A-Z]{2}$/;
const SUFFIX_RE = /^[A-Z0-9]{0,4}$/;

export interface WasteAddress {
  /** "2511AB", zonder spatie */
  postcode: string;
  houseNumber: number;
  /** null = niet opgegeven; "" = bewust het adres zonder letter of toevoeging */
  suffix: string | null;
}

export type AddressField = "postcode" | "houseNumber" | "suffix";

export const ADDRESS_ERRORS: Record<AddressField, string> = {
  postcode: "Vul een postcode in zoals 2517 AB",
  houseNumber: "Vul een huisnummer in, alleen cijfers",
  suffix: "Een toevoeging is hooguit 4 letters of cijfers",
};

export type AddressParse = { ok: true; value: WasteAddress } | { ok: false; field: AddressField; message: string };

export function normalizePostcode(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, "");
}

/** "2511AB" → "2511 AB" */
export function formatPostcode(postcode: string): string {
  const p = normalizePostcode(postcode);
  return p.length === 6 ? `${p.slice(0, 4)} ${p.slice(4)}` : p;
}

export function normalizeSuffix(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  return raw.toUpperCase().replace(/[\s-]+/g, "");
}

function fail(field: AddressField): AddressParse {
  return { ok: false, field, message: ADDRESS_ERRORS[field] };
}

/**
 * Normaliseren en controleren. "2511ab" + "12 a" en "2511 AB" + "12A" geven
 * hetzelfde: 2511AB, 12, "A". Een letter achter het nummer gaat voor een los
 * ingevulde toevoeging.
 */
export function normalizeWasteAddress(raw: {
  postcode: string;
  houseNumber: string | number;
  suffix?: string | null;
}): AddressParse {
  const postcode = normalizePostcode(String(raw.postcode ?? ""));
  if (!POSTCODE_RE.test(postcode)) return fail("postcode");

  const house = String(raw.houseNumber ?? "").trim();
  const match = /^(\d+)\s*-?\s*([A-Za-z0-9 ]*)$/.exec(house);
  if (!match) return fail("houseNumber");
  const houseNumber = Number(match[1]);
  if (!Number.isInteger(houseNumber) || houseNumber < 1 || houseNumber > 99999) return fail("houseNumber");

  const fromNumber = normalizeSuffix(match[2]);
  const fromField = normalizeSuffix(raw.suffix ?? null);
  // null = niet opgegeven (leeg veld: de client stuurt null); "" = bewust zonder letter (keuze in C2)
  const suffix = fromNumber ? fromNumber : fromField;
  if (suffix !== null && !SUFFIX_RE.test(suffix)) return fail("suffix");
  return { ok: true, value: { postcode, houseNumber, suffix } };
}

/** Een adres zoals endpoint A van de gemeente het geeft (alleen wat we gebruiken) */
export interface AddressCandidate {
  bagId: string;
  huisletter: string | null;
  huisnummerToevoeging: string | null;
  /** Alleen voor de weergave bij "Klopt dit?"; nooit bewaard of gelogd */
  street?: string | null;
  houseNumber?: number | null;
  city?: string | null;
}

export function candidateKey(c: Pick<AddressCandidate, "huisletter" | "huisnummerToevoeging">): string {
  return `${normalizeSuffix(c.huisletter) ?? ""}${normalizeSuffix(c.huisnummerToevoeging) ?? ""}`;
}

/** "12" + "A" → "12A", "12" + "2" → "12-2" */
export function houseLabel(houseNumber: number, suffix: string): string {
  if (!suffix) return String(houseNumber);
  return /^\d/.test(suffix) ? `${houseNumber}-${suffix}` : `${houseNumber}${suffix}`;
}

export type CandidateMatch =
  | { kind: "match"; candidate: AddressCandidate; suffix: string }
  | { kind: "choose"; options: { suffix: string; label: string }[] }
  | { kind: "not_found" };

export function matchCandidate(candidates: AddressCandidate[], houseNumber: number, suffix: string | null): CandidateMatch {
  const byKey = new Map<string, AddressCandidate>();
  for (const c of candidates) if (!byKey.has(candidateKey(c))) byKey.set(candidateKey(c), c);
  if (byKey.size === 0) return { kind: "not_found" };
  if (suffix === null) {
    if (byKey.size === 1) {
      const [[key, candidate]] = [...byKey.entries()];
      return { kind: "match", candidate, suffix: key };
    }
    const options = [...byKey.keys()]
      .sort((a, b) => a.localeCompare(b, "nl", { numeric: true }))
      .map((key) => ({ suffix: key, label: houseLabel(houseNumber, key) }));
    return { kind: "choose", options };
  }
  const candidate = byKey.get(suffix);
  return candidate ? { kind: "match", candidate, suffix } : { kind: "not_found" };
}
