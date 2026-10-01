# Productspecificatie — Takenlijstje

Versie: ronde 3 (2026-09-28) · Kwaliteitsniveau 2 · Werkwijze §15, stap 3 (bestaand project).
Status: ronde 5 (na plan-critic ronde 1). Alle vragen zijn beantwoord, tot en met V-39. Nog niet bevroren.

**Bronnen**
- De besluiten en antwoorden van Jurgen in `docs/PROGRESS.md` (V-04, en V-05 t/m V-27). Die zijn leidend.
- De besluiten uit `README.md` en `docs/ARCHITECTUUR.md` (V-02), voor zover Jurgen ze niet heeft vervangen.
- `docs/INVENTARIS.md`.
- De huidige code: `supabase/migrations/*`, `src/domain/**` en `src/server/**`.

Er zijn geen nieuwe functies bedacht. Waar de code afwijkt van de bedoelde regel, staat de bedoelde regel hier. De bevinding uit de inventaris staat erbij, bijvoorbeeld *(afwijking: B-01)*.

**Nummering.** Businessregels heten **BR-nn** en use cases **UC-nn**. Ze zijn in ronde 2 opnieuw genummerd. BR-nn staat los van de bevindingen R-01 t/m R-03 in de inventaris.

---

## 0. Scopewijziging in ronde 2 (besluit van Jurgen, 2026-09-28)

**Kern van het besluit (V-19, V-21, V-22):** taken worden **niet aan personen toegewezen**. Een taak is van het hele huishouden. De app laat zien **wat er moet gebeuren en vóór wanneer**. Wie het doet, vinkt het af. Iedereen mag afvinken, en iedereen mag een afvinking terugdraaien. De app **registreert niet wie afvinkte**, ook niet onzichtbaar.

Dit vervangt de overgenomen besluiten uit INVENTARIS §2 over Verdeling, Ruilen en punten. Het raakt ook de besluiten over Openingsscherm, Nieuwe taak en Afvinken.

| Vervalt | Gevolg voor het product |
| --- | --- |
| Toewijzen aan een persoon ("Wie?") | Een nieuwe taak is minimaal *Naam · Wanneer?*. Slimme invoer herkent geen personen meer ("Badkamer zaterdag"). |
| Automatische verdeling (vast, om en om, willekeurig, eerlijk) en taakbelasting | Een reeks plant alleen nog datums in, zonder persoon. |
| Ruilen en ruilverzoeken ("Ik kan deze taak niet doen") | Niet meer nodig: niemand is eigenaar, dus er valt niets over te dragen. |
| Punten, spaardoel en "Samen sparen" | Een taak heeft geen punten meer. Het veld "duur" blijft, als informatie ("ca. 30 min") (V-25). |
| Registratie van wie afvinkte, en "namens een ander afvinken" | De historie legt wat, wanneer en op tijd of te laat vast, niet wie. De melding "gedaan door Ellen" noemt geen naam meer. |
| Statistieken per persoon (Huishouden-overzicht) | Het overzicht toont alleen cijfers voor het huishouden als geheel (UC-06). |
| "Mijn taken" tegenover "Iedereen" op Vandaag | Er is één lijst voor het huishouden. |
| Filter per persoon (Taken, Kalender) | Vervalt. |
| Melding "Nieuwe taak voor jou" (toegewezen), en de meldingen over ruilen | Vervallen. |
| Dagoverzicht "waarvan X voor jou", en het avondoverzicht "van jou nog open" | Beide tellen voor het huishouden als geheel (BR-31). |
| Lid zonder account (bijv. een kind zonder telefoon) | Heeft geen functie meer: er is niets aan hem toe te wijzen en niets namens hem af te vinken. Lynn en Kai krijgen optioneel een eigen account als gezinslid (V-06). |
| Afwezigheid, met opnieuw verdelen, doorschuiven of vrijgeven | **Vervalt** (V-24). Het bestond alleen om taken van een persoon te verwerken. Gaat het hele gezin op vakantie, dan pauzeer je de terugkerende taken (BR-09). |
| Uitnodiging gekoppeld aan een bestaand lid zonder account | Vervalt samen met de leden zonder account. Een uitnodiging maakt altijd een nieuw gezinslid. |
| Instelling "Gezinsleden mogen aan anderen toewijzen" | Vervalt. "Gezinsleden mogen taken maken" blijft (BR-20). |

**Wat blijft:**
- herhaling, deadlines en pauzeren;
- afvinken en ongedaan maken;
- de kalender;
- boodschappen;
- meldingen (met andere ontvangers, BR-31);
- offline werken, realtime en uitnodigingen;
- rollen: beheerder en gezinslid.

**Wat "niet bijhouden wie" wel en niet betekent.** Jurgen koos: de app houdt niet bij wie een taak **gedaan** heeft. Andere "wie"-gegevens hebben een ander doel:
Jurgen heeft per gegeven besloten (V-25):
- **De maker van een taak of reeks wordt bewaard, maar nergens getoond** en niet gebruikt in overzichten. Hij is nodig voor het recht om een reeks te wijzigen, pauzeren of stoppen (V-09), en om een taak te verwijderen (V-13). Dat is "wie heeft dit ingesteld", niet "wie heeft het gedaan". Het botst dus niet met V-21.
- **De schrijver van een notitie wordt bewaard en getoond** bij de notitie ("Ellen: ..."). Getoond wordt de laatst bekende naam, ook na verwijderen (V-34; zie §8).
- **"Toegevoegd door" en "gekocht door" bij boodschappen vervallen.**

**Bestaande gegevens in de live database** worden bij de overgang opgeruimd volgens BR-46 (V-26). Vlak vóór het wissen vraagt de bouwer Jurgen nogmaals om bevestiging.

---

## 1. Probleem

- **De situatie.** In het gezin (Ellen, Jurgen, Lynn 15 en Kai 13) is het huishouden verdeeld over veel kleine, terugkerende taken: vaatwasser, afval, badkamer, boodschappen, dieren, gras.
- **Wat er misgaat (Jurgen, V-19):**
  - de verdeling voelt **oneerlijk**;
  - taken worden **vergeten**, "met name door Jurgen".
- **Hoe de app dat oplost (V-19, V-21):** niet door de app het werk te laten verdelen, maar door **zichtbaar te maken wat er moet gebeuren en vóór wanneer**, en wat al gedaan is. Wie iets ziet staan en tijd heeft, doet het en vinkt het af. Daardoor:
  - hoeft niemand alles te onthouden;
  - ziet iedereen dat er werk ligt;
  - is minder discussie nodig over wie wat "had moeten doen".
- **Hoe vaak.** Dagelijks, meerdere keren per dag, kort en tussendoor.
- **Welke handeling het mogelijk moet maken:**
  1. Bij het openen direct zien: wat er vandaag moet gebeuren, wat al gedaan is, wat achterloopt, en vóór wanneer.
  2. Een taak met één tik afvinken, zodat de anderen het meteen zien.
  3. Een herinnering krijgen voordat iets vergeten wordt.

## 2. Gebruikers

| Gebruiker | Primair/secundair | Context | Doel |
| --- | --- | --- | --- |
| **Ellen en Jurgen** (beheerders) | Primair | Eigen telefoon (390×844), thuis en onderweg, kort en tussendoor. Af en toe langer om taken in te richten | Zien wat er moet, afvinken, taken en reeksen inrichten, herinnerd worden |
| **Lynn (15) en Kai (13)** (gezinsleden) | Secundair, optioneel (V-06) | Eigen telefoon, als ze een account krijgen | Zien wat er moet, afvinken, boodschappen bijhouden |

- **Doelgroep (V-05):** alleen het eigen gezin. De open registratie blijft technisch bestaan, maar wordt niet actief aangeboden. Aansluiten gaat via een uitnodiging.
- **Eén huishouden per persoon (V-08).**
- **Apparaat (V-07):** de telefoon is het enige doelapparaat. De computer wordt niet ontworpen of getest. Hij hoeft wel te werken, maar zonder eigen indeling.

## 3. Jobs-to-be-done

- Als **gezinslid** wil ik bij het openen meteen zien wat er vandaag moet gebeuren en wat verlopen is, zodat ik niets vergeet, **wanneer** ik even op mijn telefoon kijk.
- Als **gezinslid** wil ik met één tik afvinken wat ik gedaan heb, zodat de anderen weten dat het niet meer hoeft, **wanneer** ik net klaar ben, ook zonder internet.
- Als **Jurgen** wil ik op tijd een herinnering krijgen voor wat er moet gebeuren, zodat ik minder vergeet, **wanneer** ik de app niet open heb.
- Als **beheerder** wil ik terugkerende taken één keer instellen met een ritme en een deadline, zodat ze vanzelf blijven verschijnen, **wanneer** ik het huishouden inricht of iets verandert.
- Als **gezinslid** wil ik snel iets op de boodschappenlijst zetten en in de winkel afvinken, **wanneer** ik iets zie opraken of in de winkel sta.
- Als **gezinslid** wil ik een per ongeluk afgevinkte taak terugzetten, zodat de lijst klopt, **wanneer** ik me vergist heb of iemand anders dat deed.

## 4. Use cases

### UC-01 — Vandaag bekijken (kernflow, deel 1)
- **Begin:** een ingelogde gebruiker opent de app.
- **Inhoud:** het openingsscherm toont voor het hele huishouden:
  - wat verlopen is;
  - wat vandaag moet gebeuren, met "vóór wanneer";
  - wat vandaag al gedaan is;
  - wat binnenkort komt.
- **Eind:** de gebruiker weet wat er moet gebeuren.
- **Wat kan misgaan:**
  - geen internet: de laatst geladen gegevens worden getoond, met een melding dat je offline bent;
  - trage verbinding: er moet een laadstaat zijn *(afwijking: S-01)*;
  - databasefout: er moet een bruikbare foutstaat zijn *(afwijking: S-01)*;
  - geen taken: een lege staat met een uitnodiging om er een toe te voegen.
- **Aanpassing van het oorspronkelijke besluit:** eerst stond hier "wat jij moet doen / wat de rest moet doen". Dat is nu **"wat er moet gebeuren"**. De huidige indeling is te vol (D-02); de indeling is werk voor de product-designer.

### UC-02 — Taak afvinken (kernflow, deel 2)
- **Begin:** de gebruiker ziet een open taak (Vandaag, Taken of Kalender).
- **Stappen:**
  1. Eén tik.
  2. De taak staat direct op gedaan (optimistisch).
  3. Er verschijnt een paar seconden "Ongedaan maken".
- **Eind:**
  - De historie legt vast wanneer het gedaan is en of dat op tijd of te laat was, niet door wie (BR-12).
  - De huisgenoten zien het binnen enkele seconden.
  - Bij een reeks staat de volgende uitvoering klaar.
- **Wat kan misgaan:**
  - offline: de actie gaat in de wachtrij, zonder dubbele registratie (BR-10);
  - twee mensen vinken tegelijk af: er wordt één keer geregistreerd (BR-11);
  - de taak is intussen verwijderd: nette melding;
  - verkeerd afgevinkt: ongedaan maken (BR-13).

### UC-03 — Taak toevoegen
- **Begin:** de zwevende +, snel toevoegen, of + bij een dag in de kalender.
- **Stappen:**
  1. Vul minimaal **Naam · Wanneer?** in.
  2. Of gebruik slimme invoer ("Badkamer zaterdag").
  3. Optioneel, onder "Meer instellingen": categorie, deadline, tijd, duur, prioriteit, herinnering en herhaling.
- **Eind:** de taak staat in de lijst.
- **Wat kan misgaan:**
  - lege naam: "Toevoegen" blijft uitgeschakeld;
  - geen recht om taken te maken (BR-20): nette melding;
  - dubbel versturen: het blijft één taak (BR-10).
- **Slimme invoer met een naam van een persoon** ("... Jurgen"): het woord wordt niet meer als persoon herkend. Het blijft deel van de naam van de taak, of wordt genegeerd. Dat is een detail voor het ontwerp, zonder gevolgen voor gegevens.

### UC-04 — Terugkerende taak instellen en wijzigen
- **Begin:** een nieuwe taak met herhaling, of een standaardtaak uit de bibliotheek.
- **Stappen:**
  1. Kies het ritme (BR-01).
  2. Kies optioneel een deadline-venster: beschikbaar X dagen vooraf, uiterlijk Y dagen na de geplande dag, tijd.
  3. Kies optioneel een einddatum.
  4. De planning maakt vooruit taken aan (BR-02).
- **Wijzigen:**
  - kies "alleen deze" of "deze en toekomstige" (BR-08);
  - pauzeren (BR-09);
  - de reeks stoppen.
- **Eind:** de reeks loopt vanzelf door (BR-30).
- **Wat kan misgaan:** een gezinslid zonder recht probeert andermans reeks te wijzigen of te stoppen. Dat wordt geweigerd, zonder dat er iets verdwijnt *(afwijking: B-01)*.

### UC-05 — Plannen in de kalender
- **Begin:** de Kalender (dag, week of maand).
- **Stappen:**
  - bekijk de taken per dag;
  - herhalingen zijn herkenbaar;
  - verplaats een taak naar een andere dag;
  - voeg een taak toe op een dag.
- **Eind:** de taak staat op de nieuwe dag. Bij een reeks geldt dat alleen voor die ene taak (BR-08).
- **Wat kan misgaan:**
  - buiten het geladen bereik staat nu stil "Niets gepland" *(afwijking: S-02)*;
  - verplaatsen kan alleen met slepen en moet ook zonder kunnen *(afwijking: A-02)*.

### UC-06 — Overzicht huishouden
- **Begin:** de gebruiker opent Huishouden.
- **Inhoud, alleen voor het huishouden als geheel:**
  - per periode: gedaan, open, verlopen en overgeslagen;
  - welke taken vaak vergeten worden (te laat, overgeslagen of verlopen);
  - wat vaak gedaan wordt.
- **Beslissing die het scherm ondersteunt:** wat vergeten we, en moet er iets aan de planning veranderen (een ander ritme, een ruimere deadline, een herinnering)?
- **Wat er niet in staat:** statistieken per persoon, punten en spaardoel (vervallen, §0).
- **Wat kan misgaan:** er is nog geen historie. Dan is een lege staat nodig *(afwijking: S-03)*.

### UC-07 — Boodschappen
- **Stappen:**
  1. Snel toevoegen, bijvoorbeeld "2 melk", met een automatische categorie.
  2. Of kies uit "Vaak gekocht".
  3. Afvinken in de winkel.
  4. Na het winkelen archiveren: wat niet gekocht is, gaat mee naar de nieuwe lijst.
  5. Vanuit een notitie bij een taak kun je iets op de lijst zetten.
- **Wat kan misgaan:**
  - offline: via de wachtrij, zonder dubbele items (BR-10);
  - twee keer archiveren: mag geen extra lege lijsten opleveren *(afwijking: R-03)*.

### UC-08 — Meldingen
- **Soorten:**
  - herinnering;
  - deadline nadert;
  - verlopen;
  - taak gedaan, zonder naam;
  - dagoverzicht en avondoverzicht.
- **Kanalen en instellingen:** in de app, en optioneel als pushmelding op de telefoon. Per persoon in te stellen.
- **Wie ontvangt ze (V-23):** iedereen met een account, volgens de eigen meldingsinstellingen. Standaard aan voor Ellen en Jurgen (de beheerders), standaard uit voor Lynn en Kai. Zij kunnen het zelf aanzetten (BR-31).
- **Wat kan misgaan:**
  - push op de iPhone kan alleen als de app op het beginscherm staat, vanaf iOS 16.4;
  - dubbele meldingen worden voorkomen met een dedupe-sleutel;
  - meldingen komen te laat, omdat de achtergrondtaak nu maar één keer per dag draait (R-01; V-04 bevestigd: pg_cron staat niet aan).

### UC-09 — Uitnodigen en aansluiten
- **Begin:** een beheerder maakt een uitnodigingslink, eventueel gebonden aan een e-mailadres.
- **Stappen:**
  1. De beheerder deelt de link.
  2. De ontvanger logt in of registreert, en accepteert.
- **Eind:** de ontvanger is een nieuw gezinslid (of beheerder), met de rol uit de uitnodiging.
- **Wat kan misgaan:**
  - de link is verlopen (na 14 dagen) of al gebruikt: een duidelijke foutstaat (die is er al);
  - de link is bedoeld voor een ander e-mailadres: geweigerd;
  - de ontvanger is al lid: de uitnodiging wordt alleen afgerond;
  - de ontvanger is al lid van een ander huishouden: geweigerd, met uitleg (BR-44).

### UC-10 — Onboarding nieuw huishouden
- **Stappen:**
  1. Naam van het huishouden.
  2. Uitnodigen van gezinsleden (optioneel, kan ook later).
  3. Standaardtaken kiezen.
  4. Frequentie per taak kiezen.

  De stap "verdeling" vervalt (§0).
- **Eind:** een ingericht huishouden met een geplande eerste week. De maker is beheerder.
- **Wat kan misgaan:** halverwege stoppen. Bij terugkomst ga je verder, of begin je opnieuw.
- **Google/Apple:** de tekst over inloggen met Google/Apple wordt weggehaald (V-14).
- Omdat het alleen voor het eigen gezin is en dat al bestaat, is de onboarding in de praktijk zelden in gebruik. Hij blijft bestaan voor een nieuw account zonder huishouden.

### UC-11 — Account en inloggen
- **Inloggen:** met e-mail en wachtwoord, of met een magic link.
- **Wachtwoord vergeten:** wordt toegevoegd (V-14).
- **Uitloggen:** wist de offline-gegevens op het apparaat (BR-43).
- **Account verwijderen:** kan door ieder lid zelf (V-15). Het lidmaatschap verdwijnt, en de historie van het huishouden blijft bestaan. Die bevat geen personen (BR-12).
- **Laatste beheerder:** het account verwijderen kan niet zolang je de enige beheerder bent (BR-24).

### UC-12 — Instellingen en beheer
- **Iedereen:** eigen profiel (naam, kleur, emoji), meldingen en push, uitloggen, account verwijderen.
- **Beheerder daarnaast:**
  - huishouden: naam en "gezinsleden mogen taken maken";
  - de **tijdzone staat vast op Europe/Amsterdam**. Hij is alleen zichtbaar en door niemand te wijzigen, ook niet door een beheerder (V-39). Daardoor verschuiven deadlines en herinneringen nooit door een andere tijdzone;
  - gezinsleden: (de)activeren, rol wijzigen en verwijderen. Voorkeur: deactiveren in plaats van verwijderen (V-15);
  - uitnodigingen;
  - terugkerende taken en standaardtaken;
  - **het huishouden verwijderen** (V-15), met een duidelijke bevestiging.
- De huidige pagina is te lang (D-03). Dat is ontwerpwerk.

## 5. Businessregels en harde regels

### Planning en herhaling
- **BR-01 — Ritmes:** dagelijks, elke X dagen, vaste weekdagen, elke X weken, maandelijks (op een dag van de maand, of "de n-de weekdag", zoals de eerste zaterdag) en jaarlijks. Optioneel met een einddatum.
- **BR-02 — Vooruit plannen:** een reeks heeft altijd concrete taken voor de komende **14 dagen**. Valt er in die periode niets, dan alleen de eerstvolgende. Dezelfde uitvoering wordt **nooit** twee keer ingepland. — waarom: je ziet deze en volgende week, en dubbele taken zijn verwarrend.
- **BR-08 — "Alleen deze" of "deze en toekomstige":**
  - **Alleen deze:** wijzigen of verplaatsen maakt de taak een uitzondering. Opnieuw plannen overschrijft hem **nooit**.
  - **Deze en toekomstige:** past de reeks aan en plant alle open, niet-aangepaste taken ná deze opnieuw in.
  - Een verplaatste taak houdt zijn oorspronkelijke datum in de reeks.
- **BR-09 — Pauzeren en stoppen:**
  - **Pauzeren** kan van–tot. Open, niet-aangepaste taken in die periode vervallen, en daarna gaat de reeks vanzelf verder.
  - **Stoppen:** de reeks maakt geen nieuwe taken meer, en de open taken ervan vervallen.
  - De historie blijft in beide gevallen bestaan.
- **BR-16 — Verlopen stapelt niet op:** een verlopen taak van een reeks wordt automatisch **overgeslagen** zodra de volgende uitvoering beschikbaar is. Hij telt wel mee als "vergeten".
- **BR-17 — Verlopen:** een open taak is verlopen als de deadline voorbij is, of, zonder deadline, als de geplande dag voorbij is. Dit wordt afgeleid, **niet** opgeslagen.
- **BR-18 — Deadline-venster:** "beschikbaar vanaf" ligt nooit ná de deadline. Is er geen tijd opgegeven, dan is de deadline het einde van de dag, in de tijdzone van het huishouden.

### Afvinken en historie
- **BR-10 — Idempotent:** elke actie die opnieuw verstuurd kan worden, levert **nooit** een dubbele registratie op. Het gaat om afvinken, nieuwe taken, boodschappen, notities, lijst archiveren, uitnodigingen en standaardtaken activeren. *(afwijking: R-03 voor archiveren, uitnodiging en standaardtaken; ruilverzoek en afwezigheid vervallen)*
- **BR-11 — Eén keer voltooid:** een taak wordt maar één keer als voltooid geregistreerd, ook als twee mensen tegelijk afvinken.
- **BR-12 — Historie zonder personen:**
  - **Wat wordt vastgelegd:** titel (als momentopname), categorie, wanneer gedaan, de geplande dag, de deadline, of het te laat was (en hoeveel minuten), en een optionele notitie.
  - **Wat de app nooit vastlegt:** wie afvinkte (V-21).
    - Niet in de database, niet in de tekst van meldingen en niet in de eigen logregels van de app. De app logt alleen actienaam, foutnaam en code.
    - **Grens van die belofte:** de platforms waarop de app draait, houden zelf toegangslogs bij die de app niet beheert.
      - **Supabase:** de API- en auth-logs leggen per aanroep vast welk account welke functie aanriep (bijvoorbeeld `rpc/complete_task`) en wanneer.
      - **Vercel:** de request- en functielogs leggen per verzoek vast welk endpoint wanneer werd aangeroepen, bijvoorbeeld `POST /api/outbox`. Via de sessie is dat naar een gebruiker te herleiden (TECHNICAL_DESIGN §9.4). De eigen logregels van de app bevatten geen invoer en geen `user_id`.
      - **Bewaartermijn:**
        - Volgens de openbare documentatie van de aanbieders (geraadpleegd op 2026-09-28) bewaart Supabase de logs op het gratis plan 1 dag, en langer op betaalde plannen. Vercel bewaart runtime-logs op het Hobby-plan 1 uur.
        - Welk Supabase-plan het project heeft, en welke termijn er werkelijk geldt, is **nog niet in het dashboard gecontroleerd**. Dat gebeurt in WP3 (TECHNICAL_DESIGN §9.4), en de uitkomst komt in `docs/DECISIONS.md`.
        - Tot die controle geldt de termijn als "kort, afhankelijk van het plan". Het is geen belofte.
    - De bouwer noemt dit in het totaalvoorstel aan Jurgen (plan-critic ronde 1, punt 3).
  - De historie blijft bestaan als de taak of reeks later wordt verwijderd.
  - Offline afgevinkt? Dan geldt het moment van afvinken, maar nooit in de toekomst en nooit meer dan 7 dagen terug.
  - *(afwijking: de code slaat nu `completed_by_member_id` en `task_completions.member_id` op, en kan "namens" een ander afvinken; B-04 vervalt daarmee)*
- **BR-13 — Ongedaan maken:**
  - **Iedereen** in het huishouden mag een afvinking terugdraaien (V-22).
  - Direct na het afvinken kan het een paar seconden via de melding, en later via het taakdetail. Dat later kunnen komt uit V-11; wie het mag, is vervangen door V-22.
  - Terugdraaien verwijdert de registratie in de historie en zet de taak weer open.
  - *(afwijking: nu mogen alleen wie afvinkte en een beheerder terugdraaien)*
- **BR-14 — Status "bezig":** een open taak kan op "bezig" gezet worden, zonder te registreren door wie. Iedereen mag de status terugzetten.

### Rechten (zie ook §7)
- **BR-20 — Taken aanmaken:** een beheerder mag het altijd. Een gezinslid mag het alleen als "Gezinsleden mogen taken maken" aan staat (standaard: aan). Dit geldt voor **elke** manier van aanmaken: los, als reeks en via standaardtaken. *(afwijking: B-02 — het aanmaken met automatische verdeling omzeilt deze instelling nu; met het vervallen van automatische verdeling moet deze route ook verdwijnen)*
- **BR-22 — Reeksen:** alleen een beheerder of de maker van de reeks mag hem wijzigen ("deze en toekomstige"), pauzeren, stoppen of verwijderen (V-09). Een geweigerde actie verandert **niets**: er verdwijnen geen taken, en de gebruiker krijgt een duidelijke melding. *(afwijking: B-01)*
- **BR-23 — Losse taken en losse uitvoeringen van een reeks (V-13):**
  - **Wijzigen, verplaatsen, op "bezig" zetten en afvinken:** iedereen. Het voorstel bij V-13 was "iedereen als de taak niet is toegewezen", en geen enkele taak is meer toegewezen.
  - **Verwijderen:** alleen een beheerder of de maker.
  - De maker van een taak kan **nooit** worden veranderd.
  - *(afwijking: B-04 — een lid kan nu de maker aanpassen; en "verwijderen" van een taak in een reeks is een zachte verwijdering die ook anderen dan de maker toestaat)*
- **BR-24 — Beheerders:**
  - Een huishouden heeft **altijd** minstens één beheerder: de laatste beheerder kan niet worden gedegradeerd of verwijderd, en kan zijn account niet verwijderen.
  - Een beheerder kan zichzelf niet via ledenbeheer verwijderen.
  - Een gezinslid kan de eigen rol, koppeling of actieve status **nooit** wijzigen.
- **BR-25 — Meldingen worden alleen door het systeem aangemaakt.** Een gebruiker kan **nooit** een melding met eigen tekst of link bij een huisgenoot plaatsen. Links in meldingen gaan **altijd** naar een pagina binnen de app. *(afwijking: B-03)*
- **BR-26 — Isolatie:** een gebruiker ziet of wijzigt **nooit** iets van een ander huishouden. Ook een gemanipuleerd verzoek kan geen verwijzing naar een ander huishouden maken.

### Achtergrond en meldingen
- **BR-30 — Achtergrondtaak:** draait elke **15 minuten**. Hij doet vier dingen:
  - vult de planning aan;
  - slaat ingehaalde verlopen taken over (BR-16);
  - verstuurt herinneringen, "deadline nadert" en "verlopen";
  - verstuurt het dag- en avondoverzicht.

  *(afwijking: R-01 — bevestigd bij V-04: pg_cron en pg_net zijn niet geïnstalleerd, en de taak draait alleen één keer per dag via `vercel.json`, om 05:30 UTC. De oplossing hoort in het technisch ontwerp.)*
- **BR-31 — Meldingsregels:**
  - **Herinnering:** X minuten vóór het geplande tijdstip, anders vóór de deadline; maximaal 5 per taak. Verstuurd binnen 90 minuten na het moment, anders vervalt hij.
  - **Deadline nadert:** binnen de ingestelde waarschuwingstijd (standaard 2 uur, instelbaar van 5 minuten tot 48 uur).
  - **Verlopen:** één keer, binnen 24 uur na de deadline.
  - **Dagoverzicht** (standaard 07:30): "Vandaag staan er N taken", alleen als N > 0.
  - **Avondoverzicht** (standaard 20:00): "Er staan nog N taken open (vandaag en verlopen)", alleen als N > 0.
  - **Taak gedaan:** "'Vaatwasser uitruimen' is gedaan", **zonder naam**. Standaard uit.
    - **Ontvangers (V-38, optie a):** ieder actief lid met een account dat "taak gedaan" aan heeft staan, **ook degene die afvinkte**. Wie de melding krijgt, hangt dus alleen af van de voorkeuren, niet van wie afvinkte. Zo is uit de opgeslagen meldingen niet af te leiden wie het deed (V-21).
    - De app gebruikt bij het versturen niet wie afvinkte.
  - **Nooit dubbel:** dezelfde melding komt per ontvanger nooit twee keer.
  - **Voorkeuren:** gelden per persoon.
  - **Ontvangers (V-23):**
    - herinnering, "deadline nadert", "verlopen", dag- en avondoverzicht en "taak gedaan" gaan naar **ieder lid met een account** dat die soort melding aan heeft staan;
    - **standaard aan** voor beheerders (Ellen en Jurgen), **standaard uit** voor gezinsleden (Lynn en Kai), behalve "taak gedaan", die voor iedereen standaard uit staat;
    - ieder lid kan dit zelf wijzigen.
  - **Gevolg van V-21:** er zijn geen meldingen meer die afhangen van een eigenaar, zoals "Nieuwe taak voor jou" of meldingen over ruilen.

### Overig
- **BR-40 — Tijd:** alle datums worden bepaald in de tijdzone van het huishouden. Die staat vast op Europe/Amsterdam en is niet te wijzigen (V-39).
- **BR-41 — Uitnodiging:**
  - is 14 dagen geldig en werkt één keer;
  - is optioneel gebonden aan een e-mailadres;
  - alleen een beheerder maakt uitnodigingen;
  - de rol staat in de uitnodiging.
- **BR-42 — Boodschappen:** elk lid mag alles op de lijst: toevoegen, wijzigen, afvinken, verwijderen en archiveren. Bij archiveren gaan de niet-gekochte producten mee.
- **BR-43 — Uitloggen wist de lokaal opgeslagen offline-gegevens.**
- **BR-44 — Eén huishouden per persoon (V-08):**
  - wie al lid is van een huishouden, kan geen tweede aanmaken of accepteren;
  - er is geen scherm om te wisselen.
- **BR-45 — Bewaartermijnen (V-18, voorstel gevolgd):**

  | Gegevens | Bewaard tot |
  | --- | --- |
  | Afvinkhistorie | 2 jaar |
  | Meldingen | 90 dagen |
  | Gearchiveerde boodschappenlijsten | 1 jaar |
  | Verlopen of gebruikte uitnodigingen | 30 dagen |
  | Pushabonnementen | Weg zodra ze ongeldig zijn |

  Ouder wordt automatisch verwijderd. De termijn voor afwezigheid uit V-18 vervalt, omdat afwezigheid zelf vervalt (V-24).
- **BR-46 — Overgang van de live gegevens (V-26):**
  1. Eerst wordt een **back-up** gemaakt van de live database, en er wordt gecontroleerd dat die terug te zetten is.
  2. **Vlak vóór het wissen vraagt de bouwer Jurgen nogmaals om uitdrukkelijke bevestiging.** Zonder die bevestiging wordt er **nooit** iets gewist.
     - Hij toont daarbij de exacte aantallen per soort gegevens die verdwijnen, **inclusief de bestaande meldingen uit punt 3**.
     - De aantallen worden direct vóór die vraag opnieuw geteld, omdat het gezin de app intussen blijft gebruiken.
  3. Daarna worden gewist:
     - toewijzingen en toewijzingshistorie;
     - wie afvinkte ("gedaan door", en de persoon in de afvinkhistorie);
     - punten en het spaardoel;
     - ruilverzoeken;
     - afwezigheden;
     - meldingen van soorten die vervallen (toegewezen, ruilverzoek, ruil geaccepteerd);
     - **alle bestaande meldingen "taak gedaan" van vóór de overgang.** Hun tekst noemt letterlijk wie afvinkte ("… is gedaan door {naam}");
     - **alle bestaande dag- en avondoverzichten van vóór de overgang.** Hun tekst is een afgeleide van toewijzing ("Waarvan N voor jou", "van jou nog open", "op jouw naam");
     - "toegevoegd door" en "gekocht door" bij boodschappen;
     - leden zonder account.

     Na het wissen staat nergens in de database, **ook niet in de tekst van meldingen**, wie een taak deed (plan-critic ronde 1, punt 1).
  4. **Blijft bestaan:**
     - de afvinkhistorie zelf (wat, wanneer, op tijd of te laat, notitie), zonder personen;
     - de makers van taken en reeksen en de schrijvers van notities (V-25);
     - bestaande meldingen van de soorten herinnering, "deadline nadert" en "verlopen", want hun tekst noemt geen persoon.

     Dit sluit aan op TECHNICAL_DESIGN §12.4.
  5. **Meldingsvoorkeuren van bestaande gezinsleden** (nu Lynn en Kai, als ze een account hebben) worden bij de overgang op de nieuwe standaard gezet: alle soorten **uit**. Dat geldt ook als ze die meldingen zelf hadden aangezet. De voorkeuren van beheerders blijven ongewijzigd. Dit volgt uit V-23. De bouwer noemt het expliciet in het totaalvoorstel aan Jurgen, zodat Lynn en Kai niet ongemerkt geen herinneringen meer krijgen. Ze kunnen het daarna zelf weer aanzetten.

  **Hoe de nieuwe versie live gaat tijdens het bouwen (V-36):**
  - Beveiliging, de omzetting van de gegevens en de herinneringen elke 15 minuten (WP1 t/m WP3) gaan live zodra ze klaar zijn.
  - De nieuwe schermen (WP4 t/m WP8) gaan samen live, na de afronding in WP9.
  - Tot dan gebruikt het gezin de huidige schermen, zonder "Wie?", punten en ruilen.

  — waarom: het wissen is onomkeerbaar en raakt gegevens van het gezin.

## 6. Randgevallen

| Geval | Bedoeld gedrag |
| --- | --- |
| Leeg huishouden | Lege staat op Vandaag, Taken, Kalender en Huishouden, met een uitnodiging om een taak toe te voegen (*afwijking: S-03 voor Huishouden*) |
| Dubbel tikken, of offline afvinken en daarna opnieuw | Eén registratie (BR-10, BR-11) |
| Twee mensen vinken tegelijk af | Eén registratie, en beiden zien de taak als gedaan |
| De een vinkt af, de ander draait terug | De laatste actie geldt. Iedereen ziet de actuele stand binnen enkele seconden |
| Taak afgevinkt terwijl iemand hem bewerkt | De bewerking maakt het afvinken niet ongedaan. Afvinken loopt alleen via de afvinkfunctie |
| Maandelijks op de 31e, of 29 februari | Volgens de bestaande, geteste domeinregel (`[AANNAME]`, §13) |
| Zomer- en wintertijd | De deadline blijft dezelfde kloktijd in de tijdzone van het huishouden |
| Offline afvinken, dagen later online | Het afvinkmoment geldt, maar maximaal 7 dagen terug |
| Veel taken op een dag, of 60+ meldingen | Groeperen per dag; bij meldingen is "meer laden" nodig (*afwijking: S-03*) |
| Kalender buiten het geladen bereik | Gegevens tonen of duidelijk uitleggen (*afwijking: S-02*) |
| Uitnodiging voor iemand die al lid is | Alleen de uitnodiging afronden |
| Uitnodiging voor iemand die al lid is van een ander huishouden | Geweigerd, met uitleg (BR-44) |
| Deadline vóór "beschikbaar vanaf" | Geweigerd, met een uitleg (BR-18) |
| Invoer te lang (taaknaam > 80, notitie > 1000) | Geweigerd, met een uitleg |
| Maker van een reeks wordt gedeactiveerd of verwijderd | Alleen de beheerders kunnen de reeks dan nog wijzigen, pauzeren of stoppen (BR-22). De reeks loopt gewoon door |
| Een beheerder verwijdert het huishouden | Alle gegevens van het huishouden verdwijnen, na een expliciete bevestiging. Dit kan niet ongedaan worden |

## 7. Rollen en rechten

Er zijn twee rollen, allebei met een account:
- **Beheerder:** Ellen en Jurgen.
- **Gezinslid:** Lynn en Kai, optioneel.

Leden zonder account vervallen (§0).

| Actie | Beheerder | Gezinslid |
| --- | --- | --- |
| Alles van het eigen huishouden zien (taken, reeksen, historie, boodschappen, leden) | Ja | Ja |
| Eigen meldingen, meldingsvoorkeuren en pushapparaten zien | Alleen eigen | Alleen eigen |
| Taak of reeks aanmaken, standaardtaken activeren | Ja | Als toegestaan (BR-20) |
| Taak afvinken | Ja | Ja |
| Afvinking terugdraaien | Ja | Ja (BR-13) |
| Losse taak of losse uitvoering wijzigen, verplaatsen, op "bezig" zetten | Ja | Ja (BR-23) |
| Taak verwijderen | Ja | Alleen zelf gemaakt (BR-23) |
| Reeks wijzigen (toekomstige), pauzeren, stoppen of verwijderen | Ja | Alleen zelf gemaakt (BR-22) |
| Notitie plaatsen, eigen notitie verwijderen | Ja (ook die van anderen verwijderen) | Ja |
| Boodschappen (alles) | Ja | Ja |
| Eigen profiel, eigen account verwijderen | Ja (niet als laatste beheerder) | Ja |
| Huishoudinstellingen | Ja | Nee |
| Leden (de)activeren, verwijderen, rol wijzigen | Ja (niet de laatste beheerder, BR-24) | Nee |
| Uitnodigingen maken en beheren | Ja | Nee |
| Eigen standaardtaken van het huishouden beheren | Ja | Nee |
| Huishouden verwijderen | Ja | Nee |
| Melding bij een ander plaatsen | Nee, alleen het systeem (BR-25) | Nee, alleen het systeem (BR-25) |

**Mag nooit:**
- een gezinslid maakt zichzelf beheerder;
- iemand wijzigt de maker van een taak;
- een geweigerde actie laat toch gegevens verdwijnen (B-01);
- de app legt vast wie een taak gedaan heeft.

**Isolatie:**
- Leden van verschillende huishoudens zien **nooit** iets van elkaar.
- Binnen het huishouden ziet ieder lid alles, **behalve** de meldingen, meldingsvoorkeuren en pushapparaten van een ander.

## 8. Gegevens

| Gegeven | Waarom nodig | Bron | Persoonsgegeven | Bewaren tot |
| --- | --- | --- | --- | --- |
| E-mailadres en wachtwoord (bij Supabase Auth) | Inloggen, magic link, uitnodiging, wachtwoord vergeten | Gebruiker | Ja (het wachtwoord slaat de app nooit zelf op) | Tot het account verwijderd wordt |
| Profiel en lidmaatschap (naam, kleur, emoji, rol, actief) | Tonen wie er in het huishouden zit, rechten | Beheerder of het lid zelf | Ja, ook van minderjarigen (Lynn 15, Kai 13) | Tot het account, het lid of het huishouden verwijderd wordt |
| Huishouden (naam, tijdzone, instelling "taken maken") | Werking | Beheerder | Indirect (de naam kan een achternaam bevatten) | Tot het huishouden verwijderd wordt |
| Uitnodigingen (token, optioneel e-mailadres, rol, wie uitnodigde) | Aansluiten | Beheerder | Ja (e-mailadres) | 30 dagen na verlopen of gebruik (BR-45) |
| Taken en reeksen (titel, omschrijving, planning, deadline, duur, prioriteit, herinneringen, **maker**) | Kernfunctie; de maker is nodig voor de rechten (BR-22, BR-23) | Leden en planning | De maker wel: wie iets instelde, niet wie het deed. Wordt bewaard, maar nergens getoond (V-25) | Tot de taak verwijderd wordt |
| Afvinkhistorie (titel, categorie, wanneer, te laat, notitie) **zonder persoon** | "Gedaan" tonen, ongedaan maken, "vergeten"-overzicht | Afvinken | Nee (alleen de vrije notitie kan iets persoonlijks bevatten) | 2 jaar (BR-45) |
| Notities bij taken (tekst, schrijver) | Afspraken en boodschappen | Leden | Ja: de schrijver wordt bewaard en bij de notitie getoond (V-25). De getoonde naam is de **laatst bekende naam** van de schrijver:<br>• De database zet hem zelf; een meegestuurde naam wordt genegeerd en is niet te wijzigen.<br>• Bij een naamswijziging wordt hij bijgewerkt.<br>• Na verwijderen van het lid of account blijft hij staan (V-34).<br>• Oude notities zonder bekende schrijver krijgen bij de overgang "Gezinslid".<br>(TECHNICAL_DESIGN §3.1) | Tot de taak verwijderd wordt |
| Meldingen (per ontvanger) | Informeren | Systeem | Ja (de ontvanger) | 90 dagen (BR-45) |
| Meldingsvoorkeuren | Werking | Lid | Ja | Tot het lid verwijderd wordt |
| Pushabonnementen (endpoint, sleutels, browserinfo) | Web Push | Apparaat | Ja | Tot uitzetten of uitloggen, of tot ze ongeldig zijn |
| Boodschappen (product, aantal, categorie, notitie, gekocht ja/nee en wanneer) | Gedeelde lijst, "vaak gekocht" | Leden | Nee. "Toegevoegd door" en "gekocht door" vervallen (V-25) | Gearchiveerde lijsten 1 jaar (BR-45) |
| Offline cache en wachtrij (op het apparaat) | Offline werken | App | Ja | Tot uitloggen (BR-43) |

- **Bewust niet opgeslagen:**
  - wie een taak afvinkte (V-21);
  - toewijzingen en toewijzingshistorie;
  - punten en taakbelasting;
  - ruilverzoeken;
  - afwezigheid (V-24);
  - wie iets op de boodschappenlijst zette of kocht (V-25);
  - wachtwoorden (alleen bij Supabase Auth);
  - locatie, telefoonnummers, geboortedata en foto's;
  - invoer of persoonsgegevens in de eigen logs van de app. De toegangslogs van Supabase en Vercel vallen daarbuiten; zie BR-12 voor wat die bevatten en hoe lang.
- **Te verwijderen bij de overgang:** volgens BR-46: eerst een back-up, dan vlak vóór het wissen nogmaals bevestiging van Jurgen.
- **Verwijderen:**
  - ieder lid kan het eigen account verwijderen;
  - een beheerder kan leden verwijderen (voorkeur: deactiveren) en het hele huishouden;
  - oudere gegevens verdwijnen volgens de bewaartermijnen (BR-45).
- **Externe partijen:**
  - **Supabase:** database, authenticatie en e-mail. Het project staat in regio eu-central-1 (Frankfurt, EU) (V-20).
  - **Vercel:** hosting.
  - **Pushdiensten van Apple en Google:** de inhoud is versleuteld, maar bevat taaktitels.
  - **Supabase en Vercel** houden daarnaast eigen, kortdurende toegangslogs bij (BR-12).
  - Er zijn geen analytics, geen advertenties en geen AI-diensten.

## 9. Afhankelijkheden

| Afhankelijkheid | Waarvoor | Risico |
| --- | --- | --- |
| Supabase (PostgreSQL, Auth, Realtime) | Gegevens, inloggen, directe updates | Uitval betekent dat alleen de offline weergave overblijft |
| Vercel | Hosting | Het gratis plan draait cron maar één keer per dag (R-01) |
| Een planner die elke 15 minuten draait (pg_cron + pg_net in Supabase, of een externe cron) | Achtergrondtaak elke 15 minuten | **Staat nu niet aan** (V-04): pg_cron en pg_net zijn niet geïnstalleerd, en Vercel draait de taak één keer per dag. Juist de herinneringen zijn de kern van het doel "minder vergeten". De keuze voor een planner hoort in het technisch ontwerp |
| Web Push (VAPID) | Pushmeldingen | iPhone: alleen vanaf iOS 16.4 en na "Zet op beginscherm" |
| E-mail van Supabase Auth | Magic link, uitnodiging, wachtwoord vergeten | De standaardtemplates zijn Engels |
| Migratie van de live database | Van het huidige model (met toewijzing en personen) naar het nieuwe | Gegevens gaan onomkeerbaar verloren. Daarom eerst een back-up, en vlak vóór het wissen nogmaals bevestiging van Jurgen (BR-46) |

## 10. Bewust niet (nu)

- **Taken aan personen toewijzen, automatisch verdelen, om en om, ruilen:** besluit van Jurgen (V-21). De app laat zien wat er moet, en het gezin regelt zelf wie.
- **Bijhouden wie iets gedaan heeft, ranglijsten, punten, spaardoel:** besluit van Jurgen (V-21). Dat zou de discussie over eerlijkheid naar de app verplaatsen in plaats van haar te verminderen.
- **AI-functies:** "na de MVP" in de README. Kosten en privacy (gegevens naar een externe AI).
- **Agenda-, smart home- en WhatsApp/e-mailkoppelingen:** "na de MVP". Elke koppeling brengt geheimen, externe verplichtingen en extra review mee.
- **Inloggen met Google/Apple:** "na de MVP" (V-14). Wachtwoord en magic link volstaan voor één gezin.
- **Meerdere huishoudens per persoon:** besluit van Jurgen (V-08).
- **Een eigen indeling voor de computer of tablet:** alleen de telefoon is doelapparaat (V-07).
- **Een native app:** de PWA volstaat voor één gezin op de telefoon.

## 11. Succescriteria

Afgestemd op Jurgens doel (V-19): minder vergeten, en minder gevoel van oneerlijke verdeling, doordat zichtbaar is wat er moet en wanneer. Akkoord van Jurgen (V-27). Controleerbaar drie maanden na de livegang van de nieuwe versie:

1. **Minder vergeten:** het aandeel taken dat verlopen of overgeslagen is, is in maand 3 lager dan in maand 1.
   - **Zo gemeten:** het Overzicht toont maximaal 30 dagen, dus maand 1 is daar later niet meer af te lezen.
   - De bouwer bepaalt het cijfer met een alleen-lezen query op de afvinkhistorie en de overgeslagen of verlopen taken. Dat gebeurt op dag 30 en op dag 90 na de livegang van de nieuwe versie, en beide keren komt het cijfer in `docs/PROGRESS.md`.
   - Het cijfer is (verlopen + overgeslagen) / (alle taken met een geplande dag in die 30 dagen).
   - De query telt alleen, en leest geen personen.
2. **Op tijd:** minstens 80% van de afgevinkte taken is vóór de deadline gedaan. Te zien in de historie ("te laat").
3. **Dagelijks gebruik:** op minstens 5 van de 7 dagen per week wordt er iets afgevinkt. Dit is gemeten voor het huishouden als geheel; per persoon kan en mag het niet (V-21).
4. **Ervaren eerlijkheid:** Ellen en Jurgen geven na drie maanden aan dat er minder discussie is over wie wat doet. Dat is een gesprek, geen meting in de app, want de app meet dit bewust niet.
5. **Betrouwbaar:**
   - geen dubbele registraties;
   - geen taken die onterecht verdwijnen (B-01 opgelost en getest);
   - herinneringen komen binnen 15 minuten na het geplande moment (R-01 opgelost).
6. **Snel:**
   - afvinken is één tik, toevoegen minimaal *Naam · Wanneer?*;
   - afvinken, verplaatsen en "bezig" kosten maximaal twee tikken. Naam of andere details wijzigen mag vier à vijf tikken kosten (V-37; dit vervangt voor dat deel het overgenomen besluit "maximaal twee tikken");
   - op 390×844 zijn de verlopen taken en die van vandaag zichtbaar zonder te scrollen, bij een normale dag (tot ongeveer 6 taken).
7. **Privacy klopt:** de database bevat geen gegevens over wie een taak afvinkte. Geen kolom, en ook geen meldingstekst of ontvangerspatroon waaruit het af te leiden is (V-38). Dat is te controleren in het schema, op de inhoud van de meldingen en met een test. De toegangslogs van de platforms vallen erbuiten (BR-12).

## 12. Verwerkte antwoorden (V-04, V-05 t/m V-27)

| Vraag | Antwoord (zie `docs/PROGRESS.md`) | Verwerkt in |
| --- | --- | --- |
| V-04 | pg_cron en pg_net zijn niet geïnstalleerd; de achtergrondtaak draait alleen één keer per dag via `vercel.json` (bevestigt R-01) | BR-30, UC-08, §9. De oplossing hoort in het technisch ontwerp |
| V-05 | Alleen het eigen gezin | §2 |
| V-06 | Vooral Ellen en Jurgen; Lynn (15) en Kai (13) optioneel | §1, §2, §7 |
| V-07 | Telefoon (390×844) | §2, §10, §11 |
| V-08 | Eén huishouden per persoon | BR-44, §10 |
| V-09 | Reeksen: alleen beheerder en maker | BR-22 |
| V-10 | Iedereen mag afvinken | BR-23; "namens" vervalt door V-21 |
| V-11 | Vervangen door V-22 | BR-13 |
| V-12 | Voorstel gevolgd; door V-21 blijft alleen over dat aanmaken de instelling "taken maken" volgt | BR-20 |
| V-13 | Voorstel gevolgd | BR-23 |
| V-14 | Google/Apple-tekst weg, wachtwoord vergeten toevoegen | UC-10, UC-11 |
| V-15 | Account verwijderen, huishouden verwijderen, bij voorkeur deactiveren | UC-11, UC-12, §8 |
| V-16 | Uitgegaan van toewijzing; vervangen door V-23 | — |
| V-17 | Uitgegaan van afwezigheid; vervallen door V-24 | — |
| V-18 | Bewaartermijnen volgens voorstel | BR-45 |
| V-19 | Doel: oneerlijke verdeling en vergeten, zonder dat de app verdeelt | §0, §1, §11 |
| V-21 | Niemand toegewezen; niet bijhouden wie; punten weg | §0 en het hele document |
| V-20 | Het Supabase-project staat in eu-central-1 (Frankfurt, EU) | §8 |
| V-22 | Iedereen mag terugdraaien | BR-13 |
| V-23 | Meldingen naar ieder lid met een account, volgens de eigen instellingen; standaard aan voor Ellen en Jurgen, uit voor Lynn en Kai | UC-08, BR-31 |
| V-24 | Afwezigheid vervalt; bij een gezinsvakantie reeksen pauzeren | §0, §8, BR-45 |
| V-25 | Maker bewaren maar niet tonen; schrijver van een notitie tonen; "toegevoegd door" en "gekocht door" bij boodschappen weg; duur blijft als informatie | §0, §8 |
| V-26 | Eerst een back-up, dan wissen zoals voorgesteld (de afvinkhistorie blijft, zonder personen); vlak vóór het wissen nogmaals bevestiging van Jurgen | BR-46, §8, §9 |
| V-27 | Succescriteria akkoord | §11 |
| V-28 t/m V-35 | Navigatie, uitgezet lid, huisstijl, planner, back-up, notitienaam, inloginstellingen (zie PROGRESS) | UX_SPEC, TECHNICAL_DESIGN; hier §8 en BR-46 |
| V-36 | WP1 t/m WP3 meteen live; de nieuwe schermen (WP4 t/m WP8) samen live na WP9 | BR-46 |
| V-37 | Naam of details wijzigen mag 4 à 5 tikken; afvinken, verplaatsen en bezig blijven maximaal 2 | §11.6 |
| V-38 | "Taak gedaan" gaat naar iedereen die hem aan heeft, ook naar wie afvinkte (optie a) | BR-31 |
| V-39 | Tijdzone vast op Europe/Amsterdam, alleen zichtbaar | UC-12 |

## 13. Aannames en open vragen

**Aannames** (zonder invloed op rechten, gegevens, privacy, scope of gebruikerservaring):
- `[AANNAME]` De bestaande, geteste herhalingsregels (maandeinde, schrikkeljaar, n-de weekdag) zijn correct en blijven ongewijzigd (ook vastgelegd in PROGRESS).

**Open vragen:** geen.

## 14. Afvalkalender (W-03)

*Bevroren op 2026-10-01 (AAE-taak W03-AFVAL-001, GO van Jurgen). Bron: `docs/wijzigingen/W-03/product-analyst-r2.md`, deel 1; taaknamen volgens UX_SPEC §13.3.*

**Doel.** Het gezin heeft drie minicontainers: restafval, papier en PMD (V-55). Elke bak heeft een eigen ophaalritme, en de gemeente verschuift dat soms, bijvoorbeeld rond feestdagen. Nu moet iemand dat onthouden, en dat gaat mis ("met name door Jurgen", V-19).

De app leest daarom de huisvuilkalender van de gemeente Den Haag voor het adres van het huishouden. Per ophaaldag zet hij zelf twee taken klaar:
- de avond ervoor **buitenzetten**, met een herinnering om 21:00;
- op de ophaaldag **binnenzetten**, vanaf 12:00, met een herinnering om 18:00.

Niemand hoeft afvaltaken nog met de hand bij te houden.

**Besluiten van Jurgen (bindend):**

| Vraag | Besluit |
| --- | --- |
| V-41 | Keuze B: de app leest de kalender zelf in, uit huisvuilkalender.denhaag.nl |
| V-43 | Alleen rest, papier en PMD; geen GFT |
| V-42/V-44 | Herinnering om 21:00 op de avond vóór de ophaaldag |
| V-45 | Postcode en huisnummer mogen worden bewaard |
| V-46 | Eigen werkpakket direct na WP3, in de huidige schermen |
| V-47 | Ook een taak "binnenzetten" op de ophaaldag, vanaf de middag |
| V-48 | Binnenzetten vanaf 12:00, uiterlijk het einde van de ophaaldag, herinnering om 18:00 |
| V-49 | De herinnering blijft om 21:00. De taak zegt "mag vanaf 22:00 buiten, uiterlijk 07:45" |
| V-50 | De afvalherinnering volgt de instelling "Herinneringen". Afvaltaken krijgen geen "deadline nadert" en geen "verlopen". Lukt bijwerken meer dan 48 uur niet: één melding aan de beheerders |
| V-51 | Meerdere bakken op één dag: één gecombineerde taak |
| V-52 | 14 dagen vooruit |
| V-53 | Het adres is alleen voor beheerders (invullen, wijzigen, zien). Gezinsleden zien alleen "Afvalkalender staat aan" |
| V-54 | Afvaltaken zijn niet te hernoemen, te verplaatsen of te verwijderen. Afvinken, "bezig", een notitie en "deze keer overslaan" mogen wel. Een vergeten buitenzet-taak vervalt na de ophaaldag vanzelf |
| V-55 | Rest, papier en PMD zijn alle drie containers, dus er is altijd een binnenzet-taak |
| V-56 | De bestaande handmatige reeks "Afvalcontainer buiten zetten" stopt Jurgen zelf zodra de afvalkalender werkt |

**Gebruikers en rollen**
- **Beheerder** (in het ontwerp Ellen en Jurgen; op live nu alleen Jurgen, omdat leden zonder account sinds WP2b niet meer bestaan):
  - zet de afvalkalender aan en voert het adres in;
  - wijzigt het adres of zet de afvalkalender uit;
  - ziet het adres en of de kalender goed wordt bijgewerkt;
  - krijgt de storingsmelding (BR-52).
- **Gezinslid** (Lynn en Kai, als ze een account krijgen):
  - ziet de afvaltaken en handelt ze af, net als andere taken (BR-53);
  - ziet in Instellingen alleen "Afvalkalender staat aan", zonder adres en zonder status (V-53).
- **Wie het resultaat ziet zonder het te gebruiken:** de gemeente Den Haag en haar leverancier van de huisvuilkalender (Opzet). Zij krijgen bij elke opvraging alleen het adres (BR-58).
- **Het adres hoort bij het huishouden,** niet bij de beheerder die het invoerde. Verwijdert die beheerder zijn account, dan blijft het adres staan.

**Use cases**

*UC-13 — Afvalkalender instellen (beheerder)*
- **Begin:** Instellingen, onderdeel Huishouden, "Afvalkalender".
- **Stappen:**
  1. De beheerder vult postcode en huisnummer in, eventueel met een huisletter of toevoeging.
  2. De app zoekt het adres op in de huisvuilkalender van Den Haag.
  3. De app toont ter controle het gevonden adres, zoals de gemeente het teruggeeft, en de eerstvolgende ophaaldag per bak ("Klopt dit?").
  4. De beheerder bevestigt.
- **Eind:** het adres is bewaard, en de afvaltaken voor de komende 14 dagen staan klaar (BR-49, BR-50).
- **Wat kan misgaan** (in al deze gevallen wordt niets bewaard, en de beheerder krijgt een duidelijke uitleg in gewone taal, BR-48):
  - het formaat is ongeldig;
  - het adres is onbekend, of ligt buiten Den Haag;
  - onder dit nummer vallen meerdere adressen, en er is geen letter of toevoeging opgegeven;
  - het adres heeft geen ophaaldagen voor rest, papier of PMD, bijvoorbeeld bij een ondergrondse container;
  - de bron is onbereikbaar ("Probeer het later opnieuw").

*UC-14 — Afvaltaken afhandelen (iedereen)*
- **Buitenzetten:**
  - de taak staat op de dag vóór de ophaaldag op Vandaag, gepland om 21:00, met de tekst "Mag vanaf 22:00 buiten, uiterlijk 07:45";
  - om 21:00 komt de herinnering;
  - wie de bak buitenzet, vinkt de taak af.
- **Binnenzetten:**
  - de taak staat op de ophaaldag klaar vanaf 12:00;
  - om 18:00 komt de herinnering, als de taak nog open is;
  - wie de bak binnenzet, vinkt de taak af.
- Afvinken werkt zoals bij elke taak: één tik, zonder dat de app bijhoudt wie het deed (BR-12).
- Staat de bak deze keer niet buiten, dan kan iemand buitenzetten "deze keer overslaan". Binnenzetten van dezelfde ophaaldag vervalt dan ook (BR-53).

*UC-15 — Afvalkalender wijzigen of uitzetten (beheerder)*
- Bij een verhuizing wijzigt de beheerder het adres. Hij kan de afvalkalender ook uitzetten, na een bevestiging (BR-56).
- Daarnaast ziet de beheerder de stand van het bijwerken:
  - wanneer de kalender voor het laatst is bijgewerkt;
  - de eerstvolgende ophaaldag per bak;
  - bij een storing een waarschuwing (BR-52).

**Businessregels**

- **BR-47 — Bron en bakken.**
  - De enige bron is de huisvuilkalender van de gemeente Den Haag.
  - De app maakt alleen taken voor **restafval, papier en PMD** (V-43). GFT, grofvuil, kerstbomen en andere soorten worden genegeerd, ook als de gemeente ze voor het adres noemt.
  - Alle drie de bakken zijn containers (V-55). Elke ophaaldag geeft dus zowel buitenzetten als binnenzetten.
  - Er is geen schakelaar per bak (zie "Bewust niet").

- **BR-48 — Het adres.**
  - Per huishouden is er hooguit **één** adres: postcode, huisnummer en een optionele huisletter of toevoeging.
  - Alleen een **beheerder** mag het invoeren, wijzigen of verwijderen (V-53).
  - **Invoer en controle:**
    - De postcode wordt genormaliseerd: hoofdletters, met of zonder spatie ("2511ab" wordt "2511 AB"). Toegestaan zijn 4 cijfers (niet beginnend met 0) en 2 letters.
    - Het huisnummer is een geheel getal van 1 t/m 99999.
    - Een letter of toevoeging moet mogelijk zijn ("12A", "12-2", "12 bis").
  - **Wanneer het adres wordt bewaard:** pas nadat de huisvuilkalender het adres kent, precies één adres oplevert en minstens één ophaaldag geeft voor rest, papier of PMD, én de beheerder "Klopt dit?" heeft bevestigd. — waarom: een fout adres geeft stil verkeerde of geen taken, en dan vergeet het gezin juist de bak.
  - **Meerdere adressen onder hetzelfde nummer** (letters of toevoegingen) en geen toevoeging opgegeven: de app kiest **nooit** zelf. Hij vraagt om de letter of toevoeging.
  - **Bron onbereikbaar tijdens het instellen:** er wordt **niets** bewaard, en de beheerder ziet "De huisvuilkalender is nu niet bereikbaar. Probeer het later opnieuw." Is er al een adres, dan blijft dat ongewijzigd.
  - Een gezinslid (of een uitgezet lid, of iemand van buiten) kan het adres niet invoeren, wijzigen of verwijderen, ook niet met een direct verzoek.

- **BR-49 — Welke taken er per ophaaldag ontstaan.** Voor elke ophaaldag D waarop minstens één van de drie bakken wordt opgehaald, maakt het systeem precies twee taken.
  - **Buitenzetten:**
    - gepland op D−1 om 21:00;
    - herinnering om 21:00 (V-44);
    - deadline: D om 07:45, de uiterste aanbiedtijd van de gemeente. Afvinken na 07:45 telt als te laat (BR-12);
    - de taak toont "Mag vanaf 22:00 buiten, uiterlijk 07:45" (V-49). De herinnering noemt dat ook. — waarom: de herinnering komt vóór de toegestane tijd, en te vroeg buitenzetten kan een boete geven.
  - **Binnenzetten:**
    - gepland op D;
    - beschikbaar vanaf D 12:00;
    - deadline: het einde van D;
    - herinnering om 18:00 op D (V-48);
    - afvinken vóór 12:00 mag wel, bijvoorbeeld als de bak al vroeg geleegd en binnengezet is.
  - **Meerdere bakken op dezelfde dag (V-51):**
    - per richting (buiten of binnen) komt er **één** taak, met alle bakken in de naam, in de vaste volgorde restafval, papier, PMD. Bijvoorbeeld "Restafval en papier buitenzetten", of "Restafval-, papier- en PMD-bak binnenzetten" (exacte namen: UX_SPEC §13.3);
    - er komt één herinnering, niet één per bak.
  - **Alleen het systeem maakt afvaltaken:**
    - de taken zijn van het hele huishouden, zonder toewijzing (V-21), en zonder maker die een lid is;
    - de instelling "Gezinsleden mogen taken maken" (BR-20) geldt er niet voor;
    - geen lid kan zelf een taak maken die als afvaltaak geldt. Een handmatige taak die "afval" heet, is en blijft een gewone taak (BR-57).
  - Afvaltaken tellen mee zoals andere taken: in Vandaag, Taken, Kalender, het dag- en avondoverzicht, het Overzicht en de historie.

- **BR-50 — Vooruit plannen en nooit dubbel.**
  - Er staan altijd afvaltaken klaar voor elke ophaaldag van **vandaag t/m vandaag + 14 dagen** (V-52), net als bij BR-02. Verder vooruit worden ze niet gemaakt.
  - Per huishouden, ophaaldag en richting (buiten of binnen) bestaat **nooit** meer dan één afvaltaak. Dat blijft zo:
    - bij herhaald bijwerken;
    - als twee achtergrondrondes elkaar overlappen;
    - bij dubbel bevestigen;
    - als twee beheerders tegelijk opslaan.
  - Een taak waarvan het moment al voorbij is, wordt niet meer aangemaakt:
    - buitenzetten alleen zolang het nog vóór D 07:45 is;
    - binnenzetten alleen zolang het nog vóór het einde van D is.
  - Een herinnering bij een laat aangemaakte taak volgt BR-31: ze komt alleen als het moment niet meer dan 90 minuten voorbij is.

- **BR-51 — De gemeente-agenda is leidend.**
  - De app controleert de agenda minstens één keer per dag. Een wijziging staat uiterlijk 24 uur later in de app.
  - **Open** afvaltaken (niet afgevinkt en niet overgeslagen) volgen de agenda:
    - een verschoven ophaaldag verschuift de taken mee, bijvoorbeeld bij een feestdag;
    - verdwijnt een ophaaldag, dan vervallen de open taken. Ze tellen niet als vergeten of overgeslagen, en komen niet in de historie;
    - bij een nieuwe ophaaldag komen er taken bij;
    - komt er op een dag een bak bij of valt er een weg, dan past de naam van de open gecombineerde taak zich aan.
  - Afgevinkte en overgeslagen afvaltaken worden bij het bijwerken **nooit** gewijzigd of verwijderd.
  - Is buitenzetten al afgevinkt, en verdwijnt of verschuift de ophaaldag daarna, dan **blijft binnenzetten** voor die dag staan: de bak staat immers buiten. Bij een verschuiving komen er ook taken voor de nieuwe dag.

- **BR-52 — Nooit gokken, nooit stil falen.**
  - **De bron is onbereikbaar of geeft onbruikbare gegevens:**
    - de afvaltaken en het adres blijven ongewijzigd;
    - de app maakt **nooit** zelf ophaaldagen aan op basis van een vermoed patroon;
    - de andere taken van de achtergrondtaak lopen gewoon door;
    - later volgt een nieuwe poging.
  - **Een volledig leeg antwoord:** geeft de bron voor alle drie de bakken samen geen enkele ophaaldag in de komende 14 dagen, terwijl er eerder wel ophaaldagen in dat bereik bekend waren, dan geldt dat als storing, en niet als "alle ophaaldagen vervallen". Bijvoorbeeld bij de jaarwisseling, als de nieuwe kalender nog niet online staat.
    - Een enkele bak zonder ophaaldagen geldt **niet** als storing. Voorbeeld: papier wordt van 19 december tot 5 januari niet opgehaald.
  - **Langer dan 48 uur geen geslaagde bijwerking** (V-50), of een volledig leeg antwoord zoals hierboven:
    - de beheerders zien in Instellingen "Afvalkalender niet bijgewerkt sinds <datum>";
    - elke actieve beheerder krijgt **één** melding: "De afvalkalender kon niet worden bijgewerkt. Kijk voor de zekerheid zelf op de site van de gemeente." De melding linkt naar Instellingen (BR-25) en wordt pas opnieuw verstuurd na een nieuwe storing.
    - Gezinsleden krijgen geen melding en zien geen waarschuwing (V-53).
  - **Lukt het weer,** dan verdwijnt de waarschuwing en wordt de planning aangevuld.
  - — waarom: stil wegvallende taken zijn erger dan geen functie, omdat het gezin erop vertrouwt.

- **BR-53 — Wat leden met afvaltaken mogen (V-54).**
  - **Mag, voor iedereen in het huishouden:**
    - afvinken;
    - terugdraaien (BR-13);
    - "bezig" (BR-14);
    - een notitie plaatsen;
    - "deze keer overslaan", en dat ongedaan maken.
  - **Mag niet, voor niemand (ook niet voor een beheerder):**
    - hernoemen;
    - datum of tijd wijzigen;
    - verplaatsen;
    - verwijderen;
    - andere details wijzigen (omschrijving, deadline, herinneringen, prioriteit);
    - omzetten naar een terugkerende taak.
  - De gemeente bepaalt de dag. Dit wijkt voor afvaltaken af van BR-23.
  - **Overslaan werkt door:** slaat iemand buitenzetten over, dan wordt binnenzetten van dezelfde ophaaldag ook overgeslagen. Wordt dat overslaan ongedaan gemaakt, dan staan beide weer open. Dit geldt niet voor het automatisch vervallen uit BR-54.
  - **Los afvinken:** buitenzetten en binnenzetten worden los van elkaar afgevinkt en teruggedraaid. Het ene sluit het andere niet af.

- **BR-54 — Verlopen en vervallen.**
  - **Buitenzetten:**
    - verlopen na D 07:45 (BR-17);
    - niet afgevinkt aan het einde van D? Dan wordt de taak vanzelf "overgeslagen", en telt als vergeten (V-54, vergelijk BR-16).
    - Binnenzetten van die dag blijft daarbij gewoon staan.
  - **Binnenzetten:**
    - verlopen na het einde van D;
    - blijft bij Verlopen staan tot iemand de taak afvinkt, of tot de dag van de volgende buitenzet-taak begint. Dan wordt hij vanzelf overgeslagen, en telt als vergeten.

- **BR-55 — Meldingen (V-50).**
  - **Herinneringen:**
    - de herinneringen van 21:00 (buitenzetten) en 18:00 (binnenzetten) volgen ieders bestaande instelling "Herinneringen" (BR-31, V-23): standaard aan voor beheerders, standaard uit voor gezinsleden. Er is geen aparte schakelaar;
    - een herinnering komt alleen als de taak op dat moment nog open is (niet afgevinkt en niet overgeslagen).
  - Afvaltaken krijgen **geen** "deadline nadert" en **geen** "verlopen". — waarom: die zouden onder meer om 05:45 's nachts komen.
  - Verder gelden de regels van BR-31:
    - versturen binnen 90 minuten na het moment, anders vervalt de melding;
    - nooit dubbel;
    - "taak gedaan" volgens de eigen instelling.
  - De storingsmelding uit BR-52 gaat naar elke actieve beheerder, ongeacht zijn meldingsvoorkeuren, en per push als die voor dat apparaat aan staat.
  - Meldingsteksten noemen de bak en de dag, **nooit het adres** en nooit de naam van een lid.

- **BR-56 — Uitzetten en adres wijzigen.**
  - **Uitzetten** door een beheerder, na een bevestiging:
    - het adres, de opgehaalde ophaaldagen en de stand van het bijwerken worden direct gewist;
    - alle open afvaltaken vervallen, zonder als vergeten te tellen;
    - afgevinkte en overgeslagen afvaltaken blijven in de historie (BR-12);
    - weer aanzetten betekent het adres opnieuw invoeren (UC-13).
  - **Adres wijzigen:**
    - het nieuwe adres doorloopt dezelfde controle (BR-48);
    - pas na de bevestiging vervallen de open afvaltaken van het oude adres, en komen de taken voor het nieuwe adres ervoor in de plaats;
    - mislukt de controle, of annuleert de beheerder, dan blijven het oude adres en de oude taken ongewijzigd.

- **BR-57 — Handmatige taken blijven ongemoeid (V-56).**
  - De afvalkalender raakt bestaande, handmatig gemaakte taken en reeksen **nooit** aan, ook niet als ze "afval", "container" of "bak" heten. De app herkent ze niet.
  - De bestaande reeks "Afvalcontainer buiten zetten" op live stopt Jurgen zelf zodra de afvalkalender werkt. De bouwer herinnert hem daar na de livegang één keer aan.
  - Tot Jurgen de reeks stopt, staan er dubbele afvaltaken. Dat is bewust geaccepteerd.

- **BR-58 — Privacy van het adres (V-45, V-53).**
  - **Wat bewaard wordt:**
    - alleen postcode, huisnummer, huisletter of toevoeging, en de adrescode die de gemeente teruggeeft (BAG-id);
    - straat en plaats worden **niet** bewaard. Ze worden alleen getoond bij "Klopt dit?".
  - **Wie het adres ziet:** het adres en de adrescode zijn alleen zichtbaar voor **beheerders** van het eigen huishouden (V-53).
    - Gezinsleden zien alleen of de afvalkalender aan staat.
    - Andere huishoudens zien **nooit** iets (BR-26).
    - Dit wijkt af van §7 ("ieder lid ziet alles").
  - **Wat naar buiten gaat:** alleen het adres of de adrescode, en alleen naar de huisvuilkalender van Den Haag. Nooit met een naam, e-mailadres, id van het huishouden of andere gegevens.
  - **Waar het adres nooit komt:**
    - in meldingen;
    - in pushinhoud;
    - in taaknamen of de historie;
    - in de eigen logregels van de app (BR-12).
  - **Wanneer het verdwijnt:** bij uitzetten (BR-56) en bij het verwijderen van het huishouden.

- **BR-59 — Tijd.**
  - Alle momenten zijn kloktijden in Europe/Amsterdam (BR-40): 21:00, 22:00, 07:45, 12:00, 18:00 en het einde van de dag.
  - Ze blijven dezelfde kloktijd bij de overgang naar zomer- of wintertijd, ook als die overgang tussen D−1 21:00 en D 07:45 valt.

### 14.1 Aanvullingen op bestaande secties (W-03)

Deze aanvullingen gelden naast de tekst van §5 t/m §13 en gaan bij strijd voor.

**§5, onderaan "Overig", één regel erbij:**
> - **BR-47 t/m BR-59 — Afvalkalender:** zie §14 (W-03).

**§5, notities achter bestaande regels (bewuste afwijkingen voor afvaltaken):**
- **Achter BR-23:** *(voor afvaltaken geldt BR-53: niemand wijzigt, verplaatst of verwijdert ze)*
- **Achter BR-30:**
  - *(sinds W-03 doet de achtergrondtaak ook: de afvalkalender minstens één keer per dag bijwerken en de afvaltaken plannen, BR-50 t/m BR-52)*;
  - de zin "Hij doet vier dingen" wordt "Hij doet vijf dingen".
- **Achter BR-31:** *(afvaltaken: geen "deadline nadert" en geen "verlopen"; wel de storingsmelding voor beheerders, BR-52 en BR-55)*

**§6 Randgevallen, rijen erbij:**

| Geval | Bedoeld gedrag |
| --- | --- |
| Ophaaldag verschoven door een feestdag | Open afvaltaken schuiven mee (BR-51) |
| Twee of drie bakken op dezelfde dag | Eén buitenzet-taak en één binnenzet-taak, met alle bakken in de naam (BR-49) |
| Ophaaldag verdwijnt uit de agenda | Open taken vervallen, zonder als vergeten te tellen. Was buitenzetten al afgevinkt, dan blijft binnenzetten staan (BR-51) |
| Nieuwe ophaaldag pas laat ontdekt | De taak komt er alsnog. De herinnering gaat mee als het moment niet meer dan 90 minuten voorbij is. Na D 07:45 komt er geen buitenzet-taak meer, na het einde van D geen binnenzet-taak (BR-50) |
| Adres ongeldig, buiten Den Haag, zonder bakken, of dubbelzinnig | Niets bewaard, met uitleg; bij een dubbelzinnig adres de vraag om een letter of toevoeging (BR-48) |
| Bron onbereikbaar bij instellen | Niets bewaard: "Probeer het later opnieuw" (BR-48) |
| Bron onbereikbaar tijdens het bijwerken | Niets gewijzigd en niets verzonnen. Na 48 uur een waarschuwing en één melding aan de beheerders (BR-52) |
| Jaarwisseling zonder nieuwe kalender | Hetzelfde als een onbereikbare bron (BR-52) |
| Papier wordt rond de kerst niet opgehaald | Geen storing. Er zijn gewoon geen papiertaken (BR-52) |
| Buitenzetten vergeten | Na D 07:45 verlopen, aan het einde van D vanzelf overgeslagen (telt als vergeten). Binnenzetten blijft staan (BR-54) |
| Bak deze keer niet buitengezet | "Deze keer overslaan" bij buitenzetten slaat binnenzetten ook over (BR-53) |
| Zomer- of wintertijd | Dezelfde kloktijden (BR-59) |
| Twee beheerders slaan tegelijk een adres op | Het laatst bevestigde adres geldt. Er zijn nooit taken voor twee adressen tegelijk (BR-50) |
| Handmatige afvalreeks bestaat ook | Blijft ongemoeid, dus dubbel tot Jurgen hem stopt (BR-57) |

**§7 Rollen en rechten, rijen erbij in de tabel:**

| Actie | Beheerder | Gezinslid |
| --- | --- | --- |
| Afvalkalender aanzetten, adres invoeren of wijzigen, uitzetten | Ja | Nee |
| Adres zien | Ja | Nee: alleen "Afvalkalender staat aan" (V-53) |
| Stand van het bijwerken zien (laatste keer gelukt, waarschuwing) | Ja | Nee |
| Storingsmelding afvalkalender ontvangen | Ja | Nee |
| Afvaltaak afvinken, terugdraaien, bezig, notitie, deze keer overslaan | Ja | Ja |
| Afvaltaak hernoemen, wijzigen, verplaatsen, verwijderen, omzetten naar een reeks | Nee | Nee (BR-53) |
| Zelf een afvaltaak aanmaken | Nee, alleen het systeem | Nee, alleen het systeem |

**§7, bij "Mag nooit", erbij:**
- een gezinslid ziet het adres van het huishouden;
- iemand wijzigt, verplaatst of verwijdert een afvaltaak.

**§7, bij "Isolatie", de tweede regel wordt:**
> Binnen het huishouden ziet ieder lid alles, **behalve** de meldingen, meldingsvoorkeuren en pushapparaten van een ander, en het adres van de afvalkalender (alleen voor beheerders, V-53).

**§8 Gegevens, rijen erbij in de tabel:**

| Gegeven | Waarom nodig | Bron | Persoonsgegeven | Bewaren tot |
| --- | --- | --- | --- | --- |
| Adres afvalkalender (postcode, huisnummer, letter of toevoeging) | Ophaaldagen opvragen | Beheerder | Ja: het woonadres van een gezin met minderjarigen | Tot uitzetten of het verwijderen van het huishouden (BR-56, BR-58) |
| Adrescode van de gemeente (BAG-id) | Ophaaldagen opvragen zonder steeds het adres te sturen | Gemeente Den Haag | Ja, want hij wijst één adres aan. Zelfde behandeling als het adres | Als het adres |
| Opgehaalde ophaaldagen (datum, bak) | Taken maken en wijzigingen herkennen | Gemeente Den Haag | Nee (alleen via het adres herleidbaar) | Alleen komende dagen. Voorbije dagen worden opgeruimd; ze leven voort als taak of historie |
| Stand van het bijwerken (laatste poging, laatste succes, foutcode, storingsmelding verstuurd ja/nee) | Beheerders waarschuwen (BR-52) | Systeem | Nee | Tot uitzetten |
| Afvaltaken en hun afvinkingen | Zoals bij andere taken | Systeem | Nee | Zoals bij andere taken (BR-45) |

**§8, bij "Bewust niet opgeslagen", erbij:**
- straat en plaats van het adres;
- coördinaten;
- de ruwe antwoorden van de gemeentebron.

**§8, bij "Externe partijen", erbij:**
- **Gemeente Den Haag, via haar leverancier van de huisvuilkalender (Opzet):**
  - krijgt bij elke opvraging het adres of de adrescode, vanaf de server van de app, minstens één keer per dag;
  - krijgt geen namen, e-mailadressen of andere gegevens van het huishouden;
  - de app gebruikt de openbare gegevens van de site. Er is geen officiële koppeling of overeenkomst.

**§9 Afhankelijkheden, rijen erbij:**

| Afhankelijkheid | Waarvoor | Risico |
| --- | --- | --- |
| Huisvuilkalender Den Haag (platform Opzet) | Ophaaldagen per adres | Onofficiële, ongedocumenteerde bron: kan zonder aankondiging veranderen of uitvallen. Opvang via BR-52. Vanuit de ontwikkelomgeving nu niet bereikbaar (V-57) |
| Planner elke 15 minuten (WP3) | Dagelijks bijwerken, planning en herinneringen om 21:00 en 18:00 | Zonder WP3 geen tijdige herinnering. Daarom komt dit werkpakket na WP3 (V-46) |

**§10 Bewust niet:**

De regel over agendakoppelingen wordt:
> - **Agenda-, smart home- en WhatsApp/e-mailkoppelingen:** "na de MVP". Elke koppeling brengt geheimen, externe verplichtingen en extra review mee. **Uitzondering:** de afvalkalender van de gemeente Den Haag (W-03, besluit van Jurgen, §14).

Erbij:
- **GFT, grofvuil, kerstbomen en de berichten van de gemeente over storingen:** Jurgen noemde alleen rest, papier en PMD (V-43).
- **Andere gemeenten of meerdere adressen:** alleen het eigen gezin in Den Haag (V-05, V-08).
- **Een schakelaar per bak, of eigen tijden per bak:** drie vaste bakken en vaste tijden houden het eenvoudig. Niemand heeft erom gevraagd.
- **Afvaltaken zelf wijzigen of verplaatsen:** de gemeente bepaalt de dag, en een verplaatste taak is niet meer bij te houden (V-54).
- **Koppeling met Google-agenda, of export als iCal:** vraagt een extra inlogkoppeling (W-03, optie verworpen).
- **Handmatige afvaltaken automatisch herkennen en opruimen:** de app zou op titels moeten gokken, en dan kan er een verkeerde taak verdwijnen (BR-57, V-56).
- **Een melding "bak niet opgehaald":** de app weet niet of de gemeente de bak echt geleegd heeft.
- **Controleren of de bak op de toegestane tijd buiten staat:** de app kan dat niet weten. Hij noemt alleen de regel (BR-49).

**§11 Succescriteria, erbij als "Afvalkalender (W-03)":** drie maanden na de livegang van WP3b, gecontroleerd door de bouwer op dag 30 en dag 90, met alleen-lezen queries. Het resultaat komt in `docs/PROGRESS.md`.
1. **Compleet:** elke ophaaldag van rest, papier en PMD in de gemeente-agenda binnen de komende 14 dagen heeft precies één buitenzet-taak en één binnenzet-taak, met de juiste bakken in de naam. Dit wordt gecontroleerd door het te vergelijken met de site van de gemeente.
2. **Op tijd buiten:** minstens 90% van de buitenzet-taken in die periode is vóór 07:45 op de ophaaldag afgevinkt. Dat is af te lezen aan "te laat" in de historie.
3. **Betrouwbaar:**
   - geen dubbele afvaltaken;
   - geen ophaaldag die stil ontbrak;
   - elke storing van meer dan 48 uur was voor de beheerders zichtbaar (BR-52).
4. **Ervaren:** Jurgen geeft aan dat er in die drie maanden geen bak is blijven staan doordat iemand hem vergat. Dat is een gesprek, geen meting.

**§12 Verwerkte antwoorden, rijen erbij:**

| Vraag | Antwoord (zie `docs/PROGRESS.md`) | Verwerkt in |
| --- | --- | --- |
| V-41 t/m V-44 | Keuze B, bron Den Haag, rest/papier/PMD, herinnering om 21:00 | §14, BR-47, BR-49 |
| V-45 | Het adres mag worden bewaard | BR-48, BR-58, §8 |
| V-46 | Eigen werkpakket na WP3, in de huidige schermen | §9, AC-217 |
| V-47 | Ook binnenzetten, vanaf de middag | BR-49 |
| V-48 | Binnenzetten vanaf 12:00, uiterlijk het einde van de dag, herinnering 18:00 | BR-49, BR-55 |
| V-49 | Herinnering om 21:00, met de tekst "mag vanaf 22:00 buiten, uiterlijk 07:45" | BR-49 |
| V-50 | Volgt "Herinneringen"; geen "deadline nadert" of "verlopen"; storing > 48 uur: één melding aan de beheerders | BR-52, BR-55 |
| V-51 | Eén gecombineerde taak per dag | BR-49 |
| V-52 | 14 dagen vooruit | BR-50 |
| V-53 | Adres alleen voor beheerders | BR-48, BR-58, §7 |
| V-54 | Niet hernoemen, verplaatsen of verwijderen; wel afvinken, bezig, notitie, overslaan; vergeten buitenzetten vervalt vanzelf | BR-53, BR-54 |
| V-55 | Alle drie containers | BR-47, BR-49 |
| V-56 | Jurgen stopt de handmatige reeks zelf | BR-57 |
| V-57 | Uitleg over de netwerkinstelling (technisch) | §9 |

**§13 Aannames, erbij:**
- `[AANNAME]` De taaknamen gebruiken de woorden "Restafval", "Papier" en "PMD" plus "buitenzetten" of "binnenzetten". De precieze woorden en de categorie kiest de product-designer (UX_SPEC §13.3, exacte namen). De regel "één taak met alle bakken in de naam" staat vast (BR-49).
