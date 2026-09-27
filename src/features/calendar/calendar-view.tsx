"use client";

/**
 * Kalender met dag-, week- en maandweergave.
 * Taken zijn te verslepen naar een andere dag; toekomstige herhalingen die nog
 * niet zijn ingepland verschijnen als gestippelde "spookjes".
 */
import {
  DndContext,
  DragOverlay,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import * as React from "react";
import { toast } from "sonner";
import { eachDay, parts, todayIn, type ISODate } from "@/domain/dates";
import { useSnapshot } from "@/features/household/store";
import type { TaskView } from "@/features/tasks/selectors";
import { useTaskActions } from "@/features/tasks/use-task-actions";
import { formatDayShort, headerTitles, shiftAnchor, visibleRange, type CalendarMode } from "./calendar-model";
import { TaskChip, type DragData } from "./calendar-items";
import { CalendarToolbar } from "./calendar-toolbar";
import { DayList } from "./day-view";
import type { DropData } from "./droppable-day";
import { MemberFilterChips } from "./member-filter";
import { MonthView } from "./month-view";
import { MousePointerSensor } from "./sensors";
import { ALL_MEMBERS, useCalendarData, type MemberFilter } from "./use-calendar-data";
import { useIsWide } from "./use-media-query";
import { WeekView } from "./week-view";

function dragTask(data: unknown): TaskView | null {
  return (data as DragData | undefined)?.task ?? null;
}

function dropDate(data: unknown): ISODate | null {
  return (data as DropData | undefined)?.date ?? null;
}

const announcements: Announcements = {
  onDragStart: ({ active }) => `${dragTask(active.data.current)?.title ?? "Taak"} opgepakt.`,
  onDragOver: ({ over }) => {
    const date = dropDate(over?.data.current);
    return date ? `Boven ${formatDayShort(date)}.` : undefined;
  },
  onDragEnd: ({ over }) => {
    const date = dropDate(over?.data.current);
    return date ? `Verplaatst naar ${formatDayShort(date)}.` : "Niet verplaatst.";
  },
  onDragCancel: () => "Slepen geannuleerd.",
};

export function CalendarView() {
  const snapshot = useSnapshot();
  const tz = snapshot.household.timezone;
  const { move } = useTaskActions();
  const wide = useIsWide();

  const [mode, setMode] = React.useState<CalendarMode>("week");
  const [anchor, setAnchor] = React.useState<ISODate>(() => todayIn(tz));
  const [filter, setFilter] = React.useState<MemberFilter>(ALL_MEMBERS);
  const [dragging, setDragging] = React.useState<TaskView | null>(null);

  const range = visibleRange(mode, anchor);
  const data = useCalendarData(range, filter);
  const { today } = data;
  const { title, subtitle } = headerTitles(mode, anchor);

  const showingToday = mode === "week" ? today >= range.from && today <= range.to : anchor === today;

  function go(direction: 1 | -1) {
    const next = shiftAnchor(mode, anchor, direction);
    // In de maandweergave de huidige dag selecteren als die in de nieuwe maand valt
    if (mode === "month" && parts(next).year === parts(today).year && parts(next).month === parts(today).month) {
      setAnchor(today);
    } else {
      setAnchor(next);
    }
  }

  // Muis: pas slepen na 6px; touch: eerst even vasthouden, zodat tikken en scrollen blijven werken
  const sensors = useSensors(
    useSensor(MousePointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    setDragging(dragTask(event.active.data.current));
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDragging(null);
    const task = dragTask(event.active.data.current);
    const date = dropDate(event.over?.data.current);
    if (!task || !date || date === task.scheduled_date) return;
    const previous = task.scheduled_date;
    const ok = await move(task.id, date);
    if (ok) {
      toast.success(`Verplaatst naar ${formatDayShort(date)}`, {
        description: task.title,
        action: { label: "Ongedaan maken", onClick: () => void move(task.id, previous) },
      });
    }
  }

  const draggingMember = dragging?.assigned_member_id ? data.memberById.get(dragging.assigned_member_id) : undefined;

  return (
    <div className="pb-6">
      <CalendarToolbar
        title={title}
        subtitle={subtitle}
        mode={mode}
        onModeChange={setMode}
        onPrev={() => go(-1)}
        onNext={() => go(1)}
        onToday={() => setAnchor(today)}
        showingToday={showingToday}
      />

      <div className="mb-5">
        <MemberFilterChips members={data.members} value={filter} onChange={setFilter} />
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={(e) => void handleDragEnd(e)}
        onDragCancel={() => setDragging(null)}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable: "Houd ingedrukt en sleep naar een andere dag om de taak te verplaatsen.",
          },
        }}
      >
        {mode === "day" && <DayList date={anchor} data={data} />}
        {mode === "week" && <WeekView days={eachDay(range.from, range.to)} data={data} wide={wide} />}
        {mode === "month" && (
          <MonthView
            anchor={anchor}
            selected={anchor}
            data={data}
            wide={wide}
            onSelect={setAnchor}
            onOpenDay={(date) => {
              setAnchor(date);
              setMode("day");
            }}
          />
        )}

        <DragOverlay dropAnimation={null}>
          {dragging ? <TaskChip task={dragging} member={draggingMember} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
