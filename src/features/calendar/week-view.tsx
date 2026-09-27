"use client";

import { Plus } from "lucide-react";
import { parts, type ISODate } from "@/domain/dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTaskUi } from "@/features/tasks/task-ui-context";
import { cn } from "@/lib/utils";
import { capitalize, formatDayShort, formatWeekdayShort } from "./calendar-model";
import { DraggableTaskCard, DraggableTaskChip, ProjectionChip, ProjectionRow } from "./calendar-items";
import { DroppableDay } from "./droppable-day";
import type { CalendarData } from "./use-calendar-data";

interface WeekViewProps {
  days: ISODate[];
  data: CalendarData;
  wide: boolean;
}

export function WeekView({ days, data, wide }: WeekViewProps) {
  return wide ? <WeekColumns days={days} data={data} /> : <WeekList days={days} data={data} />;
}

/** Mobiel: zeven dagblokken onder elkaar. */
function WeekList({ days, data }: { days: ISODate[]; data: CalendarData }) {
  const { openNewTask } = useTaskUi();
  return (
    <div className="grid gap-3">
      {days.map((date) => {
        const tasks = data.tasksByDate.get(date) ?? [];
        const projections = data.projectionsByDate.get(date) ?? [];
        const isToday = date === data.today;
        const past = date < data.today;
        const empty = !tasks.length && !projections.length;
        return (
          <DroppableDay
            key={date}
            date={date}
            onClick={() => openNewTask({ date })}
            className={cn("-mx-2 cursor-pointer rounded-3xl p-2", isToday && "bg-today-bg/40")}
          >
            <div className="mb-2 flex min-h-9 items-center gap-2 px-1">
              <h3 className={cn("font-semibold", past && !isToday && "text-muted-foreground")}>{capitalize(formatDayShort(date))}</h3>
              {isToday && <Badge variant="today">Vandaag</Badge>}
              {tasks.length > 0 && <span className="text-xs text-muted-foreground">{tasks.length}</span>}
              <Button
                variant="ghost"
                size="icon-sm"
                className="ml-auto text-muted-foreground"
                aria-label={`Taak toevoegen op ${formatDayShort(date)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  openNewTask({ date });
                }}
              >
                <Plus />
              </Button>
            </div>
            {empty ? (
              <p className="flex min-h-11 items-center rounded-2xl border border-dashed px-4 text-sm text-muted-foreground">
                {past ? "Niets gepland" : "Nog niets gepland – tik om iets toe te voegen"}
              </p>
            ) : (
              <div className="grid gap-2">
                {tasks.map((task) => (
                  <DraggableTaskCard key={task.id} task={task} />
                ))}
                {projections.map((p) => (
                  <ProjectionRow key={p.key} projection={p} member={p.memberId ? data.memberById.get(p.memberId) : undefined} />
                ))}
              </div>
            )}
          </DroppableDay>
        );
      })}
    </div>
  );
}

/** Tablet/desktop: zeven kolommen naast elkaar. */
function WeekColumns({ days, data }: { days: ISODate[]; data: CalendarData }) {
  const { openNewTask } = useTaskUi();
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((date) => {
        const tasks = data.tasksByDate.get(date) ?? [];
        const projections = data.projectionsByDate.get(date) ?? [];
        const isToday = date === data.today;
        return (
          <DroppableDay
            key={date}
            date={date}
            onClick={() => openNewTask({ date })}
            className={cn(
              "group/day flex min-h-72 cursor-pointer flex-col gap-1.5 rounded-2xl bg-muted/40 p-1.5",
              isToday && "bg-today-bg/50",
              date < data.today && "opacity-80",
            )}
          >
            <div className="flex flex-col items-center py-1">
              <span className="text-xs text-muted-foreground">{formatWeekdayShort(date)}</span>
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {parts(date).day}
              </span>
            </div>
            {tasks.map((task) => (
              <DraggableTaskChip key={task.id} task={task} member={task.assigned_member_id ? data.memberById.get(task.assigned_member_id) : undefined} />
            ))}
            {projections.map((p) => (
              <ProjectionChip key={p.key} projection={p} member={p.memberId ? data.memberById.get(p.memberId) : undefined} />
            ))}
            <button
              type="button"
              aria-label={`Taak toevoegen op ${formatDayShort(date)}`}
              onClick={(e) => {
                e.stopPropagation();
                openNewTask({ date });
              }}
              className="mt-auto flex min-h-9 items-center justify-center rounded-lg text-muted-foreground transition outline-none pointer-fine:opacity-0 pointer-fine:group-hover/day:opacity-100 hover:bg-accent focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="size-4" />
            </button>
          </DroppableDay>
        );
      })}
    </div>
  );
}
