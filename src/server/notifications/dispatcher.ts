import "server-only";

/**
 * Centrale plek om meldingen te versturen:
 *  1. voorkeuren van iedere ontvanger respecteren
 *  2. in-app melding opslaan (notifications-tabel, ook zichtbaar via realtime)
 *  3. extra kanalen (Web Push, later e-mail/WhatsApp/…) aanroepen
 */
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import type { DbClient } from "@/lib/supabase/server";
import type { MemberRow, PreferencesRow } from "@/types/database";
import { WebPushChannel } from "./channels/web-push";
import { PREFERENCE_FOR_TYPE, type NotificationChannel, type NotificationMessage, type Recipient } from "./types";

export interface NotifyOptions {
  householdId: string;
  memberIds: string[];
  message: NotificationMessage;
  /** Client om mee te schrijven als er geen service role is (alleen in-app) */
  fallbackDb?: DbClient;
}

function channelsFor(db: DbClient): NotificationChannel[] {
  return [new WebPushChannel(db)];
}

export async function notify({ householdId, memberIds, message, fallbackDb }: NotifyOptions): Promise<void> {
  const unique = [...new Set(memberIds)];
  if (!unique.length) return;

  try {
    if (!hasAdminClient()) {
      // Zonder service role: alleen in-app melding via de gebruikersclient (RLS staat dit toe)
      if (fallbackDb) {
        await fallbackDb.from("notifications").insert(unique.map((memberId) => toRow(householdId, memberId, message)));
      }
      return;
    }

    const db = createAdminClient();
    const [{ data: members }, { data: prefs }] = await Promise.all([
      db.from("household_members").select("*").eq("household_id", householdId).in("id", unique),
      db.from("user_preferences").select("*").eq("household_id", householdId).in("member_id", unique),
    ]);

    const recipients: Recipient[] = ((members ?? []) as MemberRow[])
      .filter((m) => m.is_active && m.user_id)
      .map((m) => ({
        memberId: m.id,
        userId: m.user_id,
        householdId,
        preferences: ((prefs ?? []) as PreferencesRow[]).find((p) => p.member_id === m.id) ?? null,
      }))
      .filter((r) => wants(r, message));
    if (!recipients.length) return;

    const { data: inserted } = await db
      .from("notifications")
      .upsert(
        recipients.map((r) => toRow(householdId, r.memberId, message)),
        { onConflict: "member_id,dedupe_key", ignoreDuplicates: true },
      )
      .select("member_id");

    // Alleen pushen naar wie de melding echt nieuw kreeg (dedupe)
    const fresh = new Set((inserted ?? []).map((n) => n.member_id));
    const toDeliver = recipients.filter((r) => fresh.has(r.memberId) || !message.dedupeKey);

    for (const channel of channelsFor(db)) {
      const targets = toDeliver.filter((r) => channel.isEnabledFor(r));
      if (targets.length) await channel.deliver(targets, message);
    }

    if (toDeliver.length) {
      await db
        .from("notifications")
        .update({ pushed_at: new Date().toISOString() })
        .eq("household_id", householdId)
        .in("member_id", toDeliver.map((r) => r.memberId))
        .is("pushed_at", null)
        .eq("title", message.title);
    }
  } catch (error) {
    // Een mislukte melding mag de eigenlijke actie nooit laten falen
    console.error(`[notify] ${message.type} mislukt: ${(error as Error)?.name ?? "fout"}`);
  }
}

function wants(recipient: Recipient, message: NotificationMessage): boolean {
  const prefs = recipient.preferences;
  if (!prefs) return true;
  return Boolean(prefs[PREFERENCE_FOR_TYPE[message.type]]);
}

function toRow(householdId: string, memberId: string, message: NotificationMessage) {
  return {
    household_id: householdId,
    member_id: memberId,
    type: message.type,
    title: message.title.slice(0, 120),
    body: message.body?.slice(0, 500) ?? null,
    task_id: message.taskId ?? null,
    url: message.url ?? (message.taskId ? `/taken?taak=${message.taskId}` : null),
    dedupe_key: message.dedupeKey ?? null,
  };
}
