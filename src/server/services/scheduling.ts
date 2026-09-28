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
      const rows = plan.occurrences.map((o) => ({
        household_id: householdId,
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

/** Zet verlopen taken op "overgeslagen" als de volgende uitvoering al beschikbaar is. */
export async function skipSupersededTasks(db: DbClient, householdId: string, now = new Date()): Promise<number> {
  const open = check(
    await db
      .from("tasks")
      .select("id, recurrence_id, occurrence_date, status, due_at, available_from, scheduled_date")
      .eq("household_id", householdId)
      .in("status", ["todo", "in_progress"])
      .is("deleted_at", null)
      .not("recurrence_id", "is", null),
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
  if (ids.length) check(await db.from("tasks").update({ status: "skipped" }).in("id", ids));
  return ids.length;
}
