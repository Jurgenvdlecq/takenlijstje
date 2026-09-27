import "server-only";

/**
 * Inplannen van terugkerende taken en verwerken van afwezigheid.
 * Draait met de service-role client: het is een systeemhandeling die ook
 * mag toewijzen aan anderen (rotatie), ongeacht de rechten van wie hem
 * aanleidde. Iedere query filtert expliciet op household_id.
 */
import { addDays, todayIn, type ISODate } from "@/domain/dates";
import { absenceOn, postponeTarget } from "@/domain/assignment/absence";
import { buildLoadMap, taskPoints } from "@/domain/assignment/load";
import { addLoad, availableMembers, pickFair, type AssignmentContext } from "@/domain/assignment/strategies";
import { planSeries } from "@/domain/scheduling/plan";
import { findSupersededTasks } from "@/domain/scheduling/supersede";
import { shiftInstant } from "@/domain/recurrence/window";
import type { DbClient } from "@/lib/supabase/server";
import type { AbsenceRow, RecurrenceRow, TaskRow } from "@/types/database";
import { check } from "../errors";
import { toAbsence, toAssignable, toSeries } from "../mappers";

/** Periode waarover taakbelasting meetelt voor eerlijke verdeling */
const LOAD_WINDOW_DAYS = 28;

async function loadAssignmentContext(db: DbClient, householdId: string, today: ISODate): Promise<AssignmentContext> {
  const [members, absences, completions, openTasks] = await Promise.all([
    db.from("household_members").select("*").eq("household_id", householdId).then(check),
    db.from("member_absences").select("*").eq("household_id", householdId).gte("ends_on", today).then(check),
    db
      .from("task_completions")
      .select("member_id, points")
      .eq("household_id", householdId)
      .gte("completed_at", new Date(Date.now() - LOAD_WINDOW_DAYS * 86_400_000).toISOString())
      .then(check),
    db
      .from("tasks")
      .select("assigned_member_id, points, duration_minutes")
      .eq("household_id", householdId)
      .in("status", ["todo", "in_progress"])
      .is("deleted_at", null)
      .gte("scheduled_date", today)
      .then(check),
  ]);

  const loads = buildLoadMap(
    [
      ...completions.map((c) => ({ memberId: c.member_id, points: c.points })),
      ...openTasks.map((t) => ({
        memberId: t.assigned_member_id,
        points: taskPoints({ points: t.points, durationMinutes: t.duration_minutes }),
      })),
    ],
    members.map((m) => m.id),
  );

  return { members: members.map(toAssignable), absences: absences.map(toAbsence), loads };
}

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

/**
 * Vul de planning van reeksen aan tot de horizon. Geeft de nieuw aangemaakte
 * taken terug (bijv. om toegewezen personen te informeren).
 */
export async function topUpSeries(db: DbClient, householdId: string, options: TopUpOptions = {}): Promise<TaskRow[]> {
  const now = options.now ?? new Date();
  const timeZone = await householdTimezone(db, householdId);
  const today = todayIn(timeZone, now);

  let query = db.from("task_recurrences").select("*").eq("household_id", householdId).eq("is_active", true);
  if (options.recurrenceIds?.length) query = query.in("id", options.recurrenceIds);
  const series = check(await query) as RecurrenceRow[];
  if (series.length === 0) return [];

  const ctx = await loadAssignmentContext(db, householdId, today);
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
      assignment: ctx,
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
        assigned_member_id: o.assignedMemberId,
        assignment_reason: o.assignmentReason,
        scheduled_date: o.scheduledDate,
        scheduled_time: o.scheduledTime,
        available_from: o.availableFrom,
        due_at: o.dueAt,
        duration_minutes: row.duration_minutes,
        points: row.points,
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

      const assignments = inserted
        .filter((t) => t.assigned_member_id && t.assignment_reason)
        .map((t) => ({
          household_id: householdId,
          task_id: t.id,
          member_id: t.assigned_member_id,
          reason: t.assignment_reason!,
        }));
      if (assignments.length) check(await db.from("task_assignments").insert(assignments));
    }

    if (plan.generatedUntil !== row.generated_until) {
      check(await db.from("task_recurrences").update({ generated_until: plan.generatedUntil }).eq("id", row.id));
    }
  }

  return created;
}

/**
 * Verwijder open, niet-handmatig aangepaste taken van een reeks vanaf een datum
 * (of binnen een periode) en plan opnieuw. Gebruikt bij "deze en toekomstige
 * taken aanpassen", pauzeren en stoppen.
 */
export async function clearOpenOccurrences(
  db: DbClient,
  householdId: string,
  recurrenceId: string,
  from: ISODate,
  until?: ISODate | null,
  includeExceptions = false,
): Promise<void> {
  let query = db
    .from("tasks")
    .delete()
    .eq("household_id", householdId)
    .eq("recurrence_id", recurrenceId)
    .eq("status", "todo")
    .gte("occurrence_date", from);
  if (until) query = query.lte("occurrence_date", until);
  if (!includeExceptions) query = query.eq("is_exception", false);
  check(await query);
}

export async function replanSeries(db: DbClient, householdId: string, recurrenceId: string, from: ISODate): Promise<TaskRow[]> {
  await clearOpenOccurrences(db, householdId, recurrenceId, from);
  return topUpSeries(db, householdId, { recurrenceIds: [recurrenceId], from });
}

/**
 * Verwerk een (nieuwe) afwezigheid: open taken van die persoon in de periode
 * worden opnieuw verdeeld, doorgeschoven of op "niet toegewezen" gezet.
 * Geeft de taken terug die een nieuwe eigenaar kregen.
 */
export async function applyAbsence(db: DbClient, absence: AbsenceRow): Promise<TaskRow[]> {
  const timeZone = await householdTimezone(db, absence.household_id);
  const today = todayIn(timeZone);
  const tasks = check(
    await db
      .from("tasks")
      .select("*")
      .eq("household_id", absence.household_id)
      .eq("assigned_member_id", absence.member_id)
      .in("status", ["todo", "in_progress"])
      .is("deleted_at", null)
      .gte("scheduled_date", absence.starts_on)
      .lte("scheduled_date", absence.ends_on),
  ) as TaskRow[];
  if (!tasks.length) return [];

  const ctx = await loadAssignmentContext(db, absence.household_id, today);
  ctx.absences.push(toAbsence(absence));
  const reassigned: TaskRow[] = [];

  for (const task of tasks) {
    if (absence.strategy === "postpone") {
      const { date, shiftDays } = postponeTarget(toAbsence(absence), task.scheduled_date);
      check(
        await db
          .from("tasks")
          .update({
            scheduled_date: date,
            available_from: shiftInstant(task.available_from, shiftDays, timeZone),
            due_at: shiftInstant(task.due_at, shiftDays, timeZone),
            is_exception: true,
          })
          .eq("id", task.id),
      );
      continue;
    }

    let newMember: string | null = null;
    if (absence.strategy === "reassign") {
      const candidates = availableMembers(ctx, task.scheduled_date).filter((m) => m.id !== absence.member_id);
      newMember = pickFair(candidates, ctx.loads)?.id ?? null;
      addLoad(ctx.loads, newMember, taskPoints({ points: task.points, durationMinutes: task.duration_minutes }));
    }

    const updated = check(
      await db
        .from("tasks")
        .update({ assigned_member_id: newMember, assignment_reason: newMember ? "absence" : null, is_exception: true })
        .eq("id", task.id)
        .select("*")
        .single(),
    ) as TaskRow;
    check(
      await db.from("task_assignments").insert({
        household_id: task.household_id,
        task_id: task.id,
        member_id: newMember,
        reason: newMember ? "absence" : "unassigned",
      }),
    );
    if (newMember) reassigned.push(updated);
  }

  return reassigned;
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

/** Is een gezinslid afwezig op een datum? (voor directe toewijzing) */
export function absentOn(absences: AbsenceRow[], memberId: string, date: ISODate): boolean {
  return !!absenceOn(absences.map(toAbsence), memberId, date);
}

