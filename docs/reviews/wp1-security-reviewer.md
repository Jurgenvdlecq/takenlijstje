## Security-review: WP1 — Rechtenmodel en securityfixes (commit 0d453bc)

Scope: `git diff 8143fe5 0d453bc -- src supabase public eslint.config.mjs`. Daarnaast zijn alle bestaande policies, triggers en RPC's gelezen, ook de niet-aangepaste (migraties 000100 t/m 000400), plus `src/server/**`, `src/app/api/**`, `src/lib/supabase/**`, `src/lib/offline/**` en `public/sw.js`.
Stack: afwijkend van de standaard. De app gebruikt Supabase (RLS + PostgREST + RPC) in plaats van Prisma; categorie C is daarom vertaald naar policies, security-definer-functies en triggers.
npm audit: 0 hoog, 0 kritiek (ook met `--omit=dev`: 0 kwetsbaarheden).
Verplicht op grond van: niveau 2. De app heeft login, meerdere huishoudens, persoonsgegevens van minderjarigen en is publiek bereikbaar (TD §15: security verplicht bij WP1).

**Hoe getest:** de migraties op een tijdelijke database (inmiddels verwijderd), plus de test-writer-bestanden `10_rls_and_functions.sql` en `20_rechten_br.sql` uit de scratchpad. **Beide volledig groen.** De AC-028-bevinding van de test-writer is opgelost (D-014), net als de push-policy (D-015). Let op: de repo-suite `supabase/tests/run.sh` is op dit moment **rood** (10_ r.112), omdat de nieuwe testbestanden nog niet in `supabase/tests/` staan. De eigen aanvalsproeven zijn in dezelfde tijdelijke database uitgevoerd als `authenticated` met een eigen JWT-sub, zoals PostgREST dat doet.

### Toegangstabel

| Endpoint / action / RPC | Huidige gebruiker uit | Id's uit invoer | Eigendom gecontroleerd? |
| --- | --- | --- | --- |
| `POST /api/outbox` → complete/undo/setStatus/move/assign/shopping*/markRead | sessie (`requireMember` in elke action); Origin + JSON verplicht | taskId, memberId, item-id, notif-ids | ja: `loadOwnTask` + RLS / RPC; shopping via `.eq(household_id)` + RLS |
| `createTaskAction` / `createTask` | sessie | recurrence.fixedMemberId, rotationMemberIds, assignedMemberId | ja: FK (id, household_id), rotation-trigger, guard (toewijzen) |
| `updateTaskAction` (this/future/terugkerend) | sessie | taskId, leden-id's | ja: `loadOwnTask`/`loadOwnSeries` + RLS `can_manage_series` + `expectRows` vóór de RPC |
| `deleteTaskAction` → `delete_task` | sessie / `auth.uid()` | taskId | ja: `is_member` → `can_delete_task` → `can_manage_series` (future) |
| `pauseSeriesAction` / `stopSeriesAction` → `pause_series`/`resume_series`/`stop_series` | sessie / `auth.uid()` | recurrenceId | ja: `can_manage_series` vóór elke wijziging |
| `clear_series_occurrences` (direct via REST) | `auth.uid()` | recurrenceId | ja |
| `complete_task` / `undo_complete_task` | `auth.uid()` (`my_member_id`, nu met is_active) | taskId, completedBy | ja (completedBy: zelfde huishouden) |
| `addComment` / `deleteComment` / `cancelSwap` / `acceptSwap` | sessie | taskId, commentId, requestId | ja (RLS; `cancelSwap` zonder `expectRows`, zie 9) |
| household.ts: update/remove/addMember, invitations, templates, absences | sessie (`requireAdmin`/`requireMember`) | memberId, absenceId | ja (RLS + `.eq(household_id)`; deels zonder `expectRows`, zie 9) |
| **REST insert `household_members` (policy "members: beheerder voegt toe")** | `auth.uid()` | **user_id (willekeurig account)** | **NEE: `user_id` wordt niet getoetst (zie 1)** |
| REST update `tasks` (policy `is_member`) | `auth.uid()` | — | ja voor huishouden; **status done→todo niet bewaakt (zie 2)** |
| REST update `task_swap_requests` | `auth.uid()` | requested_by, task_id | **NEE in `with check` (zie 6)** |
| `my_membership()` | `auth.uid()` | — | ja (alleen de eigen rij) |
| `/api/cron/tick`, `/api/status` | Bearer `CRON_SECRET` (timingSafeEqual, fail-closed bij een leeg geheim) | — | n.v.t. |
| `/auth/callback`, `/auth/confirm`, `/login?next=` | — | next | ja (`safeNextPath` + origin-prefix) |
| `/geen-toegang`, `/onboarding` | sessie (`getUser` + `isInactiveMember`) | — | ja |

### Bevindingen

1. **[BLOKKEREND]** `supabase/migrations/20260927000200_rls.sql:131` (policy "members: beheerder voegt toe", niet aangepast in WP1). De trigger `household_members_guard` draait alleen bij `before update or delete` (r.182), niet bij INSERT.
   - **Probleem:** een beheerder van elk huishouden kan elk bestaand account (op uuid) als lid in zijn eigen huishouden zetten, ook als `admin`, zonder toestemming van de eigenaar. Aangetoond: Bas (huishouden "Buren") voegde Lynn (huishouden "Fam") toe; daarna gaf `select email from users where id = <Lynn>` als Bas **"lynn@x.nl"** terug (de users-policy staat huisgenoten toe). Een onbekende uuid gaf een FK-fout: een bestaat-orakel voor accounts.
   - **Misbruikscenario:** wie ooit in hetzelfde huishouden zat, kent de account-uuid's (`household_members.user_id`, de snapshot in IDB), bijvoorbeeld een uitgezet of verwijderd lid of een ex-partner. Die maakt een eigen huishouden aan (`create_household` werkt ook voor een uitgezet lid; aangetoond) en voegt de kinderen toe. Gevolgen:
     - hij leest hun actuele e-mailadres en naam;
     - de dispatcher en de tick sturen pushmeldingen van zíjn huishouden naar hun toestellen, want abonnementen hangen aan `user_id`; de titels zijn door hem gekozen taaktitels ("Nieuwe taak: …");
     - het slachtoffer zit ongevraagd in twee huishoudens. Dat breekt BR-44 en laat de WP2b-voorcontrole M1(a) stoppen: een aanvaller kan zo de datamigratie blokkeren.
     Dit omzeilt precies de uitsluiting die V-29 moet bieden.
   - **Gevolg:** schending van de isolatie (BR-26): schrijven in het lidmaatschap van andermans account en lezen van persoonsgegevens van een ander.
   - **Verbetering (in `…_100`, nog niet live):**
     - `with check (private.is_admin(household_id) and user_id is null)` op de insert-policy;
     - de trigger uitbreiden naar `before insert`, zodat `user_id` bij een gebruikers-insert `null` moet zijn (behalve via de RPC-vlag of het systeem). Accounts koppelen gaat dan alleen via `create_household` en `accept_invitation`. `addMemberAction` zet geen `user_id` en blijft werken.
     - DB-test: "beheerder voegt vreemd account toe → 42501".
   - Dit lek bestaat al op live; WP1 maakt het niet erger. Het hoort wel in WP1, omdat WP1 de isolatie (BR-26/AC-026/027) als afgerond meldt.

2. **[GEMIDDELD]** `supabase/migrations/20260928000100_rechten_actief_lid.sql:297-302` (`guard_task_changes`) in combinatie met de brede update-policy (r.248-251).
   - **Probleem:** de guard verbiedt alleen `status → done`. Het omgekeerde, `done → todo/skipped/in_progress`, kan met een directe REST-update, en `completed_at` en `completed_by_member_id` blijven dan staan. Aangetoond: Ellen vinkt af (2 punten); Lynn doet `update tasks set status='todo'` en `update tasks set points=100` en roept daarna `complete_task` aan. Resultaat: **2 completions voor één taak, samen 102 punten.**
   - **Misbruikscenario:** een kind verdubbelt zijn punten of beloning. Ook omzeilt iedereen de undo-regel van WP1 (alleen afvinker of beheerder; V-22 komt pas in WP2a). En er ontstaan meerdere completions per taak, waardoor M1(b) in WP2b stopt. De app blokkeert dit (`setTaskStatusAction`: "Maak het afvinken eerst ongedaan"), de database niet.
   - **Verbetering:**
     - in de guard: `old.status = 'done' and new.status is distinct from 'done' and not v_via_rpc` → 42501 ("Gebruik undo_complete_task()");
     - bij INSERT ook `completed_at`/`completed_by_member_id` verbieden (nu kan een lid een taak invoegen met `completed_by_member_id` = een ander; aangetoond);
     - punten niet wijzigbaar door niet-beheerders, of accepteren tot WP2a en vastleggen;
     - DB-test.

3. **[GEMIDDELD]** De HttpOnly-afwijking (TD §4.1) is nu zonder de afgesproken compensatie.
   - **Probleem:** de afwijking is technisch te verdedigen: `@supabase/ssr` zet `httpOnly: false` (`node_modules/@supabase/ssr/dist/main/utils/constants.js:4-11`), en de browser-client heeft het token nodig voor Realtime en lezen onder RLS. De onderbouwing leunt echter op "een CSP met nonce (WP8)", en in TD §15 staat die pas bij WP9. `next.config.ts` zet op dit moment **geen enkele** beveiligingsheader: geen CSP, `frame-ancestors`, `X-Content-Type-Options` of `Referrer-Policy`. Wel in orde: de enige `dangerouslySetInnerHTML` (`src/app/layout.tsx:35`) bevat alleen env-waarden met `<`-escaping, en React escapet vrije tekst.
   - **Misbruikscenario:** één XSS (bijvoorbeeld via een toekomstige markdown- of linkweergave of een afhankelijkheid) leest het access- én refresh-token uit `document.cookie`: blijvende overname van een account van een minderjarige, tot de refresh-rotatie het opmerkt. De cookie leeft 400 dagen (maxAge-standaard).
   - **Oordeel:** de afwijking is **aanvaardbaar**, maar alleen met compensatie die er nu ook echt is.
   - **Verbetering:**
     - in WP1 of WP2a al statische headers via `next.config` `headers()`: `frame-ancestors 'none'` / `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `object-src 'none'; base-uri 'self'`;
     - de nonce-CSP zo vroeg als mogelijk;
     - in `docs/DECISIONS.md` vastleggen dat geen gebruikerstekst als HTML of URL wordt weergegeven;
     - de JWT-levensduur (1 uur) in het dashboard bevestigen.
     Zonder dit is een expliciete beslissing van Jurgen nodig.

4. **[LAAG]** `src/lib/supabase/server.ts:15` en `src/lib/supabase/client.ts:13`: het `Secure`-attribuut wordt niet gezet.
   - **Probleem:** TD §4.1 zegt "Secure in productie, gezet door de bibliotheek", maar de standaard van `@supabase/ssr` bevat geen `secure`.
   - **Misbruikscenario:** een netwerkaanvaller dwingt een `http://`-verzoek af en leest de sessiecookie; alleen mogelijk zonder HSTS. Voor `*.vercel.app` (HSTS-preload) en Vercel-HTTPS klein.
   - **Verbetering:** `cookieOptions: { secure: process.env.NODE_ENV === 'production' }` in beide clients, en de claim in de TD corrigeren.

5. **[LAAG]** De vlag `takenlijstje.via_rpc` is een gewone USERSET-GUC (guards in `…_100`:150, :265).
   - Aangetoond: in een ruwe SQL-sessie zet `set_config('takenlijstje.via_rpc','on',false)` als `authenticated` alle guard-controles uit (bijvoorbeeld `deleted_at` direct zetten). Via PostgREST is `set_config` niet aanroepbaar (pg_catalog is niet ontsloten), dus nu niet uit te buiten.
   - Het "blijven hangen" binnen een transactie is niet te misbruiken: elke RPC zet de vlag lokaal (`is_local=true`) en zet hem daarna terug, en PostgREST gebruikt één verzoek per transactie.
   - De uitzondering met `pg_trigger_depth() > 1` is niet te misbruiken: geen enkele trigger op een door gebruikers beschrijfbare tabel schrijft naar `tasks` of `task_recurrences` met invoer van de gebruiker; alleen FK-acties en `remove_member_from_rotations`.
   - **Verbetering (defense-in-depth):** maak de guards `security invoker` en controleer `current_user = 'authenticated'` in plaats van de GUC. Binnen een definer-RPC is `current_user` dan de eigenaar; dat is niet te vervalsen.

6. **[LAAG]** `supabase/migrations/20260928000100_rechten_actief_lid.sql:343-346` (swaps).
   - **Probleem:** WP1 herschreef deze policy, maar de `with check` controleert alleen `status`. Aangetoond: Lynn zette haar eigen ruilverzoek om naar `requested_by_member_id = Ellen` en naar een andere taak; het verzoek staat dan op Ellens naam.
   - **Gevolg:** vervalsing binnen het huishouden. Ruilen vervalt in WP2a.
   - **Verbetering:** `with check` = `using` + `private.is_my_member(requested_by_member_id) or private.is_admin(household_id)`, of de update-policy weghalen (intrekken via een RPC). Verwant (niet aangepast, `…200_rls.sql:317`): een lid kan valse `task_assignments`-historie invoegen met een willekeurige `member_id`; dit vervalt in WP2b.

7. **[LAAG]** Bestaat-orakel en rijlock vóór de rechtencheck.
   - `…_110:28,65,106,132`: de RPC's doen `select … for update` op de reeks vóór `can_manage_series` en geven P0002 (bestaat niet) tegenover 42501 (bestaat wel).
   - `delete_task` (r.168-174) geeft `true` voor een onbekende uuid en P0002 voor een taak van een ander huishouden.
   - `complete_task` doet iets vergelijkbaars via `client_mutation_id`.
   - **Gevolg:** met een bekende uuid is vast te stellen of die bestaat, en een vreemde rij kort te locken. Uuid's zijn niet te raden; de impact is minimaal.
   - **Verbetering:** eerst `is_member(v.household_id)` controleren, zonder `for update`, en pas daarna locken. Geef bij geen lidmaatschap dezelfde uitkomst als bij "bestaat niet".

8. **[LAAG]** `eslint.config.mjs:10-26`: de ESLint-regel is niet sluitend (getest met `eslint --stdin`).
   - Geblokkeerd: `@/server/system/admin-client`, `../system/admin-client`, `../../server/system/admin-client`, `src/…` en re-exports.
   - **Niet** geblokkeerd: de dynamische `await import("@/server/system/admin-client")`; `@/server/system/admin-client.ts` (faalt wel op typecheck); een eigen `createClient(url, serverEnv.serviceRoleKey)` met `@/lib/server-env`, dat overal importeerbaar is (nu gebruikt alleen `/api/status` hem, en alleen voor een aanwezigheidscheck).
   - **Verbetering:** verplaats `serviceRoleKey` uit `serverEnv` naar `src/server/system/`, of beperk `@/lib/server-env` met `importNames`. Voeg `no-restricted-syntax` toe op `ImportExpression[source.value=/admin-client/]`, of een grep-test in CI.

9. **[LAAG]** `expectRows` ontbreekt bij updates en deletes met de user-client (TD §5.1: "verplicht bij elke update/delete"; een afwijking geldt als securitybevinding). Vindplaatsen:
   - `src/server/actions/household.ts:105` (completeOnboarding), `:170` (removeMember), `:318` (deleteAbsence);
   - `src/server/actions/shopping.ts:55-63` (toggle), `:77` (update), `:93` (delete), `:109`/`:114` (archive);
   - `src/server/actions/tasks.ts` `cancelSwapAction` (update zonder `.select`) en de `task_assignments`-inserts waarvan het resultaat wordt genegeerd;
   - `src/server/actions/notifications.ts:62`.
   - **Gevolg:** geen omzeiling (RLS weigert), maar de gebruiker ziet "gelukt" bij een weigering (het B-01-patroon), en vervolgstappen lopen door.
   - **Verbetering:** `.select('id')` + `expectRows` toevoegen, of per plek in DECISIONS vastleggen waarom het niet nodig is (bijvoorbeeld markRead is idempotent).

10. **[LAAG]** `src/features/household/store.tsx:94-98`: de clientkant van TD §4.3 ontbreekt.
    - **Probleem:** "Faalt een snapshot-refresh met 'geen huishouden' → `location.assign('/')`" is niet gebouwd; de fout wordt alleen gelogd. Een lid dat wordt uitgezet terwijl de app openstaat, blijft de laatst geladen gegevens zien, en de IDB-cache blijft staan tot de volgende navigatie naar de server.
    - **Gevolg:** er lekt geen nieuwe data (RLS en Realtime leveren niets meer), maar de lokale wis-garantie (BR-43) geldt pas later.
    - **Verbetering:** herken PGRST116 / 0 rijen bij `households` en doe `location.assign('/')`, of leg het uitstel vast naast D-010.

11. **[LAAG]** Vrije tekst in meldingen en een push-endpoint als verzoek naar een willekeurige URL (bestaand gedrag, niet gewijzigd).
    - `requestSwapAction` zet de vrije notitie van een lid als `body` in de melding en de push naar anderen (`tasks.ts`, `notify(... body: note ...)`). TD §5.3.3 zegt "nooit uit vrije invoer". Dit vervalt in WP2a.
    - `push_subscriptions.endpoint` controleert alleen `^https://`. De server doet een POST naar elk opgegeven https-adres (blinde verzoeken vanaf Vercel, lage impact).
    - **Verbetering:** een allowlist van bekende push-diensten (fcm.googleapis.com, *.push.apple.com, updates.push.services.mozilla.com, *.notify.windows.com).

12. **[ONZEKER]** `git log --all -S "SERVICE_ROLE_KEY=ey"` geeft een treffer in commit `b8a10a0`.
    - De inhoud kon niet worden getoond: de tool weigerde, omdat dat geheimen zichtbaar zou maken.
    - **Nodig:** de hoofdsessie of Jurgen controleert of daar een echte service-role-sleutel staat of een voorbeeld/placeholder. Is het echt, dan moet de sleutel in Supabase worden **geroteerd**; dat wordt BLOKKEREND. `.env*` staat correct in `.gitignore`.

**Per categorie**

- **A. Wachtwoorden:** Supabase Auth (bcrypt, rate limits); de app slaat geen wachtwoorden op. Gecontroleerd, niets gevonden in WP1. Wachtwoordbeleid en -herstel zijn voor WP2a.
- **B. Sessies:** punten 3 en 4. `getUser()` valideert het token in de proxy. Uitloggen wist lokaal (`clearLocalData`) en daarna `signOut`.
- **C. Autorisatie:** punten 1, 2, 5, 6, 7 en 9.
  - Gecontroleerd en in orde: is_active in `is_member`/`is_admin`/`my_member_id` en in alle policies die WP1 raakt; ook nagelopen voor de niet-aangepaste policies op households, tasks, recurrences, completions, comments, templates, shopping, invitations en users (allemaal via `is_member`/`is_admin`).
  - Alle 5 nieuwe RPC's controleren de rechten vóór een wijziging.
  - `search_path = ''` staat op alle definer-functies.
  - Execute-rechten in `private`: alleen de 7 helpers (AC-028 groen). De default privileges zijn ingetrokken; controleer wel dat de migratie op live als `postgres` draait, anders geldt `alter default privileges` voor een andere rol.
  - Nieuwe RPC's en `my_membership` zijn ingetrokken voor anon.
  - Meldingen hebben geen insert-policy meer (AC-016 groen); de url-check `^/([^/\\]|$)` is correct.
- **D. Geheimen:** punt 12. Cron en status: Bearer met `timingSafeEqual`, fail-closed; geen geheimen in de respons. Geen geheimen in `NEXT_PUBLIC_*`. De service role wordt alleen in `src/server/system/**` gebruikt (grep: geen andere imports), maar zie punt 8.
- **E. Invoer:** zod in alle bekeken actions. Outbox: `kind` wordt tegen een allowlist gecontroleerd (geen prototype-sleutels). Geen raw SQL. Redirects via `safeNextPath` + origin-prefix. Gecontroleerd, niets gevonden.
- **F. Extern:** web-push (punt 11). Een time-out op push staat gepland in WP3.
- **G. Afhankelijkheden:** 0 hoog/kritiek. Next 16.3.6; de securityrelease 16.3.7 is nog niet uit (D-001 correct vastgelegd).
- **H. Informatielekken:** `toFailure` filtert policy-, relatie- en functieteksten. Outbox-fouten bevatten alleen de code en een Nederlandse tekst. Proxy: `/api/outbox` geeft 401 in JSON, geen redirect. Verder alleen punt 7 (orakel).
- **I. AVG:**
  - Logs bevatten alleen actie- en foutnamen en codes. Uitzondering: `src/features/settings/push-device.tsx:141,162` logt een volledig foutobject in de browser (niet nieuw; TD §9.4 wil alleen een code).
  - Supabase staat in eu-central-1.
  - Namen in meldingsteksten ("gedaan door …") en `completed_by`: bewust tot WP2a/WP2b.
  - Een uitgezet lid kan alleen zijn eigen push-abonnement nog afmelden (D-012/D-015); correct.
- **J. Headers/CSRF:**
  - CSRF voor `/api/outbox`: Origin-allowlist + `application/json`; cookies SameSite=Lax. Goed.
  - `/auth/signout` (POST zonder Origin-check): alleen uitloggen, en Lax blokkeert cross-site POST. Aanvaardbaar.
  - Headers: zie punt 3.
  - SW `internalUrl`: `javascript:`, `//host` en een andere origin → `/`. De message-handler controleert de origin. Goed.

### Wat goed is
- De rechtenchecks in de database staan op de juiste plek. Elke nieuwe RPC controleert eerst `can_manage_series`/`can_delete_task`, en een weigering verandert aantoonbaar niets (vingerafdruk-tests groen). Dit lost B-01 structureel op.
- `is_member`/`is_admin`/`my_member_id` eisen `is_active`. Een uitgezet lid ziet 0 rijen in elke tabel, alleen zijn eigen lidrij en `my_membership()`.
- De insert-policy voor meldingen is weg; de url-check plus `internalUrl` in de SW sluiten de open redirect (B-03) in twee lagen.
- `expectRows` plus de volgorde "reeks eerst, dan pas de RPC" in `updateTaskAction` (future); `systemDb`/`fallbackDb` zijn volledig verwijderd.
- `/api/outbox`: sessie in elke action, Origin- en JSON-controle, een 401 in plaats van een redirect, en geen stil weggooien.

### Doorgeven aan test-writer
- Punt 1: een beheerder voegt een vreemd account toe (met `user_id`, ook als admin) → 42501. Een onbekende uuid geeft dezelfde uitkomst.
- Punt 2: een lid zet een `done`-taak direct op todo, skipped of in_progress → 42501. Een insert met `completed_at`/`completed_by_member_id` → 42501. Daarna levert `complete_task` nooit een tweede completion op.
- Punt 6: een lid herschrijft `requested_by_member_id`/`task_id` van zijn eigen ruilverzoek → geweigerd.
- `POST /api/outbox`: zonder Origin, met een vreemde Origin, of met `text/plain` → 403/415. Zonder sessie → 401 in JSON, geen redirect. Als uitgezet lid → FORBIDDEN en de entry verdwijnt. Met `kind: "__proto__"` → obsolete of invalid, niet uitgevoerd.
- Punt 8: een lint-test met een dynamische import van `admin-client` buiten `system/` → fout, na de verbetering.
- De tests uit de scratchpad eerst in `supabase/tests/` plaatsen; de repo-suite is nu rood op `10_…:112`.

### Vragen voor de hoofdsessie
- HttpOnly en headers (punt 3): basisheaders naar WP1/WP2a halen, of laat Jurgen bewust accepteren dat de app tot WP8/WP9 live draait zonder CSP en framebeveiliging? En welke is het nu: WP8 (TD §4.1) of WP9 (TD §15)?
- Punt 12: is de treffer in commit `b8a10a0` een echte sleutel? Zo ja, dan moet hij geroteerd worden; dat is Jurgens actie in Supabase.
- Punt 2 (punten): mogen gezinsleden tot WP2a de punten van een taak via de database wijzigen, of wordt dat nu al afgesloten?

### Conclusie
**NO-GO** voor livegang van WP1 zoals hij nu is. Er staat één BLOKKEREND punt open (punt 1: een beheerder kan een vreemd account in zijn huishouden zetten, daarmee het e-mailadres lezen en pushmeldingen naar dat toestel sturen).

Dit punt bestaat al op live; WP1 maakt het niet erger. WP1 zelf is een duidelijke verbetering (B-01…B-05 opgelost en aantoonbaar getest). Omdat `…_100` nog niet is toegepast, is dit het goede moment om de fix mee te nemen: één policywijziging plus een INSERT-guard. Samen met de fix voor punt 2 (GEMIDDELD) en een groene repo-suite verwacht de reviewer GO. Punt 3 vraagt een expliciete beslissing van Jurgen als de headers niet naar voren worden gehaald.
