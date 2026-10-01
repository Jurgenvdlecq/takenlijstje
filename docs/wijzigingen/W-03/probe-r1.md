## Fixture-probe W-03: huisvuilkalender Den Haag, ronde 1 (2026-10-01)

Uitgevoerd volgens het technisch ontwerp r2 (§18.1.6, route a: netwerk-allowlist van de ontwikkelomgeving, V-57). AAE-taak `W03-AFVAL-001`, commando `node scripts/waste-probe.mjs` (curl, alleen GET, geen redirects, max 1 MB en 20 s per verzoek). Adres: het **openbare testadres 2591 BB 87** uit de HACS-integratie (Zwedenburg 87); geen persoonsgegeven. Ruwe antwoorden en headers staan in `docs/wijzigingen/W-03/probe/` (de sessiecookies in de headerbestanden zijn weggelaten).

### 1. Verzoeken en antwoorden

| # | Verzoek | Status | Content-Type | Duur | Grootte |
| --- | --- | --- | --- | --- | --- |
| R | `GET /robots.txt` | 200 | `text/plain` | 0,76 s | 24 B |
| A | `GET /rest/adressen/2591BB-87` | 200 | `application/json` | 0,78 s | 254 B |
| B | `GET /rest/adressen/0518200000813196/afvalstromen` | 200 | `application/json` | 0,64 s | 20 268 B |
| C | `GET /rest/adressen/0518200000813196/kalender/2026` | 200 | `application/json` | 0,56 s | 577 B |
| C′ | `GET /rest/adressen/0518200000813196/kalender/2027` | 200 | `application/json` | 0,59 s | 2 B (`[]`) |

Duur gemeten via de proxy van de ontwikkelomgeving. Geen redirects. Alle JSON-antwoorden: `Cache-Control: no-cache, private`, `Access-Control-Allow-Origin: *`, `Transfer-Encoding: chunked` (geen `Content-Length`, dus de streamgrens van 1 MB uit §18.1.2 is nodig), en twee sessiecookies (`XSRF-TOKEN`, `zwaste_session`, 2 uur geldig). Geen rate-limit-headers gezien.

### 2. Aannames uit r2 §18.1, per punt

| Punt | Aanname r2 | Waargenomen | Gevolg |
| --- | --- | --- | --- |
| A: vorm | JSON-array, `[]` bij onbekend | JSON-array met 1 element | bevestigd (onbekend adres niet geprobeerd, zie §4) |
| A: `bagId` | string of number, `^[0-9]{16}$`, begint met 0518 | `"0518200000813196"`, string, 16 cijfers | **bevestigd**, regex blijft |
| A: letter/toevoeging | `huisletter`, `huisnummerToevoeging`, nullable string | beide aanwezig, **lege string** `""` (niet `null`) | zod: `string().nullable().optional()`; `""` en `null` als "geen" behandelen |
| A: straat/plaats voor "Klopt dit?" | `straatnaam\|straat`, `woonplaats\|plaats` | **`openbareRuimteNaam`** ("Zwedenburg"), **`woonplaatsNaam`** ("'s-Gravenhage") | veldnamen in §18.1.4 en §18.8.1 aanpassen |
| A: overige velden | "vermoedelijk straat en plaats" | ook `postcode` ("2591BB", zonder spatie), `huisnummer` (number), `latitude`, `longitude`, `woonplaatsId`, `gemeenteId` (518) | coördinaten nooit bewaren of loggen (BR-58, stond al); zod stript ze |
| B: velden | `id`, `title`, `menu_title?`, `icon?` | `id` (number), `parent_id`, `title`, `slug`, `tags`, `page_title`, `content` (HTML), `menu_title`, `icon`, `icon_data` (SVG), `ophaaldatum` | bevestigd; `content` en `icon_data` maken B 20 KB, zod stript |
| B: icons | `zak-grijs-rest`, `doos-karton-papier`, `petfles-blik-drankpak_pmd`, `appel-gft` | **exact zo**, plus `kerstboom-zonder-kruis` (Kerstbomen) | herkenning op icon blijft primair |
| B: titels | onbekend; terugval op trefwoord | `GFT`, `PMD`, `Papier`, **`Rest`** (niet "Restafval"), `Kerstbomen` | terugval `rest` werkt; `kerst` wordt genegeerd (icon is toch onbekend) |
| B: `ophaaldatum` | eerstvolgende datum per soort | alleen Papier `2026-10-27`, de rest `null`; klopt met C | B alleen voor de vertaling id → bak, planning uit C (zoals ontworpen) |
| B: id's | voorbeeld 55–58 | **1 t/m 5** | alleen het synthetische voorbeeld aanpassen |
| C: velden | `afvalstroom_id`, `ophaaldatum` `YYYY-MM-DD`, `null` mogelijk | precies die twee sleutels; `afvalstroom_id` number; 12 datums, geen `null` | bevestigd; `null`-afhandeling blijft als vangnet |
| C: bereik | heel jaar | 2026-01-20 t/m 2026-11-24, ook verleden datums | filter "≥ vandaag" nodig (stond al) |
| C(J+1) | `[]` of 404, geen fout | **200 met `[]`** | bevestigd; 404-pad blijft als vangnet |
| Content-type | bevat `application/json` | exact `application/json` | bevestigd |
| Responstijd | < 1 s normaal | 0,56–0,78 s via de proxy | 8 s per verzoek en 12 s totaal zijn ruim |
| robots.txt | onbekend | `User-agent: *` / `Disallow:` (leeg = alles toegestaan; sinds 2021-12-09) | **geen uitsluiting van `/rest/`**; stopregel niet van toepassing |
| Gebruiksvoorwaarden | onbekend | de startpagina is een JavaScript-app zonder leesbare tekst; geen voorwaardenpagina aangetroffen; `www.denhaag.nl` is vanuit de ontwikkelomgeving geblokkeerd | niets gevonden dat geautomatiseerd gebruik verbiedt; de regels 22:00/07:45 (BR-49) worden bij de rooktest op de gemeentepagina nagelezen (stond al, AC-217) |

### 3. Nieuwe bevinding voor het ontwerp: de leeg-antwoordbewaking (§18.8.4, BR-52)

Het testadres heeft **alleen papier, eens per 4 weken** (B zegt letterlijk: "Papier en karton wordt elke 4 weken huis-aan-huis opgehaald"). Restafval en PMD hebben voor dit adres geen ophaaldagen (vermoedelijk ondergrondse containers). Op 2026-10-01 is de eerstvolgende datum 2026-10-27.

Met de vereenvoudigde regel uit r2 ("alle drie de bakken samen geen datum in [vandaag, vandaag + 14] = storing") zou dit gezonde adres op de meeste dagen `SUSPECT_EMPTY` krijgen en na twee pogingen een onterechte storingsmelding geven. De redenering "er waren eerder ophaaldagen in dat bereik bekend is structureel waar" klopt dus niet voor adressen met een laag ophaalritme. Voor Jurgens adres (drie containers, restafval en PMD om de week of vaker) treedt dit vrijwel zeker niet op, maar de regel hoort BR-52 letterlijk te volgen:

> storing = het nieuwe antwoord heeft geen enkele datum in [vandaag, vandaag + 14] **én** de eerder bewaarde `pickups` hadden wél minstens één datum in dat bereik.

Dat is één extra vergelijking met de bewaarde `pickups` (die zijn er al). Aandachtspunt voor de plan-critic en de architect; AC-204 en de unittest van `isSuspectEmpty` volgen mee. In de tests moet "vandaag" voor deze fixture vast staan (bijvoorbeeld 2026-10-20), anders is de fixture nooit "gezond".

### 4. Niet getest (één vast adres)

- A voor een onbekend adres of buiten Den Haag (ontwerp verwacht `[]`), A met meerdere kandidaten (letters/toevoegingen), B met een onbekend `bagId` (ontwerp verwacht 404). Daarvoor blijven synthetische fixtures nodig (AC-185, AC-187, `ADDRESS_GONE`). Een tweede mini-probe met een adres met toevoegingen is mogelijk als de bouwer dat nodig vindt; dan opnieuw via een route met GO.
- Restafval en PMD komen in deze echte fixture niet voor; de taaknamen met drie bakken en de herinneringstekst worden met synthetische fixtures getest, en live bij de rooktest (AC-217).
- Gedrag bij 5xx, 429 of time-outs van de bron.

### 5. Wat dit betekent voor de volgende stappen

1. Architect: §18.1.4 (veldnamen A), §18.8.1 (weergave "Klopt dit?": `openbareRuimteNaam` + huisnummer + letter/toevoeging, `woonplaatsNaam`) en §18.8.4 (BR-52 letterlijk) aanpassen; U0 is voor de fixtures gehaald.
2. Product-designer: bevestigen hoe de plaats getoond wordt. De gemeente geeft "'s-Gravenhage"; voorstel: letterlijk tonen zoals de gemeente het teruggeeft (UX §13.7.1 zegt dat al), dus "Zwedenburg 87, 's-Gravenhage".
3. Bij het bouwen: de bestanden uit `probe/` zijn de echte fixtures voor `src/server/waste/__tests__/fixtures/` (A, B, C 2026, C 2027); synthetische fixtures alleen voor de gevallen uit §4, duidelijk als synthetisch gemarkeerd.
4. Daarna: plan-critic op r2 + deze probe, totaalvoorstel, `/design-go` voor W-03, bouwen als WP3b.
