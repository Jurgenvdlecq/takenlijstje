/**
 * Weergavestatus en deadline-teksten.
 * "Verlopen" wordt niet opgeslagen maar afgeleid: een open taak waarvan de
 * deadline voorbij is. Zo is de status altijd actueel, ook zonder achtergrondtaak.
 */
import { diffDays, todayIn, zonedDate, type ISODate } from "./dates";

export type StoredStatus = "todo" | "in_progress" | "done" | "skipped";
export type DisplayStatus = StoredStatus | "overdue";

export interface StatusTask {
  status: StoredStatus;
  scheduledDate: ISODate;
  dueAt: string | null;
  availableFrom?: string | null;
}

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  todo: "Nog te doen",
  in_progress: "Bezig",
  done: "Klaar",
  overdue: "Verlopen",
  skipped: "Overgeslagen",
};

export const PRIORITY_LABELS = {
  low: "Laag",
  normal: "Normaal",
  high: "Hoog",
  urgent: "Urgent",
} as const;

export type Priority = keyof typeof PRIORITY_LABELS;

export const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export function isOpen(task: { status: StoredStatus }): boolean {
  return task.status === "todo" || task.status === "in_progress";
}

export function isOverdue(task: StatusTask, now: Date, timeZone: string): boolean {
  if (!isOpen(task)) return false;
  if (task.dueAt) return new Date(task.dueAt).getTime() < now.getTime();
  return task.scheduledDate < todayIn(timeZone, now);
}

export function displayStatus(task: StatusTask, now: Date, timeZone: string): DisplayStatus {
  return isOverdue(task, now, timeZone) ? "overdue" : task.status;
}

export function isAvailable(task: StatusTask, now: Date): boolean {
  return !task.availableFrom || new Date(task.availableFrom).getTime() <= now.getTime();
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function durationText(minutes: number): string {
  if (minutes < 60) return plural(Math.max(1, minutes), "minuut", "minuten");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return plural(hours, "uur", "uur");
  return plural(Math.round(hours / 24), "dag", "dagen");
}

/**
 * Korte deadline-tekst, bijv.:
 *  "verloopt over 3 uur", "uiterlijk morgen", "2 uur te laat"
 */
export function deadlineText(task: StatusTask, now: Date, timeZone: string): string | null {
  if (!isOpen(task) || !task.dueAt) return null;
  const due = new Date(task.dueAt);
  const minutes = Math.round((due.getTime() - now.getTime()) / 60_000);

  if (minutes < 0) return `${durationText(-minutes)} te laat`;
  if (minutes < 12 * 60) return `verloopt over ${durationText(minutes)}`;

  const today = todayIn(timeZone, now);
  const dueDay = zonedDate(due, timeZone);
  const days = diffDays(today, dueDay);
  if (days === 0) return "uiterlijk vandaag";
  if (days === 1) return "uiterlijk morgen";
  if (days < 7) {
    return `uiterlijk ${new Intl.DateTimeFormat("nl-NL", { weekday: "long", timeZone }).format(due)}`;
  }
  return null;
}

/** Volledige zin voor meldingen, bijv. "De badkamer moet uiterlijk morgen worden schoongemaakt." */
export function deadlineSentence(title: string, task: StatusTask, now: Date, timeZone: string): string | null {
  const text = deadlineText(task, now, timeZone);
  if (!text) return null;
  if (text.endsWith("te laat")) return `“${title}” is nog niet gedaan (${text}).`;
  if (text.startsWith("verloopt")) return `“${title}” is nog niet gedaan en ${text}.`;
  return `“${title}” moet ${text} gedaan zijn.`;
}

export function greeting(now: Date, timeZone: string): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(now),
  );
  if (hour >= 18 || hour < 5) return "Goedenavond";
  if (hour >= 12) return "Goedemiddag";
  return "Goedemorgen";
}

export function relativeDayLabel(date: ISODate, today: ISODate): string {
  const days = diffDays(today, date);
  if (days === 0) return "Vandaag";
  if (days === 1) return "Morgen";
  if (days === -1) return "Gisteren";
  if (days === 2) return "Overmorgen";
  const d = new Date(`${date}T12:00:00Z`);
  const opts: Intl.DateTimeFormatOptions =
    days > 0 && days < 7
      ? { weekday: "long", timeZone: "UTC" }
      : { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" };
  const label = new Intl.DateTimeFormat("nl-NL", opts).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

