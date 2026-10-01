import "server-only";

/**
 * Een adres opzoeken bij de huisvuilkalender (TECHNICAL_DESIGN §18.8.1). Schrijft
 * niets: eerst "Klopt dit?", dan pas bewaren (BR-48). Uitkomsten van de bron zijn
 * geen fouten maar soorten, zodat de UI elke toestand zonder foutpad toont.
 */
import type { ISODate } from "@/domain/dates";
import { formatPostcode, houseLabel, matchCandidate, type WasteAddress } from "@/domain/waste/address";
import { nextPickups, type WastePickups } from "@/domain/waste/plan";
import type { WasteStream } from "@/domain/waste/streams";
import { fetchPickups, lookupAddress, type SourceDeps } from "./source";

export interface FoundCalendar {
  kind: "found";
  /** Met de gekozen toevoeging ("" = zonder letter) */
  address: { postcode: string; houseNumber: number; suffix: string };
  bagId: string;
  /** "Laan van Meerdervoort 12A, Den Haag"; alleen voor de beheerder, nooit bewaard of gelogd */
  display: string;
  pickups: WastePickups;
  next: Record<WasteStream, ISODate | null>;
}

export type LookupOutcome =
  | FoundCalendar
  | { kind: "choose"; options: { suffix: string; label: string }[] }
  | { kind: "not_found" }
  | { kind: "no_streams" }
  | { kind: "no_upcoming" }
  | { kind: "unreachable" };

export async function lookupWasteCalendar(input: WasteAddress, today: ISODate, deps: SourceDeps): Promise<LookupOutcome> {
  const outcome = await lookup(input, today, deps);
  console.info(`[waste] lookup uitkomst=${outcome.kind}`);
  return outcome;
}

async function lookup(input: WasteAddress, today: ISODate, deps: SourceDeps): Promise<LookupOutcome> {
  const candidates = await lookupAddress(input.postcode, input.houseNumber, deps);
  if (!candidates.ok) return { kind: "unreachable" };

  const match = matchCandidate(candidates.value, input.houseNumber, input.suffix);
  if (match.kind === "not_found") return { kind: "not_found" };
  if (match.kind === "choose") return match;

  const fetched = await fetchPickups(match.candidate.bagId, today, deps);
  if (!fetched.ok) return { kind: "unreachable" };
  if (!fetched.value.hadAnyDate) return { kind: "no_streams" };
  const next = nextPickups(fetched.value.pickups, today);
  if (!next.rest && !next.papier && !next.pmd) return { kind: "no_upcoming" };

  const label = houseLabel(input.houseNumber, match.suffix);
  const { street, city } = match.candidate;
  const display = street ? `${street} ${label}, ${city ?? "Den Haag"}` : `${formatPostcode(input.postcode)} ${label}, Den Haag`;
  return {
    kind: "found",
    address: { postcode: input.postcode, houseNumber: input.houseNumber, suffix: match.suffix },
    bagId: match.candidate.bagId,
    display,
    pickups: fetched.value.pickups,
    next,
  };
}
