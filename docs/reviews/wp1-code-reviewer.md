## Code-review: WP1 — Rechtenmodel en securityfixes (commit 0d453bc)

**Beoordeeld:** alle 37 bestanden uit `git diff 8143fe5 0d453bc`, volledig gelezen: beide migraties, `context.ts`, `errors.ts`, `guards.ts`, `actions/{tasks,household,notifications,shopping}.ts`, `services/{tasks,scheduling}.ts`, `system/*`, `api/{outbox,status,cron/tick}`, `store.tsx`, `mutations.ts`, `lib/offline/*`, `sw.js`, `proxy.ts`, `geen-toegang`, `no-access.tsx`, `sign-out-button.tsx`, `invite-view.tsx`, `onboarding/page.tsx`, `eslint.config.mjs`. Ook gelezen: de aanroepers (pause-dialog, recurrences-section, task-detail-sheet, notifications-page) en de oude migraties `_200_rls` en `_300_functions` om te vergelijken.

**Ontwerp gelezen:** TECHNICAL_DESIGN §4.3, §4.4, §5.1–5.3, §6.1–6.3, §7, §9.3.1, §9.4, §12.3.1, §13, §15; ACCEPTANCE_CRITERIA WP1 (AC-001…033 en AC-170) plus AC-122; DECISIONS D-001…D-015; PROGRESS; `docs/reviews/wp1-test-writer.md`.

**Lint, typecheck en tests:**
- `npx tsc --noEmit`: groen.
- `npx eslint src`: groen. De ESLint-regel zelf is getest met stdin op vier importvormen (`../system/admin-client`, `@/server/system/admin-client`, `src/…`, `../../…`). Alle vier worden geweigerd.
- `npx vitest run`: groen, 110 tests. Er zit geen test bij voor de nieuwe logica.
- **`test:db` (de repo-versie van `supabase/tests/run.sh`): ROOD.** Hij faalt op `supabase/tests/10_rls_and_functions.sql:112` met "ASSERT MISLUKT: taak van ander niet gewijzigd".
- De bestanden van de test-writer (`10_` en `20_rechten_br.sql`, nog in de scratchpad) zijn door de reviewer zelf gedraaid op de gecommitte migraties. Beide zijn groen. De AC-028-fix (D-014) en de push-policies (D-015) werken dus.

### Bevindingen

1. **[BLOKKEREND]** `supabase/tests/10_rls_and_functions.sql:112` (en `supabase/tests/20_rechten_br.sql` ontbreekt)
   - **Probleem:** de databasetests in de repository zijn rood op de nieuwe migraties. De bijgewerkte `10_` en de nieuwe `20_rechten_br.sql` (772 regels) staan alleen in de scratchpad, omdat de poort de test-writer blokkeerde.
   - **Gevolg:** TD §12.3 stap 1 eist "migratie lokaal groen (`test:db`)" vóór de live-migratie. De DoD eist groene tests. Nu zijn er in git geen DB-regressietests voor B-01…B-04 en V-29, en elke volgende WP start met een rode suite.
   - **Verbetering:** plaats beide bestanden uit `/tmp/claude-0/-home-user-takenlijstje/692a0963-bcf7-518f-8e91-2ea8d7ce7c8b/scratchpad/tests/` in `supabase/tests/` en draai `npm run test:db` opnieuw (door de reviewer nagedraaid: dan is alles groen). Leg de schrijfrechten van de test-writer op `supabase/tests/**` voor aan Jurgen.

2. **[GEMIDDELD]** `src/features/household/store.tsx:232-233` en `:200-206`
   - **Probleem:** een directe snelle actie die `retry` oplevert (5xx, `UNKNOWN`, HTML-antwoord, of een netwerkfout terwijl `navigator.onLine` true is) gaat via `queue()` de wachtrij in. Daarna plant niemand een nieuwe poging: er komt geen `flushOutbox()` en geen retry-timer. De toast zegt "Wordt verstuurd zodra je weer online bent", maar de gebruiker ís online, dus er komt geen `online`-event. Dit is nieuw sinds WP1: vroeger ging alleen een netwerkfout de wachtrij in, nu ook serverfouten.
   - **Gevolg:** de afvinking blijft uren in de wachtrij in een open PWA ("wacht op verbinding"). Pas bij herladen of bij een wissel van offline naar online wordt hij verstuurd.
   - **Verbetering:** plan na `queue()` bij `retry` dezelfde backoff-timer als in `flushOutbox`, of roep `flushOutboxRef.current()` met vertraging aan. Toon bij `reason !== "network"` een passende tekst. Dezelfde lus zit in `flushOutbox` (`store.tsx:140-154`): bij `reason === "network"` volgt geen retry-timer als `navigator.onLine` true is.

3. **[GEMIDDELD]** `src/app/api/outbox/route.ts:77-79` en `src/domain/outbox/migrate.ts:57-59`
   - **Probleem:** een entry met `v > OUTBOX_VERSION` geeft `invalid` terug, dus `VALIDATION`, en de client verwijdert hem (`send.ts:21`).
   - **Gevolg:** als een latere WP de versie ophoogt en daarna een Instant Rollback volgt (TD §12.3.1 R5), gooit de oude server de nieuwere entries weg. Dat is precies het deploy-scenario dat §9.3.1 moet afvangen ("onbekend antwoord → laten staan").
   - **Verbetering:** onderscheid een toekomstige versie van ongeldige invoer (bijvoorbeeld code `UNSUPPORTED_VERSION` en HTTP 409 of 503). De client behandelt dat als `retry`. Voeg een unit-test toe.

4. **[GEMIDDELD]** `src/features/household/store.tsx:91-98`
   - **Probleem:** TD §4.3 schrijft voor: "Faalt een snapshot-refresh met 'geen huishouden' (0 rijen of PGRST116), dan doet de store `location.assign('/')`." Dat is niet gebouwd. Een lid dat wordt uitgezet terwijl de app open staat, ziet `loadSnapshot` falen met PGRST116 (`snapshot.ts:55`, `.single()`). Er volgt alleen `console.error`.
   - **Gevolg:** het uitgezette lid blijft de oude gegevens zien, en `writeCachedSnapshot` (`:281-284`) houdt de IDB-cache gevuld tot een volledige herlaadactie. AC-023 wordt pas bij de volgende navigatie gehaald.
   - **Verbetering:** herken in `refresh` een PGRST116-fout (of 0 rijen) op `households` en doe `location.assign('/')`. De server stuurt dan door naar `/geen-toegang`, en die pagina wist de lokale gegevens.

5. **[GEMIDDELD]** `src/features/household/store.tsx:125-126`
   - **Probleem:** een geweigerde wachtrij-entry toont alleen de serverfout (bijvoorbeeld "Taak niet gevonden."), zonder te zeggen dat het om een offline wijziging gaat en om welke taak.
   - **Gevolg:** AC-032 ("1 offline wijziging kon niet worden verwerkt: <taak>") en TD §9.3.1 ("zichtbare melding per taak") worden niet gehaald. De gebruiker weet niet wat er is teruggedraaid.
   - **Verbetering:** zoek de titel op via `entry.payload.taskId` in de snapshot en toon "1 offline wijziging kon niet worden verwerkt: <titel> (<reden>)".

6. **[GEMIDDELD]** `expectRows` ontbreekt bij updates en deletes met de gebruikersclient
   - **Waar:** `src/server/actions/household.ts:105` (completeOnboarding), `:170` (removeMember), `:318` (deleteAbsence); `src/server/actions/shopping.ts:52-62`, `:74-85`, `:93`; `src/server/actions/tasks.ts:483-490` (cancelSwap).
   - **Probleem:** TD §5.1 zegt dat `expectRows` "verplicht [is] bij elke update/delete met de user-client" en dat afwijken "vanaf nu" een bevinding is. WP1 heeft het alleen in `tasks.ts` ingevoerd. TD §6.2 noemt voor `removeMemberAction` expliciet "delete + expectRows; al weg → NOT_FOUND".
   - **Gevolg:** stille "gelukt" bij een RLS-weigering of een verdwenen rij. Voor boodschappen via `/api/outbox`: een toggle of verwijdering van een al verwijderd item geeft `ok`, zonder melding. Dit is precies het B-01-patroon.
   - **Verbetering:** voeg `.select("id")` en `expectRows` toe op deze plekken. Waar het ontwerp dat voorschrijft, maak van 0 rijen `NOT_FOUND`.

7. **[GEMIDDELD]** `supabase/migrations/20260928000110_reeks_rpcs.sql:79-82` en `:114-117`, samen met `src/server/actions/tasks.ts:372`
   - **Probleem:** `pause_series` en `resume_series` zetten `generated_until` niet terug. Bij een onbepaalde pauze en daarna hervatten staat `generated_until` op vandaag+14; `planSeries` begint op `generated_until+1` (`plan.ts:77`) en plant alleen de eerstvolgende uitvoering ná vandaag+14.
   - **Gevolg:** na hervatten een gat tot 14 dagen zonder taken. Dat is een fout resultaat, in strijd met AC-122 ("na hervatten weer vanaf vandaag ingepland"). Het gedrag bestond al vóór WP1, maar deze flow is in WP1 herschreven.
   - **Verbetering:** zet `generated_until = least(generated_until, p_from - 1)` in `pause_series` en `generated_until = null` of vandaag−1 in `resume_series`, of roep `topUp(…, from = vandaag)` aan na hervatten. Voeg een DB- of integratietest toe.

8. **[GEMIDDELD]** `src/server/actions/tasks.ts:217-250` en `:299` ("losse taak wordt terugkerend")
   - **Probleem:** de reeks wordt ingevoegd zonder door de client gegenereerde id. TD §6.1: "upsert reeks op id". Er is ook geen herstel als de taak-update daarna faalt.
   - **Gevolg:** bij dubbel opslaan ontstaan twee reeksen. De tweede taak-update wordt (terecht) geweigerd door "Reekskoppeling", maar de tweede reeks blijft actief met `generated_until = scheduledDate`, en de tick plant hem in: dubbele taken.
   - **Verbetering:** laat de client een `recurrenceId` meesturen en doe een upsert met `ignoreDuplicates`, zoals het ontwerp voorschrijft. Is dat bewust voor WP6 bedoeld, zet het dan in `docs/PROGRESS.md` onder technische schuld.

9. **[GEMIDDELD]** `src/server/actions/household.ts:288-312` en `src/server/services/scheduling.ts:195-259` (D-006)
   - **Probleem:** eerst wordt de afwezigheid ingevoegd, daarna voert `applyAbsence` met de gebruikersclient meerdere losse updates uit. Faalt de herverdeling halverwege (wat D-006 zelf verwacht bij "toewijzen aan anderen uit"), dan blijven de afwezigheid en een deel van de herverdelingen staan, terwijl de gebruiker een foutmelding krijgt.
   - **Gevolg:** een half uitgevoerde actie. Opnieuw proberen geeft een tweede afwezigheidsrij.
   - **Verbetering:** controleer vóór het invoegen of herverdelen mag (`members_can_assign_others` of beheerder) en weiger anders met een nette melding, of laat bij een weigering alleen de afwezigheid staan en meld duidelijk dat er niet herverdeeld is. De functie vervalt in WP2a, maar staat tot dan live.

10. **[LAAG]** `src/lib/offline/clear.ts:18`
    - **Probleem:** `navigator.serviceWorker.controller?.postMessage` doet niets als de pagina (nog) niet door de service worker wordt gecontroleerd (eerste load, harde herlaadactie).
    - **Gevolg:** op `/geen-toegang` blijft de paginacache dan bestaan. Bij uitloggen vangt de POST-handler in `sw.js` dit nog op.
    - **Verbetering:** gebruik `(await getRegistration())?.active?.postMessage(...)`.

11. **[LAAG]** `src/features/household/store.tsx:281-284` tegenover `src/features/auth/sign-out-button.tsx:27-38`
    - **Probleem:** tijdens het uitloggen kan de debounce-timer van `writeCachedSnapshot` (800 ms), of een lopende `flushOutbox` → `writeOutbox`, de IDB opnieuw vullen ná `clearLocalData()`.
    - **Gevolg:** een klein venster waarin de gegevens van het huishouden achterblijven. Het vangnet (de `userId`-sleutel) komt pas in WP4 (D-010).
    - **Verbetering:** zet in de store een vlag "uitloggen bezig" die het schrijven stopt, of wis in `SignOutButton` na de laatste schrijfactie.

12. **[LAAG]** `src/features/invite/invite-view.tsx:129-134`
    - **Probleem:** "Niet jij? Uitloggen" wist lokale gegevens zonder de waarschuwing over wachtende wijzigingen (TD §4.4 stap 1).
    - **Verbetering:** hergebruik `SignOutButton`.

13. **[LAAG]** `src/server/actions/tasks.ts:361-371`
    - **Probleem:** komt `pausedFrom` leeg binnen met een ingevulde `pausedUntil`, dan wordt dat stil "hervatten", terwijl de UI "is gepauzeerd" toont. Het oude gedrag bewaarde `paused_until`. In de huidige formulieren is "Vanaf" verplicht, dus in de praktijk komt dit zelden voor.
    - **Verbetering:** weiger die combinatie in `pauseInput`.

14. **[LAAG]** Dode code, ontstaan in dit WP
    - **Waar:** `src/server/services/scheduling.ts:165-188` (`clearOpenOccurrences`, `replanSeries`; nergens meer gebruikt), `:289` (`absentOn`), `src/server/services/tasks.ts:183` (`householdToday`).
    - **Probleem:** vooral `clearOpenOccurrences` is gevaarlijk om te laten staan: een delete-helper zonder rechtencheck, precies het B-01-patroon.
    - **Verbetering:** verwijderen, en het commentaar in `scheduling.ts:3-8` ("Draait met de service-role client") aanpassen.

15. **[LAAG]** `src/server/actions/notifications.ts:76-91` (`sendTestNotificationAction`)
    - **Probleem:** TD §6.3 zegt dat deze actie vervalt. Ontbreekt de systeemsleutel, dan retourneert `notify` stil, en de UI (`push-device.tsx:222`) toont toch "Testmelding verstuurd". Dat is een verborgen fallback.
    - **Verbetering:** verwijderen, zoals het ontwerp zegt, of fouten laten doorkomen.

16. **[LAAG]** Consistentie van de guards
    - **Probleem:** `guard_member_changes` (`_100.sql:142-192`) heeft geen uitzondering voor `pg_trigger_depth() > 1`, in tegenstelling tot de twee andere guards (D-003). Een cascade bij het verwijderen van een huishouden (WP7, `delete_household`) loopt daardoor vast op "minimaal één actieve beheerder". De push-policies (`_100.sql:374-386`) gebruiken een losse subquery in plaats van de `private`-helpers.
    - **Verbetering:** voeg de dieptecontrole toe aan `guard_member_changes`, of neem het mee als aandachtspunt voor WP7.

17. **[LAAG]** `src/server/guards.ts`
    - **Probleem:** TD §5.1 noemt `loadOwnMember`, `loadOwnShoppingItem` en `loadOwnInvitation`. Die bestaan niet. De acties filteren nu met `.eq("household_id", …)`. Dat is functioneel gelijkwaardig, mits `expectRows` erbij komt (bevinding 6).
    - **Verbetering:** voeg ze toe, of noteer in DECISIONS dat filteren op huishouden plus `expectRows` hier volstaat.

18. **[LAAG]** `src/server/actions/tasks.ts`
    - **Probleem:** het bestand telt 493 regels en `updateTaskAction` (`:170-334`) ongeveer 165 regels. Het bestond al, maar is in WP1 verder gegroeid.
    - **Verbetering:** splitsen bij WP6, als deze actie herschreven wordt.

19. **[LAAG]** `supabase/migrations/20260928000100_rechten_actief_lid.sql:424-425`
    - **Probleem:** `add constraint notifications_url_intern` controleert ook de bestaande rijen. Staat er op live een oude url als `//…` of `/\…` (vóór WP1 mogelijk via de insert-policy voor gebruikers), dan faalt de migratie. De transactie wordt dan teruggedraaid, dus er gaat niets kapot, maar de uitrol stopt.
    - **Verbetering:** doe vóór het toepassen op live een alleen-lezen-telling (`select count(*) from notifications where url is not null and url !~ '^/([^/\\]|$)'`) en leg de uitkomst vast in PROGRESS.

20. **[LAAG]** `docs/PROGRESS.md:6`
    - **Probleem:** "Volgende stap" staat nog op stap 0, terwijl die al gedaan is (regel 51). Technische schuld uit dit WP (D-006, D-010, de dode code) staat nog niet onder "Technische schuld".
    - **Verbetering:** bijwerken.

**Categorieën zonder (extra) bevindingen:**
- **A:** migraties, RPC's, het actiepatroon, de systeemmap, `/api/status`, de service-worker-check en `/geen-toegang` volgen het ontwerp. Afwijkingen D-001 t/m D-015 zijn vastgelegd. Geen scope creep.
- **Volgorde in de RPC's:** eerst de rechtencheck, dan de wijziging; alles in één transactie; `via_rpc` wordt netjes gezet en teruggezet. Gecontroleerd.
- **D:** geen TODO's, placeholders of mockdata in de kernflow.
- **G:** geen nieuwe N+1-queries of zware queries. Per afvinking blijft de planner een paar queries doen; dat is bestaand gedrag en WP3 pakt het aan.

### Doorgeven
- **Security-reviewer:**
  - De url-check `^/([^/\\]|$)` laat `/<TAB>/evil.com` toe. De URL-parser haalt de tab weg, waardoor `//evil.com` ontstaat. De service worker vangt dit af, maar `notifications-page.tsx:64` doet `router.push(n.url)`. Er voegt alleen het systeem meldingen in, dus het risico is klein.
  - De RPC's doen `select … for update` vóór de rechtencheck. Daardoor kan een lid van een ander huishouden rijen locken. Ze geven ook P0002 tegenover 42501 terug, zodat af te leiden is of een uuid bestaat.
  - `serverEnv.serviceRoleKey` is overal te importeren. De ESLint-regel dekt alleen `admin-client`.
  - Controleer of `takenlijstje.via_rpc` via PostgREST niet door een gebruiker te zetten is.
  - De CSRF-check van `/api/outbox` staat naast `SITE_URL` ook de origin van `request.url` toe, en een 403 leidt tot verwijderen van de entry.
  - Onderdeel van B-04: de impact van `alter default privileges`, afhankelijk van welke rol de migratie op live uitvoert.
- **Test-writer:**
  - Plaats de DB-tests (bevinding 1).
  - Unit: `migrateOutboxEntry` (v0, v1, toekomstige versie, onbekende soort, v0 `shoppingAdd` zonder id); `postOutbox` (401, 5xx, HTML-antwoord, JSON per code); `toFailure` en `expectRows` (0 rijen geeft FORBIDDEN; AC-033); `internalUrl` in de SW (AC-018).
  - Integratie: `POST /api/outbox` (401 in JSON, CSRF-weigering, content-type, dubbele entry geeft één registratie); AC-004 en AC-009 (`updateTaskAction` scope future door Lynn: FORBIDDEN en niets veranderd); AC-024 en AC-029.
  - E2E: AC-023 (Kai uitgezet → `/geen-toegang`, IDB leeg); AC-031 (uitloggen wist IDB, pagecache en push); AC-032; v0-entry in IDB → precies één registratie.
  - Regressietests voor bevindingen 2, 3, 7 en 8.
- **Performance-reviewer:** niets (WP1 staat niet in de performance-matrix).

### Vragen voor de hoofdsessie
- Zijn de migraties `_100` en `_110` al op live toegepast? PROGRESS zegt daar niets over, en TD §12.3 eist eerst `test:db` en E2E groen, plus de reviews.
- Zijn de bestaande E2E-tests (`tests/e2e/tasks.spec.ts`, `onboarding.spec.ts`) na deze wijziging gedraaid op de lokale stack? TD §12.3.1 eist dat per WP op `main`.
- D-013 kiest bij `occurrence_date` voor TD §5.2, boven de tekst van AC-014. Beide documenten zijn bevroren. Hoort dit niet als wijzigingsverzoek in PROGRESS, zodat AC-014 formeel wordt gelijkgetrokken, in plaats van alleen in DECISIONS?
- `/geen-toegang` mist de link naar "Account verwijderen" uit AC-023. Die functie bestaat pas in WP7. Graag expliciet vastleggen dat dit deel van AC-023 in WP7 wordt afgerond.

### Conclusie
**NO-GO.** Eerst punt 1: de databasetests in de repository zijn rood, en de nieuwe rechtentests staan niet in git. Daarna punten 2 t/m 9 (GEMIDDELD): herstellen, of per punt een expliciete beslissing van Jurgen, omdat het niveau 2 is. De kern zit goed in elkaar: rechten in de database, RPC's met eerst de rechtencheck, de service role alleen in `src/server/system`, en de testsuite van de test-writer is groen op de gecommitte migraties. Zodra de tests in de repo staan en de GEMIDDELD-punten zijn afgehandeld, verwacht ik GO.
