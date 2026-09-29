## Performance-review: WP3b (afvalkalender, W-03), commits d20026e..3b767af

Gemeten:
- Eigen database `perf_check` (stub + alle 14 migraties, daarna verwijderd): 5 huishoudens met kalender, 1210 afvaltaken (242 in het hoofdhuishouden, ± een jaar) + 7500 gewone taken; EXPLAIN (ANALYZE, BUFFERS) op de tickquery's, de RPC's en de triggers; timings met `clock_timestamp()`.
- Domeinfuncties met `tsx` (projecttsconfig): `planWasteTasks`, `findExpiredWasteTasks`, `wasteReminder`.
- `npm run build` (Next 16, exit 0) en de client-chunks per route uit `.next/server/app/(app)/*/page_client-reference-manifest.js`.

Geschat: de tickduur op Vercel (aanname: 2 roundtrips Vercel fra1 ↔ Supabase EU à 10–30 ms), en de latency van de gemeentebron (niet aangeroepen; alleen budgetten beoordeeld).

Let op: er staat nog een database `perf_check_wp3b` op de PostgreSQL-server, een restant van een eerder afgebroken review. Niet door mij aangemaakt in deze sessie, dus niet verwijderd; de hoofdsessie kan hem opruimen met `su postgres -c "psql -c 'drop database perf_check_wp3b'"`.

### Metingen tegenover de maatstaf (§18.13)

| Maatstaf | Uitkomst |
|---|---|
| Tick normaal: 2 kleine query's | Klopt. `runWasteStep` (src/server/system/waste/sync.ts:342–363): 1× `waste_calendars` (0,03 ms, seq scan op 5 rijen) + 1× `tasks` met `.in()` + `.or()` (0,53 ms voor 5 huishoudens/1210 afvaltaken, Bitmap Index Scan op `tasks_waste_key`, 60 buffers; 0,14 ms voor 1 huishouden). Planning in het geheugen 0,2 ms (200 bestaande taken), 0,43 ms als alles verschoven is, 0,10 ms bij 2000 bestaande. |
| 0 schrijfacties zonder verandering | Klopt. `applyWasteSync` (sync.ts:131) slaat de RPC over bij `outcome === null` en leeg plan; `alertIfNewFailure` (sync.ts:222–225) leest/schrijft niets zolang `alarm_since` staat of de toestand niet `failed` is; vervallen-update alleen bij treffers (sync.ts:415). |
| Tick zonder ophalen p95 < 5 s | Schatting: 20–60 ms (2 roundtrips + < 1 ms database + < 1 ms planning). Ruim binnen de grens, maar de door §18.13 gevraagde live-meting is nergens in docs/PROGRESS.md of DECISIONS.md vastgelegd (zie punt 1). |
| Ophalen 2×/dag, 2–3 GET's parallel, hard max 12 s | Klopt. `dueForFetch` (health.ts:39) met slots 06:00/17:00 en ≥ 60 min na een mislukking; `fetchPickups` (schema.ts:146) doet B + C(J) [+ C(J+1) in december] met `Promise.all`; per verzoek 8 s (`source.ts:15`), totaal `AbortSignal.timeout(12_000)` (sync.ts:156). Per huishouden 4 GET's/dag (6 in december), body-limiet 1 MB. Bij een lege C(J) volgt C(J+1) sequentieel, maar binnen dezelfde 12 s. |
| Ophalen alleen als de tick nog geen 10 s loopt | Klopt (sync.ts:391). Worst case eindigt de afvalstap na ± 22 s; de meldingenstap heeft dan nog tot 45 s (PUSH_BUDGET_MS), binnen `maxDuration = 60`. |
| Storing hooguit één update (D-048) | Klopt. `markWasteAlarm` (sync.ts:185) is één conditionele update; `waste_sync` bij `failure` is één update op `waste_calendars` zonder taakwijzigingen (plan wordt tot `insert` teruggebracht, sync.ts:130). |
| RPC's | `waste_sync` met realistisch plan (2 remove, 2 move, 1 rename, 4 insert): 6,2 ms eerste keer, 0,14 ms herhaald (idempotent, `on conflict do nothing`), 0,03 ms met leeg plan. `waste_save` (122 open taken weg, 28 nieuw): 4,9 ms. `waste_lookup_allowed`: 0,04 ms per aanroep (upsert op PK; 1 rij per huishouden, groeit nooit). `waste_calendar_enabled`: 0,22 ms. |
| Guard-trigger (`to_jsonb`) | Alleen bereikt voor rijen die al een afvaltaak zijn of er een worden (migratie _330 regel 108–110); voor gewone taken blijft `to_jsonb` ongebruikt. Gemeten als lid: 100 statuswijzigingen op afvaltaken 7,1 ms tegenover 14,2 ms op gewone taken (die lopen de reeks-/rechtencontroles). Geen kostenpost. |
| Skip-trigger | 0,57 ms per overslaan (cascade-update gebruikt `tasks_waste_key`); 50 keer overslaan 12,4 ms. De WHEN-clausule beperkt hem tot `out`-taken met een statuswijziging; de doorwerking op depth 2 slaat de guard over. |
| Indexen | Geen extra index nodig: `tasks_waste_key (household_id, waste_pickup_date, waste_direction)` dekt de tick (prefix `household_id` + `waste_direction is not null`), `loadWasteTasks` (household + datumbereik, 0,09 ms), de telling in `getWasteSettings` (0,11 ms) en de cascade. Het `.or(...)`-filter wordt als Filter op ± 30–150 rijen per huishouden afgehandeld; een index daarop zou niets opleveren. Groei: ± 200 rijen/huishouden/jaar; de tick leest alleen open taken of ophaaldag ≥ vandaag − 35, dus de tick groeit niet mee. |
| Server actions (`maxDuration = 30` op /instellingen) | Zoeken: A (8 s) + B/C parallel (8 s), samen gecapt op 12 s. Bevestigen: nogmaals 12 s + 2 kleine query's + `waste_save` (5 ms). Opnieuw proberen: claim + 12 s + 4–5 kleine query's. Alles < 15 s, ruim binnen 30 s. |
| Client-JS | Geen extra chunk op Vandaag/Taken/Kalender. De instellingenpagina laadt 1 extra chunk van 50 KB (3vyk2umg2idat.js; adresflow + status + Dialog) die op /kalender en /taken niet voorkomt. De teksten uit `src/domain/waste/messages.ts` (16 KB bron, ± 4,9 KB gzip inclusief commentaar) zitten in de gedeelde chunk 43020zmvzak8_.js (77 KB) omdat `task-card.tsx`, `use-task-actions.ts` en `notifications-page.tsx` `WASTE_TEXT` importeren. Rerenders: `WasteSection` haalt de instellingen één keer per mount op (effect-deps stabiel); `StatusView` hangt aan `useNow()` (1×/min, al bestaand patroon); sorteer- en tekstberekeningen per render zijn op 3 rijen. Niets gevonden. |
| Meldingenstap | `wasteReminder` × 200 taken: 0,77 ms. De bestaande leesquery (pkey-scan met filter, 1,6 ms per 1000 rijen) kreeg 3 kolommen erbij; geen wezenlijke verandering. |

### Bevindingen

1. [LAAG] docs/PROGRESS.md / docs/DECISIONS.md — de in TECHNICAL_DESIGN §18.13 afgesproken meting ("Meting in WP3b: p95 van de tickduur < 5 s zonder ophalen") is niet vastgelegd.
   Bewijs: geen enkele vermelding van p95, tickduur of `fetchMs` in docs/PROGRESS.md en docs/DECISIONS.md; de tick logt de duur wel (`[tick] ... duur=…ms`, src/server/system/tick.ts:102–105) en de afvalstap logt `fetchMs`.
   Gevolg: de maatstaf is alleen door schatting gedekt (20–60 ms), niet door de afgesproken meting.
   Verbetering: na de eerste dag live een handvol `duur=`-waarden uit de Vercel-logs (ticks zonder `opgehaald`) en één `fetchMs` in docs/PROGRESS.md noteren; daarmee is §18.13 afgevinkt. Geen codewijziging nodig.

2. [LAAG] src/server/services/waste-read.ts:56–73 — voor een beheerder lopen het lezen van `waste_calendars` en de telling van open afvaltaken na elkaar, terwijl ze onafhankelijk zijn.
   Bewijs: twee `await`s achter elkaar; de telling hangt niet af van de kalenderrij (alleen het `if (!cal) return` ertussen).
   Gevolg: één extra roundtrip (± 20–50 ms) bij elk openen van Instellingen door een beheerder. Merkbaar is het niet; het is de enige plek in dit WP waar parallel werk sequentieel gebeurt.
   Verbetering: beide in één `Promise.all` starten en de telling negeren als er geen kalender is. Alleen meenemen als het toch aangeraakt wordt (WP4 herbouwt deze pagina).

3. [LAAG] src/server/system/waste/sync.ts:262–279 en :293–298 — "Opnieuw proberen" leest `waste_calendars` drie keer (in `claimForRetry`, aan het begin van `syncHousehold` en na `applyWasteSync`) en doet `assertStillAdmin` en `loadWasteTasks` pas na de ophaling.
   Bewijs: `claimForRetry` → `readCalendar`; `syncHousehold` → `readCalendar`, dan `fetchOutcome` (tot 12 s), dan `assertStillAdmin`, `loadWasteTasks`, RPC, `readCalendar`.
   Gevolg: 2 vermijdbare roundtrips (± 40–100 ms) op een actie die door de ophaling zelf 0,5–12 s duurt; de gebruiker merkt het verschil niet.
   Verbetering: de kalenderrij uit de claim doorgeven aan `syncHousehold`; `loadWasteTasks` parallel met de ophaling starten (de hercontrole van het beheerderschap moet vlak vóór het schrijven blijven, security-review WP3b punt 5). Alleen als het gemak oplevert; functioneel niets mis.

4. [LAAG] src/features/settings/waste-section.tsx:71–78 — de skeleton (3 × 40 px + kop) is lager dan de beheerdersweergave (± 300–400 px), dus de secties eronder (Gezinsleden, Terugkerend, …) schuiven na het laden omlaag.
   Bewijs: skeleton-hoogte ± 150 px tegenover `StatusView` met stand, adres, drie bakregels, uitleg, tip en uitzetknop.
   Gevolg: layout shift op de instellingenpagina, alleen zichtbaar als iemand direct naar een lagere sectie scrolt; niet in de kernflow. Vergelijk met visual-qa.
   Verbetering: skeleton op de hoogte van de meest voorkomende toestand (aan, zonder storing) brengen, of een `min-h` op de sectie-inhoud. WP4 vervangt dit scherm; dan meenemen.

### Bewust niet geoptimaliseerd
- **Sequentiële verwerking per huishouden in de tick** (sync.ts:365–373) en het 10 s-afkappunt: met één gezin (PRODUCT_SPEC §2, geen open registratie) is er per tick hooguit één ophaling. Bij tientallen huishoudens zou de sortering op `last_attempt_at` de beurten eerlijk verdelen; parallel ophalen is nu niet nodig.
- **Bevestigen vraagt de bron opnieuw op** (actions/waste.ts:98): 2–3 extra GET's per instelling, bewust ontwerp (BR-48, niets uit de browser vertrouwen) en gedekt door de grens van 20 opzoekingen/uur (D-049). Instellen gebeurt hooguit enkele keren per jaar.
- **`WASTE_TEXT` in de gedeelde chunk** (± 3–5 KB gzip op ± 1 MB gedeelde JS): het splitsen van de instellingenteksten van de lijst-/toastteksten levert < 1 % op. Niet doen.
- **`tasks_waste_key` bevat ook alle niet-afvaltaken (NULL-rijen)**: een partiële index kan niet als `on conflict on constraint`-doel dienen; de extra omvang (± 300 KB bij 8700 taken) is irrelevant.
- **Geen index op het `.or(...)`-filter of op `status` voor afvaltaken**: na de indexprefix blijven 30–150 rijen over; een Filter daarop kost < 0,1 ms.
- **Intl.DateTimeFormat per aanroep in `domain/dates`** (`zonedInstant`): gemeten 4 µs per afvaltaak in de meldingenstap; niet de moeite.
- **`waste_calendars` seq scan** in de tick en de claim: 1 rij per huishouden; een index is zinloos.

### Conclusie
GO — geen blokkerende of gemiddelde performanceproblemen: de tick voldoet aan §18.13 (2 query's, < 1 ms database, 0 schrijfacties zonder verandering), de RPC's en triggers kosten milliseconden bij ± 200 afvaltaken, verzoeken naar de gemeente blijven op 4–6 per dag met een hard budget van 12 s, en de oude UI laadt geen extra JS op de kernschermen; alleen de afgesproken live-meting van de tickduur (punt 1) moet nog in docs/PROGRESS.md worden genoteerd.
