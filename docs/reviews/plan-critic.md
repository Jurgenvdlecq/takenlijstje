# Plan-critic — W-03 afvalkalender — ronde 1 — 2026-09-29

> Deze beoordeling gaat alleen over wijzigingsverzoek **W-03 (afvalkalender, WP3b)**. De vorige beoordeling van het hoofdontwerp (ronde 4, 2026-09-28, uitkomst JA) staat in de git-geschiedenis van dit bestand.

Gelezen:
- concepten `docs/wijzigingen/W-03/`: `product-analyst-r2.md` (volledig; BR-47…BR-59, AC-183…AC-219), `product-designer-r1.md` (UX §13), `visual-designer-r1.md` (DS-aanvulling), `solution-architect-r2.md` (TD §18, WP3b-regel, aanvullingen). De r1-concepten van analist en architect heb ik alleen als context gebruikt, via de afwijkingslijsten in r2;
- `docs/PROGRESS.md`: W-03, V-41…V-57, de status van WP3 (nog niet live: planner, geheim en meting staan open) en de uitgestelde punten;
- `docs/DECISIONS.md` D-040…D-045;
- `docs/ACCEPTANCE_CRITERIA.md` (AC-076, AC-138, AC-182 als ankers), `docs/PRODUCT_SPEC.md` (BR-16, §3 "vergeten"), `docs/TECHNICAL_DESIGN.md` §15 (rijen WP4–WP8);
- code: `src/server/system/tick.ts`, `src/server/actions/tasks.ts` (setStatus en move), `src/features/notifications/notifications-page.tsx` (terugvalstijl voor onbekend meldingstype), `src/features/tasks/use-task-actions.ts`, migraties `…0927000100_schema` (`task_comments` → `on delete cascade`), `…0928000210_scope_contract` (huidige `guard_task_changes`), en de `update public.tasks`-plekken in alle RPC's;
- screenshots (met Read bekeken): `docs/screenshots/prototype/w03-01` t/m `w03-06` en `w03-05-…-donker`.

## Bevindingen

1. [MOET VÓÓR BOUW WORDEN OPGELOST] TD §18.1.6 en §18.16 (U0), PRODUCT_SPEC §9: de bron is nooit gezien, maar de probe staat pas vóór de livegang gepland.
   Wat er vastligt zonder dat iemand het gezien heeft: het koppelcontract (endpoints A/B/C, veldnamen, iconnamen als `zak-grijs-rest`), het BAG-formaat (als `CHECK` in de database), het gedrag van J+1, en de gemeenteregels 22:00/07:45 (alleen via zoekresultaten, analist punt 7). In U0 wordt dit pas gecontroleerd als alle migraties, de UI en de tests al af zijn. Verder klopt TD §18.1.6 route (b) nu niet: "pg_net staat daar sinds WP3" is nog niet waar, want WP3 is niet live en `planner.sql` is nog niet uitgevoerd (PROGRESS). Niemand heeft ook gecontroleerd of de site verzoeken uit een datacenter (Vercel `fra1`) toelaat.
   Gevolg: blijkt bij U0 dat de API anders werkt, dat datacenter-IP's geblokkeerd worden, of dat `robots.txt` of de voorwaarden `/rest/` uitsluiten, dan is heel WP3b voor niets gebouwd. Het bevroren TD klopt dan niet meer, en een wijzigingsverzoek plus een nieuwe freeze volgt. Wijkt de 07:45-regel af, dan staan in bevroren BR's, AC's, teksten en DB-velden verkeerde tijden.
   Nodig:
   - De probe wordt **stap 0 van WP3b, vóór migraties en UI**, en bij voorkeur al vóór `/design-go` als Jurgen de allowlist van V-57 zet. Leg dit zo vast in TD §18.1.6 en in de WP3b-regel van §15, niet alleen in U0.
   - Voeg aan de probe toe: de gemeenteregel (22:00/07:45, minicontainers) op de pagina zelf, en een verzoek vanuit een datacenter (pg_net zodra WP3 live is, of een preview-functie) om blokkade uit te sluiten.
   - Corrigeer de pg_net-zin: route (b) kan pas nadat WP3 live is.
   - Leg vooraf vast welke afwijkingen een uitvoeringskeuze zijn (in `DECISIONS.md`: veldnamen, iconnamen, BAG-regex, J+1-gedrag) en welke een wijzigingsverzoek (een andere adresflow, geen JSON-API, andere tijden, blokkade of verbod: dan stoppen en naar Jurgen).

2. [MOET VÓÓR BOUW WORDEN OPGELOST] PRODUCT_SPEC BR-49 (voorbeeld "Restafval, papier en PMD binnenzetten"), AC-193 ("Restafval binnenzetten"), AC-195 ("Restafval en papier binnenzetten") tegenover UX §13.3 en TD §18.4.1 ("Restafvalbak binnenzetten", "Restafval- en papierbak binnenzetten", "Restafval-, papier- en PMD-bak binnenzetten").
   Gevolg: de bevroren documenten spreken elkaar tegen over een exacte, toetsbare string. De test-writer toetst tegen de AC's en keurt dan de UX-namen af, of andersom. De architect meldde dit zelf (punt 2), maar de analist heeft het nog niet verwerkt. De `[AANNAME]` in PRODUCT_SPEC §13 ("de precieze woorden kiest de product-designer") staat er ook nog.
   Nodig: de analist trekt BR-49, AC-193 en AC-195 gelijk met UX §13.3 (of verwijst ernaar), en haalt de aanname uit §13 weg of markeert hem als opgelost.

3. [MOET VÓÓR BOUW WORDEN OPGELOST] Letterlijke teksten in de AC's en BR's wijken af van UX §13.
   - AC-188 en BR-48 eisen letterlijk "De huisvuilkalender is nu niet bereikbaar. Probeer het later opnieuw." UX §13.7.1 en toestand F zeggen "De huisvuilkalender van de gemeente is nu niet bereikbaar. Er is niets opgeslagen. Probeer het over een paar minuten opnieuw."
   - AC-205 en BR-52 zeggen "Afvalkalender niet bijgewerkt sinds <datum>". UX H en DS §7.13.4 zeggen "Niet bijgewerkt sinds za 26 sep".
   - BR-52 citeert de meldingstekst "… Kijk voor de zekerheid zelf op de site van de gemeente." UX §13.10 heeft een andere tekst, met twee varianten.
   Gevolg: tests op de AC's slagen niet tegen de ontworpen UI. Of de bouwer kiest stil een van beide, en dan wijkt de code af van een bevroren document.
   Nodig: de AC's en BR's verwijzen voor exacte teksten naar UX §13.7/§13.10, of nemen die tekst letterlijk over. Eén bron per tekst.

4. [MOET VÓÓR BOUW WORDEN OPGELOST] UX §13 is nog niet gelijkgetrokken met de visuele en technische ronde. Er zijn nieuwe teksten en toestanden zonder bevestiging van de product-designer.
   - **"morgen" of "di 6 okt":** binnenzetten op D−1 in Binnenkort toont in UX §13.14 "di 6 okt", in DS §7.13.3 en screenshot w03-03 "morgen". De tabel in UX §13.4 heeft voor dit moment geen rij.
   - **D en F:** in UX §13.14 zien D en F er hetzelfde uit (ⓘ). In DS §7.13.4 is D een regel in `overdue` en F een `sunken`-balk. De oude-UI-tekst van de visual-designer (punt 5.2) geeft D "de foutstijl van Field/Input", terwijl DS §7.13.4 zegt: "zonder rode rand om de velden".
   - **Voorstelteksten:** "Zo kent de gemeente jullie adres." en "Iedereen in het huishouden ziet de taken; het adres zien alleen beheerders." (staat al in screenshot w03-02).
   - **Toestand `no_upcoming`** (instellen eind december) ontbreekt in UX §13.8. De architect koppelt hem aan F met een eigen tekst (TD §18.11).
   - **Toast `too_soon`** en de terugkoppeling na "Opnieuw proberen" (gelukt / lukt nog steeds niet) staan niet in UX.
   - **De balk H heeft één tekst** ("De gemeente-site gaf geen antwoord"). Die klopt niet voor `SUSPECT_EMPTY`, `FORMAT` en `ADDRESS_GONE`. Bij `ADDRESS_GONE` moet de beheerder juist het adres controleren.
   - **Omschrijvingen uit TD §18.4.2** zijn nieuwe teksten die de UI toont. "Binnenzetten vanaf 12:00, uiterlijk vandaag." is feitelijk onjuist als de taak op D−1 (Binnenkort) of op D+1 (Verlopen) wordt gelezen. In de oude UI verschijnt de omschrijving ook naast de infolijst uit UX §13.6, dus dubbel.
   Gevolg: in de oude UI (die live gaat) kiest de bouwer zelf, en de nieuwe UI in WP5–WP7 wijkt daar later van af. Niveau 2 eist voor elke toestand een vastgelegd beeld.
   Nodig: een korte ronde van de product-designer die deze punten in UX §13 vastlegt: rij in §13.4, toestanden in §13.8, teksten per foutoorzaak, en de omschrijvingstekst (bijvoorbeeld "uiterlijk einde van de ophaaldag", en of die in de oude UI naast de infolijst staat).

5. [MOET VÓÓR BOUW WORDEN OPGELOST] UX §13 verwijst nog naar de AC-nummers van analist-ronde 1. In r2 is alles vanaf AC-188 verschoven.
   Voorbeelden: §13.7.1 "Twee keer tikken … (BR-50, AC-190)" moet AC-191 zijn; §13.7.2 "(AC-211)" → AC-214; §13.7.3 "(AC-210)" → AC-213; §13.7.5 "(AC-203)" → AC-205; §13.10 "(BR-58, AC-209)" → AC-212; §13.13 "(AC-192)" → AC-193.
   Gevolg: na de freeze wijzen die verwijzingen naar het verkeerde criterium. AC-190 gaat bijvoorbeeld over wie het adres ziet, niet over dubbel tikken. Dat verwart test-writer en reviewers.
   Nodig: alle AC-verwijzingen in UX §13 omzetten naar de r2-nummering.

6. [MOET VÓÓR BOUW WORDEN OPGELOST] TD §18.8.2 / §18.7 (`waste_sync`) tegenover BR-51 en BR-53: een verschoven ophaaldag wordt "verwijderen + opnieuw aanmaken".
   `task_comments` hangt met `on delete cascade` aan `tasks` (`…0927000100_schema`, regel 359). Bij een verschuiving door een feestdag verdwijnen dus stil de notities bij de open afvaltaak, en de stand "bezig" gaat verloren. BR-51 zegt dat de taken "meeschuiven", en BR-53 staat notities uitdrukkelijk toe. AC-198 toetst alleen de datums.
   Gevolg: stil dataverlies van wat een gezinslid schreef ("bak is kapot, nieuwe aangevraagd"), precies rond de feestdagen.
   Nodig: kies en leg vast.
   - (a) Verschuiven als update van dezelfde open rij: `waste_pickup_date`, `scheduled_date`, `available_from` en `due_at` gaan mee, alleen als de doelsleutel vrij is. Anders geldt de huidige regel.
   - (b) Of de spec zegt expliciet dat notities en "bezig" bij een verschuiving vervallen.

   Voorkeur (a). Breid AC-198 uit met "notitie en bezig blijven".

7. [MOET VÓÓR BOUW WORDEN OPGELOST] BR-52 en AC-204 ("volledig leeg antwoord … terwijl er eerder ophaaldagen in dat bereik bekend waren") tegenover TD §18.8.4 (`isSuspectEmpty` = alle drie samen leeg in het venster, zonder die voorwaarde).
   Letterlijk toegepast werkt de spec-regel juist bij het eigen voorbeeld niet. Op 1 januari staan in de bewaarde datums geen januaridagen, dus waren er "eerder geen ophaaldagen in dat bereik bekend", en is er volgens de tekst geen storing. De architect laat de voorwaarde daarom vallen ("structureel waar"), maar de spec en de AC zeggen nog iets anders.
   Daarnaast telt de regel `failure_count ≥ 2` (TD §18.8.5) opeenvolgende mislukkingen van élke soort. Eén `UNREACHABLE` gevolgd door één leeg antwoord geeft dus al een alarm, terwijl de bedoeling "twee lege antwoorden, minstens een uur uit elkaar" is.
   Gevolg: de test-writer kan AC-204 niet eenduidig toetsen, en er kan een onterecht of te vroeg alarm komen.
   Nodig:
   - BR-52 en AC-204 gelijktrekken met de TD-regel: alle drie samen leeg in [vandaag, vandaag + 14] = verdacht, twee keer achter elkaar met minstens een uur ertussen = storing;
   - in TD tellen hoe vaak `SUSPECT_EMPTY` achter elkaar voorkomt, bijvoorbeeld door `failure_count` bij een andere foutcode terug te zetten naar 1.

8. [MOET VÓÓR BOUW WORDEN OPGELOST] TD §15 (rijen WP4–WP8) en ACCEPTANCE_CRITERIA: de W-03-onderdelen voor de nieuwe UI staan alleen in TD §18.14 en UX §13.13. Ze staan niet in de werkpakketregels en hebben geen criteria.
   Het gaat om:
   - WP4: de expliciete kolomlijst van de snapshot, met `waste_*`;
   - WP5: rij en detail;
   - WP6: informatierij in Taken › Terugkerend, en `?bewerk=<id>` → detail;
   - WP7: subpagina, en doorsturen vanaf `/instellingen#afvalkalender`;
   - WP8: slepen uit, meldingenlijst, en in het Overzicht de groepering "Afval buitenzetten" / "Bakken binnenzetten".

   AC-217 zegt alleen: "in de nieuwe schermen moet hetzelfde kunnen".
   Gevolg: bij WP4–WP8 leest de bouwer de WP-regel en de AC's van dat WP. Afvaltaken zijn dan makkelijk te vergeten. Zonder expliciete kolomlijst zijn de afvalkenmerken in de nieuwe UI bijvoorbeeld onzichtbaar, en een oude storingsmelding linkt naar een anker dat niet meer bestaat. De reviewers hebben voor deze onderdelen niets om tegen te toetsen.
   Nodig: in TD §15 bij WP4–WP8 een W-03-regel toevoegen, en per onderdeel een criterium (AC-220 en verder, of aanvullingen op de WP5–WP8-criteria).

9. [MOET VÓÓR BOUW WORDEN OPGELOST] TD §15, WP3b-regel: "geen formeel CP … zelf bekeken" en geen ux-reviewer of visual-qa.
   WP3b zet een **nieuwe flow** live voor het gezin, in de oude UI, die de visual-designer alleen in tekst heeft beschreven (DS-aanvulling punt 5). Het prototype toont de nieuwe UI. Het taakdetail van een afvaltaak, de sheet "uitzetten", toestand J en de oude-UI-varianten zijn nergens op beeld beoordeeld. De werkwijze (§5 en §9, niveau 2) vraagt visual-qa op elk screenshot-checkpoint en ux-review van een kernflow.
   Gevolg: er gaat een ongereviewde UI live. Het precedent van WP2a gold voor het weghalen van onderdelen, niet voor een nieuwe flow.
   Nodig:
   - neem in de WP3b-regel op dat de rook-screenshots (A, B, C, C2, D, E, F, G, H, I, J, Vandaag met buiten en binnen, taakdetail, overslaan-toast) vóór U3 door visual-qa en de ux-reviewer (licht) worden beoordeeld;
   - noem ze als checkpoint in PROGRESS.

10. [AANBEVELING] TD §18.16 "Terugrollen": na een Vercel-rollback naar de code van vóór WP3b ziet de oude tick afvaltaken als gewone taken.
    Omdat `due_at` gezet is, verstuurt hij dan "deadline nadert" (bij buitenzetten rond 05:45) en "verlopen". Dat is precies wat V-50 uitsluit.
    Voorstel: bij een rollback die langer duurt dan een paar uur ook de afvalkalender uitzetten (of de open afvaltaken verwijderen). Neem dat als stap op in het terugrolplan.

11. [AANBEVELING] TD §18.8.3: eén ophaling per dag, rond 06:00.
    Verschuift de gemeente overdag een ophaaldag naar morgen, dan komt de buitenzet-taak pas de volgende ochtend. Dat is te laat voor 21:00. BR-51 (24 uur) laat dat toe, maar het doel is juist "niet vergeten".
    Voorstel: een tweede dagelijkse ophaling rond 17:00–18:00. Dat kost 2–3 GET's.

12. [AANBEVELING] TD §18.8.4, punt 5 van de architect: in december, als het venster al in januari valt en C(J+1) leeg is of 404 geeft, ontbreken de januaritaken stil tot het hele venster leeg is.
    Voorstel: in dat geval de stille regel "retrying" tonen ("kalender volgend jaar nog niet beschikbaar"), zodat de beheerder dat vóór de eerste januari-ophaaldag ziet.

13. [AANBEVELING] UX §13.6, infolijst "Herinnering: ma 5 okt 21:00": voor wie "Herinneringen" uit heeft (standaard Lynn en Kai) belooft dit iets dat niet komt.
    Voorstel: de regel alleen tonen als de eigen instelling aan staat, of er "(als herinneringen aan staan)" bij zetten.

14. [AANBEVELING] TD §18.6 `confirmWasteAddressAction`: is het adres gelijk aan het bewaarde, dan loopt het via `syncHousehold`, met de claim van 60 s. Een bevestiging vlak na een tick of na "Opnieuw proberen" krijgt dan geen claim.
    Voorstel: vastleggen dat de beheerder dan gewoon "opgeslagen" ziet (er verandert niets). Anders ziet hij onterecht "te snel".

15. [AANBEVELING] TD §18.12 (voor de security-review van WP3b):
    - controleren of Vercel Observability uitgaande verzoeken met het volledige pad bewaart (dat pad bevat de postcode en het huisnummer bij endpoint A);
    - `net._http_response` na een pg_net-probe leegmaken.

16. [AANBEVELING] Voor het totaalvoorstel aan Jurgen, in gewone taal, expliciet noemen:
    - dat de bron een onofficiële, ongedocumenteerde koppeling is die zonder aankondiging kan wegvallen;
    - dat naast postcode en huisnummer ook de adrescode van de gemeente (BAG-id) wordt bewaard;
    - de interpretaties die hij niet letterlijk besliste: overslaan van buitenzetten slaat ook binnenzetten over; binnenzetten vervalt vanzelf; een aanhoudend leeg antwoord geeft al na ruim een uur een melding, niet pas na 48 uur;
    - dat er dubbele taken staan tot hij zijn eigen reeks stopt.

17. [AANBEVELING] UX §13.7.3: de sheet "uitzetten" noemt "(4 taken)". Vastleggen wat er staat bij 0 open taken: de zin weglaten, in plaats van "(0 taken)".

## Opgelost sinds vorige ronde
- Eerste ronde voor W-03. De tegenstrijdigheden tussen analist-r1 en architect-r1 zijn in r2 aantoonbaar rechtgetrokken (TD §18.17):
  - sleutel per huishouden, datum en richting;
  - adres alleen voor beheerders (RLS `is_admin` plus `waste_calendar_enabled()`);
  - niets bewaren bij een onbereikbare bron;
  - lege-antwoordbewaking over de drie bakken samen;
  - niemand wijzigt of verwijdert een afvaltaak (guard, policies, `delete_task`);
  - 18:00-herinnering, storingsmeldingstype en automatisch vervallen.
- Wat ik nagelopen heb en in orde vind:
  - de guard-uitbreiding past bij de bestaande `complete_task`/`undo_complete_task`: die raken alleen `status` en `completed_at`;
  - `setTaskStatusAction` wijzigt alleen `status`;
  - een onbekend meldingstype valt in de oude UI terug op een standaardstijl, dus een rollback breekt de meldingenlijst niet;
  - de tickstap zit binnen het pushbudget, omdat de deadline absoluut vanaf de start van de tick loopt;
  - SSRF-maatregelen (vaste host, `redirect: "error"`, override alleen loopback);
  - idempotentie via unieke sleutel, `version`, claim en dedupe-sleutel.

## Onbevestigde aannames
- **Koppelcontract en bereikbaarheid van huisvuilkalender.denhaag.nl** (endpoints, velden, iconen, BAG-formaat, J+1-gedrag, geen blokkade van datacenter-IP's, `robots.txt`/voorwaarden) — raakt: **scope** (haalbaarheid van de hele functie) en **gegevens** (wat er naar buiten gaat en wat bewaard wordt). Wordt pas opgeheven door de probe (bevinding 1).
- **Gemeenteregels 22:00 en 07:45 voor minicontainers**, alleen via zoekresultaten gezien — raakt: UX en de businessregels (tijden in BR-49, AC-192, DB-velden).
- **Adrescode (BAG-id) bewaren naast postcode en huisnummer.** V-45 noemt alleen postcode en huisnummer. Inhoudelijk is het gelijkwaardig, maar het is een extra bewaard persoonsgegeven — raakt: **gegevens**. Laten bevestigen in het totaalvoorstel (bevinding 16).
- **Interpretaties van de analist** (overslaan werkt door naar binnenzetten, binnenzetten vervalt vanzelf, alarm bij een aanhoudend leeg antwoord los van de 48 uur) — raakt: UX. Geen rechten, gegevens of scope, maar wel noemen in het totaalvoorstel.
- **"pg_net staat live sinds WP3"** (TD §18.1.6) — nu onjuist, want WP3 is nog niet live. Raakt: de uitvoerbaarheid van probe-route (b).

## Conclusie
Geen blokkerende fouten: het rechtenmodel, de privacy, SSRF en idempotentie zijn degelijk en sluiten aan op de bestaande code. Er staan wel negen moet-punten open: tegenstrijdige teksten en namen tussen analist, designer en architect, verouderde AC-verwijzingen, stil verlies van notities bij een verschuiving, geen W-03-criteria voor WP4–WP8, geen visual-qa of ux-review op de oude UI die live gaat, en een externe bron die pas na het bouwen gecontroleerd wordt. Daarnaast raakt een onbevestigde aanname scope en gegevens.

DESIGN FREEZE MOGELIJK: NEE
