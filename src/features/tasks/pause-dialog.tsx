"use client";

import * as React from "react";
import { addDays, todayIn } from "@/domain/dates";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { useHousehold } from "@/features/household/store";
import { pauseSeriesAction } from "@/server/actions/tasks";
import type { RecurrenceRow } from "@/types/database";

/** Terugkerende taak tijdelijk pauzeren; daarna gaat hij vanzelf weer door. */
export function PauseDialog({ series, open, onOpenChange }: { series: RecurrenceRow; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { snapshot, run } = useHousehold();
  const today = todayIn(snapshot.household.timezone);
  const [from, setFrom] = React.useState(series.paused_from ?? today);
  const [until, setUntil] = React.useState(series.paused_until ?? addDays(today, 30));
  const [busy, setBusy] = React.useState(false);
  const paused = !!(series.paused_from || series.paused_until);

  async function save(pausedFrom: string | null, pausedUntil: string | null, success: string) {
    setBusy(true);
    const ok = await run(() => pauseSeriesAction({ recurrenceId: series.id, pausedFrom, pausedUntil }), { success });
    setBusy(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>“{series.title}” pauzeren</DialogTitle>
          <DialogDescription>In deze periode worden geen taken ingepland. Daarna gaat het automatisch verder.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid grid-cols-2 gap-3">
          <Field label="Van">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Tot en met">
            <Input type="date" min={from} value={until} onChange={(e) => setUntil(e.target.value)} />
          </Field>
        </DialogBody>
        <DialogFooter>
          {paused && (
            <Button variant="outline" disabled={busy} onClick={() => void save(null, null, "Taak hervat")}>
              Nu hervatten
            </Button>
          )}
          <Button disabled={busy || !from || !until || until < from} onClick={() => void save(from, until, "Taak gepauzeerd")}>
            Pauzeren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
