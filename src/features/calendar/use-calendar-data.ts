"use client";

import * as React from "react";
import { todayIn, type ISODate } from "@/domain/dates";
import { useSnapshot } from "@/features/household/store";
import { compareTasks, memberMap, toViews, type TaskView } from "@/features/tasks/selectors";
import { useNow } from "@/hooks/use-now";
import type { MemberRow } from "@/types/database";
import { groupByDate, projectOccurrences, type DateRange, type Projection } from "./calendar-model";

/** "all" of het id van een gezinslid */
export type MemberFilter = string;
export const ALL_MEMBERS = "all";

export interface CalendarData {
  today: ISODate;
  members: MemberRow[];
  memberById: Map<string, MemberRow>;
  tasksByDate: Map<ISODate, TaskView[]>;
  projectionsByDate: Map<ISODate, Projection[]>;
}

function projectionMatches(p: Projection, filter: MemberFilter): boolean {
  if (filter === ALL_MEMBERS) return true;
  return p.candidateMemberIds === null || p.candidateMemberIds.includes(filter);
}

/** Taken en geprojecteerde herhalingen binnen de zichtbare periode, per dag. */
export function useCalendarData(range: DateRange, filter: MemberFilter): CalendarData {
  const snapshot = useSnapshot();
  const now = useNow();
  const tz = snapshot.household.timezone;
  const today = todayIn(tz, now);
  const { from, to } = range;

  const members = React.useMemo(
    () => snapshot.members.filter((m) => m.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [snapshot.members],
  );
  const memberById = React.useMemo(() => memberMap(snapshot.members), [snapshot.members]);

  const tasksByDate = React.useMemo(() => {
    const inRange = snapshot.tasks.filter(
      (t) =>
        !t.deleted_at &&
        t.scheduled_date >= from &&
        t.scheduled_date <= to &&
        (filter === ALL_MEMBERS || t.assigned_member_id === filter),
    );
    return groupByDate(toViews(inRange, now, tz).sort(compareTasks), (t) => t.scheduled_date);
  }, [snapshot.tasks, from, to, filter, now, tz]);

  const projectionsByDate = React.useMemo(() => {
    const projections = projectOccurrences(snapshot.recurrences, snapshot.tasks, { from, to }, today).filter((p) =>
      projectionMatches(p, filter),
    );
    return groupByDate(projections, (p) => p.date);
  }, [snapshot.recurrences, snapshot.tasks, from, to, today, filter]);

  return { today, members, memberById, tasksByDate, projectionsByDate };
}
