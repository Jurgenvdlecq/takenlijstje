## Code-review (herreview): herstel na de WP1-herreviews (D-032, D-033), diff 34f1703..53481ad
Beoordeeld: `src/server/actions/tasks.ts`, `src/features/household/store.tsx`, `src/server/actions/notifications.ts`, `eslint.config.mjs`. De nieuwe unit-tests en `tests/e2e/wp1-herreview.spec.ts` heb ik gelezen als bewijs. Ook gelezen: aanroepers en context (`src/server/guards.ts`, `src/features/settings/push-device.tsx`).
Ontwerp gelezen: DECISIONS D-032/D-033, ACCEPTANCE_CRITERIA AC-004, UX_SPEC r.119, wp1-code-reviewer-r2, wp1-security-reviewer-r2 (N1).
Lint/typecheck/tests: `tsc --noEmit` groen (0), `eslint src` groen (0), `vitest run` 11 bestanden en 183 tests groen.

### Per wijziging
1. **tasks.ts:250-255 (security N1): opgelost.**
   - Dubbel opslaan door dezelfde persoon faalt niet ten onrechte. Bij een tweede poging is `created_by_member_id === member.id`, dus die gaat door. Is de eerste poging helemaal gelukt, dan heeft de taak al een `recurrence_id` en komt dit pad niet meer aan bod.
   - Een race tussen twee verschillende leden levert voor de tweede terecht CONFLICT op.
   - De CONFLICT-weg laat geen halve wijziging achter: de upsert is genegeerd (`ignoreDuplicates`) en de throw komt vóór elke schrijfactie op `tasks`, `task_assignments` en de meldingen. De E2E-test bevestigt dat de taak los blijft en de reeks ongewijzigd is.
   - Een reeks-id in een ander huishouden geeft NOT_FOUND ("Terugkerende taak niet gevonden"). Dat is een geweigerde actie met een wat vreemde tekst, maar het is veilig.
2. **tasks.ts:269 en 300 (AC-004): klopt.** Op beide plekken is de update van de reeks de eerste schrijfactie. Dat geldt ook voor het pad "niet meer herhalen" (ends_on). "Er is niets veranderd." is daar dus inhoudelijk waar, en de code blijft FORBIDDEN (standaard van `expectRows`).
3. **store.tsx (N2 en N4): opgelost, geen herlaadlus en geen backoff van 2 s meer.** Twee LAAG-kanttekeningen staan hieronder.
4. **notifications.ts:57-66 (N5): opgelost.**
   - Faalt nu de upsert van het abonnement, dan blijft `push_enabled=true` staan zonder abonnement.
   - Dat is onschadelijk: `push-device.tsx:135-137` meldt het abonnement in de browser af en toont de fout. Zonder abonnement verstuurt `web-push.ts` niets, en een nieuwe poging is idempotent.
5. **eslint.config.mjs: opgelost** voor `process.env["…"]` en destructuring (`{ SUPABASE_SERVICE_ROLE_KEY }`). De resterende omwegen staan onder Doorgeven.

### Bevindingen
1. [LAAG] `src/server/actions/tasks.ts:252-255`: een weesreeks blokkeert de omzetting voor anderen blijvend.
   - Zo'n weesreeks ontstaat als lid A de upsert haalde, maar de update van de taak daarna faalde (netwerk, time-out, taak tegelijk verwijderd). Hetzelfde gebeurt als `created_by_member_id` door `on delete set null` leeg is geworden.
   - Gevolg: iedere andere gebruiker, ook een beheerder, krijgt bij elke poging "Deze taak is net door iemand anders aangepast. Vernieuw en probeer het opnieuw." Opnieuw proberen helpt nooit, dus de tekst belooft iets wat niet werkt. Het is zeldzaam en niet schadelijk; de weigering zelf is precies wat security N1 vroeg.
   - Verbetering: noteer het als bekend randgeval in PROGRESS "Uitgestelde punten". Of pas de tekst aan, bijvoorbeeld "Deze taak kan nu niet terugkerend worden gemaakt".
   - Al eerder aanwezig, niet nieuw: dezelfde persoon krijgt bij een tweede poging na zo'n halve mislukking de oude reekswaarden (regel en titel van de eerste poging), door `ignoreDuplicates`.
2. [LAAG] `src/features/household/store.tsx:107-117`: tweede PGRST116 wordt stil genegeerd.
   - Na één keer herladen wordt een volgende PGRST116 genegeerd zonder log en zonder melding. De gebruiker blijft dan op een verouderd scherm staan zonder te weten waarom.
   - De vlag wordt ook niet gewist als de herlaadactie netjes op `/geen-toegang` uitkomt. Hij verdwijnt pas na een geslaagde verversing.
   - Gevolg: alleen bij de inconsistentie tussen server en browser die de lus moest voorkomen. Nu geen lus meer, maar wel een stil vastgelopen scherm.
   - Verbetering: log in dat geval `console.error("[store] geen huishouden na herladen")` en/of doe `location.assign("/")`, zoals TD §4.3 zegt.
3. [LAAG] `src/features/household/store.tsx:190, 211`: eerste wachttijd wijkt af van D-032.
   - Door `Math.max(..., networkRetries, 1)` met `networkRetries=1` na de eerste netwerkfout is de eerste wachttijd 2000·2¹ = 4 s. D-032 noemt "2 s, 4 s, 8 s".
   - Functioneel prima: het doel (geen fetch elke 2 s) is gehaald.
   - Verbetering: pas D-032 aan naar "4 s, 8 s … tot 60 s", of gebruik `networkRetries - 1`.

Categorie A: gecontroleerd. Binnen de scope van D-032/D-033 en geen scope creep.
Categorie C: gecontroleerd. De lege `catch`-blokken rond `sessionStorage` zijn bewust en van commentaar voorzien; akkoord.
Categorie D en E: gecontroleerd, niets gevonden. `loadOwnSeries` is hergebruikt, geen dubbele helper.
Categorie G: gecontroleerd. Eén extra select per omzetting naar terugkerend; verwaarloosbaar.
Categorie H: N1 heeft een E2E-regressietest. Voor N2 en N4 in de store is er geen test (zie Doorgeven).

### Doorgeven
- Security-reviewer:
  - De N1-fix is correct toegepast; beoordeel hem inhoudelijk.
  - ESLint vangt nog niet: een template literal (``process.env[`SUPABASE_SERVICE_ROLE_KEY`]``), een destructuring met een tekst als sleutel (`{ "SUPABASE_SERVICE_ROLE_KEY": k } = process.env`) en toegang via een variabele (`process.env[naam]`). LAAG, ter beoordeling.
- Test-writer: de herlaadbeveiliging (maximaal één keer herladen per sessie, vlag gewist na een geslaagde verversing) en de backoff bij netwerkfouten in `store.tsx` hebben geen test. LAAG, bijvoorbeeld een unit-test met nagebootste timers.
- Performance-reviewer: niets.

### Vragen voor de hoofdsessie
- Geen.

### Conclusie
GO voor livegang van WP1. Alle vijf herstelpunten lossen het gemelde probleem op zonder nieuwe BLOKKEREND- of GEMIDDELD-fout. De drie LAAG-punten kunnen hersteld worden of in PROGRESS "Uitgestelde punten".
