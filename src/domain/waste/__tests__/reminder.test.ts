import { describe, expect, it } from "vitest";
import { wasteReminder, wasteReminderAnchor, type WasteReminderTask } from "@/domain/reminders";

/**
 * WP3b — herinneringen voor afvaltaken (BR-55; TECHNICAL_DESIGN §18.9.1).
 * AC-194, AC-195, AC-211: alleen voor open taken, één per taak, nooit
 * "deadline nadert" of "verlopen". Ophaaldag dinsdag 6 oktober 2026 (UTC+2).
 */
const TZ = "Europe/Amsterdam";
const nl = (dagTijd: string) => new Date(`${dagTijd.replace(" ", "T")}:00+02:00`);

const uit = (status: WasteReminderTask["status"] = "todo"): WasteReminderTask => ({
  id: "taak-uit",
  title: "Restafval buitenzetten",
  status,
  pickupDate: "2026-10-06",
  direction: "out",
  streamCount: 1,
});
const binnen = (status: WasteReminderTask["status"] = "todo", streamCount = 1): WasteReminderTask => ({
  id: "taak-in",
  title: streamCount > 1 ? "Restafval- en papierbak binnenzetten" : "Restafvalbak binnenzetten",
  status,
  pickupDate: "2026-10-06",
  direction: "in",
  streamCount,
});

describe("wasteReminderAnchor", () => {
  it("buiten: maandag 21:00; binnen: dinsdag 18:00 (Nederlandse tijd)", () => {
    expect(wasteReminderAnchor("2026-10-06", "out", TZ)).toBe(nl("2026-10-05 21:00").toISOString());
    expect(wasteReminderAnchor("2026-10-06", "in", TZ)).toBe(nl("2026-10-06 18:00").toISOString());
  });
});

describe("wasteReminder (AC-194)", () => {
  it("(a) buitenzetten is om 20:30 al afgevinkt → om 21:00 geen herinnering", () => {
    expect(wasteReminder(uit("done"), nl("2026-10-05 21:00"), TZ)).toBeNull();
  });

  it("(b) binnenzetten is om 14:00 al afgevinkt → om 18:00 geen herinnering; overgeslagen ook niet", () => {
    expect(wasteReminder(binnen("done"), nl("2026-10-06 18:00"), TZ)).toBeNull();
    expect(wasteReminder(binnen("skipped"), nl("2026-10-06 18:00"), TZ)).toBeNull();
  });

  it("(c) beide open: om 21:00 M-01 met de letterlijke titel en tekst", () => {
    expect(wasteReminder(uit(), nl("2026-10-05 21:00"), TZ)).toEqual({
      type: "reminder",
      title: "Herinnering: Restafval buitenzetten",
      body: "Morgen ophaaldag. Mag vanaf 22:00 buiten, uiterlijk morgen 07:45.",
      taskId: "taak-uit",
      dedupeKey: `waste:taak-uit:${nl("2026-10-05 21:00").toISOString()}`,
    });
  });

  it("(c) beide open: om 18:00 M-02, ook als de taak 'bezig' is", () => {
    expect(wasteReminder(binnen("in_progress"), nl("2026-10-06 18:00"), TZ)).toEqual({
      type: "reminder",
      title: "Herinnering: Restafvalbak binnenzetten",
      body: "Vandaag was de ophaaldag. Zet de bak vandaag nog binnen.",
      taskId: "taak-in",
      dedupeKey: `waste:taak-in:${nl("2026-10-06 18:00").toISOString()}`,
    });
  });

  it("AC-195: twee bakken → één herinnering met de meervoudstekst", () => {
    expect(wasteReminder(binnen("todo", 2), nl("2026-10-06 18:05"), TZ)?.body).toBe("Vandaag was de ophaaldag. Zet de bakken vandaag nog binnen.");
  });

  it("vóór het moment niets; binnen de speling van 90 minuten wel; daarna niet meer (AC-203 b/d)", () => {
    expect(wasteReminder(uit(), nl("2026-10-05 20:59"), TZ)).toBeNull();
    expect(wasteReminder(uit(), nl("2026-10-05 22:29"), TZ)).not.toBeNull();
    expect(wasteReminder(uit(), nl("2026-10-05 22:30"), TZ)).toBeNull();
    expect(wasteReminder(uit(), nl("2026-10-05 23:00"), TZ)).toBeNull();
    expect(wasteReminder(binnen(), nl("2026-10-06 19:45"), TZ)).toBeNull();
  });

  it("dezelfde sleutel bij elke tick binnen de speling: een tweede tick verstuurt niets opnieuw", () => {
    const a = wasteReminder(uit(), nl("2026-10-05 21:00"), TZ);
    const b = wasteReminder(uit(), nl("2026-10-05 21:15"), TZ);
    expect(a?.dedupeKey).toBe(b?.dedupeKey);
  });

  it("AC-211: een afvaltaak geeft nooit 'deadline nadert' of 'verlopen', ook niet 's nachts of na 07:45", () => {
    for (const moment of ["2026-10-06 02:00", "2026-10-06 06:45", "2026-10-06 07:50", "2026-10-06 12:00"]) {
      const bericht = wasteReminder(uit(), nl(moment), TZ);
      expect(bericht === null || bericht.type === "reminder").toBe(true);
    }
  });
});
