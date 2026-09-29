## Security-herreview: WP3 (herstel na NO-GO, D-042/D-043)
Scope: `git diff e0d70fa..HEAD -- src supabase vercel.json`. Gelezen:
- `src/lib/push-endpoints.ts`, `src/lib/validation.ts`:154-157
- `src/server/system/channels/web-push.ts`, `src/server/cron-auth.ts`, `src/app/api/cron/tick/route.ts`
- `src/server/actions/tasks.ts`:45-78, `src/server/system/dispatcher.ts`:39-96
- `src/server/system/tick.ts` (diff), `src/server/services/scheduling.ts` (diff)
- `supabase/migrations/20260929000310_push_endpoint_check.sql`, `supabase/ops/planner.sql`, `vercel.json`
- `supabase/tests/60_push_endpoint.sql`, `docs/reviews/wp3-test-writer-r2.md`

Stack: standaard | npm audit: 0 hoog, 0 kritiek (0 in totaal)
Verplicht op grond van: niveau 2. Er is login, er zijn meerdere huishoudens, er is een service role en er zijn externe geheimen (CRON_SECRET, VAPID).

Werkwijze:
- **Parsertest:** met `node -e`, alleen lezen, Node 22. Het patroon heb ik rechtstreeks uit `push-endpoints.ts` geladen, dus niet overgetypt.
- **DB-check:** met een alleen-lezen SELECT op de lokale `takenlijstje_test` (PG 16, UTF8). Ik heb daar ook gecontroleerd dat de opgeslagen CHECK-definitie gelijk is aan het patroon dat ik testte.

### Toegangstabel (alleen wat in het herstel veranderde)
| Endpoint/action | Huidige gebruiker uit | Id's uit invoer | Eigendom gecontroleerd? |
|---|---|---|---|
| `GET/POST /api/cron/tick` | geen gebruiker: Bearer-geheim, vergeleken via SHA-256 + `timingSafeEqual` (`cron-auth.ts`:13-18) | geen | n.v.t. Een leeg geheim geeft `false` (r.15) |
| `savePushSubscriptionAction` | sessie (`requireMember`) | endpoint, keys | `user_id` komt uit de sessie. Het endpoint gaat door zod + `isAllowedPushEndpoint` (`validation.ts`:155) en daarna door de DB-CHECK |
| REST insert/update `push_subscriptions` | `auth.uid()` (RLS) | endpoint | Ja, nu ook via de CHECK `push_subscriptions_endpoint_allowlist` (`_310`:15-19). Getest met 23514, ook bij een update |
| `completeTaskAction` → `after(notify)` (`tasks.ts`:63-73) | sessie | taskId (eigendom via RPC `complete_task`) | Ja. `householdId` komt uit de sessie. `notify` vangt zelf fouten af en logt alleen type en foutcode (`dispatcher.ts`:96) |
| pg_cron `takenlijstje-tick` | postgres | geen | URL en geheim komen uit Vault. Er wordt alleen verstuurd als de URL met `https://` begint (`planner.sql`:44) |

### Controle van de eerdere punten
1. **Punt 1 (GEMIDDELD, allowlist te omzeilen): OPGELOST.**
   - **De fix:** `PUSH_ENDPOINT_PATTERN` (`push-endpoints.ts`:20) werkt op de ruwe tekst. De host bevat alleen `[a-z0-9.-]`, direct gevolgd door `(:443)?/`. Daarna volgt nog de WHATWG-controle (r.24-28), en `sendPush` geeft `new URL(endpoint).href` door (`web-push.ts`:62).
   - **Mijn omzeilpogingen (±50 invoeren), allemaal geweigerd:**
     - `;` `{` `` ` `` `'` `"` en `\` in de host;
     - `user:pass@` en `fcm…:443@evil.com`;
     - `:0443` en `:443:443`;
     - een punt aan het eind, en `a..fcm`;
     - hoofdletters, en `HTTPS://`;
     - fullwidth-punt (U+FF0E), ideografische punt (U+3002), `ö` en Cyrillisch (IDN);
     - `%65vil` in de host;
     - `https:/`, `https:\\`, een spatie ervoor, en tab/CR/LF (ook als header-injectie `\r\nHost:`);
     - `fcm.googleapis.com.evil.com`.
   - **Wat wordt toegestaan, en waarom dat veilig is:** `@`, `//`, `%2f`, `#`, `?`, `|` en `^` alleen in het pad, en subdomeinen als `127.0.0.1.fcm.googleapis.com`. Voor elk toegestaan geval geven `url.parse(href)`, `url.parse(raw)` en `new URL` dezelfde host, poort leeg of 443. Een subdomein van een pushdienst is DNS van Google, Mozilla, Apple of Microsoft, dus geen SSRF.
   - **ReDoS:** 200.000 tekens in vijf lastige vormen (`a.`-herhaling, `-.`, herhaalde suffixen, een lang pad dat eindigt op een spatie) kosten hooguit 13 ms. Het patroon is lineair, en `isAllowedPushEndpoint` weigert bovendien alles boven 1000 tekens vóór de regex.
   - **web-push 3.6.7:** volgt geen redirects en gebruikt geen proxy zonder optie. De `timeout` wordt doorgegeven (`web-push-lib.js`:222).
2. **Punt 2 (LAAG, geen DB-afdwinging): OPGELOST.**
   - De CHECK in `_310` is gelijk aan het TS-patroon. Ik heb dat nagekeken in de definitie in de test-DB via `pg_get_constraintdef`.
   - De SQL-escapes kloppen, empirisch nagekeken op PG 16 met `standard_conforming_strings = on`:
     - `''` wordt één `'`;
     - `\\` is in een ARE-bracket een letterlijke backslash;
     - de backtick is letterlijk.
   - In het pad worden geweigerd: backtick, `'`, `"`, `\`, `<`, `>`, `;`, tab, LF en VT.
   - Omdat de constraint niet `not valid` is, wordt hij bij het toepassen meteen tegen de bestaande rijen gecontroleerd. De voorafgaande delete ruimt afwijkende rijen op (op live: 0).
3. **Punt 3 (https voor de tick-URL): OPGELOST** (`planner.sql`:44). Bij een niet-https-URL gebeurt niets. Dat valt op via AC-063 (geen runs met een 200).
4. **Punt 4 (lengtelek): OPGELOST** (`cron-auth.ts`:6, 17). Een prefix, een aanvulling, de juiste lengte met verkeerde inhoud, een leeg geheim en `bearer` in kleine letters geven allemaal 401 (`route.test.ts`, volgens het testrapport).
5. **Punt 5 (net/vault-rechten): DEELS.** Er staat nu `revoke execute on all functions in schema net from anon, authenticated` (`planner.sql`:23). Live nog te bevestigen (zie hieronder), en zie nieuw punt B.
6. **Punt 6 (extensieschema's): OPGELOST** (`planner.sql`:18-19).
7. **Punt 7 (opgeruimde huishoudens niet zichtbaar): OPGELOST** (`tick.ts`:88-92). De logregel bevat alleen tellingen, dus geen persoonsgegevens.

Ook bekeken (D-043), niets gevonden:
- **`after()`** (`tasks.ts`:63): het huishouden komt uit de sessie. De melding bevat geen naam van wie afvinkte (V-21). Fouten worden in `notify` afgevangen.
- **Blokken van 200** (`scheduling.ts`, `tick.ts`): de filters `status`, `deleted_at` en `generated_until` blijven per blok staan. Er is geen verbreding van de update.
- **Time-out per push:** tussen 1 s en 10 s.
- **`vercel.json` `regions: ["fra1"]`:** gunstig voor de AVG, want de verwerking blijft in de EU. De dagelijkse Vercel-cron gebruikt hetzelfde Bearer-geheim.

### Nieuwe bevindingen
A. **[LAAG] De DB-CHECK en het TS-patroon verschillen bij Unicode-witruimte en stuurtekens in het pad.**
   - **Waar:** `_310`:18 (`[:space:]`) tegenover `push-endpoints.ts`:20 (`\s`).
   - **Gemeten op PG 16:**
     - NBSP (U+00A0) en U+FEFF: de DB accepteert, TS weigert;
     - U+2028: beide weigeren;
     - `\x01`: beide accepteren (`new URL().href` codeert dit naar `%01`).
   - **Gevolg:** een rij die via REST wordt ingevoegd, kan de CHECK passeren maar bij het versturen geweigerd en verwijderd worden. De afwijking zit alleen in het pad, nooit in de host, en TS is de strengere kant. Er is dus geen omzeiling. Het commentaar "gelijk aan de CHECK" klopt alleen niet helemaal. Dit gedrag hangt af van de locale, en die kan op Supabase anders zijn.
   - **Verbetering (optioneel):** beperk het pad aan beide kanten tot zichtbare ASCII, bijvoorbeeld `[!#-&(-:=?-[\]-_a-z|~]` of eenvoudiger `[\x21-\x7e]` minus de uitgesloten tekens. Neem NBSP, FEFF en `\x01` op in `60_push_endpoint.sql` en `push-endpoints.test.ts`.
B. **[LAAG] De revoke op `net` raakt PUBLIC niet.**
   - **Waar:** `planner.sql`:23 revoket van `anon, authenticated`, maar niet van `public`. Functies die pg_net zelf aanmaakt en die niet onder `grant_pg_net_access` vallen (bijvoorbeeld `net.http_delete`, afhankelijk van de versie), kunnen via de standaard PUBLIC-EXECUTE nog aanroepbaar zijn.
   - **Risico:** dit is alleen uit te buiten als `net` via de API is blootgesteld of via een public-functie wordt doorgegeven. Allebei is nu niet het geval, maar live te bevestigen.
   - **Verbetering:** `revoke execute on all functions in schema net from public, anon, authenticated;` en controleer met L4. `has_function_privilege` telt PUBLIC mee.
C. **[LAAG] Er is geen DB-test die de SQL-escapes in het pad controleert.**
   - **Waar:** `supabase/tests/60_push_endpoint.sql`:64-81 test backtick, quote en backslash alleen in de host. Daar vallen ze al af op `[a-z0-9-]`.
   - **Gevolg:** een fout in de escape van de padklasse (bijvoorbeeld `\\` wordt `\`) zou door de tests glippen. Ik heb het nu handmatig vastgesteld: het klopt.
   - **Verbetering:** voeg `https://fcm.googleapis.com/a`b`, `…/a''b`, `…/a"b`, `E'…/a\\b'`, `…/a<b` en `…/a>b` toe als 23514-gevallen.

Categorieën:
- **A/B (wachtwoorden, sessies):** niet geraakt.
- **C (autorisatie):** gecontroleerd, niets gevonden.
- **D (geheimen):** geen geheimen in de diff. De header wordt gehasht vergeleken. Vault verandert niet.
- **E (invoer):** zie A en C. Geen raw SQL uit invoer.
- **F (extern):** time-out en https in orde.
- **G (afhankelijkheden):** audit schoon.
- **H (informatielek):** 401 en 500 bevatten alleen tellingen. Niets gevonden.
- **I (AVG):** logregels bevatten alleen tellingen en codes. fra1 houdt de verwerking in de EU.
- **J:** niet van toepassing.

### Live-query's na het uitvoeren van planner.sql (alleen lezen)
```sql
-- L1 extensies: pg_cron in pg_catalog, pg_net in extensions
select extname, extnamespace::regnamespace from pg_extension where extname in ('pg_cron','pg_net');
-- L3 geen toegang tot wachtrij/antwoorden/vault/cron voor anon/authenticated (alles false)
select r, has_table_privilege(r,'net.http_request_queue','SELECT') q, has_table_privilege(r,'net._http_response','SELECT') resp,
  has_table_privilege(r,'vault.decrypted_secrets','SELECT') vault, has_table_privilege(r,'cron.job','SELECT') cron
from unnest(array['anon','authenticated','authenticator']) r;
-- L4 net-functies (verwacht: anon en authenticated overal false; telt PUBLIC mee)
select p.oid::regprocedure, has_function_privilege('anon',p.oid,'EXECUTE') anon, has_function_privilege('authenticated',p.oid,'EXECUTE') auth
from pg_proc p where p.pronamespace='net'::regnamespace order by 1;
-- L5 net/vault/cron/private niet blootgesteld (ook dashboard › API › Exposed schemas)
select rolconfig from pg_roles where rolname='authenticator';
-- L6 Vault: url https, geheim ≥ 32 tekens (geen waarden tonen)
select name, length(decrypted_secret), decrypted_secret like 'https://%' from vault.decrypted_secrets
where name in ('takenlijstje_tick_url','takenlijstje_cron_secret');
-- L7 taak en runs (1 taak, */15, active, postgres; runs succeeded; status_code 200)
select jobname, schedule, active, username from cron.job;
select status, count(*) from cron.job_run_details where start_time > now() - interval '2 hours' group by 1;
select status_code, count(*) from net._http_response where created > now() - interval '2 hours' group by 1;
-- L8 wachtrij leeg
select count(*) from net.http_request_queue;
-- L9 CHECK aanwezig en gevalideerd; migratie _310 toegepast
select conname, convalidated from pg_constraint where conname='push_subscriptions_endpoint_allowlist';
select version from supabase_migrations.schema_migrations where version >= '20260929000300' order by 1;
```
Daarnaast de Supabase-beveiligingsadviseur. Verwacht: geen "extension in public" en `run_purge` niet aanroepbaar voor anon/authenticated.

### Wat goed is
- De allowlist werkt op de ruwe tekst plus de WHATWG-controle, en `href` wordt doorgegeven. Een parserverschil is daarmee per constructie uitgesloten. Dit mag niet worden "vereenvoudigd" tot alleen `new URL`.
- De controle zit op drie plekken: zod bij het opslaan, de DB-CHECK voor REST, en opnieuw bij het versturen, met verwijderen van een afgewezen abonnement.
- Het cron-geheim wordt gehasht en in constante tijd vergeleken. Een leeg geheim wordt altijd geweigerd.
- De planner verstuurt alleen via https. Geheim en URL staan alleen in Vault.
- `after()` houdt het huishouden uit de sessie aan, en `notify` lekt geen details in de log.

### Doorgeven aan test-writer
- Punt C: 23514-gevallen voor backtick, `'`, `"`, `\`, `<` en `>` in het pad (`60_push_endpoint.sql`).
- Punt A: NBSP, U+FEFF en `\x01` in het pad. Leg het gedrag van TS en DB vast. Na een eventuele aanscherping moeten beide weigeren.
- Unit: een endpoint van 1001 tekens wordt vóór de regex geweigerd. Een subdomein als `127.0.0.1.fcm.googleapis.com` wordt geaccepteerd, met dezelfde host in `url.parse`. Dat legt vast dat dit bewust is.

### Vragen voor de hoofdsessie
- De vraag uit de vorige ronde staat nog open: gaat `VAPID_SUBJECT` naar een persoonlijk e-mailadres? Een functioneel adres heeft de voorkeur. Dat is een beleidskeuze voor Jurgen als het nu zijn eigen adres is.

### Conclusie
**GO.** Alle punten uit de vorige review zijn aantoonbaar opgelost. De allowlist hield stand tegen parserverschillen, IDN/Unicode, %-codering, tab/newline, zeer lange invoer en ReDoS. Er is geen BLOKKEREND of GEMIDDELD punt open. De drie LAAG-punten (A-C) horen in `docs/PROGRESS.md` (uitgesteld) of in een kleine herstelronde. Voorwaarde voor de live-status is een schone uitkomst van L3-L5 en L9 na het uitvoeren van `planner.sql`.

Relevante bestanden:
- /home/user/takenlijstje/src/lib/push-endpoints.ts
- /home/user/takenlijstje/src/server/system/channels/web-push.ts
- /home/user/takenlijstje/supabase/migrations/20260929000310_push_endpoint_check.sql
- /home/user/takenlijstje/supabase/tests/60_push_endpoint.sql
- /home/user/takenlijstje/src/server/cron-auth.ts
- /home/user/takenlijstje/supabase/ops/planner.sql
- /home/user/takenlijstje/src/server/actions/tasks.ts
- /home/user/takenlijstje/vercel.json
