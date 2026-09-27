"use client";

import { AlertTriangle, CheckCircle2, CircleDashed, Hourglass, ListTodo } from "lucide-react";
import { deadlineText } from "@/domain/status";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/features/tasks/selectors";

function Stat({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  tone?: "overdue" | "done";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-2xl border bg-card p-3 shadow-xs",
        tone === "overdue" && value > 0 && "border-overdue/30 bg-overdue-bg/50",
      )}
    >
      <Icon className={cn("size-4 text-muted-foreground", tone === "overdue" && value > 0 && "text-overdue", tone === "done" && "text-done")} />
      <span className="text-2xl leading-none font-bold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function DashboardSummary({ data, now, timeZone }: { data: DashboardData; now: Date; timeZone: string }) {
  const { summary } = data;
  const next = summary.nextDeadline;
  const progress = summary.todayCount ? summary.doneToday / summary.todayCount : 0;

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-4 gap-2">
        <Stat icon={ListTodo} value={summary.todayCount} label="vandaag" />
        <Stat icon={CheckCircle2} value={summary.doneToday} label="voltooid" tone="done" />
        <Stat icon={CircleDashed} value={summary.openToday} label="nog open" />
        <Stat icon={AlertTriangle} value={summary.overdueCount} label="verlopen" tone="overdue" />
      </div>
      {summary.todayCount > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-label={`${Math.round(progress * 100)}% van vandaag gedaan`}>
          <div className="h-full rounded-full bg-done transition-[width] duration-700" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      {next && (
        <p className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
          <Hourglass className="size-4" />
          Eerstvolgende deadline: <span className="font-medium text-foreground">{next.title}</span>
          <span>· {deadlineText({ status: next.status, scheduledDate: next.scheduled_date, dueAt: next.due_at }, now, timeZone)}</span>
        </p>
      )}
    </div>
  );
}
