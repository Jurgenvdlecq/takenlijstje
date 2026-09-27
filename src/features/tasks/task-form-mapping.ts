/**
 * Omzetten tussen formulierwaarden en de invoer van de server actions.
 */
import { zonedDate, zonedTime } from "@/domain/dates";
import type { TaskInput, TaskUpdateInput } from "@/lib/validation";
import type { MemberRow, RecurrenceRow, TaskRow } from "@/types/database";
import { defaultRule } from "./recurrence-editor";
import type { AssigneeChoice } from "./task-form-fields";
import type { TaskFormValues } from "./task-form";

const numberOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

function isMember(choice: AssigneeChoice, members: MemberRow[]): boolean {
  return members.some((m) => m.id === choice);
}

function recurrenceFor(values: TaskFormValues, members: MemberRow[]) {
  const a = values.assignee;
  const strategy = isMember(a, members) ? "fixed" : a === "rotation" ? "rotation" : a === "fair" ? "fair" : a === "random" ? "random" : "none";
  return {
    rule: values.rule,
    assignmentStrategy: strategy,
    fixedMemberId: strategy === "fixed" ? a : null,
    rotationMemberIds:
      strategy === "rotation"
        ? values.rotationIds.length
          ? values.rotationIds
          : members.filter((m) => m.is_active).map((m) => m.id)
        : [],
  } as const;
}

export function toCreateInput(values: TaskFormValues, members: MemberRow[], id: string): TaskInput {
  const memberChosen = isMember(values.assignee, members);
  return {
    id,
    title: values.title.trim(),
    description: values.description || null,
    category: values.category,
    priority: values.priority,
    assignedMemberId: memberChosen ? values.assignee : null,
    autoAssign: !values.recurring && (values.assignee === "fair" || values.assignee === "random") ? values.assignee : null,
    scheduledDate: values.date,
    scheduledTime: values.time || null,
    availableDaysBefore: values.availableDaysBefore,
    dueDate: values.dueDate || null,
    dueTime: values.dueTime || null,
    durationMinutes: numberOrNull(values.duration),
    points: numberOrNull(values.points),
    reminderMinutesBefore: values.reminder === "" ? [] : [Number(values.reminder)],
    recurrence: values.recurring ? recurrenceFor(values, members) : null,
    templateId: values.templateId,
  };
}

/** Formulierwaarden van een bestaande taak (en eventueel zijn reeks). */
export function fromTask(task: TaskRow, series: RecurrenceRow | undefined, timeZone: string): TaskFormValues {
  const dueLocal = task.due_at ? zonedTime(task.due_at, timeZone) : null;
  const dueTime = dueLocal ? `${String(dueLocal.hour).padStart(2, "0")}:${String(dueLocal.minute).padStart(2, "0")}` : "";
  const dueDate = task.due_at ? zonedDate(task.due_at, timeZone) : "";
  const endOfDayOnSameDay = dueTime === "23:59" && dueDate === task.scheduled_date;
  const assignee: AssigneeChoice =
    task.assigned_member_id ??
    (series?.assignment_strategy === "rotation" || series?.assignment_strategy === "fair" || series?.assignment_strategy === "random"
      ? series.assignment_strategy
      : "none");

  return {
    title: task.title,
    description: task.description ?? "",
    category: task.category,
    priority: task.priority,
    assignee,
    date: task.scheduled_date,
    time: task.scheduled_time?.slice(0, 5) ?? "",
    dueDate: endOfDayOnSameDay ? "" : dueDate,
    dueTime: endOfDayOnSameDay || dueTime === "23:59" ? "" : dueTime,
    availableDaysBefore: series?.available_days_before ?? 0,
    duration: task.duration_minutes ? String(task.duration_minutes) : "",
    points: task.points != null ? String(task.points) : "",
    reminder: task.reminder_minutes_before?.[0] != null ? String(task.reminder_minutes_before[0]) : "",
    recurring: !!task.recurrence_id,
    rule: series?.rule ?? defaultRule("weekly", task.scheduled_date),
    rotationIds: series?.rotation_member_ids ?? [],
    templateId: series?.template_id ?? null,
  };
}

/**
 * Alleen wat er echt veranderd is. `seriesLevel` = er veranderde iets dat
 * alleen voor de reeks zin heeft (herhaling of verdeelwijze).
 */
export function toUpdateChanges(
  initial: TaskFormValues,
  values: TaskFormValues,
  members: MemberRow[],
): { changes: TaskUpdateInput["changes"]; seriesLevel: boolean; empty: boolean } {
  const changes: NonNullable<TaskUpdateInput["changes"]> = {};
  if (values.title.trim() !== initial.title) changes.title = values.title.trim();
  if (values.description !== initial.description) changes.description = values.description || null;
  if (values.category !== initial.category) changes.category = values.category;
  if (values.priority !== initial.priority) changes.priority = values.priority;
  if (values.date !== initial.date) changes.scheduledDate = values.date;
  if (values.time !== initial.time) changes.scheduledTime = values.time || null;
  if (values.dueDate !== initial.dueDate) changes.dueDate = values.dueDate || null;
  if (values.dueTime !== initial.dueTime) changes.dueTime = values.dueTime || null;
  if (values.duration !== initial.duration) changes.durationMinutes = numberOrNull(values.duration);
  if (values.points !== initial.points) changes.points = numberOrNull(values.points);
  if (values.reminder !== initial.reminder) changes.reminderMinutesBefore = values.reminder === "" ? [] : [Number(values.reminder)];

  let seriesLevel = false;
  if (values.assignee !== initial.assignee) {
    if (isMember(values.assignee, members)) changes.assignedMemberId = values.assignee;
    else if (values.assignee === "none") changes.assignedMemberId = null;
    else seriesLevel = true; // om en om / eerlijk / willekeurig
  }

  const ruleChanged = JSON.stringify(values.rule) !== JSON.stringify(initial.rule);
  const rotationChanged = JSON.stringify(values.rotationIds) !== JSON.stringify(initial.rotationIds);
  if (values.recurring !== initial.recurring || (values.recurring && (ruleChanged || rotationChanged || seriesLevel))) {
    changes.recurrence = values.recurring ? recurrenceFor(values, members) : null;
    seriesLevel = true;
  }

  return { changes, seriesLevel, empty: Object.keys(changes).length === 0 };
}
