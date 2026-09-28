## Performance-review: WP2a (scope uit de code + expand), `48acc79..HEAD`

**Controle na de herstart:** tussen 4324a46 en HEAD zijn onder `src` en `supabase` alleen testbestanden gewijzigd. De productiecode die ik review is dus ongewijzigd.

**Gemeten:**
- **Seedvolumes** via de REST-gateway op 127.0.0.1:54321, met de service-rolsleutel (gelezen met cut, niet geprint):
  - 1 huishouden, 4 leden (alle 4 met account), 88 taken, 46 afvinkingen, 9 reeksen, 42 standaardtaken, 14 boodschappen;
  - de vervallen tabellen `task_swap_requests`, `member_absences` en `task_assignments` bestaan nog en zijn leeg.
- **Snapshot:** de exacte filters uit `loadSnapshot` nagebootst via REST.
  - Payload ongeveer 128 KB JSON: 123,6 KB voor de eerste 9 queries plus 4,9 KB boodschappen.
  - Elke query duurt lokaal 3 tot 5 ms.
- **Tick:** de echte domeinfuncties (`taskMessages`, `summaryMessages`, `recipientsFor`) inline gedraaid op de seedleden en hun voorkeuren. Twee scenario's:
  - de seed op drie tijdstippen: 0 tot 2 meldingen;
  - een synthetisch scenario op werkelijk volume: 20 open taken, waarvan 15 in het verlopen-venster.
  - Beperking: `runTick` zelf kon ik niet aanroepen. Een script buiten het project en rechtstreekse databasetoegang zijn voor deze rol geblokkeerd. Het aantal queries per notify-aanroep heb ik daarom uit de code afgeleid.

**Geschat:**
- de tickduur in productie, met 10 tot 25 ms per query tussen Vercel en Supabase in eu-central-1 en 100 tot 300 ms per push;
- de snapshotgrootte bij het werkelijke volume uit TD §11.1, ongeveer 22 taakrijen per dag.

### Bevindingen

1. **[LAAG]** `src/server/system/tick.ts:76-97` — de tick roept `notify` aan per taak × per lid met account, ook voor leden die die soort melding uit hebben staan. Elke `notify` haalt daarna opnieuw alle leden en voorkeuren van het huishouden op (`dispatcher.ts:49-52`), terwijl de tick die al heeft.
   - **Bewijs** (synthetisch scenario: 20 taken, 4 leden met account, 2 van hen met meldingen aan):
     - 60 notify-aanroepen, waarvan 30 zonder ontvanger. Die doen twee selects en stoppen dan;
     - 30 meldingsrijen;
     - ongeveer 183 queries zonder push, ongeveer 243 met één pushabonnement per ontvanger;
     - de set-gebaseerde tick uit TD §11.3 doet dit met ongeveer 6 queries.
     - Vóór WP2a ging een melding naar alleen de toegewezen persoon of de beheerders. Door WP2a zijn het ongeveer 2× zoveel aanroepen.
   - **Gevolg:**
     - de gebruiker merkt niets;
     - geschat 3 tot 12 s per tick, dat komt 1× per dag voor (`vercel.json`: `30 5 * * *`) en past ruim in de functielimiet;
     - daarnaast telt `report.messages` (`sent++`) aanroepen in plaats van verstuurde meldingen (60 tegenover 30). Dat maakt het tickrapport onbetrouwbaar als meetpunt voor WP3.
   - **Verbetering:** als tussenoplossing aanvaardbaar, omdat WP3 dit vervangt door de set-gebaseerde tick. Wil je het nu al goedkoop halveren:
     - filter in de tick vooraf met `recipientsFor(msg.type, members, prefs)` voordat `notify` wordt aangeroepen;
     - tel `sent` alleen voor leden die de melding echt krijgen.
   - Belangrijker: WP3 moet §11.3 volledig uitvoeren (bulk-upsert, `pushed_at` op id, push met time-out) en de tickduur meten.

2. **[LAAG]** `src/server/actions/tasks.ts:57-73` (`completeTaskAction`) — `topUp` en `notify` lopen na elkaar. Bovendien wacht de actie op web push zonder time-out (`channels/web-push.ts:47-66`).
   - **Bewijs:**
     - na het afvinken volgen minimaal 1 RPC, 5 queries voor `topUp` (bij een reeks) en 3 tot 5 queries plus pushverzoeken voor `notify`;
     - er gaan nu meer ontvangers mee (V-38a, ook wie afvinkte), maar de pushes lopen parallel.
   - **Gevolg:**
     - het afvinken is in de UI optimistisch, dus de gebruiker ziet geen vertraging;
     - bij een trage pushdienst houdt de actie wel de outbox-synchronisatie op.
     - De ontbrekende push-time-out bestond al en staat gepland in WP3.
   - **Verbetering:** `topUp` en `notify` met `Promise.all` tegelijk laten lopen (ze zijn onafhankelijk). De push-time-out in WP3 niet laten vallen.

3. **[LAAG]** `src/lib/data/snapshot.ts:68-78` — `tasks.select("*")` neemt de vervallen kolommen nog mee: `assigned_member_id`, `assignment_reason`, `points` en `completed_by_member_id`.
   - **Bewijs:** samen 8,4 KB van de 70,4 KB taken-payload op de seed (12%), terwijl de code ze niet meer gebruikt.
   - **Gevolg:** geen merkbaar effect. Na het contract in WP2b (`…_210`) verdwijnen de kolommen vanzelf.
   - **Verbetering:** in WP2a niets doen. Expliciete kolommen staan al gepland in WP4 (TD §11.2).

**Conclusie over "snapshot zonder de vervallen tabellen" (de eis voor dit WP):** die is gehaald.
- De queries op `task_swap_requests` en `member_absences` zijn weg. Het aantal queries per snapshot gaat van 12 naar 10, in 3 opeenvolgende stappen: huishouden, 8 parallel, boodschappen.
- Het nieuwe filter `user_id is not null` op leden kost niets (4 rijen).

**Nieuwe RPC's en index:** ik heb geen probleem gevonden.
- `complete_task` v2, `undo_complete_task`, `archive_shopping_list` en `unarchive_shopping_list` zoeken via de primaire sleutel of een unieke index (`client_mutation_id unique`, `task_completions_task_idx`, `unique (recurrence_id, occurrence_date)`).
- De eerste lookup zonder lock gevolgd door `for update` kost één extra lookup op de primaire sleutel. Dat is bewust zo gedaan (security N2) en verwaarloosbaar.
- `shopping_lists_one_active_idx` (partieel uniek op `household_id where archived_at is null`) past precies bij de snapshotquery naar de actieve lijst en bij de lookups in beide RPC's.

**`createTask` met reeks:** 7 queries na elkaar: upsert, 5 in `topUp` en een select.
- Vóór WP2a waren het er ook zoveel of meer, want er kwamen nog toewijzing en meldingen bij.
- De afsluitende select is nodig voor de idempotentie: bij een tweede verzoek geeft `topUp` met `ignoreDuplicates` niets terug.
- Hij loopt via de unieke index op `(recurrence_id, occurrence_date)`.

### Bewust niet geoptimaliseerd
- **`dispatcher.ts` haalt alle leden en voorkeuren van het huishouden op en zoekt met `find` in een lus.** Dat zijn 2 tot 4 rijen, dus geen meetbaar effect. Wel meenemen in de set-gebaseerde tick van WP3.
- **Geen index op `task_comments(member_id)` voor de trigger `sync_comment_author`.** Die draait alleen bij een naamswijziging, op een handvol notities.
- **Snapshotvenster en limieten** (42 dagen terug en 70 vooruit, limiet 3000, `select("*")`). Dit bestond al vóór WP2a en is niet door dit WP veroorzaakt.
  - Schatting bij werkelijk volume (~22 taakrijen per dag, ~15 afvinkingen per dag): ruwweg 1 tot 1,7 MB JSON per snapshot, ver boven het doel van 200 KB (TD §11.2).
  - Het wordt opgelost in WP4 (venster −7/+14 plus open taken, limiet 1500, expliciete kolommen, slices). De performance-review van WP4 moet dit meten.
- **Tick per huishouden, `topUpSeries` per reeks:** dit wordt in WP3 set-gebaseerd. Bij 1 huishouden en 20 tot 40 reeksen, 1× per dag, is dat nu niet merkbaar.

### Buiten performance, ter informatie voor de hoofdsessie
- De cron `30 5 * * *` UTC valt vanaf 25-10 (wintertijd) op 06:30 lokale tijd. `isTimeWindow` vereist tijd ≥ 07:30, dus het dagoverzicht valt in de winter stil weg.
- Een avondoverzicht is bij 1 tick per dag nooit mogelijk.
- Dit bestond al (commit 1f1eb38) en wordt in WP3 opgelost met pg_cron elke 15 minuten. Wel goed om te weten als WP3 uitloopt.

### Conclusie
**GO** — WP2a haalt de snapshot-eis, voegt geen blokkerende of merkbare vertraging toe, en de extra tick-aanroepen zijn als tussenoplossing tot WP3 aanvaardbaar, mits WP3 §11.3 volledig uitvoert.

**Relevante bestanden:**
- /home/user/takenlijstje/src/server/system/tick.ts
- /home/user/takenlijstje/src/server/system/dispatcher.ts
- /home/user/takenlijstje/src/server/actions/tasks.ts
- /home/user/takenlijstje/src/server/system/channels/web-push.ts
- /home/user/takenlijstje/src/lib/data/snapshot.ts
- /home/user/takenlijstje/src/server/services/tasks.ts
- /home/user/takenlijstje/supabase/migrations/20260928000200_scope_expand.sql
- /home/user/takenlijstje/vercel.json

Ik heb niets gewijzigd. De tijdelijke bestanden in `/tmp/perfwp2a` zijn verwijderd. In de scratchpad van de sessie staan nog alleen-lezende JSON-kopieën van seedtabellen.
