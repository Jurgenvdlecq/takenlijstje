import { describe, expect, it } from "vitest";
import { buildLoadMap, pointsForDuration } from "../assignment/load";
import { pickAssignee, type AssignmentContext } from "../assignment/strategies";
import { planSeries, type SeriesDefinition } from "../scheduling/plan";

const members = [
  { id: "jurgen", isActive: true, sortOrder: 0 },
  { id: "ellen", isActive: true, sortOrder: 1 },
  { id: "lynn", isActive: true, sortOrder: 2 },
  { id: "kai", isActive: true, sortOrder: 3 },
];

function ctx(overrides: Partial<AssignmentContext> = {}): AssignmentContext {
  return { members, absences: [], loads: buildLoadMap([], members.map((m) => m.id)), ...overrides };
}

describe("punten", () => {
  it("5 min = 1, 30 min = 3, 60 min = 6", () => {
    expect(pointsForDuration(5)).toBe(1);
    expect(pointsForDuration(30)).toBe(3);
    expect(pointsForDuration(60)).toBe(6);
    expect(pointsForDuration(null)).toBe(1);
  });
});

describe("verdeelstrategieën", () => {
  it("vast persoon", () => {
    expect(pickAssignee({ strategy: "fixed", date: "2026-10-03", fixedMemberId: "jurgen" }, ctx()).memberId).toBe("jurgen");
  });

  it("vaste persoon afwezig → eerlijk naar een ander", () => {
    const result = pickAssignee(
      { strategy: "fixed", date: "2026-08-12", fixedMemberId: "ellen" },
      ctx({ absences: [{ memberId: "ellen", startsOn: "2026-08-10", endsOn: "2026-08-17", strategy: "reassign" }] }),
    );
    expect(result.memberId).toBe("jurgen");
    expect(result.reason).toBe("absence");
  });

  it("om en om: Jurgen → Ellen → Lynn → Jurgen", () => {
    const order = ["jurgen", "ellen", "lynn"];
    const picks = [0, 1, 2, 3].map(
      (i) => pickAssignee({ strategy: "rotation", date: "2026-10-01", rotationMemberIds: order, occurrenceIndex: i }, ctx()).memberId,
    );
    expect(picks).toEqual(["jurgen", "ellen", "lynn", "jurgen"]);
  });

  it("om en om slaat afwezige en inactieve personen over", () => {
    const c = ctx({
      members: members.map((m) => (m.id === "lynn" ? { ...m, isActive: false } : m)),
      absences: [{ memberId: "ellen", startsOn: "2026-10-01", endsOn: "2026-10-01", strategy: "reassign" }],
    });
    expect(pickAssignee({ strategy: "rotation", date: "2026-10-01", rotationMemberIds: ["ellen", "lynn", "kai"], occurrenceIndex: 0 }, c).memberId).toBe("kai");
  });

  it("willekeurig kiest uit beschikbare leden", () => {
    expect(pickAssignee({ strategy: "random", date: "2026-10-01" }, ctx({ random: () => 0.99 })).memberId).toBe("kai");
  });

  it("eerlijk: laagste belasting in punten", () => {
    const loads = buildLoadMap(
      [
        { memberId: "jurgen", points: 6 },
        { memberId: "ellen", points: 1 },
        { memberId: "ellen", points: 1 },
        { memberId: "lynn", points: 3 },
        { memberId: "kai", points: 2 },
      ],
      members.map((m) => m.id),
    );
    // Ellen deed 2 taken maar lichte; Kai 1 taak van 2 punten → gelijk; Kai minder taken
    expect(pickAssignee({ strategy: "fair", date: "2026-10-01" }, ctx({ loads })).memberId).toBe("kai");
  });
});

describe("vooruit inplannen", () => {
  const base: SeriesDefinition = {
    id: "wc",
    rule: { freq: "weekly", interval: 1, weekdays: [3, 7] },
    startsOn: "2026-09-27",
    timeOfDay: null,
    availableDaysBefore: 0,
    dueDaysAfter: 0,
    dueTime: null,
    assignmentStrategy: "rotation",
    fixedMemberId: null,
    rotationMemberIds: ["jurgen", "ellen", "lynn"],
    points: 3,
    durationMinutes: 15,
    generatedUntil: null,
  };

  it("plant 14 dagen vooruit met rotatie", () => {
    const result = planSeries({
      series: base,
      today: "2026-09-27",
      timeZone: "Europe/Amsterdam",
      existingOccurrenceDates: new Set(),
      hasOpenUpcoming: false,
      assignment: ctx(),
    });
    expect(result.occurrences.map((o) => [o.occurrenceDate, o.assignedMemberId])).toEqual([
      ["2026-09-27", "jurgen"],
      ["2026-09-30", "ellen"],
      ["2026-10-04", "lynn"],
      ["2026-10-07", "jurgen"],
      ["2026-10-11", "ellen"],
    ]);
    expect(result.generatedUntil).toBe("2026-10-11");
  });

  it("maakt geen dubbele taken en gaat verder waar hij was", () => {
    const result = planSeries({
      series: { ...base, generatedUntil: "2026-10-04" },
      today: "2026-09-27",
      timeZone: "Europe/Amsterdam",
      existingOccurrenceDates: new Set(["2026-10-07"]),
      hasOpenUpcoming: true,
      assignment: ctx(),
    });
    expect(result.occurrences.map((o) => o.occurrenceDate)).toEqual(["2026-10-11"]);
  });

  it("maandelijkse taak: alleen de eerstvolgende", () => {
    const result = planSeries({
      series: { ...base, rule: { freq: "monthly", interval: 1, monthDay: 1 }, assignmentStrategy: "none" },
      today: "2026-10-02",
      timeZone: "Europe/Amsterdam",
      existingOccurrenceDates: new Set(),
      hasOpenUpcoming: false,
      assignment: ctx(),
    });
    expect(result.occurrences.map((o) => o.occurrenceDate)).toEqual(["2026-11-01"]);
    expect(result.generatedUntil).toBe("2026-11-01");
  });

  it("afwezigheid met 'doorschuiven' verplaatst de taak naar na de vakantie", () => {
    const result = planSeries({
      series: { ...base, startsOn: "2026-08-01", assignmentStrategy: "fixed", fixedMemberId: "ellen", rule: { freq: "weekly", interval: 1, weekdays: [6] } },
      today: "2026-08-01",
      timeZone: "Europe/Amsterdam",
      existingOccurrenceDates: new Set(),
      hasOpenUpcoming: false,
      assignment: ctx({ absences: [{ memberId: "ellen", startsOn: "2026-08-10", endsOn: "2026-08-17", strategy: "postpone" }] }),
      horizonDays: 21,
      from: "2026-08-01",
    });
    const aug15 = result.occurrences.find((o) => o.occurrenceDate === "2026-08-15")!;
    expect(aug15.scheduledDate).toBe("2026-08-18");
    expect(aug15.assignedMemberId).toBe("ellen");
  });

  it("eerlijke verdeling houdt rekening met wat al ingepland is", () => {
    const result = planSeries({
      series: { ...base, assignmentStrategy: "fair", rule: { freq: "daily", interval: 1 } },
      today: "2026-09-27",
      timeZone: "Europe/Amsterdam",
      existingOccurrenceDates: new Set(),
      hasOpenUpcoming: false,
      assignment: ctx(),
      horizonDays: 7,
    });
    const counts = new Map<string, number>();
    for (const o of result.occurrences) counts.set(o.assignedMemberId!, (counts.get(o.assignedMemberId!) ?? 0) + 1);
    // 8 dagen over 4 personen → ieder 2
    expect([...counts.values()]).toEqual([2, 2, 2, 2]);
  });
});
