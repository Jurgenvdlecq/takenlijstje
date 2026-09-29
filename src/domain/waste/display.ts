/**
 * Hoe een afvaltaak in lijsten en kalender verschijnt (UX §13.4, §13.13.1).
 * Er staat nooit "21:00" in een rij of kalendervak. Puur.
 */
import { addDays, zonedDate, zonedInstant } from "@/domain/dates";
import { WASTE_TEXT, type WasteDirection } from "./messages";
import { WASTE_IN_FROM, WASTE_OUT_DEADLINE } from "./plan";

export interface WasteTaskLike {
  waste_direction: WasteDirection | null;
  waste_pickup_date: string | null;
}

export function isWasteTask(task: WasteTaskLike): task is WasteTaskLike & { waste_direction: WasteDirection; waste_pickup_date: string } {
  return Boolean(task.waste_direction && task.waste_pickup_date);
}

/** Rechterkolom in de lijst: T-16 op D−1, T-17 op D vóór 07:45, T-18 op D vóór 12:00; anders niets */
export function wasteListTime(task: WasteTaskLike, now: Date, timeZone: string): string | null {
  if (!isWasteTask(task)) return null;
  const today = zonedDate(now, timeZone);
  const pickup = task.waste_pickup_date;
  if (task.waste_direction === "out") {
    // Op D−1 "vanaf 22:00"; eerder staat alleen de dag (Binnenkort)
    if (today === addDays(pickup, -1)) return WASTE_TEXT.outFrom;
    if (today === pickup && now.getTime() < new Date(zonedInstant(pickup, WASTE_OUT_DEADLINE, timeZone)).getTime()) {
      return WASTE_TEXT.outBefore;
    }
    return null;
  }
  if (today === pickup && now.getTime() < new Date(zonedInstant(pickup, WASTE_IN_FROM, timeZone)).getTime()) {
    return WASTE_TEXT.inFrom;
  }
  return null;
}

/** Kalender (planning, los van nu): buiten "vanaf 22:00", binnen "vanaf 12:00" */
export function wasteCalendarTime(direction: WasteDirection): string {
  return direction === "out" ? WASTE_TEXT.outFrom : WASTE_TEXT.inFrom;
}
