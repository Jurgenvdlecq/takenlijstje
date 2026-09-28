/**
 * Alles wat de app nodig heeft voor één huishouden, in één keer geladen.
 * Werkt zowel op de server (eerste weergave) als in de browser (verversen).
 * RLS zorgt dat alleen data van het eigen huishouden terugkomt.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, todayIn } from "@/domain/dates";
import type {
  CompletionRow,
  Database,
  HouseholdRow,
  MemberRow,
  NotificationRow,
  PreferencesRow,
  RecurrenceRow,
  ShoppingItemRow,
  ShoppingListRow,
  TaskRow,
  TemplateRow,
} from "@/types/database";

export interface Snapshot {
  household: HouseholdRow;
  me: MemberRow;
  members: MemberRow[];
  preferences: PreferencesRow | null;
  tasks: TaskRow[];
  recurrences: RecurrenceRow[];
  completions: CompletionRow[];
  templates: TemplateRow[];
  shoppingList: ShoppingListRow | null;
  shoppingItems: ShoppingItemRow[];
  notifications: NotificationRow[];
  loadedAt: string;
}

/** Hoeveel dagen terug/vooruit de app taken meeneemt */
export const SNAPSHOT_PAST_DAYS = 42;
export const SNAPSHOT_FUTURE_DAYS = 70;

function unwrap<T>(result: { data: T | null; error: unknown }, fallback: T): T {
  if (result.error) throw result.error;
  return result.data ?? fallback;
}

export async function loadSnapshot(
  db: SupabaseClient<Database>,
  householdId: string,
  memberId: string,
): Promise<Snapshot> {
  const household = unwrap(await db.from("households").select("*").eq("id", householdId).single(), null as unknown as HouseholdRow);
  const today = todayIn(household.timezone);
  const from = addDays(today, -SNAPSHOT_PAST_DAYS);
  const to = addDays(today, SNAPSHOT_FUTURE_DAYS);

  const [members, preferences, tasks, recurrences, completions, templates, lists, notifications] =
    await Promise.all([
      // Alleen leden met een account; leden zonder account vervallen (V-21, BR-46)
      db
        .from("household_members")
        .select("*")
        .eq("household_id", householdId)
        .not("user_id", "is", null)
        .order("sort_order")
        .order("created_at"),
      db.from("user_preferences").select("*").eq("member_id", memberId).maybeSingle(),
      db
        .from("tasks")
        .select("*")
        .eq("household_id", householdId)
        .is("deleted_at", null)
        .lte("scheduled_date", to)
        .or(`scheduled_date.gte.${from},status.in.(todo,in_progress)`)
        .order("scheduled_date")
        .limit(3000),
      db.from("task_recurrences").select("*").eq("household_id", householdId).order("title"),
      db
        .from("task_completions")
        .select("*")
        .eq("household_id", householdId)
        .gte("completed_at", `${from}T00:00:00Z`)
        .order("completed_at", { ascending: false })
        .limit(3000),
      db.from("task_templates").select("*").or(`household_id.is.null,household_id.eq.${householdId}`).order("sort_order"),
      db
        .from("shopping_lists")
        .select("*")
        .eq("household_id", householdId)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(1),
      db.from("notifications").select("*").eq("member_id", memberId).order("created_at", { ascending: false }).limit(60),
    ]);

  const memberRows = unwrap(members, [] as MemberRow[]);
  const me = memberRows.find((m) => m.id === memberId);
  if (!me) throw new Error("Lidmaatschap niet gevonden");
  const shoppingList = unwrap(lists, [] as ShoppingListRow[])[0] ?? null;
  const shoppingItems = shoppingList
    ? unwrap(await db.from("shopping_items").select("*").eq("list_id", shoppingList.id).order("created_at"), [] as ShoppingItemRow[])
    : [];

  return {
    household,
    me,
    members: memberRows,
    preferences: unwrap(preferences, null),
    tasks: unwrap(tasks, [] as TaskRow[]),
    recurrences: unwrap(recurrences, [] as RecurrenceRow[]),
    completions: unwrap(completions, [] as CompletionRow[]),
    templates: unwrap(templates, [] as TemplateRow[]),
    shoppingList,
    shoppingItems,
    notifications: unwrap(notifications, [] as NotificationRow[]),
    loadedAt: new Date().toISOString(),
  };
}
