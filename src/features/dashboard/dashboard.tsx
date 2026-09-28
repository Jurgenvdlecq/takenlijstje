"use client";

import { AlertTriangle, CalendarRange, PartyPopper, Plus, Sparkles, Sun } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { greeting } from "@/domain/status";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionTitle } from "@/components/ui/misc";
import { useSnapshot } from "@/features/household/store";
import { QuickAddBar } from "@/features/tasks/quick-add-bar";
import { dashboardData } from "@/features/tasks/selectors";
import { TaskList } from "@/features/tasks/task-card";
import { useTaskUi } from "@/features/tasks/task-ui-context";
import { useNow } from "@/hooks/use-now";
import { DashboardSummary } from "./summary";

export function Dashboard() {
  const snapshot = useSnapshot();
  const now = useNow();
  const { openNewTask } = useTaskUi();
  const tz = snapshot.household.timezone;
  const data = React.useMemo(() => dashboardData(snapshot, now), [snapshot, now]);
  const firstName = snapshot.me.display_name.split(" ")[0];
  const dateLabel = new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(now);
  const noTasksAtAll = snapshot.tasks.length === 0 && snapshot.recurrences.length === 0;
  const allDoneToday = data.summary.todayCount > 0 && data.summary.openToday === 0;

  return (
    <div className="grid gap-7">
      <section className="grid gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting(now, tz)}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground first-letter:uppercase">{dateLabel}</p>
        </div>
        <DashboardSummary data={data} now={now} timeZone={tz} />
        <QuickAddBar />
      </section>

      {noTasksAtAll && (
        <EmptyState
          icon={Sparkles}
          title="Nog geen taken"
          description="Voeg je eerste taak toe of kies uit de standaard huishoudtaken."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => openNewTask()}>
                <Plus /> Taak
              </Button>
              <Button variant="outline" asChild>
                <Link href="/instellingen#standaardtaken">Standaardtaken kiezen</Link>
              </Button>
            </div>
          }
        />
      )}

      {data.overdue.length > 0 && (
        <section>
          <SectionTitle count={data.overdue.length}>
            <AlertTriangle className="size-4 text-overdue" /> Verlopen
          </SectionTitle>
          <TaskList tasks={data.overdue} showDate />
        </section>
      )}

      <section>
        <SectionTitle
          count={data.todayTasks.length}
          action={
            <Button variant="ghost" size="sm" onClick={() => openNewTask({ date: data.today })}>
              <Plus /> Taak
            </Button>
          }
        >
          <Sun className="size-4" /> Vandaag
        </SectionTitle>
        {allDoneToday && (
          <div className="mb-2 flex items-center gap-2 rounded-2xl bg-done-bg px-4 py-3 text-sm font-medium text-done animate-fade-up">
            <PartyPopper className="size-4" /> Alles voor vandaag is gedaan. Top!
          </div>
        )}
        <TaskList
          tasks={data.todayTasks}
          empty={!noTasksAtAll && <p className="px-1 text-sm text-muted-foreground">Vandaag staat er niets gepland. 🌤️</p>}
        />
      </section>

      <section>
        <SectionTitle count={data.upcoming.length}>
          <CalendarRange className="size-4" /> Binnenkort
        </SectionTitle>
        <TaskList
          tasks={data.upcoming}
          showDate
          limit={6}
          empty={<p className="px-1 text-sm text-muted-foreground">De komende 7 dagen staat er (nog) niets gepland.</p>}
        />
      </section>

    </div>
  );
}
