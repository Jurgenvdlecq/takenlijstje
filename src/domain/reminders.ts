/**
 * Welke meldingen zijn nu aan de beurt? Puur, zodat het te testen is.
 * De cron (iedere ~15 minuten) roept dit aan; dubbele meldingen worden
 * voorkomen via de dedupe-sleutel.
 */
import { addDays, zonedDate, zonedInstant, zonedTime, type ISODate } from "./dates";
import { wasteReminderText, type WasteDirection } from "./waste/messages";
import { WASTE_IN_REMINDER, WASTE_OUT_REMINDER } from "./waste/plan";
import type { MemberRow, NotificationType, PreferencesRow } from "@/types/database";

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
        title: `${task.title} is verlopen`,
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
 * Dag- en avondoverzicht. Telt voor het huishouden als geheel en noemt geen
 * namen (BR-31, V-21).
 * @param todayOpen            open taken die vandaag gepland staan
 * @param openIncludingOverdue open taken van vandaag plus verlopen taken
 */
export function summaryMessages(
  prefs: ReminderPrefs,
  now: Date,
  timeZone: string,
  counts: { todayOpen: number; openIncludingOverdue: number },
): DueMessage[] {
  const today = zonedDate(now, timeZone);
  const messages: DueMessage[] = [];

  if (prefs.dailySummaryEnabled && isTimeWindow(now, timeZone, prefs.dailySummaryTime) && counts.todayOpen > 0) {
    messages.push({
      type: "daily_summary",
      title: `Vandaag ${counts.todayOpen === 1 ? "staat er 1 taak" : `staan er ${counts.todayOpen} taken`}`,
      dedupeKey: `daily:${today}`,
    });
  }

  if (prefs.eveningSummaryEnabled && isTimeWindow(now, timeZone, prefs.eveningSummaryTime) && counts.openIncludingOverdue > 0) {
    const n = counts.openIncludingOverdue;
    messages.push({
      type: "evening_summary",
      title: `Er ${n === 1 ? "staat nog 1 taak" : `staan nog ${n} taken`} open`,
      dedupeKey: `evening:${today}`,
    });
  }

  return messages;
}

/**
 * Welke voorkeur bepaalt of iemand een soort melding wil ontvangen. De
 * storingsmelding van de afvalkalender heeft geen voorkeur (§18.9.3).
 */
export const PREFERENCE_FOR_TYPE: Record<Exclude<NotificationType, "waste_sync_failed">, keyof PreferencesRow> = {
  reminder: "notify_reminders",
  deadline_soon: "notify_deadline_soon",
  overdue: "notify_overdue",
  task_completed: "notify_task_completed",
  daily_summary: "daily_summary_enabled",
  evening_summary: "evening_summary_enabled",
};

/**
 * Wie krijgt deze soort melding: ieder actief lid met een account dat de
 * voorkeur aan heeft staan (V-23). Er is bewust geen parameter voor wie iets
 * deed: "taak gedaan" gaat ook naar wie afvinkte, zodat uit de ontvangers niet
 * is af te leiden wie het was (V-38a).
 */
export function recipientsFor(
  type: NotificationType,
  members: (Pick<MemberRow, "id" | "user_id" | "is_active"> & { role?: MemberRow["role"] })[],
  prefs: (Partial<PreferencesRow> & { member_id: string })[],
): string[] {
  const withAccount = members.filter((m) => m.is_active && m.user_id);
  // Storing van de afvalkalender: alle actieve beheerders, los van de voorkeuren (§18.9.3)
  if (type === "waste_sync_failed") return withAccount.filter((m) => m.role === "admin").map((m) => m.id);
  const key = PREFERENCE_FOR_TYPE[type];
  return withAccount.filter((m) => Boolean(prefs.find((p) => p.member_id === m.id)?.[key])).map((m) => m.id);
}

// ---------------------------------------------------------------------------
// Afvaltaken (BR-55, §18.9.1): vervangt taskMessages volledig, dus nooit
// "deadline nadert" of "verlopen" (AC-211)
// ---------------------------------------------------------------------------

export interface WasteReminderTask {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done" | "skipped";
  pickupDate: ISODate;
  direction: WasteDirection;
  streamCount: number;
}

/** Anker: buiten om (D−1) 21:00, binnen om D 18:00 */
export function wasteReminderAnchor(pickupDate: ISODate, direction: WasteDirection, timeZone: string): string {
  return direction === "out"
    ? zonedInstant(addDays(pickupDate, -1), WASTE_OUT_REMINDER, timeZone)
    : zonedInstant(pickupDate, WASTE_IN_REMINDER, timeZone);
}

export function wasteReminder(task: WasteReminderTask, now: Date, timeZone: string): DueMessage | null {
  if (task.status !== "todo" && task.status !== "in_progress") return null;
  const anchor = wasteReminderAnchor(task.pickupDate, task.direction, timeZone);
  const since = (now.getTime() - new Date(anchor).getTime()) / 60_000;
  if (since < 0 || since >= GRACE_MINUTES) return null;
  const text = wasteReminderText(task.title, task.direction, task.streamCount);
  return { type: "reminder", title: text.title, body: text.body, taskId: task.id, dedupeKey: `waste:${task.id}:${anchor}` };
}
