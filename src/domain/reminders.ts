/**
 * Welke meldingen zijn nu aan de beurt? Puur, zodat het te testen is.
 * De cron (iedere ~15 minuten) roept dit aan; dubbele meldingen worden
 * voorkomen via de dedupe-sleutel.
 */
import { zonedDate, zonedInstant, zonedTime, type ISODate } from "./dates";
import type { NotificationType } from "@/types/database";

export interface ReminderTask {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done" | "skipped";
  scheduledDate: ISODate;
  scheduledTime: string | null;
  dueAt: string | null;
  reminderMinutesBefore: number[];
}

export interface ReminderPrefs {
  deadlineWarningMinutes: number;
  dailySummaryEnabled: boolean;
  dailySummaryTime: string;
  eveningSummaryEnabled: boolean;
  eveningSummaryTime: string;
}

export interface DueMessage {
  type: NotificationType;
  title: string;
  body?: string;
  taskId?: string;
  dedupeKey: string;
}

/** Hoe lang na het geplande moment een melding nog zin heeft */
const GRACE_MINUTES = 90;
/** Verlopen-melding alleen in de eerste dag na de deadline */
const OVERDUE_WINDOW_MINUTES = 24 * 60;

function minutesUntil(iso: string, now: Date): number {
  return (new Date(iso).getTime() - now.getTime()) / 60_000;
}

function durationLabel(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} minuten`;
  // Afronden op halve uren: 90 → "1,5 uur", 120 → "2 uur"
  return `${String(Math.round(minutes / 30) / 2).replace(".", ",")} uur`;
}

/** Referentiemoment voor herinneringen: gepland tijdstip, anders de deadline. */
function reminderAnchor(task: ReminderTask, timeZone: string): string | null {
  if (task.scheduledTime) return zonedInstant(task.scheduledDate, task.scheduledTime.slice(0, 5), timeZone);
  return task.dueAt;
}

export function taskMessages(
  task: ReminderTask,
  prefs: ReminderPrefs,
  now: Date,
  timeZone: string,
): DueMessage[] {
  if (task.status !== "todo" && task.status !== "in_progress") return [];
  const messages: DueMessage[] = [];

  // Herinneringen X minuten vooraf
  const anchor = reminderAnchor(task, timeZone);
  if (anchor) {
    for (const before of task.reminderMinutesBefore) {
      const untilReminder = minutesUntil(anchor, now) - before;
      if (untilReminder <= 0 && untilReminder > -GRACE_MINUTES) {
        messages.push({
          type: "reminder",
          title: `Herinnering: ${task.title}`,
          body: before === 0 ? "Deze taak staat nu gepland." : `Over ${durationLabel(before)} gepland.`,
          taskId: task.id,
          dedupeKey: `reminder:${task.id}:${before}:${anchor}`,
        });
      }
    }
  }

  if (task.dueAt) {
    const left = minutesUntil(task.dueAt, now);
    // Deadline nadert
    if (left > 0 && left <= prefs.deadlineWarningMinutes) {
      messages.push({
        type: "deadline_soon",
        title: `${task.title} moet binnen ${durationLabel(left)} gedaan zijn`,
        taskId: task.id,
        dedupeKey: `deadline:${task.id}:${task.dueAt}`,
      });
    }
    // Verlopen
    if (left <= 0 && left > -OVERDUE_WINDOW_MINUTES) {
      messages.push({
        type: "overdue",
        title: `De taak “${task.title}” is nog niet gedaan`,
        taskId: task.id,
        dedupeKey: `overdue:${task.id}:${task.dueAt}`,
      });
    }
  }

  return messages;
}

function isTimeWindow(now: Date, timeZone: string, time: string): boolean {
  const { hour, minute } = zonedTime(now, timeZone);
  const [h, m] = time.split(":").map(Number);
  const diff = hour * 60 + minute - (h * 60 + m);
  return diff >= 0 && diff < GRACE_MINUTES * 2;
}

/**
 * Dag- en avondoverzicht voor één gezinslid.
 * @param todayCount   taken vandaag voor het hele huishouden
 * @param mineToday    mijn taken vandaag
 * @param mineOpen     mijn nog openstaande taken (vandaag + verlopen)
 */
export function summaryMessages(
  prefs: ReminderPrefs,
  now: Date,
  timeZone: string,
  counts: { todayCount: number; mineToday: number; mineOpen: number },
): DueMessage[] {
  const today = zonedDate(now, timeZone);
  const messages: DueMessage[] = [];

  if (prefs.dailySummaryEnabled && isTimeWindow(now, timeZone, prefs.dailySummaryTime) && counts.todayCount > 0) {
    messages.push({
      type: "daily_summary",
      title: `Vandaag staan er ${counts.todayCount} ${counts.todayCount === 1 ? "taak" : "taken"} gepland`,
      body: counts.mineToday ? `Waarvan ${counts.mineToday} voor jou.` : "Geen daarvan staat op jouw naam.",
      dedupeKey: `daily:${today}`,
    });
  }

  if (prefs.eveningSummaryEnabled && isTimeWindow(now, timeZone, prefs.eveningSummaryTime) && counts.mineOpen > 0) {
    messages.push({
      type: "evening_summary",
      title: `Er ${counts.mineOpen === 1 ? "staat" : "staan"} nog ${counts.mineOpen} ${counts.mineOpen === 1 ? "taak" : "taken"} open`,
      body: "Kijk of je er nog eentje kunt afvinken.",
      dedupeKey: `evening:${today}`,
    });
  }

  return messages;
}
