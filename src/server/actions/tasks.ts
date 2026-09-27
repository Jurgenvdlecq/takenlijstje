"use server";

/**
 * Server actions voor taken. Iedere action:
 *  1. controleert of de gebruiker lid is van het huishouden
 *  2. valideert de invoer met zod
 *  3. voert de wijziging uit (RLS controleert nogmaals in de database)
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
import { z } from "zod";
import { requireMember } from "../context";
import { check, runAction, UserError, type ActionResult } from "../errors";
import { notify } from "../notifications/dispatcher";
import { parse } from "../parse";
import { clearOpenOccurrences, replanSeries, topUpSeries } from "../services/scheduling";
import { createTask as createTaskService, getTaskForMember, notifyAssigned, systemDb, taskUrl } from "../services/tasks";

export async function createTaskAction(raw: TaskInput): Promise<ActionResult<TaskRow[]>> {
  return runAction("createTask", async () => {
    const { supabase, household, member } = await requireMember();
    const input = parse(taskInput, raw);
    return createTaskService(supabase, household, member, input);
  });
}

export async function completeTaskAction(raw: z.input<typeof completeInput>): Promise<ActionResult<CompletionRow>> {
  return runAction("completeTask", async () => {
    const { supabase, household, member } = await requireMember();
    const input = parse(completeInput, raw);
    const completion = check(
      await supabase.rpc("complete_task", {
        p_task_id: input.taskId,
        p_mutation_id: input.mutationId,
        p_note: input.note,
        p_completed_at: input.completedAt ?? null,
        p_completed_by: input.completedBy ?? null,
      }),
    ) as CompletionRow;

    // Volgende uitvoering inplannen (meestal staat die er al door de planningshorizon)
    if (completion.recurrence_id) {
      await topUpSeries(systemDb(supabase), household.id, { recurrenceIds: [completion.recurrence_id] });
    }

    // Andere gezinsleden informeren ("De boodschappen zijn gedaan door Ellen")
    const { data: others } = await supabase
      .from("household_members")
      .select("id, display_name")
      .eq("household_id", household.id)
      .neq("id", member.id);
    const doer =
      completion.member_id === member.id
        ? member.display_name
        : (others?.find((o) => o.id === completion.member_id)?.display_name ?? member.display_name);
    await notify({
      householdId: household.id,
      memberIds: (others ?? []).map((o) => o.id),
      message: {
        type: "task_completed",
        title: `“${completion.title}” is gedaan door ${doer}`,
        taskId: completion.task_id,
        dedupeKey: `completed:${completion.id}`,
      },
    });

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
    const { supabase, household } = await requireMember();
    const id = parse(uuid, taskId);
    const next = parse(z.enum(["todo", "in_progress", "skipped"]), status);
    const task = await getTaskForMember(supabase, household.id, id);
    if (task.status === "done") throw new UserError("Maak het afvinken eerst ongedaan.");
    const updated = check(await supabase.from("tasks").update({ status: next }).eq("id", id).select("*").single()) as TaskRow;
    if (next === "skipped" && task.recurrence_id) {
      await topUpSeries(systemDb(supabase), household.id, { recurrenceIds: [task.recurrence_id] });
    }
    return updated;
  });
}

/** Verplaatsen naar een andere dag (ook via slepen in de kalender). */
export async function moveTaskAction(taskId: string, newDate: string): Promise<ActionResult<TaskRow>> {
  return runAction("moveTask", async () => {
    const { supabase, household } = await requireMember();
    const id = parse(uuid, taskId);
    const date = parse(isoDate, newDate);
    const task = await getTaskForMember(supabase, household.id, id);
    const shift = diffDays(task.scheduled_date, date);
    if (shift === 0) return task;
    const tz = household.timezone;
    return check(
      await supabase
        .from("tasks")
        .update({
          scheduled_date: date,
          available_from: shiftInstant(task.available_from, shift, tz),
          due_at: shiftInstant(task.due_at, shift, tz),
          is_exception: task.recurrence_id ? true : task.is_exception,
        })
        .eq("id", id)
        .select("*")
        .single(),
    ) as TaskRow;
  });
}

export async function assignTaskAction(taskId: string, memberId: string | null): Promise<ActionResult<TaskRow>> {
  return runAction("assignTask", async () => {
    const { supabase, household, member } = await requireMember();
    const id = parse(uuid, taskId);
    const target = parse(uuid.nullable(), memberId);
    const task = await getTaskForMember(supabase, household.id, id);
    if (task.assigned_member_id === target) return task;

    const updated = check(
      await supabase
        .from("tasks")
        .update({
          assigned_member_id: target,
          assignment_reason: target ? "manual" : null,
          is_exception: task.recurrence_id ? true : task.is_exception,
        })
        .eq("id", id)
        .select("*")
        .single(),
    ) as TaskRow;
    await supabase.from("task_assignments").insert({
      household_id: household.id,
      task_id: id,
      member_id: target,
      assigned_by_member_id: member.id,
      reason: target ? "manual" : "unassigned",
    });
    await notifyAssigned(updated, member.id, supabase);
    return updated;
  });
}

export async function updateTaskAction(raw: TaskUpdateInput): Promise<ActionResult<TaskRow>> {
  return runAction("updateTask", async () => {
    const { supabase, household, member } = await requireMember();
    const { taskId, scope, changes } = parse(taskUpdateInput, raw);
    const task = await getTaskForMember(supabase, household.id, taskId);
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
      ...(changes.points !== undefined && { points: changes.points }),
      ...(changes.reminderMinutesBefore !== undefined && { reminder_minutes_before: changes.reminderMinutesBefore }),
      scheduled_date: scheduledDate,
      available_from: shiftInstant(task.available_from, shift, tz),
      due_at: dueAt,
    };
    const assigneeChanged = changes.assignedMemberId !== undefined && changes.assignedMemberId !== task.assigned_member_id;
    if (assigneeChanged) {
      patch.assigned_member_id = changes.assignedMemberId ?? null;
      patch.assignment_reason = changes.assignedMemberId ? "manual" : null;
    }

    // --- losse taak wordt terugkerend -------------------------------------
    if (!task.recurrence_id && changes.recurrence) {
      const series = check(
        await supabase
          .from("task_recurrences")
          .insert({
            household_id: household.id,
            title: patch.title ?? task.title,
            description: patch.description ?? task.description,
            category: patch.category ?? task.category,
            priority: patch.priority ?? task.priority,
            duration_minutes: patch.duration_minutes ?? task.duration_minutes,
            points: patch.points ?? task.points,
            rule: changes.recurrence.rule,
            time_of_day: patch.scheduled_time ?? task.scheduled_time,
            due_time: changes.dueTime ?? null,
            due_days_after: changes.dueDate ? diffDays(scheduledDate, changes.dueDate) : 0,
            starts_on: scheduledDate,
            ends_on: changes.recurrence.endsOn ?? null,
            assignment_strategy:
              changes.recurrence.assignmentStrategy === "none" && (patch.assigned_member_id ?? task.assigned_member_id)
                ? "fixed"
                : changes.recurrence.assignmentStrategy,
            fixed_member_id: changes.recurrence.fixedMemberId ?? patch.assigned_member_id ?? task.assigned_member_id,
            rotation_member_ids: changes.recurrence.rotationMemberIds,
            reminder_minutes_before: patch.reminder_minutes_before ?? task.reminder_minutes_before,
            generated_until: scheduledDate,
            created_by_member_id: member.id,
          })
          .select("*")
          .single(),
      ) as RecurrenceRow;
      patch.recurrence_id = series.id;
      patch.occurrence_date = scheduledDate;
    }

    if (task.recurrence_id && scope === "this") patch.is_exception = true;

    const updated = check(await supabase.from("tasks").update(patch).eq("id", taskId).select("*").single()) as TaskRow;

    if (assigneeChanged) {
      await supabase.from("task_assignments").insert({
        household_id: household.id,
        task_id: taskId,
        member_id: patch.assigned_member_id ?? null,
        assigned_by_member_id: member.id,
        reason: patch.assigned_member_id ? "manual" : "unassigned",
      });
      await notifyAssigned(updated, member.id, supabase);
    }

    // --- deze en toekomstige taken: reeks aanpassen en opnieuw plannen ---
    if (task.recurrence_id && scope === "future") {
      const series = check(
        await supabase.from("task_recurrences").select("*").eq("id", task.recurrence_id).single(),
      ) as RecurrenceRow;
      const from = task.occurrence_date ?? task.scheduled_date;

      if (changes.recurrence === null) {
        // Niet meer herhalen: reeks eindigt met deze taak
        check(await supabase.from("task_recurrences").update({ ends_on: from }).eq("id", series.id));
        await clearOpenOccurrences(systemDb(supabase), household.id, series.id, addDays(from, 1));
        return updated;
      }

      const seriesPatch: Partial<RecurrenceRow> = {
        title: updated.title,
        description: updated.description,
        category: updated.category,
        priority: updated.priority,
        duration_minutes: updated.duration_minutes,
        points: updated.points,
        reminder_minutes_before: updated.reminder_minutes_before,
        time_of_day: updated.scheduled_time,
      };
      if (changes.dueDate !== undefined || changes.dueTime !== undefined) {
        seriesPatch.due_days_after = changes.dueDate ? Math.max(0, diffDays(scheduledDate, changes.dueDate)) : 0;
        seriesPatch.due_time = changes.dueTime ?? series.due_time;
      }
      if (changes.recurrence) {
        seriesPatch.rule = changes.recurrence.rule;
        seriesPatch.starts_on = scheduledDate;
        seriesPatch.ends_on = changes.recurrence.endsOn ?? null;
        seriesPatch.assignment_strategy = changes.recurrence.assignmentStrategy;
        seriesPatch.fixed_member_id = changes.recurrence.fixedMemberId ?? null;
        seriesPatch.rotation_member_ids = changes.recurrence.rotationMemberIds;
      } else if (assigneeChanged) {
        seriesPatch.assignment_strategy = updated.assigned_member_id ? "fixed" : "none";
        seriesPatch.fixed_member_id = updated.assigned_member_id;
      }
      check(await supabase.from("task_recurrences").update(seriesPatch).eq("id", series.id));

      // Deze taak blijft staan (zelfde id), de rest wordt opnieuw ingepland
      check(
        await supabase
          .from("tasks")
          .update({ is_exception: false, occurrence_date: changes.recurrence ? scheduledDate : task.occurrence_date })
          .eq("id", taskId),
      );
      await replanSeries(systemDb(supabase), household.id, series.id, addDays(from, 1));
    }

    return updated;
  });
}

export async function deleteTaskAction(taskId: string, scope: "this" | "future" = "this"): Promise<ActionResult<null>> {
  return runAction("deleteTask", async () => {
    const { supabase, household } = await requireMember();
    const id = parse(uuid, taskId);
    const s = parse(updateScope, scope);
    const task = await getTaskForMember(supabase, household.id, id);

    if (!task.recurrence_id) {
      // Losse taak zonder historie mag echt weg; met historie zacht verwijderen
      const { count } = await supabase.from("task_completions").select("id", { count: "exact", head: true }).eq("task_id", id);
      if (count) check(await supabase.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", id));
      else check(await supabase.from("tasks").delete().eq("id", id));
      return null;
    }

    // In een reeks: zacht verwijderen zodat de planning hem niet opnieuw aanmaakt
    check(await supabase.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", id));
    if (s === "future") {
      const from = task.occurrence_date ?? task.scheduled_date;
      check(await supabase.from("task_recurrences").update({ is_active: false }).eq("id", task.recurrence_id));
      await clearOpenOccurrences(systemDb(supabase), household.id, task.recurrence_id, from, null, true);
    } else {
      await topUpSeries(systemDb(supabase), household.id, { recurrenceIds: [task.recurrence_id] });
    }
    return null;
  });
}

/** Terugkerende taak tijdelijk pauzeren (bijv. gras maaien 1 nov – 1 mrt). */
export async function pauseSeriesAction(raw: z.input<typeof pauseInput>): Promise<ActionResult<RecurrenceRow>> {
  return runAction("pauseSeries", async () => {
    const { supabase, household } = await requireMember();
    const input = parse(pauseInput, raw);
    const series = check(
      await supabase
        .from("task_recurrences")
        .update({ paused_from: input.pausedFrom, paused_until: input.pausedUntil })
        .eq("id", input.recurrenceId)
        .eq("household_id", household.id)
        .select("*")
        .single(),
    ) as RecurrenceRow;
    const db = systemDb(supabase);
    if (input.pausedFrom) {
      await clearOpenOccurrences(db, household.id, series.id, input.pausedFrom, input.pausedUntil);
    }
    await topUpSeries(db, household.id, { recurrenceIds: [series.id] });
    return series;
  });
}

export async function stopSeriesAction(recurrenceId: string): Promise<ActionResult<null>> {
  return runAction("stopSeries", async () => {
    const { supabase, household } = await requireMember();
    const id = parse(uuid, recurrenceId);
    check(await supabase.from("task_recurrences").update({ is_active: false }).eq("id", id).eq("household_id", household.id));
    await clearOpenOccurrences(systemDb(supabase), household.id, id, "0001-01-01", null, true);
    return null;
  });
}

// ---------------------------------------------------------------------------
// Opmerkingen
// ---------------------------------------------------------------------------
export async function addCommentAction(raw: z.input<typeof commentInput>): Promise<ActionResult<null>> {
  return runAction("addComment", async () => {
    const { supabase, household, member } = await requireMember();
    const input = parse(commentInput, raw);
    await getTaskForMember(supabase, household.id, input.taskId);
    check(
      await supabase.from("task_comments").upsert(
        { ...(input.id ? { id: input.id } : {}), household_id: household.id, task_id: input.taskId, member_id: member.id, body: input.body },
        { onConflict: "id", ignoreDuplicates: true },
      ),
    );
    return null;
  });
}

export async function deleteCommentAction(commentId: string): Promise<ActionResult<null>> {
  return runAction("deleteComment", async () => {
    const { supabase, household } = await requireMember();
    check(await supabase.from("task_comments").delete().eq("id", parse(uuid, commentId)).eq("household_id", household.id));
    return null;
  });
}

// ---------------------------------------------------------------------------
// Ruilen: "Ik kan deze taak niet doen"
// ---------------------------------------------------------------------------
export async function requestSwapAction(taskId: string, message?: string | null): Promise<ActionResult<null>> {
  return runAction("requestSwap", async () => {
    const { supabase, household, member } = await requireMember();
    const id = parse(uuid, taskId);
    const note = parse(z.string().trim().max(300).nullable().optional(), message ?? null) || null;
    const task = await getTaskForMember(supabase, household.id, id);
    if (task.status === "done") throw new UserError("Deze taak is al gedaan.");
    check(
      await supabase.from("task_swap_requests").insert({
        household_id: household.id,
        task_id: id,
        requested_by_member_id: member.id,
        message: note,
      }),
    );
    const { data: others } = await supabase
      .from("household_members")
      .select("id")
      .eq("household_id", household.id)
      .eq("is_active", true)
      .neq("id", member.id);
    await notify({
      householdId: household.id,
      memberIds: (others ?? []).map((o) => o.id),
      fallbackDb: supabase,
      message: {
        type: "swap_request",
        title: `${member.display_name} wil “${task.title}” ruilen`,
        body: note ?? "Tik om de taak over te nemen.",
        taskId: id,
        url: taskUrl(id),
        dedupeKey: `swap:${id}:${Date.now()}`,
      },
    });
    return null;
  });
}

export async function acceptSwapAction(requestId: string): Promise<ActionResult<TaskRow>> {
  return runAction("acceptSwap", async () => {
    const { supabase, household, member } = await requireMember();
    const id = parse(uuid, requestId);
    const { data: request } = await supabase.from("task_swap_requests").select("*").eq("id", id).maybeSingle();
    const task = check(await supabase.rpc("accept_swap_request", { p_request_id: id })) as TaskRow;
    if (request) {
      await notify({
        householdId: household.id,
        memberIds: [request.requested_by_member_id],
        fallbackDb: supabase,
        message: {
          type: "swap_accepted",
          title: `${member.display_name} neemt “${task.title}” over`,
          taskId: task.id,
          dedupeKey: `swap-accepted:${id}`,
        },
      });
    }
    return task;
  });
}

export async function cancelSwapAction(requestId: string): Promise<ActionResult<null>> {
  return runAction("cancelSwap", async () => {
    const { supabase, household } = await requireMember();
    check(
      await supabase
        .from("task_swap_requests")
        .update({ status: "cancelled", resolved_at: new Date().toISOString() })
        .eq("id", parse(uuid, requestId))
        .eq("household_id", household.id)
        .eq("status", "open"),
    );
    return null;
  });
}
