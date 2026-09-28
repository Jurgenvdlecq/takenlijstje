/**
 * Omzetting van databaserijen naar domeinobjecten (camelCase).
 */
import type { SeriesDefinition } from "@/domain/scheduling/plan";
import type { RecurrenceRow } from "@/types/database";

export function toSeries(row: RecurrenceRow): SeriesDefinition {
  return {
    id: row.id,
    rule: row.rule,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    pausedFrom: row.paused_from,
    pausedUntil: row.paused_until,
    timeOfDay: row.time_of_day?.slice(0, 5) ?? null,
    availableDaysBefore: row.available_days_before,
    dueDaysAfter: row.due_days_after,
    dueTime: row.due_time?.slice(0, 5) ?? null,
    durationMinutes: row.duration_minutes,
    generatedUntil: row.generated_until,
  };
}
