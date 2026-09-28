# Productspecificatie — Takenlijstje

Versie: ronde 1 (2026-09-28) · Kwaliteitsniveau 2 · Werkwijze §15, stap 3 (bestaand project).
Status: **wacht op antwoorden** (zie §12). Nog niet bevroren.

**Bronnen.** Dit document beschrijft het product zoals het bedoeld is. De basis is:
- de vastgelegde besluiten in `README.md` en `docs/ARCHITECTUUR.md` (bevestigd door Jurgen, V-02);
- `docs/INVENTARIS.md`;
- de huidige code, gelezen om bestaande regels exact vast te leggen: `supabase/migrations/*`, `src/domain/**`, `src/server/**`.

Er zijn geen nieuwe functies bedacht. Waar de code afwijkt van de bedoelde regel, staat de bedoelde regel hier. De bevinding uit `docs/INVENTARIS.md` §7 staat erbij, bijvoorbeeld *(afwijking: B-01)*.

**Nummering.** Businessregels heten hier **BR-nn**. Zo lopen ze niet door elkaar met de bevindingen R-01 t/m R-03 in de inventaris. Use cases heten **UC-nn**.

---

## 1. Probleem

- **De situatie.** In een gezin met meerdere volwassenen en kinderen is het huishouden verdeeld over veel kleine, terugkerende taken: vaatwasser, afval, badkamer, boodschappen, dieren, gras. Nu is het vaak onduidelijk:
  - wie wat doet, en wie aan de beurt is;
  - wat al gedaan is;
  - wat vergeten wordt.
- **Wat dat kost:**
  - dubbel werk ("had jij de vaatwasser al gedaan?");
  - vergeten taken, zoals de container die niet buiten staat;
  - discussie over een scheve verdeling;
  - een ouder die alles moet onthouden en blijft herinneren.
- **Hoe vaak.** Dagelijks, meerdere keren per dag, meestal kort en tussendoor.
- **Welke handeling het mogelijk moet maken:**
  1. Iedereen ziet bij het openen direct wat hij vandaag moet doen, wat de rest moet doen, wat al gedaan is en wat achterloopt.
  2. Een taak is in één tik afgevinkt, en de rest van het huishouden ziet dat meteen.
  3. Het werk wordt eerlijk en voorspelbaar verdeeld, zonder dat één persoon het elke keer handmatig moet regelen.
  4. Wie iets niet kan, geeft het met weinig moeite door.

`[OPEN: V-19]`: welk probleem woog voor Jurgen het zwaarst toen de app gebouwd werd? Dat bepaalt de succescriteria (§11).

## 2. Gebruikers

| Gebruiker | Primair/secundair | Context (waar, apparaat, tijd, voorkennis) | Doel |
| --- | --- | --- | --- |
| **Beheerder** (bijv. ouder die het huishouden aanmaakt) | Primair | Thuis en onderweg, op de telefoon (vastgelegd besluit). Kort en tussendoor, af en toe langer om in te richten. Gemiddelde digitale vaardigheid | Taken inrichten en verdelen, overzicht houden, gezinsleden beheren, zelf taken doen |
| **Gezinslid met account** (partner, oudere kinderen) | Primair | Op de eigen telefoon, kort en tussendoor | Zien wat hij moet doen, afvinken, ruilen, boodschappen bijhouden |
| **Kind zonder account** (bijv. Kai in de voorbeelddata) | Secundair: heeft taken, maar gebruikt de app niet zelf | Een ouder of huisgenoot vinkt namens hem af | Weten wat hij moet doen; zijn werk telt mee |
| **Nieuw uitgenodigd lid** | Secundair, eenmalig | Opent een uitnodigingslink, vaak op de telefoon | Aansluiten bij het huishouden |

- **Welke apparaten precies**, of er een gedeeld apparaat is (zoals een tablet in de keuken) en of de app als geïnstalleerde app op het beginscherm staat, is niet bevestigd `[OPEN: V-07]`.
- **Wie de gebruikers zijn**, en of de app ook voor andere huishoudens bedoeld is, is niet bevestigd `[OPEN: V-05]`, `[OPEN: V-06]`.

## 3. Jobs-to-be-done

- Als **gezinslid** wil ik bij het openen meteen zien wat ík vandaag moet doen, zodat ik niets vergeet en niet hoef te zoeken, **wanneer** ik 's ochtends of na school/werk even op mijn telefoon kijk.
- Als **gezinslid** wil ik een taak met één tik afvinken, zodat de anderen weten dat het gedaan is, **wanneer** ik net klaar ben en de telefoon in de hand heb, ook zonder internet.
- Als **gezinslid** wil ik een taak die ik niet kan doen doorgeven, zodat hij toch gebeurt zonder dat ik iedereen moet appen, **wanneer** er iets tussenkomt.
- Als **beheerder** wil ik terugkerende taken één keer instellen, met een verdeling (vast, om en om, willekeurig of eerlijk), zodat de planning vanzelf doorloopt, **wanneer** ik het huishouden inricht of iets verandert.
- Als **beheerder** wil ik zien wie hoeveel doet en wat vaak vergeten wordt, zodat ik de verdeling kan bijsturen en discussie voorkom, **wanneer** we als gezin terugkijken, bijvoorbeeld wekelijks.
- Als **ouder** wil ik taken van een kind zonder telefoon namens hem afvinken, zodat zijn werk meetelt, **wanneer** hij iets gedaan heeft.
- Als **gezinslid** wil ik mijn afwezigheid (vakantie) invoeren, zodat mijn taken in die periode vanzelf door een ander worden gedaan, verschuiven of vrijkomen, **wanneer** ik weg ga.
- Als **gezinslid** wil ik snel iets op de boodschappenlijst zetten en in de winkel afvinken, zodat we niets vergeten, **wanneer** ik iets zie opraken of in de winkel sta.
- Als **gezinslid** wil ik een melding krijgen als een taak van mij bijna moet of verlopen is, zodat ik er op tijd aan denk, **wanneer** ik de app niet open heb.

## 4. Use cases

### UC-01 — Vandaag bekijken (kernflow, deel 1)
- **Begin:** een ingelogde gebruiker opent de app.
- **Stappen:** het openingsscherm toont:
  - wat verlopen is;
  - wat vandaag voor mij staat;
  - wat de rest vandaag moet doen;
  - wat al gedaan is;
  - wat binnenkort komt;
  - de voortgang van het huishouden, en het puntendoel als dat aan staat.
- **Eind:** de gebruiker weet wat hij moet doen.
- **Wat kan misgaan:**
  - geen internet: de laatst geladen gegevens worden getoond, met een melding dat je offline bent;
  - trage verbinding: er moet een laadstaat zijn *(afwijking: S-01)*;
  - databasefout: er moet een bruikbare foutstaat zijn *(afwijking: S-01)*;
  - geen taken: een lege staat met een uitnodiging om er een toe te voegen.
- De huidige indeling is te vol (INVENTARIS D-02). Hoe het beter kan is werk voor de product-designer. De **inhoud** die zichtbaar moet zijn, blijft zoals in het besluit.

### UC-02 — Taak afvinken (kernflow, deel 2)
- **Begin:** de gebruiker ziet een open taak (op Vandaag, bij Taken of in de Kalender).
- **Stappen:**
  1. Eén tik op het afvinkrondje.
  2. De taak staat direct op gedaan (optimistisch).
  3. Er verschijnt een paar seconden "Ongedaan maken".
- **Eind:**
  - De historie legt vast wie het deed, wanneer, of het op tijd of te laat was, en de punten.
  - De huisgenoten zien het binnen enkele seconden (realtime), en krijgen desgewenst een melding.
  - Bij een terugkerende taak staat de volgende uitvoering klaar.
- **Wat kan misgaan:**
  - Offline: de actie gaat in de wachtrij en wordt later verstuurd, zonder dubbele registratie (BR-10).
  - Twee mensen vinken tegelijk af: er wordt één keer geregistreerd (BR-11).
  - De taak is intussen verwijderd: nette melding, geen registratie.
  - Verkeerd afgevinkt: ongedaan maken (BR-13).
- **Namens een ander afvinken** (een kind zonder account): kies vóór het afvinken de persoon. Wie dit mag, staat in BR-12 `[OPEN: V-10]`.

### UC-03 — Taak toevoegen
- **Begin:** de gebruiker tikt op de zwevende +, gebruikt snel toevoegen, of tikt op + bij een dag in de kalender.
- **Stappen:**
  1. Vul Naam, Wie? en Wanneer? in.
  2. Of gebruik slimme invoer ("Badkamer zaterdag Jurgen"), die naam, dag en persoon herkent.
  3. Optioneel, onder "Meer instellingen": categorie, deadline, tijd, duur, punten, herinnering, herhaling en verdeling.
- **Eind:** de taak staat in de lijst. Wie hem toegewezen krijgt, ontvangt een melding als iemand anders hem toewees.
- **Wat kan misgaan:**
  - lege naam: "Toevoegen" blijft uitgeschakeld;
  - geen recht om taken te maken (BR-20): nette melding;
  - toewijzen aan een ander zonder dat recht (BR-21): nette melding;
  - dubbel versturen, bijvoorbeeld offline en daarna opnieuw: het blijft één taak (BR-10).

### UC-04 — Terugkerende taak instellen en wijzigen
- **Begin:** een nieuwe taak met herhaling, een standaardtaak uit de bibliotheek, of een bestaande losse taak die herhalend wordt.
- **Stappen:**
  1. Kies het ritme (BR-01).
  2. Kies optioneel een deadline-venster: beschikbaar X dagen vooraf, uiterlijk Y dagen na de geplande dag, tijd.
  3. Kies de verdeling (BR-03 t/m BR-06).
  4. Kies optioneel een einddatum.
  5. De planning maakt vooruit taken aan (BR-02).
- **Wijzigen:**
  - kies "alleen deze" of "deze en toekomstige" (BR-08);
  - pauzeren voor een periode (BR-09);
  - de reeks stoppen.
- **Eind:** de reeks loopt vanzelf door, ook als niemand de app opent (achtergrondtaak, BR-30).
- **Wat kan misgaan:**
  - een gezinslid zonder recht probeert andermans reeks te wijzigen of te stoppen: dat moet worden geweigerd, zonder dat er iets verdwijnt *(afwijking: B-01)*;
  - de gekozen vaste persoon is afwezig (BR-05).

### UC-05 — "Ik kan deze taak niet doen" (ruilen)
- **Begin:** een gebruiker opent een open taak en kiest "Kan niet".
- **Drie opties:**
  - **(a) Terugzetten:** de taak wordt niet-toegewezen.
  - **(b) Iemand anders kiezen.** Dit mag alleen als toewijzen aan anderen is toegestaan (BR-21).
  - **(c) Een ruilverzoek sturen, met een optioneel bericht.** De huisgenoten krijgen een melding, en de eerste die op "Overnemen" tikt, krijgt de taak.
- **Eind:** de taak heeft een nieuwe eigenaar. De aanvrager krijgt de melding "X neemt het over".
- **Wat kan misgaan:**
  - twee mensen tikken tegelijk op "Overnemen": één wint, de ander krijgt een nette melding (BR-15);
  - de taak wordt intussen afgevinkt: het verzoek vervalt;
  - je eigen verzoek overnemen: dat is niet toegestaan;
  - opnieuw een verzoek sturen voor dezelfde taak: er is er altijd maar één open (BR-15).

### UC-06 — Plannen in de kalender
- **Begin:** de gebruiker opent de Kalender (dag, week of maand).
- **Stappen:**
  - bekijk de taken per dag;
  - toekomstige herhalingen zijn herkenbaar;
  - verplaats een taak naar een andere dag;
  - voeg een taak toe op een dag.
- **Eind:** de taak staat op de nieuwe dag. Bij een reeks geldt dat alleen voor die ene taak (BR-08).
- **Wat kan misgaan:**
  - Buiten het geladen bereik staat nu stil "Niets gepland" *(afwijking: S-02)*. Bedoeld is: je ziet wat er gepland is, of een duidelijke uitleg.
  - Verplaatsen moet ook zonder slepen kunnen, dus met het toetsenbord of een keuze in het taakdetail *(afwijking: A-02)*.

### UC-07 — Boodschappen
- **Begin:** de gebruiker opent Boodschappen.
- **Stappen:**
  1. Snel toevoegen, bijvoorbeeld "2 melk". De categorie wordt automatisch gekozen.
  2. Of kies uit "Vaak gekocht".
  3. Afvinken in de winkel.
  4. Na het winkelen de lijst archiveren: wat niet gekocht is, gaat mee naar de nieuwe lijst.
  5. Vanuit een notitie bij een taak kun je iets direct op de lijst zetten.
- **Eind:** een actuele, gedeelde lijst.
- **Wat kan misgaan:**
  - offline toevoegen of afvinken: gaat via de wachtrij, zonder dubbele items (BR-10);
  - twee keer archiveren: mag geen lege extra lijsten opleveren *(afwijking: R-03)*.

### UC-08 — Afwezigheid
- **Begin:** een gezinslid voert een periode van afwezigheid in, voor zichzelf. Een beheerder kan dat ook voor een ander doen.
- **Stappen:** kies van–tot, de strategie en een optionele notitie.
- **Eind:** open taken van die persoon in de periode worden volgens de strategie verwerkt (BR-07). Nieuwe planningen slaan de afwezige over.
- **Wat kan misgaan:**
  - Een overlappende of dubbele afwezigheid.
  - Een afwezigheid verwijderen: de al verschoven taken worden nu niet teruggezet `[OPEN: V-17]`.

### UC-09 — Uitnodigen en aansluiten
- **Begin:** een beheerder maakt een uitnodigingslink, eventueel gekoppeld aan een bestaand gezinslid (bijv. "Lynn") en/of aan een e-mailadres.
- **Stappen:**
  1. De beheerder deelt de link.
  2. De ontvanger opent hem, logt in of registreert, en accepteert.
- **Eind:** de ontvanger is lid, met de rol uit de uitnodiging. Bij koppeling aan een bestaand gezinslid neemt hij diens taken en historie over.
- **Wat kan misgaan:**
  - de link is verlopen (na 14 dagen) of al gebruikt: een duidelijke foutstaat (die is er al);
  - de link is bedoeld voor een ander e-mailadres: geweigerd;
  - de ontvanger is al lid: de uitnodiging wordt alleen afgerond.

### UC-10 — Onboarding nieuw huishouden
- **Begin:** een nieuwe gebruiker zonder huishouden (na registreren).
- **Stappen, in 5 stappen:**
  1. naam van het huishouden;
  2. gezinsleden;
  3. standaardtaken;
  4. frequentie;
  5. verdeling.
- **Eind:** een ingericht huishouden met een geplande eerste week. De maker is beheerder.
- **Wat kan misgaan:**
  - Halverwege stoppen: bij terugkomst ga je verder waar je was, of begint de onboarding opnieuw.
  - De onboarding noemt nu inloggen met Google/Apple, maar dat bestaat niet `[OPEN: V-14]`.

### UC-11 — Overzicht huishouden en puntendoel
- **Begin:** de gebruiker opent Huishouden.
- **Inhoud:**
  - per periode en per persoon: open, gedaan, verlopen, taakbelasting en voortgang;
  - de meest gedane en de meest vergeten taak;
  - wie afwezig is;
  - optioneel een gezamenlijk puntendoel ("100 punten → filmavond").
- **Eind:** inzicht om de verdeling bij te sturen.
- **Wat kan misgaan:**
  - Er is nog geen historie: dan is een lege staat nodig *(afwijking: S-03)*.
  - Getallen die weinig zeggen (D-04). Welke cijfers er wel toe doen, is ontwerpwerk. De beslissing die het scherm moet ondersteunen: **is de verdeling eerlijk, en wat wordt vergeten?**

### UC-12 — Meldingen
- **Soorten:**
  - in de app: toegewezen, herinnering, deadline nadert, verlopen, voltooid door een ander, ruilverzoek, ruil geaccepteerd;
  - dagoverzicht en avondoverzicht;
  - optioneel ook als pushmelding op dit apparaat.
- **Instellen:** per persoon (BR-31).
- **Wat kan misgaan:**
  - push kan niet op dit apparaat: op de iPhone moet de app eerst op het beginscherm staan, vanaf iOS 16.4;
  - dubbele meldingen: worden voorkomen met een dedupe-sleutel;
  - meldingen komen te laat, omdat de achtergrondtaak te weinig draait (R-01, V-04).

### UC-13 — Instellingen en beheer
- **Iedereen:** eigen profiel (naam, kleur, emoji), meldingen en push, eigen afwezigheid, uitloggen.
- **Beheerder daarnaast:**
  - huishouden: naam, tijdzone, rechten van gezinsleden, puntendoel;
  - gezinsleden toevoegen, wijzigen, (de)activeren en verwijderen, en de rol wijzigen;
  - uitnodigingen;
  - terugkerende taken en standaardtaken.
- De huidige pagina is te lang (D-03). Dat is ontwerpwerk.
- Account verwijderen, huishouden verlaten en huishouden verwijderen bestaan niet `[OPEN: V-15]`.

## 5. Businessregels en harde regels

### Planning en herhaling
- **BR-01 — Ritmes:** dagelijks, elke X dagen, vaste weekdagen, elke X weken, maandelijks (op een dag van de maand, of "de n-de weekdag", zoals de eerste zaterdag) en jaarlijks. Optioneel met een einddatum. — waarom: vastgelegd besluit.
- **BR-02 — Vooruit plannen:** een reeks heeft altijd concrete taken voor de komende **14 dagen**. Valt er in die periode niets, dan staat alleen de eerstvolgende er. Dezelfde uitvoering wordt **nooit** twee keer ingepland. — waarom: iedereen ziet deze en volgende week, en afwezigheid kan vooraf worden verwerkt. Dubbele taken zijn verwarrend en tellen dubbel.
- **BR-03 — Verdeling "vast":** altijd dezelfde persoon. Is die afwezig of inactief, dan gaat de taak eerlijk (BR-06) naar een ander, met als reden "afwezigheid".
- **BR-04 — Verdeling "om en om":** deterministisch op volgnummer van de uitvoering, over de gekozen volgorde van personen (of alle actieve leden). Wie aan de beurt is maar afwezig is, wordt overgeslagen. Opnieuw plannen verstoort de volgorde **nooit**. — waarom: voorspelbaar en uitlegbaar ("deze week is Lynn").
- **BR-05 — Verdeling "willekeurig":** een willekeurig beschikbaar (actief en niet afwezig) lid.
- **BR-06 — Verdeling "eerlijk":** het beschikbare lid met de laagste taakbelasting krijgt de taak. Bij gelijke belasting wint het laagste aantal taken, daarna de volgorde van de leden.
  - **Taakbelasting** = de punten van afgeronde taken in de **laatste 28 dagen**, plus de punten van al toegewezen open taken vanaf vandaag.
  - Bij eenmalige taken telt de code nu alleen de afgeronde punten, niet de open taken. De bedoelde regel is voor beide gelijk *(kleine afwijking in `src/server/services/tasks.ts` `autoAssignOnce`)*.
- **BR-07 — Afwezigheid:** open taken van de afwezige in de periode worden verwerkt volgens de gekozen strategie:
  - **opnieuw verdelen:** eerlijk, onder de beschikbare anderen;
  - **doorschuiven:** naar de eerste dag na de afwezigheid, met de deadline evenveel dagen mee;
  - **vrijgeven:** de taak wordt niet-toegewezen.

  Verwerkte taken worden "handmatig aangepast" (uitzondering) en worden bij opnieuw plannen niet overschreven.
- **BR-08 — "Alleen deze" of "deze en toekomstige":**
  - **Alleen deze:** wijzigen, verplaatsen of toewijzen maakt de taak een uitzondering. Opnieuw plannen overschrijft hem **nooit**.
  - **Deze en toekomstige:** past de reeks aan en plant alle open, niet-aangepaste taken ná deze opnieuw in.
  - Een verplaatste taak houdt zijn oorspronkelijke datum in de reeks.
- **BR-09 — Pauzeren:** een reeks kan van–tot worden gepauzeerd. Open, niet-aangepaste taken in die periode vervallen, en daarna gaat de reeks vanzelf verder.
  - **Stoppen:** de reeks maakt geen nieuwe taken meer, en de open taken ervan vervallen.
  - De historie blijft in beide gevallen bestaan.
- **BR-16 — Verlopen stapelt niet op:** een verlopen taak van een reeks wordt automatisch **overgeslagen** zodra de volgende uitvoering van dezelfde reeks beschikbaar is. Hij telt wel mee als "vergeten". — waarom: geen stapel van zeven keer "vaatwasser uitruimen".
- **BR-17 — Verlopen:** een open taak is verlopen als de deadline voorbij is, of, zonder deadline, als de geplande dag voorbij is. Dit wordt afgeleid en **niet** opgeslagen. — waarom: de status klopt altijd, ook als de achtergrondtaak niet gedraaid heeft.
- **BR-18 — Deadline-venster:** "beschikbaar vanaf" ligt nooit ná de deadline. Is er geen tijd opgegeven, dan is de deadline het einde van de dag, in de tijdzone van het huishouden.

### Afvinken, historie en punten
- **BR-10 — Idempotent:** elke actie die opnieuw verstuurd kan worden (offline wachtrij, dubbel tikken) levert **nooit** een dubbele registratie op. Het gaat om afvinken, nieuwe taken, boodschappen, notities, ruilverzoeken, afwezigheid, lijst archiveren, uitnodigingen en standaardtaken activeren. — waarom: vastgelegd uitgangspunt. *(afwijking: R-03 voor ruilverzoek, afwezigheid, archiveren, uitnodiging en standaardtaken)*
- **BR-11 — Eén keer voltooid:** een taak wordt maar één keer als voltooid geregistreerd, ook als twee mensen tegelijk afvinken.
- **BR-12 — De historie is onveranderlijk:**
  - Elke uitvoering legt vast: wie, wanneer, gepland op, de deadline, of het te laat was (en hoeveel minuten), punten, duur en een notitie.
  - De historie blijft bestaan als de taak of reeks later wordt verwijderd; de titel wordt als momentopname bewaard.
  - Alleen "ongedaan maken" (BR-13) verwijdert een registratie.
  - Offline afgevinkt? Dan geldt het moment van afvinken, maar nooit in de toekomst en nooit meer dan 7 dagen terug.
  - Wie namens wie mag afvinken: `[OPEN: V-10]` *(zie ook B-04)*.
- **BR-13 — Ongedaan maken:**
  - Mag door degene die afvinkte, door een beheerder, of door iedereen als er namens een lid zonder account is afgevinkt.
  - In de interface kan het een paar seconden direct na het afvinken. De database staat het nu ook later toe; of dat de bedoeling is: `[OPEN: V-11]`.
- **BR-14 — Punten:** expliciete punten van de taak gaan voor. Anders worden ze afgeleid van de duur: `max(1, afgerond(duur / 10))`, met 10 minuten als standaardduur. Voorbeelden: 5 min = 1 punt, 30 min = 3, 60 min = 6. Punten liggen tussen 0 en 100 per taak.
  - Het puntendoel is **gezamenlijk** voor het huishouden ("Samen sparen"), en staat standaard uit.
- **BR-15 — Ruilen:**
  - Per taak staat er hooguit **één** open ruilverzoek.
  - De aanvrager kan het eigen verzoek niet overnemen.
  - Overnemen lukt alleen zolang de taak open is.
  - Afvinken laat een open verzoek vervallen.
  - De aanvrager of een beheerder kan het verzoek intrekken.

### Rechten (zie ook §7)
- **BR-20 — Taken aanmaken:** een beheerder mag het altijd. Een gezinslid mag het alleen als "Gezinsleden mogen taken maken" aan staat (standaard: aan). Dit geldt voor **elke** manier van aanmaken: los, als reeks, via standaardtaken en met automatische verdeling. *(afwijking: B-02)*
- **BR-21 — Aan een ander toewijzen:** een beheerder mag het altijd. Een gezinslid mag het alleen als "Gezinsleden mogen aan anderen toewijzen" aan staat (standaard: uit). Een niet-toegewezen taak aan jezelf toewijzen mag altijd. Of automatische verdeling door een gezinslid hieronder valt: `[OPEN: V-12]`. *(afwijking: B-02)*
- **BR-22 — Reeksen wijzigen, pauzeren, stoppen en verwijderen:** alleen de beheerder of de maker van de reeks `[OPEN: V-09]` ter bevestiging. Een geweigerde actie verandert **niets**: er verdwijnen geen taken, en de gebruiker krijgt een duidelijke melding. *(afwijking: B-01 — nu kan elk gezinslid de open taken van andermans reeks laten verdwijnen via stoppen, via "deze en toekomstige" verwijderen en vermoedelijk via "deze en toekomstige" wijzigen)*
- **BR-23 — Losse taken wijzigen en verwijderen:**
  - **Wijzigen en verplaatsen:** de beheerder, de toegewezen persoon, de maker, of iedereen als de taak niet is toegewezen.
  - **Verwijderen:** de beheerder of de maker.
  - De maker van een taak kan **nooit** worden veranderd. *(afwijking: B-04 — een lid kan nu de maker van een niet-toegewezen taak aanpassen en zo verwijderrecht krijgen; en "verwijderen" van een taak in een reeks loopt via een zachte verwijdering die ook de toegewezen persoon toestaat)*
  - Bevestiging van deze verdeling: `[OPEN: V-13]`.
- **BR-24 — Beheerders:**
  - Een huishouden heeft **altijd** minstens één beheerder: de laatste beheerder kan niet worden gedegradeerd of verwijderd.
  - Een beheerder kan zichzelf niet verwijderen.
  - Een gezinslid kan de eigen rol, koppeling of actieve status **nooit** wijzigen.
- **BR-25 — Meldingen worden alleen door het systeem aangemaakt,** als gevolg van een actie of van de achtergrondtaak. Een gebruiker kan **nooit** een melding met eigen tekst of link bij een huisgenoot plaatsen. Links in meldingen gaan **altijd** naar een pagina binnen de app. — waarom: anders kan een lid een huisgenoot via een melding naar een andere website sturen. *(afwijking: B-03)*
- **BR-26 — Isolatie:** een gebruiker ziet of wijzigt **nooit** iets van een huishouden waarvan hij geen lid is. Ook een gemanipuleerd verzoek kan geen verwijzing naar een ander huishouden maken. — waarom: privacy van gezinnen onderling (vastgelegd).

### Achtergrond en meldingen
- **BR-30 — Achtergrondtaak:** draait elke **15 minuten** (vastgelegd in ARCHITECTUUR). Hij doet vier dingen:
  - vult de planning aan;
  - slaat ingehaalde verlopen taken over (BR-16);
  - verstuurt herinneringen, "deadline nadert" en "verlopen";
  - verstuurt het dag- en avondoverzicht.

  *(afwijking: R-01 — de standaardplanning draait nu één keer per dag; of pg_cron dit opvangt is onbekend, V-04)*
- **BR-31 — Meldingsregels:**
  - **Herinnering:** X minuten vóór het geplande tijdstip, anders vóór de deadline; maximaal 5 herinneringen per taak. Verstuurd binnen 90 minuten na het moment, anders vervalt hij.
  - **Deadline nadert:** binnen de ingestelde waarschuwingstijd (standaard 2 uur, instelbaar van 5 minuten tot 48 uur).
  - **Verlopen:** één keer, binnen 24 uur na de deadline.
  - **Overzichten:** het dagoverzicht (standaard 07:30) alleen als er vandaag taken zijn, het avondoverzicht (standaard 20:00) alleen als er van jou nog iets open staat.
  - **Nooit dubbel:** dezelfde melding komt nooit twee keer.
  - **Voorkeuren:** gelden per persoon.
  - **Niet-toegewezen taken:** alleen de beheerders krijgen de melding "verlopen".
  - **Taken van een lid zonder account:** nu gaan de meldingen naar dat lid, en kan niemand ze lezen `[OPEN: V-16]`.
- **BR-32 — Toewijzingsmelding:** wie een taak toegewezen krijgt door een ander, krijgt een melding. Wie zichzelf toewijst niet. Bij een nieuwe reeks krijgt ieder lid één melding, voor de eerstvolgende taak.

### Overig
- **BR-40 — Tijd:** alle datums ("vandaag", "verlopen", overzichten) worden bepaald in de tijdzone van het huishouden (standaard Europe/Amsterdam), niet in die van het apparaat.
- **BR-41 — Uitnodiging:**
  - is 14 dagen geldig en werkt één keer;
  - is optioneel gebonden aan een e-mailadres, en werkt dan alleen voor dat adres;
  - alleen een beheerder maakt uitnodigingen;
  - de rol (beheerder of gezinslid) staat in de uitnodiging.
- **BR-42 — Boodschappen:** elk lid mag alles op de lijst: toevoegen, wijzigen, afvinken, verwijderen en archiveren. Bij archiveren gaan de niet-gekochte producten mee naar de nieuwe lijst.
- **BR-43 — Uitloggen wist de lokaal opgeslagen offline-gegevens** van dat apparaat.

## 6. Randgevallen

| Geval | Bedoeld gedrag |
| --- | --- |
| Leeg huishouden (net na onboarding zonder taken) | Lege staat op Vandaag, Taken, Kalender en Huishouden, met een uitnodiging om een taak toe te voegen (*afwijking: S-03 voor Huishouden*) |
| Iedereen afwezig op een dag | Automatische verdeling levert "niet toegewezen" op. De taak blijft staan, en de beheerders krijgen de verlopen-melding |
| Vaste persoon of iedereen uit de om-en-om-lijst verwijderd | Het lid gaat uit de lijst; toekomstige taken worden niet-toegewezen of eerlijk verdeeld (BR-03) |
| Gezinslid verwijderd | Zijn taken worden niet-toegewezen, en de historie blijft bestaan maar zonder naam. Of dat gewenst is: `[OPEN: V-15]` |
| Dubbel tikken op afvinken, of offline afvinken en daarna opnieuw | Eén registratie (BR-10, BR-11) |
| Twee mensen nemen tegelijk een ruil over | Eén wint, de ander krijgt een nette melding (BR-15) |
| Taak afgevinkt terwijl iemand hem aan het bewerken is | De bewerking mag de afvinkstatus niet ongedaan maken. Afvinken loopt alleen via de afvinkfunctie |
| Maandelijks op de 31e, of 29 februari | Volgens de domeinlogica voor herhaling (getest in `src/domain/__tests__/recurrence.test.ts`). De product-designer toont duidelijk wanneer een maand die dag niet heeft `[AANNAME: de huidige, geteste domeinregel is correct; geen wijziging]` |
| Zomer- en wintertijd | De deadline blijft dezelfde kloktijd in de tijdzone van het huishouden (BR-40) |
| Offline afvinken, dagen later online | Het afvinkmoment geldt, maar maximaal 7 dagen terug (BR-12) |
| Lange lijsten: 37+ taken, 17 "binnenkort", 60+ meldingen | Groeperen per dag; bij meldingen is "meer laden" nodig (*afwijking: S-03*) |
| Kalender verder dan ongeveer 10 weken vooruit of 6 weken terug | Gegevens tonen of duidelijk uitleggen (*afwijking: S-02*) |
| Uitnodiging voor iemand die al lid is | Alleen de uitnodiging wordt afgerond, er ontstaat geen tweede lidmaatschap |
| Deadline vóór "beschikbaar vanaf" | Geweigerd, met een uitleg (BR-18) |
| Invoer te lang (taaknaam > 80, notitie > 1000, ruilbericht > 300, afwezigheidsnotitie > 200) | Geweigerd, met een uitleg |
| Afwezigheid verwijderd nadat taken zijn herverdeeld | `[OPEN: V-17]` |

## 7. Rollen en rechten

Drie soorten personen: **Beheerder** (met account), **Gezinslid** (met account) en **Lid zonder account** (bijv. een kind). Een lid zonder account logt nooit in en doet dus zelf niets; anderen handelen namens hem.

| Actie | Beheerder | Gezinslid | Lid zonder account |
| --- | --- | --- | --- |
| Alles van het eigen huishouden zien (taken, reeksen, historie, afwezigheid, boodschappen, leden) | Ja | Ja | n.v.t. |
| Eigen meldingen, meldingsvoorkeuren en pushapparaten zien | Alleen eigen | Alleen eigen | n.v.t. |
| Taak aanmaken (los, reeks, standaardtaak) | Ja | Als toegestaan (BR-20) | n.v.t. |
| Taak aan zichzelf toewijzen, of een niet-toegewezen taak oppakken | Ja | Ja | n.v.t. |
| Taak aan een ander toewijzen | Ja | Als toegestaan (BR-21); automatische verdeling `[OPEN: V-12]` | n.v.t. |
| Taak afvinken | Ja | Ja | Wordt namens hem afgevinkt |
| Namens een ander afvinken | Ja | `[OPEN: V-10]` (nu: namens iedereen) | n.v.t. |
| Afvinken ongedaan maken | Ja | Eigen afvinking, en afvinkingen namens een lid zonder account (BR-13, `[OPEN: V-11]`) | n.v.t. |
| Losse taak wijzigen en verplaatsen | Ja | Eigen, zelf gemaakt of niet-toegewezen (BR-23, `[OPEN: V-13]`) | n.v.t. |
| Taak verwijderen | Ja | Zelf gemaakt (BR-23, `[OPEN: V-13]`) | n.v.t. |
| Reeks wijzigen, pauzeren, stoppen of verwijderen | Ja | Zelf gemaakt (BR-22, `[OPEN: V-09]`) | n.v.t. |
| Status op "bezig" of "overgeslagen" zetten | Ja | Net als wijzigen (BR-23) | n.v.t. |
| Ruilverzoek sturen, overnemen, eigen verzoek intrekken | Ja (en elk verzoek intrekken) | Ja | n.v.t. |
| Notitie plaatsen, eigen notitie verwijderen | Ja (ook die van anderen verwijderen) | Ja | n.v.t. |
| Afwezigheid invoeren of verwijderen | Voor iedereen | Alleen eigen | Door een beheerder |
| Boodschappen (alles) | Ja | Ja | n.v.t. |
| Eigen profiel (naam, kleur, emoji, e-mailadres) | Ja | Ja | Door een beheerder |
| Huishoudinstellingen, rechten van leden, puntendoel | Ja | Nee | n.v.t. |
| Leden toevoegen, (de)activeren, verwijderen, rol wijzigen | Ja (niet zichzelf verwijderen, niet de laatste beheerder, BR-24) | Nee | n.v.t. |
| Uitnodigingen maken en beheren | Ja | Nee | n.v.t. |
| Eigen standaardtaken van het huishouden beheren | Ja | Nee | n.v.t. |
| Melding bij een ander plaatsen | Nee, alleen het systeem (BR-25) | Nee, alleen het systeem (BR-25) | n.v.t. |

**Mag nooit:**
- een gezinslid maakt zichzelf beheerder;
- iemand wijzigt de historie, behalve met "ongedaan maken";
- een gezinslid laat door een geweigerde actie toch gegevens van anderen verdwijnen (B-01);
- iemand wijzigt de maker van een taak.

**Isolatie:**
- Leden van verschillende huishoudens zien **nooit** iets van elkaar (BR-26).
- Binnen een huishouden ziet ieder lid alles, **behalve** de meldingen, meldingsvoorkeuren en pushapparaten van een ander.
- Afwezigheidsnotities ("vakantie Spanje") en notities bij taken zijn zichtbaar voor alle leden van het huishouden.

**Meerdere huishoudens per persoon:** technisch mogelijk (de database en een actief-huishoudencookie), maar er is geen scherm om te wisselen `[OPEN: V-08]`.

## 8. Gegevens

| Gegeven | Waarom nodig | Bron | Persoonsgegeven | Bewaren tot |
| --- | --- | --- | --- | --- |
| E-mailadres en wachtwoord (bij Supabase Auth) | Inloggen, magic link, uitnodiging | Gebruiker | Ja (het wachtwoord slaat de app nooit zelf op) | Tot het account verwijderd wordt `[OPEN: V-15]` |
| Profiel (weergavenaam) | Tonen in de app | Gebruiker | Ja | Idem |
| Huishouden (naam, tijdzone, rechten, puntendoel en beloning) | Werking | Beheerder | Indirect (de naam bevat vaak een achternaam, bijv. "Van der Lecq") | Tot het huishouden verwijderd wordt `[OPEN: V-15]` |
| Gezinsleden (naam, kleur, emoji, rol, actief, optioneel e-mailadres; ook van **kinderen zonder account**) | Taken toewijzen en tonen | Beheerder of het lid zelf | Ja, ook van minderjarigen | Tot het lid of huishouden verwijderd wordt |
| Uitnodigingen (token, optioneel e-mailadres, rol, wie uitnodigde) | Aansluiten | Beheerder | Ja (e-mailadres) | Nu onbeperkt, ook na verlopen `[OPEN: V-18]` |
| Taken en reeksen (titel, omschrijving, planning, toegewezen persoon, maker) | Kernfunctie | Leden en planning | Indirect (wie wat moet doen) | Nu onbeperkt `[OPEN: V-18]` |
| Historie van afvinkingen (wie, wanneer, te laat, punten, notitie) | Overzicht, eerlijke verdeling (28 dagen), statistieken | Afvinken | Ja (gedrag per persoon) | Nu onbeperkt `[OPEN: V-18]`. Voor de eerlijke verdeling zijn 28 dagen nodig; de statistieken gebruiken een gekozen periode |
| Historie van toewijzingen en ruilverzoeken | Uitleg waarom iemand een taak heeft | Systeem en leden | Ja | Nu onbeperkt `[OPEN: V-18]` |
| Notities bij taken | Afspraken en boodschappen | Leden | Mogelijk (vrije tekst) | Tot de taak wordt verwijderd |
| Afwezigheid (periode, strategie, notitie) | Verdeling | Lid of beheerder | Ja (wanneer iemand weg is, soms waarheen) | Nu onbeperkt `[OPEN: V-18]` |
| Meldingen (in de app) | Informeren | Systeem | Ja | Nu onbeperkt; het scherm toont er 60 `[OPEN: V-18]` |
| Meldingsvoorkeuren | Werking | Lid | Ja | Tot het lid verwijderd wordt |
| Pushabonnementen (endpoint, sleutels, browserinfo) | Web Push | Apparaat | Ja (apparaatgegevens) | Tot uitzetten of uitloggen `[OPEN: V-18]` |
| Boodschappen (producten, wie toevoegde of kocht) | Gedeelde lijst, "vaak gekocht" | Leden | Beperkt | Gearchiveerde lijsten nu onbeperkt `[OPEN: V-18]` |
| Offline cache en wachtrij (IndexedDB op het apparaat) | Offline werken | App | Ja | Tot uitloggen (BR-43) |

- **Bewust niet opgeslagen:**
  - wachtwoorden (alleen bij Supabase Auth);
  - locatie;
  - telefoonnummers;
  - geboortedata;
  - foto's (een avatar is alleen een https-link, en in de praktijk een emoji);
  - invoer of persoonsgegevens in logs (vastgelegd in de README).
- **Verwijderen:**
  - Er is nu geen manier om een account, een lidmaatschap of een huishouden te verwijderen via de app.
  - Een beheerder kan wel een lid verwijderen. De historie van dat lid blijft dan bestaan, zonder naam.
  - Voor de AVG (recht op verwijdering) is een keuze nodig `[OPEN: V-15]`.
- **Externe partijen:**
  - **Supabase:** database, authenticatie en e-mail voor magic links. De README adviseert regio EU (Frankfurt); of productie daar staat, is onbekend `[OPEN: V-20]`.
  - **Vercel:** hosting.
  - **Pushdiensten van Apple, Google en Mozilla:** bezorgen pushmeldingen. De inhoud is versleuteld volgens de Web Push-standaard, maar bevat wel taaktitels.
  - Er zijn geen analytics of advertentiepartijen, en er gaan geen gegevens naar AI-diensten.

## 9. Afhankelijkheden

| Afhankelijkheid | Waarvoor | Risico |
| --- | --- | --- |
| Supabase (PostgreSQL, Auth, Realtime) | Alle gegevens, inloggen, directe updates | Uitval betekent dat alleen de offline weergave overblijft; de limieten van het gratis plan |
| Vercel | Hosting en Vercel Cron | Het gratis plan draait cron maar één keer per dag (R-01) |
| pg_cron + pg_net in Supabase, of een externe cron | Achtergrondtaak elke 15 minuten | Onbekend of dit aan staat (V-04) |
| Web Push (VAPID) en de push-ondersteuning van de browser | Pushmeldingen | iOS alleen vanaf 16.4 en na "Zet op beginscherm" |
| E-mail van Supabase Auth | Magic link, uitnodigingsmail | Standaardtemplates zijn Engels (de README adviseert ze aan te passen) |
| Mensen: Jurgen als beheerder | Inrichting, uitnodigen | — |

## 10. Bewust niet (nu)

- **AI-functies** (taakvoorstellen, huishoudassistent): in de README staat dit onder "na de MVP". Het voegt kosten en privacyvragen toe (gegevens naar een externe AI).
- **Koppelingen met agenda's (Google, Apple, Outlook), smart home en WhatsApp/e-mail als meldingskanaal**: ook "na de MVP". Elke koppeling brengt geheimen, externe verplichtingen en extra security-review met zich mee.
- **Inloggen met Google/Apple**: "na de MVP". Wachtwoord en magic link volstaan voor een gezin. De tekst in de onboarding die het nu noemt, klopt dus niet `[OPEN: V-14]`.
- **Een native app** (App Store of Play Store): de PWA dekt het gebruik op de telefoon. Een native app vraagt veel extra onderhoud.
- **Een individuele competitie of ranglijst met beloningen per persoon**: het puntendoel is bewust gezamenlijk ("Samen sparen"). Een ranglijst kan onderling wedijveren en ruzie aanwakkeren.
- **Wisselen tussen meerdere huishoudens in de interface**: de techniek ondersteunt het, maar er is geen scherm voor. Voorstel: bewust niet `[OPEN: V-08]`.
- **Een apart kinderaccount of kindermodus**: kinderen zonder account worden namens hen afgevinkt. Een eigen, vereenvoudigde kinderweergave is een nieuwe functie en valt buiten deze ronde.

## 11. Succescriteria

Voorstel, te bevestigen door Jurgen `[OPEN: V-19]`. Controleerbaar over drie maanden:

1. **Dagelijks gebruik:** alle gezinsleden met een account vinken in een gemiddelde week op minstens 5 van de 7 dagen iets af. Te controleren in de historie van afvinkingen.
2. **Minder vergeten:** het aandeel taken dat verlopen of overgeslagen is, daalt ten opzichte van de eerste maand (Huishouden-overzicht, "vergeten").
3. **Eerlijk verdeeld:** over 28 dagen verschilt de taakbelasting tussen actieve volwassen leden niet meer dan een afgesproken marge. Voorstel: maximaal 25%.
4. **Betrouwbaar:**
   - geen enkele dubbele registratie;
   - geen enkel geval van taken die onterecht verdwijnen (B-01 opgelost en getest);
   - herinneringen komen binnen 15 minuten na het geplande moment (R-01 opgelost).
5. **Snel:** afvinken en toevoegen kost maximaal twee tikken (vastgelegd besluit). Het openingsscherm toont de eigen taken van vandaag zonder te scrollen, op de afgesproken telefoonviewport.
6. **Geen hulp nodig:** Jurgen hoeft niemand uit te leggen hoe ruilen, afwezigheid of een terugkerende taak werkt.

## 12. Aannames en open vragen

**Aannames** (zonder invloed op rechten, gegevens, privacy, scope of gebruikerservaring):
- `[AANNAME]` De bestaande, geteste domeinregels voor herhaling (maandeinde, schrikkeljaar, n-de weekdag) zijn correct en blijven ongewijzigd.

**Open vragen.** Ze staan in het rapport aan de hoofdsessie en worden na beantwoording in `docs/PROGRESS.md` vastgelegd. V-04 (pg_cron) staat al open en wordt hier niet opnieuw gesteld.

| Vraag | Onderwerp | Raakt |
| --- | --- | --- |
| V-05 | Wie gebruikt de live app: alleen het eigen huishouden of iedereen die registreert | Doelgroep, scope, privacy |
| V-06 | Echte gezinssamenstelling, rollen, kinderen met of zonder account | Gebruikers, rechten, UX |
| V-07 | Apparaten en viewports, gedeeld apparaat, geïnstalleerd als app | UX, ontwerp, tests |
| V-08 | Meerdere huishoudens per persoon | Scope |
| V-09 | Wie mag reeksen wijzigen, pauzeren, stoppen of verwijderen | Rechten (B-01) |
| V-10 | Wie mag namens wie afvinken | Rechten, punten (B-04) |
| V-11 | Afvinken later nog ongedaan maken | Rechten, historie |
| V-12 | Automatische verdeling door een gezinslid zonder toewijsrecht | Rechten (B-02) |
| V-13 | Wie mag losse taken wijzigen en verwijderen | Rechten (B-04) |
| V-14 | Google/Apple in de onboarding, wachtwoord vergeten | Scope, accounts |
| V-15 | Account, lidmaatschap en huishouden verwijderen; historie van verwijderde leden | Privacy (AVG), scope |
| V-16 | Meldingen voor taken van een lid zonder account | Functionaliteit |
| V-17 | Afwezigheid verwijderen nadat taken verschoven zijn | Functionaliteit |
| V-18 | Bewaartermijnen | Privacy (AVG) |
| V-19 | Het belangrijkste probleem en de succescriteria | Succes |
| V-20 | Regio van het Supabase-productieproject | Privacy |
