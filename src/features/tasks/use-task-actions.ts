"use client";

import { toast } from "sonner";
import { useHousehold } from "@/features/household/store";
import { newId } from "@/lib/utils";
import type { TaskRow } from "@/types/database";

/** Veelgebruikte taakacties met passende feedback. */
export function useTaskActions() {
  const { mutate } = useHousehold();

  /** Afvinken met één tik, plus "Ongedaan maken" gedurende enkele seconden. */
  async function complete(task: Pick<TaskRow, "id" | "title">) {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(12);
    const ok = await mutate("complete", {
      taskId: task.id,
      mutationId: newId(),
      completedAt: new Date().toISOString(),
    });
    if (ok) {
      toast.success("Taak voltooid", {
        description: task.title,
        duration: 6000,
        action: { label: "Ongedaan maken", onClick: () => void mutate("undo", { taskId: task.id }) },
      });
    }
    return ok;
  }

  return {
    complete,
    undo: (taskId: string) => mutate("undo", { taskId }),
    start: (taskId: string) => mutate("setStatus", { taskId, status: "in_progress" }),
    reopen: (taskId: string) => mutate("setStatus", { taskId, status: "todo" }),
    skip: async (taskId: string, task?: Pick<TaskRow, "title" | "waste_direction">) => {
      const ok = await mutate("setStatus", { taskId, status: "skipped" });
      if (!ok) return ok;
      if (task?.waste_direction === "out") {
        // Buitenzetten overslaan neemt binnenzetten mee (BR-53, UX §13.6); ongedaan maken zet beide terug
        toast("Overgeslagen, ook het binnenzetten", {
          description: task.title,
          duration: 6000,
          action: { label: "Ongedaan maken", onClick: () => void mutate("setStatus", { taskId, status: "todo" }) },
        });
      } else {
        toast("Taak overgeslagen");
      }
      return ok;
    },
    move: (taskId: string, date: string) => mutate("move", { taskId, date }),
  };
}
