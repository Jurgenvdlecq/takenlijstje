/**
 * Vooruit inplannen van terugkerende taken.
 *
 * Een reeks krijgt concrete taken voor de komende HORIZON_DAYS dagen, zodat
 * iedereen ziet wat er deze en volgende week voor hem/haar klaarstaat en
 * afwezigheid vooraf kan worden verwerkt. Valt er in die periode niets
 * (bijv. een maandelijkse taak), dan wordt alleen de eerstvolgende ingepland.
 *
 * Puur: de database-laag (src/server/services/scheduling.ts) levert de
 * bestaande datums en belasting aan en slaat het resultaat op.
 */
import { addDays, maxDate, type ISODate } from "../dates";
import { absenceOn, postponeTarget } from "../assignment/absence";
import { taskPoints } from "../assignment/load";
import {
  addLoad,
  pickAssignee,
  type AssignmentContext,
  type AssignmentInput,
  type AssignmentStrategy,
} from "../assignment/strategies";
import { nextOccurrenceAfter, occurrenceIndex, occurrencesBetween, type SeriesWindow } from "../recurrence/occurrences";
import { computeWindow } from "../recurrence/window";

export const HORIZON_DAYS = 14;

export interface SeriesDefinition extends SeriesWindow {
  id: string;
  timeOfDay: string | null;
  availableDaysBefore: number;
  dueDaysAfter: number;
  dueTime: string | null;
  assignmentStrategy: AssignmentStrategy;
  fixedMemberId: string | null;
  rotationMemberIds: string[];
  points: number | null;
  durationMinutes: number | null;
  generatedUntil: ISODate | null;
}

export interface PlannedOccurrence {
  occurrenceDate: ISODate;
  scheduledDate: ISODate;
  scheduledTime: string | null;
  availableFrom: string;
  dueAt: string;
  assignedMemberId: string | null;
  assignmentReason: "fixed" | "rotation" | "random" | "fair" | "absence" | null;
}

export interface PlanInput {
  series: SeriesDefinition;
  today: ISODate;
  timeZone: string;
  /** Datums waarvoor al een taak bestaat (ook verwijderde/aangepaste) */
  existingOccurrenceDates: Set<ISODate>;
  /** Heeft de reeks nog een open taak vanaf vandaag? */
  hasOpenUpcoming: boolean;
  assignment: AssignmentContext;
  horizonDays?: number;
  /** Plan vanaf deze datum opnieuw (na "deze en toekomstige taken aanpassen") */
  from?: ISODate;
}

export interface PlanResult {
  occurrences: PlannedOccurrence[];
  generatedUntil: ISODate;
}

export function planSeries(input: PlanInput): PlanResult {
  const { series, today, timeZone } = input;
  const horizonEnd = addDays(today, input.horizonDays ?? HORIZON_DAYS);

  // Nooit taken in het verleden aanmaken
  let start = maxDate(series.startsOn, today);
  if (input.from) start = maxDate(start, input.from);
  else if (series.generatedUntil) start = maxDate(start, addDays(series.generatedUntil, 1));

  let dates = start <= horizonEnd ? occurrencesBetween(series, start, horizonEnd) : [];

  // Niets in de horizon en ook niets open? Plan dan de eerstvolgende.
  const hasAnyUpcoming =
    input.hasOpenUpcoming || dates.some((d) => !input.existingOccurrenceDates.has(d));
  if (!hasAnyUpcoming) {
    const next = nextOccurrenceAfter(series, addDays(maxDate(start, today), -1));
    if (next) dates = [next];
  }

  const occurrences: PlannedOccurrence[] = [];
  const points = taskPoints({ points: series.points, durationMinutes: series.durationMinutes });

  for (const date of dates) {
    if (input.existingOccurrenceDates.has(date)) continue;
    const planned = planOne(series, date, input.assignment, timeZone);
    addLoad(input.assignment.loads, planned.assignedMemberId, points);
    occurrences.push(planned);
  }

  const lastDate = dates.length ? dates[dates.length - 1] : horizonEnd;
  return {
    occurrences,
    generatedUntil: maxDate(horizonEnd, lastDate),
  };
}

function planOne(
  series: SeriesDefinition,
  date: ISODate,
  ctx: AssignmentContext,
  timeZone: string,
): PlannedOccurrence {
  const assignment: AssignmentInput = {
    strategy: series.assignmentStrategy,
    date,
    fixedMemberId: series.fixedMemberId,
    rotationMemberIds: series.rotationMemberIds,
    occurrenceIndex: series.assignmentStrategy === "rotation" ? occurrenceIndex(series, date) : 0,
  };

  let scheduledDate = date;
  let result = pickAssignee(assignment, ctx);

  // Wie volgens vaste persoon / rotatie aan de beurt is maar afwezig is:
  // volg de gekozen afwezigheidsstrategie van die persoon.
  if (series.assignmentStrategy === "fixed" || series.assignmentStrategy === "rotation") {
    const intended = pickAssignee(assignment, { ...ctx, absences: [] });
    const absence = intended.memberId ? absenceOn(ctx.absences, intended.memberId, date) : undefined;
    if (absence?.strategy === "unassign") {
      result = { memberId: null, reason: null };
    } else if (absence?.strategy === "postpone") {
      scheduledDate = postponeTarget(absence, date).date;
      result = { memberId: intended.memberId, reason: intended.reason };
    }
  }

  const window = computeWindow(
    scheduledDate,
    {
      timeOfDay: series.timeOfDay,
      availableDaysBefore: series.availableDaysBefore,
      dueDaysAfter: series.dueDaysAfter,
      dueTime: series.dueTime,
    },
    timeZone,
  );

  return {
    occurrenceDate: date,
    scheduledDate: window.scheduledDate,
    scheduledTime: window.scheduledTime,
    availableFrom: window.availableFrom,
    dueAt: window.dueAt,
    assignedMemberId: result.memberId,
    assignmentReason: result.reason,
  };
}
