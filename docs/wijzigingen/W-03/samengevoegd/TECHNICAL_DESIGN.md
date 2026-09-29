## Technisch ontwerp: W-03 afvalkalender, samengevoegde invoegtekst (ronde 7)

Ik heb niets in bestanden geschreven, want `docs/TECHNICAL_DESIGN.md` is bevroren.

**Documentatie gecontroleerd.** Er was geen nieuwe externe documentatie nodig.
- De bronnen uit r3/r4 blijven gelden: pg_net `sql/pg_net.sql`, PR #285, MDN `redirect` en Vercel Observability.
- Koppelcontract: `docs/wijzigingen/W-03/probe/P0-uitkomst.md` (P0 en U0.2, 2026-09-29) en `fixtures-2591BB-87.json`.
- zod: `^4.6.5` (package.json). Daarom `z.strictObject({})` in het voorbeeld.

**Work packages:** WP3b (live op `main`, oude UI), plus de W-03-regels voor WP4–WP9 (`v2-ui`).

**Hoe samengevoegd:**
- **Basis:** r4 (A, B, C). Daarop r5 en daarna r6; bij overlap geldt de laatste.
- **(C)-keten:** r4 (C) zegt "gelijk aan r3 (C)", en r3 (C) zegt "gelijk aan r2 (C)". Daarom is r2 (C) de onderste laag, met r3 en r4 als wijzigingen erop.
- **Plan-critic W-03 r3, moet 3:**
  - §10 zegt nu "P0 uitgevoerd";
  - `classifyEmpty` staat in §18.2;
  - rij 204 in §18.15 is gesplitst per functie (geen "(e) alle eerdere r5-gevallen" meer);
  - T-64 wordt geciteerd als "rond de jaarwisseling";
  - `isWindowEmpty` is overal weg.
- **Moet 4:** U3 is aangevuld met laden en laden mislukt (T-68), overgeslagen afvaltaak met "Toch nog doen", binnenzetten bij Verlopen op D+1, balk die blijft bij een wisseling van oorzaak (H2 → H1), T-90b, en de eerstvolgende dag over 3 weken.
- **Aanvulling van de hoofdsessie:** bij H2 blijven de bewaarde datums onder "Volgende ophaaldagen · stand …" staan. Dit staat in U3 (punt 21) en is in §18 op vier plekken expliciet gemaakt: §18.6 `getWasteSettings`, §18.8.4, §18.11 en §18.15 rij 205.
- **Aanbeveling 7:** C(J−1) is geschrapt. Regel: januari zonder komende datum geeft altijd F2.
- **Aanbeveling 8:** "C(J+1) bevat geen datum van rest, papier of PMD".
- **Aanbeveling 10:** U5-blokkade: de afvalkalender blijft uit, er wordt geen adres bewaard, en er komt een wijzigingsverzoek.
- **U0.2 verwerkt:**
  - B geeft `{}` bij een onbekende adrescode. De parser herkent dat expliciet als `NOT_FOUND`, niet als FORMAT: `ADDRESS_GONE` bij het bijwerken, `not_found` bij het instellen;
  - C geeft `[]`;
  - het vorige jaar blijft opvraagbaar, maar wordt niet gebruikt;
  - U0.2 is afgerond.

---

=== §18 (nieuw, volledig) ===

Doelplek: nieuwe sectie `## 18. Afvalkalender (W-03)`, direct na §17 (einde document).

## 18. Afvalkalender (W-03)

**Basis:**
- PRODUCT_SPEC §14 (BR-47…BR-59, UC-13…UC-15);
- UX_SPEC §13, met de tekstentabel §13.16 als **enige bron** voor zichtbare teksten;
- ACCEPTANCE_CRITERIA WP3b (**AC-183…AC-223, AC-236, AC-237**) en de W-03-aanvullingen in WP4–WP9 (AC-224…AC-235);
- de besluiten V-41…V-57, en V-58 (bewaren van de adrescode) [OPEN: V-58];
- D-046 (rechten van pg_net op live);
- de uitkomst van P0 en U0.2 (`docs/wijzigingen/W-03/probe/P0-uitkomst.md`, 2026-09-29).

**Uitgangspunten:**
- Afvaltaken zijn gewone rijen in `tasks`, met drie extra kolommen. Alleen het systeem maakt ze, verschuift ze, hernoemt ze en verwijdert ze.
- Leden wijzigen alleen de status: afvinken, terugdraaien, bezig en overslaan. Notities gaan zoals altijd via `task_comments`.
- De planning is een pure functie in `src/domain/waste/`. Toepassen gebeurt atomisch in één RPC.
- **Teksten:** deze sectie legt alleen vast welke uitkomst tot welke toestand en welk tekst-ID leidt (T-xx/M-xx uit UX §13.16). De code bevat die teksten één keer, in `src/domain/waste/messages.ts`, met de ID als commentaar.

### 18.1 De bron: koppelcontract, allowlist en SSRF

#### 18.1.1 Endpoints (platform Opzet, onofficieel en ongedocumenteerd; bevestigd door P0 en U0.2 op 2026-09-29)

| # | Verzoek | Doel | Gedrag volgens P0/U0.2 | Gebruik |
| --- | --- | --- | --- | --- |
| A | `GET /rest/adressen/{POSTCODE}-{huisnummer}` | adres → kandidaten met `bagId`, `huisletter`, `huisnummerToevoeging` | 200, JSON-array; onbekend adres → 200 `[]` (geen 404) | alleen bij het instellen (opzoeken en bevestigen) |
| B | `GET /rest/adressen/{bagId}/afvalstromen` | soorten: `id`, `title`, `menu_title`, `icon` | 200, array met alle 5 soorten, ook zonder datums (~20 KB); **onbekende adrescode → 200 `{}`** (een leeg object, geen lijst en geen 404) | bij elke ophaling: vertaling van `afvalstroom_id` naar een bak, en herkennen van "adres weg" |
| C | `GET /rest/adressen/{bagId}/kalender/{jaar}` | ophaaldagen van een jaar: `afvalstroom_id`, `ophaaldatum` | 200, array; nog niet gepubliceerd jaar → `[]`; onbekende adrescode → `[]`; een vorig jaar blijft opvraagbaar | jaar J altijd. **J+1 in december, en ook zodra C(J) voor rest, papier en PMD geen komende datum meer heeft (in elke maand).** J−1 wordt **nooit** opgehaald (§18.8.1) |

Endpoint D (meldingen van de gemeente) valt buiten de scope (PRODUCT_SPEC §10).

#### 18.1.2 Vaste host, geen redirects, beperkte invoer (SSRF)

- **Basis-URL:** de constante `WASTE_SOURCE_BASE_URL = "https://huisvuilkalender.denhaag.nl"` in `src/server/waste/source.ts`. Er gaat nooit een URL of host uit invoer mee.
  - **Uitzondering, alleen voor tests en E2E:** de omgevingsvariabele `WASTE_SOURCE_BASE_URL` telt alleen als hij exact voldoet aan `^http://127\.0\.0\.1:\d{2,5}$`. Elke andere waarde wordt genegeerd, met de logregel `[waste] override genegeerd`.
- **Paden:** alleen uit gevalideerde waarden:
  - postcode `^[1-9][0-9]{3}[A-Z]{2}$`;
  - huisnummer 1–99999;
  - `bagId` `^[0-9]{16}$` (P0: string met voorloopnul);
  - jaar 2020–2100;
  - elk segment gaat door `encodeURIComponent`;
  - de toevoeging gaat **nooit** naar de bron.
- **Fetch:** `method: "GET"`, `redirect: "error"`, `cache: "no-store"`, geen credentials en geen cookies.
  - Headers alleen `Accept: application/json` en `User-Agent: Takenlijstje/1 (prive gezinsapp)`.
  - Nooit een naam, e-mailadres, huishoud-id of lid-id (AC-218).
- **Antwoord:** status 200, een `content-type` met `json`, body via de stream met een grens van 1 MB, daarna `JSON.parse` en zod.
- **Time-outs:** per verzoek `AbortSignal.timeout(8000)`, samen met een totaalbudget via `AbortSignal.any`. Het totaalbudget is 12 s per server action en 12 s voor de ophaalstap in de tick.

#### 18.1.3 Resultaattype (gooit nooit bij netwerk- of formaatfouten)

```ts
type SourceError = "UNREACHABLE" | "FORMAT" | "NOT_FOUND";
type SourceResult<T> = { ok: true; value: T } | { ok: false; code: SourceError; http?: number };
lookupAddress(postcode, houseNumber, deps)   // A; 200 [] → ok [] (onbekend adres, geen fout)
fetchStreams(bagId, deps)                     // B; 200 {} (U0.2), 200 [] of 404 → NOT_FOUND
fetchYear(bagId, year, deps)                  // C; 200 [] of 404 → ok [] (geen fout)
fetchPickups(bagId, today, deps):
  SourceResult<{ pickups: WastePickups;
                 unknownStreams: number;
                 hadAnyDateInJ: boolean;     // minstens één datum van rest/papier/pmd in jaar J, ook in het verleden
                 fetchedNextYear: boolean;   // C(J+1) is opgehaald zonder fout
                 nextYearHasDate: boolean }> // C(J+1) bevat minstens één datum van rest/papier/pmd
```

**Volgorde:**
- B en C(J) gaan parallel.
- C(J+1) wordt ook opgehaald als het december is (dan parallel), of als C(J) geen komende datum van rest, papier of PMD heeft (dan daarna, alleen in dat geval).
- Alles valt binnen het totaalbudget van 12 s.
- Er wordt nooit een C(J−1) opgehaald.

**Hoe de foutcodes ontstaan:**
- netwerkfout, time-out, 5xx, 429 of een andere 4xx → `UNREACHABLE`;
- kapotte JSON, zod-fout, verkeerde `content-type` of te groot → `FORMAT`;
- A geeft 200 `[]` → geen kandidaten → `not_found`. Dat is geen fout;
- **B geeft 200 `{}`** (U0.2: onbekende adrescode), **200 `[]` of 404 → `NOT_FOUND`**:
  - bij het instellen wordt dat `not_found`;
  - bij het bijwerken wordt dat `ADDRESS_GONE`;
  - bij een bestaand adres geeft B altijd de volledige lijst soorten, dus een lege B is geen normale toestand;
- een fout bij C(J) of C(J+1) (`UNREACHABLE`/`FORMAT`) maakt de hele ophaling `UNREACHABLE`;
- C geeft 404 of `[]`, voor welk jaar ook → leeg, en dat is **geen** fout. C geeft ook `[]` bij een onbekende adrescode. "Adres weg" wordt daarom **alleen** via B herkend. Of een leeg antwoord verdacht is, beslist één regel (§18.8.4).

#### 18.1.4 Parser (zod, `src/server/waste/schema.ts`)

Er worden alleen de velden uit de tabel gelezen. Alles daarbuiten wordt door zod gestript, en wordt nooit bewaard, gelogd of naar de client gestuurd.

| Endpoint | Gelezen velden | Gestript (in P0 gezien) |
| --- | --- | --- |
| A | `bagId` (string `^[0-9]{16}$`; komt er een number, dan links aanvullen met nullen tot 16 cijfers, anders weigeren), `huisletter` (string, `""` = geen), `huisnummerToevoeging` (string, `""` = geen). Alleen voor de weergave T-45a: `openbareRuimteNaam`, `huisnummer`, `woonplaatsNaam` | `postcode` (we gebruiken de ingevoerde), `latitude`, `longitude`, `woonplaatsId`, `gemeenteId` |
| B | `id` (number), `title` (string), `menu_title` (string, optioneel), `icon` (string, optioneel), `ophaaldatum` (`YYYY-MM-DD` of `null`; wordt geparsed maar **niet** voor de planning gebruikt) | `content` (HTML), `icon_data` (base64-SVG), `page_title`, `slug`, `tags`, `parent_id` |
| C | `afvalstroom_id` (number), `ophaaldatum` (`YYYY-MM-DD`; `null` → rij overslaan) | — |

- **B: "adres onbekend" expliciet herkennen, niet als FORMAT.**
  - De body mag een array van soorten zijn **of** precies een leeg object `{}` (U0.2).
  - `{}` en `[]` → `NOT_FOUND`.
  - Een niet-leeg object of elke andere vorm → `FORMAT`.

  Illustratie (geen implementatie):
  ```ts
  const StreamsBody = z.union([z.strictObject({}), z.array(StreamSchema)]);
  // {} → NOT_FOUND; [] → NOT_FOUND; niet-lege array → soorten; anders → FORMAT
  ```
- **Grootte:** B is ~20 KB, ruim onder de grens van 1 MB. De streamgrens blijft staan.
- **`classifyStream`** (`src/domain/waste/streams.ts`, puur), tabel uit P0:

  | `icon` | `title` | Bak |
  | --- | --- | --- |
  | `zak-grijs-rest` | Rest | rest |
  | `doos-karton-papier` | Papier | papier |
  | `petfles-blik-drankpak_pmd` | PMD | pmd |
  | `appel-gft` | GFT | `null` (genegeerd, geteld; AC-196) |
  | `kerstboom-zonder-kruis` | Kerstbomen | `null` (genegeerd, geteld; AC-196) |

  Een onbekend icon valt terug op een trefwoord in `title` of `menu_title`: `rest`, `papier`, `pmd`/`plastic`, tenzij er `grof`, `gft`, `kerst` of `textiel` in staat. Twee stromen die op dezelfde bak uitkomen, worden samengevoegd.
- **Resultaat:** `WastePickups = { rest; papier; pmd }` als gesorteerde, unieke ISO-datums ≥ vandaag, uit de opgehaalde jaren.

#### 18.1.5 Adres kiezen (`src/domain/waste/address.ts`, puur; AC-184, AC-187)

- `normalizeWasteAddress`:
  - postcode in hoofdletters zonder spatie;
  - "12a", "12 a", "12-2" en "12 bis" → nummer + toevoeging;
  - toevoeging maximaal 4 tekens `[A-Z0-9]`.
- `suffix: string | null`: `null` = niet opgegeven, `""` = bewust het adres zonder letter gekozen.
- De letter en toevoeging van een kandidaat = `(huisletter ?? "") + (huisnummerToevoeging ?? "")`, in hoofdletters. `""` is het adres zonder letter of toevoeging.
- `matchCandidate` vergelijkt die waarde met de genormaliseerde invoer:
  - 0 kandidaten → `not_found`;
  - `null` en 1 kandidaat → die kandidaat;
  - `null` en meerdere → `choose`;
  - gegeven → exacte match of `not_found`.
- De app kiest nooit zelf.

#### 18.1.6 P0 en U0.2: probe van de bron, uitgevoerd op 2026-09-29

**Uitvoering:**
- met toestemming van Jurgen ("Ja, probeer maar", letterlijk in PROGRESS);
- via `net.http_get` vanuit het live Supabase-project (AWS eu-central-1, IPv6);
- met User-Agent `Takenlijstje/1 (prive gezinsapp)` en een time-out van 20 s;
- **alleen met het openbare testadres 2591 BB 87**, en voor U0.2 een verzonnen adrescode.

Na afloop zijn de antwoordrijen (P0: id 4–11; U0.2: id 14–16) uit `net._http_response` verwijderd.

**Rechten vóór = na (L4, D-046):** de probe draaide alleen `net.http_get` en `select`/`delete` op `net._http_response`, zonder schema-, rechten- of app-gegevenswijziging.
- Verslag: `docs/wijzigingen/W-03/probe/P0-uitkomst.md`.
- Gegevens: `docs/wijzigingen/W-03/probe/fixtures-2591BB-87.json`.

| Onderdeel | Uitkomst | Gevolg in dit ontwerp |
| --- | --- | --- |
| `robots.txt` | `User-agent: *` / `Disallow:` (leeg) | geautomatiseerd opvragen niet uitgesloten |
| Datacenter | geen blokkade vanuit Supabase/AWS Frankfurt | datacentertoets gehaald. Vercel `fra1` is niet getest → controle U5 |
| A (adres) | 200 JSON-array; `bagId` "0518200000813196" (string, 16 cijfers); `huisletter`/`huisnummerToevoeging` `""`; ook straat, woonplaats ("'s-Gravenhage"), coördinaten en ids | §18.1.4, §18.1.5; `CHECK (bag_id ~ '^[0-9]{16}$')` |
| A, onbekend adres | 200 `[]` | `not_found` |
| B (afvalstromen) | 5 soorten (GFT, PMD, Papier, Rest, Kerstbomen), ook zonder datums; ~20 KB | herkennen op `icon`; strippen; B zegt **niet** welke bakken een adres gebruikt, en is dus geen bron voor `no_streams` |
| B, onbekende adrescode (U0.2) | 200 `{}` | `NOT_FOUND` → `ADDRESS_GONE` (bijwerken) of `not_found` (instellen); §18.1.4 |
| C 2026 | 200 `[{afvalstroom_id, ophaaldatum}]`; voor het testadres alleen papier (elke 4 weken, niet 24 nov – 20 jan) en kerstbomen | contract bevestigd; leeg-regel "geen komende datum" met jaareinde-uitzondering (§18.8.4) |
| C 2027 | 200 `[]` | J+1 is leeg zolang niet gepubliceerd; geen fout |
| C, onbekende adrescode (U0.2) | 200 `[]` | C is geen bron voor "adres weg" |
| C 2025, vorig jaar (U0.2) | 200, 15 datums | opvraagbaar, maar niet gebruikt (§18.8.1: geen C(J−1)) |
| www.denhaag.nl | 403 (botbescherming) | 22:00/07:45 niet op de pagina bevestigd → controle U0.1 |

**Fixtures (U1):**
- `fixtures-2591BB-87.json` gaat ongewijzigd naar `src/server/waste/__tests__/fixtures/p0-2591BB-87.json`, met een `README.md`: herkomst, 2026-09-29, openbaar testadres, `content`/`icon_data` weggelaten. De test-helper splitst het bestand per endpoint.
- Synthetische fixtures `synthetisch-*.json` krijgen **exact dezelfde vorm**:
  - B **met** `content` en `icon_data` van ± 20 KB, om het strippen en de grootte te toetsen;
  - een adres met rest (wekelijks), papier (4-wekelijks) en PMD (2-wekelijks);
  - alleen GFT;
  - meerdere kandidaten (`huisletter` "A"/"B");
  - december zonder J+1;
  - januari met een lege C(J);
  - eerstvolgende dag over 3 weken;
  - verschuiving;
  - leeg (C `[]`);
  - **adres weg: B = `{}`, letterlijk zoals U0.2**;
  - **C(J+1) met alleen kerstbomen** (§18.8.4 stap 3).
- Alleen voor rest en PMD bestaan geen echte voorbeelddata. De parser is voor alle soorten gelijk.

**Wat van P0 rest, als controle vóór de livegang (geen bouwvoorwaarde):**
- **U0.1 Gemeenteregel.** Jurgen bekijkt één keer `https://www.denhaag.nl/nl/afval/huisvuil-aanbieden/`, omdat de site servers weigert. Bij voorkeur vóór `/design-go`, uiterlijk vóór U4. Tot dan geldt het besluit V-49 (22:00/07:45). Een afwijking is een stoppunt (§18.1.7).
- **U5 Bereikbaarheid vanuit Vercel `fra1`.** pg_net en Vercel gebruiken niet dezelfde IP-adressen. De eerste echte opzoeking (Jurgens rooktest) is de controle. Bij een blokkade geldt §18.16 U5.
- **Responstijd:** is in P0 en U0.2 niet apart gemeten. Na U5 wordt hij gevolgd via `fetchMs` (alleen een getal) in de tick-log.

#### 18.1.7 Beslisregel voor latere afwijkingen van de bron (U0.1, U5 en daarna)

P0 en U0.2 zijn afgerond. Al hun uitkomsten waren uitvoeringskeuzes, en zijn verwerkt in §18.1.1–§18.1.6, §18.3.1 en §18.8. Na de freeze is de rechterkolom een **wijzigingsverzoek** in PROGRESS.

| Uitvoeringskeuze (na de freeze in `DECISIONS.md`) | Stoppunt: wijzigingsverzoek, naar Jurgen |
| --- | --- |
| andere veldnamen, hoofdletters of typen in A, B of C (bijv. `date` in plaats van `ophaaldatum`, id als number) | **U0.1:** andere gemeentetijden dan 22:00 en 07:45, of regels per bak of wijk (BR-49, AC-192, UX §13.4/§13.6, T-16/T-17/T-21/T-22, M-01) |
| andere icon- of titelnamen van de drie bakken; extra stromen | **U5:** blokkade vanaf Vercel `fra1` (403, captcha, WAF), of 429 bij minder dan ~10 verzoeken per uur (gevolg: §18.16 U5) |
| `content-type`-variant (`charset`, `application/hal+json`); grootte tot 5 MB; responstijd tot 8 s | `robots.txt` of voorwaarden gaan `/rest/` of geautomatiseerd opvragen uitsluiten |
| postcode met spatie of kleine letters, of een ander scheidingsteken in het pad van A | geen JSON-API meer, alleen HTML, of een sleutel of login nodig |
| extra verplichte header zonder persoonsgegevens | een adresflow waarvoor **meer** naar buiten moet dan postcode + huisnummer of adrescode, of waarbij iets anders dan de adrescode bewaard moet worden (BR-58, AC-218) |
| — | rest, papier en PMD zijn niet apart te herkennen |
| — | responstijden structureel boven 8 s |

Twijfel over de indeling is geen uitvoeringskeuze: de hoofdsessie legt het voor.

### 18.2 Modules en systeemgrenzen

```
src/domain/waste/                 puur, vitest
  address.ts    normalizeWasteAddress, formatPostcode, matchCandidate
  streams.ts    classifyStream, WASTE_STREAMS = ['rest','papier','pmd']
  plan.ts       wasteTitle, wasteTaskFields, planWasteTasks (insert/move/rename/remove),
                hasNoUpcoming, classifyEmpty (§18.8.4),
                WASTE_HORIZON_DAYS = 14, MAX_SHIFT_DAYS = 3,
                WASTE_OUT_FROM/DEADLINE, WASTE_IN_FROM, WASTE_*_REMINDER
  expire.ts     findExpiredWasteTasks (BR-54), WASTE_IN_EXPIRE_DAYS = 7
  health.ts     dueForFetch, FETCH_SLOTS, wasteSyncHealth (+ notice), wasteFailureVariant
  messages.ts   T-/M-teksten uit UX §13.16 (enige plek in de code), wasteReminder-, wasteFailureMessage-teksten
src/server/waste/                 server-only, GEEN service role
  source.ts, schema.ts, lookup.ts
src/server/system/waste/          service role (TD §5.3)
  sync.ts       saveWasteCalendar, applyWasteSync, syncHousehold, markWasteAlarm, runWasteStep
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
| `bag_id` | `text not null check (bag_id ~ '^[0-9]{16}$')` [OPEN: V-58] |
| `pickups` | `jsonb not null check (jsonb_typeof(pickups) = 'object')`: `{"rest":[…],"papier":[…],"pmd":[…]}`. Alleen gewijzigd door een **geslaagde** bijwerking of `waste_save`; een mislukte poging (ook `SUSPECT_EMPTY`) laat hem ongemoeid |
| `version` | `bigint not null default 1`: +1 bij elk nieuw adres |
| `last_attempt_at` | `timestamptz`: **alleen** claim en rate limit (§18.8.3). Telt niet mee in de gezondheid |
| `last_success_at` | `timestamptz not null` |
| `last_error_code` | `text check (last_error_code in ('UNREACHABLE','FORMAT','SUSPECT_EMPTY','ADDRESS_GONE'))` |
| `error_since` | `timestamptz`: moment van de **eerste** vastgelegde mislukking in de huidige reeks met **dezelfde** code |
| `last_failure_at` | `timestamptz`: moment van de **laatste vastgelegde** mislukking. **Alleen `waste_sync` zet deze kolom**, bij `p_result = 'failure'` (= `p_now`). Een succes en `waste_save` wissen hem |
| `alarm_since` | `timestamptz`: moment waarop de server voor het eerst sinds `last_success_at` `failed` vaststelde (§18.8.5). Gezet door `markWasteAlarm` (tick of "Opnieuw proberen"). Alleen gewist door een succes (`waste_sync 'success'`) en `waste_save` |
| `created_at`, `updated_at` | standaard + `set_updated_at` |

**Checks:**
- `(last_error_code is null) = (error_since is null)`;
- `(last_error_code is null) = (last_failure_at is null)`;
- `last_failure_at is null or last_failure_at >= error_since`;
- `alarm_since is null or alarm_since >= last_success_at`.

**Overig:**
- **[OPEN: V-58] Adrescode.** Jurgen besloot "adres mag opgeslagen worden" (V-45: postcode + huisnummer). Of ook `bag_id` bewaard mag worden, is nog niet bevestigd.
  - **Bij "ja":** zoals hierboven.
  - **Bij "nee":**
    - de kolom `bag_id` vervalt;
    - `syncHousehold` doet bij elke ophaling eerst A (één extra GET) en kiest de kandidaat met `matchCandidate` op de bewaarde toevoeging;
    - "adres weg" ontstaat dan ook als A geen passende kandidaat meer geeft;
    - de rest van het ontwerp blijft gelijk.
- **Niet bewaard:** straat, plaats, coördinaten, ids uit A, ruwe antwoorden en wie het adres invoerde.
- **"Storingsmelding verstuurd"** is afgeleid uit de dedupe-sleutel (§18.9.3). `alarm_since` zegt alleen dat de storing is vastgesteld, niet of de melding al verstuurd is.
- **Versimpeltoets:** één `jsonb`-kolom in plaats van een cachetabel, want het gaat om ≤ ~150 datums per jaar die altijd in hun geheel worden gelezen. De keuze voor `last_failure_at` en `alarm_since` staat in §18.17.

#### 18.3.2 `tasks`: drie kolommen erbij

| Kolom | Betekenis |
| --- | --- |
| `waste_pickup_date date` | ophaaldag D |
| `waste_direction text` | `'out'` of `'in'` |
| `waste_streams text[]` | bakken op D, in de vaste volgorde |

- `check tasks_waste_shape`: alle drie null, **of**: direction in (`out`, `in`), een datum, `recurrence_id is null`, 1–3 bakken en `waste_streams <@ array['rest','papier','pmd']`.
- `constraint tasks_waste_key unique (household_id, waste_pickup_date, waste_direction)`: niet-partieel, bruikbaar als `on conflict`-doel en als index. NULL's botsen niet.
- Nullable, zonder standaardwaarde: geen herschrijving van de tabel, en de oude code blijft werken.
- Vervallen open afvaltaken worden door het systeem **hard** verwijderd. Afgevinkte en overgeslagen taken blijven staan. Een verschuiving is een update van dezelfde rij (§18.8.2).

#### 18.3.3 Meldingstype
`notification_type` krijgt er `'waste_sync_failed'` bij.

#### 18.3.4 Migraties (nummers na `…_310`)

| Bestand | Inhoud |
| --- | --- |
| `…_320_afval_meldingstype.sql` | alleen `alter type … add value if not exists 'waste_sync_failed'`. Apart bestand, omdat de waarde pas na de commit bruikbaar is |
| `…_330_afvalkalender.sql` | `waste_calendars` (met `last_failure_at`, `alarm_since` en de checks) + RLS + grants; `tasks`-kolommen, check en sleutel; guard, policies en `delete_task` vervangen; trigger `waste_skip_cascade`; RPC's `waste_save`, `waste_sync`, `disable_waste_calendar`, `waste_calendar_enabled`; daarna opnieuw `revoke execute on all functions in schema private …` + de bestaande grants op de helpers (patroon `…_110`) |

Beide gaan pas na CP-W03 en U0.1 op live via `apply_migration` (D-040): eerst `_320`, dan `_330`.

### 18.4 Afvaltaken: naam en tijden

#### 18.4.1 Naam
`wasteTitle(streams, direction)` geeft T-01…T-14 (UX §13.3/§13.16) voor alle 7 combinaties × 2 richtingen, en is maximaal 80 tekens.

#### 18.4.2 Velden (`wasteTaskFields(D, direction, streams, tz)`, `Europe/Amsterdam`, via `zonedInstant`)

| Veld | `out` | `in` |
| --- | --- | --- |
| `scheduled_date` | D−1 | D |
| `scheduled_time` | `21:00` (alleen voor het sorteren; de UI toont nooit "21:00") | `null` |
| `available_from` | `null` | D 12:00 |
| `due_at` | D 07:45 | (D+1) 00:00 |
| `reminder_minutes_before` | `'{}'` | `'{}'` |
| `description` | `null` | `null` |
| `category` / `priority` | `outdoor` / `normal` | idem |
| maker / `recurrence_id` | `null` / `null` | idem |
| `waste_*` | D, `out`, bakken | D, `in`, bakken |

- De UI leidt de rechterkolom (T-16…T-19), de bovenregel (T-20) en de infolijst (T-21…T-25) af uit `waste_*` en de tijden. Een omschrijving in de database was op D−1 of D+1 onjuist.
- Constanten in `plan.ts`:
  - `WASTE_OUT_FROM = "22:00"`;
  - `WASTE_OUT_DEADLINE = "07:45"`;
  - `WASTE_IN_FROM = "12:00"`;
  - `WASTE_IN_REMINDER = "18:00"`;
  - `WASTE_OUT_REMINDER = "21:00"`.
- Wijkt de gemeenteregel bij U0.1 af, dan is dat een stoppunt (§18.1.7).

### 18.5 Rechten: RLS, guard, policies en RPC-checks

#### 18.5.1 `waste_calendars` (V-53)
- RLS aan, met één policy: `for select to authenticated using (private.is_admin(household_id))`. Geen schrijfpolicies.
- `revoke all … from anon`; `revoke insert, update, delete … from authenticated`. Niet in Realtime.
- Gevolg: `last_failure_at` en `alarm_since` zijn alleen via de service role te schrijven: `waste_sync`/`waste_save` en `markWasteAlarm` (§18.7).
- `public.waste_calendar_enabled()`: security definer, `stable`, `execute` alleen voor `authenticated`. Geeft `exists` voor het eigen actieve lidmaatschap, anders `false`.

#### 18.5.2 `private.guard_task_changes` (vervangen; de bestaande regels uit `…_210` letterlijk + dit)

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

Het systeem (`auth.uid() is null`) en FK-acties (`pg_trigger_depth() > 1`) gaan eerst door, zoals nu.

#### 18.5.3 Policies op `tasks` (vervangen)
- `tasks: aanmaken` krijgt erbij: `and waste_direction is null and waste_pickup_date is null`.
- `tasks: beheerder of maker verwijdert`: `using (waste_direction is null and private.can_delete_task(…))`.

#### 18.5.4 `public.delete_task` (vervangen)
Na de lidmaatschapscheck: `if v_task.waste_direction is not null then raise … '42501'`.

#### 18.5.5 Trigger `tasks_waste_skip_cascade` (BR-53, AC-209)
- `after update of status … when (new.waste_direction = 'out' and old.status is distinct from new.status)`.
- Werkt alleen als `auth.uid() is not null` en `pg_trigger_depth() = 1`:
  - `out` naar `skipped` → `in` van dezelfde D naar `skipped` (als die open is);
  - terug naar `todo` → `in` terug naar `todo` (als die `skipped` is).
- Automatisch vervallen door de tick werkt niet door.

#### 18.5.6 Server-side vroeg weigeren
`assertNotWasteTask(task)` in `moveTask`, `updateTask` (alle scopes, vóór het maken van een reeks), `deleteTask` en de wachtrij-soort `move` → `UserError FORBIDDEN`. De client toont dan T-33.

#### 18.5.7 UI-helpers
`isWasteTask`, en `canEditTask`, `canMoveTask` en `canDeleteTask` geven `false` voor afvaltaken. Ze dienen alleen om knoppen te verbergen.

### 18.6 Server actions (`src/server/actions/waste.ts`)

Alle vier volgen `runAction` → `requireAdmin()` → zod → pas daarna een opvraging of schrijfactie. Ze zijn online-only (`useOnlineOnly()`, anders T-67) en staan niet in de wachtrij.

| Actie | Wat hij doet | Resultaat (`data.kind`) |
| --- | --- | --- |
| `lookupWasteAddressAction` `{postcode, houseNumber, suffix}` | `lookupWasteCalendar` (§18.8.1). **Schrijft niets** | `found` (weergave, eerstvolgende datum per bak of `null`) · `choose` (kandidaten) · `not_found` · `no_streams` · `no_upcoming` · `unreachable` |
| `confirmWasteAddressAction` idem | vraagt **opnieuw** op (de client levert nooit `bag_id` of datums aan). Bij `found`:<br>**(a) geen bewaard adres** → `waste_save` → `saved`, `mode: 'enabled'`;<br>**(b) ander adres** → `waste_save` → `saved`, `mode: 'changed'` (BR-56);<br>**(c) zelfde adres** (`bag_id`, postcode, nummer en toevoeging gelijk) → `applyWasteSync` met de net opgehaalde datums, `p_result = 'success'`, **zonder claim**, met de gelezen `version` → `saved`, `mode: 'unchanged'` | `saved` (`{mode, inserted, removed}`), of dezelfde niet-gevonden-uitkomsten als lookup (niets bewaard). Een botsing op `version` bij (c), of een fout in de RPC, geeft `UNKNOWN` |
| `retryWasteSyncAction` `{}` | claim (≥ 60 s). Lukt de claim niet, dan `too_soon`, **zonder** verzoek naar buiten. Anders `syncHousehold(…, { manual: true })`, daarna `wasteSyncHealth`. Is die `failed`, dan volgt `markWasteAlarm` | `done` (`health`, `lastSuccessAt`, `attemptedAt`) · `too_soon` |
| `disableWasteCalendarAction` `{}` | RPC `disable_waste_calendar()` | `{ removed }` |

- **Te-snel-bescherming niet bij bevestigen:** alleen "Opnieuw proberen" gebruikt de claim. Bevestigen krijgt dus nooit T-79 (AC-222).
- **`inserted`** wordt altijd teruggegeven. De client kiest daarmee alleen tussen T-90 en T-90b (§18.11), en leidt verder niets af.
- **`getWasteSettings`** (server, user-client):
  - **de beheerder krijgt:**
    - adres;
    - `health` (§18.8.5: `state`, `variant`, `lastErrorCode`, `lastSuccessAt`, `notice`);
    - de eerstvolgende datum per bak;
    - het aantal open afvaltaken (voor T-81/T-81b/T-81c).
  - **De eerstvolgende datum per bak komt altijd uit de bewaarde `pickups` (≥ vandaag), ook tijdens een storing, ook bij H2.** Een mislukte poging wist nooit datums uit beeld. `null` (→ T-45b) alleen voor een bak zonder komende datum in de bewaarde stand;
  - een gezinslid krijgt alleen `waste_calendar_enabled` en de namen van de beheerders (T-39).
- **Foutcodes:** alleen `FORBIDDEN`, `VALIDATION` en `UNKNOWN`. Uitkomsten van de bron zijn `kind`-waarden, geen fouten.
- **Budget:** 12 s per action. Staat Fluid compute uit, dan `maxDuration = 30` op het segment.

### 18.7 RPC's en schrijfstatements

| RPC / statement | Wie | Wat (één transactie) |
| --- | --- | --- |
| `waste_save(p_household_id, p_member_id, p_postcode, p_house_number, p_house_suffix, p_bag_id, p_pickups, p_insert, p_now)` → `{version, removed, inserted}` | alleen `service_role` | 1. `households`-rij `for no key update` (serialiseert alle afval-schrijfacties per huishouden). <br>2. Hercontrole: `p_member_id` is een actieve beheerder, anders 42501. <br>3. Upsert `waste_calendars`: `version + 1` bij conflict; `last_success_at = last_attempt_at = p_now`; `last_error_code`, `error_since`, `last_failure_at` en `alarm_since` op `null`. <br>4. `delete` van **alle** open afvaltaken van het huishouden. <br>5. Insert van `p_insert` (`household_id` uit de parameter), met `on conflict (…tasks_waste_key) do nothing` |
| `waste_sync(p_household_id, p_version, p_result, p_error_code, p_pickups, p_remove uuid[], p_move jsonb, p_rename jsonb, p_insert jsonb, p_now)` → `{stale, removed, moved, renamed, inserted}` | alleen `service_role` | 1. Slot op de `households`-rij. <br>2. `waste_calendars … for update`; ontbreekt de rij of klopt `version` niet → `{stale:true}` en niets doen. <br>3. Stand bijwerken: <br>• `'success'` → `pickups = p_pickups`, `last_success_at = p_now`; `last_error_code`, `error_since`, `last_failure_at` en `alarm_since` op `null`; <br>• `'failure'` → `error_since = case when last_error_code is distinct from p_error_code then p_now else error_since end`, `last_error_code = p_error_code`, **`last_failure_at = p_now`**. `pickups` en `alarm_since` blijven; <br>• `null` → alleen plannen. <br>4. **remove:** `delete … where id = any(p_remove) and household_id = p and waste_direction is not null and status in ('todo','in_progress')`. <br>5. **move:** `update tasks t set waste_pickup_date, scheduled_date, scheduled_time, available_from, due_at, title, waste_streams from jsonb_to_recordset(p_move) x where t.id = x.id and t.household_id = p and t.waste_direction = x.direction and t.status in ('todo','in_progress')`. <br>6. **rename:** idem, alleen `title` en `waste_streams`. <br>7. **insert** zoals bij `waste_save`. <br>Volgorde 4 → 5 → 6 → 7 |
| `markWasteAlarm(h, lastSuccessAt, now)` (statement in `sync.ts`, service role) | tick en retry-action | `update waste_calendars set alarm_since = :now where household_id = :h and alarm_since is null and last_success_at = :lastSuccessAt`. De voorwaarde op `last_success_at` voorkomt dat een alarm blijft hangen na een gelijktijdig succes. Idempotent |
| `disable_waste_calendar()` → `integer` | `authenticated` | huishouden uit het **eigen actieve beheerderslidmaatschap**, anders 42501; slot; open afvaltaken weg; `waste_calendars`-rij weg |
| `waste_calendar_enabled()` → `boolean` | `authenticated` | §18.5.1 |

- **Alleen `waste_sync` zet `last_failure_at`.** De claim (§18.8.3) raakt alleen `last_attempt_at`. `waste_save` en een succes zetten hem op `null`. Er is geen ander pad. Dit wordt getoetst in §18.15 (AC-205, DB).
- **Idempotentie:** alle stappen controleren de status opnieuw, dus wat intussen is afgevinkt of overgeslagen blijft ongemoeid (AC-202). Bij twee ticks tegelijk serialiseert het slot; de tweede plant op de nieuwe stand (leeg plan), en inserts botsen op de sleutel.
- **Botsing bij move:** een `unique_violation` geeft een rollback van de hele RPC. De tick logt `[waste] sync mislukt code=CONFLICT` en de volgende tick plant opnieuw.

### 18.8 De achtergrondstap "afval"

#### 18.8.1 Opzoeken bij het instellen (`lookupWasteCalendar`)
1. A → `matchCandidate`. Bij `not_found` of `choose` → terug.
2. `fetchPickups` (§18.1.3): B + C(J); C(J+1) in december of als C(J) geen komende datum van rest, papier of PMD heeft. **Geen C(J−1).**
3. Uitkomst, in deze volgorde:
   - B geeft `NOT_FOUND` (`{}`, `[]` of 404) → `not_found` (D, T-60);
   - `UNREACHABLE` of `FORMAT` van B of een C-verzoek → `unreachable`;
   - `hasNoUpcoming(pickups)` (§18.8.4) is onwaar → `found`. Dat geldt ook als de eerstvolgende datum verder dan 14 dagen weg ligt. Dan ontstaan er na aanzetten nog geen taken (`inserted = 0` → T-90b);
   - `hasNoUpcoming` waar, en de maand van vandaag (Europe/Amsterdam) is **januari** → `no_upcoming` (F2, T-64/T-64b), **altijd**, of het adres in J (of vorig jaar) datums had of niet. In januari is "de nieuwe kalender staat nog niet online" veel waarschijnlijker, en F2 bewaart ook niets (AC-186, AC-237);
   - `hasNoUpcoming` waar en `hadAnyDateInJ` onwaar → `no_streams` (E, T-62). Het adres heeft dit jaar geen enkele datum van rest, papier of PMD, bijvoorbeeld bij een ondergrondse container;
   - anders → `no_upcoming` (F2).
4. **Geen jaareinde-uitzondering bij het instellen:** een adres zonder komende datum in J én J+1 krijgt ook in november of december `no_upcoming` (F2). Er valt nog niets te plannen, en T-64 zegt al "De kalender van het nieuwe jaar komt meestal rond de jaarwisseling online."
5. `display` komt uit A, alleen voor de beheerder. Woonplaats wordt als "Den Haag" getoond (T-45a). Het wordt nooit bewaard of gelogd.
6. B is **geen** bron voor `no_streams`: B noemt altijd alle soorten, ook als het adres er geen dagen voor heeft (P0).

#### 18.8.2 Plannen (`planWasteTasks`, puur)

```ts
planWasteTasks({ pickups, existing, now, timeZone }):
  { insert: NewWasteTask[]; move: MoveWasteTask[]; rename: {id,title,streams}[]; remove: string[] }
// existing = alle afvaltaken van het huishouden met waste_pickup_date >= vandaag (elke status)
```

1. **Venster:** D in [vandaag, vandaag + 14] (V-52).
2. **Gewenst:** per D in het venster de bakken op D, dus de sleutels `(D,out)` en `(D,in)`.
3. **Invoegbaar:** een gewenste sleutel zonder bestaande taak (elke status telt), en het moment is nog niet voorbij: `out` alleen als `now < D 07:45`; `in` altijd binnen het venster.
4. **Wees:** een bestaande **open** taak met D in het venster en **geen** ophaling meer op D. Uitzondering: `in` als `out` van dezelfde D `done` is; die blijft staan (BR-51, AC-200).
5. **Verschuiving koppelen, per dag:**
   - *weesdagen* = dagen D met minstens één wees;
   - *nieuwe dagen* = dagen D′ in het venster met minstens één invoegbare sleutel;
   - neem de weesdagen op volgorde. Koppel elke weesdag D aan een nog niet gekoppelde D′ waarvoor geldt: `|D′ − D| ≤ MAX_SHIFT_DAYS (3)`, en minstens één bak gemeen met de wezen op D. Bij meerdere kandidaten de kleinste afstand, en bij gelijke afstand de vroegste D′;
   - per wees van een gekoppelde dag, per richting: is `(D′, richting)` invoegbaar, dan **move** (dezelfde rij, `wasteTaskFields(D′, richting, bakken(D′))`, naam T-01…T-14). Die sleutel is daarna niet meer invoegbaar;
   - is `(D′, richting)` níet invoegbaar, dan **remove** van de wees.
6. **remove:** alle wezen die niet verschoven zijn (AC-199).
7. **rename:** een bestaande open taak met een gewenste sleutel maar andere bakken (AC-201).
8. **insert:** alle overgebleven invoegbare sleutels.
9. Taken met D < vandaag worden hier nooit geraakt (BR-54). Een leeg plan betekent: geen RPC.

**Waarom zo (versimpeltoets):**
- "Verwijderen + opnieuw aanmaken" is niet even betrouwbaar, want `task_comments` hangt met `on delete cascade` aan `tasks`.
- Koppelen per dag houdt buiten- en binnenzetten samen.
- De twee grenzen voorkomen dat een notitie aan een ophaaldag gaat hangen die er niets mee te maken heeft.

**Gevolgen die bewust zo blijven:**
- de herinnering volgt het nieuwe anker;
- is buitenzetten op D′ al voorbij, dan vervalt de oude buitenzet-taak, en schuift binnenzetten wel mee.

#### 18.8.3 Wanneer ophalen: twee vaste momenten, claim en rate limit

- **`FETCH_SLOTS = ["06:00", "17:00"]`** in `Europe/Amsterdam`.
- **`dueForFetch(cal, now, tz)`:**
  - `lastSlot` = het laatste slotmoment ≤ `now`;
  - ophalen als `last_success_at < lastSlot` **en** (`last_attempt_at` is null of ligt meer dan 60 min terug);
  - na een mislukking wordt er dus elk uur opnieuw geprobeerd. Bij een tick elk kwartier is de tweede automatische poging na 06:00 die van 07:15 (AC-205 b).
- **Claim** (lease en rate limit, zonder lock):
  ```sql
  update waste_calendars set last_attempt_at = :now
  where household_id = :h and version = :v
    and (last_attempt_at is null or last_attempt_at < :now - interval '60 seconds')
  returning household_id
  ```
  Geen rij betekent: niet ophalen (tick) of `too_soon` (retry). Bevestigen gebruikt de claim niet.
- **Een claim is geen uitkomst.** Wordt een poging na de claim afgebroken (time-out van de functie, een fout vóór de RPC), dan blijven `last_error_code`, `error_since` en `last_failure_at` ongewijzigd. De gezondheid verandert dus niet (§18.8.5).

#### 18.8.4 Regel voor "geen komende ophaaldagen" (BR-48, BR-52, AC-204, AC-220, AC-237)

- **`hasNoUpcoming(pickups)`** = de bron geeft voor rest, papier en PMD **samen geen enkele komende ophaaldag** (vandaag of later) in de opgehaalde jaren (J, en J+1 als die is opgehaald). Dit wordt bepaald op de **net opgehaalde** datums. Datums van andere soorten (GFT, kerstbomen) tellen niet mee.

**Bij het bijwerken bepaalt `classifyEmpty(result, today, tz)` (puur, `plan.ts`) de uitkomst, in deze volgorde:**
1. `hasNoUpcoming(pickups)` is onwaar → gewone uitkomst `success`.
2. `hadAnyDateInJ` is onwaar: het lopende jaar is voor rest, papier en PMD helemaal leeg (bijvoorbeeld op 1 januari zonder nieuwe kalender, of een bron die `[]` geeft) → `failure`, `SUSPECT_EMPTY`.
3. De maand van vandaag (Europe/Amsterdam) is november of december, `fetchedNextYear` is waar, **en C(J+1) bevat geen datum van rest, papier of PMD** (`nextYearHasDate` onwaar; een C(J+1) met alleen kerstbomen of GFT telt dus als "nog niet online") → **`success`, geen storing.** Dit is het jaareinde: de laatste ophaling van dit jaar is al geweest, en de kalender van volgend jaar staat nog niet online.
   - `pickups` wordt bewaard. Die bevat dan geen komende datums, dus er is niets te plannen. Bestaande open taken zijn al verleden tijd en vallen onder BR-54.
   - `notice = 'next_year_missing'` (§18.8.5) zorgt voor de stille regel T-73. Er komt geen melding.
   - Bij stap 3 is C(J+1) altijd opgehaald, omdat C(J) geen komende datum meer had (§18.1.3). `fetchedNextYear` staat er als verdediging.
4. In alle andere gevallen (bijvoorbeeld in juni: C(J) heeft alleen datums in het verleden en J+1 is leeg) → `failure`, `SUSPECT_EMPTY`.

**Gevolgen van `SUSPECT_EMPTY`:**
- de bewaarde datums (`pickups`) en het adres blijven ongewijzigd;
- bestaande afvaltaken worden **niet** verwijderd, verschoven of hernoemd;
- de planning draait door op de bewaarde datums, en past daarbij **alleen nieuwe taken** toe (§18.8.6): komt een al bekende ophaaldag tijdens de storing binnen de 14 dagen, dan worden de taken ervoor gewoon klaargezet (BR-50);
- vanzelf vervallen volgens BR-54 loopt door;
- **de instellingen tonen onder "Volgende ophaaldagen · stand <dag>" gewoon de bewaarde datums van de laatste geslaagde bijwerking, ook in G′ en H2** (§18.6 `getWasteSettings`, §18.11). Een leeg antwoord wist nooit datums, niet in de database en niet in beeld.

**Bij het instellen:** `no_upcoming` (F2) volgens §18.8.1. Er wordt niets bewaard, en de uitzondering uit stap 3 geldt hier niet.

**Geen voorwaarde "eerder bekend":** een adres wordt alleen bewaard als er minstens één komende ophaaldag is (BR-48). "Geen enkele komende ophaaldag" is daarna dus altijd een verandering, behalve het jaareinde uit stap 3.

**Waarom deze regel:**
- **Geen 14-dagenvenster:** P0 laat zien dat papier eens per 4 weken komt, met een pauze van bijna 2 maanden rond de jaarwisseling. Een venster van 14 dagen gaf bij adressen met weinig ophalingen elke maand een onterechte storing. Een datum verder dan 14 dagen weg is normaal; de taken verschijnen dan pas 14 dagen vooraf (V-52).
- **Jaareinde:** J+1 eerder ophalen helpt alleen als de gemeente het nieuwe jaar al gepubliceerd heeft. Dat gebeurt meestal pas in december. Het P0-adres heeft zijn laatste ophaling op 24 november, dus zonder stap 3 kwam er tussen 24 november en de publicatie alsnog vals alarm. November en december zijn de enige maanden waarin "geen komende datum dit jaar" normaal kan zijn.
- **Het echte gevaar blijft gedekt:** een lege of kapotte bron, en een nieuwe kalender die op 1 januari nog ontbreekt. Dan is C(J) helemaal leeg, en na een uur volgt H2 met T-77a.

**Eén bak zonder dagen** is geen storing.

**Bewuste grenzen:**
- stopt een adres in november of december echt met ophalen (bijvoorbeeld door een ondergrondse container), dan ziet de beheerder tot 1 januari alleen T-73. Daarna volgt `SUSPECT_EMPTY` en H2. In die periode gaan geen taken verloren;
- een afgekapte, maar niet lege lijst van de bron is niet te herkennen. De taken volgen dan de bron.

#### 18.8.5 Gezondheid (`wasteSyncHealth`, puur; UI én tick)

**Invoer:** `last_success_at`, `last_error_code`, `error_since`, `last_failure_at`, `alarm_since`, `pickups`, `now`. **`last_attempt_at` telt niet mee**, zodat een lopende of afgebroken poging de toestand niet verandert.

| Toestand | Regel (in deze volgorde; de eerste die klopt, bepaalt `reason`) |
| --- | --- |
| `failed`, reden `empty` | `last_error_code = 'SUSPECT_EMPTY'` **en** `last_failure_at − error_since ≥ 60 min`: minstens twee **vastgelegde** antwoorden zonder komende ophaaldag achter elkaar, zonder andere uitkomst ertussen, waarvan de eerste en de laatste minstens een uur uit elkaar liggen |
| `failed`, reden `stale` | `now − last_success_at > 48 h` (V-50), met welke `last_error_code` ook, **ook `null`** |
| `failed`, reden `held` | `alarm_since is not null`: de storing is al vastgesteld, en sindsdien is er geen succes geweest |
| `retrying` | `last_error_code` gezet, maar niet `failed` |
| `ok` | anders |

**Variant voor tekst en melding** (`wasteFailureVariant(lastErrorCode)`, puur; UX §13.8.2 en §13.10):

| `last_error_code` | Balk | Melding |
| --- | --- | --- |
| `UNREACHABLE`, `FORMAT`, **of `null`** | H1: T-75 + T-76 | M-03 |
| `SUSPECT_EMPTY` | H2: T-77 + T-77a (maand van `now` in Amsterdam is 12 of 1) of T-77b | M-04 |
| `ADDRESS_GONE` | H3: T-77c + T-77d, knoppen Adres controleren · Opnieuw proberen | M-05 |

**"Stil gelegen", technisch:**
- Het is de toestand `failed` met reden `stale` **en** `last_error_code is null`: sinds het laatste succes heeft geen enkele poging een uitkomst vastgelegd.
- Dat gebeurt als:
  - (1) de tick niet draaide (planner of Vercel weg). De beheerder die de pagina opent, ziet dan H1, ook zonder tick;
  - (2) de ophaalstap steeds werd overgeslagen, omdat de tick al ≥ 10 s liep;
  - (3) de claim steeds niet lukte;
  - (4) pogingen tussen claim en `waste_sync` werden afgebroken.
- In al die gevallen geldt H1 + M-03. T-75 ("Niet bijgewerkt sinds <dag>") en M-03 ("Laatst gelukt op …") kloppen dan letterlijk.
- Draait de tick na een stilstand weer, dan probeert hij eerst op te halen (§18.8.6, stap 3). Lukt die poging niet, dan volgt de variant de nieuwe code. De melding gaat pas daarna.

**Verdere regels:**
- **Per soort geteld:** een andere foutcode zet `error_since` opnieuw.
  - "Onbereikbaar" gevolgd door "leeg" geeft dus geen alarm; pas een tweede vastgelegd leeg antwoord minstens een uur na het eerste wel.
  - "Opnieuw proberen" kan het alarm niet versnellen: de claim staat hooguit één poging per minuut toe, en de regel meet tijd, geen aantal.
- **De balk blijft tot herstel:** is `failed` eenmaal door de server vastgesteld (`alarm_since`), dan blijft `failed` staan tot het eerstvolgende succes, ook als een latere andere foutcode `error_since` opnieuw zet. De tekst volgt dan de huidige code, bijvoorbeeld H1 na een alarm door een leeg antwoord (H2 → H1), zonder tweede melding.
- **Waarschuwing kalender volgend jaar:** `notice = 'next_year_missing'` als `last_error_code is null`, de bewaarde `pickups` geen datum in J+1 bevatten (`pickups` bevat alleen rest, papier en PMD), en een van deze twee geldt:
  - (a) het is december en vandaag + 14 ≥ 1 januari J+1;
  - (b) het is november of december en er is geen enkele komende datum (het jaareinde uit §18.8.4, stap 3).

  Dit wordt afgeleid, zonder kolom, en alleen getoond bij `state = ok` (G″, T-73). Er komt geen melding.
- **Terugkoppeling aan de UI:** `health = { state, reason?, variant?, lastErrorCode, lastSuccessAt, notice? }`.

#### 18.8.6 Tickstap (`runWasteStep`)
Nieuwe stap in `runTick`, **tussen "overslaan" en "meldingen"**, met een eigen `step("afval")` en try/catch.
1. `select * from waste_calendars` (service role). Leeg → klaar.
2. Eén query voor de afvaltaken van die huishoudens: open, of `waste_pickup_date ≥ vandaag − 35`.
3. Per kalender:
   - **ophalen** als `dueForFetch` klopt, de tick nog geen 10 s loopt en de claim lukt. Budget 12 s. De uitkomst is een van deze:
     - `success` (ook het jaareinde uit §18.8.4 stap 3);
     - `failure` met `UNREACHABLE`;
     - `failure` met `FORMAT`;
     - `failure` met `ADDRESS_GONE` (B `{}`, `[]` of 404);
     - `failure` met `SUSPECT_EMPTY` (via `classifyEmpty`).
     
     `fetchMs` gaat als getal naar de tick-log;
   - **plannen** met de effectieve datums: de nieuwe bij succes, anders de bewaarde. **Verwijderen, verschuiven en hernoemen (`remove`, `move`, `rename`) worden alleen toegepast na een geslaagde ophaling in dezelfde ronde.** Na een mislukte ophaling (`UNREACHABLE`, `FORMAT`, `ADDRESS_GONE` of `SUSPECT_EMPTY`), of als er deze ronde niet is opgehaald, gaat alleen `insert` naar `waste_sync`, met `p_remove`, `p_move` en `p_rename` leeg. Zo komen er tijdens een storing wel taken bij voor al bekende ophaaldagen die binnen de 14 dagen komen, en verandert er niets aan bestaande afvaltaken. Hetzelfde geldt voor `syncHousehold` vanuit "Opnieuw proberen";
   - **`waste_sync`** als er een ophaaluitkomst is of het plan niet leeg is;
   - **vervallen (BR-54):**
     - `out` open en vandaag > D → `skipped`;
     - `in` open, vandaag > D **en** (er is een `out` met een latere D waarvan `scheduled_date ≤ vandaag`, **of** vandaag ≥ D + `WASTE_IN_EXPIRE_DAYS` (7)) → `skipped`;
     - alleen `where status in ('todo','in_progress')`;
   - **storing:** `wasteSyncHealth` op de stand ná `waste_sync`. Bij `failed` eerst `markWasteAlarm`, dan `dispatcher.notify` (§18.9.3).
4. `TickReport.waste = { calendars, fetched, fetchFailed, inserted, moved, renamed, removed, expired, alerted }`. Alleen tellingen en een foutcode.

BR-16 raakt afvaltaken niet. Het Vercel-vangnet dekt de stap mee.

### 18.9 Meldingen

#### 18.9.1 Herinneringen (BR-55)
- Voor afvaltaken vervangt `wasteReminder(task, now, tz)` `taskMessages` volledig. Er komt dus nooit "deadline nadert" of "verlopen" (AC-211).
- Anker: `out` om (D−1) 21:00, `in` om D 18:00. Alleen voor open taken, en alleen als `0 ≤ now − anker < 90 min`.
- Type `reminder` (voorkeur `notify_reminders`), dedupe-sleutel `waste:<taskId>:<anker-ISO>`.
- Tekst: **M-01** (`out`) en **M-02** (`in`, enkel- of meervoud op basis van `cardinality(waste_streams)`).

#### 18.9.2 Overig
Afvaltaken tellen mee in het dag- en avondoverzicht. "Taak gedaan" volgt de eigen voorkeur.

#### 18.9.3 Storingsmelding
- Type `waste_sync_failed`. `recipientsFor` heeft er een eigen tak voor: ieder actief lid met account en `role = 'admin'`, los van de voorkeuren. Push als die aan staat. Het label in de lijst is T-39c.
- Dedupe-sleutel `waste-failed:<last_success_at ISO>` per ontvanger. Dat is één melding per storing, ook als de oorzaak of de reden tijdens de storing verandert.
- Tekst: `wasteFailureMessage(variant, lastSuccessAt, tz)` → **M-03 / M-04 / M-05** volgens de variant bij het versturen (§18.8.5; `null` → M-03). Nooit een adres of naam.
- **URL:** `appUrl.wasteSettings()` = `/instellingen/afvalkalender`, al in WP3b.
  - In de oude UI is dat een server-`redirect` naar `/instellingen#afvalkalender`. De sectie brengt zichzelf in beeld bij `location.hash === '#afvalkalender'`.
  - In WP7 wordt dezelfde route de echte subpagina.

### 18.10 Gelijktijdigheid en idempotentie

| Situatie | Mechanisme | Uitkomst |
| --- | --- | --- |
| Twee ticks tegelijk | claim; slot; sleutel + `on conflict do nothing`; dedupe | één taak per dag en richting, geen dubbele meldingen (AC-197) |
| Dubbel tikken op "Ja, aanzetten" | slot in `waste_save` | één adres, één set taken (AC-191) |
| Dubbel tikken bij hetzelfde adres | `waste_sync` onder het slot | geen extra taken; beide keren T-92 |
| Twee beheerders, verschillende adressen | slot; laatste commit geldt | nooit taken van twee adressen (AC-214) |
| Tick plant terwijl het adres wijzigt | `version` in de claim en in `waste_sync` | `stale` → niets doen |
| Afvinken tijdens verschuiven, hernoemen of opruimen | elke stap alleen `where status in (todo, in_progress)` | afgevinkt blijft staan (AC-202) |
| Notitie tijdens een verschuiving | move is een update | de notitie blijft (AC-198) |
| Overslaan en ongedaan maken, ook offline | trigger; de wachtrij is FIFO | eindstand volgt de laatste actie (AC-209) |
| "Opnieuw proberen" vaak achter elkaar, of vlak na de tick | claim ≥ 60 s | hooguit één opvraging per minuut; de tweede ziet T-79 (AC-236 c) |
| Pagina open tijdens een lopende poging | gezondheid negeert `last_attempt_at` | geen kort flitsende H2 |
| Claim zonder uitkomst na één leeg antwoord | alarm op `last_failure_at` | geen `failed`, geen melding (AC-205) |
| Storing terwijl een bewaarde ophaaldag het venster in schuift | na een mislukte ophaling alleen `insert` (§18.8.6) | taken voor die dag worden klaargezet; geen bestaande afvaltaak verwijderd, verschoven of hernoemd; BR-54 loopt door (AC-204) |
| Alarm en daarna een gelijktijdig succes | `markWasteAlarm … and last_success_at = :lastSuccessAt` | geen blijvend alarm na herstel |

### 18.11 Foutafhandeling: van uitkomst naar toestand en tekst-ID
Alle teksten komen uit UX §13.16. "Melding onderin" = toast; "regel" = tekst in de pagina.

**Instellingen (beheerder):**

| Uitkomst | Toestand (UX §13.8.1) | Tekst-ID's | Bewaard? |
| --- | --- | --- | --- |
| laden bezig / mislukt | skelet / "Laden mislukt" + Opnieuw | — / T-68 | — |
| zod-fout (client of server) | A met veldfout | T-43, T-44, T-44b | nee |
| lookup of confirm bezig | B | T-41b "Zoeken…" | — |
| `found` | C | T-45, T-45a, T-46, T-46b; per bak zonder datum T-45b; bij wijzigen + T-48 | nee |
| `choose` | C2 | T-61 + rij per kandidaat | nee |
| `not_found` (A zonder passende kandidaat, of B geeft `{}`, `[]` of 404) | D (regel boven de velden, zonder rode rand) | T-60 | nee |
| `no_streams` | E | T-62 | nee |
| `no_upcoming` | F2 | T-64 (aanzetten) / T-64b (wijzigen) | nee; een bestaand adres blijft |
| `unreachable` | F | T-63 (aanzetten) / T-63b (wijzigen) | nee; een bestaand adres blijft |
| `saved`, `mode: 'enabled'`, `inserted > 0` | G + melding onderin | **T-90** (Bekijken → Kalender week); tip T-54 eenmalig | ja |
| `saved`, `mode: 'enabled'`, `inserted = 0` (eerstvolgende ophaaldag verder dan 14 dagen weg) | G + melding onderin | **T-90b** (zonder Bekijken); tip T-54 eenmalig; de datum staat onder Volgende ophaaldagen | ja |
| `saved`, `mode: 'changed'` | G + melding onderin | T-91 | ja |
| `saved`, `mode: 'unchanged'` | G + melding onderin | T-92, nooit T-79 | ja (stand bijgewerkt) |
| `UNKNOWN` bij opslaan (ook een botsing op `version`) | C blijft, invoer blijft | T-65 | nee |
| `FORBIDDEN` (elke actie) | melding onderin, pagina → J | T-66 | nee |
| offline | laatst bekende stand; knoppen uit | T-67 onder de uitgeschakelde knop | — |
| `health.ok` | G | T-70, T-50, T-52, T-55; bak zonder datum T-45b | — |
| `health.ok` + `notice` | G″ | T-73 | — |
| `health.retrying` | G′, met de bewaarde datums | T-71; bij `ADDRESS_GONE` T-71b | — |
| `health.failed` | H + rij "Niet bijgewerkt". **Onder "Volgende ophaaldagen · stand <dag>" staan de bewaarde datums van de laatste geslaagde bijwerking, ook bij H2**; T-45b alleen voor een bak zonder komende datum in de bewaarde stand | T-72 (kop, sectiekop "stand <dag>"), T-37; balk per variant: H1 T-75/T-76 (ook bij `last_error_code null`), H2 T-77 + T-77a/T-77b, H3 T-77c/T-77d | — |
| retry bezig | balk H, knop uit | T-77e | — |
| retry `done`, `state = ok` | G (balk weg) + melding onderin | T-70, T-94 | — |
| retry `done`, `state = failed` | balk H blijft (variant kan wisselen) + regel in de balk | T-78 met `attemptedAt` (hh:mm) | — |
| retry `done`, `state = retrying` | alleen mogelijk als de storing nog niet was vastgesteld (§18.8.5); G′ | T-71/T-71b | — |
| retry `too_soon` | balk H blijft; regel in de balk op de plek van T-78; **geen melding onderin** | T-79 | — |
| H3 "Adres controleren" | A′, gevuld | T-47 | — |
| uitzetten: sheet | I | T-80 + T-81 (n ≥ 2) / T-81b (n = 1) / T-81c (n = 0), T-82 | — |
| uitzetten: `{removed}` | A + melding onderin | T-93 | adres weg |

**Gezinslid:** J, met T-38/T-38b (aan) of T-39/T-39b (uit). Het gezinslid ziet nooit health, balk of stille regels.

**Taken en meldingen:**

| Uitkomst | Tekst-ID's |
| --- | --- |
| afvinken | T-30 |
| buitenzetten overslaan (doorwerking) | T-31 |
| `FORBIDDEN` op wijzigen, verplaatsen of verwijderen (ook uit de wachtrij, 42501) | T-33 |
| detail | T-20…T-25 (T-25 alleen bij de eigen instelling Herinneringen aan, een open taak en een moment in de toekomst), T-27, T-28 |
| lijst en kalender | T-15…T-19 |
| herinneringen | M-01, M-02 |
| storing | M-03 / M-04 / M-05 (variant), label T-39c |

### 18.12 Privacy en logging (BR-58, AC-212, AC-218)
- **Bewaard:** postcode, huisnummer, toevoeging en `bag_id` (de adrescode van de gemeente) [OPEN: V-58], alleen in `waste_calendars`, alleen leesbaar voor beheerders. Bij "nee" op V-58 vervalt `bag_id` (§18.3.1).
- **Nooit bewaard of doorgegeven:** de coördinaten (`latitude`/`longitude`), `woonplaatsId` en `gemeenteId` uit A, en `content`/`icon_data` uit B. zod stript ze vóór elk ander gebruik.
- **Weg:** bij uitzetten, bij het verwijderen van het huishouden (cascade), en bij terugrollen alleen de open taken (§18.16).
- **Nooit in eigen logs:** postcode, nummer, `bag_id`, straat, bron-URL's, `error.message` van een fetch en het huishoud-id. Logregels bevatten alleen tellingen, codes en `fetchMs`. `next.config` zet geen `logging.fetches.fullUrl`.
- **Platformlogs, controle door de security-reviewer in WP3b:**
  - **Vercel Observability, tab External APIs:** per hostname voor elk plan, per pad alleen met Observability Plus (betaald). Het pad bevat postcode en huisnummer (A) of de `bag_id` (B, C). Dit blijft binnen Jurgens eigen Vercel-account. De reviewer noteert wat het huidige plan werkelijk bewaart en hoe lang.
  - **Supabase:** de body van RPC-aanroepen door de service role komt niet in de API-logs. Controleren.
  - **pg_net:** P0 en U0.2 gebruikten alleen het openbare testadres en een verzonnen adrescode; de antwoordrijen zijn verwijderd. De app zelf gebruikt pg_net nooit voor de afvalkalender.
- **Naar buiten:** alleen postcode + nummer (A) of `bag_id` (B, C), alleen naar de vaste host, vanaf Vercel `fra1`.

### 18.13 Performance-impact
- **Tick normaal:** 2 kleine query's, planning in het geheugen, 0 schrijfacties zonder verandering; ≈ 20–40 ms.
- **Twee keer per dag** (en elk uur bij een storing): 2–3 GET's parallel (hard maximaal 12 s) en 1 RPC. `markWasteAlarm` is hooguit één update per storing.
- **C(J+1) buiten december** kost één extra GET per ophaling, alleen als C(J) geen komende datum meer heeft (in de praktijk alleen eind november, en begin januari tot de publicatie). De budgetten blijven gelijk.
- **Geen C(J−1)**, dus geen extra GET bij het instellen in januari.
- **B is ~20 KB** per ophaling; het strippen gebeurt direct na het parsen.
- Ophalen start alleen als de tick nog geen 10 s loopt. Meting in WP3b: p95 van de tickduur < 5 s zonder ophalen.
- **Snapshot:** geen extra query in de oude UI. In WP4 komen de drie kolommen in de kolomlijst, en `waste_calendar_enabled` in `core`.
- **Volume:** ± 200 afvaltaken per jaar.

### 18.14 Oude UI (WP3b, `main`) en nieuwe UI (`v2-ui`)

**Oude UI (volgens UX §13.13.1):**
- `afval-section.tsx` + springlink T-34b: toestanden volgens §18.11, inline, met beschrijving T-34.
  - D gebruikt de tekststijl van de veldfout als één regel boven de velden, **zonder** rode rand.
  - F, F2 en H zijn `bg-muted`-balken.
  - Bevestigen bij uitzetten gaat via de bestaande Dialog.
  - Een gezinslid ziet alleen J.
- `task-card.tsx`:
  - meta met recycle-icoon + T-15;
  - rechterkolom T-16/T-17/T-18;
  - geen deadlinebadge behalve "… te laat";
  - nooit "21:00".
- `selectors.ts#dashboardData`, alleen voor afvaltaken:
  - open `out` van D−1 blijft tot D 07:45 onder Vandaag;
  - `in` met `available_from > now` staat onder Binnenkort.
- `task-detail-sheet.tsx`:
  - geen omschrijving;
  - ⋯-menu alleen met Ik ben ermee bezig / Niet meer bezig / Deze keer overslaan / Toch nog doen (dat laatste alleen tot het einde van D);
  - infolijst T-20…T-25 en uitlegregel T-27;
  - overslaan-melding T-31.
- `calendar-items.tsx`: slepen uit; "vanaf 22:00" en "vanaf 12:00".
- `notifications/format.ts`: label T-39c en icoon.
- `mutations.ts`: optimistisch overslaan en ongedaan maken van `out` neemt `in` mee.
- Route `instellingen/afvalkalender` (redirect, §18.9.3).

**Nieuwe UI:** zie de W-03-regels bij WP4–WP9 in §15 en AC-224…AC-235. Er komt geen nieuwe migratie.

### 18.15 Tests per acceptatiecriterium

- **De bron wordt altijd nagebootst:**
  - unit en integratie via `deps.fetch`, met de P0-fixture (`p0-2591BB-87.json`) en de `synthetisch-*.json` uit §18.1.6;
  - E2E via de stub `tests/e2e/support/waste-stub.mjs` op `127.0.0.1`.
- **Stub-scenario's:**
  - normaal;
  - meerdere adressen;
  - onbekend (A `[]`);
  - alleen GFT;
  - onbereikbaar;
  - leeg (C(J) `[]`);
  - adres weg (B `{}`);
  - jaareinde (P0-vorm op 26 november, C(J+1) `[]`);
  - C(J+1) met alleen kerstbomen;
  - december zonder J+1;
  - januari met lege C(J);
  - eerstvolgende dag over 3 weken;
  - verschuiving;
  - traag (10 s);
  - teller (telt verzoeken per pad, voor "geen verzoek" en "geen C(J−1)").
- **Waar de tests staan:**
  - DB: `supabase/tests/70_afval.sql`, plus `gelijktijdig.sh`;
  - integratie: `tests/integration/waste.test.ts`;
  - E2E: `tests/e2e/waste.spec.ts`.
- Een tekst-ID in de E2E-kolom betekent: de exacte tekst uit UX §13.16 is zichtbaar.

| AC | Unit | DB | Int | E2E |
| --- | --- | --- | --- | --- |
| 183 | — | — | (a) confirm → adres + taken vandaag…+14; `mode: 'enabled'`, `inserted > 0`; (b) adres met eerstvolgende dag over 21 dagen → `saved`, `inserted = 0`, 0 afvaltaken | (a) invullen → C (T-46) → aanzetten → **T-90** (met Bekijken); (b) eerstvolgende dag over 3 weken → C (geen F2) → aanzetten → **T-90b** (zonder Bekijken), 0 afvaltaken |
| 184 | `normalizeWasteAddress` | — | geen fetch bij een zod-fout (spy 0) | T-43/T-44/T-44b; Zoeken uit bij lege velden |
| 185 | `matchCandidate` → `not_found`; A `[]` (P0-fixture `adres_onbekend`) → `not_found`; lookup met B `{}` → `not_found` | — | bestaand adres ongewijzigd | D, T-60, velden gevuld |
| 186 | alleen GFT → `no_streams`; oktober zonder enkele datum van rest/papier/PMD in J → `no_streams`; **januari, lege C(J) → `no_upcoming`**, ongeacht het vorige jaar | — | niets bewaard; stub-teller: **geen** verzoek naar `/kalender/<J−1>` | E, T-62 |
| 187 | `huisletter`/`huisnummerToevoeging` `""` = geen; `choose` bij "A"/"B"; `suffix ""` | — | via de action | C2 → rij tikken → C |
| 188 | time-out, 503, kapotte JSON, te groot, redirect, niet-leeg object uit B → `unreachable` | — | niets bewaard; oud adres + `version` gelijk | F, T-63; bij wijzigen T-63b |
| 189 | — | schrijven geweigerd; RPC-rechten | actions als lid → `FORBIDDEN`, fetch-spy 0 | lid ziet geen formulier; T-66 bij degradatie |
| 190 | — | select per rol; `enabled()` | `getWasteSettings` als lid: geen adres of health | — |
| 191 | — | `waste_save` 2× parallel | twee adressen tegelijk | — |
| 192 | `wasteTaskFields` out; `description = null` | `complete_task` 07:50 → te laat | — | T-16 "vanaf 22:00", T-21/T-22 |
| 193 | `in`-velden | — | — | vóór 12:00 onder Binnenkort (T-18), T-23/T-24 |
| 194 | `wasteReminder` | — | tick 21:00/18:00 | — |
| 195 | `wasteTitle` 7 × 2 = T-01…T-14 | — | 1 herinnering per ontvanger | — |
| 196 | `classifyStream` op de P0-fixture: 5 soorten → rest/papier/pmd + 2× `null` | — | — | — |
| 197 | +3/+14/+15 | sleutel | 2× na elkaar en 2× parallel | — |
| 198 | `planWasteTasks`: (a) 25-12 → 26-12 = move van beide, zelfde id; (b) doel-`out` bestaat al (done) → `out` remove, `in` move; (c) 4 dagen → remove + insert; (d) geen gemeenschappelijke bak → remove + insert; (e) `out` op D′ voorbij → `out` remove, `in` move | move onder de guard (service role) lukt; als lid → 42501 | notitie en `in_progress` blijven; geen historie; herinnering op het nieuwe anker | — |
| 199 | remove beide | — | hard weg | — |
| 200 | `out` done → `in` blijft | — | idem | — |
| 201 | rename | rename raakt done niet | — | — |
| 202 | — | remove/move/rename op done/skipped → 0 rijen | — | — |
| 203 | (a)–(e) | — | tick op die tijden | — |
| 204 | **Parser:** B `{}` (letterlijk U0.2) → `NOT_FOUND`; B `[]` → `NOT_FOUND`; B niet-leeg object → `FORMAT`. <br>**`hasNoUpcoming`:** alle drie leeg = ja; alleen papier met een datum over 25 dagen = nee; alleen komende GFT- of kerstboomdatums = ja. <br>**`classifyEmpty`:** (a) P0-fixture op 2026-11-26: C(2026) alleen datums in het verleden, C(2027) `[]` → `success` + notice, geen `SUSPECT_EMPTY`; (b) dezelfde vorm op 2026-06-15 → `SUSPECT_EMPTY`; (c) 2027-01-01 met C(2027) `[]` → `SUSPECT_EMPTY`; (d) 2026-11-26 met C(2027) met datums van rest/papier/PMD → `success` + planning; (e) 2026-11-26 met C(2027) met **alleen kerstbomen** → `success` + notice; (f) 2026-12-28, na de laatste decemberdatum, C(2027) `[]` → `success` + notice; (g) 2026-10-05 met P0-fixture (volgende dag 27-10) → `success` | `waste_sync 'failure'`: `last_failure_at = p_now`; zelfde code → `error_since` blijft; andere code → reset; `'success'` → alle vier null; `'failure'` laat `pickups` ongewijzigd | 500/time-out/leeg/adres weg (B `{}`) → adres en `pickups` gelijk; **geen bestaande afvaltaak verwijderd, verschoven of hernoemd** (`removed = moved = renamed = 0`, ook als het nieuwe antwoord een andere dag zou geven); **bewaarde datum schuift tijdens de storing het venster in**: bewaarde ophaaldag D = vandaag + 15, volgende dag een tick met stub "onbereikbaar" en apart met stub "leeg" → `out` en `in` voor D worden klaargezet (`inserted = 2`); **BR-54 loopt door**: een open `out` van gisteren wordt tijdens de storing `skipped`; adres weg → `last_error_code = 'ADDRESS_GONE'`; andere tickstappen draaien; volgende poging ≤ 75 min; console zonder adres. **Regressies:** P0-fixture door twee ticks op 2026-10-05 → geen `SUSPECT_EMPTY`, geen melding; tick eind november (P0-vorm) → geen melding, T-73. **Fetch-spy:** op 2026-11-26 wordt `/kalender/2027` opgehaald; in oktober met komende datums **niet** | G′ met T-71, met de bewaarde datums onder Volgende ophaaldagen; adres weg: T-71b; gezinslid ziet niets |
| 205 | `wasteSyncHealth`: (a) leeg 06:00, claim om 07:15 zonder uitkomst, now 07:20 → `retrying` (geen `failed`); (b) leeg 06:00 + leeg 07:15 → `failed/empty`, variant H2; (c) leeg 06:00 + 06:30 → `retrying`; (d) UNREACHABLE 06:00 + leeg 07:15 → `retrying`; (e) 48 h + 1 min, `last_error_code null` → `failed/stale`, variant H1; (f) `alarm_since` gezet, daarna UNREACHABLE (reset, < 48 h) → `failed/held`, H1; (g) succes → `ok`; (h) leeg 06:00/06:20/06:40 → `retrying`; `wasteFailureVariant` voor alle codes en `null`; teksten zonder adres | claim-update laat `last_failure_at` ongemoeid; checks weigeren `last_failure_at` zonder code en `last_failure_at < error_since`; `authenticated` kan geen van de kolommen schrijven; `markWasteAlarm` met een verouderd `last_success_at` → 0 rijen | over meerdere ticks elk 1 melding voor Jurgen en Ellen (M-03/M-04/M-05 per variant), 0 voor Lynn; tick met overgeslagen ophaalstap (budget) en 48 h stil → M-03; na succes + nieuwe storing opnieuw 1; na een alarm door leeg en daarna UNREACHABLE blijft `failed`; `getWasteSettings` bij H2 geeft de bewaarde eerstvolgende datums per bak | stub "leeg" twee keer met een klok ≥ 60 min → H2 (T-77 + T-77b), **bewaarde datums blijven onder "Volgende ophaaldagen · stand <dag>"**; stub "onbereikbaar" + 48 h → H1 (T-75/T-76); stub "adres weg" + 48 h → H3 (T-77c/T-77d, twee knoppen); gezinslid geen balk |
| 206 | zomer- en wintertijd | — | — | — |
| 207 | — | `in` afvinken + terugdraaien door lid; `out` ongewijzigd | idem, historie zonder persoon | ja |
| 208 | `permissions`: afvaltaak niet te bewerken, verplaatsen of verwijderen | beheerder én lid: update van title, scheduled_date, due_at, description, reminders, prioriteit, `recurrence_id`, `waste_*` → 42501; REST-delete 0 rijen; `delete_task` → 42501; status todo/in_progress/skipped en complete/undo lukken | `moveTask`/`updateTask` (ook "wordt terugkerend": geen weesreeks)/`deleteTask` → `FORBIDDEN`; wachtrij `move` → `FORBIDDEN` → T-33 | knoppen verborgen; T-27 |
| 209 | — | lid slaat `out` over → `in` skipped; ongedaan → beide todo; service role slaat `out` over → `in` ongewijzigd; alleen `in` overslaan → `out` ongewijzigd | 18:00-herinnering komt niet na overslaan | T-31 + Ongedaan maken |
| 210 | `findExpiredWasteTasks`: out na D; in na de volgende `out`-dag; in uiterlijk op D+7 zonder volgende `out` (bovengrens); opeenvolgende dagen | — | tick di 07:46 / wo / do; lange pauze → in op D+7 skipped | — |
| 211 | reminder alleen voor `notify_reminders`; nooit deadline/overdue voor afvaltaken | — | Jurgen/Ellen wel, Lynn (uit) niet, Kai (uitgezet) niet; Lynn aan → wel | T-25 alleen bij de eigen instelling aan |
| 212 | alle builders: grep op postcode, nummer, bagId en namen = 0 | — | meldingen, push-payload (spy), titels, completions en console bevatten geen fixture-adres | — |
| 213 | — | `disable_waste_calendar`: rij weg, open afvaltaken weg, done/skipped blijven; tweede keer 0 | daarna tick: fetch-spy 0, geen afvaltaken; lid: `enabled = false` | I met T-80 + T-81 (n = 4) en T-81c (n = 0); T-93; annuleren |
| 214 | — | `waste_save` met een ander adres: open weg, done blijft | nooit twee adressen; ongeldig nieuw adres → oude blijft | A′ (T-47) → C (T-48) → T-91 |
| 215 | — | `waste_sync`/`waste_save`/`disable` raken geen taak met `waste_direction is null` | idem | tip T-54 één keer |
| 216 | — | `delete_household` → `waste_calendars` en afvaltaken weg; ander huishouden intact | — | — |
| 217 | — | — | — | UC-13/14/15 in de oude UI + CP-W03 (§18.16 U3) + live-rooktest Jurgen |
| 218 | source: host = constante, pad alleen postcode-nummer of bagId, headers alleen Accept/UA, `redirect: 'error'`, override alleen loopback; zod stript lat/lon/ids uit A en `content`/`icon_data` uit B; een synthetische B van ~20 KB wordt geparsed | — | fetch-spy over lookup, confirm, sync en retry | — |
| 219 | — | insert met `waste_direction` door lid en beheerder → 42501 (policy én guard), ook met `members_can_create_tasks` uit; systeem-insert lukt met maker `null` | — | — |
| 220 | `notice`: (a) 20 december zonder J+1 = ja; (b) 26 november zonder komende datum en zonder J+1 = ja; 10 december met een komende datum en een venster vóór januari = nee; november met een komende datum = nee; met J+1-datums = nee; `retrying` → geen notice | — | — | G″ met T-73 (december en november) |
| 221 | `dueForFetch`: 05:59 nee, 06:00 ja, 12:00 nee na succes om 06:05, 17:00 ja, na een mislukking elk uur | — | verschuiving om 14:00 → taak om 17:xx aanwezig | — |
| 222 | — | — | zelfde adres bevestigen direct na een tick → `saved`, `mode: 'unchanged'`, geen claim, notitie en `in_progress` blijven; `version` gewijzigd → `UNKNOWN` | T-92; nooit T-79; botsing → T-65 |
| 223 | — | — | `appUrl.wasteSettings()` = `/instellingen/afvalkalender` | melding openen → sectie in beeld |
| 236 | `wasteFailureVariant`; (h) uit 205 (drie keer binnen een uur versnelt niets) | claim 2× binnen 60 s → tweede 0 rijen | retry in H1: (a) stub ok → `done`, `state ok`, stub-teller 1; (b) stub fout → `done`, `state failed`, `attemptedAt`; (c) claim < 60 s → `too_soon`, **stub-teller 0**; retry vanuit `failed` zet `alarm_since` | balk H1 → "Opnieuw proberen" → T-77e, knop uit, rest van de pagina bruikbaar → (a) balk weg, T-70, T-94; (b) balk blijft, T-78 in de balk; (c) na een tweede retry binnen 60 s: T-79 in de balk en geen toast (assert: geen toast-element); offline: knop uit + T-67 |
| 237 | `lookupWasteCalendar`: geen komende datum → `no_upcoming`; alleen papier over 25 dagen → `found` (eerstvolgende datum, 0 taken); 2 januari, lege C(J) → `no_upcoming`, zowel als het vorige jaar datums had als niet (er wordt geen C(J−1) opgehaald); 26 november, P0-vorm, J+1 `[]` → `no_upcoming` (geen jaareinde-uitzondering bij instellen) | — | confirm bij `no_upcoming` → niets bewaard, `version` en taken gelijk; bij een bestaand adres blijft het oude | F2 met T-64 en hoofdknop "Adres zoeken", velden gevuld; bij wijzigen T-64b |
| 224–235 | in hun WP (§15) | | | |

Daarnaast:
- regressie `30_wp2a`;
- privacyschema: geen persoonskolommen buiten `waste_calendars`;
- `route.test.ts` van de tick met `waste.moved` en `waste.alerted`.

### 18.16 Uitrol (live op `main`, oude UI)

| # | Stap | Controle |
| --- | --- | --- |
| **P0** | Probe van de bron **en U0.2: uitgevoerd op 2026-09-29** (§18.1.6) | verslag en fixture in `docs/wijzigingen/W-03/probe/`; antwoordrijen verwijderd; rechten vóór = na |
| **U0** | **U0.1** gemeenteregel 22:00/07:45 op de pagina zelf (Jurgen). Bij voorkeur vóór `/design-go`, uiterlijk vóór U4 | uitkomst letterlijk in PROGRESS; een afwijking volgens §18.1.7 |
| U1 | Bouwen en lokaal groen: `test:db` (`70_afval.sql`, `gelijktijdig.sh`), vitest, integratie, E2E (oude UI + stub, alle scenario's). Fixtures op basis van `p0-2591BB-87.json` plus `synthetisch-*.json` | alles groen |
| U2 | Reviews: code, test-writer, security, performance; herstellen | GO |
| **U3** | **Checkpoint CP-W03** (beeldreview vóór de livegang): zie de lijst hieronder. Dit is **de enige lijst**; UX §13.13.3 en AC-217 verwijzen ernaar. visual-qa en ux-reviewer (licht) beoordelen; BLOKKEREND en GEMIDDELD worden hersteld vóór U4. Rapporten: `docs/reviews/wp3b-visual-qa.md`, `wp3b-ux-reviewer.md`; checkpoint in PROGRESS | GO van beide |
| U4 | `…_320`, dan `…_330` via `apply_migration`; push naar `main` (`fra1`) | beveiligingsadvies; RLS aan op `waste_calendars`; **L4 volgens D-046**: rechten van `anon`/`authenticated`/`public` op `net` gelijk aan de stand vóór P0, en `net` niet bij de exposed schemas; `/api/status`; tick 200 met `waste.calendars = 0` |
| U5 | Rooktest met Jurgen (AC-217): zijn adres, vergelijken met de site, taken zichtbaar, de volgende dag "bijgewerkt", en de herinnering om 21:00. **De eerste echte opzoeking is ook de controle op bereikbaarheid vanuit Vercel `fra1`**; `fetchMs` uit de tick-log noteren. Bij een blokkade: zie hieronder | akkoord in PROGRESS |
| U6 | Jurgen één keer herinneren aan het stoppen van zijn handmatige reeks (BR-57). **Niet** bij een blokkade in U5 | PROGRESS |
| U7 | `main` → `v2-ui` mergen | — |
| U8 | Succescriteria op dag 30 en 90 | PROGRESS |

**Blokkade vanuit Vercel bij U5 (403, captcha, WAF, of structureel time-out):**
- **De afvalkalender blijft uit.** De opzoeking geeft F (T-63), en er wordt **geen adres bewaard**: bevestigen bewaart alleen bij `found`. `waste_calendars` blijft leeg, dus de tickstap doet niets (`waste.calendars = 0`), en er ontstaan geen afvaltaken en geen storingsmeldingen.
- **Geen terugrol nodig.** De migraties zijn additief, en de sectie is zonder adres onschadelijk. De rest van de app blijft zoals hij is. De sectie blijft zichtbaar in toestand A/F, zonder verbergen of vlag.
- **Jurgen houdt zijn handmatige reeks** (U6 vervalt tot er een oplossing is).
- **De hoofdsessie zet een wijzigingsverzoek in PROGRESS**, met voor Jurgen deze opties:
  - (a) ophalen via een andere route (bijvoorbeeld vanuit de database, waar P0 wel werkte). Dat is een ontwerpwijziging;
  - (b) de gemeente om toestemming vragen;
  - (c) de functie verwijderen en bij gewone terugkerende taken blijven.
- **Ontstaat een blokkade pas later** (met een bewaard adres), dan geldt de gewone storingsroute: H1 na 48 uur en M-03 (§18.8.5).

**CP-W03, de enige lijst** (oude UI; 390×844 licht; de met ◐ gemarkeerde ook donker via `--donker`; lokale stack met stub; `docs/screenshots/wp3b/`; bestandsnaam `cpw03-<nr>-<naam>`):

*Instellingen, beheerder*
1. Laden (skelet)
2. Laden mislukt (T-68 + Opnieuw)
3. A — uit (T-40, T-41, T-42, T-34) ◐
4. A met veldfouten (T-43, T-44; T-44b)
5. A′ — wijzigen (T-47, Annuleren)
6. B — zoeken (T-41b "Zoeken…", velden uit)
7. C — Klopt dit? (T-45, T-45a met "Den Haag", T-46, T-46b) ◐
8. C "gedeeltelijk": één bak met T-45b
9. C bij een adres waarvan de eerstvolgende ophaaldag over 3 weken ligt: C (geen F2), met de datum onder Eerstvolgende ophaaldagen. Daarna "Ja, aanzetten" → G met melding **T-90b** (zonder Bekijken) en 0 afvaltaken
10. C bij wijzigen (T-48, "Ja, dit adres gebruiken")
11. C2 — meerdere adressen (T-61)
12. D — onbekend (T-60, zonder rode rand) ◐
13. E — geen bakken (T-62)
14. F — onbereikbaar (T-63)
15. F2 — geen komende ophaaldagen (T-64, hoofdknop Adres zoeken), ook in januari ("kalender ontbreekt") ◐
16. C met opslaan mislukt (T-65)
17. G — aan, met tip (T-70, T-50, T-52, T-54, T-55) ◐
18. G′ — hapering (T-71) en G′ met adres weg (T-71b), met de bewaarde datums
19. G″ — december (T-73), en eind november zonder komende ophaaldag (T-73)
20. H1 (T-72, T-75, T-76); ook H1 zonder foutcode (achtergrondtaak lag stil; zelfde beeld) ◐
21. H2 (T-77 + T-77b) en H2 in december/januari (T-77 + T-77a). **Onder "Volgende ophaaldagen · stand <dag>" staan de bewaarde datums van de laatste geslaagde bijwerking**, geen T-45b bij bakken met een komende bewaarde datum ◐
22. H3 (T-77c, T-77d, Adres controleren + Opnieuw proberen)
23. H tijdens een poging (T-77e)
24. H na "nog steeds fout" (T-78)
25. H na `too_soon` (T-79 in de balk, geen melding onderin)
26. H die blijft staan als de oorzaak verandert: na een alarm door een leeg antwoord (H2) volgt een onbereikbare poging → balk blijft, tekst wordt H1 (T-75/T-76), geen tweede melding
27. I — uitzetten, n = 4 (T-80, T-81, T-82) en n = 0 (T-81c)
28. Offline (T-67 onder de uitgeschakelde knoppen)
29. Meldingen onderin: T-90 (met Bekijken), T-90b (zonder Bekijken), T-91, T-92, T-93, T-94

*Instellingen, gezinslid*

30. J aan (T-38b) en J uit (T-39b)

*Lijsten, detail, kalender, meldingen*

31. Vandaag ma 19:30: buitenzetten "vanaf 22:00" (T-16) onder Vandaag, binnenzetten "Morgen" (T-19) onder Binnenkort ◐
32. Vandaag di 06:30: buitenzetten "vóór 07:45" (T-17)
33. Vandaag di 09:10: buitenzetten onder Verlopen ("… te laat", zonder klokje), binnenzetten "vanaf 12:00" (T-18) onder Binnenkort
34. Vandaag wo 09:00 (D+1): binnenzetten van di onder Verlopen met "9 uur te laat" (deadline wo 00:00; bestaande weergave, "1 dag te laat" verschijnt pas vanaf wo ± 23:30; UX §13.4); nog niet vervallen, want er is geen volgende buitenzet-taak begonnen en D+7 is niet bereikt
35. Taakdetail buitenzetten, beheerder met Herinneringen aan (T-20, T-21, T-22, T-25, T-27, ⋯-menu) ◐
36. Taakdetail buitenzetten, gezinslid zonder herinneringsrij
37. Taakdetail binnenzetten (T-23, T-24), met en zonder herinneringsrij
38. Overgeslagen afvaltaak (vóór het einde van D): ⋯-menu met "Toch nog doen" en alleen de toegestane acties (AC-217). Geen leeg menu en geen verweesde knop of scheidingslijn
39. Melding onderin na overslaan (T-31)
40. Kalender week en dag met afvaltaken ("vanaf 22:00", "vanaf 12:00")
41. Meldingenlijst met een storingsmelding (M-03, label T-39c) en een herinnering (M-01)

**Terugrollen:**
1. Vercel Instant Rollback naar een deployment **zonder** WP3b.
2. **Direct daarna** `supabase/ops/waste_rollback.sql` via de koppeling:
   ```sql
   delete from public.tasks where waste_direction is not null and status in ('todo','in_progress');
   ```
   - **Reden:** de oude tick ziet afvaltaken als gewone taken met `due_at`, en kan dezelfde nacht al "deadline nadert" en "verlopen" sturen.
   - **Wat blijft:** de adresrij. De eerstvolgende tick na het opnieuw uitrollen plant de taken vanzelf opnieuw.
   - **Gevolg:** notities bij open afvaltaken gaan verloren (cascade). Dat is aanvaardbaar bij een noodterugrol, en komt in het totaalvoorstel.
   - **Wordt de terugrol definitief,** dan ook `delete from public.waste_calendars;`.
3. Een terugrol naar een deployment die WP3b al bevat, vraagt geen actie.

**Versimpeltoets terugrol:** "afvalkalender uitzetten" wist meer dan nodig en dwingt de beheerder het adres opnieuw in te voeren. Alleen de open taken verwijderen is de kleinste ingreep die betrouwbaar werkt.

### 18.17 Versimpeltoets

| Onderdeel | Eenvoudigste variant | Gekozen? Waarom |
| --- | --- | --- |
| Ophaaldagen bewaren | niet bewaren | **Nee.** Bij een storing moeten de bekende dagen blijven gelden en zichtbaar blijven. Wel de kleinste vorm: één `jsonb`-kolom |
| Plannen tijdens een storing | niets plannen, of het volledige plan op de bewaarde datums | **Alleen `insert`.** Niets plannen laat een al bekende ophaaldag stil ontbreken. Een volledig plan zou in theorie taken kunnen weghalen of verschuiven op basis van verouderde gegevens. "Alleen nieuwe taken na een mislukte ophaling" is één voorwaarde en goed te toetsen |
| Ophalen | stap in de bestaande tick | **Ja** |
| Tweede ophaalmoment | alleen 06:00 | **Nee.** Een wijziging overdag komt dan te laat voor 21:00 |
| Lock | voorwaardelijke update op `last_attempt_at` | **Ja.** Lease en rate limit tegelijk |
| Leeg-regel | venster van 14 dagen, of "geen komende dag" | **"Geen komende dag".** Eenvoudiger (drie lege lijsten) en zonder vals alarm bij 4-wekelijks papier (P0) |
| Jaareinde | J+1 altijd ophalen | **Nee.** Kost het hele jaar extra GET's en lost het probleem niet op zolang J+1 leeg is. Gekozen: J+1 alleen als het nodig is, plus één maanduitzondering in een pure functie |
| C(J−1) in januari | ophalen om te zien of het adres vorig jaar datums had | **Nee.** Januari zonder komende datum geeft altijd F2, dus C(J−1) verandert de uitkomst nooit. Minder verzoeken, één optie en één stub-scenario minder |
| Datums-vlaggen | `hadAnyDate` (meerdere jaren) + `hadAnyDateInJ` | **Eén veld `hadAnyDateInJ`.** Zonder C(J−1) is het verschil weg. Elke datum in J+1 is komend, dus als `hasNoUpcoming` waar is, heeft J+1 geen relevante datums |
| "Adres weg" herkennen | extra A-verzoek na een leeg antwoord | **Nee.** B geeft voor een onbekende adrescode eenduidig `{}` (U0.2); één vormcontrole in de parser volstaat |
| `no_streams` via B | B zonder rest/papier/PMD | **Nee.** B noemt ook soorten zonder dagen (P0) |
| Meetpunt van het lege-antwoordalarm | `last_attempt_at` hergebruiken | **Nee.** Dat is de claimtijd en geen uitkomst, wat een onterecht alarm geeft. Eén kolom `last_failure_at`, die alleen `waste_sync` schrijft, is de kleinste juiste oplossing |
| Alarm vasthouden tot herstel | niets doen (de balk kan verdwijnen) of afleiden uit de meldingentabel | **Nee.** Verdwijnen verwart na een melding. Afleiden uit meldingen hangt af van de ontvanger en vraagt een extra query via RLS. Eén kolom `alarm_since` met één voorwaardelijke update is deterministisch en rolonafhankelijk |
| Storing zonder foutcode | eigen tekst | **Nee.** H1/M-03 kloppen letterlijk; geen extra tekst of variant |
| Bovengrens binnenzetten | geen | **Nee.** Een taak zou dan onbeperkt bij Verlopen blijven. Eén constante (7 dagen) in dezelfde regel |
| Verschuiving | remove + insert | **Nee.** Stil verlies van notities en "bezig" |
| Storingsteller | `failure_count` over alle soorten | **Nee.** `error_since` per code |
| Waarschuwing kalender volgend jaar | kolom of melding | **Nee.** Afgeleid, alleen een stille regel |
| Probe-route | allowlist in de ontwikkelomgeving | **Nee als enige route.** pg_net testte tegelijk de datacentertoegang (uitgevoerd) |
| Vercel-proef vóór het bouwen | aparte deploy met een testroute | **Nee.** Dat vraagt een ongereviewde productiedeploy; de restgrens wordt bij U5 zichtbaar, met een vastgelegd gevolg |
| Gedrag bij een U5-blokkade | sectie verbergen met een vlag | **Nee.** Zonder bewaard adres is de sectie onschadelijk; een vlag is extra code voor een geval dat misschien niet optreedt. Een definitieve keuze loopt via het wijzigingsverzoek |
| `saved`-varianten | client leidt T-90/T-90b/T-91/T-92 af uit de vorige stand | **Nee.** De server weet het zeker (`mode`, `inserted`) |
| Omschrijving op de taak | vaste tekst in de database | **Nee.** Onjuist op D−1/D+1 |
| Meldings-URL | anker + client-omleiding | **Nee.** Een vaste route werkt in beide UI's |
| Terugrollen | adres + taken wissen | **Nee.** Alleen open taken wissen is voldoende |
| Doorwerking van overslaan | in de service | **Nee.** Een trigger dekt REST, de wachtrij en de actions |
| Verbod op wijzigen | alleen UI + service | **Nee.** De DB-guard is de grens |
| Eén of twee migraties | één | **Twee** (enum eerst committen) |

---

=== §15 regels ===

**(1) Nieuwe rij in de tabel van §15, direct na de rij WP3:**

| **WP3b — Afvalkalender (W-03), live op `main` in de oude UI** | **P0 en U0.2 uitgevoerd op 2026-09-29** (§18.1.6; `docs/wijzigingen/W-03/probe/`: contract A/B/C bevestigd; onbekend adres A `[]`, onbekende adrescode B `{}`, ongepubliceerd jaar C `[]`; geen datacenterblokkade). **Vóór U4: U0.1** (gemeenteregel 22:00/07:45 door Jurgen). **Bij U5:** bereikbaarheid vanaf Vercel `fra1` (bij een blokkade §18.16 U5). **Bouwen:** fixtures uit `probe/` plus synthetische in dezelfde vorm; migraties `…_320` en `…_330` (§18.3–18.7, inclusief `last_failure_at` en `alarm_since`); `src/domain/waste/*` (move; `hasNoUpcoming` en `classifyEmpty` met de jaareinde-uitzondering in november/december en notice T-73; gezondheid met `last_failure_at`/`alarm_since`; `wasteFailureVariant` inclusief `null` → H1; twee ophaalmomenten; J+1 in december of als C(J) geen komende datum meer heeft; geen C(J−1); bovengrens binnenzetten D+7); `src/server/waste/*` (parser met strippen en herkenning van B `{}`); `system/waste/sync.ts` (+ `markWasteAlarm`); `actions/waste.ts` (`saved.mode`, `inserted` → T-90/T-90b, `too_soon` zonder verzoek); tickstap; `wasteReminder`; `recipientsFor`; route `instellingen/afvalkalender` (redirect); `supabase/ops/waste_rollback.sql`; oude UI volgens §18.14 en de tekst-ID's uit §18.11; tests §18.15 met stub-scenario's. **Checkpoint CP-W03 (U3) vóór de livegang.** Uitrol U4–U8 | **WP3 live** (pg_net via `planner.sql`, tick elke 15 min); P0 en U0.2 afgerond (2026-09-29). Niet WP4+ | BR-47…BR-59, UC-13…UC-15, **AC-183…AC-223, AC-236, AC-237**, V-41…V-57, V-58 [OPEN: V-58], D-046 | **CP-W03**: de 41 punten uit §18.16 U3 (de enige lijst), 390×844, ◐ ook donker, in `docs/screenshots/wp3b/`; checkpoint in PROGRESS | code, test-writer, **security** (bron, SSRF/allowlist, adres = persoonsgegeven, strippen van coördinaten en ids uit A, RLS/guard/RPC's, `last_failure_at`/`alarm_since` alleen via de service role, platformlogs §18.12, L4 volgens D-046), **performance** (tickduur met en zonder ophalen), **visual-qa + ux-reviewer (licht) op CP-W03 vóór U4**; rooktest Jurgen (AC-217) |

**(2) W-03-regels voor de bestaande rijen.** Toevoegen aan het eind van de kolom "Doel en inhoud"; de criteria gaan aan het eind van de kolom "BR / UC / bevindingen":

- **WP4:** "✚ W-03: de expliciete kolomlijst van `work` bevat `waste_pickup_date`, `waste_direction` en `waste_streams` (`description` blijft alleen in het detail). De `core`-slice krijgt `wasteCalendarEnabled` via `rpc('waste_calendar_enabled')`. De IDB-cache werkt ook met oudere items zonder deze velden (die worden als gewone taak getoond tot de verversing). `isWasteTask` en de permissiehelpers gelden in de nieuwe store." Criteria: **AC-224**.
- **WP5:** "✚ W-03: lijstrij met kenmerk T-15, rechterkolom T-16…T-19 en plek volgens UX §13.4; taakdetail volgens UX §13.6 (T-20…T-28; T-25 alleen bij de eigen instelling aan); overslaan-melding T-31 met Ongedaan maken van beide; optimistisch overslaan van `out` neemt `in` mee, ook via de wachtrij; verplaatsen of bewerken van een afvaltaak komt nooit in de wachtrij (anders T-33)." Criteria: **AC-225, AC-226, AC-227**. Screenshots van de afvalrij en het afvaldetail horen bij CP2 en CP3.
- **WP6:** "✚ W-03: Taken › Terugkerend toont bovenaan T-96 als `wasteCalendarEnabled` (pijl alleen voor beheerders, naar `/instellingen/afvalkalender`); `?bewerk=<id>` van een afvaltaak opent `?taak=<id>`; 'Wat wil je wijzigen?' en omzetten naar terugkerend zijn nooit bereikbaar voor afvaltaken; zoeken en het categoriefilter vinden afvaltaken." Criteria: **AC-228, AC-229**.
- **WP7:** "✚ W-03: de route `/instellingen/afvalkalender` wordt de echte subpagina (vervangt de redirect uit WP3b), met **alle toestanden en tekst-ID's uit §18.11** (laden en laden mislukt, A, A′, B, C, C2, D, E, F, F2, G, G′, G″, H1/H2/H3 inclusief T-77e/T-78/T-79 in de balk en de bewaarde datums bij H, I met T-81/T-81b/T-81c, J, offline, meldingen onderin T-90, T-90b, T-91…T-94); de rij T-35/T-36/T-37 in de groep Huishouden (gezinslid: rij zonder pijl + T-38/T-39); hergebruikt de actions en `getWasteSettings` uit WP3b ongewijzigd." Criteria: **AC-230, AC-231** (die AC-236 en AC-237 in de nieuwe UI meenemen). Hoort bij de CP3-aanvulling (instellingen). De screenshotpunten 1–30 uit CP-W03 (§18.16 U3) worden daar in de nieuwe UI herhaald.
- **WP8:** "✚ W-03: Kalender dag, week en maand zonder slepen voor afvaltaken ('+ Taak' blijft; T-95 volgens UX §13.11); meldingenlijst met label T-39c en icoon voor `waste_sync_failed`, link naar `/instellingen/afvalkalender`; Overzicht groepeert afvaltaken onder T-97/T-98. Een vanzelf overgeslagen buitenzet- of binnenzet-taak telt als vergeten; een vervallen (verwijderde) afvaltaak telt niet mee." Criteria: **AC-232, AC-233, AC-234**. Hoort bij de CP4-voorbereiding.
- **WP9:** "✚ W-03: E2E-kernflow afvalkalender in de nieuwe UI (aanzetten, Vandaag, detail, overslaan, een storing die de beheerder wel en het gezinslid niet ziet, uitzetten) met de stub; CP4 bevat de afvaltoestanden." Criteria: **AC-235**.

**(3) De alinea onder de tabel** "**Uitrol (V-36):** WP1, WP2a, WP2b en WP3 gaan direct live op `main`, op de oude UI. …" wordt:

> **Uitrol (V-36):** WP1, WP2a, WP2b, WP3 **en WP3b (W-03)** gaan direct live op `main`, op de oude UI. WP4–WP8 worden gebouwd op de branch `v2-ui` en gaan pas samen live na WP9 (§12.3).

---

=== aanvullingen in bestaande secties (per sectie letterlijk) ===

(Niet invoegen.) Bron: r2 (C) als basis, met de wijzigingen uit r3 (C) en r4 (C). Wat in deze samenvoeging nieuw is, is gemarkeerd met *(nieuw)*; die markering hoort niet in de bevroren tekst.

**§2 Systeemgrenzen.** In het codeblok wordt de regel
`Extern: Web Push-diensten van Apple/Google (versleutelde payload met taaktitel), Supabase Auth-mail.`
vervangen door:
```
Extern: Web Push-diensten van Apple/Google (versleutelde payload met taaktitel), Supabase Auth-mail,
        huisvuilkalender.denhaag.nl (alleen vanaf de server; W-03, §18.1).
```
*(nieuw)*

**§3.1 Doelmodel, tabel:**
- Rij `tasks` ✱:
  - kolom "Kolommen", aan het eind toevoegen: `✚ (W-03) waste_pickup_date, waste_direction, waste_streams`;
  - kolom "Constraints / indexen", aan het eind: `✚ (W-03) tasks_waste_key unique (household_id, waste_pickup_date, waste_direction) + check tasks_waste_shape; zie §18.3.2`;
  - kolom "Verwijdergedrag", aan het eind: `vervallen open afvaltaken: hard delete door het systeem (§18.3.2)`.
- Rij `notifications` ✱, kolom "Kolommen": `ongewijzigd, behalve ✱ type (enum zonder task_assigned, swap_request, swap_accepted; ✚ waste_sync_failed, W-03) en ✱ url check`.
- Nieuwe rij, direct na `shopping_items`:
  `| waste_calendars ✚ (W-03) | household_id (PK), postcode, house_number, house_suffix, bag_id [OPEN: V-58], pickups (jsonb), version, last_attempt_at, last_success_at, last_error_code, error_since, last_failure_at (alleen waste_sync), alarm_since; error_since, last_failure_at en alarm_since in plaats van failure_count | checks op vorm en storingskolommen; RLS alleen select voor beheerders; zie §18.3.1 | cascade met het huishouden; weg bij uitzetten |`

**§3.2 Migraties, tabel.** Nieuwe rijen, direct na `…_300_retentie.sql`:
- `| …_320_afval_meldingstype.sql | WP3b | niet-destructief | alleen alter type … add value if not exists 'waste_sync_failed'; apart bestand, omdat de waarde pas na de commit bruikbaar is. Zie §18.3.4 |`
- `| …_330_afvalkalender.sql | WP3b | niet-destructief (additief; de oude code blijft werken) | waste_calendars met last_failure_at, alarm_since en checks op de storingskolommen + RLS + grants; drie tasks-kolommen, check en sleutel; guard, policies en delete_task vervangen; trigger waste_skip_cascade; RPC's waste_save, waste_sync (met p_move), disable_waste_calendar, waste_calendar_enabled; daarna opnieuw revoke execute op private (patroon …_110). Zie §18.3.4 |`
- `| supabase/ops/waste_rollback.sql (geen migratie) | WP3b | ops-script, alleen bij een noodterugrol | verwijdert open afvaltaken (§18.16) |` *(nieuw)*

**§5.2 RLS en rechten per regel.** Drie rijen erbij, direct vóór "Huishouden verwijderen":
- `| Afvalkalender beheren en adres lezen (W-03) | ja | nee | nee | waste_calendars select is_admin, geen schrijfpolicies, RPC disable_waste_calendar, actions requireAdmin (§18.5.1) |`
- `| Afvaltaak wijzigen, verplaatsen, verwijderen, omzetten (W-03) | nee | nee | nee | guard_task_changes, policies op tasks, delete_task (§18.5.2–18.5.4) |`
- `| Afvaltaak status: afvinken, bezig, overslaan (W-03) | ja | ja | nee | bestaande update-policy + trigger waste_skip_cascade (§18.5.5) |`

**§5.3, "Toegestane systeemhandelingen".** Punt 5 erbij, na punt 4:
> 5. `system/waste/sync.ts` (W-03, §18.7–§18.8): opvragen bij de gemeente; `waste_save` na `requireAdmin()` met hercontrole in de RPC; `waste_sync`: afvaltaken invoegen, verschuiven, hernoemen of verwijderen als ze open zijn, en de storingsstand bijwerken; `markWasteAlarm`: alleen `alarm_since`; afvaltaken laten vervallen (BR-54); de storingsmelding via de dispatcher (§18.8.6).

**§6, nieuwe subsectie na §6.5** *(nieuw)*:
> ### 6.6 Afvalkalender (W-03)
> Actions `lookupWasteAddressAction`, `confirmWasteAddressAction`, `retryWasteSyncAction` en `disableWasteCalendarAction`, en de RPC's `waste_save`, `waste_sync`, `disable_waste_calendar` en `waste_calendar_enabled`: zie §18.6 en §18.7.

**§6.5 Achtergrond.** De zin "**Antwoord:** alleen tellingen (`{ planned, skipped, notified, pushed, purged }`)." wordt:
> **Antwoord:** alleen tellingen (`{ planned, skipped, notified, pushed, purged, waste }`), met `waste = { calendars, fetched, fetchFailed, inserted, moved, renamed, removed, expired, alerted }` (W-03, §18.8.6).

**§7 Gelijktijdigheid.** Onder de tabel *(nieuw)*:
> Afvalkalender (W-03): zie §18.10.

**§8 Domeinlogica, tabel:**
- Rij `reminders.ts`, aan het eind toevoegen: `recipientsFor kent waste_sync_failed (actieve beheerders met account, los van voorkeuren); voor afvaltaken wasteReminder in plaats van taskMessages (W-03, §18.9)`.
- Nieuwe rij, na `outbox/merge.ts`: `| ✚ waste/* (W-03) | zie §18.2: address, streams, plan (incl. hasNoUpcoming, classifyEmpty), expire, health, messages |`.

**§9.4 Logging.** Bullet erbij, na "De tick en de dispatcher loggen alleen tellingen en statuscodes …" *(nieuw)*:
> - **Afvalkalender (W-03):** nooit postcode, huisnummer, adrescode, straat, bron-URL's of `error.message` van een fetch; alleen tellingen, codes en `fetchMs` (§18.12).

**§10 Externe diensten, tabel.** Nieuwe rij, na "Planner → tick":
> `| Huisvuilkalender Den Haag (platform Opzet, onofficieel; W-03) | 8 s per verzoek, 12 s totaal per action of tickstap; redirect: 'error'; ≤ 1 MB | niets wijzigen; twee keer per dag opgehaald (06:00/17:00), na een mislukking elk uur opnieuw; storing na > 48 uur of aanhoudend geen komende ophaaldag → één melding aan de beheerders (§18.8.5). Contract bevestigd door probe P0, uitgevoerd op 2026-09-29 (§18.1.6) | geen geheimen |`

**§11.2 Snapshot en Realtime:**
- In de bullet "**Kolommen:** …", aan het eind toevoegen: `Vanaf WP4 bevat de kolomlijst van work ook waste_pickup_date, waste_direction en waste_streams (W-03).`
- In de bullet `core` van "Snapshot opdelen": `core: huishouden, leden, eigen voorkeuren, standaardtaken, reeksen, wasteCalendarEnabled (W-03, via rpc('waste_calendar_enabled'));`

**§11.3 Tick:**
- Nieuwe stap tussen 2 en 3:
  > 2b. **Afval (W-03):** zie §18.8.6. Eigen try/catch; ophalen alleen als de tick nog geen 10 s loopt.
- In stap 3, na "berekening met `taskMessages`/`summaryMessages`/`recipientsFor` (puur);" toevoegen: `voor afvaltaken wasteReminder in plaats van taskMessages (§18.9.1);`

**§12.3.1 Uitrolstrategie, tabel "Twee sporen"** *(nieuw)*. In de rij "Backend op de huidige app", kolom "Werkpakketten": `WP1, WP2a, WP2b, WP3, WP3b (W-03) + herstel van bevindingen`.

**§12.3, stap 5 (terugrollen).** Aan het eind toevoegen:
> Voor WP3b (W-03): Instant Rollback en **direct daarna** `supabase/ops/waste_rollback.sql` (§18.16).

**§12, L4.** Geen aanvulling nodig. De TD kent geen eigen lijst met livecontroles. De D-046-formulering van L4 ("rechten van `anon`/`authenticated`/`public` op `net` gelijk aan de stand vóór P0; `net` niet bij de exposed schemas", in plaats van "geen execute op `net.*`") staat in §18.16 U4.

**§13 Teststrategie.** Onder de bullets:
> - **WP3b (W-03):** zie §18.15 (stub `tests/e2e/support/waste-stub.mjs`, `supabase/tests/70_afval.sql`, `tests/integration/waste.test.ts`, `tests/e2e/waste.spec.ts`).

**§14 Versimpeltoets.** Nieuwe rij onderaan:
> `| Afvalkalender (W-03) | zie §18.17 | — |`

**§17 Besluiten van Jurgen en open punten.** Onder "**Open punten:**", na de bestaande bullet *(nieuw)*:
> - **W-03 afvalkalender (§18):** besluiten V-41…V-57, letterlijk in `docs/PROGRESS.md`. Open vóór `/design-go`: **V-58**, het bewaren van de adrescode (§18.3.1, §18.12) [OPEN: V-58]. Open controles vóór de livegang van WP3b: **U0.1** (gemeenteregel 22:00/07:45, Jurgen) en **U5** (bereikbaarheid vanaf Vercel, §18.16).

---

### Vragen voor Jurgen (beleid, kosten, verplichtingen)
- **V-58 (nummer is een voorstel), adrescode bewaren.** Dit is plan-critic moet 6. Voorgestelde vraag: "Mag de app naast postcode en huisnummer ook het adresnummer van de gemeente bewaren? Dat is een openbare code van jullie adres, die nodig is om de kalender op te halen. Alleen beheerders zien hem, en hij verdwijnt als je de afvalkalender uitzet."
  - **Ja:** het ontwerp blijft zoals het is.
  - **Nee:** het bijwerken zoekt elke keer eerst het adres opnieuw op (één extra verzoek, twee keer per dag). "Adres weg" wordt dan ook herkend als dat opzoeken niets meer vindt. Verder verandert er niets.
  - **Voorstel:** ja.
  - De plek staat gemarkeerd met `[OPEN: V-58]` in §18 (Basis, §18.3.1, §18.12), §15 en §3.1/§17.
- **V-59 (voorstel), U0.1:** dit is een handeling, geen beleidsvraag. Jurgen kijkt één keer op https://www.denhaag.nl/nl/afval/huisvuil-aanbieden/ of de container vanaf 22:00 buiten mag en om 07:45 buiten moet staan. Bij voorkeur in hetzelfde bericht als V-58 (aanbeveling 10).
- **Voor het totaalvoorstel (U5, aanbeveling 10):** blokkeert de gemeente de server van de app bij de eerste echte test, dan blijft de afvalkalender uit. Er wordt niets bewaard, de rest van de app werkt gewoon, en Jurgen kiest daarna tussen (a) een andere route, (b) de gemeente vragen of (c) stoppen met deze functie.

### Bewuste vereenvoudigingen
- C(J−1) is geschrapt: januari zonder komende datum geeft altijd F2. Daardoor vervallen één verzoek, één optie, één stub-scenario en een tweede datums-vlag (alleen `hadAnyDateInJ` blijft).
- "Adres weg" wordt alleen via de vorm van B herkend (`{}` of `[]`), zonder extra A-verzoek.
- Een blokkade bij U5 vraagt geen vlag en geen terugrol: zonder bewaard adres doet de functie niets.
- De regelvolgorde bij het instellen begint nu met `hasNoUpcoming`. Die geeft dezelfde uitkomsten als r5/r6, maar is makkelijker te lezen en te toetsen.

### Status
**KLAAR VOOR PLANREVIEW** (W-03 ronde 4), op voorwaarde dat Jurgen V-58 beantwoordt (verplicht vóór JA). U0.1 wordt bij voorkeur meegevraagd.

Punten voor de hoofdsessie:
- **V-nummers:** V-58 en V-59 zijn voorstellen; zo nodig hernummeren.
- **Na het antwoord op V-58** de markeringen `[OPEN: V-58]` vervangen, of bij "nee" §18.3.1 volgen.
- **Samenvoegen van UX en AC:**
  - AC-183 (b) moet de variant "eerstvolgende dag over 3 weken" bevatten, want §18.15 rij 183 toetst (a)/(b);
  - UX §13.13.3 en AC-217 verwijzen naar U3, dat nu 41 punten heeft;
  - de §15-regel voor WP7 noemt "punten 1–30".

Relevante bestanden:
- /home/user/takenlijstje/docs/wijzigingen/W-03/solution-architect-r4.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/solution-architect-r5.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/solution-architect-r6.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/solution-architect-r3.md en -r2.md (keten (C))
- /home/user/takenlijstje/docs/wijzigingen/W-03/probe/P0-uitkomst.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/samenvoegen.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/samengevoegd/DESIGN_SYSTEM.md (§7.13.4)
- /home/user/takenlijstje/docs/reviews/plan-critic.md

### Wijzigingen ten opzichte van r6 (niet invoegen)

| # | Bron | Was | Wordt |
| --- | --- | --- | --- |
| 1 | U0.2 | B bij een onbekende adrescode onbekend; uitwijkregel via een extra A-verzoek | B geeft `{}` → expliciet `NOT_FOUND` (`ADDRESS_GONE` / `not_found`), geen FORMAT; uitwijkregel vervalt; U0.2 afgerond |
| 2 | aanb. 7 | C(J−1) in januari voor `hadAnyDate`; `includePreviousYearIfEmpty` | geschrapt. Januari zonder komende datum → altijd `no_upcoming` (F2). Eén veld `hadAnyDateInJ` |
| 3 | aanb. 8 | "C(J+1) is opgehaald en leeg" | "C(J+1) bevat geen datum van rest, papier of PMD" (`nextYearHasDate`), met test (e) |
| 4 | aanb. 10 | gedrag van de live code bij een U5-blokkade niet vastgelegd | §18.16 U5: afvalkalender blijft uit, geen adres bewaard, geen terugrol, wijzigingsverzoek |
| 5 | moet 3 | §10 "probe P0 vóór de freeze"; `classifyEmpty` niet in §18.2; rij 204 "(e) alle eerdere r5-gevallen"; T-64 als "eind december" geciteerd | P0 uitgevoerd; `classifyEmpty` in §18.2; rij 204 per functie uitgeschreven; T-64 "rond de jaarwisseling" (§18.8.1) |
| 6 | moet 4 | U3 zonder laden, laden mislukt, "Toch nog doen", Verlopen op D+1, H2 → H1 | U3 punten 1, 2, 26, 34, 38 (41 punten in totaal) |
| 7 | hoofdsessie (DS §7.13.4) | bewaarde datums bij H2 alleen impliciet | expliciet in §18.6, §18.8.4, §18.11, §18.15 (205) en U3 punt 21 |
| 8 | moet 6 | adrescode als "komt in het totaalvoorstel" | `[OPEN: V-58]` met het gevolg van "nee" (§18.3.1) |
| 9 | plan-critic r4 bev. 1, aanb. 3, 4 | taken tijdens een storing impliciet; "1 dag te laat" op D+1; versiegeschiedenis in §18 | alleen insert na een mislukte ophaling (§18.8.4/§18.8.6/§18.10/§18.15/§18.18); "9 uur te laat" wo 09:00; §18.17 weg, §18.18 → §18.17 |
- /home/user/takenlijstje/docs/TECHNICAL_DESIGN.md