"use server";

import { z } from "zod";
import { shoppingItemInput, uuid } from "@/lib/validation";
import type { ShoppingItemRow, ShoppingListRow } from "@/types/database";
import { requireMember } from "../context";
import { check, runAction, type ActionResult } from "../errors";
import { parse } from "../parse";
import type { DbClient } from "@/lib/supabase/server";

/** Actieve (niet gearchiveerde) lijst; maakt er een aan als die ontbreekt. */
async function activeList(db: DbClient, householdId: string, memberId: string): Promise<ShoppingListRow> {
  const { data } = await db
    .from("shopping_lists")
    .select("*")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data) return data as ShoppingListRow;
  return check(
    await db.from("shopping_lists").insert({ household_id: householdId, created_by_member_id: memberId }).select("*").single(),
  ) as ShoppingListRow;
}

export async function addShoppingItemAction(raw: z.input<typeof shoppingItemInput>): Promise<ActionResult<ShoppingItemRow>> {
  return runAction("addShoppingItem", async () => {
    const { supabase, household, member } = await requireMember();
    const input = parse(shoppingItemInput, raw);
    const list = await activeList(supabase, household.id, member.id);
    const row = {
      ...(input.id ? { id: input.id } : {}),
      household_id: household.id,
      list_id: list.id,
      name: input.name,
      quantity: input.quantity,
      category: input.category,
      note: input.note,
      added_by_member_id: member.id,
    };
    // Idempotent: offline toegevoegd item met dezelfde id wordt niet dubbel aangemaakt
    const { data, error } = await supabase.from("shopping_items").upsert(row, { onConflict: "id", ignoreDuplicates: true }).select("*");
    if (error) throw error;
    return (data?.[0] ?? check(await supabase.from("shopping_items").select("*").eq("id", input.id!).single())) as ShoppingItemRow;
  });
}

export async function toggleShoppingItemAction(itemId: string, bought: boolean): Promise<ActionResult<null>> {
  return runAction("toggleShoppingItem", async () => {
    const { supabase, household, member } = await requireMember();
    check(
      await supabase
        .from("shopping_items")
        .update({
          is_bought: parse(z.boolean(), bought),
          bought_at: bought ? new Date().toISOString() : null,
          bought_by_member_id: bought ? member.id : null,
        })
        .eq("id", parse(uuid, itemId))
        .eq("household_id", household.id),
    );
    return null;
  });
}

export async function updateShoppingItemAction(
  itemId: string,
  raw: Partial<z.input<typeof shoppingItemInput>>,
): Promise<ActionResult<null>> {
  return runAction("updateShoppingItem", async () => {
    const { supabase, household } = await requireMember();
    const input = parse(shoppingItemInput.partial(), raw);
    check(
      await supabase
        .from("shopping_items")
        .update({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.quantity !== undefined && { quantity: input.quantity }),
          ...(input.category !== undefined && { category: input.category }),
          ...(input.note !== undefined && { note: input.note }),
        })
        .eq("id", parse(uuid, itemId))
        .eq("household_id", household.id),
    );
    return null;
  });
}

export async function deleteShoppingItemAction(itemId: string): Promise<ActionResult<null>> {
  return runAction("deleteShoppingItem", async () => {
    const { supabase, household } = await requireMember();
    check(await supabase.from("shopping_items").delete().eq("id", parse(uuid, itemId)).eq("household_id", household.id));
    return null;
  });
}

/** Lijst archiveren; nog niet gekochte items gaan mee naar de nieuwe lijst. */
export async function archiveShoppingListAction(): Promise<ActionResult<ShoppingListRow>> {
  return runAction("archiveShoppingList", async () => {
    const { supabase, household, member } = await requireMember();
    const current = await activeList(supabase, household.id, member.id);
    const next = check(
      await supabase.from("shopping_lists").insert({ household_id: household.id, created_by_member_id: member.id }).select("*").single(),
    ) as ShoppingListRow;
    check(
      await supabase
        .from("shopping_items")
        .update({ list_id: next.id })
        .eq("list_id", current.id)
        .eq("household_id", household.id)
        .eq("is_bought", false),
    );
    check(await supabase.from("shopping_lists").update({ archived_at: new Date().toISOString() }).eq("id", current.id));
    return next;
  });
}
