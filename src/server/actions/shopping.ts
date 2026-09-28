"use server";

import { z } from "zod";
import { shoppingItemInput, uuid } from "@/lib/validation";
import type { ShoppingItemRow, ShoppingListRow } from "@/types/database";
import { requireMember } from "../context";
import { check, expectRows, runAction, type ActionResult } from "../errors";
import { parse } from "../parse";
import type { DbClient } from "@/lib/supabase/server";

/**
 * Actieve (niet gearchiveerde) lijst; maakt er een aan als die ontbreekt. De
 * database staat maar één actieve lijst per huishouden toe; verliest deze
 * aanroep de race, dan wordt de lijst van de ander gebruikt.
 */
async function activeList(db: DbClient, householdId: string): Promise<ShoppingListRow> {
  const find = () =>
    db.from("shopping_lists").select("*").eq("household_id", householdId).is("archived_at", null).maybeSingle();
  const { data } = await find();
  if (data) return data as ShoppingListRow;
  const inserted = await db.from("shopping_lists").insert({ household_id: householdId }).select("*").single();
  if (!inserted.error) return inserted.data as ShoppingListRow;
  // Alleen "bestaat al" (race, 23505) opnieuw zoeken; elke andere fout gewoon melden
  if (inserted.error.code !== "23505") throw inserted.error;
  const existing = check(await find()) as ShoppingListRow | null;
  if (!existing) throw inserted.error;
  return existing;
}

export async function addShoppingItemAction(raw: z.input<typeof shoppingItemInput>): Promise<ActionResult<ShoppingItemRow>> {
  return runAction("addShoppingItem", async () => {
    const { supabase, household } = await requireMember();
    const input = parse(shoppingItemInput, raw);
    const list = await activeList(supabase, household.id);
    const row = {
      ...(input.id ? { id: input.id } : {}),
      household_id: household.id,
      list_id: list.id,
      name: input.name,
      quantity: input.quantity,
      category: input.category,
      note: input.note,
    };
    // Idempotent: offline toegevoegd item met dezelfde id wordt niet dubbel aangemaakt
    const { data, error } = await supabase.from("shopping_items").upsert(row, { onConflict: "id", ignoreDuplicates: true }).select("*");
    if (error) throw error;
    return (data?.[0] ?? check(await supabase.from("shopping_items").select("*").eq("id", input.id!).single())) as ShoppingItemRow;
  });
}

export async function toggleShoppingItemAction(itemId: string, bought: boolean): Promise<ActionResult<true>> {
  return runAction("toggleShoppingItem", async () => {
    const { supabase, household } = await requireMember();
    expectRows(
      await supabase
        .from("shopping_items")
        .update({
          is_bought: parse(z.boolean(), bought),
          bought_at: bought ? new Date().toISOString() : null,
        })
        .eq("id", parse(uuid, itemId))
        .eq("household_id", household.id)
        .select("id"),
      "Dit product staat niet meer op de lijst.",
      "NOT_FOUND",
    );
    return true as const;
  });
}

export async function updateShoppingItemAction(
  itemId: string,
  raw: Partial<z.input<typeof shoppingItemInput>>,
): Promise<ActionResult<true>> {
  return runAction("updateShoppingItem", async () => {
    const { supabase, household } = await requireMember();
    const input = parse(shoppingItemInput.partial(), raw);
    expectRows(
      await supabase
        .from("shopping_items")
        .update({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.quantity !== undefined && { quantity: input.quantity }),
          ...(input.category !== undefined && { category: input.category }),
          ...(input.note !== undefined && { note: input.note }),
        })
        .eq("id", parse(uuid, itemId))
        .eq("household_id", household.id)
        .select("id"),
      "Dit product staat niet meer op de lijst.",
      "NOT_FOUND",
    );
    return true as const;
  });
}

export async function deleteShoppingItemAction(itemId: string): Promise<ActionResult<true>> {
  return runAction("deleteShoppingItem", async () => {
    const { supabase, household } = await requireMember();
    expectRows(
      await supabase.from("shopping_items").delete().eq("id", parse(uuid, itemId)).eq("household_id", household.id).select("id"),
      "Dit product staat niet meer op de lijst.",
      "NOT_FOUND",
    );
    return true as const;
  });
}

/**
 * Lijst afronden: de database archiveert alleen als `listId` nog de actieve
 * lijst is, maakt een nieuwe lijst en verplaatst de niet-gekochte producten, in
 * één transactie. Dubbel versturen geeft dezelfde nieuwe lijst (R-03).
 */
export async function archiveShoppingListAction(listId: string): Promise<ActionResult<ShoppingListRow>> {
  return runAction("archiveShoppingList", async () => {
    const { supabase } = await requireMember();
    return check(await supabase.rpc("archive_shopping_list", { p_list_id: parse(uuid, listId) })) as ShoppingListRow;
  });
}

/** "Lijst afgerond · Ongedaan maken" (UX §4.8) */
export async function unarchiveShoppingListAction(archivedListId: string): Promise<ActionResult<ShoppingListRow>> {
  return runAction("unarchiveShoppingList", async () => {
    const { supabase } = await requireMember();
    return check(
      await supabase.rpc("unarchive_shopping_list", { p_archived_list_id: parse(uuid, archivedListId) }),
    ) as ShoppingListRow;
  });
}
