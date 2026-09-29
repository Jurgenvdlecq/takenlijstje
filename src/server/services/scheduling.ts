import "server-only";

/**
 * Inplannen van terugkerende taken. topUpSeries en skipSupersededTasks draaien
 * als systeemhandeling via src/server/system (planner en tick; alleen invoegen
 * en overslaan). Iedere query filtert expliciet op household_id.
 */
import { addDays, todayIn, type ISODate } from "@/domain/dates";
import { planSeries } from "@/domain/scheduling/plan";
import { findSupersededTasks } from "@/domain/scheduling/supersede";
import type { DbClient } from "@/lib/supabase/server";
import type { PlannedOccurrence } from "@/domain/scheduling/plan";
import type { RecurrenceRow, TaskRow } from "@/types/database";
import { check } from "../errors";
import { toSeries } from "../mappers";

async function householdTimezone(db: DbClient, householdId: string): Promise<string> {
  const { timezone } = check(await db.from("households").select("timezone").eq("id", householdId).single());
  return timezone;
}

export interface TopUpOptions {
  recurrenceIds?: string[];
  /** Opnieuw plannen vanaf deze datum (na wijzigen van de reeks) */
  from?: ISODate;
  now?: Date;
}

/** De taakrijen voor nieuwe uitvoeringen van een reeks */
function occurrenceRows(row: RecurrenceRow, occurrences: PlannedOccurrence[]) {
  return occurrences.map((o) => ({
    household_id: row.household_id,
    recurrence_id: row.id,
    occurrence_date: o.occurrenceDate,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    scheduled_date: o.scheduledDate,
    scheduled_time: o.scheduledTime,
    available_from: o.availableFrom,
    due_at: o.dueAt,
    duration_minutes: row.duration_minutes,
    reminder_minutes_before: row.reminder_minutes_before,
    created_by_member_id: row.created_by_member_id,
  }));
}

/** Vaste tijdzone van elk huishouden (V-39); terugval als de rij hem niet heeft */
export const HOUSEHOLD_TIMEZONE = "Europe/Amsterdam";

/**
 * Supabase geeft standaard hooguit 1000 rijen terug; lees in pagina's (op id
 * gesorteerd). Een gelijktijdige wijziging kan een rij verschuiven; voor de tick
 * is dat onschadelijk, want de volgende run haalt het in (D-040).
 */
export async function selectAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const size = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += size) {
    const rows = check(await page(from, from + size - 1)) as T[];
    all.push(...rows);
    if (rows.length < size) return all;
  }
}

/** Vul de planning van reeksen aan tot de horizon. Geeft de nieuw aangemaakte taken terug. */
export async function topUpSeries(db: DbClient, householdId: string, options: TopUpOptions = {}): Promise<TaskRow[]> {
  const now = options.now ?? new Date();
  const timeZone = await householdTimezone(db, householdId);
  const today = todayIn(timeZone, now);

  let query = db.from("task_recurrences").select("*").eq("household_id", householdId).eq("is_active", true);
  if (options.recurrenceIds?.length) query = query.in("id", options.recurrenceIds);
  const series = check(await query) as RecurrenceRow[];
  if (series.length === 0) return [];

  const created: TaskRow[] = [];

  for (const row of series) {
    const definition = toSeries(row);
    if (options.from) definition.generatedUntil = null;

    const existing = check(
      await db
        .from("tasks")
        .select("occurrence_date, status, scheduled_date, deleted_at")
        .eq("recurrence_id", row.id)
        .gte("occurrence_date", addDays(today, -1)),
    );
    const existingDates = new Set(existing.map((t) => t.occurrence_date).filter((d): d is string => !!d));
    const hasOpenUpcoming = existing.some(
      (t) => !t.deleted_at && (t.status === "todo" || t.status === "in_progress") && t.scheduled_date >= today,
    );

    const plan = planSeries({
      series: definition,
      today,
      timeZone,
      existingOccurrenceDates: existingDates,
      hasOpenUpcoming,
      from: options.from,
    });

    if (plan.occurrences.length) {
      const rows = occurrenceRows(row, plan.occurrences);
      const inserted = check(
        await db
          .from("tasks")
          .upsert(rows, { onConflict: "recurrence_id,occurrence_date", ignoreDuplicates: true })
          .select("*"),
      ) as TaskRow[];
      created.push(...inserted);

    }

    if (plan.generatedUntil !== row.generated_until) {
      check(await db.from("task_recurrences").update({ generated_until: plan.generatedUntil }).eq("id", row.id));
    }
  }

  return created;
}

/**
 * Tick stap 1 (TECHNICAL_DESIGN §11.3): de planning van ALLE huishoudens in
 * een vast aantal query's in plaats van per huishouden en per reeks.
 */
export async function planAllSeries(db: DbClient, now = new Date()): Promise<number> {
  const households = check(await db.from("households").select("id, timezone")) as { id: string; timezone: string }[];
  const tzOf = new Map(households.map((h) => [h.id, h.timezone]));

  const series = await selectAll<RecurrenceRow>((from, to) =>
    db.from("task_recurrences").select("*").eq("is_active", true).order("id").range(from, to),
  );
  if (!series.length) return 0;

  const todayOf = (householdId: string) => todayIn(tzOf.get(householdId) ?? HOUSEHOLD_TIMEZONE, now);
  const earliest = series.map((r) => addDays(todayOf(r.household_id), -1)).sort()[0];
  const existing = await selectAll<{ recurrence_id: string; occurrence_date: string | null; status: TaskRow["status"]; scheduled_date: string; deleted_at: string | null }>(
    (from, to) =>
      db
        .from("tasks")
        .select("recurrence_id, occurrence_date, status, scheduled_date, deleted_at")
        .not("recurrence_id", "is", null)
        .gte("occurrence_date", earliest)
        .order("id")
        .range(from, to),
  );
  const bySeries = new Map<string, typeof existing>();
  for (const t of existing) {
    const list = bySeries.get(t.recurrence_id) ?? [];
    list.push(t);
    bySeries.set(t.recurrence_id, list);
  }

  const rows: ReturnType<typeof occurrenceRows> = [];
  const horizonUpdates: { id: string; from: string | null; to: string }[] = [];
  let failed = 0;
  for (const row of series) {
    // Eén reeks met een onbruikbare regel houdt de rest niet tegen (code-review WP3, punt 7)
    try {
      const today = todayOf(row.household_id);
      const own = (bySeries.get(row.id) ?? []).filter((t) => t.occurrence_date && t.occurrence_date >= addDays(today, -1));
      const plan = planSeries({
        series: toSeries(row),
        today,
        timeZone: tzOf.get(row.household_id) ?? HOUSEHOLD_TIMEZONE,
        existingOccurrenceDates: new Set(own.map((t) => t.occurrence_date!)),
        hasOpenUpcoming: own.some(
          (t) => !t.deleted_at && (t.status === "todo" || t.status === "in_progress") && t.scheduled_date >= today,
        ),
      });
      rows.push(...occurrenceRows(row, plan.occurrences));
      if (plan.generatedUntil !== row.generated_until) horizonUpdates.push({ id: row.id, from: row.generated_until, to: plan.generatedUntil });
    } catch {
      failed++;
    }
  }
  if (failed) console.error(`[planner] ${failed} reeks(en) overgeslagen: planning mislukt`);

  let created = 0;
  if (rows.length) {
    const inserted = check(
      await db.from("tasks").upsert(rows, { onConflict: "recurrence_id,occurrence_date", ignoreDuplicates: true }).select("id"),
    );
    created = inserted.length;
  }
  // generated_until alleen als hij sinds het lezen niet veranderde: een reekswijziging
  // die tegelijk "opnieuw plannen" vroeg, wordt zo niet overschreven (code-review WP3, punt 5)
  for (const u of horizonUpdates) {
    const update = db.from("task_recurrences").update({ generated_until: u.to }).eq("id", u.id);
    check(await (u.from === null ? update.is("generated_until", null) : update.eq("generated_until", u.from)));
  }
  return created;
}

/** Tick stap 2 (BR-16): verlopen reekstaken overslaan, voor alle huishoudens tegelijk. */
export async function skipAllSuperseded(db: DbClient, now = new Date()): Promise<number> {
  const open = await selectAll<{
    id: string;
    recurrence_id: string | null;
    occurrence_date: string | null;
    status: string;
    due_at: string | null;
    available_from: string | null;
    scheduled_date: string;
  }>((from, to) =>
    db
      .from("tasks")
      .select("id, recurrence_id, occurrence_date, status, due_at, available_from, scheduled_date")
      .in("status", ["todo", "in_progress"])
      .is("deleted_at", null)
      .not("recurrence_id", "is", null)
      .order("id")
      .range(from, to),
  );
  const ids = findSupersededTasks(
    open.map((t) => ({
      id: t.id,
      recurrenceId: t.recurrence_id,
      occurrenceDate: t.occurrence_date,
      status: t.status,
      dueAt: t.due_at,
      availableFrom: t.available_from,
      scheduledDate: t.scheduled_date,
    })),
    now,
  );
  if (!ids.length) return 0;
  // Alleen wat nog open is: een taak die intussen is afgevinkt of verwijderd,
  // blijft zoals hij is (code-review WP3, punt 1)
  const skipped = check(
    await db
      .from("tasks")
      .update({ status: "skipped" })
      .in("id", ids)
      .in("status", ["todo", "in_progress"])
      .is("deleted_at", null)
      .select("id"),
  );
  return skipped.length;
}
