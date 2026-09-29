import "server-only";

/**
 * Parser van de gemeentebron (TECHNICAL_DESIGN §18.1.3, §18.1.4). Alleen de
 * velden uit de tabel worden gelezen; zod stript de rest (coördinaten, ids,
 * HTML, iconen) vóór elk ander gebruik (BR-58, AC-218).
 */
import { z } from "zod";
import { isISODate, parts, type ISODate } from "@/domain/dates";
import { candidateLetter } from "@/domain/waste/address";
import { hasNoUpcoming, type FetchedPickups } from "@/domain/waste/plan";
import { classifyStream, normalizePickups, WASTE_STREAMS, type WastePickups, type WasteStream } from "@/domain/waste/streams";
import { fetchAddressRaw, fetchStreamsRaw, fetchYearRaw, type Fetched, type SourceDeps, type SourceResult } from "./source";

const isoDate = z.string().refine(isISODate);

/** bagId als string van 16 cijfers; een number wordt links aangevuld met nullen */
const bagId = z.union([
  z.string().regex(/^[0-9]{16}$/),
  z
    .number()
    .int()
    .nonnegative()
    .transform((n) => String(n).padStart(16, "0"))
    .refine((s) => /^[0-9]{16}$/.test(s)),
]);

const AddressItem = z.object({
  bagId,
  huisletter: z.string().nullish(),
  huisnummerToevoeging: z.string().nullish(),
  // Alleen voor de weergave T-45a, nooit bewaard
  openbareRuimteNaam: z.string().nullish(),
  huisnummer: z.union([z.number(), z.string()]).nullish(),
  woonplaatsNaam: z.string().nullish(),
});
const AddressBody = z.array(AddressItem);

const StreamItem = z.object({
  id: z.number().int(),
  title: z.string(),
  menu_title: z.string().nullish(),
  icon: z.string().nullish(),
  ophaaldatum: isoDate.nullish(),
});
/** B: een lijst soorten, of precies `{}` voor een onbekende adrescode (U0.2) */
const StreamsBody = z.union([z.strictObject({}), z.array(StreamItem)]);

const YearItem = z.object({ afvalstroom_id: z.number().int(), ophaaldatum: isoDate.nullish() });
const YearBody = z.array(YearItem);

export interface AddressCandidateInfo {
  bagId: string;
  letter: string;
  street: string | null;
}

/** A: kandidaten; `[]` = onbekend adres (geen fout) */
export async function lookupAddress(
  postcode: string,
  houseNumber: number,
  deps: SourceDeps,
): Promise<SourceResult<AddressCandidateInfo[]>> {
  const fetched = await fetchAddressRaw(postcode, houseNumber, deps);
  if (fetched.kind === "error") return { ok: false, code: fetched.code, http: fetched.http };
  if (fetched.kind === "not_found") return { ok: false, code: "UNREACHABLE", http: 404 };
  const parsed = AddressBody.safeParse(fetched.body);
  if (!parsed.success) return { ok: false, code: "FORMAT" };
  return {
    ok: true,
    value: parsed.data.map((a) => ({
      bagId: a.bagId,
      letter: candidateLetter(a.huisletter, a.huisnummerToevoeging),
      street: a.openbareRuimteNaam?.trim() || null,
    })),
  };
}

/** B: id → bak; `{}`, `[]` of 404 → NOT_FOUND ("adres weg") */
export async function fetchStreams(
  bagIdValue: string,
  deps: SourceDeps,
): Promise<SourceResult<{ byId: Map<number, WasteStream | null> }>> {
  const fetched = await fetchStreamsRaw(bagIdValue, deps);
  if (fetched.kind === "error") return { ok: false, code: fetched.code, http: fetched.http };
  if (fetched.kind === "not_found") return { ok: false, code: "NOT_FOUND", http: 404 };
  const parsed = StreamsBody.safeParse(fetched.body);
  if (!parsed.success) return { ok: false, code: "FORMAT" };
  if (!Array.isArray(parsed.data) || parsed.data.length === 0) return { ok: false, code: "NOT_FOUND" };
  return { ok: true, value: { byId: new Map(parsed.data.map((s) => [s.id, classifyStream(s)])) } };
}

type YearRows = { afvalstroom_id: number; ophaaldatum: ISODate }[];

function parseYear(fetched: Fetched): SourceResult<YearRows> {
  if (fetched.kind === "error") return { ok: false, code: fetched.code, http: fetched.http };
  // C: 404 of [] = leeg, geen fout (§18.1.3)
  if (fetched.kind === "not_found") return { ok: true, value: [] };
  const parsed = YearBody.safeParse(fetched.body);
  if (!parsed.success) return { ok: false, code: "FORMAT" };
  return {
    ok: true,
    value: parsed.data.filter((r): r is YearRows[number] => typeof r.ophaaldatum === "string"),
  };
}

/** C: ophaaldagen van een jaar */
export async function fetchYear(bagIdValue: string, year: number, deps: SourceDeps): Promise<SourceResult<YearRows>> {
  return parseYear(await fetchYearRaw(bagIdValue, year, deps));
}

function toPickups(rows: YearRows, byId: Map<number, WasteStream | null>): { dates: Partial<Record<WasteStream, string[]>>; unknown: number } {
  const dates: Partial<Record<WasteStream, string[]>> = {};
  let unknown = 0;
  for (const row of rows) {
    const stream = byId.get(row.afvalstroom_id);
    if (!stream) {
      unknown++;
      continue;
    }
    (dates[stream] ??= []).push(row.ophaaldatum);
  }
  return { dates, unknown };
}

function merge(...sets: Partial<Record<WasteStream, string[]>>[]): Partial<Record<WasteStream, string[]>> {
  const result: Partial<Record<WasteStream, string[]>> = {};
  for (const set of sets) for (const s of WASTE_STREAMS) if (set[s]) result[s] = [...(result[s] ?? []), ...set[s]!];
  return result;
}

const anyDate = (d: Partial<Record<WasteStream, string[]>>) => WASTE_STREAMS.some((s) => (d[s]?.length ?? 0) > 0);

/**
 * B + C(J), en C(J+1) in december of als C(J) geen komende datum meer heeft.
 * Nooit C(J−1). Resultaat: datums ≥ vandaag, per bak, gesorteerd en uniek.
 */
export async function fetchPickups(
  bagIdValue: string,
  today: ISODate,
  deps: SourceDeps,
): Promise<SourceResult<FetchedPickups>> {
  const { year, month } = parts(today);
  const december = month === 12;

  const [streams, current, earlyNext] = await Promise.all([
    fetchStreams(bagIdValue, deps),
    fetchYear(bagIdValue, year, deps),
    december ? fetchYear(bagIdValue, year + 1, deps) : Promise.resolve(null),
  ]);
  if (!streams.ok) return streams.code === "NOT_FOUND" ? { ok: false, code: "NOT_FOUND" } : streams;
  if (!current.ok) return { ok: false, code: "UNREACHABLE", http: current.http };

  const byId = streams.value.byId;
  const inJ = toPickups(current.value, byId);
  const upcomingInJ = normalizePickups(inJ.dates);

  let next = earlyNext;
  if (!next && hasNoUpcoming(upcomingInJ, today)) next = await fetchYear(bagIdValue, year + 1, deps);
  if (next && !next.ok) return { ok: false, code: "UNREACHABLE", http: next.http };

  const inNext = next?.ok ? toPickups(next.value, byId) : { dates: {}, unknown: 0 };
  const all = normalizePickups(merge(inJ.dates, inNext.dates));
  const pickups: WastePickups = { rest: [], papier: [], pmd: [] };
  for (const s of WASTE_STREAMS) pickups[s] = all[s].filter((d) => d >= today);

  return {
    ok: true,
    value: {
      pickups,
      unknownStreams: inJ.unknown + inNext.unknown,
      hadAnyDateInJ: anyDate(inJ.dates),
      fetchedNextYear: Boolean(next?.ok),
      nextYearHasDate: anyDate(inNext.dates),
    },
  };
}
