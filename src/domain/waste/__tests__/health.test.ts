import { describe, expect, it } from "vitest";
import { dueForFetch, isNewYearPeriod, lastFetchSlot, wasteFailureVariant, wasteSyncHealth, type WasteHealthInput } from "../health";
import type { WastePickups } from "../streams";

/**
 * WP3b — ophaalmomenten en gezondheid van het bijwerken (TECHNICAL_DESIGN
 * §18.8.3, §18.8.5). AC-205, AC-220, AC-221, AC-236.
 * Alle tijden zijn Europe/Amsterdam; 29 september 2026 is zomertijd (UTC+2).
 */
const TZ = "Europe/Amsterdam";
const leeg = (extra: Partial<WastePickups> = {}): WastePickups => ({ rest: [], papier: [], pmd: [], ...extra });
/** "2026-09-29 06:00" Nederlandse tijd → ISO-instant */
const nl = (dagTijd: string, offset = "+02:00") => new Date(`${dagTijd.replace(" ", "T")}:00${offset}`).toISOString();

const gezond = (over: Partial<WasteHealthInput> = {}): WasteHealthInput => ({
  last_success_at: nl("2026-09-28 17:05"),
  last_error_code: null,
  error_since: null,
  last_failure_at: null,
  alarm_since: null,
  pickups: leeg({ rest: ["2026-10-06"] }),
  ...over,
});

describe("wasteFailureVariant — balk en melding per foutcode (AC-205, AC-236)", () => {
  it.each([
    ["UNREACHABLE", "H1"],
    ["FORMAT", "H1"],
    ["SUSPECT_EMPTY", "H2"],
    ["ADDRESS_GONE", "H3"],
    [null, "H1"],
  ] as const)("%s → %s", (code, variant) => {
    expect(wasteFailureVariant(code)).toBe(variant);
  });
});

describe("wasteSyncHealth — de tabel van §18.8.5 (AC-205)", () => {
  const leegOm = (eerste: string, laatste: string, over: Partial<WasteHealthInput> = {}) =>
    gezond({ last_error_code: "SUSPECT_EMPTY", error_since: nl(eerste), last_failure_at: nl(laatste), ...over });

  it("(a) leeg 06:00, claim 07:15 zonder uitkomst, nu 07:20 → retrying (een gestarte poging telt niet)", () => {
    const stand = wasteSyncHealth(leegOm("2026-09-29 06:00", "2026-09-29 06:00"), new Date(nl("2026-09-29 07:20")), TZ);
    expect(stand.state).toBe("retrying");
    expect(stand.reason).toBeUndefined();
  });

  it("(b) leeg 06:00 en opnieuw 07:15 → failed/empty, variant H2", () => {
    const stand = wasteSyncHealth(leegOm("2026-09-29 06:00", "2026-09-29 07:15"), new Date(nl("2026-09-29 07:16")), TZ);
    expect(stand).toMatchObject({ state: "failed", reason: "empty", variant: "H2", lastErrorCode: "SUSPECT_EMPTY" });
  });

  it("precies een uur ertussen (06:00 en 07:00) telt als storing; 59 minuten niet", () => {
    expect(wasteSyncHealth(leegOm("2026-09-29 06:00", "2026-09-29 07:00"), new Date(nl("2026-09-29 07:01")), TZ).state).toBe("failed");
    expect(wasteSyncHealth(leegOm("2026-09-29 06:00", "2026-09-29 06:59"), new Date(nl("2026-09-29 07:01")), TZ).state).toBe("retrying");
  });

  it("(c) leeg 06:00 en 06:30 → retrying (minder dan een uur ertussen)", () => {
    expect(wasteSyncHealth(leegOm("2026-09-29 06:00", "2026-09-29 06:30"), new Date(nl("2026-09-29 06:31")), TZ).state).toBe("retrying");
  });

  it("(d) UNREACHABLE 06:00, daarna leeg 07:15 → retrying (andere code: de reeks begint opnieuw)", () => {
    // waste_sync zet error_since opnieuw bij een andere code (DB-toets in 70_afval.sql)
    const stand = wasteSyncHealth(leegOm("2026-09-29 07:15", "2026-09-29 07:15"), new Date(nl("2026-09-29 07:16")), TZ);
    expect(stand.state).toBe("retrying");
  });

  it("(e) laatste succes 48 uur + 1 minuut geleden, zonder foutcode → failed/stale, variant H1", () => {
    const stand = wasteSyncHealth(gezond({ last_success_at: nl("2026-09-27 06:04") }), new Date(nl("2026-09-29 06:05")), TZ);
    expect(stand).toMatchObject({ state: "failed", reason: "stale", variant: "H1", lastErrorCode: null });
  });

  it("precies 48 uur is nog geen storing", () => {
    expect(wasteSyncHealth(gezond({ last_success_at: nl("2026-09-27 06:05") }), new Date(nl("2026-09-29 06:05")), TZ).state).toBe("ok");
  });

  it("(f) alarm gezet, daarna UNREACHABLE (reset, minder dan 48 uur) → failed/held, H1: de balk blijft", () => {
    const stand = wasteSyncHealth(
      gezond({
        last_error_code: "UNREACHABLE",
        error_since: nl("2026-09-29 08:15"),
        last_failure_at: nl("2026-09-29 08:15"),
        alarm_since: nl("2026-09-29 07:15"),
      }),
      new Date(nl("2026-09-29 08:16")),
      TZ,
    );
    expect(stand).toMatchObject({ state: "failed", reason: "held", variant: "H1" });
  });

  it("(f′) alarm door leeg antwoord, daarna adres weg → failed blijft, met de nieuwe variant H3", () => {
    const stand = wasteSyncHealth(
      gezond({
        last_error_code: "ADDRESS_GONE",
        error_since: nl("2026-09-29 08:15"),
        last_failure_at: nl("2026-09-29 08:15"),
        alarm_since: nl("2026-09-29 07:15"),
      }),
      new Date(nl("2026-09-29 08:16")),
      TZ,
    );
    expect(stand).toMatchObject({ state: "failed", reason: "held", variant: "H3" });
  });

  it("(g) succes → ok, zonder reden of variant", () => {
    expect(wasteSyncHealth(gezond(), new Date(nl("2026-09-29 06:10")), TZ)).toEqual({ state: "ok", lastErrorCode: null, lastSuccessAt: nl("2026-09-28 17:05") });
  });

  it("(h) leeg 06:00, 06:20 en 06:40 → retrying: vaker proberen versnelt de storing niet (AC-236)", () => {
    expect(wasteSyncHealth(leegOm("2026-09-29 06:00", "2026-09-29 06:40"), new Date(nl("2026-09-29 06:41")), TZ).state).toBe("retrying");
  });

  it("één mislukte poging (UNREACHABLE) → retrying, geen balk", () => {
    const stand = wasteSyncHealth(
      gezond({ last_error_code: "UNREACHABLE", error_since: nl("2026-09-29 06:00"), last_failure_at: nl("2026-09-29 06:00") }),
      new Date(nl("2026-09-29 06:01")),
      TZ,
    );
    expect(stand).toMatchObject({ state: "retrying", lastErrorCode: "UNREACHABLE" });
    expect(stand.notice).toBeUndefined();
  });

  it("de teksten van de toestand bevatten nooit een adres: alleen toestand, code en tijdstip", () => {
    const stand = wasteSyncHealth(gezond({ last_success_at: nl("2026-09-27 06:04") }), new Date(nl("2026-09-29 06:05")), TZ);
    expect(Object.keys(stand).sort()).toEqual(["lastErrorCode", "lastSuccessAt", "reason", "state", "variant"]);
  });
});

describe("stille regel T-73: kalender van volgend jaar ontbreekt (AC-220)", () => {
  const om = (dagTijd: string, offset: string, pickups: WastePickups, over: Partial<WasteHealthInput> = {}) =>
    wasteSyncHealth(gezond({ last_success_at: nl(dagTijd, offset), pickups, ...over }), new Date(nl(dagTijd, offset)), TZ);

  it("(a) 20 december zonder datums in 2027: de komende 14 dagen lopen over de jaargrens → notice", () => {
    expect(om("2026-12-20 10:00", "+01:00", leeg({ rest: ["2026-12-22", "2026-12-29"] })).notice).toBe("next_year_missing");
  });

  it("(b) 26 november zonder komende datum en zonder 2027 → notice", () => {
    expect(om("2026-11-26 10:00", "+01:00", leeg({ papier: ["2026-11-24"] })).notice).toBe("next_year_missing");
    expect(om("2026-11-26 10:00", "+01:00", leeg()).notice).toBe("next_year_missing");
  });

  it("(c) 26 november met alleen kerstbomen in 2027: de bewaarde stand kent geen kerstbomen, dus notice", () => {
    // Kerstbomen worden nooit bewaard (AC-196); de stand is dan gelijk aan (b)
    expect(om("2026-11-26 10:00", "+01:00", leeg())).toMatchObject({ state: "ok", notice: "next_year_missing" });
  });

  it("10 december met een komende datum en een venster vóór januari → geen regel", () => {
    expect(om("2026-12-10 10:00", "+01:00", leeg({ rest: ["2026-12-15", "2026-12-22"] })).notice).toBeUndefined();
  });

  it("18 december: venster tot 1 januari raakt de jaargrens net → regel", () => {
    expect(om("2026-12-18 10:00", "+01:00", leeg({ rest: ["2026-12-22"] })).notice).toBe("next_year_missing");
    expect(om("2026-12-17 10:00", "+01:00", leeg({ rest: ["2026-12-22"] })).notice).toBeUndefined();
  });

  it("november met nog een komende datum → geen regel", () => {
    expect(om("2026-11-10 10:00", "+01:00", leeg({ papier: ["2026-11-24"] })).notice).toBeUndefined();
  });

  it("zodra er datums van 2027 bekend zijn → geen regel", () => {
    expect(om("2026-12-20 10:00", "+01:00", leeg({ rest: ["2026-12-29", "2027-01-05"] })).notice).toBeUndefined();
    expect(om("2026-11-26 10:00", "+01:00", leeg({ pmd: ["2027-01-08"] })).notice).toBeUndefined();
  });

  it("tijdens retrying of een storing komt de regel niet (de balk of T-71 gaat voor)", () => {
    const retrying = om("2026-12-20 10:00", "+01:00", leeg(), {
      last_error_code: "UNREACHABLE",
      error_since: nl("2026-12-20 06:00", "+01:00"),
      last_failure_at: nl("2026-12-20 06:00", "+01:00"),
    });
    expect(retrying.state).toBe("retrying");
    expect(retrying.notice).toBeUndefined();
  });

  it("in juni zonder komende datum is er geen jaareinde-uitzondering (dat is een leeg antwoord, AC-204 b)", () => {
    expect(om("2026-06-15 10:00", "+02:00", leeg()).notice).toBeUndefined();
  });
});

describe("isNewYearPeriod: T-77a in december en januari, anders T-77b (AC-205 H2)", () => {
  it.each([
    ["2026-12-01T00:30:00+01:00", true],
    ["2027-01-31T23:30:00+01:00", true],
    ["2026-11-30T23:30:00+01:00", false],
    ["2027-02-01T00:30:00+01:00", false],
  ])("%s → %s", (moment, verwacht) => {
    expect(isNewYearPeriod(new Date(moment), TZ)).toBe(verwacht);
  });
});

describe("lastFetchSlot en dueForFetch — 06:00 en 17:00, na een mislukking elk uur (AC-221)", () => {
  const na = (last_success_at: string, last_attempt_at: string | null, nu: string) =>
    dueForFetch({ last_success_at, last_attempt_at }, new Date(nu), TZ);
  const gisteren = nl("2026-09-28 17:05");

  it("het laatste ophaalmoment ≤ nu: 05:59 → gisteren 17:00; 06:00 → vandaag 06:00; 17:00 → vandaag 17:00", () => {
    expect(lastFetchSlot(new Date(nl("2026-09-29 05:59")), TZ).toISOString()).toBe(nl("2026-09-28 17:00"));
    expect(lastFetchSlot(new Date(nl("2026-09-29 06:00")), TZ).toISOString()).toBe(nl("2026-09-29 06:00"));
    expect(lastFetchSlot(new Date(nl("2026-09-29 16:59")), TZ).toISOString()).toBe(nl("2026-09-29 06:00"));
    expect(lastFetchSlot(new Date(nl("2026-09-29 17:00")), TZ).toISOString()).toBe(nl("2026-09-29 17:00"));
  });

  it("05:59 nee, 06:00 ja (na het succes van gisteravond)", () => {
    expect(na(gisteren, gisteren, nl("2026-09-29 05:59"))).toBe(false);
    expect(na(gisteren, gisteren, nl("2026-09-29 06:00"))).toBe(true);
  });

  it("12:00 nee na een succes om 06:05; 17:00 wel", () => {
    const vanochtend = nl("2026-09-29 06:05");
    expect(na(vanochtend, vanochtend, nl("2026-09-29 12:00"))).toBe(false);
    expect(na(vanochtend, vanochtend, nl("2026-09-29 16:59"))).toBe(false);
    expect(na(vanochtend, vanochtend, nl("2026-09-29 17:00"))).toBe(true);
  });

  it("na een mislukking om 06:00: 06:59 nee, 07:01 ja (elk uur, niet vaker)", () => {
    const poging = nl("2026-09-29 06:00");
    expect(na(gisteren, poging, nl("2026-09-29 06:59"))).toBe(false);
    expect(na(gisteren, poging, nl("2026-09-29 07:00"))).toBe(false);
    expect(na(gisteren, poging, nl("2026-09-29 07:01"))).toBe(true);
  });

  it("nooit geprobeerd sinds het moment (last_attempt_at null) → ja", () => {
    expect(na(gisteren, null, nl("2026-09-29 06:00"))).toBe(true);
  });

  it("wintertijd: 06:00 Nederlandse tijd is 05:00 UTC (26 oktober 2026)", () => {
    const succes = nl("2026-10-25 17:05", "+01:00");
    expect(na(succes, succes, "2026-10-26T04:59:00Z")).toBe(false);
    expect(na(succes, succes, "2026-10-26T05:00:00Z")).toBe(true);
  });

  it("de nacht van de overgang naar wintertijd (25 oktober): 06:00 valt na de extra uur, niet ervoor", () => {
    const succes = nl("2026-10-24 17:05", "+02:00");
    // 25 oktober 06:00 CET = 05:00 UTC (de klok ging om 03:00 CEST terug naar 02:00 CET)
    expect(na(succes, succes, "2026-10-25T04:59:00Z")).toBe(false);
    expect(na(succes, succes, "2026-10-25T05:00:00Z")).toBe(true);
  });
});
