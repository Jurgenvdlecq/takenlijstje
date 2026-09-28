import { describe, expect, it } from "vitest";
import { HORIZON_DAYS, planSeries, type SeriesDefinition } from "../scheduling/plan";

/**
 * WP2a — planSeries zonder toewijzing (TECHNICAL_DESIGN §13 "Unit"; V-21, BR-02).
 * Vaste datums, geen klok.
 */
const TZ = "Europe/Amsterdam";
const TODAY = "2026-09-28"; // maandag

function series(overrides: Partial<SeriesDefinition> = {}): SeriesDefinition {
  return {
    id: "r1",
    rule: { freq: "weekly", interval: 1, weekdays: [2] }, // dinsdag
    startsOn: "2026-09-01",
    endsOn: null,
    pausedFrom: null,
    pausedUntil: null,
    timeOfDay: null,
    availableDaysBefore: 0,
    dueDaysAfter: 0,
    dueTime: null,
    durationMinutes: null,
    generatedUntil: null,
    ...overrides,
  };
}

describe("planSeries zonder toewijzing (V-21)", () => {
  it("plant 14 dagen vooruit, vanaf vandaag", () => {
    expect(HORIZON_DAYS).toBe(14);
    const result = planSeries({ series: series(), today: TODAY, timeZone: TZ, existingOccurrenceDates: new Set(), hasOpenUpcoming: false });
    expect(result.occurrences.map((o) => o.occurrenceDate)).toEqual(["2026-09-29", "2026-10-06"]);
    expect(result.generatedUntil).toBe("2026-10-12");
  });

  it("een geplande uitvoering bevat geen persoon, reden of punten", () => {
    const result = planSeries({ series: series(), today: TODAY, timeZone: TZ, existingOccurrenceDates: new Set(), hasOpenUpcoming: false });
    for (const o of result.occurrences) {
      expect(Object.keys(o).sort()).toEqual(["availableFrom", "dueAt", "occurrenceDate", "scheduledDate", "scheduledTime"]);
    }
  });

  it("maakt geen duplicaat van een datum die al bestaat", () => {
    const result = planSeries({
      series: series(),
      today: TODAY,
      timeZone: TZ,
      existingOccurrenceDates: new Set(["2026-09-29"]),
      hasOpenUpcoming: true,
    });
    expect(result.occurrences.map((o) => o.occurrenceDate)).toEqual(["2026-10-06"]);
  });

  it("tweede keer plannen met het resultaat van de eerste maakt niets extra (AC-044, BR-02)", () => {
    const first = planSeries({ series: series({ rule: { freq: "daily", interval: 1 } }), today: TODAY, timeZone: TZ, existingOccurrenceDates: new Set(), hasOpenUpcoming: false });
    const second = planSeries({
      series: series({ rule: { freq: "daily", interval: 1 }, generatedUntil: first.generatedUntil }),
      today: TODAY,
      timeZone: TZ,
      existingOccurrenceDates: new Set(first.occurrences.map((o) => o.occurrenceDate)),
      hasOpenUpcoming: true,
    });
    expect(second.occurrences).toEqual([]);
  });

  it("begint na generated_until", () => {
    const result = planSeries({
      series: series({ generatedUntil: "2026-10-01" }),
      today: TODAY,
      timeZone: TZ,
      existingOccurrenceDates: new Set(),
      hasOpenUpcoming: true,
    });
    expect(result.occurrences.map((o) => o.occurrenceDate)).toEqual(["2026-10-06"]);
  });

  it("'from' plant opnieuw vanaf die datum, ook binnen generated_until", () => {
    const result = planSeries({
      series: series({ generatedUntil: "2026-10-12" }),
      today: TODAY,
      timeZone: TZ,
      existingOccurrenceDates: new Set(),
      hasOpenUpcoming: true,
      from: "2026-10-01",
    });
    expect(result.occurrences.map((o) => o.occurrenceDate)).toEqual(["2026-10-06"]);
  });

  it("maandelijks buiten de horizon: alleen de eerstvolgende", () => {
    const result = planSeries({
      series: series({ rule: { freq: "monthly", interval: 1, monthDay: 20 } as SeriesDefinition["rule"] }),
      today: TODAY,
      timeZone: TZ,
      existingOccurrenceDates: new Set(),
      hasOpenUpcoming: false,
    });
    expect(result.occurrences.map((o) => o.occurrenceDate)).toEqual(["2026-10-20"]);
  });

  it("nooit in het verleden, ook met een startdatum ver terug", () => {
    const result = planSeries({ series: series({ rule: { freq: "daily", interval: 1 } }), today: TODAY, timeZone: TZ, existingOccurrenceDates: new Set(), hasOpenUpcoming: false });
    expect(result.occurrences[0].occurrenceDate).toBe(TODAY);
    expect(result.occurrences.every((o) => o.occurrenceDate >= TODAY)).toBe(true);
    expect(result.occurrences).toHaveLength(15); // vandaag t/m vandaag + 14
  });
});
