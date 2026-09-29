import "server-only";

/**
 * Periodieke achtergrondtaak (elke 15 minuten via Supabase Cron, vangnet 1×/dag
 * via Vercel; TECHNICAL_DESIGN §11.3). Set-gebaseerd over alle huishoudens:
 *  1. planning van terugkerende taken aanvullen
 *  2. verlopen reekstaken die zijn ingehaald overslaan (BR-16)
 *  3. herinneringen, deadline-waarschuwingen, verlopen-meldingen en overzichten
 *  4. bewaartermijnen (run_purge, BR-45)
 * Elke stap heeft een eigen try/catch: een fout in de ene blokkeert de andere
 * niet. Antwoord en log bevatten alleen tellingen en codes.
 */
import { addDays, todayIn } from "@/domain/dates";
import { recipientsFor, summaryMessages, taskMessages, type DueMessage, type ReminderPrefs } from "@/domain/reminders";
import { isOverdue } from "@/domain/status";
import type { NotificationMessage } from "@/server/notifications/types";
import type { MemberRow, PreferencesRow, TaskRow } from "@/types/database";
import { check } from "../errors";
import { chunks, HOUSEHOLD_TIMEZONE, planAllSeries, selectAll, skipAllSuperseded } from "../services/scheduling";
import { createAdminClient } from "./admin-client";
import { PUSH_CONCURRENCY, PUSH_TIMEOUT_MS, runLimited, sendPush, type PushSubscriptionRow } from "./channels/web-push";
import { toRow } from "./dispatcher";

/** Na zoveel ms geen nieuwe pushes meer starten (§11.3); de functie mag 60 s */
const PUSH_BUDGET_MS = 45_000;
const DEFAULT_TZ = HOUSEHOLD_TIMEZONE;
/**
 * Hoe ver vooruit de meldingenstap taken leest: een herinnering mag tot 7 dagen
 * vooraf (validation.ts), dus een taak over 7 dagen kan nu al aan de beurt zijn
 * (code-review WP3, punt 13)
 */
const READ_AHEAD_DAYS = 7;

export interface TickReport {
  households: number;
  planned: number;
  skipped: number;
  notified: number;
  pushed: number;
  purged: Record<string, number> | null;
  /** Namen van stappen die faalden (alleen codes, geen gegevens) */
  failed: string[];
}

function toPrefs(row: PreferencesRow | undefined): ReminderPrefs {
  return {
    deadlineWarningMinutes: row?.deadline_warning_minutes ?? 120,
    dailySummaryEnabled: row?.daily_summary_enabled ?? false,
    dailySummaryTime: row?.daily_summary_time?.slice(0, 5) ?? "07:30",
    eveningSummaryEnabled: row?.evening_summary_enabled ?? false,
    eveningSummaryTime: row?.evening_summary_time?.slice(0, 5) ?? "20:00",
  };
}

function errorCode(error: unknown): string {
  const e = error as { code?: string; name?: string };
  return e?.code ?? e?.name ?? "fout";
}

export async function runTick(now = new Date()): Promise<TickReport> {
  const started = Date.now();
  const db = createAdminClient();
  const report: TickReport = { households: 0, planned: 0, skipped: 0, notified: 0, pushed: 0, purged: null, failed: [] };

  const step = async (name: string, work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      report.failed.push(name);
      console.error(`[tick] stap ${name} mislukt: ${errorCode(error)}`);
    }
  };

  await step("plannen", async () => {
    report.planned = await planAllSeries(db, now);
  });
  await step("overslaan", async () => {
    report.skipped = await skipAllSuperseded(db, now);
  });
  await step("meldingen", async () => {
    const result = await sendDueMessages(db, now, started + PUSH_BUDGET_MS);
    report.households = result.households;
    report.notified = result.notified;
    report.pushed = result.pushed;
  });
  await step("opruimen", async () => {
    report.purged = check(await db.rpc("run_purge")) as Record<string, number>;
    // Opvallend maken wat de bouwer met Jurgen moet oplossen (security-review WP3, punt 7)
    const { households_without_members: gone = 0, households_without_admin: orphaned = 0 } = report.purged ?? {};
    if (gone || orphaned) {
      console.warn(`[tick] let op: huishoudens zonder leden opgeruimd=${gone}, zonder actieve beheerder=${orphaned}`);
    }
  });

  console.info(
    `[tick] plannen=${report.planned} overslaan=${report.skipped} meldingen=${report.notified} push=${report.pushed}` +
      ` opruimen=${JSON.stringify(report.purged)} mislukt=${report.failed.join(",") || "-"} duur=${Date.now() - started}ms`,
  );
  return report;
}

type OpenTask = Pick<
  TaskRow,
  "id" | "household_id" | "title" | "status" | "scheduled_date" | "scheduled_time" | "due_at" | "reminder_minutes_before"
>;

interface Pending {
  householdId: string;
  memberId: string;
  userId: string;
  message: NotificationMessage & { dedupeKey: string };
}

/** Stap 3: welke meldingen zijn nu aan de beurt, voor alle huishoudens (§11.3). */
async function sendDueMessages(db: ReturnType<typeof createAdminClient>, now: Date, pushDeadline: number) {
  const households = check(await db.from("households").select("id, timezone")) as { id: string; timezone: string }[];
  const latestToday = households.map((h) => todayIn(h.timezone ?? DEFAULT_TZ, now)).sort().at(-1) ?? todayIn(DEFAULT_TZ, now);

  const [tasks, members, prefs] = await Promise.all([
    selectAll<OpenTask>((from, to) =>
      db
        .from("tasks")
        .select("id, household_id, title, status, scheduled_date, scheduled_time, due_at, reminder_minutes_before")
        .is("deleted_at", null)
        .in("status", ["todo", "in_progress"])
        .lte("scheduled_date", addDays(latestToday, READ_AHEAD_DAYS))
        .order("id")
        .range(from, to),
    ),
    db
      .from("household_members")
      .select("id, household_id, user_id, is_active")
      .eq("is_active", true)
      .not("user_id", "is", null)
      .then(check) as Promise<Pick<MemberRow, "id" | "household_id" | "user_id" | "is_active">[]>,
    db.from("user_preferences").select("*").then(check) as Promise<PreferencesRow[]>,
  ]);

  const prefsOf = new Map(prefs.map((p) => [p.member_id, p]));
  const pending: Pending[] = [];

  for (const household of households) {
    const tz = household.timezone ?? DEFAULT_TZ;
    const today = todayIn(tz, now);
    const own = members.filter((m) => m.household_id === household.id);
    if (!own.length) continue;
    const ownPrefs = prefs.filter((p) => p.household_id === household.id);
    const wanted = (type: DueMessage["type"]) => new Set(recipientsFor(type, own, ownPrefs));
    const cache = new Map<string, Set<string>>();
    const wants = (type: DueMessage["type"], memberId: string) => {
      if (!cache.has(type)) cache.set(type, wanted(type));
      return cache.get(type)!.has(memberId);
    };
    const add = (memberId: string, message: DueMessage, url?: string) => {
      if (!wants(message.type, memberId)) return;
      const member = own.find((m) => m.id === memberId)!;
      pending.push({ householdId: household.id, memberId, userId: member.user_id!, message: { ...message, url: url ?? null } });
    };

    const ownTasks = tasks.filter((t) => t.household_id === household.id);
    for (const task of ownTasks) {
      for (const member of own) {
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
          toPrefs(prefsOf.get(member.id)),
          now,
          tz,
        );
        for (const message of messages) add(member.id, message);
      }
    }

    // Dag- en avondoverzicht tellen voor het hele huishouden (BR-31)
    const upToToday = ownTasks.filter((t) => t.scheduled_date <= today);
    const counts = {
      todayOpen: upToToday.filter((t) => t.scheduled_date === today).length,
      openIncludingOverdue: upToToday.filter(
        (t) => t.scheduled_date === today || isOverdue({ status: t.status, scheduledDate: t.scheduled_date, dueAt: t.due_at }, now, tz),
      ).length,
    };
    for (const member of own) {
      for (const message of summaryMessages(toPrefs(prefsOf.get(member.id)), now, tz, counts)) add(member.id, message, "/");
    }
  }

  const result = { households: households.length, notified: 0, pushed: 0 };
  if (!pending.length) return result;

  // Eén bulk-upsert; alleen wat echt nieuw is, komt terug (dedupe)
  const inserted = check(
    await db
      .from("notifications")
      .upsert(
        pending.map((p) => toRow(p.householdId, p.memberId, p.message)),
        { onConflict: "member_id,dedupe_key", ignoreDuplicates: true },
      )
      .select("id, member_id, dedupe_key"),
  ) as { id: string; member_id: string; dedupe_key: string }[];
  result.notified = inserted.length;
  if (!inserted.length) return result;

  const byKey = new Map(pending.map((p) => [`${p.memberId}|${p.message.dedupeKey}`, p]));
  const fresh = inserted
    .map((n) => ({ id: n.id, pending: byKey.get(`${n.member_id}|${n.dedupe_key}`) }))
    .filter((n): n is { id: string; pending: Pending } => Boolean(n.pending));

  // Push alleen voor de nieuwe meldingen, naar wie push aan heeft
  const pushUsers = [...new Set(fresh.filter((n) => prefsOf.get(n.pending.memberId)?.push_enabled).map((n) => n.pending.userId))];
  const subscriptions = pushUsers.length
    ? ((check(await db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", pushUsers)) ??
        []) as PushSubscriptionRow[])
    : [];
  const subsOf = new Map<string, PushSubscriptionRow[]>();
  for (const sub of subscriptions) subsOf.set(sub.user_id, [...(subsOf.get(sub.user_id) ?? []), sub]);

  // Per gebruiker gegroepeerd: één werkeenheid stuurt diens nieuwe meldingen na elkaar
  const perUser = new Map<string, typeof fresh>();
  for (const n of fresh) perUser.set(n.pending.userId, [...(perUser.get(n.pending.userId) ?? []), n]);
  const handled: string[] = [];
  await runLimited(
    [...perUser.entries()],
    PUSH_CONCURRENCY,
    async ([userId, list]) => {
      for (const n of list) {
        if (Date.now() >= pushDeadline) return;
        const wantsPush = Boolean(prefsOf.get(n.pending.memberId)?.push_enabled);
        let complete = true;
        for (const sub of wantsPush ? (subsOf.get(userId) ?? []) : []) {
          // Het budget geldt ook per toestel (code-review WP3, punt 8)
          if (Date.now() >= pushDeadline) {
            complete = false;
            break;
          }
          // De laatste verzending mag het budget hooguit 5 s overschrijden (performance-review WP3, punt 4)
          const timeout = Math.max(1000, Math.min(PUSH_TIMEOUT_MS, pushDeadline + 5000 - Date.now()));
          if (await sendPush(db, sub, n.pending.message, timeout)) result.pushed++;
        }
        if (complete) handled.push(n.id);
      }
    },
    pushDeadline,
  );

  // pushed_at op id (niet op titel, §11.3); wat na het tijdsbudget overbleef, blijft leeg
  for (const ids of chunks(handled)) {
    check(await db.from("notifications").update({ pushed_at: new Date().toISOString() }).in("id", ids));
  }
  return result;
}
