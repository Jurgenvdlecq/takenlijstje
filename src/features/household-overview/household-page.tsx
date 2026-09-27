"use client";

import { AlertTriangle, CalendarOff, CheckCircle2, CircleDashed, Clock, Flame, Percent, Sparkles } from "lucide-react";
import * as React from "react";
import { addDays, startOfIsoWeek, todayIn, zonedDate, zonedInstant } from "@/domain/dates";
import { taskPoints } from "@/domain/assignment/load";
import { isOverdue, relativeDayLabel } from "@/domain/status";
import { periodStats } from "@/domain/stats";
import { MemberAvatar } from "@/components/member-avatar";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, SectionTitle } from "@/components/ui/misc";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSnapshot } from "@/features/household/store";
import { PointsGoal } from "@/features/dashboard/points-goal";
import { useNow } from "@/hooks/use-now";
import { ABSENCE_STRATEGY_LABELS } from "@/lib/labels";

type Period = "week" | "lastWeek" | "month";

/** Gezinsdashboard: per persoon wat er open staat en wat gedaan is. Informatief, niet competitief. */
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

  const data = React.useMemo(() => {
    const fromInstant = zonedInstant(range.from, "00:00", tz);
    const toInstant = zonedInstant(addDays(range.to, 1), "00:00", tz);
    const completions = snapshot.completions.filter((c) => c.completed_at >= fromInstant && c.completed_at < toInstant);
    const tasks = snapshot.tasks.filter((t) => t.scheduled_date >= range.from && t.scheduled_date <= range.to && t.status !== "done");
    const memberIds = snapshot.members.filter((m) => m.is_active).map((m) => m.id);
    const stats = periodStats(
      completions.map((c) => ({
        memberId: c.member_id,
        title: c.title,
        recurrenceId: c.recurrence_id,
        completedAt: c.completed_at,
        wasLate: c.was_late,
        points: c.points,
      })),
      tasks.map((t) => ({
        id: t.id,
        title: t.title,
        recurrenceId: t.recurrence_id,
        assignedMemberId: t.assigned_member_id,
        status: t.status,
        scheduledDate: t.scheduled_date,
        overdue: isOverdue({ status: t.status, scheduledDate: t.scheduled_date, dueAt: t.due_at }, now, tz),
      })),
      memberIds,
    );
    // Totale belasting = gedane punten + punten van nog openstaande taken in de periode
    const openLoad = new Map<string, number>();
    for (const t of tasks) {
      if (t.assigned_member_id && (t.status === "todo" || t.status === "in_progress")) {
        openLoad.set(t.assigned_member_id, (openLoad.get(t.assigned_member_id) ?? 0) + taskPoints({ points: t.points, durationMinutes: t.duration_minutes }));
      }
    }
    return { stats, openLoad };
  }, [snapshot, range, now, tz]);

  const { stats, openLoad } = data;
  const maxLoad = Math.max(1, ...stats.members.map((m) => m.points + (openLoad.get(m.memberId) ?? 0)));
  const absences = snapshot.absences.filter((a) => a.ends_on >= today).sort((a, b) => a.starts_on.localeCompare(b.starts_on));

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

      <section>
        <SectionTitle>Per persoon</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          {stats.members.map((m) => {
            const member = snapshot.members.find((x) => x.id === m.memberId)!;
            const load = m.points + (openLoad.get(m.memberId) ?? 0);
            const absent = absences.find((a) => a.member_id === m.memberId && a.starts_on <= today);
            return (
              <Card key={m.memberId}>
                <CardContent className="grid gap-3 pt-4">
                  <div className="flex items-center gap-3">
                    <MemberAvatar member={member} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{member.display_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.done} gedaan · {m.open} open
                        {m.overdue > 0 && <span className="text-overdue"> · {m.overdue} verlopen</span>}
                      </p>
                    </div>
                    {absent && (
                      <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                        <CalendarOff className="size-3" /> afwezig
                      </span>
                    )}
                  </div>
                  <div className="grid gap-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Voortgang</span>
                      <span>{Math.round(m.progress * 100)}%</span>
                    </div>
                    <Progress value={m.progress} color={member.color} />
                  </div>
                  <div className="grid gap-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Taakbelasting</span>
                      <span>
                        {load} {load === 1 ? "punt" : "punten"}
                      </span>
                    </div>
                    <Progress value={load / maxLoad} className="h-1.5" color="var(--muted-foreground)" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-xs text-muted-foreground">
          Taakbelasting telt hoe zwaar taken zijn (5 min = 1 punt, 30 min = 3, 60 min = 6). Zo verdeelt de app eerlijker.
        </p>
      </section>

      <PointsGoal snapshot={snapshot} since={`${today.slice(0, 8)}01T00:00:00`} />

      <section className="grid gap-2 sm:grid-cols-3">
        <InsightCard icon={Flame} title="Meest gedaan" value={stats.mostDone ? `${stats.mostDone.title} (${stats.mostDone.count}×)` : "–"} />
        <InsightCard
          icon={AlertTriangle}
          title="Meest vergeten"
          value={stats.mostForgotten ? `${stats.mostForgotten.title} (${stats.mostForgotten.count}×)` : "Niets vergeten 🎉"}
        />
        <InsightCard icon={Sparkles} title="Gemiddeld per persoon" value={`${stats.averagePerMember.toFixed(1).replace(".", ",")} taken`} />
      </section>

      {absences.length > 0 && (
        <section>
          <SectionTitle>Afwezig</SectionTitle>
          <div className="grid gap-2">
            {absences.map((a) => {
              const member = snapshot.members.find((m) => m.id === a.member_id);
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-2xl border bg-card px-3.5 py-3">
                  <MemberAvatar member={member} size="sm" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">{member?.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {relativeDayLabel(a.starts_on, today)} t/m {relativeDayLabel(a.ends_on, today).toLowerCase()} ·{" "}
                      {ABSENCE_STRATEGY_LABELS[a.strategy].toLowerCase()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

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
