"use client";

import { History } from "lucide-react";
import * as React from "react";
import { MemberAvatar } from "@/components/member-avatar";
import { Badge } from "@/components/ui/badge";
import { useSnapshot } from "@/features/household/store";
import { getBrowserClient } from "@/lib/supabase/client";
import type { CompletionRow } from "@/types/database";

function lateLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min te laat`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} uur te laat`;
  const days = Math.round(minutes / 1440);
  return `${days} ${days === 1 ? "dag" : "dagen"} te laat`;
}

/** Historie van iedere uitvoering: wanneer, door wie, hoe laat, op tijd of niet. */
export function TaskHistory({ taskId, recurrenceId }: { taskId: string; recurrenceId: string | null }) {
  const snapshot = useSnapshot();
  const tz = snapshot.household.timezone;
  const [rows, setRows] = React.useState<CompletionRow[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const query = getBrowserClient().from("task_completions").select("*").order("completed_at", { ascending: false }).limit(20);
    (recurrenceId ? query.eq("recurrence_id", recurrenceId) : query.eq("task_id", taskId)).then(({ data }) => {
      if (cancelled) return;
      // Offline: val terug op wat al in de snapshot zit
      setRows(
        (data as CompletionRow[] | null) ??
          snapshot.completions.filter((c) => (recurrenceId ? c.recurrence_id === recurrenceId : c.task_id === taskId)),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [taskId, recurrenceId, snapshot.loadedAt, snapshot.completions]);

  const date = new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "long", timeZone: tz });
  const time = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: tz });

  return (
    <section className="grid gap-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <History className="size-4 text-muted-foreground" /> Geschiedenis
      </h3>
      {rows === null ? (
        <div className="h-10 animate-pulse rounded-xl bg-muted" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nog niet eerder uitgevoerd.</p>
      ) : (
        <ol className="grid gap-1">
          {rows.map((c) => {
            const member = snapshot.members.find((m) => m.id === c.member_id);
            return (
              <li key={c.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                <MemberAvatar member={member} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{date.format(new Date(c.completed_at))}</p>
                  <p className="text-xs text-muted-foreground">
                    {member?.display_name ?? "Onbekend"} · {time.format(new Date(c.completed_at))}
                    {c.note ? ` · “${c.note}”` : ""}
                  </p>
                </div>
                {c.was_late ? <Badge variant="overdue">{lateLabel(c.minutes_late)}</Badge> : <Badge variant="done">Op tijd</Badge>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
