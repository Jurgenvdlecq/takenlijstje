import "server-only";

/**
 * Centrale plek om meldingen te versturen (alleen het systeem, BR-25):
 *  1. voorkeuren van iedere ontvanger respecteren
 *  2. in-app melding opslaan (notifications-tabel, ook zichtbaar via realtime)
 *  3. extra kanalen (Web Push) aanroepen
 * Ontvangers en inhoud bepaalt de server; er is geen terugval op de
 * gebruikersclient (TECHNICAL_DESIGN §5.3).
 */
import type { DbClient } from "@/lib/supabase/server";
import { recipientsFor } from "@/domain/reminders";
import {
  type NotificationChannel,
  type NotificationMessage,
  type Recipient,
} from "@/server/notifications/types";
import type { MemberRow, PreferencesRow } from "@/types/database";
import { check } from "../errors";
import { createAdminClient, hasAdminClient } from "./admin-client";
import { WebPushChannel } from "./channels/web-push";

export interface NotifyOptions {
  householdId: string;
  /** Beperk tot deze leden; zonder lijst: het hele huishouden */
  memberIds?: string[];
  message: NotificationMessage;
}

function channelsFor(db: DbClient): NotificationChannel[] {
  return [new WebPushChannel(db)];
}

/**
 * Ontvangers bepaalt de server uit de database: ieder actief lid met account
 * dat deze soort aan heeft staan (recipientsFor, V-23). Wie de actie deed,
 * speelt geen rol (V-38a).
 */
export async function notify({ householdId, memberIds, message }: NotifyOptions): Promise<void> {
  const only = memberIds ? new Set(memberIds) : null;
  if (only && !only.size) return;

  try {
    if (!hasAdminClient()) {
      console.error(`[notify] ${message.type} niet verstuurd: systeemsleutel ontbreekt`);
      return;
    }

    const db = createAdminClient();
    // check(): een mislukte query komt in de catch en wordt gelogd (code-review WP3, punt 10)
    const [members, prefs] = await Promise.all([
      db.from("household_members").select("id, user_id, is_active, role").eq("household_id", householdId).then(check),
      db.from("user_preferences").select("*").eq("household_id", householdId).then(check),
    ]);
    // De rol is nodig voor de storingsmelding van de afvalkalender (alleen beheerders, W-03)
    const memberRows = members as Pick<MemberRow, "id" | "user_id" | "is_active" | "role">[];
    const prefRows = prefs as PreferencesRow[];

    const recipients: Recipient[] = recipientsFor(message.type, memberRows, prefRows)
      .filter((id) => !only || only.has(id))
      .map((id) => ({
        memberId: id,
        userId: memberRows.find((m) => m.id === id)!.user_id,
        householdId,
        preferences: prefRows.find((p) => p.member_id === id) ?? null,
      }));
    if (!recipients.length) return;

    const inserted = check(
      await db
        .from("notifications")
        .upsert(
          recipients.map((r) => toRow(householdId, r.memberId, message)),
          { onConflict: "member_id,dedupe_key", ignoreDuplicates: true },
        )
        .select("id, member_id"),
    );

    // Alleen pushen naar wie de melding echt nieuw kreeg (dedupe). Een melding
    // zonder dedupe-sleutel botst nooit en komt dus altijd terug.
    const fresh = new Map(inserted.map((n) => [n.member_id, n.id] as const));
    const toDeliver = recipients.filter((r) => fresh.has(r.memberId));

    for (const channel of channelsFor(db)) {
      const targets = toDeliver.filter((r) => channel.isEnabledFor(r));
      if (targets.length) await channel.deliver(targets, message);
    }

    // pushed_at op id, zodat oudere meldingen met dezelfde titel niet geraakt worden (§11.3)
    const ids = toDeliver.map((r) => fresh.get(r.memberId)!);
    if (ids.length) {
      check(await db.from("notifications").update({ pushed_at: new Date().toISOString() }).in("id", ids));
    }
  } catch (error) {
    // Een mislukte melding mag de eigenlijke actie nooit laten falen
    const e = error as { code?: string; name?: string };
    console.error(`[notify] ${message.type} mislukt: ${e?.code ?? e?.name ?? "fout"}`);
  }
}

export function toRow(householdId: string, memberId: string, message: NotificationMessage) {
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
