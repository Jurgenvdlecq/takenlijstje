/**
 * Weergave van afvaltaken in lijsten (W-03; UX_SPEC §13.4). Puur. In de rij staat
 * nooit "21:00": dat is alleen het herinneringsmoment.
 */
import { addDays, todayIn, type ISODate } from "../dates";

export interface WasteViewTask {
  status: "todo" | "in_progress" | "done" | "skipped";
  waste_direction: "out" | "in" | null;
  waste_pickup_date: ISODate | null;
  scheduled_date: ISODate;
  available_from: string | null;
  due_at: string | null;
}

function isOpen(task: { status: string }): boolean {
  return task.status === "todo" || task.status === "in_progress";
}

/** "vanaf 22:00" (avond ervoor), "vóór 07:45" (ophaaldag, vóór de deadline), "vanaf 12:00" (binnenzetten vóór 12:00) */
export function wasteTimeLabel(task: WasteViewTask, now: Date, timeZone: string): string | null {
  if (!task.waste_direction || !task.waste_pickup_date || !isOpen(task)) return null;
  if (task.waste_direction === "out") {
    if (task.due_at && now.getTime() >= new Date(task.due_at).getTime()) return null;
    return todayIn(timeZone, now) < task.waste_pickup_date ? "vanaf 22:00" : "vóór 07:45";
  }
  if (task.available_from && now.getTime() < new Date(task.available_from).getTime()) return "vanaf 12:00";
  return null;
}

/**
 * Hoort deze afvaltaak vandaag onder "Vandaag"? Buitenzetten blijft op de
 * ophaaldag tot 07:45 staan (daarna Verlopen); binnenzetten pas vanaf 12:00
 * (daarvóór onder Binnenkort).
 */
export function wasteOnToday(task: WasteViewTask, now: Date, timeZone: string): boolean {
  const today = todayIn(timeZone, now);
  if (task.waste_direction === "out") {
    return task.scheduled_date === today || (task.waste_pickup_date === today && isOpen(task));
  }
  return task.scheduled_date === today && !wasteWaitingToday(task, now, timeZone);
}

/** Binnenzetten van vandaag dat pas vanaf 12:00 kan: onder Binnenkort, bovenaan */
export function wasteWaitingToday(task: WasteViewTask, now: Date, timeZone: string): boolean {
  return (
    task.waste_direction === "in" &&
    task.scheduled_date === todayIn(timeZone, now) &&
    isOpen(task) &&
    !!task.available_from &&
    now.getTime() < new Date(task.available_from).getTime()
  );
}

/** Dag vóór de ophaaldag (voor de infolijst van buitenzetten) */
export function eveningBefore(pickupDate: ISODate): ISODate {
  return addDays(pickupDate, -1);
}
