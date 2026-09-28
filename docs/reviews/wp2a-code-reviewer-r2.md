## Code-review (herreview): WP2a — herstel in 7abca4c (D-037) en fe7c7da (D-038)
**Beoordeeld:** `git diff 4324a46 HEAD` op deze bestanden:
- `supabase/migrations/…_200`
- `supabase/ops/**`
- `src/server/actions/{household,shopping,tasks}.ts`
- `src/server/services/tasks.ts`
- `src/server/system/tick.ts`
- `src/lib/validation.ts`
- `src/features/tasks/task-comments.tsx`
- `src/features/invite/invite-view.tsx`

Ook nagekeken: de aanroepers van de verplichte id's (`quick-add-bar`, `new-task-dialog`, `templates-section`, `template-plan`, `invite-form`).

**Ontwerp gelezen:** DECISIONS D-036 t/m D-038; TD §3.1, §3.2, §4.5, §6 en §12.4.

**Zelf gedraaid op HEAD fe7c7da:**
- eslint: 0 fouten;
- tsc: 0 fouten;
- vitest: 202 van 202;
- `supabase/tests/run.sh` als postgres: "Alle databasetests geslaagd", inclusief `wp2a_huishouden_alleen_via_rpc`;
- `supabase/ops/m0/run.sh` in de echte volgorde oud → `_200`:
  - AC-053: gezinsleden met meldingen aan = 0, beheerders ongewijzigd = true;
  - AC-179: notities zonder schrijver = 0;
  - contract in één transactie: privacykolommen 0, meldingen met naam 0, historie 3;
  - terugzetten gaf **IDENTIEK**.
- E2E niet zelf gedraaid (58/58 volgens de hoofdsessie).

### Controle van de eerdere bevindingen
1. **[GEMIDDELD] Expand niet compatibel — opgelost.**
   - De unieke index "één actieve lijst" en de tijdzonecheck zijn uit `_200` gehaald en staan nu in `_210` (r. 232-242).
   - `restore_v2.sql` haalt ze weer weg.
   - Idempotent archiveren rust op de rijlock op `p_list_id`. Dat is voldoende, want de tweede aanroep leest de gearchiveerde rij opnieuw en geeft de actieve lijst terug.
2. **[GEMIDDELD] "Onbekend" als schrijver — opgelost.** `task-comments.tsx` toont `c.author_name`; `member_id` bepaalt alleen nog kleur, emoji en het verwijderrecht.
3. **[GEMIDDELD] Geen transactie om de ops-scripts — opgelost.**
   - `_210` en `restore_v2` staan nu in `begin … commit`.
   - Back-up en restore-check gebruiken `repeatable read`.
   - Zie de nieuwe opmerking N1 over het uitvoeren via MCP.
4. **[LAAG] M0-volgorde — opgelost.** Eerst schema tot en met `_110`, dan de seed, dan `_200`. AC-053 en AC-179 worden gecontroleerd en de uitvoer is zichtbaar.
5. **[LAAG] BR-44 zonder lock — opgelost.** `pg_advisory_xact_lock` per gebruiker in `create_household` en `accept_invitation`, op dezelfde sleutel. Er is geen risico op een deadlock: de advisory lock komt steeds vóór de rijlock op de uitnodiging.
6. **[LAAG] Race na de lock — opgelost.** `if not found …` staat nu na de `for update` in `complete_task` en `undo_complete_task`.
7. **[LAAG] "Al lid" verbruikt uitnodiging — opgelost.** De uitnodiging wordt alleen afgerond als die niet verlopen is en het e-mailadres klopt; `household_id` komt wel altijd terug.
8. **[LAAG] Back-up zonder momentopname — opgelost.** `repeatable read`, plus een opmerking dat de schemanaam in kleine letters moet.
9. **[LAAG] Tellingen in de voorcontroles — opgelost.** E-mail, avatar, eigen standaardtaken met punten en `assignment_reason` worden nu geteld.
10. **[LAAG] `activeList` slikt fouten in — opgelost.** Alleen bij 23505 wordt opnieuw gezocht; andere fouten worden doorgegeven, en "niet gevonden" geeft de oorspronkelijke fout.
11. **[LAAG] Client-id's optioneel — opgelost.**
    - `id`, `recurrence.recurrenceId`, de `recurrenceId` van standaardtaken en de `id` van uitnodigingen zijn verplicht in zod.
    - Alle aanroepers sturen ze mee.
    - `taskUpdateInput` gebruikt het basis-`recurrenceInput` zonder id; dat klopt, want voor "losse taak wordt terugkerend" wordt `task.id` gebruikt.
12. **[LAAG] Ongedaan maken in de oude UI — bewust vastgelegd** in D-037 (AC-051 hoort bij WP2 en WP8). Geaccepteerd.
13. **[LAAG] Policy voor leden zonder account — opgelost.** Die vervalt in `_210` en wordt in `restore_v2` teruggezet.

### Nieuwe wijzigingen
- **`drop policy "households: beheerder verwijdert"`** (`_200`): correct.
  - Code op 48acc79 en HEAD verwijdert nergens rechtstreeks een huishouden.
  - `delete_household` is security definer en werkt dus via cascade.
  - Terugrollen blijft mogelijk.
  - `restore_v2` hoeft de policy niet terug te zetten, want die is al in `_200` vervallen.
- **Revoke van `delete_my_account` tot WP7:** correct. Hij staat in de revoke voor `public` en `anon`, niet in de grant, en krijgt een expliciete revoke voor `authenticated`. Geen code roept hem aan. WP7 moet de grant toevoegen; zet dat in PROGRESS als technische schuld.
- **Lock op het huishouden in `delete_my_account`:** correct.
  - Twee beheerders tegelijk: de tweede wacht op de lock.
  - Daarna ziet de telling (nieuw statement, read committed) dat de eerste weg is en weigert.
- **Verplichte client-id's:** zie punt 11.
- **`activateTemplates` plant alleen wat werkelijk is aangemaakt:** correct via `upsert … ignoreDuplicates … select("id")`. Die geeft alleen ingevoegde rijen terug. Zie N2 voor het randgeval.
- **Tekst uitnodigingspagina:** "plannen en afvinken", zonder "verdelen" (V-21). Correct.
- **D-036** (eerder bekeken): correct.

### Nieuwe bevindingen
- **N1 [LAAG]** `supabase/ops/wp2b/20260928000210_scope_contract.sql:13-15`: de instructie luidt "via MCP apply_migration begin/commit weglaten".
  - Het destructieve script moet dan op het moment van uitvoeren met de hand worden aangepast. Een vergeten `commit` binnen `apply_migration` sluit de transactie te vroeg.
  - Verbetering: leg de uitvoerroute voor M6 in het draaiboek vast. Voorkeur: `execute_sql` met het bestand zoals het is, of psql. Zo hoeft er niets aan het bestand te worden gewijzigd.
- **N2 [LAAG]** `src/server/actions/household.ts:202-207`: dubbel activeren plant bij de tweede aanroep niets meer in.
  - Mislukt `topUp` bij de eerste aanroep (het faalt stil, met een logregel), dan herstelt een nieuwe poging dat niet meer.
  - Tot WP3 draait de tick maar één keer per dag (05:30), dus een nieuwe reeks kan tot de volgende ochtend zonder taken staan.
  - `createTask` doet wel altijd `topUp` op `recurrenceId`; dat is inconsistent.
  - Verbetering: bij een herhaald verzoek `topUp` doen voor de id's die al bestaan in het eigen huishouden. `topUp` filtert zelf op `household_id` en voegt alleen in, dus dat is veilig. Of accepteren tot WP3 (planner elke 15 min).

**Per categorie:**
- **A (ontwerp):** in orde.
- **B (logica):** N2.
- **C (foutafhandeling):** in orde.
- **D (halve implementaties):** gecontroleerd, niets gevonden.
- **E (consistentie):** N2 (verschil tussen `createTask` en `activateTemplates`).
- **F (onderhoud):** technische schuld: de grant van `delete_my_account` in WP7, en `_210` naar `migrations/` in WP2b.
- **G (prestaties):** in orde.
- **H (tests):** DB-suite, gelijktijdigheid, upgrade en M0 dekken de herstelpunten. Zie "Doorgeven".

### Doorgeven
- **Security-reviewer:** niets nieuws. De revoke van `delete_my_account` en de gedropte delete-policy op `households` zijn in lijn met hun eerdere punten.
- **Test-writer:** een regressietest voor N2, als die wordt hersteld: eerste `topUp` mislukt, tweede activering → uitvoeringen staan er.
- **Performance-reviewer:** niets.

### Vragen voor de hoofdsessie
- N2: herstellen of accepteren tot WP3?
- De grant van `delete_my_account` in WP7 als technische schuld in PROGRESS zetten.

### Conclusie
**GO**: de drie GEMIDDELD-punten en alle LAAG-punten zijn opgelost of bewust vastgelegd. De twee nieuwe punten (N1 en N2) zijn LAAG en kunnen in PROGRESS onder "Uitgestelde punten".
