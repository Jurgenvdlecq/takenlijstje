import "server-only";

/**
 * Afvalkalender: opslaan, bijwerken en de tickstap "afval" (W-03; TECHNICAL_DESIGN
 * §18.6–§18.9). Systeemhandelingen met de service role (§5.3):
 *  - opslaan alleen NA requireAdmin + opvraging in de server action; de RPC
 *    controleert opnieuw dat het lid actieve beheerder is;
 *  - bijwerken raakt alleen open afvaltaken (invoegen, hernoemen, verwijderen);
 *  - vervallen (BR-54) en de storingsmelding aan beheerders (BR-52).
 * Logregels bevatten alleen tellingen en codes: geen adres, adrescode of huishouden.
 */
import { addDays, todayIn } from "@/domain/dates";
import { findExpiredWasteTasks, type ExpiryWasteTask } from "@/domain/waste/expire";
import { CLAIM_SECONDS, dueForFetch, wasteSyncHealth, type WasteHealth } from "@/domain/waste/health";
import { WASTE_SETTINGS_URL, wasteFailureMessage } from "@/domain/waste/messages";
import { isEmptyPlan, isSuspectEmpty, planWasteTasks, type WastePickups } from "@/domain/waste/plan";
import type { DbClient } from "@/lib/supabase/server";
import type { WasteCalendarRow, WasteErrorCode } from "@/types/database";
import { check } from "../../errors";
import { chunks, HOUSEHOLD_TIMEZONE, selectAll } from "../../services/scheduling";
import type { FoundCalendar } from "../../waste/lookup";
import { createSourceDeps, fetchPickups, type SourceDeps } from "../../waste/source";
import { createAdminClient } from "../admin-client";
import { notify } from "../dispatcher";

const TZ = HOUSEHOLD_TIMEZONE;
/** Na zoveel ms in de tick niet meer bij de gemeente ophalen (§18.13) */
const FETCH_START_LIMIT_MS = 10_000;
const TASK_COLUMNS = "id, household_id, status, scheduled_date, waste_pickup_date, waste_direction, waste_streams";

export type WasteTaskRow = ExpiryWasteTask & { household_id: string };

export interface WasteStepReport {
  calendars: number;
  fetched: number;
  fetchFailed: number;
  inserted: number;
  renamed: number;
  removed: number;
  expired: number;
  alerted: number;
  /** Huishoudens waarbij de stap een fout gaf (de andere gingen door) */
  failed: number;
}

async function loadWasteTasks(db: DbClient, householdIds: string[], today: string): Promise<WasteTaskRow[]> {
  if (!householdIds.length) return [];
  return selectAll<WasteTaskRow>((from, to) =>
    db
      .from("tasks")
      .select(TASK_COLUMNS)
      .not("waste_direction", "is", null)
      .in("household_id", householdIds)
      .or(`status.in.(todo,in_progress),waste_pickup_date.gte.${addDays(today, -35)}`)
      .order("id")
      .range(from, to) as unknown as PromiseLike<{ data: WasteTaskRow[] | null; error: unknown }>,
  );
}

async function loadCalendar(db: DbClient, householdId: string): Promise<WasteCalendarRow | null> {
  const rows = check(await db.from("waste_calendars").select("*").eq("household_id", householdId).limit(1)) as WasteCalendarRow[];
  return rows[0] ?? null;
}

/** Nieuw adres opslaan (BR-56: alle open afvaltaken van het vorige adres worden vervangen) */
export async function saveWasteCalendar(householdId: string, memberId: string, found: FoundCalendar, now = new Date()) {
  const db = createAdminClient();
  const plan = planWasteTasks({ pickups: found.pickups, existing: [], now, timeZone: TZ });
  const result = check(
    await db.rpc("waste_save", {
      p_household_id: householdId,
      p_member_id: memberId,
      p_postcode: found.address.postcode,
      p_house_number: found.address.houseNumber,
      p_house_suffix: found.address.suffix,
      p_bag_id: found.bagId,
      p_pickups: found.pickups,
      p_insert: plan.insert,
      p_now: now.toISOString(),
    }),
  ) as { inserted: number; removed: number };
  return { inserted: result.inserted, removed: result.removed };
}

/**
 * Bevestigen: is het adres gelijk aan het bewaarde, dan de zojuist opgehaalde
 * datums direct toepassen (zonder claim; open taken, notities en "bezig"
 * blijven). Anders opslaan als nieuw adres. Wie het laatst bevestigt, geldt.
 */
export async function confirmWasteCalendar(householdId: string, memberId: string, found: FoundCalendar, now = new Date()) {
  const db = createAdminClient();
  const current = await loadCalendar(db, householdId);
  const same =
    current &&
    current.bag_id === found.bagId &&
    current.postcode === found.address.postcode &&
    current.house_number === found.address.houseNumber &&
    current.house_suffix === found.address.suffix;
  if (!same) return saveWasteCalendar(householdId, memberId, found, now);

  const tasks = await loadWasteTasks(db, [householdId], todayIn(TZ, now));
  const plan = planWasteTasks({ pickups: found.pickups, existing: tasks, now, timeZone: TZ });
  const result = check(
    await db.rpc("waste_sync", {
      p_household_id: householdId,
      p_version: current.version,
      p_result: "success",
      p_error_code: null,
      p_pickups: found.pickups,
      p_insert: plan.insert,
      p_rename: plan.rename,
      p_remove: plan.remove,
      p_now: now.toISOString(),
    }),
  ) as { stale: boolean; inserted?: number; removed?: number };
  // Intussen door een andere beheerder gewijzigd: dit adres opnieuw opslaan (laatste geldt)
  if (result.stale) return saveWasteCalendar(householdId, memberId, found, now);
  return { inserted: result.inserted ?? 0, removed: result.removed ?? 0 };
}

interface SyncOutcome {
  claimed: boolean;
  result: "success" | "failure" | null;
  code: WasteErrorCode | null;
  stale: boolean;
  inserted: number;
  renamed: number;
  removed: number;
}

/**
 * Eén huishouden bijwerken: eventueel ophalen (alleen met een geslaagde claim:
 * tegelijk lease en limiet van één poging per minuut), plannen met de
 * effectieve datums en atomisch toepassen via waste_sync.
 */
async function syncCalendar(
  db: DbClient,
  cal: WasteCalendarRow,
  tasks: WasteTaskRow[],
  now: Date,
  options: { fetch: boolean; deps?: SourceDeps },
): Promise<SyncOutcome> {
  const today = todayIn(TZ, now);
  const outcome: SyncOutcome = { claimed: false, result: null, code: null, stale: false, inserted: 0, renamed: 0, removed: 0 };
  let pickups = cal.pickups as Partial<WastePickups>;

  if (options.fetch) {
    const before = new Date(now.getTime() - CLAIM_SECONDS * 1000).toISOString();
    const claim = check(
      await db
        .from("waste_calendars")
        .update({ last_attempt_at: now.toISOString() })
        .eq("household_id", cal.household_id)
        .eq("version", cal.version)
        .or(`last_attempt_at.is.null,last_attempt_at.lt.${before}`)
        .select("household_id"),
    );
    if (!claim.length) return outcome;
    outcome.claimed = true;

    const started = Date.now();
    const fetched = await fetchPickups(cal.bag_id, today, options.deps ?? createSourceDeps());
    if (!fetched.ok) {
      outcome.result = "failure";
      outcome.code = fetched.code === "NOT_FOUND" ? "ADDRESS_GONE" : fetched.code;
      console.warn(`[waste] sync mislukt code=${outcome.code} http=${fetched.http ?? "-"}`);
    } else if (isSuspectEmpty(fetched.value.pickups, today)) {
      outcome.result = "failure";
      outcome.code = "SUSPECT_EMPTY";
      console.warn("[waste] sync mislukt code=SUSPECT_EMPTY http=200");
    } else {
      outcome.result = "success";
      pickups = fetched.value.pickups;
      const dates = Object.values(fetched.value.pickups).reduce((n, list) => n + list.length, 0);
      console.info(`[waste] sync ok datums=${dates} onbekend=${fetched.value.unknownStreams} ms=${Date.now() - started}`);
    }
  }

  const plan = planWasteTasks({ pickups, existing: tasks, now, timeZone: TZ });
  if (!outcome.result && isEmptyPlan(plan)) return outcome;
  const applied = check(
    await db.rpc("waste_sync", {
      p_household_id: cal.household_id,
      p_version: cal.version,
      p_result: outcome.result,
      p_error_code: outcome.code,
      p_pickups: outcome.result === "success" ? (pickups as WastePickups) : null,
      p_insert: plan.insert,
      p_rename: plan.rename,
      p_remove: plan.remove,
      p_now: now.toISOString(),
    }),
  ) as { stale: boolean; inserted?: number; renamed?: number; removed?: number };
  outcome.stale = applied.stale;
  outcome.inserted = applied.inserted ?? 0;
  outcome.renamed = applied.renamed ?? 0;
  outcome.removed = applied.removed ?? 0;
  return outcome;
}

/** "Opnieuw proberen" door een beheerder (na requireAdmin): hooguit één keer per minuut */
export async function retryWasteSync(
  householdId: string,
  now = new Date(),
  deps?: SourceDeps,
): Promise<{ kind: "done"; health: WasteHealth; lastSuccessAt: string } | { kind: "too_soon" } | { kind: "disabled" }> {
  const db = createAdminClient();
  const cal = await loadCalendar(db, householdId);
  if (!cal) return { kind: "disabled" };
  const tasks = await loadWasteTasks(db, [householdId], todayIn(TZ, now));
  const outcome = await syncCalendar(db, cal, tasks, now, { fetch: true, deps });
  if (!outcome.claimed) return { kind: "too_soon" };
  const after = (await loadCalendar(db, householdId)) ?? cal;
  return { kind: "done", health: wasteSyncHealth(after, now), lastSuccessAt: after.last_success_at };
}

/** Tick-stap "afval" (§18.8.6), tussen "overslaan" en "meldingen" */
export async function runWasteStep(db: DbClient, now: Date, tickStarted: number, deps?: SourceDeps): Promise<WasteStepReport> {
  const report: WasteStepReport = { calendars: 0, fetched: 0, fetchFailed: 0, inserted: 0, renamed: 0, removed: 0, expired: 0, alerted: 0, failed: 0 };
  const calendars = check(await db.from("waste_calendars").select("*")) as WasteCalendarRow[];
  report.calendars = calendars.length;
  if (!calendars.length) return report;

  const today = todayIn(TZ, now);
  const tasks = await loadWasteTasks(
    db,
    calendars.map((c) => c.household_id),
    today,
  );

  for (const cal of calendars) {
    // Een fout bij één huishouden houdt de andere niet tegen (code-review W-03); alleen een code in de log
    try {
      await stepForCalendar(db, cal, tasks, now, today, tickStarted, report, deps);
    } catch (error) {
      report.failed++;
      const e = error as { code?: string; name?: string };
      console.error(`[waste] huishouden overgeslagen: ${e?.code ?? e?.name ?? "fout"}`);
    }
  }
  return report;
}

async function stepForCalendar(
  db: DbClient,
  cal: WasteCalendarRow,
  tasks: WasteTaskRow[],
  now: Date,
  today: string,
  tickStarted: number,
  report: WasteStepReport,
  deps?: SourceDeps,
) {
  const own = tasks.filter((t) => t.household_id === cal.household_id);
  const fetch = dueForFetch(cal, now, TZ) && Date.now() - tickStarted < FETCH_START_LIMIT_MS;
  const outcome = await syncCalendar(db, cal, own, now, { fetch, deps });
  if (outcome.claimed) report.fetched++;
  if (outcome.result === "failure") report.fetchFailed++;
  report.inserted += outcome.inserted;
  report.renamed += outcome.renamed;
  report.removed += outcome.removed;
  const current = outcome.result ? ((await loadCalendar(db, cal.household_id)) ?? cal) : cal;

  // Vervallen (BR-54): alleen wat nog open is; automatisch, dus zonder doorwerking (BR-53)
  const pickupDates = Object.values(current.pickups ?? {}).flat();
  const expired = findExpiredWasteTasks(own, today, pickupDates);
  for (const ids of chunks(expired)) {
    const rows = check(
      await db
        .from("tasks")
        .update({ status: "skipped" })
        .in("id", ids)
        .eq("household_id", cal.household_id)
        .in("status", ["todo", "in_progress"])
        .select("id"),
    );
    report.expired += rows.length;
  }

  // Storing (BR-52): één melding per storing aan de actieve beheerders. De dispatcher
  // ontdubbelt op waste-failed:<last_success_at>; "alerted" telt dus pogingen, geen nieuwe meldingen.
  const health = wasteSyncHealth(current, now);
  if (health.state === "failed") {
    const message = wasteFailureMessage(health.reason, current.last_success_at, TZ);
    await notify({
      householdId: cal.household_id,
      message: { type: "waste_sync_failed", title: message.title, body: message.body, url: WASTE_SETTINGS_URL, dedupeKey: message.dedupeKey },
    });
    report.alerted++;
  }
}
