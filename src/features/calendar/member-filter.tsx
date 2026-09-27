"use client";

import { Users } from "lucide-react";
import { MemberAvatar } from "@/components/member-avatar";
import { cn } from "@/lib/utils";
import type { MemberRow } from "@/types/database";
import { ALL_MEMBERS, type MemberFilter } from "./use-calendar-data";

/** Filterchips: iedereen of één gezinslid. */
export function MemberFilterChips({
  members,
  value,
  onChange,
}: {
  members: MemberRow[];
  value: MemberFilter;
  onChange: (value: MemberFilter) => void;
}) {
  if (members.length < 2) return null;
  return (
    <div role="radiogroup" aria-label="Filter op gezinslid" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      <Chip active={value === ALL_MEMBERS} onClick={() => onChange(ALL_MEMBERS)}>
        <span className="flex size-7 items-center justify-center rounded-full bg-muted">
          <Users className="size-3.5" />
        </span>
        Iedereen
      </Chip>
      {members.map((m) => (
        <Chip key={m.id} active={value === m.id} onClick={() => onChange(value === m.id ? ALL_MEMBERS : m.id)}>
          <MemberAvatar member={m} size="sm" />
          {m.display_name}
        </Chip>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border bg-card py-1 pr-4 pl-2 text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-primary/50 bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60",
      )}
    >
      {children}
    </button>
  );
}
