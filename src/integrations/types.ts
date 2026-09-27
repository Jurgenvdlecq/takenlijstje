/**
 * Uitbreidingspunten voor latere koppelingen (nog niet actief in versie 1).
 *
 * De kern van de app (src/domain, src/server/services) kent alleen deze
 * interfaces. Een koppeling implementeert er één en wordt geregistreerd in
 * src/integrations/registry.ts. Zo kan bijvoorbeeld Google Calendar, Home
 * Assistant of WhatsApp worden toegevoegd zonder de kern aan te passen.
 */
import type { NotificationMessage } from "@/server/notifications/types";
import type { TaskRow } from "@/types/database";

/** Agenda's: Google Calendar, Apple Calendar (CalDAV/iCal-feed), Outlook (Microsoft Graph) */
export interface CalendarIntegration {
  readonly id: "google-calendar" | "apple-calendar" | "outlook" | (string & {});
  /** Taak aanmaken/bijwerken als agenda-item */
  upsertEvent(task: TaskRow, context: { timeZone: string }): Promise<{ externalId: string }>;
  removeEvent(externalId: string): Promise<void>;
}

/** Slimme huizen en spraakassistenten: Home Assistant, Homey, Alexa, Google Home, Siri */
export interface SmartHomeIntegration {
  readonly id: "home-assistant" | "homey" | "alexa" | "google-home" | "siri" | (string & {});
  /** Gebeurtenis doorgeven, bijv. "taak voltooid" → lampje groen */
  emit(event: { type: "task_completed" | "task_overdue" | "daily_summary"; householdId: string; payload: unknown }): Promise<void>;
}

/** Extra meldingskanalen naast in-app en Web Push: e-mail, WhatsApp, Firebase Cloud Messaging */
export interface MessagingIntegration {
  readonly id: "email" | "whatsapp" | "fcm" | (string & {});
  send(recipient: { memberId: string; email?: string | null; phone?: string | null }, message: NotificationMessage): Promise<void>;
}

/**
 * AI-functies (later): taakvoorstellen, slimme planning en een huishoudassistent.
 * Een assistent vertaalt vragen naar acties; die acties lopen altijd via de
 * bestaande server actions, zodat validatie en rechten gelijk blijven.
 */
export interface AssistantIntegration {
  readonly id: string;
  /** "Wat moet er vandaag nog gebeuren?" → antwoord + voorgestelde acties */
  ask(question: string, context: { householdId: string; memberId: string }): Promise<{
    answer: string;
    actions: AssistantAction[];
  }>;
}

export type AssistantAction =
  | { kind: "move_tasks"; taskIds: string[]; toDate: string }
  | { kind: "assign_task"; taskId: string; memberId: string | null }
  | { kind: "create_task"; title: string; date: string; memberId?: string | null }
  | { kind: "suggest_recurrence"; title: string; everyDays: number };
