import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { WasteAddress } from "@/domain/waste/address";
import { lookupWasteCalendar, nextPerStream } from "../lookup";
import { laadFixture, maakBron, rijen } from "./bron";

/**
 * WP3b — opzoeken bij het instellen (TECHNICAL_DESIGN §18.8.1). Schrijft niets.
 * AC-185, AC-186, AC-187, AC-188, AC-218, AC-237; security-review WP3b punt 4.
 */
const TZ = "Europe/Amsterdam";
const P0 = laadFixture("p0-2591BB-87");
const adres = (postcode: string, houseNumber: number, suffix: string | null = null): WasteAddress => ({ postcode, houseNumber, suffix });
const om = (dag: string) => new Date(`${dag}T10:00:00+02:00`);

describe("gevonden (AC-183)", () => {
  it("P0 op 5 oktober 2026: found met T-45a-weergave, adrescode, papier di 27 okt, rest en PMD zonder datum (T-45b)", async () => {
    const bron = maakBron(P0);
    const result = await lookupWasteCalendar(adres("2591BB", 87), om("2026-10-05"), TZ, { fetch: bron.fetch });
    expect(result).toEqual({
      kind: "found",
      bagId: "0518200000813196",
      suffix: "",
      display: "Zwedenburg 87, Den Haag",
      pickups: { rest: [], papier: ["2026-10-27", "2026-11-24"], pmd: [] },
      next: { rest: null, papier: "2026-10-27", pmd: null },
    });
  });

  it("zonder straatnaam van de bron: de weergave valt terug op postcode en nummer, met Den Haag", async () => {
    const bron = maakBron(P0, { a: { body: [{ bagId: "0518200000813196", huisletter: "", huisnummerToevoeging: "" }] } });
    const result = await lookupWasteCalendar(adres("2591BB", 87), om("2026-10-05"), TZ, { fetch: bron.fetch });
    expect(result).toMatchObject({ kind: "found", display: "2591 BB 87, Den Haag" });
  });

  it("nextPerStream: eerstvolgende datum ≥ vandaag per bak; vandaag telt mee", () => {
    expect(nextPerStream({ rest: ["2026-10-01", "2026-10-05", "2026-10-12"], papier: [], pmd: ["2026-10-30"] }, "2026-10-05")).toEqual({
      rest: "2026-10-05",
      papier: null,
      pmd: "2026-10-30",
    });
  });
});

describe("onbekend adres (AC-185)", () => {
  it("A `[]` (Rijswijk of onbekend Haags nummer) → not_found, zonder B of C op te vragen", async () => {
    const bron = maakBron(P0);
    expect(await lookupWasteCalendar(adres("2288AA", 1), om("2026-10-05"), TZ, { fetch: bron.fetch })).toEqual({ kind: "not_found" });
    expect(bron.verzoeken).toHaveLength(1);
  });

  it("B `{}` (adrescode weg, U0.2) → not_found", async () => {
    const bron = maakBron(laadFixture("synthetisch-adres-weg"));
    expect(await lookupWasteCalendar(adres("2511AB", 1), om("2026-10-05"), TZ, { fetch: bron.fetch })).toEqual({ kind: "not_found" });
  });

  it("een opgegeven toevoeging die de gemeente niet kent → not_found", async () => {
    const bron = maakBron(P0);
    expect(await lookupWasteCalendar(adres("2591BB", 87, "A"), om("2026-10-05"), TZ, { fetch: bron.fetch })).toEqual({ kind: "not_found" });
  });
});

describe("meerdere adressen en toevoeging (AC-187)", () => {
  const fixture = laadFixture("synthetisch-meerdere-kandidaten");

  it("(c) nummer 12 zonder toevoeging → choose met de drie adressen, in de volgorde van de bron; nog geen B of C", async () => {
    const bron = maakBron(fixture);
    expect(await lookupWasteCalendar(adres("2511AB", 12), om("2026-10-05"), TZ, { fetch: bron.fetch })).toEqual({
      kind: "choose",
      houseNumber: 12,
      candidates: [
        { suffix: "", display: "Voorbeeldstraat 12, Den Haag" },
        { suffix: "A", display: "Voorbeeldstraat 12A, Den Haag" },
        { suffix: "B", display: "Voorbeeldstraat 12B, Den Haag" },
      ],
    });
    expect(bron.teller("afvalstromen")).toBe(0);
  });

  it('toevoeging "A" → found voor 12A; "" (bewust zonder) → found voor het kale nummer', async () => {
    const bron = maakBron(fixture);
    expect(await lookupWasteCalendar(adres("2511AB", 12, "A"), om("2026-10-05"), TZ, { fetch: bron.fetch })).toMatchObject({
      kind: "found",
      bagId: "0518200000000105",
      suffix: "A",
    });
    expect(await lookupWasteCalendar(adres("2511AB", 12, ""), om("2026-10-05"), TZ, { fetch: bron.fetch })).toMatchObject({
      kind: "found",
      bagId: "0518200000000104",
      suffix: "",
    });
  });

  it("AC-218: de toevoeging gaat nooit mee in het verzoek; alleen postcode-nummer en de adrescode", async () => {
    const bron = maakBron(fixture);
    await lookupWasteCalendar(adres("2511AB", 12, "A"), om("2026-10-05"), TZ, { fetch: bron.fetch });
    expect(bron.verzoeken.length).toBeGreaterThanOrEqual(3);
    for (const v of bron.verzoeken) {
      expect(v.pad).toMatch(/^\/rest\/adressen\/(2511AB-12|0518200000000105(\/afvalstromen|\/kalender\/\d{4}))$/);
      expect(v.init.headers).toEqual({ Accept: "application/json", "User-Agent": "Takenlijstje/1 (prive gezinsapp)" });
    }
  });

  it("security-review punt 4: een kandidaat met een toevoeging van 5 tekens → not_found, en B/C worden niet opgevraagd", async () => {
    const bron = maakBron(fixture, {
      a: { body: [{ bagId: "0518200000000199", huisletter: "A", huisnummerToevoeging: "BCDE", openbareRuimteNaam: "Voorbeeldstraat" }] },
    });
    expect(await lookupWasteCalendar(adres("2511AB", 12), om("2026-10-05"), TZ, { fetch: bron.fetch })).toEqual({ kind: "not_found" });
    expect(bron.teller("afvalstromen")).toBe(0);
    expect(bron.teller("/kalender/")).toBe(0);
  });
});

describe("geen bakken en geen komende ophaaldagen (AC-186, AC-237)", () => {
  it("alleen GFT en kerstbomen in oktober → no_streams (T-62), niets opgevraagd voor 2027", async () => {
    const bron = maakBron(laadFixture("synthetisch-alleen-gft"));
    expect(await lookupWasteCalendar(adres("2511AB", 3), om("2026-10-05"), TZ, { fetch: bron.fetch })).toEqual({ kind: "no_streams" });
  });

  it("oktober zonder enige datum van rest/papier/PMD in het jaar (C leeg) → no_streams", async () => {
    const bron = maakBron(laadFixture("synthetisch-leeg"));
    expect(await lookupWasteCalendar(adres("2511AB", 9), om("2026-10-05"), TZ, { fetch: bron.fetch })).toEqual({ kind: "no_streams" });
  });

  it("alleen papier over 25 dagen → found met die datum en geen no_upcoming (tegenvoorbeeld AC-237)", async () => {
    const bron = maakBron(laadFixture("synthetisch-over-3-weken"));
    expect(await lookupWasteCalendar(adres("2511AB", 21), om("2026-10-05"), TZ, { fetch: bron.fetch })).toMatchObject({
      kind: "found",
      next: { rest: "2026-10-26", papier: null, pmd: null },
    });
  });

  it("26 november, P0-vorm, C(2027) leeg → no_upcoming (T-64): geen jaareinde-uitzondering bij het instellen", async () => {
    const bron = maakBron(P0);
    expect(await lookupWasteCalendar(adres("2591BB", 87), om("2026-11-26"), TZ, { fetch: bron.fetch })).toEqual({ kind: "no_upcoming" });
  });

  it("26 november met alleen kerstbomen in 2027 → no_upcoming, niet no_streams", async () => {
    const bron = maakBron(laadFixture("synthetisch-j1-alleen-kerstbomen"));
    expect(await lookupWasteCalendar(adres("2591BB", 87), om("2026-11-26"), TZ, { fetch: bron.fetch })).toEqual({ kind: "no_upcoming" });
  });

  it("28 december na de laatste ophaaldag, 2027 nog niet online → no_upcoming", async () => {
    const bron = maakBron(laadFixture("synthetisch-december-zonder-j1"), { c: { 2026: { body: rijen("rest", ["2026-12-22"]) } } });
    expect(await lookupWasteCalendar(adres("2511AB", 5), om("2026-12-28"), TZ, { fetch: bron.fetch })).toEqual({ kind: "no_upcoming" });
  });

  it("2 januari, lege C(2027), vorig jaar wél datums → no_upcoming; er wordt geen C(2026) opgehaald", async () => {
    const bron = maakBron(laadFixture("synthetisch-januari-leeg"));
    expect(await lookupWasteCalendar(adres("2511AB", 1), om("2027-01-02"), TZ, { fetch: bron.fetch })).toEqual({ kind: "no_upcoming" });
    expect(bron.teller("/kalender/2026")).toBe(0);
  });

  it("2 januari, lege C(2027), vorig jaar géén datums → ook no_upcoming (nooit T-62 in januari, AC-186)", async () => {
    const bron = maakBron(laadFixture("synthetisch-leeg"));
    expect(await lookupWasteCalendar(adres("2511AB", 9), om("2027-01-02"), TZ, { fetch: bron.fetch })).toEqual({ kind: "no_upcoming" });
    expect(bron.teller("/kalender/2026")).toBe(0);
  });

  it("de opzoeking geeft nooit kerstboom- of GFT-datums terug", async () => {
    const bron = maakBron(laadFixture("synthetisch-rest-papier-pmd"));
    const result = await lookupWasteCalendar(adres("2511AB", 12), om("2026-10-05"), TZ, { fetch: bron.fetch });
    expect(result.kind).toBe("found");
    if (result.kind === "found") expect(Object.keys(result.pickups).sort()).toEqual(["papier", "pmd", "rest"]);
  });
});

describe("bron onbereikbaar of onbruikbaar (AC-188)", () => {
  it.each([
    ["time-out", { wacht: true } as const],
    ["503", { body: "storing", status: 503 } as const],
    ["kapotte JSON", { raw: "{" } as const],
    ["HTML", { raw: "<html>", contentType: "text/html" } as const],
    ["netwerkfout", { netwerkfout: true } as const],
  ])("%s op A → unreachable", async (_naam, antwoord) => {
    const bron = maakBron(P0, { a: antwoord });
    const result = await lookupWasteCalendar(adres("2591BB", 87), om("2026-10-05"), TZ, { fetch: bron.fetch, signal: AbortSignal.timeout(30) });
    expect(result).toEqual({ kind: "unreachable" });
  });

  it("A 404 → unreachable, niet not_found (alleen 200 [] is 'onbekend', D-047)", async () => {
    const bron = maakBron(P0, { a: { body: [], status: 404 } });
    expect(await lookupWasteCalendar(adres("2591BB", 87), om("2026-10-05"), TZ, { fetch: bron.fetch })).toEqual({ kind: "unreachable" });
  });

  it("B als niet-leeg object (FORMAT) → unreachable bij het opzoeken (D-047)", async () => {
    const bron = maakBron(P0, { b: { body: { fout: "x" } } });
    expect(await lookupWasteCalendar(adres("2591BB", 87), om("2026-10-05"), TZ, { fetch: bron.fetch })).toEqual({ kind: "unreachable" });
  });

  it("C(J) 503 → unreachable, ook al zijn A en B goed", async () => {
    const bron = maakBron(P0, { c: { 2026: { body: "storing", status: 503 } } });
    expect(await lookupWasteCalendar(adres("2591BB", 87), om("2026-10-05"), TZ, { fetch: bron.fetch })).toEqual({ kind: "unreachable" });
  });
});
