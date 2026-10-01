import "server-only";

import { UserError } from "../errors";

export const WASTE_TASK_LOCKED = "Een afvaltaak kun je niet wijzigen, verplaatsen of verwijderen.";

/**
 * Vroeg weigeren in de taakacties (TECHNICAL_DESIGN §18.5.6): een nette fout en
 * geen half uitgevoerde actie (bijv. een reeks zonder taak bij "wordt
 * terugkerend"). De database (guard, policies, delete_task) blijft de grens.
 */
export function assertNotWasteTask(task: { waste_direction?: string | null }): void {
  if (task.waste_direction != null) throw new UserError(WASTE_TASK_LOCKED, "FORBIDDEN");
}
