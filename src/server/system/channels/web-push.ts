import "server-only";

import webpush from "web-push";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";
import type { DbClient } from "@/lib/supabase/server";
import { isAllowedPushEndpoint } from "@/lib/push-endpoints";
import { check } from "@/server/errors";
import type { NotificationChannel, NotificationMessage, Recipient } from "@/server/notifications/types";
import type { PushSubscriptionRow as PushSubscriptionTableRow } from "@/types/database";

let configured = false;

/** Per verzoek naar de pushdienst (TECHNICAL_DESIGN §10) */
export const PUSH_TIMEOUT_MS = 10_000;
/** Hoe lang de pushdienst een melding bewaart als het toestel offline is */
const PUSH_TTL_SECONDS = 60 * 60 * 6;
/** Hoeveel pushes tegelijk (§10) */
export const PUSH_CONCURRENCY = 5;

export function isWebPushConfigured(): boolean {
  return Boolean(publicEnv.vapidPublicKey && serverEnv.vapidPrivateKey);
}

function configure(): boolean {
  if (configured) return true;
  if (!isWebPushConfigured()) return false;
  webpush.setVapidDetails(serverEnv.vapidSubject, publicEnv.vapidPublicKey, serverEnv.vapidPrivateKey);
  configured = true;
  return true;
}

export type PushSubscriptionRow = Pick<PushSubscriptionTableRow, "id" | "user_id" | "endpoint" | "p256dh" | "auth">;

export function pushPayload(message: NotificationMessage): string {
  return JSON.stringify({
    title: message.title,
    body: message.body ?? "",
    url: message.url ?? "/",
    tag: message.dedupeKey ?? message.type,
  });
}

/**
 * Stuurt één melding naar één abonnement. Een verlopen of ingetrokken
 * abonnement (404/410) wordt opgeruimd. Geeft terug of het gelukt is.
 */
export async function sendPush(
  db: DbClient,
  sub: PushSubscriptionRow,
  message: NotificationMessage,
  timeout = PUSH_TIMEOUT_MS,
): Promise<boolean> {
  // Alleen de bekende pushdiensten; een ander adres wordt nooit aangeschreven
  if (!isAllowedPushEndpoint(sub.endpoint)) {
    await db.from("push_subscriptions").delete().eq("id", sub.id);
    return false;
  }
  try {
    // Binnen de try: een ongeldige VAPID-sleutel mag de tick niet laten vallen (code-review WP3, punt 9)
    if (!configure()) return false;
    await webpush.sendNotification(
      { endpoint: new URL(sub.endpoint).href, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      pushPayload(message),
      {
        TTL: PUSH_TTL_SECONDS,
        timeout,
        urgency: message.type === "overdue" || message.type === "deadline_soon" ? "high" : "normal",
      },
    );
    await db.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", sub.id);
    return true;
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await db.from("push_subscriptions").delete().eq("id", sub.id);
    } else {
      console.error(`[push] verzenden mislukt (status ${status ?? "onbekend"})`);
    }
    return false;
  }
}

/** Voert taken uit met hooguit `limit` tegelijk; stopt met starten na `deadline` (ms sinds epoch). */
export async function runLimited<T>(items: T[], limit: number, work: (item: T) => Promise<void>, deadline = Infinity): Promise<number> {
  let next = 0;
  let started = 0;
  const worker = async () => {
    while (next < items.length && Date.now() < deadline) {
      const item = items[next++];
      started++;
      await work(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return started;
}

/** Web Push via de service worker (werkt op Android, desktop en iOS 16.4+ als geïnstalleerde app). */
export class WebPushChannel implements NotificationChannel {
  readonly name = "web-push";

  constructor(private readonly db: DbClient) {}

  isEnabledFor(recipient: Recipient): boolean {
    return Boolean(recipient.userId && recipient.preferences?.push_enabled);
  }

  async deliver(recipients: Recipient[], message: NotificationMessage): Promise<void> {
    if (!isWebPushConfigured()) return;
    const userIds = [...new Set(recipients.map((r) => r.userId).filter((id): id is string => !!id))];
    if (!userIds.length) return;

    // check(): een mislukte query komt in de catch van notify en wordt gelogd (code-herreview WP3, N3)
    const subscriptions = check(await this.db.from("push_subscriptions").select("*").in("user_id", userIds));
    if (!subscriptions.length) return;

    await runLimited(subscriptions as PushSubscriptionRow[], PUSH_CONCURRENCY, async (sub) => {
      await sendPush(this.db, sub, message);
    });
  }
}
