import "server-only";

/**
 * Periodieke achtergrondtaak (iedere ~15 minuten via /api/cron/tick):
 *  1. planning van terugkerende taken aanvullen
 *  2. verlopen taken die zijn ingehaald overslaan
 *  3. herinneringen, deadline-waarschuwingen en verlopen-meldingen
 *  4. dag- en avondoverzicht
 */
import { todayIn } from "@/domain/dates";
import { summaryMessages, taskMessages, type ReminderPrefs } from "@/domain/reminders";
import { isOverdue } from "@/domain/status";
import { createAdminClient } from "./admin-client";
import type { HouseholdRow, MemberRow, PreferencesRow, TaskRow } from "@/types/database";
import { check } from "../errors";
import { skipSupersededTasks, topUpSeries } from "../services/scheduling";
import { notify } from "./dispatcher";

function toPrefs(row: PreferencesRow | undefined): ReminderPrefs {
  return {
    deadlineWarningMinutes: row?.deadline_warning_minutes ?? 120,
    dailySummaryEnabled: row?.daily_summary_enabled ?? true,
    dailySummaryTime: row?.daily_summary_time?.slice(0, 5) ?? "07:30",
    eveningSummaryEnabled: row?.evening_summary_enabled ?? true,
    eveningSummaryTime: row?.evening_summary_time?.slice(0, 5) ?? "20:00",
  };
}

export interface TickReport {
  households: number;
  created: number;
  skipped: number;
  messages: number;
}

export async function runTick(now = new Date()): Promise<TickReport> {
  const db = createAdminClient();
  const households = check(await db.from("households").select("*")) as HouseholdRow[];
  const report: TickReport = { households: households.length, created: 0, skipped: 0, messages: 0 };

  for (const household of households) {
    try {
      report.created += (await topUpSeries(db, household.id, { now })).length;
      report.skipped += await skipSupersededTasks(db, household.id, now);
      report.messages += await sendDueMessages(household, now);
    } catch (error) {
      console.error(`[tick] huishouden overgeslagen: ${(error as Error)?.name ?? "fout"}`);
    }
  }
  return report;
}

async function sendDueMessages(household: HouseholdRow, now: Date): Promise<number> {
  const db = createAdminClient();
  const tz = household.timezone;
  const today = todayIn(tz, now);

  const [members, prefs, tasks] = await Promise.all([
    db.from("household_members").select("*").eq("household_id", household.id).eq("is_active", true).then(check),
    db.from("user_preferences").select("*").eq("household_id", household.id).then(check),
    db
      .from("tasks")
      .select("*")
      .eq("household_id", household.id)
      .is("deleted_at", null)
      .in("status", ["todo", "in_progress"])
      .lte("scheduled_date", today)
      .then(check),
  ]);
  const admins = (members as MemberRow[]).filter((m) => m.role === "admin").map((m) => m.id);
  const prefsFor = (memberId: string) => toPrefs((prefs as PreferencesRow[]).find((p) => p.member_id === memberId));
  let sent = 0;

  for (const task of tasks as TaskRow[]) {
    // Niet toegewezen → beheerders krijgen alleen de verlopen-melding
    const recipients = task.assigned_member_id ? [task.assigned_member_id] : admins;
    for (const memberId of recipients) {
      const messages = taskMessages(
        {
          id: task.id,
          title: task.title,
          status: task.status,
          scheduledDate: task.scheduled_date,
          scheduledTime: task.scheduled_time,
          dueAt: task.due_at,
          reminderMinutesBefore: task.reminder_minutes_before ?? [],
        },
        prefsFor(memberId),
        now,
        tz,
      ).filter((m) => task.assigned_member_id || m.type === "overdue");
      for (const message of messages) {
        await notify({ householdId: household.id, memberIds: [memberId], message });
        sent++;
      }
    }
  }

  const todayTasks = (tasks as TaskRow[]).filter((t) => t.scheduled_date === today);
  for (const member of members as MemberRow[]) {
    if (!member.user_id) continue;
    const mine = (tasks as TaskRow[]).filter((t) => t.assigned_member_id === member.id);
    const messages = summaryMessages(prefsFor(member.id), now, tz, {
      todayCount: todayTasks.length,
      mineToday: mine.filter((t) => t.scheduled_date === today).length,
      mineOpen: mine.filter(
        (t) => t.scheduled_date === today || isOverdue({ status: t.status, scheduledDate: t.scheduled_date, dueAt: t.due_at }, now, tz),
      ).length,
    });
    for (const message of messages) {
      await notify({ householdId: household.id, memberIds: [member.id], message: { ...message, url: "/" } });
      sent++;
    }
  }

  return sent;
}
