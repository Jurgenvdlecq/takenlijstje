/**
 * Invoerschema's (zod). Worden server-side in iedere action gecontroleerd;
 * formulieren kunnen ze ook gebruiken voor directe feedback.
 */
import { z } from "zod";
import { isISODate } from "@/domain/dates";
import { recurrenceRuleSchema } from "@/domain/recurrence/rule";

export const uuid = z.uuid();
export const isoDate = z.string().refine(isISODate, "Ongeldige datum");
export const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Ongeldige tijd")
  .transform((t) => t.slice(0, 5));

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, min === 1 ? `${label} is verplicht` : `${label} is te kort`)
    .max(max, `${label} is te lang (max. ${max} tekens)`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const taskCategory = z.enum(["cleaning", "laundry", "groceries", "kitchen", "outdoor", "pets", "admin", "other"]);
export const taskPriority = z.enum(["low", "normal", "high", "urgent"]);
export const assignmentStrategy = z.enum(["none", "fixed", "rotation", "random", "fair"]);
export const shoppingCategory = z.enum([
  "produce", "meat", "dairy", "bread", "drinks", "frozen", "drugstore", "household", "other",
]);
export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ongeldige kleur");
export const reminderList = z.array(z.number().int().min(0).max(10080)).max(5).default([]);

export const recurrenceInput = z.object({
  rule: recurrenceRuleSchema,
  assignmentStrategy: assignmentStrategy.default("none"),
  fixedMemberId: uuid.nullable().optional(),
  rotationMemberIds: z.array(uuid).max(20).default([]),
  endsOn: isoDate.nullable().optional(),
});

export const taskInput = z
  .object({
    /** Door de client gegenereerd, zodat opnieuw versturen (offline) geen dubbele taak geeft */
    id: uuid.optional(),
    title: trimmed(1, 80, "Naam taak"),
    description: optionalText(1000),
    category: taskCategory.default("other"),
    priority: taskPriority.default("normal"),
    assignedMemberId: uuid.nullable().optional(),
    /** Eenmalige taak automatisch verdelen */
    autoAssign: z.enum(["fair", "random"]).nullable().optional(),
    scheduledDate: isoDate,
    scheduledTime: timeOfDay.nullable().optional(),
    availableDaysBefore: z.number().int().min(0).max(30).default(0),
    dueDate: isoDate.nullable().optional(),
    dueTime: timeOfDay.nullable().optional(),
    durationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
    points: z.number().int().min(0).max(100).nullable().optional(),
    reminderMinutesBefore: reminderList,
    recurrence: recurrenceInput.nullable().optional(),
    templateId: uuid.nullable().optional(),
  })
  .refine((t) => !t.dueDate || t.dueDate >= t.scheduledDate, {
    message: "De deadline ligt vóór de uitvoerdatum",
    path: ["dueDate"],
  });

export type TaskInput = z.input<typeof taskInput>;

export const updateScope = z.enum(["this", "future"]);

export const taskUpdateInput = z.object({
  taskId: uuid,
  scope: updateScope.default("this"),
  changes: z
    .object({
      title: trimmed(1, 80, "Naam taak"),
      description: optionalText(1000),
      category: taskCategory,
      priority: taskPriority,
      assignedMemberId: uuid.nullable(),
      scheduledDate: isoDate,
      scheduledTime: timeOfDay.nullable(),
      dueDate: isoDate.nullable(),
      dueTime: timeOfDay.nullable(),
      durationMinutes: z.number().int().min(1).max(1440).nullable(),
      points: z.number().int().min(0).max(100).nullable(),
      reminderMinutesBefore: z.array(z.number().int().min(0).max(10080)).max(5),
      recurrence: recurrenceInput.nullable(),
    })
    .partial(),
});

export type TaskUpdateInput = z.input<typeof taskUpdateInput>;

export const completeInput = z.object({
  taskId: uuid,
  mutationId: uuid,
  completedAt: z.iso.datetime({ offset: true }).optional(),
  completedBy: uuid.optional(),
  note: optionalText(500),
});

export const pauseInput = z
  .object({
    recurrenceId: uuid,
    pausedFrom: isoDate.nullable(),
    pausedUntil: isoDate.nullable(),
  })
  .refine((p) => !p.pausedFrom || !p.pausedUntil || p.pausedUntil >= p.pausedFrom, {
    message: "De einddatum ligt vóór de begindatum",
  })
  .refine((p) => p.pausedFrom || !p.pausedUntil, { message: "Kies ook vanaf wanneer de pauze begint" });

export const commentInput = z.object({
  id: uuid.optional(),
  taskId: uuid,
  body: trimmed(1, 1000, "Opmerking"),
});

export const memberInput = z.object({
  displayName: trimmed(1, 50, "Naam"),
  color: hexColor.default("#6366f1"),
  icon: z.string().max(16).nullable().optional(),
  role: z.enum(["admin", "member"]).default("member"),
  email: z.email("Ongeldig e-mailadres").nullable().optional().or(z.literal("").transform(() => null)),
  isActive: z.boolean().default(true),
});

export const householdSettingsInput = z.object({
  name: trimmed(1, 80, "Naam huishouden").optional(),
  timezone: z.string().min(1).max(64).optional(),
  membersCanCreateTasks: z.boolean().optional(),
  membersCanAssignOthers: z.boolean().optional(),
  pointsEnabled: z.boolean().optional(),
  pointsGoal: z.number().int().min(1).max(100000).nullable().optional(),
  pointsGoalReward: optionalText(120),
});

export const absenceInput = z
  .object({
    memberId: uuid,
    startsOn: isoDate,
    endsOn: isoDate,
    strategy: z.enum(["reassign", "postpone", "unassign"]).default("reassign"),
    note: optionalText(200),
  })
  .refine((a) => a.endsOn >= a.startsOn, { message: "De einddatum ligt vóór de begindatum", path: ["endsOn"] });

export const shoppingItemInput = z.object({
  id: uuid.optional(),
  name: trimmed(1, 80, "Product"),
  quantity: optionalText(30),
  category: shoppingCategory.default("other"),
  note: optionalText(200),
});

export const preferencesInput = z.object({
  pushEnabled: z.boolean(),
  notifyTaskAssigned: z.boolean(),
  notifyReminders: z.boolean(),
  notifyDeadlineSoon: z.boolean(),
  notifyOverdue: z.boolean(),
  notifyTaskCompleted: z.boolean(),
  notifySwapRequests: z.boolean(),
  dailySummaryEnabled: z.boolean(),
  dailySummaryTime: timeOfDay,
  eveningSummaryEnabled: z.boolean(),
  eveningSummaryTime: timeOfDay,
  deadlineWarningMinutes: z.number().int().min(5).max(2880),
});

export const pushSubscriptionInput = z.object({
  endpoint: z.url().startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export const templateActivationInput = z.object({
  items: z
    .array(
      z.object({
        templateId: uuid,
        title: trimmed(1, 80, "Naam taak").optional(),
        rule: recurrenceRuleSchema,
        timeOfDay: timeOfDay.nullable().optional(),
        assignmentStrategy: assignmentStrategy.default("fair"),
        fixedMemberId: uuid.nullable().optional(),
        rotationMemberIds: z.array(uuid).max(20).default([]),
      }),
    )
    .min(1, "Kies minimaal één taak")
    .max(60),
});

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Ongeldige invoer";
}
