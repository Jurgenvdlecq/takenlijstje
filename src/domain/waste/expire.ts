/**
 * Vanzelf vervallen van afvaltaken (W-03, BR-54; TECHNICAL_DESIGN §18.8.6).
 * Puur. Vervallen = status "overgeslagen" door het systeem; telt als vergeten.
 */
import { addDays, type ISODate } from "../dates";
import type { ExistingWasteTask } from "./plan";

export interface ExpiryWasteTask extends ExistingWasteTask {
  scheduled_date: ISODate;
}

function isOpen(task: { status: string }): boolean {
  return task.status === "todo" || task.status === "in_progress";
}

/**
 *  - buitenzetten: open en de ophaaldag is voorbij;
 *  - binnenzetten: open, de ophaaldag is voorbij (dus al verlopen) én de dag van
 *    de volgende buitenzet-taak is begonnen. "Al verlopen" voorkomt dat
 *    binnenzetten bij twee opeenvolgende ophaaldagen al op de ophaaldag vervalt.
 * De volgende buitenzet-dag komt uit de bestaande taken én uit de bekende
 * ophaaldagen (`pickupDates`, alle bakken): ook als die taak (nog) niet bestaat,
 * bijv. bij meer dan 14 dagen tussen twee ophaaldagen (code-review W-03).
 */
export function findExpiredWasteTasks(tasks: ExpiryWasteTask[], today: ISODate, pickupDates: ISODate[] = []): string[] {
  const nextOutDays = [
    ...tasks.filter((t) => t.waste_direction === "out").map((o) => ({ pickup: o.waste_pickup_date, day: o.scheduled_date })),
    ...pickupDates.map((d) => ({ pickup: d, day: addDays(d, -1) })),
  ];
  return tasks
    .filter((t) => isOpen(t) && today > t.waste_pickup_date)
    .filter((t) => t.waste_direction === "out" || nextOutDays.some((o) => o.pickup > t.waste_pickup_date && o.day <= today))
    .map((t) => t.id);
}
