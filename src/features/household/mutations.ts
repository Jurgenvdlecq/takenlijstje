"use client";

/**
 * Acties die direct (optimistisch) in de interface worden getoond en – als
 * `offline: true` – ook zonder internet kunnen worden uitgevoerd. Ze komen dan
 * in de wachtrij en worden later verstuurd.
 */
import type { Snapshot } from "@/lib/data/snapshot";
import { postOutbox, type SendOutcome } from "@/lib/offline/send";
import type { ShoppingCategory, TaskStatus } from "@/types/database";

export interface MutationContext {
  meId: string;
  now: string;
}

interface MutationDef<P> {
  offline: boolean;
  optimistic: (s: Snapshot, payload: P, ctx: MutationContext) => Snapshot;
  /** Versturen via het stabiele endpoint POST /api/outbox (§9.3.1) */
  send: (payload: P) => Promise<SendOutcome>;
}

function patchTask(s: Snapshot, taskId: string, patch: Partial<Snapshot["tasks"][number]>): Snapshot {
  return { ...s, tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) };
}

/**
 * Buitenzetten overslaan neemt binnenzetten van dezelfde ophaaldag mee, en
 * terugzetten zet het weer terug (BR-53, AC-209). Zelfde regel als de trigger
 * in de database, zodat de lijst direct klopt, ook offline.
 */
function wasteSkipCascade(next: Snapshot, before: Snapshot, taskId: string, status: TaskStatus): Snapshot {
  const out = before.tasks.find((t) => t.id === taskId);
  if (!out || out.waste_direction !== "out" || !out.waste_pickup_date) return next;
  const sameDayIn = (t: Snapshot["tasks"][number]) =>
    t.household_id === out.household_id && t.waste_direction === "in" && t.waste_pickup_date === out.waste_pickup_date;
  if (status === "skipped") {
    return {
      ...next,
      tasks: next.tasks.map((t) => (sameDayIn(t) && (t.status === "todo" || t.status === "in_progress") ? { ...t, status: "skipped" } : t)),
    };
  }
  if (status === "todo" && out.status === "skipped") {
    return { ...next, tasks: next.tasks.map((t) => (sameDayIn(t) && t.status === "skipped" ? { ...t, status: "todo" } : t)) };
  }
  return next;
}

export const mutations = {
  complete: {
    offline: true,
    optimistic: (s, p) => {
      const task = s.tasks.find((t) => t.id === p.taskId);
      if (!task) return s;
      const next = patchTask(s, p.taskId, { status: "done", completed_at: p.completedAt });
      return {
        ...next,
        completions: [
          {
            id: p.mutationId,
            household_id: task.household_id,
            task_id: task.id,
            recurrence_id: task.recurrence_id,
            title: task.title,
            category: task.category,
            completed_at: p.completedAt,
            scheduled_date: task.scheduled_date,
            due_at: task.due_at,
            was_late: !!task.due_at && p.completedAt > task.due_at,
            minutes_late: 0,
            duration_minutes: task.duration_minutes,
            note: p.note ?? null,
            client_mutation_id: p.mutationId,
            created_at: p.completedAt,
          },
          ...next.completions,
        ],
      };
    },
    send: (p) => postOutbox("complete", p),
  } satisfies MutationDef<{ taskId: string; mutationId: string; completedAt: string; note?: string | null }>,

  undo: {
    offline: true,
    optimistic: (s, p) => ({
      ...patchTask(s, p.taskId, { status: "todo", completed_at: null }),
      completions: removeLatestCompletion(s.completions, p.taskId),
    }),
    send: (p) => postOutbox("undo", p),
  } satisfies MutationDef<{ taskId: string }>,

  setStatus: {
    offline: true,
    optimistic: (s, p) => wasteSkipCascade(patchTask(s, p.taskId, { status: p.status }), s, p.taskId, p.status),
    send: (p) => postOutbox("setStatus", p),
  } satisfies MutationDef<{ taskId: string; status: Exclude<TaskStatus, "done"> }>,

  move: {
    offline: true,
    optimistic: (s, p) => patchTask(s, p.taskId, { scheduled_date: p.date }),
    send: (p) => postOutbox("move", p),
  } satisfies MutationDef<{ taskId: string; date: string }>,

  shoppingAdd: {
    offline: true,
    optimistic: (s, p, ctx) =>
      s.shoppingItems.some((i) => i.id === p.id) || !s.shoppingList
        ? s
        : {
            ...s,
            shoppingItems: [
              ...s.shoppingItems,
              {
                id: p.id,
                household_id: s.household.id,
                list_id: s.shoppingList.id,
                name: p.name,
                quantity: p.quantity ?? null,
                category: p.category,
                note: p.note ?? null,
                is_bought: false,
                bought_at: null,
                created_at: ctx.now,
              },
            ],
          },
    send: (p) => postOutbox("shoppingAdd", p),
  } satisfies MutationDef<{ id: string; name: string; quantity?: string | null; category: ShoppingCategory; note?: string | null }>,

  shoppingToggle: {
    offline: true,
    optimistic: (s, p, ctx) => ({
      ...s,
      shoppingItems: s.shoppingItems.map((i) =>
        i.id === p.id
          ? { ...i, is_bought: p.bought, bought_at: p.bought ? ctx.now : null }
          : i,
      ),
    }),
    send: (p) => postOutbox("shoppingToggle", p),
  } satisfies MutationDef<{ id: string; bought: boolean }>,

  shoppingDelete: {
    offline: true,
    optimistic: (s, p) => ({ ...s, shoppingItems: s.shoppingItems.filter((i) => i.id !== p.id) }),
    send: (p) => postOutbox("shoppingDelete", p),
  } satisfies MutationDef<{ id: string }>,

  markRead: {
    offline: true,
    optimistic: (s, p, ctx) => ({
      ...s,
      notifications: s.notifications.map((n) =>
        !n.read_at && (!p.ids || p.ids.includes(n.id)) ? { ...n, read_at: ctx.now } : n,
      ),
    }),
    send: (p) => postOutbox("markRead", p),
  } satisfies MutationDef<{ ids?: string[] }>,
};

export type Mutations = typeof mutations;
export type MutationKind = keyof Mutations;
export type MutationPayload<K extends MutationKind> = Parameters<Mutations[K]["send"]>[0];

function removeLatestCompletion(completions: Snapshot["completions"], taskId: string): Snapshot["completions"] {
  const index = completions.findIndex((c) => c.task_id === taskId);
  return index === -1 ? completions : completions.filter((_, i) => i !== index);
}

/** Pas een mutatie optimistisch toe (generiek, type-veilig per soort). */
export function applyOptimistic(s: Snapshot, kind: string, payload: unknown, ctx: MutationContext): Snapshot {
  // Een wachtrij-item van een soort die niet meer bestaat, verandert de weergave niet
  if (!(kind in mutations)) return s;
  const def = mutations[kind as MutationKind] as MutationDef<unknown>;
  return def.optimistic(s, payload, ctx);
}

/** Versturen; `v` is de versie van een wachtrij-item (ontbreekt = versie 0 van vóór WP1). */
export function sendMutation(kind: string, payload: unknown, v?: number): Promise<SendOutcome> {
  if (v !== undefined || !(kind in mutations)) return postOutbox(kind, payload, v ?? 0);
  return (mutations[kind as MutationKind] as MutationDef<unknown>).send(payload);
}

export function isOfflineCapable(kind: MutationKind): boolean {
  return mutations[kind]?.offline ?? false;
}
