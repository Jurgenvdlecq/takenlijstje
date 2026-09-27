"use client";

import {
  AlertTriangle,
  ArrowLeftRight,
  Bell,
  BellRing,
  CheckCheck,
  CheckCircle2,
  Clock,
  Handshake,
  Moon,
  Settings2,
  Sun,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { MemberAvatar } from "@/components/member-avatar";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, SectionTitle } from "@/components/ui/misc";
import { todayIn } from "@/domain/dates";
import { relativeDayLabel } from "@/domain/status";
import { useHousehold } from "@/features/household/store";
import { useTaskUi } from "@/features/tasks/task-ui-context";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";
import { acceptSwapAction, cancelSwapAction } from "@/server/actions/tasks";
import type { NotificationRow, NotificationType, SwapRequestRow } from "@/types/database";
import { groupByDay, relativeTime } from "./format";

const TYPE_STYLE: Record<NotificationType, { icon: LucideIcon; className: string; label: string }> = {
  task_assigned: { icon: UserPlus, className: "bg-accent text-accent-foreground", label: "Nieuwe taak" },
  reminder: { icon: BellRing, className: "bg-progress-bg text-progress", label: "Herinnering" },
  deadline_soon: { icon: Clock, className: "bg-today-bg text-today", label: "Deadline nadert" },
  overdue: { icon: AlertTriangle, className: "bg-overdue-bg text-overdue", label: "Te laat" },
  task_completed: { icon: CheckCircle2, className: "bg-done-bg text-done", label: "Gedaan" },
  daily_summary: { icon: Sun, className: "bg-today-bg text-today", label: "Dagoverzicht" },
  evening_summary: { icon: Moon, className: "bg-progress-bg text-progress", label: "Avondoverzicht" },
  swap_request: { icon: ArrowLeftRight, className: "bg-accent text-accent-foreground", label: "Ruilverzoek" },
  swap_accepted: { icon: Handshake, className: "bg-done-bg text-done", label: "Ruil gelukt" },
};

export function NotificationsPage() {
  const { snapshot, mutate } = useHousehold();
  const { openTask } = useTaskUi();
  const router = useRouter();
  const now = useNow();
  const tz = snapshot.household.timezone;

  const { today, earlier } = groupByDay(snapshot.notifications, now, tz);
  const unread = snapshot.notifications.filter((n) => !n.read_at).length;
  const swapsForMe = snapshot.swapRequests.filter((r) => r.status === "open" && r.requested_by_member_id !== snapshot.me.id);
  const mySwaps = snapshot.swapRequests.filter((r) => r.status === "open" && r.requested_by_member_id === snapshot.me.id);
  const isEmpty = snapshot.notifications.length === 0 && swapsForMe.length === 0 && mySwaps.length === 0;

  const openNotification = (n: NotificationRow) => {
    if (!n.read_at) void mutate("markRead", { ids: [n.id] });
    if (n.task_id) openTask(n.task_id);
    else if (n.url) router.push(n.url);
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        className="mb-0"
        title="Meldingen"
        subtitle={unread > 0 ? `${unread} ongelezen` : "Je bent helemaal bij"}
        actions={
          unread > 0 && (
            <Button variant="outline" size="sm" onClick={() => void mutate("markRead", {})}>
              <CheckCheck />
              Alles gelezen
            </Button>
          )
        }
      />

      {swapsForMe.length > 0 && (
        <section aria-label="Ruilverzoeken">
          <SectionTitle count={swapsForMe.length}>Ruilverzoeken</SectionTitle>
          <div className="grid gap-2">
            {swapsForMe.map((r) => (
              <SwapCard key={r.id} request={r} mine={false} />
            ))}
          </div>
        </section>
      )}

      {mySwaps.length > 0 && (
        <section aria-label="Jouw ruilverzoeken">
          <SectionTitle count={mySwaps.length}>Jouw ruilverzoeken</SectionTitle>
          <div className="grid gap-2">
            {mySwaps.map((r) => (
              <SwapCard key={r.id} request={r} mine />
            ))}
          </div>
        </section>
      )}

      {isEmpty && (
        <EmptyState
          icon={Bell}
          title="Geen meldingen"
          description="Hier zie je nieuwe taken, herinneringen en ruilverzoeken van je huisgenoten."
        />
      )}

      {today.length > 0 && (
        <NotificationGroup title="Vandaag" items={today} now={now} tz={tz} onOpen={openNotification} />
      )}
      {earlier.length > 0 && (
        <NotificationGroup title="Eerder" items={earlier} now={now} tz={tz} onOpen={openNotification} />
      )}

      <div className="flex justify-center pb-2">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href="/instellingen#meldingen">
            <Settings2 />
            Meldingen instellen
          </Link>
        </Button>
      </div>
    </div>
  );
}

function NotificationGroup({
  title,
  items,
  now,
  tz,
  onOpen,
}: {
  title: string;
  items: NotificationRow[];
  now: Date;
  tz: string;
  onOpen: (n: NotificationRow) => void;
}) {
  return (
    <section aria-label={title}>
      <SectionTitle>{title}</SectionTitle>
      <ul className="grid gap-2">
        {items.map((n) => (
          <li key={n.id}>
            <NotificationItem notification={n} time={relativeTime(n.created_at, now, tz)} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function NotificationItem({
  notification: n,
  time,
  onOpen,
}: {
  notification: NotificationRow;
  time: string;
  onOpen: (n: NotificationRow) => void;
}) {
  const style = TYPE_STYLE[n.type] ?? TYPE_STYLE.reminder;
  const Icon = style.icon;
  const unread = !n.read_at;

  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={cn(
        "flex min-h-16 w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] animate-fade-up",
        unread ? "border-primary/25 bg-accent/40 shadow-xs hover:bg-accent/60" : "bg-card hover:border-primary/30",
      )}
    >
      <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full", style.className)}>
        <Icon className="size-4.5" aria-label={style.label} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={cn("text-sm leading-snug", unread ? "font-semibold" : "font-medium")}>{n.title}</span>
          <span className="mt-0.5 flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            {time}
            {unread && <span className="size-2 rounded-full bg-primary" aria-label="Ongelezen" />}
          </span>
        </span>
        {n.body && <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{n.body}</span>}
      </span>
    </button>
  );
}

/** Ruilverzoek: van een ander ("Overnemen") of van mezelf ("Intrekken"). */
function SwapCard({ request, mine }: { request: SwapRequestRow; mine: boolean }) {
  const { snapshot, run } = useHousehold();
  const { openTask } = useTaskUi();
  const now = useNow();
  const [busy, setBusy] = React.useState(false);
  const task = snapshot.tasks.find((t) => t.id === request.task_id);
  const requester = snapshot.members.find((m) => m.id === request.requested_by_member_id);
  const title = task?.title ?? "een taak";
  const when = task ? relativeDayLabel(task.scheduled_date, todayIn(snapshot.household.timezone, now)) : null;

  const act = async () => {
    setBusy(true);
    if (mine) await run(() => cancelSwapAction(request.id), { success: "Ruilverzoek ingetrokken" });
    else await run(() => acceptSwapAction(request.id), { success: "Taak overgenomen" });
    setBusy(false);
  };

  return (
    <Card className={cn("flex flex-col gap-3 p-4 animate-fade-up", !mine && "border-primary/25")}>
      <div className="flex items-start gap-3">
        {mine ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <ArrowLeftRight className="size-4.5" />
          </span>
        ) : (
          <MemberAvatar member={requester} size="md" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug">
            {mine ? (
              <>
                Je wilt <span className="font-semibold">‘{title}’</span> ruilen
              </>
            ) : (
              <>
                <span className="font-semibold">{requester?.display_name ?? "Iemand"}</span> wil{" "}
                <span className="font-semibold">‘{title}’</span> ruilen
              </>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[when, relativeTime(request.created_at, now, snapshot.household.timezone)].filter(Boolean).join(" · ")}
          </p>
          {request.message && (
            <p className="mt-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">“{request.message}”</p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        {task && (
          <Button variant="ghost" className="flex-1 sm:flex-none" onClick={() => openTask(task.id)}>
            Bekijken
          </Button>
        )}
        <Button
          variant={mine ? "outline" : "default"}
          className="flex-1 sm:ml-auto sm:flex-none"
          disabled={busy}
          onClick={() => void act()}
        >
          {mine ? "Intrekken" : (
            <>
              <Handshake />
              Overnemen
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
