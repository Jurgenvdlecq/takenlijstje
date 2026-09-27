"use client";

import {
  ArrowLeftRight,
  CalendarClock,
  CheckIcon,
  Clock,
  Hourglass,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Repeat,
  RotateCcw,
  SkipForward,
  Trash2,
  Trophy,
  UserRound,
} from "lucide-react";
import * as React from "react";
import { todayIn, zonedDate } from "@/domain/dates";
import { describeRule } from "@/domain/recurrence/rule";
import { deadlineText, displayStatus, PRIORITY_LABELS, relativeDayLabel, STATUS_LABELS } from "@/domain/status";
import { MemberAvatar } from "@/components/member-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NativeSelect } from "@/components/ui/input";
import { useHousehold } from "@/features/household/store";
import { useNow } from "@/hooks/use-now";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "@/lib/labels";
import { acceptSwapAction, cancelSwapAction, deleteTaskAction } from "@/server/actions/tasks";
import type { TaskRow } from "@/types/database";
import { CannotDoDialog } from "./cannot-do-dialog";
import { EditTaskDialog } from "./edit-task-dialog";
import { PauseDialog } from "./pause-dialog";
import { ScopeDialog } from "./scope-dialog";
import { TaskComments } from "./task-comments";
import { TaskHistory } from "./task-history";
import { useTaskUi } from "./task-ui-context";
import { useTaskActions } from "./use-task-actions";

const STATUS_VARIANT = { todo: "default", in_progress: "progress", done: "done", overdue: "overdue", skipped: "outline" } as const;

export function TaskDetailSheet() {
  const { openTaskId, closeTask } = useTaskUi();
  const { snapshot } = useHousehold();
  const task = openTaskId ? snapshot.tasks.find((t) => t.id === openTaskId) : undefined;

  return (
    <Dialog open={!!openTaskId} onOpenChange={(o) => !o && closeTask()}>
      <DialogContent aria-describedby={undefined}>
        {task ? (
          <TaskDetail task={task} />
        ) : (
          <DialogHeader>
            <DialogTitle>Taak niet gevonden</DialogTitle>
            <DialogDescription>Deze taak is verwijderd of valt buiten de geladen periode.</DialogDescription>
          </DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="w-28 shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1 text-sm font-medium">{children}</div>
    </div>
  );
}

function TaskDetail({ task }: { task: TaskRow }) {
  const { snapshot, run } = useHousehold();
  const { closeTask } = useTaskUi();
  const actions = useTaskActions();
  const now = useNow();
  const tz = snapshot.household.timezone;
  const today = todayIn(tz, now);

  const [editing, setEditing] = React.useState(false);
  const [pausing, setPausing] = React.useState(false);
  const [cannotDo, setCannotDo] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const series = snapshot.recurrences.find((r) => r.id === task.recurrence_id);
  const assignee = snapshot.members.find((m) => m.id === task.assigned_member_id);
  const completedBy = snapshot.members.find((m) => m.id === task.completed_by_member_id);
  const status = displayStatus({ status: task.status, scheduledDate: task.scheduled_date, dueAt: task.due_at }, now, tz);
  const deadline = deadlineText({ status: task.status, scheduledDate: task.scheduled_date, dueAt: task.due_at }, now, tz);
  const swap = snapshot.swapRequests.find((r) => r.task_id === task.id);
  const swapBy = swap && snapshot.members.find((m) => m.id === swap.requested_by_member_id);
  const done = task.status === "done";
  const open = task.status === "todo" || task.status === "in_progress";
  const CategoryIcon = CATEGORY_ICONS[task.category];
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(iso));

  async function remove(scope: "this" | "future") {
    const ok = await run(() => deleteTaskAction(task.id, scope), {
      success: scope === "future" ? "Taak en toekomstige herhalingen verwijderd" : "Taak verwijderd",
    });
    setDeleting(false);
    if (ok !== null) closeTask();
  }

  return (
    <>
      <DialogHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>
          {task.priority !== "normal" && (
            <Badge variant={task.priority === "urgent" ? "overdue" : task.priority === "high" ? "today" : "outline"}>
              {PRIORITY_LABELS[task.priority]}
            </Badge>
          )}
          {series && (
            <Badge variant="primary">
              <Repeat /> {describeRule(series.rule)}
            </Badge>
          )}
        </div>
        <DialogTitle className="mt-1 text-xl">{task.title}</DialogTitle>
        {task.description && <DialogDescription className="whitespace-pre-wrap">{task.description}</DialogDescription>}
      </DialogHeader>

      <DialogBody className="grid gap-5">
        {/* Hoofdactie: met één tik afvinken */}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          {done ? (
            <Button size="lg" variant="secondary" onClick={() => void actions.undo(task.id)}>
              <RotateCcw /> Afvinken ongedaan maken
            </Button>
          ) : (
            <Button
              size="lg"
              className="bg-done text-white hover:bg-done/90"
              disabled={task.status === "skipped"}
              onClick={async () => {
                const ok = await actions.complete(task);
                if (ok) closeTask();
              }}
            >
              <CheckIcon strokeWidth={3} /> Afvinken
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="lg" variant="outline" className="px-4" aria-label="Meer acties">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil /> Bewerken
              </DropdownMenuItem>
              {open && task.status === "todo" && (
                <DropdownMenuItem onSelect={() => void actions.start(task.id)}>
                  <Play /> Ik ben ermee bezig
                </DropdownMenuItem>
              )}
              {task.status === "in_progress" && (
                <DropdownMenuItem onSelect={() => void actions.reopen(task.id)}>
                  <RotateCcw /> Niet meer bezig
                </DropdownMenuItem>
              )}
              {open && (
                <DropdownMenuItem onSelect={() => void actions.skip(task.id)}>
                  <SkipForward /> Deze keer overslaan
                </DropdownMenuItem>
              )}
              {task.status === "skipped" && (
                <DropdownMenuItem onSelect={() => void actions.reopen(task.id)}>
                  <RotateCcw /> Toch nog doen
                </DropdownMenuItem>
              )}
              {open && (
                <DropdownMenuItem onSelect={() => setCannotDo(true)}>
                  <ArrowLeftRight /> Ik kan deze taak niet doen
                </DropdownMenuItem>
              )}
              {series && (
                <DropdownMenuItem onSelect={() => setPausing(true)}>
                  <Pause /> Reeks pauzeren
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => (series ? setDeleting(true) : void remove("this"))}
              >
                <Trash2 /> Verwijderen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {swap && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-accent p-3 text-sm">
            <ArrowLeftRight className="size-4 text-accent-foreground" />
            <p className="flex-1">
              <strong>{swapBy?.display_name ?? "Iemand"}</strong> wil deze taak ruilen
              {swap.message ? `: “${swap.message}”` : "."}
            </p>
            {swap.requested_by_member_id === snapshot.me.id ? (
              <Button size="sm" variant="outline" onClick={() => void run(() => cancelSwapAction(swap.id), { success: "Ruilverzoek ingetrokken" })}>
                Intrekken
              </Button>
            ) : (
              <Button size="sm" onClick={() => void run(() => acceptSwapAction(swap.id), { success: "Je hebt de taak overgenomen" })}>
                Overnemen
              </Button>
            )}
          </div>
        )}

        <div className="divide-y rounded-2xl border px-3.5">
          <InfoRow icon={UserRound} label="Wie">
            {open ? (
              <div className="flex items-center gap-2">
                <MemberAvatar member={assignee} size="xs" />
                <NativeSelect
                  aria-label="Toewijzen aan"
                  className="h-9 border-none bg-transparent px-0 pr-7 shadow-none"
                  value={task.assigned_member_id ?? ""}
                  onChange={(e) => void actions.assign(task.id, e.target.value || null)}
                >
                  <option value="">Niet toegewezen</option>
                  {snapshot.members
                    .filter((m) => m.is_active || m.id === task.assigned_member_id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.display_name}
                      </option>
                    ))}
                </NativeSelect>
              </div>
            ) : (
              <span className="flex items-center gap-2">
                <MemberAvatar member={assignee} size="xs" />
                {assignee?.display_name ?? "Niet toegewezen"}
              </span>
            )}
          </InfoRow>
          <InfoRow icon={CalendarClock} label="Wanneer">
            {open ? (
              <label className="relative inline-flex cursor-pointer items-center gap-1 text-primary">
                {relativeDayLabel(task.scheduled_date, today)}
                {task.scheduled_time ? `, ${task.scheduled_time.slice(0, 5)}` : ""}
                <span className="text-xs font-normal text-muted-foreground">(verplaatsen)</span>
                <input
                  type="date"
                  aria-label="Verplaatsen naar"
                  value={task.scheduled_date}
                  onChange={(e) => e.target.value && void actions.move(task.id, e.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
            ) : (
              <>
                {relativeDayLabel(task.scheduled_date, today)}
                {task.scheduled_time ? `, ${task.scheduled_time.slice(0, 5)}` : ""}
              </>
            )}
          </InfoRow>
          {task.available_from && zonedDate(task.available_from, tz) < task.scheduled_date && (
            <InfoRow icon={Clock} label="Beschikbaar">
              vanaf {relativeDayLabel(zonedDate(task.available_from, tz), today).toLowerCase()}
            </InfoRow>
          )}
          {task.due_at && (
            <InfoRow icon={Hourglass} label="Uiterlijk">
              <span className={status === "overdue" ? "text-overdue" : undefined}>
                {fmt(task.due_at)}
                {deadline && <span className="block text-xs font-normal text-muted-foreground">{deadline}</span>}
              </span>
            </InfoRow>
          )}
          {task.duration_minutes && (
            <InfoRow icon={Clock} label="Duur">
              ± {task.duration_minutes} minuten
            </InfoRow>
          )}
          {snapshot.household.points_enabled && (
            <InfoRow icon={Trophy} label="Punten">
              {task.points ?? Math.max(1, Math.round((task.duration_minutes ?? 10) / 10))}
            </InfoRow>
          )}
          <InfoRow icon={CategoryIcon} label="Categorie">
            {CATEGORY_LABELS[task.category]}
          </InfoRow>
          {done && task.completed_at && (
            <InfoRow icon={CheckIcon} label="Gedaan">
              {fmt(task.completed_at)} door {completedBy?.display_name ?? "onbekend"}
            </InfoRow>
          )}
          {series?.paused_from && series.paused_until && series.paused_until >= today && (
            <InfoRow icon={Pause} label="Gepauzeerd">
              {relativeDayLabel(series.paused_from, today)} t/m {relativeDayLabel(series.paused_until, today).toLowerCase()}
            </InfoRow>
          )}
        </div>

        <TaskComments taskId={task.id} />
        <TaskHistory taskId={task.id} recurrenceId={task.recurrence_id} />
      </DialogBody>

      <EditTaskDialog task={task} open={editing} onOpenChange={setEditing} />
      {series && <PauseDialog series={series} open={pausing} onOpenChange={setPausing} />}
      <CannotDoDialog task={task} open={cannotDo} onOpenChange={setCannotDo} />
      <ScopeDialog open={deleting} onOpenChange={setDeleting} title="Wat wil je verwijderen?" destructive onChoose={(scope) => void remove(scope)} />
    </>
  );
}
