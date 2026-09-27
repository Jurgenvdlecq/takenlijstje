"use client";

import { MoreVertical, Pause, Play, Repeat, Square } from "lucide-react";
import * as React from "react";
import { addDays, todayIn } from "@/domain/dates";
import { describeRule } from "@/domain/recurrence/rule";
import { MemberAvatar } from "@/components/member-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/misc";
import { useHousehold } from "@/features/household/store";
import { CATEGORY_ICONS, STRATEGY_LABELS } from "@/lib/labels";
import { pauseSeriesAction, stopSeriesAction } from "@/server/actions/tasks";
import type { MemberRow, RecurrenceRow } from "@/types/database";
import { formatDate, SettingsSection } from "./shared";

function pauseLabel(r: RecurrenceRow, today: string): string | null {
  if (!r.paused_from && !r.paused_until) return null;
  if (r.paused_until && r.paused_until < today) return null;
  if (r.paused_from && r.paused_from > today) {
    return r.paused_until
      ? `Pauze van ${formatDate(r.paused_from)} t/m ${formatDate(r.paused_until)}`
      : `Pauze vanaf ${formatDate(r.paused_from)}`;
  }
  return r.paused_until ? `Gepauzeerd t/m ${formatDate(r.paused_until)}` : "Gepauzeerd";
}

function assigneeInfo(r: RecurrenceRow, members: MemberRow[]): { text: string; people: MemberRow[] } {
  const byId = (id: string) => members.find((m) => m.id === id);
  switch (r.assignment_strategy) {
    case "fixed": {
      const m = r.fixed_member_id ? byId(r.fixed_member_id) : undefined;
      return { text: m?.display_name ?? "Onbekend", people: m ? [m] : [] };
    }
    case "rotation": {
      const people = r.rotation_member_ids.map(byId).filter((m): m is MemberRow => Boolean(m));
      return { text: people.map((m) => m.display_name).join(" → ") || "Iedereen", people };
    }
    case "none":
      return { text: "Wie tijd heeft", people: [] };
    default:
      return { text: "Iedereen", people: members.filter((m) => m.is_active) };
  }
}

export function RecurrencesSection() {
  const { snapshot, run } = useHousehold();
  const isAdmin = snapshot.me.role === "admin";
  const today = todayIn(snapshot.household.timezone);
  const [pausing, setPausing] = React.useState<RecurrenceRow | null>(null);

  const series = [...snapshot.recurrences].sort(
    (a, b) => Number(b.is_active) - Number(a.is_active) || a.title.localeCompare(b.title, "nl"),
  );
  const canManage = (r: RecurrenceRow) =>
    isAdmin || r.created_by_member_id === snapshot.me.id || snapshot.household.members_can_create_tasks;

  async function resume(r: RecurrenceRow) {
    await run(() => pauseSeriesAction({ recurrenceId: r.id, pausedFrom: null, pausedUntil: null }), {
      success: `“${r.title}” loopt weer`,
    });
  }

  async function stop(r: RecurrenceRow) {
    if (!window.confirm(`“${r.title}” stoppen? Er worden geen nieuwe taken meer gemaakt. Taken die al gepland staan blijven zichtbaar.`))
      return;
    await run(() => stopSeriesAction(r.id), { success: `“${r.title}” is gestopt` });
  }

  return (
    <SettingsSection
      id="terugkerend"
      icon={Repeat}
      title="Terugkerende taken"
      description="Alles wat automatisch terugkomt. Een reeks aanpassen doe je via een taak zelf."
    >
      {series.length === 0 ? (
        <EmptyState icon={Repeat} title="Nog geen terugkerende taken" description="Kies hieronder standaardtaken om snel te beginnen." />
      ) : (
        <ul className="grid gap-2">
          {series.map((r) => {
            const Icon = CATEGORY_ICONS[r.category];
            const paused = r.is_active ? pauseLabel(r, today) : null;
            const who = assigneeInfo(r, snapshot.members);
            return (
              <li key={r.id} className={r.is_active ? "flex items-center gap-3 rounded-2xl border p-3" : "flex items-center gap-3 rounded-2xl border border-dashed p-3 opacity-60"}>
                <div className="rounded-xl bg-muted p-2 text-muted-foreground">
                  <Icon className="size-4" />
                </div>
                <div className="grid min-w-0 flex-1 gap-1">
                  <span className="truncate font-medium">{r.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {describeRule(r.rule)} · {STRATEGY_LABELS[r.assignment_strategy].label}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {who.people.length > 0 && (
                      <span className="flex -space-x-1.5">
                        {who.people.slice(0, 5).map((m) => (
                          <MemberAvatar key={m.id} member={m} size="xs" ring />
                        ))}
                      </span>
                    )}
                    <span className="truncate text-xs text-muted-foreground">{who.text}</span>
                    {!r.is_active && <Badge variant="outline">Gestopt</Badge>}
                    {paused && <Badge variant="today">{paused}</Badge>}
                  </div>
                </div>
                {r.is_active && canManage(r) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Opties voor ${r.title}`}>
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {paused ? (
                        <DropdownMenuItem onSelect={() => void resume(r)}>
                          <Play />
                          Hervatten
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={() => setPausing(r)}>
                          <Pause />
                          Pauzeren
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => void stop(r)}>
                        <Square />
                        Stoppen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={pausing !== null} onOpenChange={(open) => !open && setPausing(null)}>
        <DialogContent>{pausing && <PauseForm series={pausing} today={today} onDone={() => setPausing(null)} />}</DialogContent>
      </Dialog>
    </SettingsSection>
  );
}

function PauseForm({ series, today, onDone }: { series: RecurrenceRow; today: string; onDone: () => void }) {
  const { run } = useHousehold();
  const [pausedFrom, setPausedFrom] = React.useState(today);
  const [pausedUntil, setPausedUntil] = React.useState(addDays(today, 14));
  const [saving, setSaving] = React.useState(false);
  const invalid = Boolean(pausedUntil) && pausedUntil < pausedFrom;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const ok = await run(
      () => pauseSeriesAction({ recurrenceId: series.id, pausedFrom: pausedFrom || null, pausedUntil: pausedUntil || null }),
      { success: `“${series.title}” is gepauzeerd` },
    );
    setSaving(false);
    if (ok) onDone();
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>“{series.title}” pauzeren</DialogTitle>
        <DialogDescription>In deze periode worden er geen taken voor gemaakt. Laat de einddatum leeg om voor onbepaalde tijd te pauzeren.</DialogDescription>
      </DialogHeader>
      <DialogBody className="grid grid-cols-2 gap-3">
        <Field label="Vanaf" htmlFor="pauze-van">
          <Input id="pauze-van" type="date" value={pausedFrom} required onChange={(e) => setPausedFrom(e.target.value)} />
        </Field>
        <Field label="Tot en met" htmlFor="pauze-tot" error={invalid ? "Kies een datum na de begindatum" : null}>
          <Input id="pauze-tot" type="date" value={pausedUntil} min={pausedFrom} onChange={(e) => setPausedUntil(e.target.value)} />
        </Field>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost">
            Annuleren
          </Button>
        </DialogClose>
        <Button type="submit" disabled={saving || invalid || !pausedFrom}>
          {saving ? "Bezig…" : "Pauzeren"}
        </Button>
      </DialogFooter>
    </form>
  );
}
