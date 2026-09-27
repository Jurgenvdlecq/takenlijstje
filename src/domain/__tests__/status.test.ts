import { describe, expect, it } from "vitest";
import { findSupersededTasks } from "../scheduling/supersede";
import { periodStats } from "../stats";
import { deadlineSentence, deadlineText, displayStatus, greeting, relativeDayLabel } from "../status";

const TZ = "Europe/Amsterdam";
const now = new Date("2026-09-27T10:00:00Z"); // zondag 12:00 CEST

describe("status en deadlines", () => {
  it("verlopen wordt afgeleid", () => {
    expect(displayStatus({ status: "todo", scheduledDate: "2026-09-27", dueAt: "2026-09-27T09:00:00Z" }, now, TZ)).toBe("overdue");
    expect(displayStatus({ status: "done", scheduledDate: "2026-09-20", dueAt: "2026-09-20T09:00:00Z" }, now, TZ)).toBe("done");
    expect(displayStatus({ status: "todo", scheduledDate: "2026-09-26", dueAt: null }, now, TZ)).toBe("overdue");
  });

  it("deadline-teksten", () => {
    const task = (dueAt: string) => ({ status: "todo" as const, scheduledDate: "2026-09-27", dueAt });
    expect(deadlineText(task("2026-09-27T13:00:00Z"), now, TZ)).toBe("verloopt over 3 uur");
    expect(deadlineText(task("2026-09-27T08:00:00Z"), now, TZ)).toBe("2 uur te laat");
    expect(deadlineText(task("2026-09-28T16:00:00Z"), now, TZ)).toBe("uiterlijk morgen");
    expect(deadlineSentence("Badkamer schoonmaken", task("2026-09-27T13:00:00Z"), now, TZ))
      .toBe("“Badkamer schoonmaken” is nog niet gedaan en verloopt over 3 uur.");
  });

  it("begroeting per dagdeel", () => {
    expect(greeting(new Date("2026-09-27T06:00:00Z"), TZ)).toBe("Goedemorgen");
    expect(greeting(now, TZ)).toBe("Goedemiddag");
    expect(greeting(new Date("2026-09-27T18:00:00Z"), TZ)).toBe("Goedenavond");
  });

  it("dag-labels", () => {
    expect(relativeDayLabel("2026-09-27", "2026-09-27")).toBe("Vandaag");
    expect(relativeDayLabel("2026-09-28", "2026-09-27")).toBe("Morgen");
    expect(relativeDayLabel("2026-10-01", "2026-09-27")).toBe("Donderdag");
  });
});

describe("verlopen taken opruimen", () => {
  it("oude uitvoering vervalt zodra de nieuwe beschikbaar is", () => {
    const tasks = [
      { id: "ma", recurrenceId: "vw", occurrenceDate: "2026-09-26", status: "todo", dueAt: "2026-09-26T21:59:00Z", availableFrom: "2026-09-25T22:00:00Z", scheduledDate: "2026-09-26" },
      { id: "di", recurrenceId: "vw", occurrenceDate: "2026-09-27", status: "todo", dueAt: "2026-09-27T21:59:00Z", availableFrom: "2026-09-26T22:00:00Z", scheduledDate: "2026-09-27" },
      { id: "wo", recurrenceId: "vw", occurrenceDate: "2026-09-28", status: "todo", dueAt: "2026-09-28T21:59:00Z", availableFrom: "2026-09-27T22:00:00Z", scheduledDate: "2026-09-28" },
      { id: "los", recurrenceId: null, occurrenceDate: null, status: "todo", dueAt: "2026-09-20T21:59:00Z", availableFrom: null, scheduledDate: "2026-09-20" },
    ];
    expect(findSupersededTasks(tasks, now)).toEqual(["ma"]);
  });
});

describe("statistieken", () => {
  it("telt per persoon en vindt meest vergeten taak", () => {
    const stats = periodStats(
      [
        { memberId: "j", title: "WC", recurrenceId: "a", completedAt: "", wasLate: true, points: 3 },
        { memberId: "j", title: "Afwas", recurrenceId: "b", completedAt: "", wasLate: false, points: 2 },
        { memberId: "e", title: "WC", recurrenceId: "a", completedAt: "", wasLate: false, points: 3 },
      ],
      [
        { id: "1", title: "WC", recurrenceId: "a", assignedMemberId: "e", status: "todo", scheduledDate: "2026-09-27", overdue: true },
        { id: "2", title: "Stofzuigen", recurrenceId: "c", assignedMemberId: "j", status: "todo", scheduledDate: "2026-09-28", overdue: false },
      ],
      ["j", "e"],
    );
    expect(stats.completed).toBe(3);
    expect(stats.open).toBe(2);
    expect(stats.completionRate).toBeCloseTo(0.6);
    expect(stats.mostDone).toEqual({ title: "WC", count: 2 });
    expect(stats.mostForgotten).toEqual({ title: "WC", count: 2 });
    expect(stats.members.find((m) => m.memberId === "j")).toMatchObject({ done: 2, open: 1, points: 5 });
  });
});
