import "server-only";

/**
 * Bedrijfslogica rond taken, los van de server actions zodat ook de cron en
 * de voorbeelddata het kunnen gebruiken. Taken horen bij het huishouden; er
 * wordt niets aan personen toegewezen (V-21).
 */
import { diffDays } from "@/domain/dates";
import { computeWindow } from "@/domain/recurrence/window";
import type { DbClient } from "@/lib/supabase/server";
import type { TaskInput, taskInput } from "@/lib/validation";
import type { HouseholdRow, MemberRow, TaskRow } from "@/types/database";
import type { z } from "zod";
import { check } from "../errors";
import { topUp } from "../system/planner";

type ParsedTaskInput = z.output<typeof taskInput>;
export type { TaskInput };

export function taskUrl(taskId: string): string {
  return `/taken?taak=${taskId}`;
}

/**
 * Nieuwe taak aanmaken. Met `recurrence` wordt een reeks aangemaakt en
 * direct vooruit ingepland; anders één losse taak. Door de client gegenereerde
 * id's maken opnieuw versturen idempotent (BR-10, R-03).
 */
export async function createTask(
  db: DbClient,
  household: HouseholdRow,
  member: MemberRow,
  input: ParsedTaskInput,
): Promise<TaskRow[]> {
  const tz = household.timezone;

  if (input.recurrence) {
    const recurrenceId = input.recurrence.recurrenceId;
    // Rechtenstap: insert met de gebruikersclient (RLS can_create_tasks);
    // bestaat de reeks al (tweede verzoek), dan verandert er niets
    check(
      await db.from("task_recurrences").upsert(
        {
          id: recurrenceId,
          household_id: household.id,
          template_id: input.templateId ?? null,
          title: input.title,
          description: input.description,
          category: input.category,
          priority: input.priority,
          duration_minutes: input.durationMinutes ?? null,
          rule: input.recurrence.rule,
          time_of_day: input.scheduledTime ?? null,
          available_days_before: input.availableDaysBefore,
          due_days_after: input.dueDate ? diffDays(input.scheduledDate, input.dueDate) : 0,
          due_time: input.dueTime ?? null,
          starts_on: input.scheduledDate,
          ends_on: input.recurrence.endsOn ?? null,
          reminder_minutes_before: input.reminderMinutesBefore,
          created_by_member_id: member.id,
        },
        { onConflict: "id", ignoreDuplicates: true },
      ),
    );

    // De planner voegt alleen uitvoeringen in
    await topUp(household.id, [recurrenceId]);
    return check(
      await db
        .from("tasks")
        .select("*")
        .eq("household_id", household.id)
        .eq("recurrence_id", recurrenceId)
        .is("deleted_at", null)
        .order("scheduled_date"),
    ) as TaskRow[];
  }

  const window = computeWindow(
    input.scheduledDate,
    {
      timeOfDay: input.scheduledTime ?? null,
      availableDaysBefore: input.availableDaysBefore,
      dueDaysAfter: input.dueDate ? diffDays(input.scheduledDate, input.dueDate) : 0,
      dueTime: input.dueTime ?? null,
    },
    tz,
  );

  const id = input.id;
  const row = {
    id,
    household_id: household.id,
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority,
    scheduled_date: window.scheduledDate,
    scheduled_time: window.scheduledTime,
    available_from: window.availableFrom,
    due_at: window.dueAt,
    duration_minutes: input.durationMinutes ?? null,
    reminder_minutes_before: input.reminderMinutesBefore,
    created_by_member_id: member.id,
  };

  // Altijd met de gebruikersclient: RLS beslist. Er is geen aanmaakroute met de service role.
  check(await db.from("tasks").upsert(row, { onConflict: "id", ignoreDuplicates: true }));
  return [check(await db.from("tasks").select("*").eq("id", id).eq("household_id", household.id).single()) as TaskRow];
}
