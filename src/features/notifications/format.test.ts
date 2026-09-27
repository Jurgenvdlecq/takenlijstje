import { describe, expect, it } from "vitest";
import { groupByDay, relativeTime } from "./format";

const tz = "Europe/Amsterdam";
// 27 september 2026, 20:00 in Amsterdam (zomertijd, UTC+2)
const now = new Date("2026-09-27T18:00:00Z");

describe("relativeTime", () => {
  it.each([
    ["2026-09-27T17:59:40Z", "zojuist"],
    ["2026-09-27T17:55:00Z", "5 min geleden"],
    ["2026-09-27T15:00:00Z", "3 uur geleden"],
    ["2026-09-26T16:04:00Z", "gisteren 18:04"],
    ["2026-09-24T08:30:00Z", "donderdag 10:30"],
    ["2026-09-01T08:30:00Z", "1 sep"],
    ["2025-12-24T08:30:00Z", "24 dec 2025"],
  ])("%s → %s", (instant, expected) => {
    expect(relativeTime(instant, now, tz)).toBe(expected);
  });

  it("net na middernacht lokaal is 'gisteren' ook al is het minder dan een dag", () => {
    const earlyMorning = new Date("2026-09-26T22:30:00Z"); // 00:30 lokaal
    expect(relativeTime("2026-09-26T21:00:00Z", earlyMorning, tz)).toBe("gisteren 23:00");
  });
});

describe("groupByDay", () => {
  it("vandaag en eerder, nieuwste eerst", () => {
    const items = [
      { id: "a", created_at: "2026-09-26T21:00:00Z" }, // 23:00 gisteren
      { id: "b", created_at: "2026-09-27T06:00:00Z" },
      { id: "c", created_at: "2026-09-27T17:00:00Z" },
    ];
    const { today, earlier } = groupByDay(items, now, tz);
    expect(today.map((i) => i.id)).toEqual(["c", "b"]);
    expect(earlier.map((i) => i.id)).toEqual(["a"]);
  });
});
