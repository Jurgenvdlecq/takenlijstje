import { describe, expect, it } from "vitest";
import { isoWeekday } from "../dates";
import { nextOccurrenceAfter, occurrenceIndex, occurrencesBetween } from "../recurrence/occurrences";
import { describeRule, recurrenceRuleSchema } from "../recurrence/rule";
import { computeWindow, shiftInstant } from "../recurrence/window";

// 2026-09-27 is een zondag
const START = "2026-09-01"; // dinsdag

describe("planningsregels", () => {
  it("dagelijks en elke X dagen", () => {
    expect(occurrencesBetween({ rule: { freq: "daily", interval: 1 }, startsOn: START }, "2026-09-01", "2026-09-03"))
      .toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
    expect(occurrencesBetween({ rule: { freq: "daily", interval: 3 }, startsOn: START }, "2026-09-01", "2026-09-10"))
      .toEqual(["2026-09-01", "2026-09-04", "2026-09-07", "2026-09-10"]);
  });

  it("badkamer elke zaterdag", () => {
    const dates = occurrencesBetween({ rule: { freq: "weekly", interval: 1, weekdays: [6] }, startsOn: START }, "2026-09-01", "2026-09-30");
    expect(dates).toEqual(["2026-09-05", "2026-09-12", "2026-09-19", "2026-09-26"]);
    expect(dates.every((d) => isoWeekday(d) === 6)).toBe(true);
  });

  it("WC elke woensdag en zondag", () => {
    expect(occurrencesBetween({ rule: { freq: "weekly", interval: 1, weekdays: [3, 7] }, startsOn: START }, "2026-09-01", "2026-09-14"))
      .toEqual(["2026-09-02", "2026-09-06", "2026-09-09", "2026-09-13"]);
  });

  it("bed verschonen elke 2 weken op zondag (vanaf de startweek)", () => {
    expect(occurrencesBetween({ rule: { freq: "weekly", interval: 2, weekdays: [7] }, startsOn: START }, "2026-09-01", "2026-10-15"))
      .toEqual(["2026-09-06", "2026-09-20", "2026-10-04"]);
  });

  it("maandelijks, laatste dag en de 31e in korte maanden", () => {
    const series = { rule: { freq: "monthly" as const, interval: 1, monthDay: 31 }, startsOn: "2026-01-01" };
    expect(occurrencesBetween(series, "2026-01-01", "2026-04-30")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(occurrencesBetween({ rule: { freq: "monthly", interval: 2, monthDay: -1 }, startsOn: "2026-01-15" }, "2026-01-01", "2026-06-30"))
      .toEqual(["2026-01-31", "2026-03-31", "2026-05-31"]);
  });

  it("eerste zaterdag van de maand", () => {
    expect(occurrencesBetween({ rule: { freq: "monthly", interval: 1, nth: 1, weekday: 6 }, startsOn: START }, "2026-09-01", "2026-11-30"))
      .toEqual(["2026-09-05", "2026-10-03", "2026-11-07"]);
  });

  it("jaarlijks", () => {
    expect(nextOccurrenceAfter({ rule: { freq: "yearly", interval: 1, month: 4, monthDay: 1 }, startsOn: START }, "2026-09-27"))
      .toBe("2027-04-01");
  });

  it("pauze: gras maaien 1 nov t/m 1 mrt, daarna vanzelf hervat", () => {
    const series = {
      rule: { freq: "weekly" as const, interval: 1, weekdays: [6] },
      startsOn: START,
      pausedFrom: "2026-11-01",
      pausedUntil: "2027-03-01",
    };
    expect(nextOccurrenceAfter(series, "2026-10-31")).toBe("2027-03-06");
    expect(occurrencesBetween(series, "2026-10-20", "2026-11-10")).toEqual(["2026-10-24", "2026-10-31"]);
  });

  it("einddatum", () => {
    expect(nextOccurrenceAfter({ rule: { freq: "daily", interval: 1 }, startsOn: START, endsOn: "2026-09-05" }, "2026-09-05")).toBeNull();
  });

  it("volgnummer voor om-en-om", () => {
    const series = { rule: { freq: "weekly" as const, interval: 1, weekdays: [3, 7] }, startsOn: START };
    expect(occurrenceIndex(series, "2026-09-02")).toBe(0);
    expect(occurrenceIndex(series, "2026-09-06")).toBe(1);
    expect(occurrenceIndex(series, "2026-09-09")).toBe(2);
  });

  it("valideert en beschrijft regels", () => {
    expect(recurrenceRuleSchema.safeParse({ freq: "weekly", interval: 1, weekdays: [] }).success).toBe(false);
    expect(recurrenceRuleSchema.safeParse({ freq: "monthly", interval: 1 }).success).toBe(false);
    expect(recurrenceRuleSchema.safeParse({ freq: "hourly", interval: 1 }).success).toBe(false);
    const parsed = recurrenceRuleSchema.parse({ freq: "weekly", interval: 1, weekdays: [7, 3, 3] });
    expect(parsed).toEqual({ freq: "weekly", interval: 1, weekdays: [3, 7] });
    expect(describeRule(parsed)).toBe("Elke woensdag en zondag");
    expect(describeRule({ freq: "weekly", interval: 2, weekdays: [7] })).toBe("Elke 2 weken op zondag");
    expect(describeRule({ freq: "daily", interval: 1 })).toBe("Dagelijks");
    expect(describeRule({ freq: "monthly", interval: 1, nth: 1, weekday: 6 })).toBe("Maandelijks op de eerste zaterdag");
  });
});

describe("deadline-venster", () => {
  it("badkamer: beschikbaar vrijdag, bij voorkeur zaterdag, uiterlijk zondag 18:00", () => {
    const w = computeWindow("2026-10-03", { availableDaysBefore: 1, dueDaysAfter: 1, dueTime: "18:00" }, "Europe/Amsterdam");
    expect(w.availableFrom).toBe("2026-10-01T22:00:00.000Z"); // vrijdag 00:00 CEST
    expect(w.dueAt).toBe("2026-10-04T16:00:00.000Z"); // zondag 18:00 CEST
  });

  it("zonder deadline: einde van de dag, ook in de wintertijd", () => {
    const w = computeWindow("2026-12-05", { timeOfDay: "10:00" }, "Europe/Amsterdam");
    expect(w.scheduledTime).toBe("10:00");
    expect(w.dueAt).toBe("2026-12-05T22:59:00.000Z");
  });

  it("verschuiven over de wisseling naar wintertijd behoudt de kloktijd", () => {
    // za 24 okt 18:00 CEST → za 31 okt 18:00 CET
    expect(shiftInstant("2026-10-24T16:00:00.000Z", 7, "Europe/Amsterdam")).toBe("2026-10-31T17:00:00.000Z");
  });
});
