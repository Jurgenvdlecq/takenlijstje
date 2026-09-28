"use client";

import { CalendarCheck, Plus } from "lucide-react";
import type { ISODate } from "@/domain/dates";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionTitle } from "@/components/ui/misc";
import { TaskCard } from "@/features/tasks/task-card";
import { useTaskUi } from "@/features/tasks/task-ui-context";
import { DraggableTaskCard, ProjectionRow } from "./calendar-items";
import type { CalendarData } from "./use-calendar-data";

/** Lijst met de taken (en geprojecteerde herhalingen) van één dag. */
export function DayList({
  date,
  data,
  title,
  draggable = false,
}: {
  date: ISODate;
  data: CalendarData;
  title?: string;
  /** Taken sleepbaar maken (bijv. naar een vakje in het maandraster) */
  draggable?: boolean;
}) {
  const { openNewTask } = useTaskUi();
  const tasks = data.tasksByDate.get(date) ?? [];
  const projections = data.projectionsByDate.get(date) ?? [];
  const open = tasks.filter((t) => t.status === "todo" || t.status === "in_progress").length;

  const addButton = (
    <Button variant="ghost" size="sm" onClick={() => openNewTask({ date })}>
      <Plus />
      Taak
    </Button>
  );

  if (!tasks.length && !projections.length) {
    return (
      <div>
        {title && <SectionTitle>{title}</SectionTitle>}
        <EmptyState
          icon={CalendarCheck}
          title={date < data.today ? "Niets gepland" : "Een rustige dag"}
          description={date < data.today ? "Op deze dag stond niets op de planning." : "Er staat nog niets gepland. Zin om iets toe te voegen?"}
          action={
            date >= data.today ? (
              <Button variant="outline" onClick={() => openNewTask({ date })}>
                <Plus />
                Taak toevoegen
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div>
      <SectionTitle count={open || undefined} action={addButton}>
        {title ?? "Planning"}
      </SectionTitle>
      <div className="grid gap-2">
        {tasks.map((task) => (draggable ? <DraggableTaskCard key={task.id} task={task} /> : <TaskCard key={task.id} task={task} />))}
        {projections.map((p) => (
          <ProjectionRow key={p.key} projection={p} />
        ))}
      </div>
    </div>
  );
}
