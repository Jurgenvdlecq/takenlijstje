"use client";

import * as React from "react";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useHousehold } from "@/features/household/store";
import { updateTaskAction } from "@/server/actions/tasks";
import type { TaskRow } from "@/types/database";
import { ScopeDialog } from "./scope-dialog";
import { TaskForm, type TaskFormValues } from "./task-form";
import { fromTask, toUpdateChanges } from "./task-form-mapping";

export function EditTaskDialog({ task, open, onOpenChange }: { task: TaskRow; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { snapshot, run } = useHousehold();
  const series = snapshot.recurrences.find((r) => r.id === task.recurrence_id);
  const initial = React.useMemo(() => fromTask(task, series, snapshot.household.timezone), [task, series, snapshot.household.timezone]);
  const [busy, setBusy] = React.useState(false);
  const [pending, setPending] = React.useState<{ changes: ReturnType<typeof toUpdateChanges> } | null>(null);

  async function save(scope: "this" | "future", diff: ReturnType<typeof toUpdateChanges>) {
    setBusy(true);
    const result = await run(() => updateTaskAction({ taskId: task.id, scope, changes: diff.changes }), {
      success: scope === "future" ? "Deze en toekomstige taken aangepast" : "Taak aangepast",
    });
    setBusy(false);
    setPending(null);
    if (result) onOpenChange(false);
  }

  function submit(values: TaskFormValues) {
    const diff = toUpdateChanges(initial, values);
    if (diff.empty) {
      toast("Niets gewijzigd");
      onOpenChange(false);
      return;
    }
    if (task.recurrence_id) setPending({ changes: diff });
    else void save("this", diff);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Taak wijzigen</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {open && (
              <TaskForm initial={initial} submitLabel="Opslaan" busy={busy} onSubmit={submit} onCancel={() => onOpenChange(false)} />
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
      <ScopeDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title="Wat wil je aanpassen?"
        onlyFuture={pending?.changes.seriesLevel}
        onChoose={(scope) => pending && void save(scope, pending.changes)}
      />
    </>
  );
}
