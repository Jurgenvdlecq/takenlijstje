"use client";

/**
 * Kleine bouwstenen die op de instellingenpagina (en in de onboarding)
 * steeds terugkomen: sectiekaart, kleurkiezer en emoji-kiezer.
 */
import { CheckIcon, type LucideIcon } from "lucide-react";
import * as React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MEMBER_COLORS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-titel`} className="scroll-mt-24">
      <Card className={className}>
        <div className="flex items-start gap-3 p-4 pb-2">
          <div className="rounded-xl bg-accent p-2 text-accent-foreground">
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={`${id}-titel`} className="text-base font-semibold">
              {title}
            </h2>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
        <div className="p-4 pt-2">{children}</div>
      </Card>
    </section>
  );
}

/** Rij met gekleurde rondjes om een kleur te kiezen. */
export function ColorSwatches({
  value,
  onChange,
  colors = MEMBER_COLORS,
}: {
  value: string;
  onChange: (color: string) => void;
  colors?: readonly string[];
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kleur">
      {colors.map((color) => {
        const active = value.toLowerCase() === color.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`Kleur ${color}`}
            onClick={() => onChange(color)}
            className={cn(
              "flex size-11 items-center justify-center rounded-full transition outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              active ? "ring-2 ring-foreground/70 ring-offset-2 ring-offset-card" : "hover:scale-105",
            )}
            style={{ backgroundColor: color }}
          >
            {active && <CheckIcon className="size-5 text-white" strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}

export const PRESET_EMOJI = ["😀", "😎", "🦊", "🐻", "🐱", "🐶", "🦄", "🌻", "⚽", "🎸", "🚀", "👑"];

/** Een paar vaste emoji plus een klein vrij invulveld. Leeg = initiaal. */
export function EmojiPicker({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  const id = React.useId();
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Icoon">
        <button
          type="button"
          role="radio"
          aria-checked={!value}
          onClick={() => onChange("")}
          className={cn(
            "flex h-11 items-center justify-center rounded-xl border px-3 text-sm transition",
            !value ? "border-primary bg-accent text-accent-foreground" : "bg-card hover:bg-accent",
          )}
        >
          Geen
        </button>
        {PRESET_EMOJI.map((emoji) => (
          <button
            key={emoji}
            type="button"
            role="radio"
            aria-checked={value === emoji}
            aria-label={`Icoon ${emoji}`}
            onClick={() => onChange(emoji)}
            className={cn(
              "flex size-11 items-center justify-center rounded-xl border text-xl transition",
              value === emoji ? "border-primary bg-accent" : "bg-card hover:bg-accent",
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-xs text-muted-foreground">
          Of typ zelf een emoji:
        </label>
        <Input
          id={id}
          value={value}
          maxLength={8}
          onChange={(e) => onChange(e.target.value.trim())}
          className="h-10 w-20 text-center text-lg"
          placeholder="🙂"
        />
      </div>
    </div>
  );
}

const DAY_MONTH = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", timeZone: "UTC" });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** "2026-03-01" → "1 maart" (of met jaartal als het niet dit jaar is) */
export function formatDate(date: string, withYear?: boolean): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  const showYear = withYear ?? d.getUTCFullYear() !== new Date().getFullYear();
  return (showYear ? DAY_MONTH_YEAR : DAY_MONTH).format(d);
}

export function formatRange(from: string, to: string): string {
  return from === to ? formatDate(from) : `${formatDate(from)} t/m ${formatDate(to)}`;
}
