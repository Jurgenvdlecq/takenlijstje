# Acceptatiecriteria — Takenlijstje (herwerking van de live app)

Versie: ronde 1 (2026-09-28) · Kwaliteitsniveau 2 · Fase 6.

## Bronnen

| Document | Wat eruit komt |
| --- | --- |
| `docs/PRODUCT_SPEC.md` (ronde 3) | BR-nn en UC-nn |
| `docs/UX_SPEC.md` | Flows §4, schermen §5, states §7, rechten in de interface §9 |
| `docs/TECHNICAL_DESIGN.md` | Rechten per regel §5.2, gelijktijdigheid §7, datamigratie §12.4, teststrategie §13, work packages §15 |
| `docs/PROGRESS.md` | Besluiten van Jurgen V-05 t/m V-39, en V-41 t/m V-58 (W-03) |
| `docs/UX_SPEC.md` §13.16 | Enige bron voor de letterlijke teksten van W-03 (T-xx, M-xx) |
| `docs/wijzigingen/W-03/probe/` | Echte antwoorden van de gemeentebron (P0 en U0.2), basis voor de nagebootste bron |

## Afspraken

- **Formaat.** Per criterium:
  - een kop `AC-nnn — titel (WPn; regels)`;
  - de regels GEGEVEN / WANNEER / DAN;
  - een regel **Toets:** met de testlaag.
- **Testlagen** (TECHNICAL_DESIGN §13):

  | Laag | Wat en waar |
  | --- | --- |
  | DB | SQL-tests in `supabase/tests/` |
  | Unit | vitest |
  | Int | integratietest tegen de lokale stack |
  | E2E | Playwright op 390×844 |
  | Vis | screenshot-checkpoint met visual-qa |
  | Live | controle op productie na de deploy |
  | Proces | stap in het draaiboek, gecontroleerd door de code-reviewer |

- **Rollen in de voorbeelddata:**

  | Rol | Persoon |
  | --- | --- |
  | Beheerder | Jurgen, Ellen |
  | Gezinslid | Lynn |
  | Uitgezet lid | Kai (na uitzetten) |
  | Buitenstaander | Bas, lid van een tweede huishouden "Buren" (voor isolatietests) |

- **"Maker"** is het lid dat een taak of reeks aanmaakte. Hij wordt nooit getoond (V-25).
- **"Er verandert niets"** betekent: het aantal rijen en de waarden van de betrokken reeks, taken en historie zijn na de actie gelijk aan ervoor.
- **Besluiten van Jurgen.** Alle criteria volgen de antwoorden tot en met V-39. Er zijn geen open punten meer.
  - **V-36 — uitrol:**
    - WP1 t/m WP3 gaan meteen live. Hun toetsen "Live" en "Proces" gebeuren per WP, direct na de deploy.
    - WP4 t/m WP8 gaan samen live na WP9. Hun toetsen "Live" gebeuren bij die gezamenlijke release; tot dan wordt lokaal getoetst.
    - Zie AC-180.
  - **V-37 — tikken:** afvinken, verplaatsen en "bezig" kosten maximaal twee tikken. Naam of details wijzigen mag vier à vijf tikken kosten (AC-181).
  - **V-38 — "taak gedaan":** gaat ook naar wie afvinkte (AC-073).
  - **V-39 — tijdzone:** vast op Europe/Amsterdam, alleen zichtbaar (AC-182).
- **Nieuwe criteria na de plan-critic.** Die hebben de nummers AC-170 t/m AC-182 gekregen en staan in de sectie van hun work package. Zo blijven de bestaande verwijzingen kloppen.
- **WP2 = WP2a + WP2b.** TECHNICAL_DESIGN splitst WP2 in WP2a (code en expand) en WP2b (draaiboek M2–M8).
  - Hier staat "WP2" voor beide.
  - AC-054, AC-073, AC-178 en AC-179 horen bij WP2a. AC-073 staat daarom in de sectie WP2, niet bij WP3 (plan-critic ronde 2, punt 2).
  - AC-055 t/m AC-061 horen bij WP2b.
- **Regressie.** Elke bevinding uit een review krijgt een extra AC en een test. Die criteria worden na de freeze toegevoegd, via de bouwer in `docs/DECISIONS.md` en een testverwijzing.
- **W-03 — afvalkalender.**
  - De criteria voor WP3b zijn AC-183 t/m AC-223, AC-236 en AC-237. Ze staan in de sectie WP3b, direct na WP3. AC-236 en AC-237 zijn later toegevoegd en staan ná AC-223, zodat de bestaande nummers kloppen.
  - De W-03-criteria voor de nieuwe schermen zijn AC-224 t/m AC-235. Ze staan aan het eind van de secties WP4 t/m WP9.
  - Ze volgen PRODUCT_SPEC §14 (BR-47 t/m BR-59), UX_SPEC §13 en de antwoorden V-41 t/m V-58.
  - "D" is de ophaaldag. Alle tijden zijn Europe/Amsterdam.
  - **Teksten:** noemt een criterium een tekst-ID (T-xx of M-xx), dan toetst de test letterlijk de tekst uit UX §13.16. De tekst tussen aanhalingstekens is daar een kopie van. Bij een verschil geldt UX §13.16.
  - **"Leeg" en "komende ophaaldag"** gaan altijd alleen over rest, papier en PMD. Datums van GFT en kerstbomen tellen nergens mee.
  - **De gemeentebron** wordt in Unit, Int en E2E altijd nagebootst:
    - met de echte P0-antwoorden van het openbare testadres (`probe/fixtures-2591BB-87.json`);
    - voor rest en PMD met synthetische antwoorden in dezelfde vorm;
    - voor een onbekende adrescode met het leeg object `{}` uit U0.2.
    Alleen de Live-toets gebruikt de echte bron.
  - "Huidige schermen" = de oude UI op `main` (WP3b). "Nieuwe schermen" = `v2-ui` (WP4 t/m WP9).

---

## WP1 — Rechtenmodel en securityfixes

### AC-001 — Reeks stoppen door een gezinslid dat niet de maker is (WP1; BR-22; B-01)
GEGEVEN een actieve reeks "Badkamer schoonmaken", gemaakt door Jurgen, met 2 open uitvoeringen en 3 afvinkingen in de historie
WANNEER Lynn (gezinslid, niet de maker) de reeks probeert te stoppen, via de interface of direct via de RPC `stop_series`
DAN wordt de actie geweigerd (42501 / `FORBIDDEN`), is de reeks nog actief, bestaan beide open uitvoeringen nog en is de historie ongewijzigd
**Toets:** DB + Int

### AC-002 — Reeks pauzeren door een gezinslid dat niet de maker is (WP1; BR-22; B-01)
GEGEVEN dezelfde reeks als in AC-001
WANNEER Lynn `pause_series` of `resume_series` aanroept
DAN wordt dit geweigerd en veranderen de pauzevelden en de open uitvoeringen niet
**Toets:** DB + Int

### AC-003 — "Deze en alle volgende" verwijderen door een gezinslid dat niet de maker is (WP1; BR-22, BR-23; B-01)
GEGEVEN een open uitvoering uit Jurgens reeks
WANNEER Lynn `delete_task` aanroept met scope `future`
DAN wordt dit geweigerd, is de reeks nog actief en bestaan alle open uitvoeringen nog, ook de uitvoering waarop de actie werd gestart
**Toets:** DB + Int

### AC-004 — "Deze en alle volgende" wijzigen door een gezinslid dat niet de maker is (WP1; BR-22; B-01)
GEGEVEN een open uitvoering uit Jurgens reeks
WANNEER Lynn via een direct verzoek `updateTaskAction` aanroept met scope `future` en een nieuwe titel
DAN geeft de actie `FORBIDDEN`, zijn de titel en regel van de reeks ongewijzigd, zijn er geen uitvoeringen verwijderd of opnieuw ingepland, en toont de interface "Dit mag je niet (meer) wijzigen. Er is niets veranderd."
**Toets:** Int + E2E

### AC-005 — De RPC om uitvoeringen op te ruimen weigert zonder recht (WP1; BR-22; B-01)
GEGEVEN Jurgens reeks met open uitvoeringen
WANNEER Lynn direct `clear_series_occurrences` aanroept
DAN krijgt ze 42501 en is het aantal open uitvoeringen ongewijzigd
**Toets:** DB

### AC-006 — De maker mag de eigen reeks beheren (WP1; BR-22, BR-09)
GEGEVEN een reeks die Lynn zelf maakte, met 2 open uitvoeringen en 1 afvinking
WANNEER Lynn de reeks stopt
DAN is de reeks inactief, zijn beide open uitvoeringen weg, bestaat de afvinking nog in de historie en maakt de planner geen nieuwe uitvoeringen meer
**Toets:** DB + Int

### AC-007 — Een beheerder mag elke reeks beheren (WP1; BR-22)
GEGEVEN een reeks die Lynn maakte
WANNEER Ellen (beheerder) de reeks pauzeert, hervat of stopt
DAN slaagt de actie
**Toets:** DB

### AC-008 — Maker verwijderd of uitgezet: alleen de beheerders beheren de reeks (WP1; BR-22; PRODUCT_SPEC §6)
GEGEVEN een reeks waarvan de maker is uitgezet of verwijderd
WANNEER Lynn (actief gezinslid, niet de maker) de reeks probeert te stoppen, en daarna Jurgen (beheerder) hetzelfde doet
DAN wordt Lynn geweigerd en slaagt Jurgen. Tot dat moment blijft de reeks gewoon doorlopen
**Toets:** DB

### AC-009 — Stille weigering telt als weigering (WP1; B-01; TECHNICAL_DESIGN §5.1 `expectRows`)
GEGEVEN een server action die een update of delete doet met de gebruikersverbinding
WANNEER RLS de wijziging weigert, zodat er 0 rijen geraakt worden
DAN geeft de action `FORBIDDEN` terug in plaats van "gelukt", en volgt er geen vervolgstap (planning, opruimen, melding)
**Toets:** Int

### AC-010 — Aanmaken is dicht als de instelling uit staat, via elke route (WP1; BR-20; B-02)
GEGEVEN "Gezinsleden mogen taken maken" staat uit
WANNEER Lynn probeert aan te maken: een losse taak, een reeks, standaardtaken activeren, of (zolang die route nog bestaat, tot WP2) een taak met automatische verdeling
DAN wordt elke poging geweigerd en is er geen taak, reeks of toewijzing aangemaakt
**Toets:** DB + Int

### AC-011 — Aanmaken mag als de instelling aan staat (WP1; BR-20)
GEGEVEN "Gezinsleden mogen taken maken" staat aan
WANNEER Lynn een losse taak en een reeks aanmaakt
DAN slagen beide, en staat Lynn als maker vastgelegd (niet zichtbaar)
**Toets:** DB

### AC-012 — Verwijderen: alleen de maker of een beheerder (WP1; BR-23)
GEGEVEN een losse taak die Ellen maakte, en een losse taak die Lynn maakte
WANNEER Lynn beide probeert te verwijderen
DAN is Ellens taak nog aanwezig (geweigerd) en is Lynns eigen taak verwijderd. Een beheerder kan beide verwijderen
**Toets:** DB + Int

### AC-013 — Wijzigen en verplaatsen mag iedereen (WP1; BR-23)
GEGEVEN een losse taak die Ellen maakte, en een uitvoering uit Jurgens reeks
WANNEER Lynn de titel van de losse taak wijzigt en de uitvoering een dag verplaatst
DAN slagen beide. De verplaatste uitvoering is een uitzondering (`is_exception`) en de reeks zelf is ongewijzigd
**Toets:** DB + Int

### AC-014 — Onveranderlijke velden (WP1; BR-23; B-04)
GEGEVEN een taak
WANNEER iemand de maker, het huishouden, de reeks of de oorspronkelijke datum in de reeks (`occurrence_date`) probeert te veranderen met een directe update. Voor de maker geldt dit ook als het een beheerder is
DAN wordt de update geweigerd en blijven die velden gelijk. Uitzondering volgens TECHNICAL_DESIGN §5.2 ("Reekskoppeling"): een beheerder of de maker van de reeks mag `occurrence_date` wijzigen, en een losse taak mag aan een eigen, nieuwe reeks worden gekoppeld (nodig voor "deze en volgende" en "losse taak wordt terugkerend"). Wisselen van reeks blijft altijd geweigerd (W-01, akkoord Jurgen 2026-09-28)
**Toets:** DB

### AC-015 — Afvinken alleen via de afvinkfunctie (WP1; BR-11, BR-12)
GEGEVEN een open taak
WANNEER iemand met een directe update de status op `done` zet of `completed_at` invult
DAN wordt dat geweigerd. Het afvinken zelf lukt via `complete_task`
**Toets:** DB

### AC-016 — Gebruikers kunnen geen meldingen plaatsen (WP1; BR-25; B-03)
GEGEVEN een ingelogd actief lid
WANNEER hij rechtstreeks een rij invoegt in `notifications` (voor zichzelf of voor een huisgenoot)
DAN wordt dit geweigerd, want er is geen insert-recht voor gebruikers
**Toets:** DB

### AC-017 — Meldingslinks zijn altijd intern (WP1; BR-25; B-03)
GEGEVEN het systeem dat een melding opslaat
WANNEER de url `//andere-site.nl`, `/\andere-site.nl` of `https://andere-site.nl` is
DAN weigert de database de rij. `/?taak=<id>` en `/` worden geaccepteerd
**Toets:** DB + Unit (`appUrl`)

### AC-018 — Tik op een pushmelding blijft binnen de app (WP1; BR-25; B-03)
GEGEVEN een pushmelding waarvan de url, na het samenvoegen met de origin, naar een andere origin zou wijzen
WANNEER de gebruiker op de melding tikt
DAN opent de service worker de startpagina van de app, niet het externe adres
**Toets:** Unit (SW-hulpfunctie) of E2E

### AC-019 — Er is altijd een actieve beheerder (WP1; BR-24)
GEGEVEN Jurgen is de enige actieve beheerder
WANNEER iemand hem probeert te degraderen, uit te zetten of te verwijderen
DAN wordt dat geweigerd met "Er moet altijd minstens één beheerder (met toegang) zijn"
**Toets:** DB

### AC-020 — Een gezinslid kan de eigen rol en status niet wijzigen (WP1; BR-24)
GEGEVEN Lynn (gezinslid)
WANNEER ze de eigen rol op beheerder of de eigen actieve status probeert te zetten
DAN wordt dat geweigerd. Wijzigingen aan de eigen naam, kleur en emoji slagen wel
**Toets:** DB

### AC-021 — Een beheerder kan zichzelf niet uitzetten of verwijderen via ledenbeheer (WP1; BR-24)
GEGEVEN Jurgen (beheerder), met Ellen als tweede beheerder
WANNEER hij zichzelf via ledenbeheer uitzet of verwijdert
DAN wordt dat geweigerd. Jezelf verwijderen kan alleen via "Account verwijderen" (AC-134)
**Toets:** DB + Int

### AC-022 — Uitgezet lid: geen toegang tot huishouddata (WP1; V-29)
GEGEVEN Kai is uitgezet door een beheerder
WANNEER Kai een tabel met huishouddata leest, een RPC aanroept (afvinken, terugdraaien) of een server action gebruikt
DAN geven de selects 0 rijen, weigeren de RPC's en geven de actions `FORBIDDEN`. Alleen zijn eigen lidrij en `my_membership()` zijn leesbaar
**Toets:** DB + Int

### AC-023 — Uitgezet lid: scherm "Geen toegang" en lokale data weg (WP1; V-29; BR-43)
GEGEVEN Kai heeft eerder offline gegevens op zijn telefoon en is intussen uitgezet
WANNEER hij de app opent
DAN ziet hij alleen `/geen-toegang`, met de naam van het huishouden, Uitloggen en een link naar Account verwijderen. Er is geen onderbalk, er zijn geen taken, en de lokale cache en wachtrij zijn leeg
**Toets:** E2E

### AC-024 — Uitgezet lid krijgt geen meldingen (WP1/WP3; V-29)
GEGEVEN Kai is uitgezet en had herinneringen aan staan
WANNEER de tick draait of iemand een taak afvinkt
DAN wordt er voor Kai geen melding opgeslagen en geen push verstuurd
**Toets:** Int

### AC-025 — Weer aanzetten herstelt alles (WP1; V-29)
GEGEVEN Kai is uitgezet geweest
WANNEER een beheerder hem weer aanzet
DAN ziet Kai het huishouden weer volledig, zijn zijn notities en account ongewijzigd, en werken zijn meldingsvoorkeuren weer zoals voorheen
**Toets:** DB + E2E

### AC-026 — Isolatie tussen huishoudens bij lezen (WP1; BR-26)
GEGEVEN twee huishoudens, "Familie" en "Buren"
WANNEER Bas (Buren) via de REST-API of Realtime elke tabel van het schema public bevraagt
DAN krijgt hij geen enkele rij van Familie te zien
**Toets:** DB (per tabel) + E2E (nieuw account ziet niets van een ander huishouden)

### AC-027 — Isolatie tussen huishoudens bij schrijven (WP1; BR-26)
GEGEVEN Bas kent de id van een taak, reeks, boodschap of lid van Familie
WANNEER hij met die id een server action aanroept (afvinken, wijzigen, verwijderen, notitie, verplaatsen) of een rij invoegt die ernaar verwijst
DAN krijgt hij `NOT_FOUND` of een foreign-key-fout, en verandert er niets bij Familie
**Toets:** DB + Int

### AC-028 — Interne databasefuncties zijn niet aan te roepen (WP1; B-04)
GEGEVEN een ingelogde gebruiker
WANNEER hij een trigger- of interne functie in het schema `private` aanroept die niet in een policy wordt gebruikt
DAN krijgt hij "permission denied"
**Toets:** DB

### AC-029 — Tick en status alleen met het geheim (WP1; B-05; §6.5)
GEGEVEN de endpoints `/api/cron/tick` en `/api/status`
WANNEER ze worden aangeroepen zonder header of met een verkeerde header `Authorization: Bearer`
DAN is het antwoord 401 en wordt er niets uitgevoerd. Met het juiste geheim bevat het antwoord alleen tellingen of status, geen geheimen
**Toets:** Int + Live

### AC-030 — De service role alleen in de systeemmap (WP1; TECHNICAL_DESIGN §5.3)
GEGEVEN de code
WANNEER een bestand buiten `src/server/system/**` de systeemclient importeert
DAN faalt `npm run lint`
**Toets:** Lint + code-review

### AC-031 — Uitloggen wist alles lokaal (WP1; BR-43)
GEGEVEN Jurgen is ingelogd, met een gevulde cache en push aan
WANNEER hij uitlogt en Ellen daarna op dezelfde telefoon inlogt
DAN zijn de IndexedDB-cache, de wachtrij, de paginacache en het pushabonnement van Jurgen verwijderd, en ziet Ellen geen gegevens uit Jurgens sessie
**Toets:** E2E

### AC-032 — Een geweigerde offline wijziging wordt niet eindeloos herhaald (WP1/WP4; TECHNICAL_DESIGN §9.3)
GEGEVEN een offline afvinking in de wachtrij, terwijl de gebruiker intussen is uitgezet of de taak is verwijderd
WANNEER de verbinding terugkomt
DAN krijgt de actie `FORBIDDEN` of `NOT_FOUND`, verdwijnt hij uit de wachtrij en ziet de gebruiker (als die nog toegang heeft) "1 offline wijziging kon niet worden verwerkt: <taak>"
**Toets:** Int (outbox) + E2E

### AC-033 — Nette foutmeldingen, schone logs (WP1; §6, §9.4)
GEGEVEN een actie die faalt op RLS, een constraint of een eigen RPC-fout
WANNEER de fout bij de gebruiker en in de log komt
DAN ziet de gebruiker een Nederlandse tekst zonder policynaam of stacktrace. De log bevat alleen de actienaam, de foutnaam en de code: geen invoer, titels, namen, e-mailadressen, tokens of `user_id`
**Toets:** Unit (`friendlyMessage`) + code-review

### AC-170 — Niemand verliest ongemerkt toegang bij de invoering van "uitgezet" (WP1; V-29; plan-critic punt 7)
GEGEVEN de live database vóór de deploy van WP1
WANNEER de bouwer met een alleen-lezen telling vaststelt hoeveel leden een account hebben en `is_active = false`
DAN wordt WP1 alleen uitgerold bij 0. Bij 1 of meer toont de bouwer Jurgen de namen, en kiest Jurgen per naam uit twee mogelijkheden: **weer aanzetten** of **uitgezet laten**. Verwijderen hoort daar niet bij; dat kan Jurgen daarna zelf via Gezinsleden. Er wordt niets uitgerold tot hij voor elke naam heeft beslist. Zijn keuze per naam komt in `docs/PROGRESS.md`, zodat de tweede controle (AC-055) weet wie al beoordeeld is
**Toets:** Proces + Live (alleen lezen)

---

## WP2 — Datamodel, scope en datamigratie

### AC-034 — Afvinken registreert geen persoon (WP2; BR-12; V-21)
GEGEVEN een open taak
WANNEER Ellen hem afvinkt
DAN bevat de nieuwe historie-rij titel, categorie, `completed_at`, geplande dag, deadline, `was_late`, `minutes_late`, duur en notitie, maar geen enkel veld dat naar Ellen verwijst. Ook de taakrij bevat niet wie afvinkte
**Toets:** DB + Int

### AC-035 — Privacytest op het schema (WP2; BR-12; succescriterium 7)
GEGEVEN de database na de contract-migratie
WANNEER `supabase/tests/30_privacy.sql` draait
DAN:
- **Schema:** in `tasks`, `task_completions` en `shopping_items` bestaat geen kolom `completed_by*`, `member_id`, `added_by*` of `bought_by*`. De test faalt zodra zo'n kolom terugkomt.
- **Inhoud:** er is geen melding waarvan de titel of tekst "gedaan door" bevat, of de weergavenaam van een lid in combinatie met "gedaan", "voor jou", "van jou" of "jouw naam". Dit sluit aan op de inhoudscontrole van M6 in TECHNICAL_DESIGN §12.4. Er is geen melding van het type `task_completed`, `daily_summary` of `evening_summary` met `created_at` vóór het moment van de contract-migratie.
**Toets:** DB (in CI, met seed-data die zulke oude meldingen bevat) + Live (alleen lezen, na M6)

### AC-036 — Dubbel tikken geeft één registratie (WP2; BR-10, BR-11)
GEGEVEN een open taak
WANNEER dezelfde afvinking met dezelfde `mutationId` twee keer snel na elkaar wordt verstuurd
DAN bestaat er precies één historie-rij en geven beide aanroepen dezelfde registratie terug
**Toets:** DB + Int

### AC-037 — Twee mensen vinken tegelijk af (WP2; BR-11; §7)
GEGEVEN een open taak
WANNEER Jurgen en Ellen hem gelijktijdig afvinken, met verschillende `mutationId`'s (`Promise.all`)
DAN bestaat er precies één historie-rij, krijgen beiden "gedaan" terug en geeft geen van beiden een foutmelding
**Toets:** Int

### AC-038 — Te laat wordt vastgelegd (WP2; BR-12)
GEGEVEN een taak met deadline 12:00
WANNEER hij om 12:07 wordt afgevinkt
DAN is `was_late = true` en `minutes_late = 7`. Afgevinkt om 11:59 geeft `was_late = false` en `0`
**Toets:** DB

### AC-039 — Offline afvinkmoment wordt begrensd (WP2; BR-12)
GEGEVEN een afvinking uit de wachtrij met `completedAt` in de toekomst, en een tweede met `completedAt` 10 dagen geleden
WANNEER beide worden verwerkt
DAN wordt het moment respectievelijk "nu" en "nu − 7 dagen"
**Toets:** DB

### AC-040 — Historie blijft na verwijderen (WP2; BR-12)
GEGEVEN een reeks met 3 afvinkingen
WANNEER de reeks wordt gestopt en een afgevinkte losse taak wordt verwijderd
DAN bestaan alle historie-rijen nog, met hun titel als momentopname
**Toets:** DB

### AC-041 — Iedereen mag terugdraaien, ook later (WP2; BR-13; V-22)
GEGEVEN een taak die gisteren is afgevinkt (door wie is niet bekend)
WANNEER Lynn (gezinslid) hem terugzet
DAN staat de taak weer open, is de bijbehorende historie-rij verwijderd en verschijnt de taak weer in de juiste sectie
**Toets:** DB + Int

### AC-042 — Terugdraaien van een open taak doet niets (WP2; BR-13)
GEGEVEN een taak die niet gedaan is
WANNEER iemand `undo_complete_task` aanroept, bijvoorbeeld twee keer snel na elkaar
DAN verandert er niets en volgt er geen foutmelding
**Toets:** DB

### AC-043 — Afvinken tijdens bewerken (WP2; §7; PRODUCT_SPEC §6)
GEGEVEN Ellen heeft het bewerkformulier van een taak open en Jurgen vinkt die taak intussen af
WANNEER Ellen de titel opslaat
DAN is de nieuwe titel opgeslagen en blijft de taak gedaan
**Toets:** Int

### AC-044 — De volgende keer staat klaar na afvinken (WP2; UC-02; BR-02)
GEGEVEN een dagelijkse reeks waarvan alleen de uitvoering van vandaag nog open is
WANNEER die wordt afgevinkt
DAN is er een open uitvoering voor de eerstvolgende dag. Een tweede afvinkpoging maakt geen extra uitvoering
**Toets:** Int

### AC-045 — Vervallen functies bestaan niet meer (WP2; V-21, V-24)
GEGEVEN de app na WP2
WANNEER een gebruiker de interface doorloopt, of iemand de oude acties of RPC's aanroept (`assignTask`, ruilen, afwezigheid, `accept_swap_request`, `complete_task` met `p_completed_by`)
DAN zijn er geen velden of knoppen voor "Wie?", punten, spaardoel, ruilen, afwezigheid of "namens", en falen de oude aanroepen (bestaan niet)
**Toets:** Int + E2E + Vis

### AC-046 — Eén huishouden per persoon (WP2; BR-44; V-08)
GEGEVEN Lynn is lid van Familie
WANNEER ze een nieuw huishouden probeert aan te maken, of een uitnodiging van Buren accepteert
DAN wordt dat geweigerd met "Je hoort al bij een ander huishouden. Je kunt maar bij één huishouden horen." en ontstaat er geen tweede lidmaatschap
**Toets:** DB + E2E

### AC-047 — Uitnodigingsregels (WP2; BR-41; UC-09)
GEGEVEN uitnodigingen die verlopen zijn (> 14 dagen), al gebruikt zijn, of gebonden zijn aan `x@example.com`
WANNEER iemand ze probeert te accepteren (voor de gebonden uitnodiging: met een ander adres)
DAN wordt dat geweigerd met de passende tekst uit UX §4.11. Is de gebruiker al lid van dit huishouden, dan wordt de uitnodiging alleen afgerond, zonder tweede lidrij
**Toets:** DB + E2E

### AC-048 — Alleen een beheerder maakt uitnodigingen (WP2; BR-41)
GEGEVEN Lynn (gezinslid)
WANNEER ze een uitnodiging probeert te maken of in te trekken
DAN wordt dat geweigerd
**Toets:** DB

### AC-049 — Dubbel aanmaken geeft één rij (WP2; BR-10; R-03)
GEGEVEN een nieuwe taak, reeks, notitie, boodschap, uitnodiging of een activering van standaardtaken, elk met een id die de client heeft gegenereerd
WANNEER hetzelfde verzoek twee keer wordt verstuurd
DAN bestaat de rij, of de reeks met zijn uitvoeringen, precies één keer
**Toets:** DB + Int

### AC-050 — Dubbel archiveren geeft één nieuwe lijst (WP2; BR-42; R-03)
GEGEVEN een actieve lijst met 3 gekochte en 2 niet-gekochte producten
WANNEER "Klaar met winkelen" twee keer met dezelfde `listId` wordt verstuurd
DAN is er precies één nieuwe actieve lijst met de 2 niet-gekochte producten. De oude lijst is gearchiveerd met de 3 gekochte. Per huishouden is er altijd precies één actieve lijst
**Toets:** DB

### AC-051 — Archiveren ongedaan maken (WP2/WP8; UX §4.8)
GEGEVEN een lijst die net is afgerond
WANNEER "Ongedaan maken" wordt gekozen
DAN is de oude lijst weer actief, met alle producten, en is de nieuwe lege lijst verdwenen. Een tweede keer ongedaan maken doet niets
**Toets:** DB

### AC-052 — Standaard meldingsvoorkeuren per rol (WP2; BR-31; V-23)
GEGEVEN een nieuw lid
WANNEER het als beheerder of als gezinslid wordt aangemaakt
DAN staan bij een beheerder herinneringen, "deadline nadert", "verlopen", dagoverzicht en avondoverzicht aan, en bij een gezinslid allemaal uit. "Taak gedaan" staat bij iedereen uit. Een latere rolwijziging verandert de voorkeuren niet
**Toets:** DB

### AC-053 — Bestaande gezinsleden krijgen de nieuwe standaard (WP2; V-23; TECHNICAL_DESIGN §3.3)
GEGEVEN bestaande leden vóór de migratie `…_200`
WANNEER die migratie draait
DAN staan de genoemde soorten uit voor leden met rol gezinslid, ook als het lid die zelf had aangezet, en zijn de voorkeuren van beheerders ongewijzigd (PRODUCT_SPEC BR-46.5)
- Het totaalvoorstel aan Jurgen noemt dit gevolg expliciet, voordat het gebeurt.
**Toets:** DB (op een kopie van het oude schema, met een gezinslid dat zelf herinneringen aan had) + Live-controle + Proces (totaalvoorstel)

### AC-054 — Na de expand-stap schrijft de app geen persoon meer (WP2; BR-46; draaiboek M1)
GEGEVEN `…_200` en de WP2-code staan op live
WANNEER er na het moment van deployen wordt afgevinkt. WP2a gaat direct live, met de huidige schermen (V-36)
DAN is het aantal taken met `completed_by_member_id is not null` en `completed_at > <deploymoment>` gelijk aan 0
**Toets:** Live + Proces

### AC-055 — Voorcontroles stoppen bij twijfel (WP2; BR-46; M2)
GEGEVEN de voorcontroles op live, alleen lezend, uitgevoerd vóór de eerste migratie die ervan afhangt:
- een gebruiker in meer dan één huishouden;
- meer dan één afvinking per taak;
- meer dan één actieve lijst per huishouden;
- leden met een account en `is_active = false`.
WANNEER een van die tellingen niet 0 is
DAN stopt het draaiboek, wordt er niets gewist of gewijzigd, en legt de bouwer de opties voor aan Jurgen. Hij verzint zelf geen ontdubbelregel
- **Uitgezette leden met een account (controle M1(d)):**
  - Er wordt alleen gestopt voor namen die Jurgen **nog niet eerder** beoordeelde, bij de telling vóór WP1 (AC-170). Voor die namen toont de bouwer ze aan Jurgen, en kiest Jurgen per naam uit twee mogelijkheden: **weer aanzetten** of **uitgezet laten**. Verwijderen kan hij daarna zelf via Gezinsleden.
  - Namen die Jurgen eerder al beoordeelde, en leden die na WP1 bewust via de app zijn uitgezet, worden **alleen gemeld**, zonder te stoppen.
  - **Herkenregel (TECHNICAL_DESIGN §12.4, M1(d)):** "bewust via de app uitgezet" telt alleen als Jurgen of Ellen die uitzetting zelf aan de bouwer noemde. Is dat niet vast te stellen, dan geldt de naam als "nog niet beoordeeld" en stopt M1(d) voor die naam.
  - Alle keuzes komen in dezelfde lijst in `docs/PROGRESS.md` als bij AC-170.
- Pas daarna gaat de betreffende stap verder (zie ook AC-170 voor de telling vóór WP1).
**Toets:** Proces

### AC-056 — Back-up is volledig (WP2; BR-46.1; V-33; M3)
GEGEVEN de live database vóór het wissen
WANNEER de back-up is gemaakt
DAN:
- staat hij als kopie van alle tabellen van `public` in het schema `backup_v2_<datum>`, binnen het eigen Supabase-project in Frankfurt;
- is het aantal rijen per tabel in de back-up gelijk aan live;
- is het schema niet bereikbaar voor de rollen `anon` en `authenticated`, en wordt het niet via de API ontsloten;
- is er geen los exportbestand gemaakt en hebben er geen gegevens het project verlaten (V-33).
**Toets:** Proces + Live

### AC-057 — Terugzetten is getest (WP2; BR-46.1; M4, M0)
GEGEVEN de back-up
WANNEER de restore-controle hem terugzet in een apart schema
DAN zijn de aantallen en checksums per tabel gelijk aan live. Anders stopt het draaiboek
- Ook in de sandbox (M0): back-up → contract → restore → vergelijken levert een identiek resultaat.
**Toets:** Proces + DB (sandbox)

### AC-058 — Nooit wissen zonder Jurgens bevestiging vlak ervoor (WP2; BR-46.2; V-26; M5)
GEGEVEN de back-up en de restore-test zijn geslaagd
WANNEER de bouwer de contract-migratie `…_210` op live wil uitvoeren
DAN heeft hij Jurgen eerst in gewone taal getoond:
- de datum en plaats van de back-up;
- de geslaagde restore-test;
- de exacte aantallen die verdwijnen, per soort gegevens, **inclusief de bestaande meldingen "taak gedaan" en de dag- en avondoverzichten** (BR-46.3). Die aantallen zijn **direct vóór de vraag opnieuw geteld**.

Daarna heeft Jurgen letterlijk geantwoord met "ja, wissen". Dat antwoord staat letterlijk in `docs/PROGRESS.md`
- Zonder dat antwoord wordt `…_210` niet uitgevoerd.
- Een eerder akkoord, ook `/design-go`, telt niet.
- De contract-migratie draait in dezelfde werksessie als het antwoord.
- Is er intussen iets gewijzigd waardoor de aantallen niet meer kloppen, dan wordt opnieuw gevraagd.
**Toets:** Proces (code-reviewer controleert PROGRESS en het bouwverslag)

### AC-059 — Wat verdwijnt en wat blijft (WP2; BR-46.3/4; M6)
GEGEVEN de contract-migratie is uitgevoerd
WANNEER de controles op live draaien
DAN:
- zijn toewijzingen, ruilverzoeken, afwezigheden, punten, "wie afvinkte", "toegevoegd/gekocht door", meldingen van vervallen soorten en leden zonder account weg;
- zijn **alle meldingen "taak gedaan" en alle dag- en avondoverzichten van vóór de overgang weg**;
- is het aantal historie-rijen gelijk aan vóór het wissen (zonder persoon);
- bestaan makers van taken en reeksen en schrijvers van notities nog;
- geeft de privacytest (AC-035) op live zowel voor het schema als voor de inhoud van de meldingen 0 treffers.
**Toets:** Live + Proces

### AC-060 — Terugrollen kan (WP2; TECHNICAL_DESIGN §12.4)
GEGEVEN een probleem na M6
WANNEER `restore_v2.sql` wordt uitgevoerd en de vorige deployment wordt teruggezet
DAN werkt de oude versie weer met de oude gegevens (getest in M0)
**Toets:** DB (sandbox)

### AC-061 — De back-up wordt na 30 dagen en een melding opgeruimd (WP2; V-33; M8)
GEGEVEN de back-up `backup_v2_<datum>` na het wissen
WANNEER 30 dagen na de datum van het wissen voorbij zijn
DAN:
- meldt de bouwer Jurgen dat de back-up wordt opgeruimd;
- wordt daarna het schema verwijderd (`drop schema … cascade`);
- bestaat er daarna geen kopie meer met de oude persoonsgegevens.

Vóór de 30 dagen wordt de back-up niet verwijderd. Na de 30 dagen blijft hij niet ongemerkt staan
**Toets:** Proces + Live (het schema bestaat niet meer)

### AC-062 — Schrijver van een notitie na vertrek (WP2/WP7; V-25)
GEGEVEN een notitie van Kai
WANNEER Kai zijn account verwijdert of uit het huishouden wordt verwijderd
DAN:
- blijft de notitie bestaan, met als schrijver de **laatst bekende naam** van Kai ("Kai:"), uit `author_name` (V-34, TECHNICAL_DESIGN §3.1);
- wordt `member_id` leeg en blijft `author_name` staan;
- blijft de naam ook staan bij een uitgezet lid (UX §4.15).
**Toets:** DB + E2E

### AC-178 — De schrijversnaam is niet te vervalsen en niet te wijzigen (WP2; V-25, V-34; plan-critic punt 5; TECHNICAL_DESIGN §3.1)
GEGEVEN Lynn (gezinslid) bij een taak
WANNEER ze:
- (a) een notitie plaatst en daarbij met een direct verzoek `author_name = "Jurgen"` of een andere `member_id` meestuurt;
- (b) daarna met een directe update de `author_name`, `member_id`, tekst, taak of het huishouden van een bestaande notitie probeert te wijzigen (eigen notitie of die van een ander).

Een beheerder probeert (b) ook.
DAN:
- bij (a) is de notitie opgeslagen met `author_name` = Lynns eigen weergavenaam. De meegestuurde waarde is genegeerd, en een andere `member_id` wordt geweigerd (RLS `is_my_member`);
- bij (b) wordt elke wijziging geweigerd, ook voor de beheerder, en is de notitie ongewijzigd;
- verwijderen blijft volgens AC-108 mogelijk (eigen notitie, of een beheerder).
**Toets:** DB

### AC-179 — Schrijversnaam van bestaande notities bij de overgang (WP2; V-34; TECHNICAL_DESIGN §3.2 `…_200`)
GEGEVEN live notities van vóór de migratie: een deel van leden die nog bestaan, en een deel van leden die al verwijderd zijn (`member_id` leeg)
WANNEER de expand-migratie draait
DAN heeft elke notitie een `author_name`: de huidige weergavenaam van het lid als dat nog bestaat, en anders "Gezinslid". Geen notitie heeft een lege schrijver
**Toets:** DB (op een kopie van het oude schema) + Live (alleen lezen: `count(*) where author_name is null` = 0)

### AC-073 — "Taak gedaan" naar iedereen die hem aan heeft, ook de afvinker (WP2a; BR-31; V-21, V-38; plan-critic ronde 2, punt 2)
GEGEVEN Ellen en Jurgen hebben "taak gedaan" aan staan, Lynn heeft hem uit, en Kai is uitgezet
WANNEER Ellen "Vaatwasser uitruimen" afvinkt, en in een tweede geval Jurgen dezelfde soort taak afvinkt
DAN:
- krijgen **zowel Ellen als Jurgen** in beide gevallen precies één melding "Vaatwasser uitruimen is gedaan", zonder naam;
- krijgen Lynn en Kai niets;
- is de set ontvangers in beide gevallen gelijk, zodat uit tekst en ontvangers niet af te leiden is wie afvinkte (V-38, optie a);
- wordt ook bij dubbel afvinken maar één melding per ontvanger opgeslagen.

**Vanaf de livegang van WP2a** sluit geen enkele nieuw opgeslagen melding "taak gedaan" de afvinker nog uit, en bevat geen enkele nieuwe melding een naam.
- Daarmee wordt het lek niet pas in WP3 gedicht. Zonder deze eis zou er tussen WP2a en WP3 op live opnieuw vastgelegd worden wie afvinkte, ná het wissen in WP2b.
- **Controle op live, vóór M5** (vóór de vraag "ja, wissen" aan Jurgen):
  - Voor alle meldingen "taak gedaan" sinds de WP2a-deploy vergelijkt de bouwer per `dedupe_key` (één afvinking) de set ontvangers met de leden die de voorkeur "taak gedaan" op dat moment aan hadden staan.
  - Is er een verschil, dan zoekt hij dat eerst uit. Het kan komen door een voorkeur die intussen is gewijzigd. Pas als vaststaat dat het geen uitsluiting van de afvinker is, gaat M5 verder.
**Toets:** Int + Unit (`recipientsFor` gebruikt de afvinker niet) + Live/Proces (controle vóór M5)

---

## WP3 — Planner, tick, meldingen en bewaartermijnen

### AC-063 — De planner draait elke 15 minuten (WP3; BR-30; R-01)
GEGEVEN productie na WP3
WANNEER het schema van de planner wordt bekeken en over 2 uur de tick-aanroepen worden geteld
DAN:
- staat in het eigen Supabase-project een Supabase Cron-taak (pg_cron + pg_net) met schema elke 15 minuten, die de tick aanroept (V-32);
- staan het geheim en de URL van de tick in Supabase Vault, en komen ze niet voor in migraties, de repository of `docs/`;
- zijn er in 2 uur minstens 8 aanroepen, die elk met 200 antwoorden;
- blijft het dagelijkse vangnet via Vercel bestaan.
**Toets:** Live + code-review (geen geheimen in de repository)

### AC-064 — Herinneringen komen binnen 15 minuten (WP3; BR-30, BR-31; succescriterium 5)
GEGEVEN een taak met een herinnering op tijdstip T, en een beheerder met herinneringen aan
WANNEER het tijdstip T verstrijkt
DAN bestaat de in-app-melding uiterlijk om T + 15 minuten, en is de push (indien aan) daarna verstuurd
**Toets:** Live (meting in WP3) + Int (tick met een vaste `now`)

### AC-065 — Een tweede tick maakt niets dubbel (WP3; BR-02, BR-31; §7)
GEGEVEN een tick is net gedraaid op een vaste `now`
WANNEER een tweede tick draait op dezelfde `now`, of twee ticks overlappen
DAN komen er geen extra taken, meldingen of pushes bij
**Toets:** Int

### AC-066 — Planning 14 dagen vooruit (WP3; BR-02)
GEGEVEN een wekelijkse reeks en een maandelijkse reeks
WANNEER de tick plant
DAN staan er voor de wekelijkse reeks uitvoeringen tot 14 dagen vooruit, en voor de maandelijkse alleen de eerstvolgende. Geen enkele `(reeks, datum)` bestaat twee keer
**Toets:** Unit (`planSeries`) + Int

### AC-067 — Pauze wordt gerespecteerd (WP3/WP6; BR-09)
GEGEVEN een reeks die gepauzeerd is van 1 tot en met 14 november
WANNEER de tick plant
DAN komen er geen uitvoeringen met een datum in die periode, en staan er daarna weer uitvoeringen zonder handeling
**Toets:** Unit + Int

### AC-068 — Verlopen stapelt niet op (WP3; BR-16)
GEGEVEN een dagelijkse reeks waarvan de uitvoering van gisteren verlopen is en die van vandaag beschikbaar is
WANNEER de tick draait
DAN krijgt de uitvoering van gisteren de status "overgeslagen", en telt hij in het Overzicht mee als vergeten
**Toets:** Unit + Int

### AC-069 — "Verlopen" is afgeleid (WP3; BR-17)
GEGEVEN een open taak waarvan de deadline net voorbij is, terwijl er nog geen tick heeft gedraaid
WANNEER Vandaag wordt geladen
DAN staat de taak bij Verlopen
**Toets:** Unit (`status`)

### AC-070 — Moment van herinneren en waarschuwen (WP3; BR-31)
GEGEVEN een taak met een herinnering 60 minuten vooraf, een deadline, en een waarschuwingstijd van 120 minuten
WANNEER de tick draait op verschillende momenten
DAN:
- komt de herinnering vanaf 60 minuten vooraf, en niet meer als dat moment meer dan 90 minuten voorbij is;
- komt "deadline nadert" binnen 120 minuten vóór de deadline;
- komt "verlopen" één keer, binnen 24 uur na de deadline.
**Toets:** Unit (`reminders`)

### AC-071 — Wie krijgt de meldingen (WP3; BR-31; V-23)
GEGEVEN Jurgen (beheerder, standaard), Lynn (gezinslid, standaard) en Kai (uitgezet), plus een lid dat herinneringen zelf heeft aangezet
WANNEER er een herinnering, "deadline nadert", "verlopen" of een overzicht verstuurd wordt
DAN krijgen alleen Jurgen en dat lid die melding. Lynn krijgt niets met de standaard, Kai krijgt niets
**Toets:** Unit (`recipientsFor`) + Int

### AC-072 — Dag- en avondoverzicht voor het huishouden (WP3; BR-31)
GEGEVEN vandaag 5 open taken en 1 verlopen taak
WANNEER het tijdvenster van het dag- of avondoverzicht aanbreekt
DAN krijgt de ontvanger:
- om de dagtijd één keer "Vandaag staan er 5 taken";
- om de avondtijd één keer "Er staan nog N taken open".

Bij 0 open taken komt er geen overzicht. Er staat nergens "voor jou"
**Toets:** Unit + Int

### AC-074 — Meldingsteksten bevatten geen namen van leden (WP3; V-21; UX §4.9)
GEGEVEN alle meldingsbuilders
WANNEER ze tekst maken voor elk meldingstype
DAN bevat geen enkele tekst de naam van een lid. Namen in de taaktitel zelf zijn toegestaan
**Toets:** Unit

### AC-075 — Pushen alleen voor nieuwe meldingen; dode abonnementen weg (WP3; BR-45)
GEGEVEN een melding die al bestond, en een pushabonnement dat 410 teruggeeft
WANNEER de tick draait
DAN wordt de bestaande melding niet opnieuw gepusht, wordt `pushed_at` per id gezet, en is het abonnement met 410 verwijderd
**Toets:** Int

### AC-076 — Een fout in één stap blokkeert de andere niet (WP3; TECHNICAL_DESIGN §11.3)
GEGEVEN de meldingenstap faalt
WANNEER de tick draait
DAN draaien planning en opruimen toch. Het antwoord en de log bevatten alleen tellingen en codes. Na 45 seconden stopt het pushen, en de meldingen staan wel in de app
**Toets:** Int

### AC-077 — Bewaartermijnen (WP3; BR-45)
GEGEVEN rijen net vóór en net ná elke grens:

| Gegevens | Grens |
| --- | --- |
| Afvinkhistorie | 2 jaar |
| Meldingen | 90 dagen |
| Gearchiveerde lijsten (met producten) | 1 jaar |
| Uitnodigingen | 30 dagen na gebruik of verlopen |
| Zacht verwijderde taken | Volgens de regel in TECHNICAL_DESIGN §3.4 |

WANNEER het opruimen draait
DAN zijn alleen de rijen voorbij de grens weg. Actieve gegevens, de actieve lijst en open uitnodigingen blijven. Na het verwijderen van een oude taak blijft de historie bestaan
**Toets:** DB (`40_retentie.sql`)

### AC-078 — Opruimen alleen door het systeem (WP3; BR-45)
GEGEVEN een ingelogde gebruiker
WANNEER hij `run_purge()` of `purge_expired_data()` aanroept
DAN wordt dat geweigerd
**Toets:** DB

---

## WP3b — Afvalkalender (W-03)

### AC-183 — Adres instellen door een beheerder (WP3b; BR-48, BR-49, BR-50; UC-13)
**(a) Met ophaaldagen in de komende 14 dagen.**
GEGEVEN Jurgen (beheerder) en een geldig Haags adres met ophaaldagen voor rest, papier en PMD in de komende 14 dagen
WANNEER hij postcode en huisnummer invult, "Adres zoeken" kiest, bij "Klopt dit?" (T-45) het adres (T-45a, met plaats "Den Haag"), de eerstvolgende ophaaldag per bak en de uitleg T-46 ziet, en "Ja, aanzetten" kiest
DAN:
- is het adres bewaard;
- ziet hij de melding T-90 "Afvalkalender staat aan · taken voor 2 weken klaargezet · Bekijken";
- staat er voor elke ophaaldag van vandaag t/m vandaag + 14 dagen één buitenzet-taak en één binnenzet-taak (BR-49);
- zijn die taken zichtbaar op Vandaag en in de Kalender van de huidige schermen.

Heeft één bak geen datum, dan staat bij die bak "nog geen ophaaldag bekend" (T-45b), en kan hij toch aanzetten. Kiest hij bij "Klopt dit?" voor "Ander adres", of verlaat hij de pagina, dan is er niets bewaard en zijn er geen taken ontstaan.

**(b) De eerstvolgende ophaaldag ligt over ruim drie weken.**
GEGEVEN het is maandag 5 oktober 2026, en de gemeente geeft voor het adres alleen papier, met de eerstvolgende ophaaldag op dinsdag 27 oktober (P0-testadres)
WANNEER Jurgen het adres zoekt en bij "Klopt dit?" "Ja, aanzetten" kiest
DAN:
- toont "Klopt dit?" bij Papier "di 27 okt", en bij Restafval en PMD "nog geen ophaaldag bekend" (T-45b);
- is de afvalkalender aangezet en het adres bewaard, zonder T-64;
- zijn er 0 afvaltaken ontstaan;
- ziet hij de melding T-90b "Afvalkalender staat aan · taken verschijnen 14 dagen vooraf", zonder "Bekijken";
- ontstaan de taken voor 27 oktober vanzelf zodra die dag binnen de 14 dagen valt, dus op 13 oktober (AC-197);
- volgt er bij het bijwerken daarna geen stille regel en geen storing (AC-204).
**Toets:** Int + E2E ((b) met de P0-fixture)

### AC-184 — Ongeldig formaat (WP3b; BR-48)
GEGEVEN Jurgen in het adresformulier
WANNEER hij een van deze dingen invult:
- een postcode die niet uit 4 cijfers (niet beginnend met 0) en 2 letters bestaat;
- een huisnummer dat geen getal is, of een getal buiten 1 t/m 99999;
- een toevoeging van meer dan 4 letters of cijfers;
- of hij laat postcode of huisnummer leeg
DAN:
- ziet hij bij het veld "Vul een postcode in zoals 2517 AB" (T-43), "Vul een huisnummer in, zoals 12 of 12A" (T-44) of "Een toevoeging heeft hooguit 4 letters of cijfers" (T-44b);
- is "Adres zoeken" uitgeschakeld zolang postcode of huisnummer leeg is;
- wordt er niets bewaard en niets bij de gemeente opgevraagd.
**Toets:** Unit + Int + E2E

### AC-185 — Adres onbekend of buiten Den Haag (WP3b; BR-48)
GEGEVEN een correct geschreven postcode buiten Den Haag (bijvoorbeeld Rijswijk), of een Haags adres dat de huisvuilkalender niet kent
WANNEER Jurgen het invult en "Adres zoeken" kiest
DAN:
- ziet hij boven de velden de regel T-60 "Dit adres staat niet in de huisvuilkalender van Den Haag. Controleer postcode en huisnummer. De afvalkalender werkt alleen voor adressen in Den Haag.", zonder rode rand om de velden;
- blijven de velden gevuld;
- wordt er geen adres bewaard en ontstaan er geen taken;
- blijft een eerder bewaard adres, met de taken ervan, ongewijzigd.
**Toets:** Int + E2E

### AC-186 — Adres zonder rest, papier of PMD (WP3b; BR-47, BR-48)
GEGEVEN het is geen januari, en een Haags adres waarvoor de agenda alleen GFT of kerstbomen geeft, of niets (bijvoorbeeld bij een ondergrondse container)
WANNEER Jurgen het invult
DAN:
- ziet hij T-62 "Voor dit adres geeft de gemeente geen ophaaldagen voor restafval, papier of PMD. Gebruiken jullie een ondergrondse container? Dan hoeft er niets buiten te staan.";
- wordt er niets bewaard.

**In januari** is niet te zien of het adres geen bakken heeft, of dat de kalender van het nieuwe jaar nog niet online staat. Geeft de gemeente voor het nieuwe jaar nog geen datum voor rest, papier of PMD, dan geldt AC-237 (T-64/T-64b) en niet T-62, ook als de kalender van het vorige jaar geen datums had.
**Toets:** Unit + Int + E2E

### AC-187 — Schrijfwijze, toevoeging en meerdere adressen (WP3b; BR-48)
GEGEVEN een van deze drie situaties:
- (a) invoer "2511ab" en huisnummer "12 a";
- (b) invoer "2511 AB" met "12A";
- (c) een huisnummer waaronder de gemeente meerdere adressen kent (12, 12A, 12B), ingevuld zonder letter of toevoeging
WANNEER Jurgen het invult
DAN:
- worden (a) en (b) op dezelfde manier opgevraagd en bewaard, als "2511 AB", huisnummer 12, toevoeging "A";
- kiest de app bij (c) niet zelf. Hij toont T-61 "Op nummer 12 staan meerdere adressen. Welke is van jullie?" met een aantikbare rij per adres. Er is dan nog niets bewaard. Eén tik op een rij opent "Klopt dit?" voor dat adres.
**Toets:** Unit + Int + E2E

### AC-188 — Bron onbereikbaar tijdens het instellen (WP3b; BR-48)
GEGEVEN de gemeentebron geeft een fout, een time-out of een onbruikbaar antwoord
WANNEER Jurgen een adres zoekt of bevestigt, (a) zonder bestaand adres of (b) als wijziging van een bestaand adres
DAN:
- ziet hij bij (a) T-63 "De huisvuilkalender van de gemeente is nu niet bereikbaar. Er is niets opgeslagen.", met de knop "Opnieuw proberen";
- ziet hij bij (b) T-63b "De huisvuilkalender van de gemeente is nu niet bereikbaar. Er is niets opgeslagen; het huidige adres blijft gebruikt.";
- blijven de velden gevuld;
- is er bij (a) geen adres bewaard;
- zijn bij (b) het oude adres en de oude taken ongewijzigd;
- is er in geen van beide gevallen een taak bijgekomen of verdwenen.
**Toets:** Int + E2E

### AC-189 — Een gezinslid kan de afvalkalender niet beheren (WP3b; BR-48, BR-56; PRODUCT_SPEC §7)
GEGEVEN Lynn (gezinslid) en Kai (uitgezet lid)
WANNEER Lynn Instellingen opent, of een van beiden met een direct verzoek (een actie, of rechtstreeks op de tabel) een adres invoert of wijzigt, de afvalkalender uitzet of "Opnieuw proberen" start
DAN:
- ziet Lynn geen formulier en geen knoppen, alleen de weergave uit AC-190;
- wordt elk verzoek geweigerd. Via de interface gebeurt dat met T-66 "Alleen een beheerder kan de afvalkalender aanpassen. Er is niets veranderd.";
- verandert er niets aan het adres, de bekende ophaaldagen, de stand van het bijwerken of de taken;
- vraagt de server bij de gemeente niets op.

Verliest een beheerder tijdens het instellen zijn beheerdersrol, dan krijgt hij bij bevestigen T-66, en ziet hij daarna de gezinslid-weergave.
**Toets:** DB + Int + E2E

### AC-190 — Wie het adres ziet (WP3b; BR-58, BR-26; V-53)
GEGEVEN een huishouden met een bewaard adres, Jurgen (beheerder), Lynn (gezinslid) en Bas (ander huishouden)
WANNEER ieder van hen Instellingen opent, en Lynn en Bas het adres en de adrescode proberen te lezen via elk mogelijk verzoek
DAN:
- ziet Jurgen het volledige adres en de stand van het bijwerken;
- ziet Lynn alleen "Afvalkalender staat aan" met "Ophaaldagen van de gemeente komen vanzelf als taak in de lijst." (T-38b);
- ziet Lynn geen adres, geen adrescode, geen stand van het bijwerken en geen storingsregel, en geven haar verzoeken het adres niet terug;
- ziet Lynn, als de afvalkalender uit staat, "Afvalkalender staat uit" met "Jurgen kan de afvalkalender aanzetten." (T-39b). Bij twee beheerders is dat "Ellen en Jurgen kunnen de afvalkalender aanzetten.";
- krijgt Bas niets terug, ook niet dat er een afvalkalender is.
**Toets:** DB + E2E

### AC-191 — Dubbel bevestigen en twee beheerders tegelijk (WP3b; BR-10, BR-50)
GEGEVEN Jurgen tikt twee keer snel op "Ja, aanzetten", en tegelijk bevestigt Ellen een ander geldig adres
WANNEER alle verzoeken verwerkt zijn
DAN:
- is er precies één adres: het laatst bevestigde;
- zijn er alleen afvaltaken voor dat adres;
- bestaat geen enkele combinatie van ophaaldag en richting (buiten of binnen) twee keer.
**Toets:** Int

### AC-192 — De buitenzet-taak (WP3b; BR-49; V-44, V-49)
GEGEVEN een ophaaldag voor restafval op dinsdag 6 oktober 2026
WANNEER de taken klaarstaan
DAN:
- heet de taak "Restafval buitenzetten" (T-01), heeft hij het kenmerk "Afvalkalender" (T-15), en staat hij gepland op maandag 5 oktober, gesorteerd op 21:00;
- toont de lijst op maandag "vanaf 22:00" (T-16), en op dinsdag tot 07:45 "vóór 07:45" (T-17);
- staat nergens in een rij, kaart of kalendervak "21:00", en is er geen deadlinebadge "verloopt over …" of "uiterlijk morgen";
- heeft de taak een herinnering om 21:00 op maandag;
- is de deadline dinsdag 6 oktober om 07:45. Afvinken om 07:50 registreert "te laat" (BR-12), en na 07:45 staat de taak bij Verlopen met alleen "… te laat";
- heeft de taak geen omschrijving. Het detail toont "Afvalkalender · ophaaldag di 6 okt" (T-20), "Mag buiten · ma 5 okt vanaf 22:00" (T-21) en "Uiterlijk · di 6 okt 07:45" (T-22).
**Toets:** Unit + Int + E2E

### AC-193 — De binnenzet-taak (WP3b; BR-49; V-47, V-48, V-55)
GEGEVEN dezelfde ophaaldag
WANNEER de taken klaarstaan
DAN:
- heet de taak "Restafvalbak binnenzetten" (T-08), en staat hij gepland op dinsdag 6 oktober;
- staat hij op maandag onder Binnenkort met "morgen" (T-19; huidige schermen "Morgen");
- staat hij op dinsdag vóór 12:00 bovenaan Binnenkort met "vanaf 12:00" (T-18; huidige schermen "Vandaag" met "vanaf 12:00"), en vanaf 12:00 onder Vandaag;
- is de deadline het einde van dinsdag;
- heeft de taak een herinnering om 18:00;
- lukt afvinken om 10:00 ook;
- toont het detail "Binnenzetten · di 6 okt vanaf 12:00" (T-23) en "Uiterlijk · di 6 okt, einde van de dag" (T-24), zonder omschrijving.

Voor papier en PMD geldt hetzelfde: "Papierbak binnenzetten" (T-09) en "PMD-bak binnenzetten" (T-10).
**Toets:** Unit + E2E

### AC-194 — Herinneringen alleen voor open afvaltaken (WP3b; BR-55, BR-31)
GEGEVEN Jurgen met herinneringen aan, en ophaaldag dinsdag 6 oktober voor restafval
WANNEER de tick draait:
- (a) om 21:00 op maandag, terwijl buitenzetten om 20:30 al is afgevinkt;
- (b) om 18:00 op dinsdag, terwijl binnenzetten om 14:00 al is afgevinkt;
- (c) zoals (a) en (b), maar met beide taken nog open
DAN:
- komt er bij (a) en (b) geen herinnering;
- krijgt Jurgen bij (c) om 21:00 één herinnering M-01, met de titel "Herinnering: Restafval buitenzetten" en de tekst "Morgen ophaaldag. Mag vanaf 22:00 buiten, uiterlijk morgen 07:45.";
- krijgt Jurgen bij (c) om 18:00 één herinnering M-02, met de titel "Herinnering: Restafvalbak binnenzetten" en de tekst "Vandaag was de ophaaldag. Zet de bak vandaag nog binnen.".

Een tweede tick verstuurt niets opnieuw.
**Toets:** Unit + Int

### AC-195 — Twee bakken op dezelfde dag, en de namenlijst (WP3b; BR-49; V-51)
GEGEVEN rest en papier hebben allebei ophaaldag dinsdag 6 oktober
WANNEER de taken klaarstaan en de herinneringen verstuurd worden
DAN:
- is er één taak "Restafval en papier buitenzetten" (T-04, maandag) en één taak "Restafval- en papierbak binnenzetten" (T-11, dinsdag);
- krijgt elke ontvanger om 21:00 één herinnering en om 18:00 één herinnering, niet één per bak;
- heeft de herinnering van 18:00 de meervoudstekst "Vandaag was de ophaaldag. Zet de bakken vandaag nog binnen." (M-02).

Bij alle drie de bakken heten de taken "Restafval, papier en PMD buitenzetten" (T-07) en "Restafval-, papier- en PMD-bak binnenzetten" (T-14). Alle 7 bakcombinaties × 2 richtingen geven exact de namen uit UX §13.3 (T-01 t/m T-14), in de vaste volgorde restafval, papier, PMD.
**Toets:** Unit + Int

### AC-196 — Alleen rest, papier en PMD (WP3b; BR-47; V-43)
GEGEVEN de agenda voor het adres noemt ook GFT, kerstbomen, grofvuil en een onbekende soort
WANNEER de taken worden gemaakt
DAN:
- komen er alleen taken voor ophaaldagen van rest, papier en PMD;
- noemt geen enkele taaknaam GFT, kerstbomen, grofvuil of de onbekende soort;
- ontstaat er voor een dag met alleen GFT of kerstbomen geen taak.
**Toets:** Unit

### AC-197 — 14 dagen vooruit en nooit dubbel (WP3b; BR-50; V-52)
GEGEVEN een bewaard adres, en ophaaldagen op vandaag + 3, vandaag + 14 en vandaag + 15
WANNEER het bijwerken en het plannen twee keer achter elkaar draaien, en ook twee keer tegelijk
DAN:
- zijn er taken voor vandaag + 3 en vandaag + 14, en nog niet voor vandaag + 15;
- zijn er na de tweede ronde geen extra taken of meldingen bijgekomen.

De volgende dag komen de taken voor vandaag + 15 erbij.
**Toets:** Int

### AC-198 — Verschoven ophaaldag (feestdag) (WP3b; BR-51)
GEGEVEN een open buitenzet-taak, met een notitie van Ellen en de stand "bezig", en een open binnenzet-taak, voor ophaaldag vrijdag 25 december 2026. De gemeente verschuift die dag naar zaterdag 26 december
WANNEER het bijwerken draait
DAN:
- staat **dezelfde** buitenzet-taak op vrijdag 25 december, met als uiterste moment zaterdag 26 december 07:45;
- staat **dezelfde** binnenzet-taak op zaterdag 26 december;
- staan de notitie van Ellen en de stand "bezig" er nog;
- zijn er voor ophaaldag 25 december geen afvaltaken meer;
- is er niets als vergeten of overgeslagen geteld, en staat er niets in de historie;
- komen de herinneringen op het nieuwe moment (vrijdag 21:00 en zaterdag 18:00).

**Uitzonderingen.** In deze gevallen vervalt de oude open taak (zoals in AC-199), en komt er voor de nieuwe dag een nieuwe taak, als het moment nog niet voorbij is:
- de nieuwe ophaaldag ligt meer dan 3 dagen van de oude;
- hij heeft geen enkele bak gemeen met de oude;
- er bestaat voor die dag en richting al een afvaltaak.

Is 07:45 op de nieuwe ophaaldag al voorbij, dan vervalt de oude buitenzet-taak, en schuift binnenzetten wel mee.
**Toets:** Unit + DB + Int

### AC-199 — Een ophaaldag verdwijnt uit de agenda (WP3b; BR-51)
GEGEVEN open afvaltaken voor een ophaaldag die daarna uit de agenda verdwijnt, terwijl de andere ophaaldagen blijven
WANNEER het bijwerken draait
DAN:
- zijn beide taken verdwenen;
- staan ze niet in de historie;
- tellen ze in het Overzicht niet mee als vergeten of overgeslagen.
**Toets:** Int

### AC-200 — Een ophaaldag verdwijnt terwijl de bak al buiten staat (WP3b; BR-51)
GEGEVEN buitenzetten voor dinsdag is afgevinkt, en daarna verdwijnt die ophaaldag, of verschuift hij naar woensdag
WANNEER het bijwerken draait
DAN:
- blijft de afgevinkte buitenzet-taak ongewijzigd in de historie;
- blijft binnenzetten voor dinsdag staan. Hij schuift niet mee;
- komen er bij een verschuiving nieuwe taken voor woensdag.
**Toets:** Int

### AC-201 — Een bak komt erbij of valt weg op een dag (WP3b; BR-51; V-51)
GEGEVEN een open taak "Restafval en papier buitenzetten" en een open taak "Restafval- en papierbak binnenzetten". De agenda haalt papier van die dag af, of voegt PMD toe
WANNEER het bijwerken draait
DAN:
- heten de open taken bij het weghalen van papier "Restafval buitenzetten" en "Restafvalbak binnenzetten";
- heten ze bij het toevoegen van PMD "Restafval, papier en PMD buitenzetten" en "Restafval-, papier- en PMD-bak binnenzetten";
- is er nog steeds één taak per richting, met dezelfde notities.

Was een taak al afgevinkt of overgeslagen, dan blijft hij ongewijzigd.
**Toets:** Unit + Int

### AC-202 — Afgevinkt en overgeslagen blijft onaangetast (WP3b; BR-51, BR-12)
GEGEVEN afgevinkte en overgeslagen afvaltaken
WANNEER de agenda iets verandert aan die ophaaldagen (verschuiven, weghalen, een bak erbij of eraf) en het bijwerken draait
DAN veranderen hun datum, naam, status en historie niet.
**Toets:** DB + Int

### AC-203 — Een nieuwe ophaaldag wordt laat ontdekt (WP3b; BR-50, BR-31)
GEGEVEN de agenda voegt een ophaaldag toe voor woensdag 7 oktober 2026
WANNEER het plannen draait:
- (a) om 21:40 op dinsdag;
- (b) om 23:00 op dinsdag;
- (c) om 08:00 op woensdag;
- (d) om 19:45 op woensdag;
- (e) om 00:10 op donderdag
DAN:
- (a) komt de buitenzet-taak er, en de herinnering gaat nog mee;
- (b) komt de buitenzet-taak er, zonder herinnering;
- (c) komt alleen de binnenzet-taak er, met de herinnering om 18:00;
- (d) komt alleen de binnenzet-taak er, zonder herinnering (meer dan 90 minuten na 18:00);
- (e) komt er geen afvaltaak meer.
**Toets:** Unit + Int

### AC-204 — Bron tijdelijk onbereikbaar, onbruikbaar of leeg (WP3b; BR-52)
GEGEVEN een bewaard adres met afvaltaken, en de gemeentebron geeft een van deze antwoorden:
- (a) een fout, een time-out of een onbegrijpelijk antwoord;
- (b) voor rest, papier en PMD samen **geen enkele komende ophaaldag** (vandaag of later), buiten het jaareinde (zie "Geen storing zijn"). Dit geldt ook in deze gevallen:
  - op 1 januari, als de kalender van het nieuwe jaar voor rest, papier en PMD nog helemaal leeg is, ook als er al kerstboomdatums in staan. Een kalender van het lopende jaar zonder enige datum voor rest, papier of PMD is in elke maand een leeg antwoord;
  - in juni, als de kalender van dit jaar alleen datums in het verleden heeft;
  - als er alleen komende datums voor GFT of kerstbomen zijn;
- (c) het adres is onbekend geworden: de bron geeft voor de bewaarde adrescode geen enkele afvalsoort meer terug (een leeg object `{}`, P0 U0.2). Dat is geval (c), en niet een onbegrijpelijk antwoord (a)
WANNEER het bijwerken draait
DAN:
- veranderen het adres en de bekende ophaaldagen niet;
- wordt geen enkele bestaande afvaltaak verwijderd, verschoven of hernoemd;
- worden voor al bekende ophaaldagen die in die tijd binnen de 14 dagen komen, wel taken klaargezet (BR-50). Voorbeeld:
  - de bewaarde ophaaldag is dinsdag 20 oktober 2026;
  - de bron is van zondag 4 tot en met woensdag 7 oktober onbereikbaar;
  - op dinsdag 6 oktober staan de taken voor 20 oktober toch gewoon klaar;
- loopt het vanzelf vervallen gewoon door (BR-54, AC-210), net als afvinken, overslaan en de herinneringen;
- verschijnen er geen verzonnen ophaaldagen;
- draaien de andere stappen van de achtergrondtaak gewoon (vergelijk AC-076);
- wordt het ongeveer een uur later opnieuw geprobeerd (binnen 75 minuten);
- bevat de log alleen een code, geen adres en geen adrescode;
- is er na één zo'n antwoord nog geen storing. Er komt geen melding en geen balk.
  - De beheerder ziet alleen de stille regel T-71 "De laatste poging lukte niet. De app probeert het elk uur opnieuw.".
  - Bij (c) ziet hij T-71b "Bij de laatste poging vond de gemeente het adres niet. De app probeert het elk uur opnieuw.".
  - Een gezinslid ziet niets.

**Geen storing zijn** (het bijwerken geldt als gelukt; geen T-71, geen balk, geen melding):
- **Alleen datums ná de komende 14 dagen.** Voorbeeld met de echte P0-gegevens van het testadres:
  - op maandag 5 oktober 2026 geeft de bron alleen papier, met de eerstvolgende ophaaldag op dinsdag 27 oktober;
  - na twee rondes op die dag is er geen leeg antwoord, geen stille regel en geen melding;
  - de taken voor 27 oktober ontstaan zodra die dag binnen de 14 dagen valt (AC-197).
- **Het jaareinde.** Het P0-adres heeft papier tot 24 november.
  - Op donderdag 26 november 2026 geeft de bron geen enkele komende ophaaldag in 2026, en is de kalender van 2027 nog leeg, of bevat hij alleen kerstboom- of GFT-datums.
  - Dat is geen storing, ook niet na meerdere rondes. De beheerder ziet alleen de stille regel T-73 (AC-220).
  - Hetzelfde geldt in december, ná de laatste ophaaldag van het jaar, zolang de kalender van volgend jaar nog geen datum voor rest, papier of PMD heeft.
- **Eén bak zonder dagen.** Geeft de bron alleen voor papier geen dagen, terwijl rest of PMD wel komende dagen heeft, dan is dat geen leeg antwoord. De open papiertaken voor verdwenen dagen vervallen dan volgens AC-199.
**Toets:** Unit + DB + Int (met regressietoetsen op de P0-fixture voor 5 oktober en 26 november, op het U0.2-antwoord `{}`, en op het geval "bewaarde ophaaldag schuift tijdens een storing het venster in → taken worden klaargezet, geen taak verwijderd, verschoven of hernoemd")

### AC-205 — Storing, per oorzaak (WP3b; BR-52, BR-55; V-50)
GEGEVEN Jurgen en Ellen (beheerders, Ellen met herinneringen uit) en Lynn (gezinslid), en een van deze situaties:
- (a) het bijwerken lukt al meer dan 48 uur niet;
- (b) de bron geeft om 06:00 een leeg antwoord (AC-204 (b)), en opnieuw bij de volgende automatische poging om 07:15;
- (c) het laatste geslaagde bijwerken is meer dan 48 uur geleden, zonder dat er sindsdien een mislukte poging is vastgelegd, bijvoorbeeld omdat de achtergrondtaak stil lag
WANNEER de achtergrondtaak daarna nog meerdere keren draait
DAN:
- zien Jurgen en Ellen in Instellingen de balk H, met de kop "Aan · laatst bijgewerkt <tijdstip>" (T-72). De balk hoort bij de oorzaak van de laatste mislukte poging. Bij (c) is dat de rij "onbereikbaar of onbruikbaar":

| Oorzaak | Balk | Melding |
| --- | --- | --- |
| onbereikbaar of onbruikbaar, of geen vastgelegde mislukte poging | H1: "Niet bijgewerkt sinds <dag>" (T-75) + T-76 | M-03 "De afvalkalender kon niet worden bijgewerkt" |
| leeg antwoord | H2: T-77 + T-77a (december en januari) of T-77b (andere maanden) | M-04 |
| adres niet meer gevonden (ook bij `{}` voor de adrescode) | H3: "Adres niet meer gevonden" (T-77c) + T-77d, met de knoppen "Adres controleren" (opent het wijzigformulier, gevuld) en "Opnieuw proberen" | M-05 "De afvalkalender vindt het adres niet meer" |

- krijgen Jurgen en Ellen elk precies één melding, met de tekst uit UX §13.10 voor de oorzaak bij het versturen.
  - De melding linkt naar de instellingen van de afvalkalender (AC-223).
  - Hij komt niet bij elke ronde opnieuw, en ook niet opnieuw als de oorzaak tijdens de storing verandert;
- blijft de balk staan tot het bijwerken weer lukt, ook als de oorzaak intussen verandert. De tekst van de balk volgt dan de nieuwe oorzaak;
- krijgt Lynn geen melding en ziet ze geen balk of stille regel;
- noemen de melding en de push het adres niet.

**Geen storing zijn:**
- één leeg antwoord;
- een leeg antwoord om 06:00, en opnieuw om 06:30 (minder dan een uur ertussen);
- "onbereikbaar" om 06:00, gevolgd door een leeg antwoord om 07:15;
- een poging die gestart is maar geen uitkomst gaf, na één leeg antwoord;
- een bron die alleen ophaaldagen ná de komende 14 dagen geeft, hoe vaak achter elkaar ook. Voorbeeld: papier eens per 4 weken, met de eerstvolgende dag over ruim drie weken (AC-204, P0);
- het jaareinde: in november of december, na de laatste ophaaldag van het jaar, zolang de kalender van volgend jaar nog geen datum voor rest, papier of PMD heeft (AC-204, AC-220).

Ook tijdens de storing verschijnen de taken voor al bekende ophaaldagen binnen de 14 dagen gewoon (AC-204). Lukt het bijwerken weer, dan verdwijnt de balk zonder melding "weer gelukt", en worden de wijzigingen van de gemeente verwerkt (BR-51). Een latere, nieuwe storing geeft opnieuw één melding.
**Toets:** Unit + Int + E2E

### AC-206 — Zomer- en wintertijd (WP3b; BR-59, BR-40)
GEGEVEN deze ophaaldagen:
- (a) maandag 26 oktober 2026;
- (b) maandag 29 maart 2027;
- (c) zondag 25 oktober 2026, waarbij de wintertijd ingaat tussen buitenzetten en de deadline
WANNEER de taken en de herinneringen worden gemaakt
DAN liggen in alle drie gevallen:
- de herinnering op de dag ervoor om 21:00 Nederlandse tijd;
- de deadline van buitenzetten op de ophaaldag om 07:45 Nederlandse tijd;
- "beschikbaar vanaf" van binnenzetten om 12:00 en de herinnering om 18:00 Nederlandse tijd.
**Toets:** Unit

### AC-207 — Buitenzetten en binnenzetten los afvinken (WP3b; BR-53, BR-12, BR-13)
GEGEVEN een open buitenzet-taak en een open binnenzet-taak voor dezelfde ophaaldag
WANNEER Lynn binnenzetten afvinkt terwijl buitenzetten nog open staat, en Kai (met account, actief) daarna het afvinken van binnenzetten terugdraait
DAN:
- blijft buitenzetten ongewijzigd open;
- is binnenzetten na het terugdraaien weer open;
- staat er in de historie nergens wie afvinkte.
**Toets:** Int + E2E

### AC-208 — Wat wel en niet kan met een afvaltaak (WP3b; BR-53; V-54)
GEGEVEN een open afvaltaak
WANNEER Jurgen (beheerder) of Lynn (gezinslid) iets van het volgende probeert, via de interface, met een direct verzoek, of via een oud verzoek in de offline wachtrij:
- de taak hernoemen;
- de datum, tijd, deadline, omschrijving of herinneringen wijzigen;
- de taak verplaatsen, ook door te slepen in de Kalender;
- de taak verwijderen;
- de taak omzetten naar een terugkerende taak
DAN:
- zijn die keuzes in de interface verborgen, niet uitgeschakeld. Het detail toont de uitlegregel T-27 "De ophaaldag komt uit de afvalkalender van de gemeente. Daarom kun je deze taak niet verplaatsen, wijzigen of verwijderen. Verschuift de gemeente de dag, dan schuift de taak vanzelf mee.";
- wordt een direct verzoek geweigerd, en verandert er niets;
- geeft een geweigerd verzoek uit de wachtrij de melding T-33 "Een afvaltaak kun je niet wijzigen, verplaatsen of verwijderen.";
- lukken afvinken, terugdraaien, "bezig", een notitie plaatsen en "deze keer overslaan" wel.
**Toets:** DB + Int + E2E

### AC-209 — Buitenzetten overslaan neemt binnenzetten mee (WP3b; BR-53)
GEGEVEN een open buitenzet-taak en een open binnenzet-taak voor dezelfde ophaaldag
WANNEER Lynn bij buitenzetten "Deze keer overslaan" kiest, en daarna in de melding "Ongedaan maken"
DAN:
- gebeurt het overslaan zonder bevestiging, en ziet Lynn de melding T-31 "Overgeslagen, ook het binnenzetten · Ongedaan maken";
- zijn na het overslaan beide taken overgeslagen, en komt er om 18:00 geen herinnering binnenzetten;
- staan na het ongedaan maken beide weer open.

**Verder:**
- Overslaan van alleen binnenzetten geeft de gewone overslaan-melding, en laat buitenzetten ongemoeid.
- "Toch nog doen" bij een overgeslagen afvaltaak is zichtbaar tot het einde van de ophaaldag D, en daarna niet meer.
- Het automatisch vervallen van buitenzetten (AC-210) slaat binnenzetten niet over.
**Toets:** Int + E2E

### AC-210 — Verlopen en vanzelf vervallen (WP3b; BR-54; V-54)
GEGEVEN buitenzetten en binnenzetten voor ophaaldag dinsdag, geen van beide afgevinkt, en de volgende ophaaldag vrijdag
WANNEER het dinsdag 07:46 is, daarna het einde van dinsdag voorbij is, en daarna donderdag begint
DAN:
- staat buitenzetten om 07:46 bij Verlopen;
- is buitenzetten na het einde van dinsdag "overgeslagen", en telt het als vergeten;
- staat binnenzetten vanaf woensdag bij Verlopen;
- is binnenzetten aan het begin van donderdag (de dag van de volgende buitenzet-taak) "overgeslagen", en telt het als vergeten.

Vinkt iemand binnenzetten woensdag af, dan is het gedaan, met "te laat".

**Geen volgende buitenzet-taak (lange pauze):**
GEGEVEN binnenzetten voor ophaaldag dinsdag 6 oktober 2026, niet afgevinkt, en de volgende ophaaldag is pas dinsdag 3 november (papier eens per 4 weken). Er bestaat dus nog geen volgende buitenzet-taak
WANNEER dinsdag 13 oktober 00:00 (D+7) voorbij is
DAN:
- heeft binnenzetten tot dat moment bij Verlopen gestaan;
- is binnenzetten daarna vanzelf "overgeslagen", en telt het als vergeten.
**Toets:** Unit + Int

### AC-211 — Wie de afvalherinnering krijgt (WP3b; BR-55, BR-31; V-23, V-50)
GEGEVEN Jurgen en Ellen met herinneringen aan (standaard), Lynn met de standaard (uit), en Kai uitgezet
WANNEER het maandag 21:00 is voor een ophaaldag op dinsdag, en daarna de hele dinsdag
DAN:
- krijgen alleen Jurgen en Ellen de herinneringen van 21:00 en 18:00, elk één keer;
- komen er voor afvaltaken geen meldingen "deadline nadert" of "verlopen", ook niet 's nachts of na 07:45;
- tellen de afvaltaken gewoon mee in het dag- en avondoverzicht;
- ziet Jurgen in het detail van de open taak de rij "Herinnering · ma 5 okt 21:00" (T-25) zolang het moment nog in de toekomst ligt;
- ziet Lynn die rij niet, en staat er voor haar ook geen "(uit)" of iets anders in de plaats.

Zet Lynn herinneringen aan, dan krijgt zij ze ook, en ziet ze de rij ook.
**Toets:** Unit + Int + E2E

### AC-212 — Geen adres of namen in meldingen, taken en logs (WP3b; BR-58, BR-12)
GEGEVEN alle afvalmeldingen (M-01 t/m M-05), de pushinhoud, de taaknamen, de historie en de eigen logregels van de app, bij een geslaagde en een mislukte bijwerking
WANNEER die worden gecontroleerd
DAN komen postcode, huisnummer, adrescode, straat en namen van leden er nergens in voor. De bak en de dag mogen er wel in staan.
**Toets:** Unit + Int

### AC-213 — Afvalkalender uitzetten (WP3b; BR-56)
GEGEVEN een bewaard adres, open afvaltaken, en afgevinkte en overgeslagen afvaltaken in de historie
WANNEER Jurgen "Afvalkalender uitzetten…" kiest en in de bevestiging "Uitzetten" kiest
DAN:
- zag hij in de bevestiging de titel "Afvalkalender uitzetten?" (T-80), en de tekst die bij het aantal open afvaltaken hoort:
  - bij 4: T-81 "Het adres wordt gewist en de 4 afvaltaken die nog open staan, verdwijnen. Wat al gedaan is, blijft in de historie. Weer aanzetten kan altijd; dan vul je het adres opnieuw in.";
  - bij 1: T-81b;
  - bij 0: T-81c, zonder zin over taken en zonder "(0 taken)";
- zijn het adres, de adrescode, de bekende ophaaldagen en de stand van het bijwerken uit de database verdwenen;
- zijn alle open afvaltaken verdwenen, zonder als vergeten te tellen;
- staat de historie er nog;
- ziet hij de melding T-93 "Afvalkalender staat uit", zonder "Ongedaan maken";
- maakt de achtergrondtaak daarna geen afvaltaken meer, en vraagt hij niets meer op bij de gemeente;
- ziet Lynn "Afvalkalender staat uit" (T-39b).

Annuleert hij in de bevestiging, dan verandert er niets.
**Toets:** DB + Int + E2E

### AC-214 — Adres wijzigen (verhuizen) (WP3b; BR-56, BR-48)
GEGEVEN een bewaard adres met open en afgevinkte afvaltaken
WANNEER Jurgen:
- "Wijzigen" kiest;
- "Ander adres" met de regel T-47 ziet;
- een nieuw, geldig adres zoekt;
- bij "Klopt dit?" de regel T-48 ziet;
- en "Ja, dit adres gebruiken" kiest
DAN:
- zijn de open taken van het oude adres vervangen door die van het nieuwe adres;
- blijven afgevinkte en overgeslagen taken ongewijzigd;
- bestaan er nooit tegelijk taken voor beide adressen;
- ziet hij de melding T-91 "Nieuw adres opgeslagen · afvaltaken bijgewerkt".

In deze gevallen blijven het oude adres en de oude taken staan:
- het nieuwe adres is ongeldig of onbekend;
- de bron is onbereikbaar (T-63b);
- de bron geeft nog geen komende ophaaldagen (T-64b);
- Jurgen kiest "Annuleren".
**Toets:** Int + E2E

### AC-215 — Handmatige taken blijven ongemoeid (WP3b; BR-57; V-56)
GEGEVEN een handmatige reeks "Afvalcontainer buiten zetten" (elke maandag) en een losse taak "Container schoonmaken"
WANNEER de afvalkalender wordt aangezet, bijgewerkt, gewijzigd en uitgezet
DAN:
- verandert er niets aan die reeks, die taak en hun uitvoeringen;
- ziet de beheerder na het aanzetten één keer de tip T-54 (huidige schermen). Die kan hij wegtikken, en daarna komt hij niet terug.
**Toets:** Int + E2E

### AC-216 — Huishouden verwijderen wist het adres (WP3b; BR-58; UC-12; AC-138)
GEGEVEN een huishouden met een bewaard adres
WANNEER een beheerder het huishouden verwijdert (AC-138)
DAN:
- bestaan het adres, de adrescode, de bekende ophaaldagen, de stand van het bijwerken en de afvaltaken niet meer;
- zijn andere huishoudens ongemoeid.
**Toets:** DB

### AC-217 — Werkt in de huidige schermen, met beeldreview vóór de livegang (WP3b; V-46)
GEGEVEN de huidige interface, vóór WP4
WANNEER het werkpakket live gaat
DAN:
- kan een beheerder in de sectie "Afvalkalender" (na Huishouden, springlink "Afval", beschrijving T-34) het adres invoeren, controleren ("Klopt dit?"), wijzigen en uitzetten, en de stand van het bijwerken zien. Dat werkt in alle toestanden uit UX §13.8.1;
- zijn de afvaltaken te zien op Vandaag en in de Kalender, met het kenmerk en de tijden uit UX §13.13.1. In de Kalender kunnen ze niet gesleept worden;
- zijn de afvaltaken af te vinken, over te slaan en van een notitie te voorzien. Het ⋯-menu in het detail bevat alleen "Ik ben ermee bezig" / "Niet meer bezig", "Deze keer overslaan" en "Toch nog doen";
- hebben visual-qa en de ux-reviewer (licht) vóór de livegang de rook-screenshots van checkpoint CP-W03 beoordeeld (390×844; de lijst in TD §18.16 U3), zonder open BLOKKEREND of GEMIDDELD punt;
- vergelijkt Jurgen bij de rooktest met zijn eigen adres de ophaaldagen met de site van de gemeente.

In de nieuwe schermen gelden AC-224 t/m AC-235.
**Toets:** E2E (huidige build) + CP-W03 + Live (rooktest door Jurgen)

### AC-218 — Alleen het adres gaat naar de gemeente (WP3b; BR-58)
GEGEVEN elke opvraging bij de gemeentebron (bij het instellen, bij het bijwerken, bij "Opnieuw proberen" en bij een wijziging)
WANNEER het uitgaande verzoek wordt bekeken
DAN:
- bevat het alleen de postcode en het huisnummer, of de adrescode van de gemeente. De toevoeging gaat niet mee;
- bevat het geen naam, e-mailadres, id van het huishouden, id van een lid of andere gegevens;
- gaat het alleen naar de vaste basis-URL van de huisvuilkalender, zonder omleidingen te volgen.
**Toets:** Int + security-review

### AC-219 — Alleen het systeem maakt afvaltaken (WP3b; BR-49, BR-20, BR-53)
GEGEVEN "Gezinsleden mogen taken maken" staat uit
WANNEER de afvalkalender plant, en daarnaast Lynn of Jurgen met een direct verzoek zelf een taak probeert aan te maken of te wijzigen zodat die als afvaltaak geldt
DAN:
- ontstaan de afvaltaken gewoon, zonder maker die een lid is;
- wordt het directe verzoek geweigerd;
- bestaat er geen door een lid gemaakte of gewijzigde afvaltaak.
**Toets:** DB + Int

### AC-220 — Kalender volgend jaar ontbreekt nog (WP3b; BR-52)
GEGEVEN het bijwerken lukt, de gemeente heeft voor het nieuwe jaar nog geen ophaaldagen voor rest, papier of PMD online, en een van deze situaties:
- (a) het is 20 december 2026, en de komende 14 dagen lopen over de jaargrens;
- (b) het is 26 november 2026, en het adres heeft geen enkele komende ophaaldag meer in 2026 (het P0-adres: papier tot 24 november);
- (c) zoals (b), maar de kalender van 2027 bevat al alleen kerstboomdatums (bijvoorbeeld 6 en 13 januari)
WANNEER een beheerder de instellingen van de afvalkalender opent
DAN:
- ziet hij de stille regel T-73 "De kalender voor 2027 staat nog niet online. Ophaaldagen vanaf 1 januari komen erbij zodra hij er is.";
- ziet hij bij (b) en (c) geen balk en geen T-71, want het bijwerken is gelukt (AC-204, "Geen storing zijn");
- komt er geen melding;
- ziet een gezinslid niets.

In deze gevallen staat de regel er **niet**:
- op 10 december, als er nog een komende ophaaldag is en de komende 14 dagen niet over de jaargrens lopen;
- in november, als er nog een komende ophaaldag in dit jaar is;
- zodra er ophaaldagen van rest, papier of PMD in het nieuwe jaar bekend zijn.

Is de kalender van het nieuwe jaar op 1 januari voor rest, papier en PMD nog steeds leeg, dan geldt AC-204 (b), en na een uur AC-205 (H2 met T-77a).
**Toets:** Unit + E2E

### AC-221 — Ook een wijziging overdag komt op tijd (WP3b; BR-51)
GEGEVEN het bijwerken om 06:00 is gelukt, en om 14:00 zet de gemeente een nieuwe ophaaldag voor morgen online
WANNEER de achtergrondtaak na 17:00 draait
DAN:
- staat de buitenzet-taak voor morgen vóór 17:30 in de app;
- komt de herinnering om 21:00.

Tussen 06:00 en 17:00 wordt er na een geslaagde bijwerking niet opnieuw bij de gemeente opgevraagd.
**Toets:** Unit + Int

### AC-222 — Hetzelfde adres opnieuw bevestigen (WP3b; BR-48, BR-56)
GEGEVEN de afvalkalender staat aan, bij een open afvaltaak staan een notitie en de stand "bezig", en de achtergrondtaak heeft een halve minuut geleden bijgewerkt
WANNEER een beheerder via "Wijzigen" hetzelfde adres invoert, en "Ja, dit adres gebruiken" kiest
DAN:
- ziet hij T-92 "Adres opgeslagen · er verandert niets", en nooit T-79 of een andere te-snel-tekst;
- blijven de open afvaltaken met hun notitie en "bezig" staan;
- ontstaan er geen dubbele taken.

Heeft een andere beheerder intussen een ander adres bevestigd, dan ziet hij T-65 "Opslaan lukte niet. Er is niets veranderd. Probeer het opnieuw.".
**Toets:** Int + E2E

### AC-223 — De storingsmelding opent de juiste plek (WP3b; BR-25, BR-52)
GEGEVEN een beheerder heeft een storingsmelding van de afvalkalender
WANNEER hij de melding opent, in de huidige schermen of later in de nieuwe
DAN komt hij bij de instellingen van de afvalkalender, zonder foutpagina:
- in de huidige schermen staat de sectie Afvalkalender in beeld;
- in de nieuwe schermen opent de subpagina.
**Toets:** Int + E2E

### AC-236 — "Opnieuw proberen" bij een storing (WP3b; BR-52)
GEGEVEN Jurgen (beheerder) ziet balk H
WANNEER hij "Opnieuw proberen" kiest, en de poging:
- (a) lukt;
- (b) niet lukt;
- (c) niet wordt uitgevoerd, omdat iemand anders of de achtergrondtaak het minder dan een minuut eerder al probeerde
DAN:
- staat er tijdens de poging "Bezig…" (T-77e) en is de knop uitgeschakeld, hooguit 12 seconden. De rest van de pagina blijft bruikbaar;
- bij (a) verdwijnt de balk, toont de kop "Aan · bijgewerkt vandaag <tijd>", zijn de Volgende ophaaldagen bijgewerkt, en verschijnt de melding T-94 "Afvalkalender bijgewerkt";
- bij (b) blijft de balk, eventueel met de tekst van een nieuwe oorzaak. In de balk staat de regel T-78 "Opnieuw geprobeerd om <hh:mm>. Het lukt nog steeds niet.". De knop is weer actief;
- bij (c) staat in de balk de regel T-79 "Net geprobeerd. Probeer het over een minuut opnieuw.". Er komt geen melding onderin, en er gaat geen verzoek naar de gemeente.

**Regel:** een lege-antwoordstoring ontstaat alleen door vastgelegde lege antwoorden die minstens een uur uit elkaar liggen; vaker proberen versnelt dat niet (BR-52 storing (b), AC-205). **Toets van deze regel:** Unit.

Offline is de knop uitgeschakeld, met "Hiervoor heb je internet nodig" (T-67).
**Toets:** Unit + Int + E2E

### AC-237 — Instellen zonder komende ophaaldagen (WP3b; BR-48, BR-52)
GEGEVEN een Haags adres waarvoor de gemeente voor rest, papier en PMD samen **geen enkele komende ophaaldag** (vandaag of later) geeft. Bijvoorbeeld:
- 26 november, als de laatste ophaaldag van het jaar geweest is (het P0-adres: papier tot 24 november) en de kalender van volgend jaar nog geen datum voor rest, papier of PMD heeft (ook als er al kerstboomdatums in staan);
- 28 december, na de laatste ophaaldag van het jaar, als de kalender van het nieuwe jaar nog niet online staat;
- 2 januari, als de kalender van het nieuwe jaar nog niet online staat. Dat geldt **zowel** als de kalender van het vorige jaar voor dit adres datums had, **als** wanneer die geen datums had
WANNEER Jurgen het adres zoekt, (a) zonder bestaand adres of (b) als wijziging
DAN:
- ziet hij bij (a) de balk T-64, en bij (b) T-64b (UX §13.16);
- ziet hij ook op 26 november en 2 januari T-64/T-64b, en **niet** T-62 "geen bakken". De jaareinde-uitzondering uit BR-52 geldt bij het instellen niet;
- is de hoofdknop "Adres zoeken", en blijven de velden gevuld;
- is er niets bewaard, en zijn er geen taken ontstaan of verdwenen;
- blijven bij (b) het oude adres en de oude taken staan. Verkeert het bewaarde adres zelf in dezelfde jaareindesituatie, dan ziet de beheerder daar alleen T-73 (AC-220).

**Tegenvoorbeeld:** ligt de eerstvolgende ophaaldag alleen ver weg (over ruim drie weken), dan is dat geen T-64. Het adres wordt bewaard, met T-90b en 0 taken: zie AC-183 (b). Bij het bijwerken volgt daarna geen stille regel en geen storing (AC-204).
**Toets:** Unit + Int + E2E

---

## WP4 — Fundament van de interface: shell, navigatie en states

### AC-079 — De app-schil (WP4; V-28; UX §3)
GEGEVEN een ingelogd actief lid op 390×844
WANNEER een willekeurig scherm opent
DAN staat onderaan de balk Vandaag · Taken · + · Kalender · Boodschappen, en staan bovenin de bel (met het aantal ongelezen) en het tandwiel
**Toets:** E2E + Vis (CP1)

### AC-080 — De + alleen voor wie mag aanmaken (WP4; BR-20; UX §9)
GEGEVEN "Gezinsleden mogen taken maken" staat uit
WANNEER Lynn de app opent
DAN ontbreekt de + in de balk. Bij Jurgen staat hij er wel
**Toets:** E2E

### AC-081 — Eerste keer laden: nooit een wit scherm (WP4; S-01; UX §7)
GEGEVEN geen cache en een trage verbinding
WANNEER de app opent
DAN staan meteen de schil en skeletrijen in de vorm van de inhoud, tot de gegevens er zijn
**Toets:** E2E (throttling) + Vis

### AC-082 — Laden met cache (WP4; UX §7)
GEGEVEN een gevulde cache
WANNEER de app opent en het verversen langer dan 5 seconden duurt
DAN staat de bewaarde stand er direct, en verschijnt na 5 seconden "Bijwerken…" onder de kop
**Toets:** E2E

### AC-083 — Fout zonder cache (WP4; S-01)
GEGEVEN geen cache, en een server of database die met een fout antwoordt
WANNEER de app opent
DAN verschijnt een uitleg in gewone taal met "Opnieuw proberen", blijft de onderbalk bruikbaar, en verschijnt nooit de standaardfoutpagina van Next.js. "Opnieuw proberen" laadt opnieuw als de fout over is
**Toets:** E2E + Vis

### AC-084 — Fout met cache (WP4; UX §7)
GEGEVEN een gevulde cache, terwijl verversen faalt
WANNEER de app opent
DAN staat de bewaarde stand er, met de balk "Kon niet bijwerken · stand van HH:MM · Opnieuw"
**Toets:** E2E

### AC-085 — Offline-balk (WP4; UX §7, wireframe 17)
GEGEVEN de telefoon is offline en er staan 2 wijzigingen in de wachtrij
WANNEER een scherm open is
DAN staat bovenaan "Offline · stand van HH:MM. Afvinken kan gewoon; 2 wijzigingen worden verstuurd zodra je weer verbinding hebt." Na herstel van de verbinding verdwijnt de balk
**Toets:** E2E

### AC-086 — Acties die internet nodig hebben, zijn offline uitgeschakeld (WP4; TECHNICAL_DESIGN §9.3)
GEGEVEN offline
WANNEER de gebruiker een actie aantikt die alleen online kan (bijvoorbeeld een reeks maken, pauzeren, instellingen)
DAN is die uitgeschakeld en staat erbij "Hiervoor heb je internet nodig". De wachtrij-acties uit §9.3 werken wel
**Toets:** E2E

### AC-087 — Offline naar een nooit bezochte pagina (WP4; S-04)
GEGEVEN offline, en `/instellingen/profiel` is nog nooit geopend
WANNEER de gebruiker ernaartoe gaat
DAN verschijnt de pagina `/offline`, niet het dashboard onder een andere URL
**Toets:** E2E

### AC-088 — Niet gevonden (WP4; UX §5.14)
GEGEVEN een onbekende URL, of `/?taak=<id>` van een verwijderde taak
WANNEER die wordt geopend
DAN verschijnt respectievelijk "Deze pagina bestaat niet · Naar Vandaag" en "Deze taak bestaat niet meer. Misschien is hij verwijderd. · Naar Vandaag"
**Toets:** E2E

### AC-089 — Sheets hebben een eigen URL (WP4; UX §3; TECHNICAL_DESIGN §9.2)
GEGEVEN de URL `/?taak=<id>`
WANNEER die direct wordt geopend (ook offline, als de taak in de cache staat) en daarna wordt vernieuwd
DAN is het taakdetail open en blijft het open. "Terug" sluit de sheet en laat Vandaag zien
**Toets:** E2E

### AC-090 — Gericht verversen en prestaties (WP4; P-01; TECHNICAL_DESIGN §11.2)
GEGEVEN de seed-data, telefoonemulatie op 390×844 met 4G-throttling
WANNEER Vandaag laadt, en daarna een ander apparaat een taak afvinkt
DAN:
- is de LCP ≤ 2,5 s en is HTML + RSC van Vandaag ≤ 200 KB;
- leidt een Realtime-wijziging tot ten hoogste 2 queries, niet tot de hele snapshot.
**Toets:** performance-review (meting)

### AC-091 — Eén bron voor kleuren en letters (WP4; D-01; V-30, V-31)
GEGEVEN het design system
WANNEER de schermen worden bekeken in licht en donker
DAN:
- komen alle kleuren uit de tokens, zonder hardgecodeerde kleuren of dubbele tokens;
- is de accentkleur #2B4C9B, en heeft het app-icoon dezelfde tint (V-30);
- past de `theme_color` van het manifest bij de app;
- is het lettertype Figtree, door de app zelf gehost via `next/font/local` (V-31). Er gaan geen verzoeken naar Google Fonts of een andere externe letterdienst; te controleren in het netwerkoverzicht.
**Toets:** code-review + Vis + E2E (netwerkverzoeken)

### AC-224 — Afvalgegevens in de nieuwe gegevenslaag (WP4; TD §11.2, §18.14)
GEGEVEN afvaltaken in het venster van de taken, en een gezinslid en een beheerder
WANNEER de app laadt, online en offline uit de cache
DAN:
- heeft elke afvaltaak zijn ophaaldag, richting en bakken;
- weet de app of de afvalkalender aan staat;
- zijn bij afvaltaken voor niemand de knoppen voor bewerken, verplaatsen en verwijderen beschikbaar.

Een oudere cache zonder deze gegevens toont de taak als gewone taak tot de verversing, zonder fout.
**Toets:** Unit + Int

---

## WP5 — Vandaag, de afvinken-kernflow en het taakdetail

### AC-092 — Inhoud van Vandaag (WP5; UC-01; UX §5.1)
GEGEVEN 1 verlopen taak, 4 open taken voor vandaag, 2 gedane taken en 5 komende taken
WANNEER Vandaag opent
DAN staan in deze volgorde:
1. Verlopen (met "N dagen te laat");
2. Vandaag, gesorteerd op deadline en tijd;
3. "✓ 2 gedaan vandaag · tonen";
4. Binnenkort (maximaal 3);
5. de weekkaart.

De verlopen taak staat er één keer. Er staan geen namen, avatars, punten of "Mijn taken / Iedereen"
**Toets:** E2E + Vis (CP2)

### AC-093 — Alles in beeld zonder scrollen (WP5; succescriterium 6)
GEGEVEN dezelfde situatie als in AC-092, op 390×844
WANNEER Vandaag opent
DAN zijn de verlopen taak, de 4 taken van vandaag en de gedaan-regel zichtbaar zonder te scrollen
**Toets:** Vis (CP2)

### AC-094 — Afvinken met één tik (WP5; UC-02; UX §4.1)
GEGEVEN een open taak op Vandaag
WANNEER de gebruiker één keer op het rondje tikt
DAN is de taak binnen 100 ms zichtbaar gedaan, schuift hij naar de gedaan-regel en daalt de teller. Onderaan verschijnt ongeveer 5 seconden "Gedaan: <taak> · Ongedaan maken"
**Toets:** E2E + performance-review

### AC-095 — Direct ongedaan maken (WP5; BR-13)
GEGEVEN een taak die net is afgevinkt
WANNEER de gebruiker "Ongedaan maken" aantikt
DAN staat de taak weer open op zijn plek. Na herladen is hij open, en er is geen historie-rij voor deze afvinking
**Toets:** E2E

### AC-096 — Later terugzetten door iedereen (WP5; BR-13; V-22; UX §4.2)
GEGEVEN een taak die eerder vandaag is afgevinkt
WANNEER Lynn "✓ gedaan vandaag · tonen" en daarna het gevulde rondje aantikt, of in het detail "Terugzetten" kiest
DAN staat de taak weer open, met de melding "Weer open: <taak> · Ongedaan maken". Er staat nergens wie hem afvinkte
**Toets:** E2E

### AC-097 — Dubbel tikken in de interface (WP5; BR-10, BR-11)
GEGEVEN een open taak
WANNEER de gebruiker twee keer heel snel op het rondje tikt
DAN is er na herladen precies één registratie, en staat de taak op gedaan, niet weer open
**Toets:** E2E + Int

### AC-098 — Offline afvinken (WP5; BR-10; UX §4.1)
GEGEVEN de telefoon is offline
WANNEER de gebruiker een taak afvinkt, daarna weer online gaat en herlaadt
DAN:
- staat de taak meteen op gedaan, met "wacht op verbinding" in de rij;
- wordt hij na herstel verstuurd;
- is er na herladen precies één registratie, met het afvinkmoment van toen (BR-12).
**Toets:** E2E

### AC-099 — Offline afvinken en weer terugzetten vóór synchronisatie (WP5; TECHNICAL_DESIGN §6.1)
GEGEVEN offline
WANNEER de gebruiker een taak afvinkt en daarna "Ongedaan maken" kiest, en de verbinding terugkomt
DAN wordt er niets verstuurd en blijft de taak open
**Toets:** E2E / Int (outbox)

### AC-100 — Afvinken van een taak die intussen weg is, of bij een fout (WP5; UX §4.1)
GEGEVEN een taak die op de server intussen is verwijderd, en een tweede taak waarbij de server een onbekende fout geeft
WANNEER de gebruiker beide afvinkt
DAN verdwijnt de eerste rij met "Deze taak bestaat niet meer". De tweede springt terug naar open met "Afvinken lukte niet · Opnieuw"
**Toets:** E2E (gemockte fout) + Int

### AC-101 — Een huisgenoot ziet het (WP5; UC-02)
GEGEVEN Jurgen en Ellen zijn beiden ingelogd
WANNEER Ellen een taak afvinkt
DAN ziet Jurgen de taak als gedaan: lokaal na herladen, en op live binnen enkele seconden via Realtime
**Toets:** E2E (lokaal, herladen) + Live (Realtime)

### AC-102 — Leeg huishouden (WP5; UX §7, wireframe 03)
GEGEVEN een huishouden zonder taken
WANNEER Jurgen en Lynn (zonder aanmaakrecht) Vandaag openen
DAN ziet Jurgen "Nog geen taken" met "Kies uit standaardtaken" en "Zelf een taak toevoegen". Lynn ziet een verwijzing naar de beheerder, zonder knoppen om aan te maken
**Toets:** E2E + Vis (CP3)

### AC-103 — Alles gedaan, en alleen verlopen (WP5; UX §7, wireframe 02)
GEGEVEN (a) alle taken van vandaag zijn gedaan, (b) er is alleen een verlopen taak en niets meer voor vandaag
WANNEER Vandaag opent
DAN toont (a) "Alles gedaan voor vandaag" met de gedaan-regel en Binnenkort. Bij (b) staat onder Vandaag "Voor vandaag staat niets meer gepland"
**Toets:** Vis (CP3)

### AC-104 — Rondje en rij zijn twee losse knoppen (WP5; A-01)
GEGEVEN een taakrij
WANNEER hij met het toetsenbord en een schermlezer wordt bediend
DAN zijn het rondje ("<taak> afvinken") en de rij ("<taak> openen") twee aparte, focusbare knoppen met een eigen naam, zonder knop in een klikbaar element
**Toets:** E2E (rol en naam) + accessibility-review

### AC-105 — Het taakdetail (WP5; UX §5.5)
GEGEVEN een open uitvoering uit een reeks
WANNEER Lynn het detail opent
DAN ziet ze:
- de knoppen Afvinken, Naar morgen, Andere dag… en ⋯;
- de gegevens Gepland, Uiterlijk, Herhaalt, Notities (met de naam van de schrijver) en Vorige keren (zonder personen).

Voor andermans reeks ziet ze geen reeksacties en geen Verwijderen, maar wel de regel "Reeks aanpassen kan een beheerder of wie hem instelde." De maker wordt nergens genoemd
**Toets:** E2E + Vis

### AC-106 — Bezig (WP5; BR-14)
GEGEVEN een open taak
WANNEER Lynn "Ik ben ermee bezig" kiest, en Jurgen daarna "Niet meer bezig"
DAN staat eerst het label "bezig" in de rij, zonder naam, en daarna is het weg. Nergens wordt opgeslagen wie het deed
**Toets:** E2E + DB

### AC-107 — Deze keer overslaan (WP5; UX §4.7)
GEGEVEN een open uitvoering uit een reeks
WANNEER een lid "Deze keer overslaan" kiest en daarna "Ongedaan maken"
DAN staat de uitvoering eerst op overgeslagen, met de volgende keer klaar, en daarna weer open
**Toets:** E2E

### AC-108 — Notities (WP5; V-25; UX §5.5)
GEGEVEN een taak met een notitie van Ellen
WANNEER Lynn een notitie toevoegt (twee keer dezelfde verzending), de eigen notitie verwijdert en die van Ellen probeert te verwijderen
DAN:
- bestaat Lynns notitie één keer, met "Lynn:" ervoor;
- kan ze de eigen notitie verwijderen;
- heeft ze voor Ellens notitie geen verwijderoptie, en de database weigert het ook.

Jurgen (beheerder) kan elke notitie verwijderen
**Toets:** E2E + DB

### AC-109 — Laadfout bij notities (WP5; S-03)
GEGEVEN het laden van de notities mislukt
WANNEER het detail open is
DAN staat er "Notities konden niet worden geladen · Opnieuw", en werkt de rest van het detail gewoon
**Toets:** E2E (gemockt)

### AC-171 — Teller "nog N te doen" in de kop (WP5; UX §5.1)
GEGEVEN 1 verlopen taak, 4 open taken voor vandaag en 2 gedane taken
WANNEER Vandaag opent, en daarna een taak van vandaag wordt afgevinkt
DAN staat in de kop eerst "nog 5 te doen" (open vandaag + verlopen) en na het afvinken "nog 4 te doen". Na "Ongedaan maken" staat er weer 5
**Toets:** E2E + Unit

### AC-172 — Offline afgevinkt vóór een deploy, online ná de deploy (WP4/WP5; BR-10, BR-11; plan-critic punt 9)
GEGEVEN een telefoon met de app open, en een afvinking die offline in de wachtrij staat, in de vorm van een oudere app-versie. Voorbeeld: entry v0, met het vervallen veld `completedBy`
WANNEER er intussen een nieuwe versie van de app wordt uitgerold en de telefoon daarna weer verbinding krijgt
DAN:
- bestaat er na verwerking **precies één** registratie van die afvinking, zonder persoon. De oude vorm wordt omgezet (`migrateOutboxEntry`), niet weggegooid, en niet dubbel verwerkt. Ook een tweede verzending van dezelfde entry geeft één registratie;
- wordt een actie van een soort die niet meer bestaat (bijvoorbeeld v0 "toewijzen") niet uitgevoerd, en ziet de gebruiker de melding "1 offline wijziging hoort bij een functie die niet meer bestaat (toewijzen) en is niet uitgevoerd.";
- blijft een entry die een onbekend antwoord krijgt (bijvoorbeeld een HTML-foutpagina tijdens de deploy), een 5xx, 408, 429 of 401, staan en wordt die later opnieuw geprobeerd:
  - na 5 mislukte pogingen blijft hij staan, met de balk "N wijzigingen konden niet worden verstuurd · Opnieuw";
  - bij 401 staat er "Log opnieuw in om N wijzigingen te versturen";
- verdwijnt een entry nooit uit de wachtrij zonder dat de gebruiker dat ziet;
- geeft `POST /api/outbox` zonder geldige sessie een **HTTP 401 met een JSON-antwoord**. Dus geen redirect naar `/login` en geen HTML-pagina, want dan zou de client het als "onbekend antwoord" behandelen. `proxy.ts` stuurt dit pad niet door. De client laat de entry staan en toont "Log opnieuw in om N wijzigingen te versturen".

Dit geldt vanaf de eerste deploy mét het stabiele wachtrij-endpoint (TECHNICAL_DESIGN §9.3.1). Het eenmalige restrisico bij de allereerste deploy (WP1) wordt vooraf aan Jurgen gemeld, samen met de beperkende maatregel (§9.3.1 punt 5)
**Toets:** E2E (entry v0 in IndexedDB geïnjecteerd → online na de deploy → precies één registratie) + Int (`POST /api/outbox`: dubbele entry, CSRF-weigering, zonder sessie 401 met JSON en zonder redirect) + Unit (`migrateOutboxEntry`, alle v0-soorten) + Proces (melding aan Jurgen bij de WP1-deploy)

### AC-225 — Afvaltaak in de lijst (WP5; UX §13.4, §13.5)
GEGEVEN ophaaldag dinsdag 6 oktober voor restafval en papier
WANNEER Vandaag wordt bekeken op zondag 14:00, maandag 14:00, dinsdag 06:30, dinsdag 09:00, dinsdag 13:00 en woensdag 09:00
DAN staan de taken op de plek en met de rechterkolom uit de tabellen in UX §13.4:
- zondag: buitenzetten onder Binnenkort met "morgen";
- maandag: buitenzetten onder Vandaag met "vanaf 22:00", binnenzetten onder Binnenkort met "morgen";
- dinsdag 06:30: buitenzetten onder Vandaag met "vóór 07:45";
- dinsdag 09:00: buitenzetten bij Verlopen met "… te laat", binnenzetten bovenaan Binnenkort met "vanaf 12:00";
- dinsdag 13:00: binnenzetten onder Vandaag;
- woensdag: binnenzetten bij Verlopen, en buitenzetten weg (vanzelf overgeslagen).

De taken hebben het kenmerk "♻ Afvalkalender" (met bezig: "Afvalkalender bezig"). Nergens staat "21:00", en er is geen deadlinebadge behalve "… te laat".
**Toets:** Unit + E2E

### AC-226 — Taakdetail van een afvaltaak (WP5; UX §13.6; BR-53)
GEGEVEN een open buitenzet-taak, geopend door een beheerder en door een gezinslid
WANNEER het detail opent
DAN:
- is "Afvinken" de hoofdactie, met "Ik ben ermee bezig", "Deze keer overslaan" en de notities direct zichtbaar;
- zijn er geen ⋯-menu, geen "Naar morgen", "Andere dag…", "Bewerken" of "Verwijderen", en geen "Vorige keren";
- staan de bovenregel T-20, de infolijst (T-21, T-22, en T-25 alleen volgens AC-211) en de uitlegregel T-27 er, zonder omschrijving;
- geeft overslaan de melding T-31, waarbij "Ongedaan maken" beide taken terugzet.
**Toets:** E2E

### AC-227 — Overslaan zonder verbinding (WP5; BR-53)
GEGEVEN een gezinslid is offline
WANNEER hij buitenzetten overslaat, en later weer online komt
DAN:
- staan buitenzetten en binnenzetten direct als overgeslagen in beeld;
- gaat de actie na het herstel van de verbinding één keer naar de server;
- klopt de eindstand met de server.

Bewerken of verplaatsen van een afvaltaak kan offline niet in de wachtrij komen.
**Toets:** Int + E2E

---

## WP6 — Taak maken en wijzigen, reeksen, het scherm Taken

### AC-110 — Snel een taak toevoegen (WP6; UC-03; UX §4.3)
GEGEVEN Vandaag is open
WANNEER Jurgen op + tikt, "Fietsband plakken" typt en op Toevoegen tikt
DAN staat de taak voor vandaag, met de deadline aan het einde van de dag in de tijdzone van het huishouden, en verschijnt "Toegevoegd voor vandaag · Bekijken". Dat zijn 2 tikken, zonder "Wie?"
**Toets:** E2E

### AC-111 — Slimme invoer herkent de dag, niet de persoon (WP6; UC-03; UX §4.3)
GEGEVEN de sheet Nieuwe taak
WANNEER "Badkamer zaterdag Jurgen" wordt ingetypt
DAN wordt "zaterdag" onderstreept, staat de chip op de eerstvolgende zaterdag en wordt de naam "Badkamer Jurgen". Met "toch in de naam" blijft "zaterdag" in de naam en gaat de dag terug
**Toets:** Unit (parser, `matchedText`) + E2E

### AC-112 — Validatie van de naam (WP6; UX §6)
GEGEVEN de sheet Nieuwe taak
WANNEER de naam leeg is, 70 tekens heeft of 81 tekens heeft
DAN is Toevoegen uit bij een lege naam, verschijnt de teller vanaf 70 tekens, en staat er bij 81 "Maximaal 80 tekens" met Toevoegen uit. De server weigert ook 81 tekens
**Toets:** E2E + Unit (zod)

### AC-113 — Serverfout en dubbel versturen bij toevoegen (WP6; BR-10)
GEGEVEN een ingevulde sheet
WANNEER de gebruiker twee keer snel op Toevoegen tikt, en in een tweede geval de server een fout geeft
DAN ontstaat er één taak en toont de knop "Bezig…" tijdens het verzenden. Bij de fout blijft de sheet open, met alle invoer en "Opslaan lukte niet. Probeer het opnieuw."
**Toets:** E2E

### AC-114 — Offline een losse taak toevoegen (WP6; TECHNICAL_DESIGN §9.3)
GEGEVEN offline
WANNEER de gebruiker een losse taak toevoegt en daarna een reeks probeert te maken
DAN komt de losse taak in de lijst met "wacht op verbinding", en na herstel bestaat hij precies één keer. Het maken van een reeks is uitgeschakeld met "Hiervoor heb je internet nodig"
**Toets:** E2E

### AC-115 — Een terugkerende taak maken (WP6; UC-04; BR-01, BR-02)
GEGEVEN de sheet Nieuwe taak
WANNEER Jurgen "Badkamer" typt, Herhalen aanzet met Wekelijks op zaterdag, en toevoegt
DAN:
- toont de samenvatting "Elke zaterdag, vanaf za <datum>" vóór het opslaan;
- ontstaat er één reeks;
- staan er uitvoeringen op de zaterdagen in de komende 14 dagen.

Elk ritme uit BR-01 (dagelijks, elke X dagen, weekdagen, elke X weken, maandelijks op dag N of de n-de weekdag, jaarlijks) levert de datums van de geteste domeinregel op
**Toets:** E2E + Unit

### AC-116 — Het deadline-venster (WP6; BR-18)
GEGEVEN het formulier met "Uiterlijk" en "Mag al eerder"
WANNEER "Mag al eerder" later ligt dan "Uiterlijk"
DAN staat er "Mag al kan niet later zijn dan uiterlijk", is Toevoegen uit, en weigert de server het ook
**Toets:** E2E + Unit

### AC-117 — Zomer- en wintertijd (WP6; BR-40)
GEGEVEN een reeks met deadline 20:00, in de tijdzone Europe/Amsterdam
WANNEER uitvoeringen vóór en na de overgang naar wintertijd worden ingepland
DAN is de deadline steeds 20:00 lokale tijd
**Toets:** Unit

### AC-118 — Alleen deze keer wijzigen (WP6; BR-08)
GEGEVEN een uitvoering uit een reeks
WANNEER die voor "alleen deze keer" een nieuwe titel krijgt en de reeks daarna opnieuw wordt ingepland (AC-119)
DAN houdt deze uitvoering de nieuwe titel en blijft de reeks ongewijzigd
**Toets:** Int

### AC-119 — Deze en alle volgende keren wijzigen, met recht (WP6; BR-08, BR-22)
GEGEVEN een reeks van Jurgen, met een aangepaste uitvoering (uitzondering) in de toekomst
WANNEER Jurgen vanaf zaterdag "Deze en alle volgende keren" een nieuwe titel geeft
DAN hebben de reeks en alle open, niet-aangepaste uitvoeringen vanaf zaterdag de nieuwe titel, blijft de uitzondering ongemoeid, en verschijnt "Reeks aangepast vanaf za <datum>"
**Toets:** Int + E2E

### AC-120 — Zonder recht verschijnt de keuze niet (WP6; BR-22; UX §4.5)
GEGEVEN Lynn bewerkt een uitvoering uit Jurgens reeks
WANNEER ze opslaat
DAN heeft ze de keuze "Wat wil je wijzigen?" niet gekregen, staat er "Dit verandert alleen deze keer. De hele reeks aanpassen kan een beheerder.", en is alleen deze uitvoering veranderd
**Toets:** E2E

### AC-121 — Verplaatsen (WP6/WP8; UC-05; UX §4.6)
GEGEVEN een taak op vandaag met deadline vandaag 20:00, uit een reeks
WANNEER een lid "Naar morgen" kiest en daarna "Ongedaan maken"
DAN staat de taak eerst op morgen, met deadline morgen 20:00, alleen voor deze keer en zonder vraag, met "Verplaatst naar <dag> · Ongedaan maken". Daarna staat hij weer op vandaag
**Toets:** E2E + Int

### AC-122 — Pauzeren en hervatten (WP6; BR-09; UX §4.7)
GEGEVEN Jurgens reeks
WANNEER hij "Reeks pauzeren…" kiest tot en met over 2 weken, en later "Hervatten"
DAN vervallen de open, niet-aangepaste uitvoeringen in die periode, staat er "gepauzeerd t/m <datum> · Hervatten", en wordt er na hervatten weer vanaf vandaag ingepland
**Toets:** E2E + Int

### AC-123 — Stoppen vraagt om bevestiging (WP6; BR-09; UX §4.7)
GEGEVEN Jurgens reeks
WANNEER hij "Reeks stoppen…" kiest
DAN verschijnt eerst de bevestiging met de gevolgen. Pas na "Stoppen" komen er geen nieuwe keren meer, verdwijnen de open keren en blijft de historie. Annuleren verandert niets
**Toets:** E2E

### AC-124 — Verwijderen (WP6; BR-23; UX §4.7)
GEGEVEN een losse taak zonder historie, een losse taak met historie, en een uitvoering uit een reeks
WANNEER de maker of een beheerder verwijdert (na bevestiging)
DAN:
- is de taak zonder historie echt weg;
- is de taak met historie verborgen, met de historie behouden;
- vraagt de reeks-uitvoering om "Alleen deze keer" of "Deze en alle volgende keren (reeks stoppen)". De tweede optie is er alleen voor wie de reeks mag beheren.
**Toets:** E2E + DB

### AC-125 — Een losse taak wordt terugkerend (WP6; UC-04)
GEGEVEN een losse taak
WANNEER een lid met aanmaakrecht bij Bewerken Herhalen aanzet
DAN hoort de taak bij een nieuwe reeks, met hem als eerste uitvoering, en zijn de volgende uitvoeringen ingepland
**Toets:** Int

### AC-126 — Het scherm Taken (WP6; UX §5.2; S-03, A-03, D-04)
GEGEVEN taken in verschillende staten
WANNEER de gebruiker Taken opent
DAN:
- zijn er de segmenten Open (gegroepeerd per periode), Gedaan (30 dagen, "op tijd"/"te laat") en Terugkerend (per reeks: ritme, volgende keer, gepauzeerd);
- heeft het zoekveld het label "Zoek een taak";
- staan actieve filters als chips met ✕ en "Filters wissen";
- is er geen filter per persoon en geen "Mijn taken".

Zoeken zonder resultaat met een filter geeft "Niets gevonden voor ‘…’ · Filters wissen"
**Toets:** E2E + Vis

### AC-127 — Standaardtaken activeren (WP6; BR-20, BR-10)
GEGEVEN de lijst met standaardtaken
WANNEER Jurgen 3 taken aanvinkt, met een ritme per taak, en "Toevoegen (3)" twee keer verstuurt
DAN bestaan er 3 reeksen, elk één keer, met hun uitvoeringen. Lynn kan dit alleen als de instelling aan staat
**Toets:** Int + E2E

### AC-173 — Een reeks wijzigen vanuit het reeksdetail (WP6; BR-08, BR-22; plan-critic punt 10)
GEGEVEN (a) een gepauzeerde reeks van Jurgen zonder open uitvoering, (b) een actieve reeks van Jurgen
WANNEER Jurgen vanuit Taken › Terugkerend › reeksdetail "Wijzigen" kiest en het ritme of de titel aanpast, en Lynn (gezinslid, niet de maker) hetzelfde probeert, ook met een direct verzoek
DAN:
- slaagt de wijziging bij Jurgen in beide gevallen, zonder dat een open uitvoering nodig is;
- worden de toekomstige, niet-aangepaste uitvoeringen volgens de nieuwe regel ingepland (bij (a) na de pauze);
- ziet Lynn geen knop "Wijzigen";
- weigert de server haar directe verzoek met `FORBIDDEN`, zonder dat er iets verandert.
**Toets:** Int + E2E

### AC-174 — "Wijzigingen weggooien?" bij sluiten (WP6; UX §3, §4.3)
GEGEVEN de sheet Nieuwe taak of Bewerken, met een ingevulde of gewijzigde naam
WANNEER de gebruiker ✕ tikt of de sheet omlaag veegt
DAN vraagt de app "Wijzigingen weggooien?".
- "Weggooien" sluit de sheet zonder op te slaan.
- Annuleren laat alles staan.
- Zonder ingevulde of gewijzigde gegevens sluit de sheet direct, zonder vraag.
**Toets:** E2E

### AC-181 — Aantal tikken (WP5/WP6; V-37; UX §4.1, §4.5, §4.6)
GEGEVEN een open taak op Vandaag
WANNEER de gebruiker de taak afvinkt, verplaatst naar morgen, op "bezig" zet, en de naam wijzigt
DAN kost:
- afvinken 1 tik (het rondje);
- "Naar morgen" 2 tikken (rij openen → Naar morgen);
- "bezig" maximaal 2 tikken vanaf het taakdetail;
- naam of details wijzigen maximaal 5 tikken, typen niet meegeteld (rij → ⋯ → Bewerken → Opslaan, plus bij een reeks de keuze "Alleen deze keer" / "Deze en alle volgende keren").
**Toets:** E2E (tikken tellen in het script)

### AC-228 — Informatierij bij Terugkerend (WP6; UX §13.11)
GEGEVEN de afvalkalender staat aan
WANNEER een beheerder en een gezinslid Taken › Terugkerend openen
DAN:
- zien beiden bovenaan de rij T-96 "Afvalkalender · volgt de ophaaldagen van de gemeente";
- heeft alleen de beheerder een pijl naar de instellingen van de afvalkalender.

Staat de afvalkalender uit, dan is de rij er niet.
**Toets:** E2E

### AC-229 — Geen bewerkformulier voor afvaltaken (WP6; BR-53)
GEGEVEN een afvaltaak
WANNEER iemand de link om die taak te bewerken opent (`/taken/<id>/bewerken` of `?bewerk=<id>`)
DAN:
- opent het taakdetail en niet het formulier;
- zijn "Wat wil je wijzigen?" en omzetten naar terugkerend niet bereikbaar;
- vinden zoeken op "afval", "papier" of "PMD" en het categoriefilter Buiten de afvaltaken.
**Toets:** E2E

---

## WP7 — Instellingen, account en inloggen

### AC-128 — Inloggen en een fout wachtwoord (WP7; UC-11; UX §4.12)
GEGEVEN het inlogscherm
WANNEER een fout wachtwoord wordt ingevoerd, en daarna te vaak achter elkaar
DAN staat er "E-mailadres of wachtwoord klopt niet" en blijft het e-mailadres staan. Bij de limiet van Supabase verschijnt "Te veel pogingen. Wacht even en probeer het opnieuw." Uit de tekst blijkt nooit of het adres bestaat
**Toets:** E2E

### AC-129 — Geen open registratie in het inlogscherm (WP7; V-05)
GEGEVEN het inlogscherm
WANNEER het wordt bekeken
DAN is er geen tab of knop "Nieuw", wel de tekst "Nieuw? Je komt erbij via een uitnodiging van iemand uit je huishouden." Registreren kan alleen vanuit een uitnodiging of de onboarding
**Toets:** E2E + Vis

### AC-130 — Wachtwoord vergeten (WP7; UC-11; V-14)
GEGEVEN Lynn is haar wachtwoord vergeten
WANNEER ze "Wachtwoord vergeten?" kiest, haar adres invult, de herstellink opent, een nieuw wachtwoord van minstens 8 tekens instelt en opslaat
DAN:
- verschijnt na het versturen "Check je mail. De link is 1 uur geldig." Die tekst komt ook bij een onbekend adres;
- komt ze na het opslaan ingelogd op Vandaag;
- verliezen haar andere toestellen hun sessie.

De mail is Nederlandstalig. De bouwer heeft in Supabase via de koppeling de template "Reset password" (Nederlands, `token_hash`-variant) en een minimale wachtwoordlengte van 8 ingesteld. Lukt dat niet via de koppeling, dan heeft Jurgen een stappenlijst gekregen en zijn de instellingen daarna gecontroleerd (V-35)
**Toets:** E2E (link via `generateLink`) + Live-controle mail

### AC-131 — Wachtwoordeisen en een verlopen herstellink (WP7; UC-11)
GEGEVEN het scherm Nieuw wachtwoord, en een herstellink van meer dan 1 uur oud
WANNEER een wachtwoord van 7 tekens wordt ingevoerd, of de oude link wordt geopend
DAN wordt het korte wachtwoord geweigerd, met de eis al vooraf zichtbaar. De oude link leidt naar "Deze link is verlopen · Nieuwe link sturen"
**Toets:** E2E + Unit

### AC-132 — Inloglink opnieuw sturen (WP7; UX §4.12)
GEGEVEN een inloglink is net verstuurd
WANNEER de gebruiker direct opnieuw wil sturen
DAN is "Opnieuw sturen" pas na 60 seconden actief
**Toets:** E2E

### AC-133 — Uitloggen met een bevestiging (WP7; BR-43; UX §4.12)
GEGEVEN er staan 2 niet-verstuurde offline wijzigingen
WANNEER de gebruiker Uitloggen kiest
DAN verschijnt eerst "Er staan nog 2 wijzigingen klaar die niet verstuurd zijn. Die gaan verloren." met Toch uitloggen / Annuleren. Zonder wachtende wijzigingen verschijnt de gewone bevestiging over het wissen van de offline gegevens. Na uitloggen geldt AC-031
**Toets:** E2E

### AC-134 — Account verwijderen (WP7; UC-11; V-15)
GEGEVEN Lynn met een wachtwoord, notities en afvinkingen in het huishouden
WANNEER ze Account verwijderen kiest, de gevolgen leest en haar wachtwoord juist invoert
DAN:
- zijn haar lidmaatschap, voorkeuren, meldingen, pushabonnementen en inlogaccount weg;
- bestaan de taken, reeksen, historie en haar notities nog (naamweergave volgens AC-062);
- is de lokale data gewist;
- ziet ze het inlogscherm met "Je account is verwijderd."
**Toets:** Int + E2E

### AC-135 — Account verwijderen met een fout wachtwoord (WP7; §4.5)
GEGEVEN het scherm Account verwijderen
WANNEER het wachtwoord onjuist is
DAN staat er "Wachtwoord klopt niet" en is er niets verwijderd
**Toets:** Int

### AC-136 — De enige beheerder kan zijn account niet verwijderen (WP7; BR-24)
GEGEVEN Jurgen is de enige actieve beheerder
WANNEER hij Account verwijderen opent, en daarnaast direct de RPC aanroept
DAN is de knop uitgeschakeld met "Je bent de enige beheerder. Maak eerst iemand anders beheerder in Gezinsleden." en weigert de RPC. Er is niets verwijderd
**Toets:** E2E + DB

### AC-137 — Account verwijderen zonder wachtwoord (WP7; TECHNICAL_DESIGN §4.5)
GEGEVEN een gebruiker die alleen met een inloglink inlogt en geen wachtwoord heeft
WANNEER hij Account verwijderen opent
DAN ziet hij "Stel eerst een wachtwoord in via Wachtwoord vergeten", en kan hij zonder die stap niet verwijderen
**Toets:** E2E

### AC-138 — Huishouden verwijderen (WP7; UC-12; V-15; UX §4.14)
GEGEVEN Jurgen (beheerder) en het huishouden "Familie"
WANNEER hij "Huishouden verwijderen…" kiest
DAN:
- is "Alles verwijderen" pas actief na het exact typen van "Familie";
- zijn daarna alle gegevens van Familie weg: taken, reeksen, historie, boodschappen, leden, uitnodigingen en meldingen;
- zijn alle andere huishoudens ongemoeid;
- ziet Jurgen "Het huishouden is verwijderd.";
- ziet Ellen bij haar volgende gebruik **eerst** het scherm "Je hoort niet meer bij ‘Familie’" (UX §4.14/§4.16, AC-177, TECHNICAL_DESIGN §4.6), en niet direct de onboarding. De onboarding volgt pas na "Een eigen huishouden starten" → "Toch starten". Haar lokale data zijn gewist. Alleen op een toestel zonder cache van Ellen verschijnt direct de onboarding (bewuste grens, AC-177).

Lynn (gezinslid) ziet deze optie niet en de RPC weigert haar
**Toets:** E2E + DB

### AC-139 — Uitnodigen (WP7; UC-09; UX §4.11)
GEGEVEN Jurgen bij Gezinsleden
WANNEER hij "Iemand uitnodigen" kiest, met rol Gezinslid en zonder e-mailadres, en een link maakt
DAN verschijnt "Link klaar · geldig tot <datum + 14 dagen>" met Delen en Kopiëren, en staat de uitnodiging onder "Open uitnodigingen". Na Intrekken werkt de link niet meer
**Toets:** E2E

### AC-140 — Een uitnodiging accepteren (WP7; UC-09)
GEGEVEN een geldige uitnodiging als gezinslid
WANNEER een nieuwe persoon de link opent, een account maakt, meedoet en de profielstap afrondt
DAN is hij gezinslid in het huishouden, met de standaardvoorkeuren voor zijn rol (AC-052), en komt hij op Vandaag. Een bestaande, ingelogde gebruiker zonder huishouden kan met "Meedoen" hetzelfde bereiken
**Toets:** E2E

### AC-141 — Gezinsleden beheren (WP7; UC-12; BR-24; V-29; UX §4.15)
GEGEVEN Jurgen bij Gezinsleden, met Ellen, Lynn en Kai
WANNEER hij Kai uitzet (met bevestiging), weer aanzet, Lynn tot beheerder maakt en een lid verwijdert (met bevestiging)
DAN:
- staat Kai na uitzetten grijs, met "uitgezet · Geen toegang, geen meldingen";
- verschijnt bij weer aanzetten "Kai heeft weer toegang";
- zijn de rolwijziging en het verwijderen doorgevoerd.

Voor jezelf, en voor de enige beheerder, zijn uitzetten, degraderen en verwijderen uitgeschakeld, met de reden erbij
**Toets:** E2E + DB

### AC-142 — Gezinslid in Instellingen (WP7; UX §5.8, §9)
GEGEVEN Lynn (gezinslid)
WANNEER ze Instellingen opent
DAN ziet ze Profiel, Meldingen, Gezinsleden (alleen-lezen, met "Ellen en Jurgen beheren het huishouden.") en Account, maar geen Standaardtaken, geen Huishouden en geen beheerknoppen
**Toets:** E2E

### AC-143 — Eigen profiel (WP7; UC-12)
GEGEVEN een lid
WANNEER het de eigen naam, kleur of emoji wijzigt
DAN:
- is dat direct opgeslagen ("Opgeslagen");
- zien huisgenoten de nieuwe naam in de ledenlijst;
- tonen **alle** notities van dit lid, ook de oudere, de nieuwe naam. `author_name` is de laatst bekende naam en wordt bij een naamswijziging bijgewerkt (TECHNICAL_DESIGN §3.1, V-34).
**Toets:** DB (naamswijziging → `author_name` van alle notities van dit lid bijgewerkt) + E2E

### AC-144 — Meldingen instellen (WP7; BR-31; V-23; UX §4.10)
GEGEVEN Lynn met de standaardvoorkeuren van een gezinslid
WANNEER ze Instellingen › Meldingen opent en herinneringen aanzet
DAN staan alle soorten eerst uit, en is de wijziging per schakelaar direct opgeslagen. Mislukt het opslaan, dan springt de schakelaar terug en staat er "Opslaan lukte niet"
**Toets:** E2E

### AC-145 — Push aanzetten (WP7; UX §4.10)
GEGEVEN (a) een browser die push ondersteunt, (b) een iPhone-Safari die niet op het beginscherm staat, (c) een browser die push eerder heeft geblokkeerd
WANNEER de gebruiker "Meldingen aanzetten" kiest
DAN:
- is bij (a) na toestemming het abonnement opgeslagen en staat er "Aan op deze telefoon";
- ziet de gebruiker bij (b) de uitleg "Zet op beginscherm";
- ziet de gebruiker bij (c) de uitleg waar hij het terugzet.
**Toets:** E2E (a) + Vis/handmatig (b, c)

### AC-146 — De instelling "taken maken" werkt direct (WP7; BR-20)
GEGEVEN Jurgen zet "Gezinsleden mogen taken toevoegen" uit
WANNEER Lynn daarna de app gebruikt, of een eerder geopend formulier toch verstuurt
DAN verdwijnt de + bij haar (na verversen), en weigert de server haar aanmaakpoging (AC-010)
**Toets:** E2E + DB

### AC-147 — Onboarding (WP7; UC-10; UX §8; V-14)
GEGEVEN een nieuw account zonder huishouden
WANNEER de gebruiker "Nieuw huishouden starten" doorloopt: naam, taken kiezen met ritme, uitnodigen of Later
DAN:
- is hij beheerder van het nieuwe huishouden;
- is de eerste week ingepland;
- komt hij op Vandaag;
- was er geen stap "verdeling" en geen tekst over Google of Apple.

Halverwege stoppen en terugkomen gaat verder bij dezelfde stap
**Toets:** E2E

### AC-148 — Het scherm "Geen toegang" (WP7; V-29)
Zie AC-023. Aanvullend:
GEGEVEN Kai op `/geen-toegang`
WANNEER hij Uitloggen kiest, of de link Account verwijderen
DAN logt hij uit, of komt hij in de flow van AC-134. Het verwijderen van zijn account slaagt, ook al is hij uitgezet: de RPC herkent hem aan zijn eigen account, niet aan een actief lidmaatschap
**Toets:** E2E + DB (uitgezet lid roept `delete_my_account` aan → geslaagd)

### AC-175 — Eigen standaardtaken beheren: alleen een beheerder (WP7; PRODUCT_SPEC §7; plan-critic punt 11)
GEGEVEN het huishouden Familie met een eigen standaardtaak "Kippen voeren"
WANNEER Lynn (gezinslid) een eigen standaardtaak probeert toe te voegen, te wijzigen of te verwijderen, via de interface of met een direct verzoek (`saveTemplateAction`, `deleteTemplateAction`, of rechtstreeks op de tabel)
DAN:
- ziet ze in Instellingen geen Standaardtaken;
- wordt elke poging geweigerd, en is de bibliotheek ongewijzigd;
- kan Jurgen (beheerder) dezelfde handelingen wel uitvoeren;
- kan niemand de globale bibliotheek wijzigen.
**Toets:** DB (positief en negatief) + Int + E2E

### AC-176 — Huishoudinstellingen: alleen een beheerder (WP7; BR-20; PRODUCT_SPEC §7; plan-critic punt 11)
GEGEVEN "Gezinsleden mogen taken maken" staat uit
WANNEER Lynn (gezinslid) met een direct verzoek (`updateHouseholdAction`, of rechtstreeks op `households`) die instelling aanzet, of de naam van het huishouden wijzigt (de tijdzone kan niemand wijzigen, zie AC-182)
DAN:
- wordt elke poging geweigerd, en zijn alle instellingen ongewijzigd;
- kan Lynn daarna nog steeds geen taak aanmaken (AC-010);
- ziet ze Huishouden niet in Instellingen;
- kan Jurgen dezelfde wijzigingen wel doen.
**Toets:** DB (positief en negatief) + Int

### AC-177 — Niet meer in een huishouden (WP7; UC-12; BR-43, BR-44; plan-critic punt 12; UX_SPEC §4.16, wireframe 22; TECHNICAL_DESIGN §4.6)
GEGEVEN (a) Ellen heeft Kai uit Familie verwijderd, (b) Jurgen heeft Familie verwijderd terwijl Ellen ingelogd blijft. In beide gevallen staat op het toestel nog de offline-cache van deze gebruiker (`userId`-sleutel)
WANNEER Kai, respectievelijk Ellen, de app daarna opent, of de eerstvolgende verbinding krijgt
DAN ziet die persoon **vóór de onboarding** het scherm uit UX_SPEC §4.16:
- titel "Je hoort niet meer bij ‘Familie’", met de naam uit de cache;
- de uitleg "Je bent uit dit huishouden gehaald, of het huishouden bestaat niet meer. Wil je er weer bij? Vraag iemand uit je gezin om een nieuwe uitnodiging en open de link.";
- **Uitloggen** als hoofdknop;
- kleiner de link **"Een eigen huishouden starten"**. Die vraagt eerst "Weet je het zeker? Je kunt maar bij één huishouden horen. Een uitnodiging van je gezin werkt dan pas weer als je dit huishouden verlaat.". Pas na **Toch starten** volgt de onboarding; Annuleren laat het scherm staan;
- kleiner de link **"Account verwijderen"**, naar de flow van AC-134;
- geen onderbalk en geen taken.

Daarna zijn de offline opgeslagen gegevens op het toestel gewist: IndexedDB-cache, wachtrij en paginacache. Opnieuw openen toont dus geen gegevens van Familie meer.

Randgevallen:
- Is de naam van het huishouden niet bekend, dan luidt de titel "Je hoort niet meer bij een huishouden".
- **Bewuste grens (TECHNICAL_DESIGN §4.6):** op een toestel zonder cache van deze gebruiker verschijnt direct de onboarding, zonder dit scherm. De database bewaart hiervoor bewust niets over het verwijderde lidmaatschap.
- De beheerder die het huishouden zelf verwijderde, ziet dit scherm niet. Hij wordt uitgelogd naar `/login` met "Het huishouden is verwijderd." (AC-138).
- Opent de persoon later een geldige uitnodiging, dan verloopt het accepteren volgens AC-140.
**Toets:** E2E (Ellen verwijdert Kai → Kai opent de app → dit scherm met "Familie" → Toch starten → onboarding; IndexedDB leeg), plus E2E zonder cache (direct de onboarding) + Vis (wireframe 22)

### AC-182 — Tijdzone vast op Europe/Amsterdam (WP7; BR-40; V-39; UC-12)
GEGEVEN het huishouden Familie
WANNEER Jurgen (beheerder) Instellingen › Huishouden opent, en daarna met een direct verzoek (`updateHouseholdAction`, of rechtstreeks op `households`) de tijdzone op een andere waarde probeert te zetten; in een tweede geval maakt iemand een nieuw huishouden aan
DAN:
- toont de pagina de tijdzone "Europe/Amsterdam" alleen als informatie, zonder veld of keuzelijst;
- wordt het directe verzoek geweigerd (ook voor een beheerder), en blijft de tijdzone Europe/Amsterdam;
- blijven de deadlines en herinneringen van open taken ongewijzigd;
- krijgt een nieuw huishouden altijd Europe/Amsterdam, ook als er een andere waarde wordt meegestuurd.
**Toets:** DB + Int + E2E

### AC-230 — Instellingen › Afvalkalender in de nieuwe schermen (WP7; UX §13.8; AC-183 t/m AC-191, AC-213, AC-214, AC-236, AC-237)
GEGEVEN een beheerder en een gezinslid
WANNEER zij de subpagina `/instellingen/afvalkalender` openen, en de beheerder alle toestanden doorloopt:
- zoeken, Klopt dit?, meerdere adressen;
- onbekend, geen bakken, geen komende ophaaldagen, onbereikbaar;
- aan (met T-90 en met T-90b), hapering;
- kalender volgend jaar ontbreekt (T-73), storing per oorzaak, opnieuw proberen;
- uitzetten en offline
DAN:
- klopt elke toestand met UX §13.8.1 en §13.8.2, met de teksten uit UX §13.16;
- ziet het gezinslid alleen of de afvalkalender aan staat (T-38 of T-39);
- gedragen opslaan, wijzigen, opnieuw proberen en uitzetten zich zoals in AC-183 t/m AC-191, AC-213, AC-214, AC-236 en AC-237.
**Toets:** E2E

### AC-231 — Rij in Instellingen en oude links (WP7; UX §13.8; AC-223)
GEGEVEN de afvalkalender staat aan, uit, of heeft een storing
WANNEER Instellingen opent
DAN:
- toont de rij "Afvalkalender" in de groep Huishouden de waarde "Aan", "Uit" of (alleen voor beheerders) "Niet bijgewerkt" (T-35 t/m T-37);
- heeft de beheerder een pijl. Het gezinslid heeft geen pijl, maar wel de regel T-38 of T-39;
- openen een storingsmelding van vóór de nieuwe schermen en de link `/instellingen#afvalkalender` de subpagina.
**Toets:** E2E

---

## WP8 — Kalender, Boodschappen, Meldingen en Overzicht

### AC-149 — Kalender: weergaven en taak toevoegen (WP8; UC-05; UX §5.3)
GEGEVEN de Kalender in de weekweergave
WANNEER de gebruiker wisselt tussen Dag, Week en Maand, en bij een dag "+ Taak" kiest
DAN:
- zijn alle drie de weergaven correct: vandaag omkaderd, gedaan per dag ingeklapt, in de maand het aantal open taken met een markering voor verlopen;
- opent "+ Taak" een nieuwe taak met die dag ingevuld;
- staan verlopen taken op hun eigen dag.
**Toets:** E2E + Vis

### AC-150 — Kalender buiten de geladen periode (WP8; S-02)
GEGEVEN het gegevensvenster van de app
WANNEER de gebruiker 8 weken vooruit of 3 weken terug navigeert
DAN ziet hij eerst skeletrijen en daarna de werkelijke taken van die week, geen stille "Niets gepland".
- Laden mislukt: "Deze week kon niet worden geladen · Opnieuw".
- Een echt lege week: "Niets gepland deze week".
- Offline bij een niet-geladen week: "Niet beschikbaar zonder verbinding".
**Toets:** E2E

### AC-151 — Spookjes (WP8; UX §5.3)
GEGEVEN een reeks met keren verder dan 14 dagen vooruit
WANNEER de gebruiker zo'n keer aantikt
DAN staat die gestippeld zonder rondje, met "Deze keer staat nog niet klaar. Hij verschijnt 14 dagen vooraf." en een link naar de reeks
**Toets:** E2E + Vis

### AC-152 — Verplaatsen zonder slepen (WP8; A-02)
GEGEVEN de Kalender, alleen bediend met het toetsenbord
WANNEER de gebruiker een taak naar een andere dag verplaatst
DAN lukt dat via het detail, met "Andere dag…" en de datumkiezer. Slepen is een extra manier met dezelfde uitkomst
**Toets:** E2E + accessibility-review

### AC-153 — Boodschappen toevoegen (WP8; UC-07)
GEGEVEN de lijst Boodschappen
WANNEER de gebruiker "2 melk" invoert, en daarna op de chip "+ Kaas" bij Vaak gekocht tikt
DAN staat "melk" met aantal 2 bij Zuivel, blijft het veld gefocust, en is kaas toegevoegd. Er staat nergens wie iets toevoegde (V-25)
**Toets:** E2E + Unit (parser)

### AC-154 — Afvinken en klaar met winkelen (WP8; BR-42)
GEGEVEN 4 producten, waarvan 2 gekocht
WANNEER de gebruiker een gekocht product nog eens aantikt, daarna "Klaar met winkelen" kiest en vervolgens "Ongedaan maken"
DAN:
- gaat het product terug naar te halen;
- verdwijnt na afronden het gekochte naar het archief en blijft het niet-gekochte staan, met "Lijst afgerond · Ongedaan maken";
- zet Ongedaan maken alles terug (AC-051).

"Klaar met winkelen" is verborgen als er niets gekocht is
**Toets:** E2E

### AC-155 — Boodschappen offline (WP8; BR-10)
GEGEVEN offline
WANNEER de gebruiker 2 producten toevoegt en er 1 afvinkt
DAN verschijnen ze meteen, en bestaan ze na herstel precies één keer met de juiste status
**Toets:** E2E

### AC-156 — Een product bewerken en de lege lijst (WP8; UX §5.6, §7)
GEGEVEN een product, en een lege lijst
WANNEER de gebruiker op het product tikt, en de lege lijst opent
DAN opent de sheet met naam, aantal, categorie, notitie en Verwijderen. De lege lijst toont "De lijst is leeg. Wat moet er gehaald worden?" met Vaak gekocht
**Toets:** E2E + Vis

### AC-157 — Van notitie naar boodschappenlijst (WP8; UC-07)
GEGEVEN een notitie "melk en eieren" bij een taak
WANNEER de gebruiker "Op boodschappenlijst" kiest en de woorden kiest
DAN staan de gekozen producten één keer op de actieve lijst, met een bevestiging
**Toets:** E2E

### AC-158 — Meldingenlijst (WP8; UC-08; S-03, A-03)
GEGEVEN 35 meldingen, waarvan 3 ongelezen
WANNEER de gebruiker het scherm Meldingen opent
DAN:
- staan de meldingen gegroepeerd onder Vandaag en Eerder;
- zijn ongelezen meldingen vet, met een stip die een schermlezer als "ongelezen" meldt;
- markeert een tik de melding als gelezen en opent hij de taak;
- zet "Alles gelezen" alles op gelezen;
- laadt "Oudere meldingen laden" de volgende 30.

Zonder meldingen staat er "Nog geen meldingen. Hier komt een seintje als iets bijna moet of verlopen is."
**Toets:** E2E + accessibility-review

### AC-159 — Klikken op een push (WP8; UC-08; BR-25)
GEGEVEN een push voor een herinnering, en een push voor het dagoverzicht
WANNEER de gebruiker erop tikt
DAN opent de eerste het taakdetail (`/?taak=<id>`) en de tweede Vandaag
**Toets:** E2E (gesimuleerd) + Live

### AC-160 — Kaart "push staat uit" (WP8; UX §4.9)
GEGEVEN push staat uit op dit toestel
WANNEER de gebruiker "Niet nu" kiest
DAN verdwijnt de kaart en komt hij pas na 14 dagen terug
**Toets:** E2E / Unit

### AC-161 — Overzicht (WP8; UC-06; UX §5.9)
GEGEVEN afvinkingen, overgeslagen en verlopen taken in de afgelopen weken
WANNEER de gebruiker Overzicht opent en van periode wisselt (Deze week, Vorige week, 30 dagen)
DAN:
- staan er vier getallen voor het huishouden: gedaan, op tijd ("7 van 9"), vergeten, staat nog open;
- zijn er de lijsten "Vaak te laat of vergeten" (tik → taak of reeks) en "Vaak gedaan";
- staan er nergens personen, punten of taakbelasting.

De getallen kloppen met de historie in die periode
**Toets:** Unit (`stats`) + E2E

### AC-162 — Overzicht leeg of met weinig gegevens (WP8; S-03)
GEGEVEN (a) geen historie, (b) een periode met weinig gegevens
WANNEER het Overzicht opent
DAN toont (a) "Nog niets om te laten zien. Na een week afvinken zie je hier wat goed gaat en wat vaak vergeten wordt." Bij (b) staan de getallen er, maar de lijsten niet
**Toets:** Vis + Unit

### AC-232 — Kalender zonder slepen (WP8; UX §13.11; BR-53)
GEGEVEN afvaltaken in de dag-, week- en maandweergave
WANNEER iemand een afvaltaak probeert te slepen
DAN:
- beweegt de taak niet en verandert er niets;
- blijft "+ Taak" per dag werken;
- staat onder de eerste week zonder afvaltaken eenmalig T-95 "Ophaaldagen verschijnen 14 dagen vooraf.";
- tonen afvaltaken "vanaf 22:00" (buitenzetten) en "vanaf 12:00" (binnenzetten), en nergens "21:00".
**Toets:** E2E

### AC-233 — Storingsmelding in de meldingenlijst (WP8; BR-52)
GEGEVEN een beheerder met een storingsmelding van de afvalkalender
WANNEER hij Meldingen opent
DAN:
- staat de melding er met het label "Afvalkalender" (T-39c), het recycle-icoon, en de titel en tekst van M-03, M-04 of M-05;
- opent tikken de subpagina.
**Toets:** E2E

### AC-234 — Afvaltaken in het Overzicht (WP8; UX §13.11; BR-51, BR-54)
GEGEVEN in 30 dagen afvaltaken met verschillende combinaties van bakken: afgevinkt, te laat, vanzelf overgeslagen (ook binnenzetten op D+7), en vervallen door een verdwenen ophaaldag
WANNEER het Overzicht wordt bekeken
DAN:
- tellen de afvaltaken samen onder "Afval buitenzetten" en "Bakken binnenzetten" (T-97, T-98);
- telt een vanzelf overgeslagen buitenzet- of binnenzet-taak als vergeten;
- telt een vervallen afvaltaak nergens mee.
**Toets:** Unit + E2E

---

## WP9 — Hardening en release

### AC-180 — Uitrol volgens V-36 (WP1–WP9; V-36)
GEGEVEN het bouwtraject
WANNEER WP1, WP2a, WP2b en WP3 klaar en gereviewd zijn, en later WP4 t/m WP8 klaar zijn
DAN:
- gaan WP1 t/m WP3 elk direct na hun review live, met de rooktest op live. Het gezin blijft in die periode de huidige schermen gebruiken, zonder "Wie?", punten en ruilen;
- gaan de nieuwe schermen van WP4 t/m WP8 **niet** afzonderlijk live, maar samen in één release, na afronding van WP9 en de release gate;
- ziet het gezin tussendoor nooit een mengsel van oude en nieuwe schermen.
**Toets:** Proces (code-reviewer controleert per WP het bouwverslag en de deploys in `docs/PROGRESS.md`) + Live (rooktest per live-moment)

### AC-163 — Alle states per scherm (WP9; UX §7; DoD)
GEGEVEN de volledige app
WANNEER CP4 wordt vastgelegd op 390×844, in licht en donker
DAN is elke state uit de tabel in UX §7 aanwezig voor elk scherm: leeg, laden, fout, succes, uitgeschakeld, bezig, gedeeltelijk en offline. Visual-qa heeft ze goedgekeurd
**Toets:** Vis (CP4)

### AC-164 — Technisch schoon (WP9; DoD)
GEGEVEN de release-kandidaat
WANNEER typecheck, lint, unit-, DB-, integratie- en E2E-tests draaien, en de kernflow in de browser wordt doorlopen
DAN is alles groen. Er zijn geen console-fouten, geen onverklaarde waarschuwingen en geen TODO's of placeholders in de kernflow
**Toets:** CI + code-review

### AC-165 — Content Security Policy (WP9; TECHNICAL_DESIGN §4.1)
GEGEVEN productie
WANNEER een pagina laadt
DAN wordt een CSP met nonce meegestuurd, werkt de app zonder CSP-meldingen in de console, en wordt een inline script zonder nonce geblokkeerd
**Toets:** E2E + security-review

### AC-166 — Opgeruimd (WP9; INVENTARIS §7 "Overig")
GEGEVEN de repository
WANNEER de code-reviewer zoekt
DAN is er geen code meer voor toewijzing, verdeling, punten, ruilen, afwezigheid, `src/integrations/*` of `supabase/cron/schedule-tick.sql`. `docs/ARCHITECTUUR.md` verwijst naar het technisch ontwerp, en de prototypes zijn gearchiveerd
**Toets:** code-review

### AC-167 — De E2E-suite dekt de kern (WP9; TECHNICAL_DESIGN §13)
GEGEVEN de E2E-tests
WANNEER ze draaien
DAN dekken ze minimaal deze onderwerpen, met de AC's waar ze bij horen:

| Onderwerp | AC's |
| --- | --- |
| Kernflow afvinken en ongedaan maken | AC-094, AC-095 |
| Offline afvinken | AC-098 |
| Tweede gebruiker ziet het | AC-101 |
| Rechten in de interface (reeksacties) | AC-105, AC-120 |
| Uitgezet lid | AC-023 |
| Wachtwoord vergeten | AC-130 |
| Uitloggen wist de lokale data | AC-031 |
| Sheet-URL | AC-089 |
| Isolatie (nieuw account ziet niets van een ander huishouden) | AC-026 |
**Toets:** CI

### AC-168 — Succescriteria meetbaar (WP9; PRODUCT_SPEC §11)
GEGEVEN productie na de release
WANNEER de bouwer de succescriteria controleert
DAN:
- **Criterium 1:** het aandeel vergeten taken wordt met een alleen-lezen query bepaald op dag 30 en op dag 90 na de livegang: (verlopen + overgeslagen) / (alle taken met een geplande dag in die 30 dagen). Beide cijfers staan in `docs/PROGRESS.md`, en de query telt alleen, zonder personen (PRODUCT_SPEC §11.1);
- **Criteria 2 en 5:** het aandeel "op tijd" en de tijd tussen het geplande moment en de melding zijn uit de historie en de tick-tellingen af te lezen;
- **Criterium 7:** de privacytest (AC-035, schema en inhoud) draait in CI.
**Toets:** Proces + Live

### AC-169 — Toegankelijkheid basis (WP9; A-01, A-02, A-03)
GEGEVEN de volledige app
WANNEER de accessibility-review draait
DAN:
- zijn alle interactieve elementen met het toetsenbord te bereiken;
- hebben ze een naam;
- is de kalender zonder slepen te bedienen;
- haalt het contrast van de tekst WCAG AA.
**Toets:** accessibility-review

### AC-235 — Kernflow afvalkalender in de nieuwe schermen (WP9; AC-167)
GEGEVEN de volledige nieuwe interface met de nagebootste gemeentebron
WANNEER de E2E-suite draait
DAN dekt hij:
- aanzetten;
- afvaltaken op Vandaag;
- het detail, en overslaan met ongedaan maken;
- een storing die de beheerder wel en het gezinslid niet ziet;
- uitzetten.

CP4 bevat de afvaltoestanden.
**Toets:** E2E

---

## Dekking

**Harde regels:**

| Regel | AC's |
| --- | --- |
| BR-02 | AC-044, AC-066 |
| BR-08 | AC-118, AC-119, AC-120 |
| BR-09 | AC-006, AC-067, AC-122, AC-123 |
| BR-10 | AC-036, AC-049, AC-097, AC-113, AC-127, AC-155, AC-191 |
| BR-11 | AC-036, AC-037 |
| BR-12 | AC-034, AC-038, AC-039, AC-040, AC-207, AC-212 |
| BR-13 | AC-041, AC-042, AC-095, AC-096, AC-207 |
| BR-14 | AC-106 |
| BR-16 | AC-068 |
| BR-17 | AC-069 |
| BR-18 | AC-116 |
| BR-20 | AC-010, AC-011, AC-080, AC-146, AC-219 |
| BR-22 | AC-001 t/m AC-008, AC-119, AC-120 |
| BR-23 | AC-012, AC-013, AC-014, AC-124 |
| BR-24 | AC-019, AC-020, AC-021, AC-136, AC-141 |
| BR-25 | AC-016, AC-017, AC-018, AC-159, AC-223 |
| BR-26 | AC-026, AC-027, AC-190 |
| BR-30 | AC-063, AC-064 |
| BR-31 | AC-052, AC-070 t/m AC-075, AC-194, AC-203, AC-211 |
| BR-40 | AC-117, AC-206 |
| BR-41 | AC-047, AC-048 |
| BR-42 | AC-050, AC-154 |
| BR-43 | AC-031, AC-133 |
| BR-44 | AC-046 |
| BR-45 | AC-077, AC-078 |
| BR-46 | AC-054 t/m AC-061 |
| BR-47 | AC-186, AC-196 |
| BR-48 | AC-183 t/m AC-189, AC-214, AC-222, AC-237 |
| BR-49 | AC-183, AC-192, AC-193, AC-195, AC-219 |
| BR-50 | AC-183, AC-191, AC-197, AC-203 |
| BR-51 | AC-198 t/m AC-202, AC-221, AC-234 |
| BR-52 | AC-204, AC-205, AC-220, AC-223, AC-233, AC-236, AC-237 |
| BR-53 | AC-207, AC-208, AC-209, AC-219, AC-226, AC-227, AC-229, AC-232 |
| BR-54 | AC-210, AC-225, AC-234 |
| BR-55 | AC-194, AC-205, AC-211 |
| BR-56 | AC-189, AC-213, AC-214, AC-222 |
| BR-57 | AC-215 |
| BR-58 | AC-190, AC-212, AC-216, AC-218 |
| BR-59 | AC-206 |

**Regressie op bevindingen:**

| Bevinding | AC's |
| --- | --- |
| B-01 | AC-001 t/m AC-005, AC-009 |
| B-02 | AC-010 |
| B-03 | AC-016, AC-017, AC-018 |
| B-04 | AC-014, AC-028 |
| B-05 | AC-029 |
| R-01 | AC-063, AC-064 |
| R-02 | AC-065, AC-076 |
| R-03 | AC-049, AC-050 |
| S-01 | AC-081, AC-083 |
| S-02 | AC-150 |
| S-03 | AC-109, AC-126, AC-158, AC-162 |
| S-04 | AC-087 |
| A-01 | AC-104 |
| A-02 | AC-152 |
| A-03 | AC-126, AC-158 |
| P-01 | AC-090 |

**Een geweigerde actie per rol:**
- Gezinslid: AC-001, AC-012, AC-020, AC-048, AC-189 (afvalkalender beheren), AC-190 (adres lezen), AC-208 (afvaltaak wijzigen of verwijderen), AC-219 (zelf een afvaltaak maken).
- Uitgezet lid: AC-022, AC-189.
- Beheerder: AC-014 (de maker wijzigen), AC-019 (de laatste beheerder degraderen), AC-021 (zichzelf uitzetten), AC-208 (een afvaltaak wijzigen, verplaatsen of verwijderen) en AC-219.
- Buitenstaander: AC-026, AC-027, AC-190.

**Verwerkte besluiten van Jurgen (V-30 t/m V-35):**
- AC-056 en AC-061: V-33.
- AC-062 en AC-134: V-34.
- AC-063: V-32.
- AC-091: V-30 en V-31.
- AC-130: V-35.

**Aanvullingen na de plan-critic, ronde 1:**

| Punt van de plan-critic | AC's |
| --- | --- |
| 1 (oude meldingen met namen) | AC-035 (schema en inhoud), AC-058, AC-059 |
| 2 (ontvangers "taak gedaan") | AC-073 (V-38) |
| 5 (naam bij notities) | AC-062, AC-143, AC-178, AC-179 |
| 7 (uitgezette leden op live) | AC-055, AC-170 |
| 9 (wachtrij over een deploy heen) | AC-172 |
| 10 (reeks wijzigen vanuit het reeksdetail) | AC-173 |
| 11 (rechten standaardtaken en huishoudinstellingen) | AC-175, AC-176 |
| 12 (verwijderd uit het huishouden) | AC-177 |
| 16 (aantallen opnieuw tellen) | AC-058 |
| 17 (uitgezet lid verwijdert eigen account) | AC-148 |
| 18 (succescriterium 1 meetbaar) | AC-168 |
| 20 (voorkeuren van gezinsleden) | AC-053 |
| 22 ("Wijzigingen weggooien?" en de teller "nog N te doen") | AC-174, AC-171 |

**Verwerkte besluiten van Jurgen (W-03):**

| Besluit | AC's |
| --- | --- |
| V-41 t/m V-44 | AC-183, AC-192, AC-194, AC-196 |
| V-45 | AC-183, AC-213, AC-216 |
| V-46 | AC-217, AC-224 t/m AC-235 |
| V-47 en V-48 | AC-193, AC-194 |
| V-49 | AC-192, AC-194 |
| V-50 | AC-204, AC-205, AC-211, AC-236 |
| V-51 | AC-195, AC-201 |
| V-52 | AC-197, AC-204, AC-237 |
| V-53 | AC-189, AC-190, AC-205 |
| V-54 | AC-208, AC-209, AC-210 |
| V-55 | AC-193 |
| V-56 | AC-215 |
| V-58 | AC-190, AC-212, AC-213, AC-216, AC-218 |

**Aanvullingen na de plan-critic W-03, ronde 3:**

| Punt van de plan-critic | AC's |
| --- | --- |
| 1 (bovengrens binnenzetten D+7) | AC-210, AC-234 |
| 2 (jaareinde geen storing) | AC-204, AC-205, AC-220, AC-237 |
| 3 (verwijzing T-90b-variant) | AC-183 (b), AC-237 |
| Aanbeveling 8 (kerstbomen tellen niet mee) | AC-196, AC-204, AC-220, AC-237 |
| Aanbeveling 9 (onbekende adrescode) | AC-204 (c), AC-205 |

**Open bij Jurgen:**
Geen. Verwerkt:
- V-36: AC-054, AC-180;
- V-37: AC-181;
- V-38: AC-073;
- V-39: AC-182.
- V-41 t/m V-58 (W-03): zie "Verwerkte besluiten van Jurgen (W-03)".
