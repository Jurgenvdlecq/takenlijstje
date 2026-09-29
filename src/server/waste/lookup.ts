import "server-only";

/**
 * Opzoeken bij het instellen (TECHNICAL_DESIGN §18.8.1). Schrijft niets.
 * De uitkomsten zijn `kind`-waarden, geen fouten (§18.6).
 */
import { parts, zonedDate, type ISODate } from "@/domain/dates";
import { formatWasteAddress, isStorableSuffix, matchCandidate, type WasteAddress } from "@/domain/waste/address";
import { wasteAddressDisplay } from "@/domain/waste/messages";
import { hasNoUpcoming } from "@/domain/waste/plan";
import { WASTE_STREAMS, type WastePickups, type WasteStream } from "@/domain/waste/streams";
import { fetchPickups, lookupAddress } from "./schema";
import type { SourceDeps } from "./source";

export type NextPickups = Record<WasteStream, ISODate | null>;

export type WasteLookup =
  | {
      kind: "found";
      bagId: string;
      suffix: string;
      /** T-45a, alleen voor de beheerder; nooit bewaard of gelogd */
      display: string;
      pickups: WastePickups;
      next: NextPickups;
    }
  | { kind: "choose"; houseNumber: number; candidates: { suffix: string; display: string }[] }
  | { kind: "not_found" }
  | { kind: "no_streams" }
  | { kind: "no_upcoming" }
  | { kind: "unreachable" };

export function nextPerStream(pickups: WastePickups, today: ISODate): NextPickups {
  const next = { rest: null, papier: null, pmd: null } as NextPickups;
  for (const s of WASTE_STREAMS) next[s] = (pickups[s] ?? []).find((d) => d >= today) ?? null;
  return next;
}

export async function lookupWasteCalendar(
  address: WasteAddress,
  now: Date,
  timeZone: string,
  deps: SourceDeps,
): Promise<WasteLookup> {
  const today = zonedDate(now, timeZone);
  const fallback = (letter: string) => formatWasteAddress(address.postcode, address.houseNumber, letter);

  // 1. A → kandidaat
  const found = await lookupAddress(address.postcode, address.houseNumber, deps);
  if (!found.ok) return { kind: "unreachable" };
  const match = matchCandidate(found.value, address.suffix);
  if (match.kind === "not_found") return { kind: "not_found" };
  if (match.kind === "choose") {
    return {
      kind: "choose",
      houseNumber: address.houseNumber,
      candidates: match.candidates.map((c) => ({
        suffix: c.letter,
        display: wasteAddressDisplay(c.street, address.houseNumber, c.letter, fallback(c.letter)),
      })),
    };
  }
  const candidate = match.candidate;
  // Een toevoeging die niet te bewaren is, gaat nooit naar de database: dan zou
  // een checkfout het adres in een platformlog zetten (security-review WP3b, punt 4)
  if (!isStorableSuffix(candidate.letter)) return { kind: "not_found" };

  // 2. B + C(J) (+ C(J+1) als het nodig is; nooit C(J−1))
  const fetched = await fetchPickups(candidate.bagId, today, deps);

  // 3. Uitkomst, in deze volgorde
  if (!fetched.ok) return fetched.code === "NOT_FOUND" ? { kind: "not_found" } : { kind: "unreachable" };
  const { pickups, hadAnyDateInJ } = fetched.value;
  if (!hasNoUpcoming(pickups, today)) {
    return {
      kind: "found",
      bagId: candidate.bagId,
      suffix: candidate.letter,
      display: wasteAddressDisplay(candidate.street, address.houseNumber, candidate.letter, fallback(candidate.letter)),
      pickups,
      next: nextPerStream(pickups, today),
    };
  }
  if (parts(today).month === 1) return { kind: "no_upcoming" };
  if (!hadAnyDateInJ) return { kind: "no_streams" };
  return { kind: "no_upcoming" };
}
