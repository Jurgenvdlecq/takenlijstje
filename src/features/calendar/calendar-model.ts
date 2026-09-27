/**
 * Pure rekenhulpjes voor de kalender: zichtbare periodes, maandraster,
 * weeknummers, Nederlandse titels en geprojecteerde herhalingen.
 */
import {
  addDays,
  addMonths,
  daysInMonth,
  diffDays,
  eachDay,
  isoWeekday,
  makeDate,
  maxDate,
  parts,
  startOfIsoWeek,
  startOfMonth,
  type ISODate,
} from "@/domain/dates";
import { occurrencesBetween, type SeriesWindow } from "@/domain/recurrence/occurrences";
import type { RecurrenceRule } from "@/domain/recurrence/rule";
import type { RecurrenceRow, TaskCategory, TaskRow } from "@/types/database";

export type CalendarMode = "day" | "week" | "month";

export interface DateRange {
  from: ISODate;
  to: ISODate;
}

/** De periode die een weergave rond `anchor` toont. Maand = volledige weken van het raster. */
export function visibleRange(mode: CalendarMode, anchor: ISODate): DateRange {
  if (mode === "day") return { from: anchor, to: anchor };
  if (mode === "week") {
    const from = startOfIsoWeek(anchor);
    return { from, to: addDays(from, 6) };
  }
  const grid = monthGrid(anchor);
  return { from: grid[0][0], to: grid[grid.length - 1][6] };
}

/** Een stap vooruit (+1) of terug (-1) in de huidige weergave. */
export function shiftAnchor(mode: CalendarMode, anchor: ISODate, direction: 1 | -1): ISODate {
  if (mode === "day") return addDays(anchor, direction);
  if (mode === "week") return addDays(anchor, 7 * direction);
  return addMonths(startOfMonth(anchor), direction);
}

/** Maandraster: weken (ma t/m zo) die de maand van `anchor` volledig bedekken. */
export function monthGrid(anchor: ISODate): ISODate[][] {
  const { year, month } = parts(anchor);
  const first = makeDate(year, month, 1);
  const last = makeDate(year, month, daysInMonth(year, month));
  const start = startOfIsoWeek(first);
  const end = addDays(startOfIsoWeek(last), 6);
  const days = eachDay(start, end);
  const weeks: ISODate[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/** ISO-weeknummer (week 1 bevat de eerste donderdag van het jaar). */
export function isoWeekNumber(date: ISODate): number {
  const thursday = addDays(date, 4 - isoWeekday(date));
  const dayOfYear = diffDays(makeDate(parts(thursday).year, 1, 1), thursday);
  return Math.floor(dayOfYear / 7) + 1;
}

// ---------------------------------------------------------------------------
// Nederlandse opmaak (kalenderdatums altijd als UTC-middag formatteren)
// ---------------------------------------------------------------------------

function fmt(date: ISODate, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("nl-NL", { ...options, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

/** "dinsdag 29 sep" */
export function formatDayShort(date: ISODate): string {
  return fmt(date, { weekday: "long", day: "numeric", month: "short" });
}

/** "dinsdag 29 september" */
export function formatDayLong(date: ISODate): string {
  return fmt(date, { weekday: "long", day: "numeric", month: "long" });
}

/** "di" */
export function formatWeekdayShort(date: ISODate): string {
  return fmt(date, { weekday: "short" });
}

/** "september 2026" */
export function formatMonth(date: ISODate): string {
  return fmt(date, { month: "long", year: "numeric" });
}

/** "28 sep – 4 okt" */
export function formatRange(from: ISODate, to: ISODate): string {
  const sameYear = parts(from).year === parts(to).year;
  const a = fmt(from, sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
  const b = fmt(to, sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
  return `${a} – ${b}`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Titel en ondertitel boven de kalender. */
export function headerTitles(mode: CalendarMode, anchor: ISODate): { title: string; subtitle: string } {
  if (mode === "month") return { title: capitalize(formatMonth(anchor)), subtitle: "" };
  if (mode === "week") {
    const { from, to } = visibleRange("week", anchor);
    return { title: `Week ${isoWeekNumber(from)}`, subtitle: formatRange(from, to) };
  }
  return { title: capitalize(formatDayLong(anchor)), subtitle: `Week ${isoWeekNumber(anchor)} · ${formatMonth(anchor)}` };
}

// ---------------------------------------------------------------------------
// Geprojecteerde herhalingen
// ---------------------------------------------------------------------------

/** Een toekomstige uitvoering van een reeks die nog niet als taak bestaat. */
export interface Projection {
  key: string;
  recurrenceId: string;
  date: ISODate;
  title: string;
  time: string | null;
  category: TaskCategory;
  rule: RecurrenceRule;
  /** Vaste persoon (alleen bekend bij strategie "vast") */
  memberId: string | null;
  /** Wie aan de beurt kán zijn; null = iedereen */
  candidateMemberIds: string[] | null;
}

export function seriesWindow(row: RecurrenceRow): SeriesWindow {
  return {
    rule: row.rule,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    pausedFrom: row.paused_from,
    pausedUntil: row.paused_until,
  };
}

function candidates(row: RecurrenceRow): string[] | null {
  if (row.assignment_strategy === "fixed") return row.fixed_member_id ? [row.fixed_member_id] : [];
  if (row.assignment_strategy === "rotation" && row.rotation_member_ids.length) return row.rotation_member_ids;
  return null;
}

/**
 * Uitvoeringen ná `generated_until` binnen de periode, voor actieve reeksen.
 * Nooit in het verleden, en niet als er al een echte taak voor die datum is.
 */
export function projectOccurrences(
  recurrences: RecurrenceRow[],
  tasks: Pick<TaskRow, "recurrence_id" | "occurrence_date">[],
  range: DateRange,
  today: ISODate,
): Projection[] {
  const existing = new Set(
    tasks.filter((t) => t.recurrence_id && t.occurrence_date).map((t) => `${t.recurrence_id}:${t.occurrence_date}`),
  );
  const result: Projection[] = [];
  for (const row of recurrences) {
    if (!row.is_active) continue;
    let from = maxDate(range.from, today);
    if (row.generated_until) from = maxDate(from, addDays(row.generated_until, 1));
    if (from > range.to) continue;
    const window = seriesWindow(row);
    for (const date of occurrencesBetween(window, from, range.to)) {
      const key = `${row.id}:${date}`;
      if (existing.has(key)) continue;
      result.push({
        key,
        recurrenceId: row.id,
        date,
        title: row.title,
        time: row.time_of_day,
        category: row.category,
        rule: row.rule,
        memberId: row.assignment_strategy === "fixed" ? row.fixed_member_id : null,
        candidateMemberIds: candidates(row),
      });
    }
  }
  return result.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const ta = a.time ?? "99";
    const tb = b.time ?? "99";
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.title.localeCompare(b.title, "nl");
  });
}

/** Groepeer items per datum. */
export function groupByDate<T>(items: T[], dateOf: (item: T) => ISODate): Map<ISODate, T[]> {
  const map = new Map<ISODate, T[]>();
  for (const item of items) {
    const date = dateOf(item);
    const list = map.get(date);
    if (list) list.push(item);
    else map.set(date, [item]);
  }
  return map;
}
