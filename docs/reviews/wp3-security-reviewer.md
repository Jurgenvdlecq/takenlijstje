## Security-review: WP3 (planner, set-gebaseerde tick, push, retentie, undo-hercontrole)
Scope: `git diff c8eb5bb..HEAD -- src supabase package.json`. Gelezen: `src/server/system/tick.ts`, `dispatcher.ts`, `channels/web-push.ts`, `src/lib/push-endpoints.ts`, `src/lib/validation.ts`, `src/server/services/scheduling.ts`, `src/app/api/cron/tick/route.ts`, `src/server/cron-auth.ts`, `src/lib/server-env.ts`, `src/server/actions/notifications.ts` (push opslaan), `supabase/migrations/20260928000220_undo_hercontrole.sql`, `20260929000300_retentie.sql`, `supabase/ops/planner.sql`, `supabase/ops/restore_v2.sql` (diff), de RLS-policies van `push_subscriptions` (`_100`:434-450) en de tabeldefinitie (`20260927000100`:411-420), en `node_modules/web-push/src/web-push-lib.js` (v3.6.7).
Stack: standaard | npm audit: 0 hoog, 0 kritiek (0 in totaal)
Verplicht op grond van: niveau 2, met login, meerdere gebruikers, persoonsgegevens, service role en een extern geheim (CRON_SECRET, VAPID).

Beperking: live kon ik niet bereiken. Wat alleen live vast te stellen is, staat onder "Query's voor live". Een script uit de scratchpad draaien blokkeerde de poort. De parsertest hieronder heb ik inline (`node -e`, alleen lezen) gedaan, op Node 22.22.2.

### Toegangstabel
| Endpoint/action | Huidige gebruiker uit | Id's uit invoer | Eigendom gecontroleerd? |
|---|---|---|---|
| `GET/POST /api/cron/tick` (`route.ts`:14-25) | geen gebruiker: Bearer `CRON_SECRET` (`cron-auth.ts`:32-39) | geen | n.v.t. Een leeg geheim geeft altijd 401. De vergelijking is constant in tijd, alleen de lengte lekt (punt 4) |
| `runTick` → `planAllSeries`, `skipAllSuperseded`, `sendDueMessages` (service role) | systeem | geen invoer. Alle id's komen uit de database | `household_id` van nieuwe taken komt uit de reeksrij (`scheduling.ts`:32). Ontvangers per huishouden (`tick.ts`:140). Abonnementen op `user_id` van het eigen lid (`tick.ts`:213, 231). Ja |
| `savePushSubscriptionAction` (`notifications.ts`:50) | sessie (`requireMember`) | endpoint, keys | `user_id` uit de sessie. Endpoint via zod + allowlist, maar die is te omzeilen (punt 1) |
| REST `insert/update push_subscriptions` (RLS `_100`:439-450) | `auth.uid()` | endpoint, keys | `user_id = auth.uid()` en actief lid. Op het endpoint zelf alleen de DB-check `^https://` (punt 2). De zod-validatie wordt hier dus overgeslagen |
| RPC `public.run_purge()` | alleen `service_role` (`_300`:98-100) | geen | revoke voor public/anon/authenticated. Getest in `50_retentie.sql`:168-196 |
| `private.purge_expired_data(p_now)` | alleen postgres (en eigenaar) | `p_now` | niet aanroepbaar voor anon/authenticated (`_300`:98, getest) |
| RPC `undo_complete_task` (`_220`) | `auth.uid()` via `is_member` | task_id | ja, en nu ook opnieuw na de lock (`_220`:123-125) |
| pg_cron-taak `takenlijstje-tick` (`planner.sql`) | postgres | geen | URL en geheim worden per run uit Vault gelezen. Live leesrechten op `net.*`/`vault.*` controleren (punt 5) |

### Bevindingen

1. **[GEMIDDELD] De push-allowlist is te omzeilen door een verschil tussen twee URL-parsers.** `src/lib/push-endpoints.ts`:52-61, samen met `node_modules/web-push/src/web-push-lib.js`:274 en :348.
   - **Probleem:** `isAllowedPushEndpoint` leest de host met de WHATWG-parser (`new URL`). `web-push` bepaalt het doel met de oude `url.parse()`. Die knipt de hostnaam af bij tekens als `;`, `{`, `` ` ``, `'` en `"`. Aangetoond met `node -e`:
     - `https://evil.com;.fcm.googleapis.com/x` → allowlist: `evil.com;.fcm.googleapis.com` (TOEGESTAAN); web-push stuurt naar host `evil.com`, poort 443, audience `https://evil.com`;
     - `https://169.254.169.254;.fcm.googleapis.com/x` → web-push-host `169.254.169.254`;
     - `https://localhost;.push.apple.com/x` → `localhost`;
     - `https://10.0.0.1{.notify.windows.com/x` → `10.0.0.1`;
     - dezelfde omzeiling werkt met `` ` ``, `'` en `"`.

     `z.url()` accepteert deze adressen ook (gecontroleerd: `success: true`). De omzeiling werkt dus via de server action én via een directe REST-insert.
   - **Wat wel goed tegengehouden wordt:** hoofdletters (worden genormaliseerd), een punt aan het eind (geweigerd), `@`-trucs (username en backslash geven host `evil.com`, geweigerd), een IPv6-literal (geweigerd), een andere poort dan 443 (geweigerd), `%2f`/`%00` (ongeldig).
   - **Misbruikscenario:** iedereen kan zich registreren en een eigen huishouden maken. Zo iemand zet een abonnement met zo'n endpoint en vinkt een eigen taak af, of zet een herinnering. De server (Vercel, service role) doet dan op commando een POST naar een host naar keuze op poort 443, ook naar een intern IP of `localhost`. Het verzoek bevat:
     - de VAPID-JWT met `sub` = `VAPID_SUBJECT`, een e-mailadres;
     - de versleutelde payload.

     Er lekt geen data van andere huishoudens, want de payload is versleuteld met de eigen sleutels van de aanvaller. Maar de maatregel die in D-041 als "gebouwd" staat, werkt feitelijk niet. Dit is precies het SSRF-gat uit de WP1-schuld.
   - **Verbetering:**
     - weiger in `isAllowedPushEndpoint` elke hostnaam die niet voldoet aan `/^[a-z0-9.-]+$/`;
     - eis daarnaast dat `url.parse(endpoint).hostname === new URL(endpoint).hostname` en `url.parse(endpoint).port` leeg of `443` is. Zo is een verschil tussen de parsers per definitie uitgesloten;
     - geef bij voorkeur `new URL(endpoint).href` door aan `sendNotification`;
     - voeg deze gevallen toe aan `web-push.test.ts`:87-90 en aan de validatietest.
   - **Op live:** controleer met query L9 of er al afwijkende endpoints staan.

2. **[LAAG] De database dwingt de allowlist niet af.** `supabase/migrations/20260927000100_*.sql`:414 (`check (endpoint ~ '^https://')`) en de RLS-insert/update in `_100`:439-450.
   - **Probleem:** via REST schrijft een actief lid rechtstreeks een willekeurig https-endpoint weg. Alleen de controle bij het versturen houdt het tegen, en die is nu lek (punt 1).
   - **Verbetering (defense-in-depth):** een CHECK met een strikte regex, bijvoorbeeld `endpoint ~ '^https://([a-z0-9-]+\.)*(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)(:443)?/[^\s]*$'`. Daarmee zijn ook `;`/`{`/quote in de authority uitgesloten. Voeg hem toe als `not valid` en valideer hem na query L9.

3. **[LAAG] `https://…` is niet afgedwongen voor de tick-URL in Vault.** `supabase/ops/planner.sql`:169-171.
   - **Probleem:** als `takenlijstje_tick_url` per ongeluk `http://` of een verkeerd domein bevat, gaat het Bearer-geheim onversleuteld of naar een ander adres.
   - **Verbetering:** in het cron-commando alleen sturen als de URL met `https://` begint, en live controleren met query L6.

4. **[LAAG] De vergelijking van het cron-geheim lekt de lengte.** `src/server/cron-auth.ts`:38.
   - **Probleem:** `given.length === expected.length` geeft vóór `timingSafeEqual` een snellere weigering bij een verkeerde lengte. Dat is theoretisch en praktisch nauwelijks te benutten.
   - **Verbetering:** hash beide met SHA-256 en vergelijk de digests met `timingSafeEqual`. Controleer ook dat `CRON_SECRET` ≥ 32 willekeurige bytes is (query L6 geeft de lengte, niet de waarde).
   - **Wel goed:** een leeg geheim geeft `false` (regel 34), er is geen fallback en de 401 lekt niets.

5. **[ONZEKER] Leesrechten op `net.http_request_queue`, `net._http_response`, `vault.decrypted_secrets` en `cron.*`.**
   - **Wat ik weet:** pg_net zet de header `Authorization: Bearer <geheim>` in `net.http_request_queue` tot het verzoek verwerkt is. Supabase heeft een event trigger (`grant_pg_net_access`) die bij het installeren USAGE op schema `net` en EXECUTE op `net.http_post/http_get` geeft aan onder andere anon en authenticated.
   - **Risico:** zolang schema `net` niet in de "Exposed schemas" van de API staat, kan een gebruiker er via PostgREST niet bij. Maar een SELECT-recht op de wachtrij, of een blootgesteld `net`-schema, zou het geheim lekken. Een EXECUTE voor anon op `http_post` is een SSRF-primitief als ooit een public-functie het doorgeeft.
   - **Nodig:** queries L2-L5 en L8 op live. Verwacht:
     - anon/authenticated zonder SELECT op `net.*`, `vault.*` en `cron.*`;
     - `vault.decrypted_secrets` alleen voor postgres (en eventueel service_role);
     - `net` niet in de exposed schemas.

     Is EXECUTE op `net.http_*` voor anon/authenticated aanwezig: aanbevolen revoke. Let op, de event trigger kan dat bij een extensie-update terugzetten. Leg dat vast in DECISIONS.

6. **[LAAG/ONZEKER] De extensies worden zonder schema aangemaakt.** `supabase/ops/planner.sql`:158-159.
   - **Probleem:** `create extension if not exists pg_cron; … pg_net;` zonder `with schema`. Supabase adviseert `pg_cron … with schema pg_catalog` en `pg_net … with schema extensions`. Anders kan de adviseur "extension in public" melden. Op V-04 stond: niet geïnstalleerd.
   - **Verbetering:** schema expliciet noemen, en op live controleren met query L1. Er is geen direct lek: de objecten zelf staan in `cron`/`net`.

7. **[LAAG] Het opruimen van huishoudens zonder leden is onomkeerbaar en alleen als telling zichtbaar.** `supabase/migrations/20260929000300_retentie.sql`:64-66.
   - **Wat klopt:** de keuze staat in D-041. Er is geen misbruik mogelijk: een gebruiker kan geen leden van een ander huishouden verwijderen (RLS), en `create_household` maakt huishouden en lid in één transactie (`_200`:389-429), dus er is geen race met de tick.
   - **Gevolg:** wordt het laatste account buiten de app om verwijderd, dan verdwijnt het hele huishouden binnen 15 minuten. Alleen de Supabase-platformback-up heeft het dan nog.
   - **Verbetering (optioneel):** de tick laat een aparte logregel achter als `households_without_members > 0` of `households_without_admin > 0`, zodat het opvalt.

Gecontroleerd per categorie:
- **A/B (wachtwoorden, sessies):** niet geraakt. Niets gevonden.
- **C (autorisatie):** de service role wordt alleen in `src/server/system/**` aangemaakt (ESLint `no-restricted-imports`; `planAllSeries`/`skipAllSuperseded` staan in `services/` maar krijgen de client alleen vanuit `tick.ts`, gecontroleerd met grep). `runTick` is alleen bereikbaar via de route met het geheim. Isolatie per huishouden in de tick is in orde. `skipAllSuperseded` werkt alleen open taken bij (`scheduling.ts`:233-241). `undo_complete_task` heeft de hercontrole na de lock (`_220`:122-125) en houdt via `create or replace` dezelfde ACL. Niets gevonden, buiten punt 1.
- **D (geheimen):** geen geheimen in de diff of de historie (alleen testwaarden `test-cron-geheim-…`). `.env*` staat in `.gitignore`. Vault levert URL en geheim per run. `cron.job.command` bevat geen geheim. Zie punten 3-5.
- **E (invoer):** zie 1 en 2. Geen raw SQL uit invoer.
- **F (extern):** push-time-out van 10 s en een budget van 45 s, een time-out van 55 s voor pg_net, en 404/410 ruimt op. Zie 1.
- **G (afhankelijkheden):** audit schoon. `web-push` 3.6.7 gebruikt de verouderde `url.parse` (oorzaak van punt 1).
- **H (informatielek):** het 500-antwoord bevat alleen tellingen en stapnamen. Gooit `createAdminClient` buiten een stap, dan geeft Next een generieke 500 zonder details. De 401 is generiek. Niets gevonden.
- **I (AVG):**
  - de logregels bevatten alleen tellingen, statuscodes en stapnamen (`tick.ts`:70, :90-93; `web-push.ts`:72; `dispatcher.ts`:211; `scheduling.ts`:180);
  - de pushinhoud is end-to-end versleuteld voor de pushdienst;
  - de bewaartermijnen volgen TD §3.4 en D-040.

  Niets gevonden.
- **J:** niet van toepassing (niveau 2).
- **`restore_v2.sql`:** de `pg_temp.lid/gebruiker`-filters zetten geen verwijderd account terug. Er zijn revokes voor anon op de drie opnieuw aangemaakte tabellen. De WP2b-punten 3 en 4 zijn opgelost (in de code gelezen).

### Query's voor live (alleen lezen, voor de hoofdsessie)
```sql
-- L1 extensies en hun schema (verwacht: pg_cron in pg_catalog, pg_net in extensions; niet in public)
select extname, extnamespace::regnamespace, extversion from pg_extension where extname in ('pg_cron','pg_net','supabase_vault');

-- L2 tabelrechten op net/vault/cron (verwacht: geen rijen voor anon, authenticated, authenticator of PUBLIC ('-'))
select c.oid::regclass as tabel, a.grantee::regrole as rol, a.privilege_type
from pg_class c cross join lateral aclexplode(c.relacl) a
where c.relnamespace in ('net'::regnamespace, 'vault'::regnamespace, 'cron'::regnamespace)
order by 1, 2, 3;

-- L3 per rol expliciet (verwacht: alles false behalve eventueel service_role op vault)
select r,
  has_schema_privilege(r, 'net', 'USAGE') net_usage,
  has_table_privilege(r, 'net.http_request_queue', 'SELECT') queue_select,
  has_table_privilege(r, 'net._http_response', 'SELECT') response_select,
  has_schema_privilege(r, 'vault', 'USAGE') vault_usage,
  has_table_privilege(r, 'vault.decrypted_secrets', 'SELECT') decrypted_select,
  has_table_privilege(r, 'cron.job', 'SELECT') cron_job_select
from unnest(array['anon','authenticated','authenticator','service_role']) r;

-- L4 wie mag net.http_* aanroepen (verwacht bij voorkeur: anon/authenticated false)
select p.oid::regprocedure, p.prosecdef,
  has_function_privilege('anon', p.oid, 'EXECUTE') anon,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') authenticated
from pg_proc p where p.pronamespace = 'net'::regnamespace order by 1;

-- L5 blootgestelde schema's van de API (verwacht: geen net, vault, cron, private); ook dashboard › API › Exposed schemas bekijken
select rolname, rolconfig from pg_roles where rolname = 'authenticator';
select evtname, evtfoid::regproc, evtenabled from pg_event_trigger order by 1;

-- L6 Vault-inhoud zonder waarden te tonen (verwacht: url https, geheim ≥ 32 tekens)
select name, length(decrypted_secret) as lengte,
       case when name = 'takenlijstje_tick_url' then decrypted_secret like 'https://%' end as is_https
from vault.decrypted_secrets where name in ('takenlijstje_tick_url', 'takenlijstje_cron_secret');

-- L7 cron-taak en runs (verwacht: 1 taak, */15, active, username postgres, geen geheim in command; ≥ 8 runs in 2 uur; status_code 200)
select jobid, jobname, schedule, active, username, command ~* 'bearer\s+[a-z0-9]{8}' as geheim_in_command from cron.job;
select status, count(*) from cron.job_run_details where start_time > now() - interval '2 hours' group by 1;
select status_code, count(*) from net._http_response where created > now() - interval '2 hours' group by 1;

-- L8 wachtrij leeg na verwerking (verwacht 0 of heel klein)
select count(*) from net.http_request_queue;

-- L9 pushabonnementen die niet aan een strikte allowlist voldoen (verwacht afwijkend = 0)
select count(*) as totaal,
       count(*) filter (where endpoint !~ '^https://([a-z0-9-]+\.)*(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)(:443)?/[^\s;{}`''"]*$') as afwijkend
from public.push_subscriptions;

-- L10 rechten opruimen en undo (verwacht: run_purge alleen service_role; purge_expired_data niet voor anon/authenticated/service_role? (service_role mag, is vertrouwd); beide security definer met search_path="")
select p.oid::regprocedure, p.prosecdef, p.proconfig,
  has_function_privilege('anon', p.oid, 'EXECUTE') anon,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') authenticated,
  has_function_privilege('service_role', p.oid, 'EXECUTE') service_role
from pg_proc p
where p.oid in ('public.run_purge()'::regprocedure, 'private.purge_expired_data(timestamptz)'::regprocedure, 'public.undo_complete_task(uuid)'::regprocedure);

-- L11 migraties _220 en _300 toegepast
select version, name from supabase_migrations.schema_migrations order by version desc limit 5;
```
Daarnaast, geen SQL: draai de Supabase-beveiligingsadviseur (`get_advisors` security) via de koppeling. Verwacht: `run_purge` niet als aanroepbaar voor anon/authenticated, en geen "extension in public".

### Wat goed is
- De Bearer-controle weigert een leeg geheim, vergelijkt in constante tijd en valt nooit terug. Het 500-antwoord bevat alleen tellingen en stapnamen (`route.ts`:21).
- Het geheim en de URL staan alleen in Vault en worden per run gelezen. Er staat niets in de repository, in `cron.job.command` of in migraties.
- `run_purge`/`purge_expired_data`: security definer met `search_path = ''`, revoke voor public/anon/authenticated, en getest als authenticated, anon en service_role (`50_retentie.sql`:168-196).
- Er is een allowlist-controle bij het versturen (niet alleen bij opslaan), en een niet-toegestaan abonnement wordt verwijderd (`web-push.ts`:49-52). Dat is het juiste ontwerp; alleen de parser moet strakker (punt 1).
- `undo_complete_task` heeft de hercontrole na de lock weer terug (`_220`:122-125).

### Doorgeven aan test-writer
- Allowlist-regressie (unit, voor `isAllowedPushEndpoint` en `pushSubscriptionInput`): `https://evil.com;.fcm.googleapis.com/x`, `https://evil.com{.fcm.googleapis.com/x`, `` https://evil.com`.fcm.googleapis.com/x ``, `https://evil.com'.fcm.googleapis.com/x`, `https://evil.com".fcm.googleapis.com/x`, `https://169.254.169.254;.fcm.googleapis.com/x` en `https://localhost;.push.apple.com/x` worden allemaal geweigerd. Plus een eigenschapstest: voor elk toegestaan endpoint geldt `url.parse(e).hostname === new URL(e).hostname`.
- `sendPush` met zo'n endpoint roept `webpush.sendNotification` niet aan en verwijdert de rij.
- DB-test (na punt 2): een REST-insert met een endpoint buiten de allowlist geeft 23514.
- Route: `CRON_SECRET` leeg → ook een verzoek met `Bearer ` (leeg) geeft 401. Een geheim met de juiste lengte maar de verkeerde inhoud geeft 401.

### Vragen voor de hoofdsessie
- Punt 5: als L4 laat zien dat anon/authenticated EXECUTE hebben op `net.http_post`, dan intrekken (met het risico dat de Supabase-event-trigger het bij een extensie-update terugzet)? Dat is een uitvoeringskeuze; vastleggen in DECISIONS.
- Staat `VAPID_SUBJECT` op een persoonlijk e-mailadres? Dat gaat mee in elke push, en bij punt 1 ook naar een willekeurige host. Een functioneel adres heeft de voorkeur. Dat is een beleidskeuze voor Jurgen als het nu zijn eigen adres is.

### Conclusie
**NO-GO.** De push-allowlist (D-041, schuld uit WP1) is aantoonbaar te omzeilen (punt 1, GEMIDDELD). Daardoor kan iedereen met een account de server naar een willekeurige host op poort 443 laten posten, ook naar interne adressen. Dit mag op niveau 2 niet openblijven zonder besluit van Jurgen. Na herstel van punt 1 (liefst met punt 2), een schone uitkomst van L2-L5 en L9 op live, en de regressietests hierboven, verwacht ik GO. Er is geen BLOKKEREND punt gevonden.

Relevante bestanden:
- /home/user/takenlijstje/src/lib/push-endpoints.ts
- /home/user/takenlijstje/src/server/system/channels/web-push.ts
- /home/user/takenlijstje/src/server/cron-auth.ts
- /home/user/takenlijstje/supabase/ops/planner.sql
- /home/user/takenlijstje/supabase/migrations/20260929000300_retentie.sql
- /home/user/takenlijstje/supabase/migrations/20260928000220_undo_hercontrole.sql
- /home/user/takenlijstje/node_modules/web-push/src/web-push-lib.js (regels 274 en 348)
