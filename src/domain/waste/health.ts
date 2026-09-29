/**
 * Wanneer ophalen, en hoe gezond is het bijwerken? (TECHNICAL_DESIGN §18.8.3,
 * §18.8.5). Puur; gebruikt door de UI én de tick.
 */
import { addDays, parts, zonedDate, zonedInstant, type ISODate } from "@/domain/dates";
import type { WasteVariant } from "./messages";
import { hasNoUpcoming, WASTE_HORIZON_DAYS } from "./plan";
import { WASTE_STREAMS, type WastePickups } from "./streams";

/** Twee vaste ophaalmomenten per dag (Europe/Amsterdam) */
export const FETCH_SLOTS = ["06:00", "17:00"] as const;
/** Na een mislukking hooguit elk uur opnieuw */
const RETRY_AFTER_MS = 60 * 60_000;
/** Storing als het langer dan 48 uur niet lukte (V-50) */
const STALE_AFTER_MS = 48 * 60 * 60_000;
/** Twee lege antwoorden minstens een uur uit elkaar */
const EMPTY_ALARM_MS = 60 * 60_000;

export type WasteErrorCode = "UNREACHABLE" | "FORMAT" | "SUSPECT_EMPTY" | "ADDRESS_GONE";

export interface WasteFetchState {
  last_success_at: string;
  last_attempt_at: string | null;
}

/** Het laatste ophaalmoment ≤ nu */
export function lastFetchSlot(now: Date, timeZone: string): Date {
  const today = zonedDate(now, timeZone);
  for (const day of [today, addDays(today, -1)]) {
    for (const slot of [...FETCH_SLOTS].reverse()) {
      const moment = new Date(zonedInstant(day, slot, timeZone));
      if (moment.getTime() <= now.getTime()) return moment;
    }
  }
  return new Date(zonedInstant(addDays(today, -1), FETCH_SLOTS[0], timeZone));
}

/** Moet de tick nu ophalen? (§18.8.3) */
export function dueForFetch(cal: WasteFetchState, now: Date, timeZone: string): boolean {
  if (new Date(cal.last_success_at).getTime() >= lastFetchSlot(now, timeZone).getTime()) return false;
  if (cal.last_attempt_at === null) return true;
  return now.getTime() - new Date(cal.last_attempt_at).getTime() > RETRY_AFTER_MS;
}

export interface WasteHealthInput {
  last_success_at: string;
  last_error_code: WasteErrorCode | null;
  error_since: string | null;
  last_failure_at: string | null;
  alarm_since: string | null;
  pickups: WastePickups;
}

export type WasteHealthState = "ok" | "retrying" | "failed";
export type WasteFailedReason = "empty" | "stale" | "held";

export interface WasteHealth {
  state: WasteHealthState;
  reason?: WasteFailedReason;
  variant?: WasteVariant;
  lastErrorCode: WasteErrorCode | null;
  lastSuccessAt: string;
  notice?: "next_year_missing";
}

/** Balk en melding per foutcode (§18.8.5); `null` → H1/M-03 */
export function wasteFailureVariant(lastErrorCode: WasteErrorCode | null): WasteVariant {
  if (lastErrorCode === "SUSPECT_EMPTY") return "H2";
  if (lastErrorCode === "ADDRESS_GONE") return "H3";
  return "H1";
}

/** H2: T-77a in december en januari, anders T-77b */
export function isNewYearPeriod(now: Date, timeZone: string): boolean {
  const { month } = parts(zonedDate(now, timeZone));
  return month === 12 || month === 1;
}

const ms = (iso: string) => new Date(iso).getTime();

function hasDateInYear(pickups: WastePickups, year: number): boolean {
  return WASTE_STREAMS.some((s) => (pickups[s] ?? []).some((d) => d.startsWith(`${year}-`)));
}

/** Stille regel T-73: de kalender van volgend jaar staat nog niet online */
function nextYearNotice(input: WasteHealthInput, today: ISODate): boolean {
  if (input.last_error_code !== null) return false;
  const { year, month } = parts(today);
  if (hasDateInYear(input.pickups, year + 1)) return false;
  const windowReachesJanuary = month === 12 && addDays(today, WASTE_HORIZON_DAYS) >= `${year + 1}-01-01`;
  const yearEnd = (month === 11 || month === 12) && hasNoUpcoming(input.pickups, today);
  return windowReachesJanuary || yearEnd;
}

/** Toestand volgens de tabel in §18.8.5; `last_attempt_at` telt bewust niet mee */
export function wasteSyncHealth(input: WasteHealthInput, now: Date, timeZone: string): WasteHealth {
  const base = { lastErrorCode: input.last_error_code, lastSuccessAt: input.last_success_at };
  const variant = wasteFailureVariant(input.last_error_code);

  if (
    input.last_error_code === "SUSPECT_EMPTY" &&
    input.error_since &&
    input.last_failure_at &&
    ms(input.last_failure_at) - ms(input.error_since) >= EMPTY_ALARM_MS
  ) {
    return { ...base, state: "failed", reason: "empty", variant };
  }
  if (now.getTime() - ms(input.last_success_at) > STALE_AFTER_MS) {
    return { ...base, state: "failed", reason: "stale", variant };
  }
  if (input.alarm_since !== null) return { ...base, state: "failed", reason: "held", variant };
  if (input.last_error_code !== null) return { ...base, state: "retrying" };

  const notice = nextYearNotice(input, zonedDate(now, timeZone));
  return notice ? { ...base, state: "ok", notice: "next_year_missing" } : { ...base, state: "ok" };
}
