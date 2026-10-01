"use client";

import { useDraggable } from "@dnd-kit/core";
import { CalendarClock, Clock, Repeat } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { shortTime } from "@/domain/dates";
import { describeRule } from "@/domain/recurrence/rule";
import { isOpen } from "@/domain/status";
import { TaskCard } from "@/features/tasks/task-card";
import type { TaskView } from "@/features/tasks/selectors";
import { useTaskUi } from "@/features/tasks/task-ui-context";
import { cn } from "@/lib/utils";
import type { Projection } from "./calendar-model";

export interface DragData {
  task: TaskView;
}

/** Sleepbaar omhulsel: alleen open taken; tikken blijft gewoon werken. */
function Draggable({ task, children, className }: { task: TaskView; children: React.ReactNode; className?: string }) {
  // Afvaltaken volgen de gemeente en zijn niet te verplaatsen (W-03, V-54)
  const enabled = isOpen(task) && !task.waste_direction;
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `task:${task.id}`,
    data: { task } satisfies DragData,
    disabled: !enabled,
  });
  return (
    <div
      ref={setNodeRef}
      {...(enabled ? listeners : {})}
      // Lang indrukken op mobiel: geen tekstselectie of contextmenu
      className={cn("select-none [-webkit-touch-callout:none]", isDragging && "opacity-30", className)}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

/** Volledige taakkaart (lijstweergave), sleepbaar naar een andere dag. */
export function DraggableTaskCard({ task }: { task: TaskView }) {
  return (
    <Draggable task={task}>
      <TaskCard task={task} compact />
    </Draggable>
  );
}

/** Kleine taakregel voor kolommen en maandvakjes. */
export function TaskChip({
  task,
  overlay = false,
}: {
  task: TaskView;
  overlay?: boolean;
}) {
  const { openTask } = useTaskUi();
  const finished = task.status === "done" || task.status === "skipped";
  const overdue = task.display === "overdue";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openTask(task.id);
      }}
      title={task.title}
      className={cn(
        "flex min-h-9 w-full items-center gap-1.5 rounded-lg border-l-[3px] bg-card px-1.5 py-1 text-left text-xs shadow-xs ring-1 ring-border/70 transition outline-none hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-ring",
        overdue && "bg-overdue-bg/60 text-overdue ring-overdue/30",
        finished && "opacity-60",
        overlay && "rotate-1 shadow-lg ring-primary/40",
      )}
      style={{ borderLeftColor: "var(--color-border)" }}
    >
      <span className="min-w-0 flex-1">
        {task.scheduled_time && (
          <span className="block text-[10px] leading-tight text-muted-foreground tabular-nums">{shortTime(task.scheduled_time)}</span>
        )}
        <span className={cn("block truncate font-medium", finished && "text-muted-foreground line-through")}>{task.title}</span>
      </span>
      {task.recurring && <Repeat className="size-3 shrink-0 text-muted-foreground" aria-label="Terugkerend" />}
    </button>
  );
}

export function DraggableTaskChip({ task }: { task: TaskView }) {
  return (
    <Draggable task={task}>
      <TaskChip task={task} />
    </Draggable>
  );
}

function explainProjection(p: Projection) {
  toast("Wordt automatisch ingepland", {
    description: `${p.title} · ${describeRule(p.rule)}. Deze taak verschijnt vanzelf zodra de datum dichterbij komt.`,
  });
}

/** Geprojecteerde herhaling: gedimd en gestippeld, niet sleepbaar. */
export function ProjectionRow({ projection }: { projection: Projection }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        explainProjection(projection);
      }}
      className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-dashed border-muted-foreground/30 px-3.5 py-2 text-left text-muted-foreground transition outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30">
        <Repeat className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{projection.title}</span>
        <span className="mt-0.5 flex items-center gap-2 text-xs">
          {projection.time && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {shortTime(projection.time)}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3" />
            Wordt ingepland
          </span>
        </span>
      </span>
    </button>
  );
}

export function ProjectionChip({ projection }: { projection: Projection }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        explainProjection(projection);
      }}
      title={`${projection.title} (wordt automatisch ingepland)`}
      className="flex min-h-9 w-full items-center gap-1.5 rounded-lg border border-dashed border-muted-foreground/35 px-1.5 py-1 text-left text-xs text-muted-foreground transition outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="min-w-0 flex-1">
        {projection.time && <span className="block text-[10px] leading-tight tabular-nums">{shortTime(projection.time)}</span>}
        <span className="block truncate">{projection.title}</span>
      </span>
      <Repeat className="size-3 shrink-0" aria-hidden />
    </button>
  );
}
