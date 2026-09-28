import "server-only";

/** Geheime omgevingsvariabelen – alleen op de server beschikbaar. */
export const serverEnv = {
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  vapidSubject: process.env.VAPID_SUBJECT ?? "mailto:beheer@example.com",
  cronSecret: process.env.CRON_SECRET ?? "",
};
