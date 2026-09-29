import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchPickups, fetchStreams, fetchYear, lookupAddress } from "../schema";
import { laadFixture, maakBron, rijen } from "./bron";

/**
 * WP3b — parser van de gemeentebron (TECHNICAL_DESIGN §18.1.3, §18.1.4, §18.8.4).
 * AC-196, AC-204, AC-218, AC-237: zod stript alles buiten de tabel; B `{}` is
 * "adres weg"; C(J+1) alleen in december of als C(J) geen komende datum heeft;
 * nooit C(J−1).
 */
const P0 = laadFixture("p0-2591BB-87");
const BAG = "0518200000813196";

describe("A: adres → kandidaten (AC-185, AC-218)", () => {
  it("de P0-fixture geeft één kandidaat, zonder coördinaten, ids of plaats (zod stript)", async () => {
    const bron = maakBron(P0);
    const result = await lookupAddress("2591BB", 87, { fetch: bron.fetch });
    expect(result).toEqual({ ok: true, value: [{ bagId: BAG, letter: "", street: "Zwedenburg" }] });
    if (result.ok) expect(Object.keys(result.value[0]).sort()).toEqual(["bagId", "letter", "street"]);
  });

  it("A `[]` (onbekend adres, ook Rijswijk) is geen fout: een lege lijst", async () => {
    const bron = maakBron(P0);
    expect(await lookupAddress("2288AA", 1, { fetch: bron.fetch })).toEqual({ ok: true, value: [] });
  });

  it("een adrescode als getal wordt een string van 16 cijfers", async () => {
    const bron = maakBron(P0, { a: { body: [{ bagId: 518200000813196, huisletter: "a", huisnummerToevoeging: "2", openbareRuimteNaam: " Straat " }] } });
    expect(await lookupAddress("2591BB", 87, { fetch: bron.fetch })).toEqual({ ok: true, value: [{ bagId: BAG, letter: "A2", street: "Straat" }] });
  });

  it("A 404 → UNREACHABLE (D-047); A met een ander formaat → FORMAT", async () => {
    const bron = maakBron(P0, { a: { body: [], status: 404 } });
    expect(await lookupAddress("2591BB", 87, { fetch: bron.fetch })).toEqual({ ok: false, code: "UNREACHABLE", http: 404 });
    bron.zet({ a: { body: { adres: "iets" } } });
    expect(await lookupAddress("2591BB", 87, { fetch: bron.fetch })).toEqual({ ok: false, code: "FORMAT" });
  });
});

describe("B: afvalsoorten (AC-204 c, AC-196)", () => {
  it("B `{}` letterlijk zoals U0.2 → NOT_FOUND; B `[]` → NOT_FOUND; B 404 → NOT_FOUND", async () => {
    const bron = maakBron(laadFixture("synthetisch-adres-weg"));
    expect(await fetchStreams(BAG, { fetch: bron.fetch })).toEqual({ ok: false, code: "NOT_FOUND" });
    bron.zet({ b: { body: [] } });
    expect(await fetchStreams(BAG, { fetch: bron.fetch })).toEqual({ ok: false, code: "NOT_FOUND" });
    bron.zet({ b: { body: {}, status: 404 } });
    expect(await fetchStreams(BAG, { fetch: bron.fetch })).toEqual({ ok: false, code: "NOT_FOUND", http: 404 });
  });

  it("B als niet-leeg object → FORMAT (geen 'adres weg')", async () => {
    const bron = maakBron(P0, { b: { body: { fout: "onverwacht" } } });
    expect(await fetchStreams(BAG, { fetch: bron.fetch })).toEqual({ ok: false, code: "FORMAT" });
  });

  it("de P0-soorten: GFT en kerstbomen → null, PMD/papier/rest → bak", async () => {
    const bron = maakBron(P0);
    const result = await fetchStreams(BAG, { fetch: bron.fetch });
    expect(result.ok && [...result.value.byId.entries()]).toEqual([
      [1, null],
      [2, "pmd"],
      [3, "papier"],
      [4, "rest"],
      [5, null],
    ]);
  });

  it("een synthetische B met content en icon_data (± 20 KB) wordt gewoon geparsed; die velden komen nergens terug", async () => {
    const fixture = laadFixture("synthetisch-b-groot");
    expect(JSON.stringify(fixture.afvalstromen).length).toBeGreaterThan(15_000);
    const bron = maakBron(fixture);
    const result = await fetchStreams(BAG, { fetch: bron.fetch });
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/content|icon_data/);
  });
});

describe("C: ophaaldagen van een jaar", () => {
  it("C 404 of [] = leeg (geen fout); rijen zonder datum vallen weg; FORMAT bij een ander formaat", async () => {
    const bron = maakBron(P0, { c: { 2027: { body: [], status: 404 } } });
    expect(await fetchYear(BAG, 2027, { fetch: bron.fetch })).toEqual({ ok: true, value: [] });
    bron.zet({ c: { 2027: { body: [{ afvalstroom_id: 4, ophaaldatum: null }, { afvalstroom_id: 4, ophaaldatum: "2027-01-05" }] } } });
    expect(await fetchYear(BAG, 2027, { fetch: bron.fetch })).toEqual({ ok: true, value: [{ afvalstroom_id: 4, ophaaldatum: "2027-01-05" }] });
    bron.zet({ c: { 2027: { body: { kalender: [] } } } });
    expect(await fetchYear(BAG, 2027, { fetch: bron.fetch })).toEqual({ ok: false, code: "FORMAT" });
    bron.zet({ c: { 2027: { body: [{ afvalstroom_id: 4, ophaaldatum: "5 januari" }] } } });
    expect(await fetchYear(BAG, 2027, { fetch: bron.fetch })).toEqual({ ok: false, code: "FORMAT" });
  });
});

describe("fetchPickups — B + C(J) (+ C(J+1)); nooit C(J−1) (AC-204, AC-220, AC-237)", () => {
  it("P0 op 5 oktober 2026: alleen papier, eerstvolgende 27 oktober; 2027 wordt niet opgehaald (fetch-spy)", async () => {
    const bron = maakBron(P0);
    const result = await fetchPickups(BAG, "2026-10-05", { fetch: bron.fetch });
    expect(result.ok && result.value).toEqual({
      pickups: { rest: [], papier: ["2026-10-27", "2026-11-24"], pmd: [] },
      unknownStreams: 2, // de twee kerstboomdatums van 2026: geen bak, geen taak (AC-196)
      hadAnyDateInJ: true,
      fetchedNextYear: false,
      nextYearHasDate: false,
    });
    expect(bron.teller("/kalender/2027")).toBe(0);
    expect(bron.teller("/kalender/2025")).toBe(0);
    expect(bron.verzoeken.map((v) => v.pad).sort()).toEqual([`/rest/adressen/${BAG}/afvalstromen`, `/rest/adressen/${BAG}/kalender/2026`]);
  });

  it("P0 op 26 november 2026: geen komende datum in 2026 → C(2027) wordt opgehaald en is leeg", async () => {
    const bron = maakBron(P0);
    const result = await fetchPickups(BAG, "2026-11-26", { fetch: bron.fetch });
    expect(result.ok && result.value).toEqual({
      pickups: { rest: [], papier: [], pmd: [] },
      unknownStreams: 2,
      hadAnyDateInJ: true,
      fetchedNextYear: true,
      nextYearHasDate: false,
    });
    expect(bron.teller("/kalender/2027")).toBe(1);
  });

  it("C(2027) met alleen kerstbomen: fetchedNextYear = true, nextYearHasDate = false (AC-220 c)", async () => {
    const bron = maakBron(laadFixture("synthetisch-j1-alleen-kerstbomen"));
    const result = await fetchPickups(BAG, "2026-11-26", { fetch: bron.fetch });
    expect(result.ok && result.value).toMatchObject({ fetchedNextYear: true, nextYearHasDate: false, unknownStreams: 4 });
    expect(result.ok && result.value.pickups).toEqual({ rest: [], papier: [], pmd: [] });
  });

  it("in december wordt C(J+1) altijd (parallel) opgehaald, ook met komende datums in J", async () => {
    const bron = maakBron(laadFixture("synthetisch-december-zonder-j1"));
    const result = await fetchPickups("0518200000000107", "2026-12-10", { fetch: bron.fetch });
    expect(result.ok && result.value.pickups.rest).toContain("2026-12-29");
    expect(result.ok && result.value.fetchedNextYear).toBe(true);
    expect(bron.teller("/kalender/2027")).toBe(1);
    expect(bron.teller("/kalender/2026")).toBe(1);
  });

  it("datums van J+1 komen bij de stand, gesorteerd en uniek; alleen datums ≥ vandaag", async () => {
    const bron = maakBron(laadFixture("synthetisch-december-zonder-j1"), { c: { 2027: { body: rijen("rest", ["2027-01-12", "2027-01-05", "2027-01-05"]) } } });
    const result = await fetchPickups("0518200000000107", "2026-12-28", { fetch: bron.fetch });
    expect(result.ok && result.value.pickups.rest).toEqual(["2026-12-29", "2027-01-05", "2027-01-12"]);
    expect(result.ok && result.value.nextYearHasDate).toBe(true);
  });

  it("2 januari met een lege C(2027): geen verzoek naar /kalender/2026 (nooit C(J−1))", async () => {
    const bron = maakBron(laadFixture("synthetisch-januari-leeg"));
    const result = await fetchPickups("0518200000000108", "2027-01-02", { fetch: bron.fetch });
    expect(result.ok && result.value).toMatchObject({ pickups: { rest: [], papier: [], pmd: [] }, hadAnyDateInJ: false, fetchedNextYear: true });
    expect(bron.teller("/kalender/2026")).toBe(0);
    expect(bron.teller("/kalender/2027")).toBe(1);
    expect(bron.teller("/kalender/2028")).toBe(1);
  });

  it("B `{}` → NOT_FOUND (adres weg), ook al zou C iets geven", async () => {
    const bron = maakBron(laadFixture("synthetisch-adres-weg"), { c: { 2026: { body: rijen("rest", ["2026-10-06"]) } } });
    expect(await fetchPickups("0518200000000000", "2026-10-05", { fetch: bron.fetch })).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("B 503 → UNREACHABLE; B kapot → FORMAT; C(J) 503 → UNREACHABLE; C(J+1) mislukt in december → UNREACHABLE", async () => {
    const bron = maakBron(P0, { b: { body: "storing", status: 503 } });
    expect(await fetchPickups(BAG, "2026-10-05", { fetch: bron.fetch })).toMatchObject({ ok: false, code: "UNREACHABLE" });
    bron.zet({ b: { raw: "<html>", contentType: "text/html" } });
    expect(await fetchPickups(BAG, "2026-10-05", { fetch: bron.fetch })).toMatchObject({ ok: false, code: "FORMAT" });
    bron.zet({ b: undefined, c: { 2026: { body: "storing", status: 503 } } });
    expect(await fetchPickups(BAG, "2026-10-05", { fetch: bron.fetch })).toMatchObject({ ok: false, code: "UNREACHABLE", http: 503 });
    bron.zet({ c: { 2027: { netwerkfout: true } } });
    expect(await fetchPickups(BAG, "2026-12-10", { fetch: bron.fetch })).toMatchObject({ ok: false, code: "UNREACHABLE" });
  });

  it("C(J+1) mislukt bij 'geen komende datum in J' (26 november) → UNREACHABLE, geen verzonnen leeg antwoord", async () => {
    const bron = maakBron(P0, { c: { 2027: { body: "storing", status: 500 } } });
    expect(await fetchPickups(BAG, "2026-11-26", { fetch: bron.fetch })).toMatchObject({ ok: false, code: "UNREACHABLE", http: 500 });
  });

  it("datums zonder bak (grofvuil, textiel, GFT) tellen als unknownStreams en geven geen datum (AC-196)", async () => {
    const bron = maakBron(P0, {
      b: { body: [...(P0.afvalstromen as unknown[]), { id: 9, title: "Grofvuil", icon: "bank" }, { id: 10, title: "Textiel", icon: "x" }] },
      c: { 2026: { body: [...rijen("rest", ["2026-10-06"]), { ophaaldatum: "2026-10-07", afvalstroom_id: 9 }, { ophaaldatum: "2026-10-08", afvalstroom_id: 10 }, { ophaaldatum: "2026-10-09", afvalstroom_id: 1 }] } },
    });
    const result = await fetchPickups(BAG, "2026-10-05", { fetch: bron.fetch });
    expect(result.ok && result.value.pickups).toEqual({ rest: ["2026-10-06"], papier: [], pmd: [] });
    expect(result.ok && result.value.unknownStreams).toBe(3);
  });

  it("het budget (signal) geldt voor alle deelverzoeken samen", async () => {
    const bron = maakBron(P0, { c: { 2026: { wacht: true } } });
    const result = await fetchPickups(BAG, "2026-10-05", { fetch: bron.fetch, signal: AbortSignal.timeout(30) });
    expect(result).toEqual({ ok: false, code: "UNREACHABLE" });
  });
});
