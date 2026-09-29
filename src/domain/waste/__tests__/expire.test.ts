import { describe, expect, it } from "vitest";
import { findExpiredWasteTasks, WASTE_IN_EXPIRE_DAYS, type ExpiryTask } from "../expire";

/**
 * WP3b — vanzelf vervallen van vergeten afvaltaken (BR-54; TECHNICAL_DESIGN
 * §18.8.6). AC-210. Ophaaldag dinsdag 6 oktober 2026, volgende vrijdag 9 oktober.
 */
const taak = (id: string, pickupDate: string, direction: "out" | "in", status: ExpiryTask["status"] = "todo"): ExpiryTask => ({
  id,
  pickupDate,
  direction,
  status,
});

describe("findExpiredWasteTasks (AC-210)", () => {
  const uitDi = taak("uit-di", "2026-10-06", "out");
  const inDi = taak("in-di", "2026-10-06", "in");
  const uitVr = taak("uit-vr", "2026-10-09", "out");
  const inVr = taak("in-vr", "2026-10-09", "in");
  const alles = [uitDi, inDi, uitVr, inVr];

  it("op de ophaaldag zelf (dinsdag) vervalt nog niets: buitenzetten staat alleen bij Verlopen", () => {
    expect(findExpiredWasteTasks(alles, "2026-10-06")).toEqual([]);
  });

  it("woensdag: buitenzetten van dinsdag vervalt; binnenzetten nog niet (de volgende buitenzet-taak is nog niet begonnen)", () => {
    expect(findExpiredWasteTasks(alles, "2026-10-07")).toEqual(["uit-di"]);
  });

  it("donderdag (de dag waarop de buitenzet-taak van vrijdag begint): binnenzetten van dinsdag vervalt", () => {
    expect(findExpiredWasteTasks([inDi, uitVr, inVr], "2026-10-08")).toEqual(["in-di"]);
  });

  it("de volgende buitenzet-taak telt ook als hij al gedaan of overgeslagen is", () => {
    expect(findExpiredWasteTasks([inDi, taak("uit-vr", "2026-10-09", "out", "done")], "2026-10-08")).toEqual(["in-di"]);
    expect(findExpiredWasteTasks([inDi, taak("uit-vr", "2026-10-09", "out", "skipped")], "2026-10-08")).toEqual(["in-di"]);
  });

  it("alleen open taken (todo of bezig) vervallen; gedaan en overgeslagen blijven ongemoeid", () => {
    const bezig = taak("in-bezig", "2026-10-06", "in", "in_progress");
    const gedaan = taak("uit-gedaan", "2026-10-06", "out", "done");
    const over = taak("in-over", "2026-10-06", "in", "skipped");
    expect(findExpiredWasteTasks([bezig, gedaan, over, uitVr], "2026-10-08")).toEqual(["in-bezig"]);
  });

  it("lange pauze zonder volgende buitenzet-taak: binnenzetten vervalt pas op D+7 (dinsdag 13 oktober), niet op 12 oktober", () => {
    expect(WASTE_IN_EXPIRE_DAYS).toBe(7);
    expect(findExpiredWasteTasks([inDi], "2026-10-12")).toEqual([]);
    expect(findExpiredWasteTasks([inDi], "2026-10-13")).toEqual(["in-di"]);
  });

  it("een volgende buitenzet-taak ver weg (3 november) verandert niets aan de bovengrens D+7", () => {
    const uitNov = taak("uit-nov", "2026-11-03", "out");
    expect(findExpiredWasteTasks([inDi, uitNov], "2026-10-12")).toEqual([]);
    expect(findExpiredWasteTasks([inDi, uitNov], "2026-10-13")).toEqual(["in-di"]);
  });

  it("opeenvolgende ophaaldagen (dinsdag en woensdag): binnenzetten van dinsdag vervalt op woensdag, want buitenzetten voor woensdag begon dinsdag", () => {
    const uitWo = taak("uit-wo", "2026-10-07", "out");
    const inWo = taak("in-wo", "2026-10-07", "in");
    expect(findExpiredWasteTasks([uitDi, inDi, uitWo, inWo], "2026-10-07").sort()).toEqual(["in-di", "uit-di"]);
  });

  it("een buitenzet-taak van een eerdere dag telt niet als 'volgende'", () => {
    const uitMa = taak("uit-ma", "2026-10-05", "out", "done");
    expect(findExpiredWasteTasks([inDi, uitMa], "2026-10-08")).toEqual([]);
  });

  it("de uitkomst bevat alleen ids, nooit een dag of naam", () => {
    for (const id of findExpiredWasteTasks(alles, "2026-10-20")) expect(["uit-di", "in-di", "uit-vr", "in-vr"]).toContain(id);
    expect(findExpiredWasteTasks(alles, "2026-10-20").sort()).toEqual(["in-di", "in-vr", "uit-di", "uit-vr"]);
  });
});
