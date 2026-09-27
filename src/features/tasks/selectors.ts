/**
 * Afgeleide gegevens voor de schermen (dashboard, lijsten, kalender).
 */
import { addDays, todayIn, type ISODate } from "@/domain/dates";
import { displayStatus, isOpen, PRIORITY_ORDER, type DisplayStatus } from "@/domain/status";
import type { Snapshot } from "@/lib/data/snapshot";
import type { MemberRow, TaskRow } from "@/types/database";

export interface TaskView extends TaskRow {
  display: DisplayStatus;
  recurring: boolean;
}

export function toViews(tasks: TaskRow[], now: Date, timeZone: string): TaskView[] {
  return tasks.map((t) => ({
    ...t,
    display: displayStatus({ status: t.status, scheduledDate: t.scheduled_date, dueAt: t.due_at }, now, timeZone),
    recurring: !!t.recurrence_id,
  }));
}

/** Sorteervolgorde: verlopen → urgent → tijdstip → titel; afgerond onderaan */
export function compareTasks(a: TaskView, b: TaskView): number {
  const doneA = a.display === "done" || a.display === "skipped";
  const doneB = b.display === "done" || b.display === "skipped";
  if (doneA !== doneB) return doneA ? 1 : -1;
  if (a.scheduled_date !== b.scheduled_date) return a.scheduled_date < b.scheduled_date ? -1 : 1;
  if ((a.display === "overdue") !== (b.display === "overdue")) return a.display === "overdue" ? -1 : 1;
  const prio = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (prio) return prio;
  const ta = a.scheduled_time ?? "99";
  const tb = b.scheduled_time ?? "99";
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.title.localeCompare(b.title, "nl");
}

export interface DashboardData {
  today: ISODate;
  todayTasks: TaskView[];
  upcoming: TaskView[];
  overdue: TaskView[];
  mine: TaskView[];
  everyone: TaskView[];
  summary: {
    todayCount: number;
    doneToday: number;
    openToday: number;
    overdueCount: number;
    nextDeadline: TaskView | null;
  };
}

export function dashboardData(snapshot: Snapshot, now: Date): DashboardData {
  const tz = snapshot.household.timezone;
  const today = todayIn(tz, now);
  const weekEnd = addDays(today, 7);
  const views = toViews(snapshot.tasks, now, tz).sort(compareTasks);

  const todayTasks = views.filter((t) => t.scheduled_date === today && t.display !== "overdue");
  const overdue = views.filter((t) => t.display === "overdue");
  const upcoming = views.filter((t) => t.scheduled_date > today && t.scheduled_date <= weekEnd && isOpen(t));
  const relevant = (t: TaskView) => t.display === "overdue" || (t.scheduled_date >= today && t.scheduled_date <= weekEnd);
  const mine = views.filter((t) => t.assigned_member_id === snapshot.me.id && relevant(t) && isOpen(t));
  const everyone = views.filter((t) => t.scheduled_date === today || t.display === "overdue");

  const openWithDeadline = views
    .filter((t) => isOpen(t) && t.due_at && t.display !== "overdue")
    .sort((a, b) => (a.due_at! < b.due_at! ? -1 : 1));

  return {
    today,
    todayTasks,
    upcoming,
    overdue,
    mine,
    everyone,
    summary: {
      todayCount: todayTasks.length,
      doneToday: todayTasks.filter((t) => t.status === "done").length,
      openToday: todayTasks.filter((t) => isOpen(t)).length,
      overdueCount: overdue.length,
      nextDeadline: openWithDeadline[0] ?? null,
    },
  };
}

export function memberMap(members: MemberRow[]): Map<string, MemberRow> {
  return new Map(members.map((m) => [m.id, m]));
}

export interface TaskFilters {
  search: string;
  memberId: string | "all" | "unassigned";
  category: string | "all";
  status: DisplayStatus | "all" | "open";
  priority: string | "all";
  recurring: "all" | "yes" | "no";
  from: ISODate | null;
  to: ISODate | null;
}

export const DEFAULT_FILTERS: TaskFilters = {
  search: "",
  memberId: "all",
  category: "all",
  status: "open",
  priority: "all",
  recurring: "all",
  from: null,
  to: null,
};

export function filterTasks(views: TaskView[], f: TaskFilters): TaskView[] {
  const needle = f.search.trim().toLowerCase();
  return views.filter((t) => {
    if (needle && !t.title.toLowerCase().includes(needle) && !(t.description ?? "").toLowerCase().includes(needle)) return false;
    if (f.memberId === "unassigned" && t.assigned_member_id) return false;
    if (f.memberId !== "all" && f.memberId !== "unassigned" && t.assigned_member_id !== f.memberId) return false;
    if (f.category !== "all" && t.category !== f.category) return false;
    if (f.status === "open" && !(t.display === "todo" || t.display === "in_progress" || t.display === "overdue")) return false;
    if (f.status !== "all" && f.status !== "open" && t.display !== f.status) return false;
    if (f.priority !== "all" && t.priority !== f.priority) return false;
    if (f.recurring === "yes" && !t.recurring) return false;
    if (f.recurring === "no" && t.recurring) return false;
    if (f.from && t.scheduled_date < f.from) return false;
    if (f.to && t.scheduled_date > f.to) return false;
    return true;
  });
}

export function activeFilterCount(f: TaskFilters): number {
  return (Object.keys(DEFAULT_FILTERS) as (keyof TaskFilters)[]).filter((k) => k !== "search" && f[k] !== DEFAULT_FILTERS[k]).length;
}
