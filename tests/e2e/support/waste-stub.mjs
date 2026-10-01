#!/usr/bin/env node
/**
 * Nagebootste huisvuilkalender voor E2E (TECHNICAL_DESIGN §18.15). Luistert alleen
 * op 127.0.0.1; de app gebruikt hem via WASTE_SOURCE_BASE_URL=http://127.0.0.1:<poort>
 * (de bronmodule accepteert uitsluitend een loopback-adres). SYNTHETISCHE gegevens,
 * datums relatief aan vandaag (Europe/Amsterdam).
 *
 * Testadressen:
 *   2591BB-87  één adres, rest morgen, papier morgen, PMD over 3 dagen
 *   2511AB-12  drie adressen (12, 12A, 12B) → kiezen
 *   2288GH-5   onbekend → []
 *   2500AA-1   bron onbereikbaar → 503
 *   2501AA-1   alleen GFT → geen bakken
 */
import http from "node:http";

const PORT = Number(process.env.WASTE_STUB_PORT ?? 4010);

function day(offset) {
  const d = new Date(Date.now() + offset * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(d);
}

const STREAMS = [
  { id: 1, title: "Restafval", menu_title: "Restafval", icon: "zak-grijs-rest" },
  { id: 2, title: "Papier en karton", menu_title: "Papier", icon: "doos-karton-papier" },
  { id: 3, title: "PMD", menu_title: "PMD", icon: "petfles-blik-drankpak_pmd" },
  { id: 4, title: "GFT", menu_title: "GFT", icon: "appel-gft" },
];

const ADDRESSES = {
  "2591BB-87": [{ bagId: "0518200000999001", huisletter: null, huisnummerToevoeging: null, straatnaam: "Teststraat", huisnummer: 87, woonplaats: "Den Haag" }],
  "2511AB-12": [
    { bagId: "0518200000999012", huisletter: null, huisnummerToevoeging: null, straatnaam: "Proefweg", huisnummer: 12, woonplaats: "Den Haag" },
    { bagId: "0518200000999013", huisletter: "A", huisnummerToevoeging: null, straatnaam: "Proefweg", huisnummer: 12, woonplaats: "Den Haag" },
    { bagId: "0518200000999014", huisletter: "B", huisnummerToevoeging: null, straatnaam: "Proefweg", huisnummer: 12, woonplaats: "Den Haag" },
  ],
  "2288GH-5": [],
  "2501AA-1": [{ bagId: "0518200000999099", huisletter: null, huisnummerToevoeging: null }],
};

function calendar(bagId) {
  if (bagId === "0518200000999099") return [{ afvalstroom_id: 4, ophaaldatum: day(2) }];
  return [
    { afvalstroom_id: 1, ophaaldatum: day(1) },
    { afvalstroom_id: 2, ophaaldatum: day(1) },
    { afvalstroom_id: 3, ophaaldatum: day(3) },
    { afvalstroom_id: 1, ophaaldatum: day(8) },
    { afvalstroom_id: 4, ophaaldatum: day(2) },
  ];
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

http
  .createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? "").split("?")[0]);
    let m;
    if ((m = /^\/rest\/adressen\/(\d{4}[A-Z]{2}-\d+)$/.exec(path))) {
      if (m[1] === "2500AA-1") return json(res, 503, {});
      return m[1] in ADDRESSES ? json(res, 200, ADDRESSES[m[1]]) : json(res, 404, {});
    }
    if ((m = /^\/rest\/adressen\/(\d{16})\/afvalstromen$/.exec(path))) return json(res, 200, STREAMS);
    if ((m = /^\/rest\/adressen\/(\d{16})\/kalender\/(\d{4})$/.exec(path))) {
      const rows = calendar(m[1]).filter((r) => r.ophaaldatum.startsWith(m[2]));
      return json(res, 200, rows);
    }
    json(res, 404, {});
  })
  .listen(PORT, "127.0.0.1", () => console.log(`afval-stub op http://127.0.0.1:${PORT}`));
