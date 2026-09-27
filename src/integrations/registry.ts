/**
 * Actieve koppelingen. In versie 1 leeg; een koppeling toevoegen =
 * implementatie van een interface uit ./types + hier registreren.
 */
import type { AssistantIntegration, CalendarIntegration, MessagingIntegration, SmartHomeIntegration } from "./types";

export const integrations: {
  calendars: CalendarIntegration[];
  smartHome: SmartHomeIntegration[];
  messaging: MessagingIntegration[];
  assistant: AssistantIntegration | null;
} = {
  calendars: [],
  smartHome: [],
  messaging: [],
  assistant: null,
};
