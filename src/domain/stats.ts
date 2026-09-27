/**
 * Eenvoudige huishoudstatistieken – informatief, niet competitief.
 */
import type { ISODate } from "./dates";

export interface StatsCompletion {
  memberId: string | null;
  title: string;
  recurrenceId: string | null;
  completedAt: string;
  wasLate: boolean;
  points: number;
}

export interface StatsTask {
  id: string;
  title: string;
  recurrenceId: string | null;
  assignedMemberId: string | null;
  status: "todo" | "in_progress" | "done" | "skipped";
  scheduledDate: ISODate;
  overdue: boolean;
}

export interface MemberStats {
  memberId: string;
  done: number;
  open: number;
  overdue: number;
  points: number;
  /** Aandeel afgerond van (afgerond + open) in de periode, 0..1 */
  progress: number;
}

export interface PeriodStats {
  completed: number;
  open: number;
  late: number;
  overdue: number;
  completionRate: number | null;
  mostDone: { title: string; count: number } | null;
  mostForgotten: { title: string; count: number } | null;
  averagePerMember: number;
  totalPoints: number;
  members: MemberStats[];
}

function topBy<T>(items: T[], key: (item: T) => string): { title: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  let best: { title: string; count: number } | null = null;
  for (const [title, count] of counts) {
    if (!best || count > best.count) best = { title, count };
  }
  return best;
}

/**
 * @param completions afgeronde taken in de periode
 * @param tasks       taken gepland in de periode (open, overgeslagen, klaar)
 */
export function periodStats(
  completions: StatsCompletion[],
  tasks: StatsTask[],
  memberIds: string[],
): PeriodStats {
  const open = tasks.filter((t) => t.status === "todo" || t.status === "in_progress");
  const skipped = tasks.filter((t) => t.status === "skipped");
  const overdue = open.filter((t) => t.overdue);
  const late = completions.filter((c) => c.wasLate);

  const planned = completions.length + open.length + skipped.length;
  const members: MemberStats[] = memberIds.map((memberId) => {
    const done = completions.filter((c) => c.memberId === memberId);
    const mine = open.filter((t) => t.assignedMemberId === memberId);
    const total = done.length + mine.length;
    return {
      memberId,
      done: done.length,
      open: mine.length,
      overdue: mine.filter((t) => t.overdue).length,
      points: done.reduce((sum, c) => sum + c.points, 0),
      progress: total === 0 ? 1 : done.length / total,
    };
  });

  // "Vergeten" = te laat afgerond, overgeslagen of nu verlopen
  const forgotten = [
    ...late.map((c) => c.title),
    ...skipped.map((t) => t.title),
    ...overdue.map((t) => t.title),
  ];

  return {
    completed: completions.length,
    open: open.length,
    late: late.length,
    overdue: overdue.length,
    completionRate: planned === 0 ? null : completions.length / planned,
    mostDone: topBy(completions, (c) => c.title),
    mostForgotten: topBy(forgotten, (t) => t),
    averagePerMember: memberIds.length ? completions.length / memberIds.length : 0,
    totalPoints: completions.reduce((sum, c) => sum + c.points, 0),
    members,
  };
}
