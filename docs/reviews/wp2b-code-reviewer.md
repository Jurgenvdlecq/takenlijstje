## Code-review: WP2b (contract-migratie …_210, M3–M6, testupdates), diff 27c24c3..HEAD
**Beoordeeld:** `supabase/migrations/20260928000210_scope_contract.sql`, `supabase/ops/m0/run.sh`, `supabase/tests/{10_,20_,30_wp2a,40_wp2b}.sql`, `upgrade/{voor_200,na_200,na_210}.sql`, `gelijktijdig.sh`, `mutatie.sh`, `run.sh`, het verwijderde `bevindingen/`-bestand, `tests/e2e/tasks.spec.ts`, `tests/e2e/wp2a.spec.ts`, `src/domain/__tests__/reminders-recipients.test.ts`.
**Ontwerp gelezen:** PROGRESS (M3–M6, antwoorden, open punten), TECHNICAL_DESIGN §3.1, §3.2, §11.3, §12.3/§12.4, ACCEPTANCE_CRITERIA AC-055 t/m AC-061, `docs/reviews/wp2b-test-writer.md`.
**Lint/typecheck/tests:**
- typecheck: 0 fouten.
- lint: 0 fouten. Er zijn 5 waarschuwingen, allemaal in bestanden buiten deze WP (`gate.mjs`, `seed.ts`, `visual-check.mjs`).
- vitest: 202/202 geslaagd.
- DB-suite: zelf gedraaid in een eigen testdatabase `cr_wp2b_test` (daarna verwijderd). Volledig groen: 10_–40_, gelijktijdig en de upgrade _200 → na_200 → _210 → na_210.
- Let op: in die run zat ook het nog niet gecommitte `20260929000300_retentie.sql` uit het WP3-werk in de werkmap. Ook daarmee groen.
- E2E heb ik niet gedraaid.

### Controle: SQL-body van …_210 gelijk aan wat op live draaide
Vergeleken met `git show c1ddf03:supabase/ops/wp2b/20260928000210_scope_contract.sql`. Alleen de kopcommentaar (regels 5–12) verschilt. Vanaf `begin;` tot `commit;` is alles byte-gelijk. **Akkoord.**

### Bevindingen
1. **[LAAG]** Registratie op live (20260929073700) wijkt af van de bestandsnaam (20260928000210). Vindplaatsen: `README.md:88` (instructie `supabase db push`) en de kop van `supabase/migrations/20260928000210_scope_contract.sql:9`.
   - **Probleem:** de Supabase CLI koppelt migraties aan het versienummer.
     - Live bevat een versie die lokaal niet bestaat. Het lokale `20260928000210` staat voor de CLI als "niet toegepast".
     - Waarschijnlijk geldt hetzelfde al voor `_100`, `_110` en `_200`, omdat MCP `apply_migration` een eigen tijdstempel geeft. Dat kon ik niet bevestigen, want ik kan live niet bereiken.
     - Het nieuwe `20260929000300_retentie.sql` is bovendien ouder dan de laatste live-versie 20260929073700. De CLI ziet dat als "out of order".
   - **Gevolg:**
     - `supabase db push` naar live weigert, of vraagt om `migration repair`.
     - Wie daarna repareert en pusht, laat …_210 opnieuw lopen. Dat faalt bij `drop table public.task_assignments` (zonder `if exists`) en wordt in zijn geheel teruggedraaid. Er gaat dus geen data verloren, maar het is verwarrend.
     - De poort blokkeert `supabase db push` voor de hoofdsessie, dus het risico is klein. De README stuurt een lezer wel die kant op.
   - **Verbetering:**
     - Leg in `docs/DECISIONS.md` vast: live-migraties gaan alleen via de MCP-koppeling, nooit via `db push`. Voeg een tabel toe met bestand → live-versie (voor zover bekend).
     - Pas README r.88 daarop aan.

2. **[LAAG]** De index `tasks_open_sched_idx` ontbreekt in …_210 (bevinding 1 van de test-writer, bevestigd).
   - **Probleem:** TD §3.1 zet de index in het doelmodel "na WP2b". §3.2 noemt hem niet bij …_210, en §11.3 koppelt hem aan de tick. Het ontwerp is hier dus zelf dubbelzinnig. Hij staat inmiddels in het nog niet gecommitte `supabase/migrations/20260929000300_retentie.sql:10` (WP3).
   - **Gevolg:** bij ongeveer 57 taken is er geen merkbaar effect. Het is wel een afwijking van §3.1 zonder regel in DECISIONS.
   - **Verbetering:** één regel in `docs/DECISIONS.md`: "tasks_open_sched_idx komt in …_300 (WP3, bij de tick), niet in …_210". Het DB-testje op het bestaan van de index hoort bij WP3.

3. **[LAAG]** De uitnodigingen-delete is breder dan BR-46.3 (bevinding 2 van de test-writer, bevestigd). Vindplaats: `supabase/migrations/20260928000210_scope_contract.sql:27`.
   - **Probleem:** `where member_id is not null and accepted_at is null` wist ook open uitnodigingen die aan een lid **met** account hingen. BR-46.3 noemt alleen "gekoppeld aan een lid zonder account".
   - **Gevolg:** geen. Op live was het aantal 0 (M1/M5). Zo'n uitnodiging zou na het droppen van `member_id` ook een gewone e-mailuitnodiging worden, die bij accepteren op BR-44 stuit. Wissen is dus eerder juist dan fout. Deze tak is niet getest; er is geen fixture met zo'n uitnodiging.
   - **Verbetering:** vastleggen in `docs/DECISIONS.md` als bewuste uitvoeringskeuze. De migratie niet meer wijzigen, want die is op live uitgevoerd.

4. **[LAAG]** In de M0-proef lopen latere migraties vóór het contract. Vindplaats: `supabase/ops/m0/run.sh:26-30`.
   - **Probleem:** de lus draait elke migratie na `_110` behalve `*_scope_contract.sql`. Daarna volgt pas het contract (r.54). Vanaf WP3 draait `…_300` (en elke latere migratie) in de proef dus vóór …_210. Dat is een andere volgorde dan op live en in `supabase/tests/run.sh`, dat wel netto `<_210` / `≥_210` splitst. De echo op r.31 zegt ook "expand (…_200)".
   - **Gevolg:** een herhaling van M0 kan breken of iets anders toetsen zodra een latere migratie het schema van na …_210 veronderstelt.
   - **Verbetering:** beperk de lus tot `< 20260928000210` en draai `≥ _210` na het contract, net als in `supabase/tests/run.sh:52-61`. Of markeer M0 expliciet als afgerond en bevroren.

5. **[LAAG]** Twee asserties zijn na …_210 vrijwel betekenisloos, maar kunnen geen kwaad.
   - `supabase/tests/30_wp2a.sql` (N2-blok, "oude signatuur vreemd = onbekend") vergelijkt nu twee keer 42883 "functie bestaat niet". Dat zegt niets meer over een orakel.
   - `supabase/tests/40_wp2b.sql:450-452` controleert de realtime-publicatie. Een gedropte tabel verdwijnt daar automatisch uit, dus de controle kan niet falen.
   - **Gevolg:** schijnzekerheid, meer niet.
   - **Verbetering:** laten staan, of de labels eerlijker maken. Geen actie vereist.

**Categorieën**
- **A (ontwerp):**
  - Datamodel, drops, constraints, cascade, enums, policy-drop en rechten in …_210 kloppen met TD §3.1/§3.2. De enige uitzondering is punt 2.
  - M3–M6 volgens §12.4, zoals vastgelegd in PROGRESS:
    - back-up 17/17 en restore 17/17;
    - hertelling vlak vóór de vraag;
    - checksum-controle vlak vóór M6;
    - één transactie in dezelfde sessie;
    - nacontrole volgens de M6-query's.
  - AC-058: het antwoord luidde "Ja. Wissen" in plaats van letterlijk "ja, wissen". Inhoudelijk is dat gelijk; ik reken het niet als afwijking, alleen ter informatie.
  - Er loopt niets vooruit op een later WP. De gecommitte diff raakt geen productiecode.
- **B (randgevallen):** gecontroleerd, niets nieuws.
  - Gelijktijdig afvinken is gedekt door `unique (task_id)` plus race 4.
  - Historie met `task_id null` mag meerdere keren bestaan (BR-12, getest).
  - `updated_at` blijft ongewijzigd bij het wissen (getest).
- **C (foutafhandeling):** gecontroleerd, niets gevonden.
  - `2>/dev/null` bij de upgrade-migraties in `run.sh` verbergt alleen meldingen. `ON_ERROR_STOP` plus `set -e` stoppen nog steeds bij een fout.
- **D (halve implementaties):** gecontroleerd, niets gevonden.
  - `src/` bevat geen verwijzingen meer naar vervallen kolommen, tabellen of RPC's. `types/database.ts` heeft `user_id: string`.
  - De functiescan in 40_ bevestigt dit ook voor PL/pgSQL.
- **E (consistentie):** zie punt 4 (M0 volgt een andere volgorde dan `run.sh`). Verder consistent.
- **F (onderhoud):** zie punt 5. Het lege `bevindingen/` is terecht opgeruimd; de test is verplaatst naar 30_wp2a.sql, met dezelfde toets en een extra "niets veranderd".
- **G (performance):** zie punt 2.
- **H (tests):** de geschrapte tests zijn beoordeeld.
  - **D-021 ruilverzoeken (7 asserties):** de tabel bestaat niet meer; dat hij weg is, toetst 40_.
  - **Oude-signatuurblokken en AC-034-kolomasserties:** vervangen door 42883-toetsen, de privacy-invariant en de rij-tekstcontrole "verwijst niet naar Ellen". Die laatste blijft staan.
  - **"Baby toevoegen":** omgezet naar een negatieve toets, plus een nieuwe toets "ander account aan Kai hangen".
  - **Weggevallen mutaties:** 'afvinken_met_persoon', 'oude_signatuur_schrijft_persoon', 'ruilverzoek_herschrijfbaar' en 'insert_policy_zonder_user_id_null' zijn vervangen door zinvolle mutaties op …_210.
  - Er is **niets geschrapt dat nog iets zinnigs toetste.**
  - De E2E-asserties zijn strenger geworden: "sleutel bestaat niet" in plaats van `?? null`.
  - Alle criteria met een DB-toets zijn gedekt: AC-059 (upgrade op oude gegevens), AC-045, BR-11 en BR-44.

### Doorgeven
- **Security-reviewer:** de uitnodigingen-delete (punt 3) is breder dan de regel, zonder gevolg. De insert-policy "members: beheerder voegt toe" is weg; alleen de uitnodiging blijft als weg naar binnen (getest in 20_ en 40_). Verder niets.
- **Test-writer:** in WP3 een DB-toets op het bestaan en de vorm van `tasks_open_sched_idx`. Optioneel: een upgrade-fixture met een open uitnodiging die aan een lid **met** account hangt, om het gedrag van regel 27 vast te leggen.
- **Performance-reviewer:** `tasks_open_sched_idx` meenemen bij de review van WP3 (tick).

### Vragen voor de hoofdsessie
- Staan de live-versies van `_100`, `_110` en `_200` ook onder een ander tijdstempel dan de bestandsnaam? Dat is nodig om de tabel uit punt 1 volledig te maken (`select version, name from supabase_migrations.schema_migrations`).
- Wordt M0 (`supabase/ops/m0/run.sh`) nog opnieuw gedraaid, of is het afgesloten? Dat bepaalt of punt 4 herstel of alleen een notitie nodig heeft.

### Conclusie
**GO** — de SQL die op live draaide is ongewijzigd in `supabase/migrations/` beland, het draaiboek M3–M6 is gevolgd, en er zijn geen tests geschrapt om groen te krijgen. Alle vier bevindingen zijn LAAG. Punten 1 tot en met 3 hebben alleen een regel in `docs/DECISIONS.md` nodig; punt 4 is een kleine herstelactie of een notitie.

Relevante bestanden:
- /home/user/takenlijstje/supabase/migrations/20260928000210_scope_contract.sql
- /home/user/takenlijstje/supabase/ops/m0/run.sh
- /home/user/takenlijstje/supabase/tests/run.sh
- /home/user/takenlijstje/supabase/tests/40_wp2b.sql
- /home/user/takenlijstje/supabase/tests/upgrade/na_210.sql
- /home/user/takenlijstje/supabase/tests/30_wp2a.sql
- /home/user/takenlijstje/README.md
- /home/user/takenlijstje/docs/TECHNICAL_DESIGN.md (§3.1 r.79, §3.2 r.117)
