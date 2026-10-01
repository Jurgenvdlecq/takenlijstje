/**
 * W-03 — bronmodule en opzoeken (TECHNICAL_DESIGN §18.1, §18.8.1; AC-185…AC-188,
 * AC-196, AC-218). De gemeentebron wordt altijd nagebootst met gereconstrueerde,
 * SYNTHETISCHE antwoorden (§18.1.6): de echte bron is nog niet live gezien. Na de
 * probe komen echte fixtures erbij.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { lookupWasteCalendar } from "../lookup";
import { fetchPickups, lookupAddress, MAX_BYTES, sourceBaseUrl, WASTE_SOURCE_BASE_URL, type SourceDeps } from "../source";

// --- synthetische antwoorden (vorm afgeleid uit open-source integraties) ---
const BAG = "0518200000123456";
const SYNTHETIC_ADDRESS = [{ bagId: BAG, huisletter: null, huisnummerToevoeging: null, straatnaam: "Teststraat", huisnummer: 87, woonplaats: "Den Haag" }];
const SYNTHETIC_STREAMS = [
  { id: 1, title: "Restafval", menu_title: "Restafval", icon: "zak-grijs-rest" },
  { id: 2, title: "Papier en karton", menu_title: null, icon: "doos-karton-papier" },
  { id: 3, title: "PMD", icon: "petfles-blik-drankpak_pmd" },
  { id: 4, title: "GFT", icon: "appel-gft" },
  { id: 5, title: "Grofvuil" },
];
const SYNTHETIC_YEAR = [
  { afvalstroom_id: 1, ophaaldatum: "2026-09-29" },
  { afvalstroom_id: 1, ophaaldatum: "2026-10-06" },
  { afvalstroom_id: 2, ophaaldatum: "2026-10-06" },
  { afvalstroom_id: 3, ophaaldatum: "2026-10-08" },
  { afvalstroom_id: 4, ophaaldatum: "2026-10-05" },
  { afvalstroom_id: 5, ophaaldatum: "2026-10-07" },
  { afvalstroom_id: 3, ophaaldatum: null },
];

type Route = { status?: number; body?: unknown; raw?: string; type?: string; error?: Error };
interface Call {
  url: string;
  init: RequestInit;
}

function fakeFetch(routes: Record<string, Route>) {
  const calls: Call[] = [];
  const fn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    const path = url.replace(WASTE_SOURCE_BASE_URL, "");
    const route = routes[path] ?? { status: 404, body: { error: "not found" } };
    if (route.error) throw route.error;
    const text = route.raw ?? JSON.stringify(route.body ?? null);
    return new Response(text, { status: route.status ?? 200, headers: { "content-type": route.type ?? "application/json; charset=utf-8" } });
  });
  return { fn, calls };
}

function deps(routes: Record<string, Route>): SourceDeps & { calls: Call[] } {
  const { fn, calls } = fakeFetch(routes);
  return { fetch: fn as unknown as typeof fetch, signal: new AbortController().signal, baseUrl: WASTE_SOURCE_BASE_URL, calls };
}

const ok = {
  "/rest/adressen/2591BB-87": { body: SYNTHETIC_ADDRESS },
  [`/rest/adressen/${BAG}/afvalstromen`]: { body: SYNTHETIC_STREAMS },
  [`/rest/adressen/${BAG}/kalender/2026`]: { body: SYNTHETIC_YEAR },
};
const TODAY = "2026-10-01";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("vaste host en alleen het adres naar buiten (AC-218)", () => {
  it("alle verzoeken naar de vaste host, alleen postcode-nummer of adrescode in het pad, alleen Accept en User-Agent, nooit een redirect volgen", async () => {
    const d = deps(ok);
    await lookupWasteCalendar({ postcode: "2591BB", houseNumber: 87, suffix: null }, TODAY, d);
    expect(d.calls.map((c) => c.url)).toEqual([
      `${WASTE_SOURCE_BASE_URL}/rest/adressen/2591BB-87`,
      `${WASTE_SOURCE_BASE_URL}/rest/adressen/${BAG}/afvalstromen`,
      `${WASTE_SOURCE_BASE_URL}/rest/adressen/${BAG}/kalender/2026`,
    ]);
    for (const { init } of d.calls) {
      expect(init.method).toBe("GET");
      expect(init.redirect).toBe("error");
      expect(init.credentials).toBeUndefined();
      expect(Object.keys(init.headers as Record<string, string>).sort()).toEqual(["Accept", "User-Agent"]);
    }
  });

  it("in december ook het volgende jaar (404 = leeg, geen fout)", async () => {
    const d = deps({ ...ok, [`/rest/adressen/${BAG}/kalender/2026`]: { body: [{ afvalstroom_id: 1, ophaaldatum: "2026-12-29" }] } });
    const result = await fetchPickups(BAG, "2026-12-20", d);
    expect(d.calls.map((c) => c.url.split("/").at(-1))).toEqual(["afvalstromen", "2026", "2027"]);
    expect(result).toMatchObject({ ok: true, value: { pickups: { rest: ["2026-12-29"] } } });
  });

  it("de override geldt alleen voor een loopback-adres", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(sourceBaseUrl(undefined)).toBe(WASTE_SOURCE_BASE_URL);
    expect(sourceBaseUrl("http://127.0.0.1:4010")).toBe("http://127.0.0.1:4010");
    for (const bad of ["https://evil.example", "http://127.0.0.1.evil.com:80", "http://localhost:4010", "http://127.0.0.1:4010/x", "http://10.0.0.1:80"]) {
      expect(sourceBaseUrl(bad)).toBe(WASTE_SOURCE_BASE_URL);
    }
  });

  it("ongeldige invoer gaat nooit naar buiten", async () => {
    const d = deps(ok);
    expect(await lookupAddress("../../x", 1, d)).toEqual({ ok: false, code: "FORMAT" });
    expect(await fetchPickups("12/../../etc", TODAY, d)).toEqual({ ok: false, code: "FORMAT" });
    expect(d.calls).toEqual([]);
  });
});

describe("uitkomsten van het opzoeken (AC-183…AC-188, AC-196)", () => {
  it("gevonden: weergave en eerstvolgende dag per bak; GFT en grofvuil genegeerd", async () => {
    const result = await lookupWasteCalendar({ postcode: "2591BB", houseNumber: 87, suffix: null }, TODAY, deps(ok));
    expect(result).toEqual({
      kind: "found",
      address: { postcode: "2591BB", houseNumber: 87, suffix: "" },
      bagId: BAG,
      display: "Teststraat 87, Den Haag",
      pickups: { rest: ["2026-10-06"], papier: ["2026-10-06"], pmd: ["2026-10-08"] },
      next: { rest: "2026-10-06", papier: "2026-10-06", pmd: "2026-10-08" },
    });
  });

  it("onbekend of buiten Den Haag → not_found (lege lijst of 404)", async () => {
    expect(await lookupWasteCalendar({ postcode: "2288GH", houseNumber: 5, suffix: null }, TODAY, deps({ "/rest/adressen/2288GH-5": { body: [] } }))).toEqual({ kind: "not_found" });
    expect(await lookupWasteCalendar({ postcode: "2288GH", houseNumber: 5, suffix: null }, TODAY, deps({}))).toEqual({ kind: "not_found" });
  });

  it("meerdere adressen → kiezen", async () => {
    const d = deps({
      "/rest/adressen/2511AB-12": {
        body: [
          { bagId: "0518200000000001", huisletter: null, huisnummerToevoeging: null },
          { bagId: "0518200000000002", huisletter: "A", huisnummerToevoeging: null },
        ],
      },
    });
    expect(await lookupWasteCalendar({ postcode: "2511AB", houseNumber: 12, suffix: null }, TODAY, d)).toEqual({
      kind: "choose",
      options: [
        { suffix: "", label: "12" },
        { suffix: "A", label: "12A" },
      ],
    });
  });

  it("alleen GFT → no_streams; alleen datums in het verleden → no_upcoming", async () => {
    const onlyGft = { ...ok, [`/rest/adressen/${BAG}/kalender/2026`]: { body: [{ afvalstroom_id: 4, ophaaldatum: "2026-10-05" }] } };
    expect(await lookupWasteCalendar({ postcode: "2591BB", houseNumber: 87, suffix: null }, TODAY, deps(onlyGft))).toEqual({ kind: "no_streams" });
    const past = { ...ok, [`/rest/adressen/${BAG}/kalender/2026`]: { body: [{ afvalstroom_id: 1, ophaaldatum: "2026-09-01" }] } };
    expect(await lookupWasteCalendar({ postcode: "2591BB", houseNumber: 87, suffix: null }, TODAY, deps(past))).toEqual({ kind: "no_upcoming" });
  });

  it.each<[string, Route]>([
    ["503", { status: 503, body: {} }],
    ["429", { status: 429, body: {} }],
    ["time-out", { error: Object.assign(new Error("timeout"), { name: "TimeoutError" }) }],
    ["redirect", { error: new TypeError("fetch failed: redirect") }],
    ["kapotte JSON", { raw: "{nee" }],
    ["verkeerde content-type", { raw: "<html></html>", type: "text/html" }],
    ["onverwachte vorm", { body: [{ afvalstroom_id: 1, ophaaldatum: 12345 }] }],
    ["te groot", { raw: `[${"0,".repeat(MAX_BYTES / 2)}0]` }],
  ])("bron onbereikbaar of onbruikbaar (%s) → unreachable, niets bewaard", async (_label, route) => {
    const d = deps({ ...ok, [`/rest/adressen/${BAG}/kalender/2026`]: route });
    expect(await lookupWasteCalendar({ postcode: "2591BB", houseNumber: 87, suffix: null }, TODAY, d)).toEqual({ kind: "unreachable" });
  });

  it("de log bevat alleen de uitkomst, geen adres of adrescode (AC-212)", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await lookupWasteCalendar({ postcode: "2591BB", houseNumber: 87, suffix: null }, TODAY, deps(ok));
    const logged = info.mock.calls.flat().join(" ");
    expect(logged).toBe("[waste] lookup uitkomst=found");
  });
});
