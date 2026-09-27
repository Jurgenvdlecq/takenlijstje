/**
 * Berekent op welke datums een terugkerende taak valt.
 * Alles werkt op kalenderdatums (YYYY-MM-DD) en is puur (geen I/O).
 */
import {
  addDays,
  daysInMonth,
  diffDays,
  isoWeekday,
  monthsBetween,
  parts,
  startOfIsoWeek,
  type ISODate,
} from "../dates";
import type { RecurrenceRule } from "./rule";

export interface SeriesWindow {
  rule: RecurrenceRule;
  /** Eerste mogelijke datum; ook het ankerpunt voor "elke X dagen/weken/maanden" */
  startsOn: ISODate;
  endsOn?: ISODate | null;
  pausedFrom?: ISODate | null;
  pausedUntil?: ISODate | null;
}

/** Maximale zoekafstand (dagen) voor de volgende uitvoering. */
const MAX_SEARCH_DAYS = 366 * 11;

function matchesMonthDay(date: ISODate, monthDay: number): boolean {
  const { year, month, day } = parts(date);
  const last = daysInMonth(year, month);
  // 31e in een korte maand → laatste dag van die maand
  const target = monthDay === -1 ? last : Math.min(monthDay, last);
  return day === target;
}

function matchesNthWeekday(date: ISODate, nth: number, weekday: number): boolean {
  if (isoWeekday(date) !== weekday) return false;
  const { year, month, day } = parts(date);
  if (nth === -1) return day + 7 > daysInMonth(year, month);
  return Math.ceil(day / 7) === nth;
}

/** Valt de regel op deze datum (zonder rekening te houden met pauze/einde)? */
export function ruleMatches(rule: RecurrenceRule, anchor: ISODate, date: ISODate): boolean {
  if (date < anchor) return false;
  switch (rule.freq) {
    case "daily":
      return diffDays(anchor, date) % rule.interval === 0;
    case "weekly": {
      if (!rule.weekdays.includes(isoWeekday(date))) return false;
      const weeks = diffDays(startOfIsoWeek(anchor), startOfIsoWeek(date)) / 7;
      return weeks % rule.interval === 0;
    }
    case "monthly": {
      if (monthsBetween(anchor, date) % rule.interval !== 0) return false;
      if (rule.nth !== undefined && rule.weekday !== undefined) {
        return matchesNthWeekday(date, rule.nth, rule.weekday);
      }
      return matchesMonthDay(date, rule.monthDay ?? parts(anchor).day);
    }
    case "yearly": {
      const { year, month } = parts(date);
      if ((year - parts(anchor).year) % rule.interval !== 0) return false;
      return month === rule.month && matchesMonthDay(date, rule.monthDay);
    }
  }
}

export function isPaused(series: SeriesWindow, date: ISODate): boolean {
  if (!series.pausedFrom && !series.pausedUntil) return false;
  const from = series.pausedFrom ?? "0000-01-01";
  const until = series.pausedUntil ?? "9999-12-31";
  return date >= from && date <= until;
}

export function occursOn(series: SeriesWindow, date: ISODate): boolean {
  if (date < series.startsOn) return false;
  if (series.endsOn && date > series.endsOn) return false;
  if (isPaused(series, date)) return false;
  return ruleMatches(series.rule, series.startsOn, date);
}

/** Alle uitvoeringsdatums van `from` t/m `to`. */
export function occurrencesBetween(series: SeriesWindow, from: ISODate, to: ISODate): ISODate[] {
  const result: ISODate[] = [];
  let date = from < series.startsOn ? series.startsOn : from;
  const last = series.endsOn && series.endsOn < to ? series.endsOn : to;
  while (date <= last) {
    if (occursOn(series, date)) result.push(date);
    date = addDays(date, 1);
  }
  return result;
}

/** Eerste uitvoeringsdatum ná `after` (of null als de reeks is afgelopen). */
export function nextOccurrenceAfter(series: SeriesWindow, after: ISODate): ISODate | null {
  let date = addDays(after < series.startsOn ? addDays(series.startsOn, -1) : after, 1);
  for (let i = 0; i < MAX_SEARCH_DAYS; i++) {
    if (series.endsOn && date > series.endsOn) return null;
    if (occursOn(series, date)) return date;
    date = addDays(date, 1);
  }
  return null;
}

/**
 * Volgnummer van een uitvoering (0 = eerste) sinds de start van de reeks.
 * Gebruikt voor om-en-om verdelen, zodat de volgorde voorspelbaar blijft,
 * ook als er later taken opnieuw worden ingepland. Pauzes tellen niet mee.
 */
export function occurrenceIndex(series: SeriesWindow, date: ISODate): number {
  let count = 0;
  for (let d = series.startsOn; d < date; d = addDays(d, 1)) {
    if (occursOn(series, d)) count++;
  }
  return count;
}
