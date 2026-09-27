"use server";

import { z } from "zod";
import { preferencesInput, pushSubscriptionInput, uuid } from "@/lib/validation";
import type { PreferencesRow } from "@/types/database";
import { requireMember } from "../context";
import { check, runAction, UserError, type ActionResult } from "../errors";
import { notify } from "../notifications/dispatcher";
import { isWebPushConfigured } from "../notifications/channels/web-push";
import { parse } from "../parse";

export async function markNotificationsReadAction(ids?: string[]): Promise<ActionResult<null>> {
  return runAction("markNotificationsRead", async () => {
    const { supabase, member } = await requireMember();
    let query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("member_id", member.id).is("read_at", null);
    if (ids?.length) query = query.in("id", parse(z.array(uuid).max(200), ids));
    check(await query);
    return null;
  });
}

export async function savePreferencesAction(raw: z.input<typeof preferencesInput>): Promise<ActionResult<PreferencesRow>> {
  return runAction("savePreferences", async () => {
    const { supabase, household, member } = await requireMember();
    const p = parse(preferencesInput, raw);
    return check(
      await supabase
        .from("user_preferences")
        .upsert({
          member_id: member.id,
          household_id: household.id,
          push_enabled: p.pushEnabled,
          notify_task_assigned: p.notifyTaskAssigned,
          notify_reminders: p.notifyReminders,
          notify_deadline_soon: p.notifyDeadlineSoon,
          notify_overdue: p.notifyOverdue,
          notify_task_completed: p.notifyTaskCompleted,
          notify_swap_requests: p.notifySwapRequests,
          daily_summary_enabled: p.dailySummaryEnabled,
          daily_summary_time: p.dailySummaryTime,
          evening_summary_enabled: p.eveningSummaryEnabled,
          evening_summary_time: p.eveningSummaryTime,
          deadline_warning_minutes: p.deadlineWarningMinutes,
        })
        .select("*")
        .single(),
    ) as PreferencesRow;
  });
}

export async function savePushSubscriptionAction(raw: z.input<typeof pushSubscriptionInput>): Promise<ActionResult<null>> {
  return runAction("savePushSubscription", async () => {
    const { supabase, user, household, member } = await requireMember();
    if (!isWebPushConfigured()) throw new UserError("Pushmeldingen zijn op deze server nog niet ingesteld (VAPID-sleutels).");
    const sub = parse(pushSubscriptionInput, raw);
    check(
      await supabase.from("push_subscriptions").upsert(
        { user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        { onConflict: "endpoint" },
      ),
    );
    check(await supabase.from("user_preferences").update({ push_enabled: true }).eq("member_id", member.id).eq("household_id", household.id));
    return null;
  });
}

export async function deletePushSubscriptionAction(endpoint: string): Promise<ActionResult<null>> {
  return runAction("deletePushSubscription", async () => {
    const { supabase, user } = await requireMember();
    check(await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", parse(z.url(), endpoint)));
    return null;
  });
}

export async function sendTestNotificationAction(): Promise<ActionResult<null>> {
  return runAction("sendTestNotification", async () => {
    const { supabase, household, member } = await requireMember();
    await notify({
      householdId: household.id,
      memberIds: [member.id],
      fallbackDb: supabase,
      message: {
        type: "reminder",
        title: "Testmelding",
        body: "Meldingen werken! 🎉",
        url: "/meldingen",
        dedupeKey: `test:${Date.now()}`,
      },
    });
    return null;
  });
}
