"use client";

import { Plane, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { addDays, todayIn } from "@/domain/dates";
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
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/misc";
import { useHousehold } from "@/features/household/store";
import { ABSENCE_STRATEGY_LABELS } from "@/lib/labels";
import { createAbsenceAction, deleteAbsenceAction } from "@/server/actions/household";
import type { AbsenceRow, AbsenceStrategy } from "@/types/database";
import { formatRange, SettingsSection } from "./shared";

export function AbsenceSection() {
  const { snapshot, run } = useHousehold();
  const isAdmin = snapshot.me.role === "admin";
  const today = todayIn(snapshot.household.timezone);
  const [open, setOpen] = React.useState(false);

  const absences = snapshot.absences
    .filter((a) => isAdmin || a.member_id === snapshot.me.id)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on));

  async function remove(absence: AbsenceRow) {
    if (!window.confirm("Deze afwezigheid verwijderen?")) return;
    await run(() => deleteAbsenceAction(absence.id), { success: "Afwezigheid verwijderd" });
  }

  return (
    <SettingsSection
      id="afwezigheid"
      icon={Plane}
      title="Afwezigheid"
      description="Op vakantie of een weekje weg? Dan schuiven je taken door of gaan ze naar een ander."
    >
      <div className="grid gap-3">
        {absences.length === 0 ? (
          <EmptyState icon={Plane} title="Geen afwezigheid gepland" description="Voeg een periode toe als je er even niet bent." />
        ) : (
          <ul className="grid gap-2">
            {absences.map((absence) => {
              const member = snapshot.members.find((m) => m.id === absence.member_id);
              const past = absence.ends_on < today;
              const current = absence.starts_on <= today && !past;
              return (
                <li key={absence.id} className="flex items-center gap-3 rounded-2xl border p-3">
                  <MemberAvatar member={member} size="md" />
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium">{formatRange(absence.starts_on, absence.ends_on)}</span>
                      {current && <Badge variant="today">Nu afwezig</Badge>}
                      {past && <Badge variant="outline">Voorbij</Badge>}
                    </div>
                    <span className="truncate text-xs text-muted-foreground">
                      {isAdmin && member ? `${member.display_name} · ` : ""}
                      {ABSENCE_STRATEGY_LABELS[absence.strategy]}
                      {absence.note ? ` · ${absence.note}` : ""}
                    </span>
                  </div>
                  {(isAdmin || absence.member_id === snapshot.me.id) && (
                    <Button variant="ghost" size="icon" aria-label="Afwezigheid verwijderen" onClick={() => void remove(absence)}>
                      <Trash2 className="text-muted-foreground" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Button variant="outline" className="justify-self-start" onClick={() => setOpen(true)}>
          <Plus />
          Afwezigheid toevoegen
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {open && <AbsenceForm today={today} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}

function AbsenceForm({ today, onDone }: { today: string; onDone: () => void }) {
  const { snapshot, run } = useHousehold();
  const isAdmin = snapshot.me.role === "admin";
  const [memberId, setMemberId] = React.useState(snapshot.me.id);
  const [startsOn, setStartsOn] = React.useState(today);
  const [endsOn, setEndsOn] = React.useState(addDays(today, 7));
  const [strategy, setStrategy] = React.useState<AbsenceStrategy>("reassign");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const invalid = endsOn < startsOn;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const count = await run(() => createAbsenceAction({ memberId, startsOn, endsOn, strategy, note }));
    setSaving(false);
    if (count === null) return;
    const verb = strategy === "postpone" ? "doorgeschoven" : strategy === "unassign" ? "vrijgegeven" : "opnieuw verdeeld";
    toast.success("Afwezigheid opgeslagen", {
      description: count === 0 ? "Er vielen geen taken in deze periode." : `${count} ${count === 1 ? "taak" : "taken"} ${verb}.`,
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>Afwezigheid toevoegen</DialogTitle>
        <DialogDescription>Taken in deze periode worden automatisch aangepast.</DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4">
        {isAdmin && (
          <Field label="Wie is er weg?" htmlFor="afw-lid">
            <NativeSelect id="afw-lid" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              {snapshot.members
                .filter((m) => m.is_active)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                    {m.id === snapshot.me.id ? " (ik)" : ""}
                  </option>
                ))}
            </NativeSelect>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Van" htmlFor="afw-van">
            <Input id="afw-van" type="date" value={startsOn} required onChange={(e) => setStartsOn(e.target.value)} />
          </Field>
          <Field label="Tot en met" htmlFor="afw-tot" error={invalid ? "Kies een datum na de begindatum" : null}>
            <Input id="afw-tot" type="date" value={endsOn} min={startsOn} required onChange={(e) => setEndsOn(e.target.value)} />
          </Field>
        </div>
        <Field label="Wat moet er met de taken gebeuren?" htmlFor="afw-strategie">
          <NativeSelect id="afw-strategie" value={strategy} onChange={(e) => setStrategy(e.target.value as AbsenceStrategy)}>
            {(Object.keys(ABSENCE_STRATEGY_LABELS) as AbsenceStrategy[]).map((key) => (
              <option key={key} value={key}>
                {ABSENCE_STRATEGY_LABELS[key]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Notitie (optioneel)" htmlFor="afw-notitie">
          <Input id="afw-notitie" value={note} maxLength={200} placeholder="Bijv. Vakantie in Frankrijk" onChange={(e) => setNote(e.target.value)} />
        </Field>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost">
            Annuleren
          </Button>
        </DialogClose>
        <Button type="submit" disabled={saving || invalid || !startsOn || !endsOn}>
          {saving ? "Bezig…" : "Opslaan"}
        </Button>
      </DialogFooter>
    </form>
  );
}
