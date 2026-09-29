## Technisch vooronderzoek: W-03 afvalkalender (Den Haag), ronde 1

Document: niets geschreven. TECHNICAL_DESIGN.md is bevroren en de poort blokkeert elke schrijfactie van deze rol buiten TD/SPEC. Alles staat hieronder.

**Gecontroleerd:**
- Broncode van drie actieve open-source integraties: mampfes/hacs_waste_collection_schedule (`hvcgroep_nl.py`), pippyn/Home-Assistant-Sensor-Afvalbeheer (`collectors/shared/opzet.py`, `const.py`) en xirixiz/homeassistant-afvalwijzer (`collector/opzet.py`, `const/const.py`), opgehaald via raw.githubusercontent.com (master, 2026-09-29).
- Zoekresultaten over de Den Haagse regels.

**Niet bereikbaar vanuit deze omgeving (egress-policy):** huisvuilkalender.denhaag.nl, denhaag.nl, officielebekendmakingen.nl, lokaleregelgeving.overheid.nl, data.overheid.nl, binsync.nl en forum.domoticz.com. Ik heb de bron dus **niet live gezien**. Alle antwoordformaten hieronder zijn afgeleid uit de code van drie onafhankelijke integraties die ze gebruiken.

---

### 1. Welke bron zit erachter

**Leverancier: Opzet.** Het testdomein `huisvuilkalender-denhaag-test.opzet.nl` bestaat en is te vinden via zoeken. Alle drie de integraties rekenen `https://huisvuilkalender.denhaag.nl` tot de "Opzet"-familie; HACS noemt die familie `hvcgroep_nl`. Hetzelfde platform draait voor HVC, GAD, Cyclus, DAR, PreZero, Spaarnelanden, ZRD en ongeveer 25 andere gemeenten en inzamelaars.

- Het is **geen** Ximmio: Avalex (buurgemeenten Delft/Rijswijk) is wél Ximmio, Den Haag niet.
- Het is ook **geen** Mijn Afvalwijzer.
- Er is geen sleutel en geen company code nodig. De basis-URL is de enige parameter.

**Endpoints.** Dit is de interne JSON-REST-API die de site zelf gebruikt. Er is geen publieke documentatie van.

| # | Methode en URL | Doel | Antwoord (afgeleid uit de code) |
|---|---|---|---|
| A | `GET https://huisvuilkalender.denhaag.nl/rest/adressen/{POSTCODE}-{huisnummer}`, bijv. `/rest/adressen/2591BB-87` | adres → BAG-id | JSON-array van adressen, `[]` als het adres onbekend is. Velden: `bagId`, `huisletter`, `huisnummerToevoeging` (plus vermoedelijk straat, postcode en nummer). Meerdere rijen bij letters of toevoegingen. Kies dan de rij op `huisletter` of `huisnummerToevoeging` (pippyn, xirixiz) |
| A' | `GET …/adressen/{POSTCODE}:{huisnummer}` (zonder `/rest`) | alternatief (HACS) | velden `bagid`, `huisletter`, `toevoeging` (andere spelling). **Voorstel:** A gebruiken, want twee van de drie integraties gebruiken A |
| B | `GET …/rest/adressen/{bagId}/afvalstromen` | afvalsoorten + **eerstvolgende** ophaaldatum per soort | array van `{ id, parent_id, title, slug, tags, page_title, menu_title, icon, icon_data, ophaaldatum: "YYYY-MM-DD" \| null }` |
| C | `GET …/rest/adressen/{bagId}/kalender/{jaar}` | **alle** ophaaldagen van een jaar | array van `{ afvalstroom_id, ophaaldatum: "YYYY-MM-DD", … }`. `afvalstroom_id` verwijst naar `id` uit B (HACS) |
| D | `GET …/rest/app/meldingen/{bagId}` | storings- en wijzigingsberichten van de gemeente | array van `{ id, kop, content (HTML), afwijsbaar }` (xirixiz). Optioneel, niet nodig voor de kern |

**Voorbeeld (gereconstrueerd, niet live geverifieerd):**
```json
// A
[{"bagId":"0518200000xxxxxx","huisletter":"","huisnummerToevoeging":"", "...":"..."}]
// B
[{"id":55,"title":"Restafval","menu_title":"Restafval","icon":"zak-grijs-rest","ophaaldatum":"2026-10-01"},
 {"id":56,"title":"Papier","icon":"doos-karton-papier","ophaaldatum":"2026-10-07"},
 {"id":57,"title":"PMD","icon":"petfles-blik-drankpak_pmd","ophaaldatum":"2026-10-02"},
 {"id":58,"title":"GFT","icon":"appel-gft","ophaaldatum":null}]
// C
[{"afvalstroom_id":55,"ophaaldatum":"2026-10-01"},{"afvalstroom_id":57,"ophaaldatum":"2026-10-02"}]
```

**Afvalsoorten in Den Haag.** De `icon`-sleutels uit HACS zijn het betrouwbaarste herkenningspunt:
- `zak-grijs-rest` → rest
- `doos-karton-papier` → papier
- `petfles-blik-drankpak_pmd` → PMD
- `appel-gft` → GFT (negeren, V-43)

De exacte `title`-teksten zijn niet bevestigd. Voorstel voor de mapping: eerst op `icon`, dan als terugval een trefwoord in `title`/`menu_title` (`rest`, `papier`, `pmd`/`plastic`). Een onbekende soort wordt genegeerd en geteld in de log.

**Hoe ver vooruit.**
- C levert een heel kalenderjaar.
- Het volgende jaar wordt pas beschikbaar nadat de gemeente de huisvuilkalender heeft vastgesteld, meestal eind van het jaar (Gemeenteblad 2025-448382 = kalender 2026). Tot die tijd geeft `kalender/{jaar+1}` vermoedelijk een lege lijst of een 404. Dat is geen fout.
- B geeft alleen de eerstvolgende datum.

**Den Haagse regels die ertoe doen (uit zoekresultaten van denhaag.nl en het Gemeenteblad):**
- Aanbieden mag op de ophaaldag vóór 07:45, of de avond ervoor **vanaf 22:00**.
- Een minicontainer mag alleen op de ophaaldag op straat staan.
- Op feestdagen schuift de ophaling naar een inhaaldag. De online kalender wordt volgens de gemeente automatisch aangepast.
- Oud papier wordt tussen 19 december en 5 januari niet aan huis opgehaald.
- Adressen met ondergrondse containers hebben geen ophaaldagen in de kalender.

### 2. Voorwaarden, betrouwbaarheid en risico's

- **Officieel of niet:** het endpoint is **onofficieel en niet gedocumenteerd**. Het is de eigen frontend-API van de gemeentesite. Er is geen open dataset; er loopt zelfs een dataverzoek "Afvalwijzer data" op data.overheid.nl. Het wordt al jaren door meerdere open-source integraties gebruikt, dus het is stabiel genoeg, maar er is geen garantie.
- **robots.txt en gebruiksvoorwaarden:** niet te controleren vanuit hier. **Verplicht bij de bouw:** eerst `robots.txt` en de voorwaarden bekijken (zie probe onder §3.9).
- **Rate limits:** niet bekend. Dit ontwerp doet ongeveer 3 verzoeken per dag voor één huishouden, dus verwaarloosbaar.
- **Risico's:**
  1. het formaat of de paden veranderen, of er komt botbescherming → de synchronisatie faalt;
  2. een tijdelijke storing of een leeg antwoord mag nooit taken wissen;
  3. pippyn forceert IPv4 voor Opzet-hosts, dus er zijn mogelijk IPv6-problemen. Node `fetch` in Vercel gebruikt happy eyeballs; bij de probe letten op time-outs;
  4. het jaar volgend jaar is laat beschikbaar;
  5. het adres (of het daaraan gekoppelde `bagId`) gaat naar een derde partij, de gemeente en Opzet. Het verzoek komt van de Vercel-server, niet van de telefoon.

### 3. Ontwerpvoorstel op hoofdlijnen

**3.1 Waar het draait.** Alleen server-side, in `src/server/system/waste/`:
- `source.ts`: fetch + zod-parser;
- `sync.ts`: cache bijwerken;
- `plan.ts` (puur) in `src/domain/waste/`.

De basis-URL is een constante. Alleen in tests is een override via een server-only env mogelijk, en alleen als `NODE_ENV=test` (geen SSRF). Validatie:
- postcode `^[1-9][0-9]{3}[A-Z]{2}$` na normaliseren;
- huisnummer 1–99999;
- letter 1 teken, toevoeging ≤ 4;
- `bagId` uit het antwoord moet matchen op `^[0-9]{16}$` (BAG-formaat; bij de probe verifiëren) en wordt ge-`encodeURIComponent`.

**3.2 Twee gescheiden stappen.** Dit is de eenvoudigste variant die even betrouwbaar is.
1. **Ophalen (1× per dag):** een extra stap aan het eind van de bestaande tick. Hij draait alleen als `last_success_at` van vóór vandaag is (Europe/Amsterdam) en het na 06:00 is. Budget maximaal 15 s, `AbortSignal.timeout(8000)` per verzoek, eigen try/catch.
   - Haalt B op (mapping id → soort, plus de eerstvolgende datum) en C voor jaar J.
   - Haalt C ook voor J+1 op, vanaf 1 november (leeg of 404 = ok).
   - Het resultaat gaat naar een **cache-tabel**.
   - Het vangnet van Vercel (1×/dag) dekt ook deze stap.
2. **Taken maken (elke tick, uit de cache):** pure functie `planWasteTasks(pickups, existing, today, tz)` → `{ insert[], remove[] }`. Venster: vandaag t/m vandaag + 14, gelijk aan de planner en de snapshot.
- **Versimpeltoets:** zonder cache (direct taken uit de bron) is één tabel minder. Maar bij een storing van meer dan 14 dagen komen er dan geen taken meer, en fetchen zou gekoppeld zijn aan elke tick. De cache ontkoppelt dat en maakt het plannen deterministisch en testbaar. Daarom **wel** de cache.
- Een aparte pg_cron-job of route kies ik **niet**: dat betekent een extra endpoint en geheimdraad voor 3 verzoeken per dag.
- **Bij adres opslaan** doet de server action direct: A (adres zoeken) → B/C → cache → taken maken. Dan ziet de gebruiker meteen resultaat.

**3.3 Datamodel.** Nieuwe migratie `…_310_afvalkalender.sql`, niet-destructief.

- **`waste_addresses`** (één per huishouden):
  - kolommen: `household_id` PK → `households on delete cascade`, `postcode`, `house_number`, `house_letter`, `house_suffix`, `bag_id` (null tot gevonden), `last_attempt_at`, `last_success_at`, `last_error_code` (`NOT_FOUND` | `UNREACHABLE` | `FORMAT` | `SUSPECT_EMPTY`), `failure_count`, timestamps;
  - de soorten rest/papier/PMD zijn een **constante** in de code, geen kolom (V-43; versimpeltoets).
- **`waste_pickups`** (cache):
  - kolommen: `household_id`, `stream` (`check in ('rest','papier','pmd')`), `pickup_date`, `last_seen_at`;
  - **PK (`household_id`, `stream`, `pickup_date`)**; cascade met het huishouden.
- **`tasks` ✚ `external_key text`:**
  - formaat `check (external_key ~ '^waste:(rest|papier|pmd):\d{4}-\d{2}-\d{2}:(out|in)$')`;
  - **unieke partiële index `(household_id, external_key) where external_key is not null`**;
  - dit is de koppeling naar de ophaaldag, zonder FK, zodat historie blijft als een ophaaldag verdwijnt.
- **Taakvelden** (Europe/Amsterdam, V-39):
  - *buitenzetten*: `scheduled_date = D−1`, `scheduled_time = 21:00`, `reminder_minutes_before = {0}` → herinnering om 21:00 via de bestaande `taskMessages` (≤ 15 min te laat, WP3); `due_at = D 07:45` (gemeentelijke deadline);
  - *binnenzetten*: `scheduled_date = D`, `available_from = D 12:00` (zie vraag), `due_at` zie vraag;
  - `category = 'outdoor'` (bestaand domein), `recurrence_id = null`, `created_by_member_id = null`: alleen beheerders mogen verwijderen (bestaande regel bij een lege maker).
- **Wat de herinnering bereikt:** de herinnering volgt de bestaande `notify_reminders`-voorkeur. Die staat standaard aan voor Ellen en Jurgen en uit voor Lynn en Kai (V-23). Er is geen nieuw meldingstype nodig.

**3.4 Idempotentie en verschoven dagen.**
- **Cache bijwerken (één transactie, RPC `private.replace_waste_pickups(household, streams, from, to, dates jsonb)`, alleen service_role):** per soort binnen het opgehaalde bereik rijen verwijderen die niet meer voorkomen en nieuwe invoegen (`on conflict do update last_seen_at`).
- **Leeg-antwoordbewaking:** is het nieuwe resultaat voor een soort leeg terwijl de cache voor dat bereik datums had, dan wordt die soort **niet** vervangen en komt er `SUSPECT_EMPTY`. Een storing wist dus nooit taken.
- **Taken:**
  - invoegen met `upsert … ignoreDuplicates` op `(household_id, external_key)`. Twee gelijktijdige ticks of een dubbele opslag geven geen duplicaten;
  - de sync **werkt bestaande taken nooit bij**, dus bewerkingen van gebruikers blijven staan;
  - **verschoven ophaaldag D → D′:** D valt uit de cache → open (`todo`/`in_progress`), niet-verwijderde afvaltaken met datum ≥ vandaag waarvan de sleutel niet meer gewenst is, worden **hard verwijderd** (geen historie). Voor D′ komen nieuwe taken. Gedane taken blijven (historie);
  - **gebruiker verwijdert een afvaltaak:** `delete_task` moet voor `external_key is not null` **soft delete** doen (`deleted_at`). Dan blokkeert de unieke sleutel het opnieuw aanmaken. Dit is een kleine aanpassing in de RPC;
  - omzetten naar een terugkerende taak is geweigerd voor taken met `external_key` (guard);
  - `external_key` is onveranderlijk voor gebruikers (`guard_task_changes`), en bij een insert door `authenticated` moet hij null zijn (RLS with check).
- **Voorbij de ophaaldag:** een open *buitenzetten*-taak na dag D automatisch op `skipped` zetten, net als BR-16 bij reeksen. Zie de vraag hierover.

**3.5 Foutafhandeling.**
- **Bron onbereikbaar (time-out, 5xx, netwerk), of zod faalt (`FORMAT`):** cache en taken blijven ongewijzigd, `failure_count++`, logregel met alleen een code of status. Volgende dag opnieuw; bij opslaan meteen.
- **Adres niet gevonden (A = `[]`, of geen match op letter/toevoeging):**
  - bij opslaan een `VALIDATION`-fout: "Dit adres staat niet in de huisvuilkalender van Den Haag";
  - meerdere treffers zonder toevoeging: vragen om de toevoeging;
  - adres wel gevonden maar geen rest/papier/PMD-dagen (ondergrondse container): een melding in de UI, geen fout.
- **Bron onbereikbaar bij opslaan:** het adres wordt wel opgeslagen (`bag_id = null`) en de status toont "Nog niet opgehaald, we proberen het later opnieuw".
- **Status in de UI:** "Bijgewerkt op …", volgende ophaaldag per bak, en na X dagen falen een waarschuwing (zie vraag).
- `ActionResult`-codes volgens TD §6.

**3.6 Rechten (RLS) — voorstel, beslissing hoort bij Jurgen (zie vragen):**
- `waste_addresses`: select `is_member(household_id)`; insert/update/delete `is_admin(household_id)`, net als huishoudinstellingen (TD §5.2);
- `waste_pickups`: select `is_member`; geen schrijfpolicies (alleen het systeem);
- server action `saveWasteAddressAction`/`removeWasteAddressAction`: `requireAdmin()`. De aanroep naar de bron gebeurt in `src/server/system/waste/*`, pas **na** de rechtencheck. Schrijven naar cache en taken gaat met de service role, alleen invoegen en de afvalspecifieke opruiming (§5.3 uitbreiden met "4. waste sync");
- **uitzetten:** adres + cache + open toekomstige afvaltaken weg, in één RPC (`remove_waste_address`, `is_admin`).

**3.7 Privacy.**
- Adres = persoonsgegeven, toestemming V-45.
- Minimaal: alleen postcode, nummer, letter en toevoeging, plus `bag_id`. Geen straatnaam opslaan.
- Weg met het huishouden (cascade) en bij "uitzetten".
- **Nooit loggen:** postcode, huisnummer, `bagId` of URL's met die waarden. Alleen `waste_sync status=… code=… streams=n dates=n`.
- De gemeente en Opzet ontvangen het adres dagelijks vanaf Vercel. Dit moet in de privacytekst (PRODUCT_SPEC §8), door de product-analyst.
- User-Agent eerlijk, bijv. `Takenlijstje/1 (prive gezinsapp)`, zonder e-mailadres tenzij Jurgen dat wil.
- Geen `NEXT_PUBLIC_`-variabelen; er is geen geheim nodig.

**3.8 Performance.**
- 3 verzoeken per dag, ongeveer 150 ophaaldagen per jaar.
- `planWasteTasks` over ≤ 30 rijen, in de bestaande set-gebaseerde tick (één select op cache en bestaande sleutels, één upsert, één delete).
- De tick blijft ruim binnen 45 s; de ophaalstap heeft een harde grens van 15 s en kan het pushen niet blokkeren.

**3.9 Tests.**
- **Fixtures vastleggen (voorstel):** na WP3 staat pg_net aan. Dan kan de bouwer via de Supabase-koppeling `net.http_get` op A/B/C/`robots.txt` doen voor het **openbare testadres uit HACS (2591BB 87)**. Dat is geen persoonsgegeven. De antwoorden gaan als fixtures in `src/domain/waste/__tests__/fixtures/`. Dit verifieert meteen: veldnamen, `icon`/`title` van rest/papier/PMD, het BAG-formaat, J+1-gedrag en of B's eerstvolgende datum overeenkomt met C.
- **Unit (vitest):**
  - parser: normaal, meerdere adressen met letter/toevoeging, leeg, onbekende soort, `ophaaldatum: null`, kapot JSON en verkeerde types;
  - mapping;
  - `planWasteTasks`: tijden in Europe/Amsterdam inclusief de wintertijdovergang (ophaling ma 26-10-2026 → buitenzetten zo 25-10 21:00 CET), verschoven dag, verdwenen dag, teruggekomen dag, door gebruiker verwijderd = niet opnieuw, gedaan blijft, leeg-antwoordbewaking, jaargrens (J+1 leeg).
- **DB (SQL):**
  - RLS voor lid, beheerder, ander huishouden en uitgezet lid op beide tabellen;
  - `authenticated` kan niet in `waste_pickups` schrijven en geen `external_key` zetten of wijzigen;
  - unieke sleutel; `delete_task` doet soft delete voor afvaltaken; `remove_waste_address` cascade.
- **Integratie:** fetch geïnjecteerd (fixtures).
  - Tick twee keer → geen duplicaten.
  - 500 of time-out → niets veranderd, `failure_count` 1.
  - Opslaan met een onbekend adres → `VALIDATION`.
  - Gezinslid opslaan → `FORBIDDEN`.
- **E2E (licht, oude UI):** beheerder vult het adres in (bron gestubd via testserver) → Vandaag of Kalender toont "Restafval buitenzetten" op D−1.
- **Rooktest op live** met Jurgens eigen adres: datums vergelijken met de gemeentesite.

**3.10 Plaats in de WP-volgorde (V-46).** **WP3b — Afvalkalender**, direct na WP3, vóór WP4. Live op `main`, op de huidige UI.
- **Afhankelijk van:** WP3 (tick elke 15 min, pg_net voor de probe) en WP2a. Niet van WP2b.
- **Inhoud:**
  - migratie `_310` (tabellen, `external_key`, guard, RLS, RPC's, aanpassing `delete_task`);
  - `system/waste/*`, `domain/waste/*`, tickstappen;
  - minimale sectie "Afvalkalender" in de bestaande Instellingen (alleen beheerder): adres, status, volgende ophaaldagen, uitzetten;
  - tests en fixture-probe.
- In WP7 wordt die sectie opnieuw vormgegeven volgens het design system. Product- en UX-ontwerp zijn nodig voor de W-03-freeze.
- **Reviews:** code, test-writer, **security** (externe aanroep, persoonsgegeven, nieuwe RLS), performance licht (tickduur), rooktest Jurgen. Geen formeel CP. Wel rook-screenshots van de oude UI, zoals bij WP2a.

---

### Vragen voor de hoofdsessie (productkeuzes voor Jurgen)
1. **Tijdstip buitenzetten tegenover de gemeenteregel.**
   - Den Haag staat aanbieden pas toe **vanaf 22:00** de avond ervoor (of vóór 07:45 op de dag zelf). Jurgen wil om 21:00 een herinnering.
   - Opties: (a) herinnering 21:00, taaktekst of omschrijving "vanaf 22:00 buiten"; (b) herinnering om 22:00; (c) 21:00 zonder toelichting.
   - Voorstel: (a).
2. **Binnenzetten.**
   - Vanaf hoe laat precies? Voorstel 12:00.
   - Krijgt het een herinnering? Voorstel: geen, of één om 18:00.
   - Wanneer is het "te laat"? Voorstel: einde van de ophaaldag, want de gemeente wil de container dezelfde dag van straat.
3. **Voor welke bakken geldt binnenzetten?** Voor zakken (bijv. PMD- of restzakken) bestaat geen binnenzetten. Welke van rest, papier en PMD zijn bij Jurgen een container?
4. **Vergeten buitenzetten:** na de ophaaldag automatisch laten vervallen (voorstel), of blijven staan als "verlopen"?
5. **Rechten:** wie mag het adres invullen, wijzigen of uitzetten? Voorstel: alleen beheerders. Wie mag adres en status zien? Voorstel: alle actieve leden.
6. **Als de gemeentebron niet bereikbaar is:** alleen een status in Instellingen, of na 3 dagen falen ook één melding aan de beheerders? Voorstel: één melding na 3 dagen. Let op: dit vraagt een nieuw meldingstype.
7. **Taaknamen:** voorstel "Restafval buitenzetten", "Papier buitenzetten", "PMD buitenzetten" en "… binnenzetten" (of "Bak … binnenzetten"). Graag bevestigen.
8. **Bestaande handmatige afvaltaken of reeksen op live:** laat Jurgen die zelf stoppen, of moet de app bij het aanzetten voorstellen ze te stoppen? Ik heb live niet geteld.
9. **Voor de hoofdsessie, geen Jurgen-vraag:** akkoord met de fixture-probe via `net.http_get` vanuit het live Supabase-project met het openbare HACS-testadres (§3.9)? Dat is een uitgaand verzoek vanuit productie naar de gemeente, zonder persoonsgegevens.

### Bewuste vereenvoudigingen
- Alleen Den Haag (Opzet, vaste basis-URL). Geen generieke leverancierskeuze, al zou het Opzet-formaat later ongeveer 30 andere gemeenten dekken.
- Soorten vast in de code (rest/papier/PMD), geen instelling per bak.
- Ophalen als dagelijkse stap in de bestaande tick; geen aparte cronjob of route.
- De sync voegt alleen toe en verwijdert alleen open, niet-gedane taken; hij werkt nooit bij (bewerkingen van gebruikers blijven).
- Geen FK van taak naar ophaaldag, maar een unieke `external_key`: historie blijft en idempotentie volgt uit één index.
- Meldingen van de gemeente (endpoint D) buiten scope.

### Status
**WACHT OP ANTWOORDEN** (vragen 1–8). Daarna kan ik §3 als W-03-aanvulling op TECHNICAL_DESIGN uitschrijven, na `/design-go intrekken` of als wijzigingsverzoek. Productspec en UX (instellingensectie, taakteksten, privacytekst) zijn eerst nodig.

### Bronnen
- [HACS waste_collection_schedule — hvcgroep_nl.py (Den Haag, endpoints A'/B/C, icon-sleutels)](https://github.com/mampfes/hacs_waste_collection_schedule/blob/master/custom_components/waste_collection_schedule/waste_collection_schedule/source/hvcgroep_nl.py)
- [HACS — doc/source/hvcgroep_nl.md](https://github.com/mampfes/hacs_waste_collection_schedule/blob/master/doc/source/hvcgroep_nl.md) en [README (Den Haag → hvcgroep_nl)](https://github.com/mampfes/hacs_waste_collection_schedule)
- [pippyn Afvalbeheer — collectors/shared/opzet.py (endpoints A/B, IPv4-omweg)](https://github.com/pippyn/Home-Assistant-Sensor-Afvalbeheer/blob/master/custom_components/afvalbeheer/collectors/shared/opzet.py) en [const.py (OPZET_COLLECTOR_URLS, denhaag)](https://github.com/pippyn/Home-Assistant-Sensor-Afvalbeheer/blob/master/custom_components/afvalbeheer/const.py)
- [xirixiz afvalwijzer — collector/opzet.py (A/B/D, time-outs)](https://github.com/xirixiz/homeassistant-afvalwijzer/blob/master/custom_components/afvalwijzer/collector/opzet.py) en [const.py (SENSOR_COLLECTORS_OPZET)](https://github.com/xirixiz/homeassistant-afvalwijzer/blob/master/custom_components/afvalwijzer/const/const.py)
- [Opzet-testomgeving Den Haag](https://huisvuilkalender-denhaag-test.opzet.nl/) · [Huisvuilkalender Den Haag](https://huisvuilkalender.denhaag.nl/)
- [Huisvuilkalender — denhaag.nl](https://www.denhaag.nl/nl/afval/huisvuilkalender/) · [Huishoudelijk afval aanbieden — denhaag.nl](https://www.denhaag.nl/nl/afval/huisvuil-aanbieden/) (07:45 / 22:00, minicontainer alleen op de ophaaldag; via zoekresultaten)
- [Vaststelling Huisvuilkalender 2026 — Gemeenteblad 2025, 448382](https://zoek.officielebekendmakingen.nl/gmb-2025-448382.html) · [CVDR762811](https://lokaleregelgeving.overheid.nl/CVDR762811/)
- [Afval rond de feestdagen — schoondoenwegewoon.nl](https://schoondoenwegewoon.nl/nieuws/afvalfeestdagen/)
- [Dataverzoek "Afvalwijzer data" — data.overheid.nl](https://data.overheid.nl/en/community/datarequest/1213)

Relevante projectbestanden: /home/user/takenlijstje/docs/PROGRESS.md (W-03, V-41…V-47), /home/user/takenlijstje/docs/TECHNICAL_DESIGN.md (§3.1, §5.2–5.3, §6.1 `delete_task`, §11.3 tick, §15), /home/user/takenlijstje/src/domain/reminders.ts (herinnering op `scheduled_time` + `reminder_minutes_before`), /home/user/takenlijstje/supabase/migrations/20260927000100_schema.sql (tabel `tasks`, domein `task_category`).
