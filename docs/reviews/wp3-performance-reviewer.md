## Performance-review: WP3 (planner, set-gebaseerde tick, push, retentie)

**Gemeten**
- De echte `runTick()` heb ik gedraaid via een vitest-harnas in `/tmp`. De web-push-bibliotheek was nagebootst, en elk REST-verzoek werd geteld en getimed.
- Dat liep tegen een **aparte** database `takenlijstje_perf`, met een tweede testgateway op poort 54399. `takenlijstje_e2e` heb ik niet aangeraakt. De stack is niet herstart en er is geen app-server gestart.
- Volumes:
  - seed: 2 huishoudens, 23 reeksen, 182 taken;
  - schaal A: 20 huishoudens, 230 reeksen, 5.050 taken, 22,5k meldingen, 100 push-abonnementen;
  - schaal B: dezelfde 20 huishoudens met een jaar historie, 93k taken en 90k afvinkingen.
- Netwerkvertraging per verzoek gesimuleerd met 0, 5 en 90 ms.
- `EXPLAIN ANALYZE` van de hoofdquery's en de opruimstap op schaal B. De opruimstap draaide in een transactie die ik daarna heb teruggedraaid.

Na afloop heb ik de perf-database en de tweede gateway weer verwijderd, net als het sleutelbestand in `/tmp`. De sleutels zijn nooit afgedrukt.

**Geschat**
- De latentie tussen Vercel en Supabase in productie: ongeveer 5–25 ms als de functie in fra1 draait, ongeveer 90–100 ms als Vercel de standaardregio iad1 gebruikt.
- De responstijd van pushdiensten (100–300 ms).
- De testgateway is geen PostgREST. Het aantal query's klopt exact; de absolute tijden zijn alleen lokaal geldig.

**Kernmetingen**

| Scenario | Duur | Verzoeken |
|---|---|---|
| Seed, gewone tick (niets nieuws) | 32–40 ms | 9–10 |
| Seed, eerste tick van de dag (horizon schuift, 18 pushes), 0 / 5 / 90 ms | 0,30 / 0,51 / 3,86 s | 45–55 |
| Schaal A, gewone tick, 0 / 5 / 90 ms | 0,13 / 0,17 / 1,04 s | 12 |
| Schaal A, eerste tick van de dag, 0 / 5 / 90 ms | 1,4 / 3,8 / 28,0 s | 406–466, waarvan 230 `PATCH task_recurrences` en ~220 `PATCH push_subscriptions` |
| Schaal A, pushdienst hangt (elke verzending loopt tegen de 10 s-time-out) | 52,7 s | 25 verzendpogingen, ~10 meldingen afgehandeld, ~50 zonder push (zoals ontworpen) |
| Schaal A, inhaaltick na 4 weken stilstand | stap "overslaan" **faalt** | `PATCH tasks?id=in.(…)` van 42 KB (±1.140 uuid's) |

Queryplannen op schaal B (93k taken):
- open taken ≤ vandaag+7: bitmap-indexscan, 2,9 ms per pagina;
- open reekstaken (overslaan): `tasks_open_sched_idx`, 2,5 ms;
- bestaande uitvoeringen ≥ gisteren: **seq scan**, 17,9 ms per pagina (92k rijen weggefilterd);
- opruimen van afvinkingen en meldingen: via index, < 0,1 ms;
- opruimen van 933 zacht verwijderde taken: **1.348 ms**, waarvan 1.260 ms in de FK-trigger van `notifications`.

Voor één huishouden, zoals in de productspec, haalt de tick het doel van < 3 s ruim: ongeveer 0,3–0,5 s bij een functie in de EU. Bij 90 ms per verzoek komt de eerste tick van de dag al op 3,9 s.

### Bevindingen

1. **[LAAG]** `src/server/services/scheduling.ts:191-194` (`planAllSeries`): `generated_until` wordt **per reeks** met een eigen PATCH bijgewerkt.
   - Bewijs: de eerste tick van elke dag doet 23 (seed) of 230 (schaal A) opeenvolgende verzoeken. Bij 90 ms per verzoek is dat 2,1 s (seed) of 22 s (schaal A). Op schaal A gaat dat direct af van het pushbudget van 45 s, dat bij de start van de tick begint.
   - Gevolg: voor één huishouden met 20–40 reeksen kost het 0,2–0,4 s in de EU en 2–4 s bij iad1. Gebruikers merken het niet, maar het doel van < 3 s uit §11.3 wordt alleen gehaald als de functie dicht bij de database draait. Dit is een O(reeksen)-lus in een ontwerp dat een vast aantal query's belooft (§11.3: "één bulk-upsert").
   - Verbetering: groepeer `horizonUpdates` per paar (oude waarde, nieuwe waarde) en doe één `update … .in("id", ids).eq("generated_until", from)` (of `.is(null)`) per groep. De optimistische controle uit D-041 blijft zo intact. In de metingen hadden alle reeksen hetzelfde paar, dus dat is 1 verzoek in plaats van 23 of 230.

2. **[LAAG]** `src/server/services/scheduling.ts:233-241` (`skipAllSuperseded`), en in mindere mate `tick.ts:247` (`pushed_at … in(handled)`): alle id's gaan in één `in.(…)` in de **URL**.
   - Bewijs: na een gesimuleerde stilstand van 4 weken op schaal A werd de URL 42 KB. De stap faalde (`failed: ["overslaan"]`); de testgateway (Node) weigert headers boven 16 KB. Per huishouden kwamen er ~2 over te slane taken per dag stilstand bij, dus ±430 uuid's (16 KB) na enkele maanden. Supabase heeft een vergelijkbare URL-grens; die heb ik niet tegen Supabase zelf gemeten.
   - Gevolg: voor één huishouden pas na maandenlange stilstand. Is de grens eenmaal bereikt, dan herstelt het zich **niet**: de lijst groeit elke tick, BR-16 draait nooit meer en de route geeft voortaan 500.
   - Verbetering: werk de id's in blokken van ±200 bij, of doe het overslaan in één RPC of één update met het filter in SQL. Doe hetzelfde voor `handled`.

3. **[LAAG]** `supabase/migrations/20260929000300_retentie.sql:56-58`: bij het hard verwijderen van taken zet de FK `notifications (task_id, household_id) … on delete set null` de verwijzing leeg. Op `notifications.task_id` staat **geen index**.
   - Bewijs: 933 taken verwijderen kostte 1.348 ms, waarvan 1.260 ms in "Trigger for constraint notifications_task_id_household_id_fkey" (per taak een seq scan over 22,8k meldingen).
   - Gevolg: voor één huishouden (±1.800 meldingen, een paar verwijderde taken per dag) is dit milliseconden. Alleen de eerste opruimronde na de datamigratie (BR-46), met veel oude verwijderde taken, of een groter volume maakt het merkbaar.
   - Verbetering: in een volgende migratie `create index notifications_task_idx on public.notifications (task_id) where task_id is not null;`.

4. **[LAAG]** `tick.ts:228-237` samen met `web-push.ts:14` (10 s-time-out) tegenover pg_net (55 s) en `maxDuration` (60 s).
   - Bewijs: met een hangende pushdienst eindigde de tick na 52,7 s. In het slechtste geval start een verzending net vóór 45 s en duurt die 10 s. Daarna volgen `last_used_at`/delete, de `pushed_at`-PATCH en `run_purge`. Samen is dat ±55,3 s in de functie, plus een eventuele cold start en de netwerktijd van pg_net.
   - Gevolg: 60 s wordt niet gehaald, dus er is geen afbreking en geen dataverlies. pg_net kan dan wel een time-out registreren (`net._http_response`) terwijl de tick nog goed afloopt. Dat geeft een onterecht storingssignaal bij AC-063.
   - Verbetering: geef de time-out per verzending mee als `Math.max(1000, Math.min(PUSH_TIMEOUT_MS, pushDeadline + 5000 - Date.now()))`, of verlaag het budget naar 40 s.

5. **[LAAG]** `src/server/actions/tasks.ts:59-72` en `src/server/system/dispatcher.ts:83-86` (`WebPushChannel.deliver`). Dit staat buiten de kern van WP3, maar raakt web-push.ts.
   - Bewijs: `completeTaskAction` wacht op `notify`, en daarmee op de pushverzendingen: 10 s-time-out, 5 tegelijk.
   - Gevolg: in normale omstandigheden kost het 100–300 ms extra op de serverbevestiging; afvinken zelf is optimistisch. Hangt een pushdienst, dan duurt de bevestiging tot 10 s (en langer bij meer dan 5 abonnementen). Next.js voert server actions van één client na elkaar uit, dus snel achter elkaar afvinken stapelt dat op, net als de outbox-synchronisatie.
   - Verbetering: `notify` (of alleen de pushstap) via `after()` uit `next/server` na het antwoord laten lopen. Dat bevestigt LAAG 2 uit WP2a; de time-out is nu wel gebouwd.

6. **[LAAG]** `scheduling.ts:140-149`: "bestaande uitvoeringen ≥ gisteren" heeft geen passende index.
   - Bewijs: seq scan met 17,9 ms per pagina op 93k taken. `(recurrence_id, occurrence_date)` helpt niet voor een bereik op alleen de datum. Afgeronde taken worden nooit opgeruimd, dus de tabel groeit ±8k rijen per jaar per huishouden.
   - Gevolg: voor één huishouden is dat na 5 jaar ~40k rijen, ±7 ms. Verwaarloosbaar.
   - Verbetering: niets nu. Bij veel groei een index `on tasks (occurrence_date) where recurrence_id is not null`.

### Te verifiëren (geen bevinding, wel bepalend)
- **Functieregio van Vercel.** `vercel.json` zet geen `regions`, en in de docs staat alleen de regio van Supabase (eu-central-1, V-20). Draaien de functies in de standaardregio iad1 (Washington), dan kost elke query ±90–100 ms heen en terug over de oceaan. Dan haalt de tick op de eerste run van de dag de 3 s niet: gemeten 3,9 s op seedvolume. Belangrijker: het raakt ook elke server action en elke RSC-render van de app (§11.2-doelen, LCP). Vraag voor de hoofdsessie: controleer in het Vercel-dashboard of de functieregio fra1 is, en leg dat vast in DECISIONS. Als het iad1 is, wordt dit een GEMIDDELD punt voor de hele app, niet alleen voor de tick.

### Bewust niet geoptimaliseerd
- **`last_used_at`-PATCH per verzending** (`web-push.ts:65`): 160–220 verzoeken op schaal A, maar ze lopen binnen de 5 parallelle workers. Voor 2–4 leden gaat het om enkele verzoeken per tick.
- **Offset-paginering in `selectAll`:** elke pagina sorteert de volledige set opnieuw. Gemeten 2,5–2,9 ms per pagina bij 2.400 open taken. D-041 accepteert dit.
- **Dubbele `households`-lezing en de in-memory filters per huishouden** (O(huishoudens × taken)): een gewone tick op schaal A duurt 134 ms, inclusief alle rekenwerk.
- **`tasks_open_sched_idx`:** op schaal B kiest de planner voor de meldingenquery soms `tasks_open_due_idx`; beide zijn partiële indexen op open taken. De nieuwe index wordt wel gebruikt voor het overslaan. Het is een kleine overlap, geen probleem.
- **Opnieuw upserten van dezelfde meldingen elke tick** (dedupe met DO NOTHING): het venster is begrensd (verlopen: 24 uur), dus de payload blijft klein.
- **Tijdsbudget bij een hangende pushdienst:** meldingen na 45 s krijgen geen push. Dat is ontworpen en geaccepteerd (§11.3). Gemeten: ±50 van de 60 nieuwe meldingen op schaal A zonder push; bij één huishouden een handvol.
- **Opruimstap (`run_purge`):** 2,3 ms op schaal B als er niets te wissen is. Afvinkingen, meldingen en lijsten gaan via hun index. Uitnodigingen en huishoudens gebruiken een seq scan over kleine tabellen.
- **Cold start:** niet meetbaar zonder deployment. Dat een tick om de 15 minuten de functie warm houdt (§11.4), is optimistisch, maar een cold start valt ruim binnen het budget.

### Conclusie
GO. De tick is set-gebaseerd en haalt op het volume uit de productspec ruim het doel van < 3 s (±0,3–0,5 s in de EU). Er is geen BLOKKEREND of GEMIDDELD prestatiepunt. De punten 1–3 zijn goedkope robuustheidswinsten die ik zou meenemen in het herstel. De functieregio van Vercel moet nog bevestigd worden.

Relevante bestanden:
- /home/user/takenlijstje/src/server/services/scheduling.ts (r. 191-194, 233-241, 140-149)
- /home/user/takenlijstje/src/server/system/tick.ts (r. 228-247)
- /home/user/takenlijstje/src/server/system/channels/web-push.ts (r. 14, 56-65)
- /home/user/takenlijstje/src/server/system/dispatcher.ts (r. 83-86)
- /home/user/takenlijstje/src/server/actions/tasks.ts (r. 59-72)
- /home/user/takenlijstje/supabase/migrations/20260929000300_retentie.sql (r. 56-58)
- /home/user/takenlijstje/vercel.json (geen `regions`)
