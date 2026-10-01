/**
 * Wanneer ophalen en hoe gezond is het bijwerken (W-03, BR-51, BR-52;
 * TECHNICAL_DESIGN §18.8.3, §18.8.5). Puur; gebruikt door de tick en de UI.
 */
import { todayIn, zonedDate, zonedTime } from "../dates";

export type WasteErrorCode = "UNREACHABLE" | "FORMAT" | "SUSPECT_EMPTY" | "ADDRESS_GONE";

export interface WasteSyncState {
  last_attempt_at: string | null;
  last_success_at: string;
  last_error_code: WasteErrorCode | null;
  failure_count: number;
  first_failure_at: string | null;
}

const MINUTE = 60_000;
/** Tussen twee automatische pogingen (ook na een mislukte) */
export const FETCH_INTERVAL_MINUTES = 60;
/** Tussen twee pogingen samen (claim; ook "Opnieuw proberen") */
export const CLAIM_SECONDS = 60;
const STALE_HOURS = 48;

export function dueForFetch(cal: WasteSyncState, now: Date, timeZone: string): boolean {
  if (cal.last_attempt_at && now.getTime() - new Date(cal.last_attempt_at).getTime() < FETCH_INTERVAL_MINUTES * MINUTE) {
    return false;
  }
  if (cal.last_error_code) return true;
  return zonedDate(cal.last_success_at, timeZone) < todayIn(timeZone, now) && zonedTime(now, timeZone).hour >= 6;
}

export type WasteHealth = { state: "ok" } | { state: "retrying" } | { state: "failed"; reason: "stale" | "empty" };

export function wasteSyncHealth(cal: WasteSyncState, now: Date): WasteHealth {
  const empty =
    cal.last_error_code === "SUSPECT_EMPTY" &&
    cal.failure_count >= 2 &&
    !!cal.first_failure_at &&
    now.getTime() - new Date(cal.first_failure_at).getTime() >= FETCH_INTERVAL_MINUTES * MINUTE;
  if (empty) return { state: "failed", reason: "empty" };
  if (now.getTime() - new Date(cal.last_success_at).getTime() > STALE_HOURS * 60 * MINUTE) return { state: "failed", reason: "stale" };
  if (cal.last_error_code) return { state: "retrying" };
  return { state: "ok" };
}
