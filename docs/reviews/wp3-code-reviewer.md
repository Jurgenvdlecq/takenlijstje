## Code-review: WP3 — planner, set-gebaseerde tick, push, retentie (c8eb5bb..HEAD, incl. 2429603 en 4adc714)

**Beoordeeld:** src/server/system/tick.ts, src/server/services/scheduling.ts, src/server/system/channels/web-push.ts, src/server/system/dispatcher.ts, src/app/api/cron/tick/route.ts, src/types/database.ts, supabase/migrations/20260929000300_retentie.sql, supabase/ops/planner.sql, README.md, het verwijderde supabase/cron/schedule-tick.sql. Daarnaast gelezen: src/domain/scheduling/plan.ts, src/domain/scheduling/supersede.ts, src/domain/reminders.ts, src/server/system/planner.ts, src/server/mappers.ts (toSeries), FK's en triggers in de migraties en vercel.json.

**Ontwerp gelezen:** PROGRESS.md, TECHNICAL_DESIGN §3.1, §3.2, §3.4, §6.5, §7, §9.4, §10, §11.3, §12.2 en §15, ACCEPTANCE_CRITERIA AC-063…AC-078, DECISIONS D-040.

**Lint/typecheck/tests:**
- typecheck: groen.
- lint: 0 fouten, 5 waarschuwingen, allemaal buiten deze wijziging.
- vitest: 202/202.
- DB-suite (`run.sh` als postgres): groen, ook de upgrade-test tot en met `_300`.
- Eigen controle in een transactie die ik daarna heb teruggedraaid:
  - `run_purge()` geeft nu `{0,…}`;
  - `purge_expired_data(now()+5 jaar)` wist taken, afvinkingen, uitnodigingen, meldingen en lijsten zonder FK-fouten;
  - de rechten kloppen: `run_purge` alleen voor postgres en service_role, `purge_expired_data` alleen voor postgres, beide security definer.

### Bevindingen

1. [GEMIDDELD] src/server/services/scheduling.ts:216 — `skipAllSuperseded` zet `status = 'skipped'` op id, zonder te controleren of de taak nog open is.
   Gevolg: vinkt iemand een verlopen taak af tussen het (gepagineerde) lezen en deze update, dan overschrijft de tick "done" met "skipped". Dat kan omdat de service role langs de guard gaat. De afvinking bestaat dan wel, maar de taak telt als "vergeten". Dat is een inconsistentie met BR-11/BR-16. Het probleem bestond al per huishouden, maar door de paginering is het venster groter geworden.
   Verbetering: `.in("status", ["todo","in_progress"]).is("deleted_at", null)` aan de update toevoegen, en de telling uit `.select("id")` halen.

2. [GEMIDDELD] src/app/api/cron/tick/route.ts:18-19 en tick.ts:59-66 — De route antwoordt altijd met 200, ook als alle vier de stappen faalden (`failed` staat alleen in de body).
   Gevolg: de controle van AC-063 ("elk met 200", `net._http_response.status_code`) slaagt ook als de tick niets doet. Een structurele storing (bijvoorbeeld een verlopen service-rolsleutel of een schemafout) blijft zo onzichtbaar, behalve in de Vercel-logs. Dat is een verborgen fallback (categorie D).
   Verbetering: bij een niet-lege `report.failed` met 500 antwoorden (de body blijft alleen tellingen). De tick is idempotent, dus dat is veilig. Leg de keuze vast in DECISIONS.

3. [GEMIDDELD] Tests (categorie H) — De diff bevat geen enkele test voor `planAllSeries`, `skipAllSuperseded`, `selectAll`, `sendDueMessages`, `runLimited`/`sendPush` of `purge_expired_data`. `supabase/tests/40_retentie.sql` uit AC-077 bestaat niet; het nummer 40 is bovendien al bezet door `40_wp2b.sql`. De vitest-telling is gelijk aan WP2a (202).
   Gevolg: de gelijkwaardigheid van de set-gebaseerde planning met `topUpSeries`, de dedupe bij overlappende ticks en de retentiegrenzen zijn niet geborgd.
   Verbetering: zie "Doorgeven → test-writer".

4. [GEMIDDELD] src/server/system/channels/web-push.ts (geheel) — De "push-endpoint-allowlist" staat in PROGRESS › Technische schuld (security-review WP1) expliciet op WP3, maar is niet gebouwd. `validation.ts:154` eist alleen `https://`. Het punt staat ook niet opnieuw ingepland in D-040 of PROGRESS.
   Gevolg: een toegezegde securitymaatregel verdwijnt stil uit de planning. De server blijft POST-verzoeken naar willekeurige https-hosts sturen die een gebruiker opgeeft.
   Verbetering: bouwen (allowlist van de bekende push-diensten bij opslaan en bij versturen), of met reden verplaatsen naar een later WP, vastgelegd in PROGRESS.

5. [LAAG] src/server/services/scheduling.ts:175-180 — `generated_until` wordt onvoorwaardelijk overschreven met de waarde die aan het begin van de stap is berekend.
   Gevolg: draait `clear_series_occurrences` (reeks wijzigen) tijdens de planningsstap, dan zet de tick `generated_until` terug naar de oude horizon. Uitvoeringen volgens de oude regel die de tick net heeft ingevoegd, blijven dan staan tot de horizon voorbij is. TD §7 noemt dit "herstelt zichzelf", maar dat klopt in dit geval niet. Het probleem is niet nieuw; het venster is wel groter.
   Verbetering: optimistisch bijwerken met `.eq("generated_until", oude waarde)` (of `.is(null)`) per reeks, of per waardegroep plus de oude waarde.

6. [LAAG] src/server/services/scheduling.ts:50-58 — `selectAll` pagineert met offset (`order("id").range`). Een gelijktijdige insert, update of delete (een overlappende tick, of een gebruiker) verschuift de offsets, waardoor een rij gemist of dubbel gelezen wordt.
   Gevolg: bij de huidige omvang is dat onschadelijk. Een gemiste bestaande datum levert een upsert op die genegeerd wordt; een gemiste open taak wordt pas een tick later overgeslagen.
   Verbetering: keyset-paginering (`.gt("id", laatste).order("id").limit(1000)`), of het risico als bewuste keuze opnemen in D-040.

7. [LAAG] src/server/services/scheduling.ts:152-166 — Planning en upsert van alle huishoudens gebeuren in één geheel.
   Gevolg: één reeks met een regel die `toSeries`/`planSeries` laat falen, of één rij die de bulk-upsert laat falen, stopt de planning voor alle reeksen van alle huishoudens (R-01). Met één huishouden gedroeg het oude gedrag zich hetzelfde.
   Verbetering: `planSeries` per reeks in try/catch; de reeks overslaan en tellen/loggen met alleen de code.

8. [LAAG] src/server/system/tick.ts:220-228 — Het tijdsbudget wordt per melding gecontroleerd, niet per abonnement. Na de deadline kan één gebruiker met meerdere toestellen nog N × (10 s time-out + DB-update) doorlopen. Daarna volgen nog de update van `pushed_at` en stap 4.
   Gevolg: bij een haperende pushdienst loopt de totale duur over de 55 s van pg_net en de 60 s van `maxDuration`. De functie wordt dan afgebroken: `pushed_at` en de opruimstap worden niet uitgevoerd en de run registreert als time-out.
   Verbetering: de deadline ook in de lus over de abonnementen controleren, bijvoorbeeld de subs van één melding parallel sturen met `runLimited(..., deadline)`.

9. [LAAG] src/server/system/channels/web-push.ts:52 — `configure()` (en daarmee `webpush.setVapidDetails`, dat gooit bij een ongeldige sleutel) staat buiten de try.
   Gevolg: bij een foute VAPID-configuratie faalt de hele meldingenstap nadat de meldingen al zijn ingevoegd. Er komt geen `pushed_at`, en door de dedupe probeert een volgende run het niet opnieuw. Het wordt wel gelogd als `stap meldingen mislukt`.
   Verbetering: `configure()` binnen de try, of eenmalig vóór `runLimited` in tick.ts controleren en dan pushen overslaan.

10. [LAAG] src/server/system/dispatcher.ts:49-52, 66-72 en 87 — Fouten van de ledenquery, de voorkeurenquery, de upsert en de `pushed_at`-update worden niet gecontroleerd (`{ data }` zonder `check`).
    Gevolg: een mislukte insert van "taak gedaan" verdwijnt stil, zonder logregel (categorie C). Dit gedrag bestond al, maar de upsert-regel is in deze wijziging aangepast.
    Verbetering: `check(...)` gebruiken, zodat de bestaande catch de fout logt met alleen de naam of code.

11. [LAAG] src/server/system/tick.ts:233-236 — `pushed_at` wordt ook gezet als er niets verstuurd is: push staat uit, er is geen abonnement, of er was een 5xx of time-out.
    Gevolg: de kolom betekent "afgehandeld", niet "gepusht". D-040 formuleert het zo, dus dit is geen fout, maar de naam misleidt. Er is nu geen lezer van `pushed_at` in `src`.
    Verbetering: in D-040 expliciet noemen dat dit ook geldt bij push uit of een mislukte verzending, of alleen zetten bij minstens één geslaagde of bewust overgeslagen push.

12. [LAAG] Afwijkingen van het ontwerp zonder regel in DECISIONS:
    - het antwoord bevat naast de velden uit TD §6.5 ook `households` en `failed`;
    - `supabase/cron/schedule-tick.sql` is nu al verwijderd (TD §15 noemt dat pas bij WP9; §3.2 "vervangt" dekt het deels);
    - de tick leest meldingen voor taken tot en met morgen (volgens §11.3, maar anders dan de oude code die tot vandaag las).

    Verbetering: kort aanvullen in D-040.

13. [LAAG] src/lib/validation.ts:38 en :150 tegenover tick.ts:115 — De API staat herinneringen tot 10080 minuten en een deadline-waarschuwing tot 2880 minuten toe. De tick leest alleen taken met `scheduled_date` ≤ morgen.
    Gevolg: een herinnering van meer dan ongeveer 1 dag vooraf wordt nooit verstuurd; het moment is voorbij voordat de taak in de selectie valt. De UI biedt hooguit 1440, dus dit raakt alleen de API.
    Verbetering: de validatie begrenzen op 1440, of het leesvenster afleiden van het maximum.

14. [LAAG] Duplicatie en omvang (categorieën E/F):
    - web-push.ts:30-36 definieert een eigen `PushSubscriptionRow`, terwijl `src/types/database.ts:173` die al heeft (gebruik een `Pick`);
    - `"Europe/Amsterdam"` staat los in scheduling.ts:131 en :158 naast `DEFAULT_TZ` in tick.ts;
    - `households` wordt twee keer gelezen (in plannen en in meldingen);
    - `sendDueMessages` is ongeveer 135 regels (boven de 80); de berekening van `pending` kan een pure functie worden, wat ook het testen vergemakkelijkt.

**Gecontroleerd en in orde:**
- **Planning gelijk aan `topUpSeries`:** −1 dag per huishouden (via `earliest` en een filter per reeks), `hasOpenUpcoming` identiek, `generated_until` uit de rij, pauze via `toSeries`/`planSeries`. Tasks worden eerst ge-upsert, daarna pas `generated_until`.
- **Dedupe:** volledige unique `(member_id, dedupe_key)`, en `DO NOTHING RETURNING` geeft alleen nieuwe rijen terug. Push alleen voor nieuwe meldingen; bij overlappende ticks pusht alleen de tick die de melding invoegde.
- **Tijdzones:** per huishouden; retentie gebruikt vast Europe/Amsterdam (V-39).
- **Logging:** alleen tellingen en codes.
- **Retentie:** grenzen volgens §3.4 plus D-040. Cascades werken: notities cascade, historie en meldingen `task_id → null`, producten cascade. Security definer met `search_path=''`, revoke/grant correct.
- **planner.sql:** idempotent (eerst unschedule), timeout 55000, geheim en URL alleen uit Vault en per run gelezen (rotatie werkt), geen geheimen in de diff. Het Vercel-vangnet staat in vercel.json.

Categorie G (basisperformance): gecontroleerd. Een vast aantal query's; indexen voor de open-takenlezing en de opruimstap zijn aanwezig; volumes zijn klein. Geen N+1 meer. Alleen de punten 6 en 8 hierboven.

### Doorgeven
- **Security-reviewer:**
  - de push-endpoint-allowlist uit de WP1-schuld is niet gebouwd (punt 4);
  - pg_net zet de Bearer-header met het cron-geheim tijdelijk in `net.http_request_queue`; controleer wie die tabel kan lezen;
  - controleer bij de uitvoering van planner.sql de schema's van `create extension` (Supabase adviseert `with schema pg_catalog` voor pg_cron en `extensions` voor pg_net), en of `vault.decrypted_secrets` alleen voor postgres leesbaar is;
  - `run_purge` staat in `public` (alleen service_role): bevestig in het Supabase-beveiligingsadvies dat hij niet voor anon/authenticated aanroepbaar is.
- **Test-writer:**
  - (a) `planAllSeries` tegen `topUpSeries`: dezelfde uitkomst voor wekelijks, maandelijks, gepauzeerd, verwijderde uitvoering binnen de horizon en een reeks over middernacht (AC-066/067);
  - (b) `skipAllSuperseded` (AC-068), plus een regressietest dat een taak die tussen lezen en bijwerken "done" wordt, niet "skipped" wordt (punt 1);
  - (c) `selectAll` over meer dan 1000 rijen;
  - (d) de tick twee keer op dezelfde `now`, en twee ticks parallel: geen extra taken, meldingen of pushes (AC-065);
  - (e) push alleen voor nieuwe id's, `pushed_at` per id, 410 verwijdert het abonnement (AC-075);
  - (f) de meldingenstap faalt, maar plannen en opruimen draaien toch; het antwoord bevat alleen tellingen; pushen stopt na het budget (AC-076, met een nep-klok);
  - (g) `40_retentie.sql` (ander nummer, 40 is bezet) met rijen net vóór en net ná elke grens, losse en reeks-verwijderde taken, historie blijft, de actieve lijst en open uitnodigingen blijven (AC-077);
  - (h) `run_purge` als authenticated/anon wordt geweigerd (AC-078);
  - (i) AC-064: herinnering uiterlijk op T+15 bij een vaste `now`, ook voor een taak van morgen vroeg.
- **Performance-reviewer:** tickduur meten op seed-volume (verwacht minder dan 3 s). Ook het gedrag bij een trage of hangende pushdienst tegenover de 45/55/60 s (punt 8).

### Vragen voor de hoofdsessie
- Hoort de push-endpoint-allowlist bij WP3 (zoals PROGRESS › Technische schuld zegt), of wordt hij bewust verplaatst? Zo ja: waarheen, en is daar een besluit voor vastgelegd?
- Is een niet-200-antwoord bij mislukte stappen gewenst voor de AC-063-meting (punt 2)? Dat is een uitvoeringskeuze: vastleggen in DECISIONS.

### Conclusie
NO-GO: eerst punt 1 (skip-update alleen op open taken), punt 2 (antwoord bij falen niet 200), punt 3 (tests van de test-writer voor AC-063…AC-078) en punt 4 (allowlist bouwen of bewust herplannen). De set-gebaseerde tick, de retentie en planner.sql zijn verder inhoudelijk juist en volgen het ontwerp; er is geen BLOKKEREND punt gevonden.
