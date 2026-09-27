"use client";

/**
 * Open een taak (detailvenster) of het "+ Taak"-venster vanaf elke plek.
 * Links als /taken?taak=<id> (bijv. uit een pushmelding) openen ook het detail.
 */
import { useSearchParams } from "next/navigation";
import * as React from "react";
import type { ISODate } from "@/domain/dates";

export interface NewTaskPrefill {
  title?: string;
  date?: ISODate;
  time?: string | null;
  memberId?: string | null;
}

interface TaskUi {
  openTask: (taskId: string) => void;
  closeTask: () => void;
  openTaskId: string | null;
  openNewTask: (prefill?: NewTaskPrefill) => void;
  closeNewTask: () => void;
  newTask: NewTaskPrefill | null;
}

const TaskUiContext = React.createContext<TaskUi | null>(null);

export function useTaskUi(): TaskUi {
  const ctx = React.useContext(TaskUiContext);
  if (!ctx) throw new Error("useTaskUi buiten TaskUiProvider");
  return ctx;
}

export function TaskUiProvider({ children }: { children: React.ReactNode }) {
  const [explicitId, setExplicitId] = React.useState<string | null>(null);
  const [dismissedLink, setDismissedLink] = React.useState<string | null>(null);
  const [newTask, setNewTask] = React.useState<NewTaskPrefill | null>(null);

  // Deep link: ?taak=<id> (bijv. vanuit een pushmelding of de meldingenlijst)
  const linkedId = useSearchParams().get("taak");
  const openTaskId = explicitId ?? (linkedId && linkedId !== dismissedLink ? linkedId : null);

  const value = React.useMemo<TaskUi>(
    () => ({
      openTaskId,
      openTask: (id) => {
        setExplicitId(id);
        setDismissedLink(null);
      },
      closeTask: () => {
        setExplicitId(null);
        setDismissedLink(linkedId);
        const url = new URL(window.location.href);
        if (url.searchParams.has("taak")) {
          url.searchParams.delete("taak");
          window.history.replaceState(null, "", url.toString());
        }
      },
      newTask,
      openNewTask: (prefill = {}) => setNewTask(prefill),
      closeNewTask: () => setNewTask(null),
    }),
    [openTaskId, linkedId, newTask],
  );

  return <TaskUiContext.Provider value={value}>{children}</TaskUiContext.Provider>;
}
