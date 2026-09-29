## Technisch ontwerp: W-03 afvalkalender, ronde 5 (verwerking van P0)

Ik heb niets in bestanden geschreven. Hieronder staan alleen de delen van §18 en §15 die veranderen ten opzichte van r4 (`docs/wijzigingen/W-03/solution-architect-r4.md`), plus de lijst met wijzigingen. Alles wat hier niet genoemd wordt, blijft zoals in r4.

Gelezen: `docs/wijzigingen/W-03/probe/P0-uitkomst.md` en `fixtures-2591BB-87.json`.

**Het belangrijkste eerst: P0 dwingt een inhoudelijke correctie af (wijziging 2).**
- **Probleem:** het testadres laat papier zien eens per 4 weken, en helemaal niet tussen 24 november en 20 januari. Met de r4-regel ("geen enkele datum in vandaag…+14 = verdacht leeg") zou zo'n adres bijna elke maand een **onterechte storingsmelding** krijgen. Bij het instellen zou het F2 tonen terwijl er gewoon een datum over drie weken bekend is.
- **Nieuwe regel:** alleen "geen enkele **komende** ophaaldag" is verdacht.
- **Gevolg:** de designer moet vier teksten aanpassen die "twee weken" noemen, en de analist BR-48/BR-52 en AC-204/AC-205/AC-237 (punten voor designer en analist, onderaan).
- Dit raakt geen rechten, privacy, kosten of scope.

---

# Wijzigingen ten opzichte van r4

| # | r4 | r5 | Reden (P0) |
| --- | --- | --- | --- |
| 1 | P0 = draaiboek vóór `/design-go` (P0.0–P0.6) | **P0 uitgevoerd op 2026-09-29**, met uitkomst en fixture. De pagina-regel (22:00/07:45) en de bereikbaarheid vanuit Vercel `fra1` worden **controles vóór de livegang (U0 en U5)**, geen bouwvoorwaarde | P0 gedaan; www.denhaag.nl geeft servers 403 |
| 2 | leeg = geen datum in [vandaag, vandaag+14] (`isWindowEmpty`) | leeg = **geen enkele komende datum** voor rest, papier en PMD samen (`hasNoUpcoming`), bij bijwerken én instellen | 4-wekelijks papier gaf anders structureel vals alarm |
| 3 | januari-terugval: `no_streams` op basis van B | **vervalt**: B noemt altijd alle soorten, ook zonder dagen. Zonder datums in C(J−1) geeft januari `no_upcoming` (F2), niet E | B toont Rest en PMD met `ophaaldatum: null` op een adres zonder die dagen |
| 4 | `NOT_FOUND` alleen bij B = 404 | B 404 **of** 200 met een lege lijst → `NOT_FOUND` / `ADDRESS_GONE` | A geeft voor een onbekend adres 200 `[]`, geen 404; B doet vermoedelijk hetzelfde |
| 5 | A: `huisletter`/`huisnummerToevoeging` nullable; `bagId`-regex een aanname | `""` = geen letter/toevoeging; `bagId` string `^[0-9]{16}$` (met voorloopnul) is definitief, in zod én `CHECK` | vorm van A bevestigd |
| 6 | parser B: `id`, `title`, `menu_title?`, `icon?` | parser B **alleen** `id`, `title`, `menu_title`, `icon`, `ophaaldatum`. De rest (`content`, `icon_data`, `page_title`, `slug`, `tags`, `parent_id`) wordt gestript. A: coördinaten en ids worden gestript | B is ~20 KB door HTML en base64-iconen |
| 7 | `classifyStream`: iconnamen als aanname | tabel uit P0 (5 soorten), trefwoord "rest" dekt titel "Rest" | bevestigd |
| 8 | fixtures pas na P0 | basis = `probe/fixtures-2591BB-87.json`; rest en PMD synthetisch in dezelfde vorm | testadres heeft geen rest- en PMD-dagen |
| 9 | U-stappen P0 → U1 | nieuwe stap **U0** (vóór U4): pagina-regel door Jurgen, plus een optionele korte restcontrole via pg_net; U5 = bereikbaarheid vanuit Vercel | open punten uit P0 |
| 10 | §15 WP3b: "Vóór `/design-go`: P0 …" | "P0 uitgevoerd op 2026-09-29; vóór U4: U0" | — |

---

# Gewijzigde delen van §18

## Kop "Basis": één toevoeging
Na "D-046": "… en de uitkomst van P0 (`docs/wijzigingen/W-03/probe/P0-uitkomst.md`, 2026-09-29)."

## 18.1.1 Endpoints (tabelkop en voetregel)
- Kop: "(platform Opzet, onofficieel en ongedocumenteerd; **bevestigd door P0 op 2026-09-29**)".
- Rij C, kolom "Gebruik": "jaar J altijd; J+1 als het december is (geeft `[]` zolang het jaar niet gepubliceerd is); J−1 alleen bij het instellen in januari, als C(J) geen datum van rest, papier of PMD heeft (§18.8.1)".

## 18.1.3 Resultaattype: vervangt de derde en vierde bullet van "Hoe de foutcodes ontstaan"
- A geeft 200 `[]` → geen kandidaten → `not_found` (P0: onbekend adres geeft `[]`, geen 404).
- B geeft 404, **of** 200 met een lege lijst → `NOT_FOUND` (bij de sync `ADDRESS_GONE`). Bij een bestaand adres geeft B altijd de volledige lijst soorten (P0: vijf, ook zonder datums). Een lege B is dus geen normale toestand.
- C geeft 404 of `[]`, voor welk jaar ook → leeg, en dat is **geen** fout (P0: `/kalender/2027` geeft 200 `[]`). Of dat verdacht is, beslist één regel (§18.8.4).

## 18.1.4 Parser (vervangt de hele subsectie)
Er worden alleen de velden uit de tabel gelezen. Alles daarbuiten wordt door zod gestript (`.strip()`), en wordt nooit bewaard, gelogd of naar de client gestuurd.

| Endpoint | Gelezen velden | Gestript (P0 gezien) |
| --- | --- | --- |
| A | `bagId` (string `^[0-9]{16}$`; komt er een number, dan links aanvullen met nullen tot 16 cijfers, anders weigeren), `huisletter` (string, `""` = geen), `huisnummerToevoeging` (string, `""` = geen). Alleen voor de weergave T-45a: `openbareRuimteNaam`, `huisnummer`, `woonplaatsNaam` | `postcode` (we gebruiken de ingevoerde), `latitude`, `longitude`, `woonplaatsId`, `gemeenteId` |
| B | `id` (number), `title` (string), `menu_title` (string, optioneel), `icon` (string, optioneel), `ophaaldatum` (`YYYY-MM-DD` of `null`; wordt geparsed maar **niet** voor de planning gebruikt) | `content` (HTML), `icon_data` (base64-SVG), `page_title`, `slug`, `tags`, `parent_id` |
| C | `afvalstroom_id` (number), `ophaaldatum` (`YYYY-MM-DD`; `null` → rij overslaan) | — |

- **Grootte:** B is ~20 KB, ruim onder de grens van 1 MB. De streamgrens blijft staan.
- **`classifyStream`** (`src/domain/waste/streams.ts`, puur), tabel uit P0:

  | `icon` | `title` | Bak |
  | --- | --- | --- |
  | `zak-grijs-rest` | Rest | rest |
  | `doos-karton-papier` | Papier | papier |
  | `petfles-blik-drankpak_pmd` | PMD | pmd |
  | `appel-gft` | GFT | `null` (genegeerd, geteld) |
  | `kerstboom-zonder-kruis` | Kerstbomen | `null` (genegeerd, geteld) |

  Een onbekend icon valt terug op een trefwoord in `title` of `menu_title`: `rest`, `papier`, `pmd`/`plastic`, tenzij er `grof`, `gft`, `kerst` of `textiel` in staat. Twee stromen die op dezelfde bak uitkomen, worden samengevoegd.
- **Resultaat:** `WastePickups = { rest; papier; pmd }` als gesorteerde, unieke ISO-datums ≥ vandaag, uit de opgehaalde jaren.

## 18.1.5 Adres kiezen: aanvulling
- De letter en toevoeging van een kandidaat = `(huisletter ?? "") + (huisnummerToevoeging ?? "")`, in hoofdletters. `""` is het adres zonder letter of toevoeging.
- `matchCandidate` vergelijkt die waarde met de genormaliseerde invoer. De rest blijft zoals in r4.

## 18.1.6 Stap P0: vervangt de hele r4-subsectie

#### 18.1.6 P0: probe van de bron, uitgevoerd op 2026-09-29

**Uitvoering:**
- met toestemming van Jurgen ("Ja, probeer maar");
- via `net.http_get` vanuit het live Supabase-project (AWS eu-central-1);
- met User-Agent `Takenlijstje/1 (prive gezinsapp)` en een time-out van 20 s;
- **alleen met het openbare testadres 2591 BB 87**.

De antwoordrijen (id 4–11) zijn daarna uit `net._http_response` verwijderd. P0 wijzigde geen schema, rechten of app-gegevens (L4 volgens D-046).
- Verslag: `docs/wijzigingen/W-03/probe/P0-uitkomst.md`.
- Gegevens: `docs/wijzigingen/W-03/probe/fixtures-2591BB-87.json`.

| Onderdeel | Uitkomst | Gevolg |
| --- | --- | --- |
| `robots.txt` | `User-agent: *` / `Disallow:` (leeg) | geautomatiseerd opvragen niet uitgesloten |
| Datacenter | geen blokkade vanuit Supabase/AWS Frankfurt | datacentertoets gehaald. Vercel `fra1` is niet getest → controle U5 |
| A (adres) | 200 JSON-array; `bagId` "0518200000813196" (string, 16 cijfers); `huisletter`/`huisnummerToevoeging` `""`; ook straat, woonplaats ("'s-Gravenhage"), coördinaten en ids | §18.1.4 en §18.1.5; `CHECK (bag_id ~ '^[0-9]{16}$')` |
| A, onbekend adres | 200 `[]` | `not_found` |
| B (afvalstromen) | 5 soorten (GFT, PMD, Papier, Rest, Kerstbomen), ook zonder datums; ~20 KB | herkennen op `icon`; strippen; B zegt **niet** welke bakken een adres gebruikt |
| C 2026 | 200 `[{afvalstroom_id, ophaaldatum}]`; voor het testadres alleen papier (elke 4 weken, niet 24 nov – 20 jan) en kerstbomen | contract bevestigd; leeg-regel herzien (§18.8.4) |
| C 2027 | 200 `[]` | J+1 is leeg zolang niet gepubliceerd; geen fout |
| www.denhaag.nl | 403 (botbescherming) | 22:00/07:45 niet op de pagina bevestigd → controle U0.1 |

**Fixtures (U1):**
- `fixtures-2591BB-87.json` gaat ongewijzigd naar `src/server/waste/__tests__/fixtures/p0-2591BB-87.json`, met een `README.md` (herkomst, 2026-09-29, openbaar testadres, `content`/`icon_data` weggelaten).
- De test-helper splitst het per endpoint.
- Synthetische fixtures `synthetisch-*.json` krijgen **exact dezelfde vorm**:
  - B **met** `content` en `icon_data` van ± 20 KB, om het strippen en de grootte te toetsen;
  - een adres met rest (wekelijks), papier (4-wekelijks) en PMD (2-wekelijks);
  - alleen GFT;
  - meerdere kandidaten (`huisletter` "A"/"B");
  - december zonder J+1;
  - januari met een lege C(J);
  - verschuiving;
  - leeg (C `[]`);
  - adres weg (B `[]`).
- Alleen voor rest en PMD bestaan geen echte voorbeelddata. De parser is voor alle soorten gelijk.

**Wat van P0 rest, als controle vóór de livegang (geen bouwvoorwaarde):**
- **U0.1 Gemeenteregel.** Jurgen bekijkt één keer `https://www.denhaag.nl/nl/afval/huisvuil-aanbieden/` (de site weigert servers). Tot dan geldt het besluit V-49 (22:00/07:45). Een afwijking is een wijzigingsverzoek (§18.1.7).
- **U0.2 (optioneel; 3 verzoeken via pg_net, dezelfde werkwijze en hetzelfde testadres, daarna opruimen op id):**
  - (a) `/kalender/2025`: bestaat C(J−1)?
  - (b) `/rest/adressen/0000000000000000/afvalstromen`: wat geeft B bij een onbekende `bagId`?
  - (c) de responstijd per verzoek (`created` min het tijdstip van versturen).

  Zonder U0.2 gelden de veilige standaardregels in §18.1.3 en §18.8.1. De responstijd wordt dan na U5 gemeten via `fetchMs` (alleen een getal) in de tick-log.
- **U5 Bereikbaarheid vanuit Vercel `fra1`.** pg_net en Vercel gebruiken niet dezelfde IP-adressen. De eerste echte opzoeking (Jurgens rooktest) is de controle. Een blokkade is een stoppunt (§18.1.7).

## 18.1.7 Beslisregel: kop en twee rijen
- Kop: "Beslisregel voor de uitkomsten van U0 en U5 (P0 is afgerond; al zijn uitkomsten waren uitvoeringskeuzes, en zijn verwerkt in §18.1.3–§18.1.5, §18.3.1 en §18.8)". Na de freeze is de rechterkolom een wijzigingsverzoek.
- De rij "C(J−1) geeft geen datums" wordt: "C(J−1) geeft `[]` of 404 (U0.2 a) → de januari-standaardregel uit §18.8.1 stap 5 blijft gelden (uitvoeringskeuze)".
- De rij "B bij een onbekende `bagId`" (nieuw, links): "B geeft 200 met soorten voor een onbekende `bagId` (U0.2 b) → `ADDRESS_GONE` alleen via 'A geeft `[]` voor het bewaarde postcode-nummer', één extra verzoek, alleen na `SUSPECT_EMPTY`".
- De rij "gemeenteregel niet te bevestigen" vervalt: het besluit V-49 geldt, en U0.1 is de controle.

## 18.2 Modules: één regel
`plan.ts`: `isWindowEmpty` → **`hasNoUpcoming`**.

## 18.3.1 `waste_calendars`: één regel
`bag_id`: `text not null check (bag_id ~ '^[0-9]{16}$')` (P0).

## 18.8.1 Opzoeken bij het instellen: vervangt stap 3 en stap 5
3. Uitkomst, in deze volgorde:
   - `UNREACHABLE`, `FORMAT` of `NOT_FOUND` van B of een C-verzoek → `unreachable`;
   - `hadAnyDate = false` → buiten januari `no_streams` (E). **In januari** `no_upcoming` (F2), als C(J−1) niet is opgehaald of `[]` gaf. In januari is "de nieuwe kalender staat nog niet online" veel waarschijnlijker, en F2 bewaart ook niets;
   - `hasNoUpcoming(pickups)` (§18.8.4) → `no_upcoming` (F2);
   - anders `found`. Dat geldt ook als de eerstvolgende datum verder dan 14 dagen weg ligt; dan ontstaan er nog geen taken.
5. B is **geen** bron voor `no_streams`: B noemt altijd alle soorten, ook als het adres er geen dagen voor heeft (P0). De r4-terugval op B vervalt.

## 18.8.4 Eén regel voor "geen komende ophaaldagen": vervangt de hele subsectie

- **`hasNoUpcoming(pickups)`** = de bron geeft voor rest, papier en PMD **samen geen enkele komende ophaaldag** (vandaag of later) in de opgehaalde jaren (J, en J+1 in december). Dit wordt bepaald op de net opgehaalde datums.
- **Tijdens het bijwerken:** geen komende dag → `p_result = 'failure'`, code `SUSPECT_EMPTY`. De bewaarde datums, de taken en het adres blijven ongewijzigd, en de planning draait door op de bewaarde datums.
- **Bij het instellen:** geen komende dag → `no_upcoming` (F2), en er wordt niets bewaard.
- **Waarom niet "geen datum in de komende 14 dagen" (r4):** P0 laat zien dat papier eens per 4 weken komt, met een pauze van bijna 2 maanden rond de jaarwisseling. Het venster van 14 dagen gaf dan bij adressen met weinig ophalingen elke maand een onterechte storing. Een datum verder dan 14 dagen weg is normaal; de taken verschijnen dan pas 14 dagen vooraf (V-52).
- **Jaarwisseling:**
  - ná de laatste decemberdatum is C(J) zonder komende datums en C(J+1) nog `[]` → `SUSPECT_EMPTY`;
  - op 1 januari is C(J) `[]` → `SUSPECT_EMPTY`.
  In beide gevallen volgt na een uur H2 met T-77a. De stille regel T-73 (G″) waarschuwt eerder, zolang er nog decemberdatums zijn.
- **Eén bak zonder dagen** is geen storing.
- **Bewuste grens:** een afgekapte, maar niet lege lijst van de bron is niet te herkennen. De taken volgen dan de bron.

## 18.8.5 Gezondheid: één zin
In de tabelregel "`failed`, reden `empty`": "… minstens twee **vastgelegde** antwoorden zonder komende ophaaldag achter elkaar …". De rest van r4 (`last_failure_at`, `alarm_since`, `wasteFailureVariant`, "stil gelegen") blijft ongewijzigd.

## 18.12 Privacy: één aanvulling
"**Nooit bewaard of doorgegeven** (P0): de coördinaten (`latitude`/`longitude`), `woonplaatsId` en `gemeenteId` uit A. zod stript ze vóór elk ander gebruik."

## 18.15 Tests: gewijzigde rijen (de overige rijen zoals in r4)

| AC | Unit | DB | Int | E2E |
| --- | --- | --- | --- | --- |
| 185 | `matchCandidate` → `not_found`; A `[]` (P0-fixture `adres_onbekend`) → `not_found` | — | bestaand adres ongewijzigd | D, T-60 |
| 186 | alleen GFT → `no_streams`; oktober zonder enkele datum → `no_streams`; **januari**, lege C(J) en geen C(J−1)-datums → `no_upcoming` | — | niets bewaard | E, T-62 |
| 187 | `huisletter`/`huisnummerToevoeging` `""` = geen; `choose` bij "A"/"B"; `suffix ""` | — | via de action | C2 |
| 196 | `classifyStream` op de P0-fixture: 5 soorten → rest/papier/pmd + 2× `null` | — | — | — |
| 204 | `hasNoUpcoming`: alle drie leeg = ja; **alleen papier met een datum over 25 dagen = nee**; 1 januari met een lege C(J) = ja; na de laatste decemberdatum met J+1 `[]` = ja; B `[]` → `ADDRESS_GONE` | als r4 | als r4, plus **regressie: de P0-fixture (alleen papier) door twee ticks op 2026-10-05 (volgende dag 27-10) → geen `SUSPECT_EMPTY`, geen melding** | als r4 |
| 218 | als r4, plus: zod stript lat/lon/ids uit A en `content`/`icon_data` uit B; een synthetische B van ~20 KB wordt geparsed | — | als r4 | — |
| 237 | `lookupWasteCalendar`: geen komende datum → `no_upcoming`; **alleen papier over 25 dagen → `found`** (eerstvolgende datum, 0 taken); 2 januari, lege C(J), C(J−1) met datums → `no_upcoming`; idem zonder C(J−1)-datums → `no_upcoming` | — | als r4 | als r4 |

## 18.16 Uitrol: vervangt de rijen P0 en U5, en voegt U0 toe

| # | Stap | Controle |
| --- | --- | --- |
| **P0** | Probe van de bron: **uitgevoerd op 2026-09-29** (§18.1.6) | verslag en fixture in `docs/wijzigingen/W-03/probe/`; antwoordrijen verwijderd |
| **U0** | Vóór U4: **U0.1** gemeenteregel 22:00/07:45 op de pagina zelf (Jurgen); **U0.2** optioneel (C(J−1), B bij een onbekende `bagId`, responstijden), als dat niet al vóór de freeze gedaan is | uitkomst in PROGRESS; een afwijking volgens §18.1.7 |
| U1 | als r4; fixtures op basis van `p0-2591BB-87.json` | alles groen |
| U5 | als r4. **Bereikbaarheid vanuit Vercel `fra1`** is hier de controle (eerste echte opzoeking); `fetchMs` uit de tick-log noteren | akkoord in PROGRESS |

## 18.17 r4 → r5: nieuwe tabel onder r3 → r4
Gelijk aan de tabel "Wijzigingen ten opzichte van r4" bovenaan dit rapport.

## 18.18 Versimpeltoets: twee rijen erbij, één vervangen
- **Leeg-regel:** een venster van 14 dagen of "geen komende dag" → **"geen komende dag"**. Eenvoudiger (drie lege lijsten) en zonder vals alarm bij 4-wekelijks papier (P0).
- **`no_streams` via B:** **nee**. B noemt ook soorten zonder dagen (P0).
- De r4-rij "`no_streams` in januari" wordt: "C(J−1) alleen bij instellen in januari met een lege C(J); zonder datums daarin F2 in plaats van E. Geen terugval op B".

---

# Gewijzigde delen van §15 (WP3b-rij; WP4–WP9 zoals in r4)

- **Kolom "Doel en inhoud":** de openingszin "Vóór `/design-go`: P0 (§18.1.6): draaiboek P0.0–P0.6 …" wordt:
  > "**P0 uitgevoerd op 2026-09-29** (§18.1.6; fixture `docs/wijzigingen/W-03/probe/fixtures-2591BB-87.json`: contract A/B/C bevestigd, onbekend adres en een ongepubliceerd jaar = `[]`, geen datacenterblokkade). **Vóór U4: U0** (gemeenteregel 22:00/07:45 bevestigen; optioneel C(J−1), B bij een onbekende `bagId`, responstijden). **Bij U5:** bereikbaarheid vanuit Vercel `fra1`."
- In dezelfde kolom: `isWindowEmpty` → `hasNoUpcoming`. En "januari-C(J−1)" → "januari-C(J−1), zonder datums F2".
- **Kolom "Afhankelijk":** "P0 afgerond (of een expliciete keuze van Jurgen …)" → "WP3 live; P0 afgerond (2026-09-29)".
- **Kolom "Reviews", security:** erbij "strippen van coördinaten en ids uit A".

---

# Punten voor designer en analist (nieuw door P0; te bundelen door de hoofdsessie)

1. **Designer: teksten die "twee weken" noemen voor `SUSPECT_EMPTY` en `no_upcoming`** kloppen niet meer met §18.8.4. Voorstellen, de designer beslist:
   - T-77: "Geen komende ophaaldagen meer bekend";
   - T-77a/T-77b: "De gemeente geeft geen enkele komende ophaaldag meer. …";
   - M-04: "De gemeente geeft geen komende ophaaldagen meer. …";
   - T-64: laat "voor de komende weken" vallen.
2. **Designer, T-45a:** de bron geeft woonplaats "'s-Gravenhage". Voorstel: altijd "Den Haag" tonen (alle adressen komen uit gemeente 518). Het gaat alleen om de weergave; er wordt niets bewaard.
3. **Designer, T-90 bij 0 taken:** een adres waarvan de eerstvolgende dag verder dan 14 dagen weg ligt, heeft na aanzetten 0 taken. Voorstel: dan "Afvalkalender staat aan · taken verschijnen 14 dagen vooraf". De server geeft `inserted` al terug.
4. **Analist:**
   - BR-48 ("… in de komende 14 dagen" → "minstens één **komende** ophaaldag");
   - BR-52 en AC-204 (b) ("geen enkele komende ophaaldag"; "alleen datums ná de 14 dagen" wordt een tegenvoorbeeld onder "Geen storing zijn", bijvoorbeeld papier eens per 4 weken);
   - AC-205 (b), idem;
   - AC-237 (GEGEVEN "geen enkele komende ophaaldag"; extra: "ligt de eerstvolgende dag over 3 weken, dan wordt het adres gewoon bewaard"; januari zonder datums van het vorige jaar geeft ook F2).
5. **Hoofdsessie:** in PROGRESS P0 als afgerond vastleggen, en U0.1 als open controle vóór U4. U0.2 kan nog vóór de freeze met dezelfde werkwijze (3 verzoeken, testadres). Dan vervallen de standaardregels voor januari en `ADDRESS_GONE` als onzekerheid.

### Vragen voor Jurgen
- **U0.1 (geen beleidsvraag, wel een handeling; mag na de freeze, vóór de livegang):** "Wil je één keer op https://www.denhaag.nl/nl/afval/huisvuil-aanbieden/ kijken of de minicontainer vanaf 22:00 buiten mag en om 07:45 buiten moet staan? De site laat onze server niet binnen."
- Verder geen vragen. Voor het totaalvoorstel, in gewone taal: "Een melding over een lege kalender komt alleen als de gemeente helemaal geen komende ophaaldag meer geeft, niet als de volgende papierdag toevallig over drie weken is."

### Bewuste vereenvoudigingen
- De leeg-regel is nu drie lege lijsten in plaats van een venstertoets.
- Geen terugval op B voor `no_streams`.
- Fixtures: één echt bestand plus synthetische bestanden in dezelfde vorm, zonder nieuwe probe.

### Status
**KLAAR VOOR PLANREVIEW** voor de architect: r4 plus deze r5. Voorwaarden voor de volgende critic-ronde:
- de designer verwerkt r4-D1–D4 en de punten 1–3 hierboven;
- de analist verwerkt r4-D5 en punt 4 hierboven;
- de visual-designer-r2 (moet 3).

P0 is geen open punt meer. U0.1 en de bereikbaarheid vanuit Vercel zijn controles vóór de livegang.

Relevante bestanden:
- /home/user/takenlijstje/docs/wijzigingen/W-03/probe/P0-uitkomst.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/probe/fixtures-2591BB-87.json
- /home/user/takenlijstje/docs/wijzigingen/W-03/solution-architect-r4.md
- /home/user/takenlijstje/docs/DECISIONS.md (D-046)
