import type { NotificationType, PreferencesRow } from "@/types/database";

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
  userId: string | null;
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

/** Welke voorkeur bepaalt of iemand een type melding wil ontvangen */
export const PREFERENCE_FOR_TYPE: Record<NotificationType, keyof PreferencesRow> = {
  task_assigned: "notify_task_assigned",
  reminder: "notify_reminders",
  deadline_soon: "notify_deadline_soon",
  overdue: "notify_overdue",
  task_completed: "notify_task_completed",
  daily_summary: "daily_summary_enabled",
  evening_summary: "evening_summary_enabled",
  swap_request: "notify_swap_requests",
  swap_accepted: "notify_swap_requests",
};
