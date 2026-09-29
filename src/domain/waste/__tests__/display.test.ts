import { describe, expect, it } from "vitest";
import { isWasteTask, wasteCalendarTime, wasteListTime } from "../display";

/**
 * WP3b — hoe een afvaltaak in lijst en kalender staat (UX §13.4, §13.13.1).
 * AC-192 (T-16, T-17), AC-193 (T-18). Nergens "21:00".
 * Ophaaldag dinsdag 6 oktober 2026 (zomertijd, UTC+2).
 */
const TZ = "Europe/Amsterdam";
const nl = (dagTijd: string) => new Date(`${dagTijd.replace(" ", "T")}:00+02:00`);
const uit = { waste_direction: "out" as const, waste_pickup_date: "2026-10-06" };
const binnen = { waste_direction: "in" as const, waste_pickup_date: "2026-10-06" };

describe("isWasteTask", () => {
  it("alleen met richting én ophaaldag", () => {
    expect(isWasteTask(uit)).toBe(true);
    expect(isWasteTask({ waste_direction: null, waste_pickup_date: null })).toBe(false);
    expect(isWasteTask({ waste_direction: "out", waste_pickup_date: null })).toBe(false);
  });
});

describe("wasteListTime — buitenzetten (AC-192)", () => {
  it('maandag (D−1), de hele dag: "vanaf 22:00" (T-16), nooit "21:00"', () => {
    expect(wasteListTime(uit, nl("2026-10-05 08:00"), TZ)).toBe("vanaf 22:00");
    expect(wasteListTime(uit, nl("2026-10-05 21:00"), TZ)).toBe("vanaf 22:00");
    expect(wasteListTime(uit, nl("2026-10-05 23:30"), TZ)).toBe("vanaf 22:00");
  });

  it('dinsdag vóór 07:45: "vóór 07:45" (T-17); vanaf 07:45 niets meer (dan staat hij bij Verlopen)', () => {
    expect(wasteListTime(uit, nl("2026-10-06 00:10"), TZ)).toBe("vóór 07:45");
    expect(wasteListTime(uit, nl("2026-10-06 07:44"), TZ)).toBe("vóór 07:45");
    expect(wasteListTime(uit, nl("2026-10-06 07:45"), TZ)).toBeNull();
    expect(wasteListTime(uit, nl("2026-10-06 09:00"), TZ)).toBeNull();
  });

  it("zondag (D−2, Binnenkort): alleen de dag, geen tijd", () => {
    expect(wasteListTime(uit, nl("2026-10-04 20:00"), TZ)).toBeNull();
  });
});

describe("wasteListTime — binnenzetten (AC-193)", () => {
  it('dinsdag vóór 12:00: "vanaf 12:00" (T-18); vanaf 12:00 niets', () => {
    expect(wasteListTime(binnen, nl("2026-10-06 08:00"), TZ)).toBe("vanaf 12:00");
    expect(wasteListTime(binnen, nl("2026-10-06 11:59"), TZ)).toBe("vanaf 12:00");
    expect(wasteListTime(binnen, nl("2026-10-06 12:00"), TZ)).toBeNull();
  });

  it("maandag (Binnenkort, 'morgen') en woensdag: geen tijd", () => {
    expect(wasteListTime(binnen, nl("2026-10-05 20:00"), TZ)).toBeNull();
    expect(wasteListTime(binnen, nl("2026-10-07 08:00"), TZ)).toBeNull();
  });

  it("een gewone taak krijgt nooit een afvaltijd", () => {
    expect(wasteListTime({ waste_direction: null, waste_pickup_date: null }, nl("2026-10-06 08:00"), TZ)).toBeNull();
  });
});

describe("wasteCalendarTime — kalender toont het geplande moment, los van nu (D-047)", () => {
  it('buiten "vanaf 22:00", binnen "vanaf 12:00"', () => {
    expect(wasteCalendarTime("out")).toBe("vanaf 22:00");
    expect(wasteCalendarTime("in")).toBe("vanaf 12:00");
  });
});
