## Code-review (herreview): WP1 — herstel in e271b26 … 34f1703

**Beoordeeld:** `git diff 0d453bc 34f1703 -- src supabase public eslint.config.mjs next.config.ts`, 30 bestanden. Daarnaast DECISIONS D-016…D-031, PROGRESS (W-01, W-02, technische schuld, stap 0) en `supabase/tests/20_rechten_br.sql`, voor zover het de herstelpunten raakt.

**Lint, typecheck en tests:**
- `tsc --noEmit`: groen.
- `eslint src`: groen.
- `vitest`: groen (7 bestanden, 110 tests). Het aantal is ongewijzigd, er zijn dus geen nieuwe unit-tests bij gekomen.
- `supabase/tests/run.sh`: zelf gedraaid in een eigen database, daarna weer opgeruimd. Uitkomst: "✓ Alle databasetests geslaagd".
- E2E 9/9: niet zelf gedraaid, ik neem de melding van de coördinator over.

### Per eerdere bevinding

| # | Status | Toelichting |
|---|---|---|
| 1 | **Opgelost** | `10_` is bijgewerkt en `20_rechten_br.sql` plus `mutatie.sh` staan in de repo. De suite is groen. |
| 2 | **Opgelost** | `store.tsx:272-282`: `queue("retry")` doet `scheduleFlush(2000)` en toont een passende tekst. `flushOutbox` probeert een netwerkfout nu ook met backoff opnieuw als `navigator.onLine` true is (`:239`, `:249`). |
| 3 | **Opgelost** | `migrate.ts:115-116` geeft `future` terug en `route.ts:67-71` antwoordt met 503 `UNSUPPORTED_VERSION`. De client behandelt 503 als `retry` (`send.ts:38`). Er is nog geen unit-test (zie H). |
| 4 | **Opgelost** | `store.tsx:96-104` doet `location.reload()` bij PGRST116, waarna de server beslist. Kleine kanttekening in N2. |
| 5 | **Opgelost** | `rejectedMessage` (`store.tsx:202-210`) toont "1 offline wijziging kon niet worden verwerkt: <titel> (<reden>)". Dat past bij AC-032. |
| 6 | **Opgelost** | `expectRows` staat nu op de genoemde plekken, met code `NOT_FOUND` waar het ontwerp dat vraagt. De uitzonderingen `markRead` en `deletePushSubscription` staan onderbouwd in D-024; akkoord. |
| 7 | **Opgelost** | `pause_series` zet `generated_until` op `least(…, p_from-1)` en `resume_series` zet hem op null (D-027). Gedekt in `20_rechten_br.sql:457-491`. |
| 8 | **Opgelost** | De reeks krijgt de id van de taak, via een upsert met `ignoreDuplicates` (D-026, `tasks.ts:218-250`). Dubbel opslaan levert nu één reeks op. Een tweede poging ziet `task.recurrence_id` en loopt dan door het pad "deze". |
| 9 | **Opgelost** | Een voorcontrole in `household.ts:297-301` weigert "reassign" vóór het invoegen. Er ontstaat geen halve actie meer. |
| 10 | **Opgelost** | `clear.ts:18-20` stuurt nu naar `registration.active ?? controller`. |
| 11 | **Opgelost** | Er is een `locked`-vlag in `cache.ts` en `outbox.ts` (D-031). Kanttekening in N3. |
| 12 | **Opgelost** | `invite-view` gebruikt `signOutSafely`, met de waarschuwing over wachtende wijzigingen. |
| 13 | **Opgelost** | Een extra `refine` in `validation.ts:121` weigert "tot" zonder "vanaf". |
| 14 | **Opgelost** | `clearOpenOccurrences`, `replanSeries`, `absentOn` en `householdToday` zijn weg, en het commentaar klopt weer. |
| 15 | **Opgelost** | Geen stil "gelukt" meer (`notifications.ts:82-85`). Het ontwerp zegt dat deze actie "vervalt". Ik accepteer dat hij tot WP7 blijft, omdat hij nu eerlijk faalt. |
| 16 | **Deels** | De dieptecontrole in `guard_member_changes` is opgelost (`_100.sql:163-166`). De losse subquery in de push-policies (`_100.sql:~400-415`) staat er nog en is niet vastgelegd. Dit is LAAG en werkt functioneel correct. |
| 17 | **Vastgelegd** | D-025; akkoord, want `expectRows` staat er nu overal bij. |
| 18 | **Vastgelegd** | Technische schuld (splitsen in WP6). |
| 19 | **Opgelost** | Live-telling: 0 van 5 meldingen wijken af (PROGRESS regel 54). |
| 20 | **Deels** | "Volgende stap" is bijgewerkt, maar de stappen (1) en (3) zijn inmiddels uitgevoerd (de tests staan in de repo). Dit is LAAG documentatie. |

### Nieuwe bevindingen in het herstel
1. **[GEMIDDELD, categorie H]** Er is nog steeds geen unit-test voor de nieuwe logica.
   - **Wat ontbreekt:**
     - `migrateOutboxEntry`, inclusief de nieuwe `future`-tak;
     - `postOutbox`;
     - `toFailure` en `expectRows` (AC-033);
     - `internalUrl` in de SW (AC-018);
     - de integratietest voor `POST /api/outbox` (TD §9.3.1 punt 6).
   - AC-017, AC-018 en AC-033 noemen "Unit" als toetslaag voor WP1.
   - **Gevolg:** de wachtrijlogica die deploys moet overleven, heeft geen regressievangnet.
   - **Verbetering:** de test-writer schrijft deze tests vóórdat WP1 als afgerond wordt gemarkeerd.
2. **[LAAG]** `store.tsx:100-102`
   - **Probleem:** bij PGRST116 volgt `location.reload()`, en bij het opstarten draait meteen een refresh (`update()` → `scheduleRefresh(300)`). Geeft de server om wat voor reden ook de pagina toch weer, dan ontstaat een herlaadlus.
   - **Wanneer:** bij de huidige RLS alleen bij een inconsistentie tussen de sessie van de server en die van de browser.
   - **Verbetering:** een eenmalige beveiliging via `sessionStorage`, of `location.assign('/')`, zoals TD §4.3 zegt.
3. **[LAAG]** `cache.ts` en `outbox.ts` (de `locked`-vlag)
   - **Probleem:** logt iemand uit terwijl hij offline is, dan faalt het POST-verzoek. De sessie blijft dan bestaan, maar de wachtrij en de cache schrijven niets meer weg tot een herlaadactie.
   - **Gevolg:** nieuwe offline acties bestaan alleen nog in het geheugen, en een herlaadactie verliest ze.
   - **Verbetering:** zet `locked` pas na een geslaagde uitlog, of hef hem op als de navigatie niet doorgaat.
4. **[LAAG]** `store.tsx:239-249`
   - **Probleem:** bij een netwerkfout terwijl de browser online is, wordt `attempts` niet verhoogd. De backoff blijft daardoor op 2 s staan: zolang de server onbereikbaar is, volgt elke 2 s een nieuwe fetch.
   - **Verbetering:** gebruik een aparte teller voor de backoff.
5. **[LAAG]** `notifications.ts:63-65`
   - **Probleem:** `expectRows` op de update van `user_preferences` komt ná de upsert van het pushabonnement. Ontbreekt de voorkeurenrij, dan staat het abonnement er wel, maar krijgt de gebruiker een fout.
   - **Wanneer:** in de praktijk maakt de trigger die rij altijd aan.
   - **Verbetering:** eerst de voorkeuren bijwerken, daarna het abonnement.
6. **[LAAG]** `shopping.ts:121-125`
   - **Probleem:** `expectRows` op archiveren komt ná het aanmaken van de nieuwe lijst en het verplaatsen van de items. Archiveren twee mensen tegelijk, dan volgt een fout na een half uitgevoerde actie.
   - Dat gedrag bestond al en wordt in WP2a vervangen door de RPC `archive_shopping_list`.
   - **Verbetering:** noteren als technische schuld tot WP2a.

**Nieuwe code die ik heb gecontroleerd, zonder fouten gevonden:**
- de migratieonderdelen: member-insertpolicy plus guard (D-016), `completed_*` bij insert en ongedaan maken alleen via de RPC (D-017), `guard_swap_changes` (D-021; `accept_swap_request` en `complete_task` blijven werken), `assert_can_manage_series` en de volgorde in `delete_task` (D-022);
- het herhaalde `revoke`-blok dekt ook de nieuwe `private`-functies;
- ESLint-regels (D-023), `system/config.ts`, cookie-opties (D-019), `next.config` headers (D-018).

### Doorgeven
- **Security-reviewer:**
  - D-016, D-017, D-021 en D-022 zijn in de code juist toegepast. Beoordeel ze inhoudelijk.
  - De ESLint-selector vangt `process.env["SUPABASE_SERVICE_ROLE_KEY"]` (met blokhaken) niet af. Dit is LAAG.
- **Test-writer:** zie nieuwe bevinding 1.
- **Performance-reviewer:** niets.

### Vragen voor de hoofdsessie
- Geldt de melding "E2E 9/9 groen" voor 34f1703? Graag het resultaat in PROGRESS vastleggen, want TD §12.3.1 vraagt dat per WP.

### Conclusie
**GO vanuit code-review voor de productiecode van WP1.** Alle 20 punten zijn opgelost of bewust vastgelegd, op twee LAAG-restjes na (16 en 20). In het herstel is geen BLOKKEREND of GEMIDDELD codeprobleem ontstaan. Voorwaarde vóórdat WP1 als afgerond wordt gemarkeerd: de test-writer sluit het ontbrekende unit- en integratiewerk (nieuwe bevinding 1, GEMIDDELD). Anders moet Jurgen dat punt expliciet accepteren. De LAAG-punten kunnen naar "Uitgestelde punten".
