"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CalendarMode } from "./calendar-model";

const MODES: { value: CalendarMode; label: string }[] = [
  { value: "day", label: "Dag" },
  { value: "week", label: "Week" },
  { value: "month", label: "Maand" },
];

const PERIOD_NAME: Record<CalendarMode, string> = { day: "dag", week: "week", month: "maand" };

/** Kop met titel, weergavekeuze en bladerknoppen. */
export function CalendarToolbar({
  title,
  subtitle,
  mode,
  onModeChange,
  onPrev,
  onNext,
  onToday,
  showingToday,
}: {
  title: string;
  subtitle: string;
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  showingToday: boolean;
}) {
  return (
    <div className="mb-4 grid min-w-0 gap-4">
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight" aria-live="polite">
            {title}
          </h1>
          {subtitle && <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={onToday} disabled={showingToday}>
          Vandaag
        </Button>
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon" onClick={onPrev} aria-label={`Vorige ${PERIOD_NAME[mode]}`}>
            <ChevronLeft className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onNext} aria-label={`Volgende ${PERIOD_NAME[mode]}`}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </div>
      <Tabs value={mode} onValueChange={(v) => onModeChange(v as CalendarMode)}>
        <TabsList className="h-11 w-full">
          {MODES.map((m) => (
            <TabsTrigger key={m.value} value={m.value} className="h-9">
              {m.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
