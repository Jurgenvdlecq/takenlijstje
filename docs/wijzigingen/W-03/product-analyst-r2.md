## Product-analyse: W-03 afvalkalender, ronde 2
Documenten bijgewerkt: geen. `docs/PRODUCT_SPEC.md` en `docs/ACCEPTANCE_CRITERIA.md` zijn bevroren. De tekst hieronder is definitief, bevat geen [OPEN]-plekken en kan letterlijk worden ingevoegd.
Niveau-advies: **2 blijft**. Er komen een externe bron en een woonadres (persoonsgegeven) bij, maar het blijft een interne gezinsapp. De security-review is verplicht: de app roept een externe bron aan, bewaart een adres en krijgt nieuwe rechtenregels.

**Controle op de nummers** (gedaan met grep op `docs/`):
- De hoogste bestaande nummers zijn BR-46, UC-12 en AC-182. BR-47 en hoger, UC-13 en hoger en AC-183 en hoger komen alleen voor in PROGRESS (één verwijzing naar "BR-52") en in mijn tekst uit ronde 1.
- Nieuw zijn dus BR-47 t/m BR-59, UC-13 t/m UC-15 en AC-183 t/m AC-219. De gaten in de BR-reeks (BR-03 t/m BR-07 en andere) blijven bewust ongebruikt.
- De nummers zijn gewijzigd ten opzichte van ronde 1: AC-188 en AC-194 zijn nieuw, dus vanaf AC-188 verschuift alles. Verwijs voortaan alleen naar deze ronde.

**Verwerkt uit PROGRESS:**
- V-48, V-49, V-51 en V-55 (antwoord van 2026-09-29, eerste blok);
- V-50, V-52, V-53, V-54, V-56 en V-57 (tweede blok);
- de toestand op live na WP2b: leden zonder account bestaan niet meer, er is nu 1 lid (Jurgen, beheerder).

---

# DEEL 1 — Tekst voor PRODUCT_SPEC.md

## 1a. Nieuwe sectie, na §13: "§14 Afvalkalender (W-03)"

### §14 Afvalkalender (W-03)

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
    - per richting (buiten of binnen) komt er **één** taak, met alle bakken in de naam, in de vaste volgorde restafval, papier, PMD. Bijvoorbeeld "Restafval en papier buitenzetten", of "Restafval, papier en PMD binnenzetten";
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

## 1b. Aanvullingen in bestaande secties van PRODUCT_SPEC

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
- `[AANNAME]` De taaknamen gebruiken de woorden "Restafval", "Papier" en "PMD" plus "buitenzetten" of "binnenzetten". De precieze woorden en de categorie kiest de product-designer. De regel "één taak met alle bakken in de naam" staat vast (BR-49).

---

# DEEL 2 — Tekst voor ACCEPTANCE_CRITERIA.md

## 2a. Bij "Bronnen" en "Afspraken"

- **In de tabel "Bronnen",** de regel `docs/PROGRESS.md` wordt: "Besluiten van Jurgen V-05 t/m V-39, en V-41 t/m V-57 (W-03)".
- **Bij "Afspraken", een punt erbij:**
  > - **W-03 — afvalkalender (WP3b).** De criteria AC-183 t/m AC-219 staan in de sectie WP3b, direct na WP3. Ze volgen PRODUCT_SPEC §14 (BR-47 t/m BR-59) en de antwoorden V-41 t/m V-57.
  >   - "D" is de ophaaldag.
  >   - Alle tijden zijn Europe/Amsterdam.
  >   - De gemeentebron wordt in Unit en Int altijd nagebootst met vastgelegde antwoorden (fixtures). Alleen de Live-toets gebruikt de echte bron.

## 2b. Nieuwe sectie, direct na "WP3 — Planner, tick, meldingen en bewaartermijnen"

## WP3b — Afvalkalender (W-03)

### AC-183 — Adres instellen door een beheerder (WP3b; BR-48, BR-49, BR-50; UC-13)
GEGEVEN Jurgen (beheerder) en een geldig Haags adres met ophaaldagen voor rest, papier en PMD
WANNEER hij postcode en huisnummer invult, bij "Klopt dit?" het adres en de eerstvolgende ophaaldag per bak ziet, en bevestigt
DAN:
- is het adres bewaard;
- staat er voor elke ophaaldag van vandaag t/m vandaag + 14 dagen één buitenzet-taak en één binnenzet-taak (BR-49);
- zijn die zichtbaar op Vandaag en in de Kalender van de huidige schermen.

Annuleert hij bij "Klopt dit?", dan is er niets bewaard en zijn er geen taken ontstaan.
**Toets:** Int + E2E

### AC-184 — Ongeldig formaat (WP3b; BR-48)
GEGEVEN Jurgen in het adresformulier
WANNEER hij een van deze dingen invult:
- een postcode die niet uit 4 cijfers (niet beginnend met 0) en 2 letters bestaat;
- een leeg huisnummer, een huisnummer dat geen getal is, of een getal buiten 1 t/m 99999
DAN:
- kan hij niet bevestigen;
- ziet hij bij het veld wat er mis is;
- wordt er niets bewaard en niets bij de gemeente opgevraagd.
**Toets:** Unit + E2E

### AC-185 — Adres onbekend of buiten Den Haag (WP3b; BR-48)
GEGEVEN een correct geschreven postcode buiten Den Haag (bijvoorbeeld Rijswijk), of een Haags adres dat de huisvuilkalender niet kent
WANNEER Jurgen het invult
DAN:
- ziet hij "Dit adres staat niet in de huisvuilkalender van Den Haag";
- wordt er geen adres bewaard en ontstaan er geen taken;
- blijft een eerder bewaard adres, met de taken ervan, ongewijzigd.
**Toets:** Int + E2E

### AC-186 — Adres zonder rest, papier of PMD (WP3b; BR-47, BR-48)
GEGEVEN een Haags adres waarvoor de agenda alleen GFT geeft, of niets (bijvoorbeeld bij een ondergrondse container)
WANNEER Jurgen het invult
DAN:
- ziet hij dat er voor dit adres geen ophaaldagen voor rest, papier of PMD zijn;
- wordt er niets bewaard.
**Toets:** Int

### AC-187 — Schrijfwijze, toevoeging en meerdere adressen (WP3b; BR-48)
GEGEVEN een van deze drie situaties:
- (a) invoer "2511ab" en huisnummer "12 a";
- (b) invoer "2511 AB" met "12A";
- (c) een huisnummer waaronder de gemeente meerdere adressen kent (12, 12A, 12B), ingevuld zonder letter of toevoeging
WANNEER Jurgen het invult
DAN:
- worden (a) en (b) op dezelfde manier opgevraagd en bewaard, als "2511 AB", huisnummer 12, toevoeging "A";
- kiest de app bij (c) niet zelf, maar vraagt hij om de letter of toevoeging. Er is dan nog niets bewaard.
**Toets:** Unit + Int

### AC-188 — Bron onbereikbaar tijdens het instellen (WP3b; BR-48)
GEGEVEN de gemeentebron geeft een fout of een time-out
WANNEER Jurgen een adres invult en bevestigt, (a) zonder bestaand adres of (b) als wijziging van een bestaand adres
DAN:
- ziet hij "De huisvuilkalender is nu niet bereikbaar. Probeer het later opnieuw.";
- is er bij (a) geen adres bewaard;
- zijn bij (b) het oude adres en de oude taken ongewijzigd;
- is er in geen van beide gevallen een taak bijgekomen of verdwenen.
**Toets:** Int

### AC-189 — Een gezinslid kan de afvalkalender niet beheren (WP3b; BR-48, BR-56; PRODUCT_SPEC §7)
GEGEVEN Lynn (gezinslid) en Kai (uitgezet lid)
WANNEER Lynn Instellingen opent, of een van beiden met een direct verzoek (een actie, of rechtstreeks op de tabel) een adres invoert, wijzigt of de afvalkalender uitzet
DAN:
- ziet Lynn geen mogelijkheid om iets te wijzigen;
- wordt elk verzoek geweigerd;
- verandert er niets aan het adres, de opgehaalde ophaaldagen, de stand van het bijwerken of de taken;
- vraagt de server bij de gemeente niets op.
**Toets:** DB + Int + E2E

### AC-190 — Wie het adres ziet (WP3b; BR-58, BR-26; V-53)
GEGEVEN een huishouden met een bewaard adres, Jurgen (beheerder), Lynn (gezinslid) en Bas (ander huishouden)
WANNEER ieder van hen Instellingen opent, en Lynn en Bas het adres en de adrescode proberen te lezen via elk mogelijk verzoek
DAN:
- ziet Jurgen het volledige adres en de stand van het bijwerken;
- ziet Lynn alleen "Afvalkalender staat aan": geen adres, geen adrescode en geen stand van het bijwerken. Haar verzoeken geven het adres niet terug;
- krijgt Bas niets terug, ook niet dat er een afvalkalender is.
**Toets:** DB + E2E

### AC-191 — Dubbel bevestigen en twee beheerders tegelijk (WP3b; BR-10, BR-50)
GEGEVEN Jurgen tikt twee keer snel op "Bevestigen", en tegelijk bevestigt Ellen een ander geldig adres
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
- staat "Restafval buitenzetten" gepland op maandag 5 oktober om 21:00;
- heeft de taak een herinnering om 21:00;
- is de deadline dinsdag 6 oktober om 07:45. Afvinken om 07:50 registreert "te laat" (BR-12);
- toont de taak "Mag vanaf 22:00 buiten, uiterlijk 07:45".
**Toets:** Unit + Int + E2E

### AC-193 — De binnenzet-taak (WP3b; BR-49; V-47, V-48, V-55)
GEGEVEN dezelfde ophaaldag
WANNEER de taken klaarstaan
DAN:
- staat "Restafval binnenzetten" gepland op dinsdag 6 oktober;
- staat die taak vóór 12:00 niet tussen wat nu te doen is, en vanaf 12:00 wel;
- is de deadline het einde van dinsdag;
- heeft de taak een herinnering om 18:00;
- lukt afvinken om 10:00 ook.

Voor papier en PMD geldt hetzelfde: elke bak krijgt ook een binnenzet-taak.
**Toets:** Unit + E2E

### AC-194 — Herinneringen alleen voor open afvaltaken (WP3b; BR-55, BR-31)
GEGEVEN Jurgen met herinneringen aan, en ophaaldag dinsdag 6 oktober
WANNEER de tick draait:
- (a) om 21:00 op maandag, terwijl buitenzetten om 20:30 al is afgevinkt;
- (b) om 18:00 op dinsdag, terwijl binnenzetten om 14:00 al is afgevinkt;
- (c) zoals (a) en (b), maar met beide taken nog open
DAN:
- komt er bij (a) en (b) geen herinnering;
- krijgt Jurgen bij (c) om 21:00 één herinnering die "vanaf 22:00" noemt, en om 18:00 één herinnering binnenzetten.

Een tweede tick verstuurt niets opnieuw.
**Toets:** Unit + Int

### AC-195 — Twee bakken op dezelfde dag (WP3b; BR-49; V-51)
GEGEVEN rest en papier hebben allebei ophaaldag dinsdag 6 oktober
WANNEER de taken klaarstaan en de herinneringen verstuurd worden
DAN:
- is er één taak "Restafval en papier buitenzetten" (maandag 21:00) en één taak "Restafval en papier binnenzetten" (dinsdag);
- krijgt elke ontvanger om 21:00 één herinnering en om 18:00 één herinnering, niet één per bak.

Bij alle drie de bakken heet de taak "Restafval, papier en PMD buitenzetten". De volgorde van de bakken ligt altijd vast.
**Toets:** Unit + Int

### AC-196 — Alleen rest, papier en PMD (WP3b; BR-47; V-43)
GEGEVEN de agenda voor het adres noemt ook GFT, grofvuil en een onbekende soort
WANNEER de taken worden gemaakt
DAN:
- komen er alleen taken voor ophaaldagen van rest, papier en PMD;
- noemt geen enkele taaknaam GFT, grofvuil of de onbekende soort;
- ontstaat er voor een dag met alleen GFT geen taak.
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
GEGEVEN een open buitenzet-taak en een open binnenzet-taak voor ophaaldag vrijdag 25 december 2026, en de gemeente verschuift die dag naar zaterdag 26 december
WANNEER het bijwerken draait
DAN:
- staat buitenzetten op vrijdag 25 december om 21:00, en binnenzetten op zaterdag 26 december;
- zijn er voor ophaaldag 25 december geen afvaltaken meer;
- is er niets als vergeten of overgeslagen geteld, en staat er niets in de historie.
**Toets:** Unit + Int

### AC-199 — Een ophaaldag verdwijnt uit de agenda (WP3b; BR-51)
GEGEVEN open afvaltaken voor een ophaaldag die daarna uit de agenda verdwijnt, terwijl de andere ophaaldagen blijven
WANNEER het bijwerken draait
DAN:
- zijn beide taken verdwenen;
- staan ze niet in de historie;
- tellen ze in het Overzicht niet mee als vergeten of overgeslagen.
**Toets:** Int

### AC-200 — Een ophaaldag verdwijnt terwijl de bak al buiten staat (WP3b; BR-51)
GEGEVEN buitenzetten voor dinsdag is afgevinkt, en daarna verdwijnt die ophaaldag of verschuift hij naar woensdag
WANNEER het bijwerken draait
DAN:
- blijft de afgevinkte buitenzet-taak ongewijzigd in de historie;
- blijft binnenzetten voor dinsdag staan;
- komen er bij een verschuiving ook taken voor woensdag.
**Toets:** Int

### AC-201 — Een bak komt erbij of valt weg op een dag (WP3b; BR-51; V-51)
GEGEVEN een open taak "Restafval en papier buitenzetten", en de agenda haalt papier van die dag af, of voegt PMD toe
WANNEER het bijwerken draait
DAN:
- heet de open taak "Restafval buitenzetten" of "Restafval, papier en PMD buitenzetten";
- is er nog steeds één taak per richting.

Was de taak al afgevinkt of overgeslagen, dan blijft hij ongewijzigd.
**Toets:** Unit + Int

### AC-202 — Afgevinkt en overgeslagen blijft onaangetast (WP3b; BR-51, BR-12)
GEGEVEN afgevinkte en overgeslagen afvaltaken
WANNEER de agenda iets verandert aan die ophaaldagen en het bijwerken draait
DAN veranderen hun datum, naam, status en historie niet
**Toets:** Int

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

### AC-204 — Bron tijdelijk onbereikbaar of onbruikbaar (WP3b; BR-52)
GEGEVEN bestaande afvaltaken, en de gemeentebron geeft een van deze antwoorden:
- een fout, een time-out of een onbegrijpelijk antwoord;
- een volledig leeg antwoord voor alle drie de bakken, terwijl er eerder ophaaldagen in dat bereik bekend waren
WANNEER het bijwerken draait
DAN:
- verandert er niets aan de afvaltaken, het adres en de opgehaalde ophaaldagen;
- verschijnen er geen verzonnen ophaaldagen;
- draaien de andere stappen van de achtergrondtaak gewoon (vergelijk AC-076);
- wordt het later opnieuw geprobeerd;
- bevat de log alleen een code, geen adres en geen adrescode.

Geeft de bron alleen voor papier geen dagen, terwijl rest en PMD wel dagen hebben (zoals rond de kerst), dan geldt dat niet als storing. De open papiertaken voor verdwenen dagen vervallen volgens AC-199.
**Toets:** Int

### AC-205 — Langdurige storing (WP3b; BR-52, BR-55; V-50)
GEGEVEN het bijwerken lukt al meer dan 48 uur niet, of het volledig lege antwoord uit AC-204 duurt voort, met Jurgen en Ellen (beheerders, Ellen met herinneringen uit) en Lynn (gezinslid)
WANNEER de achtergrondtaak meerdere keren draait
DAN:
- zien Jurgen en Ellen in Instellingen "Afvalkalender niet bijgewerkt sinds <datum>";
- krijgen Jurgen en Ellen elk precies één melding "De afvalkalender kon niet worden bijgewerkt…", met een link naar Instellingen, en niet bij elke ronde opnieuw;
- krijgt Lynn geen melding en ziet ze geen waarschuwing;
- noemt de melding het adres niet.

Lukt het daarna weer, dan verdwijnt de waarschuwing en worden de taken aangevuld. Een latere, nieuwe storing van meer dan 48 uur geeft opnieuw één melding.
**Toets:** Int + E2E

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
WANNEER Jurgen (beheerder) of Lynn (gezinslid) probeert de taak te hernoemen, de datum, tijd, deadline, omschrijving of herinneringen te wijzigen, te verplaatsen, te verwijderen of om te zetten naar een terugkerende taak, via de interface of met een direct verzoek
DAN:
- ontbreken die keuzes in de interface;
- wordt een direct verzoek geweigerd, en verandert er niets;
- lukken afvinken, terugdraaien, "bezig", een notitie plaatsen en "deze keer overslaan" wel.
**Toets:** DB + Int + E2E

### AC-209 — Buitenzetten overslaan neemt binnenzetten mee (WP3b; BR-53)
GEGEVEN een open buitenzet-taak en een open binnenzet-taak voor dezelfde ophaaldag
WANNEER Lynn bij buitenzetten "Deze keer overslaan" kiest, en daarna "Ongedaan maken"
DAN:
- zijn na het overslaan beide taken overgeslagen, en komt er om 18:00 geen herinnering binnenzetten;
- staan na het ongedaan maken beide weer open.

Overslaan van alleen binnenzetten laat buitenzetten ongemoeid.
**Toets:** Int + E2E

### AC-210 — Verlopen en vanzelf vervallen (WP3b; BR-54; V-54)
GEGEVEN buitenzetten en binnenzetten voor ophaaldag dinsdag, geen van beide afgevinkt, en de volgende ophaaldag vrijdag
WANNEER het dinsdag 07:46 is, daarna het einde van dinsdag voorbij is, en daarna donderdag begint
DAN:
- staat buitenzetten om 07:46 bij Verlopen;
- is buitenzetten na het einde van dinsdag "overgeslagen", en telt als vergeten;
- staat binnenzetten vanaf woensdag bij Verlopen;
- is binnenzetten aan het begin van donderdag (de dag van de volgende buitenzet-taak) "overgeslagen", en telt als vergeten.

Vinkt iemand binnenzetten woensdag af, dan is hij gedaan, met "te laat".
**Toets:** Unit + Int

### AC-211 — Wie de afvalherinnering krijgt (WP3b; BR-55, BR-31; V-23, V-50)
GEGEVEN Jurgen en Ellen met herinneringen aan (standaard), Lynn met de standaard (uit), en Kai uitgezet
WANNEER het maandag 21:00 is voor een ophaaldag op dinsdag, en daarna de hele dinsdag
DAN:
- krijgen alleen Jurgen en Ellen de herinneringen van 21:00 en 18:00, elk één keer;
- komen er voor afvaltaken geen meldingen "deadline nadert" of "verlopen", ook niet 's nachts of na 07:45;
- tellen de afvaltaken gewoon mee in het dag- en avondoverzicht.

Zet Lynn herinneringen aan, dan krijgt zij ze ook.
**Toets:** Unit + Int

### AC-212 — Geen adres of namen in meldingen, taken en logs (WP3b; BR-58, BR-12)
GEGEVEN alle afvalmeldingen (herinneringen en storing), de pushinhoud, de taaknamen, de historie en de eigen logregels van de app bij een geslaagde en een mislukte bijwerking
WANNEER die worden gecontroleerd
DAN komen postcode, huisnummer, adrescode, straat en namen van leden er nergens in voor. De bak en de dag mogen er wel in staan
**Toets:** Unit + Int

### AC-213 — Afvalkalender uitzetten (WP3b; BR-56)
GEGEVEN een bewaard adres, open afvaltaken, en afgevinkte en overgeslagen afvaltaken in de historie
WANNEER Jurgen de afvalkalender uitzet en bevestigt
DAN:
- zijn het adres, de adrescode, de opgehaalde ophaaldagen en de stand van het bijwerken uit de database verdwenen;
- zijn alle open afvaltaken verdwenen, zonder als vergeten te tellen;
- staat de historie er nog;
- maakt de achtergrondtaak daarna geen afvaltaken meer, en vraagt hij niets meer op bij de gemeente;
- ziet Lynn geen "Afvalkalender staat aan" meer.

Annuleert hij in de bevestiging, dan verandert er niets.
**Toets:** DB + Int + E2E

### AC-214 — Adres wijzigen (verhuizen) (WP3b; BR-56, BR-48)
GEGEVEN een bewaard adres met open en afgevinkte afvaltaken
WANNEER Jurgen een nieuw, geldig adres invult en bevestigt
DAN:
- zijn de open taken van het oude adres vervangen door die van het nieuwe adres;
- blijven afgevinkte en overgeslagen taken ongewijzigd;
- bestaan er nooit tegelijk taken voor beide adressen.

Is het nieuwe adres ongeldig of onbekend, of annuleert hij, dan blijven het oude adres en de oude taken staan.
**Toets:** Int

### AC-215 — Handmatige taken blijven ongemoeid (WP3b; BR-57; V-56)
GEGEVEN een handmatige reeks "Afvalcontainer buiten zetten" (elke maandag) en een losse taak "Container schoonmaken"
WANNEER de afvalkalender wordt aangezet, bijgewerkt, gewijzigd en uitgezet
DAN verandert er niets aan die reeks, die taak en hun uitvoeringen
**Toets:** Int

### AC-216 — Huishouden verwijderen wist het adres (WP3b; BR-58; UC-12; AC-138)
GEGEVEN een huishouden met een bewaard adres
WANNEER een beheerder het huishouden verwijdert (AC-138)
DAN bestaan het adres, de adrescode, de opgehaalde ophaaldagen, de stand van het bijwerken en de afvaltaken niet meer. Andere huishoudens zijn ongemoeid
**Toets:** DB

### AC-217 — Werkt in de huidige schermen (WP3b; V-46)
GEGEVEN de huidige interface, vóór WP4
WANNEER het werkpakket live gaat
DAN:
- kan een beheerder daar het adres invoeren, controleren ("Klopt dit?"), wijzigen en uitzetten, en de stand van het bijwerken zien;
- zijn de afvaltaken op Vandaag en in de Kalender te zien, en af te vinken, over te slaan en van een notitie te voorzien;
- vergelijkt Jurgen bij de rooktest met zijn eigen adres de ophaaldagen met de site van de gemeente.

In de nieuwe schermen (WP4 t/m WP8) moet hetzelfde kunnen.
**Toets:** E2E (huidige build) + Live (rooktest door Jurgen)

### AC-218 — Alleen het adres gaat naar de gemeente (WP3b; BR-58)
GEGEVEN elke opvraging bij de gemeentebron (bij het instellen, bij het bijwerken en bij een wijziging)
WANNEER het uitgaande verzoek wordt bekeken
DAN:
- bevat het alleen de postcode en het huisnummer, of de adrescode van de gemeente;
- bevat het geen naam, e-mailadres, id van het huishouden, id van een lid of andere gegevens;
- gaat het alleen naar de vaste basis-URL van de huisvuilkalender.
**Toets:** Int + security-review

### AC-219 — Alleen het systeem maakt afvaltaken (WP3b; BR-49, BR-20, BR-53)
GEGEVEN "Gezinsleden mogen taken maken" staat uit
WANNEER de afvalkalender plant, en daarnaast Lynn of Jurgen met een direct verzoek zelf een taak probeert aan te maken of te wijzigen zodat die als afvaltaak geldt
DAN:
- ontstaan de afvaltaken gewoon, zonder maker die een lid is;
- wordt het directe verzoek geweigerd;
- bestaat er geen door een lid gemaakte of gewijzigde afvaltaak.
**Toets:** DB + Int

## 2c. Aanvullingen in de sectie "Dekking"

**Harde regels, rijen erbij:**

| Regel | AC's |
| --- | --- |
| BR-47 | AC-186, AC-196 |
| BR-48 | AC-183 t/m AC-189, AC-214 |
| BR-49 | AC-183, AC-192, AC-193, AC-195, AC-219 |
| BR-50 | AC-183, AC-191, AC-197, AC-203 |
| BR-51 | AC-198 t/m AC-202 |
| BR-52 | AC-204, AC-205 |
| BR-53 | AC-207, AC-208, AC-209, AC-219 |
| BR-54 | AC-210 |
| BR-55 | AC-194, AC-205, AC-211 |
| BR-56 | AC-189, AC-213, AC-214 |
| BR-57 | AC-215 |
| BR-58 | AC-190, AC-212, AC-216, AC-218 |
| BR-59 | AC-206 |

**Bestaande rijen aanvullen:**
- BR-10: + AC-191
- BR-12: + AC-207, AC-212
- BR-13: + AC-207
- BR-20: + AC-219
- BR-26: + AC-190
- BR-31: + AC-194, AC-203, AC-211
- BR-40: + AC-206

**Een geweigerde actie per rol, erbij:**
- Gezinslid: AC-189 (afvalkalender beheren), AC-190 (adres lezen), AC-208 (afvaltaak wijzigen of verwijderen), AC-219 (zelf een afvaltaak maken).
- Uitgezet lid: AC-189.
- Beheerder: AC-208 (een afvaltaak wijzigen, verplaatsen of verwijderen), AC-219.
- Buitenstaander: AC-190.

**Verwerkte besluiten van Jurgen (W-03), erbij:**

| Besluit | AC's |
| --- | --- |
| V-41 t/m V-44 | AC-183, AC-192, AC-196 |
| V-45 | AC-183, AC-213, AC-216 |
| V-46 | AC-217 |
| V-47 en V-48 | AC-193, AC-194 |
| V-49 | AC-192, AC-194 |
| V-50 | AC-205, AC-211 |
| V-51 | AC-195, AC-201 |
| V-52 | AC-197 |
| V-53 | AC-189, AC-190, AC-205 |
| V-54 | AC-208, AC-209, AC-210 |
| V-55 | AC-193 |
| V-56 | AC-215 |

**Open bij Jurgen:** geen.

---

### Vragen voor Jurgen
Geen. Alle kernvragen zijn beantwoord.

### Interpretaties (ter controle door de hoofdsessie; binnen Jurgens antwoorden, zonder nieuwe keuze op rechten, gegevens of scope)
1. **V-54, de lijst "wel" is compleet.** Behalve hernoemen, verplaatsen en verwijderen mogen ook andere details (omschrijving, herinneringen, deadline) en omzetten naar een reeks niet. De notitie is het vrije kanaal.
2. **V-54 en V-50, overslaan en vervallen.**
   - Het doorwerken van "buitenzetten overslaan" naar binnenzetten geldt alleen voor handmatig overslaan. Vervalt buitenzetten vanzelf, dan blijft binnenzetten staan.
   - Een vergeten buitenzet-taak telt als vergeten, zoals voorgesteld in ronde 1.
3. **V-50, de storingsmelding.** Die gaat naar elke actieve beheerder, los van diens meldingsvoorkeuren. Er is geen nieuwe schakelaar.
4. **V-49, de tekst "vanaf 22:00" staat ook in de herinnering.** Zonder die tekst zou juist de herinnering van 21:00 tot te vroeg buitenzetten leiden.

### Aannames
- Zie §13: de taakwoorden en de categorie kiest de product-designer.

### Aandachtspunten voor de hoofdsessie en de solution-architect
Het technisch vooronderzoek (`docs/wijzigingen/W-03/solution-architect-r1.md`) is geschreven vóór de antwoorden. Op deze punten wijkt het af van de spec:
1. **De sleutel van een afvaltaak.** `external_key` is per bak (`waste:<bak>:<datum>:<out|in>`). V-51 vraagt één taak per ophaaldag en richting. De sleutel moet dus per huishouden, datum en richting zijn, en de open taak moet zijn naam kunnen aanpassen (BR-51, AC-201).
2. **Wie het adres mag lezen.** De architect stelt voor dat `waste_addresses` leesbaar is voor elk lid (`is_member`). V-53 zegt: alleen beheerders, ook voor `bag_id`. Gezinsleden hebben alleen een apart aan/uit-gegeven nodig (AC-190).
3. **Opslaan bij een onbereikbare bron.** De architect bewaart het adres dan toch, met `bag_id` leeg. De spec zegt: niets bewaren (BR-48, AC-188).
4. **De bescherming tegen een leeg antwoord.** Die werkt in het voorstel per bak. Volgens de spec is alleen een antwoord dat voor alle drie de bakken samen leeg is een storing. Een verdwenen papierdag moet gewoon vervallen (BR-52, AC-204).
5. **Maker leeg betekent in het voorstel "alleen beheerders mogen verwijderen", en `delete_task` doet een zachte verwijdering.** Volgens V-54 mag niemand een afvaltaak verwijderen of wijzigen. Het systeem is de enige schrijver (AC-208, AC-219).
6. **Nieuw in het ontwerp:**
   - de herinnering om 18:00 bij binnenzetten, met "beschikbaar vanaf" 12:00;
   - de storingsmelding als nieuw meldingstype;
   - het automatisch overslaan van binnenzetten (BR-54);
   - het uitschakelen van "deadline nadert" en "verlopen" voor afvaltaken.
7. **De gemeenteregels (22:00 en 07:45, minicontainer alleen op de ophaaldag) zijn alleen via zoekresultaten gezien.** De bouwer bevestigt ze op de pagina zelf zodra het netwerk dat toelaat (V-57). Wijken ze af, dan is dat een wijzigingsverzoek op de tekst in BR-49.
8. **Op live is nu alleen Jurgen lid (beheerder).** De rooktest (AC-217) en de storingsmelding raken dus alleen hem. De criteria gebruiken de gewone testrollen.

### Status
KLAAR VOOR UX-ONTWERP. De product-designer heeft vooral nodig: de sectie Afvalkalender in Instellingen (beheerder en gezinslid), "Klopt dit?", de tekst "mag vanaf 22:00 buiten, uiterlijk 07:45", hoe binnenzetten vóór 12:00 wordt getoond, en welke keuzes bij een afvaltaak ontbreken.

Bronbestanden: /home/user/takenlijstje/docs/PROGRESS.md, /home/user/takenlijstje/docs/PRODUCT_SPEC.md, /home/user/takenlijstje/docs/ACCEPTANCE_CRITERIA.md, /home/user/takenlijstje/docs/wijzigingen/W-03/product-analyst-r1.md, /home/user/takenlijstje/docs/wijzigingen/W-03/solution-architect-r1.md, /home/user/takenlijstje/src/domain/reminders.ts (bevestigt dat herinneringen alleen voor open taken komen).