/**
 * Vanzelf vervallen van afvaltaken (W-03, BR-54; TECHNICAL_DESIGN §18.8.6).
 * Puur. Vervallen = status "overgeslagen" door het systeem; telt als vergeten.
 */
import type { ISODate } from "../dates";
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
 */
export function findExpiredWasteTasks(tasks: ExpiryWasteTask[], today: ISODate): string[] {
  const outs = tasks.filter((t) => t.waste_direction === "out");
  return tasks
    .filter((t) => isOpen(t) && today > t.waste_pickup_date)
    .filter(
      (t) =>
        t.waste_direction === "out" ||
        outs.some((o) => o.waste_pickup_date > t.waste_pickup_date && o.scheduled_date <= today),
    )
    .map((t) => t.id);
}
