import "server-only";

/**
 * Afvalkalender bijwerken en plannen, met de service role (TECHNICAL_DESIGN
 * §5.3, §18.7, §18.8). Filtert altijd op household_id. Logt alleen tellingen,
 * codes en fetchMs; nooit een adres, adrescode of URL (§18.12).
 */
import { addDays, zonedDate, type ISODate } from "@/domain/dates";
import { findExpiredWasteTasks } from "@/domain/waste/expire";
import { dueForFetch, wasteFailureVariant, wasteSyncHealth, type WasteHealth } from "@/domain/waste/health";
import { wasteFailureMessage } from "@/domain/waste/messages";
import { classifyEmpty, isEmptyPlan, planWasteTasks, type ExistingWasteTask, type WastePlan } from "@/domain/waste/plan";
import { normalizePickups, type WastePickups } from "@/domain/waste/streams";
import { appUrl } from "@/lib/app-url";
import type { DbClient } from "@/lib/supabase/server";
import { fetchPickups } from "@/server/waste/schema";
import type { SourceDeps } from "@/server/waste/source";
import type { TaskRow, WasteCalendarRow, WasteErrorCode } from "@/types/database";
import { check } from "../../errors";
import { chunks, HOUSEHOLD_TIMEZONE } from "../../services/scheduling";
import { createAdminClient } from "../admin-client";
import { notify } from "../dispatcher";

/** Totaalbudget van één ophaling (action of tickstap) */
export const WASTE_FETCH_BUDGET_MS = 12_000;
/** Ophalen start alleen als de tick nog geen 10 s loopt */
const TICK_FETCH_CUTOFF_MS = 10_000;
/** Hoe ver terug de tick afgevinkte afvaltaken leest (voor het vervallen) */
const TICK_LOOKBACK_DAYS = 35;


type WasteTaskRow = Pick<TaskRow, "id" | "household_id" | "status" | "waste_pickup_date" | "waste_direction" | "waste_streams">;
const WASTE_TASK_COLUMNS = "id, household_id, status, waste_pickup_date, waste_direction, waste_streams";

function toExisting(rows: WasteTaskRow[]): ExistingWasteTask[] {
  return rows
    .filter((r) => r.waste_pickup_date && r.waste_direction)
    .map((r) => ({
      id: r.id,
      pickupDate: r.waste_pickup_date!,
      direction: r.waste_direction!,
      streams: r.waste_streams ?? [],
      status: r.status,
    }));
}

async function loadWasteTasks(db: DbClient, householdId: string, from: ISODate): Promise<WasteTaskRow[]> {
  return check(
    await db
      .from("tasks")
      .select(WASTE_TASK_COLUMNS)
      .eq("household_id", householdId)
      .not("waste_direction", "is", null)
      .gte("waste_pickup_date", from),
  ) as WasteTaskRow[];
}

// ---------------------------------------------------------------------------
// Adres opslaan (waste_save) en bijwerken (waste_sync)
// ---------------------------------------------------------------------------

export interface SaveInput {
  householdId: string;
  memberId: string;
  postcode: string;
  houseNumber: number;
  suffix: string;
  bagId: string;
  pickups: WastePickups;
  now: Date;
}

/** Nieuw of ander adres (BR-48, BR-56). Open afvaltaken worden vervangen. */
export async function saveWasteCalendar(input: SaveInput): Promise<{ version: number; removed: number; inserted: number }> {
  const db = createAdminClient();
  const tz = HOUSEHOLD_TIMEZONE;
  const today = zonedDate(input.now, tz);
  // Afgevinkte en overgeslagen taken blijven; open taken verwijdert de RPC eerst
  const kept = toExisting(await loadWasteTasks(db, input.householdId, today)).filter(
    (t) => t.status === "done" || t.status === "skipped",
  );
  const plan = planWasteTasks({ pickups: input.pickups, existing: kept, now: input.now, timeZone: tz });
  return check(
    await db.rpc("waste_save", {
      p_household_id: input.householdId,
      p_member_id: input.memberId,
      p_postcode: input.postcode,
      p_house_number: input.houseNumber,
      p_house_suffix: input.suffix,
      p_bag_id: input.bagId,
      p_pickups: input.pickups,
      p_insert: plan.insert,
      p_now: input.now.toISOString(),
    }),
  ) as { version: number; removed: number; inserted: number };
}

export type SyncOutcome =
  | { result: "success"; pickups: WastePickups }
  | { result: "failure"; code: WasteErrorCode }
  | null;

export interface SyncCounts {
  stale: boolean;
  removed: number;
  moved: number;
  renamed: number;
  inserted: number;
}

const NO_CHANGES: SyncCounts = { stale: false, removed: 0, moved: 0, renamed: 0, inserted: 0 };

/**
 * Plant op de effectieve datums en roept waste_sync aan als er een uitkomst of
 * een niet-leeg plan is. Verwijderen, verschuiven en hernoemen alleen na een
 * geslaagde ophaling; anders alleen nieuwe taken (§18.8.6).
 */
export async function applyWasteSync(
  db: DbClient,
  cal: Pick<WasteCalendarRow, "household_id" | "version" | "pickups">,
  outcome: SyncOutcome,
  existingRows: WasteTaskRow[],
  now: Date,
): Promise<SyncCounts> {
  const tz = HOUSEHOLD_TIMEZONE;
  const today = zonedDate(now, tz);
  const pickups = outcome?.result === "success" ? outcome.pickups : normalizePickups(cal.pickups ?? {});
  const existing = toExisting(existingRows).filter((t) => t.pickupDate >= today);
  let plan: WastePlan = planWasteTasks({ pickups, existing, now, timeZone: tz });
  if (outcome?.result !== "success") plan = { insert: plan.insert, move: [], rename: [], remove: [] };
  if (!outcome && isEmptyPlan(plan)) return NO_CHANGES;

  return check(
    await db.rpc("waste_sync", {
      p_household_id: cal.household_id,
      p_version: cal.version,
      p_result: outcome?.result ?? null,
      p_error_code: outcome?.result === "failure" ? outcome.code : null,
      p_pickups: outcome?.result === "success" ? outcome.pickups : null,
      p_remove: plan.remove,
      p_move: plan.move,
      p_rename: plan.rename,
      p_insert: plan.insert,
      p_now: now.toISOString(),
    }),
  ) as SyncCounts;
}

/** Eén ophaling bij de bron, vertaald naar een uitkomst (§18.8.6 stap 3) */
export async function fetchOutcome(
  bagId: string,
  now: Date,
  deps: SourceDeps = {},
): Promise<{ outcome: Exclude<SyncOutcome, null>; fetchMs: number }> {
  const started = Date.now();
  const signal = deps.signal ?? AbortSignal.timeout(WASTE_FETCH_BUDGET_MS);
  const fetched = await fetchPickups(bagId, zonedDate(now, HOUSEHOLD_TIMEZONE), { ...deps, signal });
  const fetchMs = Date.now() - started;
  if (!fetched.ok) {
    const code: WasteErrorCode = fetched.code === "NOT_FOUND" ? "ADDRESS_GONE" : fetched.code;
    return { outcome: { result: "failure", code }, fetchMs };
  }
  const classified = classifyEmpty(fetched.value, zonedDate(now, HOUSEHOLD_TIMEZONE));
  return {
    outcome: classified.result === "success" ? { result: "success", pickups: fetched.value.pickups } : { result: "failure", code: classified.code },
    fetchMs,
  };
}

/** Claim: lease en rate limit (≥ 60 s), zonder lock (§18.8.3) */
export async function claimWasteFetch(db: DbClient, householdId: string, version: number, now: Date): Promise<boolean> {
  const rows = check(
    await db
      .from("waste_calendars")
      .update({ last_attempt_at: now.toISOString() })
      .eq("household_id", householdId)
      .eq("version", version)
      .or(`last_attempt_at.is.null,last_attempt_at.lt.${new Date(now.getTime() - 60_000).toISOString()}`)
      .select("household_id"),
  );
  return rows.length > 0;
}

/** Storing vastgesteld; de voorwaarde op last_success_at voorkomt een blijvend alarm na herstel */
export async function markWasteAlarm(db: DbClient, householdId: string, lastSuccessAt: string, now: Date): Promise<void> {
  check(
    await db
      .from("waste_calendars")
      .update({ alarm_since: now.toISOString() })
      .eq("household_id", householdId)
      .is("alarm_since", null)
      .eq("last_success_at", lastSuccessAt),
  );
}

async function readCalendar(db: DbClient, householdId: string): Promise<WasteCalendarRow | null> {
  const rows = check(await db.from("waste_calendars").select("*").eq("household_id", householdId)) as WasteCalendarRow[];
  return rows[0] ?? null;
}

export function calendarHealth(cal: WasteCalendarRow, now: Date): WasteHealth {
  return wasteSyncHealth(
    {
      last_success_at: cal.last_success_at,
      last_error_code: cal.last_error_code,
      error_since: cal.error_since,
      last_failure_at: cal.last_failure_at,
      alarm_since: cal.alarm_since,
      pickups: normalizePickups(cal.pickups ?? {}),
    },
    now,
    HOUSEHOLD_TIMEZONE,
  );
}

/** Storingsmelding aan alle actieve beheerders; één per storing via de dedupe-sleutel (§18.9.3) */
async function alertFailure(db: DbClient, cal: WasteCalendarRow, health: WasteHealth, now: Date): Promise<void> {
  await markWasteAlarm(db, cal.household_id, cal.last_success_at, now);
  const text = wasteFailureMessage(health.variant ?? wasteFailureVariant(cal.last_error_code), cal.last_success_at, HOUSEHOLD_TIMEZONE);
  await notify({
    householdId: cal.household_id,
    message: {
      type: "waste_sync_failed",
      title: text.title,
      body: text.body,
      url: appUrl.wasteSettings(),
      dedupeKey: `waste-failed:${cal.last_success_at}`,
    },
  });
}

/**
 * "Opnieuw proberen" (§18.6): claim, ophalen, plannen, en bij `failed` het
 * alarm vastleggen. De claim is al gedaan door de aanroeper.
 */
export async function syncHousehold(
  householdId: string,
  now: Date,
  deps: SourceDeps = {},
): Promise<{ health: WasteHealth; attemptedAt: string } | null> {
  const db = createAdminClient();
  const cal = await readCalendar(db, householdId);
  if (!cal) return null;
  const { outcome } = await fetchOutcome(cal.bag_id, now, deps);
  const today = zonedDate(now, HOUSEHOLD_TIMEZONE);
  await applyWasteSync(db, cal, outcome, await loadWasteTasks(db, householdId, today), now);
  const after = (await readCalendar(db, householdId)) ?? cal;
  const health = calendarHealth(after, now);
  if (health.state === "failed") await markWasteAlarm(db, householdId, after.last_success_at, now);
  return { health, attemptedAt: now.toISOString() };
}

/** Claim voor "Opnieuw proberen"; geen rij = `too_soon` (zonder verzoek naar buiten) */
export async function claimForRetry(householdId: string, now: Date): Promise<boolean> {
  const db = createAdminClient();
  const cal = await readCalendar(db, householdId);
  if (!cal) return false;
  return claimWasteFetch(db, householdId, cal.version, now);
}

/** Zelfde adres opnieuw bevestigd (§18.6 (c)): de net opgehaalde datums, zonder claim */
export async function applyConfirmedSameAddress(
  householdId: string,
  version: number,
  pickups: WastePickups,
  now: Date,
): Promise<SyncCounts> {
  const db = createAdminClient();
  const cal = await readCalendar(db, householdId);
  if (!cal) return { ...NO_CHANGES, stale: true };
  const today = zonedDate(now, HOUSEHOLD_TIMEZONE);
  return applyWasteSync(db, { ...cal, version }, { result: "success", pickups }, await loadWasteTasks(db, householdId, today), now);
}

// ---------------------------------------------------------------------------
// Tickstap (§18.8.6)
// ---------------------------------------------------------------------------

export interface WasteStepReport {
  calendars: number;
  fetched: number;
  fetchFailed: number;
  inserted: number;
  moved: number;
  renamed: number;
  removed: number;
  expired: number;
  alerted: number;
}

export async function runWasteStep(
  db: DbClient,
  now: Date,
  tickStarted: number,
  deps: SourceDeps = {},
): Promise<WasteStepReport> {
  const report: WasteStepReport = {
    calendars: 0, fetched: 0, fetchFailed: 0, inserted: 0, moved: 0, renamed: 0, removed: 0, expired: 0, alerted: 0,
  };
  const calendars = check(await db.from("waste_calendars").select("*")) as WasteCalendarRow[];
  report.calendars = calendars.length;
  if (!calendars.length) return report;

  const tz = HOUSEHOLD_TIMEZONE;
  const today = zonedDate(now, tz);
  const householdIds = calendars.map((c) => c.household_id);
  const allTasks: WasteTaskRow[] = [];
  for (const ids of chunks(householdIds)) {
    allTasks.push(
      ...(check(
        await db
          .from("tasks")
          .select(WASTE_TASK_COLUMNS)
          .in("household_id", ids)
          .not("waste_direction", "is", null)
          .or(`status.in.(todo,in_progress),waste_pickup_date.gte.${addDays(today, -TICK_LOOKBACK_DAYS)}`),
      ) as WasteTaskRow[]),
    );
  }

  for (const cal of calendars) {
    const tasks = allTasks.filter((t) => t.household_id === cal.household_id);

    // Ophalen: twee vaste momenten, na een mislukking elk uur, binnen het tickbudget
    let outcome: SyncOutcome = null;
    if (
      dueForFetch(cal, now, tz) &&
      Date.now() - tickStarted < TICK_FETCH_CUTOFF_MS &&
      (await claimWasteFetch(db, cal.household_id, cal.version, now))
    ) {
      const fetched = await fetchOutcome(cal.bag_id, now, deps);
      outcome = fetched.outcome;
      report.fetched++;
      if (outcome.result === "failure") {
        report.fetchFailed++;
        console.warn(`[waste] ophalen mislukt code=${outcome.code} fetchMs=${fetched.fetchMs}`);
      } else {
        console.info(`[waste] opgehaald fetchMs=${fetched.fetchMs}`);
      }
    }

    // Plannen en de uitkomst vastleggen
    try {
      const counts = await applyWasteSync(db, cal, outcome, tasks, now);
      if (counts.stale) continue;
      report.inserted += counts.inserted;
      report.moved += counts.moved;
      report.renamed += counts.renamed;
      report.removed += counts.removed;
    } catch (error) {
      const e = error as { code?: string };
      console.error(`[waste] sync mislukt code=${e?.code === "23505" ? "CONFLICT" : (e?.code ?? "fout")}`);
      continue;
    }

    // Vanzelf vervallen (BR-54); alleen open taken, het systeem (geen doorwerking)
    const expired = findExpiredWasteTasks(toExisting(tasks), today);
    if (expired.length) {
      const rows = check(
        await db
          .from("tasks")
          .update({ status: "skipped" })
          .in("id", expired)
          .eq("household_id", cal.household_id)
          .in("status", ["todo", "in_progress"])
          .select("id"),
      );
      report.expired += rows.length;
    }

    // Storing: op de stand ná waste_sync
    const after = outcome ? await readCalendar(db, cal.household_id) : cal;
    if (!after) continue;
    const health = calendarHealth(after, now);
    if (health.state === "failed") {
      await alertFailure(db, after, health, now);
      report.alerted++;
    }
  }
  return report;
}
