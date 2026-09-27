"use client";

/** Bouwstenen van het taakformulier: "Wie?" en "Wanneer?" als grote, tikbare keuzes. */
import { Dices, Repeat2, Scale, UserX } from "lucide-react";
import * as React from "react";
import { addDays, isoWeekday, type ISODate } from "@/domain/dates";
import { MemberAvatar } from "@/components/member-avatar";
import { cn } from "@/lib/utils";
import type { MemberRow } from "@/types/database";

export type AssigneeChoice = string | "none" | "fair" | "random" | "rotation";

function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition",
        active ? "border-primary bg-accent text-accent-foreground ring-1 ring-primary" : "bg-card hover:bg-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function WhoPicker({
  members,
  value,
  onChange,
  recurring,
}: {
  members: MemberRow[];
  value: AssigneeChoice;
  onChange: (value: AssigneeChoice) => void;
  recurring: boolean;
}) {
  const active = members.filter((m) => m.is_active);
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {active.map((m) => (
        <Chip key={m.id} active={value === m.id} onClick={() => onChange(m.id)}>
          <MemberAvatar member={m} size="xs" />
          {m.display_name}
        </Chip>
      ))}
      {recurring && (
        <Chip active={value === "rotation"} onClick={() => onChange("rotation")}>
          <Repeat2 className="size-4" /> Om en om
        </Chip>
      )}
      <Chip active={value === "fair"} onClick={() => onChange("fair")}>
        <Scale className="size-4" /> Eerlijk verdelen
      </Chip>
      <Chip active={value === "random"} onClick={() => onChange("random")}>
        <Dices className="size-4" /> Willekeurig
      </Chip>
      <Chip active={value === "none"} onClick={() => onChange("none")}>
        <UserX className="size-4" /> Niemand
      </Chip>
    </div>
  );
}

export function WhenPicker({ today, value, onChange }: { today: ISODate; value: ISODate; onChange: (date: ISODate) => void }) {
  const quick: { label: string; date: ISODate }[] = [
    { label: "Vandaag", date: today },
    { label: "Morgen", date: addDays(today, 1) },
  ];
  // Eerstvolgende zaterdag en zondag (populaire klusdagen), als die niet al vandaag/morgen zijn
  for (const weekday of [6, 7]) {
    const diff = (weekday - isoWeekday(today) + 7) % 7;
    const date = addDays(today, diff);
    if (!quick.some((q) => q.date === date)) quick.push({ label: weekday === 6 ? "Zaterdag" : "Zondag", date });
  }
  const isQuick = quick.some((q) => q.date === value);

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {quick.map((q) => (
        <Chip key={q.date} active={value === q.date} onClick={() => onChange(q.date)}>
          {q.label}
        </Chip>
      ))}
      <label
        className={cn(
          "relative inline-flex h-11 shrink-0 cursor-pointer items-center rounded-full border px-3.5 text-sm font-medium",
          !isQuick ? "border-primary bg-accent text-accent-foreground ring-1 ring-primary" : "bg-card hover:bg-muted",
        )}
      >
        {!isQuick
          ? new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
              new Date(`${value}T12:00:00Z`),
            )
          : "Andere dag…"}
        <input
          type="date"
          aria-label="Kies een datum"
          value={value}
          min={addDays(today, -365)}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

export const REMINDER_OPTIONS = [
  { value: "", label: "Geen herinnering" },
  { value: "0", label: "Op het geplande tijdstip" },
  { value: "15", label: "15 minuten van tevoren" },
  { value: "60", label: "1 uur van tevoren" },
  { value: "180", label: "3 uur van tevoren" },
  { value: "1440", label: "1 dag van tevoren" },
];
