import { describe, expect, it } from "vitest";
import { summaryMessages, taskMessages, type ReminderPrefs, type ReminderTask } from "../reminders";
import { planSeries, type SeriesDefinition } from "../scheduling/plan";

/**
 * WP3 — momenten en teksten van meldingen (ACCEPTANCE_CRITERIA AC-070, AC-074)
 * en pauze in de planning met de letterlijke data uit AC-067.
 * Vaste tijden, geen klok.
 */
const TZ = "Europe/Amsterdam";
const DEADLINE = "2026-10-06T16:00:00.000Z"; // 18:00 lokaal (zomertijd)
const prefs: ReminderPrefs = {
  deadlineWarningMinutes: 120,
  dailySummaryEnabled: true,
  dailySummaryTime: "07:30",
  eveningSummaryEnabled: true,
  eveningSummaryTime: "20:00",
};
const task: ReminderTask = {
  id: "t1",
  title: "Badkamer schoonmaken",
  status: "todo",
  scheduledDate: "2026-10-06",
  scheduledTime: null,
  dueAt: DEADLINE,
  reminderMinutesBefore: [60],
};

/** Moment ten opzichte van de deadline, in minuten */
const at = (minutesFromDeadline: number) => new Date(new Date(DEADLINE).getTime() + minutesFromDeadline * 60_000);
const typesAt = (minutesFromDeadline: number, t: ReminderTask = task) =>
  taskMessages(t, prefs, at(minutesFromDeadline), TZ).map((m) => m.type).sort();

describe("AC-070: moment van herinneren en waarschuwen", () => {
  it("herinnering 60 minuten vooraf: niet eerder, wel precies op het moment", () => {
    expect(typesAt(-61)).not.toContain("reminder");
    expect(typesAt(-60)).toContain("reminder");
  });

  it("herinnering komt niet meer als het moment meer dan 90 minuten voorbij is", () => {
    // herinneringsmoment = deadline − 60; +89 min is nog op tijd, +90 niet meer
    expect(taskMessages({ ...task, dueAt: DEADLINE }, { ...prefs, deadlineWarningMinutes: 0 }, at(-60 + 89), TZ).map((m) => m.type)).toContain("reminder");
    expect(taskMessages({ ...task, dueAt: DEADLINE }, { ...prefs, deadlineWarningMinutes: 0 }, at(-60 + 90), TZ).map((m) => m.type)).not.toContain("reminder");
  });

  it("'deadline nadert' binnen 120 minuten vóór de deadline, niet eerder en niet op of na de deadline", () => {
    expect(typesAt(-121)).not.toContain("deadline_soon");
    expect(typesAt(-120)).toContain("deadline_soon");
    expect(typesAt(-1)).toContain("deadline_soon");
    expect(typesAt(0)).not.toContain("deadline_soon");
  });

  it("de waarschuwingstijd volgt de eigen voorkeur", () => {
    const kort = { ...prefs, deadlineWarningMinutes: 30 };
    expect(taskMessages(task, kort, at(-31), TZ).map((m) => m.type)).not.toContain("deadline_soon");
    expect(taskMessages(task, kort, at(-30), TZ).map((m) => m.type)).toContain("deadline_soon");
  });

  it("'verlopen' vanaf de deadline tot 24 uur erna, daarna niet meer", () => {
    expect(typesAt(-1)).not.toContain("overdue");
    expect(typesAt(0)).toContain("overdue");
    expect(typesAt(24 * 60 - 1)).toContain("overdue");
    expect(typesAt(24 * 60)).not.toContain("overdue");
  });

  it("'verlopen' één keer: dezelfde dedupe-sleutel bij elke tick binnen het venster", () => {
    const keys = [0, 15, 600, 1439].map((m) => taskMessages(task, prefs, at(m), TZ).find((x) => x.type === "overdue")!.dedupeKey);
    expect(new Set(keys).size).toBe(1);
  });

  it("herinnering en 'deadline nadert' houden ook elk één sleutel over opeenvolgende ticks", () => {
    const reminderKeys = [-60, -45, -30].map((m) => taskMessages(task, prefs, at(m), TZ).find((x) => x.type === "reminder")!.dedupeKey);
    const soonKeys = [-120, -60, -1].map((m) => taskMessages(task, prefs, at(m), TZ).find((x) => x.type === "deadline_soon")!.dedupeKey);
    expect(new Set(reminderKeys).size).toBe(1);
    expect(new Set(soonKeys).size).toBe(1);
  });

  it("een verplaatste deadline geeft een nieuwe sleutel (nieuwe melding hoort erbij)", () => {
    const later = { ...task, dueAt: "2026-10-07T16:00:00.000Z" };
    const a = taskMessages(task, prefs, at(0), TZ).find((x) => x.type === "overdue")!.dedupeKey;
    const b = taskMessages(later, prefs, new Date("2026-10-07T16:00:00.000Z"), TZ).find((x) => x.type === "overdue")!.dedupeKey;
    expect(a).not.toBe(b);
  });

  it("met een gepland tijdstip is dat het ankerpunt van de herinnering, niet de deadline", () => {
    const gepland = { ...task, scheduledTime: "10:00", dueAt: null }; // 10:00 lokaal = 08:00Z
    expect(taskMessages(gepland, prefs, new Date("2026-10-06T06:59:00Z"), TZ)).toEqual([]);
    expect(taskMessages(gepland, prefs, new Date("2026-10-06T07:00:00Z"), TZ).map((m) => m.type)).toEqual(["reminder"]);
  });

  it("geen meldingen voor gedaan of overgeslagen", () => {
    for (const status of ["done", "skipped"] as const) {
      expect(taskMessages({ ...task, status }, prefs, at(-60), TZ)).toEqual([]);
      expect(taskMessages({ ...task, status }, prefs, at(10), TZ)).toEqual([]);
    }
  });
});

describe("AC-074: meldingsteksten bevatten geen namen van leden", () => {
  const namen = ["Jurgen", "Ellen", "Lynn", "Kai"];

  function alleTeksten(t: ReminderTask): string[] {
    const teksten: string[] = [];
    for (const m of [-60, -30, 0, 60]) for (const x of taskMessages({ ...t, reminderMinutesBefore: [0, 30, 60] }, prefs, at(m), TZ)) teksten.push(`${x.title} ${x.body ?? ""}`);
    for (const time of ["07:30", "20:00"]) {
      const now = new Date(`2026-10-06T${time === "07:30" ? "05:30" : "18:00"}:00Z`);
      for (const counts of [{ todayOpen: 1, openIncludingOverdue: 1 }, { todayOpen: 5, openIncludingOverdue: 6 }]) {
        for (const x of summaryMessages(prefs, now, TZ, counts)) teksten.push(`${x.title} ${x.body ?? ""}`);
      }
    }
    return teksten;
  }

  it("herinnering, deadline nadert, verlopen en beide overzichten: geen naam, geen 'jou/jouw'", () => {
    const teksten = alleTeksten(task);
    // Alle soorten zijn langsgekomen
    expect(teksten.length).toBeGreaterThanOrEqual(8);
    for (const tekst of teksten) {
      for (const naam of namen) expect(tekst).not.toContain(naam);
      expect(tekst.toLowerCase()).not.toMatch(/\bjou\b|\bjouw\b|\bjij\b/);
    }
  });

  it("een naam in de taaktitel zelf mag blijven staan", () => {
    const teksten = alleTeksten({ ...task, title: "Kamer van Kai opruimen" });
    const metTitel = teksten.filter((t) => t.includes("Kamer van Kai opruimen"));
    expect(metTitel.length).toBeGreaterThan(0);
    // buiten de titel komt de naam niet voor
    for (const tekst of teksten) expect(tekst.replace("Kamer van Kai opruimen", "")).not.toContain("Kai");
  });
});

describe("AC-067: pauze van 1 tot en met 14 november", () => {
  const reeks = (rule: SeriesDefinition["rule"], overrides: Partial<SeriesDefinition> = {}): SeriesDefinition => ({
    id: "r-pauze",
    rule,
    startsOn: "2026-09-01",
    endsOn: null,
    pausedFrom: "2026-11-01",
    pausedUntil: "2026-11-14",
    timeOfDay: null,
    availableDaysBefore: 0,
    dueDaysAfter: 0,
    dueTime: null,
    durationMinutes: null,
    generatedUntil: null,
    ...overrides,
  });
  const plan = (series: SeriesDefinition, today: string) =>
    planSeries({ series, today, timeZone: TZ, existingOccurrenceDates: new Set(), hasOpenUpcoming: false }).occurrences.map((o) => o.occurrenceDate);

  it("dagelijks, gepland vanaf 25 oktober: tot en met 31 oktober, niets in 1–14 november", () => {
    const datums = plan(reeks({ freq: "daily", interval: 1 }), "2026-10-25");
    expect(datums).toEqual(["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"]);
  });

  it("dagelijks, gepland op 10 november: weer uitvoeringen vanaf 15 november, zonder handeling", () => {
    const datums = plan(reeks({ freq: "daily", interval: 1 }), "2026-11-10");
    expect(datums[0]).toBe("2026-11-15");
    expect(datums.every((d) => d > "2026-11-14")).toBe(true);
    expect(datums.at(-1)).toBe("2026-11-24");
  });

  it("maandelijks op de 5e: de uitvoering van 5 november vervalt, de eerstvolgende is 5 december", () => {
    expect(plan(reeks({ freq: "monthly", interval: 1, monthDay: 5 } as SeriesDefinition["rule"]), "2026-10-20")).toEqual(["2026-12-05"]);
  });
});

describe("AC-064: herinnering uiterlijk T + 15 minuten, ook voor een taak van morgen vroeg", () => {
  // Taak morgen om 00:30 lokaal, herinnering 60 min vooraf → T = vandaag 23:30 lokaal = 21:30Z
  const vroeg: ReminderTask = { ...task, id: "vroeg", scheduledDate: "2026-10-07", scheduledTime: "00:30", dueAt: null, reminderMinutesBefore: [60] };
  const T = new Date("2026-10-06T21:30:00Z");
  const na = (min: number) => new Date(T.getTime() + min * 60_000);

  it("vóór T nog niet", () => {
    expect(taskMessages(vroeg, prefs, na(-1), TZ)).toEqual([]);
  });

  it("elke tick in [T, T + 15] maakt de herinnering, met steeds dezelfde sleutel", () => {
    const keys = [0, 1, 7, 14, 15].map((m) => {
      const msgs = taskMessages(vroeg, prefs, na(m), TZ);
      expect(msgs.map((x) => x.type)).toEqual(["reminder"]);
      return msgs[0].dedupeKey;
    });
    expect(new Set(keys).size).toBe(1);
  });
});
