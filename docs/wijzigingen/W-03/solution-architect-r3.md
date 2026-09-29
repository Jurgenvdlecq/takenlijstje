## Technisch ontwerp: W-03 afvalkalender (Den Haag), ronde 3
Document: niets geschreven, want `docs/TECHNICAL_DESIGN.md` is bevroren. Hieronder staan: (A) de volledige, bijgewerkte §18 die r2-§18 helemaal vervangt, (B) de §15-regels (WP3b volledig, plus W-03-regels voor WP4–WP9), (C) korte aanvullingen in bestaande TD-secties, en (D) de exacte BR/AC-tekst voor de analist.

**Documentatie gecontroleerd (2026-09-29):**
- Bron `huisvuilkalender.denhaag.nl` en `www.denhaag.nl` zijn nog steeds niet bereikbaar vanuit de ontwikkelomgeving: curl gaf "CONNECT 403" en WebFetch gaf `EGRESS_BLOCKED`. Het koppelcontract is dus nog altijd afgeleid en niet live gezien. Daarom komt de probe nu als stap P0 vóór de rest.
- Gemeenteregel minicontainer: volgens zoekresultaten mag de container "vanaf 22.00 uur de avond ervoor" buiten en moet hij "uiterlijk 7.45 uur" buiten staan ([denhaag.nl huisvuil aanbieden](https://www.denhaag.nl/nl/afval/huisvuil-aanbieden/)). Dit komt alleen uit een samenvatting van zoekresultaten, niet van de pagina zelf. Bevestigen hoort bij P0.4.
- pg_net: antwoorden blijven standaard 6 uur in `net._http_response` (`pg_net.ttl`) en worden opgeruimd door de worker ([Supabase pg_net](https://supabase.com/docs/guides/database/extensions/pg_net), [pg_net API](https://supabase.github.io/pg_net/api/)). `net.http_get` heeft een standaard time-out van enkele seconden, dus bij de probe expliciet `timeout_milliseconds` meegeven.
- Vercel Observability, tab "External APIs": uitgaande verzoeken zijn per hostname voor iedereen te zien, per pad alleen met Observability Plus (betaald) ([changelog external API caching](https://vercel.com/changelog/external-api-caching-insights-now-in-observability), [query external API requests](https://vercel.com/changelog/query-data-on-external-api-requests-in-vercel-observability)). De docs-pagina zelf was niet bereikbaar (egress). De security-reviewer bevestigt dit in het dashboard.
- Uit r2 en nog geldig: Vercel Fluid `maxDuration`, PostgreSQL `ALTER TYPE … ADD VALUE` (pas bruikbaar na commit), MDN `redirect: "error"`, `AbortSignal.any`.
- `supabase/ops/planner.sql` gelezen: dit bestand installeert `pg_net` (`create extension if not exists pg_net with schema extensions`) en trekt `execute` op `net.*` in bij `public`, `anon` en `authenticated`.

**Work packages:** WP3b (live op `main`, oude UI) met stap P0 vóór alle migraties en UI, en checkpoint CP-W03 vóór de livegang. W-03-aanvullingen in WP4, WP5, WP6, WP7, WP8 en WP9 op `v2-ui`.

---

# (A) Tekst voor TECHNICAL_DESIGN.md: nieuwe sectie (vervangt r2-§18 volledig)

## 18. Afvalkalender (W-03)

**Basis:** PRODUCT_SPEC §14 (BR-47…BR-59, UC-13…UC-15), UX_SPEC §13 (inclusief de definitieve tekstentabel), ACCEPTANCE_CRITERIA WP3b (AC-183…AC-223) en de W-03-aanvullingen in WP4–WP9 (AC-224…AC-235), en de besluiten V-41…V-57.

Deze sectie vervangt `docs/wijzigingen/W-03/solution-architect-r1.md` en `-r2.md` overal waar die afwijken. De verschillen staan in §18.17.

**Uitgangspunten:**
- Afvaltaken zijn gewone rijen in `tasks`, met drie extra kolommen.
- Alleen het systeem maakt, verschuift, hernoemt en verwijdert ze.
- Gebruikers mogen alleen de status wijzigen: afvinken, terugdraaien, bezig en overslaan. Notities gaan zoals altijd via `task_comments`.
- De planning is een pure functie in `src/domain/waste/`. Toepassen gebeurt atomisch in één RPC.
- **Teksten:** alle zichtbare teksten (instellingen, toasts, taakdetail, meldingen, push) komen uit de tekstentabel in UX §13, met één bron per tekst. Deze sectie legt alleen vast *welke uitkomst* tot *welke toestand of tekstsleutel* leidt. Taaknamen volgen UX §13.3.

### 18.1 De bron: koppelcontract, allowlist en SSRF

#### 18.1.1 Endpoints (platform Opzet, onofficieel en ongedocumenteerd; te bevestigen in P0)

| # | Verzoek | Doel | Gebruik |
| --- | --- | --- | --- |
| A | `GET /rest/adressen/{POSTCODE}-{huisnummer}` | adres → kandidaten met `bagId`, `huisletter`, `huisnummerToevoeging` (en vermoedelijk straat en plaats) | alleen bij het instellen (opzoeken en bevestigen) |
| B | `GET /rest/adressen/{bagId}/afvalstromen` | soorten: `id`, `title`, `menu_title`, `icon` | vertaling `afvalstroom_id` → bak |
| C | `GET /rest/adressen/{bagId}/kalender/{jaar}` | alle ophaaldagen van een jaar: `afvalstroom_id`, `ophaaldatum` | jaar J altijd, plus J+1 als vandaag in december valt |

Endpoint D (meldingen van de gemeente) valt buiten de scope (PRODUCT_SPEC §10).

#### 18.1.2 Vaste host, geen redirects, beperkte invoer (SSRF)

- **Basis-URL:** de constante `WASTE_SOURCE_BASE_URL = "https://huisvuilkalender.denhaag.nl"` in `src/server/waste/source.ts`. Er is geen instelling per huishouden, en er gaat nooit een URL of host uit invoer mee.
  - **Uitzondering, alleen voor tests en E2E:** de omgevingsvariabele `WASTE_SOURCE_BASE_URL` telt alleen als hij exact voldoet aan `^http://127\.0\.0\.1:\d{2,5}$`. Elke andere waarde wordt genegeerd, met de logregel `[waste] override genegeerd`.
- **Paden:** alleen uit gevalideerde waarden.
  - postcode `^[1-9][0-9]{3}[A-Z]{2}$`;
  - huisnummer 1–99999;
  - `bagId` volgens de regex uit P0. De aanname is `^[0-9]{16}$`; wijkt het af, dan is dat een uitvoeringskeuze (§18.1.7);
  - jaar 2020–2100;
  - elk segment gaat door `encodeURIComponent`;
  - de toevoeging gaat **nooit** naar de bron.
- **Fetch:** `method: "GET"`, `redirect: "error"`, `cache: "no-store"`, geen credentials en geen cookies.
  - Headers alleen `Accept: application/json` en `User-Agent: Takenlijstje/1 (prive gezinsapp)`.
  - Nooit een naam, e-mailadres, huishoud-id of lid-id (AC-218).
- **Antwoord:** status 200, een `content-type` met `json`, body via de stream met een grens van 1 MB, daarna `JSON.parse` en zod.
- **Time-outs:** per verzoek `AbortSignal.timeout(8000)`, samen met een totaalbudget via `AbortSignal.any`.
  - Totaalbudget: 12 s per server action en 12 s voor de ophaalstap in de tick.
  - B en C parallel; A daarvóór, alleen bij het instellen.

#### 18.1.3 Resultaattype (gooit nooit bij netwerk- of formaatfouten)

```ts
type SourceError = "UNREACHABLE" | "FORMAT" | "NOT_FOUND";
type SourceResult<T> = { ok: true; value: T } | { ok: false; code: SourceError; http?: number };
lookupAddress(postcode, houseNumber, deps)   // A; [] = onbekend
fetchStreams(bagId, deps)                     // B; 404 → NOT_FOUND
fetchYear(bagId, year, deps)                  // C; 404 of [] → ok [] (voor J én J+1)
fetchPickups(bagId, today, deps): SourceResult<{ pickups: WastePickups; unknownStreams: number; hadAnyDate: boolean }>
```

Hoe de foutcodes ontstaan:
- netwerkfout, time-out, 5xx, 429 of een andere 4xx → `UNREACHABLE`;
- kapotte JSON, zod-fout, verkeerde content-type of te groot → `FORMAT`;
- B geeft 404 → `NOT_FOUND` (bij de sync `ADDRESS_GONE`);
- C geeft 404 of `[]`, voor welk jaar ook → leeg, en dat is **geen** fout. Of het venster daardoor leeg is, beslist één regel (§18.8.4).

#### 18.1.4 Parser (zod, `src/server/waste/schema.ts`)

- Alleen verplicht wat gebruikt wordt; onbekende velden worden gestript.
  - A: `bagId` (string of number → string, regex), `huisletter` en `huisnummerToevoeging` (nullable).
  - A, optioneel voor "Klopt dit?": straat, huisnummer en plaats. Deze worden **nooit** bewaard of gelogd.
  - B: `id`, `title`, `menu_title?`, `icon?`.
  - C: `afvalstroom_id`, `ophaaldatum` (`YYYY-MM-DD`; `null` → rij overslaan).
- **Bak herkennen** (`src/domain/waste/streams.ts`, puur):
  - eerst op `icon` (namen uit P0; de aanname is `zak-grijs-rest`, `doos-karton-papier`, `petfles-blik-drankpak_pmd`);
  - daarna als terugval op trefwoord in `title` of `menu_title`: `pmd`/`plastic`, `papier`, `rest`, tenzij er `grof`, `gft`, `kerst` of `textiel` in staat;
  - onbekend → `null`: genegeerd en alleen geteld (AC-196);
  - twee stromen die op dezelfde bak uitkomen, worden samengevoegd.
- **Resultaat:** `WastePickups = { rest; papier; pmd }` als gesorteerde, unieke ISO-datums ≥ vandaag.

#### 18.1.5 Adres kiezen (`src/domain/waste/address.ts`, puur; AC-184, AC-187)

- `normalizeWasteAddress`:
  - postcode in hoofdletters zonder spatie;
  - "12a", "12 a", "12-2" en "12 bis" → nummer + toevoeging;
  - toevoeging maximaal 4 tekens `[A-Z0-9]`.
- `suffix: string | null`: `null` = niet opgegeven, `""` = bewust het adres zonder letter gekozen.
- `matchCandidate`:
  - 0 kandidaten → `not_found`;
  - `null` en 1 kandidaat → die kandidaat;
  - `null` en meerdere → `choose`;
  - gegeven → exacte match of `not_found`.
- De app kiest dus nooit zelf.

#### 18.1.6 Stap P0 van WP3b: probe van de bron (vóór alle migraties, code en UI; bij voorkeur al vóór `/design-go`)

**Wanneer.** P0 is de eerste stap van WP3b en is een harde voorwaarde voor elke volgende stap. Voorkeur: P0 **vóór de Design Freeze** uitvoeren. Dan kunnen de uitkomsten nog in de documenten worden verwerkt zonder wijzigingsverzoek. P0 schrijft vóór de freeze alleen in `docs/wijzigingen/W-03/probe/` (ruwe antwoorden en verslag); pas na de freeze komen ze als fixtures in `src/server/waste/__tests__/fixtures/`.

**Route.** Eén van twee:
- **(b) pg_net vanuit het live Supabase-project.** Dit is de standaardroute, omdat hij meteen de datacentertoets is (P0.3). `pg_net` is op live geïnstalleerd door `supabase/ops/planner.sql` bij de livegang van WP3. Deze route kan dus pas nadat `planner.sql` is uitgevoerd. De hoofdsessie controleert eerst met `select extversion from pg_extension where extname = 'pg_net'` en na afloop met controle L4 (D-042: geen `execute` op `net.*` voor `anon`/`authenticated`).
- **(a) Netwerk-allowlist van de ontwikkelomgeving (V-57).** Alleen als aanvulling, bijvoorbeeld voor herhaald testen tijdens het bouwen. Dit is **geen** vervanging van P0.3.

**Adres.** Alleen het openbare testadres uit de open-source-integraties (2591 BB 87). Jurgens eigen adres gaat nooit via pg_net of curl; dat komt pas bij de rooktest (U5), via de UI.

**Wat P0 doet:**

| Stap | Verzoek of controle | Wat vastleggen |
| --- | --- | --- |
| P0.1 | `robots.txt` van huisvuilkalender.denhaag.nl, plus een eventuele disclaimer- of voorwaardenpagina waar de site naar linkt | of `/rest/` of geautomatiseerd opvragen is uitgesloten |
| P0.2 | A (`2591BB-87`), B (`bagId` uit A), C(2026), C(2027) | status, `content-type`, relevante headers (rate limit, cache), responstijd, grootte, volledige body |
| P0.3 | datacentertoets: P0.1 en P0.2 lopen via pg_net vanuit AWS eu-central-1 (Frankfurt). Vercel `fra1` draait in dezelfde cloud en regio | geen 403, captcha, WAF-pagina of 429 bij 5–6 verzoeken achter elkaar |
| P0.4 | gemeenteregel: GET van de gemeentepagina over huisvuil aanbieden (en de pagina van de huisvuilkalender zelf), zoeken op "22.00"/"22:00", "7.45"/"07:45" en "minicontainer" | letterlijk citaat + URL + datum; ook of de regel verschilt per bak of wijk, en of er een binnenzet-regel staat |
| P0.5 | afvalstromen in B: icon en titel van rest, papier en PMD; wat er nog meer staat (GFT, grof, kerst) | de tabel voor `classifyStream` |
| P0.6 | opruimen | `delete from net._http_response where id = any(<ids van de probe>)`. Alleen de probe-id's, niet de tick-antwoorden. Het antwoord bevat het testadres, geen persoonsgegeven, maar we bewaren het niet langer dan nodig |

Voorbeeld van de aanroep (illustratie):

```sql
select net.http_get(
  url := 'https://huisvuilkalender.denhaag.nl/rest/adressen/2591BB-87',
  headers := '{"Accept":"application/json","User-Agent":"Takenlijstje/1 (prive gezinsapp)"}'::jsonb,
  timeout_milliseconds := 10000);
-- daarna: select id, status_code, headers, content from net._http_response where id = <id>;
```

**Bekende restgrens van P0.3.** pg_net en Vercel gebruiken niet exact dezelfde IP-adressen, al zitten ze in dezelfde cloud en regio. Blokkeert de site alleen Vercel, dan blijkt dat pas bij de eerste echte opzoeking (U5). Dat valt dan onder "blokkade" in §18.1.7 (wijzigingsverzoek). Een aparte Vercel-proef vóór het bouwen zou een ongereviewde deploy naar productie vragen. Dat is niet gekozen (versimpeltoets §18.18).

#### 18.1.7 Beslisregel: welke afwijking van de bron is een uitvoeringskeuze en welke een wijzigingsverzoek

Deze regel ligt vooraf vast. Wordt P0 vóór de freeze gedaan, dan worden alle punten gewoon in de documenten verwerkt. De punten in de rechterkolom gaan dan ook naar Jurgen, maar als vraag vóór de freeze in plaats van als wijzigingsverzoek.

| Uitvoeringskeuze, vastleggen in `DECISIONS.md` (geen nieuwe freeze) | Wijzigingsverzoek: stoppen, naar Jurgen, WP3b wacht |
| --- | --- |
| andere veldnamen, hoofdletters of typen in A, B of C (bijv. `date` in plaats van `ophaaldatum`, id als number) | `robots.txt` of voorwaarden sluiten `/rest/` of geautomatiseerd opvragen uit |
| andere icon- of titelnamen van de drie bakken; extra stromen | blokkade vanuit het datacenter (403, captcha, WAF), of 429 bij minder dan ~10 verzoeken per uur |
| ander BAG-formaat → regex in zod én `CHECK` in `…_330` aanpassen (de migratie is dan nog niet toegepast) | geen JSON-API meer, of alleen HTML die gescraped moet worden, of een sleutel of login nodig |
| gedrag van J+1 (404, `[]`, of 200 met datums uit een ander jaar, die dan worden weggefilterd) | een andere adresflow waarvoor **meer** naar buiten moet dan postcode + huisnummer of adrescode (raakt BR-58, AC-218), of waarbij iets anders dan de adrescode bewaard moet worden |
| postcode met spatie of kleine letters, of een ander scheidingsteken in het pad van A | geen onderscheid per bak (rest, papier en PMD niet apart te herkennen) |
| `content-type` met een variant (`charset`, `application/hal+json`); grootte tot 5 MB; responstijd tot 8 s | andere gemeentetijden dan 22:00 en 07:45, of regels die per bak of wijk verschillen (raakt BR-49, AC-192, UX §13.4 en §13.6) |
| extra verplichte header zonder persoonsgegevens | responstijden structureel boven 8 s (het budget van de tick en de actions klopt dan niet meer) |

Twijfel over de indeling is geen uitvoeringskeuze: de hoofdsessie legt het voor.

### 18.2 Modules en systeemgrenzen

```
src/domain/waste/                 puur, vitest
  address.ts    normalizeWasteAddress, formatPostcode, matchCandidate
  streams.ts    classifyStream, WASTE_STREAMS = ['rest','papier','pmd']
  plan.ts       wasteTitle, wasteTaskFields, planWasteTasks (insert/move/rename/remove),
                isWindowEmpty, WASTE_HORIZON_DAYS = 14, MAX_SHIFT_DAYS = 3
  expire.ts     findExpiredWasteTasks (BR-54)
  health.ts     dueForFetch (06:00 en 17:00), wasteSyncHealth (+ notice), FETCH_SLOTS
  messages.ts   tekstsleutels → teksten uit UX §13 (herinnering, storing, toasts)
src/server/waste/                 server-only, GEEN service role
  source.ts, schema.ts, lookup.ts
src/server/system/waste/          service role (TD §5.3)
  sync.ts       saveWasteCalendar, applyWasteSync, syncHousehold, runWasteStep
src/server/actions/waste.ts       lookup-, confirm-, retry- en disable-action
src/server/services/waste-read.ts getWasteSettings (user-client, RLS)
src/app/(app)/instellingen/afvalkalender/page.tsx   oude UI: alleen redirect (§18.9.3)
supabase/ops/waste_rollback.sql   terugrolstap (§18.16)
```

- **Browser:** formulier, uitkomsten van de actions en het tonen van afvaltaken. De telefoon doet nooit een verzoek naar de gemeente.
- **Server:** alle opvragingen, altijd na `requireAdmin()` of vanuit de tick.
- **Extern:** alleen de vaste host.
- **Geheimen:** geen.

### 18.3 Datamodel en migraties

#### 18.3.1 Tabel `waste_calendars` (hooguit één per huishouden)

| Kolom | Type en regel |
| --- | --- |
| `household_id` | `uuid primary key references households(id) on delete cascade` |
| `postcode` | `text not null check (postcode ~ '^[1-9][0-9]{3}[A-Z]{2}$')` |
| `house_number` | `integer not null check (house_number between 1 and 99999)` |
| `house_suffix` | `text not null default '' check (house_suffix ~ '^[A-Z0-9]{0,4}$')` |
| `bag_id` | `text not null check (bag_id ~ '<regex uit P0>')` |
| `pickups` | `jsonb not null check (jsonb_typeof(pickups) = 'object')`: `{"rest":[…],"papier":[…],"pmd":[…]}` |
| `version` | `bigint not null default 1`: +1 bij elk nieuw adres |
| `last_attempt_at` | `timestamptz`: claim en rate limit |
| `last_success_at` | `timestamptz not null` |
| `last_error_code` | `text check (last_error_code in ('UNREACHABLE','FORMAT','SUSPECT_EMPTY','ADDRESS_GONE'))` |
| `error_since` | `timestamptz`: moment van de **eerste** poging in de huidige reeks mislukkingen **met dezelfde code**. `null` als `last_error_code` null is. Check: `(last_error_code is null) = (error_since is null)` |
| `created_at`, `updated_at` | standaard + `set_updated_at` |

- **Niet bewaard:** straat, plaats, coördinaten, ruwe antwoorden en wie het adres invoerde.
- **"Storingsmelding verstuurd"** is afgeleid uit de dedupe-sleutel (§18.9.3).
- **`failure_count` (r2) vervalt.** `error_since` vervangt hem (§18.8.5). Zo telt alleen een reeks van **dezelfde** foutcode, en is "minstens een uur uit elkaar" een directe vergelijking in plaats van een teller plus een aanname over de tijd tussen pogingen.
- **Versimpeltoets:** één `jsonb`-kolom in plaats van een cachetabel. Het zijn ≤ ~150 datums per jaar die altijd in hun geheel worden gelezen.

#### 18.3.2 `tasks`: drie kolommen erbij

| Kolom | Betekenis |
| --- | --- |
| `waste_pickup_date date` | ophaaldag D |
| `waste_direction text` | `'out'` of `'in'` |
| `waste_streams text[]` | bakken op D, in de vaste volgorde |

- `check tasks_waste_shape`: alle drie null, **of** direction in (`out`, `in`) en een datum, `recurrence_id is null`, 1–3 bakken en `waste_streams <@ array['rest','papier','pmd']`.
- `constraint tasks_waste_key unique (household_id, waste_pickup_date, waste_direction)`: niet-partieel, bruikbaar als `on conflict`-doel en als index. NULL's botsen niet.
- Nullable, zonder standaardwaarde: geen herschrijving van de tabel, en de oude code blijft werken.
- Vervallen open afvaltaken worden door het systeem **hard** verwijderd. Afgevinkte en overgeslagen taken blijven altijd staan. Een **verschuiving** is geen verwijdering maar een update van dezelfde rij (§18.8.2).

#### 18.3.3 Meldingstype
`notification_type` krijgt er `'waste_sync_failed'` bij.

#### 18.3.4 Migraties (nummers na `…_310`)

| Bestand | Inhoud |
| --- | --- |
| `…_320_afval_meldingstype.sql` | alleen `alter type … add value if not exists 'waste_sync_failed'`. Apart bestand, omdat de waarde pas na de commit bruikbaar is |
| `…_330_afvalkalender.sql` | `waste_calendars` + RLS + grants; `tasks`-kolommen, check en sleutel; guard, policies en `delete_task` vervangen; trigger `waste_skip_cascade`; RPC's `waste_save`, `waste_sync`, `disable_waste_calendar`, `waste_calendar_enabled`; daarna opnieuw `revoke execute on all functions in schema private …` + de bestaande grants op de helpers (patroon `…_110`) |

Beide gaan pas na P0 en CP-W03 op live via `apply_migration` (D-040): eerst `_320`, dan `_330`.

### 18.4 Afvaltaken: sleutel, naam en tijden

#### 18.4.1 Naam
`wasteTitle(streams, direction)` volgt UX §13.3 exact, voor alle 7 combinaties × 2 richtingen, en is maximaal 80 tekens. De tabel in UX §13.3 is de enige bron; BR-49, AC-193 en AC-195 verwijzen ernaar.

#### 18.4.2 Velden (`wasteTaskFields(D, direction, streams, tz)`, `Europe/Amsterdam`, via `zonedInstant`)

| Veld | `out` | `in` |
| --- | --- | --- |
| `scheduled_date` | D−1 | D |
| `scheduled_time` | `21:00` (alleen voor het sorteren; de UI toont nooit "21:00") | `null` |
| `available_from` | `null` | D 12:00 |
| `due_at` | D 07:45 | (D+1) 00:00 |
| `reminder_minutes_before` | `'{}'` | `'{}'` |
| `description` | **`null`** | **`null`** |
| `category` / `priority` | `outdoor` / `normal` | idem |
| maker / `recurrence_id` | `null` / `null` | idem |
| `waste_*` | D, `out`, bakken | D, `in`, bakken |

- **Omschrijving `null` (nieuw in r3):** de UI leidt de regels en de infolijst af uit `waste_*` en de tijden, met de teksten uit UX §13.6 en §13.4. Een vaste omschrijving in de database was op D−1 of D+1 onjuist ("uiterlijk vandaag") en kwam dubbel naast de infolijst (plan-critic 4). De oude UI toont voor afvaltaken dus geen `description`, maar de infolijst.
- De 22:00/07:45 in de UI zijn constanten in `src/domain/waste/plan.ts` (`WASTE_OUT_FROM = "22:00"`, `WASTE_OUT_DEADLINE = "07:45"`, `WASTE_IN_FROM = "12:00"`, `WASTE_IN_REMINDER = "18:00"`, `WASTE_OUT_REMINDER = "21:00"`). Wijkt P0.4 af, dan is dat een wijzigingsverzoek (§18.1.7).

### 18.5 Rechten: RLS, guard, policies en RPC-checks

#### 18.5.1 `waste_calendars` (V-53)
- RLS aan, met één policy: `for select to authenticated using (private.is_admin(household_id))`. Geen schrijfpolicies.
- `revoke all … from anon`; `revoke insert, update, delete … from authenticated`. Niet in Realtime.
- `public.waste_calendar_enabled()`: security definer, `stable`, `execute` alleen voor `authenticated`. Geeft `exists` voor het eigen actieve lidmaatschap, anders `false`.

#### 18.5.2 `private.guard_task_changes` (vervangen; bestaande regels uit `…_210` letterlijk + dit)

```sql
if tg_op = 'INSERT' then
  if new.waste_direction is not null or new.waste_pickup_date is not null or new.waste_streams is not null then
    raise exception 'Afvaltaken maakt alleen de afvalkalender' using errcode = '42501';
  end if;
else
  if old.waste_direction is not null
     or row(new.waste_direction, new.waste_pickup_date, new.waste_streams)
        is distinct from row(old.waste_direction, old.waste_pickup_date, old.waste_streams) then
    if (to_jsonb(new) - array['status','completed_at','updated_at'])
       is distinct from (to_jsonb(old) - array['status','completed_at','updated_at']) then
      raise exception 'Een afvaltaak kun je niet wijzigen, verplaatsen of verwijderen' using errcode = '42501';
    end if;
  end if;
end if;
```

Het systeem (`auth.uid() is null`) en FK-acties (`pg_trigger_depth() > 1`) gaan eerst door, zoals nu. Verschuiven en hernoemen door `waste_sync` (service role) zijn dus toegestaan; voor leden is elke wijziging buiten de status geblokkeerd.

#### 18.5.3 Policies op `tasks` (vervangen)
- `tasks: aanmaken` krijgt erbij: `and waste_direction is null and waste_pickup_date is null`.
- `tasks: beheerder of maker verwijdert`: `using (waste_direction is null and private.can_delete_task(…))`.

#### 18.5.4 `public.delete_task` (vervangen)
Na de lidmaatschapscheck: `if v_task.waste_direction is not null then raise … '42501'`. De reeks-RPC's raken alleen taken met `recurrence_id` en hoeven niet te veranderen.

#### 18.5.5 Trigger `tasks_waste_skip_cascade` (BR-53, AC-209)
- `after update of status … when (new.waste_direction = 'out' and old.status is distinct from new.status)`.
- Werkt alleen als `auth.uid() is not null` en `pg_trigger_depth() = 1`: `out` naar `skipped` → `in` van dezelfde D naar `skipped` (als die open is), en terug naar `todo` (als die `skipped` is). Automatisch vervallen door de tick werkt niet door.
- Verschuiven door `waste_sync` raakt `status` niet, dus de trigger start dan niet.

#### 18.5.6 Server-side vroeg weigeren
`assertNotWasteTask(task)` in `moveTask`, `updateTask` (alle scopes, vóór het maken van een reeks), `deleteTask` en de wachtrij-soort `move` → `UserError FORBIDDEN`, met de tekst uit UX §13.

#### 18.5.7 UI-helpers
`isWasteTask`, en `canEditTask`, `canMoveTask` en `canDeleteTask` geven `false` voor afvaltaken. Ze dienen alleen om knoppen te verbergen.

### 18.6 Server actions (`src/server/actions/waste.ts`)

Alle vier volgen `runAction` → `requireAdmin()` → zod → pas daarna een opvraging of schrijfactie. Ze zijn online-only (`useOnlineOnly()`) en staan niet in de wachtrij.

| Actie | Wat hij doet | Resultaat (`data.kind`) |
| --- | --- | --- |
| `lookupWasteAddressAction` `{postcode, houseNumber, suffix}` | `lookupWasteCalendar` (§18.8.1). **Schrijft niets** | `found` (adres, weergave, eerstvolgende datum per bak) · `choose` · `not_found` · `no_streams` · `no_upcoming` · `unreachable` |
| `confirmWasteAddressAction` idem | vraagt **opnieuw** op (de client levert nooit `bag_id` of datums aan). Bij `found`: <br>**(a) nieuw of ander adres** → `waste_save` (alle open afvaltaken weg, nieuwe erin; BR-56). <br>**(b) zelfde adres** (`bag_id`, postcode, nummer en toevoeging gelijk aan het bewaarde) → `applyWasteSync` met de **net opgehaalde** datums, **zonder claim** en met de gelezen `version`. Open taken, notities en "bezig" blijven; verschuivingen volgen §18.8.2 | `saved` (`{inserted, removed}`), of bij (b) `saved` met `unchanged: true`, of dezelfde niet-gevonden-uitkomsten als lookup (niets bewaard). Wordt bij (b) `version` intussen verhoogd (een andere beheerder koos net een ander adres), dan `UNKNOWN` met de tekst "opslaan lukte niet, niets veranderd" uit UX §13 |
| `retryWasteSyncAction` `{}` | `syncHousehold(…, { manual: true })` **met** de claim (≥ 60 s) | `done` (`health`, `lastSuccessAt`) · `too_soon` |
| `disableWasteCalendarAction` `{}` | RPC `disable_waste_calendar()` | `{ removed }` |

- **Te-snel-bescherming niet bij hetzelfde adres (plan-critic 14):** alleen "Opnieuw proberen" gebruikt de claim. Bevestigen heeft zijn eigen verse opvraging al gedaan en krijgt dus nooit `too_soon`. De beheerder ziet "opgeslagen".
- `getWasteSettings` (server, user-client): de beheerder krijgt adres, `health` (§18.8.5, met `reason`, `lastErrorCode` en `notice`) en de eerstvolgende datum per bak. Een gezinslid krijgt alleen `waste_calendar_enabled`.
- Het aantal open afvaltaken voor de bevestiging bij uitzetten komt uit de snapshot. Wat er bij 0 staat, bepaalt UX §13.
- **Foutcodes:** alleen `FORBIDDEN`, `VALIDATION` en `UNKNOWN`. Uitkomsten van de bron zijn `kind`-waarden, geen fouten.
- **Budget:** 12 s per action. Staat Fluid compute uit, dan `maxDuration = 30` op het segment.

### 18.7 RPC's

| RPC | Wie | Wat (één transactie) |
| --- | --- | --- |
| `waste_save(p_household_id, p_member_id, p_postcode, p_house_number, p_house_suffix, p_bag_id, p_pickups, p_insert, p_now)` → `{version, removed, inserted}` | alleen `service_role` | 1. `households`-rij `for no key update` (serialiseert alle afval-schrijfacties per huishouden). 2. Hercontrole: `p_member_id` is een actieve beheerder, anders 42501. 3. Upsert `waste_calendars` (`version + 1` bij conflict; `last_success_at = last_attempt_at = p_now`; `last_error_code = null`, `error_since = null`). 4. `delete` van **alle** open afvaltaken van het huishouden. 5. Insert van `p_insert` (`household_id` uit de parameter, nooit uit de payload) met `on conflict (…tasks_waste_key) do nothing` |
| `waste_sync(p_household_id, p_version, p_result, p_error_code, p_pickups, p_remove uuid[], p_move jsonb, p_rename jsonb, p_insert jsonb, p_now)` → `{stale, removed, moved, renamed, inserted}` | alleen `service_role` | 1. Slot op de `households`-rij. 2. `waste_calendars … for update`; ontbreekt de rij of klopt `version` niet → `{stale:true}` en niets doen. 3. Stand bijwerken: <br>• `'success'` → `pickups = p_pickups`, `last_success_at = p_now`, `last_error_code = null`, `error_since = null`; <br>• `'failure'` → `error_since = case when last_error_code is distinct from p_error_code then p_now else error_since end`, daarna `last_error_code = p_error_code` (pickups blijven); <br>• `null` → alleen plannen. <br>4. **remove:** `delete … where id = any(p_remove) and household_id = p and waste_direction is not null and status in ('todo','in_progress')`. <br>5. **move:** `update tasks t set waste_pickup_date, scheduled_date, scheduled_time, available_from, due_at, title, waste_streams from jsonb_to_recordset(p_move) x where t.id = x.id and t.household_id = p and t.waste_direction = x.direction and t.status in ('todo','in_progress')`. Status, notities (`task_comments`) en `id` blijven. <br>6. **rename:** idem, alleen `title` en `waste_streams`. <br>7. **insert** zoals bij `waste_save`. <br>Volgorde 4 → 5 → 6 → 7: eerst ruimte maken, dan verschuiven, dan pas nieuwe sleutels innemen |
| `disable_waste_calendar()` → `integer` | `authenticated` | huishouden uit het **eigen actieve beheerderslidmaatschap**, anders 42501; slot; open afvaltaken weg; `waste_calendars`-rij weg |
| `waste_calendar_enabled()` → `boolean` | `authenticated` | §18.5.1 |

- **Idempotentie:** alle stappen controleren de status opnieuw, dus wat intussen is afgevinkt of overgeslagen blijft ongemoeid (AC-202). Twee ticks: het slot serialiseert, de tweede plant op de nieuwe stand (leeg plan), en inserts botsen op de sleutel.
- **Botsing bij move:** onder het slot kan de doelsleutel niet bezet raken, want leden kunnen geen afvaltaken maken. Toch leidt een `unique_violation` tot een rollback van de hele RPC. De tick logt `[waste] sync mislukt code=CONFLICT` en de volgende tick plant opnieuw. Er gaat niets half.

### 18.8 De achtergrondstap "afval"

#### 18.8.1 Opzoeken bij het instellen (`lookupWasteCalendar`)
1. A → `matchCandidate`. Bij `not_found` of `choose` → terug.
2. B + C(J), plus C(J+1) als het december is → `fetchPickups`.
3. Uitkomst, in deze volgorde:
   - `UNREACHABLE`, `FORMAT` of `NOT_FOUND` van B → `unreachable`;
   - geen enkele datum van rest, papier of PMD in de opgehaalde jaren → `no_streams`;
   - `isWindowEmpty(pickups, today)` (§18.8.4) → `no_upcoming`. Dit is **dezelfde regel** als de storingsregel. Er wordt dus nooit een adres bewaard dat bij de eerste bijwerking meteen als verdacht leeg zou gelden;
   - anders `found`.
4. `display` komt uit A, alleen voor de beheerder, en wordt nooit bewaard of gelogd.

#### 18.8.2 Plannen (`planWasteTasks`, puur)

```ts
planWasteTasks({ pickups, existing, now, timeZone }):
  { insert: NewWasteTask[]; move: MoveWasteTask[]; rename: {id,title,streams}[]; remove: string[] }
// existing = alle afvaltaken van het huishouden met waste_pickup_date >= vandaag (elke status)
```

1. **Venster:** D in [vandaag, vandaag + 14] (V-52).
2. **Gewenst:** per D in het venster de bakken op D, dus de sleutels `(D,out)` en `(D,in)`.
3. **Invoegbaar:** een gewenste sleutel zonder bestaande taak (elke status telt), en het moment is nog niet voorbij: `out` alleen als `now < D 07:45`; `in` altijd binnen het venster.
4. **Wees:** een bestaande **open** taak met D in het venster en **geen** ophaling meer op D, **behalve** `in` als `out` van dezelfde D `done` is (BR-51, AC-200; die blijft gewoon staan).
5. **Verschuiving koppelen, per dag (nieuw in r3):**
   - *weesdagen* = dagen D met minstens één wees;
   - *nieuwe dagen* = dagen D′ in het venster met minstens één invoegbare sleutel;
   - neem de weesdagen op volgorde. Koppel elke weesdag D aan de nieuwe dag D′ die nog niet gekoppeld is en waarvoor geldt: `|D′ − D| ≤ MAX_SHIFT_DAYS (3)`, en de bakken van D′ hebben minstens één bak gemeen met de bakken van de wezen op D. Bij meerdere kandidaten: de kleinste afstand, en bij gelijke afstand de vroegste D′;
   - per wees van een gekoppelde dag, per richting: is `(D′, richting)` invoegbaar, dan **move** (dezelfde rij krijgt `wasteTaskFields(D′, richting, bakken(D′))` en de naam uit UX §13.3). Die sleutel is daarna niet meer invoegbaar;
   - is `(D′, richting)` níet invoegbaar (er bestaat al een taak, of het moment is voorbij), dan geldt de gewone regel: **remove** van de wees.
6. **remove:** alle wezen die niet verschoven zijn (AC-199).
7. **rename:** een bestaande open taak met een gewenste sleutel maar andere bakken (AC-201).
8. **insert:** alle overgebleven invoegbare sleutels.
9. Taken met D < vandaag worden hier nooit geraakt (BR-54 regelt die). Een leeg plan betekent: geen RPC.

**Waarom zo (versimpeltoets):** de eenvoudigste variant is "verwijderen + opnieuw aanmaken". Die is niet even betrouwbaar, want `task_comments` hangt met `on delete cascade` aan `tasks` en er gaan dan stil notities en "bezig" verloren (plan-critic 6). Koppelen per dag houdt buitenzetten en binnenzetten van één ophaaldag samen. De grenzen "≤ 3 dagen" en "minstens één gemeenschappelijke bak" voorkomen dat een notitie aan een ophaaldag gaat hangen die er niets mee te maken heeft. Een verschuiving door een feestdag is in de praktijk 1–2 dagen. Buiten die grenzen geldt de gewone regel; er gaat dan ook alleen iets verloren bij een echte, grote wijziging van de agenda.

**Gevolgen die bewust zo blijven:**
- de herinnering volgt het nieuwe anker. De dedupe-sleutel `waste:<id>:<anker>` verandert, dus op de nieuwe dag komt de herinnering gewoon;
- is buitenzetten op de nieuwe dag al voorbij (`now ≥ D′ 07:45`), dan vervalt de oude buitenzet-taak volgens de gewone regel, en schuift binnenzetten wel mee.

#### 18.8.3 Wanneer ophalen: twee vaste momenten, claim en rate limit

- **`FETCH_SLOTS = ["06:00", "17:00"]`** in `Europe/Amsterdam` (nieuw in r3, plan-critic 11). 17:00 ligt vóór de herinneringen van 18:00 en 21:00, zodat een verschuiving die de gemeente overdag doorvoert nog dezelfde avond in de app staat.
- **`dueForFetch(cal, now, tz)`:**
  - `lastSlot` = het laatste slotmoment ≤ `now` (vandaag 17:00, vandaag 06:00, of gisteren 17:00);
  - ophalen als `last_success_at < lastSlot` **en** (`last_attempt_at` is null of ligt meer dan 60 min terug).
  - Zo is er één regel voor alle gevallen: na een mislukte poging blijft `last_success_at < lastSlot`, dus wordt er elk uur opnieuw geprobeerd. Een aparte storingsclausule is niet nodig.
- **Claim** (lease en rate limit, zonder lock):
  ```sql
  update waste_calendars set last_attempt_at = :now
  where household_id = :h and version = :v
    and (last_attempt_at is null or last_attempt_at < :now - interval '60 seconds')
  returning household_id
  ```
  Geen rij betekent niet ophalen, of `too_soon` bij "Opnieuw proberen". Bevestigen gebruikt de claim niet (§18.6).

#### 18.8.4 Eén regel voor een leeg antwoord (BR-52, AC-204), ook bij de jaarwisseling

- **`isWindowEmpty(pickups, today)`** = er is voor rest, papier en PMD **samen** geen enkele datum in [vandaag, vandaag + 14]. Dit gebeurt op de **net opgehaalde** datums, zonder voorwaarde over wat er eerder bekend was.
- **Tijdens het bijwerken:** leeg → `p_result = 'failure'`, code `SUSPECT_EMPTY`. De bewaarde datums, de taken en het adres blijven ongewijzigd. De planning draait verder op de **bewaarde** datums, zodat taken die er al staan niet vervallen en er niets wordt verzonnen.
- **Bij het instellen:** leeg → `no_upcoming`, en er wordt niets bewaard (§18.8.1).
- **Waarom zonder voorwaarde over "eerder bekend":** een adres wordt alleen bewaard als het venster níet leeg is. Een leeg venster daarna is dus altijd een verandering. Dit dekt de jaarwisseling. Voorbeeld: op 1 januari komt C(nieuw jaar) terug met 404 of `[]`, of alleen met datums na de 14 dagen. Het venster is leeg, dus `SUSPECT_EMPTY`. De voorwaarde uit de huidige BR-52 zou hier juist *geen* storing geven.
- **Eén bak zonder dagen** (papier van 19 december tot 5 januari) is **geen** storing. Het antwoord wordt normaal verwerkt.
- **Bewuste grens:** een echte ophaalpauze van meer dan 15 dagen voor alle drie de bakken tegelijk geeft een onterechte storingsmelding. Dat is in Den Haag voor rest niet bekend.

#### 18.8.5 Gezondheid (`wasteSyncHealth`, puur; UI én tick)

| Toestand | Regel |
| --- | --- |
| `failed`, reden `empty` | `last_error_code = 'SUSPECT_EMPTY'` **en** `last_attempt_at − error_since ≥ 60 min`: minstens twee lege antwoorden achter elkaar, zonder andere uitkomst ertussen, waarvan de eerste en de laatste minstens een uur uit elkaar liggen |
| `failed`, reden `stale` | `now − last_success_at > 48 h` (V-50), met welke foutcode ook, of zonder poging (bijv. als de tick stil lag) |
| `retrying` | `last_error_code` gezet, maar niet `failed` |
| `ok` | anders |

- **Per soort geteld:** een andere foutcode zet `error_since` opnieuw (§18.7). "Onbereikbaar" gevolgd door "leeg" geeft dus geen alarm; pas een tweede leeg antwoord minstens een uur na het eerste lege antwoord wel. Een succes wist alles. "Opnieuw proberen" binnen het uur kan het alarm niet versnellen, want de regel meet tijd, geen aantal.
- `UNREACHABLE`, `FORMAT` en `ADDRESS_GONE` geven alleen `failed` via de 48-uursregel.
- **Terugkoppeling aan de UI:** `health = { state, reason?, lastErrorCode?, lastSuccessAt, notice? }`. De tekst per `lastErrorCode` (ook voor balk H, met `ADDRESS_GONE` = "controleer het adres") kiest UX §13.
- **December-waarschuwing (plan-critic 12):** `notice = 'next_year_missing'` als vandaag in december valt, vandaag + 14 ≥ 1 januari van J+1, de laatste bijwerking gelukt is, en de bewaarde `pickups` geen enkele datum in J+1 bevatten. Dit wordt afgeleid, zonder kolom. Het is alleen een stille regel voor beheerders (tekst in UX §13), geen melding en geen `failed`. Zo ziet de beheerder vóór de eerste januari-ophaaldag dat de nieuwe kalender nog ontbreekt.

#### 18.8.6 Tickstap (`runWasteStep`)
Nieuwe stap in `runTick`, **tussen "overslaan" en "meldingen"**, met een eigen `step("afval")` en try/catch.
1. `select * from waste_calendars` (service role). Leeg → klaar.
2. Eén query voor de afvaltaken van die huishoudens: open, of `waste_pickup_date ≥ vandaag − 35`.
3. Per kalender:
   - **ophalen** als `dueForFetch` klopt, de tick nog geen 10 s loopt en de claim lukt. Budget 12 s. Uitkomst `success`, of `failure` met `UNREACHABLE`, `FORMAT`, `ADDRESS_GONE` of `SUSPECT_EMPTY`;
   - **plannen** met de effectieve datums: de nieuwe bij succes, anders de bewaarde;
   - **`waste_sync`** als er een ophaaluitkomst is of het plan niet leeg is;
   - **vervallen (BR-54):** `out` open en vandaag > D → `skipped`. `in` open, vandaag > D **en** er is een `out` met een latere D waarvan `scheduled_date ≤ vandaag` → `skipped`;
   - **storing:** `wasteSyncHealth`. Bij `failed` volgt `dispatcher.notify` (§18.9.3).
4. `TickReport.waste = { calendars, fetched, fetchFailed, inserted, moved, renamed, removed, expired, alerted }`. Alleen tellingen en een foutcode.

BR-16 raakt afvaltaken niet. Het Vercel-vangnet dekt de stap mee.

### 18.9 Meldingen

#### 18.9.1 Herinneringen (BR-55)
- Voor afvaltaken vervangt `wasteReminder(task, now, tz)` `taskMessages` volledig. Er komt dus nooit "deadline nadert" of "verlopen" (AC-211).
- Anker: `out` om (D−1) 21:00, `in` om D 18:00. Alleen voor open taken, en alleen als `0 ≤ now − anker < 90 min`.
- Type `reminder` (voorkeur `notify_reminders`), dedupe-sleutel `waste:<taskId>:<anker-ISO>`.
- Titel en tweede regel: tekstsleutels `waste.reminder.out` en `waste.reminder.in` (enkel- en meervoud op basis van `cardinality(waste_streams)`), met de teksten uit UX §13.10.

#### 18.9.2 Overig
Afvaltaken tellen mee in het dag- en avondoverzicht. "Taak gedaan" volgt de eigen voorkeur.

#### 18.9.3 Storingsmelding
- Type `waste_sync_failed`. `recipientsFor` heeft er een eigen tak voor: ieder actief lid met account en `role = 'admin'`, los van de voorkeuren. Push als die aan staat.
- Dedupe-sleutel `waste-failed:<last_success_at ISO>` per ontvanger: één melding per storing. "Leeg" en daarna "> 48 uur" geven samen één melding.
- Tekst: `wasteFailureMessage(reason, lastErrorCode, lastSuccessAt, tz)` met de varianten uit UX §13.10. Nooit een adres of naam.
- **URL (gewijzigd in r3):** `appUrl.wasteSettings()` = **`/instellingen/afvalkalender`**, al in WP3b.
  - In de oude UI is dat een server-`redirect` naar `/instellingen#afvalkalender` (`src/app/(app)/instellingen/afvalkalender/page.tsx`). Scrollt de browser niet naar het anker omdat de sectie pas na het laden bestaat, dan brengt de sectie zichzelf in beeld bij `location.hash === '#afvalkalender'`.
  - In WP7 wordt dezelfde route de echte subpagina.
  - Zo blijven oude meldingen werken zonder hash-omleiding aan de clientkant; een server ziet de hash nooit. De URL voldoet aan `^/([^/\\]|$)`.

### 18.10 Gelijktijdigheid en idempotentie

| Situatie | Mechanisme | Uitkomst |
| --- | --- | --- |
| Twee ticks tegelijk | claim; slot; sleutel + `on conflict do nothing`; dedupe | één taak per dag en richting, geen dubbele meldingen (AC-197) |
| Dubbel tikken op "Ja, aanzetten" (nieuw adres) | slot in `waste_save` | één adres, één set taken (AC-191) |
| Dubbel tikken bij hetzelfde adres | `waste_sync` onder het slot; de tweede plant op de nieuwe stand | geen extra taken; beide keren `saved` |
| Twee beheerders, verschillende adressen | slot; laatste commit geldt; `waste_save` wist eerst alle open taken | nooit taken van twee adressen (AC-214) |
| Tick plant terwijl het adres wijzigt | `version` in de claim en in `waste_sync` | `stale` → niets doen |
| Afvinken tijdens verschuiven, hernoemen of opruimen | elke stap alleen `where status in (todo, in_progress)` | afgevinkt blijft staan (AC-202); een taak die net is afgevinkt schuift niet mee |
| Notitie plaatsen tijdens een verschuiving | move is een update; `task_comments` blijft aan hetzelfde `id` hangen | de notitie blijft (AC-198) |
| Overslaan en ongedaan maken, ook offline | trigger; de wachtrij is FIFO | eindstand volgt de laatste actie (AC-209) |
| "Opnieuw proberen" vaak achter elkaar | claim ≥ 60 s | hooguit één opvraging per minuut; het alarm meet tijd, geen aantal |

### 18.11 Foutafhandeling: van uitkomst naar toestand
Teksten: UX §13 (tekstentabel). Deze tabel legt alleen de koppeling vast.

| Uitkomst | UX-toestand | Bewaard? |
| --- | --- | --- |
| zod-fout | A + foutregel bij het veld (AC-184) | nee |
| `not_found` | D | nee |
| `choose` | C2 | nee |
| `no_streams` | E | nee |
| `no_upcoming` | toestand volgens UX §13.8 (rij "no_upcoming") | nee |
| `unreachable` | F | nee; een bestaand adres blijft |
| `FORBIDDEN` | tekst uit UX §13 | nee |
| `UNKNOWN` bij opslaan (ook `stale` bij hetzelfde adres) | "Fout bij opslaan", "Klopt dit?" blijft staan | nee |
| `saved` / `saved unchanged` | toast "Opgeslagen" (UX §13.7.1/13.7.2) | ja |
| `too_soon` | toast (UX §13) | — |
| `done` na "Opnieuw proberen" | terugkoppeling "gelukt" of "lukt nog steeds niet" per `health` (UX §13) | — |
| `health.retrying` / `failed` / `notice` | stille regel / balk H per `lastErrorCode` / stille decemberregel | — |

### 18.12 Privacy en logging (BR-58, AC-212, AC-218)
- **Bewaard:** postcode, huisnummer, toevoeging en `bag_id` (de adrescode van de gemeente), alleen in `waste_calendars` en alleen leesbaar voor beheerders. **Voor het totaalvoorstel:** V-45 noemt alleen postcode en huisnummer; dat de adrescode ook bewaard wordt, moet expliciet worden genoemd.
- **Weg:** bij uitzetten, bij het verwijderen van het huishouden (cascade), en bij terugrollen alleen de open taken (§18.16).
- **Nooit in eigen logs:** postcode, nummer, `bag_id`, straat, bron-URL's, `error.message` van een fetch, huishoud-id. Logregels bevatten alleen tellingen en codes. `next.config` zet geen `logging.fetches.fullUrl`.
- **Platformlogs, controle door de security-reviewer in WP3b:**
  - **Vercel Observability, tab External APIs:** per hostname voor elk plan, per pad alleen met Observability Plus (betaald; volgens de changelog, in het dashboard bevestigen). Het pad van endpoint A bevat postcode en huisnummer, en van B en C de `bag_id`. Dit valt niet te vermijden, want het pad is het contract. Het blijft binnen Jurgens eigen Vercel-account, dezelfde verwerker als nu. Endpoint A draait alleen bij het instellen. De reviewer noteert wat het huidige plan werkelijk bewaart en hoe lang.
  - **Supabase:** de body van RPC-aanroepen door de service role komt niet in de API-logs. Controleren.
  - **pg_net-probe:** `net._http_response` na P0 leegmaken op id (P0.6); anders verdwijnt het na 6 uur (TTL). Jurgens eigen adres gaat nooit via pg_net.
- **Naar buiten:** alleen postcode + nummer (A) of `bag_id` (B, C), alleen naar de vaste host, vanaf Vercel `fra1`.

### 18.13 Performance-impact
- **Tick normaal:** 2 kleine query's, planning in het geheugen, 0 schrijfacties zonder verandering; ≈ 20–40 ms.
- **Twee keer per dag** (06:00 en 17:00, en elk uur bij een storing): 2–3 GET's parallel (hard maximaal 12 s) en 1 RPC. De tweede ophaling kost 2–3 GET's per dag extra.
- Ophalen start alleen als de tick nog geen 10 s loopt. Het pushbudget en de 55 s van pg_net blijven gehaald. Meting in WP3b: p95 van de tickduur < 5 s zonder ophalen.
- **Snapshot:** geen extra query in de oude UI (`select("*")`). In WP4 staan de drie kolommen in de expliciete kolomlijst, en `waste_calendar_enabled` komt als één RPC in de `core`-slice.
- **Volume:** ± 200 afvaltaken per jaar.

### 18.14 Oude UI (WP3b, `main`) en nieuwe UI (`v2-ui`)

**Oude UI (volgens UX §13.13):**
- `afval-section.tsx` + springlink: toestanden A–J en de extra toestanden uit UX §13.8, inline. Bevestigen bij uitzetten via de bestaande Dialog. Een gezinslid ziet alleen J.
- `task-card.tsx`: meta met het recycle-icoon + "Afvalkalender"; rechterkolom volgens UX §13.4; nooit "21:00".
- `selectors.ts#dashboardData`, alleen voor afvaltaken: open `out` van D−1 blijft tot D 07:45 onder Vandaag; `in` met `available_from > now` staat onder Binnenkort.
- `task-detail-sheet.tsx`: bewerk-, verplaats- en verwijderacties verborgen; infolijst en uitlegregel volgens UX §13.6; geen `description`; overslaan-toast met Ongedaan maken.
- `calendar-items.tsx`: slepen uit. `notifications/format.ts`: label en icoon voor het nieuwe type.
- `mutations.ts`: optimistisch overslaan en ongedaan maken van `out` neemt `in` mee; server en Realtime zijn leidend.
- Route `instellingen/afvalkalender` (redirect, §18.9.3).

**Nieuwe UI:** zie de W-03-regels bij WP4–WP9 in §15 en AC-224…AC-235. Er komt geen nieuwe migratie voor.

### 18.15 Tests per acceptatiecriterium

Lagen zoals in TD §13. De bron wordt altijd nagebootst: `deps.fetch` met fixtures (vanaf P0 de echte antwoorden van het testadres), en E2E met de stubserver `tests/e2e/support/waste-stub.mjs` op `127.0.0.1`. Die stub kent scenario's (normaal, meerdere adressen, onbekend, alleen GFT, onbereikbaar, leeg, adres weg, december zonder J+1, verschuiving), zodat ook de screenshots van CP-W03 elke toestand kunnen tonen. Databasetests in `supabase/tests/70_afval.sql`, integratie in `tests/integration/waste.test.ts`, E2E in `tests/e2e/waste.spec.ts`.

| AC | Unit | DB | Int | E2E |
| --- | --- | --- | --- | --- |
| 183 | — | — | confirm → adres + taken vandaag…+14 | invullen → Klopt dit? → aanzetten |
| 184 | `normalizeWasteAddress` | — | geen fetch bij een zod-fout | foutregel, knop uit |
| 185 | `matchCandidate` → `not_found` | — | bestaand adres ongewijzigd | D |
| 186 | alleen GFT → `no_streams` | — | niets bewaard | — |
| 187 | normaliseren; `choose`; `suffix ""` | — | via de action | — |
| 188 | time-out, 503, JSON, te groot, redirect | — | niets bewaard; oud adres + `version` gelijk | — |
| 189 | — | schrijven geweigerd; RPC-rechten | actions als lid → `FORBIDDEN`, fetch-spy 0 | lid ziet geen formulier |
| 190 | — | select per rol; `enabled()` | `getWasteSettings` als lid | — |
| 191 | — | `waste_save` 2× parallel | twee adressen tegelijk | — |
| 192 | `wasteTaskFields` out; `description = null` | `complete_task` 07:50 → te laat | — | "vanaf 22:00" |
| 193 | `in`-velden | — | — | vóór 12:00 onder Binnenkort |
| 194 | `wasteReminder` | — | tick 21:00/18:00 | — |
| 195 | `wasteTitle` 7 × 2 tegen de tabel in UX §13.3 | — | 1 herinnering per ontvanger | — |
| 196 | `classifyStream` | — | — | — |
| 197 | +3/+14/+15 | sleutel | 2× na elkaar en 2× parallel | — |
| **198** | `planWasteTasks`: (a) 25-12 → 26-12 = **move** van beide, zelfde id; (b) doel `out` bestaat al (done) → `out` remove, `in` move; (c) afstand 4 dagen → remove + insert; (d) geen gemeenschappelijke bak → remove + insert; (e) `out` op D′ al voorbij → `out` remove, `in` move | move onder de guard (service role) lukt; als lid → 42501 | notitie en `in_progress` blijven na de verschuiving; geen historie; herinnering op het nieuwe anker | — |
| 199 | remove beide | — | hard weg | — |
| 200 | `out` done → `in` blijft; verschuiving → nieuwe D′ via insert | — | idem | — |
| 201 | rename | rename raakt done niet | — | — |
| 202 | — | remove/move/rename op done/skipped → 0 rijen | — | — |
| 203 | (a)–(e) | — | tick op die tijden | — |
| **204** | `isWindowEmpty`: alle drie leeg = ja; alleen papier = nee; 1 januari zonder nieuwe kalender = ja; alleen datums na +14 = ja | `error_since`: andere code → reset; zelfde code → blijft; succes → null | 500/time-out/leeg → taken, adres en `pickups` gelijk; andere stappen draaien; console zonder adres | — |
| **205** | `wasteSyncHealth`: leeg 0/59 min → `retrying`; leeg 0/60 min → `failed`; UNREACHABLE → leeg → leeg na 30 min → geen alarm; 48 u → `failed`; tekst zonder adres | — | over meerdere ticks elk 1 melding voor Jurgen/Ellen, 0 voor Lynn; na succes + nieuwe storing opnieuw 1; "Opnieuw proberen" 3× binnen een uur geeft geen alarm | balk H |
| 206 | zomer- en wintertijd | — | — | — |
| 207–216 | zoals r2 | zoals r2 | zoals r2 | zoals r2 |
| 217 | — | — | — | UC-13/14/15 oude UI + rooktest Jurgen |
| 218 | host, pad, headers, redirect, override | — | fetch-spy | — |
| 219 | — | insert met `waste_*` → 42501 | — | — |
| **220** | `wasteSyncHealth.notice` (20 dec zonder J+1 = ja; 10 dec = nee; met J+1 = nee) | — | — | stille regel zichtbaar |
| **221** | `dueForFetch`: 05:59 nee, 06:00 ja, 12:00 nee na succes om 06:05, 17:00 ja, na een mislukking elk uur | — | verschuiving om 14:00 → taak om 17:xx aanwezig | — |
| **222** | — | — | zelfde adres bevestigen direct na een tick → `saved unchanged`, geen `too_soon`, notitie blijft; `version` gewijzigd → `UNKNOWN` | toast "Opgeslagen" |
| **223** | — | — | `appUrl.wasteSettings()` = `/instellingen/afvalkalender` | openen via melding → sectie in beeld |
| 224–235 | in hun WP (§15) | | | |

Daarnaast:
- regressie `30_wp2a`;
- privacyschema: geen persoonskolommen buiten `waste_calendars`;
- `route.test.ts` van de tick met `waste.moved`.

### 18.16 Uitrol (live op `main`, oude UI)

| # | Stap | Controle |
| --- | --- | --- |
| **P0** | Probe van de bron (§18.1.6), **vóór alle WP3b-code**, bij voorkeur vóór `/design-go` | verslag in `docs/wijzigingen/W-03/probe/`; beslissingen volgens §18.1.7; bij een wijzigingsverzoek-punt stoppen |
| U1 | Bouwen en lokaal groen: `test:db` (`70_afval.sql`, `gelijktijdig.sh`), vitest, integratie, E2E (oude UI + stub, alle scenario's) | alles groen |
| U2 | Reviews: code, test-writer, security, performance; herstellen | GO |
| **U3** | **Checkpoint CP-W03** (beeldreview vóór de livegang): rook-screenshots op 390×844 in `docs/screenshots/wp3b/`, gemaakt op de lokale stack met de stub. Minimaal: instellingen A, B, C, C2, D, E, F, `no_upcoming`, G, "Gedeeltelijk", `retrying`, december-regel, H per foutoorzaak (`stale`, `empty`, `ADDRESS_GONE`), I (met en zonder open taken), J (aan en uit, gezinslid), offline, fout bij opslaan, toasts (opgeslagen, `too_soon`, opnieuw proberen gelukt/mislukt, overslaan met Ongedaan maken); Vandaag met buitenzetten "vanaf 22:00" en na middernacht "vóór 07:45"; Binnenkort met binnenzetten vóór 12:00; Verlopen; taakdetail buiten en binnen (beheerder en gezinslid); Kalender-dag met afvaltaak; meldingenlijst met storingsmelding. Donker ook, als de oude UI dat heeft. **visual-qa** en **ux-reviewer (licht)** beoordelen het beeld; BLOKKEREND en GEMIDDELD worden hersteld vóór U4. Rapporten in `docs/reviews/wp3b-visual-qa.md` en `wp3b-ux-reviewer.md`; checkpoint in PROGRESS | GO van beide |
| U4 | `…_320`, dan `…_330` via `apply_migration`; push naar `main` (`fra1`) | beveiligingsadvies; RLS aan; L4 (`net.*`); `/api/status`; tick 200 met `waste.calendars = 0` |
| U5 | Rooktest met Jurgen (AC-217): zijn adres, vergelijken met de site, taken zichtbaar, de volgende dag "bijgewerkt" en de herinnering om 21:00. **De eerste echte opzoeking vanaf Vercel is ook de datacentertoets voor `fra1`**; faalt die met een blokkade, dan geldt §18.1.7 | akkoord in PROGRESS |
| U6 | Jurgen één keer herinneren aan het stoppen van zijn handmatige reeks (BR-57) | PROGRESS |
| U7 | `main` → `v2-ui` mergen | — |
| U8 | Succescriteria op dag 30 en 90 | PROGRESS |

**Terugrollen (plan-critic 10):**
1. Vercel Instant Rollback naar een deployment **zonder** WP3b.
2. **Direct daarna**, niet pas na een paar uur, `supabase/ops/waste_rollback.sql` via de koppeling:
   ```sql
   delete from public.tasks where waste_direction is not null and status in ('todo','in_progress');
   ```
   Reden: de oude tick ziet afvaltaken als gewone taken met `due_at`, en kan dezelfde nacht al "deadline nadert" sturen (rond 05:45) en daarna "verlopen" (V-50). Omdat de oude code geen afvaltaken maakt, is dit voldoende. De adresrij blijft staan. Na het opnieuw uitrollen van WP3b plant de eerstvolgende tick de taken vanzelf opnieuw, zonder dat de beheerder iets opnieuw hoeft in te voeren.
   - **Gevolg:** notities bij open afvaltaken gaan verloren (cascade). Dat is aanvaardbaar bij een noodterugrol, en er gaat geen adres of historie verloren.
   - **Wordt de terugrol definitief,** dan ook `delete from public.waste_calendars;` (adres weg, BR-58).
3. Een terugrol naar een deployment die WP3b al bevat, vraagt geen actie.

**Versimpeltoets terugrol:** "afvalkalender uitzetten" (ook het adres weg) is even effectief tegen verkeerde meldingen, maar wist meer dan nodig en dwingt de beheerder het adres opnieuw in te voeren. Alleen de open taken verwijderen is de kleinste ingreep die betrouwbaar werkt.

### 18.17 Afwijkingen, rechtgetrokken

**r1 → r2:** sleutel per dag en richting; adres alleen voor beheerders; niets bewaren bij een storing; leeg-bewaking over drie bakken samen; niemand wijzigt afvaltaken; 18:00, storingstype en vervallen; `jsonb` in plaats van een cachetabel; elk uur opnieuw na een storing.

**r2 → r3 (plan-critic W-03 ronde 1):**

| # | r2 | r3 |
| --- | --- | --- |
| 1 | probe pas bij U0, na het bouwen; "pg_net staat live sinds WP3" | probe = stap P0, vóór migraties en UI, bij voorkeur vóór de freeze; pg_net via `planner.sql` bij de WP3-livegang; datacentertoets en gemeenteregel erbij; beslisregel §18.1.7 |
| 6 | verschuiving = remove + insert (notities weg door cascade) | move van dezelfde rij als de nieuwe dag vrij is (≤ 3 dagen, gemeenschappelijke bak); anders de gewone regel |
| 7 | "eerder bekend" in de spec, niet in de TD; `failure_count` over alle soorten | één regel `isWindowEmpty`, ook bij het instellen (`no_upcoming`); `error_since` per foutcode, alarm na ≥ 60 min dezelfde code |
| 8 | W-03 voor de nieuwe UI alleen in §18.14 | W-03-regels in §15 bij WP4–WP9 + AC-224…AC-235 |
| 9 | WP3b zonder beeldreview | checkpoint CP-W03 met visual-qa en ux-reviewer vóór de livegang |
| 10 | terugrollen zonder stap voor afvaltaken | `waste_rollback.sql` direct na de rollback |
| 11 | één ophaling per dag (06:00) | 06:00 en 17:00, via één `dueForFetch`-regel |
| 12 | december: stil ontbrekende januaritaken | `notice: next_year_missing` (afgeleid) |
| 14 | bevestigen van hetzelfde adres via de claim → onterecht "te snel" | bevestigen zonder claim, met de eigen verse opvraging |
| 15 | platformlogs algemeen | Vercel External APIs (pad = Plus) en `net._http_response` expliciet |
| 4 | vaste omschrijving in de database | `description = null`; UI uit `waste_*` + UX §13.6 |
| — | meldings-URL `/instellingen#afvalkalender` + omleiding in WP7 | `/instellingen/afvalkalender` vanaf WP3b; in de oude UI een server-redirect naar het anker |

### 18.18 Versimpeltoets

| Onderdeel | Eenvoudigste variant | Gekozen? Waarom |
| --- | --- | --- |
| Ophaaldagen bewaren | niet bewaren | **Nee.** Bij een storing moeten de bekende dagen blijven gelden. Wel de kleinste vorm: één `jsonb`-kolom |
| Ophalen | stap in de bestaande tick | **Ja** |
| Tweede ophaalmoment | alleen 06:00 | **Nee.** Een verschuiving overdag komt dan te laat voor 21:00. Het kost één extra slot in dezelfde functie en 2–3 GET's per dag |
| Lock | voorwaardelijke update op `last_attempt_at` | **Ja.** Lease en rate limit tegelijk |
| Verschuiving | remove + insert | **Nee.** Stil verlies van notities en "bezig" door de cascade. Move kost één extra lijst in dezelfde RPC |
| Koppeling bij een verschuiving | op bak-niveau of met een "vorige datum"-kolom | **Nee.** Per dag met twee grenzen (≤ 3 dagen, gemeenschappelijke bak): deterministisch, puur en testbaar, zonder extra kolom |
| Storingsteller | `failure_count` over alle soorten | **Nee.** `error_since` per code: één kolom, meet tijd, en retry-spam versnelt het alarm niet |
| "Eerder bekend" in de leeg-regel | als voorwaarde meenemen | **Nee.** Het maakt de jaarwisseling juist blind. Dezelfde regel bij het instellen maakt de voorwaarde overbodig |
| December-waarschuwing | kolom of melding | **Nee.** Afgeleid uit `pickups` + datum, alleen een stille regel |
| Probe-route | allowlist in de ontwikkelomgeving | **Nee als enige route.** pg_net test tegelijk de datacentertoegang, zonder handeling van Jurgen |
| Vercel-proef vóór het bouwen | aparte deploy met een testroute | **Nee.** Dat vraagt een ongereviewde productiedeploy. pg_net zit in dezelfde cloud en regio; de restgrens wordt bij U5 zichtbaar en valt onder §18.1.7 |
| Omschrijving op de taak | vaste tekst in de database | **Nee.** Onjuist op D−1/D+1 en dubbel naast de infolijst; afleiden in de UI |
| Meldings-URL | anker + client-omleiding in WP7 | **Nee.** Een vaste route vanaf WP3b werkt in beide UI's zonder hash-logica |
| Terugrollen | adres + taken wissen | **Nee.** Alleen open taken wissen is voldoende en herstelt zichzelf na het opnieuw uitrollen |
| Vlag voor gezinsleden | kolom op `households` | **Nee.** Afgeleide functie |
| Doorwerking van overslaan | in de service | **Nee.** Een trigger dekt REST, de wachtrij en de actions |
| Verbod op wijzigen | alleen UI + service | **Nee.** De DB-guard is de grens |
| Eén of twee migraties | één | **Twee** (enum eerst committen) |

---

# (B) Regels voor de tabel in TD §15

**WP3b (volledig, vervangt de r2-regel):**

| **WP3b — Afvalkalender (W-03), live op `main` in de oude UI** | **Stap P0 eerst** (§18.1.6, vóór elke migratie, code en UI; bij voorkeur vóór `/design-go`): probe via pg_net vanuit het live project met het openbare testadres: `robots.txt`/voorwaarden, A/B/C(J)/C(J+1), datacentertoets, gemeenteregel 22:00/07:45 op de pagina zelf, opruimen van `net._http_response`. Afwijkingen volgens de beslisregel §18.1.7 (DECISIONS of stoppen en een wijzigingsverzoek). Daarna: migraties `…_320` en `…_330` (§18.3–18.7), `src/domain/waste/*` (inclusief move, `isWindowEmpty`, `error_since`-gezondheid, twee ophaalmomenten, december-notice), `src/server/waste/*`, `system/waste/sync.ts`, `actions/waste.ts`, tickstap, `wasteReminder`, `recipientsFor`, route `instellingen/afvalkalender` (redirect), `supabase/ops/waste_rollback.sql`; oude UI volgens §18.14; tests §18.15 met stub-scenario's. **Checkpoint CP-W03 (U3) vóór de livegang.** Uitrol U4–U8 | **WP3 live** (pg_net via `planner.sql`, tick elke 15 min). Niet WP4+ | BR-47…BR-59, UC-13…UC-15, AC-183…AC-223, V-41…V-57 | **CP-W03**: rook-screenshots van alle toestanden van de oude UI (lijst in §18.16 U3), 390×844, in `docs/screenshots/wp3b/`; checkpoint in PROGRESS | code, test-writer, **security** (bron, SSRF/allowlist, adres = persoonsgegeven, RLS/guard/RPC's, platformlogs §18.12), **performance** (tickduur met en zonder ophalen), **visual-qa + ux-reviewer (licht) op CP-W03 vóór U4**; rooktest Jurgen (AC-217) |

**W-03-regels om toe te voegen aan de bestaande rijen** (kolom "Doel en inhoud" en kolom "BR / UC / bevindingen"):

- **WP4:** "✚ W-03: de expliciete kolomlijst van `work` bevat `waste_pickup_date`, `waste_direction` en `waste_streams` (`description` blijft alleen in het detail); de `core`-slice krijgt `wasteCalendarEnabled` via `rpc('waste_calendar_enabled')`; de IDB-cache werkt ook met oudere items zonder deze velden (die worden als gewone taak getoond tot de verversing). `isWasteTask` en de permissiehelpers gelden in de nieuwe store." Criteria: **AC-224**.
- **WP5:** "✚ W-03: lijstrij met meta `♻ Afvalkalender` en rechterkolom en plek volgens UX §13.4 (buitenzetten tot 07:45 onder Vandaag, binnenzetten vóór 12:00 onder Binnenkort, Verlopen); taakdetail volgens UX §13.6 (Afvinken primair; Bezig en Deze keer overslaan secundair; geen ⋯, geen Naar morgen, Andere dag, Bewerken of Verwijderen; infolijst, uitlegregel, notities; geen Vorige keren); overslaan-toast met Ongedaan maken van beide; optimistisch overslaan van `out` neemt `in` mee, ook via de wachtrij; verplaatsen of bewerken van een afvaltaak komt nooit in de wachtrij." Criteria: **AC-225, AC-226, AC-227**. Screenshots van afvalrij en afvaldetail horen bij CP2 en CP3.
- **WP6:** "✚ W-03: Taken › Terugkerend toont bovenaan de informatierij volgens UX §13.11 als `wasteCalendarEnabled` (pijl alleen voor beheerders, naar `/instellingen/afvalkalender`); `?bewerk=<id>` van een afvaltaak opent `?taak=<id>`; 'Wat wil je wijzigen?' en 'omzetten naar terugkerend' zijn nooit bereikbaar voor afvaltaken; zoeken en het categoriefilter vinden afvaltaken." Criteria: **AC-228, AC-229**.
- **WP7:** "✚ W-03: de route `/instellingen/afvalkalender` wordt de echte subpagina (vervangt de redirect uit WP3b) met alle toestanden uit UX §13.8, inclusief `no_upcoming`, december-regel, H per foutoorzaak, toasts en offline; de rij 'Afvalkalender · Aan / Uit / ⓘ Niet bijgewerkt' in de groep Huishouden (gezinslid: rij zonder pijl + regel volgens UX §13.8); het uitzetten volgens UX §13.7.3. Hergebruikt de actions en `getWasteSettings` uit WP3b ongewijzigd." Criteria: **AC-230, AC-231**. Hoort bij de CP3-aanvulling (instellingen).
- **WP8:** "✚ W-03: Kalender dag, week en maand zonder slepen voor afvaltaken ('+ Taak' blijft; regel 'Ophaaldagen verschijnen 14 dagen vooraf' volgens UX §13.11); meldingenlijst met label en icoon voor `waste_sync_failed`, link naar `/instellingen/afvalkalender`; Overzicht groepeert afvaltaken per `waste_direction` onder de namen uit UX §13.11, automatisch overgeslagen buitenzetten telt als vergeten, vervallen (verwijderde) afvaltaken tellen niet mee." Criteria: **AC-232, AC-233, AC-234**. Hoort bij de CP4-voorbereiding.
- **WP9:** "✚ W-03: E2E-kernflow afvalkalender in de nieuwe UI (aanzetten, Vandaag, detail, overslaan, storing zichtbaar voor beheerder en niet voor gezinslid) met de stub; CP4 bevat de afvaltoestanden." Criteria: **AC-235** (aanvulling bij AC-167).

---

# (C) Korte aanvullingen in bestaande TD-secties
Gelijk aan r2 (C), met deze wijzigingen:
- **§3.1:** bij `waste_calendars` staat "`error_since` in plaats van `failure_count`".
- **§3.2:** bij `…_330` staat "`waste_sync` met `p_move`".
- **§6.5:** `waste` bevat ook `moved`.
- **§10, rij Huisvuilkalender:** "twee keer per dag (06:00/17:00), na een mislukking elk uur; eerst probe P0 (§18.1.6)".
- **§11.2:** "Kolommen van `work` bevatten `waste_*` (W-03); `core` bevat `wasteCalendarEnabled`".
- **§12, terugrollen:** verwijzing naar §18.16 (`waste_rollback.sql`).
- **§15, "Uitrol (V-36)":** "WP1, WP2a, WP2b, WP3 en WP3b gaan direct live op `main`".
- **§5.3, punt 5:** "`waste_sync`: afvaltaken invoegen, verschuiven, hernoemen of verwijderen als ze open zijn".

---

# (D) Exacte tekst voor BR en AC (voor de analist)
Teksten die de UI toont, staan hier alleen als verwijzing naar UX §13 (één bron). De analist neemt de UX-tekst over of verwijst ernaar.

**BR-48, bullet "Wanneer het adres wordt bewaard", vervangen door:**
> - **Wanneer het adres wordt bewaard:** pas nadat de huisvuilkalender het adres kent, precies één adres oplevert en minstens één ophaaldag voor rest, papier of PMD geeft **in de komende 14 dagen (vandaag t/m vandaag + 14)**, én de beheerder "Klopt dit?" heeft bevestigd. Geeft de gemeente voor die 14 dagen nog geen ophaaldagen (bijvoorbeeld eind december, als de nieuwe kalender nog niet online staat), dan wordt er niets bewaard en ziet de beheerder de tekst uit UX §13.8 (toestand "no_upcoming"). — waarom: dan geldt bij het instellen dezelfde regel als bij het bijwerken (BR-52), en kan een net bewaard adres niet meteen als storing gelden.

**BR-51, eerste bullet vervangen en een bullet toevoegen:**
> - De app controleert de agenda twee keer per dag, rond 06:00 en rond 17:00. Een wijziging staat uiterlijk 24 uur later in de app; een wijziging die de gemeente overdag doorvoert, staat er meestal dezelfde avond al in.
> - **Verschuiven betekent: dezelfde taak krijgt de nieuwe dag.** Notities, en de stand "bezig", blijven staan. Dat gebeurt als de nieuwe ophaaldag hooguit 3 dagen van de oude ligt, minstens één van dezelfde bakken heeft, en er voor die dag en richting nog geen afvaltaak is. Anders vervalt de oude taak zoals bij een verdwenen ophaaldag, en komt er voor de nieuwe dag een nieuwe taak. Buitenzetten schuift alleen mee zolang het nieuwe moment (07:45 op de nieuwe ophaaldag) nog niet voorbij is.

**BR-52, bullet "Een volledig leeg antwoord" en bullet "Langer dan 48 uur" vervangen door:**
> - **Een leeg antwoord:** geeft de bron voor rest, papier en PMD **samen** geen enkele ophaaldag van vandaag t/m vandaag + 14, dan is dat een verdacht leeg antwoord en geen "alle ophaaldagen vervallen". De afvaltaken, het adres en de bekende ophaaldagen blijven ongewijzigd, en er volgt later een nieuwe poging. Dit geldt ook bij de jaarwisseling, als de nieuwe kalender nog niet online staat.
>   - Een enkele bak zonder ophaaldagen geldt **niet** als leeg antwoord. Voorbeeld: papier wordt van 19 december tot 5 januari niet opgehaald.
> - **Wanneer het een storing is.** Er is een storing als:
>   - (a) het bijwerken al meer dan 48 uur niet gelukt is (V-50), om welke reden ook; of
>   - (b) de bron twee of meer keer achter elkaar een leeg antwoord gaf, met minstens een uur tussen het eerste en het laatste lege antwoord, en zonder een andere uitkomst ertussen. Een andere fout (bijvoorbeeld "onbereikbaar") tussen twee lege antwoorden laat de telling opnieuw beginnen. Vaker "Opnieuw proberen" maakt de storing niet eerder.
> - **Bij een storing:**
>   - de beheerders zien in Instellingen de waarschuwing uit UX §13.8 (toestand H), met de tekst die bij de oorzaak hoort;
>   - elke actieve beheerder krijgt **één** melding met de tekst uit UX §13.10. De melding linkt naar de instellingen van de afvalkalender (BR-25) en wordt pas opnieuw verstuurd na een nieuwe storing, dus nadat het bijwerken eerst weer gelukt is;
>   - gezinsleden krijgen geen melding en zien geen waarschuwing (V-53).
> - **Korter dan een storing:** de beheerder ziet alleen de stille regel uit UX §13.7.5. Er komt geen melding.
> - **December:** is het december, lopen de komende 14 dagen al over de jaargrens, en kent de app nog geen enkele ophaaldag van het nieuwe jaar, dan ziet de beheerder een stille regel (UX §13.8). Er komt geen melding.

**AC-198, vervangen door:**
> ### AC-198 — Verschoven ophaaldag (feestdag) (WP3b; BR-51)
> GEGEVEN een open buitenzet-taak (met een notitie van Ellen en de stand "bezig") en een open binnenzet-taak voor ophaaldag vrijdag 25 december 2026, en de gemeente verschuift die dag naar zaterdag 26 december
> WANNEER het bijwerken draait
> DAN:
> - staat **dezelfde** buitenzet-taak op vrijdag 25 december met als uiterste moment zaterdag 26 december 07:45, en **dezelfde** binnenzet-taak op zaterdag 26 december;
> - staan de notitie van Ellen en de stand "bezig" er nog;
> - zijn er voor ophaaldag 25 december geen afvaltaken meer;
> - is er niets als vergeten of overgeslagen geteld, en staat er niets in de historie.
>
> Ligt de nieuwe ophaaldag meer dan 3 dagen van de oude, heeft hij geen enkele bak gemeen met de oude, of bestaat er voor die dag en richting al een afvaltaak, dan vervalt de oude open taak (zoals in AC-199) en komt er voor de nieuwe dag een nieuwe taak (als het moment nog niet voorbij is).
> **Toets:** Unit + DB + Int

**AC-204, vervangen door:**
> ### AC-204 — Bron tijdelijk onbereikbaar, onbruikbaar of leeg (WP3b; BR-52)
> GEGEVEN een bewaard adres met afvaltaken, en de gemeentebron geeft een van deze antwoorden:
> - (a) een fout, een time-out of een onbegrijpelijk antwoord;
> - (b) voor rest, papier en PMD samen geen enkele ophaaldag van vandaag t/m vandaag + 14, ook op 1 januari als de kalender van het nieuwe jaar nog ontbreekt
> WANNEER het bijwerken draait
> DAN:
> - verandert er niets aan de afvaltaken, het adres en de bekende ophaaldagen;
> - verschijnen er geen verzonnen ophaaldagen;
> - draaien de andere stappen van de achtergrondtaak gewoon (vergelijk AC-076);
> - wordt het uiterlijk een uur later opnieuw geprobeerd;
> - bevat de log alleen een code, geen adres en geen adrescode;
> - is er na één zo'n antwoord nog geen storing (dus geen melding en geen waarschuwing), alleen de stille regel uit UX §13.7.5.
>
> Geeft de bron alleen voor papier geen dagen, terwijl rest of PMD wel dagen heeft in die 14 dagen, dan is dat geen leeg antwoord. De open papiertaken voor verdwenen dagen vervallen volgens AC-199.
> **Toets:** Unit + Int

**AC-205, vervangen door:**
> ### AC-205 — Storing (WP3b; BR-52, BR-55; V-50)
> GEGEVEN Jurgen en Ellen (beheerders, Ellen met herinneringen uit) en Lynn (gezinslid), en:
> - (a) het bijwerken lukt al meer dan 48 uur niet; of
> - (b) de bron geeft om 06:00 een leeg antwoord (AC-204 b), en om 07:00 opnieuw
> WANNEER de achtergrondtaak daarna nog meerdere keren draait
> DAN:
> - zien Jurgen en Ellen in Instellingen de waarschuwing uit UX §13.8 (toestand H), met de tekst voor die oorzaak;
> - krijgen Jurgen en Ellen elk precies één melding met de tekst uit UX §13.10 en een link naar de instellingen van de afvalkalender, en niet bij elke ronde opnieuw;
> - krijgt Lynn geen melding en ziet ze geen waarschuwing;
> - noemt de melding het adres niet.
>
> Geen storing zijn: één leeg antwoord; een leeg antwoord om 06:00 en opnieuw om 06:30 (minder dan een uur ertussen); en "onbereikbaar" om 06:00 gevolgd door een leeg antwoord om 07:00. Lukt het bijwerken weer, dan verdwijnt de waarschuwing en worden de taken aangevuld. Een latere, nieuwe storing geeft opnieuw één melding.
> **Toets:** Unit + Int + E2E

**AC-217, laatste zin vervangen door:**
> In de nieuwe schermen gelden AC-224 t/m AC-235.

**Nieuwe criteria voor WP3b (AC-220 t/m AC-223):**
> ### AC-220 — Kalender volgend jaar ontbreekt nog (WP3b; BR-52)
> GEGEVEN het is 20 december, het bijwerken lukt, en de gemeente heeft nog geen ophaaldagen voor het nieuwe jaar online
> WANNEER een beheerder de instellingen van de afvalkalender opent
> DAN ziet hij de stille regel uit UX §13.8 over de ontbrekende kalender van het volgende jaar. Er komt geen melding, en een gezinslid ziet niets. Op 10 december, of zodra er ophaaldagen van het nieuwe jaar bekend zijn, staat de regel er niet.
> **Toets:** Unit + E2E

> ### AC-221 — Ook een wijziging overdag komt op tijd (WP3b; BR-51)
> GEGEVEN het bijwerken om 06:00 is gelukt, en om 14:00 zet de gemeente een nieuwe ophaaldag voor morgen online
> WANNEER de achtergrondtaak na 17:00 draait
> DAN staat de buitenzet-taak voor morgen vóór 17:30 in de app, en komt de herinnering om 21:00. Tussen 06:00 en 17:00 wordt er na een geslaagde bijwerking niet opnieuw bij de gemeente opgevraagd.
> **Toets:** Unit + Int

> ### AC-222 — Hetzelfde adres opnieuw bevestigen (WP3b; BR-48, BR-56)
> GEGEVEN de afvalkalender staat aan, er staat een notitie bij een open afvaltaak, en de achtergrondtaak heeft een halve minuut geleden bijgewerkt
> WANNEER een beheerder hetzelfde adres opnieuw invoert en "Ja, aanzetten" kiest
> DAN ziet hij "Opgeslagen" (UX §13.7.1) en niet "te snel", blijven de open afvaltaken met hun notitie en "bezig" staan, en ontstaan er geen dubbele taken.
> **Toets:** Int + E2E

> ### AC-223 — De storingsmelding opent de juiste plek (WP3b; BR-25, BR-52)
> GEGEVEN een beheerder heeft een storingsmelding van de afvalkalender
> WANNEER hij de melding opent, in de huidige schermen of later in de nieuwe
> DAN komt hij bij de instellingen van de afvalkalender (huidige schermen: de sectie Afvalkalender in beeld; nieuwe schermen: de subpagina), zonder foutpagina.
> **Toets:** Int + E2E

**Nieuwe criteria voor WP4–WP9 (AC-224 t/m AC-235):**
> ### AC-224 — Afvalgegevens in de nieuwe gegevenslaag (WP4; TD §11.2, §18.14)
> GEGEVEN afvaltaken in het venster van de taken, en een gezinslid en een beheerder
> WANNEER de app laadt, online en offline uit de cache
> DAN heeft elke afvaltaak zijn ophaaldag, richting en bakken, weet de app of de afvalkalender aan staat, en zijn bij afvaltaken voor niemand de knoppen voor bewerken, verplaatsen en verwijderen beschikbaar.
> **Toets:** Unit + Int

> ### AC-225 — Afvaltaak in de lijst (WP5; UX §13.4, §13.5)
> GEGEVEN ophaaldag dinsdag 6 oktober voor restafval en papier
> WANNEER Vandaag wordt bekeken op maandag 14:00, dinsdag 06:30, dinsdag 09:00, dinsdag 11:00, dinsdag 13:00 en woensdag 09:00
> DAN staan de taken op de plek en met de rechterkolom uit de tabel in UX §13.4, met het kenmerk "Afvalkalender", en nergens "21:00".
> **Toets:** Unit + E2E

> ### AC-226 — Taakdetail van een afvaltaak (WP5; UX §13.6; BR-53)
> GEGEVEN een open buitenzet-taak, geopend door een beheerder en door een gezinslid
> WANNEER het detail opent
> DAN zijn Afvinken, Ik ben ermee bezig, Deze keer overslaan en notities beschikbaar; ontbreken Naar morgen, Andere dag, Bewerken, Verwijderen en Vorige keren; staan de infolijst en de uitlegregel uit UX §13.6 er; en geeft overslaan de melding uit UX §13.6, waarbij Ongedaan maken beide taken terugzet.
> **Toets:** E2E

> ### AC-227 — Overslaan zonder verbinding (WP5; BR-53)
> GEGEVEN een gezinslid is offline
> WANNEER hij buitenzetten overslaat, en later weer online komt
> DAN staan buitenzetten en binnenzetten direct als overgeslagen in beeld, gaat de actie na het herstel van de verbinding één keer naar de server, en klopt de eindstand met de server. Bewerken of verplaatsen van een afvaltaak kan offline niet in de wachtrij komen.
> **Toets:** Int + E2E

> ### AC-228 — Informatierij bij Terugkerend (WP6; UX §13.11)
> GEGEVEN de afvalkalender staat aan
> WANNEER een beheerder en een gezinslid Taken › Terugkerend openen
> DAN zien beiden bovenaan de informatierij uit UX §13.11; alleen de beheerder heeft een pijl naar de instellingen van de afvalkalender. Staat de afvalkalender uit, dan is de rij er niet.
> **Toets:** E2E

> ### AC-229 — Geen bewerkformulier voor afvaltaken (WP6; BR-53)
> GEGEVEN een afvaltaak
> WANNEER iemand de link om die taak te bewerken opent
> DAN opent het taakdetail en niet het formulier. "Wat wil je wijzigen?" en omzetten naar terugkerend zijn niet bereikbaar.
> **Toets:** E2E

> ### AC-230 — Instellingen › Afvalkalender in de nieuwe schermen (WP7; UX §13.8; AC-183…AC-191, AC-213, AC-214)
> GEGEVEN een beheerder en een gezinslid
> WANNEER zij de subpagina openen, en de beheerder alle toestanden doorloopt (zoeken, Klopt dit?, meerdere adressen, onbekend, geen bakken, geen ophaaldagen, onbereikbaar, aan, storing per oorzaak, december-regel, uitzetten, offline)
> DAN klopt elke toestand met UX §13.8; ziet het gezinslid alleen of de afvalkalender aan staat; en gedragen opslaan, wijzigen en uitzetten zich zoals in AC-183 t/m AC-191, AC-213 en AC-214.
> **Toets:** E2E

> ### AC-231 — Rij in Instellingen en oude links (WP7; UX §13.8; AC-223)
> GEGEVEN de afvalkalender staat aan, uit of heeft een storing
> WANNEER Instellingen opent
> DAN toont de rij in de groep Huishouden de waarde uit UX §13.8 (beheerder met pijl, gezinslid zonder), en opent een storingsmelding van vóór de nieuwe schermen de subpagina.
> **Toets:** E2E

> ### AC-232 — Kalender zonder slepen (WP8; UX §13.11; BR-53)
> GEGEVEN afvaltaken in de dag-, week- en maandweergave
> WANNEER iemand een afvaltaak probeert te slepen
> DAN beweegt hij niet en verandert er niets. "+ Taak" per dag blijft werken, en de regel "Ophaaldagen verschijnen 14 dagen vooraf" staat er volgens UX §13.11.
> **Toets:** E2E

> ### AC-233 — Storingsmelding in de meldingenlijst (WP8; BR-52)
> GEGEVEN een beheerder met een storingsmelding van de afvalkalender
> WANNEER hij Meldingen opent
> DAN staat de melding er met het label en icoon uit UX §13.10, en opent hij de subpagina.
> **Toets:** E2E

> ### AC-234 — Afvaltaken in het Overzicht (WP8; UX §13.11; BR-51, BR-54)
> GEGEVEN in 30 dagen afvaltaken met verschillende combinaties van bakken: afgevinkt, te laat, vanzelf overgeslagen, en vervallen door een verdwenen ophaaldag
> WANNEER het Overzicht wordt bekeken
> DAN tellen de afvaltaken samen onder de twee namen uit UX §13.11 (buiten en binnen); telt een vanzelf overgeslagen buitenzet-taak als vergeten; en telt een vervallen afvaltaak nergens mee.
> **Toets:** Unit + E2E

> ### AC-235 — Kernflow afvalkalender in de nieuwe schermen (WP9; AC-167)
> GEGEVEN de volledige nieuwe interface met de nagebootste gemeentebron
> WANNEER de E2E-suite draait
> DAN dekt hij: aanzetten, afvaltaken op Vandaag, detail en overslaan met ongedaan maken, een storing die de beheerder wel en het gezinslid niet ziet, en uitzetten. CP4 bevat de afvaltoestanden.
> **Toets:** E2E

**Dekkingstabel, aanpassen:**
- BR-48 → + AC-222;
- BR-51 → AC-198 t/m AC-202, AC-221;
- BR-52 → AC-204, AC-205, AC-220, AC-223;
- BR-53 → + AC-226, AC-227, AC-229, AC-232;
- V-46 → AC-217, AC-224…AC-235.

---

### Vragen voor Jurgen (beleid, kosten, verplichtingen)
- **Geen nieuwe vragen.**
- **Conditioneel, alleen als P0 het laat zien:** `robots.txt` of voorwaarden sluiten het uit, blokkade vanuit het datacenter, andere tijden dan 22:00/07:45, of meer gegevens naar buiten nodig.
  - Opties: (a) toch gebruiken, met risico op blokkade; (b) de gemeente om toestemming vragen; (c) terug naar gewone terugkerende taken.
  - Voorstel: (b), en tot die tijd (c).
- **Voor het totaalvoorstel, in gewone taal (plan-critic 16):**
  - de bron is een onofficiële koppeling die zonder aankondiging kan wegvallen;
  - naast postcode en huisnummer wordt ook de adrescode van de gemeente (BAG-id) bewaard, alleen zichtbaar voor beheerders;
  - overslaan van buitenzetten slaat ook binnenzetten over;
  - binnenzetten vervalt vanzelf;
  - een aanhoudend leeg antwoord geeft al na ruim een uur een melding;
  - er staan dubbele taken tot Jurgen zijn eigen reeks stopt;
  - bij een verschuiving door de gemeente blijven notities staan, behalve bij een grote wijziging (meer dan 3 dagen, of een andere bak).

### Vragen en punten voor de hoofdsessie
1. **P0 vóór `/design-go` uitvoeren**, via pg_net op live met het openbare testadres. Controleer eerst of `pg_net` er staat (`planner.sql`). Het is geen wijziging aan de database, wel een uitgaand verzoek vanuit productie. Voorstel: dit valt onder de gegeven toestemming voor de live database via de koppeling; meld het Jurgen in één zin. Verwerk de uitkomsten vóór de freeze in TD, BR en AC (dan geen wijzigingsverzoek nodig).
2. **Product-designer (UX §13-tekstentabel), sleutels die de TD verwacht:**
   - `no_upcoming`;
   - de december-regel;
   - H per `lastErrorCode` (`stale`/`empty`/`ADDRESS_GONE`, en eventueel `UNREACHABLE`/`FORMAT`);
   - `too_soon`;
   - opnieuw proberen gelukt / nog steeds niet;
   - "opgeslagen" ook bij hetzelfde adres;
   - fout bij opslaan;
   - herinneringsteksten enkel- en meervoud;
   - storingsmelding per reden;
   - FORBIDDEN-tekst;
   - de 0-takenvariant van de uitzetbevestiging (plan-critic 17);
   - of "Herinnering: …" in de infolijst alleen verschijnt als de eigen instelling aan staat (plan-critic 13; technisch kan dat, want de eigen voorkeuren staan in `core`).
   - Verder moet UX §13.7.5 "terwijl die er eerder wel waren" laten vallen (regel §18.8.4).
3. **Analist:** de tekst uit (D) overnemen. De nummers AC-220…AC-235 zijn een voorstel; hernummeren mag, als TD §15 en §18.15 dan mee worden aangepast.
4. **PROGRESS:** CP-W03 als checkpoint van WP3b opnemen, en de stap P0 als eerste stap.

### Bewuste vereenvoudigingen
- P0 alleen via pg_net (tegelijk de datacentertoets), zonder aparte Vercel-proefdeploy. De restgrens wordt bij de rooktest zichtbaar en valt onder de beslisregel.
- Verschuiving als update van dezelfde rij, gekoppeld per dag met twee eenvoudige grenzen, zonder extra kolom.
- Eén leeg-regel (`isWindowEmpty`) voor instellen én bijwerken. `error_since` vervangt `failure_count`.
- Twee ophaalmomenten via één `dueForFetch`-regel, die ook het uurlijks opnieuw proberen dekt.
- December-waarschuwing afgeleid, zonder kolom en zonder melding.
- Geen omschrijving in de database voor afvaltaken.
- Meldings-URL als vaste route vanaf WP3b, zonder hash-omleiding.
- Terugrollen: alleen open afvaltaken wissen. Dat herstelt zichzelf na het opnieuw uitrollen.

### Status
**KLAAR VOOR PLANREVIEW** voor de punten van de architect (moet 1, 6, 7, 8 en 9, en aanbevelingen 10, 11, 12, 14, 15 en 16). Twee voorwaarden: de analist verwerkt (D), en de product-designer levert de tekstentabel met de sleutels uit punt 2. Sterk aanbevolen: P0 vóór `/design-go`.

Relevante bestanden:
- /home/user/takenlijstje/docs/reviews/plan-critic.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/solution-architect-r2.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-analyst-r2.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-designer-r1.md
- /home/user/takenlijstje/docs/TECHNICAL_DESIGN.md (§11.2, §15)
- /home/user/takenlijstje/supabase/ops/planner.sql
- /home/user/takenlijstje/src/app/(app)/instellingen/page.tsx

Bronnen:
- [Den Haag — Huishoudelijk afval aanbieden](https://www.denhaag.nl/nl/afval/huisvuil-aanbieden/) (alleen via zoekresultaten, zelf te bevestigen in P0.4)
- [Supabase — pg_net](https://supabase.com/docs/guides/database/extensions/pg_net)
- [pg_net API-referentie](https://supabase.github.io/pg_net/api/)
- [Vercel — External API caching insights](https://vercel.com/changelog/external-api-caching-insights-now-in-observability)
- [Vercel — Query data on external API requests](https://vercel.com/changelog/query-data-on-external-api-requests-in-vercel-observability)
- Uit r2: Vercel Functions duration/limits, PostgreSQL ALTER TYPE, MDN RequestInit.redirect