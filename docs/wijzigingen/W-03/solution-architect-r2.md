## Technisch ontwerp: W-03 afvalkalender (Den Haag), ronde 2
Document: niets geschreven. `docs/TECHNICAL_DESIGN.md` is bevroren. Hieronder staan drie blokken die letterlijk kunnen worden ingevoegd: (A) de nieuwe sectie "§18 Afvalkalender (W-03)", (B) de WP3b-regel voor de tabel in §15, en (C) korte aanvullingen in bestaande secties.

**Documentatie gecontroleerd:**
- Vercel Functions: met Fluid compute is de standaard `maxDuration` 300 s, ook op Hobby ([duration](https://vercel.com/docs/functions/configuring-functions/duration), [changelog](https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute), [limits](https://vercel.com/docs/limits)).
- PostgreSQL `ALTER TYPE … ADD VALUE`: de nieuwe waarde is pas bruikbaar na de commit ([docs](https://www.postgresql.org/docs/current/sql-altertype.html)).
- Fetch `redirect: "error"` ([MDN RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#redirect)) en `AbortSignal.any` (Node ≥ 20.3; Next 16 eist Node ≥ 20.9).
- Bronbeschrijving van de huisvuilkalender: overgenomen uit r1 (HACS `hvcgroep_nl.py`, pippyn `opzet.py`, xirixiz `opzet.py`).
- **De bron zelf is opnieuw niet bereikbaar.** Op 2026-09-29 gaf `curl` naar `huisvuilkalender.denhaag.nl` "CONNECT tunnel failed, 403" via de proxy. Het antwoordformaat is dus nog steeds afgeleid en niet live gezien. De fixture-probe (§18.1.6) is daarom een harde voorwaarde vóór de livegang.

**Gelezen:**
- `solution-architect-r1.md`, `product-analyst-r2.md` (BR-47…BR-59, AC-183…AC-219, 8 aandachtspunten), `product-designer-r1.md` (§13.1–13.15, punten 1–7), `PROGRESS.md` (V-41…V-57), TD §3/§5/§6/§9/§11.3/§12/§13/§15, `DECISIONS.md` D-040…D-044.
- Code: `src/server/system/tick.ts`, `dispatcher.ts`, `services/scheduling.ts`, `domain/reminders.ts`, `status.ts`, `scheduling/supersede.ts`, `features/tasks/selectors.ts`, `lib/data/snapshot.ts` (`select("*")`).
- Migraties: `…0927000100_schema` (tasks, notifications, enum), `…0928000100` (policies), `…0928000110` (`delete_task`), `…0928000210` (laatste `guard_task_changes`, enum zonder oude waarden), `supabase/tests/run.sh` (per bestand, autocommit).

**Work packages:** WP3b — Afvalkalender, direct na WP3, live op `main` in de oude UI. De onderdelen voor de nieuwe UI komen als aanvulling in WP5, WP6, WP7 en WP8 op `v2-ui`.

---

# (A) Tekst voor TECHNICAL_DESIGN.md — nieuwe sectie

## 18. Afvalkalender (W-03)

**Basis:** PRODUCT_SPEC §14 (BR-47…BR-59, UC-13…UC-15), UX_SPEC §13, ACCEPTANCE_CRITERIA WP3b (AC-183…AC-219) en de besluiten V-41…V-57.

Deze sectie vervangt het vooronderzoek `docs/wijzigingen/W-03/solution-architect-r1.md` overal waar die afwijkt. De punten die zijn rechtgetrokken, staan in §18.17.

**Uitgangspunten:**
- Afvaltaken zijn gewone rijen in `tasks`, met drie extra kolommen.
- Alleen het systeem maakt, hernoemt en verwijdert ze.
- Gebruikers mogen alleen de status wijzigen: afvinken, terugdraaien, bezig en overslaan. Notities gaan zoals altijd via `task_comments`.
- De planning is een pure functie in `src/domain/waste/`. Het toepassen gebeurt atomisch in één RPC.

### 18.1 De bron: koppelcontract, allowlist en SSRF

#### 18.1.1 Endpoints (platform Opzet, onofficieel en ongedocumenteerd)

| # | Verzoek | Doel | Gebruik |
| --- | --- | --- | --- |
| A | `GET /rest/adressen/{POSTCODE}-{huisnummer}` | adres → kandidaten met `bagId`, `huisletter`, `huisnummerToevoeging` (+ vermoedelijk straat en plaats) | alleen bij het instellen (lookup en bevestigen) |
| B | `GET /rest/adressen/{bagId}/afvalstromen` | soorten: `id`, `title`, `menu_title`, `icon` | vertaling `afvalstroom_id` → bak |
| C | `GET /rest/adressen/{bagId}/kalender/{jaar}` | alle ophaaldagen van een jaar: `afvalstroom_id`, `ophaaldatum` | jaar J altijd; J+1 als vandaag in december valt |

Endpoint D (meldingen van de gemeente) is buiten scope (PRODUCT_SPEC §10).

#### 18.1.2 Vaste host, geen redirects, beperkte invoer (SSRF)

- **Basis-URL:** de constante `WASTE_SOURCE_BASE_URL = "https://huisvuilkalender.denhaag.nl"` in `src/server/waste/source.ts`. Er is geen configuratie per huishouden en er gaat nooit een URL of host uit invoer mee.
  - **Uitzondering, alleen voor tests en E2E:** de omgevingsvariabele `WASTE_SOURCE_BASE_URL` wordt alleen gebruikt als hij exact voldoet aan `^http://127\.0\.0\.1:\d{2,5}$`. Elke andere waarde wordt genegeerd, met een logregel `[waste] override genegeerd`. Ook bij een verkeerde instelling op productie kan hij dus hooguit naar loopback wijzen.
- **Paden:** alleen opgebouwd uit gevalideerde waarden.
  - postcode `^[1-9][0-9]{3}[A-Z]{2}$` (na normaliseren, zonder spatie);
  - huisnummer: geheel getal 1–99999;
  - `bagId` `^[0-9]{16}$` (BAG-nummeraanduiding: 0518 + objecttype + volgnummer; **bij de probe bevestigen**, anders de regex aanpassen in `DECISIONS.md`);
  - jaar: geheel getal 2020–2100.
  - Elk segment gaat ook door `encodeURIComponent`.
  - De toevoeging gaat **nooit** naar de bron. Die dient alleen om kandidaten uit A te kiezen.
- **Fetch-opties:** `method: "GET"`, `redirect: "error"` (een redirect is een fout, nooit volgen), `cache: "no-store"`, `credentials` niet gezet, geen cookies.
  - Headers alleen `Accept: application/json` en `User-Agent: Takenlijstje/1 (prive gezinsapp)`.
  - Nooit een naam, e-mailadres, huishoud-id of lid-id (AC-218).
- **Antwoord:**
  - status 200 met `content-type` die `application/json` bevat;
  - body gelezen via de stream met een harde grens van 1 MB, daarboven `FORMAT`;
  - daarna `JSON.parse` en zod (§18.1.4).
- **Time-outs:**
  - per verzoek `AbortSignal.timeout(8000)`, gecombineerd met een totaalbudget via `AbortSignal.any([...])`;
  - totaalbudget: 12 s voor lookup of bevestigen in een server action, 12 s voor de dagelijkse ophaalstap in de tick;
  - B en C worden parallel opgehaald (`Promise.all`), A daarvóór (alleen bij het instellen).
- **IPv4/IPv6:** Node (undici) doet happy eyeballs (`autoSelectFamily`, standaard aan). Bij de probe letten op de responstijd.

#### 18.1.3 Resultaattype (gooit nooit bij netwerk- of formaatfouten)

```ts
type SourceError = "UNREACHABLE" | "FORMAT" | "NOT_FOUND";
type SourceResult<T> = { ok: true; value: T } | { ok: false; code: SourceError; http?: number };

lookupAddress(postcode, houseNumber, deps): Promise<SourceResult<AddressCandidate[]>>  // A; [] = onbekend
fetchStreams(bagId, deps): Promise<SourceResult<StreamDef[]>>                        // B; 404 → NOT_FOUND
fetchYear(bagId, year, deps): Promise<SourceResult<RawPickup[]>>                     // C; 404 → ok []
fetchPickups(bagId, today, deps): Promise<SourceResult<{ pickups: WastePickups; unknownStreams: number; hadAnyDate: boolean }>>
// deps = { fetch: typeof fetch; signal: AbortSignal; baseUrl: string } — in tests geïnjecteerd
```

Hoe foutcodes ontstaan:
- netwerkfout, time-out of abort, 5xx, 429, of een andere 4xx → `UNREACHABLE`;
- kapotte JSON, zod-fout, verkeerde content-type of te groot → `FORMAT`;
- B geeft 404 → `NOT_FOUND` (adres onbekend geworden; bij de sync wordt dat `ADDRESS_GONE`);
- C voor J+1 geeft 404 of `[]` → leeg, en dat is **geen** fout.

#### 18.1.4 Parser (zod, `src/server/waste/schema.ts`)

- **Alleen verplicht wat we gebruiken.** Onbekende velden worden genegeerd (`.passthrough()` niet nodig; `z.object` stript ze).
  - A: `bagId` (string of number → string, regex).
  - A: `huisletter` en `huisnummerToevoeging` (nullable string).
  - A, optioneel voor de weergave bij "Klopt dit?": `straatnaam|straat`, `huisnummer`, `woonplaats|plaats`. Deze velden worden **nooit** bewaard of gelogd.
  - B: `id` (number of string), `title`, `menu_title?`, `icon?`.
  - C: `afvalstroom_id`, `ophaaldatum` (`YYYY-MM-DD`; `null` → rij overslaan).
- **Bak herkennen** (`src/domain/waste/streams.ts`, puur):
  - eerst op `icon`: `zak-grijs-rest` → rest, `doos-karton-papier` → papier, `petfles-blik-drankpak_pmd` → pmd;
  - daarna als terugval op trefwoord in `title` of `menu_title` (kleine letters): `pmd`|`plastic` → pmd, `papier` → papier, `rest` → rest, **tenzij** `grof`, `gft`, `kerst` of `textiel` erin staat (dan negeren);
  - `appel-gft` en alles wat onbekend is → `null` (genegeerd en alleen geteld, AC-196);
  - twee stromen die op dezelfde bak uitkomen, worden samengevoegd.
- **Resultaat:** `WastePickups = { rest: ISODate[]; papier: ISODate[]; pmd: ISODate[] }`, gesorteerd, uniek, alleen datums ≥ vandaag.

#### 18.1.5 Adres kiezen (`src/domain/waste/address.ts`, puur; AC-184, AC-187)

- **`normalizeWasteAddress(raw)`:**
  - postcode: hoofdletters, spaties eruit ("2511ab" → "2511AB"; tonen als "2511 AB");
  - huisnummer "12a", "12 a", "12-2" of "12 bis" → nummer 12 + toevoeging;
  - toevoeging: hoofdletters, spaties en `-` eruit, maximaal 4 tekens `[A-Z0-9]`.
- **`suffix`** is `string | null`:
  - `null` = niet opgegeven;
  - `""` = bewust het adres zonder letter gekozen (keuze "12" in C2).
- **Sleutel van een kandidaat:** `normalize(huisletter) + normalize(huisnummerToevoeging)`.
- **`matchCandidate(candidates, suffix)`:**
  - 0 kandidaten → `not_found`;
  - `suffix === null` en precies 1 kandidaat → die kandidaat;
  - `suffix === null` en meer dan 1 kandidaat → `choose` met `options[{ suffix: key, label: "12A" }]`;
  - `suffix` gegeven → exacte sleutelmatch, anders `not_found`.
- De app kiest dus nooit zelf (BR-48).

#### 18.1.6 Fixtures en probe (verplicht vóór de livegang)

- **Zolang de bron niet bereikbaar is:** tests draaien op gereconstrueerde fixtures in `src/server/waste/__tests__/fixtures/` (`synthetic-*.json`, gemarkeerd als synthetisch).
- **Vóór de livegang van WP3b** komen er echte antwoorden, voor het openbare testadres uit HACS (2591 BB 87, geen persoonsgegeven). Eén van twee routes (keuze van de hoofdsessie, zie de vragen):
  1. Jurgen zet `huisvuilkalender.denhaag.nl` in de netwerk-allowlist van de ontwikkelomgeving (V-57). De bouwer haalt A, B, C(J), C(J+1) en `robots.txt` op met `curl`.
  2. Een eenmalige `select net.http_get(...)` vanuit het live Supabase-project (pg_net staat daar sinds WP3), gelezen uit `net._http_response`.
- **De probe bevestigt en legt vast in `DECISIONS.md`:**
  - veldnamen van A, B en C;
  - `icon`/`title` van rest, papier en PMD in Den Haag;
  - het BAG-formaat;
  - het gedrag van J+1 (`[]` of 404);
  - de content-type;
  - de responstijd.
- **`robots.txt` of gebruiksvoorwaarden die `/rest/` uitsluiten:** dan **stoppen** en naar Jurgen (beleidskeuze). De echte fixtures vervangen daarna de synthetische, en alle parser- en planningtests draaien er ook op.
- **Rooktest op live (AC-217):** Jurgens eigen adres. De datums worden vergeleken met de site van de gemeente, ook de gemeenteregels uit BR-49 (22:00, 07:45) op de pagina zelf (aandachtspunt 7 van de analist).

### 18.2 Modules en systeemgrenzen

```
src/domain/waste/                 puur, vitest
  address.ts    normalizeWasteAddress, formatPostcode, matchCandidate
  streams.ts    classifyStream, WASTE_STREAMS = ['rest','papier','pmd'] (vaste volgorde)
  plan.ts       wasteTitle, wasteTaskFields, planWasteTasks, isSuspectEmpty, WASTE_HORIZON_DAYS = 14
  expire.ts     findExpiredWasteTasks (BR-54)
  health.ts     dueForFetch, wasteSyncHealth (BR-52)
  messages.ts   wasteReminder (21:00/18:00), wasteFailureMessage, teksten (UX §13.10)
src/server/waste/                 server-only, GEEN service role
  source.ts     fetch + limieten (§18.1)   schema.ts  zod
  lookup.ts     lookupWasteCalendar(input, today, deps) → found | choose | not_found | no_streams | no_upcoming | unreachable
src/server/system/waste/          service role (TD §5.3)
  sync.ts       saveWasteCalendar, syncHousehold, runWasteStep (tick)
src/server/actions/waste.ts       lookupWasteAddressAction, confirmWasteAddressAction, retryWasteSyncAction, disableWasteCalendarAction
src/server/services/waste-read.ts getWasteSettings(db, ctx) (user-client, RLS) voor de instellingenpagina
```

- **Browser:** alleen het formulier, de resultaten van de actions en het tonen van afvaltaken. Geen enkel verzoek naar de gemeente vanaf de telefoon.
- **Server:** alle opvragingen bij de gemeente, altijd **na** `requireAdmin()` (user-flow) of vanuit de tick.
- **Extern:** alleen de vaste host (§18.1.2).
- **Geheimen:** geen. Er is geen sleutel nodig en er komt geen `NEXT_PUBLIC_`-variabele bij.

### 18.3 Datamodel en migraties

#### 18.3.1 Nieuwe tabel `waste_calendars` (hooguit één per huishouden)

| Kolom | Type en regel |
| --- | --- |
| `household_id` | `uuid primary key references households(id) on delete cascade` |
| `postcode` | `text not null check (postcode ~ '^[1-9][0-9]{3}[A-Z]{2}$')` |
| `house_number` | `integer not null check (house_number between 1 and 99999)` |
| `house_suffix` | `text not null default '' check (house_suffix ~ '^[A-Z0-9]{0,4}$')` |
| `bag_id` | `text not null check (bag_id ~ '^[0-9]{16}$')` |
| `pickups` | `jsonb not null` — `{"rest":[ISODate…],"papier":[…],"pmd":[…]}`, alleen datums ≥ vandaag op het moment van schrijven; `check (jsonb_typeof(pickups) = 'object')` |
| `version` | `bigint not null default 1` — +1 bij elk nieuw adres (optimistische controle voor de tick) |
| `last_attempt_at` | `timestamptz` (claim en rate limit) |
| `last_success_at` | `timestamptz not null` (gezet bij opslaan; opslaan kan alleen na een geslaagde opvraging, BR-48) |
| `last_error_code` | `text check (last_error_code in ('UNREACHABLE','FORMAT','SUSPECT_EMPTY','ADDRESS_GONE'))` |
| `failure_count` | `integer not null default 0` (opeenvolgende mislukte pogingen) |
| `created_at`, `updated_at` | standaard + trigger `set_updated_at` |

- **Niet opgeslagen (BR-58):** straat, plaats, coördinaten, ruwe antwoorden en wie het adres invoerde. Het adres hoort bij het huishouden.
- **"Storingsmelding verstuurd ja/nee"** (PRODUCT_SPEC §8) is afgeleid: de melding met dedupe-sleutel `waste-failed:<last_success_at>` bestaat of niet (§18.9).
- **Versimpeltoets (tabel):** in r1 stonden de ophaaldagen in een aparte cachetabel. Nu staan ze in één `jsonb`-kolom.
  - Het zijn ≤ ~150 datums per jaar, altijd in zijn geheel gelezen en vervangen, en nooit per datum bevraagd in SQL.
  - Eén tabel, één policy en geen cascade.
  - De tick leest hem toch al (één query).

#### 18.3.2 `tasks` ✚ drie kolommen

| Kolom | Betekenis |
| --- | --- |
| `waste_pickup_date date` | ophaaldag D waar de taak bij hoort |
| `waste_direction text` | `'out'` (buitenzetten) of `'in'` (binnenzetten) |
| `waste_streams text[]` | bakken op D, in de vaste volgorde rest, papier, pmd |

- `check tasks_waste_shape`:
  ```sql
  (waste_direction is null and waste_pickup_date is null and waste_streams is null)
  or (waste_direction in ('out','in') and waste_pickup_date is not null and recurrence_id is null
      and cardinality(waste_streams) between 1 and 3
      and waste_streams <@ array['rest','papier','pmd']::text[])
  ```
- `constraint tasks_waste_key unique (household_id, waste_pickup_date, waste_direction)`.
  - Dit is de sleutel **per huishouden, datum en richting** (V-51, BR-50).
  - NULL's botsen niet (standaard `NULLS DISTINCT`), dus gewone taken merken er niets van.
  - Een gewone, niet-partiële constraint, zodat hij ook als `on conflict`-doel en als index voor "taken van deze ophaaldag" werkt.
- De kolommen zijn nullable en zonder standaardwaarde: geen herschrijving van de tabel. De oude code (`select("*")`) blijft werken (expand).
- **Afvaltaken worden nooit zacht verwijderd.** Vervallen open taken worden door het systeem **hard** verwijderd: geen historie en niet geteld als vergeten (BR-51, AC-199). Afgevinkte en overgeslagen taken blijven altijd staan.

#### 18.3.3 Meldingstype

`notification_type` ✚ `'waste_sync_failed'`.

#### 18.3.4 Migraties (datumprefix bij het bouwen; nummers na `…_310`)

| Bestand | Soort | Inhoud |
| --- | --- | --- |
| `…_320_afval_meldingstype.sql` | niet-destructief | alleen `alter type public.notification_type add value if not exists 'waste_sync_failed'`. Apart bestand, omdat een nieuwe enumwaarde pas na de commit bruikbaar is (PG-docs). Zo blijft de volgende migratie in één transactie bruikbaar |
| `…_330_afvalkalender.sql` | niet-destructief, compatibel met de huidige code | tabel `waste_calendars` + RLS + grants (§18.5.1); `tasks`-kolommen, check en unieke sleutel (§18.3.2); `guard_task_changes` vervangen (§18.5.2); policies `tasks: aanmaken` en `tasks: beheerder of maker verwijdert` vervangen (§18.5.3); `delete_task` vervangen (§18.5.4); trigger `waste_skip_cascade` (§18.5.5); RPC's `waste_save`, `waste_sync`, `disable_waste_calendar`, `waste_calendar_enabled` (§18.7); daarna opnieuw `revoke execute on all functions in schema private from public, anon, authenticated` + de bestaande grants op de policy-helpers (patroon uit `…_110`) |

Beide gaan op live via de Supabase-koppeling (`apply_migration`, D-040), eerst `_320`, dan `_330`.

### 18.4 Afvaltaken: sleutel, naam en tijden

#### 18.4.1 Naam (`wasteTitle(streams, direction)`, UX §13.3 exact)

- **Buitenzetten:** de namen "Restafval", "papier", "PMD" in vaste volgorde, verbonden met ", " en " en "; de eerste letter een hoofdletter; + " buitenzetten".
  - Voorbeeld: "Restafval, papier en PMD buitenzetten".
- **Binnenzetten:**
  - één bak: "Restafvalbak", "Papierbak" of "PMD-bak";
  - meerdere: alle behalve de laatste krijgen "-", de laatste krijgt "bak" (bij PMD "PMD-bak");
  - voorbeelden: "Restafval- en papierbak binnenzetten", "Restafval-, papier- en PMD-bak binnenzetten".
- Maximaal 47 tekens (≤ 80, constraint).

#### 18.4.2 Velden (`wasteTaskFields(D, direction, streams, tz)`)

Tijden via `zonedInstant` in `Europe/Amsterdam` (BR-59; ook correct als de klok verzet tussen D−1 21:00 en D 07:45).

| Veld | Buitenzetten (`out`) | Binnenzetten (`in`) |
| --- | --- | --- |
| `scheduled_date` | D−1 | D |
| `scheduled_time` | `21:00` (sortering; de UI toont "vanaf 22:00", nooit "21:00") | `null` |
| `available_from` | `null` (afvinken nooit geblokkeerd) | D 12:00 |
| `due_at` | D 07:45 (afvinken daarna = "te laat", via de bestaande `complete_task`) | (D+1) 00:00 = einde van D |
| `reminder_minutes_before` | `'{}'` (de afvalherinnering is afgeleid, §18.9) | `'{}'` |
| `description` | "Mag vanaf 22:00 buiten, uiterlijk 07:45." | "Binnenzetten vanaf 12:00, uiterlijk vandaag." |
| `category` / `priority` | `outdoor` / `normal` | idem |
| `created_by_member_id` / `recurrence_id` | `null` / `null` | idem |
| `waste_*` | D, `out`, streams | D, `in`, streams |

- Teksten staan als constanten in `src/domain/waste/messages.ts`: geen adres en geen naam.
- De omschrijving zorgt dat de oude UI de regel uit BR-49 al toont zonder extra werk.

### 18.5 Rechten: RLS, guard, policies en RPC-checks

#### 18.5.1 `waste_calendars` (V-53: alleen beheerders)

- `enable row level security`.
- Eén policy: `for select to authenticated using (private.is_admin(household_id))`.
- **Geen** policy voor insert, update of delete. Schrijven gebeurt alleen via de service role (`waste_save` en `waste_sync`) en de RPC `disable_waste_calendar`.
- `revoke all on public.waste_calendars from anon`; `revoke insert, update, delete on public.waste_calendars from authenticated`.
- Niet in de Realtime-publicatie.
- **Gezinsleden:** `public.waste_calendar_enabled()` (security definer, `stable`) geeft `exists(waste_calendars van het eigen actieve lidmaatschap)`. Zonder actief lidmaatschap is de uitkomst `false`: een buitenstaander leert niets over een ander huishouden (AC-190).
  - `execute` alleen voor `authenticated`.
  - **Versimpeltoets:** een kolom `households.waste_calendar_enabled` geeft een tweede bron die met een extra trigger bewaakt moet worden (beheerders mogen `households` wijzigen). De afgeleide functie slaat niets dubbel op.

#### 18.5.2 `private.guard_task_changes` (vervangen; de bestaande regels uit `…_210` blijven letterlijk, dit komt erbij)

```sql
-- vóór de bestaande controles, ná "systeem en FK-acties mogen door"
if tg_op = 'INSERT' then
  if new.waste_direction is not null or new.waste_pickup_date is not null or new.waste_streams is not null then
    raise exception 'Afvaltaken maakt alleen de afvalkalender' using errcode = '42501';   -- AC-219
  end if;
else
  if old.waste_direction is not null
     or row(new.waste_direction, new.waste_pickup_date, new.waste_streams)
        is distinct from row(old.waste_direction, old.waste_pickup_date, old.waste_streams) then
    -- BR-53: alleen status (en completed_at via de RPC's) mag veranderen; ook met via_rpc
    if (to_jsonb(new) - array['status','completed_at','updated_at'])
       is distinct from (to_jsonb(old) - array['status','completed_at','updated_at']) then
      raise exception 'Een afvaltaak kun je niet wijzigen, verplaatsen of verwijderen' using errcode = '42501';
    end if;
  end if;
end if;
```

- Het systeem (`auth.uid() is null`) en FK-acties (`pg_trigger_depth() > 1`) gaan zoals nu eerst door.
- De jsonb-vergelijking bevriest ook kolommen die later bijkomen.
- Hij weigert, ook voor beheerders:
  - hernoemen, datum, tijd, `available_from`, `due_at`, omschrijving, herinneringen, prioriteit en categorie;
  - `is_exception` en `deleted_at`;
  - koppelen aan een reeks ("omzetten naar terugkerend").
- Toegestaan:
  - `todo ↔ in_progress ↔ skipped` door ieder actief lid (bestaande update-policy);
  - `done` en terug via `complete_task` en `undo_complete_task` (die raken alleen `status` en `completed_at`).

#### 18.5.3 Policies op `tasks` (vervangen)

- `tasks: aanmaken`: `with check (private.can_create_tasks(household_id) and waste_direction is null and waste_pickup_date is null)`. Dubbel met de guard, bewust: RLS + guard.
- `tasks: beheerder of maker verwijdert`: `using (waste_direction is null and private.can_delete_task(household_id, created_by_member_id))`. Een directe REST-delete raakt dan 0 rijen, en `expectRows` maakt daar `FORBIDDEN` van.

#### 18.5.4 `public.delete_task` (vervangen)

- Na de bestaande lidmaatschapscheck: `if v_task.waste_direction is not null then raise exception 'Een afvaltaak kun je niet verwijderen' using errcode = '42501'; end if;`.
- Nodig omdat de RPC security definer is (hij omzeilt de policy) en de BEFORE-guard geen DELETE ziet.
- `stop_series`, `pause_series`, `resume_series` en `clear_series_occurrences` raken alleen taken met `recurrence_id`. Afvaltaken hebben er geen, dus daar is geen wijziging nodig.

#### 18.5.5 Doorwerking "deze keer overslaan" (BR-53, AC-209): trigger

```sql
create trigger tasks_waste_skip_cascade
  after update of status on public.tasks
  for each row when (new.waste_direction = 'out' and old.status is distinct from new.status)
  execute function private.waste_skip_cascade();
```

`private.waste_skip_cascade()` (security definer, `search_path = ''`):
- **Alleen als `auth.uid() is not null` en `pg_trigger_depth() = 1`:** dus alleen handmatig overslaan. Het automatisch vervallen door de tick (service role) werkt bewust **niet** door (BR-53, BR-54).
- **`old.status in (todo, in_progress)` en `new.status = 'skipped'`:** binnenzetten van dezelfde `(household_id, waste_pickup_date)` wordt `skipped`, als die nog open is.
- **`old.status = 'skipped'` en `new.status in (todo, in_progress)`:** binnenzetten wordt `todo`, als die `skipped` is. Dit volgt de spec letterlijk: "dan staan beide weer open".
- De geneste update loopt op diepte 2 door de guard (toegestaan) en start deze trigger niet opnieuw (`waste_direction = 'in'`).
- **Versimpeltoets:** in de service zou het goedkoper zijn, maar dan omzeilt een directe REST-update of de wachtrij de regel. De trigger dekt elk pad met één object.

#### 18.5.6 Server-side vroeg weigeren (vriendelijke fout, geen weesreeks)

- `assertNotWasteTask(task)` in `src/server/services/tasks.ts` geeft een `UserError` met code `FORBIDDEN` en de tekst "Een afvaltaak kun je niet wijzigen, verplaatsen of verwijderen."
- Hij wordt aangeroepen in `moveTask`, `updateTask` (alle scopes, **vóór** het aanmaken van een reeks), `deleteTask` en de wachtrij-soort `move`.
- De database blijft de echte grens.

#### 18.5.7 UI-helpers (`src/domain/permissions.ts`)

- `isWasteTask(t) = t.waste_direction != null`.
- `canEditTask`, `canMoveTask` en `canDeleteTask` geven `false` voor afvaltaken, ook voor beheerders (UX §13.12). Ze zijn alleen voor het verbergen van knoppen.

### 18.6 Server actions (`src/server/actions/waste.ts`)

Alle vier volgen TD §5.1: `runAction` → `requireAdmin()` → zod → pas daarna een opvraging of schrijfactie. Alle vier zijn online-only: ze staan niet in de wachtrij en zijn uitgeschakeld via `useOnlineOnly()`.

| Actie | Invoer (zod, `wasteAddressInput` in `src/lib/validation.ts`) | Wat hij doet | Resultaat (`ActionResult.data`) |
| --- | --- | --- | --- |
| `lookupWasteAddressAction` | `{ postcode, houseNumber, suffix: string\|null }` → `normalizeWasteAddress` | `lookupWasteCalendar` (§18.8.1): A → kandidaat kiezen → B + C. **Schrijft niets** (BR-48: "Klopt dit?" vóór bewaren) | `{ kind: 'found', address, display, next: { rest, papier, pmd } }` of `{ kind: 'choose', options }` / `'not_found'` / `'no_streams'` / `'no_upcoming'` / `'unreachable'` |
| `confirmWasteAddressAction` | idem | **Opnieuw** opvragen (de client levert nooit `bag_id` of datums aan). Bij `found`: is het adres gelijk aan het bewaarde (`bag_id`, postcode, nummer, toevoeging), dan `syncHousehold` (zelfde adres = gewone bijwerking; open taken, notities en "bezig" blijven). Anders `saveWasteCalendar` → RPC `waste_save` | `{ kind: 'saved', inserted, removed }` of dezelfde uitkomsten als lookup (niets bewaard) |
| `retryWasteSyncAction` | `{}` | `syncHousehold(household, { manual: true })`: claim met ten minste 60 s tussen twee pogingen (§18.8.3) | `{ kind: 'done', health, lastSuccessAt }` of `{ kind: 'too_soon' }` |
| `disableWasteCalendarAction` | `{}` | RPC `disable_waste_calendar()` (user-client, eigen rechtencheck) | `{ removed }` (aantal vervallen open taken) |

- **Alleen lezen:** `getWasteSettings(db, ctx)` (server, user-client).
  - Beheerder: `waste_calendars` via RLS, en daaruit adres, stand, `health` en eerstvolgende datum per bak.
  - Gezinslid: `rpc('waste_calendar_enabled')`.
  - Het aantal "(4 taken)" in de bevestiging van uitzetten komt uit de snapshot: open taken met `waste_direction`.
- **Foutcodes:** alleen de bestaande `ActionResult`-codes (`FORBIDDEN`, `VALIDATION`, `UNKNOWN`). Uitkomsten van de bron zijn **geen** fouten, maar `kind`-waarden. Zo kan de UI zonder foutpad de toestanden C, C2, D, E en F tonen.
- **Budget:** 12 s per action (§18.1.2). Met Fluid compute is de standaard-`maxDuration` 300 s; de bouwer controleert in het dashboard dat Fluid aan staat. Staat het uit, dan `export const maxDuration = 30` op het segment `instellingen`.

### 18.7 RPC's

| RPC | Wie | Wat (één transactie) | Idempotentie |
| --- | --- | --- | --- |
| `public.waste_save(p_household_id, p_member_id, p_postcode, p_house_number, p_house_suffix, p_bag_id, p_pickups jsonb, p_insert jsonb, p_now)` → `jsonb {version, removed, inserted}` | **alleen `service_role`** (`revoke … from public, anon, authenticated`) | 1. `perform 1 from households where id = p_household_id for no key update` (serialiseert alle afval-schrijfacties per huishouden; `no key` blokkeert gewone taakinserts niet). 2. Hercontrole: `p_member_id` is een **actieve beheerder** van dit huishouden, anders 42501 (sluit TOCTOU na `requireAdmin`). 3. Upsert `waste_calendars` (`version = version + 1` bij conflict, `last_success_at = last_attempt_at = p_now`, fout leeg, `failure_count = 0`, `pickups`). 4. `delete from tasks where household_id = p and waste_direction is not null and status in ('todo','in_progress')` (BR-56: **alle** open afvaltaken). 5. Insert van `p_insert` via `jsonb_to_recordset`, met `household_id = p_household_id` (nooit uit de payload), `category 'outdoor'`, maker `null`, `on conflict (household_id, waste_pickup_date, waste_direction) do nothing` | dubbel bevestigen: het tweede verzoek wacht op het slot en levert dezelfde eindstand op. Twee beheerders: wie het laatst commit, geldt (AC-191). Er bestaan nooit taken voor twee adressen tegelijk |
| `public.waste_sync(p_household_id, p_version, p_result text, p_error_code text, p_pickups jsonb, p_insert jsonb, p_rename jsonb, p_remove uuid[], p_now)` → `jsonb {stale, inserted, renamed, removed}` | **alleen `service_role`** | 1. Slot op het households-rij (idem). 2. `select … from waste_calendars … for update`; ontbreekt hij of is `version ≠ p_version`, dan `{stale:true}` en **niets** doen (adres intussen gewijzigd of uitgezet). 3. Bij `p_result = 'success'`: `pickups`, `last_success_at = p_now`, `last_error_code = null`, `failure_count = 0`. Bij `'failure'`: `last_error_code`, `failure_count + 1` (pickups blijven). Bij `null`: alleen plannen. 4. `delete … where id = any(p_remove) and household_id = p and waste_direction is not null and status in ('todo','in_progress')`. 5. `update … set title, waste_streams … where id = x.id and household_id = p and waste_direction is not null and status in ('todo','in_progress')`. 6. Insert zoals bij `waste_save` | alle stappen controleren de status opnieuw: wat intussen is afgevinkt of overgeslagen, blijft ongemoeid (AC-202). Twee ticks: inserts botsen op de sleutel, verwijderen is idempotent |
| `public.disable_waste_calendar()` → `integer` | `authenticated` | Huishouden uit het **eigen actieve beheerderslidmaatschap** (`user_id = auth.uid() and is_active and role = 'admin'`), anders 42501. Dan het slot, `delete` van de open afvaltaken, en `delete from waste_calendars` (adres, datums en stand in één keer, AC-213) | tweede aanroep → 0 |
| `public.waste_calendar_enabled()` → `boolean` | `authenticated` | zie §18.5.1 | — |

**Versimpeltoets (plannen):** alles in plpgsql zou de datum- en naamlogica dubbel maken, buiten de geteste TS-domeinlaag. Daarom plant TS (puur) en past de RPC toe. Een versieveld voorkomt dat een verouderd plan van de tick een net gewijzigd adres overschrijft. Het is één bigint, geen lease.

### 18.8 De achtergrondstap "afval"

#### 18.8.1 Opvragen bij het instellen (`lookupWasteCalendar`)

1. A met postcode en nummer, daarna `matchCandidate`. Uitkomst `not_found` of `choose` → terug.
2. B + C(J), plus C(J+1) als vandaag in december valt → `fetchPickups`.
3. Uitkomst:
   - geen enkele rest-, papier- of PMD-datum in de opgehaalde jaren → `no_streams` (AC-186);
   - wel datums, maar geen ≥ vandaag (alleen eind december, als de nieuwe kalender nog niet online staat) → `no_upcoming`;
   - `UNREACHABLE`, `FORMAT` of `NOT_FOUND` van B → `unreachable` (UX toestand F, AC-188).
4. `display` = "straat nummer+toevoeging, plaats" uit A, anders "2517 AB 12A, Den Haag". Alleen in het antwoord aan de beheerder, nooit bewaard of gelogd.

#### 18.8.2 Plannen (`planWasteTasks`, puur)

```ts
planWasteTasks({ pickups, existing, now, timeZone }): { insert: NewWasteTask[]; rename: {id,title,streams}[]; remove: string[] }
// existing = alle afvaltaken van het huishouden met waste_pickup_date >= vandaag (elke status)
```

- **Venster:** D in [vandaag, vandaag + 14] (V-52, BR-50).
- **Per D in het venster:** de bakken met een datum op D, in vaste volgorde. Dat is de gewenste sleutel `(D, out)` + `(D, in)` met naam en bakken.
- **insert:** gewenste sleutel zonder bestaande taak (elke status telt als bestaand), en het moment is nog niet voorbij (BR-50, AC-203):
  - `out` alleen als `now < D 07:45`;
  - `in` altijd binnen het venster (D ≥ vandaag, dus vóór het einde van D).
- **rename:** bestaande **open** taak met een gewenste sleutel, maar andere `waste_streams` (AC-201). De naam volgt uit de bakken.
- **remove:** bestaande **open** taak met D in het venster en **geen** ophaling meer op D (AC-198, AC-199).
  - **Behalve** `in` als `out` van dezelfde D `done` is: de bak staat buiten (BR-51, AC-200).
  - Taken met D < vandaag vallen buiten het venster en worden hier nooit geraakt (BR-54 regelt die).
- **Leeg plan → geen RPC.** Dat is het normale geval bij bijna elke tick.

#### 18.8.3 Wanneer ophalen, claim en rate limit

- **`dueForFetch(cal, now, tz)`:**
  - niet als `last_attempt_at` minder dan 60 min geleden is;
  - wel als de lokale datum van `last_success_at` vóór vandaag ligt en het lokaal ≥ 06:00 is (dagelijks, BR-51: een wijziging staat uiterlijk 24 uur later in de app);
  - wel als de laatste poging mislukte (`last_error_code` gezet), dan elk uur opnieuw.
- **Claim (tegelijk lease en rate limit, zonder lock):**
  ```
  update waste_calendars set last_attempt_at = now
  where household_id = X and version = V and (last_attempt_at is null or last_attempt_at < now - 60 s)
  returning household_id
  ```
  - Geen rij = een andere tick of een handmatige poging was net bezig → niet ophalen.
  - "Opnieuw proberen" gebruikt dezelfde claim, dus hooguit één keer per minuut per huishouden, afgedwongen op de server. Geen claim → `{ kind: 'too_soon' }`.

#### 18.8.4 Leeg-antwoordbewaking (BR-52, AC-204): over alle drie de bakken samen

- `isSuspectEmpty(fetched, today)` = geen enkele datum van rest, papier of PMD **samen** in [vandaag, vandaag + 14].
- "Er waren eerder ophaaldagen in dat bereik bekend" is structureel waar: een adres wordt alleen bewaard als het ophaaldagen heeft (BR-48). Zo vangt de regel ook de jaarwisseling zonder nieuwe kalender, het voorbeeld uit BR-52.
- **Gevolg:** `p_result = 'failure'`, `SUSPECT_EMPTY`. De datums, de taken en het adres blijven ongewijzigd.
- **Eén bak zonder dagen** (papier 19 dec – 5 jan) is **geen** storing. Het antwoord wordt normaal verwerkt, en open papiertaken voor verdwenen dagen vervallen of worden hernoemd.

#### 18.8.5 Gezondheid (`wasteSyncHealth`, puur; UI én tick)

| Toestand | Regel | UI (beheerder) |
| --- | --- | --- |
| `failed` (reden `empty`) | `last_error_code = 'SUSPECT_EMPTY'` en `failure_count ≥ 2` (twee pogingen, minstens een uur uit elkaar: het lege antwoord "duurt voort", AC-205; één enkele hapering geeft geen alarm) | toestand H + melding |
| `failed` (reden `stale`) | `now − last_success_at > 48 h` (V-50) | toestand H + melding |
| `retrying` | `last_error_code` gezet, verder niet `failed` | stille regel (UX §13.7.5) |
| `ok` | anders | toestand G |

#### 18.8.6 Tickstap (`runWasteStep(db, now, tickStarted)` in `src/server/system/waste/sync.ts`)

Nieuwe stap in `runTick`, **tussen "overslaan" en "meldingen"**. Zo krijgt een net aangemaakte taak in dezelfde tick zijn herinnering (AC-203a). Eigen `step("afval")` met try/catch, zoals de andere stappen: een fout blokkeert de meldingen en het opruimen niet (AC-204).

1. `select * from waste_calendars` (service role). Leeg → klaar (1 query).
2. Eén query voor de afvaltaken van die huishoudens: `waste_direction is not null and household_id in (…) and (status in (todo, in_progress) or waste_pickup_date >= vandaag − 35)`.
3. Per kalender, na elkaar (in de praktijk 1):
   - **Ophalen:** alleen als `dueForFetch` klopt, de tick nog geen 10 s loopt en de claim slaagt. Daarna `fetchPickups` met een budget van 12 s (per verzoek 8 s). Uitkomst:
     - `success` met de nieuwe datums;
     - `failure` met een code (`UNREACHABLE`, `FORMAT`, `ADDRESS_GONE` bij 404 op B, of `SUSPECT_EMPTY`).
   - **Plannen** met de effectieve datums (nieuw bij succes, anders de bewaarde).
   - **Toepassen:** RPC `waste_sync` alleen als er een ophaaluitkomst is of het plan niet leeg is.
   - **Verlopen (BR-54):** `findExpiredWasteTasks(tasks, today)`. Update `status = 'skipped'` met de service role, alleen waar de taak nog open is (zelfde patroon als `skipAllSuperseded`, in blokken van 200):
     - `out` open en vandaag > D → `skipped` (telt als vergeten);
     - `in` open, vandaag > D (dus al verlopen) **en** er bestaat een `out`-taak met `waste_pickup_date > D` en `scheduled_date ≤ vandaag` → `skipped`.
     - "Al verlopen" is een voorwaarde: bij ophaaldagen op twee opeenvolgende dagen zou binnenzetten anders al vervallen op de ophaaldag zelf (AC-210).
   - **Storing:** `wasteSyncHealth` na de stap. Bij `failed` volgt `dispatcher.notify` met de storingsmelding (§18.9.3).
4. Tellingen in `TickReport.waste = { calendars, fetched, fetchFailed, inserted, renamed, removed, expired, alerted }`. De log bevat alleen die tellingen en de foutcode.

- **BR-16 (`skipAllSuperseded`)** raakt afvaltaken niet: die hebben geen `recurrence_id`.
- **Het Vercel-vangnet (1×/dag, 07:30)** draait dezelfde tick en dekt dus ook de dagelijkse ophaalstap als pg_cron stilvalt.

### 18.9 Meldingen

#### 18.9.1 Herinneringen (BR-55, V-44, V-48, V-49)

- **`wasteReminder(task, now, tz)` (puur)** vervangt voor afvaltaken `taskMessages` volledig. In de tick staat per taak:
  ```ts
  task.waste_direction ? wasteReminder(...) : taskMessages(...)
  ```
  Daarmee komt er voor afvaltaken **nooit** "deadline nadert" of "verlopen" (V-50, AC-211). De tick-select krijgt `waste_direction, waste_pickup_date, waste_streams` erbij.
- **Anker:**
  - `out` → (D−1) 21:00;
  - `in` → D 18:00.
- **Wanneer:** alleen als de taak open is (de tick leest alleen open taken) en `0 ≤ now − anker < 90 min` (dezelfde grens als BR-31; AC-194, AC-203).
- **Inhoud:**
  - type `reminder` (voorkeur `notify_reminders`, V-23);
  - titel `Herinnering: <taaknaam>`;
  - dedupe-sleutel `waste:<taskId>:<anker-ISO>`.
- **Tweede regel (UX §13.10):**
  - `out`: "Morgen ophaaldag. Mag vanaf 22:00 buiten, uiterlijk morgen 07:45."
  - `in`: "Vandaag was de ophaaldag. Zet de bak vandaag nog binnen." Bij meer dan één bak (`cardinality(waste_streams) > 1`): "Zet de bakken vandaag nog binnen."
- **Eén herinnering per ontvanger**, omdat er één taak per dag en richting is (AC-195).

#### 18.9.2 Overig

- Afvaltaken tellen gewoon mee in het dag- en avondoverzicht.
- "Taak gedaan" volgt de eigen voorkeur (V-38a).

#### 18.9.3 Storingsmelding (BR-52, BR-55, AC-205)

- **Nieuw type `waste_sync_failed`.**
- **`recipientsFor`:**
  - krijgt het veld `role` in de leden-Pick;
  - heeft voor dit type een eigen tak: **ieder actief lid met account en `role = 'admin'`, los van de voorkeuren**;
  - `PREFERENCE_FOR_TYPE` wordt `Record<Exclude<NotificationType,'waste_sync_failed'>, keyof PreferencesRow>`;
  - de dispatcher leest ook `role`.
- **Push:** zoals bij elke melding, als `push_enabled` aan staat en er een abonnement is ("als push op dat toestel aan staat").
- **Eén per storing:** dedupe-sleutel `waste-failed:<last_success_at ISO>` per ontvanger, via de bestaande `unique (member_id, dedupe_key)`.
  - Elke tick tijdens een storing is een no-op (geen nieuwe rij, geen push).
  - Na een geslaagde bijwerking verandert `last_success_at`, dus een nieuwe storing geeft opnieuw precies één melding.
  - "Leeg" en daarna "> 48 uur" hebben dezelfde sleutel: één melding.
- **Tekst:** `wasteFailureMessage(reason, lastSuccessAt, tz)`, UX §13.10, twee varianten (`stale`, `empty`). Datum in het Nederlands. Nooit een adres of naam.
- **URL:** `appUrl.wasteSettings()` = `/instellingen#afvalkalender` in de oude UI. De nieuwe UI (WP7) laat `/instellingen` met dit anker doorsturen naar `/instellingen/afvalkalender`, zodat oude meldingen blijven werken. De url-check `^/([^/\\]|$)` wordt gerespecteerd.

### 18.10 Gelijktijdigheid en idempotentie

| Situatie | Mechanisme | Uitkomst |
| --- | --- | --- |
| Twee ticks tegelijk (pg_cron + vangnet) | claim met `last_attempt_at` (één haalt op); unieke sleutel `tasks_waste_key` + `on conflict do nothing`; dedupe op meldingen | één taak per huishouden, datum en richting; geen dubbele meldingen (AC-197) |
| Dubbel tikken op "Ja, aanzetten" | slot op het households-rij in `waste_save`; hetzelfde adres → dezelfde eindstand | één adres, één set taken (AC-191) |
| Twee beheerders slaan tegelijk een ander adres op | slot; wie het laatst commit, geldt; `waste_save` wist **alle** open afvaltaken vóór het invoegen | nooit taken van twee adressen (AC-191, AC-214) |
| Tick plant terwijl het adres wijzigt | `version` in de claim en in `waste_sync` → `stale` = niets doen | de volgende tick plant voor het nieuwe adres |
| Gebruiker vinkt af terwijl de tick opruimt of hernoemt | `waste_sync` verwijdert en hernoemt alleen `where status in (todo, in_progress)` | wat is afgevinkt, blijft (AC-202) |
| Overslaan en ongedaan maken snel na elkaar, of offline | trigger per update; de wachtrij is FIFO | eindstand volgt de laatste actie; binnenzetten volgt mee (AC-209) |
| "Opnieuw proberen" spammen | claim ≥ 60 s | hooguit één opvraging per minuut |

### 18.11 Foutafhandeling: wat de gebruiker ziet

| Uitkomst | UX-toestand (§13.8) | Bewaard? |
| --- | --- | --- |
| zod-fout (vorm) | A met foutregel bij het veld; geen opvraging (AC-184) | nee |
| `not_found` | D | nee |
| `choose` | C2 | nee |
| `no_streams` | E | nee |
| `no_upcoming` | F, met eigen tekst (zie punt 3 voor de hoofdsessie) | nee |
| `unreachable` (ook `FORMAT`) | F "… niet bereikbaar. Er is niets opgeslagen." | nee; een bestaand adres blijft (AC-188) |
| `FORBIDDEN` | "Alleen een beheerder kan de afvalkalender aanpassen. Er is niets veranderd." | nee |
| `UNKNOWN` bij `waste_save` | "Opslaan lukte niet. Er is niets veranderd." ("Klopt dit?" blijft staan) | nee (één transactie) |
| `too_soon` | toast "Net geprobeerd. Probeer het over een minuut opnieuw." | — |
| sync `retrying` / `failed` | stille regel / H + melding | — |

### 18.12 Privacy en logging (BR-58, AC-212, AC-218)

- **Bewaard:** postcode, huisnummer, toevoeging en `bag_id`, alleen in `waste_calendars`, alleen leesbaar voor beheerders.
- **Weg:**
  - bij uitzetten (`disable_waste_calendar`);
  - bij het verwijderen van het huishouden (FK-cascade, AC-216).
- **Nooit gelogd:** postcode, huisnummer, `bag_id`, straat, URL's van de bron, `error.message` van een fetch (kan de host of het pad bevatten) of een huishoud-id.
- **Logregels:**
  - `[waste] sync ok datums=n onbekend=u ms=t`;
  - `[waste] sync mislukt code=UNREACHABLE http=503`;
  - `[waste] lookup uitkomst=not_found`.
- `next.config` zet **geen** `logging.fetches.fullUrl`.
- **Naar buiten:** alleen postcode + nummer (A) of `bag_id` (B, C), alleen naar de vaste host (AC-218), vanaf de Vercel-functie in `fra1`.
- **Platformlogs (TD §9.4):** de body van een RPC-aanroep door de service role komt niet in de API-logs van Supabase (alleen pad en metadata). Niet gecontroleerd per plan; de security-reviewer bekijkt dit in WP3b.
- **Teksten:** meldingen, push, taaknamen, omschrijvingen en historie bevatten alleen bak en dag (vaste teksten, §18.4 en §18.9).

### 18.13 Performance-impact

- **Tick, normaal (elke 15 min):**
  - 2 kleine query's erbij (`waste_calendars`: 1 rij; afvaltaken: ≤ ~60 rijen via `tasks_waste_key` + filter);
  - planning in het geheugen;
  - **0 schrijfacties** als er niets verandert;
  - ≈ 20–40 ms extra.
- **Dagelijks (en elk uur bij een storing):**
  - 2–3 GET's parallel (normaal < 1 s, hard maximaal 12 s);
  - 1 RPC (≈ 2–4 inserts per dag).
- **Ophalen start alleen als de tick nog geen 10 s loopt,** dus uiterlijk ± 22 s na de start. Het pushbudget (45 s) en de 55 s van pg_net blijven gehaald. De meting van de tickduur in WP3b-performance: p95 < 5 s zonder ophalen.
- **Snapshot en Realtime:** geen extra query's. De drie kolommen komen mee via `select("*")` (oude UI) of via de expliciete kolomlijst (WP4). Het venster van `work` bevat de afvaltaken al.
- **Instellingenpagina:** 1 query (beheerder) of 1 RPC (gezinslid).
- **Volume:** ± 2 × 100 afvaltaken per jaar: verwaarloosbaar tegenover ~8k taken.

### 18.14 Oude UI (WP3b, `main`) en nieuwe UI (`v2-ui`)

**Oude UI, minimaal en volgens UX §13.13:**
- `src/features/settings/afval-section.tsx` (nieuw) + springlink "Afval" in `settings-page.tsx`:
  - toestanden A–J inline;
  - de bevestiging van uitzetten met de bestaande Dialog;
  - voor een gezinslid alleen J (op basis van `waste_calendar_enabled`).
- `task-card.tsx`:
  - voor afvaltaken de meta "♻ Afvalkalender" (lucide `Recycle`, 14 px) in plaats van de categorie;
  - rechterkolom "vanaf 22:00" (D−1), "vóór 07:45" (D, vóór de deadline), "vanaf 12:00" (binnenzetten vóór 12:00);
  - nooit "21:00".
- `features/tasks/selectors.ts#dashboardData`, **alleen voor afvaltaken**:
  - een open `out`-taak van D−1 die nog niet verlopen is, blijft op D tot 07:45 onder Vandaag;
  - een `in`-taak met `available_from > now` staat onder Binnenkort.
  - Gewone taken blijven zoals ze zijn ("niets herontwerpen").
- `task-detail-sheet.tsx`:
  - Bewerken, Verwijderen, Naar morgen, Andere dag en de datumkiezer verborgen;
  - infolijst en uitlegregel volgens UX §13.6;
  - toast "Overgeslagen, ook het binnenzetten · Ongedaan maken".
- `calendar-items.tsx`: `useDraggable` uit voor afvaltaken.
- `features/notifications/format.ts`: label en icoon voor `waste_sync_failed`.
- `features/household/mutations.ts` (optimistisch):
  - overslaan van een `out`-taak markeert lokaal ook de bijbehorende `in`-taak als overgeslagen;
  - ongedaan maken zet beide terug;
  - de server (trigger) en Realtime zijn leidend.

**Nieuwe UI (op `v2-ui`, als W-03-aanvulling in bestaande WP's):**
- WP5: rij en detail volgens UX §13.4–13.6.
- WP6: informatierij in Taken › Terugkerend; `?bewerk=<id>` van een afvaltaak opent `?taak=<id>`.
- WP7: subpagina `/instellingen/afvalkalender`, plus doorsturen vanaf het oude anker.
- WP8: slepen uit, meldingenlijst, Overzicht groepeert op `waste_direction` ("Afval buitenzetten" / "Bakken binnenzetten").

Er komt geen nieuwe migratie voor.

### 18.15 Tests per acceptatiecriterium

Lagen zoals TD §13. Bron altijd nagebootst:
- Unit/Int: `deps.fetch` geïnjecteerd met fixtures.
- E2E: stubserver `tests/e2e/support/waste-stub.mjs` op `127.0.0.1:<poort>`, gestart door `local-stack.sh` met `WASTE_SOURCE_BASE_URL`.
- Databasetests: `supabase/tests/70_afval.sql`.
- Integratie: `tests/integration/waste.test.ts`.
- E2E: `tests/e2e/waste.spec.ts` (oude UI, 390×844).

| AC | Unit (`src/domain/waste/__tests__`, `src/server/waste/__tests__`) | DB (`70_afval.sql`) | Int | E2E |
| --- | --- | --- | --- | --- |
| 183 | — | — | confirm → adres + taken voor vandaag…+14; annuleren = geen aanroep | invullen → Klopt dit? → aanzetten → Vandaag/Kalender |
| 184 | `normalizeWasteAddress`: ongeldige postcodes en nummers | — | geen fetch bij een zod-fout (spy) | foutregel, knop uit |
| 185 | `matchCandidate` → `not_found` | — | A `[]` → `not_found`; bestaand adres en taken ongewijzigd | melding D |
| 186 | `fetchPickups`: alleen GFT → `no_streams` | — | niets bewaard | — |
| 187 | "2511ab"/"12 a" ≡ "2511 AB"/"12A"; meerdere → `choose`; `suffix ""` kiest "12" | — | idem, via de action | — |
| 188 | source: time-out, 503, kapotte JSON, te groot, redirect → `UNREACHABLE`/`FORMAT` | — | (a) niets bewaard; (b) oud adres, taken en `version` gelijk | — |
| 189 | — | lid, uitgezet lid en buitenstaander: insert/update/delete `waste_calendars` geweigerd; `disable_waste_calendar` → 42501; `waste_save`/`waste_sync` niet uitvoerbaar voor `authenticated`/`anon` | actions als gezinslid → `FORBIDDEN`, **fetch-spy 0 aanroepen** | Lynn ziet geen formulier |
| 190 | — | select `waste_calendars`: beheerder 1 rij, lid/uitgezet/ander 0; `waste_calendar_enabled()`: lid `true`, Bas `false` | `getWasteSettings` als lid: geen adresvelden | beheerder ziet adres, Lynn alleen "Aan" |
| 191 | — | `waste_save` 2× parallel (`gelijktijdig.sh`) → 1 rij, geen dubbele sleutels | `Promise.all` twee adressen → alleen taken van het laatst gecommitte | — |
| 192 | `wasteTaskFields` out: D−1 21:00, due D 07:45, omschrijving | `complete_task` om 07:50 → `was_late` | — | rij "vanaf 22:00" |
| 193 | `in`: D, `available_from` 12:00, due (D+1) 00:00 | — | — | vóór 12:00 onder Binnenkort |
| 194 | `wasteReminder` (a)/(b) afgevinkt = geen; (c) open = één, met teksten | — | tick om 21:00/18:00 → 1 melding elk; tweede tick 0 | — |
| 195 | `wasteTitle` alle 7 combinaties × 2 richtingen (UX-tabel) | — | 1 herinnering per ontvanger | — |
| 196 | `classifyStream`: GFT, grof, kerst, onbekend → `null` | — | — | — |
| 197 | `planWasteTasks`: +3/+14 wel, +15 niet | unieke sleutel weigert een duplicaat | 2 ticks na elkaar + 2 parallel → geen extra taken of meldingen; dag later +15 | — |
| 198 | plan: 25-12 → 26-12 (remove + insert) | — | idem, geen historie | — |
| 199 | plan: dag verdwijnt → remove beide | — | hard verwijderd, geen completion | — |
| 200 | plan: `out` done + dag weg → `in` blijft; verschuiving → nieuwe D′ | — | idem | — |
| 201 | plan: rename bij −papier / +PMD; niet bij done/skipped | `waste_sync` rename raakt done niet | idem | — |
| 202 | — | `waste_sync` remove/rename op done/skipped → 0 rijen | idem | — |
| 203 | plan + reminder (a)–(e) op vaste `now` | — | tick op 21:40/23:00/08:00/19:45/00:10 | — |
| 204 | `isSuspectEmpty` (alle drie leeg = ja; alleen papier leeg = nee) | — | 500/time-out/leeg → taken, adres en `pickups` gelijk; `failure_count` 1; andere tickstappen draaien; log zonder adres (console-spy) | — |
| 205 | `wasteSyncHealth` (48 u, leeg ≥ 2); `wasteFailureMessage` zonder adres | — | Jurgen + Ellen (herinneringen uit) elk 1 melding over 3 ticks; Lynn 0; na succes + nieuwe storing opnieuw 1 | beheerder ziet balk H |
| 206 | 26-10-2026, 29-03-2027, 25-10-2026: 21:00, 07:45, 12:00 en 18:00 lokaal | — | — | — |
| 207 | — | `in` afvinken + terugdraaien door lid; `out` ongewijzigd | idem, historie zonder persoon | ja |
| 208 | `permissions`: afvaltaak niet te bewerken, verplaatsen of verwijderen | beheerder én lid: update van title, scheduled_date, due_at, description, reminders, prioriteit, `recurrence_id`, `waste_*` → 42501; REST-delete 0 rijen; `delete_task` → 42501; status todo/in_progress/skipped en complete/undo lukken | `moveTask`/`updateTask` (ook "wordt terugkerend": **geen weesreeks**)/`deleteTask` → `FORBIDDEN`; wachtrij `move` → `FORBIDDEN` | knoppen verborgen |
| 209 | — | lid slaat `out` over → `in` skipped; ongedaan → beide todo; service role slaat `out` over → `in` ongewijzigd; alleen `in` overslaan → `out` ongewijzigd | 18:00-herinnering komt niet na overslaan | toast + ongedaan maken |
| 210 | `findExpiredWasteTasks`: out na D; in pas als verlopen + volgende `out`-dag begonnen; opeenvolgende dagen | — | tick di 07:46 / wo / do | — |
| 211 | reminder alleen voor `notify_reminders`; nooit deadline/overdue voor afvaltaken | — | Jurgen/Ellen wel, Lynn (uit) niet, Kai (uitgezet) niet; Lynn aan → wel | — |
| 212 | alle builders: grep op postcode, nummer, bagId en namen = 0 | — | meldingen, push-payload (spy), titels, completions en console bevatten geen fixture-adres | — |
| 213 | — | `disable_waste_calendar`: rij weg, open afvaltaken weg, done/skipped blijven; tweede keer 0 | daarna tick: fetch-spy 0, geen afvaltaken; lid: `enabled = false` | bevestigen en annuleren |
| 214 | — | `waste_save` met een ander adres: open weg, done blijft | nooit twee adressen; ongeldig nieuw adres → oude blijft | — |
| 215 | — | `waste_sync`/`waste_save`/`disable` raken geen taak met `waste_direction is null` (reeks "Afvalcontainer buiten zetten" + losse taak) | idem | — |
| 216 | — | `delete_household` → `waste_calendars` en afvaltaken weg; ander huishouden intact | — | — |
| 217 | — | — | — | de hele UC-13/14/15-flow in de oude UI + **Live-rooktest Jurgen** |
| 218 | source: URL-host = constante, pad alleen postcode-nummer of bagId, headers alleen Accept/UA, `redirect: 'error'`, override alleen loopback | — | fetch-spy over lookup, confirm, sync en retry | — |
| 219 | — | insert met `waste_direction` door lid en beheerder → 42501 (policy én guard), ook met `members_can_create_tasks` uit; systeem-insert lukt met maker `null` | — | — |

Daarnaast:
- regressie op bestaande suites (`30_wp2a`, privacy-schema: geen nieuwe persoonskolommen buiten `waste_calendars`);
- `route.test.ts` van de tick: nieuwe stap in het rapport.

### 18.16 Uitrol (live op `main`, oude UI)

| # | Stap | Controle |
| --- | --- | --- |
| U0 | Voorwaarde: WP3 live en afgerond. De fixture-probe (§18.1.6) is gedaan, echte fixtures staan in de repo en de beslissingen staan in `DECISIONS.md`. `robots.txt` en voorwaarden zijn niet in de weg | anders stoppen en naar Jurgen |
| U1 | Lokaal groen: `test:db` (met `70_afval.sql`, `gelijktijdig.sh`), vitest, integratie, E2E (oude UI + stub) | alles groen |
| U2 | `…_320`, dan `…_330` op live via `apply_migration` (D-040). Additief: de huidige productiecode blijft werken | beveiligingsadvies: nieuwe RPC's alleen met eigen check of alleen service role; `waste_calendars` RLS aan; L4-controle op `net.*` (D-042) |
| U3 | Push naar `main` (Vercel, `fra1`) | `/api/status` met Bearer; tick-antwoord 200 met `waste.calendars = 0` |
| U4 | Rooktest met Jurgen (AC-217): adres invoeren → "Klopt dit?" → aanzetten; ophaaldagen vergelijken met de site; taken op Vandaag en Kalender; de volgende dag "Bijgewerkt vandaag" en de herinnering om 21:00 | akkoord van Jurgen in PROGRESS |
| U5 | Eén keer Jurgen eraan herinneren zijn handmatige reeks te stoppen (BR-57, V-56) | in PROGRESS |
| U6 | `main` → `v2-ui` mergen; de UI-onderdelen uit §18.14 komen in WP5–WP8 | — |
| U7 | Succescriteria (PRODUCT_SPEC §11): alleen-lezen-query's op dag 30 en 90 (dubbele sleutels = 0 door de constraint; aantal "te laat" bij `out`; storingen = meldingen `waste_sync_failed`) | resultaat in PROGRESS |

**Terugrollen:** Vercel Instant Rollback. De database is compatibel: de oude code negeert de kolommen, de guard blijft afvaltaken beschermen en open afvaltaken blijven staan zonder bijwerking. Volledig uitzetten kan met `disable_waste_calendar` via de UI of een eenmalige aanroep.

### 18.17 Afwijkingen van r1, rechtgetrokken

| # | r1 | Nu |
| --- | --- | --- |
| 1 | `external_key` per bak | `tasks_waste_key (household_id, waste_pickup_date, waste_direction)`; één taak per dag en richting; open taken worden hernoemd als de bakken veranderen (§18.3.2, §18.8.2) |
| 2 | adres leesbaar voor leden (`is_member`) | `waste_calendars` alleen `is_admin`; gezinsleden krijgen alleen `waste_calendar_enabled()` (§18.5.1) |
| 3 | bron onbereikbaar → adres toch bewaren (`bag_id` leeg) | niets bewaren; `bag_id` en `last_success_at` zijn `not null` (§18.3.1, §18.6) |
| 4 | leeg-bewaking per bak | alleen alle drie samen leeg in het venster; één bak leeg = normaal verwerken (§18.8.4) |
| 5 | maker leeg = beheerder mag verwijderen; zacht verwijderen | niemand wijzigt, verplaatst, verwijdert of zet om: guard + policies + `delete_task` + UI; het systeem verwijdert hard, alleen open taken (§18.5) |
| 6 | geen 18:00, geen storingstype, geen automatisch overslaan, deadline/overdue niet uit | §18.4.2, §18.8.6, §18.9 |
| 7 | cachetabel `waste_pickups` | `jsonb`-kolom (versimpeltoets, §18.3.1) |
| 8 | bij een storing "volgende dag opnieuw" | na een mislukte poging elk uur; de 48-uursgrens wordt zo haalbaar (§18.8.3) |
| UX 1–5 | — | niets bewaren bij een storing; namen met "bak"; eigen tweede regel in de herinnering; Binnenkort vóór 12:00 in de oude UI (selector, alleen afval); nieuw meldingstype + "Opnieuw proberen" ≤ 1/min op de server |

### 18.18 Versimpeltoets

| Onderdeel | Eenvoudigste variant die even betrouwbaar is | Gekozen? Waarom |
| --- | --- | --- |
| Ophaaldagen bewaren | direct uit de bron plannen, zonder bewaren | **Nee.** Bij een storing moeten de bekende dagen blijven gelden (BR-52), en plannen moet deterministisch en testbaar zijn. Wel de kleinste vorm: één `jsonb`-kolom in plaats van een tabel |
| Aparte cronjob of route voor ophalen | stap in de bestaande tick | **Ja.** Geen extra geheim of endpoint; het vangnet dekt het mee |
| Lock tegen dubbele ophaling | voorwaardelijke update op `last_attempt_at` | **Ja.** Het is tegelijk lease en rate limit van "Opnieuw proberen" |
| Plannen | in SQL | **Nee.** TS (puur) plant, één RPC past atomisch toe, `version` beschermt tegen verouderde plannen |
| Vlag voor gezinsleden | kolom op `households` | **Nee.** Afgeleide functie: niets dubbel opslaan, geen extra guard |
| Doorwerking van overslaan | in de service | **Nee.** Trigger: dekt REST, wachtrij en actions |
| Verbod op wijzigen | alleen UI + service | **Nee.** De DB-guard is de grens (fouten hierin zijn autorisatiefouten); UI en service geven alleen een nette ervaring |
| Herinneringstijden | `scheduled_time` + `reminder_minutes_before` hergebruiken | **Nee.** Eigen pure functie: een eigen tweede regel, 18:00 zonder geplande tijd, en in één tak geen deadline/verlopen |
| Bakken op de taak | afleiden uit de naam | **Nee.** Kolom `waste_streams`: hernoemen, meervoud in de herinnering en een naam die altijd klopt |
| Storing één keer melden | kolom "melding verstuurd" | **Nee.** Dedupe-sleutel op `last_success_at`: bestaand mechanisme |
| Eén of twee migraties | één | **Twee.** De enumwaarde moet eerst gecommit zijn |
| Endpoints | alleen C met vaste id's | **Nee.** B + C: id's zijn ongedocumenteerd en kunnen wijzigen |
| Rate limit op lookup bij het instellen | server-limiter | **Nee** (zie vereenvoudigingen): alleen beheerders, vaste host, 3–4 GET's per klik |

---

# (B) Regel voor de tabel in §15 (na WP3)

| **WP3b — Afvalkalender (W-03), live op `main` in de oude UI** | **Eerst de fixture-probe** (§18.1.6; bij `robots.txt` of voorwaarden die het uitsluiten: stoppen en naar Jurgen). Migraties `…_320_afval_meldingstype` en `…_330_afvalkalender` (§18.3–18.7): `waste_calendars` (admin-RLS), drie `tasks`-kolommen + unieke sleutel, guard, policies, `delete_task`, overslaan-trigger, RPC's `waste_save`/`waste_sync`/`disable_waste_calendar`/`waste_calendar_enabled`. `src/domain/waste/*` (adres, bakken, plan, verlopen, gezondheid, meldingen), `src/server/waste/*` (bron met allowlist, zod, limieten), `src/server/system/waste/sync.ts` (opslaan, bijwerken, tickstap "afval"), `actions/waste.ts` (4 actions). Tick: nieuwe stap tussen overslaan en meldingen; `wasteReminder` in plaats van `taskMessages` voor afvaltaken; `recipientsFor` met `waste_sync_failed` voor beheerders. Oude UI volgens §18.14 (instellingensectie A–J, taakrij, detail, Binnenkort vóór 12:00, slepen uit, meldingslabel). Tests volgens §18.15, stubserver voor E2E. Uitrol U0–U5 | **WP3** (tick elke 15 min, pg_net voor de probe). Niet WP4+ | BR-47…BR-59, UC-13…UC-15, AC-183…AC-219, V-41…V-57 | geen formeel CP. Rook-screenshots van de oude UI (instellingen A, C, G, H, J; Vandaag met buiten/binnen; detail) in `docs/screenshots/wp3b/`, zelf bekeken (zoals WP2a); de visuele controle van UX §13 komt bij CP2–CP4 op `v2-ui` | code, test-writer, **security** (externe bron, SSRF/allowlist, adres = persoonsgegeven, nieuwe RLS/guard/RPC's), **performance** (tickduur met en zonder ophalen); rooktest Jurgen (AC-217) |

---

# (C) Korte aanvullingen in bestaande secties van TECHNICAL_DESIGN

- **§3.1 (tabel):**
  - rij `waste_calendars` ✚ → "zie §18.3.1; cascade met het huishouden";
  - bij `tasks` ✱ → "✚ `waste_pickup_date`, `waste_direction`, `waste_streams`; ✚ `unique (household_id, waste_pickup_date, waste_direction)`; zie §18.3.2";
  - bij `notifications` ✱ → "type ✚ `waste_sync_failed`".
- **§3.2 (migraties):** rijen `…_320_afval_meldingstype.sql` en `…_330_afvalkalender.sql`, WP3b, niet-destructief, "zie §18.3.4".
- **§5.2 (tabel), rijen erbij:**
  - "Afvalkalender beheren en adres lezen: beheerder ja, gezinslid nee, uitgezet nee → `waste_calendars` select `is_admin`, geen schrijfpolicies, RPC `disable_waste_calendar`, actions `requireAdmin` (§18.5.1)";
  - "Afvaltaak wijzigen, verplaatsen, verwijderen, omzetten: niemand → guard, policies, `delete_task` (§18.5.2–18.5.4)";
  - "Afvaltaak status (afvinken, bezig, overslaan): ieder actief lid → bestaande update-policy + trigger `waste_skip_cascade` (§18.5.5)".
- **§5.3, "Toegestane systeemhandelingen", punt 5:** "`system/waste/sync.ts`: opvragen bij de gemeente, `waste_save` na `requireAdmin` + hercontrole in de RPC, `waste_sync` (alleen afvaltaken: invoegen, hernoemen of verwijderen als ze open zijn), afvaltaken laten vervallen (BR-54), storingsmelding via de dispatcher (§18.8.6)".
- **§6.5:** het antwoord van de tick krijgt `waste` (alleen tellingen, §18.8.6).
- **§8 (tabel):** rij "✚ `waste/*` → zie §18.2"; bij `reminders.ts`: "`recipientsFor` kent `waste_sync_failed` (actieve beheerders, los van voorkeuren)".
- **§10 (tabel), rij erbij:** "Huisvuilkalender Den Haag (Opzet, onofficieel) | 8 s per verzoek, 12 s totaal, `redirect: 'error'`, ≤ 1 MB | niets wijzigen, uur later opnieuw, na 48 u / aanhoudend leeg één melding aan beheerders (§18.8) | geen geheimen".
- **§11.3, stap 2b "afval"** tussen 2 en 3: "zie §18.8.6". In stap 3: "voor afvaltaken `wasteReminder` in plaats van `taskMessages`".
- **§13:** verwijzing "WP3b: zie §18.15".
- **§14:** verwijzing "Afvalkalender: zie §18.18".
- **§15, "Uitrol (V-36)":** "WP1, WP2a, WP2b, WP3 **en WP3b** gaan direct live op `main`, op de oude UI."

---

### Vragen voor Jurgen (beleid, kosten, verplichtingen)
- Geen.
- **Conditioneel:** blijkt bij de probe dat `robots.txt` of de gebruiksvoorwaarden van huisvuilkalender.denhaag.nl geautomatiseerd opvragen van `/rest/` uitsluiten, dan wordt het wel een beleidsvraag.
  - Opties: (a) toch gebruiken, met het risico van blokkade of een verzoek van de gemeente; (b) de gemeente om toestemming vragen; (c) terug naar optie A (gewone terugkerende taken).
  - Voorstel: dan (b), en tot die tijd (c).

### Vragen en punten voor de hoofdsessie (geen Jurgen-vragen)
1. **Route voor de fixture-probe (r1 punt 9, V-57):**
   - (a) Jurgen zet `huisvuilkalender.denhaag.nl` op de netwerk-allowlist van de ontwikkelomgeving. Dat heeft de voorkeur: geen uitgaand verzoek vanuit productie, en ook later bruikbaar;
   - (b) een eenmalige `net.http_get` vanuit het live Supabase-project met het openbare testadres 2591 BB 87 (geen persoonsgegeven).
   - Zonder een van beide geldt U0 niet en gaat WP3b niet live.
2. **Taaknamen in AC-193 en AC-195** (analist r2) gebruiken nog "Restafval binnenzetten" en "Restafval en papier binnenzetten". Het ontwerp volgt UX §13.3 ("Restafvalbak binnenzetten", "Restafval- en papierbak binnenzetten"), zoals opgedragen. De product-analyst trekt AC-193 en AC-195 gelijk vóór de freeze.
3. **Twee kleine UX-teksten zijn nieuw**, graag laten bevestigen door de product-designer:
   - `no_upcoming` (instellen eind december terwijl de nieuwe kalender nog niet online staat). Voorstel: "De gemeente heeft de ophaaldagen voor de komende weken nog niet online gezet. Er is niets opgeslagen. Probeer het later opnieuw.";
   - `too_soon` bij "Opnieuw proberen" ("Net geprobeerd. Probeer het over een minuut opnieuw.").
4. **Uitleg binnen de spec, ter controle door de plan-critic:**
   - een aanhoudend leeg antwoord = twee pogingen, minstens een uur uit elkaar (AC-205 "duurt voort");
   - binnenzetten vervalt pas als het al verlopen is én de dag van de volgende buitenzet-taak begonnen is. Dat voorkomt vervallen op de ophaaldag zelf bij twee opeenvolgende ophaaldagen.
5. **Bekende grens:** in de laatste dagen van december, als de kalender van het volgende jaar nog niet online staat, ontbreken de eerste januaritaken totdat het venster helemaal leeg is. Dan volgt de storingsmelding, meestal 1–2 dagen van tevoren. Een zeldzame ophaalpauze van meer dan 15 dagen voor alle drie de bakken zou een onterechte storingsmelding kunnen geven. Beide zijn bewust zo gelaten, want de spec-regel is "alle drie samen leeg".
6. **Verhuizen naar een adres met dezelfde ophaaldag, terwijl buitenzetten voor die dag al was afgevinkt:** dan komt er voor die dag geen nieuwe buitenzet-taak (de sleutel bestaat al en "afgevinkt blijft onaangetast"). Dat is een randgeval en het ontwerp laat het zo.
7. **Design system:** het icoon `recycle` in DS §7.10 (UX punt 6, visual-designer).

### Bewuste vereenvoudigingen
- Alleen Den Haag, een vaste host, en de drie bakken als constante in de code.
- De ophaaldagen staan als `jsonb` in één rij per huishouden, in plaats van in een aparte cachetabel.
- Ophalen gebeurt als stap in de bestaande tick: dagelijks, en elk uur na een mislukte poging. Er komt geen aparte cronjob en geen extra geheim.
- Één voorwaardelijke update op `last_attempt_at` dient tegelijk als lease tegen dubbel ophalen en als limiet van één keer per minuut voor "Opnieuw proberen".
- "Gezinsleden zien of het aan staat" is een afgeleide functie, geen opgeslagen vlag.
- "Storingsmelding al verstuurd" is afgeleid uit de bestaande dedupe-sleutel, niet uit een aparte kolom.
- Het opzoeken van een adres tijdens het instellen heeft geen rate limit op de server. Het kan alleen door een beheerder, alleen naar de vaste host, en kost 3–4 opvragingen per klik; in de browser zit een korte wachttijd tussen twee pogingen.
- Het UI-werk in de oude UI blijft beperkt tot afvaltaken: gewone taken veranderen niet van plek of gedrag.

### Status
**KLAAR VOOR PLANREVIEW**, met één voorwaarde voor de livegang (niet voor de freeze): de fixture-probe (punt 1), omdat de bron nog steeds niet live is gezien. Vóór de plan-critic moeten eerst AC-193 en AC-195 worden gelijkgetrokken (punt 2) en de twee teksten worden bevestigd (punt 3).

Relevante bestanden:
- /home/user/takenlijstje/docs/wijzigingen/W-03/solution-architect-r1.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-analyst-r2.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-designer-r1.md
- /home/user/takenlijstje/docs/TECHNICAL_DESIGN.md
- /home/user/takenlijstje/src/server/system/tick.ts
- /home/user/takenlijstje/src/domain/reminders.ts
- /home/user/takenlijstje/src/server/system/dispatcher.ts
- /home/user/takenlijstje/src/features/tasks/selectors.ts
- /home/user/takenlijstje/supabase/migrations/20260928000210_scope_contract.sql (laatste `guard_task_changes`)
- /home/user/takenlijstje/supabase/migrations/20260928000110_reeks_rpcs.sql (`delete_task`)
- /home/user/takenlijstje/supabase/migrations/20260928000100_rechten_actief_lid.sql (policies op `tasks`)

Bronnen:
- [Vercel — Configuring Maximum Duration](https://vercel.com/docs/functions/configuring-functions/duration)
- [Vercel — Higher defaults with Fluid compute](https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute)
- [Vercel — Limits](https://vercel.com/docs/limits)
- [PostgreSQL — ALTER TYPE](https://www.postgresql.org/docs/current/sql-altertype.html)
- [MDN — RequestInit.redirect](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#redirect)
- Bronnen uit r1 over het koppelcontract: HACS `hvcgroep_nl.py`, pippyn `opzet.py`, xirixiz `opzet.py`