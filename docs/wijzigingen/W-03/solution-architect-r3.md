## Technisch ontwerp: W-03 afvalkalender, ronde 3 (verwerking van de probe, D-046)

**Herkomst van deze tekst.** De `aae-solution-architect` heeft deze ronde twee keer uitgevoerd (2026-10-01, 11:56 en 13:41 UTC, beide `STATUS: READY`), maar het volledige rapport is beide keren niet in de hoofdsessie aangekomen; de AAE-administratie bewaart alleen het slot van elk rapport. De hoofdsessie heeft ronde 3 daarom **gereconstrueerd** uit (a) de bewaarde slotdelen van beide rapporten (R3-6 t/m R3-8, de bijvangst en de "fout of voorkeur"-afweging zijn daaruit letterlijk overgenomen), (b) `probe-r1.md` en D-046, en (c) de opdracht aan de architect. Jurgen heeft hiervoor gekozen (`AAE GO` na uitleg). De plan-critic beoordeelt r2 + r3 samen; een gemiste nuance komt daar boven water.

Alles hieronder is de **delta ten opzichte van `solution-architect-r2.md`**; wat niet genoemd wordt, blijft zoals in r2 (zie R3-8).

---

### R3-1. §18.1.4 Parser (zod) — vervangende tekst voor het blok "Alleen verplicht wat we gebruiken"

- **A (adres), per rij:**
  - `bagId`: string of number → string, daarna `^[0-9]{16}$` (bevestigd: `"0518200000813196"`).
  - `huisnummer`: number (bevestigd) of string → geheel getal; alleen voor de weergave.
  - `huisletter`, `huisnummerToevoeging`: `z.string().nullable().optional()`. De bron geeft **lege strings** (`""`), geen `null`; `""`, `null` en ontbrekend betekenen alle drie "geen".
  - `openbareRuimteNaam` (straat) en `woonplaatsNaam` (plaats): `z.string().nullable().optional()`; alleen voor "Klopt dit?", **nooit** bewaard of gelogd.
  - Alle andere velden (`postcode`, `latitude`, `longitude`, `woonplaatsId`, `gemeenteId`) worden door `z.object` gestript. Coördinaten komen dus nooit verder dan de parser (BR-58).
- **B (afvalstromen), per rij:** `id` (number of string → string), `title` (string), `menu_title` en `icon` (`string().nullable().optional()`). `content`, `icon_data`, `slug`, `tags`, `page_title`, `parent_id`, `ophaaldatum` worden gestript. B is ± 20 KB door `icon_data` en `content`; de grens van 1 MB blijft ruim.
- **C (kalender), per rij:** `afvalstroom_id` (number of string → string, zodat hij altijd met `id` uit B vergelijkt), `ophaaldatum` (`^\d{4}-\d{2}-\d{2}$` of `null` → rij overslaan). Bevestigd: precies deze twee sleutels, het hele jaar inclusief verleden datums.
- **Zod-fouten nooit loggen** (`error.issues` kan invoerwaarden bevatten); alleen `[waste] FORMAT endpoint=A|B|C`.

### R3-2. §18.1.5 Sleutel van een kandidaat — aanvulling

- `normalize(x) = (x ?? "").toUpperCase().replace(/[\s-]/g, "")`; sleutel = `normalize(huisletter) + normalize(huisnummerToevoeging)`. Voor het adres zonder letter of toevoeging is de sleutel `""`; `suffix === ""` (keuze "12" in C2) matcht die sleutel. Bevestigd met de echte A-fixture (beide velden `""`).
- **Label in C2** (correctie, uit het architectrapport): `huisnummer + huisletter + (toevoeging ? "-" + toevoeging : "")`, dus "12", "12A", "12-2". Zonder het streepje zou "12" met toevoeging "2" als "122" verschijnen. De sleutel blijft zonder streepje.
- **Bijvangst (architect):** `house_suffix` heeft in §18.3.1 de check `^[A-Z0-9]{0,4}$`, maar letter plus toevoeging kan samen 5 tekens zijn (bijv. "A" + "BIS"); opslaan mislukt dan. Voorstel: `{0,6}` in de CHECK én in `normalizeWasteAddress`. Besluit bij de plan-critic.

### R3-3. §18.8.1 stap 4 — weergave "Klopt dit?" (vervangende tekst)

`display` = `openbareRuimteNaam` + " " + huisnummer + letter + ("-" + toevoeging als aanwezig) + ", " + `woonplaatsNaam`, letterlijk zoals de gemeente het geeft: voor het testadres "Zwedenburg 87, 's-Gravenhage". UX §13.7.1 zegt "zoals de gemeente het kent", dus geen omzetting van "'s-Gravenhage" naar "Den Haag". Ontbreekt de straat, dan "2591 BB 87, 's-Gravenhage"; ontbreekt ook de plaats, dan alleen postcode en nummer. `display` staat alleen in het antwoord aan de beheerder en wordt nooit bewaard of gelogd.

### R3-4. §18.8.4 Leeg-antwoordbewaking (vervangende tekst) en gevolgen

**Waarom:** het testadres heeft alleen papier, eens per 4 weken (ophaaldagen 2026-09-29, 10-27, 11-24). Met de r2-regel ("alle drie samen geen datum in [vandaag, vandaag + 14]") zou dit gezonde adres op de meeste dagen `SUSPECT_EMPTY` krijgen en na twee pogingen een onterechte melding. De redenering "er waren eerder ophaaldagen in dat bereik bekend is structureel waar" klopt niet voor een laag ophaalritme (D-046).

**Regel 1 (BR-52 letterlijk, D-046):** `isSuspectEmpty(fetched, stored, today)` is `true` als het nieuwe antwoord geen enkele datum van rest, papier of PMD in [vandaag, vandaag + 14] heeft **én** de eerder bewaarde `pickups` wél minstens één datum in dat bereik hadden. Eén bak zonder dagen blijft normaal verwerken.

**Regel 2 (voorstel architect, nog geen besluit):** ook `true` als het nieuwe antwoord in alle opgehaalde jaren **geen enkele datum ≥ vandaag** heeft. Dat vangt het voorbeeld uit BR-52 (jaarwisseling: de kalender van J+1 staat nog niet online en die van J is "op"), want regel 1 herkent die niet: de bewaarde `pickups` bevatten alleen datums vanaf de vorige opvraging en zijn aan het jaareinde meestal ook leeg. Nadeel: een adres waarvan de kalender vroeg stopt (het testadres na 24-11) krijgt dan een storingsmelding "kijk zelf op de site", terwijl er niets kapot is. De architect noemt het ontbreken van regel 2 een fout ten opzichte van het BR-52-voorbeeld; de hoofdsessie ziet een productafweging. **Zonder besluit geldt alleen regel 1 (D-046).** De plan-critic beoordeelt; zo nodig naar Jurgen.

**Gevolgen:**
- `fetchPickups` (§18.1.3) geeft ook `hadAnyFuture: boolean` terug, zodat regel 2 zonder extra opvraging kan.
- `wasteSyncHealth` (§18.8.5): tabel ongewijzigd; `failed (empty)` blijft `SUSPECT_EMPTY` met `failure_count ≥ 2`.
- AC-204 (analist): de zin "terwijl er eerder ophaaldagen in dat bereik bekend waren" is nu de letterlijke voorwaarde; AC-205 ongewijzigd.
- §18.15 rij 204 (unit): `isSuspectEmpty` = `true` bij (nieuw leeg in venster, bewaard wél datum in venster); `false` bij (nieuw leeg, bewaard ook leeg in venster); `false` bij (alleen papier leeg, rest of PMD wel); de **echte fixture** met vaste `today = 2026-10-20` is gezond (10-27 valt in het venster) en met `today = 2026-10-01` **ook** gezond onder regel 1 (bewaard had niets in het venster). Rij 205: ongewijzigd. Rij 186: `no_streams` blijft een **synthetische** fixture (alleen GFT); de echte fixture is `found` met alleen papier en test "één bak zonder dagen is geen storing".
- Alle tests met de echte fixture gebruiken een vaste klok; `dueForFetch` en de tick krijgen `now` al als parameter (rij 203).

### R3-5. §18.1.6 Fixtures (vervangende tekst)

- **Echt (uit de probe, 2026-10-01, openbaar testadres 2591 BB 87):** `probe/A-adressen.json`, `probe/B-afvalstromen.json`, `probe/C-kalender-2026.json`, `probe/C-kalender-2027.json` (`[]`). Bij het bouwen worden ze **gekopieerd** naar `src/server/waste/__tests__/fixtures/real/` met dezelfde namen en een `README.md` met herkomst, datum en de vaste testdatum; de originelen in `docs/wijzigingen/W-03/probe/` blijven het bewijs. `robots.txt` en de headers zijn documentatie, geen fixture.
- **Synthetisch (bestandsnaam begint met `synthetic-`, kop met `"_synthetic": true`):** A onbekend adres `[]`; A met drie kandidaten (12, 12A, 12-2); B met status 404 (`ADDRESS_GONE`); B alleen GFT (`no_streams`); een adres met rest (wekelijks), papier (4-wekelijks) en PMD (2-wekelijks) voor de naam-, herinnerings- en planningstests, inclusief een dag met drie bakken en een feestdagverschuiving; C voor J+1 met datums (december-geval). Fouten (5xx, 429, time-out, kapotte JSON, te groot, redirect) komen uit de geïnjecteerde `deps.fetch`, niet uit bestanden.
- De voorwaarde U0 (§18.16) is voor de fixtures gehaald; de rooktest op live (AC-217) blijft zoals in r2.

### R3-6. r2-punt 2 afgesloten: correctie voor de analist-tekst (`product-analyst-r2.md`)

- r. 495 (AC-193): `- staat "Restafvalbak binnenzetten" gepland op dinsdag 6 oktober;`
- r. 521 (AC-195): `- is er één taak "Restafval en papier buitenzetten" (maandag 21:00) en één taak "Restafval- en papierbak binnenzetten" (dinsdag);`
- Ook nodig (zelfde punt, BR-49, r. 132): in plaats van "Restafval, papier en PMD binnenzetten" komt "Restafval-, papier- en PMD-bak binnenzetten".

### R3-7. r2-punt 3 afgesloten: teksten definitief

- `no_upcoming`: "De gemeente heeft de ophaaldagen voor de komende weken nog niet online gezet. Er is niets opgeslagen. Probeer het later opnieuw." Klopt ook voor het testadres eind november en voor nul kalenderrijen.
- `too_soon`: "Net geprobeerd. Probeer het over een minuut opnieuw." "Over een minuut" past bij de wachttijd van 60 s.
- Geen bezwaar van de architect.

### R3-8. Wat ongewijzigd blijft of vervalt

- **Ongewijzigd:** §18.1.1 en §18.1.2 inhoudelijk, §18.1.3 behalve de `fetchPickups`-regel, §18.2 t/m §18.7, §18.8.2, §18.8.3, de tabel in §18.8.5, §18.8.6, §18.9 t/m §18.14, §18.15 behalve de rijen 186, 204 en 205, §18.16 t/m §18.18, blok (B) op één regel na, blok (C), de bewuste vereenvoudigingen en de r2-punten 4, 6 en 7.
- **Redactioneel in §18.1.1/§18.1.2:** "(+ vermoedelijk straat en plaats)" wordt "`openbareRuimteNaam`, `woonplaatsNaam`"; "bij de probe bevestigen" wordt "bevestigd (D-046)"; responstijd 0,56–0,78 s, dus 8 s per verzoek en 12 s totaal blijven.
- **Blok (B):** "**Eerst de fixture-probe** (…stoppen en naar Jurgen)" wordt "**Fixture-probe gedaan** (D-046; fixtures volgens §18.1.6)".
- **Vervalt:** r2-punt 1 (de probe is gedaan via route a) en de voorwaardelijke Jurgen-vraag over robots.txt en voorwaarden (niets gevonden dat geautomatiseerd gebruik verbiedt).
- **Status r2 wordt:** "KLAAR VOOR PLANREVIEW; U0 voor fixtures gehaald; punten 2 en 3 afgesloten; voor de plan-critic staan open: regel 2 (R3-4) en de breedte van `house_suffix` (R3-2)."

---

**Fout of voorkeur (architect):** het ontbreken van regel 2 is een fout ten opzichte van het BR-52-voorbeeld; het streepje in het label "12-2" is een fout (zonder streepje "122"); de plaats letterlijk tonen volgt UX en is geen nieuwe keuze.

**Niet gecontroleerd (architect):** welke zod-versie het project gebruikt en of issues invoerwaarden bevatten (daarom de regel om zod-issues nooit te loggen); of een sleutel van de bron (bijv. "bis") altijd aan `^[A-Z0-9]{0,4}$` voldoet; of de E2E-opzet uit r2 al een eigen klok heeft; de rest van `product-analyst-r2.md` op andere oude taaknamen (alleen r. 132, 495 en 521 gevonden).

**Bijvangst (architect, niet uitgewerkt):** voor adressen met een laag ophaalritme zet "Afvalkalender staat aan · taken voor 2 weken klaargezet" soms 0 taken klaar; de tekst zou dan beter "taken komen 14 dagen vooraf" kunnen zeggen (product-designer, bij de freeze).

**Kleinste vervolg:** de analist-correcties (R3-6) bij de freeze in `product-analyst-r2.md` zetten; daarna de plan-critic.

STATUS: READY (gereconstrueerd door de hoofdsessie; de twee architectruns eindigden zelf ook op READY)
