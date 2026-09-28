## Security-herreview: WP1 — herstel van de securitybevindingen (e271b26 … 34f1703)

Scope: `git diff 0d453bc 34f1703 -- src supabase public eslint.config.mjs next.config.ts`, gelezen samen met D-016…D-031.
Stack: Supabase met RLS, PostgREST en RPC (vertaald zoals in de eerste review).
npm audit: 0 hoog, 0 kritiek (ongewijzigd).
Verplicht op grond van: niveau 2; login, meerdere huishoudens, minderjarigen.

**Tests**
- Repo-suite: `su postgres -c "… bash supabase/tests/run.sh"` → **"✓ Alle databasetests geslaagd"**. 10_ en 20_ staan nu in de repo.
- Mijn aanvalsproeven voor punt 1, 2, 6 en 7 heb ik opnieuw gedaan: in een eigen database met de huidige migraties, als `authenticated` met een eigen JWT. De database is daarna verwijderd; ik heb niets geschreven.

### Per bevinding: opgelost of uitgesteld?

| # | Eerste oordeel | Nu | Bewijs |
| --- | --- | --- | --- |
| 1 | BLOKKEREND | **OPGELOST** | Een beheerder van Buren kan Lynn niet meer toevoegen, ook niet als admin → 42501. Een onbekende uuid geeft dezelfde 42501, dus het orakel is weg. Lid zonder account toevoegen en daarna `user_id` zetten → 42501. Bas leest `users` van Lynn → 0 rijen. Uitgezette Kai maakt nog wel een eigen huishouden aan (BR-44 volgt in WP2a), maar kan geen account meer toevoegen → 42501. De insert-policy eist `user_id is null` en de guard staat nu ook `before insert` (`…_100`:137-145, 163-176, 214-217). `create_household` en `accept_invitation` (zelf koppelen) blijven werken. |
| 2 | GEMIDDELD | **OPGELOST**, punten bewust uitgesteld (D-017) | Lynn zet een gedane taak op todo, skipped of in_progress → 42501 "Gebruik undo_complete_task()". Een insert met `completed_at` of `completed_by_member_id` → 42501. Een tweede `complete_task` geeft de bestaande completion terug; ná undo door de afvinker is het aantal completions 0. Dubbel belonen is dus dicht. Dat gezinsleden punten nog kunnen wijzigen tot WP2a (punten vervallen dan) vind ik aanvaardbaar, omdat het misbruik (een tweede afvinking) nu dicht is. |
| 3 | GEMIDDELD | **OPGELOST (voldoende voor WP1)** | `next.config.ts` stuurt op alle paden `frame-ancestors 'none'; object-src 'none'; base-uri 'self'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` en `Permissions-Policy` mee. De HttpOnly-afwijking is daarmee **aanvaardbaar** tot de script-CSP met nonce er is (D-018: WP9). Rest: zie N3. |
| 4 | LAAG | **OPGELOST** | `cookieOptions: { secure: production, sameSite: 'lax' }` staat in de server-, browser- én proxyclient. TD §4.1 is gecorrigeerd (W-02, akkoord Jurgen). |
| 5 | LAAG | **BEWUST UITGESTELD** (D-020, WP9) | De reden klopt: `set_config` is via PostgREST niet bereikbaar. Aanvaardbaar. |
| 6 | LAAG | **OPGELOST** | Het verzoek omzetten naar Ellen, naar een andere taak, of `accepted_by` zetten → 42501 (`guard_swap_changes`). `status='accepted'` → RLS-weigering. Intrekken werkt, en heropenen als Ellen met een andere aanvrager → 42501. `accept_swap_request` werkt nog, en `complete_task` annuleert open ruilverzoeken zonder conflict. Alleen `message` blijft wijzigbaar door de aanvrager: onschuldig, en ruilen vervalt in WP2a. |
| 7 | LAAG | **OPGELOST voor reeks-RPC's en `delete_task`**, rest LAAG | Bas: `delete_task` op een vreemde en op een onbekende taak → beide `true`, en de vreemde taak bestaat nog. `stop`, `clear` en `pause` op een vreemde en op een onbekende reeks → beide P0002. De lock komt pas na de rechtencheck (`assert_can_manage_series`). Rest: zie N2. |
| 8 | LAAG | **GROTENDEELS OPGELOST** | De sleutel wordt alleen gelezen in `system/admin-client.ts`. Geblokkeerd (getest met `eslint --stdin`): `process.env.SUPABASE_SERVICE_ROLE_KEY`, `import("@/server/system/admin-client")` en de `.ts`-extensie. Er is geen gebruik buiten `system/` (grep). Rest: zie N4. |
| 9 | LAAG | **OPGELOST** | Nu `expectRows` in completeOnboarding, removeMember, deleteAbsence, shopping (toggle, update, delete, archive), cancelSwap en push-voorkeur. De uitzonderingen markRead en deletePushSubscription zijn onderbouwd in D-024 (idempotent). |
| 10 | LAAG | **OPGELOST** | `store.tsx:97-103`: bij PGRST116 herlaadt de pagina en beslist de server (/geen-toegang wist lokaal). Een netwerkfout geeft geen reload, dus er ontstaat geen herlaadlus. |
| 11 | LAAG | **BEWUST UITGESTELD** (D-028) | Allowlist voor push-endpoints in WP3; vrije tekst in ruilmeldingen vervalt met ruilen in WP2a. Aanvaardbaar. |
| 12 | ONZEKER | **AFGESLOTEN** | Jurgen heeft het gecontroleerd: in `.env.example` van b8a10a0 staat geen echte sleutel (PROGRESS r.56). |

Ook gecontroleerd:
- `private.assert_can_manage_series` en `private.guard_swap_changes` zijn **niet** aanroepbaar voor authenticated (`has_function_privilege` = f). De revoke aan het eind van `_110` dekt ze.
- `pg_trigger_depth() > 1` bovenaan `guard_member_changes`: geen enkele trigger op een door gebruikers beschrijfbare tabel schrijft naar `household_members`. Alleen FK-cascades (huishouden of account verwijderd) vallen eronder, en dat is zo bedoeld.

### Nieuwe of resterende bevindingen uit het herstel

- **N1 [LAAG]** `src/server/actions/tasks.ts:216-250` (D-026): de reeks krijgt `id = task.id` via een upsert met `ignoreDuplicates`, en daarna volgt `patch.recurrence_id = task.id`.
  - **Misbruikscenario:** een gezinslid met aanmaakrecht kent de id van een losse taak in het eigen huishouden. Hij maakt via REST vooraf een eigen reeks aan met precies die id. Zet een beheerder die taak later om naar terugkerend, dan wordt de upsert genegeerd en hangt de taak aan de reeks van het lid, met diens regel en titel en het lid als maker (die hem dus mag beheren). De guard laat dit toe, want de beheerder mag elke reeks beheren.
  - Buiten het huishouden: een reeks met die id in een ander huishouden geeft alleen een FK-fout. De uuid is daar niet bekend, dus dat is hooguit een DoS op één omzetting.
  - **Gevolg:** manipulatie binnen het huishouden, geen lek.
  - **Verbetering:** lees na de upsert de reeks terug (`loadOwnSeries`) en weiger als `created_by_member_id <> member.id` of als de reeks niet net is aangemaakt. Of gebruik een afgeleide id die de client niet kan voorspellen, bijvoorbeeld uuidv5(taskId, geheim).

- **N2 [LAAG]** Bestaat-orakel in `complete_task` en `undo_complete_task` (`…000300_functions.sql`).
  - Bas krijgt voor een vreemde taak 42501 "Geen toegang" en voor een onbekende taak P0002 "Taak niet gevonden" (opnieuw aangetoond). Ook de `for update` op de vreemde rij gebeurt nog vóór de lidmaatschapscheck.
  - De uuid is niet te raden, dus de impact is minimaal.
  - **Verbetering:** in WP2a, bij `complete_task` v2 en de nieuwe `undo`: eerst lidmaatschap controleren zonder lock, en bij beide gevallen dezelfde uitkomst geven.

- **N3 [LAAG]** Documentatie: TD §4.1 noemt de CSP met nonce nog bij "WP8", terwijl D-018 en TD §15 WP9 zeggen. Er is nog geen `script-src`-beperking. Graag gelijktrekken bij de volgende wijziging, en de script-CSP niet verder uitstellen dan WP9.

- **N4 [LAAG]** De ESLint-regel is niet waterdicht tegen opzettelijke omzeiling:
  - `process.env["SUPABASE_SERVICE_ROLE_KEY"]`, destructuring uit `process.env` en `import(variabele)` worden **niet** geblokkeerd (getest);
  - `src/server/system/**` mag vrij exporteren (bijvoorbeeld `config.ts` → alleen een boolean; in orde).
  - Per ongeluk misbruik is nu wel afgedekt.
  - **Verbetering:** voeg selectors toe voor `MemberExpression[property.value='SUPABASE_SERVICE_ROLE_KEY']` en `VariableDeclarator > ObjectPattern > Property[key.name='SUPABASE_SERVICE_ROLE_KEY']`, of een grep-test in CI.

Verder gecontroleerd zonder bevindingen:
- `clearLocalData` stuurt nu ook naar `registration.active`.
- Met de `locked`-vlag schrijven cache en outbox na het wissen niets meer terug.
- `signOutSafely` staat ook in de uitnodigingsweergave.
- `UNSUPPORTED_VERSION` geeft 503 zonder informatielek.
- `/api/status` gebruikt `hasSystemKey()`.
- `pause_series`/`resume_series` rond `generated_until`: geen securitygevolg.

### Wat goed is
- Accounts koppelen gaat alleen nog via `create_household`/`accept_invitation`, afgedwongen in twee lagen: de insert-policy en de INSERT-guard.
- "Gedaan" is éénrichtingsverkeer buiten de RPC's: geen dubbele afvinking of beloning meer mogelijk.
- De reeks-RPC's controleren lidmaatschap en recht vóór de lock, en geven dezelfde uitkomst voor "bestaat niet" en "ander huishouden".
- Basisbeveiligingsheaders en `Secure`-cookies staan er nu echt; de claim in de TD klopt weer.
- De regressietests voor punt 1, 2 en 6 staan in de repo, en de mutatiecontrole is 20/20.

### Doorgeven aan test-writer
- N1: een lid maakt een reeks aan met `id` = de id van een losse taak; een beheerder zet die taak om naar terugkerend → geweigerd, of er komt een nieuwe reeks van de beheerder. Na de fix.
- N2 (WP2a): `complete_task`/`undo_complete_task` op een vreemde en op een onbekende taak → identieke uitkomst.
- Een headers-test (Int/E2E): elke respons bevat `X-Frame-Options: DENY` en `frame-ancestors 'none'`.

### Vragen voor de hoofdsessie
- Geen die een beslissing van Jurgen vragen. N1 t/m N4 zijn uitvoeringskeuzes (LAAG): herstellen of in PROGRESS "Uitgestelde punten" zetten.

### Conclusie
**GO** voor livegang van WP1. Er staan geen BLOKKEREND- of GEMIDDELD-punten meer open. Punt 1 (BLOKKEREND) en punt 2 (GEMIDDELD) zijn aantoonbaar opgelost, en punt 3 is voldoende afgedekt voor deze fase. Wat overblijft is LAAG en in DECISIONS onderbouwd uitgesteld of nieuw gemeld (N1 t/m N4).
Voorwaarde bij de uitrol: eerst stap 0 van TD §12.3 (telling van uitgezette leden met account op live), en dan de migraties `_100`/`_110` in de versie van commit 34f1703 toepassen.
