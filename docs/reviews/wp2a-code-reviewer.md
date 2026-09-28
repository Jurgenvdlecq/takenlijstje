## Code-review: WP2a (scope uit de code + expand), commits d09c285, bc4f20f, 4324a46 en 33757f2 (D-036)

**Beoordeeld:** `git diff 48acc79 HEAD -- src supabase scripts vercel.json`, zonder testbestanden. Volledig gelezen:
- `supabase/migrations/20260928000200_scope_expand.sql`
- `supabase/ops/**`: `_210`, precheck, back-up, restore-check, restore en m0
- de acties `tasks.ts`, `household.ts` en `shopping.ts`
- `services/tasks.ts`, `context.ts`, `dispatcher.ts`, `tick.ts`, `reminders.ts`, `outbox/migrate.ts` en `api/outbox/route.ts`
- `mutations.ts`, `store.tsx`-diff, `snapshot.ts`, `validation.ts`, `scripts/seed.ts` en `vercel.json`
- de oude code op 48acc79 voor de compatibiliteit

**Ontwerp gelezen:**
- TECHNICAL_DESIGN §3.1–3.3, §4.5–4.6, §5, §6, §7, §8, §9.3.1, §12.3.1, §12.4 en §15;
- ACCEPTANCE_CRITERIA AC-034…062, 073, 178 en 179;
- UX §4.8, §4.9 en §4.11;
- DECISIONS D-034, D-035 en D-036;
- PROGRESS.

**Lint, typecheck en tests (op HEAD 04a9012):**
- `npx eslint src`: 0 fouten.
- `npx tsc --noEmit`: 0 fouten, ook in de testbestanden.
- `npx vitest run`: 12 bestanden, 202 van 202 geslaagd.
- `bash supabase/ops/m0/run.sh` als postgres: geslaagd. De restore-test en het terugzetten gaven 17 van 17 tabellen identiek, privacykolommen 0, meldingen met naam 0.
- Eigen extra proef in `takenlijstje_m0`: oud schema tot en met `_110` + `seed_oud.sql`, daarna pas `_200`.
  - AC-053 klopt: Lynn had herinneringen en "taak gedaan" aan en heeft na `_200` alles uit; de voorkeuren van de beheerders zijn ongewijzigd.
  - AC-179 klopt: de notities krijgen "Ellen" en "Kai", ook bij Kai als lid zonder account.
  - De database `takenlijstje_m0` staat nu in die proefstand; `run.sh` maakt hem opnieuw aan.
- DB-tests (`supabase/tests/run.sh`) heb ik niet gedraaid: de test-writer is die aan het bijwerken.

### Bevindingen

1. **[GEMIDDELD]** `supabase/migrations/20260928000200_scope_expand.sql:289-290`: de expand-migratie is niet volledig compatibel met de vorige code.
   - De unieke index "één actieve lijst" breekt de oude `archiveShoppingListAction` (48acc79 `src/server/actions/shopping.ts:113-124`). Die maakt eerst de nieuwe lijst aan en archiveert pas daarna de oude, dus de insert faalt altijd met 23505.
   - Kleiner punt: de check `households_timezone_amsterdam` (r. 381) laat het oude tijdzoneveld in de instellingen falen zodra iemand een andere zone kiest.
   - Gevolg: in het venster tussen `_200` op live en de deploy (§12.3.1 stap 2→3), en bij elke Instant Rollback tussen M2 en M6, werkt "Klaar met winkelen" in de oude app niet. TD §3.2 en §12.4 beloven juist dat terugrollen tussen M2 en M6 werkt.
   - Verbetering: verplaats de index naar `_210`. De RPC geeft zelf al idempotentie via de rijlock op `p_list_id`, en M1(c) controleert vooraf. Of leg de incompatibiliteit vast in DECISIONS en in de rollback-tekst, en deploy direct na de migratie.

2. **[GEMIDDELD]** `src/features/tasks/task-comments.tsx:90-97`: de oude UI toont de schrijver via `snapshot.members` en valt terug op "Onbekend".
   - Sinds WP2a filtert `src/lib/data/snapshot.ts:58-65` leden zonder account weg. Notities van bijvoorbeeld Kai (zonder account) tonen nu "Onbekend", terwijl `author_name = "Kai"` in de database staat.
   - Dit gaat in tegen TD §3.1 ("De UI toont altijd `author_name`") en AC-062. Het is een zichtbare terugval die door deze WP is ontstaan.
   - Verbetering: toon `c.author_name`, en laat `member_id` alleen nog bepalen of de gebruiker de notitie mag verwijderen.

3. **[GEMIDDELD]** `supabase/ops/wp2b/20260928000210_scope_contract.sql` (hele bestand) en `supabase/ops/restore_v2.sql`: geen expliciete `begin; … commit;`.
   - TD §12.4 M6 eist "in één transactie". Of dat gebeurt, hangt nu af van hoe het script wordt uitgevoerd: MCP `apply_migration` is wel één transactie, `psql -f` (zoals in M0) niet.
   - Gevolg: een fout halverwege laat een half gewist schema achter. `restore_v2.sql` gaat uit van een volledig uitgevoerde contract-stap en faalt dan ook. Dat is bij een destructief script een risico op dataverlies.
   - Verbetering: zet beide scripts in `begin; … commit;` en draai ze in M0 met `psql -1` of `--single-transaction`.

4. **[LAAG]** `supabase/ops/m0/run.sh:17`: M0 past alle migraties inclusief `_200` toe **vóór** de seed.
   - De omzetting van bestaande gegevens (AC-053, AC-179, timezone-check en index op bestaande rijen) wordt daardoor in M0 niet beproefd; TD §12.4 M0 vraagt dat wel. Mijn eigen proef hierboven laat zien dat het correct werkt, maar dat bewijs staat niet in het script.
   - Daarnaast verbergt `2>/dev/null` de foutmeldingen van migraties.
   - Verbetering: eerst migraties tot en met `_110`, dan de seed, dan `_200`, met controles op AC-053 en AC-179. Laat stderr zichtbaar.

5. **[LAAG]** `_200` `create_household` (r. 404) en `accept_invitation` (r. 471): de BR-44-check is een `exists` zonder lock.
   - Tot `_210` bestaat er geen `unique (user_id)`. Twee gelijktijdige verzoeken (dubbeltik bij de onboarding) kunnen dus twee lidmaatschappen maken. M1(a) blokkeert daarna M6.
   - Verbetering: `perform pg_advisory_xact_lock(hashtext(v_user::text))` vóór de check, in beide RPC's.

6. **[LAAG]** `_200` r. 52-60 (`complete_task`) en r. 137-145 (`undo_complete_task`): tussen de select zonder lock en de `for update` kan de taak hard verwijderd worden.
   - De tweede `select into` geeft dan nulls, zonder foutcontrole. Afvinken faalt dan met een onduidelijke 23502 in plaats van "Taak niet gevonden"; terugdraaien geeft een lege rij terug.
   - Verbetering: `if not found then raise … 'P0002'` na de `for update`.

7. **[LAAG]** `_200` r. 449-459 (`accept_invitation`, pad "al lid"): de uitnodiging wordt als geaccepteerd gemarkeerd, ook als die verlopen is of voor een ander e-mailadres bedoeld was.
   - Gevolg: een beheerder die zijn eigen link test, verbruikt de uitnodiging voor de echte ontvanger.
   - Verbetering: in dit pad alleen `household_id` teruggeven, en afronden alleen als de uitnodiging geldig is en het e-mailadres klopt. AC-047 zegt "alleen afronden", zie de vraag hieronder.

8. **[LAAG]** `supabase/ops/backup_v2.sql` en `restore_check_v2.sql`: tabellen worden per statement gekopieerd en gemeten, zonder één snapshot.
   - Gevolg: bij gebruik tijdens het kopiëren ontstaat een back-up die tussen tabellen niet consistent is, of een onterechte afwijking in M4.
   - Verbetering: `begin transaction isolation level repeatable read; … commit;`. Vermeld ook dat de schemanaam in kleine letters moet: `create schema __BACKUP__` wordt naar kleine letters omgezet, `format('%I')` niet.

9. **[LAAG]** `supabase/ops/precheck_v2.sql` (deel e): een aantal aantallen voor Jurgen ontbreken (BR-46.3, "exacte aantallen").
   - leden met `email` (dat is een persoonsgegeven) en met `avatar_url`;
   - eigen standaardtaken met `points`;
   - taken met alleen `assignment_reason`.
   - Verbetering: deze tellingen toevoegen.

10. **[LAAG]** `src/server/actions/shopping.ts:17-23` (`activeList`): elke insertfout wordt stil vervangen door een nieuwe `find()`.
    - Gevolg: vindt die niets, dan volgt een `null` en een TypeError, en is de oorspronkelijke fout (bijvoorbeeld RLS) verdwenen.
    - Verbetering: alleen bij 23505 opnieuw zoeken, anders `throw inserted.error`.

11. **[LAAG]** `src/lib/validation.ts:42,164`, `services/tasks.ts:38,90` en `actions/household.ts:134,186`: `id` en `recurrenceId` zijn optioneel, met een willekeurige id op de server als terugval.
    - TD §6.1 noemt ze verplicht. Een aanroeper zonder id verliest stil zijn idempotentie (R-03).
    - Verbetering: in zod verplicht maken (alle huidige clients sturen ze al mee), of vastleggen in DECISIONS.

12. **[LAAG]** `src/features/shopping/shopping-page.tsx:59-65`: "Ongedaan maken" na "Lijst afgerond" is nieuwe functionaliteit in de oude UI.
    - §12.3.1 zegt "alleen verwijderen, niets herontwerpen"; die UI hoort bij WP8. Het is klein en onschadelijk.
    - Verbetering: vastleggen in DECISIONS, of weghalen tot WP8.

13. **[LAAG]** `_210`: de policy `"members: beheerder voegt toe"` (`user_id is null`) blijft bestaan.
    - Na `user_id not null` is die dood, en tot M6 kan een beheerder via de API nog leden zonder account maken.
    - Verbetering: in `_210` droppen (staat ook onder "Doorgeven").

**Per categorie:**
- **A (ontwerp):** buiten 1, 2, 3, 11 en 12 klopt het.
  - Toewijzing, ruilen, afwezigheid, punten, "namens", `completed_by` en `added_by`/`bought_by` zijn uit server, domein, store, mutaties en schermen. Een grep op `src` vindt alleen nog `src/integrations/types.ts:49` (opruimen in WP9) en het obsolete-label.
  - "Taak gedaan" gaat via `recipientsFor` naar ieder actief lid met account en met de voorkeur aan, ook de afvinker, zonder naam en met dedupe `completed:<id>`. De tickteksten zeggen "Vandaag staan er N taken" en "Er staan nog N taken open", zonder "voor jou".
  - De overloads in PostgREST zijn ondubbelzinnig: oude aanroepen met `p_completed_by` → oude signatuur, nieuwe zonder → v2. `accept_swap_request` blijft tot `_210`.
  - `delete_household` en `delete_my_account` volgen TD §4.5/§4.6: actieve beheerder plus exacte naam, zoeken op `user_id`, BR-24, een no-op zonder lidmaatschap, en via de RPC-vlag langs de guard.
  - Archive en unarchive zijn idempotent (rijlock, tweede aanroep → actieve lijst; tweede undo → no-op).
  - `OUTBOX_VERSION = 2` en `migrateOutboxEntry`: `assign` → DISCARDED_OBSOLETE met label "toewijzen"; bij `complete` uit v0/v1 valt `completedBy` weg. Niets wordt stil weggegooid.
  - `vercel.json` klopt met D-035.
  - De D-036-wijzigingen zijn correct: vooraf filteren met dezelfde `recipientsFor`, en `topUp` en `notify` vangen allebei hun eigen fouten op, dus `Promise.all` is veilig.
- **B (logica en randgevallen):** zie 5, 6 en 7.
- **C (foutafhandeling):** zie 10.
- **D (halve implementaties):** gecontroleerd, niets gevonden in de kernflow.
- **E (consistentie en duplicatie):** gecontroleerd, niets gevonden. `recipientsFor` wordt hergebruikt in dispatcher en tick.
- **F (onderhoudbaarheid):** `supabase/ops/restore_v2.sql` telt 580 regels, maar dat is een eenmalig ops-script en dus acceptabel. Technische schuld voor PROGRESS: punten 4, 8 en 13.
- **G (prestaties):** de tick doet nog per taak, per lid en per melding een aparte `notify` (twee queries per aanroep). Dit wordt al gedekt door de performance-review en WP3 (set-gebaseerde tick).
- **H (tests):** zie "Doorgeven".

### Doorgeven
- **Security-reviewer:**
  - de insert-policy `"members: beheerder voegt toe"` (`user_id is null`) blijft actief tot WP2b (punt 13);
  - het pad "al lid" in `accept_invitation` slaat de controle op e-mailadres en vervaldatum over (punt 7);
  - `guard_comment_changes` laat bij diepte > 1 elke triggerketen door (bedoeld voor sync en FK); graag bevestigen;
  - het back-upschema: rechten en blootstelling via de API.
- **Test-writer:**
  - AC-053 en AC-179 op een kopie van het **oude** schema (seed vóór `_200`, zie punt 4);
  - AC-050 en AC-051 inclusief gelijktijdigheid en een tweede undo;
  - een integratietest voor AC-073 (Jurgen en Ellen aan, Lynn uit, Kai uitgezet; afvinker krijgt de melding; dubbel afvinken geeft één melding per ontvanger);
  - de overload: een aanroep met `p_completed_by` gebruikt de oude signatuur en schrijft geen persoon (AC-034 tot M6);
  - AC-178 (a en b, ook voor een beheerder);
  - AC-062 (verwijderd lid: `member_id` wordt null, de naam blijft);
  - BR-44 in `create_household` en `accept_invitation` (AC-046), plus de paden "al lid", verlopen en ander e-mailadres (AC-047);
  - `delete_household`: verkeerde naam, gezinslid, tweede aanroep → NOT_FOUND;
  - `delete_my_account`: enige beheerder, uitgezet lid, zonder lidmaatschap;
  - de tick-filter uit D-036;
  - regressietests voor punt 1 (oude archiveervolgorde, of vastgelegd als geaccepteerd) en punt 2 (weergave van `author_name`).
- **Performance-reviewer:** niets nieuws; de tick staat al voor WP3.

### Vragen voor de hoofdsessie
- Punt 7: moet het pad "al lid" van `accept_invitation` de uitnodiging echt als geaccepteerd markeren als die voor een ander e-mailadres bedoeld was of verlopen is? AC-047 zegt "alleen afronden"; dat verbruikt een link die voor iemand anders bedoeld was.
- Punt 1: kies je voor de index in `_210`, of voor een vastgelegde incompatibiliteit bij terugrollen? Dat raakt de belofte in TD §12.4.
- Volgens §12.3.1 zijn voor WP2a nog open: oude E2E groen en rook-screenshots van de oude schermen, branch `v2-ui`, en M1/M2 op live. Dat heb ik niet beoordeeld.

### Conclusie
**NO-GO: eerst punt 1, 2 en 3.** Er is geen blokkerende bevinding en lint, typecheck, unit-tests en M0 zijn groen. Maar de expand-stap breekt het terugrollen voor "Klaar met winkelen", de oude UI toont "Onbekend" als schrijver, en de destructieve scripts staan niet gegarandeerd in één transactie. Alle drie zijn kleine herstellingen, en daarna volgt een herreview van alleen die punten.
