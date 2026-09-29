import "server-only";

/**
 * Eigendomscontrole voor elke id uit invoer (TECHNICAL_DESIGN §5.1): lezen met
 * de gebruikersclient (RLS) én expliciet op het huishouden uit de sessie.
 */
import { WASTE_TEXT } from "@/domain/waste/messages";
import type { RecurrenceRow, TaskRow } from "@/types/database";
import type { HouseholdContext } from "./context";
import { UserError } from "./errors";

type Ctx = Pick<HouseholdContext, "supabase" | "household">;

export async function loadOwnTask(ctx: Ctx, taskId: string): Promise<TaskRow> {
  const { data } = await ctx.supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("household_id", ctx.household.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) throw new UserError("Taak niet gevonden.", "NOT_FOUND");
  return data as TaskRow;
}

/**
 * Afvaltaken zijn niet te verplaatsen, te wijzigen of te verwijderen (BR-53,
 * §18.5.6). De database weigert ook; dit geeft vooraf een nette fout (T-33).
 */
export function assertNotWasteTask(task: Pick<TaskRow, "waste_direction">): void {
  if (task.waste_direction) throw new UserError(WASTE_TEXT.forbidden, "FORBIDDEN");
}

export async function loadOwnSeries(ctx: Ctx, recurrenceId: string): Promise<RecurrenceRow> {
  const { data } = await ctx.supabase
    .from("task_recurrences")
    .select("*")
    .eq("id", recurrenceId)
    .eq("household_id", ctx.household.id)
    .maybeSingle();
  if (!data) throw new UserError("Terugkerende taak niet gevonden.", "NOT_FOUND");
  return data as RecurrenceRow;
}
