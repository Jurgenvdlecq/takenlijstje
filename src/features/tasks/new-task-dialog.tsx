"use client";

import * as React from "react";
import { todayIn } from "@/domain/dates";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useHousehold } from "@/features/household/store";
import { newId } from "@/lib/utils";
import { createTaskAction } from "@/server/actions/tasks";
import { emptyValues, TaskForm, type TaskFormValues } from "./task-form";
import { toCreateInput } from "./task-form-mapping";
import { useTaskUi } from "./task-ui-context";

/** Het "+ Taak"-venster. */
export function NewTaskDialog() {
  const { newTask, closeNewTask } = useTaskUi();
  const { snapshot, run } = useHousehold();
  const [busy, setBusy] = React.useState(false);
  // Eén id per geopend venster: dubbel tikken op "Toevoegen" maakt geen twee taken of reeksen
  const idRef = React.useRef(newId());
  const recurrenceIdRef = React.useRef(newId());

  const open = newTask !== null;
  const today = todayIn(snapshot.household.timezone);
  const initial: TaskFormValues = React.useMemo(
    () => ({
      ...emptyValues(today),
      title: newTask?.title ?? "",
      date: newTask?.date ?? today,
      time: newTask?.time ?? "",
    }),
    [newTask, today],
  );

  async function submit(values: TaskFormValues) {
    setBusy(true);
    const created = await run(() => createTaskAction(toCreateInput(values, idRef.current, recurrenceIdRef.current)), {
      success: values.recurring ? "Terugkerende taak ingepland" : "Taak toegevoegd",
    });
    setBusy(false);
    if (created) {
      idRef.current = newId();
      recurrenceIdRef.current = newId();
      closeNewTask();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeNewTask()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Nieuwe taak</DialogTitle>
          <DialogDescription className="sr-only">Vul in wat er moet gebeuren en wanneer.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {open && (
            <TaskForm
              key={JSON.stringify(newTask)}
              initial={initial}
              smartTitle
              submitLabel="Toevoegen"
              busy={busy}
              onSubmit={submit}
              onCancel={closeNewTask}
            />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
