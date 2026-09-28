import type { NotificationType, PreferencesRow } from "@/types/database";

export { PREFERENCE_FOR_TYPE } from "@/domain/reminders";

export interface NotificationMessage {
  type: NotificationType;
  title: string;
  body?: string | null;
  url?: string | null;
  taskId?: string | null;
  /** Unieke sleutel per ontvanger; voorkomt dubbele meldingen */
  dedupeKey?: string | null;
}

export interface Recipient {
  memberId: string;
  userId: string;
  householdId: string;
  preferences: PreferencesRow | null;
}

/**
 * Een kanaal waarlangs een melding naast de in-app melding wordt bezorgd.
 * Nu: Web Push. Later bijvoorbeeld Firebase Cloud Messaging, e-mail of WhatsApp
 * (zie src/integrations).
 */
export interface NotificationChannel {
  readonly name: string;
  isEnabledFor(recipient: Recipient): boolean;
  deliver(recipients: Recipient[], message: NotificationMessage): Promise<void>;
}
