import "server-only";

/**
 * Bedrijfslogica rond taken, los van de server actions zodat ook de cron en
 * de voorbeelddata het kunnen gebruiken.
 */
import { diffDays, todayIn, type ISODate } from "@/domain/dates";
import { buildLoadMap } from "@/domain/assignment/load";
import { pickAssignee } from "@/domain/assignment/strategies";
import { computeWindow } from "@/domain/recurrence/window";
import type { DbClient } from "@/lib/supabase/server";
import type { TaskInput, taskInput } from "@/lib/validation";
import type { HouseholdRow, MemberRow, RecurrenceRow, TaskRow } from "@/types/database";
import type { z } from "zod";
import { check } from "../errors";
import { toAbsence, toAssignable } from "../mappers";
import { notify } from "../system/dispatcher";
import { topUp } from "../system/planner";

type ParsedTaskInput = z.output<typeof taskInput>;
export type { TaskInput };

export function taskUrl(taskId: string): string {
  return `/taken?taak=${taskId}`;
}

/** Informeer iemand dat een taak aan hem/haar is toegewezen (niet als je het zelf deed). */
export async function notifyAssigned(
  task: Pick<TaskRow, "id" | "household_id" | "title" | "assigned_member_id" | "scheduled_date">,
  byMemberId: string | null,
): Promise<void> {
  if (!task.assigned_member_id || task.assigned_member_id === byMemberId) return;
  await notify({
    householdId: task.household_id,
    memberIds: [task.assigned_member_id],
    message: {
      type: "task_assigned",
      title: `Nieuwe taak: ${task.title}`,
      body: null,
      taskId: task.id,
      dedupeKey: `assigned:${task.id}:${task.assigned_member_id}`,
    },
  });
}

/** Eenmalige taak automatisch verdelen (eerlijk of willekeurig). */
async function autoAssignOnce(
  db: DbClient,
  household: HouseholdRow,
  strategy: "fair" | "random",
  date: ISODate,
): Promise<string | null> {
  const [members, absences, completions] = await Promise.all([
    db.from("household_members").select("*").eq("household_id", household.id).then(check),
    db.from("member_absences").select("*").eq("household_id", household.id).gte("ends_on", date).then(check),
    db
      .from("task_completions")
      .select("member_id, points")
      .eq("household_id", household.id)
      .gte("completed_at", new Date(Date.now() - 28 * 86_400_000).toISOString())
      .then(check),
  ]);
  const loads = buildLoadMap(
    completions.map((c) => ({ memberId: c.member_id, points: c.points })),
    members.map((m: MemberRow) => m.id),
  );
  return pickAssignee(
    { strategy, date },
    { members: members.map(toAssignable), absences: absences.map(toAbsence), loads },
  ).memberId;
}

/**
 * Nieuwe taak aanmaken. Met `recurrence` wordt een reeks aangemaakt en
 * direct vooruit ingepland; anders één losse taak.
 */
export async function createTask(
  db: DbClient,
  household: HouseholdRow,
  member: MemberRow,
  input: ParsedTaskInput,
): Promise<TaskRow[]> {
  const tz = household.timezone;

  if (input.recurrence) {
    const strategy =
      input.recurrence.assignmentStrategy === "none" && input.assignedMemberId ? "fixed" : input.recurrence.assignmentStrategy;
    const series = check(
      await db
        .from("task_recurrences")
        .insert({
          household_id: household.id,
          template_id: input.templateId ?? null,
          title: input.title,
          description: input.description,
          category: input.category,
          priority: input.priority,
          duration_minutes: input.durationMinutes ?? null,
          points: input.points ?? null,
          rule: input.recurrence.rule,
          time_of_day: input.scheduledTime ?? null,
          available_days_before: input.availableDaysBefore,
          due_days_after: input.dueDate ? diffDays(input.scheduledDate, input.dueDate) : 0,
          due_time: input.dueTime ?? null,
          starts_on: input.scheduledDate,
          ends_on: input.recurrence.endsOn ?? null,
          assignment_strategy: strategy,
          fixed_member_id: strategy === "fixed" ? (input.recurrence.fixedMemberId ?? input.assignedMemberId ?? null) : null,
          rotation_member_ids: input.recurrence.rotationMemberIds,
          reminder_minutes_before: input.reminderMinutesBefore,
          created_by_member_id: member.id,
        })
        .select("*")
        .single(),
    ) as RecurrenceRow;

    // Rechtenstap is geslaagd (RLS-insert van de reeks); de planner voegt alleen uitvoeringen in
    const created = await topUp(household.id, [series.id]);
    const firstPerMember = new Map<string, TaskRow>();
    for (const task of created) {
      if (task.assigned_member_id && !firstPerMember.has(task.assigned_member_id)) firstPerMember.set(task.assigned_member_id, task);
    }
    await Promise.all([...firstPerMember.values()].map((t) => notifyAssigned(t, member.id)));
    return created;
  }

  let assignee = input.assignedMemberId ?? null;
  let reason: TaskRow["assignment_reason"] = assignee ? "manual" : null;
  if (!assignee && input.autoAssign) {
    assignee = await autoAssignOnce(db, household, input.autoAssign, input.scheduledDate);
    reason = assignee ? input.autoAssign : null;
  }

  const window = computeWindow(
    input.scheduledDate,
    {
      timeOfDay: input.scheduledTime ?? null,
      availableDaysBefore: input.availableDaysBefore,
      dueDaysAfter: input.dueDate ? diffDays(input.scheduledDate, input.dueDate) : 0,
      dueTime: input.dueTime ?? null,
    },
    tz,
  );

  const row = {
    ...(input.id ? { id: input.id } : {}),
    household_id: household.id,
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority,
    assigned_member_id: assignee,
    assignment_reason: reason,
    scheduled_date: window.scheduledDate,
    scheduled_time: window.scheduledTime,
    available_from: window.availableFrom,
    due_at: window.dueAt,
    duration_minutes: input.durationMinutes ?? null,
    points: input.points ?? null,
    reminder_minutes_before: input.reminderMinutesBefore,
    created_by_member_id: member.id,
  };

  // Altijd met de gebruikersclient: RLS en de guard beslissen of toewijzen aan
  // een ander mag (B-02). Er is geen aanmaakroute met de service role.
  const { data, error } = await db.from("tasks").upsert(row, { onConflict: "id", ignoreDuplicates: true }).select("*");
  if (error) throw error;
  const task = (data?.[0] ?? check(await db.from("tasks").select("*").eq("id", input.id!).single())) as TaskRow;

  if (data?.length && assignee) {
    await db.from("task_assignments").insert({
      household_id: household.id,
      task_id: task.id,
      member_id: assignee,
      assigned_by_member_id: member.id,
      reason: reason ?? "manual",
    });
    await notifyAssigned(task, member.id);
  }
  return [task];
}

export function householdToday(household: HouseholdRow): ISODate {
  return todayIn(household.timezone);
}

