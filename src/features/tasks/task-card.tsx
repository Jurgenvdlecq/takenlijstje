"use client";

import { AlertTriangle, CheckIcon, Clock, Loader2, Recycle, Repeat, SkipForward } from "lucide-react";
import * as React from "react";
import { shortTime, todayIn, zonedDate } from "@/domain/dates";
import { deadlineText, relativeDayLabel } from "@/domain/status";
import { wasteTimeLabel } from "@/domain/waste/display";
import { Badge } from "@/components/ui/badge";
import { useSnapshot } from "@/features/household/store";
import { useNow } from "@/hooks/use-now";
import { CATEGORY_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { TaskView } from "./selectors";
import { useTaskUi } from "./task-ui-context";
import { useTaskActions } from "./use-task-actions";

/** Ronde afvinkknop met een kleine "pop"-animatie. */
export function CompleteButton({ task, className }: { task: TaskView; className?: string }) {
  const { complete, undo } = useTaskActions();
  const done = task.status === "done";
  const [popping, setPopping] = React.useState(false);

  return (
    <button
      type="button"
      aria-label={done ? `${task.title}: afvinken ongedaan maken` : `${task.title} afvinken`}
      aria-pressed={done}
      onClick={(e) => {
        e.stopPropagation();
        if (done) {
          void undo(task.id);
        } else {
          setPopping(true);
          void complete(task);
        }
      }}
      onAnimationEnd={() => setPopping(false)}
      className={cn(
        // Groot touch-doel (44px) met een kleinere zichtbare cirkel
        "group/check -m-2 flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-full border-2 transition-colors",
          done ? "border-done bg-done text-white" : "border-muted-foreground/35 group-hover/check:border-done group-hover/check:bg-done-bg",
          task.display === "overdue" && !done && "border-overdue/70",
          popping && "animate-pop",
        )}
      >
        {done && <CheckIcon className="size-4" strokeWidth={3} />}
      </span>
    </button>
  );
}

export function TaskCard({
  task,
  showDate = false,
  compact = false,
}: {
  task: TaskView;
  showDate?: boolean;
  compact?: boolean;
}) {
  const snapshot = useSnapshot();
  const { openTask } = useTaskUi();
  const now = useNow();
  const tz = snapshot.household.timezone;
  const done = task.status === "done";
  const skipped = task.status === "skipped";
  const rawDeadline = deadlineText({ status: task.status, scheduledDate: task.scheduled_date, dueAt: task.due_at }, now, tz);
  // Afvaltaak (W-03, UX §13.4–13.5): eigen tijdregel, kenmerk in plaats van categorie, deadline alleen als verlopen
  const waste = !!task.waste_direction;
  const wasteTime = waste ? wasteTimeLabel(task, now, tz) : null;
  // Rustig houden: alleen tonen als het iets toevoegt (bijna/te laat, of deadline op een andere dag)
  const deadline =
    rawDeadline &&
    (task.display === "overdue" ||
      (!waste && rawDeadline.startsWith("verloopt")) ||
      (!waste && task.due_at && zonedDate(task.due_at, tz) !== task.scheduled_date))
      ? rawDeadline
      : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openTask(task.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openTask(task.id);
        }
      }}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-2xl border bg-card px-3.5 text-left shadow-xs transition hover:border-primary/30 active:scale-[0.99] animate-fade-up",
        compact ? "py-2" : "py-3",
        task.display === "overdue" && "border-overdue/30 bg-overdue-bg/40",
        (done || skipped) && "opacity-70",
      )}
    >
      <CompleteButton task={task} />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate font-medium", (done || skipped) && "text-muted-foreground line-through decoration-2")}>
          {task.priority === "urgent" && !done && <span className="mr-1 text-overdue">!!</span>}
          {task.priority === "high" && !done && <span className="mr-1 text-today">!</span>}
          {task.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {showDate && <span>{relativeDayLabel(task.scheduled_date, todayIn(tz, now))}</span>}
          {waste ? (
            wasteTime && (
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Clock className="size-3" />
                {wasteTime}
              </span>
            )
          ) : (
            task.scheduled_time && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {shortTime(task.scheduled_time)}
              </span>
            )
          )}
          {waste && (
            <span className="inline-flex items-center gap-1">
              <Recycle className="size-3.5" aria-hidden />
              Afvalkalender
            </span>
          )}
          {task.recurring && <Repeat className="size-3" aria-label="Terugkerend" />}
          {done && <span>Gedaan</span>}
          {skipped && (
            <span className="inline-flex items-center gap-1">
              <SkipForward className="size-3" />
              Overgeslagen
            </span>
          )}
          {!compact && !done && !skipped && !waste && <span>{CATEGORY_LABELS[task.category]}</span>}
          {task.status === "in_progress" && (
            <Badge variant="progress">
              <Loader2 className="animate-spin" />
              Bezig
            </Badge>
          )}
          {deadline && (
            <Badge variant={task.display === "overdue" ? "overdue" : deadline.startsWith("verloopt") ? "today" : "outline"}>
              {task.display === "overdue" && <AlertTriangle />}
              {deadline}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

export function TaskList({
  tasks,
  showDate,
  empty,
  limit,
}: {
  tasks: TaskView[];
  showDate?: boolean;
  empty?: React.ReactNode;
  /** Toon eerst maximaal zoveel taken, met "Toon alles" */
  limit?: number;
}) {
  const [expanded, setExpanded] = React.useState(false);
  if (!tasks.length) return <>{empty ?? null}</>;
  const visible = limit && !expanded ? tasks.slice(0, limit) : tasks;
  return (
    <div className="grid gap-2">
      {visible.map((task) => (
        <TaskCard key={task.id} task={task} showDate={showDate} />
      ))}
      {visible.length < tasks.length && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="h-11 rounded-2xl border border-dashed text-sm font-medium text-primary hover:bg-accent"
        >
          Toon alles ({tasks.length - visible.length} meer)
        </button>
      )}
    </div>
  );
}
