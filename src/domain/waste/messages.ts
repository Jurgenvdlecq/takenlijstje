/**
 * Vaste teksten en meldingen van de afvalkalender (UX_SPEC §13.10,
 * TECHNICAL_DESIGN §18.9). Nooit een adres, straat of naam (BR-58, AC-212):
 * alleen de bak en de dag.
 */
import { addDays, zonedInstant, type ISODate } from "../dates";
import type { DueMessage } from "../reminders";

export type WasteDirection = "out" | "in";

export const WASTE_OUT_DESCRIPTION = "Mag vanaf 22:00 buiten, uiterlijk 07:45.";
export const WASTE_IN_DESCRIPTION = "Binnenzetten vanaf 12:00, uiterlijk vandaag.";
export const WASTE_EXPLANATION =
  "De ophaaldag komt uit de afvalkalender van de gemeente. Daarom kun je deze taak niet verplaatsen, wijzigen of verwijderen. Verschuift de gemeente de dag, dan schuift de taak vanzelf mee.";
/** Instellingen › Afvalkalender in de huidige schermen (§18.9.3) */
export const WASTE_SETTINGS_URL = "/instellingen#afvalkalender";
export const WASTE_FAILURE_TITLE = "De afvalkalender kon niet worden bijgewerkt";

/** Grens zoals bij gewone herinneringen (BR-31) */
const GRACE_MINUTES = 90;

/** Herinneringsmoment: buitenzetten (D−1) 21:00, binnenzetten D 18:00 */
export function wasteReminderAnchor(direction: WasteDirection, pickupDate: ISODate, timeZone: string): string {
  return direction === "out" ? zonedInstant(addDays(pickupDate, -1), "21:00", timeZone) : zonedInstant(pickupDate, "18:00", timeZone);
}

export interface WasteReminderTask {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done" | "skipped";
  waste_direction: WasteDirection;
  waste_pickup_date: ISODate;
  waste_streams: string[];
}

/**
 * De herinnering voor een afvaltaak (BR-55, V-48, V-49). Vervangt voor
 * afvaltaken de gewone taakmeldingen helemaal: nooit "deadline nadert" of
 * "verlopen" (V-50). Alleen voor een open taak, binnen 90 minuten na het anker.
 */
export function wasteReminder(task: WasteReminderTask, now: Date, timeZone: string): DueMessage[] {
  if (task.status !== "todo" && task.status !== "in_progress") return [];
  const anchor = wasteReminderAnchor(task.waste_direction, task.waste_pickup_date, timeZone);
  const minutesSince = (now.getTime() - new Date(anchor).getTime()) / 60_000;
  if (minutesSince < 0 || minutesSince >= GRACE_MINUTES) return [];
  const body =
    task.waste_direction === "out"
      ? "Morgen ophaaldag. Mag vanaf 22:00 buiten, uiterlijk morgen 07:45."
      : `Vandaag was de ophaaldag. Zet ${task.waste_streams.length > 1 ? "de bakken" : "de bak"} vandaag nog binnen.`;
  return [
    {
      type: "reminder",
      title: `Herinnering: ${task.title}`,
      body,
      taskId: task.id,
      // Op richting en dag, niet op taak-id: een opnieuw aangemaakte taak geeft geen tweede herinnering
      dedupeKey: `waste:${task.waste_direction}:${task.waste_pickup_date}:${anchor}`,
    },
  ];
}

/** "za 26 sep" */
export function shortDay(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short", timeZone }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((p) => p.type === type)?.value.replace(".", "") ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")}`;
}

/** De storingsmelding voor beheerders (BR-52, AC-205): één per storing. */
export function wasteFailureMessage(
  reason: "stale" | "empty",
  lastSuccessAt: string,
  timeZone: string,
): { title: string; body: string; dedupeKey: string } {
  const body =
    reason === "empty"
      ? "De gemeente geeft voor de komende twee weken geen ophaaldagen. Soms staat de nieuwe kalender nog niet online. Kijk zelf op huisvuilkalender.denhaag.nl."
      : `Laatst gelukt op ${shortDay(lastSuccessAt, timeZone)}. Nieuwe ophaaldagen komen er pas bij als het weer lukt. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl.`;
  return { title: WASTE_FAILURE_TITLE, body, dedupeKey: `waste-failed:${new Date(lastSuccessAt).toISOString()}` };
}
