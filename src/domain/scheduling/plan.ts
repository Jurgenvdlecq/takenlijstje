/**
 * Vooruit inplannen van terugkerende taken.
 *
 * Een reeks krijgt concrete taken voor de komende HORIZON_DAYS dagen, zodat
 * iedereen ziet wat er deze en volgende week klaarstaat. Valt er in die
 * periode niets (bijv. een maandelijkse taak), dan wordt alleen de
 * eerstvolgende ingepland. Er wordt niets aan personen toegewezen (V-21).
 *
 * Puur: de database-laag (src/server/services/scheduling.ts) levert de
 * bestaande datums aan en slaat het resultaat op.
 */
import { addDays, maxDate, type ISODate } from "../dates";
import { nextOccurrenceAfter, occurrencesBetween, type SeriesWindow } from "../recurrence/occurrences";
import { computeWindow } from "../recurrence/window";

export const HORIZON_DAYS = 14;

export interface SeriesDefinition extends SeriesWindow {
  id: string;
  timeOfDay: string | null;
  availableDaysBefore: number;
  dueDaysAfter: number;
  dueTime: string | null;
  durationMinutes: number | null;
  generatedUntil: ISODate | null;
}

export interface PlannedOccurrence {
  occurrenceDate: ISODate;
  scheduledDate: ISODate;
  scheduledTime: string | null;
  availableFrom: string;
  dueAt: string;
}

export interface PlanInput {
  series: SeriesDefinition;
  today: ISODate;
  timeZone: string;
  /** Datums waarvoor al een taak bestaat (ook verwijderde/aangepaste) */
  existingOccurrenceDates: Set<ISODate>;
  /** Heeft de reeks nog een open taak vanaf vandaag? */
  hasOpenUpcoming: boolean;
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
  for (const date of dates) {
    if (input.existingOccurrenceDates.has(date)) continue;
    occurrences.push(planOne(series, date, timeZone));
  }

  const lastDate = dates.length ? dates[dates.length - 1] : horizonEnd;
  return {
    occurrences,
    generatedUntil: maxDate(horizonEnd, lastDate),
  };
}

function planOne(series: SeriesDefinition, date: ISODate, timeZone: string): PlannedOccurrence {
  const window = computeWindow(
    date,
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
  };
}
