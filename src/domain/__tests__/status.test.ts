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

describe("statistieken voor het huishouden (V-21)", () => {
  it("telt voor het huishouden als geheel en vindt de meest vergeten taak", () => {
    const stats = periodStats(
      [
        { title: "WC", recurrenceId: "a", completedAt: "", wasLate: true },
        { title: "Afwas", recurrenceId: "b", completedAt: "", wasLate: false },
        { title: "WC", recurrenceId: "a", completedAt: "", wasLate: false },
      ],
      [
        { id: "1", title: "WC", recurrenceId: "a", status: "todo", scheduledDate: "2026-09-27", overdue: true },
        { id: "2", title: "Stofzuigen", recurrenceId: "c", status: "todo", scheduledDate: "2026-09-28", overdue: false },
      ],
    );
    expect(stats).toEqual({
      completed: 3,
      open: 2,
      late: 1,
      overdue: 1,
      completionRate: 0.6,
      mostDone: { title: "WC", count: 2 },
      mostForgotten: { title: "WC", count: 2 },
    });
  });

  it("bevat geen cijfers per persoon of punten", () => {
    const stats = periodStats([{ title: "WC", recurrenceId: "a", completedAt: "", wasLate: false }], []);
    expect(Object.keys(stats)).not.toContain("members");
    expect(JSON.stringify(stats)).not.toMatch(/member|points|punten/i);
  });

  it("lege periode: geen percentage en geen toplijsten", () => {
    expect(periodStats([], [])).toEqual({
      completed: 0,
      open: 0,
      late: 0,
      overdue: 0,
      completionRate: null,
      mostDone: null,
      mostForgotten: null,
    });
  });

  it("overgeslagen telt als gepland en als vergeten", () => {
    const stats = periodStats(
      [{ title: "Dweilen", recurrenceId: "d", completedAt: "", wasLate: false }],
      [{ id: "1", title: "Stofzuigen", recurrenceId: "c", status: "skipped", scheduledDate: "2026-09-26", overdue: false }],
    );
    expect(stats.completionRate).toBe(0.5);
    expect(stats.mostForgotten).toEqual({ title: "Stofzuigen", count: 1 });
  });
});

import { summaryMessages, taskMessages } from "../reminders";

describe("herinneringen", () => {
  const prefs = {
    deadlineWarningMinutes: 120,
    dailySummaryEnabled: true,
    dailySummaryTime: "07:30",
    eveningSummaryEnabled: true,
    eveningSummaryTime: "20:00",
  };
  const task = {
    id: "wc",
    title: "WC schoonmaken",
    status: "todo" as const,
    scheduledDate: "2026-09-27",
    scheduledTime: null,
    dueAt: "2026-09-27T11:30:00Z", // 13:30 lokaal
    reminderMinutesBefore: [120],
  };

  it("deadline nadert + herinnering", () => {
    const messages = taskMessages(task, prefs, now, TZ); // 12:00 lokaal
    expect(messages.map((m) => m.type).sort()).toEqual(["deadline_soon", "reminder"]);
    expect(messages.find((m) => m.type === "deadline_soon")!.title).toBe("WC schoonmaken moet binnen 1,5 uur gedaan zijn");
  });

  it("verlopen, en niets voor afgeronde taken", () => {
    const later = new Date("2026-09-27T12:00:00Z");
    expect(taskMessages(task, prefs, later, TZ).map((m) => m.type)).toEqual(["overdue"]);
    expect(taskMessages({ ...task, status: "done" }, prefs, later, TZ)).toEqual([]);
  });

  const counts = { todayOpen: 4, openIncludingOverdue: 2 };

  it("dagoverzicht om 07:30 en avondoverzicht om 20:00 (UX §4.9)", () => {
    const morning = new Date("2026-09-27T05:40:00Z"); // 07:40 lokaal
    expect(summaryMessages(prefs, morning, TZ, counts)).toEqual([
      { type: "daily_summary", title: "Vandaag staan er 4 taken", dedupeKey: "daily:2026-09-27" },
    ]);
    const evening = new Date("2026-09-27T18:05:00Z"); // 20:05 lokaal
    expect(summaryMessages(prefs, evening, TZ, counts)).toEqual([
      { type: "evening_summary", title: "Er staan nog 2 taken open", dedupeKey: "evening:2026-09-27" },
    ]);
    expect(summaryMessages(prefs, now, TZ, counts)).toEqual([]);
  });

  it("enkelvoud en niets bij 0", () => {
    const morning = new Date("2026-09-27T05:40:00Z");
    const evening = new Date("2026-09-27T18:05:00Z");
    expect(summaryMessages(prefs, morning, TZ, { todayOpen: 1, openIncludingOverdue: 1 })[0].title).toBe("Vandaag staat er 1 taak");
    expect(summaryMessages(prefs, evening, TZ, { todayOpen: 1, openIncludingOverdue: 1 })[0].title).toBe("Er staat nog 1 taak open");
    expect(summaryMessages(prefs, morning, TZ, { todayOpen: 0, openIncludingOverdue: 0 })).toEqual([]);
    expect(summaryMessages(prefs, evening, TZ, { todayOpen: 0, openIncludingOverdue: 0 })).toEqual([]);
  });

  it("overzichten noemen niemand: geen 'voor jou', 'van jou' of 'jouw naam' (V-21, AC-074)", () => {
    const moments = ["2026-09-27T05:40:00Z", "2026-09-27T18:05:00Z"].map((t) => new Date(t));
    for (const c of [counts, { todayOpen: 1, openIncludingOverdue: 1 }, { todayOpen: 12, openIncludingOverdue: 30 }]) {
      for (const at of moments) {
        for (const m of summaryMessages(prefs, at, TZ, c)) {
          const text = `${m.title} ${m.body ?? ""}`;
          expect(text).not.toMatch(/voor jou|van jou|jouw naam|jouw|waarvan/i);
        }
      }
    }
  });

  it("uitgezette voorkeur geeft geen overzicht", () => {
    const off = { ...prefs, dailySummaryEnabled: false, eveningSummaryEnabled: false };
    expect(summaryMessages(off, new Date("2026-09-27T05:40:00Z"), TZ, counts)).toEqual([]);
    expect(summaryMessages(off, new Date("2026-09-27T18:05:00Z"), TZ, counts)).toEqual([]);
  });
});
