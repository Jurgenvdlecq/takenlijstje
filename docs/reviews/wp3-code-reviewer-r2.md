## Code-review (herreview): WP3 na herstel (2429603..HEAD)

**Beoordeeld:** de diff op src, supabase, vercel.json, package.json en README. Volledig gelezen: `tick.ts`, `scheduling.ts`, `web-push.ts`, `dispatcher.ts` (diff), `push-endpoints.ts`, `cron-auth.ts`, `actions/tasks.ts` (diff) met de aanroeper `api/outbox/route.ts`, `…_220_undo_hercontrole.sql` (vergeleken met de versie in `_210`), `…_300_retentie.sql` (diff), `…_310_push_endpoint_check.sql`, `ops/planner.sql` en `ops/restore_v2.sql`. Tests heb ik alleen op zinvolheid bekeken: de routetest, push-endpoints, de E2E-test voor AC-073 en `60_push_endpoint.sql`.

**Ontwerp en rapporten gelezen:** mijn eerdere rapport, D-040 t/m D-043, PROGRESS (livestatus, Uitgestelde punten, Technische schuld) en de conclusies van security r1/r2, performance en test-writer r2.

**Lint/typecheck/tests:**
- tsc: groen.
- lint: 0 fouten; 5 waarschuwingen, alle buiten deze wijziging.
- vitest unit: 327/327, zelf gedraaid.
- Integratie, DB-suite, mutatie en E2E heb ik niet zelf gedraaid; daarvoor gaat dit rapport uit van jouw opgave.
- Eigen proef: de allowlist-regex uit TS (node) en uit SQL (psql) op dezelfde invoer gedraaid (zie punt N1).

### Eerdere punten 1–14
1. **Opgelost.** `scheduling.ts:254-265`: de update werkt alleen op taken die nog `todo`/`in_progress` zijn en niet verwijderd. De telling komt uit `.select("id")`.
2. **Opgelost.** `route.ts:21` geeft 500 bij een niet-lege `failed`; getest in `route.test.ts:84-95` en vastgelegd in D-041.
3. **Opgelost.** De tests staan er. Het nummer van de retentietest is `50_retentie.sql`, niet 40.
4. **Opgelost.** De allowlist geldt bij opslaan (zod), bij versturen (`sendPush`) en in de database (CHECK in `_310`). Security r2 gaf GO. Zie N1 voor een klein verschil tussen TS en SQL.
5. **Deels opgelost.** `generated_until` wordt nu optimistisch bijgewerkt per (oude, nieuwe) waarde en de groepering klopt. Maar taken volgens de oude regel, die de tick net heeft ingevoegd, blijven staan (zie N2).
6. **Bewust vastgelegd** in D-041 en in het commentaar bij `selectAll`.
7. **Opgelost.** Een try/catch per reeks, met alleen een telling in de log.
8. **Opgelost.** De deadline wordt ook per toestel gecontroleerd. De time-out van de laatste push is begrensd op budget + 5 s. Een onvolledig afgehandelde melding krijgt geen `pushed_at`.
9. **Opgelost.** `configure()` staat nu binnen de try.
10. **Opgelost in de dispatcher.** Dezelfde fout bestaat nog in `WebPushChannel.deliver` (zie N3).
11. **Opgelost.** De betekenis "afgehandeld" staat in D-041.
12. **Opgelost.** Vastgelegd in D-041.
13. **Opgelost.** `READ_AHEAD_DAYS = 7` past bij het maximum van 10080 minuten in de validatie. Deadline-waarschuwingen van hooguit 2880 minuten vallen daar binnen.
14. **Deels opgelost.** De `Pick` en `HOUSEHOLD_TIMEZONE` zijn gedaan. `households` wordt nog twee keer gelezen en `sendDueMessages` is ongeveer 140 regels. Dat staat niet onder Uitgestelde punten (zie N6).

### Gecontroleerd en in orde (nieuwe onderdelen)
- **`after()` in `completeTaskAction`:**
  - Werkt in server actions en in route handlers (Next 16.3.6), dus ook via `/api/outbox`. De E2E-test voor AC-073 (`wp2a.spec.ts:252-283`) loopt via `postOutbox` en wacht op de melding.
  - `notify` vangt al zijn fouten zelf af. `after` draait ook als `topUp` daarna faalt; dat is juist, want de afvinking is dan al vastgelegd.
  - De testmelding (`notifications.ts:85`) wacht bewust wel op `notify`.
- **Chunks:** alle id-lijsten (overslaan, `pushed_at`, horizon) gaan in blokken van 200. Een lege lijst levert geen verzoek op.
- **500-antwoord:** de body bevat alleen tellingen en codes. De tick is idempotent, dus een herhaling is veilig.
- **`vercel.json` `regions: ["fra1"]`:** geldig, en vastgelegd in D-043.
- **`_220`:** gelijk aan de versie in `_210`, plus de hercontrole na de lock (`not found or deleted_at`). Bij `create or replace` blijven de grants behouden. `_300` staat nog niet op live, dus aanpassen mocht.
- **Purge van huishoudens zonder leden:**
  - `create_household` voegt huishouden en beheerder in één transactie in (`_200:418-423`), dus er is geen venster waarin een nieuw huishouden leeg is.
  - Leden zonder account tellen als lid.
  - Huishoudens zonder actieve beheerder worden alleen geteld en gelogd.
- **`restore_v2`:** de `pg_temp`-functies worden schemagekwalificeerd aangeroepen. Leden worden teruggezet vóór de eerste `lid()`-aanroep. `rotation_member_ids` is `not null default '{}'`, dus een lege `array()` is geldig.
- **`cron-auth`:** SHA-256 op beide kanten, daarna `timingSafeEqual`. Correct.
- **Categorie D:** gecontroleerd, geen TODO's, placeholders of verborgen terugvallen gevonden.

### Nieuwe of resterende bevindingen
N1. [LAAG] `src/lib/push-endpoints.ts:68` tegenover `supabase/migrations/20260929000310_push_endpoint_check.sql:651/657` — de twee regexen zijn niet gelijk, terwijl het commentaar dat wel zegt.
   - Mijn proef: `[^\s…]` in JS en `[^[:space:]…]` in Postgres geven een andere uitkomst voor Unicode-witruimte in het pad. De SQL-kant accepteert U+00A0 (NBSP) en U+FEFF; de TS-kant weigert ze. Bij U+0085 accepteren beide.
   - Gevolg: een rechtstreekse REST-insert met zo'n endpoint komt door de CHECK, en de tick verwijdert het abonnement daarna bij het versturen. Geen securitygevolg (de host blijft vast), wel een onjuiste garantie. Welke tekens `[:space:]` omvat, hangt bovendien af van de locale van de database op live.
   - Verbetering: in beide een expliciete ASCII-klasse voor het pad (bijvoorbeeld `[A-Za-z0-9._~:/?#@!$&()*+,=%-]*`). Plus één pariteitstest die dezelfde lijst endpoints door TS en door de DB-suite haalt.

N2. [LAAG] `src/server/services/scheduling.ts:193-213` — het restant van punt 5.
   - Het optimistisch bijwerken voorkomt alleen dat `generated_until` wordt teruggezet. Draait `clear_series_occurrences` (reeks wijzigen) tussen het lezen van de reeksen en de upsert, dan voegt de tick toch uitvoeringen volgens de oude regel in. Die blijven staan, naast die van de nieuwe regel.
   - D-041 schrijft het op alsof het is opgelost. Het venster is klein (enkele honderden ms).
   - Verbetering: het restrisico expliciet in D-041 zetten. Of: `.select("id")` op de horizon-update, en voor reeksen die niet zijn bijgewerkt de zojuist ingevoegde open taken verwijderen.

N3. [LAAG] `src/server/system/channels/web-push.ts:113` — `WebPushChannel.deliver` leest de abonnementen nog met `{ data: subscriptions }` zonder `check`. Dat is dezelfde categorie als punt 10.
   - Gevolg: een mislukte query betekent stil geen push voor "taak gedaan" en de testmelding, zonder logregel.
   - Verbetering: `check(...)` gebruiken, zodat de catch van `notify` de fout logt.

N4. [LAAG] `supabase/ops/planner.sql:41-44` — het https-filter maakt een verkeerde URL in Vault een stille no-op.
   - Gevolg: er komt geen verzoek en geen fout in `cron.job_run_details`. Alleen de afwezigheid van rijen in `net._http_response` verraadt het, en de tick valt terug op het dagelijkse Vercel-vangnet.
   - Verbetering: het commando als `DO`-blok dat een fout geeft als de URL niet met `https://` begint. Of deze controle expliciet opnemen in de livecontrole (L-query's).

N5. [LAAG] `supabase/ops/restore_v2.sql:111` — `array(select x from unnest(b.rotation_member_ids) x where …)` zonder `with ordinality … order by`.
   - Gevolg: de volgorde van de rotatie is formeel niet gegarandeerd, en die volgorde bepaalt wie aan de beurt is.
   - Verbetering: `unnest(...) with ordinality as u(x, n) … order by n`.

N6. [LAAG] Documentatie.
   - De resten van punt 14 staan niet onder "Uitgestelde punten": `households` twee keer gelezen (`scheduling.ts:140`, `tick.ts:116`) en `sendDueMessages` van ongeveer 140 regels (`tick.ts:115-257`).
   - `docs/PROGRESS.md:136` noemt de push-endpoint-allowlist (WP3) nog als open technische schuld.
   - Verbetering: beide bijwerken.

N7. [LAAG] Testisolatie. `tests/integration/tick.test.ts` roept `runTick` aan, en daarmee de purge van álle huishoudens zonder leden in de testdatabase. `tests/e2e/wp2a.spec.ts:341` maakt juist zo'n huishouden aan ("Buren E2E").
   - Gevolg: draaien integratie en E2E tegelijk op dezelfde stack, dan kan de E2E-test af en toe falen. Geen productiefout.
   - Verbetering: de suites na elkaar draaien, of het testhuishouden een lid geven.

Categorieën:
- A (ontwerp): in orde; afwijkingen staan in D-041 t/m D-043.
- B (logica en randgevallen): N2.
- C (foutafhandeling): N3, N4.
- D (halve implementaties, verborgen gedrag): niets gevonden.
- E (consistentie en duplicatie): N1.
- F (onderhoudbaarheid): N5, N6.
- G (basisperformance): gecontroleerd, niets nieuws. De chunks, de index `notifications_task_idx` en `fra1` zijn verbeteringen. Het leesvenster van 7 dagen vergroot de lus taken × leden licht; op gezinsvolume is dat verwaarloosbaar.
- H (tests): in orde. Alleen de pariteitstest uit N1 ontbreekt, en N7.

### Doorgeven
- **Security-reviewer:** N1 (de SQL-CHECK is ruimer dan de TS-regel voor Unicode-witruimte in het pad; geen hostomzeiling) en N4 (stille no-op bij een verkeerde URL in Vault). Beide ter informatie, niet blokkerend.
- **Test-writer:**
  - pariteitstest van de allowlist in TS en SQL, met NBSP, U+FEFF en U+2028 in het pad (N1);
  - regressietest voor `WebPushChannel.deliver` bij een mislukte query, zodra N3 is hersteld;
  - zorgen dat integratie en E2E niet tegelijk op dezelfde stack draaien (N7).
- **Performance-reviewer:** Niets.

### Vragen voor de hoofdsessie
- Wordt het restrisico van N2 (oude-regeltaken bij een race met "reeks wijzigen") bewust geaccepteerd en in D-041 vastgelegd, of hersteld?

### Conclusie
**GO.** Alle punten 1–14 zijn opgelost of bewust vastgelegd; alleen 5 en 14 zijn deels opgelost (N2 en N6), en die waren LAAG. Het herstel bracht geen BLOKKEREND of GEMIDDELD probleem mee. De zeven LAAG-punten (N1–N7) kunnen in een kleine herstelronde, of onder "Uitgestelde punten" in `docs/PROGRESS.md`.

Relevante bestanden:
- /home/user/takenlijstje/src/lib/push-endpoints.ts
- /home/user/takenlijstje/supabase/migrations/20260929000310_push_endpoint_check.sql
- /home/user/takenlijstje/src/server/services/scheduling.ts
- /home/user/takenlijstje/src/server/system/channels/web-push.ts
- /home/user/takenlijstje/src/server/system/tick.ts
- /home/user/takenlijstje/supabase/ops/planner.sql
- /home/user/takenlijstje/supabase/ops/restore_v2.sql
- /home/user/takenlijstje/docs/PROGRESS.md

NB: een eerdere controleopdracht van mij in de achtergrond (id `bpwqtneez`, een psql-aanroep die op invoer wachtte) kan nog hangen. Hij schrijft niets en mag worden afgebroken.
