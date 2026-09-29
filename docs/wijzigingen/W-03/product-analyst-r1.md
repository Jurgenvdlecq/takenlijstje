## Product-analyse: W-03 afvalkalender, ronde 1
Documenten bijgewerkt: geen. PRODUCT_SPEC en ACCEPTANCE_CRITERIA zijn bevroren, dus ik heb niets geschreven. Hieronder staat alle tekst, klaar om letterlijk in te voegen.
Niveau-advies: **2 blijft**. Er komt een externe bron bij, een adres als persoonsgegeven, en de taken zijn voor het hele gezin. Dat past binnen niveau 2. De security-review is verplicht, omdat de app een externe bron aanroept en een woonadres bewaart.

Gebruikte bronnen: PROGRESS (W-03, V-41…V-47), PRODUCT_SPEC (hoogste regel is BR-46, hoogste use case UC-12), ACCEPTANCE_CRITERIA (hoogste criterium is AC-182), TD (§3, §5.2, §11), UX_SPEC.

**Belangrijke vondst.** Volgens denhaag.nl mag afval pas **vanaf 22:00** de avond vóór de ophaaldag buiten staan en moet het er **uiterlijk 07:45** staan. Wie te vroeg of te laat buitenzet, kan een boete krijgen. Wordt het afval niet vóór 17:00 opgehaald, dan moet de bak 's avonds weer naar binnen. Jurgens herinnering om 21:00 ligt dus vóór de toegestane tijd. Aan zijn besluit verander ik niets, maar ik leg het hem voor in V-49.
Bronnen: [Huishoudelijk afval aanbieden – Den Haag](https://www.denhaag.nl/nl/afval/huisvuil-aanbieden/), [Kosten bij verkeerd aanbieden – Den Haag](https://www.denhaag.nl/nl/afval/kosten-bij-verkeerd-aanbieden-huisvuil/). De pagina zelf is vanuit de sandbox geblokkeerd; ik heb dit via de zoekresultaten gelezen. De architect of de bouwer moet het nog op de pagina zelf bevestigen.

---

## 1. Tekst voor PRODUCT_SPEC

### Invoegen als nieuwe sectie "§14 Afvalkalender (W-03)"

**Doel.** Het gezin heeft minicontainers voor restafval, papier en PMD. Elke bak heeft een eigen ophaalritme, en de gemeente verschuift dat soms rond feestdagen. Nu moet iemand dat onthouden, en dat gaat mis ("met name door Jurgen", V-19). De app leest de huisvuilkalender van de gemeente Den Haag voor het adres van het huishouden en zet de taken zelf klaar:
- de avond ervoor **buitenzetten**, met een herinnering om 21:00 (V-42/V-44);
- op de ophaaldag vanaf de middag **binnenzetten** (V-47).

Niemand hoeft dan nog handmatig afvaltaken bij te houden.

**Besluiten van Jurgen (bindend):**
- keuze B: de app leest de kalender zelf in;
- bron: huisvuilkalender.denhaag.nl (V-41);
- bakken: rest, papier en PMD, geen GFT (V-43);
- herinnering om 21:00 op de avond vóór de ophaaldag (V-42/V-44);
- postcode en huisnummer mogen worden bewaard (V-45);
- binnenzetten op de ophaaldag vanaf de middag (V-47);
- een eigen werkpakket direct na WP3, in de huidige schermen (V-46).

**Gebruikers en rollen**
- **Beheerder (Ellen, Jurgen):**
  - zet de afvalkalender aan en voert het adres in;
  - wijzigt het adres of zet de afvalkalender uit;
  - ziet of de kalender goed wordt bijgewerkt.
- **Gezinslid (Lynn, Kai):** ziet de afvaltaken en vinkt ze af, net als andere taken. Het adres instellen, wijzigen of uitzetten kan een gezinslid niet. Of een gezinslid het adres mag zien: [OPEN: V-53].
- **Wie het resultaat ziet zonder het te gebruiken:** de gemeente Den Haag. Zij krijgt bij elke opvraging postcode, huisnummer en toevoeging (BR-58).

**Use cases**

*UC-13: Afvalkalender instellen (beheerder)*
- **Begin:** Instellingen, onderdeel Huishouden.
- **Stappen:**
  1. De beheerder vult postcode en huisnummer in, met een eventuele toevoeging.
  2. De app zoekt het adres op in de huisvuilkalender.
  3. De app toont ter controle de eerstvolgende ophaaldagen per bak ("Klopt dit?").
  4. De beheerder bevestigt.
- **Eind:** het adres is bewaard en de afvaltaken voor de komende periode staan klaar (BR-50).
- **Wat kan misgaan:**
  - het adres heeft een ongeldig formaat;
  - het adres is onbekend bij de gemeente of ligt buiten Den Haag;
  - er zijn geen ophaaldagen voor rest, papier of PMD (bijvoorbeeld alleen een ondergrondse container);
  - de bron is onbereikbaar.

  In al die gevallen wordt niets bewaard en krijgt de beheerder een duidelijke uitleg.

*UC-14: Afvaltaken afhandelen (iedereen)*
- De buitenzet-taak staat de avond vóór de ophaaldag op Vandaag. Om 21:00 komt de herinnering.
- De binnenzet-taak staat op de ophaaldag klaar vanaf de middag.
- Wie het doet, vinkt het af, zoals bij elke taak (BR-12: zonder persoon).

*UC-15: Afvalkalender wijzigen of uitzetten (beheerder)*
- Bij een verhuizing verandert de beheerder het adres, of hij zet de afvalkalender uit (BR-56).

**Businessregels**

- **BR-47: Bron en bakken.**
  - De enige bron is de huisvuilkalender van de gemeente Den Haag.
  - De app maakt alleen taken voor **restafval, papier en PMD**. GFT en andere soorten (grofvuil, kerstbomen) worden genegeerd, ook als de gemeente ze voor het adres noemt.
  - Er is geen schakelaar per bak (zie "Bewust niet").

- **BR-48: Het adres.**
  - Per huishouden is er hooguit één adres: postcode, huisnummer en een optionele toevoeging.
  - Alleen een beheerder mag het invoeren, wijzigen of verwijderen.
  - De postcode wordt genormaliseerd: hoofdletters, spatie mag wel of niet (bijvoorbeeld "2511ab" wordt "2511 AB"). Een toevoeging ("12A", "12-2", "12 bis") moet mogelijk zijn.
  - Het adres wordt **pas bewaard nadat de gemeente-agenda het adres kent en minstens één ophaaldag geeft** voor rest, papier of PMD. Anders wordt niets bewaard en krijgt de beheerder een uitleg. — waarom: een fout adres geeft stil verkeerde of geen taken, en dan vergeet het gezin juist de bak.

- **BR-49: Welke taken er per ophaaldag ontstaan.** Voor elke ophaaldag D van een van de drie bakken maakt het systeem twee taken:
  - **Buitenzetten.** Gepland op D−1, met tijd 21:00 en een herinnering om 21:00 (V-44). Uiterlijk D om 07:45 [OPEN: V-49].
  - **Binnenzetten.** Gepland op D. Beschikbaar vanaf 12:00 [OPEN: V-48], uiterlijk D om 23:59. Of er een herinnering bij komt en hoe laat: [OPEN: V-48].
  - Vallen er meerdere bakken op dezelfde dag, dan komt er per soort (buiten of binnen) **één taak met alle bakken in de naam**, bijvoorbeeld "Restafval en papier buitenzetten" [OPEN: V-51].
  - De taken zijn van het hele huishouden. Er is geen toewijzing (V-21).
  - Het systeem maakt ze; ze hebben geen maker die een lid is.

- **BR-50: Vooruit plannen en nooit dubbel.**
  - Er staan altijd afvaltaken klaar voor alle ophaaldagen in de komende **14 dagen**, net als bij BR-02 [OPEN: V-52].
  - Per huishouden, ophaaldag en soort (buiten of binnen) bestaat **nooit** meer dan één afvaltaak. Dat blijft zo bij herhaald bijwerken, bij overlappende planner-runs en als twee beheerders tegelijk opslaan.
  - Een taak waarvan het moment al voorbij is, wordt niet meer aangemaakt:
    - buitenzetten alleen zolang het nog vóór D 07:45 is;
    - binnenzetten alleen zolang het nog vóór het einde van D is.

- **BR-51: De gemeente-agenda is leidend.**
  - De app controleert de agenda minstens één keer per dag. Een wijziging staat uiterlijk 24 uur later in de app. Hoe dat technisch gebeurt, bepaalt de architect.
  - Voor **open** afvaltaken (niet afgevinkt en niet overgeslagen) volgt de app de agenda:
    - een verschoven ophaaldag verschuift de taken mee, bijvoorbeeld bij een feestdag;
    - een ophaaldag die verdwijnt, laat zijn open taken vervallen. Die tellen niet als "vergeten" en komen niet in de historie;
    - bij een nieuwe ophaaldag komen er taken bij;
    - komt er een bak bij of valt er een weg op een dag, dan wordt de naam van de gecombineerde taak aangepast.
  - Afgevinkte en overgeslagen taken worden door het bijwerken **nooit** gewijzigd of verwijderd.
  - Is "buitenzetten" al afgevinkt en verdwijnt of verschuift de ophaaldag daarna, dan **blijft "binnenzetten" staan**. De bak staat immers buiten.

- **BR-52: Nooit gokken, nooit stil falen.**
  - Is de bron onbereikbaar, of geeft hij onbruikbare gegevens, dan:
    - blijven de bestaande afvaltaken ongewijzigd;
    - maakt de app **nooit** zelf ophaaldagen aan op basis van een vermoed patroon;
    - probeert de app het later opnieuw.
  - Lukt het bijwerken langer dan **48 uur** niet, of geeft de bron voor de komende 14 dagen geen enkele ophaaldag terwijl er eerder wel waren (bijvoorbeeld bij de jaarwisseling, als de nieuwe kalender nog niet online staat), dan:
    - ziet de beheerder dat in Instellingen, met de datum van de laatste geslaagde bijwerking;
    - krijgen de beheerders één in-app-melding "De afvalkalender kon niet worden bijgewerkt" [OPEN: V-50].
  - Lukt het weer, dan verdwijnt de waarschuwing en wordt de planning aangevuld.
  - — waarom: stil wegvallende taken zijn erger dan geen functie, omdat het gezin erop vertrouwt.

- **BR-53: Wat leden met afvaltaken mogen** [OPEN: V-54].
  - **Mag:** afvinken, terugdraaien (BR-13), "bezig" (BR-14), notitie, "deze keer overslaan". Iedereen mag dit, net als bij andere taken.
  - **Mag niet:** de naam, de datum of de tijd wijzigen, verplaatsen of verwijderen. Niemand mag dat, ook een beheerder niet; de gemeente bepaalt de dag. Dit wijkt voor afvaltaken af van BR-23.
  - Wordt "buitenzetten" overgeslagen, dan wordt "binnenzetten" van dezelfde ophaaldag ook overgeslagen.
  - Buitenzetten en binnenzetten worden los van elkaar afgevinkt. Het ene sluit het andere niet af.

- **BR-54: Verlopen.**
  - Buitenzetten is verlopen na D 07:45 en wordt aan het einde van D automatisch "overgeslagen". Hij telt als vergeten (vergelijk BR-16).
  - Binnenzetten is verlopen na het einde van D. Hij blijft verlopen staan tot iemand hem afvinkt, of tot de volgende buitenzet-taak beschikbaar wordt. Dan wordt hij overgeslagen.

- **BR-55: Meldingen** [OPEN: V-50].
  - De herinnering om 21:00 volgt de bestaande instelling "Herinneringen" (BR-31, V-23): standaard aan voor Ellen en Jurgen, uit voor Lynn en Kai. Er is geen aparte schakelaar.
  - Voor afvaltaken komen er **geen** meldingen "deadline nadert" of "verlopen". Die zouden bijvoorbeeld om 05:45 's nachts komen.
  - Verder gelden de regels van BR-31: versturen binnen 90 minuten na het moment, anders vervalt de melding, en nooit dubbel.
  - De tekst van de melding noemt de bak en de ophaaldag, **nooit het adres** en nooit een naam van een lid.

- **BR-56: Uitzetten en adres wijzigen.**
  - **Uitzetten** door een beheerder, met bevestiging:
    - het adres wordt direct gewist;
    - alle open afvaltaken vervallen (ze tellen niet als vergeten);
    - de historie blijft (BR-12).
  - Weer aanzetten betekent het adres opnieuw invoeren.
  - **Adres wijzigen:**
    - de nieuwe controle volgt BR-48;
    - pas na bevestiging vervallen de open afvaltaken van het oude adres en komen de taken voor het nieuwe adres ervoor in de plaats;
    - mislukt de controle, dan blijven het oude adres en de oude taken ongewijzigd.

- **BR-57: Bestaande handmatige taken.**
  - De afvalkalender raakt bestaande, handmatig gemaakte taken en reeksen **nooit** aan, ook niet als ze "afval" of "container" heten.
  - De app herkent ze niet.
  - De bouwer controleert na de livegang (alleen lezen) of er handmatige afvalreeksen zijn, en noemt ze aan Jurgen. Die stopt ze zelf, als hij dat wil.

- **BR-58: Privacy van het adres.**
  - Er wordt alleen bewaard: postcode, huisnummer en toevoeging. Straat en plaats worden niet bewaard, behalve als weergave uit de gemeentebron voor de controle "Klopt dit?". Die weergave wordt niet opgeslagen.
  - Het adres wordt **alleen** naar de huisvuilkalender van Den Haag gestuurd, zonder naam, e-mail of andere gegevens van het huishouden.
  - Het adres komt **nooit** in meldingen, pushinhoud, historie of de eigen logregels van de app.
  - Het is alleen zichtbaar voor leden van het eigen huishouden. Welke leden precies: [OPEN: V-53]. Voor andere huishoudens is het **nooit** zichtbaar (BR-26).
  - Het adres verdwijnt bij uitzetten (BR-56) en bij het verwijderen van het huishouden.

- **BR-59: Tijd.**
  - Alle momenten (21:00, 07:45, 12:00, einde van de dag) zijn kloktijden in Europe/Amsterdam (BR-40).
  - Ze blijven dezelfde kloktijd bij de overgang naar zomer- of wintertijd.

**Randgevallen (aanvulling op §6)**

| Geval | Bedoeld gedrag |
| --- | --- |
| Ophaaldag verschoven door een feestdag | Open taken schuiven mee (BR-51) |
| Twee of drie bakken op dezelfde dag | Eén buitenzet-taak en één binnenzet-taak met alle bakken in de naam (BR-49, [OPEN: V-51]) |
| Ophaaldag verdwijnt uit de agenda | Open taken vervallen, niet als vergeten. Was buitenzetten al afgevinkt, dan blijft binnenzetten staan (BR-51) |
| Nieuwe ophaaldag pas na 21:00 ontdekt | De taak komt er alsnog. De herinnering gaat mee als het nog binnen 90 minuten na 21:00 is, anders niet. Na D 07:45 komt er geen buitenzet-taak meer (BR-50) |
| Adres ongeldig, buiten Den Haag of zonder bakken | Niets bewaard, met uitleg (BR-48) |
| Bron onbereikbaar | Niets gewijzigd, niets verzonnen; na 48 uur een signaal aan de beheerders (BR-52) |
| Jaarwisseling zonder nieuwe kalender | Zelfde signaal als bij een onbereikbare bron (BR-52) |
| Zomer- of wintertijd | Dezelfde kloktijden (BR-59) |
| Twee beheerders slaan tegelijk een adres op | De laatste geldt. Er zijn nooit taken voor twee adressen tegelijk (BR-50) |

**Rollen en rechten (regels erbij voor de tabel in §7)**

| Actie | Beheerder | Gezinslid |
| --- | --- | --- |
| Afvalkalender aanzetten, adres invoeren of wijzigen, uitzetten | Ja | Nee |
| Adres zien | Ja | [OPEN: V-53] (voorstel: nee, alleen "Afvalkalender staat aan") |
| Status van het bijwerken zien (laatste keer gelukt, waarschuwing) | Ja | Nee |
| Afvaltaak afvinken, terugdraaien, bezig, notitie, deze keer overslaan | Ja | Ja |
| Afvaltaak hernoemen, verplaatsen, verwijderen | Nee | Nee ([OPEN: V-54]) |

**Gegevens (regels erbij voor de tabel in §8)**

| Gegeven | Waarom nodig | Bron | Persoonsgegeven | Bewaren tot |
| --- | --- | --- | --- | --- |
| Adres (postcode, huisnummer, toevoeging) | De ophaaldagen opvragen | Beheerder | Ja: woonadres van een gezin met minderjarigen | Tot uitzetten of verwijderen van het huishouden (BR-56, BR-58) |
| Opgehaalde ophaaldagen (datum, bak) | Taken maken en wijzigingen herkennen | Gemeente Den Haag | Nee (alleen via het adres herleidbaar) | Alleen de komende periode; voorbije dagen worden niet bewaard (ze leven voort als taak of historie) |
| Stand van het bijwerken (laatste gelukt, laatste fout als code) | Beheerder waarschuwen (BR-52) | Systeem | Nee | Tot uitzetten |
| Afvaltaken en hun afvinkingen | Als bij andere taken | Systeem | Nee | Als bij andere taken (BR-45) |

- **Bewust niet opgeslagen:** straat en plaats, de coördinaten, en de ruwe antwoorden van de gemeentebron.
- **Externe partijen (aanvulling):** de gemeente Den Haag (huisvuilkalender) krijgt bij elke opvraging postcode, huisnummer en toevoeging. Er gaan geen andere gegevens mee.

**Afhankelijkheden (aanvulling op §9)**

| Afhankelijkheid | Waarvoor | Risico |
| --- | --- | --- |
| Huisvuilkalender van de gemeente Den Haag | Ophaaldagen per adres | Geen officiële koppeling beloofd: de site kan veranderen of uitvallen. Vanuit de ontwikkelomgeving nu niet bereikbaar (netwerkbeleid). Of er een iCal-link of een open gegevensbron is, zoekt de architect uit. Opvang via BR-52 |
| Planner (WP3) | Periodiek bijwerken en herinneringen | Zonder WP3 geen tijdige herinnering; daarom komt dit werkpakket na WP3 (V-46) |

**Bewust niet (aanvulling op §10).** De regel "Agenda-koppelingen … na de MVP" krijgt de toevoeging: "met uitzondering van de afvalkalender van de gemeente Den Haag (W-03, besluit van Jurgen)". Verder blijft buiten scope:
- **GFT, grofvuil, kerstbomen en ophaalmeldingen:** Jurgen noemde alleen rest, papier en PMD (V-43).
- **Andere gemeenten of meerdere adressen:** alleen het eigen gezin in Den Haag (V-05, V-08).
- **Een schakelaar per bak of een eigen tijd per bak:** drie vaste bakken en vaste tijden houden het eenvoudig. Zo'n schakelaar vraagt instellingen die niemand gevraagd heeft.
- **Koppeling met Google-agenda of export als iCal:** vraagt een extra inlogkoppeling (W-03, optie verworpen).
- **Automatisch herkennen en opruimen van handmatige afvaltaken:** de app zou dan moeten raden op titels, en dan kan er een verkeerde taak verdwijnen (BR-57).
- **Een melding "bak niet opgehaald":** de app weet niet of de gemeente de bak echt geleegd heeft.

**Succescriteria (aanvulling op §11), drie maanden na de livegang van dit werkpakket:**
1. Elke ophaaldag van rest, papier en PMD in de gemeente-agenda heeft een buitenzet-taak en een binnenzet-taak. Dit wordt gecontroleerd met een steekproef: de bouwer vergelijkt de komende 14 dagen met de agenda op dag 30 en dag 90.
2. Minstens 90% van de buitenzet-taken is vóór 07:45 afgevinkt. Dit is te zien in de historie ("te laat").
3. Geen dubbele afvaltaken en geen ophaaldag die stil ontbrak. Elke storing van meer dan 48 uur was voor de beheerders zichtbaar.
4. Jurgen geeft aan dat er in die drie maanden geen bak is blijven staan door vergeten. Dat is een gesprek, geen meting.

**§12, regels erbij:**
- V-41…V-44: keuze B, bron Den Haag, rest/papier/PMD, 21:00. Verwerkt in §14, BR-47 en BR-49.
- V-45: het adres mag worden bewaard. Verwerkt in BR-48 en BR-58.
- V-46: eigen werkpakket na WP3. Verwerkt in §9 en AC-214.
- V-47: binnenzetten vanaf de middag. Verwerkt in BR-49.

---

## 2. Acceptatiecriteria

Nieuwe sectie **"WP3b — Afvalkalender (W-03)"**. De naam van het werkpakket bepaalt de architect. Het formaat volgt het bestaande document; de voorbeelddata gebruiken dezelfde rollen.

### AC-183: Adres instellen door een beheerder (WP-afval; BR-48, BR-49, BR-50; UC-13)
GEGEVEN Jurgen (beheerder) en een geldig Haags adres met ophaaldagen voor rest, papier en PMD
WANNEER hij postcode en huisnummer invult, de getoonde eerstvolgende ophaaldagen per bak controleert en bevestigt
DAN:
- is het adres bewaard;
- staan er voor elke ophaaldag in de komende 14 dagen een buitenzet-taak en een binnenzet-taak (BR-49);
- is dat zichtbaar in de huidige schermen Vandaag en Kalender.
**Toets:** Int + E2E

### AC-184: Ongeldig adres (WP-afval; BR-48)
GEGEVEN Jurgen in het adresformulier
WANNEER hij een postcode invult die niet uit 4 cijfers en 2 letters bestaat, of een leeg of niet-numeriek huisnummer
DAN kan hij niet bevestigen, ziet hij bij het veld wat er mis is, en wordt niets bewaard of opgevraagd
**Toets:** Unit + E2E

### AC-185: Adres onbekend of buiten Den Haag (WP-afval; BR-48)
GEGEVEN een correct geschreven postcode buiten Den Haag (bijvoorbeeld Rijswijk), of een Haags adres dat de gemeente-agenda niet kent
WANNEER Jurgen het invult
DAN:
- ziet hij "Dit adres staat niet in de huisvuilkalender van Den Haag";
- wordt er geen adres bewaard;
- ontstaan er geen taken;
- blijft een eerder bewaard adres ongewijzigd.
**Toets:** Int (bron nagebootst) + E2E

### AC-186: Adres zonder rest, papier of PMD (WP-afval; BR-47, BR-48)
GEGEVEN een Haags adres waarvoor de agenda alleen GFT geeft, of niets (bijvoorbeeld alleen een ondergrondse container)
WANNEER Jurgen het invult
DAN ziet hij dat er voor dit adres geen ophaaldagen voor rest, papier of PMD zijn, en wordt niets bewaard
**Toets:** Int

### AC-187: Toevoeging en schrijfwijze (WP-afval; BR-48)
GEGEVEN het adres "2511ab" en huisnummer "12 a"
WANNEER Jurgen het invult
DAN wordt het opgevraagd en bewaard als "2511 AB", huisnummer 12, toevoeging "A", en geeft "2511 AB 12A" hetzelfde resultaat
**Toets:** Unit

### AC-188: Gezinslid kan de afvalkalender niet beheren (WP-afval; BR-48, BR-56; §7)
GEGEVEN Lynn (gezinslid)
WANNEER ze Instellingen opent, of met een direct verzoek (actie of rechtstreeks op de tabel) een adres invoert, wijzigt of de afvalkalender uitzet
DAN ziet ze geen wijzigmogelijkheid, wordt het verzoek geweigerd, en verandert er niets (adres, taken, stand)
**Toets:** DB + Int + E2E

### AC-189: Wie het adres ziet (WP-afval; BR-58, BR-26; [OPEN: V-53])
GEGEVEN een huishouden met een bewaard adres, Lynn (gezinslid) en Bas (ander huishouden)
WANNEER Lynn Instellingen opent en Bas het adres probeert te lezen via elk mogelijk verzoek
DAN:
- ziet Lynn alleen "Afvalkalender staat aan", zonder adres (voorstel V-53);
- krijgt Bas niets terug;
- zien Jurgen en Ellen het volledige adres.
**Toets:** DB + E2E

### AC-190: Dubbel opslaan en twee beheerders tegelijk (WP-afval; BR-10, BR-50)
GEGEVEN Jurgen tikt twee keer snel op "Bevestigen", en tegelijk slaat Ellen een ander adres op
WANNEER beide verzoeken verwerkt zijn
DAN:
- is er precies één adres (het laatst opgeslagen);
- zijn er alleen taken voor dat adres;
- bestaat geen enkele combinatie (ophaaldag, buiten/binnen) twee keer.
**Toets:** Int

### AC-191: De buitenzet-taak (WP-afval; BR-49; V-44)
GEGEVEN een ophaaldag voor restafval op dinsdag 6 oktober 2026
WANNEER de taken klaarstaan
DAN:
- staat "Restafval buitenzetten" gepland op maandag 5 oktober om 21:00;
- heeft de taak een herinnering om 21:00;
- is de taak uiterlijk dinsdag 6 oktober om 07:45 af te vinken [OPEN: V-49].
**Toets:** Unit + Int

### AC-192: De binnenzet-taak (WP-afval; BR-49; V-47; [OPEN: V-48])
GEGEVEN dezelfde ophaaldag
WANNEER de taken klaarstaan
DAN:
- staat "Restafval binnenzetten" gepland op dinsdag 6 oktober;
- staat die taak vóór 12:00 niet bij wat er nu te doen is, en vanaf 12:00 wel;
- is de taak uiterlijk dinsdag om 23:59 af te vinken;
- komt er een herinnering volgens het antwoord op V-48 (voorstel: 18:00).
**Toets:** Unit + E2E

### AC-193: Twee bakken op dezelfde dag (WP-afval; BR-49; [OPEN: V-51])
GEGEVEN rest en papier hebben allebei ophaaldag dinsdag 6 oktober
WANNEER de taken klaarstaan
DAN:
- is er één taak "Restafval en papier buitenzetten" (maandag 21:00) en één taak "Restafval en papier binnenzetten" (dinsdag);
- krijgt elke ontvanger om 21:00 één herinnering, niet twee.
**Toets:** Unit + Int

### AC-194: Alleen rest, papier en PMD (WP-afval; BR-47; V-43)
GEGEVEN de agenda voor het adres noemt ook GFT en grofvuil
WANNEER de taken worden gemaakt
DAN komen er alleen taken voor rest, papier en PMD, en noemt geen enkele taaknaam GFT of grofvuil
**Toets:** Unit

### AC-195: 14 dagen vooruit en nooit dubbel (WP-afval; BR-50; [OPEN: V-52])
GEGEVEN een bewaard adres
WANNEER het bijwerken twee keer achter elkaar draait op dezelfde tijd, of twee keer tegelijk
DAN:
- staan er taken voor alle ophaaldagen in de komende 14 dagen, en niet verder;
- zijn er geen extra taken of meldingen bijgekomen.
**Toets:** Int

### AC-196: Verschoven ophaaldag (feestdag) (WP-afval; BR-51)
GEGEVEN een open buitenzet-taak en binnenzet-taak voor ophaaldag vrijdag 25 december 2026, en de gemeente verschuift die dag naar zaterdag 26 december
WANNEER het bijwerken draait
DAN:
- staan buitenzetten op vrijdag 25 december 21:00 en binnenzetten op zaterdag 26 december;
- zijn er voor 25 december geen afvaltaken meer over;
- is er niets als vergeten geteld.
**Toets:** Unit + Int

### AC-197: Ophaaldag verdwijnt uit de agenda (WP-afval; BR-51)
GEGEVEN open afvaltaken voor een ophaaldag die daarna uit de agenda verdwijnt
WANNEER het bijwerken draait
DAN zijn beide taken verdwenen, staan ze niet in de historie en tellen ze niet mee in het Overzicht als vergeten of overgeslagen
**Toets:** Int

### AC-198: Ophaaldag verdwijnt terwijl de bak al buiten staat (WP-afval; BR-51)
GEGEVEN "buitenzetten" voor dinsdag is afgevinkt, en daarna verdwijnt of verschuift die ophaaldag
WANNEER het bijwerken draait
DAN:
- blijft de afgevinkte buitenzet-taak ongewijzigd in de historie;
- blijft "binnenzetten" voor dinsdag staan;
- komen er bij een verschuiving ook taken voor de nieuwe dag.
**Toets:** Int

### AC-199: Een bak komt erbij of valt weg op een dag (WP-afval; BR-51; [OPEN: V-51])
GEGEVEN een open taak "Restafval en papier buitenzetten", en de agenda haalt papier van die dag af of voegt PMD toe
WANNEER het bijwerken draait
DAN heet de open taak "Restafval buitenzetten" of "Restafval, papier en PMD buitenzetten". Is de taak al afgevinkt, dan blijft hij ongewijzigd
**Toets:** Unit + Int

### AC-200: Afgevinkt en overgeslagen blijft onaangetast (WP-afval; BR-51, BR-12)
GEGEVEN afgevinkte en overgeslagen afvaltaken
WANNEER de agenda iets verandert aan die ophaaldagen en het bijwerken draait
DAN veranderen hun datum, naam, status en historie niet
**Toets:** Int

### AC-201: Een nieuwe ophaaldag wordt laat ontdekt (WP-afval; BR-50, BR-31)
GEGEVEN de agenda voegt een ophaaldag toe voor woensdag 7 oktober 2026
WANNEER het bijwerken (a) om 21:40 op dinsdag draait, (b) om 23:00 op dinsdag, (c) om 08:00 op woensdag
DAN:
- (a) komt de buitenzet-taak er, en gaat de herinnering nog mee (binnen 90 minuten na 21:00);
- (b) komt de buitenzet-taak er zonder herinnering;
- (c) komt alleen de binnenzet-taak er.
**Toets:** Unit + Int

### AC-202: Bron tijdelijk onbereikbaar (WP-afval; BR-52)
GEGEVEN bestaande afvaltaken, en de gemeentebron geeft een fout, een time-out of een onbegrijpelijk antwoord
WANNEER het bijwerken draait
DAN:
- verandert er niets aan de afvaltaken en het adres;
- verschijnen er geen verzonnen ophaaldagen;
- draaien de andere stappen van de planner gewoon (vergelijk AC-076);
- wordt het later opnieuw geprobeerd;
- bevat de log alleen een code, geen adres.
**Toets:** Int

### AC-203: Langdurige storing of geen ophaaldagen (WP-afval; BR-52; [OPEN: V-50])
GEGEVEN het bijwerken lukt al meer dan 48 uur niet, of de bron geeft voor de komende 14 dagen geen enkele ophaaldag terwijl er eerder wel waren
WANNEER de planner draait
DAN:
- zien Jurgen en Ellen in Instellingen "Afvalkalender niet bijgewerkt sinds <datum>";
- krijgen ze elk één in-app-melding, en niet elke run opnieuw;
- ziet Lynn geen waarschuwing.

Lukt het daarna weer, dan verdwijnt de waarschuwing en worden de taken aangevuld.
**Toets:** Int + E2E

### AC-204: Zomer- en wintertijd (WP-afval; BR-59, BR-40)
GEGEVEN ophaaldag maandag 26 oktober 2026 (na de overgang naar wintertijd op 25 oktober), en ophaaldag maandag 29 maart 2027 (na de overgang naar zomertijd op 28 maart)
WANNEER de taken en herinneringen worden gemaakt
DAN komt de herinnering op zondag om 21:00 Nederlandse tijd, en ligt "uiterlijk" op maandag om 07:45 Nederlandse tijd, in beide gevallen
**Toets:** Unit

### AC-205: Buitenzetten en binnenzetten afvinken los van elkaar (WP-afval; BR-53, BR-12, BR-13)
GEGEVEN een open buitenzet-taak en een binnenzet-taak voor dezelfde ophaaldag
WANNEER Lynn binnenzetten afvinkt terwijl buitenzetten nog open staat, en Kai daarna het afvinken van binnenzetten terugdraait
DAN:
- blijft buitenzetten ongewijzigd open;
- is binnenzetten na het terugdraaien weer open;
- staat er in de historie nergens wie afvinkte.
**Toets:** Int + E2E

### AC-206: Wat wel en niet kan met een afvaltaak (WP-afval; BR-53; [OPEN: V-54])
GEGEVEN een open afvaltaak
WANNEER Jurgen (beheerder) of Lynn probeert hem te hernoemen, te verplaatsen of te verwijderen, via de interface of met een direct verzoek
DAN:
- ontbreken die keuzes in de interface;
- wordt een direct verzoek geweigerd, en verandert er niets;
- lukken afvinken, bezig, notitie en "deze keer overslaan" wel.

Wordt buitenzetten overgeslagen, dan is binnenzetten van die dag ook overgeslagen.
**Toets:** DB + Int + E2E

### AC-207: Verlopen en automatisch overslaan (WP-afval; BR-54)
GEGEVEN een buitenzet-taak voor ophaaldag dinsdag, niet afgevinkt
WANNEER het dinsdag 07:46 is, en later dinsdag 23:59 voorbij is
DAN:
- staat de buitenzet-taak om 07:46 bij Verlopen;
- is de buitenzet-taak na het einde van dinsdag "overgeslagen", en telt hij als vergeten.

Een niet-afgevinkte binnenzet-taak staat vanaf woensdag bij Verlopen en blijft daar tot hij afgevinkt is, of tot de volgende buitenzet-taak beschikbaar komt. Dan wordt hij overgeslagen.
**Toets:** Unit + Int

### AC-208: Wie krijgt de afvalherinnering (WP-afval; BR-55, BR-31, V-23; [OPEN: V-50])
GEGEVEN Jurgen en Ellen met herinneringen aan (standaard), Lynn met de standaard (uit), Kai uitgezet
WANNEER het maandag 21:00 is voor een ophaaldag op dinsdag
DAN:
- krijgen alleen Jurgen en Ellen de herinnering, elk één keer;
- komen er voor afvaltaken geen meldingen "deadline nadert" of "verlopen", ook niet 's nachts.

Zet Lynn herinneringen aan, dan krijgt zij hem ook.
**Toets:** Unit + Int

### AC-209: Geen adres of namen in meldingen en logs (WP-afval; BR-58, BR-12)
GEGEVEN alle afvalmeldingen, de pushinhoud, de historie en de eigen logregels bij een geslaagd en een mislukt bijwerken
WANNEER die worden gecontroleerd
DAN komen postcode, huisnummer, straat en namen van leden er nergens in voor. Wel staan er de bak en de ophaaldag in
**Toets:** Unit + Int

### AC-210: Afvalkalender uitzetten (WP-afval; BR-56)
GEGEVEN een bewaard adres, open afvaltaken, en afgevinkte afvaltaken in de historie
WANNEER Jurgen de afvalkalender uitzet en bevestigt
DAN:
- is het adres uit de database verdwenen;
- zijn alle open afvaltaken verdwenen, zonder als vergeten te tellen;
- staat de historie er nog;
- maakt het bijwerken daarna geen afvaltaken meer.

Annuleert hij in de bevestiging, dan verandert er niets.
**Toets:** DB + Int + E2E

### AC-211: Adres wijzigen (verhuizen) (WP-afval; BR-56, BR-48)
GEGEVEN een bewaard adres met open afvaltaken
WANNEER Jurgen een nieuw geldig adres invult en bevestigt
DAN zijn de open taken van het oude adres vervangen door die van het nieuwe, en blijven afgevinkte taken ongewijzigd.

Is het nieuwe adres ongeldig of onbekend, dan blijven het oude adres en de oude taken staan.
**Toets:** Int

### AC-212: Handmatige taken blijven ongemoeid (WP-afval; BR-57)
GEGEVEN een handmatige reeks "Afval buitenzetten" (elke maandag) en een losse taak "Container schoonmaken"
WANNEER de afvalkalender wordt aangezet, bijgewerkt, gewijzigd of uitgezet
DAN veranderen die reeks en die taak niet
**Toets:** Int

### AC-213: Huishouden verwijderen wist het adres (WP-afval; BR-58; UC-12)
GEGEVEN een huishouden met een bewaard adres
WANNEER een beheerder het huishouden verwijdert (AC-138)
DAN bestaan het adres, de opgehaalde ophaaldagen en de stand van het bijwerken niet meer
**Toets:** DB

### AC-214: Werkt in de huidige schermen (WP-afval; V-46)
GEGEVEN de huidige interface, vóór WP4
WANNEER het werkpakket live gaat
DAN kan een beheerder daar het adres invoeren, wijzigen en uitzetten, en zijn de afvaltaken op Vandaag en in de Kalender te zien en af te vinken. In de nieuwe schermen (WP4–WP8) moet hetzelfde kunnen
**Toets:** E2E (huidige build) + Live-rooktest door Jurgen

### AC-215: Alleen het adres gaat naar de gemeente (WP-afval; BR-58)
GEGEVEN een opvraging bij de gemeentebron
WANNEER het verzoek wordt bekeken
DAN bevat het alleen postcode, huisnummer en toevoeging, en geen naam, e-mailadres, id van het huishouden of andere gegevens
**Toets:** Int + security-review

**Regels erbij voor de dekkingstabel:**

| Regel | Criteria |
| --- | --- |
| BR-47 | AC-186, AC-194 |
| BR-48 | AC-183–AC-188, AC-211 |
| BR-49 | AC-183, AC-191–AC-193 |
| BR-50 | AC-190, AC-195, AC-201 |
| BR-51 | AC-196–AC-200 |
| BR-52 | AC-202, AC-203 |
| BR-53 | AC-205, AC-206 |
| BR-54 | AC-207 |
| BR-55 | AC-208 |
| BR-56 | AC-188, AC-210, AC-211 |
| BR-57 | AC-212 |
| BR-58 | AC-189, AC-209, AC-213, AC-215 |
| BR-59 | AC-204 |

---

## 3. Vragen voor Jurgen (gebundeld per onderwerp)

**Tijden**
- **V-48:** "Binnenzetten vanaf die middag": vanaf hoe laat staat de taak klaar, en wil je er een herinnering bij?
  - Waarom: dit bepaalt wanneer de taak op Vandaag verschijnt en of er 's middags of 's avonds een melding komt.
  - Voorstel: de taak staat klaar vanaf **12:00**, met een herinnering om **18:00** voor wie thuiskomt. Uiterlijk om 23:59 die dag. De gemeente zegt: is de bak om 17:00 niet geleegd, zet hem dan 's avonds binnen. Klopt dat?
- **V-49:** Volgens de gemeente mag de bak pas **vanaf 22:00** buiten en moet hij er **uiterlijk om 07:45** staan. Bij te vroeg of te laat buitenzetten kan een boete volgen. Blijft de herinnering om 21:00?
  - Waarom: je koos 21:00, maar dat ligt vóór de toegestane tijd.
  - Voorstel: de herinnering blijft om **21:00**, en de taak zegt "mag vanaf 22:00 buiten, uiterlijk 07:45". Na 07:45 telt de taak als te laat. Of wil je de herinnering liever om 22:00?

**Meldingen**
- **V-50:** Wie krijgt de afvalherinneringen, en wie hoort het als de gemeentekalender niet bij te werken is?
  - Waarom: het bepaalt wie om 21:00 een melding krijgt en wie een storing opmerkt.
  - Voorstel: de herinnering volgt ieders gewone instelling "Herinneringen" (standaard Ellen en Jurgen; Lynn en Kai alleen als ze het zelf aanzetten), zonder aparte schakelaar. Voor afvaltaken komen er geen meldingen "deadline nadert" of "verlopen" (die zouden om 05:45 's nachts komen). Bij een storing van meer dan 48 uur krijgen alleen Ellen en Jurgen één melding.

**Taken**
- **V-51:** Staan er twee of drie bakken op dezelfde dag, wil je dan één taak of een taak per bak?
  - Waarom: één taak betekent één tik en één melding. Aparte taken laten per bak zien wat er gedaan is, maar geven meer meldingen.
  - Voorstel: één taak, bijvoorbeeld "Restafval en papier buitenzetten", met één herinnering.
- **V-52:** Hoe ver vooruit zet de app de afvaltaken klaar?
  - Waarom: dat bepaalt hoe ver je in de Kalender de ophaaldagen ziet.
  - Voorstel: **14 dagen**, net als bij de andere terugkerende taken.
- **V-54:** Mag iemand een afvaltaak hernoemen, verplaatsen of verwijderen?
  - Waarom: bij gewone taken mag iedereen wijzigen, maar hier bepaalt de gemeente de dag, en de app kan een verplaatste taak niet meer goed bijhouden.
  - Voorstel: **nee** (ook een beheerder niet). Wel afvinken, terugdraaien, "bezig", een notitie en "deze keer overslaan". Sla je buitenzetten over, dan vervalt binnenzetten van die dag ook.

**Rechten en privacy**
- **V-53:** Wie mag het adres instellen en zien?
  - Waarom: het woonadres is een persoonsgegeven.
  - Voorstel: alleen de beheerders (Ellen en Jurgen) zien, wijzigen en verwijderen het adres. Lynn en Kai zien alleen dat de afvalkalender aan staat, en krijgen gewoon de taken.

## Aannames (expliciet, geen invloed op rechten, gegevens of scope)
- Taaknamen gebruiken "Restafval", "Papier" en "PMD". Welke woorden en welke categorie precies, beslist de product-designer.
- De gemeente-agenda wordt minstens één keer per dag gecontroleerd. De architect kiest hoe vaak precies, zolang een wijziging binnen 24 uur in de app staat (BR-51).

## Aandachtspunten voor de hoofdsessie
- §10 van PRODUCT_SPEC ("Agenda-koppelingen … na de MVP") moet een uitzondering voor W-03 krijgen. Anders spreekt het document zichzelf tegen.
- BR-53 wijkt voor afvaltaken af van BR-23 (iedereen mag wijzigen) en BR-55 van BR-31 ("deadline nadert" en "verlopen"). Beide zijn bewust en hangen af van V-54 en V-50.
- De architect moet uitzoeken hoe de app bij de gegevens komt (iCal of een open bron) en of de server van de app huisvuilkalender.denhaag.nl kan bereiken. Vanuit de sandbox is het domein geblokkeerd. De regels van de gemeente (22:00 en 07:45) moet de architect of de bouwer nog op de pagina zelf bevestigen.
- Na de livegang controleert de bouwer (alleen lezen) of er al handmatige afvalreeksen zijn, en noemt die aan Jurgen (BR-57).

### Status
WACHT OP ANTWOORDEN: V-48, V-49, V-50, V-51, V-52, V-53, V-54. V-48, V-51, V-53 en V-54 raken de kern. De tekst hierboven volgt overal het voorstel; na de antwoorden hoeven alleen de plekken met [OPEN] te worden bijgewerkt.
