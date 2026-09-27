/**
 * Deadline-venster van een uitvoering.
 *
 * Voorbeeld "Badkamer schoonmaken":
 *   gepland op zaterdag, available_days_before = 1, due_days_after = 1, due_time = 18:00
 *   → beschikbaar vanaf vrijdag 00:00, bij voorkeur zaterdag, uiterlijk zondag 18:00
 */
import { addDays, zonedDate, zonedInstant, zonedTime, type ISODate } from "../dates";

export interface WindowSettings {
  timeOfDay?: string | null;
  availableDaysBefore?: number;
  dueDaysAfter?: number;
  dueTime?: string | null;
}

export interface TaskWindow {
  scheduledDate: ISODate;
  scheduledTime: string | null;
  availableFrom: string;
  dueAt: string;
}

export const END_OF_DAY = "23:59";

export function computeWindow(date: ISODate, settings: WindowSettings, timeZone: string): TaskWindow {
  const before = settings.availableDaysBefore ?? 0;
  const after = settings.dueDaysAfter ?? 0;
  const dueDate = addDays(date, after);

  // Zonder expliciete deadline: einde van de deadline-dag.
  let dueTime = settings.dueTime ?? END_OF_DAY;
  // Een deadline op dezelfde dag vóór het geplande tijdstip is onlogisch → einde dag.
  if (after === 0 && settings.dueTime && settings.timeOfDay && settings.dueTime < settings.timeOfDay) {
    dueTime = END_OF_DAY;
  }

  return {
    scheduledDate: date,
    scheduledTime: settings.timeOfDay ?? null,
    availableFrom: zonedInstant(addDays(date, -before), "00:00", timeZone),
    dueAt: zonedInstant(dueDate, dueTime, timeZone),
  };
}

/** Schuift een tijdstip een aantal kalenderdagen op, met behoud van de lokale kloktijd (zomertijd-veilig). */
export function shiftInstant(iso: string | null, days: number, timeZone: string): string | null {
  if (!iso) return null;
  const date = zonedDate(iso, timeZone);
  const { hour, minute } = zonedTime(iso, timeZone);
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return zonedInstant(addDays(date, days), time, timeZone);
}
