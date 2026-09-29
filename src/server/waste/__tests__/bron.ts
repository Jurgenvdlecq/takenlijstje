/**
 * Testhelper: bootst de huisvuilkalender na als `deps.fetch` (TD §18.15: "de bron
 * wordt altijd nagebootst"). Splitst een fixture per endpoint:
 *   A `/rest/adressen/{POSTCODE}-{nr}`     → `adres` (bij een ander adres: `adres_onbekend`)
 *   B `/rest/adressen/{bagId}/afvalstromen` → `afvalstromen`
 *   C `/rest/adressen/{bagId}/kalender/{J}` → `kalender_{J}` (ontbreekt → `[]`)
 * Houdt elk verzoek bij (url, headers, opties) en telt per pad ("stub-teller").
 * Nooit een echt netwerkverzoek: een URL buiten de vaste host geeft een fout.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const BRON_HOST = "https://huisvuilkalender.denhaag.nl";

export type Fixture = Record<string, unknown> & {
  adres: { postcode: string; huisnummer: number; bagId: string }[];
  afvalstromen: unknown;
  adres_onbekend: unknown[];
};

export function laadFixture(naam: string): Fixture {
  const pad = fileURLToPath(new URL(`./fixtures/${naam}.json`, import.meta.url));
  return JSON.parse(readFileSync(pad, "utf8")) as Fixture;
}

/** Wat een endpoint teruggeeft: een JSON-body, of een eigen antwoord of fout */
export type Antwoord =
  | { body: unknown; status?: number; contentType?: string; headers?: Record<string, string> }
  | { raw: string; status?: number; contentType?: string }
  | { netwerkfout: true }
  | { wacht: true }
  | ((url: string, init: RequestInit) => Promise<Response> | Response);

export interface BronOpties {
  /** Overschrijf per endpoint (A, B, of C met jaar) */
  a?: Antwoord;
  b?: Antwoord;
  c?: Record<number, Antwoord>;
  /** Alle antwoorden op één pad-patroon vervangen (bijv. "onbereikbaar") */
  alles?: Antwoord;
  /** Andere basis (alleen voor de loopback-override) */
  host?: string;
}

export interface Verzoek {
  url: string;
  pad: string;
  init: RequestInit;
}

export interface Bron {
  fetch: typeof fetch;
  verzoeken: Verzoek[];
  /** Aantal verzoeken waarvan het pad `deel` bevat (of op de regex past) */
  teller(deel: string | RegExp): number;
  /** Antwoorden aanpassen tussen twee rondes */
  zet(opties: BronOpties): void;
}

function json(body: unknown, status = 200, contentType = "application/json; charset=utf-8", headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": contentType, ...headers } });
}

async function beantwoord(antwoord: Antwoord, url: string, init: RequestInit): Promise<Response> {
  if (typeof antwoord === "function") return antwoord(url, init);
  if ("netwerkfout" in antwoord) throw new TypeError("fetch failed");
  if ("wacht" in antwoord) {
    // Wacht tot het signaal (time-out of totaalbudget) afbreekt, zoals een trage bron
    return new Promise<Response>((_resolve, reject) => {
      const signal = init.signal;
      if (signal?.aborted) return reject(signal.reason);
      signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  }
  if ("raw" in antwoord) {
    return new Response(antwoord.raw, { status: antwoord.status ?? 200, headers: { "content-type": antwoord.contentType ?? "application/json" } });
  }
  return json(antwoord.body, antwoord.status, antwoord.contentType, antwoord.headers);
}

export function maakBron(fixture: Fixture, beginOpties: BronOpties = {}): Bron {
  let opties = { ...beginOpties };
  const verzoeken: Verzoek[] = [];
  const host = () => opties.host ?? BRON_HOST;

  const doFetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.startsWith(`${host()}/`)) throw new Error(`Testbron: verzoek buiten de vaste host: ${url}`);
    const pad = url.slice(host().length);
    verzoeken.push({ url, pad, init });
    if (init.signal?.aborted) throw init.signal.reason;
    if (opties.alles) return beantwoord(opties.alles, url, init);

    const kalender = /^\/rest\/adressen\/([0-9]{16})\/kalender\/(\d{4})$/.exec(pad);
    if (kalender) {
      const jaar = Number(kalender[2]);
      const eigen = opties.c?.[jaar];
      if (eigen) return beantwoord(eigen, url, init);
      return json(fixture[`kalender_${jaar}`] ?? []);
    }
    if (/^\/rest\/adressen\/[0-9]{16}\/afvalstromen$/.test(pad)) {
      if (opties.b) return beantwoord(opties.b, url, init);
      return json(fixture.afvalstromen);
    }
    const adres = /^\/rest\/adressen\/([1-9][0-9]{3}[A-Z]{2})-(\d{1,5})$/.exec(pad);
    if (adres) {
      if (opties.a) return beantwoord(opties.a, url, init);
      const bekend = fixture.adres.filter((a) => a.postcode === adres[1] && Number(a.huisnummer) === Number(adres[2]));
      return json(bekend.length ? fixture.adres : fixture.adres_onbekend);
    }
    return new Response("niet gevonden", { status: 404, headers: { "content-type": "text/html" } });
  }) as typeof fetch;

  return {
    fetch: doFetch,
    verzoeken,
    teller: (deel) => verzoeken.filter((v) => (typeof deel === "string" ? v.pad.includes(deel) : deel.test(v.pad))).length,
    zet(nieuw) {
      opties = { ...opties, ...nieuw };
    },
  };
}

/** Datums als C-rijen (`afvalstroom_id` volgens de P0-soorten: 2 PMD, 3 papier, 4 rest, 1 GFT, 5 kerstbomen) */
export const STROOM_ID = { gft: 1, pmd: 2, papier: 3, rest: 4, kerstbomen: 5 } as const;
export function rijen(soort: keyof typeof STROOM_ID, datums: string[]) {
  return datums.map((ophaaldatum) => ({ ophaaldatum, afvalstroom_id: STROOM_ID[soort] }));
}
