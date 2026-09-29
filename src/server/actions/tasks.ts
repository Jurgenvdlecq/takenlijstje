"use server";

/**
 * Server actions voor taken. Iedere action volgt het vaste patroon
 * (TECHNICAL_DESIGN §5.1):
 *  1. actief lid en huishouden uit de sessie (requireMember)
 *  2. invoer valideren met zod
 *  3. elke id uit de invoer op eigendom toetsen (loadOwn*)
 *  4. schrijven met de gebruikersclient (RLS + expectRows) of een RPC met
 *     eigen rechtencheck; het systeem voegt daarna alleen planning in
 */
import { addDays, diffDays, zonedDate, zonedInstant, zonedTime } from "@/domain/dates";
import { END_OF_DAY, shiftInstant } from "@/domain/recurrence/window";
import {
  commentInput,
  completeInput,
  pauseInput,
  taskInput,
  taskUpdateInput,
  updateScope,
  uuid,
  isoDate,
  type TaskInput,
  type TaskUpdateInput,
} from "@/lib/validation";
import type { CompletionRow, RecurrenceRow, TaskRow, TaskStatus } from "@/types/database";
import { after } from "next/server";
import { z } from "zod";
import { requireMember } from "../context";
import { check, expectRows, runAction, UserError, type ActionResult } from "../errors";
import { loadOwnSeries, loadOwnTask } from "../guards";
import { parse } from "../parse";
import { createTask as createTaskService } from "../services/tasks";
import { notify } from "../system/dispatcher";
import { topUp } from "../system/planner";

export async function createTaskAction(raw: TaskInput): Promise<ActionResult<TaskRow[]>> {
  return runAction("createTask", async () => {
    const { supabase, household, member } = await requireMember();
    const input = parse(taskInput, raw);
    return createTaskService(supabase, household, member, input);
  });
}

export async function completeTaskAction(raw: z.input<typeof completeInput>): Promise<ActionResult<CompletionRow>> {
  return runAction("completeTask", async () => {
    const { supabase, household } = await requireMember();
    const input = parse(completeInput, raw);
    const completion = check(
      await supabase.rpc("complete_task", {
        p_task_id: input.taskId,
        p_mutation_id: input.mutationId,
        p_note: input.note,
        p_completed_at: input.completedAt ?? null,
      }),
    ) as CompletionRow;

    // Volgende uitvoering inplannen (de gebruiker ziet hem meteen). Iedereen die
    // "taak gedaan" aan heeft informeren, ook wie afvinkte; zonder naam, zodat
    // tekst en ontvangers niet verraden wie het deed (V-21, V-38a). De melding
    // (met push) loopt na het antwoord, zodat een trage pushdienst het afvinken
    // niet ophoudt (performance-review WP3, punt 5).
    after(() =>
      notify({
        householdId: household.id,
        message: {
          type: "task_completed",
          title: `${completion.title} is gedaan`,
          taskId: completion.task_id,
          dedupeKey: `completed:${completion.id}`,
        },
      }),
    );
    if (completion.recurrence_id) await topUp(household.id, [completion.recurrence_id]);

    return completion;
  });
}

export async function undoCompleteAction(taskId: string): Promise<ActionResult<TaskRow>> {
  return runAction("undoComplete", async () => {
    const { supabase } = await requireMember();
    const id = parse(uuid, taskId);
    return check(await supabase.rpc("undo_complete_task", { p_task_id: id })) as TaskRow;
  });
}

export async function setTaskStatusAction(taskId: string, status: Exclude<TaskStatus, "done">): Promise<ActionResult<TaskRow>> {
  return runAction("setTaskStatus", async () => {
    const ctx = await requireMember();
    const id = parse(uuid, taskId);
    const next = parse(z.enum(["todo", "in_progress", "skipped"]), status);
    const task = await loadOwnTask(ctx, id);
    if (task.status === "done") throw new UserError("Maak het afvinken eerst ongedaan.");
    if (task.status === next) return task;
    const [updated] = expectRows(await ctx.supabase.from("tasks").update({ status: next }).eq("id", id).select("*")) as TaskRow[];
    if (next === "skipped" && task.recurrence_id) {
      await topUp(ctx.household.id, [task.recurrence_id]);
    }
    return updated;
  });
}

/** Verplaatsen naar een andere dag (ook via slepen in de kalender). */
export async function moveTaskAction(taskId: string, newDate: string): Promise<ActionResult<TaskRow>> {
  return runAction("moveTask", async () => {
    const ctx = await requireMember();
    const id = parse(uuid, taskId);
    const date = parse(isoDate, newDate);
    const task = await loadOwnTask(ctx, id);
    const shift = diffDays(task.scheduled_date, date);
    if (shift === 0) return task;
    const tz = ctx.household.timezone;
    const [updated] = expectRows(
      await ctx.supabase
        .from("tasks")
        .update({
          scheduled_date: date,
          available_from: shiftInstant(task.available_from, shift, tz),
          due_at: shiftInstant(task.due_at, shift, tz),
          is_exception: task.recurrence_id ? true : task.is_exception,
        })
        .eq("id", id)
        .select("*"),
    ) as TaskRow[];
    return updated;
  });
}

export async function updateTaskAction(raw: TaskUpdateInput): Promise<ActionResult<TaskRow>> {
  return runAction("updateTask", async () => {
    const ctx = await requireMember();
    const { supabase, household, member } = ctx;
    const { taskId, scope, changes } = parse(taskUpdateInput, raw);
    const task = await loadOwnTask(ctx, taskId);
    // "Deze en toekomstige": eerst de rechten op de reeks, zodat een weigering niets verandert (B-01)
    const series = task.recurrence_id && scope === "future" ? await loadOwnSeries(ctx, task.recurrence_id) : null;
    const tz = household.timezone;

    // --- nieuwe waarden voor deze taak ----------------------------------
    const scheduledDate = changes.scheduledDate ?? task.scheduled_date;
    const shift = diffDays(task.scheduled_date, scheduledDate);
    let dueAt = shiftInstant(task.due_at, shift, tz);
    if (changes.dueDate !== undefined || changes.dueTime !== undefined) {
      const shiftedDue = shiftInstant(task.due_at, shift, tz);
      const dueDate = changes.dueDate ?? (shiftedDue ? zonedDate(shiftedDue, tz) : scheduledDate);
      const existingTime = task.due_at ? zonedTime(task.due_at, tz) : null;
      const dueTime =
        changes.dueTime ??
        (existingTime ? `${String(existingTime.hour).padStart(2, "0")}:${String(existingTime.minute).padStart(2, "0")}` : END_OF_DAY);
      dueAt = zonedInstant(dueDate, dueTime, tz);
    }
    if (dueAt && dueAt < (shiftInstant(task.available_from, shift, tz) ?? dueAt)) {
      throw new UserError("De deadline ligt vóór het moment dat de taak beschikbaar is.");
    }

    const patch: Partial<TaskRow> = {
      ...(changes.title !== undefined && { title: changes.title }),
      ...(changes.description !== undefined && { description: changes.description }),
      ...(changes.category !== undefined && { category: changes.category }),
      ...(changes.priority !== undefined && { priority: changes.priority }),
      ...(changes.scheduledTime !== undefined && { scheduled_time: changes.scheduledTime }),
      ...(changes.durationMinutes !== undefined && { duration_minutes: changes.durationMinutes }),
      ...(changes.reminderMinutesBefore !== undefined && { reminder_minutes_before: changes.reminderMinutesBefore }),
      scheduled_date: scheduledDate,
      available_from: shiftInstant(task.available_from, shift, tz),
      due_at: dueAt,
    };

    // --- losse taak wordt terugkerend -------------------------------------
    if (!task.recurrence_id && changes.recurrence) {
      // De reeks krijgt de id van de taak: dubbel opslaan levert zo nooit een
      // tweede reeks op (upsert, idempotent; TECHNICAL_DESIGN §6.1)
      check(
        await supabase.from("task_recurrences").upsert(
          {
            id: task.id,
            household_id: household.id,
            title: patch.title ?? task.title,
            description: patch.description ?? task.description,
            category: patch.category ?? task.category,
            priority: patch.priority ?? task.priority,
            duration_minutes: patch.duration_minutes ?? task.duration_minutes,
            rule: changes.recurrence.rule,
            time_of_day: patch.scheduled_time ?? task.scheduled_time,
            due_time: changes.dueTime ?? null,
            due_days_after: changes.dueDate ? diffDays(scheduledDate, changes.dueDate) : 0,
            starts_on: scheduledDate,
            ends_on: changes.recurrence.endsOn ?? null,
            reminder_minutes_before: patch.reminder_minutes_before ?? task.reminder_minutes_before,
            generated_until: scheduledDate,
            created_by_member_id: member.id,
          },
          { onConflict: "id", ignoreDuplicates: true },
        ),
      );
      // Bestond er al een reeks met deze id (door iemand anders vooraf
      // aangemaakt), dan koppelen we de taak daar niet stilletjes aan
      const ownSeries = await loadOwnSeries(ctx, task.id);
      if (ownSeries.created_by_member_id !== member.id) {
        throw new UserError("Deze taak is net door iemand anders aangepast. Vernieuw en probeer het opnieuw.", "CONFLICT");
      }
      patch.recurrence_id = task.id;
      patch.occurrence_date = scheduledDate;
    }

    if (task.recurrence_id && scope === "this") patch.is_exception = true;

    // Deze en toekomstige: de reeks wordt als eerste bijgewerkt. Weigert RLS
    // (geen beheerder en niet de maker), dan is er nog niets veranderd.
    const from = task.occurrence_date ?? task.scheduled_date;
    if (series && changes.recurrence === null) {
      // Niet meer herhalen: reeks eindigt met deze taak
      expectRows(
        await supabase.from("task_recurrences").update({ ends_on: from }).eq("id", series.id).select("id"),
        "Dit mag je niet (meer) wijzigen. Er is niets veranderd.",
      );
    } else if (series) {
      const seriesPatch: Partial<RecurrenceRow> = {
        title: patch.title ?? task.title,
        description: patch.description ?? task.description,
        category: patch.category ?? task.category,
        priority: patch.priority ?? task.priority,
        duration_minutes: patch.duration_minutes ?? task.duration_minutes,
        reminder_minutes_before: patch.reminder_minutes_before ?? task.reminder_minutes_before,
        time_of_day: patch.scheduled_time ?? task.scheduled_time,
      };
      if (changes.dueDate !== undefined || changes.dueTime !== undefined) {
        seriesPatch.due_days_after = changes.dueDate ? Math.max(0, diffDays(scheduledDate, changes.dueDate)) : 0;
        seriesPatch.due_time = changes.dueTime ?? series.due_time;
      }
      if (changes.recurrence) {
        seriesPatch.rule = changes.recurrence.rule;
        seriesPatch.starts_on = scheduledDate;
        seriesPatch.ends_on = changes.recurrence.endsOn ?? null;
      }
      expectRows(
        await supabase.from("task_recurrences").update(seriesPatch).eq("id", series.id).select("id"),
        "Dit mag je niet (meer) wijzigen. Er is niets veranderd.",
      );
      // Deze taak blijft staan (zelfde id) en hoort weer gewoon bij de reeks
      patch.is_exception = false;
      if (changes.recurrence) patch.occurrence_date = scheduledDate;
    }

    const [updated] = expectRows(await supabase.from("tasks").update(patch).eq("id", taskId).select("*")) as TaskRow[];

    // Losse taak werd terugkerend: planning aanvullen
    if (!task.recurrence_id && updated.recurrence_id) {
      await topUp(household.id, [updated.recurrence_id]);
    }

    // Deze en toekomstige: open uitvoeringen na deze taak weg (RPC controleert
    // de rechten opnieuw) en opnieuw inplannen. Faalt een stap halverwege, dan
    // herstelt de volgende poging of tick het (TECHNICAL_DESIGN §6.1).
    if (series) {
      check(
        await supabase.rpc("clear_series_occurrences", {
          p_recurrence_id: series.id,
          p_from: addDays(from, 1),
          p_until: null,
          p_include_exceptions: false,
        }),
      );
      if (changes.recurrence !== null) await topUp(household.id, [series.id], addDays(from, 1));
    }

    return updated;
  });
}

export async function deleteTaskAction(taskId: string, scope: "this" | "future" = "this"): Promise<ActionResult<true>> {
  return runAction("deleteTask", async () => {
    const ctx = await requireMember();
    const id = parse(uuid, taskId);
    const s = parse(updateScope, scope);
    const task = await loadOwnTask(ctx, id);
    // De RPC controleert de rechten (beheerder of maker; voor "future" ook de
    // reeks) en verandert niets bij een weigering (B-01)
    check(await ctx.supabase.rpc("delete_task", { p_task_id: id, p_scope: s }));
    if (task.recurrence_id && s === "this") {
      await topUp(ctx.household.id, [task.recurrence_id]);
    }
    return true as const;
  });
}

/**
 * Terugkerende taak tijdelijk pauzeren (bijv. gras maaien 1 nov – 1 mrt), of
 * met een lege begindatum de pauze opheffen. De RPC controleert de rechten.
 */
export async function pauseSeriesAction(raw: z.input<typeof pauseInput>): Promise<ActionResult<RecurrenceRow>> {
  return runAction("pauseSeries", async () => {
    const ctx = await requireMember();
    const input = parse(pauseInput, raw);
    await loadOwnSeries(ctx, input.recurrenceId);
    const series = (
      input.pausedFrom
        ? check(
            await ctx.supabase.rpc("pause_series", {
              p_recurrence_id: input.recurrenceId,
              p_from: input.pausedFrom,
              p_until: input.pausedUntil,
            }),
          )
        : check(await ctx.supabase.rpc("resume_series", { p_recurrence_id: input.recurrenceId }))
    ) as RecurrenceRow;
    await topUp(ctx.household.id, [series.id]);
    return series;
  });
}

export async function stopSeriesAction(recurrenceId: string): Promise<ActionResult<true>> {
  return runAction("stopSeries", async () => {
    const ctx = await requireMember();
    const id = parse(uuid, recurrenceId);
    await loadOwnSeries(ctx, id);
    check(await ctx.supabase.rpc("stop_series", { p_recurrence_id: id }));
    return true as const;
  });
}

// ---------------------------------------------------------------------------
// Opmerkingen
// ---------------------------------------------------------------------------
export async function addCommentAction(raw: z.input<typeof commentInput>): Promise<ActionResult<true>> {
  return runAction("addComment", async () => {
    const ctx = await requireMember();
    const { supabase, household, member } = ctx;
    const input = parse(commentInput, raw);
    await loadOwnTask(ctx, input.taskId);
    check(
      await supabase.from("task_comments").upsert(
        { ...(input.id ? { id: input.id } : {}), household_id: household.id, task_id: input.taskId, member_id: member.id, body: input.body },
        { onConflict: "id", ignoreDuplicates: true },
      ),
    );
    return true as const;
  });
}

export async function deleteCommentAction(commentId: string): Promise<ActionResult<true>> {
  return runAction("deleteComment", async () => {
    const { supabase, household } = await requireMember();
    expectRows(
      await supabase.from("task_comments").delete().eq("id", parse(uuid, commentId)).eq("household_id", household.id).select("id"),
      "Je kunt alleen je eigen notities verwijderen.",
    );
    return true as const;
  });
}
