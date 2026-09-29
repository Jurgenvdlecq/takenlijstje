## Security-review: WP3b Afvalkalender (W-03)
Scope: de commits e243197 t/m b289758 (sinds d20026e "PROGRESS: Design Freeze met W-03; start WP3b"). Het gaat om de migraties `_320` en `_330`, `src/server/waste/{source,schema,lookup}.ts`, `src/server/system/waste/sync.ts`, de `tick.ts`-stap, `src/server/actions/waste.ts`, `src/server/services/waste-read.ts`, de wijzigingen in `src/server/actions/tasks.ts` en `guards.ts`, `src/features/settings/waste-section.tsx`, de redirectpagina `/instellingen/afvalkalender` en `supabase/ops/waste_rollback.sql`.
Stack: standaard (Next.js, Supabase/PostgREST met RLS; geen Prisma).
npm audit: 0 hoog, 0 kritiek (0 kwetsbaarheden in totaal).
Verplicht op grond van: niveau 2. Er is login, er zijn meerdere gebruikers en huishoudens, en er worden persoonsgegevens bewaard (het woonadres en de adrescode).

**Samenvatting:** geen BLOKKEREND. Er is één GEMIDDELD punt (opzoeken bij de gemeente is onbegrensd), vijf LAAG-punten en drie ONZEKER-controlepunten voor de livegang.

**Hoe getoetst.** Naast het lezen van de code heb ik de aanvalsscenario's echt uitgevoerd tegen `takenlijstje_test`, als rol `authenticated` en `anon`, met twee huishoudens A en B. Dat gebeurde in één transactie die daarna is teruggedraaid; ik heb niets gewijzigd. Omdat de teststub geen Supabase-standaardrechten kent, heb ik die in de transactie eerst nagebootst.

### Toegangstabel
| Endpoint/action | Huidige gebruiker uit | Id's uit invoer | Eigendom gecontroleerd? |
| --- | --- | --- | --- |
| `getWasteSettingsAction` | sessie (`requireMember`) | geen | ja. Beheerder of lid bepaalt wat terugkomt: een lid krijgt alleen aan/uit en de namen van de beheerders, geen adres |
| `lookupWasteAddressAction` | sessie (`requireAdmin`, vóór zod en vóór elke fetch) | geen id's; postcode, huisnummer en toevoeging, gevalideerd met zod en `normalizeWasteAddress` | n.v.t. Schrijft niets en stuurt geen adrescode (`bagId`) naar de browser (`forBrowser`) |
| `confirmWasteAddressAction` | sessie (`requireAdmin`) | geen id's. De adrescode komt niet van de client: er wordt opnieuw opgezocht | ja. Huishouden en lid komen uit de sessie. `waste_save` controleert opnieuw of iemand actieve beheerder is (alleen bij (a) aanzetten en (b) ander adres, zie punt 5) |
| `retryWasteSyncAction` | sessie (`requireAdmin`) | geen | ja (huishouden uit de sessie). Claim van 60 s |
| `disableWasteCalendarAction` → RPC `disable_waste_calendar()` | sessie + `auth.uid()` in de RPC | geen | ja. De RPC bepaalt het huishouden zelf uit het eigen beheerderslidmaatschap (`user_id` is uniek, dus één huishouden). Getoetst: A zet uit, B blijft intact |
| `moveTaskAction`, `updateTaskAction`, `deleteTaskAction` | sessie | `taskId` | ja. `loadOwnTask` (RLS + huishouden), daarna `assertNotWasteTask`, en de databaseguard als laatste grens |
| `setTaskStatusAction` (ook via `/api/outbox` setStatus/move) | sessie | `taskId` | ja (`loadOwnTask` + RLS). Status wijzigen mag; overslaan werkt door binnen hetzelfde huishouden |
| PostgREST `tasks` insert/update/delete (direct) | JWT | `id` | ja. Policies + guard, getoetst (zie hieronder) |
| PostgREST `waste_calendars` | JWT | `household_id` | lezen alleen voor beheerders (RLS). Schrijven ingetrokken, getoetst |
| RPC `waste_save`, `waste_sync` | service role | `p_household_id`, `p_member_id` (uit de sessie via de server) | alleen `service_role` heeft uitvoerrecht (proacl gecontroleerd). `authenticated` krijgt "permission denied" |
| RPC `waste_calendar_enabled()` | `auth.uid()` | geen | ja, alleen het eigen actieve lidmaatschap. `anon` wordt geweigerd |
| `private.waste_insert_tasks`, `waste_skip_cascade` | n.v.t. | n.v.t. | uitvoerrecht alleen voor `postgres`. `authenticated` krijgt "permission denied" |
| `/instellingen/afvalkalender` | layout (bestaand) | geen | alleen een vaste `redirect`, zonder invoer |

**Getoetste scenario's.** Alle uitkomsten waren zoals verwacht.
- **Lid van A:**
  - leest `waste_calendars`: 0 rijen;
  - maakt een afvaltaak: 42501;
  - wijzigt titel, datum of `deleted_at` van een afvaltaak: 42501;
  - maakt van een gewone taak een afvaltaak, of maakt van een afvaltaak een gewone taak: 42501;
  - verwijdert een afvaltaak via REST: `DELETE 0`; via `delete_task`: 42501;
  - roept `waste_save`, `waste_sync` of `private.waste_insert_tasks` aan: permission denied;
  - roept `disable_waste_calendar` aan: 42501;
  - slaat buitenzetten over in A: binnenzetten in A wordt ook overgeslagen, B blijft `todo`;
  - wijzigt een taak van B: `UPDATE 0`.
- **Beheerder van A:**
  - leest alleen de rij van A;
  - `update waste_calendars` (ook `last_attempt_at`): permission denied.
- **anon:** tabel en RPC geweigerd.

### Bevindingen

1. **[GEMIDDELD] Opzoeken en bevestigen bij de gemeente zijn onbegrensd**
   - Plek: `src/server/actions/waste.ts:78-86` (`lookupWasteAddressAction`) en `:89-129` (`confirmWasteAddressAction`). Het TD kiest hier bewust voor: §18.6 "Te-snel-bescherming niet bij bevestigen".
   - Wat er gebeurt: elke aanroep doet 3 tot 4 GET's naar `huisvuilkalender.denhaag.nl` (A, B, C(J), soms C(J+1)). Bevestigen zoekt opnieuw op, en pad (c) "zelfde adres" schrijft daarna ook nog via `waste_sync`. Er is geen limiet per huishouden of per tijdseenheid.
   - Waarom dit zwaarder weegt: de open registratie bestaat technisch nog (PRODUCT_SPEC r.83, V-05). Daardoor is iedereen met een zelf aangemaakt account beheerder van een eigen huishouden.
   - Misbruikscenario: een aanvaller registreert zich en roept de server action in een lus aan, bijvoorbeeld 10 per seconde, met wisselende postcodes. De app wordt dan een proxy naar de gemeentebron, met onze vaste User-Agent `Takenlijstje/1 (prive gezinsapp)` en vanaf Vercel `fra1`.
   - Gevolg:
     - de gemeente of haar WAF kan de User-Agent of IP-reeks blokkeren. Dan valt Jurgens afvalkalender uit (H1 na 48 uur) en ontstaat de U5-blokkadesituatie alsnog;
     - de gemeentebron wordt massaal bevraagd uit naam van de app (adressen naar BAG-id en straat). Dat is openbare data, maar het is misbruik van een onofficiële bron.
   - Verbetering:
     - een lichte begrenzing per huishouden voor opzoeken en bevestigen samen, bijvoorbeeld hooguit 20 per uur. Bijhouden in een kleine tabel of kolom via de service role; bij overschrijding `unreachable` of een eigen toestand teruggeven vóórdat er een verzoek naar buiten gaat;
     - dit mag AC-222 niet raken (bevestigen krijgt nooit T-79). Er is dus een tekstkeuze nodig: zie de vragen;
     - of: de open registratie sluiten. Dan beperkt dit risico zich tot Jurgens eigen beheerders en wordt het LAAG.

2. **[LAAG] Veel huishoudens met een adres kunnen de tickstap uithongeren**
   - Plek: `src/server/system/waste/sync.ts:300, 326-330`. `select("*")` heeft geen volgorde, ophalen stopt na `TICK_FETCH_CUTOFF_MS = 10_000`, en elke ophaling mag 12 s duren.
   - Misbruikscenario: via de open registratie maakt een aanvaller tientallen huishoudens met een geldig adres. Per tick lukken maar enkele ophalingen, in willekeurige volgorde. Jurgens huishouden komt dan soms uren niet aan de beurt.
   - Gevolg: vertraagde bijwerking of een onterechte storingsmelding. Geen datalek.
   - Verbetering:
     - sorteer op `last_attempt_at nulls first` (of op achterstand), zodat elk huishouden eerlijk aan de beurt komt;
     - en/of begrens het aantal adressen dat de tick per keer behandelt.
   - Samenhang: hangt samen met punt 1 en met de open registratie.

3. **[LAAG] De testoverride van de bronhost werkt ook in productie**
   - Plek: `src/server/waste/source.ts:31-41`.
   - Wat er gebeurt: `WASTE_SOURCE_BASE_URL=http://127.0.0.1:<poort>` wordt in elke omgeving geaccepteerd. Dat klopt letterlijk met TD §18.1.2, en de regex is correct verankerd, dus SSRF naar willekeurige hosts is niet mogelijk.
   - Misbruikscenario: een per ongeluk meegekopieerde env-variabele in Vercel Production. Dan gaan alle opvragingen naar loopback in de functie, en volgt na 48 uur stilzwijgend een storing. Met schrijfrechten op de env is alles al verloren, dus dit is hardening.
   - Verbetering: negeer de override (met dezelfde logregel) als `process.env.VERCEL_ENV === "production"`.

4. **[LAAG] Een toevoeging van de bron wordt niet tegen `SUFFIX_RE` gecontroleerd vóór `waste_save`. Bij een afwijking belandt het hele adres in de databaselog.**
   - Plek: `src/domain/waste/address.ts:78-80` (`candidateLetter` maakt alleen hoofdletters en valideert niet) en `src/server/waste/schema.ts:67-71`. Opgeslagen via `waste.ts:117` (`suffix: result.suffix`), terwijl de database `house_suffix ~ '^[A-Z0-9]{0,4}$'` eist (`_330`, r.26).
   - Wanneer: BAG staat een huisletter plus een toevoeging van 4 tekens toe, dus 5 tekens. Ook een spatie of streepje uit de bron valt buiten de regel.
   - Misbruikscenario en gevolg: er is geen aanvaller nodig. Bij zo'n adres faalt `waste_save` met 23514. PostgreSQL legt dan in de Supabase-postgreslog `DETAIL: Failing row contains (<household_id>, <postcode>, <huisnummer>, <toevoeging>, <bag_id>, …)` vast. Het woonadres staat daarmee in een platformlog, in strijd met de bedoeling van BR-58 en §18.12. Daarnaast ziet de gebruiker T-65, en is zo'n kandidaat in "choose" niet te kiezen.
   - Onze eigen log (`runAction`) logt alleen naam en code. Dat is goed.
   - Verbetering:
     - normaliseer de letter uit de bron met dezelfde `cleanSuffix` en toets hem tegen `SUFFIX_RE` in de parser. Past hij niet, dan de kandidaat als `FORMAT` of `not_found` behandelen, nooit doorgeven aan de database;
     - regressietest met een kandidaat `huisletter: "A", huisnummerToevoeging: "1HG2"`.

5. **[LAAG] Geen hercontrole in de database op beheerder bij pad (c) en bij "Opnieuw proberen"**
   - Plek: `waste.ts:106-110` (`applyConfirmedSameAddress` → `waste_sync`) en `:135-141` (`syncHousehold`). Beide draaien met de service role na alleen `requireAdmin()` aan het begin. Daarna volgt tot 12 s ophalen.
   - Misbruikscenario: een beheerder die tijdens die 12 s wordt teruggezet naar lid, ververst nog één keer de ophaaldagen van het eigen huishouden (en wist daarbij bij (c) een lopend alarm).
   - Gevolg: verwaarloosbaar. Hetzelfde huishouden, gegevens van de gemeente, geen adreswijziging. Het TD eist de hercontrole alleen in `waste_save`.
   - Verbetering (defense-in-depth): lees vlak vóór de RPC het lidmaatschap opnieuw met de service role, of geef `waste_sync` een optionele `p_member_id` met dezelfde controle als `waste_save`.

6. **[LAAG] De migratie leunt voor `waste_calendars` op de standaardrechten van Supabase**
   - Plek: `supabase/migrations/20260929000330_afvalkalender.sql:54-55`. Er staan alleen revokes. `_200` gaf destijds expliciet `grant select, insert, update, delete on all tables … to authenticated`, maar dat geldt niet voor nieuwe tabellen.
   - Gevolg: op live klopt het (standaardrechten + revokes geven `authenticated` alleen SELECT onder RLS en geven `anon` niets). In de lokale testdatabase hebben `authenticated` en `service_role` echter géén rechten op de tabel (`role_table_grants` toont alleen `postgres`). DB-tests kunnen "beheerder leest wel, lid niet" dus niet getrouw toetsen zonder nabootsing. Het beveiligingsgedrag is dan niet deterministisch vastgelegd.
   - Verbetering: expliciet `grant select on public.waste_calendars to authenticated; grant select, insert, update, delete on public.waste_calendars to service_role;` naast de bestaande revokes.

**Per categorie**
- **SSRF (§18.1.2):** aan elk vereiste van het TD is voldaan, en ik heb geen afwijkingen gevonden.
  - vaste host als constante;
  - paden alleen uit regex-gevalideerde waarden plus `encodeURIComponent`, en de toevoeging gaat nooit mee (AC-218);
  - `redirect: "error"`, `credentials: "omit"`, `cache: "no-store"`, alleen de twee toegestane headers;
  - status 200, controle op `content-type`, streamgrens van 1 MB, time-out van 8 s per verzoek en een totaalbudget van 12 s via `AbortSignal.any`;
  - ook de adrescode uit de bron wordt vóór hergebruik opnieuw gevalideerd (`bagIdSchema.parse`).
- **Lekken van adres of adrescode:** gecontroleerd, niets gevonden, behalve punt 4 (platformlog).
  - naar gezinsleden: RLS en `getWasteSettings` getoetst; een lid krijgt alleen aan/uit en de namen van de beheerders;
  - naar de browser: nooit de adrescode of ruwe datums; bevestigen neemt geen adrescode van de client aan;
  - taaktitels (T-01…T-14), M-01…M-05, de push-payload en de dedupe-sleutels bevatten geen adres of naam;
  - de logregels in `sync.ts` en `source.ts` bevatten alleen codes, tellingen en `fetchMs`;
  - `localStorage` bewaart alleen de tipvlag.
- **Guard, policies en doorwerking van overslaan:** gecontroleerd, niets gevonden. Er is geen andere trigger die `tasks` schrijft (alle triggers opgevraagd), dus de uitzondering `pg_trigger_depth() > 1` in de guard is alleen bereikbaar via de doorwerking. Die raakt uitsluitend `status` binnen `new.household_id`, en dat huishouden kan een lid niet wijzigen.
- **Geheimen en configuratie:** geen nieuwe geheimen; `next.config` zet geen `logging.fetches.fullUrl`.
- **Injectie:** geen raw SQL; `.or()`-filters bevatten alleen door de server gemaakte ISO-tijden. Geen `dangerouslySetInnerHTML`.
- **AVG en dataminimalisatie:** coördinaten, `woonplaatsId`, `gemeenteId` en HTML worden door zod gestript. `pickups` bevat alleen datums vanaf vandaag. Het adres verdwijnt bij uitzetten en bij het verwijderen van het huishouden (cascade).
- **Afhankelijkheden:** 0 kwetsbaarheden.

**ONZEKER (niet lokaal vast te stellen; controlepunten voor U4/U5)**
- **Vercel (§18.12):** het pad naar buiten bevat postcode plus huisnummer (A) of de adrescode (B, C). Per pad zichtbaar in Observability › External APIs alleen met Observability Plus. Nodig: welk Vercel-plan er actief is en de bewaartermijn van Observability en Runtime Logs. Jurgen of de hoofdsessie kijkt in het dashboard.
- **Supabase:**
  - API/edge-logs bewaren methode, pad en query (daarin staat het huishoud-id; dat is een bestaand patroon), en volgens de documentatie geen request-body. De body van `rpc/waste_save` (met adres en adrescode) komt er dus naar verwachting niet in;
  - te controleren: `log_min_duration_statement` en `log_statement` van het project (bij trage-query-logging kunnen parameters in de postgreslog komen), en de projectregio (EU?).
- **D-046 / pg_net:** de migraties `_320` en `_330` gebruiken geen `net.*`. Bij U4 blijft de L4-controle staan: rechten op `net` gelijk aan de stand vóór P0, en `net` niet bij de exposed schemas.

### Wat goed is (niet weghalen)
- **Vaste volgorde in elke afval-action:** `requireAdmin()`, dan zod, dan pas een fetch. Bevestigen zoekt opnieuw op en neemt nooit een adrescode van de client aan.
- **Controle van de uitkomst van `waste_save`:** vergrendeling op het huishouden, hercontrole op `p_member_id` als actieve beheerder, en elke schrijfactie van `waste_sync` gefilterd op `household_id` én `waste_direction is not null` én een open status.
- **Guard `to_jsonb(new) - [...]`:** alleen status wijzigen is dicht en generiek. Ook `deleted_at`, `household_id` en het omzetten van of naar een afvaltaak zijn geblokkeerd; dat staat als drievoudige grens ook in de policies en in `delete_task`.
- **`disable_waste_calendar` en `waste_calendar_enabled`** bepalen het huishouden zelf uit `auth.uid()`.
- **Bron-SSRF-laag (`source.ts`) en de strippende zod-parser (`schema.ts`).**

### Doorgeven aan test-writer
- DB (`70_afval.sql`), alle scenario's hierboven als regressie:
  - lid leest geen `waste_calendars`;
  - lid kan een afvaltaak niet aanmaken, hernoemen, verplaatsen of (via REST of `delete_task`) verwijderen, en kan een gewone taak niet omzetten naar een afvaltaak of terug;
  - `waste_save`, `waste_sync` en `private.*` geven permission denied voor `authenticated`;
  - de doorwerking van overslaan blijft binnen het eigen huishouden (B blijft `todo`);
  - `disable_waste_calendar` door beheerder A laat B intact;
  - `anon` wordt overal geweigerd;
  - `waste_save` met een lid of met een beheerder van een ander huishouden als `p_member_id` geeft 42501.
- Unit en integratie:
  - `sourceBaseUrl()` negeert `http://evil`, `https://127.0.0.1:1`, `http://127.0.0.1.evil:80` en `http://localhost:80`;
  - een redirect (301) geeft `UNREACHABLE`;
  - een body boven 1 MB geeft `FORMAT`;
  - een verkeerd `content-type` geeft `FORMAT`;
  - de uitgaande URL bevat nooit de toevoeging (AC-218);
  - de headers zijn exact de twee toegestane.
- Het antwoord van `lookupWasteAddressAction` en `confirmWasteAddressAction` bevat nooit `bagId` of `pickups` (snapshot van de sleutels).
- Een lid krijgt FORBIDDEN op alle vier de afval-actions zonder één uitgaand verzoek (fetch-mock heeft 0 aanroepen).
- Een bronkandidaat met een toevoeging van 5 tekens leidt nooit tot een aanroep van `waste_save` (punt 4).
- `retryWasteSyncAction` twee keer binnen 60 s: de tweede geeft `too_soon` zonder fetch.

### Vragen voor de hoofdsessie
- **V (voor Jurgen, punt 1):** mag er een begrenzing komen op het opzoeken van een adres, bijvoorbeeld hooguit 20 keer per uur per huishouden? Daarvoor is een nieuwe tekst nodig, want T-79 mag bij bevestigen niet (AC-222), dus het raakt het bevroren UX-document. Het alternatief is de open registratie sluiten, waarmee alleen eigen beheerders het nog kunnen. Zonder één van beide blijft punt 1 GEMIDDELD open en moet Jurgen het bewust accepteren (PROGRESS, "Bewust geaccepteerde open punten").
- **Controlepunt voor U4/U5:** Vercel-plan en bewaartermijn van logs, Supabase-logginginstellingen en projectregio, en de L4-controle volgens D-046 (zie ONZEKER).

### Conclusie
**GO**: er is geen BLOKKEREND securityprobleem. De isolatie tussen huishoudens, de rechten op de RPC's en de SSRF-afscherming zijn getoetst en werken. Vóór U4 moet punt 1 (GEMIDDELD) hersteld zijn of door Jurgen bewust geaccepteerd, en moeten de ONZEKER-controlepunten op de platformlogs worden afgevinkt.

Relevante bestanden:
- /home/user/takenlijstje/supabase/migrations/20260929000330_afvalkalender.sql
- /home/user/takenlijstje/src/server/waste/source.ts
- /home/user/takenlijstje/src/server/waste/schema.ts
- /home/user/takenlijstje/src/domain/waste/address.ts
- /home/user/takenlijstje/src/server/actions/waste.ts
- /home/user/takenlijstje/src/server/system/waste/sync.ts
- /home/user/takenlijstje/src/server/services/waste-read.ts
- /home/user/takenlijstje/src/server/guards.ts
- /home/user/takenlijstje/src/server/actions/tasks.ts
