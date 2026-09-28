"use client";

import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Flame, Percent } from "lucide-react";
import * as React from "react";
import { addDays, startOfIsoWeek, todayIn, zonedDate, zonedInstant } from "@/domain/dates";
import { isOverdue, relativeDayLabel } from "@/domain/status";
import { periodStats } from "@/domain/stats";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSnapshot } from "@/features/household/store";
import { useNow } from "@/hooks/use-now";

type Period = "week" | "lastWeek" | "month";

/** Gezinsdashboard: wat er in het huishouden gedaan is en open staat. Zonder cijfers per persoon (V-21). */
export function HouseholdPage() {
  const snapshot = useSnapshot();
  const now = useNow();
  const tz = snapshot.household.timezone;
  const today = todayIn(tz, now);
  const [period, setPeriod] = React.useState<Period>("week");

  const range = React.useMemo(() => {
    const week = startOfIsoWeek(today);
    if (period === "week") return { from: week, to: addDays(week, 6) };
    if (period === "lastWeek") return { from: addDays(week, -7), to: addDays(week, -1) };
    return { from: addDays(today, -29), to: today };
  }, [period, today]);

  const stats = React.useMemo(() => {
    const fromInstant = zonedInstant(range.from, "00:00", tz);
    const toInstant = zonedInstant(addDays(range.to, 1), "00:00", tz);
    const completions = snapshot.completions.filter((c) => c.completed_at >= fromInstant && c.completed_at < toInstant);
    const tasks = snapshot.tasks.filter((t) => t.scheduled_date >= range.from && t.scheduled_date <= range.to && t.status !== "done");
    return periodStats(
      completions.map((c) => ({
        title: c.title,
        recurrenceId: c.recurrence_id,
        completedAt: c.completed_at,
        wasLate: c.was_late,
      })),
      tasks.map((t) => ({
        id: t.id,
        title: t.title,
        recurrenceId: t.recurrence_id,
        status: t.status,
        scheduledDate: t.scheduled_date,
        overdue: isOverdue({ status: t.status, scheduledDate: t.scheduled_date, dueAt: t.due_at }, now, tz),
      })),
    );
  }, [snapshot, range, now, tz]);

  return (
    <div className="grid gap-6">
      <PageHeader title="Huishouden" subtitle={snapshot.household.name} />

      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <TabsList className="w-full">
          <TabsTrigger value="week">Deze week</TabsTrigger>
          <TabsTrigger value="lastWeek">Vorige week</TabsTrigger>
          <TabsTrigger value="month">30 dagen</TabsTrigger>
        </TabsList>
      </Tabs>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile icon={CheckCircle2} label="taken afgerond" value={String(stats.completed)} tone="done" />
        <StatTile icon={CircleDashed} label="taken open" value={String(stats.open)} />
        <StatTile icon={Clock} label="te laat gedaan" value={String(stats.late)} tone={stats.late ? "overdue" : undefined} />
        <StatTile
          icon={Percent}
          label="gemiddelde voltooiing"
          value={stats.completionRate === null ? "–" : `${Math.round(stats.completionRate * 100)}%`}
        />
      </section>

      <section className="grid gap-2 sm:grid-cols-2">
        <InsightCard icon={Flame} title="Meest gedaan" value={stats.mostDone ? `${stats.mostDone.title} (${stats.mostDone.count}×)` : "–"} />
        <InsightCard
          icon={AlertTriangle}
          title="Meest vergeten"
          value={stats.mostForgotten ? `${stats.mostForgotten.title} (${stats.mostForgotten.count}×)` : "Niets vergeten 🎉"}
        />
      </section>

      <p className="px-1 text-center text-xs text-muted-foreground">
        Laatst bijgewerkt {relativeDayLabel(zonedDate(snapshot.loadedAt, tz), today).toLowerCase()}{" "}
        {new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(snapshot.loadedAt))}
      </p>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "done" | "overdue";
}) {
  return (
    <div className="rounded-2xl border bg-card p-3.5 shadow-xs">
      <Icon className={tone === "done" ? "size-4 text-done" : tone === "overdue" ? "size-4 text-overdue" : "size-4 text-muted-foreground"} />
      <p className="mt-1.5 text-2xl leading-none font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function InsightCard({ icon: Icon, title, value }: { icon: React.ComponentType<{ className?: string }>; title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="size-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 font-semibold">{value}</CardContent>
    </Card>
  );
}
