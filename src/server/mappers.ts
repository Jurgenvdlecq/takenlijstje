/**
 * Omzetting van databaserijen naar domeinobjecten (camelCase).
 */
import type { Absence } from "@/domain/assignment/absence";
import type { AssignableMember } from "@/domain/assignment/strategies";
import type { SeriesDefinition } from "@/domain/scheduling/plan";
import type { AbsenceRow, MemberRow, RecurrenceRow } from "@/types/database";

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
    assignmentStrategy: row.assignment_strategy,
    fixedMemberId: row.fixed_member_id,
    rotationMemberIds: row.rotation_member_ids ?? [],
    points: row.points,
    durationMinutes: row.duration_minutes,
    generatedUntil: row.generated_until,
  };
}

export function toAssignable(row: MemberRow): AssignableMember {
  return { id: row.id, isActive: row.is_active, sortOrder: row.sort_order };
}

export function toAbsence(row: AbsenceRow): Absence {
  return { memberId: row.member_id, startsOn: row.starts_on, endsOn: row.ends_on, strategy: row.strategy };
}
