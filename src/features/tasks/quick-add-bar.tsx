"use client";

import { CornerDownLeft, Loader2, Sparkles, Zap } from "lucide-react";
import * as React from "react";
import { todayIn } from "@/domain/dates";
import { parseQuickAdd } from "@/domain/quick-add/parser";
import { describeRule } from "@/domain/recurrence/rule";
import { relativeDayLabel } from "@/domain/status";
import { Badge } from "@/components/ui/badge";
import { useHousehold } from "@/features/household/store";
import { newId } from "@/lib/utils";
import { createTaskAction } from "@/server/actions/tasks";

/**
 * Snelle invoerbalk: "Badkamer zaterdag Jurgen" + Enter en klaar.
 * Toont vooraf hoe de invoer begrepen wordt.
 */
export function QuickAddBar() {
  const { snapshot, run } = useHousehold();
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const tz = snapshot.household.timezone;
  const today = todayIn(tz);

  const parsed = React.useMemo(
    () =>
      text.trim()
        ? parseQuickAdd(text, {
            today,
            members: snapshot.members.filter((m) => m.is_active).map((m) => ({ id: m.id, displayName: m.display_name })),
            templates: snapshot.templates.map((t) => ({ id: t.id, title: t.title, keywords: t.keywords })),
          })
        : null,
    [text, today, snapshot.members, snapshot.templates],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed?.title) return;
    const template = snapshot.templates.find((t) => t.id === parsed.templateId);
    setBusy(true);
    const created = await run(
      () =>
        createTaskAction({
          id: newId(),
          title: parsed.title,
          category: template?.category ?? "other",
          priority: parsed.priority ?? "normal",
          assignedMemberId: parsed.memberId ?? snapshot.me.id,
          scheduledDate: parsed.date ?? today,
          scheduledTime: parsed.time,
          durationMinutes: template?.duration_minutes ?? null,
          points: template?.points ?? null,
          templateId: template?.id ?? null,
          recurrence: parsed.rule ? { rule: parsed.rule, assignmentStrategy: parsed.memberId ? "fixed" : "fair" } : null,
        }),
      { success: `“${parsed.title}” toegevoegd` },
    );
    setBusy(false);
    if (created) setText("");
  }

  const member = parsed?.memberId ? snapshot.members.find((m) => m.id === parsed.memberId) : null;

  return (
    <form onSubmit={submit} className="grid gap-2">
      <div className="flex h-12 items-center gap-2 rounded-2xl border bg-card pr-1.5 pl-3.5 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
        <Zap className="size-4 shrink-0 text-primary" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={120}
          enterKeyHint="send"
          placeholder="Snel toevoegen: badkamer zaterdag Jurgen"
          aria-label="Snel een taak toevoegen"
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
        />
        <button
          type="submit"
          disabled={!parsed?.title || busy}
          aria-label="Toevoegen"
          className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground transition disabled:opacity-30"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <CornerDownLeft className="size-4" />}
        </button>
      </div>
      {parsed?.title && (
        <p className="flex flex-wrap items-center gap-1.5 px-1 text-xs text-muted-foreground animate-fade-up">
          <Sparkles className="size-3.5 text-primary" />
          <Badge variant="primary">{parsed.title}</Badge>
          <Badge>{relativeDayLabel(parsed.date ?? today, today)}</Badge>
          {parsed.time && <Badge>{parsed.time}</Badge>}
          <Badge>{member?.display_name ?? snapshot.me.display_name}</Badge>
          {parsed.rule && <Badge variant="progress">{describeRule(parsed.rule)}</Badge>}
        </p>
      )}
    </form>
  );
}
