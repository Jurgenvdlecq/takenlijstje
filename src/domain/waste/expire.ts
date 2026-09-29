/**
 * Vanzelf vervallen van vergeten afvaltaken (BR-54, AC-210; TECHNICAL_DESIGN
 * §18.8.6). Puur.
 */
import { addDays, type ISODate } from "@/domain/dates";
import type { WasteDirection } from "./messages";
import type { WasteTaskStatus } from "./plan";

/** Binnenzetten vervalt uiterlijk aan het begin van D+7 */
export const WASTE_IN_EXPIRE_DAYS = 7;

export interface ExpiryTask {
  id: string;
  pickupDate: ISODate;
  direction: WasteDirection;
  status: WasteTaskStatus;
}

/**
 * Welke open afvaltaken vervallen vandaag?
 * - buitenzetten: vandaag > D;
 * - binnenzetten: vandaag > D en (de volgende buitenzet-taak is begonnen, of vandaag ≥ D+7).
 * `tasks` bevat ook de buitenzet-taken van latere dagen (elke status).
 */
export function findExpiredWasteTasks(tasks: ExpiryTask[], today: ISODate): string[] {
  const outStarts = tasks.filter((t) => t.direction === "out").map((t) => ({ day: t.pickupDate, start: addDays(t.pickupDate, -1) }));
  const expired: string[] = [];
  for (const task of tasks) {
    if (task.status !== "todo" && task.status !== "in_progress") continue;
    if (today <= task.pickupDate) continue;
    if (task.direction === "out") {
      expired.push(task.id);
      continue;
    }
    const nextOutStarted = outStarts.some((o) => o.day > task.pickupDate && o.start <= today);
    if (nextOutStarted || today >= addDays(task.pickupDate, WASTE_IN_EXPIRE_DAYS)) expired.push(task.id);
  }
  return expired;
}
