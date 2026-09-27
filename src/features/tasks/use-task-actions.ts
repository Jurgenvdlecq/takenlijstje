"use client";

import { toast } from "sonner";
import { useHousehold } from "@/features/household/store";
import { newId } from "@/lib/utils";
import type { TaskRow } from "@/types/database";

/** Veelgebruikte taakacties met passende feedback. */
export function useTaskActions() {
  const { mutate, snapshot } = useHousehold();

  /** Afvinken met één tik, plus "Ongedaan maken" gedurende enkele seconden. */
  async function complete(task: Pick<TaskRow, "id" | "title" | "assigned_member_id">, options?: { onBehalfOf?: string }) {
    // Taak van een gezinslid zonder account (bijv. een kind)? Dan namens hem/haar afvinken.
    const assignee = snapshot.members.find((m) => m.id === task.assigned_member_id);
    const completedBy = options?.onBehalfOf ?? (assignee && !assignee.user_id ? assignee.id : undefined);

    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(12);
    const ok = await mutate("complete", {
      taskId: task.id,
      mutationId: newId(),
      completedAt: new Date().toISOString(),
      completedBy,
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
    skip: async (taskId: string) => {
      const ok = await mutate("setStatus", { taskId, status: "skipped" });
      if (ok) toast("Taak overgeslagen");
      return ok;
    },
    move: (taskId: string, date: string) => mutate("move", { taskId, date }),
    assign: (taskId: string, memberId: string | null) => mutate("assign", { taskId, memberId }),
  };
}
