"use client";

/**
 * Kiezer voor terugkerende taken. Begint met eenvoudige voorinstellingen
 * (dagelijks, wekelijks, 2x per week …) en laat daarna fijn afstellen.
 */
import * as React from "react";
import { isoWeekday, parts, type ISODate } from "@/domain/dates";
import { describeRule, MONTH_NAMES, WEEKDAY_SHORT, type RecurrenceRule } from "@/domain/recurrence/rule";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Freq = RecurrenceRule["freq"];

export function defaultRule(freq: Freq, date: ISODate): RecurrenceRule {
  const { day, month } = parts(date);
  switch (freq) {
    case "daily":
      return { freq: "daily", interval: 1 };
    case "weekly":
      return { freq: "weekly", interval: 1, weekdays: [isoWeekday(date)] };
    case "monthly":
      return { freq: "monthly", interval: 1, monthDay: day };
    case "yearly":
      return { freq: "yearly", interval: 1, month, monthDay: day };
  }
}

export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  return (
    <div className="flex gap-1.5" role="group" aria-label="Dagen van de week">
      {WEEKDAY_SHORT.map((label, i) => {
        const day = i + 1;
        const active = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={active}
            onClick={() => {
              const next = active ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b);
              if (next.length) onChange(next);
            }}
            className={cn(
              "flex size-10 items-center justify-center rounded-full border text-sm font-medium capitalize transition",
              active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function RecurrenceEditor({
  value,
  onChange,
  startDate,
}: {
  value: RecurrenceRule;
  onChange: (rule: RecurrenceRule) => void;
  startDate: ISODate;
}) {
  const id = React.useId();

  return (
    <div className="grid gap-3 rounded-2xl bg-muted/50 p-3">
      <div className="grid grid-cols-[auto_5rem_1fr] items-center gap-2">
        <Label htmlFor={`${id}-interval`} className="text-muted-foreground">
          Elke
        </Label>
        <Input
          id={`${id}-interval`}
          type="number"
          inputMode="numeric"
          min={1}
          max={52}
          value={value.interval}
          onChange={(e) => {
            const interval = Math.max(1, Math.min(52, Number(e.target.value) || 1));
            onChange({ ...value, interval } as RecurrenceRule);
          }}
        />
        <NativeSelect
          aria-label="Eenheid"
          value={value.freq}
          onChange={(e) => onChange({ ...defaultRule(e.target.value as Freq, startDate), interval: value.interval } as RecurrenceRule)}
        >
          <option value="daily">{value.interval === 1 ? "dag" : "dagen"}</option>
          <option value="weekly">{value.interval === 1 ? "week" : "weken"}</option>
          <option value="monthly">{value.interval === 1 ? "maand" : "maanden"}</option>
          <option value="yearly">jaar</option>
        </NativeSelect>
      </div>

      {value.freq === "weekly" && (
        <div className="grid gap-2">
          <span className="text-sm text-muted-foreground">Op</span>
          <WeekdayPicker value={value.weekdays} onChange={(weekdays) => onChange({ ...value, weekdays })} />
        </div>
      )}

      {value.freq === "monthly" && (
        <NativeSelect
          aria-label="Welke dag van de maand"
          value={value.nth !== undefined ? `nth:${value.nth}:${value.weekday}` : `day:${value.monthDay}`}
          onChange={(e) => {
            const [kind, a, b] = e.target.value.split(":");
            onChange(
              kind === "day"
                ? { freq: "monthly", interval: value.interval, monthDay: Number(a) }
                : { freq: "monthly", interval: value.interval, nth: Number(a), weekday: Number(b) },
            );
          }}
        >
          <option value={`day:${parts(startDate).day}`}>Op de {parts(startDate).day}e</option>
          <option value="day:1">Op de 1e</option>
          <option value="day:15">Op de 15e</option>
          <option value="day:-1">Op de laatste dag</option>
          {[1, 2, 3, 4, -1].map((nth) => (
            <option key={nth} value={`nth:${nth}:${isoWeekday(startDate)}`}>
              Op de {({ 1: "eerste", 2: "tweede", 3: "derde", 4: "vierde", [-1]: "laatste" } as Record<number, string>)[nth]}{" "}
              {["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"][isoWeekday(startDate) - 1]}
            </option>
          ))}
        </NativeSelect>
      )}

      {value.freq === "yearly" && (
        <p className="text-sm text-muted-foreground">
          Op {value.monthDay} {MONTH_NAMES[value.month - 1]}
        </p>
      )}

      <p className="text-sm font-medium text-accent-foreground">{describeRule(value)}</p>
    </div>
  );
}

/** Snelle keuzes voor wie het simpel wil houden. */
export const RULE_PRESETS: { label: string; build: (date: ISODate) => RecurrenceRule }[] = [
  { label: "Dagelijks", build: () => ({ freq: "daily", interval: 1 }) },
  { label: "Wekelijks", build: (d) => ({ freq: "weekly", interval: 1, weekdays: [isoWeekday(d)] }) },
  { label: "2x per week", build: (d) => ({ freq: "weekly", interval: 1, weekdays: twiceAWeek(isoWeekday(d)) }) },
  { label: "Elke 2 weken", build: (d) => ({ freq: "weekly", interval: 2, weekdays: [isoWeekday(d)] }) },
  { label: "Maandelijks", build: (d) => ({ freq: "monthly", interval: 1, monthDay: parts(d).day }) },
];

function twiceAWeek(day: number): number[] {
  const other = ((day + 2) % 7) + 1; // ~3-4 dagen later
  return [day, other].sort((a, b) => a - b);
}
