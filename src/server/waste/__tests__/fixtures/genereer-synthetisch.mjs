// Genereert de synthetische fixtures (TD §18.1.6) in exact de vorm van de P0-fixture.
import { readFileSync, writeFileSync } from "node:fs";

const dir = process.argv[2];
const p0 = JSON.parse(readFileSync(`${dir}/p0-2591BB-87.json`, "utf8"));

const stromen = p0.afvalstromen.map((s) => ({ ...s, ophaaldatum: null }));
const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const reeks = (start, stap, tot, id) => {
  const out = [];
  for (let d = start; d <= tot; d = addDays(d, stap)) out.push({ ophaaldatum: d, afvalstroom_id: id });
  return out;
};
const sorteer = (rows) => rows.sort((a, b) => (a.ophaaldatum < b.ophaaldatum ? -1 : a.ophaaldatum > b.ophaaldatum ? 1 : a.afvalstroom_id - b.afvalstroom_id));
const adres = (bagId, straat, nr, letter = "", toev = "", postcode = "2511AB") => ({
  bagId, latitude: 52.0801, postcode, longitude: 4.3102, gemeenteId: 518, huisletter: letter, huisnummer: nr,
  woonplaatsId: 1245, woonplaatsNaam: "'s-Gravenhage", openbareRuimteNaam: straat, huisnummerToevoeging: toev,
});
const robots = p0.robots;
const schrijf = (naam, data) => writeFileSync(`${dir}/synthetisch-${naam}.json`, JSON.stringify(data, null, 2) + "\n");

// 1. Rest (wekelijks, di), papier (4-wekelijks, wo), PMD (2-wekelijks, vr), plus GFT en kerstbomen in de agenda
const kalender2026 = sorteer([
  ...reeks("2026-01-06", 7, "2026-12-29", 4),
  ...reeks("2026-01-14", 28, "2026-12-31", 3),
  ...reeks("2026-01-09", 14, "2026-12-31", 2),
  ...reeks("2026-01-05", 14, "2026-12-31", 1),
  { ophaaldatum: "2026-01-07", afvalstroom_id: 5 },
  { ophaaldatum: "2026-01-14", afvalstroom_id: 5 },
]);
schrijf("rest-papier-pmd", {
  adres: [adres("0518200000000101", "Voorbeeldstraat", 12)],
  robots,
  afvalstromen: stromen,
  kalender_2026: kalender2026,
  kalender_2027: [],
  adres_onbekend: [],
});

// 2. B met content en icon_data (± 20 KB), om het strippen en de grootte te toetsen
const html = "<p>Zet de container aan de weg. </p>".repeat(60);
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg">${"<path d='M0 0L10 10'/>".repeat(40)}</svg>`).toString("base64");
schrijf("b-groot", {
  adres: [adres("0518200000000101", "Voorbeeldstraat", 12)],
  robots,
  afvalstromen: stromen.map((s) => ({ ...s, content: html, icon_data: svg })),
  kalender_2026: kalender2026,
  kalender_2027: [],
  adres_onbekend: [],
});

// 3. Alleen GFT (en kerstbomen): geen rest, papier of PMD
schrijf("alleen-gft", {
  adres: [adres("0518200000000103", "Groenstraat", 3)],
  robots,
  afvalstromen: stromen,
  kalender_2026: sorteer([...reeks("2026-01-05", 14, "2026-12-31", 1), { ophaaldatum: "2026-01-07", afvalstroom_id: 5 }]),
  kalender_2027: [],
  adres_onbekend: [],
});

// 4. Meerdere kandidaten op nummer 12: zonder letter, A en B
schrijf("meerdere-kandidaten", {
  adres: [
    adres("0518200000000104", "Voorbeeldstraat", 12),
    adres("0518200000000105", "Voorbeeldstraat", 12, "A"),
    adres("0518200000000106", "Voorbeeldstraat", 12, "B"),
  ],
  robots,
  afvalstromen: stromen,
  kalender_2026: kalender2026,
  kalender_2027: [],
  adres_onbekend: [],
});

// 5. December zonder J+1: rest wekelijks tot en met 29 december, 2027 nog leeg
schrijf("december-zonder-j1", {
  adres: [adres("0518200000000107", "Decemberlaan", 5)],
  robots,
  afvalstromen: stromen,
  kalender_2026: reeks("2026-01-06", 7, "2026-12-29", 4),
  kalender_2027: [],
  adres_onbekend: [],
});

// 6. Januari met een lege C(J): het vorige jaar had wél datums (en een variant zonder)
schrijf("januari-leeg", {
  adres: [adres("0518200000000108", "Januaristraat", 1)],
  robots,
  afvalstromen: stromen,
  kalender_2026: reeks("2026-01-06", 7, "2026-12-29", 4),
  kalender_2027: [{ ophaaldatum: "2027-01-06", afvalstroom_id: 5 }],
  adres_onbekend: [],
});

// 7. Eerstvolgende dag over 3 weken (vanaf maandag 5 oktober 2026): rest op 26 oktober
schrijf("over-3-weken", {
  adres: [adres("0518200000000109", "Verweg", 21)],
  robots,
  afvalstromen: stromen,
  kalender_2026: [
    { ophaaldatum: "2026-09-28", afvalstroom_id: 4 },
    { ophaaldatum: "2026-10-26", afvalstroom_id: 4 },
    { ophaaldatum: "2026-11-23", afvalstroom_id: 4 },
  ],
  kalender_2027: [],
  adres_onbekend: [],
});

// 8. Verschuiving: vrijdag 25 december (rest) schuift naar zaterdag 26 december
const voor = [
  { ophaaldatum: "2026-12-18", afvalstroom_id: 4 },
  { ophaaldatum: "2026-12-25", afvalstroom_id: 4 },
  { ophaaldatum: "2027-01-01", afvalstroom_id: 4 },
];
schrijf("verschuiving", {
  adres: [adres("0518200000000110", "Kerstlaan", 25)],
  robots,
  afvalstromen: stromen,
  kalender_2026: voor,
  kalender_2026_verschoven: voor.map((r) => (r.ophaaldatum === "2026-12-25" ? { ...r, ophaaldatum: "2026-12-26" } : r)),
  kalender_2027: [{ ophaaldatum: "2027-01-01", afvalstroom_id: 4 }],
  adres_onbekend: [],
});

// 9. Leeg: C(J) en C(J+1) []
schrijf("leeg", {
  adres: [adres("0518200000000111", "Leegstraat", 9)],
  robots,
  afvalstromen: stromen,
  kalender_2026: [],
  kalender_2027: [],
  adres_onbekend: [],
});

// 10. Adres weg: B = {} letterlijk zoals U0.2, C []
schrijf("adres-weg", {
  adres: [adres("0518200000000000", "Weg", 1)],
  robots,
  afvalstromen: {},
  kalender_2026: [],
  kalender_2027: [],
  adres_onbekend: [],
});

// 11. C(J+1) met alleen kerstbomen (P0-vorm; §18.8.4 stap 3)
schrijf("j1-alleen-kerstbomen", {
  adres: p0.adres,
  robots,
  afvalstromen: p0.afvalstromen,
  kalender_2026: p0.kalender_2026,
  kalender_2027: [
    { ophaaldatum: "2027-01-06", afvalstroom_id: 5 },
    { ophaaldatum: "2027-01-13", afvalstroom_id: 5 },
  ],
  adres_onbekend: [],
});
