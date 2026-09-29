import { describe, expect, it } from "vitest";
import { wasteReminderAnchor } from "@/domain/reminders";
import {
  classifyEmpty,
  hasNoUpcoming,
  isEmptyPlan,
  pickupsByDay,
  planWasteTasks,
  wasteTaskFields,
  WASTE_HORIZON_DAYS,
  type ExistingWasteTask,
  type FetchedPickups,
} from "../plan";
import type { WastePickups } from "../streams";

/**
 * WP3b — afvaltaken plannen (TECHNICAL_DESIGN §18.4, §18.8.2, §18.8.4).
 * AC-192, AC-193, AC-196, AC-197, AC-198, AC-199, AC-200, AC-201, AC-203, AC-204, AC-206.
 */
const TZ = "Europe/Amsterdam";
const utc = (iso: string) => new Date(iso).toISOString();
const leeg = (extra: Partial<WastePickups> = {}): WastePickups => ({ rest: [], papier: [], pmd: [], ...extra });

let volgnummer = 0;
function taak(pickupDate: string, direction: "out" | "in", status: ExistingWasteTask["status"] = "todo", streams: ExistingWasteTask["streams"] = ["rest"]): ExistingWasteTask {
  volgnummer += 1;
  return { id: `taak-${volgnummer}`, pickupDate, direction, streams, status };
}

describe("wasteTaskFields — velden van buiten- en binnenzetten (AC-192, AC-193)", () => {
  it("buitenzetten voor di 6 okt: T-01, gepland ma 5 okt op 21:00, deadline di 07:45 Nederlandse tijd, geen omschrijving", () => {
    const velden = wasteTaskFields("2026-10-06", "out", ["rest"], TZ);
    expect(velden).toEqual({
      title: "Restafval buitenzetten",
      scheduled_date: "2026-10-05",
      scheduled_time: "21:00",
      available_from: null,
      due_at: utc("2026-10-06T05:45:00Z"), // 07:45 CEST
      waste_pickup_date: "2026-10-06",
      waste_direction: "out",
      waste_streams: ["rest"],
    });
    expect("description" in velden).toBe(false);
  });

  it("binnenzetten voor di 6 okt: T-08, gepland di 6 okt, vanaf 12:00, deadline einde van de dag", () => {
    expect(wasteTaskFields("2026-10-06", "in", ["rest"], TZ)).toEqual({
      title: "Restafvalbak binnenzetten",
      scheduled_date: "2026-10-06",
      scheduled_time: null,
      available_from: utc("2026-10-06T10:00:00Z"), // 12:00 CEST
      due_at: utc("2026-10-06T22:00:00Z"), // 00:00 CEST op 7 okt
      waste_pickup_date: "2026-10-06",
      waste_direction: "in",
      waste_streams: ["rest"],
    });
  });

  it("bakken komen in de vaste volgorde rest, papier, PMD, ook in de naam (AC-195)", () => {
    const velden = wasteTaskFields("2026-10-06", "out", ["pmd", "rest"], TZ);
    expect(velden.waste_streams).toEqual(["rest", "pmd"]);
    expect(velden.title).toBe("Restafval en PMD buitenzetten");
  });
});

describe("AC-206 — zomer- en wintertijd: alles op Nederlandse tijd", () => {
  it.each([
    // ophaaldag, herinnering D−1 21:00, deadline 07:45, binnen vanaf 12:00, herinnering 18:00 (in UTC)
    ["2026-10-26", "2026-10-25T20:00:00Z", "2026-10-26T06:45:00Z", "2026-10-26T11:00:00Z", "2026-10-26T17:00:00Z"], // (a) wintertijd
    ["2027-03-29", "2027-03-28T19:00:00Z", "2027-03-29T05:45:00Z", "2027-03-29T10:00:00Z", "2027-03-29T16:00:00Z"], // (b) zomertijd, net na de overgang
    ["2026-10-25", "2026-10-24T19:00:00Z", "2026-10-25T06:45:00Z", "2026-10-25T11:00:00Z", "2026-10-25T17:00:00Z"], // (c) overgang tussen buitenzetten en deadline
  ])("ophaaldag %s", (dag, herinneringUit, deadline, binnenVanaf, herinneringIn) => {
    const uit = wasteTaskFields(dag, "out", ["rest"], TZ);
    const binnen = wasteTaskFields(dag, "in", ["rest"], TZ);
    expect(wasteReminderAnchor(dag, "out", TZ)).toBe(utc(herinneringUit));
    expect(uit.due_at).toBe(utc(deadline));
    expect(binnen.available_from).toBe(utc(binnenVanaf));
    expect(wasteReminderAnchor(dag, "in", TZ)).toBe(utc(herinneringIn));
  });
});

describe("pickupsByDay — venster en alleen rest/papier/PMD (AC-196, AC-197)", () => {
  it("dagen buiten [from, to] vallen weg; bakken per dag gesorteerd", () => {
    const dagen = pickupsByDay(leeg({ rest: ["2026-10-01", "2026-10-08"], pmd: ["2026-10-08", "2026-10-20"], papier: ["2026-10-08"] }), "2026-10-05", "2026-10-19");
    expect([...dagen.entries()]).toEqual([["2026-10-08", ["rest", "papier", "pmd"]]]);
  });
});

describe("planWasteTasks — 14 dagen vooruit en nooit dubbel (AC-197)", () => {
  const now = new Date("2026-10-05T08:00:00Z");
  const pickups = leeg({ rest: ["2026-10-08", "2026-10-19", "2026-10-20"] }); // +3, +14, +15

  it("plant buiten én binnen voor +3 en +14, nog niet voor +15", () => {
    expect(WASTE_HORIZON_DAYS).toBe(14);
    const plan = planWasteTasks({ pickups, existing: [], now, timeZone: TZ });
    expect(plan.insert.map((t) => `${t.waste_pickup_date}|${t.waste_direction}`)).toEqual([
      "2026-10-08|out",
      "2026-10-08|in",
      "2026-10-19|out",
      "2026-10-19|in",
    ]);
    expect(plan.move).toEqual([]);
    expect(plan.rename).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it("een tweede ronde met dezelfde stand is leeg", () => {
    const eerste = planWasteTasks({ pickups, existing: [], now, timeZone: TZ });
    const bestaand = eerste.insert.map((t) => taak(t.waste_pickup_date, t.waste_direction));
    const tweede = planWasteTasks({ pickups, existing: bestaand, now, timeZone: TZ });
    expect(isEmptyPlan(tweede)).toBe(true);
  });

  it("de volgende dag komt +15 erbij", () => {
    const bestaand = [taak("2026-10-08", "out"), taak("2026-10-08", "in"), taak("2026-10-19", "out"), taak("2026-10-19", "in")];
    const plan = planWasteTasks({ pickups, existing: bestaand, now: new Date("2026-10-06T08:00:00Z"), timeZone: TZ });
    expect(plan.insert.map((t) => `${t.waste_pickup_date}|${t.waste_direction}`)).toEqual(["2026-10-20|out", "2026-10-20|in"]);
    expect(plan.remove).toEqual([]);
  });

  it("een dag met een taak in elke status (ook done of skipped) krijgt nooit een tweede taak", () => {
    const bestaand = [taak("2026-10-08", "out", "done"), taak("2026-10-08", "in", "skipped")];
    const plan = planWasteTasks({ pickups: leeg({ rest: ["2026-10-08"] }), existing: bestaand, now, timeZone: TZ });
    expect(isEmptyPlan(plan)).toBe(true);
  });
});

describe("planWasteTasks — verschoven ophaaldag (AC-198)", () => {
  const now = new Date("2026-12-15T08:00:00Z");

  it("(a) 25 → 26 december: beide taken verschuiven met hetzelfde id; buiten op vr 25 dec met deadline za 26 dec 07:45", () => {
    const uit = taak("2026-12-25", "out", "in_progress");
    const binnen = taak("2026-12-25", "in");
    const plan = planWasteTasks({ pickups: leeg({ rest: ["2026-12-26"] }), existing: [uit, binnen], now, timeZone: TZ });
    expect(plan.insert).toEqual([]);
    expect(plan.remove).toEqual([]);
    expect(plan.rename).toEqual([]);
    expect(plan.move.map((m) => [m.id, m.direction, m.scheduled_date, m.waste_pickup_date, m.due_at])).toEqual([
      [uit.id, "out", "2026-12-25", "2026-12-26", utc("2026-12-26T06:45:00Z")],
      [binnen.id, "in", "2026-12-26", "2026-12-26", utc("2026-12-26T23:00:00Z")],
    ]);
  });

  it("(b) op de nieuwe dag bestaat buitenzetten al (done): oude buiten weg, binnen schuift mee", () => {
    const uit = taak("2026-12-25", "out");
    const binnen = taak("2026-12-25", "in");
    const alGedaan = taak("2026-12-26", "out", "done");
    const plan = planWasteTasks({ pickups: leeg({ rest: ["2026-12-26"] }), existing: [uit, binnen, alGedaan], now, timeZone: TZ });
    expect(plan.remove).toEqual([uit.id]);
    expect(plan.move.map((m) => [m.id, m.waste_pickup_date])).toEqual([[binnen.id, "2026-12-26"]]);
    expect(plan.insert).toEqual([]);
  });

  it("(c) meer dan 3 dagen verschil (25 → 29 december): oude taken weg, nieuwe erbij", () => {
    const uit = taak("2026-12-25", "out");
    const binnen = taak("2026-12-25", "in");
    const plan = planWasteTasks({ pickups: leeg({ rest: ["2026-12-29"] }), existing: [uit, binnen], now, timeZone: TZ });
    expect(plan.remove.sort()).toEqual([uit.id, binnen.id].sort());
    expect(plan.move).toEqual([]);
    expect(plan.insert.map((t) => `${t.waste_pickup_date}|${t.waste_direction}`)).toEqual(["2026-12-29|out", "2026-12-29|in"]);
  });

  it("precies 3 dagen verschil telt nog als verschuiving", () => {
    const uit = taak("2026-12-25", "out");
    const plan = planWasteTasks({ pickups: leeg({ rest: ["2026-12-28"] }), existing: [uit], now, timeZone: TZ });
    expect(plan.move.map((m) => m.id)).toEqual([uit.id]);
  });

  it("(d) geen gemeenschappelijke bak (papier → rest): oude taken weg, nieuwe erbij", () => {
    const uit = taak("2026-12-25", "out", "todo", ["papier"]);
    const binnen = taak("2026-12-25", "in", "todo", ["papier"]);
    const plan = planWasteTasks({ pickups: leeg({ rest: ["2026-12-26"] }), existing: [uit, binnen], now, timeZone: TZ });
    expect(plan.remove.sort()).toEqual([uit.id, binnen.id].sort());
    expect(plan.move).toEqual([]);
    expect(plan.insert.map((t) => t.title)).toEqual(["Restafval buitenzetten", "Restafvalbak binnenzetten"]);
  });

  it("(e) 07:45 op de nieuwe dag is voorbij (27 → 26 december, om 08:00 op de 26e): buiten weg, binnen schuift mee", () => {
    const uit = taak("2026-12-27", "out");
    const binnen = taak("2026-12-27", "in");
    const plan = planWasteTasks({
      pickups: leeg({ rest: ["2026-12-26"] }),
      existing: [uit, binnen],
      now: new Date("2026-12-26T07:00:00Z"), // 08:00 CET
      timeZone: TZ,
    });
    expect(plan.remove).toEqual([uit.id]);
    expect(plan.move.map((m) => [m.id, m.waste_pickup_date])).toEqual([[binnen.id, "2026-12-26"]]);
    expect(plan.insert).toEqual([]);
  });

  it("bij gelijke afstand (24 en 26 voor 25 december) blijft de vroegste staan; de andere dag krijgt nieuwe taken", () => {
    const uit = taak("2026-12-25", "out");
    const binnen = taak("2026-12-25", "in");
    const plan = planWasteTasks({ pickups: leeg({ rest: ["2026-12-24", "2026-12-26"] }), existing: [uit, binnen], now, timeZone: TZ });
    expect(plan.move.map((m) => m.waste_pickup_date)).toEqual(["2026-12-24", "2026-12-24"]);
    expect(plan.insert.map((t) => t.waste_pickup_date)).toEqual(["2026-12-26", "2026-12-26"]);
  });
});

describe("planWasteTasks — dag verdwijnt (AC-199, AC-200)", () => {
  const now = new Date("2026-10-05T08:00:00Z");

  it("AC-199: open buiten en binnen voor een verdwenen dag gaan allebei weg, de andere dagen blijven", () => {
    const uit = taak("2026-10-08", "out");
    const binnen = taak("2026-10-08", "in");
    const blijftUit = taak("2026-10-13", "out");
    const blijftIn = taak("2026-10-13", "in");
    const plan = planWasteTasks({ pickups: leeg({ rest: ["2026-10-13"] }), existing: [uit, binnen, blijftUit, blijftIn], now, timeZone: TZ });
    expect(plan.remove.sort()).toEqual([uit.id, binnen.id].sort());
    expect(plan.move).toEqual([]);
    expect(plan.insert).toEqual([]);
  });

  it("AC-200: buiten is gedaan en de dag verdwijnt → binnen blijft staan, de gedane taak blijft ongemoeid", () => {
    const uit = taak("2026-10-06", "out", "done");
    const binnen = taak("2026-10-06", "in");
    const plan = planWasteTasks({ pickups: leeg(), existing: [uit, binnen], now, timeZone: TZ });
    expect(isEmptyPlan(plan)).toBe(true);
  });

  it("AC-200: buiten is gedaan en de dag verschuift naar woensdag → binnen schuift niet mee, woensdag krijgt nieuwe taken", () => {
    const uit = taak("2026-10-06", "out", "done");
    const binnen = taak("2026-10-06", "in");
    const plan = planWasteTasks({ pickups: leeg({ rest: ["2026-10-07"] }), existing: [uit, binnen], now, timeZone: TZ });
    expect(plan.move).toEqual([]);
    expect(plan.remove).toEqual([]);
    expect(plan.insert.map((t) => `${t.waste_pickup_date}|${t.waste_direction}`)).toEqual(["2026-10-07|out", "2026-10-07|in"]);
  });

  it("taken met een ophaaldag vóór vandaag raakt het plan nooit", () => {
    const oud = taak("2026-10-01", "in");
    const plan = planWasteTasks({ pickups: leeg(), existing: [oud], now, timeZone: TZ });
    expect(isEmptyPlan(plan)).toBe(true);
  });
});

describe("planWasteTasks — bak erbij of eraf (AC-201, AC-202)", () => {
  const now = new Date("2026-10-05T08:00:00Z");

  it("papier valt weg: beide open taken heten voortaan Restafval …, met dezelfde id", () => {
    const uit = taak("2026-10-06", "out", "todo", ["rest", "papier"]);
    const binnen = taak("2026-10-06", "in", "in_progress", ["rest", "papier"]);
    const plan = planWasteTasks({ pickups: leeg({ rest: ["2026-10-06"] }), existing: [uit, binnen], now, timeZone: TZ });
    expect(plan.rename).toEqual([
      { id: uit.id, title: "Restafval buitenzetten", waste_streams: ["rest"] },
      { id: binnen.id, title: "Restafvalbak binnenzetten", waste_streams: ["rest"] },
    ]);
    expect(plan.insert).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it("PMD komt erbij: T-07 en T-14", () => {
    const uit = taak("2026-10-06", "out", "todo", ["rest", "papier"]);
    const binnen = taak("2026-10-06", "in", "todo", ["rest", "papier"]);
    const plan = planWasteTasks({ pickups: leeg({ rest: ["2026-10-06"], papier: ["2026-10-06"], pmd: ["2026-10-06"] }), existing: [uit, binnen], now, timeZone: TZ });
    expect(plan.rename.map((r) => r.title)).toEqual(["Restafval, papier en PMD buitenzetten", "Restafval-, papier- en PMD-bak binnenzetten"]);
  });

  it("AC-202: een gedane of overgeslagen taak wordt niet hernoemd, verplaatst of verwijderd", () => {
    const gedaan = taak("2026-10-06", "out", "done", ["rest", "papier"]);
    const overgeslagen = taak("2026-10-06", "in", "skipped", ["rest", "papier"]);
    const plan = planWasteTasks({ pickups: leeg({ rest: ["2026-10-06"] }), existing: [gedaan, overgeslagen], now, timeZone: TZ });
    expect(isEmptyPlan(plan)).toBe(true);
    const verdwenen = planWasteTasks({ pickups: leeg({ rest: ["2026-10-09"] }), existing: [gedaan, overgeslagen], now, timeZone: TZ });
    expect(verdwenen.remove).toEqual([]);
    expect(verdwenen.move).toEqual([]);
  });
});

describe("planWasteTasks — nieuwe ophaaldag laat ontdekt (AC-203, plan-deel)", () => {
  const pickups = leeg({ rest: ["2026-10-07"] });
  const sleutels = (now: string) =>
    planWasteTasks({ pickups, existing: [], now: new Date(now), timeZone: TZ }).insert.map((t) => t.waste_direction);

  it("(a) di 21:40 en (b) di 23:00: buiten én binnen komen er", () => {
    expect(sleutels("2026-10-06T19:40:00Z")).toEqual(["out", "in"]);
    expect(sleutels("2026-10-06T21:00:00Z")).toEqual(["out", "in"]);
  });

  it("(c) wo 08:00 en (d) wo 19:45: alleen binnenzetten (07:45 is voorbij)", () => {
    expect(sleutels("2026-10-07T06:00:00Z")).toEqual(["in"]);
    expect(sleutels("2026-10-07T17:45:00Z")).toEqual(["in"]);
  });

  it("precies om 07:45 op de ophaaldag komt buitenzetten niet meer", () => {
    expect(sleutels("2026-10-07T05:45:00Z")).toEqual(["in"]);
    expect(sleutels("2026-10-07T05:44:59Z")).toEqual(["out", "in"]);
  });

  it("(e) do 00:10: niets meer", () => {
    expect(sleutels("2026-10-07T22:10:00Z")).toEqual([]);
  });
});

describe("hasNoUpcoming (AC-204 b)", () => {
  it("alle drie leeg = ja; alleen datums in het verleden = ja", () => {
    expect(hasNoUpcoming(leeg(), "2026-10-05")).toBe(true);
    expect(hasNoUpcoming(leeg({ papier: ["2026-09-29"] }), "2026-10-05")).toBe(true);
  });
  it("alleen papier met een datum over 25 dagen = nee; vandaag zelf telt als komend", () => {
    expect(hasNoUpcoming(leeg({ papier: ["2026-10-30"] }), "2026-10-05")).toBe(false);
    expect(hasNoUpcoming(leeg({ rest: ["2026-10-05"] }), "2026-10-05")).toBe(false);
  });
});

describe("classifyEmpty — de volgorde van §18.8.4 (AC-204, AC-220, AC-237)", () => {
  const stand = (over: Partial<FetchedPickups>): FetchedPickups => ({
    pickups: leeg(),
    unknownStreams: 0,
    hadAnyDateInJ: true,
    fetchedNextYear: false,
    nextYearHasDate: false,
    ...over,
  });

  it("(a) 26 november, alleen datums in het verleden, C(2027) leeg → gelukt met de stille regel", () => {
    expect(classifyEmpty(stand({ fetchedNextYear: true }), "2026-11-26")).toEqual({ result: "success", notice: "next_year_missing" });
  });
  it("(b) dezelfde stand op 15 juni → SUSPECT_EMPTY", () => {
    expect(classifyEmpty(stand({ fetchedNextYear: true }), "2026-06-15")).toEqual({ result: "failure", code: "SUSPECT_EMPTY" });
  });
  it("(c) 1 januari, C(2027) zonder enige datum van rest/papier/PMD → SUSPECT_EMPTY, ook met kerstbomen", () => {
    expect(classifyEmpty(stand({ hadAnyDateInJ: false, fetchedNextYear: true }), "2027-01-01")).toEqual({ result: "failure", code: "SUSPECT_EMPTY" });
  });
  it("(d) 26 november met datums van rest/papier/PMD in 2027 → gelukt, zonder regel", () => {
    expect(classifyEmpty(stand({ pickups: leeg({ rest: ["2027-01-05"] }), fetchedNextYear: true, nextYearHasDate: true }), "2026-11-26")).toEqual({ result: "success", notice: null });
  });
  it("(e) 26 november, C(2027) met alleen kerstbomen → gelukt met de stille regel", () => {
    expect(classifyEmpty(stand({ fetchedNextYear: true, nextYearHasDate: false }), "2026-11-26")).toEqual({ result: "success", notice: "next_year_missing" });
  });
  it("(f) 28 december na de laatste datum, C(2027) leeg → gelukt met de stille regel", () => {
    expect(classifyEmpty(stand({ fetchedNextYear: true }), "2026-12-28")).toEqual({ result: "success", notice: "next_year_missing" });
  });
  it("(g) 5 oktober met een volgende dag op 27 oktober → gelukt", () => {
    expect(classifyEmpty(stand({ pickups: leeg({ papier: ["2026-10-27"] }) }), "2026-10-05")).toEqual({ result: "success", notice: null });
  });
  it("november zonder C(J+1) opgehaald (bijv. mislukt) → SUSPECT_EMPTY, geen verzonnen uitzondering", () => {
    expect(classifyEmpty(stand({ fetchedNextYear: false }), "2026-11-26")).toEqual({ result: "failure", code: "SUSPECT_EMPTY" });
  });
  it("oktober zonder enige datum van rest/papier/PMD in J → SUSPECT_EMPTY", () => {
    expect(classifyEmpty(stand({ hadAnyDateInJ: false }), "2026-10-05")).toEqual({ result: "failure", code: "SUSPECT_EMPTY" });
  });
});
