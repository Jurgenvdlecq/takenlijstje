# W-03 — Probe P0 van de bron (2026-09-29, 09:5x UTC)

Toestemming Jurgen: "Ja, probeer maar". Uitgevoerd met `net.http_get` vanuit het live Supabase-project (AWS eu-central-1, IPv6), User-Agent `Takenlijstje/1 (prive gezinsapp)`, time-out 20 s, **alleen met het openbare testadres 2591 BB 87** (uit de open-source integraties; geen persoonsgegeven). Na afloop zijn de antwoordrijen (id 4–11) uit `net._http_response` verwijderd. Fixtures (zonder de grote velden `content` en `icon_data`): `fixtures-2591BB-87.json`.

| Verzoek | Resultaat |
| --- | --- |
| `GET https://huisvuilkalender.denhaag.nl/robots.txt` | 200, `User-agent: *` / `Disallow:` (leeg) → geautomatiseerd opvragen niet uitgesloten |
| `GET /` | 200, HTML "Afvalkalender van de gemeente Den Haag" (Laravel, csrf-token) |
| `GET /rest/adressen/2591BB-87` | 200 `application/json`, array met 1 adres: `bagId` (16 cijfers, "0518…"), `postcode`, `huisnummer` (getal), `huisletter`, `huisnummerToevoeging`, `openbareRuimteNaam`, `woonplaatsNaam` ("'s-Gravenhage"), `latitude`, `longitude`, `woonplaatsId`, `gemeenteId` (518) |
| `GET /rest/adressen/2288GH-5` (Rijswijk) | 200, `[]` (onbekend = lege lijst, geen 404) |
| `GET /rest/adressen/<bagId>/afvalstromen` | 200, 5 soorten: 1 GFT (`appel-gft`), 2 PMD (`petfles-blik-drankpak_pmd`), 3 Papier (`doos-karton-papier`), 4 **Rest** (`zak-grijs-rest`), 5 Kerstbomen (`kerstboom-zonder-kruis`); veld `ophaaldatum` = eerstvolgende of `null`. Titels zijn "Rest", "Papier", "PMD" (niet "Restafval"). Groot antwoord (~20 KB) door `content` (HTML) en `icon_data` (base64-SVG) |
| `GET /rest/adressen/<bagId>/kalender/2026` | 200, array `{afvalstroom_id, ophaaldatum:"YYYY-MM-DD"}`; voor dit adres alleen Papier (elke 4 weken, niet tussen 24 nov en 20 jan) en Kerstbomen (7 en 14 jan) |
| `GET /rest/adressen/<bagId>/kalender/2027` | 200, `[]` (volgend jaar nog niet gepubliceerd = lege lijst, geen fout) |
| `GET https://www.denhaag.nl/nl/afval/huisvuil-aanbieden/` | **403** (botbescherming/Akamai "Helaas … Error code", client-IP van het datacenter). De regel 22:00 / 07:45 is daardoor **niet** op de pagina zelf bevestigd |

## Conclusies voor het ontwerp
1. **Koppelcontract bevestigd** (endpoints A, B, C uit r1): paden, veldnamen, datumformaat, lege lijst bij onbekend adres en bij een nog niet gepubliceerd jaar. Geen sleutel, geen redirect.
2. **Herkenning van de bakken op `icon`** is juist; de titel van restafval is "Rest". Onbekende soorten (GFT, Kerstbomen) negeren.
3. **Verzoeken vanuit een datacenter worden door de huisvuilkalender niet geblokkeerd** (Supabase/AWS Frankfurt). Vercel fra1 is niet getest; restrisico blijft (zichtbaar bij U5).
4. **Het testadres heeft geen rest- en PMD-dagen** (vermoedelijk ondergrondse containers). Voor rest/PMD-dagen zijn er dus geen echte voorbeelddata; de parser is voor alle soorten gelijk, de fixtures voor rest/PMD worden synthetisch (zelfde vorm).
5. **Regel 22:00 / 07:45:** alleen uit zoekresultaten; www.denhaag.nl weigert servers. Bevestigen vraagt een blik van Jurgen op de pagina (of de netwerk-allowlist van de ontwikkelomgeving). Tot die tijd blijft de tekst zoals Jurgen besloot (21:00-herinnering met "mag vanaf 22:00 buiten, uiterlijk 07:45").
6. **Veel data in `afvalstromen`** (~20 KB per aanroep door HTML en base64-iconen): bij het parsen alleen `id`, `title`, `menu_title`, `icon`, `ophaaldatum` gebruiken; niets anders bewaren.
