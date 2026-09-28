/**
 * Omzetten tussen formulierwaarden en de invoer van de server actions.
 */
import { zonedDate, zonedTime } from "@/domain/dates";
import type { TaskInput, TaskUpdateInput } from "@/lib/validation";
import type { RecurrenceRow, TaskRow } from "@/types/database";
import { defaultRule } from "./recurrence-editor";
import type { TaskFormValues } from "./task-form";

const numberOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

/**
 * @param id           door de client gegenereerd (dubbel versturen = één taak)
 * @param recurrenceId idem voor de reeks
 */
export function toCreateInput(values: TaskFormValues, id: string, recurrenceId: string): TaskInput {
  return {
    id,
    title: values.title.trim(),
    description: values.description || null,
    category: values.category,
    priority: values.priority,
    scheduledDate: values.date,
    scheduledTime: values.time || null,
    availableDaysBefore: values.availableDaysBefore,
    dueDate: values.dueDate || null,
    dueTime: values.dueTime || null,
    durationMinutes: numberOrNull(values.duration),
    reminderMinutesBefore: values.reminder === "" ? [] : [Number(values.reminder)],
    recurrence: values.recurring ? { recurrenceId, rule: values.rule } : null,
    templateId: values.templateId,
  };
}

/** Formulierwaarden van een bestaande taak (en eventueel zijn reeks). */
export function fromTask(task: TaskRow, series: RecurrenceRow | undefined, timeZone: string): TaskFormValues {
  const dueLocal = task.due_at ? zonedTime(task.due_at, timeZone) : null;
  const dueTime = dueLocal ? `${String(dueLocal.hour).padStart(2, "0")}:${String(dueLocal.minute).padStart(2, "0")}` : "";
  const dueDate = task.due_at ? zonedDate(task.due_at, timeZone) : "";
  const endOfDayOnSameDay = dueTime === "23:59" && dueDate === task.scheduled_date;

  return {
    title: task.title,
    description: task.description ?? "",
    category: task.category,
    priority: task.priority,
    date: task.scheduled_date,
    time: task.scheduled_time?.slice(0, 5) ?? "",
    dueDate: endOfDayOnSameDay ? "" : dueDate,
    dueTime: endOfDayOnSameDay || dueTime === "23:59" ? "" : dueTime,
    availableDaysBefore: series?.available_days_before ?? 0,
    duration: task.duration_minutes ? String(task.duration_minutes) : "",
    reminder: task.reminder_minutes_before?.[0] != null ? String(task.reminder_minutes_before[0]) : "",
    recurring: !!task.recurrence_id,
    rule: series?.rule ?? defaultRule("weekly", task.scheduled_date),
    templateId: series?.template_id ?? null,
  };
}

/**
 * Alleen wat er echt veranderd is. `seriesLevel` = er veranderde iets dat
 * alleen voor de reeks zin heeft (de herhaling).
 */
export function toUpdateChanges(
  initial: TaskFormValues,
  values: TaskFormValues,
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
  if (values.reminder !== initial.reminder) changes.reminderMinutesBefore = values.reminder === "" ? [] : [Number(values.reminder)];

  let seriesLevel = false;
  const ruleChanged = JSON.stringify(values.rule) !== JSON.stringify(initial.rule);
  if (values.recurring !== initial.recurring || (values.recurring && ruleChanged)) {
    changes.recurrence = values.recurring ? { rule: values.rule } : null;
    seriesLevel = true;
  }

  return { changes, seriesLevel, empty: Object.keys(changes).length === 0 };
}
