import "server-only";

/**
 * De huisvuilkalender van Den Haag (platform Opzet, onofficieel; TECHNICAL_DESIGN
 * §18.1). Alleen GET's naar één vaste host, nooit een redirect volgen, harde
 * time-outs en een groottegrens. Er gaat alleen postcode + huisnummer of de
 * adrescode (bagId) mee (AC-218). Gooit nooit bij netwerk- of formaatfouten.
 */
import type { z } from "zod";
import { parts, type ISODate } from "@/domain/dates";
import type { AddressCandidate } from "@/domain/waste/address";
import { emptyPickups, futurePickups, type WastePickups } from "@/domain/waste/plan";
import { classifyStream, type StreamDef } from "@/domain/waste/streams";
import { addressesSchema, calendarSchema, streamsSchema, type RawPickup } from "./schema";

export const WASTE_SOURCE_BASE_URL = "https://huisvuilkalender.denhaag.nl";
/** Alleen voor tests en E2E: uitsluitend een loopback-adres (§18.1.2) */
const OVERRIDE_RE = /^http:\/\/127\.0\.0\.1:\d{2,5}$/;
const USER_AGENT = "Takenlijstje/1 (prive gezinsapp)";
export const REQUEST_TIMEOUT_MS = 8_000;
export const TOTAL_BUDGET_MS = 12_000;
export const MAX_BYTES = 1_000_000;

export type SourceError = "UNREACHABLE" | "FORMAT" | "NOT_FOUND";
export type SourceResult<T> = { ok: true; value: T } | { ok: false; code: SourceError; http?: number };

export interface SourceDeps {
  fetch: typeof fetch;
  /** Totaalbudget van de hele opvraging */
  signal: AbortSignal;
  baseUrl: string;
}

export function sourceBaseUrl(override: string | undefined = process.env.WASTE_SOURCE_BASE_URL): string {
  if (!override) return WASTE_SOURCE_BASE_URL;
  if (OVERRIDE_RE.test(override)) return override;
  console.warn("[waste] override genegeerd");
  return WASTE_SOURCE_BASE_URL;
}

export function createSourceDeps(budgetMs = TOTAL_BUDGET_MS): SourceDeps {
  return { fetch: globalThis.fetch.bind(globalThis), signal: AbortSignal.timeout(budgetMs), baseUrl: sourceBaseUrl() };
}

async function readLimited(res: Response): Promise<string | null> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(all);
}

/** Eén GET op een pad dat alleen uit gecontroleerde, gecodeerde segmenten bestaat */
async function getJson<T>(segments: string[], schema: z.ZodType<T>, deps: SourceDeps): Promise<SourceResult<T>> {
  const url = `${deps.baseUrl}/rest/${segments.map(encodeURIComponent).join("/")}`;
  let res: Response;
  try {
    res = await deps.fetch(url, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.any([deps.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
    });
  } catch {
    return { ok: false, code: "UNREACHABLE" };
  }
  try {
    if (res.status === 404) {
      await res.body?.cancel().catch(() => undefined);
      return { ok: false, code: "NOT_FOUND", http: 404 };
    }
    if (res.status !== 200) {
      await res.body?.cancel().catch(() => undefined);
      return { ok: false, code: "UNREACHABLE", http: res.status };
    }
    if (!(res.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
      await res.body?.cancel().catch(() => undefined);
      return { ok: false, code: "FORMAT", http: 200 };
    }
    const text = await readLimited(res);
    if (text === null) return { ok: false, code: "FORMAT", http: 200 };
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, code: "FORMAT", http: 200 };
    }
    const parsed = schema.safeParse(json);
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false, code: "FORMAT", http: 200 };
  } catch {
    // Afgebroken tijdens het lezen (time-out)
    return { ok: false, code: "UNREACHABLE" };
  }
}

const POSTCODE_RE = /^[1-9][0-9]{3}[A-Z]{2}$/;
const BAG_ID_RE = /^[0-9]{16}$/;

/** A: adressen bij postcode en huisnummer; [] = onbekend */
export async function lookupAddress(postcode: string, houseNumber: number, deps: SourceDeps): Promise<SourceResult<AddressCandidate[]>> {
  if (!POSTCODE_RE.test(postcode) || !Number.isInteger(houseNumber) || houseNumber < 1 || houseNumber > 99999) {
    return { ok: false, code: "FORMAT" };
  }
  const result = await getJson(["adressen", `${postcode}-${houseNumber}`], addressesSchema, deps);
  if (!result.ok && result.code === "NOT_FOUND") return { ok: true, value: [] };
  return result;
}

/** B: de soorten van dit adres; 404 = adres onbekend geworden */
export async function fetchStreams(bagId: string, deps: SourceDeps): Promise<SourceResult<StreamDef[]>> {
  if (!BAG_ID_RE.test(bagId)) return { ok: false, code: "FORMAT" };
  return getJson(["adressen", bagId, "afvalstromen"], streamsSchema, deps);
}

/** C: alle ophaaldagen van een jaar; 404 = leeg (bijv. J+1 nog niet online) */
export async function fetchYear(bagId: string, year: number, deps: SourceDeps): Promise<SourceResult<RawPickup[]>> {
  if (!BAG_ID_RE.test(bagId) || !Number.isInteger(year) || year < 2020 || year > 2100) return { ok: false, code: "FORMAT" };
  const result = await getJson(["adressen", bagId, "kalender", String(year)], calendarSchema, deps);
  if (!result.ok && result.code === "NOT_FOUND") return { ok: true, value: [] };
  return result;
}

export interface FetchedPickups {
  /** Alleen datums vanaf vandaag */
  pickups: WastePickups;
  /** Aantal soorten dat niet rest, papier of PMD is (alleen geteld, AC-196) */
  unknownStreams: number;
  /** Staat er in de opgehaalde jaren ooit een rest-, papier- of PMD-datum? */
  hadAnyDate: boolean;
}

/** B + C(J), en C(J+1) als vandaag in december valt; parallel */
export async function fetchPickups(bagId: string, today: ISODate, deps: SourceDeps): Promise<SourceResult<FetchedPickups>> {
  const { year, month } = parts(today);
  const years = month === 12 ? [year, year + 1] : [year];
  const [streams, ...calendars] = await Promise.all([fetchStreams(bagId, deps), ...years.map((y) => fetchYear(bagId, y, deps))]);
  if (!streams.ok) return streams;
  for (const c of calendars) if (!c.ok) return c;

  const byId = new Map(streams.value.map((s) => [s.id, classifyStream(s)]));
  const all = emptyPickups();
  let hadAnyDate = false;
  for (const c of calendars) {
    if (!c.ok) continue;
    for (const p of c.value) {
      const stream = byId.get(p.streamId);
      if (!stream) continue;
      all[stream].push(p.date);
      hadAnyDate = true;
    }
  }
  const unknownStreams = [...byId.values()].filter((s) => s === null).length;
  return { ok: true, value: { pickups: futurePickups(all, today), unknownStreams, hadAnyDate } };
}
