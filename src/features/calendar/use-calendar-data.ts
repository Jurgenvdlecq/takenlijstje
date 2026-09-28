"use client";

import * as React from "react";
import { todayIn, type ISODate } from "@/domain/dates";
import { useSnapshot } from "@/features/household/store";
import { compareTasks, toViews, type TaskView } from "@/features/tasks/selectors";
import { useNow } from "@/hooks/use-now";
import { groupByDate, projectOccurrences, type DateRange, type Projection } from "./calendar-model";

export interface CalendarData {
  today: ISODate;
  tasksByDate: Map<ISODate, TaskView[]>;
  projectionsByDate: Map<ISODate, Projection[]>;
}

/** Taken en geprojecteerde herhalingen binnen de zichtbare periode, per dag. */
export function useCalendarData(range: DateRange): CalendarData {
  const snapshot = useSnapshot();
  const now = useNow();
  const tz = snapshot.household.timezone;
  const today = todayIn(tz, now);
  const { from, to } = range;

  const tasksByDate = React.useMemo(() => {
    const inRange = snapshot.tasks.filter((t) => !t.deleted_at && t.scheduled_date >= from && t.scheduled_date <= to);
    return groupByDate(toViews(inRange, now, tz).sort(compareTasks), (t) => t.scheduled_date);
  }, [snapshot.tasks, from, to, now, tz]);

  const projectionsByDate = React.useMemo(() => {
    const projections = projectOccurrences(snapshot.recurrences, snapshot.tasks, { from, to }, today);
    return groupByDate(projections, (p) => p.date);
  }, [snapshot.recurrences, snapshot.tasks, from, to, today]);

  return { today, tasksByDate, projectionsByDate };
}
