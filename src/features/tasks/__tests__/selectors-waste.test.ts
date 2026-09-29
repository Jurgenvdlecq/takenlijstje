import { describe, expect, it } from "vitest";
import type { Snapshot } from "@/lib/data/snapshot";
import type { HouseholdRow, TaskRow } from "@/types/database";
import { dashboardData } from "../selectors";

/**
 * WP3b — afvaltaken op het dashboard van de huidige schermen (UX §13.13.1;
 * D-048: afvaltaken tellen niet mee in "Eerstvolgende deadline").
 * AC-192, AC-193. Ophaaldag dinsdag 6 oktober 2026 (zomertijd, UTC+2).
 */
const TZ = "Europe/Amsterdam";
const nl = (dagTijd: string) => new Date(`${dagTijd.replace(" ", "T")}:00+02:00`);
const utc = (dagTijd: string) => nl(dagTijd).toISOString();

let n = 0;
function taak(over: Partial<TaskRow>): TaskRow {
  n += 1;
  return {
    id: `taak-${n}`,
    household_id: "h1",
    recurrence_id: null,
    occurrence_date: null,
    title: `Taak ${n}`,
    description: null,
    category: "other",
    priority: "normal",
    status: "todo",
    scheduled_date: "2026-10-06",
    scheduled_time: null,
    available_from: null,
    due_at: null,
    duration_minutes: null,
    reminder_minutes_before: [],
    is_exception: false,
    completed_at: null,
    created_by_member_id: null,
    deleted_at: null,
    created_at: utc("2026-10-01 10:00"),
    updated_at: utc("2026-10-01 10:00"),
    waste_pickup_date: null,
    waste_direction: null,
    waste_streams: null,
    ...over,
  };
}

const buiten = taak({
  title: "Restafval buitenzetten",
  scheduled_date: "2026-10-05",
  scheduled_time: "21:00",
  due_at: utc("2026-10-06 07:45"),
  waste_pickup_date: "2026-10-06",
  waste_direction: "out",
  waste_streams: ["rest"],
});
const binnen = taak({
  title: "Restafvalbak binnenzetten",
  scheduled_date: "2026-10-06",
  available_from: utc("2026-10-06 12:00"),
  due_at: utc("2026-10-07 00:00"),
  waste_pickup_date: "2026-10-06",
  waste_direction: "in",
  waste_streams: ["rest"],
});
const gewoon = taak({ title: "Container schoonmaken", scheduled_date: "2026-10-06", due_at: utc("2026-10-06 18:00") });

function snapshot(tasks: TaskRow[]): Snapshot {
  const household = { id: "h1", name: "Test", timezone: TZ } as HouseholdRow;
  return { household, tasks, members: [], completions: [], notifications: [] } as unknown as Snapshot;
}

describe("dashboardData met afvaltaken (AC-192, AC-193, D-048)", () => {
  it("D-048: een afvaltaak is nooit de eerstvolgende deadline, ook niet als hij eerder verloopt", () => {
    const data = dashboardData(snapshot([buiten, binnen, gewoon]), nl("2026-10-05 20:00"));
    expect(data.summary.nextDeadline?.id).toBe(gewoon.id);
    expect(dashboardData(snapshot([buiten, binnen]), nl("2026-10-05 20:00")).summary.nextDeadline).toBeNull();
  });

  it("maandag: buitenzetten onder Vandaag, binnenzetten onder Binnenkort", () => {
    const data = dashboardData(snapshot([buiten, binnen]), nl("2026-10-05 20:00"));
    expect(data.todayTasks.map((t) => t.id)).toEqual([buiten.id]);
    expect(data.upcoming.map((t) => t.id)).toEqual([binnen.id]);
  });

  it("dinsdag 07:00: buitenzetten blijft onder Vandaag (tot 07:45); binnenzetten bovenaan Binnenkort (vóór 12:00)", () => {
    const data = dashboardData(snapshot([buiten, binnen, gewoon]), nl("2026-10-06 07:00"));
    expect(data.todayTasks.map((t) => t.id)).toEqual([buiten.id, gewoon.id]);
    expect(data.upcoming[0]?.id).toBe(binnen.id);
    expect(data.overdue).toEqual([]);
  });

  it("dinsdag 09:00: buitenzetten bij Verlopen; binnenzetten nog onder Binnenkort", () => {
    const data = dashboardData(snapshot([buiten, binnen]), nl("2026-10-06 09:00"));
    expect(data.overdue.map((t) => t.id)).toEqual([buiten.id]);
    expect(data.todayTasks).toEqual([]);
    expect(data.upcoming.map((t) => t.id)).toEqual([binnen.id]);
  });

  it("dinsdag 12:00: binnenzetten onder Vandaag", () => {
    const data = dashboardData(snapshot([binnen]), nl("2026-10-06 12:00"));
    expect(data.todayTasks.map((t) => t.id)).toEqual([binnen.id]);
    expect(data.upcoming).toEqual([]);
  });

  it("een afgevinkte buitenzet-taak van gisteren staat dinsdag niet meer onder Vandaag", () => {
    const gedaan = { ...buiten, status: "done" as const, completed_at: utc("2026-10-05 22:10") };
    const data = dashboardData(snapshot([gedaan, binnen]), nl("2026-10-06 07:00"));
    expect(data.todayTasks).toEqual([]);
  });
});
