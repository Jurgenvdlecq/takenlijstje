import "server-only";

import webpush from "web-push";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";
import type { DbClient } from "@/lib/supabase/server";
import type { NotificationChannel, NotificationMessage, Recipient } from "@/server/notifications/types";

let configured = false;

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

/** Web Push via de service worker (werkt op Android, desktop en iOS 16.4+ als geïnstalleerde app). */
export class WebPushChannel implements NotificationChannel {
  readonly name = "web-push";

  constructor(private readonly db: DbClient) {}

  isEnabledFor(recipient: Recipient): boolean {
    return Boolean(recipient.userId && recipient.preferences?.push_enabled);
  }

  async deliver(recipients: Recipient[], message: NotificationMessage): Promise<void> {
    if (!configure()) return;
    const userIds = [...new Set(recipients.map((r) => r.userId).filter((id): id is string => !!id))];
    if (!userIds.length) return;

    const { data: subscriptions } = await this.db.from("push_subscriptions").select("*").in("user_id", userIds);
    if (!subscriptions?.length) return;

    const payload = JSON.stringify({
      title: message.title,
      body: message.body ?? "",
      url: message.url ?? "/",
      tag: message.dedupeKey ?? message.type,
    });

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 60 * 60 * 6, urgency: message.type === "overdue" || message.type === "deadline_soon" ? "high" : "normal" },
          );
          await this.db.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", sub.id);
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          // Abonnement verlopen of ingetrokken → opruimen
          if (status === 404 || status === 410) {
            await this.db.from("push_subscriptions").delete().eq("id", sub.id);
          } else {
            console.error(`[push] verzenden mislukt (status ${status ?? "onbekend"})`);
          }
        }
      }),
    );
  }
}
