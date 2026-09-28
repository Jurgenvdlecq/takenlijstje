"use client";

import { AlertTriangle, ListChecks, Plus, Search, SearchX } from "lucide-react";
import * as React from "react";
import { todayIn } from "@/domain/dates";
import { relativeDayLabel } from "@/domain/status";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionTitle } from "@/components/ui/misc";
import { useSnapshot } from "@/features/household/store";
import { compareTasks, DEFAULT_FILTERS, filterTasks, toViews, type TaskFilters, type TaskView } from "@/features/tasks/selectors";
import { TaskList } from "@/features/tasks/task-card";
import { useTaskUi } from "@/features/tasks/task-ui-context";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";
import { TaskFiltersButton } from "./task-filters";

const QUICK = [
  { key: "open", label: "Open" },
  { key: "overdue", label: "Verlopen" },
  { key: "done", label: "Voltooid" },
  { key: "all", label: "Alles" },
] as const;

type QuickKey = (typeof QUICK)[number]["key"];

function quickFilters(key: QuickKey, search: string): TaskFilters {
  const base = { ...DEFAULT_FILTERS, search };
  switch (key) {
    case "open":
      return base;
    case "overdue":
      return { ...base, status: "overdue" };
    case "done":
      return { ...base, status: "done" };
    case "all":
      return { ...base, status: "all" };
  }
}

export function TaskListPage() {
  const snapshot = useSnapshot();
  const now = useNow();
  const { openNewTask } = useTaskUi();
  const tz = snapshot.household.timezone;
  const today = todayIn(tz, now);
  const [quick, setQuick] = React.useState<QuickKey | null>("open");
  const [filters, setFilters] = React.useState<TaskFilters>(DEFAULT_FILTERS);

  const views = React.useMemo(() => toViews(snapshot.tasks, now, tz), [snapshot.tasks, now, tz]);
  const results = React.useMemo(() => {
    const list = filterTasks(views, filters).sort(compareTasks);
    // Voltooid: nieuwste eerst
    return filters.status === "done" ? list.reverse() : list;
  }, [views, filters]);

  // Groeperen: verlopen, dan per dag
  const groups = React.useMemo(() => {
    const overdue = results.filter((t) => t.display === "overdue");
    const byDate = new Map<string, TaskView[]>();
    for (const t of results) {
      if (t.display === "overdue") continue;
      byDate.set(t.scheduled_date, [...(byDate.get(t.scheduled_date) ?? []), t]);
    }
    return { overdue, days: [...byDate.entries()] };
  }, [results]);

  return (
    <div>
      <PageHeader
        title="Taken"
        subtitle={`${results.length} ${results.length === 1 ? "taak" : "taken"}`}
        actions={
          <Button onClick={() => openNewTask()} size="sm">
            <Plus /> Taak
          </Button>
        }
      />

      <div className="sticky top-14 z-20 -mx-4 mb-4 grid gap-3 bg-background/90 px-4 py-2 backdrop-blur">
        <div className="flex gap-2">
          <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border bg-card px-3.5 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
            <Search className="size-4 text-muted-foreground" />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Zoek een taak"
              className="h-full min-w-0 flex-1 bg-transparent text-base outline-none md:text-sm"
            />
          </label>
          <TaskFiltersButton
            filters={filters}
            onChange={(f) => {
              setFilters(f);
              setQuick(null);
            }}
          />
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none]">
          {QUICK.map((q) => (
            <button
              key={q.key}
              type="button"
              aria-pressed={quick === q.key}
              onClick={() => {
                setQuick(q.key);
                setFilters((f) => quickFilters(q.key, f.search));
              }}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition",
                quick === q.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
              )}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {results.length === 0 ? (
        filters.search || quick !== "open" ? (
          <EmptyState icon={SearchX} title="Geen taken gevonden" description="Probeer een andere zoekterm of filter." />
        ) : (
          <EmptyState
            icon={ListChecks}
            title="Alles is gedaan"
            description="Er staan geen open taken. Tijd voor iets leuks!"
            action={
              <Button onClick={() => openNewTask()}>
                <Plus /> Taak toevoegen
              </Button>
            }
          />
        )
      ) : (
        <div className="grid gap-6">
          {groups.overdue.length > 0 && (
            <section>
              <SectionTitle count={groups.overdue.length}>
                <AlertTriangle className="size-4 text-overdue" /> Verlopen
              </SectionTitle>
              <TaskList tasks={groups.overdue} showDate />
            </section>
          )}
          {groups.days.map(([date, tasks]) => (
            <section key={date}>
              <SectionTitle count={tasks.length}>{relativeDayLabel(date, today)}</SectionTitle>
              <TaskList tasks={tasks} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
