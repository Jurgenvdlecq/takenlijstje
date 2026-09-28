import "server-only";

/**
 * Eigendomscontrole voor elke id uit invoer (TECHNICAL_DESIGN §5.1): lezen met
 * de gebruikersclient (RLS) én expliciet op het huishouden uit de sessie.
 */
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
