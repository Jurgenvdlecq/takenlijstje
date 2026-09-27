/**
 * Datumhulpjes voor "kalenderdatums" (YYYY-MM-DD) zonder tijdzone-gedoe.
 * Kalenderdatums rekenen we intern in UTC, zodat zomer-/wintertijd nooit
 * een dag verschuift. Omrekenen naar echte tijdstippen gebeurt alleen via
 * de functies onderaan, met de tijdzone van het huishouden.
 */
import { TZDate } from "@date-fns/tz";

export type ISODate = string; // "2026-09-27"
export type ISOWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // ma = 1 … zo = 7

const DAY_MS = 86_400_000;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(value: string): value is ISODate {
  const match = ISO_DATE_RE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function toUtc(date: ISODate): Date {
  const match = ISO_DATE_RE.exec(date);
  if (!match) throw new Error(`Ongeldige datum: ${date}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function fromUtc(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function parts(date: ISODate): { year: number; month: number; day: number } {
  const d = toUtc(date);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function makeDate(year: number, month: number, day: number): ISODate {
  return fromUtc(new Date(Date.UTC(year, month - 1, day)));
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUtc(new Date(toUtc(date).getTime() + days * DAY_MS));
}

export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS);
}

export function isoWeekday(date: ISODate): ISOWeekday {
  const day = toUtc(date).getUTCDay(); // zo = 0
  return (day === 0 ? 7 : day) as ISOWeekday;
}

export function startOfIsoWeek(date: ISODate): ISODate {
  return addDays(date, 1 - isoWeekday(date));
}

export function startOfMonth(date: ISODate): ISODate {
  const { year, month } = parts(date);
  return makeDate(year, month, 1);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthsBetween(from: ISODate, to: ISODate): number {
  const a = parts(from);
  const b = parts(to);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

export function addMonths(date: ISODate, months: number): ISODate {
  const { year, month, day } = parts(date);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const y = target.getUTCFullYear();
  const m = target.getUTCMonth() + 1;
  return makeDate(y, m, Math.min(day, daysInMonth(y, m)));
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a <= b ? a : b;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a >= b ? a : b;
}

export function isBetween(date: ISODate, from: ISODate | null, to: ISODate | null): boolean {
  return (from === null || date >= from) && (to === null || date <= to);
}

/** Alle datums van `from` t/m `to`. */
export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const result: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) result.push(d);
  return result;
}

// ---------------------------------------------------------------------------
// Tijdzones: kalenderdatum + tijd ↔ echt tijdstip
// ---------------------------------------------------------------------------

/** "HH:MM" of "HH:MM:SS" → [uren, minuten] */
export function parseTime(time: string): [number, number] {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error(`Ongeldige tijd: ${time}`);
  }
  return [h, m];
}

/** Lokale datum + tijd in de tijdzone van het huishouden → ISO-tijdstip (UTC). */
export function zonedInstant(date: ISODate, time: string, timeZone: string): string {
  const { year, month, day } = parts(date);
  const [h, m] = parseTime(time);
  const zoned = new TZDate(year, month - 1, day, h, m, 0, timeZone);
  return new Date(zoned.getTime()).toISOString();
}

/** De kalenderdatum van een tijdstip in een tijdzone. */
export function zonedDate(instant: Date | string, timeZone: string): ISODate {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  // en-CA formatteert als YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Uur en minuut van een tijdstip in een tijdzone. */
export function zonedTime(instant: Date | string, timeZone: string): { hour: number; minute: number } {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
  const [hour, minute] = formatted.split(":").map(Number);
  return { hour, minute };
}

export function todayIn(timeZone: string, now: Date = new Date()): ISODate {
  return zonedDate(now, timeZone);
}

/** "18:00:00" → "18:00" */
export function shortTime(time: string | null | undefined): string | null {
  return time ? time.slice(0, 5) : null;
}
