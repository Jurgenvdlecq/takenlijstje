import { describe, expect, it } from "vitest";
import type { RecurrenceRow } from "@/types/database";
import {
  formatDayShort,
  headerTitles,
  isoWeekNumber,
  monthGrid,
  projectOccurrences,
  shiftAnchor,
  visibleRange,
} from "./calendar-model";

function recurrence(overrides: Partial<RecurrenceRow> = {}): RecurrenceRow {
  return {
    id: "r1",
    household_id: "h1",
    template_id: null,
    title: "Stofzuigen",
    description: null,
    category: "cleaning",
    priority: "normal",
    duration_minutes: null,
    rule: { freq: "weekly", interval: 1, weekdays: [2] }, // dinsdag
    time_of_day: null,
    available_days_before: 0,
    due_days_after: 0,
    due_time: null,
    starts_on: "2026-09-01",
    ends_on: null,
    paused_from: null,
    paused_until: null,
    reminder_minutes_before: [],
    is_active: true,
    generated_until: "2026-10-11",
    created_by_member_id: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  } as RecurrenceRow;
}

describe("monthGrid", () => {
  it("bedekt de maand in volledige weken vanaf maandag", () => {
    const grid = monthGrid("2026-09-15");
    expect(grid[0][0]).toBe("2026-08-31"); // maandag
    expect(grid[grid.length - 1][6]).toBe("2026-10-04"); // zondag
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid).toHaveLength(5);
  });

  it("begint op de 1e als die op maandag valt", () => {
    expect(monthGrid("2026-06-10")[0][0]).toBe("2026-06-01");
  });
});

describe("visibleRange / shiftAnchor", () => {
  it("week loopt van maandag t/m zondag", () => {
    expect(visibleRange("week", "2026-09-27")).toEqual({ from: "2026-09-21", to: "2026-09-27" });
  });

  it("maand verschuift naar de 1e van de volgende maand", () => {
    expect(shiftAnchor("month", "2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftAnchor("week", "2026-09-27", -1)).toBe("2026-09-20");
    expect(shiftAnchor("day", "2026-09-30", 1)).toBe("2026-10-01");
  });
});

describe("isoWeekNumber", () => {
  it("rekent ISO-weken", () => {
    expect(isoWeekNumber("2026-09-28")).toBe(40);
    expect(isoWeekNumber("2027-01-01")).toBe(53); // vrijdag, hoort bij week 53 van 2026
    expect(isoWeekNumber("2024-12-30")).toBe(1);
  });
});

describe("opmaak", () => {
  it("maakt Nederlandse titels", () => {
    expect(formatDayShort("2026-09-29")).toMatch(/^dinsdag 29 sep/);
    expect(headerTitles("month", "2026-09-12").title).toBe("September 2026");
    expect(headerTitles("week", "2026-09-30").title).toBe("Week 40");
  });
});

describe("projectOccurrences", () => {
  const range = { from: "2026-09-28", to: "2026-11-01" };

  it("projecteert alleen ná generated_until", () => {
    const result = projectOccurrences([recurrence()], [], range, "2026-09-27");
    expect(result.map((p) => p.date)).toEqual(["2026-10-13", "2026-10-20", "2026-10-27"]);
    // Geen persoon meer in de projectie (V-21)
    expect(Object.keys(result[0])).not.toContain("memberId");
    expect(Object.keys(result[0])).not.toContain("candidateMemberIds");
  });

  it("slaat bestaande taken, inactieve reeksen en het verleden over", () => {
    const tasks = [{ recurrence_id: "r1", occurrence_date: "2026-10-20" }];
    expect(projectOccurrences([recurrence()], tasks, range, "2026-09-27").map((p) => p.date)).toEqual([
      "2026-10-13",
      "2026-10-27",
    ]);
    expect(projectOccurrences([recurrence({ is_active: false })], [], range, "2026-09-27")).toEqual([]);
    expect(
      projectOccurrences([recurrence({ generated_until: null })], [], range, "2026-10-21").map((p) => p.date),
    ).toEqual(["2026-10-27"]);
  });

  it("houdt rekening met pauzes en einddatum", () => {
    const paused = recurrence({ paused_from: "2026-10-19", paused_until: "2026-10-25" });
    expect(projectOccurrences([paused], [], range, "2026-09-27").map((p) => p.date)).toEqual([
      "2026-10-13",
      "2026-10-27",
    ]);
    const ended = recurrence({ ends_on: "2026-10-15" });
    expect(projectOccurrences([ended], [], range, "2026-09-27").map((p) => p.date)).toEqual(["2026-10-13"]);
  });
});
