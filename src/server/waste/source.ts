import "server-only";

/**
 * De huisvuilkalender van Den Haag (platform Opzet; onofficieel,
 * ongedocumenteerd; TECHNICAL_DESIGN §18.1). Vaste host, geen redirects,
 * alleen gevalideerde padsegmenten. Gooit nooit bij netwerk- of formaatfouten.
 * Logt nooit een URL, adres of foutmelding van de fetch (§18.12).
 */
import { z } from "zod";

export const WASTE_SOURCE_BASE_URL = "https://huisvuilkalender.denhaag.nl";
const LOOPBACK_OVERRIDE = /^http:\/\/127\.0\.0\.1:\d{2,5}$/;

/** Per verzoek */
const REQUEST_TIMEOUT_MS = 8_000;
/** Grootte van een antwoord */
const MAX_BODY_BYTES = 1_000_000;
const HEADERS = { Accept: "application/json", "User-Agent": "Takenlijstje/1 (prive gezinsapp)" };

export type SourceError = "UNREACHABLE" | "FORMAT" | "NOT_FOUND";
export type SourceResult<T> = { ok: true; value: T } | { ok: false; code: SourceError; http?: number };

export interface SourceDeps {
  fetch?: typeof fetch;
  /** Totaalbudget van de hele opvraging (server action of tickstap) */
  signal?: AbortSignal;
}

let overrideWarned = false;

/** De vaste host; alleen voor tests en E2E een loopback-adres uit de omgeving */
export function sourceBaseUrl(): string {
  const override = process.env.WASTE_SOURCE_BASE_URL;
  if (!override) return WASTE_SOURCE_BASE_URL;
  // Nooit in productie, ook niet per ongeluk meegekopieerd (security-review WP3b, punt 3)
  if (LOOPBACK_OVERRIDE.test(override) && process.env.VERCEL_ENV !== "production") return override;
  if (!overrideWarned) {
    console.warn("[waste] override genegeerd");
    overrideWarned = true;
  }
  return WASTE_SOURCE_BASE_URL;
}

export const postcodeSchema = z.string().regex(/^[1-9][0-9]{3}[A-Z]{2}$/);
export const houseNumberSchema = z.number().int().min(1).max(99_999);
export const bagIdSchema = z.string().regex(/^[0-9]{16}$/);
export const yearSchema = z.number().int().min(2020).max(2100);

type Fetched = { kind: "json"; body: unknown } | { kind: "not_found" } | { kind: "error"; code: SourceError; http?: number };

async function readLimited(response: Response): Promise<string | null> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** GET van één pad (segmenten al gevalideerd en gecodeerd) */
async function getJson(path: string, deps: SourceDeps): Promise<Fetched> {
  const doFetch = deps.fetch ?? fetch;
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = deps.signal ? AbortSignal.any([timeout, deps.signal]) : timeout;
  let response: Response;
  try {
    response = await doFetch(`${sourceBaseUrl()}${path}`, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      credentials: "omit",
      headers: HEADERS,
      signal,
    });
  } catch {
    return { kind: "error", code: "UNREACHABLE" };
  }
  if (response.status === 404) {
    await response.body?.cancel().catch(() => undefined);
    return { kind: "not_found" };
  }
  if (response.status !== 200) {
    await response.body?.cancel().catch(() => undefined);
    return { kind: "error", code: "UNREACHABLE", http: response.status };
  }
  if (!(response.headers.get("content-type") ?? "").toLowerCase().includes("json")) {
    await response.body?.cancel().catch(() => undefined);
    return { kind: "error", code: "FORMAT", http: 200 };
  }
  let text: string | null;
  try {
    text = await readLimited(response);
  } catch {
    return { kind: "error", code: "UNREACHABLE", http: 200 };
  }
  if (text === null) return { kind: "error", code: "FORMAT", http: 200 };
  try {
    return { kind: "json", body: JSON.parse(text) };
  } catch {
    return { kind: "error", code: "FORMAT", http: 200 };
  }
}

const seg = (value: string | number) => encodeURIComponent(String(value));

/** A: adres → kandidaten. 200 [] is geen fout (onbekend adres). */
export async function fetchAddressRaw(postcode: string, houseNumber: number, deps: SourceDeps): Promise<Fetched> {
  postcodeSchema.parse(postcode);
  houseNumberSchema.parse(houseNumber);
  return getJson(`/rest/adressen/${seg(postcode)}-${seg(houseNumber)}`, deps);
}

/** B: soorten van het adres */
export async function fetchStreamsRaw(bagId: string, deps: SourceDeps): Promise<Fetched> {
  bagIdSchema.parse(bagId);
  return getJson(`/rest/adressen/${seg(bagId)}/afvalstromen`, deps);
}

/** C: ophaaldagen van een jaar */
export async function fetchYearRaw(bagId: string, year: number, deps: SourceDeps): Promise<Fetched> {
  bagIdSchema.parse(bagId);
  yearSchema.parse(year);
  return getJson(`/rest/adressen/${seg(bagId)}/kalender/${seg(year)}`, deps);
}

export type { Fetched };
