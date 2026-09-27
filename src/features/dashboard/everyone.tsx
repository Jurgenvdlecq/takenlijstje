"use client";

import { MemberAvatar } from "@/components/member-avatar";
import { TaskCard } from "@/features/tasks/task-card";
import type { TaskView } from "@/features/tasks/selectors";
import type { MemberRow } from "@/types/database";

/** Wat moet de rest doen? Taken van vandaag (en achterstand) per persoon. */
export function EveryoneOverview({ tasks, members }: { tasks: TaskView[]; members: MemberRow[] }) {
  const groups = [
    ...members.filter((m) => m.is_active).map((m) => ({ member: m as MemberRow | null, tasks: tasks.filter((t) => t.assigned_member_id === m.id) })),
    { member: null, tasks: tasks.filter((t) => !t.assigned_member_id) },
  ].filter((g) => g.tasks.length);

  if (!groups.length) return <p className="px-1 text-sm text-muted-foreground">Vandaag staat er niets gepland.</p>;

  return (
    <div className="grid gap-4">
      {groups.map(({ member, tasks: list }) => {
        const done = list.filter((t) => t.status === "done").length;
        return (
          <div key={member?.id ?? "none"} className="grid gap-2">
            <div className="flex items-center gap-2 px-1">
              <MemberAvatar member={member} size="sm" />
              <span className="font-medium">{member?.display_name ?? "Nog niet verdeeld"}</span>
              <span className="text-sm text-muted-foreground">
                {done}/{list.length} gedaan
              </span>
            </div>
            <div className="grid gap-2">
              {list.map((t) => (
                <TaskCard key={t.id} task={t} compact />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
