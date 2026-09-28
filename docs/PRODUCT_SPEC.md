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
