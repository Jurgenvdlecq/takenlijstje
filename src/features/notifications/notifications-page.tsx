"use client";

import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCheck,
  CheckCircle2,
  Clock,
  Moon,
  Recycle,
  Settings2,
  Sun,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionTitle } from "@/components/ui/misc";
import { useHousehold } from "@/features/household/store";
import { useTaskUi } from "@/features/tasks/task-ui-context";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";
import type { NotificationRow, NotificationType } from "@/types/database";
import { groupByDay, relativeTime } from "./format";

type TypeStyle = { icon: LucideIcon; className: string; label: string };

const TYPE_STYLE: Record<NotificationType, TypeStyle> = {
  reminder: { icon: BellRing, className: "bg-progress-bg text-progress", label: "Herinnering" },
  deadline_soon: { icon: Clock, className: "bg-today-bg text-today", label: "Deadline nadert" },
  overdue: { icon: AlertTriangle, className: "bg-overdue-bg text-overdue", label: "Te laat" },
  task_completed: { icon: CheckCircle2, className: "bg-done-bg text-done", label: "Gedaan" },
  daily_summary: { icon: Sun, className: "bg-today-bg text-today", label: "Dagoverzicht" },
  evening_summary: { icon: Moon, className: "bg-progress-bg text-progress", label: "Avondoverzicht" },
  // Geen rood: het is geen fout van de gebruiker (UX_SPEC §13.7.5)
  waste_sync_failed: { icon: Recycle, className: "bg-muted text-muted-foreground", label: "Afvalkalender" },
};

/** Oude meldingen van vervallen soorten (tot ze in WP2b verdwijnen) krijgen een neutrale stijl */
const FALLBACK_STYLE: TypeStyle = { icon: Bell, className: "bg-muted text-muted-foreground", label: "Melding" };
const styleFor = (type: string): TypeStyle => TYPE_STYLE[type as NotificationType] ?? FALLBACK_STYLE;

export function NotificationsPage() {
  const { snapshot, mutate } = useHousehold();
  const { openTask } = useTaskUi();
  const router = useRouter();
  const now = useNow();
  const tz = snapshot.household.timezone;

  const { today, earlier } = groupByDay(snapshot.notifications, now, tz);
  const unread = snapshot.notifications.filter((n) => !n.read_at).length;
  const isEmpty = snapshot.notifications.length === 0;

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

      {isEmpty && (
        <EmptyState
          icon={Bell}
          title="Geen meldingen"
          description="Hier zie je herinneringen, deadlines en wat er gedaan is."
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
  const style = styleFor(n.type) ?? TYPE_STYLE.reminder;
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
