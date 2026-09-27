"use client";

import { ArrowRight, Repeat } from "lucide-react";
import { parts, type ISODate } from "@/domain/dates";
import { WEEKDAY_SHORT } from "@/domain/recurrence/rule";
import { Button } from "@/components/ui/button";
import type { TaskView } from "@/features/tasks/selectors";
import { cn } from "@/lib/utils";
import { capitalize, formatDayLong, monthGrid, type Projection } from "./calendar-model";
import { DraggableTaskChip } from "./calendar-items";
import { DayList } from "./day-view";
import { DroppableDay } from "./droppable-day";
import type { CalendarData } from "./use-calendar-data";

interface MonthViewProps {
  anchor: ISODate;
  selected: ISODate;
  data: CalendarData;
  wide: boolean;
  onSelect: (date: ISODate) => void;
  onOpenDay: (date: ISODate) => void;
}

const MAX_DOTS = 4;
const MAX_CHIPS = 3;

export function MonthView({ anchor, selected, data, wide, onSelect, onOpenDay }: MonthViewProps) {
  const weeks = monthGrid(anchor);
  const month = parts(anchor).month;

  return (
    <div className="grid gap-6">
      <div>
        <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
          {WEEKDAY_SHORT.map((d) => (
            <span key={d} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="grid gap-1">
          {weeks.map((week) => (
            <div key={week[0]} className="grid grid-cols-7 gap-1">
              {week.map((date) => (
                <MonthCell
                  key={date}
                  date={date}
                  outside={parts(date).month !== month}
                  selected={date === selected}
                  today={date === data.today}
                  tasks={data.tasksByDate.get(date) ?? []}
                  projections={data.projectionsByDate.get(date) ?? []}
                  data={data}
                  wide={wide}
                  onSelect={onSelect}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-2 px-1">
          <h2 className="font-semibold">{capitalize(formatDayLong(selected))}</h2>
          <Button variant="ghost" size="sm" onClick={() => onOpenDay(selected)}>
            Open dag
            <ArrowRight />
          </Button>
        </div>
        <DayList date={selected} data={data} draggable />
      </div>
    </div>
  );
}

interface MonthCellProps {
  date: ISODate;
  outside: boolean;
  selected: boolean;
  today: boolean;
  tasks: TaskView[];
  projections: Projection[];
  data: CalendarData;
  wide: boolean;
  onSelect: (date: ISODate) => void;
}

function MonthCell({ date, outside, selected, today, tasks, projections, data, wide, onSelect }: MonthCellProps) {
  const open = tasks.filter((t) => t.display !== "done" && t.display !== "skipped");
  const overdue = tasks.some((t) => t.display === "overdue");
  const allDone = tasks.length > 0 && open.length === 0;
  const label = `${formatDayLong(date)}: ${tasks.length ? `${tasks.length} ${tasks.length === 1 ? "taak" : "taken"}` : "niets gepland"}`;

  const dayNumber = (
    <span
      className={cn(
        "flex size-7 items-center justify-center rounded-full text-sm tabular-nums",
        today && "bg-primary font-semibold text-primary-foreground",
        !today && selected && "font-semibold text-primary",
        overdue && !today && "text-overdue",
      )}
    >
      {parts(date).day}
    </span>
  );

  return (
    <DroppableDay
      date={date}
      onClick={() => onSelect(date)}
      className={cn(
        "cursor-pointer rounded-xl",
        wide ? "flex min-h-28 flex-col gap-1 p-1" : "flex min-h-14 flex-col items-center gap-1 py-1.5",
        outside ? "opacity-45" : "bg-muted/40",
        selected && "bg-accent ring-2 ring-primary/40",
        overdue && !selected && "bg-overdue-bg/50",
      )}
    >
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(date);
        }}
        className={cn("flex items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring", wide ? "self-start" : "self-center")}
      >
        {dayNumber}
      </button>

      {wide ? (
        <>
          {tasks.slice(0, MAX_CHIPS).map((task) => (
            <DraggableTaskChip key={task.id} task={task} member={task.assigned_member_id ? data.memberById.get(task.assigned_member_id) : undefined} />
          ))}
          {tasks.length > MAX_CHIPS && (
            <span className="px-1 text-[11px] text-muted-foreground">+{tasks.length - MAX_CHIPS} meer</span>
          )}
          {projections.length > 0 && tasks.length < MAX_CHIPS && (
            <span className="inline-flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
              <Repeat className="size-3" />
              {projections.length} volgt
            </span>
          )}
        </>
      ) : (
        <Dots tasks={open} projections={projections} allDone={allDone} data={data} />
      )}
    </DroppableDay>
  );
}

/** Mobiel: gekleurde puntjes per taak (kleur van het gezinslid). */
function Dots({
  tasks,
  projections,
  allDone,
  data,
}: {
  tasks: TaskView[];
  projections: Projection[];
  allDone: boolean;
  data: CalendarData;
}) {
  if (allDone && !projections.length) return <span className="size-1.5 rounded-full bg-done" aria-hidden />;
  const shown = tasks.slice(0, MAX_DOTS);
  const rest = tasks.length - shown.length;
  const ghosts = Math.min(projections.length, Math.max(0, MAX_DOTS - shown.length));
  return (
    <span className="flex h-2 flex-wrap items-center justify-center gap-0.5" aria-hidden>
      {shown.map((t) => (
        <span
          key={t.id}
          className={cn("size-1.5 rounded-full", t.display === "overdue" && "ring-1 ring-overdue")}
          style={{ backgroundColor: (t.assigned_member_id && data.memberById.get(t.assigned_member_id)?.color) || "var(--color-muted-foreground)" }}
        />
      ))}
      {Array.from({ length: ghosts }, (_, i) => (
        <span key={`g${i}`} className="size-1.5 rounded-full border border-muted-foreground/50" />
      ))}
      {rest > 0 && <span className="text-[9px] leading-none text-muted-foreground">+{rest}</span>}
    </span>
  );
}
