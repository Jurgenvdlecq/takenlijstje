# Plan-critic — ronde 1 — 2026-09-28

Gelezen: `docs/PROGRESS.md` (besluiten en antwoorden V-01…V-35), `docs/INVENTARIS.md` (incl. §8), `docs/PRODUCT_SPEC.md` (ronde 3), `docs/UX_SPEC.md` (ronde 4), `docs/DESIGN_SYSTEM.md` (ronde 1), `docs/TECHNICAL_DESIGN.md` (ronde 1/2), `docs/ACCEPTANCE_CRITERIA.md` (ronde 1, AC-001…AC-169).
Screenshots bekeken: `vis-01-vandaag`, `vis-03-nieuwe-taak`, `vis-04-taakdetail`, `vis-06-boodschappen`, `vis-09-componenten`, `wf-01-vandaag`, `wf-06-taken-terugkerend`, `wf-10b-taakdetail-menu`, `wf-14-instellingen`, `wf-16-gezinsleden`.
Code getoetst: `supabase/migrations/20260927000100_schema.sql`, `…0200_rls.sql`, `…0300_functions.sql` (`complete_task`, `undo_complete_task`), `src/server/actions/tasks.ts`, `src/server/services/scheduling.ts`, `src/features/household/store.tsx` (outbox), `src/domain/reminders.ts`.

Algemeen oordeel: het plan is grondig, de besluiten van Jurgen zijn op bijna alle plekken correct verwerkt, B-01 wordt structureel opgelost (RPC's + `expectRows`), het draaiboek voor de onomkeerbare migratie (M0–M8, letterlijk "ja, wissen" bij M5) is sterk en het visuele ontwerp is specifiek en onderbouwd (geen generieke look; prototype volgt de wireframes). De bevindingen hieronder zijn gaten en tegenstrijdigheden die na de freeze niet meer in de bevroren documenten te herstellen zijn, en drie punten die alleen Jurgen kan beslissen.

## Bevindingen

1. [MOET VÓÓR BOUW WORDEN OPGELOST] PRODUCT_SPEC BR-46.3 en TECHNICAL_DESIGN §12.4 ("Wat blijft: meldingen van soorten die blijven") — Bestaande meldingen van het type `task_completed` bevatten letterlijk wie afvinkte: `src/server/actions/tasks.ts:74` schrijft `"“<taak>” is gedaan door <naam>"` in `notifications.title`. Het draaiboek bewaart deze soort. Hetzelfde geldt, minder ernstig, voor dagoverzichten met "Waarvan N voor jou" (`src/domain/reminders.ts:133`), een afgeleide van toewijzing.
   Gevolg: na M6 staat in de live database nog tot 90 dagen per huisgenoot wie wat deed. Dat is in strijd met V-21 ("de app houdt niet bij wie iets deed") en met succescriterium 7. De controles van M6/AC-059 en de privacytest AC-035 (die alleen kolommen controleert) zien dit niet. Het overzicht "exacte aantallen die verdwijnen" dat Jurgen bij M5 krijgt, is dan onvolledig.
   Nodig: BR-46.3 en §12.4 uitbreiden met "bestaande meldingen `task_completed` (en dag-/avondoverzichten met 'voor jou'/'jouw naam') wissen", dit meenemen in de M2-tellingen en M5-tekst, en AC-059 aanvullen met een inhoudscontrole (geen meldingstitel/-tekst met "door <naam>").

2. [MOET VÓÓR BOUW WORDEN OPGELOST] PRODUCT_SPEC BR-31 ("Taak gedaan … niet naar degene die op dat moment afvinkte"), TECHNICAL_DESIGN WP3, ACCEPTANCE_CRITERIA AC-073 — De ontvangerslijst zelf verraadt wie afvinkte. Staat "taak gedaan" bij Ellen en Jurgen aan en krijgt alleen Jurgen de rij in `notifications`, dan staat in de database (90 dagen) dat Ellen het deed.
   Gevolg: de regel "de app registreert niet wie afvinkte, ook niet onzichtbaar" (PRODUCT_SPEC §0) wordt door een andere regel in hetzelfde document gebroken. AC-073 dwingt het lek zelfs af.
   Nodig: vraag voor Jurgen, zie V-38. Pas daarna BR-31, AC-073 en de dispatcher-beschrijving aanpassen.

3. [MOET VÓÓR BOUW WORDEN OPGELOST] PRODUCT_SPEC BR-12 ("Ook niet in logs") en §8 ("Bewust niet opgeslagen: invoer of persoonsgegevens in logs") — `complete_task` wordt met de JWT van de gebruiker aangeroepen. De API-logs van Supabase (en de requestlogs van Vercel) leggen per aanroep vast welke gebruiker `rpc/complete_task` aanriep en wanneer. De app beheert die platformlogs niet.
   Gevolg: de specificatie belooft iets wat niet waar te maken en niet te toetsen is. Een reviewer of Jurgen kan later terecht zeggen dat de belofte gebroken is.
   Nodig: BR-12 en §8 eerlijk formuleren: "de app zelf slaat dit nergens op, ook niet in eigen logs; de toegangslogs van Supabase en Vercel bevatten kortdurend (dagen) welke gebruiker een aanroep deed". Noem dit in het totaalvoorstel aan Jurgen. Geen extra techniek nodig.

4. [MOET VÓÓR BOUW WORDEN OPGELOST] TECHNICAL_DESIGN §5.2 tegenover §6.1 — Volgens §5.2 maakt `guard_task_changes` `recurrence_id` en `occurrence_date` onveranderlijk. Volgens §6.1 zet `updateTaskAction` ("losse taak wordt terugkerend") juist `recurrence_id` en `occurrence_date` op een bestaande taak.
   Gevolg: AC-125 kan niet slagen, of de bouwer versoepelt de guard naar eigen inzicht, wat een securityrelevante keuze is.
   Nodig: in §5.2 de uitzondering vastleggen, bijvoorbeeld "alleen van `null` naar een waarde, eenmalig, via een RPC die `can_create_tasks` controleert en nagaat dat de reeks bij hetzelfde huishouden hoort", of deze route via een RPC laten lopen.

5. [MOET VÓÓR BOUW WORDEN OPGELOST] TECHNICAL_DESIGN §3.1 (`task_comments.author_name` als momentopname, "De UI toont `author_name`") tegenover ACCEPTANCE_CRITERIA AC-143 ("huisgenoten zien de nieuwe naam bij notities") — Wijzigt Kai zijn naam, dan tonen zijn oude notities volgens het TD de oude naam. Volgens AC-143 moet de nieuwe naam verschijnen.
   Gevolg: een test faalt, of de bouwer kiest stil een gedrag.
   Nodig: één regel vastleggen, bijvoorbeeld "bestaat het lid nog (`member_id` niet leeg), dan de actuele `display_name`, anders `author_name`". Dat past bij V-34. Leg ook vast dat de trigger `author_name` altijd zelf zet (invoer van de client negeren) en dat de kolom niet te wijzigen is. Anders kan iemand een notitie onder een andere naam plaatsen.

6. [MOET VÓÓR BOUW WORDEN OPGELOST] TECHNICAL_DESIGN §12.4, volgorde M1/M2 — De partiële unieke index "één actieve boodschappenlijst per huishouden" zit in `…_200_scope_expand` (M1). De voorcontrole daarop (M2c) draait pas ná M1.
   Gevolg: heeft live meer dan één actieve lijst, dan faalt `…_200` op productie tijdens de deploy van WP2, zonder de nette stop-en-voorleggen-route die M2 belooft.
   Nodig: M2c (en voor de zekerheid alle alleen-lezen-controles) vóór M1 uitvoeren, of de index naar `…_210` verplaatsen. Voeg bij deze voorcontroles ook toe: "leden met `is_active = false` en een account", zie punt 7.

7. [MOET VÓÓR BOUW WORDEN OPGELOST] TECHNICAL_DESIGN WP1 (`…_100`: `is_member`/`my_member_id` eisen `is_active`) — In de huidige database beperkt `is_active` de toegang niet: in `…0200_rls.sql` komt het alleen voor in de guard. Staat bij een lid met account op live `is_active = false`, dan verliest dat lid bij de deploy van WP1 ongemerkt alle toegang.
   Gevolg: een gezinslid (mogelijk Lynn of Kai) staat plots voor "Geen toegang", zonder dat Jurgen dat besloot.
   Nodig: vóór WP1 op live een alleen-lezen-telling. Is die groter dan 0, dan eerst aan Jurgen voorleggen. Leg dit als stap vast in §12.3 of WP1.

8. [MOET VÓÓR BOUW WORDEN OPGELOST] TECHNICAL_DESIGN §12.3 ("per WP deployen") tegenover DESIGN_SYSTEM §4 ("oude shadcn-namen in één keer vervangen, niet naast elkaar") en WP4–WP8 — WP4 vervangt alle tokens, maar Taken, Kalender, Boodschappen, Instellingen en het oude Huishouden-scherm worden pas in WP5–WP8 herbouwd. WP4 haalt Huishouden ook al uit de onderbalk, terwijl `/overzicht` pas in WP8 komt.
   Gevolg: wordt WP4 live gezet zoals §12.3 voorschrijft, dan gebruikt het gezin wekenlang een app met deels ongestylede schermen en een onbereikbaar overzicht. Wordt het niet live gezet, dan klopt §12.3 niet en ontbreekt de strategie (branch, gezamenlijke release) in het plan.
   Nodig: in §12.3/§15 expliciet vastleggen welke WP's direct live gaan en welke samen. Mijn lezing: WP1–WP3 direct, WP4–WP9 samen. Jurgen moet weten hoe de app er in de tussentijd uitziet, zie V-36.

9. [MOET VÓÓR BOUW WORDEN OPGELOST] TECHNICAL_DESIGN §9.3 (outbox) en §12.3 (deploys) — De wachtrij verstuurt via server actions (`store.tsx` `sendMutation`). Na elke deploy heeft een open PWA met de oude JS-bundel verouderde action-id's en payloadvormen. Na WP2 gaat het ook om soorten die niet meer bestaan (toewijzen, ruilen, `completedBy`). De huidige flush behandelt elke niet-netwerkfout als "kon niet worden verwerkt" en gooit de entry weg (`store.tsx:119-124`).
   Gevolg: offline afvinkingen van gezinsleden kunnen na een van de ongeveer negen deploys stil verloren gaan. Dat is dataverlies van gebruikersacties in de kernflow.
   Nodig: in §9.3 een versie-aanpak vastleggen, bijvoorbeeld een versienummer in outbox-entries, vóór het flushen herladen als de build veranderd is, en "action niet gevonden" behandelen als "opnieuw proberen na herladen" in plaats van weggooien. Voeg een AC toe: "offline afgevinkt vóór een deploy, online ná de deploy → precies één registratie".

10. [MOET VÓÓR BOUW WORDEN OPGELOST] UX_SPEC §5.2 (reeksdetail "acties Wijzigen …") tegenover TECHNICAL_DESIGN §6.1 — Er is geen actie om een reeks vanuit het reeksdetail te wijzigen. `updateTaskAction` scope `future` vraagt een `taskId`. Voor een gepauzeerde reeks, of een reeks zonder open uitvoering, is er dan geen route. Er is ook geen wireframe van het reeksdetail.
    Gevolg: de bouwer verzint een actie met rechtencontrole, of de knop werkt niet.
    Nodig: `updateSeriesAction` (of een RPC) toevoegen met dezelfde autorisatie en volgorde als "future", plus een AC ("reeks wijzigen vanuit Taken › Terugkerend, met en zonder recht").

11. [MOET VÓÓR BOUW WORDEN OPGELOST] ACCEPTANCE_CRITERIA — Harde rechtenregels uit PRODUCT_SPEC §7 zonder GEGEVEN/WANNEER/DAN:
    - "Eigen standaardtaken beheren: alleen beheerder" (`saveTemplateAction`/`deleteTemplateAction`);
    - "Huishoudinstellingen (naam, tijdzone, 'gezinsleden mogen taken maken'): gezinslid nee". AC-146 test alleen het effect, niet dat Lynn de instelling zelf niet kan omzetten;
    - "Lid verwijderen": wat de verwijderde persoon daarna ziet (zie punt 12).

    Gevolg: juist de route waarmee een gezinslid zichzelf aanmaakrecht zou kunnen geven, heeft geen test.
    Nodig: AC's toevoegen, met DB- en Int-toets per regel (positief en negatief).

12. [MOET VÓÓR BOUW WORDEN OPGELOST] UX_SPEC §4.15/§7 en TECHNICAL_DESIGN §4.6 — De state "je bent uit het huishouden verwijderd" of "het huishouden is verwijderd" ontbreekt voor de getroffen persoon. Volgens het TD komt die persoon in `/onboarding`, dus zonder uitleg in "Nieuw huishouden starten". Voor Kai (13) of Ellen is dat verwarrend, en hij kan zo per ongeluk een eigen huishouden aanmaken.
    Gevolg: onbegrijpelijk foutpad voor een gezinslid, niet te toetsen.
    Nodig: in UX §4.15/§8 één scherm of melding vastleggen ("Je hoort niet meer bij 'Familie'. Vraag een nieuwe uitnodiging." met Uitloggen, en pas daarna de keuze voor een nieuw huishouden), plus een AC.

13. [MOET VÓÓR BOUW WORDEN OPGELOST] UX_SPEC §7 (rij Taakdetail, kolom Offline: "afvinken/terugzetten/bezig werken; overige acties uitgeschakeld") tegenover TECHNICAL_DESIGN §9.3 (offline ook overslaan en verplaatsen) — Twee bevroren documenten zeggen straks iets anders over "Naar morgen" en "Deze keer overslaan" zonder verbinding.
    Gevolg: na de freeze kan dit alleen via een wijzigingsverzoek worden rechtgezet.
    Nodig: UX §7 gelijktrekken met TD §9.3.

14. [MOET VÓÓR BOUW WORDEN OPGELOST] UX_SPEC §0.4 en §4.5 tegenover het overgenomen besluit "wijzigen … kost maximaal twee tikken" (INVENTARIS §2, bindend via V-02) — De UX laat een titel wijzigen bewust 4 tot 5 tikken kosten. De reden staat erbij, maar Jurgen heeft deze afwijking niet bevestigd. Werkwijze §11: "besluiten worden nooit stil opnieuw geïnterpreteerd".
    Gevolg: een bindend besluit wordt zonder akkoord losgelaten.
    Nodig: vraag voor Jurgen, zie V-37.

15. [AANBEVELING] TECHNICAL_DESIGN §15, WP2 — WP2 bundelt veel: code uit het hele systeem halen, de expand-migratie, deployen, back-up, restore-test, wachten op Jurgens "ja, wissen" en de contract-migratie. Splits het in WP2a (code + expand + deploy) en WP2b (M2–M8). Het wachten op Jurgen houdt dan geen reviewronde of WP3 tegen. Overweeg ook de planner (WP3, R-01, de kern van "minder vergeten") niet van het wissen afhankelijk te maken. Hij heeft alleen WP2a nodig.

16. [AANBEVELING] TECHNICAL_DESIGN §12.4 M5/M6 — De aantallen uit M2 kunnen tot M5 veranderen, omdat het gezin de app blijft gebruiken. Draai de tellingen opnieuw direct vóór M5, en voer M6 uit in dezelfde sessie als Jurgens "ja, wissen".

17. [AANBEVELING] TECHNICAL_DESIGN §4.5 (`delete_my_account`) — Een uitgezet lid mag volgens §5.2 zijn eigen account verwijderen (en de knop staat op `/geen-toegang`), maar `private.my_member_id()` geeft na WP1 voor hem `null`. Leg vast dat deze RPC `is_my_member`/`user_id = auth.uid()` gebruikt. AC-148 vangt het in E2E, maar beter vooraf eenduidig.

18. [AANBEVELING] PRODUCT_SPEC §11.1 en AC-168 — "Maand 3 lager dan maand 1, te zien in het Huishouden-overzicht" is niet af te lezen: het Overzicht toont maximaal 30 dagen. Leg vast dat de bouwer op dag 30 na livegang het cijfer van maand 1 in PROGRESS noteert, of dat het met een alleen-lezen query wordt bepaald.

19. [AANBEVELING] PRODUCT_SPEC UC-12 / TECHNICAL_DESIGN — De tijdzone van het huishouden kan worden gewijzigd, maar wat er met bestaande `due_at`-tijden van open taken gebeurt, staat nergens. Voor één gezin in Amsterdam: overweeg het veld alleen-lezen te maken (minder scope), of leg het gedrag vast.

20. [AANBEVELING] TECHNICAL_DESIGN §3.3 / AC-053 — De migratie zet de meldingsvoorkeuren van bestaande gezinsleden (met account) uit, ook als zij die zelf hadden aangezet. Dat volgt uit V-23, maar noem het expliciet in het totaalvoorstel, zodat Lynn en Kai niet ongemerkt geen herinneringen meer krijgen.

21. [AANBEVELING] Documenthygiëne:
    - `docs/PROGRESS.md`: de tabel Work packages staat nog op "Nog te bepalen" en het veld "Fase" loopt achter.
    - `docs/INVENTARIS.md` §2: toont Verdeling, Ruilen en punten nog als geldend besluit. Markeer die als vervangen door V-21/V-22/V-24.
    - `docs/INVENTARIS.md` §8 zegt "Behouden: snelle invoer", terwijl de invoerbalk vervalt en alleen de parser blijft.
    - TECHNICAL_DESIGN verwijst naar "UX_SPEC ronde 2".
    - DESIGN_SYSTEM §3 noemt nog `next/font/google` als optie, terwijl V-31 lokaal hosten vastlegt.
    - `wf-01` toont "nog 4 te doen", `vis-01` "nog 5". Volgens UX §5.1 is 5 juist.

22. [AANBEVELING] ACCEPTANCE_CRITERIA — Nog geen AC voor "Wijzigingen weggooien?" bij het sluiten van een gevulde sheet (UX §3), en voor de koptekst "nog N te doen" (open vandaag + verlopen). Klein, maar allebei zichtbaar gedrag in de kernflow.

## Vragen voor Jurgen

- **V-36 — Hoe gaat de nieuwe versie live tijdens het bouwen?**
  - Waarom dit ertoe doet: het gezin gebruikt de app elke dag, en het bouwen gebeurt in negen stappen over langere tijd.
  - Opties:
    - (a) Beveiliging, de gegevensomzetting en de herinneringen elke 15 minuten gaan zodra ze klaar zijn live. De nieuwe schermen gaan pas samen live als alles af is. Tot dan gebruikt het gezin de huidige app, zonder "Wie?", punten en ruilen.
    - (b) Elk onderdeel gaat meteen live. Het gezin ziet dan wekenlang een mengsel van oude en nieuwe schermen, waarvan sommige er onaf uitzien.
  - Voorstel: (a).

- **V-37 — Mag "taak wijzigen" meer dan twee tikken kosten?**
  - Waarom dit ertoe doet: het oude besluit was "wijzigen in maximaal twee tikken".
  - In het nieuwe ontwerp kosten verplaatsen ("Naar morgen"), bezig en afvinken twee tikken, maar de naam of andere details wijzigen kost vier à vijf tikken (taak openen → ⋯ → Bewerken → Opslaan).
  - Voorstel: akkoord. Het vaakst gebruikte wijzigen blijft snel, en het scherm blijft rustig.

- **V-38 — De melding "taak gedaan" verraadt wie afvinkte.**
  - Waarom dit ertoe doet: je koos dat de app niet bijhoudt wie iets deed. Als degene die afvinkt de melding niet krijgt en de anderen wel, is in de gegevens toch te zien wie het was (90 dagen lang).
  - Opties:
    - (a) De melding gaat naar iedereen die hem aan heeft, ook naar wie afvinkte.
    - (b) De melding "taak gedaan" vervalt helemaal (hij staat nu al standaard uit).
    - (c) Zo laten en dit accepteren.
  - Voorstel: (a). Eenvoudig en in lijn met je besluit.

## Opgelost sinds vorige ronde
- Eerste ronde.

## Onbevestigde aannames
- Wijzigen mag meer dan twee tikken kosten (UX §4.5), terwijl het overgenomen besluit anders is — raakt: UX (bindend besluit) → V-37.
- "Taak gedaan" niet naar de afvinker sturen is verenigbaar met "niet bijhouden wie" (BR-31, AC-073) — raakt: gegevens/privacy → V-38.
- Uitrol per WP is aanvaardbaar voor het dagelijks gebruik van het gezin (TD §12.3) — raakt: scope/UX van de live app → V-36.
- Geen enkel lid met account heeft op live nu `is_active = false` (impliciet in WP1) — raakt: rechten → punt 7 (controle, geen vraag, tenzij de telling > 0 is).
- Overige aannames (herhalingsregels correct, meeschuivende deadline, prioriteit zonder kleur, donker volgens systeem, + zonder label) raken geen rechten, gegevens of scope.

## Conclusie
DESIGN FREEZE MOGELIJK: NEE
Reden: er staan veertien punten MOET VÓÓR BOUW open, waaronder twee privacygaten die botsen met V-21 (bestaande meldingen met "gedaan door <naam>" blijven na het wissen bestaan; de ontvangerslijst van "taak gedaan" verraadt wie afvinkte), een tegenstrijdigheid in het rechtenmodel (guard tegenover "losse taak wordt terugkerend") en een ontbrekende uitrol- en outboxstrategie voor de live app. Drie punten wachten op Jurgen (V-36…V-38).
