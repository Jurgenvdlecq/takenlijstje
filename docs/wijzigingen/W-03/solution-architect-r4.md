## Technisch ontwerp: W-03 afvalkalender (Den Haag), ronde 4

Ik heb niets in bestanden geschreven, want `docs/TECHNICAL_DESIGN.md` is bevroren. Hieronder staan:
- **(A)** de volledige §18, die r3-§18 helemaal vervangt;
- **(B)** de §15-regels;
- **(C)** korte aanvullingen in bestaande TD-secties;
- **(D)** punten voor de analist en de designer;
- de lijst met wijzigingen ten opzichte van r3.

**Documentatie gecontroleerd (2026-09-29):**
- **pg_net, broncode `sql/pg_net.sql` op GitHub:**
  - `net.http_get(url text, params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint`;
  - `net._http_response(id, status_code, content_type, headers jsonb, content text, timed_out bool, error_msg text, created timestamptz)`, een unlogged tabel;
  - de standaard-time-out is 5000 ms, dus in P0 staat hij expliciet op 10000/15000.
- **pg_net PR #285** (samengevoegd op 2026-09-22): nieuwe instelling `pg_net.max_timeout_ms` (standaard 600000). Voor 10000/15000 maakt dat niets uit. De versie op live wordt in P0.0 vastgelegd.
- **Niet direct te lezen:** supabase.com en supabase.github.io (EGRESS_BLOCKED). Daarom komen TTL (standaard 6 uur) en "wordt pas na de commit verstuurd" uit r3 en uit zoekresultaten. P0.0 leest `pg_net.ttl` zelf uit, en het draaiboek is zo opgezet dat het ook werkt als het versturen pas na de commit gebeurt: elke aanroep is een eigen `execute_sql`, en het uitlezen gebeurt in een aparte aanroep.
- **Donkere modus in de oude UI:** `src/app/globals.css` gebruikt `prefers-color-scheme: dark`, en `scripts/visual-check.mjs` kent `--donker`.
- **D-046** en PROGRESS (WP3 livegang, deel 2: pg_net staat in `extensions` op live) gelezen.

**Work packages:** WP3b (live op `main`, oude UI). P0 gaat nu **vóór `/design-go`**. CP-W03 komt vóór de livegang. De W-03-regels voor WP4–WP9 staan op `v2-ui`.

---

# Wijzigingen ten opzichte van r3

| # | Plan-critic | r3 | r4 |
| --- | --- | --- | --- |
| 1 | moet 1 | P0 "bij voorkeur" vóór de freeze, en één voorbeeldaanroep. Controle L4 = "geen execute op `net.*`" | P0 is een **uitvoerbaar draaiboek** vóór `/design-go` (§18.1.6): P0.0–P0.6 met de exacte SQL (`net.http_get` met `timeout_milliseconds`), wat in `docs/wijzigingen/W-03/probe/` komt, wat later als fixture dient, en opruimen op id. **L4 is herschreven volgens D-046:** de rechten op `net` blijven gelijk aan de momentopname van vóór P0, en `net` staat niet bij de exposed schemas. Er is een terugvaloptie als een expliciete keuze van Jurgen |
| 2 | moet 2 | §18.11/§18.15/§18.16 met "toast Opgeslagen", `too_soon`-toast en H per `reason` | §18.11 gebruikt nu **alleen T-/M-ID's uit UX §13.16**:<br>• `saved` wordt gesplitst in `mode` enabled/changed/unchanged, met T-90/T-91/T-92;<br>• `too_soon` is T-79 in de balk, zonder melding onderin;<br>• een opslagfout is T-65;<br>• `no_upcoming` is F2 met T-64/T-64b;<br>• H1/H2/H3 hangen af van `last_error_code`.<br>AC-236 en AC-237 staan in de Basis, in §15 en in §18.15. Er is **één CP-W03-lijst** (§18.16 U3), gelijk aan de vereniging van UX §13.13.3 en TD r3, met H1/H2/H3 |
| 3 | moet 4 | `failed/stale` zonder code was niet gedefinieerd | `wasteFailureVariant(null)` geeft H1/M-03. "Stil gelegen" is technisch gedefinieerd, met de oorzaken erbij (§18.8.5), plus tests |
| 4 | moet 6 | alarm op `last_attempt_at − error_since` (de claimtijd) | nieuwe kolom **`last_failure_at`**, die **alleen `waste_sync`** zet bij `'failure'`. Het alarm kijkt naar `last_failure_at − error_since ≥ 60 min`, en `last_attempt_at` speelt geen rol meer in de gezondheid. Er zijn checks en tests bij (claim zonder uitkomst geeft geen `failed`; tijdens een lopende poging verschijnt geen H2) |
| 5 | aanb. 7 | `no_streams` vóór `no_upcoming` op basis van C(J)(+J+1) | als C(J) in januari geen enkele datum heeft, wordt ook **C(J−1)** opgehaald voor `hadAnyDate`. Een adres met een ondergrondse container geeft dan nog steeds E; begin januari geeft F2. Terugval als C(J−1) niet bestaat: `no_streams` op basis van B (uitvoeringskeuze, §18.1.7) |
| 6 | aanb. 8 | de balk kon verdwijnen zonder herstel | nieuwe kolom **`alarm_since`**: gezet door de tick of door "Opnieuw proberen" zodra de server `failed` vaststelt, en alleen gewist door een geslaagde bijwerking. `failed` blijft tot het eerstvolgende succes |
| 7 | aanb. 9 | "Opnieuw proberen" als E2E-oorzaak voor een lege-antwoordreeks | als unit-/regeltest (`wasteSyncHealth`). E2E alleen voor wat via de UI bereikbaar is |
| 8 | aanb. 10 | binnenzetten kon onbeperkt bij Verlopen blijven | bovengrens: vervalt uiterlijk aan het begin van D+7 (`WASTE_IN_EXPIRE_DAYS = 7`) |
| 9 | — | `confirm` gaf `saved`/`unchanged` | `saved` met `mode: 'enabled' \| 'changed' \| 'unchanged'`, zodat T-90/T-91/T-92 zonder afleiding in de client kiesbaar zijn |
| 10 | — | §18.15 rij 207–216 "zoals r2" | uitgeschreven |

---

# (A) Tekst voor TECHNICAL_DESIGN.md: nieuwe sectie (vervangt r3-§18 volledig)

## 18. Afvalkalender (W-03)

**Basis:**
- PRODUCT_SPEC §14 (BR-47…BR-59, UC-13…UC-15);
- UX_SPEC §13, met de tekstentabel §13.16 als **enige bron** voor zichtbare teksten;
- ACCEPTANCE_CRITERIA WP3b (**AC-183…AC-223, AC-236, AC-237**) en de W-03-aanvullingen in WP4–WP9 (AC-224…AC-235);
- de besluiten V-41…V-57;
- D-046 (rechten van pg_net op live).

Deze sectie vervangt `docs/wijzigingen/W-03/solution-architect-r1.md` t/m `-r3.md`. De verschillen staan in §18.17.

**Uitgangspunten:**
- Afvaltaken zijn gewone rijen in `tasks`, met drie extra kolommen. Alleen het systeem maakt ze, verschuift ze, hernoemt ze en verwijdert ze.
- Leden wijzigen alleen de status: afvinken, terugdraaien, bezig en overslaan. Notities gaan zoals altijd via `task_comments`.
- De planning is een pure functie in `src/domain/waste/`. Toepassen gebeurt atomisch in één RPC.
- **Teksten:** deze sectie legt alleen vast welke uitkomst tot welke toestand en welk tekst-ID leidt (T-xx/M-xx uit UX §13.16). De code bevat die teksten één keer, in `src/domain/waste/messages.ts`, met de ID als commentaar.

### 18.1 De bron: koppelcontract, allowlist en SSRF

#### 18.1.1 Endpoints (platform Opzet, onofficieel en ongedocumenteerd; bevestigd door P0)

| # | Verzoek | Doel | Gebruik |
| --- | --- | --- | --- |
| A | `GET /rest/adressen/{POSTCODE}-{huisnummer}` | adres → kandidaten met `bagId`, `huisletter` en `huisnummerToevoeging` (en vermoedelijk straat en plaats) | alleen bij het instellen (opzoeken en bevestigen) |
| B | `GET /rest/adressen/{bagId}/afvalstromen` | soorten: `id`, `title`, `menu_title`, `icon` | vertaling van `afvalstroom_id` naar een bak |
| C | `GET /rest/adressen/{bagId}/kalender/{jaar}` | ophaaldagen van een jaar: `afvalstroom_id`, `ophaaldatum` | altijd jaar J; J+1 als het december is; J−1 alleen bij het instellen in januari, als C(J) geen datum van rest, papier of PMD geeft (§18.8.1) |

Endpoint D (meldingen van de gemeente) valt buiten de scope (PRODUCT_SPEC §10).

#### 18.1.2 Vaste host, geen redirects, beperkte invoer (SSRF)

- **Basis-URL:** de constante `WASTE_SOURCE_BASE_URL = "https://huisvuilkalender.denhaag.nl"` in `src/server/waste/source.ts`. Er gaat nooit een URL of host uit invoer mee.
  - **Uitzondering, alleen voor tests en E2E:** de omgevingsvariabele `WASTE_SOURCE_BASE_URL` telt alleen als hij exact voldoet aan `^http://127\.0\.0\.1:\d{2,5}$`. Elke andere waarde wordt genegeerd, met de logregel `[waste] override genegeerd`.
- **Paden:** alleen uit gevalideerde waarden.
  - postcode `^[1-9][0-9]{3}[A-Z]{2}$`;
  - huisnummer 1–99999;
  - `bagId` volgens de regex uit P0 (aanname `^[0-9]{16}$`);
  - jaar 2020–2100;
  - elk segment gaat door `encodeURIComponent`;
  - de toevoeging gaat **nooit** naar de bron.
- **Fetch:** `method: "GET"`, `redirect: "error"`, `cache: "no-store"`, geen credentials en geen cookies.
  - Headers alleen `Accept: application/json` en `User-Agent: Takenlijstje/1 (prive gezinsapp)`.
  - Nooit een naam, e-mailadres, huishoud-id of lid-id (AC-218).
- **Antwoord:** status 200, een `content-type` met `json`, body via de stream met een grens van 1 MB, daarna `JSON.parse` en zod.
- **Time-outs:** per verzoek `AbortSignal.timeout(8000)`, samen met een totaalbudget via `AbortSignal.any`. Het totaalbudget is 12 s per server action en 12 s voor de ophaalstap in de tick. B en C gaan parallel; A gaat daarvóór, alleen bij het instellen.

#### 18.1.3 Resultaattype (gooit nooit bij netwerk- of formaatfouten)

```ts
type SourceError = "UNREACHABLE" | "FORMAT" | "NOT_FOUND";
type SourceResult<T> = { ok: true; value: T } | { ok: false; code: SourceError; http?: number };
lookupAddress(postcode, houseNumber, deps)   // A; [] = onbekend
fetchStreams(bagId, deps)                     // B; 404 → NOT_FOUND
fetchYear(bagId, year, deps)                  // C; 404 of [] → ok []
fetchPickups(bagId, today, deps, opts?: { includePreviousYearIfEmpty?: boolean }):
  SourceResult<{ pickups: WastePickups; unknownStreams: number; hadAnyDate: boolean }>
```

Hoe de foutcodes ontstaan:
- netwerkfout, time-out, 5xx, 429 of een andere 4xx → `UNREACHABLE`;
- kapotte JSON, zod-fout, verkeerde `content-type` of te groot → `FORMAT`;
- B geeft 404 → `NOT_FOUND` (bij de sync `ADDRESS_GONE`);
- C geeft 404 of `[]` → leeg, en dat is **geen** fout. Of het venster daardoor leeg is, beslist één regel (§18.8.4).

`hadAnyDate` betekent: er is minstens één datum van rest, papier of PMD in een van de opgehaalde jaren, ook in het verleden.

#### 18.1.4 Parser (zod, `src/server/waste/schema.ts`)

- Alleen verplicht wat gebruikt wordt; onbekende velden worden gestript.
  - A: `bagId` (string of number → string, regex), `huisletter` en `huisnummerToevoeging` (nullable).
  - A, optioneel: straat, huisnummer en plaats, alleen voor "Klopt dit?" (T-45a). Deze worden **nooit** bewaard of gelogd.
  - B: `id`, `title`, `menu_title?`, `icon?`.
  - C: `afvalstroom_id`, `ophaaldatum` (`YYYY-MM-DD`; `null` → rij overslaan).
  - Veldnamen en typen volgen P0. Afwijkingen zijn een uitvoeringskeuze (§18.1.7).
- **Bak herkennen** (`src/domain/waste/streams.ts`, puur):
  - eerst op `icon` (namen uit P0.5);
  - daarna op trefwoord in `title` of `menu_title`: `pmd`/`plastic`, `papier`, `rest`, tenzij er `grof`, `gft`, `kerst` of `textiel` in staat;
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
- De app kiest nooit zelf.

#### 18.1.6 Stap P0: probe van de bron, **vóór `/design-go`**

**Status en plaats.**
- P0 wordt **vóór de Design Freeze** uitgevoerd door de hoofdsessie. De uitkomsten worden volgens §18.1.7 in de concepten verwerkt, zonder wijzigingsverzoek.
- P0 schrijft alleen in `docs/wijzigingen/W-03/probe/`. Dat staat de poort vóór de freeze toe.
- **Aankondiging aan Jurgen (één zin, vóór P0.1):** "Ik stuur vanuit de live database een paar leesverzoeken (± 12) naar huisvuilkalender.denhaag.nl en denhaag.nl, met het openbare testadres 2591 BB 87 en niet met ons eigen adres. Er verandert niets aan de app of de gegevens, en de antwoorden ruim ik direct daarna op."
- **Kan P0 om een onvoorziene reden niet vóór de freeze** (pg_net weg, de koppeling faalt), dan is bevriezen een **expliciete keuze van Jurgen** in het totaalvoorstel ("ik accepteer dat een stoppunt uit de beslisregel na de freeze een wijzigingsverzoek wordt"), vastgelegd in PROGRESS. Dan wordt P0 de eerste stap van WP3b.

**Route.** pg_net vanuit het live Supabase-project, via de koppeling (`execute_sql`).
- Dit is tegelijk de datacentertoets: AWS eu-central-1, dezelfde cloud en regio als Vercel `fra1`.
- **Nooit via `apply_migration`**, want dat zou een migratie registreren.
- Elke aanroep hieronder is een eigen `execute_sql`, dus een eigen transactie. Verzoeken worden verstuurd nadat de aanroep is afgerond, en worden in een **volgende** aanroep uitgelezen.
- Alleen het openbare testadres **2591 BB 87**. Jurgens eigen adres gaat nooit via pg_net, curl of een andere route buiten de UI (dat komt pas bij U5).

**Wat P0 wel en niet wijzigt.**
- Er verandert niets aan het schema, de rechten of de app-gegevens.
- pg_net zet wel rijen in zijn eigen wachtrij (`net.http_request_queue`, door de worker geleegd) en in `net._http_response`. P0.6 ruimt die op id op.

**Grenzen.**
- Hooguit **12 verzoeken** in totaal, binnen ongeveer 15 minuten.
- Per verzoek expliciet `timeout_milliseconds`: 10000, voor denhaag.nl 15000.
- Bij `timed_out = true` hooguit één herhaling van dat ene verzoek.
- **Stoppunt tijdens de probe:** sluit `robots.txt` of een voorwaardenpagina `/rest/` of geautomatiseerd opvragen uit, dan gaan er **geen** verzoeken naar `/rest/`. Dan meteen P0.6 en naar Jurgen (§18.1.7).

**Vaste header-waarde** (hieronder `:h_json`):

```sql
'{"Accept":"application/json","User-Agent":"Takenlijstje/1 (prive gezinsapp)"}'::jsonb
```

---

**P0.0 Voorcontrole (alleen lezen)**

```sql
-- P0.0a: pg_net aanwezig, versie en bewaartijd
select extversion from pg_extension where extname = 'pg_net';
select current_setting('pg_net.ttl', true)        as ttl,
       current_setting('pg_net.batch_size', true) as batch_size;

-- P0.0b: momentopname van de rechten op net (D-046; na P0.6 opnieuw, moet gelijk zijn)
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'net' and grantee in ('anon','authenticated','public')
order by 1, 2, 3;
select p.proname,
       has_function_privilege('anon',          p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'net' order by 1;

-- P0.0c: wachtrij leeg
select count(*) as wachtrij from net.http_request_queue;
```

Geen rij in P0.0a betekent: stop, en de terugvaloptie hierboven geldt.

---

**P0.1 `robots.txt` en voorwaarden (vóór elk `/rest/`-verzoek)**

Aanroep 1:

```sql
select v.stap, v.id, clock_timestamp() as verstuurd
from (values
  ('P0.1-robots', net.http_get(
      url := 'https://huisvuilkalender.denhaag.nl/robots.txt',
      headers := '{"User-Agent":"Takenlijstje/1 (prive gezinsapp)"}'::jsonb,
      timeout_milliseconds := 10000)),
  ('P0.1-home', net.http_get(
      url := 'https://huisvuilkalender.denhaag.nl/',
      headers := '{"User-Agent":"Takenlijstje/1 (prive gezinsapp)"}'::jsonb,
      timeout_milliseconds := 10000))
) as v(stap, id);
```

Aanroep 2, na ≥ 10 s. Herhaal tot beide rijen er zijn, hooguit 60 s; daarna `net.http_request_queue` bekijken.

```sql
select id, status_code, content_type, timed_out, error_msg, headers,
       octet_length(content) as bytes, created
from net._http_response where id = any(array[:id_robots, :id_home]::bigint[]) order by id;

select content from net._http_response where id = :id_robots;

select distinct m[1] as link
from net._http_response r,
     regexp_matches(r.content,
       'href="([^"]*(voorwaarden|disclaimer|privacy|colofon|gebruik)[^"]*)"', 'gi') as m
where r.id = :id_home;
```

Staat er een voorwaardenlink op `huisvuilkalender.denhaag.nl` of `www.denhaag.nl`, dan volgt één `net.http_get` van die pagina (vorm als hierboven, `timeout_milliseconds := 15000`). Die wordt doorzocht met:

```sql
select m[1] as citaat
from net._http_response r,
     regexp_matches(regexp_replace(r.content, '<[^>]+>', ' ', 'g'),
       '([^.]{0,200}(automatisch|geautomatiseerd|scrap|robot|api|hergebruik|opvragen)[^.]{0,200})', 'gi') as m
where r.id = :id_voorwaarden;
```

**Beoordeling:**
- `Disallow: /` of `Disallow: /rest` voor `*` of een passende user-agent, of een verbod in de voorwaarden → **stoppunt**.
- 404 op `robots.txt` betekent: geen beperking.
- Is de homepage een single-page-app zonder links, dan noteer je "geen voorwaarden gevonden".

---

**P0.2 Adres (endpoint A)**

Aanroep 3:

```sql
select net.http_get(
  url := 'https://huisvuilkalender.denhaag.nl/rest/adressen/2591BB-87',
  headers := '{"Accept":"application/json","User-Agent":"Takenlijstje/1 (prive gezinsapp)"}'::jsonb,
  timeout_milliseconds := 10000) as id_a, clock_timestamp() as verstuurd;
```

Aanroep 4:

```sql
select id, status_code, content_type, timed_out, error_msg, headers,
       octet_length(content) as bytes, created, content
from net._http_response where id = :id_a;
```

Daarna:
- Kies de `bagId` van de kandidaat zonder huisletter en toevoeging.
- Noteer het type (string of number) en de lengte.
- **Plak hem letterlijk in P0.3, maar alleen als hij uitsluitend uit cijfers bestaat.** Anders: eerst de vorm vastleggen en de hoofdsessie beslist.
- Is het antwoord geen JSON, dan is dat zelf de bevinding (FORMAT of HTML-only) → §18.1.7.

---

**P0.3 Afvalstromen, kalenders en datacentertoets (6 verzoeken in één batch)**

Aanroep 5 (`<BAG>` = de `bagId` uit P0.2):

```sql
select v.stap, v.id, clock_timestamp() as verstuurd
from (values
  ('B',      net.http_get(url := 'https://huisvuilkalender.denhaag.nl/rest/adressen/<BAG>/afvalstromen',
             headers := '{"Accept":"application/json","User-Agent":"Takenlijstje/1 (prive gezinsapp)"}'::jsonb,
             timeout_milliseconds := 10000)),
  ('C-2025', net.http_get(url := 'https://huisvuilkalender.denhaag.nl/rest/adressen/<BAG>/kalender/2025',
             headers := '{"Accept":"application/json","User-Agent":"Takenlijstje/1 (prive gezinsapp)"}'::jsonb,
             timeout_milliseconds := 10000)),
  ('C-2026', net.http_get(url := 'https://huisvuilkalender.denhaag.nl/rest/adressen/<BAG>/kalender/2026',
             headers := '{"Accept":"application/json","User-Agent":"Takenlijstje/1 (prive gezinsapp)"}'::jsonb,
             timeout_milliseconds := 10000)),
  ('C-2027', net.http_get(url := 'https://huisvuilkalender.denhaag.nl/rest/adressen/<BAG>/kalender/2027',
             headers := '{"Accept":"application/json","User-Agent":"Takenlijstje/1 (prive gezinsapp)"}'::jsonb,
             timeout_milliseconds := 10000)),
  ('A-2',    net.http_get(url := 'https://huisvuilkalender.denhaag.nl/rest/adressen/2591BB-87',
             headers := '{"Accept":"application/json","User-Agent":"Takenlijstje/1 (prive gezinsapp)"}'::jsonb,
             timeout_milliseconds := 10000)),
  ('B-2',    net.http_get(url := 'https://huisvuilkalender.denhaag.nl/rest/adressen/<BAG>/afvalstromen',
             headers := '{"Accept":"application/json","User-Agent":"Takenlijstje/1 (prive gezinsapp)"}'::jsonb,
             timeout_milliseconds := 10000))
) as v(stap, id);
```

Aanroep 6, na ≥ 10 s:

```sql
-- overzicht (datacentertoets: geen 403/429/captcha/WAF; headers retry-after / x-ratelimit-*)
select id, status_code, content_type, timed_out, error_msg,
       headers->>'cache-control' as cache_control, headers->>'retry-after' as retry_after,
       (select jsonb_object_agg(k, headers->>k) from jsonb_object_keys(headers) k where k ilike '%ratelimit%') as ratelimit,
       headers ? 'set-cookie' as zet_cookie,
       octet_length(content) as bytes, created
from net._http_response where id = any(array[:ids_p03]::bigint[]) order by id;

-- volledige bodies (per id), voor de bestanden hieronder
select id, content from net._http_response where id = any(array[:ids_p03]::bigint[]) order by id;

-- P0.5: afvalstromen
select e->>'id' as id, e->>'title' as title, e->>'menu_title' as menu_title, e->>'icon' as icon
from net._http_response r, jsonb_array_elements(r.content::jsonb) e where r.id = :id_b;

-- kalenders per jaar: aantal datums per stroom, eerste en laatste
select r.id, e->>'afvalstroom_id' as stroom, count(*) as n,
       min(e->>'ophaaldatum') as eerste, max(e->>'ophaaldatum') as laatste
from net._http_response r, jsonb_array_elements(r.content::jsonb) e
where r.id = any(array[:id_c2025, :id_c2026, :id_c2027]::bigint[])
group by 1, 2 order by 1, 2;
```

Wijken veldnamen of vorm af, lees dan de ruwe `content` en pas alleen de uitleesquery aan.

**Beoordeling:**
- Een blokkade (403, captcha of een WAF-pagina) of 429 binnen deze 6 verzoeken → **stoppunt**.
- A-2 en B-2 moeten dezelfde status en vorm geven als de eerste A en B.
- Een responstijd-bovengrens (`created − verstuurd`) structureel > 8 s → **stoppunt**.

---

**P0.4 Gemeenteregel (tijden)**

Aanroep 7:

```sql
select net.http_get(
  url := 'https://www.denhaag.nl/nl/afval/huisvuil-aanbieden/',
  headers := '{"Accept":"text/html","User-Agent":"Takenlijstje/1 (prive gezinsapp)"}'::jsonb,
  timeout_milliseconds := 15000) as id_gemeente, clock_timestamp() as verstuurd;
```

Aanroep 8:

```sql
select status_code, headers->>'location' as location, octet_length(content) as bytes
from net._http_response where id = :id_gemeente;

select m[1] as citaat
from net._http_response r,
     regexp_matches(regexp_replace(r.content, '<[^>]+>', ' ', 'g'),
       '([^.]{0,250}(22[.:]00|7[.:]45|minicontainer|binnen ?zetten|binnenhalen)[^.]{0,250})', 'gi') as m
where r.id = :id_gemeente;
```

- Bij 301, 302 of 308 volgt één extra verzoek naar `location`, alleen als dat op `www.denhaag.nl` staat.
- Levert de pagina geen citaat op (403, of een inhoud die met JavaScript wordt geladen), dan blijft de gemeenteregel **onbevestigd**. De hoofdsessie legt hem dan in het totaalvoorstel aan Jurgen voor ("mag de minicontainer vanaf 22:00 buiten en moet hij om 07:45 buiten staan?").
- Andere tijden, of regels per bak of wijk → **stoppunt** (§18.1.7).

---

**P0.5 Indeling van de stromen.** Geen verzoek. Maak uit de uitkomst van P0.3 de tabel stroom → bak (icon, title, menu_title), en noteer:
- welke stromen er verder zijn (GFT, grof, kerst, textiel);
- of de `afvalstroom_id` in C overeenkomt met de `id` in B;
- of B ook stromen noemt zonder datums in C. Dat is nodig voor de januari-terugval in §18.8.1.

---

**P0.6 Opruimen en nacontrole (direct na het uitlezen)**

Aanroep 9 (`:alle_ids` = alle id's uit P0.1–P0.4):

```sql
delete from net._http_response where id = any(array[:alle_ids]::bigint[]) returning id;
select count(*) as over     from net._http_response    where id = any(array[:alle_ids]::bigint[]);  -- 0
select count(*) as wachtrij from net.http_request_queue where id = any(array[:alle_ids]::bigint[]);  -- 0
```

Daarna de rechtenquery's van **P0.0b opnieuw**. De uitkomst moet identiek zijn.

- **Alleen de probe-id's.** Rijen van de planner (`http_post` naar de tick) blijven staan.
- Geeft de `delete` 42501 (geen recht voor `postgres`), dan worden **geen** rechten verhoogd. Noteer het in het verslag. De rijen verdwijnen dan via de TTL uit P0.0a (standaard 6 uur). Ze bevatten alleen het openbare testadres en openbare pagina's.

**Controle L4, in lijn met D-046** (vervangt "geen execute op `net.*`"):
- (1) de rechten van `anon`, `authenticated` en `public` op `net` zijn na P0 identiek aan de momentopname P0.0b. P0 voegt geen rechten toe en trekt er geen in; intrekken kan op live niet (D-046);
- (2) `net` staat niet bij de exposed schemas van de Data API. Dat bevestigt Jurgen eenmalig in het dashboard (D-046). Is dat nog niet gebeurd, dan vraagt de hoofdsessie het in dezelfde zin als de aankondiging.
- Het restrisico (`anon` en `authenticated` hebben SELECT op `net._http_response`) is alleen relevant als `net` exposed is. P0.6 direct na het uitlezen houdt de blootstelling op minuten.

---

**Wat vastleggen in `docs/wijzigingen/W-03/probe/`:**

| Bestand | Inhoud |
| --- | --- |
| `verslag.md` | Datum en tijd (UTC), pg_net-versie en `pg_net.ttl`. Per verzoek: stap, pad (testadres of `<BAG>`), `status_code`, `content_type`, `cache-control`/`etag`/`last-modified`/`retry-after`/`x-ratelimit-*`, of er een `set-cookie` is (alleen ja/nee, geen waarde), bytes, responstijd-bovengrens (`created − verstuurd`), `timed_out`/`error_msg`. Verder: `robots.txt` letterlijk; voorwaarden-citaten met URL; P0.4-citaten met URL en datum; de P0.5-tabel; per bevinding de indeling volgens §18.1.7 (uitvoeringskeuze of stoppunt); de uitkomst van het opruimen; en "rechten vóór = na" |
| `robots.txt` | letterlijk |
| `A-2591BB-87.json` | body van A, byte-exact (niet opnieuw geformatteerd) |
| `B-afvalstromen.json` | body van B, byte-exact |
| `C-2025.json`, `C-2026.json`, `C-2027.json` | bodies van C, byte-exact (ook als ze `[]` zijn of een 404-body hebben; dan met de status in `verslag.md`) |

De HTML van de pagina's wordt **niet** bewaard, alleen de citaten.

**Fixtures (na de freeze, stap U1):**
- de JSON-bestanden gaan **ongewijzigd** naar `src/server/waste/__tests__/fixtures/`, met een `README.md` (herkomst, datum en "openbaar testadres");
- scenario's die de bron niet vanzelf levert (leeg venster, alleen GFT, meerdere kandidaten, december zonder J+1, januari met lege C(J), verschuiving, adres weg) maakt de test-writer als `synthetisch-*.json`, **afgeleid van de echte vorm**;
- de E2E-stub (`tests/e2e/support/waste-stub.mjs`) gebruikt dezelfde bestanden.

**Verwerken vóór de freeze:**
- veldnamen en typen in §18.1.4;
- de `bagId`-regex in §18.1.2 en §18.3.1;
- de icon- en titelnamen in §18.1.4;
- het gedrag van J+1 en J−1 in §18.1.3 en §18.8.1;
- de gemeentetijden. Die zijn bij afwijking een stoppunt.

Ze worden verwerkt als tekstwijziging in de concepten van analist, designer en architect. De rechterkolom van §18.1.7 gaat als vraag naar Jurgen.

**Bekende restgrens.**
- pg_net en Vercel gebruiken niet exact dezelfde IP-adressen, al zitten ze in dezelfde cloud en regio.
- Blokkeert de site alleen Vercel, dan blijkt dat pas bij de eerste echte opzoeking (U5). Dat valt dan onder "blokkade" in §18.1.7.
- Een aparte Vercel-proef vóór het bouwen zou een ongereviewde productiedeploy vragen. Die is bewust niet gekozen (§18.18).

#### 18.1.7 Beslisregel: welke afwijking van de bron is een uitvoeringskeuze en welke een stoppunt

Vóór de freeze (de standaardroute) worden alle punten in de concepten verwerkt. De rechterkolom gaat dan als vraag naar Jurgen. Na een freeze zonder P0 (alleen via de expliciete terugvaloptie) is de rechterkolom een wijzigingsverzoek.

| Uitvoeringskeuze (verwerken in de concepten; na de freeze in `DECISIONS.md`) | Stoppunt: naar Jurgen, WP3b wacht |
| --- | --- |
| andere veldnamen, hoofdletters of typen in A, B of C (bijv. `date` in plaats van `ophaaldatum`, id als number) | `robots.txt` of voorwaarden sluiten `/rest/` of geautomatiseerd opvragen uit |
| andere icon- of titelnamen van de drie bakken; extra stromen | blokkade vanuit het datacenter (403, captcha, WAF), of 429 bij minder dan ~10 verzoeken per uur |
| ander BAG-formaat → regex in zod én `CHECK` in `…_330` | geen JSON-API, alleen HTML, of een sleutel of login nodig |
| gedrag van J+1 (404, `[]`, of datums uit een ander jaar, die dan worden weggefilterd) | een adresflow waarvoor **meer** naar buiten moet dan postcode + huisnummer of adrescode, of waarbij iets anders dan de adrescode bewaard moet worden (BR-58, AC-218) |
| **C(J−1) geeft geen datums** → `no_streams` op basis van B ("B noemt geen stroom die rest, papier of PMD is") in plaats van `hadAnyDate` over C(J−1) (§18.8.1) | rest, papier en PMD zijn niet apart te herkennen |
| postcode met spatie of kleine letters, of een ander scheidingsteken in het pad van A | andere gemeentetijden dan 22:00 en 07:45, of regels per bak of wijk (BR-49, AC-192, UX §13.4/§13.6, T-16/T-17/T-21/T-22, M-01) |
| `content-type`-variant (`charset`, `application/hal+json`); grootte tot 5 MB; responstijd tot 8 s | responstijden structureel boven 8 s |
| extra verplichte header zonder persoonsgegevens | gemeenteregel niet te bevestigen (P0.4 zonder citaat): **vraag** aan Jurgen, geen stoppunt voor het bouwen als hij de tijden bevestigt |

Twijfel over de indeling is geen uitvoeringskeuze: de hoofdsessie legt het voor.

### 18.2 Modules en systeemgrenzen

```
src/domain/waste/                 puur, vitest
  address.ts    normalizeWasteAddress, formatPostcode, matchCandidate
  streams.ts    classifyStream, WASTE_STREAMS = ['rest','papier','pmd']
  plan.ts       wasteTitle, wasteTaskFields, planWasteTasks (insert/move/rename/remove),
                isWindowEmpty, WASTE_HORIZON_DAYS = 14, MAX_SHIFT_DAYS = 3,
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
| `bag_id` | `text not null check (bag_id ~ '<regex uit P0>')` |
| `pickups` | `jsonb not null check (jsonb_typeof(pickups) = 'object')`: `{"rest":[…],"papier":[…],"pmd":[…]}` |
| `version` | `bigint not null default 1`: +1 bij elk nieuw adres |
| `last_attempt_at` | `timestamptz`: **alleen** claim en rate limit (§18.8.3). Telt niet mee in de gezondheid |
| `last_success_at` | `timestamptz not null` |
| `last_error_code` | `text check (last_error_code in ('UNREACHABLE','FORMAT','SUSPECT_EMPTY','ADDRESS_GONE'))` |
| `error_since` | `timestamptz`: moment van de **eerste** vastgelegde mislukking in de huidige reeks met **dezelfde** code |
| **`last_failure_at`** | `timestamptz`: moment van de **laatste vastgelegde** mislukking. **Alleen `waste_sync` zet deze kolom**, bij `p_result = 'failure'` (= `p_now`). Een succes en `waste_save` wissen hem |
| **`alarm_since`** | `timestamptz`: moment waarop de server voor het eerst sinds `last_success_at` `failed` vaststelde (§18.8.5). Gezet door `markWasteAlarm` (tick of "Opnieuw proberen"). Alleen gewist door een succes (`waste_sync 'success'`) en `waste_save` |
| `created_at`, `updated_at` | standaard + `set_updated_at` |

**Checks:**
- `(last_error_code is null) = (error_since is null)`;
- `(last_error_code is null) = (last_failure_at is null)`;
- `last_failure_at is null or last_failure_at >= error_since`;
- `alarm_since is null or alarm_since >= last_success_at`.

**Overig:**
- **Niet bewaard:** straat, plaats, coördinaten, ruwe antwoorden en wie het adres invoerde.
- **"Storingsmelding verstuurd"** is afgeleid uit de dedupe-sleutel (§18.9.3). `alarm_since` zegt alleen dat de storing is vastgesteld, niet of de melding al verstuurd is.
- **Versimpeltoets:** één `jsonb`-kolom in plaats van een cachetabel, want het gaat om ≤ ~150 datums per jaar die altijd in hun geheel worden gelezen. De keuze voor `last_failure_at` en `alarm_since` staat in §18.18.

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

Beide gaan pas na CP-W03 op live via `apply_migration` (D-040): eerst `_320`, dan `_330`.

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
- Wijkt P0.4 af, dan is dat een stoppunt (§18.1.7).

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
- **`getWasteSettings`** (server, user-client):
  - de beheerder krijgt adres, `health` (§18.8.5: `state`, `variant`, `lastErrorCode`, `lastSuccessAt`, `notice`), de eerstvolgende datum per bak, en het aantal open afvaltaken (voor T-81/T-81b/T-81c);
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
2. B + C(J), plus C(J+1) als het december is.
   - **Januari:** heeft C(J) geen enkele datum van rest, papier of PMD, dan wordt ook C(J−1) opgehaald, **alleen voor `hadAnyDate`**. Die datums liggen in het verleden en komen nooit in `pickups`.
3. Uitkomst, in deze volgorde:
   - `UNREACHABLE`, `FORMAT` of `NOT_FOUND` van B of een C-verzoek → `unreachable`;
   - `hadAnyDate = false` → `no_streams`. Het adres heeft in geen enkel opgehaald jaar een datum van rest, papier of PMD, bijvoorbeeld bij een ondergrondse container;
   - `isWindowEmpty(pickups, today)` (§18.8.4) → `no_upcoming`. Dit is **dezelfde regel** als de storingsregel. Begin januari zonder nieuwe kalender komt hier uit (F2, T-64), en niet bij E;
   - anders `found`.
4. `display` komt uit A, alleen voor de beheerder, en wordt nooit bewaard of gelogd.
5. Geeft C(J−1) volgens P0 nooit datums, dan wordt `no_streams` "B bevat geen stroom die `classifyStream` als rest, papier of PMD herkent" (uitvoeringskeuze, §18.1.7).

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

#### 18.8.4 Eén regel voor een leeg antwoord (BR-52, AC-204, AC-237)

- **`isWindowEmpty(pickups, today)`** = voor rest, papier en PMD **samen** geen enkele datum in [vandaag, vandaag + 14]. Dit gebeurt op de **net opgehaalde** datums.
- **Tijdens het bijwerken:** leeg → `p_result = 'failure'`, code `SUSPECT_EMPTY`. De bewaarde datums, de taken en het adres blijven ongewijzigd. De planning draait verder op de bewaarde datums.
- **Bij het instellen:** leeg → `no_upcoming` (F2), en er wordt niets bewaard.
- **Geen voorwaarde "eerder bekend":** een adres wordt alleen bewaard als het venster niet leeg is. Een leeg venster daarna is dus altijd een verandering. Dit dekt de jaarwisseling.
- **Eén bak zonder dagen** is geen storing.
- **Bewuste grens:** een echte ophaalpauze van meer dan 15 dagen voor alle drie de bakken tegelijk geeft een onterechte storing. Dat is in Den Haag voor rest niet bekend.

#### 18.8.5 Gezondheid (`wasteSyncHealth`, puur; UI én tick)

**Invoer:** `last_success_at`, `last_error_code`, `error_since`, `last_failure_at`, `alarm_since`, `pickups`, `now`. **`last_attempt_at` telt niet mee**, zodat een lopende of afgebroken poging de toestand niet verandert.

| Toestand | Regel (in deze volgorde; de eerste die klopt, bepaalt `reason`) |
| --- | --- |
| `failed`, reden `empty` | `last_error_code = 'SUSPECT_EMPTY'` **en** `last_failure_at − error_since ≥ 60 min`: minstens twee **vastgelegde** lege antwoorden achter elkaar, zonder andere uitkomst ertussen, waarvan de eerste en de laatste minstens een uur uit elkaar liggen |
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

**"Stil gelegen" (moet-punt 4), technisch:**
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
- **De balk blijft tot herstel (aanbeveling 8):** is `failed` eenmaal door de server vastgesteld (`alarm_since`), dan blijft `failed` staan tot het eerstvolgende succes, ook als een latere andere foutcode `error_since` opnieuw zet. De tekst volgt dan de huidige code, bijvoorbeeld H1 na een alarm door een leeg antwoord.
- **December-waarschuwing:** `notice = 'next_year_missing'` als:
  - vandaag in december valt;
  - vandaag + 14 ≥ 1 januari van J+1;
  - `last_error_code is null`;
  - de bewaarde `pickups` geen datum in J+1 bevatten.
  Dit wordt afgeleid, zonder kolom, en alleen getoond als `state = ok` (G″, T-73).
- **Terugkoppeling aan de UI:** `health = { state, reason?, variant?, lastErrorCode, lastSuccessAt, notice? }`.

#### 18.8.6 Tickstap (`runWasteStep`)
Nieuwe stap in `runTick`, **tussen "overslaan" en "meldingen"**, met een eigen `step("afval")` en try/catch.
1. `select * from waste_calendars` (service role). Leeg → klaar.
2. Eén query voor de afvaltaken van die huishoudens: open, of `waste_pickup_date ≥ vandaag − 35`.
3. Per kalender:
   - **ophalen** als `dueForFetch` klopt, de tick nog geen 10 s loopt en de claim lukt. Budget 12 s. Uitkomst `success`, of `failure` met `UNREACHABLE`, `FORMAT`, `ADDRESS_GONE` of `SUSPECT_EMPTY`;
   - **plannen** met de effectieve datums: de nieuwe bij succes, anders de bewaarde;
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
| **Pagina open tijdens een lopende poging** | gezondheid negeert `last_attempt_at` | geen kort flitsende H2 |
| **Claim zonder uitkomst na één leeg antwoord** | alarm op `last_failure_at` | geen `failed`, geen melding (AC-205) |
| Alarm en daarna een gelijktijdig succes | `markWasteAlarm … and last_success_at = :lastSuccessAt` | geen blijvend alarm na herstel |

### 18.11 Foutafhandeling: van uitkomst naar toestand en tekst-ID
Alle teksten komen uit UX §13.16. "Melding onderin" = toast; "regel" = tekst in de pagina.

**Instellingen (beheerder):**

| Uitkomst | Toestand (UX §13.8.1) | Tekst-ID's | Bewaard? |
| --- | --- | --- | --- |
| laden bezig / mislukt | skelet / "Laden mislukt" | — / T-68 | — |
| zod-fout (client of server) | A met veldfout | T-43, T-44, T-44b | nee |
| lookup of confirm bezig | B | T-41b "Zoeken…" | — |
| `found` | C | T-45, T-45a, T-46, T-46b; per bak zonder datum T-45b; bij wijzigen + T-48 | nee |
| `choose` | C2 | T-61 + rij per kandidaat | nee |
| `not_found` | D (regel boven de velden, zonder rode rand) | T-60 | nee |
| `no_streams` | E | T-62 | nee |
| `no_upcoming` | **F2** | T-64 (aanzetten) / T-64b (wijzigen) | nee; een bestaand adres blijft |
| `unreachable` | F | T-63 (aanzetten) / T-63b (wijzigen) | nee; een bestaand adres blijft |
| `saved`, `mode: 'enabled'` | G + melding onderin | T-90 (Bekijken → Kalender week); eenmalig tip T-54 | ja |
| `saved`, `mode: 'changed'` | G + melding onderin | T-91 | ja |
| `saved`, `mode: 'unchanged'` | G + melding onderin | T-92, nooit T-79 | ja (stand bijgewerkt) |
| `UNKNOWN` bij opslaan (ook een botsing op `version`) | C blijft, invoer blijft | T-65 | nee |
| `FORBIDDEN` (elke actie) | melding onderin, pagina → J | T-66 | nee |
| offline | laatst bekende stand; knoppen uit | T-67 onder de uitgeschakelde knop | — |
| `health.ok` | G | T-70, T-50, T-52, T-55; bak zonder datum T-45b | — |
| `health.ok` + `notice` | G″ | T-73 | — |
| `health.retrying` | G′ | T-71; bij `ADDRESS_GONE` T-71b | — |
| `health.failed` | H + rij "Niet bijgewerkt" | T-72 (kop, sectiekop "stand <dag>"), T-37; balk per variant: H1 T-75/T-76 (ook bij `last_error_code null`), H2 T-77 + T-77a/T-77b, H3 T-77c/T-77d | — |
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
- **Bewaard:** postcode, huisnummer, toevoeging en `bag_id` (de adrescode van de gemeente), alleen in `waste_calendars`, alleen leesbaar voor beheerders. Dat de adrescode wordt bewaard, komt expliciet in het totaalvoorstel (V-45 noemde alleen postcode en huisnummer).
- **Weg:** bij uitzetten, bij het verwijderen van het huishouden (cascade), en bij terugrollen alleen de open taken (§18.16).
- **Nooit in eigen logs:** postcode, nummer, `bag_id`, straat, bron-URL's, `error.message` van een fetch en het huishoud-id. Logregels bevatten alleen tellingen en codes. `next.config` zet geen `logging.fetches.fullUrl`.
- **Platformlogs, controle door de security-reviewer in WP3b:**
  - **Vercel Observability, tab External APIs:** per hostname voor elk plan, per pad alleen met Observability Plus (betaald). Het pad bevat postcode en huisnummer (A) of de `bag_id` (B, C). Dit blijft binnen Jurgens eigen Vercel-account. De reviewer noteert wat het huidige plan werkelijk bewaart en hoe lang.
  - **Supabase:** de body van RPC-aanroepen door de service role komt niet in de API-logs. Controleren.
  - **pg_net:** P0 gebruikt alleen het testadres, en P0.6 ruimt op id op. De app zelf gebruikt pg_net nooit voor de afvalkalender.
- **Naar buiten:** alleen postcode + nummer (A) of `bag_id` (B, C), alleen naar de vaste host, vanaf Vercel `fra1`.

### 18.13 Performance-impact
- **Tick normaal:** 2 kleine query's, planning in het geheugen, 0 schrijfacties zonder verandering; ≈ 20–40 ms.
- **Twee keer per dag** (en elk uur bij een storing): 2–3 GET's parallel (hard maximaal 12 s) en 1 RPC. `markWasteAlarm` is hooguit één update per storing.
- **Instellen in januari** met een lege C(J): één extra GET voor C(J−1).
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

- De bron wordt altijd nagebootst:
  - unit en integratie via `deps.fetch` met de fixtures uit P0 (plus `synthetisch-*.json`);
  - E2E via de stub `tests/e2e/support/waste-stub.mjs` op `127.0.0.1`.
- Stub-scenario's:
  - normaal;
  - meerdere adressen;
  - onbekend;
  - alleen GFT;
  - onbereikbaar;
  - leeg;
  - adres weg;
  - december zonder J+1;
  - januari met lege C(J);
  - verschuiving;
  - traag (10 s);
  - teller (telt verzoeken, voor "geen verzoek").
- Waar de tests staan:
  - DB: `supabase/tests/70_afval.sql`, plus `gelijktijdig.sh`;
  - integratie: `tests/integration/waste.test.ts`;
  - E2E: `tests/e2e/waste.spec.ts`.
- Een tekst-ID in de E2E-kolom betekent: de exacte tekst uit UX §13.16 is zichtbaar.

| AC | Unit | DB | Int | E2E |
| --- | --- | --- | --- | --- |
| 183 | — | — | confirm → adres + taken vandaag…+14; `mode: 'enabled'` | invullen → C (T-46) → aanzetten → T-90 |
| 184 | `normalizeWasteAddress` | — | geen fetch bij een zod-fout (spy 0) | T-43/T-44/T-44b; Zoeken uit bij lege velden |
| 185 | `matchCandidate` → `not_found` | — | bestaand adres ongewijzigd | D, T-60, velden gevuld |
| 186 | alleen GFT → `no_streams`; ondergrondse container (geen datums in C(J−1)/C(J)) → `no_streams` | — | niets bewaard | E, T-62 |
| 187 | normaliseren; `choose`; `suffix ""` | — | via de action | C2 → rij tikken → C |
| 188 | time-out, 503, kapotte JSON, te groot, redirect → `unreachable` | — | niets bewaard; oud adres + `version` gelijk | F, T-63; bij wijzigen T-63b |
| 189 | — | schrijven geweigerd; RPC-rechten | actions als lid → `FORBIDDEN`, fetch-spy 0 | lid ziet geen formulier; T-66 bij degradatie |
| 190 | — | select per rol; `enabled()` | `getWasteSettings` als lid: geen adres of health | — |
| 191 | — | `waste_save` 2× parallel | twee adressen tegelijk | — |
| 192 | `wasteTaskFields` out; `description = null` | `complete_task` 07:50 → te laat | — | T-16 "vanaf 22:00", T-21/T-22 |
| 193 | `in`-velden | — | — | vóór 12:00 onder Binnenkort (T-18), T-23/T-24 |
| 194 | `wasteReminder` | — | tick 21:00/18:00 | — |
| 195 | `wasteTitle` 7 × 2 = T-01…T-14 | — | 1 herinnering per ontvanger | — |
| 196 | `classifyStream` op de P0-fixture | — | — | — |
| 197 | +3/+14/+15 | sleutel | 2× na elkaar en 2× parallel | — |
| 198 | `planWasteTasks`: (a) 25-12 → 26-12 = move van beide, zelfde id; (b) doel-`out` bestaat al (done) → `out` remove, `in` move; (c) 4 dagen → remove + insert; (d) geen gemeenschappelijke bak → remove + insert; (e) `out` op D′ voorbij → `out` remove, `in` move | move onder de guard (service role) lukt; als lid → 42501 | notitie en `in_progress` blijven; geen historie; herinnering op het nieuwe anker | — |
| 199 | remove beide | — | hard weg | — |
| 200 | `out` done → `in` blijft | — | idem | — |
| 201 | rename | rename raakt done niet | — | — |
| 202 | — | remove/move/rename op done/skipped → 0 rijen | — | — |
| 203 | (a)–(e) | — | tick op die tijden | — |
| 204 | `isWindowEmpty`: alle drie leeg = ja; alleen papier = nee; 1 januari zonder nieuwe kalender = ja; alleen datums na +14 = ja | `waste_sync 'failure'`: `last_failure_at = p_now`; zelfde code → `error_since` blijft; andere code → reset; `'success'` → alle vier null | 500/time-out/leeg/adres weg → taken, adres en `pickups` gelijk; andere tickstappen draaien; volgende poging ≤ 75 min; console zonder adres | G′ met T-71; adres weg: T-71b; gezinslid ziet niets |
| **205** | `wasteSyncHealth`: (a) leeg 06:00, **claim om 07:15 zonder uitkomst**, now 07:20 → `retrying` (geen `failed`); (b) leeg 06:00 + leeg 07:15 → `failed/empty`, variant H2; (c) leeg 06:00 + 06:30 → `retrying`; (d) UNREACHABLE 06:00 + leeg 07:15 → `retrying`; (e) 48 h + 1 min, **`last_error_code null`** → `failed/stale`, variant H1; (f) `alarm_since` gezet, daarna UNREACHABLE (reset, < 48 h) → `failed/held`, H1; (g) succes → `ok`; (h) leeg 06:00/06:20/06:40 → `retrying`; `wasteFailureVariant` voor alle codes en `null`; teksten zonder adres | claim-update laat `last_failure_at` ongemoeid; checks weigeren `last_failure_at` zonder code en `last_failure_at < error_since`; `authenticated` kan geen van de kolommen schrijven; `markWasteAlarm` met een verouderd `last_success_at` → 0 rijen | over meerdere ticks elk 1 melding voor Jurgen en Ellen (M-03/M-04/M-05 per variant), 0 voor Lynn; tick met overgeslagen ophaalstap (budget) en 48 h stil → M-03; na succes + nieuwe storing opnieuw 1; na een alarm door leeg en daarna UNREACHABLE blijft `failed` | stub "leeg" twee keer met een klok ≥ 60 min → H2 (T-77 + T-77b); stub "onbereikbaar" + 48 h → H1 (T-75/T-76); stub "adres weg" + 48 h → H3 (T-77c/T-77d, twee knoppen); gezinslid geen balk |
| 206 | zomer- en wintertijd | — | — | — |
| 207 | — | `in` afvinken + terugdraaien door lid; `out` ongewijzigd | idem, historie zonder persoon | ja |
| 208 | `permissions`: afvaltaak niet te bewerken, verplaatsen of verwijderen | beheerder én lid: update van title, scheduled_date, due_at, description, reminders, prioriteit, `recurrence_id`, `waste_*` → 42501; REST-delete 0 rijen; `delete_task` → 42501; status todo/in_progress/skipped en complete/undo lukken | `moveTask`/`updateTask` (ook "wordt terugkerend": geen weesreeks)/`deleteTask` → `FORBIDDEN`; wachtrij `move` → `FORBIDDEN` → T-33 | knoppen verborgen; T-27 |
| 209 | — | lid slaat `out` over → `in` skipped; ongedaan → beide todo; service role slaat `out` over → `in` ongewijzigd; alleen `in` overslaan → `out` ongewijzigd | 18:00-herinnering komt niet na overslaan | T-31 + Ongedaan maken |
| 210 | `findExpiredWasteTasks`: out na D; in na de volgende `out`-dag; **in uiterlijk op D+7 zonder volgende `out`** (bovengrens); opeenvolgende dagen | — | tick di 07:46 / wo / do; lange pauze → in op D+7 skipped | — |
| 211 | reminder alleen voor `notify_reminders`; nooit deadline/overdue voor afvaltaken | — | Jurgen/Ellen wel, Lynn (uit) niet, Kai (uitgezet) niet; Lynn aan → wel | T-25 alleen bij de eigen instelling aan |
| 212 | alle builders: grep op postcode, nummer, bagId en namen = 0 | — | meldingen, push-payload (spy), titels, completions en console bevatten geen fixture-adres | — |
| 213 | — | `disable_waste_calendar`: rij weg, open afvaltaken weg, done/skipped blijven; tweede keer 0 | daarna tick: fetch-spy 0, geen afvaltaken; lid: `enabled = false` | I met T-80 + T-81 (n = 4) en T-81c (n = 0); T-93; annuleren |
| 214 | — | `waste_save` met een ander adres: open weg, done blijft | nooit twee adressen; ongeldig nieuw adres → oude blijft | A′ (T-47) → C (T-48) → T-91 |
| 215 | — | `waste_sync`/`waste_save`/`disable` raken geen taak met `waste_direction is null` | idem | tip T-54 één keer |
| 216 | — | `delete_household` → `waste_calendars` en afvaltaken weg; ander huishouden intact | — | — |
| 217 | — | — | — | UC-13/14/15 in de oude UI + CP-W03 (§18.16 U3) + live-rooktest Jurgen |
| 218 | source: host = constante, pad alleen postcode-nummer of bagId, headers alleen Accept/UA, `redirect: 'error'`, override alleen loopback | — | fetch-spy over lookup, confirm, sync en retry | — |
| 219 | — | insert met `waste_direction` door lid en beheerder → 42501 (policy én guard), ook met `members_can_create_tasks` uit; systeem-insert lukt met maker `null` | — | — |
| 220 | `notice`: 20 dec zonder J+1 = ja; 10 dec = nee; met J+1 = nee; `retrying` → geen notice | — | — | G″ met T-73 |
| 221 | `dueForFetch`: 05:59 nee, 06:00 ja, 12:00 nee na succes om 06:05, 17:00 ja, na een mislukking elk uur | — | verschuiving om 14:00 → taak om 17:xx aanwezig | — |
| 222 | — | — | zelfde adres bevestigen direct na een tick → `saved`, `mode: 'unchanged'`, geen claim, notitie en `in_progress` blijven; `version` gewijzigd → `UNKNOWN` | **T-92**; nooit T-79; botsing → T-65 |
| 223 | — | — | `appUrl.wasteSettings()` = `/instellingen/afvalkalender` | melding openen → sectie in beeld |
| **236** | `wasteFailureVariant`; (h) uit 205 (drie keer binnen een uur versnelt niets) | claim 2× binnen 60 s → tweede 0 rijen | retry in H1: (a) stub ok → `done`, `state ok`, stub-teller 1; (b) stub fout → `done`, `state failed`, `attemptedAt`; (c) claim < 60 s → `too_soon`, **stub-teller 0**; retry vanuit `failed` zet `alarm_since` | balk H1 → "Opnieuw proberen" → T-77e, knop uit, rest van de pagina bruikbaar → (a) balk weg, T-70, **T-94**; (b) balk blijft, **T-78** in de balk; (c) na een tweede retry binnen 60 s: **T-79 in de balk en geen toast** (assert: geen toast-element); offline: knop uit + T-67 |
| **237** | `lookupWasteCalendar`: alleen datums na +14 → `no_upcoming`; **2 januari, C(J) leeg, C(J−1) met datums → `no_upcoming`** (niet `no_streams`); C(J−1) alleen opgehaald in januari bij een lege C(J) | — | confirm bij `no_upcoming` → niets bewaard, `version` en taken gelijk; bij een bestaand adres blijft het oude | F2 met T-64 en hoofdknop "Adres zoeken", velden gevuld; bij wijzigen T-64b |
| 224–235 | in hun WP (§15) | | | |

Daarnaast:
- regressie `30_wp2a`;
- privacyschema: geen persoonskolommen buiten `waste_calendars`;
- `route.test.ts` van de tick met `waste.moved` en `waste.alerted`.

### 18.16 Uitrol (live op `main`, oude UI)

| # | Stap | Controle |
| --- | --- | --- |
| **P0** | Probe van de bron (§18.1.6), **vóór `/design-go`** (terugvaloptie: expliciete keuze van Jurgen) | verslag + bodies in `docs/wijzigingen/W-03/probe/`; uitkomsten verwerkt volgens §18.1.7; P0.6 opgeruimd; rechten vóór = na |
| U1 | Bouwen en lokaal groen: `test:db` (`70_afval.sql`, `gelijktijdig.sh`), vitest, integratie, E2E (oude UI + stub, alle scenario's). Fixtures uit `probe/` ongewijzigd naar `src/server/waste/__tests__/fixtures/` | alles groen |
| U2 | Reviews: code, test-writer, security, performance; herstellen | GO |
| **U3** | **Checkpoint CP-W03** (beeldreview vóór de livegang): zie de lijst hieronder. Dit is **de enige lijst**; UX §13.13.3 en AC-217 verwijzen ernaar. visual-qa en ux-reviewer (licht) beoordelen; BLOKKEREND en GEMIDDELD worden hersteld vóór U4. Rapporten: `docs/reviews/wp3b-visual-qa.md`, `wp3b-ux-reviewer.md`; checkpoint in PROGRESS | GO van beide |
| U4 | `…_320`, dan `…_330` via `apply_migration`; push naar `main` (`fra1`) | beveiligingsadvies; RLS aan op `waste_calendars`; **L4 volgens D-046**: rechten van `anon`/`authenticated`/`public` op `net` gelijk aan de P0.0b-momentopname, en `net` niet bij de exposed schemas; `/api/status`; tick 200 met `waste.calendars = 0` |
| U5 | Rooktest met Jurgen (AC-217): zijn adres, vergelijken met de site, taken zichtbaar, de volgende dag "bijgewerkt", en de herinnering om 21:00. **De eerste echte opzoeking vanaf Vercel is ook de datacentertoets voor `fra1`**; bij een blokkade geldt §18.1.7 | akkoord in PROGRESS |
| U6 | Jurgen één keer herinneren aan het stoppen van zijn handmatige reeks (BR-57) | PROGRESS |
| U7 | `main` → `v2-ui` mergen | — |
| U8 | Succescriteria op dag 30 en 90 | PROGRESS |

**CP-W03, de enige lijst** (oude UI; 390×844 licht; de met ◐ gemarkeerde ook donker via `--donker`; lokale stack met stub; `docs/screenshots/wp3b/`; bestandsnaam `cpw03-<nr>-<naam>`):

*Instellingen, beheerder*
1. A — uit (T-40, T-41, T-42, T-34) ◐
2. A met veldfouten (T-43, T-44; T-44b)
3. A′ — wijzigen (T-47, Annuleren)
4. B — zoeken (T-41b "Zoeken…", velden uit)
5. C — Klopt dit? (T-45, T-45a, T-46, T-46b) ◐
6. C "gedeeltelijk": één bak met T-45b
7. C bij wijzigen (T-48, "Ja, dit adres gebruiken")
8. C2 — meerdere adressen (T-61)
9. D — onbekend (T-60, zonder rode rand) ◐
10. E — geen bakken (T-62)
11. F — onbereikbaar (T-63)
12. F2 — geen komende ophaaldagen (T-64, hoofdknop Adres zoeken) ◐
13. C met opslaan mislukt (T-65)
14. G — aan, met tip (T-70, T-50, T-52, T-54, T-55) ◐
15. G′ — hapering (T-71) en G′ met adres weg (T-71b)
16. G″ — december (T-73)
17. H1 (T-72, T-75, T-76) ◐
18. H2 (T-77 + T-77b) en H2 in december/januari (T-77 + T-77a) ◐
19. H3 (T-77c, T-77d, Adres controleren + Opnieuw proberen)
20. H tijdens een poging (T-77e)
21. H na "nog steeds fout" (T-78)
22. H na `too_soon` (T-79 in de balk, geen melding onderin)
23. I — uitzetten, n = 4 (T-80, T-81, T-82) en n = 0 (T-81c)
24. offline (T-67 onder de uitgeschakelde knoppen)
25. meldingen onderin: T-90 (met Bekijken), T-91, T-92, T-93, T-94

*Instellingen, gezinslid*

26. J aan (T-38b) en J uit (T-39b)

*Lijsten, detail, kalender, meldingen*

27. Vandaag ma 19:30: buitenzetten "vanaf 22:00" (T-16) onder Vandaag, binnenzetten "Morgen" (T-19) onder Binnenkort ◐
28. Vandaag di 06:30: buitenzetten "vóór 07:45" (T-17)
29. Vandaag di 09:10: buitenzetten onder Verlopen ("… te laat", zonder klokje), binnenzetten "vanaf 12:00" (T-18) onder Binnenkort
30. Taakdetail buitenzetten, beheerder met Herinneringen aan (T-20, T-21, T-22, T-25, T-27, ⋯-menu) ◐
31. Taakdetail buitenzetten, gezinslid zonder herinneringsrij
32. Taakdetail binnenzetten (T-23, T-24), met en zonder herinneringsrij
33. Melding onderin na overslaan (T-31)
34. Kalender week en dag met afvaltaken ("vanaf 22:00", "vanaf 12:00")
35. Meldingenlijst met een storingsmelding (M-03, label T-39c) en een herinnering (M-01)

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

### 18.17 Afwijkingen, rechtgetrokken

**r1 → r2:** sleutel per dag en richting; adres alleen voor beheerders; niets bewaren bij een storing; leeg-bewaking over drie bakken samen; niemand wijzigt afvaltaken; 18:00, storingstype en vervallen; `jsonb` in plaats van een cachetabel; elk uur opnieuw na een storing.

**r2 → r3 (plan-critic W-03 ronde 1):**
- P0 vóór migraties en UI, met een beslisregel;
- verschuiving als move;
- `isWindowEmpty` en `error_since`;
- W-03-regels bij WP4–WP9;
- CP-W03;
- `waste_rollback.sql`;
- 06:00 en 17:00;
- december-`notice`;
- bevestigen zonder claim;
- platformlogs;
- `description = null`;
- de meldings-URL als route.

**r3 → r4 (plan-critic W-03 ronde 2):**

| # | r3 | r4 |
| --- | --- | --- |
| 1 | P0 "bij voorkeur" vóór de freeze, één voorbeeld; L4 = "geen execute op `net.*`" | P0 vóór `/design-go` als draaiboek P0.0–P0.6 met exacte SQL, bestanden en fixtures, en terugvaloptie als keuze van Jurgen; L4 volgens D-046 |
| 2 | §18.11 met "toast Opgeslagen", een `too_soon`-toast en "Fout bij opslaan" | tekst-ID's uit UX §13.16; `saved.mode` → T-90/T-91/T-92; T-79 in de balk; T-65; F2 met T-64/T-64b |
| 2 | Basis/§15/§18.15 zonder AC-236/AC-237 | opgenomen, met testregels |
| 2 | twee CP-W03-lijsten, H per `reason` | één lijst in U3 (35 punten), H1/H2/H3 per `last_error_code` |
| 4 | `failed/stale` zonder code niet gedefinieerd | `wasteFailureVariant(null)` = H1/M-03; "stil gelegen" gedefinieerd |
| 6 | alarm op `last_attempt_at − error_since` | `last_failure_at` (alleen `waste_sync`); gezondheid negeert `last_attempt_at` |
| 7 | `no_streams` gaf E begin januari | C(J−1) in januari voor `hadAnyDate`; terugval op B |
| 8 | balk kon verdwijnen zonder herstel | `alarm_since`: `failed` blijft tot het volgende succes |
| 9 | "Opnieuw proberen" als E2E-oorzaak van een lege reeks | unit-/regeltest |
| 10 | binnenzetten onbeperkt bij Verlopen | uiterlijk op D+7 |

### 18.18 Versimpeltoets

| Onderdeel | Eenvoudigste variant | Gekozen? Waarom |
| --- | --- | --- |
| Ophaaldagen bewaren | niet bewaren | **Nee.** Bij een storing moeten de bekende dagen blijven gelden. Wel de kleinste vorm: één `jsonb`-kolom |
| Ophalen | stap in de bestaande tick | **Ja** |
| Tweede ophaalmoment | alleen 06:00 | **Nee.** Een wijziging overdag komt dan te laat voor 21:00 |
| Lock | voorwaardelijke update op `last_attempt_at` | **Ja.** Lease en rate limit tegelijk |
| Meetpunt van het lege-antwoordalarm | `last_attempt_at` hergebruiken (r3) | **Nee.** Dat is de claimtijd en geen uitkomst, wat een onterecht alarm geeft (plan-critic 6). Eén kolom `last_failure_at`, die alleen `waste_sync` schrijft, is de kleinste juiste oplossing |
| Alarm vasthouden tot herstel | niets doen (de balk kan verdwijnen) of afleiden uit de meldingentabel | **Nee.** Verdwijnen verwart na een melding. Afleiden uit meldingen hangt af van de ontvanger (een nieuwe beheerder ziet iets anders) en vraagt een extra query via RLS. Eén kolom `alarm_since` met één voorwaardelijke update is deterministisch en rolonafhankelijk |
| Storing zonder foutcode | eigen tekst | **Nee.** H1/M-03 kloppen letterlijk ("niet bijgewerkt sinds"); geen extra tekst of variant |
| `no_streams` in januari | alleen op B | **Nee als standaard.** B noemt mogelijk ook stromen zonder ophaaldagen (ondergrondse container), en dan zou E wegvallen. C(J−1) is één extra GET, alleen bij instellen in januari met een lege C(J). **Wel als terugval** als C(J−1) volgens P0 niet bestaat |
| Bovengrens binnenzetten | geen | **Nee.** Een taak zou dan onbeperkt bij Verlopen blijven. Eén constante (7 dagen) in dezelfde regel |
| Verschuiving | remove + insert | **Nee.** Stil verlies van notities en "bezig" |
| Storingsteller | `failure_count` over alle soorten | **Nee.** `error_since` per code |
| December-waarschuwing | kolom of melding | **Nee.** Afgeleid, alleen een stille regel |
| Probe-route | allowlist in de ontwikkelomgeving | **Nee als enige route.** pg_net test tegelijk de datacentertoegang, zonder handeling van Jurgen |
| Vercel-proef vóór het bouwen | aparte deploy met een testroute | **Nee.** Dat vraagt een ongereviewde productiedeploy; de restgrens wordt bij U5 zichtbaar |
| `saved`-varianten | client leidt T-90/T-91/T-92 af uit de vorige stand | **Nee.** De server weet het zeker (`mode`); de client zou een verouderde stand kunnen hebben |
| Omschrijving op de taak | vaste tekst in de database | **Nee.** Onjuist op D−1/D+1 |
| Meldings-URL | anker + client-omleiding | **Nee.** Een vaste route werkt in beide UI's |
| Terugrollen | adres + taken wissen | **Nee.** Alleen open taken wissen is voldoende |
| Doorwerking van overslaan | in de service | **Nee.** Een trigger dekt REST, de wachtrij en de actions |
| Verbod op wijzigen | alleen UI + service | **Nee.** De DB-guard is de grens |
| Eén of twee migraties | één | **Twee** (enum eerst committen) |

---

# (B) Regels voor de tabel in TD §15

**WP3b (volledig, vervangt de r3-regel):**

| **WP3b — Afvalkalender (W-03), live op `main` in de oude UI** | **Vóór `/design-go`: P0** (§18.1.6): draaiboek P0.0–P0.6 via pg_net op live met het openbare testadres (`robots.txt`/voorwaarden, A/B/C(J−1, J, J+1), datacentertoets, gemeenteregel 22:00/07:45, opruimen op id, rechten vóór = na volgens D-046); uitkomsten volgens §18.1.7 in de concepten verwerkt. **Bouwen:** fixtures uit `probe/`; migraties `…_320` en `…_330` (§18.3–18.7, inclusief `last_failure_at`, `alarm_since`); `src/domain/waste/*` (move, `isWindowEmpty`, gezondheid met `last_failure_at`/`alarm_since`, `wasteFailureVariant` inclusief `null` → H1, twee ophaalmomenten, december-notice, januari-C(J−1), bovengrens binnenzetten D+7); `src/server/waste/*`; `system/waste/sync.ts` (+ `markWasteAlarm`); `actions/waste.ts` (`saved.mode`, `too_soon` zonder verzoek); tickstap; `wasteReminder`; `recipientsFor`; route `instellingen/afvalkalender` (redirect); `supabase/ops/waste_rollback.sql`; oude UI volgens §18.14 en de tekst-ID's uit §18.11; tests §18.15 met stub-scenario's. **Checkpoint CP-W03 (U3) vóór de livegang.** Uitrol U4–U8 | **WP3 live** (pg_net via `planner.sql`, tick elke 15 min); **P0 afgerond** (of een expliciete keuze van Jurgen, vastgelegd in PROGRESS). Niet WP4+ | BR-47…BR-59, UC-13…UC-15, **AC-183…AC-223, AC-236, AC-237**, V-41…V-57, D-046 | **CP-W03**: de 35 punten uit §18.16 U3 (de enige lijst), 390×844, ◐ ook donker, in `docs/screenshots/wp3b/`; checkpoint in PROGRESS | code, test-writer, **security** (bron, SSRF/allowlist, adres = persoonsgegeven, RLS/guard/RPC's, `last_failure_at`/`alarm_since` alleen via de service role, platformlogs §18.12, L4 volgens D-046), **performance** (tickduur met en zonder ophalen), **visual-qa + ux-reviewer (licht) op CP-W03 vóór U4**; rooktest Jurgen (AC-217) |

**W-03-regels voor de bestaande rijen** (gelijk aan r3, met de aanpassingen die vet staan):

- **WP4:** "✚ W-03: de expliciete kolomlijst van `work` bevat `waste_pickup_date`, `waste_direction` en `waste_streams` (`description` blijft alleen in het detail). De `core`-slice krijgt `wasteCalendarEnabled` via `rpc('waste_calendar_enabled')`. De IDB-cache werkt ook met oudere items zonder deze velden. `isWasteTask` en de permissiehelpers gelden in de nieuwe store." Criteria: **AC-224**.
- **WP5:** "✚ W-03:
  - lijstrij met kenmerk T-15, rechterkolom T-16…T-19 en plek volgens UX §13.4;
  - taakdetail volgens UX §13.6 (T-20…T-28; T-25 alleen bij de eigen instelling aan);
  - overslaan-melding T-31 met Ongedaan maken van beide;
  - optimistisch overslaan van `out` neemt `in` mee, ook via de wachtrij;
  - verplaatsen of bewerken van een afvaltaak komt nooit in de wachtrij (anders T-33)."
  Criteria: **AC-225, AC-226, AC-227**. Screenshots van de afvalrij en het afvaldetail horen bij CP2 en CP3.
- **WP6:** "✚ W-03:
  - Taken › Terugkerend toont bovenaan T-96 als `wasteCalendarEnabled` (pijl alleen voor beheerders, naar `/instellingen/afvalkalender`);
  - `?bewerk=<id>` van een afvaltaak opent `?taak=<id>`;
  - 'Wat wil je wijzigen?' en omzetten naar terugkerend zijn nooit bereikbaar voor afvaltaken;
  - zoeken en het categoriefilter vinden afvaltaken."
  Criteria: **AC-228, AC-229**.
- **WP7:** "✚ W-03:
  - de route `/instellingen/afvalkalender` wordt de echte subpagina, met **alle toestanden en tekst-ID's uit §18.11** (A, A′, B, C, C2, D, E, F, F2, G, G′, G″, H1/H2/H3 inclusief T-77e/T-78/T-79 in de balk, I met T-81/T-81b/T-81c, J, offline, laden mislukt, meldingen onderin T-90…T-94);
  - de rij T-35/T-36/T-37 in de groep Huishouden (gezinslid: rij zonder pijl + T-38/T-39);
  - hergebruikt de actions en `getWasteSettings` uit WP3b ongewijzigd."
  Criteria: **AC-230, AC-231** (die AC-236 en AC-237 in de nieuwe UI meenemen). Hoort bij de CP3-aanvulling (instellingen); de screenshotpunten 1–26 uit CP-W03 worden daar in de nieuwe UI herhaald.
- **WP8:** "✚ W-03:
  - Kalender dag, week en maand zonder slepen voor afvaltaken ('+ Taak' blijft; T-95 volgens UX §13.11);
  - meldingenlijst met label T-39c en icoon voor `waste_sync_failed`, link naar `/instellingen/afvalkalender`;
  - Overzicht groepeert afvaltaken onder T-97/T-98. Een vanzelf overgeslagen buitenzet- of binnenzet-taak telt als vergeten; een vervallen (verwijderde) afvaltaak telt niet mee."
  Criteria: **AC-232, AC-233, AC-234**.
- **WP9:** "✚ W-03: E2E-kernflow afvalkalender in de nieuwe UI (aanzetten, Vandaag, detail, overslaan, een storing die de beheerder wel en het gezinslid niet ziet, uitzetten) met de stub; CP4 bevat de afvaltoestanden." Criteria: **AC-235**.

---

# (C) Korte aanvullingen in bestaande TD-secties
Gelijk aan r3 (C), met deze aanpassingen:
- **§3.1:** bij `waste_calendars`: "`error_since`, `last_failure_at` (alleen `waste_sync`) en `alarm_since` in plaats van `failure_count`".
- **§3.2:** bij `…_330`: "`waste_sync` met `p_move`; checks op de storingskolommen".
- **§5.3, punt 5:** "`waste_sync`: afvaltaken invoegen, verschuiven, hernoemen of verwijderen als ze open zijn; storingsstand bijwerken. `markWasteAlarm`: alleen `alarm_since`."
- **§6.5:** `waste` bevat ook `moved` en `alerted`.
- **§10, rij Huisvuilkalender:** "twee keer per dag (06:00/17:00), na een mislukking elk uur; probe P0 vóór de freeze (§18.1.6)".
- **§11.2:** "Kolommen van `work` bevatten `waste_*` (W-03); `core` bevat `wasteCalendarEnabled`".
- **§12, terugrollen:** verwijzing naar §18.16 (`waste_rollback.sql`).
- **§12 of de livecontroles:** L4 = D-046-formulering (rechten op `net` gelijk aan de momentopname; `net` niet exposed), niet "geen execute op `net.*`".
- **§15, "Uitrol (V-36)":** "WP1, WP2a, WP2b, WP3 en WP3b gaan direct live op `main`".

---

# (D) Punten voor de analist en de designer (uit te voeren door de hoofdsessie)

1. **Designer, UX §13.8.2 en §13.10 (moet-punt 4):** een regel toevoegen: "`last_error_code` leeg bij een storing (de app heeft sinds het laatste succes geen poging kunnen vastleggen, bijvoorbeeld omdat de achtergrondtaak stil lag) → H1 (T-75/T-76) en M-03." Technisch staat dit vast in §18.8.5.
2. **Designer, UX §13.13.3:** vervangen door: "De lijst met rook-screenshots voor WP3b staat in TD §18.16 U3 (CP-W03). Dat is de enige lijst."
3. **Designer, UX §13.7.5, "Weer gelukt" (aanbeveling 8):** een zin toevoegen: "Is de storing gemeld, dan blijft de balk staan tot het bijwerken weer lukt, ook als de oorzaak intussen verandert. De tekst volgt dan de nieuwe oorzaak."
4. **Designer, T-52 (moet-punt 5):** dit hoort niet bij mij, maar de TD gaat uit van 06:00 en 17:00. Voorstel van de critic: "… De app kijkt 's ochtends en aan het eind van de middag of de gemeente iets veranderd heeft."
5. **Analist:**
   - **AC-217:** "de lijst in UX §13.13.3 en TD §18.16 U3" → "de lijst in TD §18.16 U3".
   - **AC-205:** als geval toevoegen: "Lukt het bijwerken al meer dan 48 uur niet zonder dat er een poging mislukte (bijvoorbeeld omdat de achtergrondtaak stil lag), dan geldt de rij 'onbereikbaar of onbruikbaar' (H1, M-03)."
   - **AC-205, "Geen storing zijn":** toevoegen "een poging die is gestart maar geen uitkomst gaf, na één leeg antwoord".
   - **AC-205/AC-236 (aanbeveling 9):** "bijvoorbeeld door 'Opnieuw proberen'" in AC-205 schrappen. De laatste zin van AC-236 herformuleren als regel ("Een lege-antwoordstoring ontstaat alleen door vastgelegde lege antwoorden die minstens een uur uit elkaar liggen; vaker proberen versnelt dat niet"), met als toets Unit.
   - **BR-52 en AC-205 (aanbeveling 8):** "Een gemelde storing blijft zichtbaar tot het bijwerken weer lukt, ook als de oorzaak intussen verandert."
   - **BR-54 en AC-210 (aanbeveling 10):** "… tot de dag van de volgende buitenzet-taak begint, **en uiterlijk aan het begin van de zevende dag na de ophaaldag**." Extra geval in AC-210: "is er geen volgende buitenzet-taak (lange pauze), dan vervalt binnenzetten aan het begin van D+7."
   - **AC-186/AC-237 (aanbeveling 7):** in AC-237 "bijvoorbeeld 28 december" aanvullen met "of 2 januari, als de kalender van het nieuwe jaar nog niet online staat: dan ziet hij F2, niet 'geen bakken'".
   - **Interpretatie voor het totaalvoorstel:** de bovengrens van 7 dagen voor binnenzetten, en "de balk blijft tot herstel".

---

### Vragen voor Jurgen (beleid, kosten, verplichtingen)
- **Geen nieuwe beleidsvragen.**
- **Melding vóór P0 (één zin, geen keuze):** het uitgaande leesverzoek vanuit de live database met het openbare testadres (tekst in §18.1.6). Heeft Jurgen de dashboardcontrole van D-046 (`net` niet bij de exposed schemas) nog niet bevestigd, vraag die dan in dezelfde zin.
- **Alleen als P0 het laat zien** (stoppunten §18.1.7): `robots.txt` of voorwaarden sluiten het uit, blokkade, andere tijden, of meer gegevens naar buiten nodig. Opties:
  - (a) toch gebruiken, met risico op blokkade;
  - (b) de gemeente om toestemming vragen;
  - (c) terug naar gewone terugkerende taken.

  Voorstel: (b), en tot die tijd (c).
- **Alleen als P0.4 geen citaat oplevert:** Jurgen bevestigt de tijden 22:00/07:45.
- **Voor het totaalvoorstel, in gewone taal:**
  - onofficiële bron;
  - de adrescode wordt bewaard;
  - overslaan werkt door naar binnenzetten;
  - binnenzetten vervalt vanzelf (uiterlijk na 7 dagen);
  - een aanhoudend leeg antwoord geeft al na ruim een uur een melding;
  - de balk blijft tot herstel;
  - dubbele taken tot Jurgen zijn eigen reeks stopt;
  - notities blijven bij een kleine verschuiving;
  - de restgrens (een blokkade van alleen Vercel blijkt pas bij de rooktest);
  - bij een noodterugrol gaan notities bij open afvaltaken verloren.

### Bewuste vereenvoudigingen
- P0 alleen via pg_net (tegelijk de datacentertoets), met ≤ 12 verzoeken, zonder Vercel-proefdeploy.
- Twee kleine kolommen (`last_failure_at`, `alarm_since`) in plaats van afleidingen uit claimtijd of meldingen. Beide zijn deterministisch en met checks begrensd.
- Storing zonder foutcode hergebruikt H1/M-03, zonder nieuwe tekst.
- C(J−1) alleen bij instellen in januari met een lege C(J).
- Bovengrens voor binnenzetten als één constante in de bestaande vervalregel.
- `saved.mode` vanaf de server in plaats van afleiding in de client.
- Eén CP-W03-lijst in de TD; UX en AC verwijzen ernaar.

### Status
**KLAAR VOOR PLANREVIEW** voor de onderdelen van de architect: moet 1, 2, 4 (technische kant) en 6, en aanbevelingen 7, 8, 9 en 10.

Voorwaarden vóór de volgende critic-ronde:
- (1) de hoofdsessie voert **P0** uit volgens §18.1.6 en verwerkt de uitkomsten;
- (2) de designer verwerkt D1–D4;
- (3) de analist verwerkt D5;
- (4) de visual-designer-r2 (moet 3, geen onderdeel van mij).

Relevante bestanden:
- /home/user/takenlijstje/docs/reviews/plan-critic.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/solution-architect-r3.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-analyst-r3.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-designer-r2.md
- /home/user/takenlijstje/docs/DECISIONS.md (D-042, D-046)
- /home/user/takenlijstje/docs/PROGRESS.md (WP3 livegang, deel 2)
- /home/user/takenlijstje/supabase/ops/planner.sql
- /home/user/takenlijstje/scripts/visual-check.mjs (`--donker`)

Bronnen:
- [pg_net sql/pg_net.sql (signatuur `net.http_get`, `net._http_response`)](https://github.com/supabase/pg_net/blob/master/sql/pg_net.sql)
- [pg_net PR #285 — bound request timeouts (`pg_net.max_timeout_ms`)](https://github.com/supabase/pg_net/pull/285)
- [pg_net repository](https://github.com/supabase/pg_net)
- [Supabase — pg_net](https://supabase.com/docs/guides/database/extensions/pg_net) (niet direct bereikbaar, egress; alleen via zoekresultaten)
- [Den Haag — Huishoudelijk afval aanbieden](https://www.denhaag.nl/nl/afval/huisvuil-aanbieden/) (te bevestigen in P0.4)
- Uit r3: Vercel Observability changelogs (External APIs), Vercel Functions duration/limits, PostgreSQL ALTER TYPE, MDN `RequestInit.redirect`