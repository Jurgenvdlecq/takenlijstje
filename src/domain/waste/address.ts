/**
 * Adres invoeren en kiezen (TECHNICAL_DESIGN §18.1.5; AC-184, AC-187). Puur.
 * De app kiest nooit zelf tussen meerdere adressen.
 */

export const POSTCODE_RE = /^[1-9][0-9]{3}[A-Z]{2}$/;
export const SUFFIX_RE = /^[A-Z0-9]{0,4}$/;

export interface WasteAddressInput {
  postcode: string;
  houseNumber: string;
  /** `null` = niet opgegeven; `""` = bewust het adres zonder letter of toevoeging */
  suffix: string | null;
}

export interface WasteAddress {
  postcode: string;
  houseNumber: number;
  suffix: string | null;
}

export type WasteAddressField = "postcode" | "houseNumber" | "suffix";

export type NormalizeResult =
  | { ok: true; address: WasteAddress }
  | { ok: false; errors: Partial<Record<WasteAddressField, true>> };

function cleanSuffix(value: string): string {
  return value.toUpperCase().replace(/[\s-]/g, "");
}

/**
 * Postcode in hoofdletters zonder spatie; "12a", "12 a", "12-2" en "12 bis"
 * worden nummer + toevoeging. Een ingevulde toevoeging gaat voor.
 */
export function normalizeWasteAddress(input: WasteAddressInput): NormalizeResult {
  const errors: Partial<Record<WasteAddressField, true>> = {};

  const postcode = input.postcode.toUpperCase().replace(/\s/g, "");
  if (!POSTCODE_RE.test(postcode)) errors.postcode = true;

  const match = /^\s*(\d{1,5})\s*[-\s]?\s*([A-Za-z0-9]*)\s*$/.exec(input.houseNumber);
  const number = match ? Number(match[1]) : NaN;
  if (!match || !Number.isInteger(number) || number < 1 || number > 99_999) errors.houseNumber = true;
  const fromNumber = match?.[2] ? cleanSuffix(match[2]) : "";

  let suffix: string | null;
  if (input.suffix !== null && input.suffix.trim() !== "") suffix = cleanSuffix(input.suffix);
  else if (fromNumber) suffix = fromNumber;
  else suffix = input.suffix === "" ? "" : null;

  if (suffix !== null && !SUFFIX_RE.test(suffix)) {
    if (input.suffix !== null && input.suffix.trim() !== "") errors.suffix = true;
    else errors.houseNumber = true;
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, address: { postcode, houseNumber: number, suffix } };
}

/** "2517AB" → "2517 AB" */
export function formatPostcode(postcode: string): string {
  return `${postcode.slice(0, 4)} ${postcode.slice(4)}`;
}

/** <adres> = "2517 AB 12A" (UX §13.16) */
export function formatWasteAddress(postcode: string, houseNumber: number, suffix: string | null | undefined): string {
  return `${formatPostcode(postcode)} ${houseNumber}${suffix ?? ""}`;
}

export interface AddressCandidate {
  bagId: string;
  /** Letter + toevoeging in hoofdletters; "" = zonder */
  letter: string;
}

export type MatchResult<C extends AddressCandidate> =
  | { kind: "match"; candidate: C }
  | { kind: "choose"; candidates: C[] }
  | { kind: "not_found" };

export function candidateLetter(huisletter: string | null | undefined, toevoeging: string | null | undefined): string {
  return `${huisletter ?? ""}${toevoeging ?? ""}`.toUpperCase();
}

export function matchCandidate<C extends AddressCandidate>(candidates: C[], suffix: string | null): MatchResult<C> {
  if (candidates.length === 0) return { kind: "not_found" };
  if (suffix === null) {
    return candidates.length === 1 ? { kind: "match", candidate: candidates[0] } : { kind: "choose", candidates };
  }
  const exact = candidates.filter((c) => c.letter === suffix);
  return exact.length === 1 ? { kind: "match", candidate: exact[0] } : { kind: "not_found" };
}
