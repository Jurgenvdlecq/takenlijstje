/**
 * Nagebootste huisvuilkalender van Den Haag voor de E2E-tests van de
 * afvalkalender (TECHNICAL_DESIGN §18.1.1, §18.15). Luistert ALLEEN op
 * 127.0.0.1, zodat de app hem via WASTE_SOURCE_BASE_URL=http://127.0.0.1:<poort>
 * mag gebruiken (§18.1.2).
 *
 * Endpoints zoals de echte bron (vorm uit docs/wijzigingen/W-03/probe/fixtures-2591BB-87.json):
 *   A  GET /rest/adressen/{POSTCODE}-{nr}           → kandidaten
 *   B  GET /rest/adressen/{bagId}/afvalstromen      → soorten (of {} bij "adres weg")
 *   C  GET /rest/adressen/{bagId}/kalender/{jaar}   → ophaaldagen van dat jaar
 *
 * Beheer (alleen loopback; de app roept deze paden nooit aan):
 *   POST /__stub/scenario  {"scenario": "<naam>", "delayMs"?: n}  → wisselt het scenario en zet de teller op 0
 *   GET  /__stub/counts                                            → {"<pad>": aantal, ...}
 *   POST /__stub/reset                                             → scenario "normaal", teller 0
 *   GET  /__stub/health                                            → 200 (voor Playwright webServer)
 *
 * Datums worden berekend vanaf vandaag in Europe/Amsterdam (de server van de app
 * gebruikt de echte klok), zodat de tests op elke dag hetzelfde betekenen.
 *
 * Scenario's (TD §18.15):
 *   normaal          rest D+2, D+9, D+16; papier D+2, D+30; PMD D+9, D+23
 *                    → binnen 14 dagen: D+2 (rest+papier) en D+9 (rest+PMD) = 4 afvaltaken
 *   normaal_b        tweede adres (andere adrescode): rest D+3, papier D+10 → 4 afvaltaken
 *   meerdere         A geeft 12, 12A en 12B (zelfde data als normaal per kandidaat)
 *   onbekend         A → []
 *   alleen_gft       C(J) alleen GFT-datums (en C(J+1) [])
 *   onbereikbaar     alles 503
 *   leeg             C(J) [] en C(J+1) []
 *   adres_weg        B → {} (letterlijk U0.2), C → []
 *   jaareinde        C(J) alleen datums in het verleden (P0-vorm), C(J+1) []
 *   kerstbomen_j1    als jaareinde, maar C(J+1) alleen kerstbomen
 *   drie_weken       alleen papier, eerstvolgende D+21 (en D+49)
 *   verschuiving     als normaal, alle datums één dag later
 *   traag            als normaal, maar elk antwoord na 10 s (of delayMs)
 */
import http from "node:http";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.E2E_WASTE_STUB_PORT ?? 4599);
const HOST = "127.0.0.1";

export const BAG_ID = "0518200000813196"; // P0-testadres 2591 BB 87
export const BAG_ID_B = "0518200000999902"; // tweede adres (normaal_b)
export const BAG_ID_12 = "0518200000000012";
export const BAG_ID_12A = "0518200000000121";
export const BAG_ID_12B = "0518200000000122";

// B: de vijf soorten uit P0 (content/icon_data weggelaten, zoals in de fixture)
const STREAMS = [
  { id: 1, icon: "appel-gft", slug: "", tags: null, title: "GFT", parent_id: 0, menu_title: "GFT", page_title: "Groente, Fruit en Tuinafval", ophaaldatum: null },
  { id: 2, icon: "petfles-blik-drankpak_pmd", slug: "", tags: null, title: "PMD", parent_id: 0, menu_title: "PMD", page_title: "Plastic verpakkingen, blik en drinkpakken", ophaaldatum: null },
  { id: 3, icon: "doos-karton-papier", slug: "", tags: "", title: "Papier", parent_id: 0, menu_title: "Papier", page_title: "Papier", ophaaldatum: null },
  { id: 4, icon: "zak-grijs-rest", slug: "", tags: "", title: "Rest", parent_id: 0, menu_title: "Rest", page_title: "Rest", ophaaldatum: null },
  { id: 5, icon: "kerstboom-zonder-kruis", slug: "", tags: null, title: "Kerstbomen", parent_id: 0, menu_title: "Kerstbomen", page_title: "Kerstbomen", ophaaldatum: null },
];
const ID = { gft: 1, pmd: 2, papier: 3, rest: 4, kerst: 5 };

function addressItem(bagId, huisnummer, huisletter = "", postcode = "2591BB", straat = "Zwedenburg") {
  return {
    bagId,
    latitude: 52.092559,
    postcode,
    longitude: 4.360263,
    gemeenteId: 518,
    huisletter,
    huisnummer,
    woonplaatsId: 1245,
    woonplaatsNaam: "'s-Gravenhage",
    openbareRuimteNaam: straat,
    huisnummerToevoeging: "",
  };
}

/** Vandaag (YYYY-MM-DD) in Europe/Amsterdam, plus n dagen */
export function amsterdamDay(offsetDays = 0, now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(now);
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const rows = (stream, offsets) => offsets.map((o) => ({ ophaaldatum: amsterdamDay(o), afvalstroom_id: ID[stream] }));

/** Alle ophaaldagen per scenario en adrescode (alle jaren door elkaar; C filtert op jaar) */
function pickupRows(scenario, bagId) {
  switch (scenario) {
    case "normaal":
    case "meerdere":
    case "traag":
      return [...rows("rest", [2, 9, 16]), ...rows("papier", [2, 30]), ...rows("pmd", [9, 23]), ...rows("gft", [1, 8])];
    case "normaal_b":
      return bagId === BAG_ID_B
        ? [...rows("rest", [3, 17]), ...rows("papier", [10])]
        : [...rows("rest", [2, 9, 16]), ...rows("papier", [2, 30]), ...rows("pmd", [9, 23])];
    case "verschuiving":
      return [...rows("rest", [3, 10, 17]), ...rows("papier", [3, 31]), ...rows("pmd", [10, 24])];
    case "alleen_gft":
      return rows("gft", [1, 8, 15]);
    case "drie_weken":
      return rows("papier", [21, 49]);
    case "jaareinde":
      // P0-vorm: papier elke 4 weken, maar alleen in het verleden; kerstbomen in januari
      return [...rows("papier", [-84, -56, -28, -2]), ...rows("kerst", [-260, -253])];
    case "kerstbomen_j1":
      return [...rows("papier", [-84, -56, -28, -2]), { ophaaldatum: `${Number(amsterdamDay(0).slice(0, 4)) + 1}-01-06`, afvalstroom_id: ID.kerst }];
    default:
      return [];
  }
}

function candidates(scenario, postcode, nr) {
  if (scenario === "onbekend") return [];
  if (scenario === "meerdere") {
    return [addressItem(BAG_ID_12, nr, "", postcode), addressItem(BAG_ID_12A, nr, "A", postcode), addressItem(BAG_ID_12B, nr, "B", postcode)];
  }
  if (scenario === "normaal_b" && postcode !== "2591BB") return [addressItem(BAG_ID_B, nr, "", postcode, "Nieuwe Parklaan")];
  return [addressItem(BAG_ID, nr, "", postcode)];
}

// ---------------------------------------------------------------------------
// Toestand
// ---------------------------------------------------------------------------
const state = { scenario: "normaal", delayMs: 0, counts: {} };

function reset(scenario = "normaal", delayMs) {
  state.scenario = scenario;
  state.delayMs = delayMs ?? (scenario === "traag" ? 10_000 : 0);
  state.counts = {};
}

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const text = Buffer.concat(chunks).toString();
  return text ? JSON.parse(text) : {};
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function handle(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const path = url.pathname;

  // Beheer
  if (path === "/__stub/health") return send(res, 200, { ok: true });
  if (path === "/__stub/counts") return send(res, 200, state.counts);
  if (path === "/__stub/reset" && req.method === "POST") {
    reset();
    return send(res, 200, { ok: true });
  }
  if (path === "/__stub/scenario" && req.method === "POST") {
    const body = await readBody(req);
    reset(body.scenario ?? "normaal", body.delayMs);
    return send(res, 200, { ok: true, scenario: state.scenario });
  }

  // Bron
  state.counts[path] = (state.counts[path] ?? 0) + 1;
  if (req.method !== "GET") return send(res, 405, { error: "alleen GET" });
  if (state.delayMs) await sleep(state.delayMs);
  if (state.scenario === "onbereikbaar") return send(res, 503, "Service Unavailable", "text/plain");

  let m = /^\/rest\/adressen\/([1-9][0-9]{3}[A-Z]{2})-(\d{1,5})$/.exec(path);
  if (m) return send(res, 200, candidates(state.scenario, m[1], Number(m[2])));

  m = /^\/rest\/adressen\/(\d{16})\/afvalstromen$/.exec(path);
  if (m) return send(res, 200, state.scenario === "adres_weg" ? {} : STREAMS);

  m = /^\/rest\/adressen\/(\d{16})\/kalender\/(\d{4})$/.exec(path);
  if (m) {
    if (state.scenario === "adres_weg") return send(res, 200, []);
    const year = m[2];
    return send(res, 200, pickupRows(state.scenario, m[1]).filter((r) => r.ophaaldatum.startsWith(`${year}-`)));
  }

  return send(res, 404, { error: "onbekend pad" });
}

export function startWasteStub(port = PORT) {
  const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => send(res, 500, { error: String(error) }));
  });
  return new Promise((resolve) => server.listen(port, HOST, () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await startWasteStub();
  console.log(`✓ Afvalkalender-stub op http://${HOST}:${PORT}`);
}
