"use client";

import { useDroppable } from "@dnd-kit/core";
import * as React from "react";
import type { ISODate } from "@/domain/dates";
import { cn } from "@/lib/utils";

export interface DropData {
  date: ISODate;
}

export function dropId(date: ISODate): string {
  return `day:${date}`;
}

/** Een dag waar je een taak op kunt laten vallen; licht op tijdens het slepen. */
export function DroppableDay({
  date,
  className,
  overClassName = "bg-accent/70 ring-2 ring-primary/40",
  children,
  ...props
}: { date: ISODate; overClassName?: string } & Omit<React.ComponentProps<"div">, "ref">) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId(date), data: { date } satisfies DropData });
  return (
    <div ref={setNodeRef} data-date={date} className={cn("transition-colors", className, isOver && overClassName)} {...props}>
      {children}
    </div>
  );
}
