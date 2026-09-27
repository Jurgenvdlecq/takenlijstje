/**
 * Planningsregels voor terugkerende taken.
 *
 * Voorbeelden:
 *  - Dagelijks:                 { freq: "daily", interval: 1 }
 *  - Elke 3 dagen:              { freq: "daily", interval: 3 }
 *  - Woensdag en zondag:        { freq: "weekly", interval: 1, weekdays: [3, 7] }
 *  - Elke 2 weken op zondag:    { freq: "weekly", interval: 2, weekdays: [7] }
 *  - Maandelijks op de 1e:      { freq: "monthly", interval: 1, monthDay: 1 }
 *  - Laatste dag v/d maand:     { freq: "monthly", interval: 1, monthDay: -1 }
 *  - Eerste zaterdag v/d maand: { freq: "monthly", interval: 1, nth: 1, weekday: 6 }
 *  - Jaarlijks op 1 april:      { freq: "yearly", interval: 1, month: 4, monthDay: 1 }
 *
 * De regel wordt als JSON in task_recurrences.rule opgeslagen en altijd
 * server-side met dit schema gevalideerd.
 */
import { z } from "zod";

const weekday = z.number().int().min(1).max(7);
const interval = z.number().int().min(1).max(52);

export const dailyRuleSchema = z.object({
  freq: z.literal("daily"),
  interval,
});

export const weeklyRuleSchema = z.object({
  freq: z.literal("weekly"),
  interval,
  weekdays: z
    .array(weekday)
    .min(1)
    .max(7)
    .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
});

export const monthlyRuleSchema = z
  .object({
    freq: z.literal("monthly"),
    interval: z.number().int().min(1).max(24),
    monthDay: z.number().int().min(-1).max(31).refine((d) => d !== 0).optional(),
    nth: z.number().int().min(-1).max(4).refine((n) => n !== 0).optional(),
    weekday: weekday.optional(),
  })
  .refine((r) => r.monthDay !== undefined || (r.nth !== undefined && r.weekday !== undefined), {
    message: "Kies een dag van de maand of bijvoorbeeld 'eerste zaterdag'",
  });

export const yearlyRuleSchema = z.object({
  freq: z.literal("yearly"),
  interval: z.number().int().min(1).max(10),
  month: z.number().int().min(1).max(12),
  monthDay: z.number().int().min(1).max(31),
});

export const recurrenceRuleSchema = z.union([
  dailyRuleSchema,
  weeklyRuleSchema,
  monthlyRuleSchema,
  yearlyRuleSchema,
]);

export type DailyRule = z.infer<typeof dailyRuleSchema>;
export type WeeklyRule = z.infer<typeof weeklyRuleSchema>;
export type MonthlyRule = z.infer<typeof monthlyRuleSchema>;
export type YearlyRule = z.infer<typeof yearlyRuleSchema>;
export type RecurrenceRule = z.infer<typeof recurrenceRuleSchema>;

export const WEEKDAY_NAMES = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"] as const;
export const WEEKDAY_SHORT = ["ma", "di", "wo", "do", "vr", "za", "zo"] as const;
export const MONTH_NAMES = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
] as const;

const NTH_NAMES: Record<number, string> = { 1: "eerste", 2: "tweede", 3: "derde", 4: "vierde", [-1]: "laatste" };

function joinDutch(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} en ${items[items.length - 1]}`;
}

/** Leesbare Nederlandse omschrijving, bijv. "Elke 2 weken op zondag". */
export function describeRule(rule: RecurrenceRule): string {
  switch (rule.freq) {
    case "daily":
      return rule.interval === 1 ? "Dagelijks" : `Elke ${rule.interval} dagen`;
    case "weekly": {
      const days = joinDutch(rule.weekdays.map((d) => WEEKDAY_NAMES[d - 1]));
      if (rule.interval === 1) {
        return rule.weekdays.length === 7 ? "Dagelijks" : `Elke ${days}`;
      }
      return `Elke ${rule.interval} weken op ${days}`;
    }
    case "monthly": {
      const every = rule.interval === 1 ? "Maandelijks" : `Elke ${rule.interval} maanden`;
      if (rule.nth !== undefined && rule.weekday !== undefined) {
        return `${every} op de ${NTH_NAMES[rule.nth]} ${WEEKDAY_NAMES[rule.weekday - 1]}`;
      }
      if (rule.monthDay === -1) return `${every} op de laatste dag`;
      return `${every} op de ${rule.monthDay}e`;
    }
    case "yearly": {
      const every = rule.interval === 1 ? "Jaarlijks" : `Elke ${rule.interval} jaar`;
      return `${every} op ${rule.monthDay} ${MONTH_NAMES[rule.month - 1]}`;
    }
  }
}

/** Gemiddeld aantal keer per week – gebruikt voor schattingen en statistiek. */
export function timesPerWeek(rule: RecurrenceRule): number {
  switch (rule.freq) {
    case "daily":
      return 7 / rule.interval;
    case "weekly":
      return rule.weekdays.length / rule.interval;
    case "monthly":
      return 12 / 52 / rule.interval;
    case "yearly":
      return 1 / 52 / rule.interval;
  }
}
