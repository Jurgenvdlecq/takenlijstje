import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchAddressRaw, fetchStreamsRaw, fetchYearRaw, sourceBaseUrl, WASTE_SOURCE_BASE_URL } from "../source";
import { BRON_HOST, laadFixture, maakBron, type Bron } from "./bron";

/**
 * WP3b — de gemeentebron: vaste host, alleen gevalideerde padsegmenten, twee
 * headers, geen redirects, grenzen op tijd en grootte (TECHNICAL_DESIGN §18.1.2).
 * AC-188, AC-218; security-review WP3b (punt 3: override nooit in productie).
 */
const BAG = "0518200000813196";

describe("sourceBaseUrl — vaste host; override alleen loopback en nooit in productie (AC-218, security-review punt 3)", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("zonder override: de huisvuilkalender van Den Haag over https", () => {
    vi.stubEnv("WASTE_SOURCE_BASE_URL", "");
    expect(sourceBaseUrl()).toBe("https://huisvuilkalender.denhaag.nl");
    expect(WASTE_SOURCE_BASE_URL).toBe(BRON_HOST);
  });

  it("een loopback-override (http://127.0.0.1:<poort>) geldt buiten productie", () => {
    vi.stubEnv("WASTE_SOURCE_BASE_URL", "http://127.0.0.1:4599");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(sourceBaseUrl()).toBe("http://127.0.0.1:4599");
  });

  it("dezelfde override wordt genegeerd als VERCEL_ENV = production", () => {
    vi.stubEnv("WASTE_SOURCE_BASE_URL", "http://127.0.0.1:4599");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(sourceBaseUrl()).toBe(WASTE_SOURCE_BASE_URL);
  });

  it.each(["http://evil", "https://127.0.0.1:1", "http://127.0.0.1.evil:80", "http://localhost:80", "http://127.0.0.1:4599/pad", "http://127.0.0.1"])(
    "%s wordt genegeerd",
    (override) => {
      vi.stubEnv("WASTE_SOURCE_BASE_URL", override);
      vi.stubEnv("VERCEL_ENV", "development");
      expect(sourceBaseUrl()).toBe(WASTE_SOURCE_BASE_URL);
    },
  );
});

describe("het uitgaande verzoek (AC-218)", () => {
  let bron: Bron;
  beforeEach(() => {
    bron = maakBron(laadFixture("p0-2591BB-87"));
  });

  it("A: pad alleen postcode-nummer; precies de headers Accept en User-Agent; redirect 'error'; geen cookies", async () => {
    const result = await fetchAddressRaw("2591BB", 87, { fetch: bron.fetch });
    expect(result.kind).toBe("json");
    expect(bron.verzoeken).toHaveLength(1);
    const { url, init } = bron.verzoeken[0];
    expect(url).toBe(`${BRON_HOST}/rest/adressen/2591BB-87`);
    expect(init.method).toBe("GET");
    expect(init.redirect).toBe("error");
    expect(init.credentials).toBe("omit");
    expect(init.headers).toEqual({ Accept: "application/json", "User-Agent": "Takenlijstje/1 (prive gezinsapp)" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("B en C: alleen de adrescode en het jaar in het pad", async () => {
    await fetchStreamsRaw(BAG, { fetch: bron.fetch });
    await fetchYearRaw(BAG, 2026, { fetch: bron.fetch });
    expect(bron.verzoeken.map((v) => v.pad)).toEqual([`/rest/adressen/${BAG}/afvalstromen`, `/rest/adressen/${BAG}/kalender/2026`]);
  });

  it("de User-Agent en URL bevatten geen naam, e-mail, huishouden- of lid-id", async () => {
    await fetchAddressRaw("2591BB", 87, { fetch: bron.fetch });
    const alles = JSON.stringify(bron.verzoeken[0]);
    expect(alles).not.toMatch(/@|household|member|jurgen|ellen/i);
  });

  it.each([
    ["2591 BB", 87],
    ["2591bb", 87],
    ["0591BB", 87],
    ["2591BB", 0],
    ["2591BB", 100_000],
    ["2591BB", 1.5],
  ] as const)("ongeldig segment %s / %s: geen verzoek (de segmenten zijn al genormaliseerd)", async (postcode, nummer) => {
    await expect(fetchAddressRaw(postcode, nummer, { fetch: bron.fetch })).rejects.toThrow();
    expect(bron.verzoeken).toHaveLength(0);
  });

  it.each(["123", "05182000008131961", "0518200000813x96"])("ongeldige adrescode %s: geen verzoek", async (bagId) => {
    await expect(fetchStreamsRaw(bagId, { fetch: bron.fetch })).rejects.toThrow();
    await expect(fetchYearRaw(bagId, 2026, { fetch: bron.fetch })).rejects.toThrow();
    expect(bron.verzoeken).toHaveLength(0);
  });

  it("een jaar buiten 2020…2100 gaat niet naar buiten", async () => {
    await expect(fetchYearRaw(BAG, 1999, { fetch: bron.fetch })).rejects.toThrow();
    expect(bron.verzoeken).toHaveLength(0);
  });
});

describe("antwoorden die geen 200-JSON zijn (AC-188, AC-204 a)", () => {
  const fixture = laadFixture("p0-2591BB-87");

  it("503 → UNREACHABLE met de status; 404 op A → not_found (D-047: alleen 200 [] is 'onbekend adres')", async () => {
    const bron = maakBron(fixture, { a: { body: "storing", status: 503 } });
    expect(await fetchAddressRaw("2591BB", 87, { fetch: bron.fetch })).toEqual({ kind: "error", code: "UNREACHABLE", http: 503 });
    bron.zet({ a: { body: [], status: 404 } });
    expect(await fetchAddressRaw("2591BB", 87, { fetch: bron.fetch })).toEqual({ kind: "not_found" });
  });

  it("een netwerkfout → UNREACHABLE, zonder dat de fout omhoog komt", async () => {
    const bron = maakBron(fixture, { alles: { netwerkfout: true } });
    expect(await fetchAddressRaw("2591BB", 87, { fetch: bron.fetch })).toEqual({ kind: "error", code: "UNREACHABLE" });
  });

  it("een redirect (301) wordt niet gevolgd: met redirect 'error' gooit fetch, en dat is UNREACHABLE", async () => {
    const bron = maakBron(fixture, {
      alles: (_url, init) => {
        if (init.redirect === "error") throw new TypeError("fetch failed: redirect");
        return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
      },
    });
    expect(await fetchAddressRaw("2591BB", 87, { fetch: bron.fetch })).toEqual({ kind: "error", code: "UNREACHABLE" });
  });

  it("een 301 die tóch als antwoord terugkomt → UNREACHABLE met status 301", async () => {
    const bron = maakBron(fixture, { alles: { body: "", status: 301, headers: { location: "https://elders.example" } } });
    expect(await fetchStreamsRaw(BAG, { fetch: bron.fetch })).toEqual({ kind: "error", code: "UNREACHABLE", http: 301 });
  });

  it("geen JSON content-type (HTML-foutpagina met 200) → FORMAT", async () => {
    const bron = maakBron(fixture, { alles: { raw: "<html>storing</html>", contentType: "text/html" } });
    expect(await fetchStreamsRaw(BAG, { fetch: bron.fetch })).toEqual({ kind: "error", code: "FORMAT", http: 200 });
  });

  it("kapotte JSON → FORMAT", async () => {
    const bron = maakBron(fixture, { alles: { raw: '{"afgebroken": [1, 2' } });
    expect(await fetchYearRaw(BAG, 2026, { fetch: bron.fetch })).toEqual({ kind: "error", code: "FORMAT", http: 200 });
  });

  it("een antwoord boven 1 MB wordt afgebroken → FORMAT", async () => {
    const groot = `[${"{\"ophaaldatum\":\"2026-10-06\",\"afvalstroom_id\":4},".repeat(30_000)}]`;
    expect(groot.length).toBeGreaterThan(1_000_000);
    const bron = maakBron(fixture, { alles: { raw: groot } });
    expect(await fetchYearRaw(BAG, 2026, { fetch: bron.fetch })).toEqual({ kind: "error", code: "FORMAT", http: 200 });
  });

  it("een antwoord net onder de grens komt gewoon door", async () => {
    const rijen = Array.from({ length: 9_000 }, () => ({ ophaaldatum: "2026-10-06", afvalstroom_id: 4 }));
    const bron = maakBron(fixture, { alles: { body: rijen } });
    const result = await fetchYearRaw(BAG, 2026, { fetch: bron.fetch });
    expect(result.kind).toBe("json");
  });

  it("time-out: het totaalbudget (signal) breekt een trage bron af → UNREACHABLE", async () => {
    const bron = maakBron(fixture, { alles: { wacht: true } });
    const result = await fetchAddressRaw("2591BB", 87, { fetch: bron.fetch, signal: AbortSignal.timeout(30) });
    expect(result).toEqual({ kind: "error", code: "UNREACHABLE" });
  });

  it("een al afgebroken budget: het verzoek gaat niet meer naar buiten", async () => {
    const bron = maakBron(fixture);
    const result = await fetchAddressRaw("2591BB", 87, { fetch: bron.fetch, signal: AbortSignal.abort() });
    expect(result).toEqual({ kind: "error", code: "UNREACHABLE" });
  });
});
