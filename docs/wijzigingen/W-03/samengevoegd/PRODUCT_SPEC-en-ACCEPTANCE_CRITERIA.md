## Product-analyse: W-03 afvalkalender, samengevoegde invoegtekst (ronde 5)
Documenten bijgewerkt: geen, want ze zijn bevroren. Hieronder staat de definitieve tekst in twee blokken, per plek letterlijk. Die vervangt r3, r4, r4b en r4c in hun geheel; die rondes worden archief.
Niveau-advies: 2 blijft. Het is een interne gezinsapp met een externe bron en een woonadres, dus de security-review is verplicht.

**Basis:** r3 met alle delen (1a, 1b, 2a, 2b, 2c, 2d), daarop r4, r4b en r4c; bij overlap geldt de laatste.

**Verwerkt uit plan-critic W-03 ronde 3:**
- **Moet-punt 1:** D+7 blijft in BR-54 en AC-210. Er is ook een §6-rij "Binnenzetten vergeten" bij gekomen.
- **Moet-punt 2:** de §6-rij over de jaarwisseling en interpretatie nr. 3 volgen nu de jaareinde-regel.
- **Moet-punt 3:** AC-183 heeft een expliciete variant (b), en AC-237 verwijst daarheen. Alle verwijzingen zijn nagelopen.
- **Aanbeveling 8:** "leeg" betekent overal: geen datum van rest, papier of PMD. Kerstbomen en GFT tellen niet mee.
- **P0 U0.2:** een onbekende adrescode geeft `{}`. Dat geldt als "adres niet meer gevonden".
- **UX r4:** T-45a toont als plaats altijd "Den Haag". T-90b is overgenomen.

**Niet opnemen in de documenten:** statussen, vragen, wijzigingslijsten, de oude teksttabel en "Aansluiting op TD". De interpretaties staan hieronder apart, alleen voor het totaalvoorstel.

=== PRODUCT_SPEC.md ===

**P1. Nieuwe sectie §14, na §13 "Aannames en open vragen":**

## 14. Afvalkalender (W-03)

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

**Teksten.** Alle teksten die de gebruiker ziet (taaknamen, tijden, foutteksten, meldingen, storingsbalken) staan in UX_SPEC §13.16. Dat is de enige bron. Deze sectie legt de regels vast en noemt teksten alleen met hun ID uit UX §13.16.

**Gebruikers en rollen**
- **Beheerder** (in het ontwerp Ellen en Jurgen; op live nu alleen Jurgen, omdat leden zonder account sinds WP2b niet meer bestaan):
  - zet de afvalkalender aan en voert het adres in;
  - wijzigt het adres of zet de afvalkalender uit;
  - ziet het adres en de stand van het bijwerken (laatste keer gelukt, stille regels, storingsbalk);
  - kan bij een storing "Opnieuw proberen";
  - krijgt de storingsmelding (BR-52).
- **Gezinslid** (Lynn en Kai, als ze een account krijgen):
  - ziet de afvaltaken en handelt ze af, net als andere taken (BR-53);
  - ziet in Instellingen alleen of de afvalkalender aan of uit staat (T-38/T-38b of T-39/T-39b), zonder adres en zonder status (V-53).
- **Wie het resultaat ziet zonder het te gebruiken:** de gemeente Den Haag en haar leverancier van de huisvuilkalender (Opzet). Zij krijgen bij elke opvraging alleen het adres of de adrescode (BR-58).
- **Het adres hoort bij het huishouden**, niet bij de beheerder die het invoerde. Verwijdert die beheerder zijn account, dan blijft het adres staan.

**Use cases**

*UC-13: Afvalkalender instellen (beheerder)*
- **Begin:** Instellingen, onderdeel Afvalkalender. In de huidige schermen is dat de sectie Afvalkalender, na Huishouden, met de springlink "Afval".
- **Stappen:**
  1. De beheerder vult postcode en huisnummer in, eventueel met een huisletter of toevoeging.
  2. Hij kiest "Adres zoeken". De app zoekt het adres op in de huisvuilkalender van Den Haag.
  3. De app toont "Klopt dit?" (T-45) met:
     - het gevonden adres, met als plaats altijd "Den Haag" (T-45a);
     - de eerstvolgende ophaaldag per bak, of "nog geen ophaaldag bekend" bij een bak zonder datum (T-45b);
     - de uitleg T-46.
  4. De beheerder kiest "Ja, aanzetten".
- **Eind:** het adres is bewaard.
  - Liggen er ophaaldagen in de komende 14 dagen, dan staan de afvaltaken daarvoor klaar (BR-49, BR-50) en ziet de beheerder melding T-90.
  - Ligt de eerstvolgende ophaaldag verder weg, dan zijn er nog geen taken, en ziet hij melding T-90b (BR-48).
- **Wat kan misgaan.** In al deze gevallen wordt niets bewaard, blijven de velden gevuld, en blijft een eerder adres ongewijzigd (BR-48):
  - het formaat is ongeldig: foutregel bij het veld (T-43, T-44, T-44b);
  - het adres is onbekend, of ligt buiten Den Haag (T-60);
  - onder dit nummer vallen meerdere adressen, en er is geen letter of toevoeging opgegeven: de beheerder kiest zelf het adres (T-61);
  - het adres heeft geen ophaaldagen voor rest, papier of PMD, bijvoorbeeld bij een ondergrondse container (T-62). In januari geldt in plaats daarvan T-64 (BR-48);
  - de gemeente geeft geen enkele komende ophaaldag, bijvoorbeeld na de laatste ophaaldag van het jaar (eind november of december) of begin januari (T-64);
  - de bron is onbereikbaar of geeft een onbruikbaar antwoord (T-63);
  - opslaan mislukt (T-65).

*UC-14: Afvaltaken afhandelen (iedereen)*
- **Buitenzetten:**
  - de taak staat de hele dag vóór de ophaaldag op Vandaag, met "vanaf 22:00" (T-16);
  - om 21:00 komt de herinnering (M-01);
  - op de ophaaldag staat de taak er tot 07:45 nog, met "vóór 07:45" (T-17);
  - wie de bak buitenzet, vinkt de taak af.
- **Binnenzetten:**
  - de dag vóór de ophaaldag staat de taak onder Binnenkort met "morgen" (T-19);
  - op de ophaaldag staat hij vóór 12:00 bovenaan Binnenkort met "vanaf 12:00" (T-18), en vanaf 12:00 onder Vandaag;
  - om 18:00 komt de herinnering (M-02), als de taak nog open is;
  - wie de bak binnenzet, vinkt de taak af.
- Afvinken werkt zoals bij elke taak: één tik, zonder dat de app bijhoudt wie het deed (BR-12).
- Staat de bak deze keer niet buiten, dan kan iemand bij buitenzetten "Deze keer overslaan" kiezen. Binnenzetten van dezelfde ophaaldag wordt dan ook overgeslagen (BR-53, melding T-31).

*UC-15: Afvalkalender wijzigen of uitzetten, en de stand van het bijwerken (beheerder)*
- **Adres wijzigen, bijvoorbeeld bij een verhuizing:** "Wijzigen" → "Ander adres" (T-47) → "Klopt dit?" met de regel T-48 → "Ja, dit adres gebruiken" → melding T-91. Is het hetzelfde adres, dan volgt melding T-92 (BR-56).
- **Uitzetten:** "Afvalkalender uitzetten…" → bevestiging (T-80 met T-81, T-81b of T-81c) → melding T-93 (BR-56).
- **Stand van het bijwerken.** De beheerder ziet:
  - wanneer de kalender voor het laatst is bijgewerkt (T-70);
  - de eerstvolgende ophaaldag per bak;
  - bij een mislukte poging een stille regel (T-71/T-71b);
  - in november of december een stille regel als de kalender van het volgende jaar ontbreekt (T-73, BR-52);
  - bij een storing de balk per oorzaak, met "Opnieuw proberen" (BR-52).

**Businessregels**

- **BR-47 — Bron en bakken.**
  - De enige bron is de huisvuilkalender van de gemeente Den Haag.
  - De app maakt alleen taken voor **restafval, papier en PMD** (V-43). GFT, grofvuil, kerstbomen en andere soorten worden genegeerd, ook als de gemeente ze voor het adres noemt. Ze tellen ook nergens mee in de regels van BR-48 en BR-52.
  - Alle drie de bakken zijn containers (V-55). Elke ophaaldag geeft dus zowel buitenzetten als binnenzetten.
  - Er is geen schakelaar per bak (zie §10 "Bewust niet").

- **BR-48 — Het adres.**
  - Per huishouden is er hooguit **één** adres: postcode, huisnummer en een optionele huisletter of toevoeging.
  - Alleen een **beheerder** mag het invoeren, wijzigen of verwijderen (V-53).
  - **Invoer en controle:**
    - De postcode wordt genormaliseerd: hoofdletters, met of zonder spatie ("2511ab" wordt "2511 AB"). Toegestaan zijn 4 cijfers (niet beginnend met 0) en 2 letters.
    - Het huisnummer is een geheel getal van 1 t/m 99999.
    - Een letter of toevoeging moet mogelijk zijn ("12A", "12 a", "12-2"), met hooguit 4 letters of cijfers.
    - De knop "Adres zoeken" blijft uitgeschakeld zolang postcode of huisnummer leeg is. Bij een vormfout wordt er niets bij de gemeente opgevraagd.
  - **Wanneer het adres wordt bewaard:** pas als aan alle vier deze voorwaarden is voldaan:
    - de huisvuilkalender kent het adres;
    - hij levert precies één adres op;
    - hij geeft voor rest, papier en PMD samen **minstens één komende ophaaldag** (vandaag of later). Datums van GFT en kerstbomen tellen niet mee;
    - de beheerder heeft "Klopt dit?" bevestigd.
    — waarom: een fout adres geeft stil verkeerde of geen taken, en dan vergeet het gezin juist de bak.
  - **De eerstvolgende ophaaldag ligt verder dan 14 dagen weg** (bijvoorbeeld bij papier eens per 4 weken): het adres wordt **gewoon bewaard**.
    - Er ontstaan dan nog geen taken; die komen zodra de ophaaldag binnen de 14 dagen valt (BR-50).
    - De beheerder ziet T-90b, zonder "Bekijken". T-90 (met "Bekijken") geldt alleen als er minstens één taak is klaargezet.
    — waarom: een ophaaldag ver weg is normaal, en geen reden om het instellen te weigeren.
  - **Geen enkele komende ophaaldag** (bijvoorbeeld na de laatste ophaaldag van het jaar, eind november of in december, of begin januari, zolang de kalender van het nieuwe jaar nog niet online staat): er wordt niets bewaard, en de beheerder ziet T-64 (bij wijzigen T-64b).
    - De jaareinde-uitzondering uit BR-52 geldt bij het instellen **niet**.
    - **In januari** geeft de gemeente voor een nieuw jaar soms nog niets. Dan ziet de beheerder T-64 en niet T-62, ook als de kalender van het vorige jaar geen datums voor dit adres had. — waarom: in januari is "de nieuwe kalender staat nog niet online" veel waarschijnlijker dan "dit adres heeft geen bakken". T-64 bewaart ook niets.
    — waarom: dan geldt bij het instellen dezelfde regel als bij het bijwerken (BR-52), en kan een net bewaard adres niet meteen als storing gelden.
  - **Meerdere adressen onder hetzelfde nummer** (letters of toevoegingen), en geen toevoeging opgegeven: de app kiest **nooit** zelf. Hij toont T-61 met één rij per adres, en de beheerder kiest.
  - **Bron onbereikbaar of onbruikbaar tijdens het instellen:** er wordt **niets** bewaard. De beheerder ziet T-63, of T-63b als er al een adres is. Dat adres en de taken ervan blijven dan ongewijzigd.
  - **Hetzelfde adres opnieuw bevestigen:** de open afvaltaken blijven staan, met hun notities en de stand "bezig". De beheerder ziet T-92, en nooit een melding dat het te snel was.
  - Een gezinslid, een uitgezet lid of iemand van buiten kan het adres niet invoeren, wijzigen of verwijderen, ook niet met een direct verzoek. Een geweigerde poging geeft T-66.

- **BR-49 — Welke taken er per ophaaldag ontstaan.** Voor elke ophaaldag D waarop minstens één van de drie bakken wordt opgehaald, maakt het systeem precies twee taken.
  - **Buitenzetten:**
    - gepland op D−1, gesorteerd op 21:00. De app toont nergens "21:00" als tijd van de taak; 21:00 is alleen het moment van de herinnering;
    - herinnering om 21:00 op D−1 (V-44), met de tekst M-01, die "vanaf 22:00" en "uiterlijk morgen 07:45" noemt;
    - deadline: D om 07:45, de uiterste aanbiedtijd van de gemeente. Afvinken na 07:45 telt als te laat (BR-12);
    - V-49 ("mag vanaf 22:00 buiten, uiterlijk 07:45") wordt zo getoond:
      - in de lijst: "vanaf 22:00" (T-16) op D−1, en "vóór 07:45" (T-17) op D tot 07:45;
      - in het detail: de rijen "Mag buiten · <dag D−1> vanaf 22:00" (T-21) en "Uiterlijk · <dag D> 07:45" (T-22).
      — waarom: de herinnering komt vóór de toegestane tijd, en te vroeg buitenzetten kan een boete geven.
  - **Binnenzetten:**
    - gepland op D;
    - beschikbaar vanaf D 12:00;
    - deadline: het einde van D;
    - herinnering om 18:00 op D (V-48), met de tekst M-02;
    - in het detail: "Binnenzetten · <dag D> vanaf 12:00" (T-23) en "Uiterlijk · <dag D>, einde van de dag" (T-24);
    - afvinken vóór 12:00 mag wel, bijvoorbeeld als de bak al vroeg geleegd en binnengezet is.
  - **Geen omschrijving.** Afvaltaken hebben geen omschrijving. Alle tijden komen uit de lijst en de infolijst, altijd met absolute datums. — waarom: een vaste tekst als "uiterlijk vandaag" is op een andere dag onjuist, en zou dubbel naast de infolijst staan.
  - **Geen deadlinebadges** ("verloopt over …", "uiterlijk morgen") bij afvaltaken. Alleen "… te laat" bij Verlopen blijft.
  - **Taaknamen (V-51):**
    - per richting (buiten of binnen) komt er **één** taak, met alle bakken in de naam, in de vaste volgorde restafval, papier, PMD;
    - bij binnenzetten staat het woord "bak" in de naam, want de lege bak gaat naar binnen;
    - de exacte namen staan in UX §13.3 (T-01 t/m T-14), en die tabel is leidend. Voorbeelden: "Restafval buitenzetten", "Restafvalbak binnenzetten", "Restafval en papier buitenzetten", "Restafval- en papierbak binnenzetten", "Restafval, papier en PMD buitenzetten", "Restafval-, papier- en PMD-bak binnenzetten";
    - er komt één herinnering, niet één per bak.
  - **Alleen het systeem maakt afvaltaken:**
    - de taken zijn van het hele huishouden, zonder toewijzing (V-21), en zonder maker die een lid is;
    - de instelling "Gezinsleden mogen taken maken" (BR-20) geldt er niet voor;
    - geen lid kan zelf een taak maken die als afvaltaak geldt. Een handmatige taak die "afval" heet, is en blijft een gewone taak (BR-57).
  - Afvaltaken hebben het kenmerk "Afvalkalender" (T-15) met het recycle-icoon. Ze tellen mee zoals andere taken: in Vandaag, Taken, Kalender, het dag- en avondoverzicht, het Overzicht en de historie. In het categoriefilter vallen ze onder Buiten.

- **BR-50 — Vooruit plannen en nooit dubbel.**
  - Er staan altijd afvaltaken klaar voor elke ophaaldag van **vandaag t/m vandaag + 14 dagen** (V-52), net als bij BR-02. Verder vooruit worden ze niet gemaakt. Dat geldt ook tijdens een hapering of storing van de bron: dan op basis van de laatst bekende ophaaldagen (BR-52).
  - Per huishouden, ophaaldag en richting (buiten of binnen) bestaat **nooit** meer dan één afvaltaak. Dat blijft zo:
    - bij herhaald bijwerken;
    - als twee achtergrondrondes elkaar overlappen;
    - bij dubbel bevestigen;
    - als twee beheerders tegelijk opslaan;
    - bij een verschuiving (BR-51).
  - Een taak waarvan het moment al voorbij is, wordt niet meer aangemaakt:
    - buitenzetten alleen zolang het nog vóór D 07:45 is;
    - binnenzetten alleen zolang het nog vóór het einde van D is.
  - Een herinnering bij een laat aangemaakte taak volgt BR-31: ze komt alleen als het moment niet meer dan 90 minuten voorbij is.

- **BR-51 — De gemeente-agenda is leidend.**
  - De app controleert de agenda twee keer per dag, rond 06:00 en rond 17:00. Een wijziging staat uiterlijk 24 uur later in de app. Een wijziging die de gemeente overdag doorvoert, staat er meestal dezelfde avond al in, vóór de herinnering van 21:00.
  - Tussen twee vaste momenten wordt er na een geslaagde bijwerking niet opnieuw bij de gemeente opgevraagd. Na een mislukte poging probeert de app het ongeveer elk uur opnieuw (BR-52).
  - **Open** afvaltaken (niet afgevinkt en niet overgeslagen; "bezig" telt als open) volgen de agenda:
    - **Verschuiven betekent: dezelfde taak krijgt de nieuwe dag.** Notities en de stand "bezig" blijven staan. Dat gebeurt als aan alle drie deze voorwaarden is voldaan:
      - de nieuwe ophaaldag ligt hooguit 3 dagen van de oude;
      - hij heeft minstens één van dezelfde bakken;
      - er is voor die dag en richting nog geen afvaltaak.
      Anders vervalt de oude taak zoals bij een verdwenen ophaaldag, en komt er voor de nieuwe dag een nieuwe taak. Buitenzetten schuift alleen mee zolang het nieuwe moment (07:45 op de nieuwe ophaaldag) nog niet voorbij is. Anders vervalt de oude buitenzet-taak, en schuift binnenzetten wel mee.
    - Verdwijnt een ophaaldag, dan vervallen de open taken. Ze tellen niet als vergeten of overgeslagen, en komen niet in de historie. Notities bij die taken vervallen mee.
    - Bij een nieuwe ophaaldag komen er taken bij.
    - Komt er op een dag een bak bij of valt er een weg, dan past de naam van de open gecombineerde taak zich aan (UX §13.3).
  - Afgevinkte en overgeslagen afvaltaken worden bij het bijwerken **nooit** gewijzigd, verschoven of verwijderd.
  - Is buitenzetten al afgevinkt, en verdwijnt of verschuift de ophaaldag daarna, dan **blijft binnenzetten** voor die dag staan: de bak staat immers buiten. Bij een verschuiving komen er ook taken voor de nieuwe dag.

- **BR-52 — Nooit gokken, nooit stil falen.**
  - **De bron is onbereikbaar, geeft een onbruikbaar antwoord, of kent het adres niet meer:**
    - het adres en de bekende ophaaldagen blijven ongewijzigd;
    - bestaande afvaltaken worden **niet** verwijderd, verschoven of hernoemd;
    - voor al bekende ophaaldagen die binnen de 14 dagen komen, worden **wel** taken klaargezet (BR-50). Dat is geen gokken: die datums komen van de gemeente;
    - vanzelf vervallen volgens BR-54 loopt gewoon door, net als afvinken, overslaan en de herinneringen;
    - de app maakt **nooit** zelf ophaaldagen aan op basis van een vermoed patroon;
    - de andere taken van de achtergrondtaak lopen gewoon door;
    - later volgt een nieuwe poging.
    - Geeft de bron voor de bewaarde adrescode helemaal niets terug (geen enkele afvalsoort), dan geldt dat als "adres niet meer gevonden", en niet als een onbruikbaar antwoord (P0, U0.2).
  - **Een leeg antwoord:** de bron geeft voor rest, papier en PMD **samen geen enkele komende ophaaldag** (vandaag of later), en het jaareinde hieronder geldt niet. Dat is een verdacht leeg antwoord, en niet "alle ophaaldagen vervallen". Er gebeurt dan hetzelfde als bij een onbereikbare bron hierboven. Het adres en de bekende ophaaldagen blijven ongewijzigd, en bestaande afvaltaken worden niet verwijderd, verschoven of hernoemd. Voor al bekende ophaaldagen binnen de 14 dagen worden wel taken klaargezet, en BR-54 loopt door. Er volgt later een nieuwe poging.
    - Is de kalender van het lopende jaar voor rest, papier en PMD **helemaal leeg**, dan is dat altijd een leeg antwoord, in elke maand. Voorbeeld: op 1 januari, als de gemeente voor het nieuwe jaar nog geen datum voor rest, papier of PMD geeft.
    - Er geldt geen voorwaarde over wat er eerder bekend was. Een adres wordt alleen bewaard als er minstens één komende ophaaldag is (BR-48). "Geen enkele komende ophaaldag" is daarna dus altijd een verandering.
    - Datums van andere soorten (GFT, kerstbomen) tellen nergens in deze regel mee. Een kalender met alleen kerstboom- of GFT-datums geldt als leeg.
  - **Geen leeg antwoord:**
    - **Alleen ophaaldagen verder dan 14 dagen weg.** Voorbeeld: papier eens per 4 weken, met de eerstvolgende dag over ruim drie weken. Er komen dan nog geen taken (BR-50), maar er is geen storing en geen stille regel.
    - **Een enkele bak zonder ophaaldagen.** Voorbeeld: papier wordt van eind november tot half januari niet opgehaald.
    - **Het jaareinde:**
      - **Situatie:** het is november of december, er is voor rest, papier en PMD samen geen komende ophaaldag meer in dit jaar, en de kalender van volgend jaar bevat nog geen datum voor rest, papier of PMD. Datums van GFT of kerstbomen tellen niet mee.
      - **Gevolg:** dat is **geen storing**. Het bijwerken geldt als gelukt, en de beheerder ziet alleen de stille regel T-73. Er komt geen melding.
      - **Voorbeeld:** een adres met papier tot 24 november, op 26 november.
      - — waarom: in november en december kan "geen komende datum dit jaar" normaal zijn, en de gemeente publiceert het nieuwe jaar meestal pas in december.
      - **Bewuste grens:** stopt een adres in november of december echt met ophalen, dan ziet de beheerder tot 1 januari alleen T-73. In die periode gaan geen taken verloren.
      - **Alleen bij het bijwerken:** deze uitzondering geldt niet bij het instellen (BR-48: dan T-64).
  - **Wanneer het een storing is.** Er is een storing als:
    - (a) het bijwerken al meer dan 48 uur niet gelukt is (V-50), om welke reden ook. Dat geldt ook als er in die tijd geen mislukte poging is vastgelegd, bijvoorbeeld omdat de achtergrondtaak stil lag; of
    - (b) de bron twee of meer keer achter elkaar een leeg antwoord gaf, met minstens een uur tussen het eerste en het laatste lege antwoord, en zonder een andere uitkomst ertussen.
      - Een andere fout (bijvoorbeeld "onbereikbaar") tussen twee lege antwoorden laat de telling opnieuw beginnen.
      - Vaker "Opnieuw proberen" maakt de storing niet eerder, want de regel meet tijd, geen aantal.
  - **Korter dan een storing:** de beheerder ziet alleen de stille regel T-71, of T-71b als de gemeente het adres niet vond. Er komt geen melding en geen balk.
  - **Bij een storing:**
    - de beheerders zien in Instellingen de balk H. De tekst hangt af van de oorzaak van de laatste mislukte poging, niet van de reden van het alarm (UX §13.8.2):
      - onbereikbaar of onbruikbaar, of geen vastgelegde mislukte poging (H1): T-75 en T-76;
      - leeg antwoord (H2): T-77, met T-77a in december en januari, en T-77b in de andere maanden;
      - adres niet meer gevonden (H3): T-77c en T-77d, met de knop "Adres controleren";
    - een gemelde storing blijft zichtbaar tot het bijwerken weer lukt, ook als de oorzaak intussen verandert. De tekst volgt dan de nieuwe oorzaak;
    - elke actieve beheerder krijgt **één** melding: M-03, M-04 of M-05, afhankelijk van de oorzaak bij het versturen. Is er geen mislukte poging vastgelegd, dan is het M-03.
      - De melding linkt naar de instellingen van de afvalkalender (BR-25).
      - Hij wordt pas opnieuw verstuurd na een nieuwe storing, dus nadat het bijwerken eerst weer gelukt is.
      - Verandert de oorzaak tijdens de storing, dan komt er geen tweede melding;
    - gezinsleden krijgen geen melding en zien geen waarschuwing of stille regel (V-53).
  - **"Opnieuw proberen"** (alleen beheerders, in balk H):
    - tijdens de poging staat er "Bezig…" (T-77e);
    - is het gelukt, dan verdwijnt de balk, worden de wijzigingen van de gemeente verwerkt (BR-51), en verschijnt melding T-94;
    - lukt het nog steeds niet, dan komt regel T-78 in de balk;
    - heeft iemand anders of de achtergrondtaak het binnen de minuut al geprobeerd, dan komt regel T-79 in de balk. Er komt dan geen melding onderin en geen extra opvraging bij de gemeente.
  - **Lukt het weer**, dan verdwijnen de balk en de stille regel vanzelf, en worden de wijzigingen van de gemeente verwerkt (BR-51). Er komt geen melding "weer gelukt".
  - **Stille regel T-73.** De beheerder ziet T-73 als aan alle drie deze voorwaarden is voldaan:
    - de laatste bijwerking is gelukt;
    - de app kent nog geen enkele ophaaldag van rest, papier of PMD in het nieuwe jaar;
    - en een van deze twee geldt:
      - het is december, en de komende 14 dagen lopen al over de jaargrens; of
      - het is november of december, en er is geen enkele komende ophaaldag meer (het jaareinde hierboven).

    Er komt geen melding, en een gezinslid ziet niets.
  - — waarom: stil wegvallende taken zijn erger dan geen functie, omdat het gezin erop vertrouwt. Een onterechte storingsmelding elke maand, of elk jaareinde, zou de echte melding waardeloos maken.

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
    - verplaatsen, ook niet door te slepen in de Kalender;
    - verwijderen;
    - andere details wijzigen (omschrijving, deadline, herinneringen, prioriteit);
    - omzetten naar een terugkerende taak.
  - Die keuzes zijn verborgen, niet uitgeschakeld. In het detail staat de uitlegregel T-27. Komt er toch een verzoek binnen, bijvoorbeeld uit een oude offline wachtrij, dan wordt het geweigerd met T-33.
  - De gemeente bepaalt de dag. Dit wijkt voor afvaltaken af van BR-23.
  - **Overslaan werkt door:** slaat iemand buitenzetten over, dan wordt binnenzetten van dezelfde ophaaldag ook overgeslagen, met de melding T-31. Wordt dat overslaan ongedaan gemaakt, dan staan beide weer open. Dit geldt niet voor het automatisch vervallen uit BR-54. Overslaan van alleen binnenzetten laat buitenzetten ongemoeid.
  - **"Toch nog doen"** bij een overgeslagen afvaltaak kan alleen zolang de ophaaldag D nog niet voorbij is. — waarom: daarna zou de taak bij de volgende ronde meteen weer vervallen.
  - **Los afvinken:** buitenzetten en binnenzetten worden los van elkaar afgevinkt en teruggedraaid. Het ene sluit het andere niet af.

- **BR-54 — Verlopen en vervallen.**
  - **Buitenzetten:**
    - verlopen na D 07:45 (BR-17);
    - niet afgevinkt aan het einde van D? Dan wordt de taak vanzelf "overgeslagen", en telt hij als vergeten (V-54, vergelijk BR-16);
    - binnenzetten van die dag blijft daarbij gewoon staan.
  - **Binnenzetten:**
    - verlopen na het einde van D;
    - blijft bij Verlopen staan tot iemand de taak afvinkt, of tot de dag van de volgende buitenzet-taak begint, en **uiterlijk tot het begin van de zevende dag na de ophaaldag (D+7, 00:00)**. Wat het eerst komt, telt. Dan wordt de taak vanzelf "overgeslagen", en telt hij als vergeten.
    - — waarom: zonder bovengrens blijft binnenzetten bij een lange pauze weken bij Verlopen staan. Voorbeelden: papier eens per 4 weken, of de jaarwisseling.

- **BR-55 — Meldingen (V-50).**
  - **Herinneringen:**
    - de herinneringen van 21:00 (buitenzetten, M-01) en 18:00 (binnenzetten, M-02, in enkelvoud of meervoud naar het aantal bakken) volgen ieders bestaande instelling "Herinneringen" (BR-31, V-23): standaard aan voor beheerders, standaard uit voor gezinsleden. Er is geen aparte schakelaar;
    - een herinnering komt alleen als de taak op dat moment nog open is (niet afgevinkt en niet overgeslagen);
    - de rij "Herinnering" (T-25) staat alleen in het taakdetail als de eigen instelling "Herinneringen" van de kijker aan staat, de taak open is en het moment nog in de toekomst ligt.
  - Afvaltaken krijgen **geen** "deadline nadert" en **geen** "verlopen". — waarom: die zouden onder meer om 05:45 's nachts komen.
  - Verder gelden de regels van BR-31:
    - versturen binnen 90 minuten na het moment, anders vervalt de melding;
    - nooit dubbel;
    - "taak gedaan" volgens de eigen instelling.
  - De storingsmelding uit BR-52 (M-03, M-04, M-05; label T-39c in de lijst Meldingen) gaat naar elke actieve beheerder, ongeacht zijn meldingsvoorkeuren. Push komt erbij als die voor dat apparaat aan staat.
  - Meldingsteksten noemen de bak en de dag, **nooit het adres** en nooit de naam van een lid.

- **BR-56 — Uitzetten en adres wijzigen.**
  - **Uitzetten** door een beheerder, na een bevestiging (T-80, met T-81 bij 2 of meer open afvaltaken, T-81b bij 1 en T-81c bij 0):
    - het adres, de adrescode, de bekende ophaaldagen en de stand van het bijwerken worden direct gewist;
    - alle open afvaltaken vervallen, zonder als vergeten te tellen;
    - afgevinkte en overgeslagen afvaltaken blijven in de historie (BR-12);
    - daarna volgt melding T-93. Er is geen "ongedaan maken", want het adres is gewist;
    - weer aanzetten betekent het adres opnieuw invoeren (UC-13).
  - **Adres wijzigen:**
    - het nieuwe adres doorloopt dezelfde controle (BR-48);
    - pas na de bevestiging vervallen de open afvaltaken van het oude adres, en komen de taken voor het nieuwe adres ervoor in de plaats (T-48, T-91);
    - mislukt de controle, of annuleert de beheerder, dan blijven het oude adres en de oude taken ongewijzigd;
    - is het nieuwe adres hetzelfde als het bewaarde, dan verandert er niets aan de open taken (BR-48, T-92).

- **BR-57 — Handmatige taken blijven ongemoeid (V-56).**
  - De afvalkalender raakt bestaande, handmatig gemaakte taken en reeksen **nooit** aan, ook niet als ze "afval", "container" of "bak" heten. De app herkent ze niet.
  - Na het aanzetten ziet de beheerder één keer de tip T-54 (nieuwe schermen: T-53). Die kan hij wegtikken.
  - De bestaande reeks "Afvalcontainer buiten zetten" op live stopt Jurgen zelf zodra de afvalkalender werkt. De bouwer herinnert hem daar na de livegang één keer aan.
  - Tot Jurgen de reeks stopt, staan er dubbele afvaltaken. Dat is bewust geaccepteerd.

- **BR-58 — Privacy van het adres (V-45, V-53).**
  - **Wat bewaard wordt:**
    - alleen postcode, huisnummer, huisletter of toevoeging, en de adrescode die de gemeente teruggeeft (BAG-id);
    - straat en plaats worden **niet** bewaard. Ze worden alleen getoond bij "Klopt dit?".
  - **Wie het adres ziet:** het adres en de adrescode zijn alleen zichtbaar voor **beheerders** van het eigen huishouden (V-53). Dat geldt ook voor de storingsbalk H3, waarin het adres staat (T-77d).
    - Gezinsleden zien alleen of de afvalkalender aan staat.
    - Andere huishoudens zien **nooit** iets (BR-26).
    - Dit wijkt af van §7 ("ieder lid ziet alles").
  - **Wat naar buiten gaat:** alleen postcode en huisnummer (bij het opzoeken) of de adrescode (bij het ophalen van de ophaaldagen), en alleen naar de huisvuilkalender van Den Haag. De toevoeging gaat niet mee; de keuze tussen meerdere adressen gebeurt in de app. Er gaat nooit een naam, e-mailadres, id van het huishouden of ander gegeven mee.
  - **Waar het adres nooit komt:**
    - in meldingen;
    - in pushinhoud;
    - in taaknamen of de historie;
    - in de eigen logregels van de app (BR-12).
  - **Wanneer het verdwijnt:** bij uitzetten (BR-56) en bij het verwijderen van het huishouden.

- **BR-59 — Tijd.**
  - Alle momenten zijn kloktijden in Europe/Amsterdam (BR-40): 21:00, 22:00, 07:45, 12:00, 18:00, het einde van de dag, D+7 00:00, en de ophaalmomenten 06:00 en 17:00.
  - Ze blijven dezelfde kloktijd bij de overgang naar zomer- of wintertijd, ook als die overgang tussen D−1 21:00 en D 07:45 valt.

**P2. §5 "Overig", onderaan een regel erbij:**
> - **BR-47 t/m BR-59 — Afvalkalender:** zie §14 (W-03).

**P3. §5, BR-23: aan het eind van de bullet, na de bestaande afwijkingsnotitie, erbij:**
> *(voor afvaltaken geldt BR-53: niemand wijzigt, verplaatst of verwijdert ze)*

**P4. §5, BR-30: vervang "Hij doet vier dingen:" door "Hij doet vijf dingen:", en zet onder "verstuurt het dag- en avondoverzicht." een vijfde bullet:**
> - werkt de afvalkalender bij (twee keer per dag, na een mislukking ongeveer elk uur) en plant de afvaltaken (BR-50 t/m BR-52; sinds W-03).

**P5. §5, BR-31: als laatste subbullet erbij:**
> - *(afvaltaken: geen "deadline nadert" en geen "verlopen"; wel de storingsmelding voor beheerders, BR-52 en BR-55)*

**P6. §6 Randgevallen: deze rijen onderaan de tabel erbij:**

| Geval | Bedoeld gedrag |
| --- | --- |
| Ophaaldag verschoven door een feestdag (hooguit 3 dagen, zelfde bak) | Dezelfde open taken schuiven mee; notities en "bezig" blijven (BR-51) |
| Grote verschuiving (meer dan 3 dagen, of geen gemeenschappelijke bak) | Oude open taken vervallen, met hun notities; voor de nieuwe dag komen nieuwe taken (BR-51) |
| Twee of drie bakken op dezelfde dag | Eén buitenzet-taak en één binnenzet-taak, met alle bakken in de naam (BR-49, UX §13.3) |
| Ophaaldag verdwijnt uit de agenda | Open taken vervallen, zonder als vergeten te tellen. Was buitenzetten al afgevinkt, dan blijft binnenzetten staan (BR-51) |
| Gemeente wijzigt overdag | Meestal dezelfde avond vóór 21:00 in de app, via de ophaling van 17:00 (BR-51) |
| Nieuwe ophaaldag pas laat ontdekt | De taak komt er alsnog. De herinnering gaat mee als het moment niet meer dan 90 minuten voorbij is. Na D 07:45 komt er geen buitenzet-taak meer, na het einde van D geen binnenzet-taak (BR-50) |
| Adres ongeldig, buiten Den Haag, zonder bakken, of dubbelzinnig | Niets bewaard, met uitleg; bij een dubbelzinnig adres kiest de beheerder zelf uit de lijst (BR-48) |
| Eerstvolgende ophaaldag verder dan 14 dagen weg (bijvoorbeeld papier eens per 4 weken) | Geen storing; bij het instellen gewoon bewaard, met T-90b en 0 taken; taken verschijnen 14 dagen vooraf (BR-48, BR-50, BR-52) |
| Instellen na de laatste ophaaldag van het jaar (eind november of december) of begin januari, nieuwe kalender nog niet online | Niets bewaard, "over een paar dagen opnieuw" (T-64, BR-48); in januari ook bij een adres zonder bakken. De jaareinde-uitzondering van het bijwerken geldt hier niet |
| Bron onbereikbaar bij instellen | Niets bewaard (T-63/T-63b, BR-48) |
| Hetzelfde adres opnieuw bevestigd | Niets verandert; notities en "bezig" blijven (T-92, BR-48) |
| Bron onbereikbaar tijdens het bijwerken | Geen taak verwijderd, verschoven of hernoemd, en niets verzonnen. Taken voor al bekende ophaaldagen binnen 14 dagen verschijnen gewoon, en vergeten taken vervallen zoals altijd (BR-50, BR-54). Stille regel voor de beheerders; na 48 uur een balk en één melding (BR-52) |
| Geen enkele komende ophaaldag voor rest, papier en PMD samen (buiten het jaareinde) | Geen taak verwijderd, verschoven of hernoemd; taken voor al bekende ophaaldagen binnen 14 dagen verschijnen gewoon (BR-50). Blijft het zo bij een poging minstens een uur later: storing met balk H2 en één melding (BR-52) |
| November of december: laatste ophaaldag van het jaar geweest, kalender van volgend jaar nog niet online (of alleen met kerstboom- of GFT-datums) | Geen storing, alleen de stille regel T-73 voor de beheerders (BR-52). Is de kalender van het nieuwe jaar op 1 januari voor rest, papier en PMD nog steeds helemaal leeg: leeg antwoord, na een uur H2 met T-77a |
| December, de komende 14 dagen lopen over de jaargrens en het nieuwe jaar is nog niet online | Stille regel T-73; taken tot 31 december staan gewoon klaar (BR-52) |
| Papier wordt van eind november tot half januari niet opgehaald | Geen storing. Er zijn gewoon geen papiertaken (BR-52) |
| Gemeente kent het adres niet meer (ook als de bron voor de adrescode niets meer teruggeeft) | Stille regel T-71b; na 48 uur balk H3 met "Adres controleren" en melding M-05 (BR-52) |
| Buitenzetten vergeten | Na D 07:45 verlopen, aan het einde van D vanzelf overgeslagen (telt als vergeten). Binnenzetten blijft staan (BR-54) |
| Binnenzetten vergeten | Na het einde van D verlopen; vanzelf overgeslagen (telt als vergeten) bij het begin van de dag van de volgende buitenzet-taak, en uiterlijk op D+7 om 00:00 (BR-54) |
| Bak deze keer niet buitengezet | "Deze keer overslaan" bij buitenzetten slaat binnenzetten ook over (BR-53) |
| Zomer- of wintertijd bij afvaltaken | Dezelfde kloktijden (BR-59) |
| Twee beheerders slaan tegelijk een adres op | Het laatst bevestigde adres geldt. Er zijn nooit taken voor twee adressen tegelijk (BR-50) |
| Handmatige afvalreeks bestaat ook | Blijft ongemoeid, dus dubbel tot Jurgen hem stopt (BR-57) |

**P7. §7 Rollen en rechten: deze rijen onderaan de tabel erbij:**

| Actie | Beheerder | Gezinslid |
| --- | --- | --- |
| Afvalkalender aanzetten, adres invoeren of wijzigen, uitzetten | Ja | Nee |
| Adres zien | Ja | Nee: alleen of de afvalkalender aan of uit staat (V-53) |
| Stand van het bijwerken zien (laatste keer gelukt, stille regels, storingsbalk), "Opnieuw proberen" | Ja | Nee |
| Storingsmelding afvalkalender ontvangen | Ja | Nee |
| Afvaltaak afvinken, terugdraaien, bezig, notitie, deze keer overslaan | Ja | Ja |
| Afvaltaak hernoemen, wijzigen, verplaatsen (ook slepen), verwijderen, omzetten naar een reeks | Nee | Nee (BR-53) |
| Zelf een afvaltaak aanmaken | Nee, alleen het systeem | Nee, alleen het systeem |

**P8. §7 "Mag nooit": onderaan twee bullets erbij:**
> - een gezinslid ziet het adres van het huishouden;
> - iemand wijzigt, verplaatst of verwijdert een afvaltaak.

**P9. §7 "Isolatie": vervang de tweede bullet ("Binnen het huishouden ziet ieder lid alles, **behalve** de meldingen, meldingsvoorkeuren en pushapparaten van een ander.") door:**
> - Binnen het huishouden ziet ieder lid alles, **behalve** de meldingen, meldingsvoorkeuren en pushapparaten van een ander, en het adres en de stand van de afvalkalender (alleen voor beheerders, V-53).

**P10. §8 Gegevens: deze rijen onderaan de tabel erbij:**

| Gegeven | Waarom nodig | Bron | Persoonsgegeven | Bewaren tot |
| --- | --- | --- | --- | --- |
| Adres afvalkalender (postcode, huisnummer, letter of toevoeging) | Ophaaldagen opvragen | Beheerder | Ja: het woonadres van een gezin met minderjarigen | Tot uitzetten of het verwijderen van het huishouden (BR-56, BR-58) |
| Adrescode van de gemeente (BAG-id) | Ophaaldagen opvragen zonder steeds het adres te sturen | Gemeente Den Haag | Ja, want hij wijst één adres aan. Zelfde behandeling als het adres | Als het adres |
| Bekende ophaaldagen (datum, bak) | Taken maken, wijzigingen herkennen, doorwerken bij een storing | Gemeente Den Haag | Nee (alleen via het adres herleidbaar) | Alleen komende dagen. Voorbije dagen worden opgeruimd; ze leven voort als taak of historie |
| Stand van het bijwerken (laatste poging, laatste succes, foutcode van de laatste mislukte poging, sinds wanneer die fout, sinds wanneer er een storing is) | Stille regels, storing en melding bepalen (BR-52) | Systeem | Nee | Tot uitzetten |
| Afvaltaken en hun afvinkingen | Zoals bij andere taken | Systeem | Nee | Zoals bij andere taken (BR-45) |

**P11. §8 "Bewust niet opgeslagen": onderaan erbij:**
> - straat en plaats van het adres afvalkalender;
> - coördinaten;
> - de ruwe antwoorden van de gemeentebron;
> - wie het adres invoerde.

**P12. §8 "Externe partijen": na de bullet "Vercel: hosting." erbij:**
> - **Gemeente Den Haag, via haar leverancier van de huisvuilkalender (Opzet):**
>   - krijgt vanaf de server van de app het adres (postcode en huisnummer, alleen bij het opzoeken) of de adrescode (bij het ophalen). Dat gebeurt twee keer per dag, en na een mislukking ongeveer elk uur;
>   - krijgt geen namen, e-mailadressen of andere gegevens van het huishouden;
>   - de app gebruikt de openbare gegevens van de site. Er is geen officiële koppeling of overeenkomst.

**P13. §9 Afhankelijkheden: deze rijen onderaan de tabel erbij:**

| Afhankelijkheid | Waarvoor | Risico |
| --- | --- | --- |
| Huisvuilkalender Den Haag (platform Opzet) | Ophaaldagen per adres | Onofficiële, ongedocumenteerde bron: kan zonder aankondiging veranderen of uitvallen. Opvang via BR-52. Vanuit de ontwikkelomgeving niet bereikbaar (V-57) |
| Proef van de bron, stap P0 en U0.2 (TD §18.1.6) | **Uitgevoerd op 2026-09-29** met het openbare testadres (`docs/wijzigingen/W-03/probe/P0-uitkomst.md`). `robots.txt` sluit opvragen niet uit, de opvraagroutes zijn bevestigd, en er is geen blokkade vanuit het datacenter (Supabase). Een onbekend adres geeft een lege lijst, een nog niet gepubliceerd jaar ook, en een onbekende adrescode een leeg antwoord (U0.2). **Niet bevestigd:** de gemeenteregel 22:00/07:45, omdat de gemeentesite servers weigert. Die bekijkt Jurgen één keer zelf **vóór de livegang (U0.1)**. De bereikbaarheid vanaf de echte server (Vercel) wordt gecontroleerd bij de rooktest (U5) | Zie de beslisregel hieronder |
| Planner elke 15 minuten (WP3) | Twee keer per dag bijwerken, planning, en herinneringen om 21:00 en 18:00 | Zonder WP3 geen tijdige herinnering. Daarom komt dit werkpakket na WP3 (V-46) |

**P14. §9, onder de tabel erbij:**
> **Beslisregel voor U0.1 en U5 (P0 is afgerond):**
> - **Een uitvoeringskeuze**, vastgelegd in DECISIONS: andere veldnamen, iconnamen, adrescodeformaat, jaargedrag en vergelijkbare technische details (TD §18.1.7, linkerkolom).
> - **Stoppen en naar Jurgen:**
>   - de site blokkeert verzoeken vanaf de server van de app (U5);
>   - de gemeentetijden wijken af van 22:00 en 07:45, of verschillen per bak of wijk (U0.1).
>
>   Gebeurt dit vóór de freeze, dan is het een vraag aan Jurgen; erna een wijzigingsverzoek. De tijden in BR-49 en de teksten T-16, T-17, T-21, T-22 en M-01 hangen van die gemeenteregel af.

**P15. §10 Bewust niet: vervang de bullet "Agenda-, smart home- en WhatsApp/e-mailkoppelingen: …" door:**
> - **Agenda-, smart home- en WhatsApp/e-mailkoppelingen:** "na de MVP". Elke koppeling brengt geheimen, externe verplichtingen en extra review mee. **Uitzondering:** de afvalkalender van de gemeente Den Haag (W-03, besluit van Jurgen, §14).

**P16. §10: onderaan erbij:**
> - **GFT, grofvuil, kerstbomen en de berichten van de gemeente over storingen:** Jurgen noemde alleen rest, papier en PMD (V-43).
> - **Andere gemeenten of meerdere adressen:** alleen het eigen gezin in Den Haag (V-05, V-08).
> - **Een schakelaar per bak, of eigen tijden per bak:** drie vaste bakken en vaste tijden houden het eenvoudig. Niemand heeft erom gevraagd.
> - **Afvaltaken zelf wijzigen of verplaatsen:** de gemeente bepaalt de dag, en een verplaatste taak is niet meer bij te houden (V-54).
> - **Koppeling met Google-agenda, of export als iCal:** vraagt een extra inlogkoppeling (W-03, optie verworpen).
> - **Handmatige afvaltaken automatisch herkennen en opruimen:** de app zou op titels moeten gokken, en dan kan er een verkeerde taak verdwijnen (BR-57, V-56).
> - **Een melding "bak niet opgehaald" of "weer gelukt":** de app weet niet of de gemeente de bak echt geleegd heeft. Een herstel is zichtbaar doordat de balk verdwijnt.
> - **Controleren of de bak op de toegestane tijd buiten staat:** de app kan dat niet weten. Hij noemt alleen de regel (BR-49).

**P17. §11 Succescriteria: onderaan erbij:**
> **Afvalkalender (W-03).** Drie maanden na de livegang van WP3b, gecontroleerd door de bouwer op dag 30 en dag 90, met alleen-lezen queries. Het resultaat komt in `docs/PROGRESS.md`.
> 1. **Compleet:** elke ophaaldag van rest, papier en PMD in de gemeente-agenda binnen de komende 14 dagen heeft precies één buitenzet-taak en één binnenzet-taak, met de juiste bakken in de naam (UX §13.3). Dit wordt gecontroleerd door het te vergelijken met de site van de gemeente.
> 2. **Op tijd buiten:** minstens 90% van de buitenzet-taken in die periode is vóór 07:45 op de ophaaldag afgevinkt. Dat is af te lezen aan "te laat" in de historie.
> 3. **Betrouwbaar:**
>    - geen dubbele afvaltaken;
>    - geen ophaaldag die stil ontbrak;
>    - geen notitie die verdween bij een verschuiving van hooguit 3 dagen;
>    - elke storing (BR-52) was voor de beheerders zichtbaar.
> 4. **Ervaren:** Jurgen geeft aan dat er in die drie maanden geen bak is blijven staan doordat iemand hem vergat. Dat is een gesprek, geen meting.

**P18. §12: vervang de kop "## 12. Verwerkte antwoorden (V-04, V-05 t/m V-27)" door "## 12. Verwerkte antwoorden (V-04, V-05 t/m V-27, V-41 t/m V-57)", en zet deze rijen onderaan de tabel:**

| Vraag | Antwoord (zie `docs/PROGRESS.md`) | Verwerkt in |
| --- | --- | --- |
| V-41 t/m V-44 | Keuze B, bron Den Haag, rest/papier/PMD, herinnering om 21:00 | §14, BR-47, BR-49 |
| V-45 | Het adres mag worden bewaard | BR-48, BR-58, §8 |
| V-46 | Eigen werkpakket na WP3, in de huidige schermen | §9, §14 |
| V-47 | Ook binnenzetten, vanaf de middag | BR-49 |
| V-48 | Binnenzetten vanaf 12:00, uiterlijk het einde van de dag, herinnering 18:00 | BR-49, BR-55 |
| V-49 | Herinnering om 21:00, met de tekst "mag vanaf 22:00 buiten, uiterlijk 07:45" | BR-49, BR-55 |
| V-50 | Volgt "Herinneringen"; geen "deadline nadert" of "verlopen"; storing > 48 uur: één melding aan de beheerders | BR-52, BR-55 |
| V-51 | Eén gecombineerde taak per dag | BR-49 |
| V-52 | 14 dagen vooruit | BR-48, BR-50, BR-52 |
| V-53 | Adres alleen voor beheerders | BR-48, BR-52, BR-58, §7 |
| V-54 | Niet hernoemen, verplaatsen of verwijderen; wel afvinken, bezig, notitie, overslaan; vergeten buitenzetten vervalt vanzelf | BR-53, BR-54 |
| V-55 | Alle drie containers | BR-47, BR-49 |
| V-56 | Jurgen stopt de handmatige reeks zelf | BR-57 |
| V-57 | Uitleg over de netwerkinstelling (technisch) | §9 |

**P19. §13 Aannames en open vragen: geen wijziging.** Er komt geen W-03-aanname bij.

=== ACCEPTANCE_CRITERIA.md ===

**A1. "Bronnen": in de tabel vervang de rij `docs/PROGRESS.md` door de eerste rij hieronder, en zet de twee andere rijen eronder:**

| Document | Wat eruit komt |
| --- | --- |
| `docs/PROGRESS.md` | Besluiten van Jurgen V-05 t/m V-39, en V-41 t/m V-57 (W-03) |
| `docs/UX_SPEC.md` §13.16 | Enige bron voor de letterlijke teksten van W-03 (T-xx, M-xx) |
| `docs/wijzigingen/W-03/probe/` | Echte antwoorden van de gemeentebron (P0 en U0.2), basis voor de nagebootste bron |

**A2. "Afspraken": onderaan, vóór de `---`, een punt erbij:**
> - **W-03 — afvalkalender.**
>   - De criteria voor WP3b zijn AC-183 t/m AC-223, AC-236 en AC-237. Ze staan in de sectie WP3b, direct na WP3. AC-236 en AC-237 zijn later toegevoegd en staan ná AC-223, zodat de bestaande nummers kloppen.
>   - De W-03-criteria voor de nieuwe schermen zijn AC-224 t/m AC-235. Ze staan aan het eind van de secties WP4 t/m WP9.
>   - Ze volgen PRODUCT_SPEC §14 (BR-47 t/m BR-59), UX_SPEC §13 en de antwoorden V-41 t/m V-57.
>   - "D" is de ophaaldag. Alle tijden zijn Europe/Amsterdam.
>   - **Teksten:** noemt een criterium een tekst-ID (T-xx of M-xx), dan toetst de test letterlijk de tekst uit UX §13.16. De tekst tussen aanhalingstekens is daar een kopie van. Bij een verschil geldt UX §13.16.
>   - **"Leeg" en "komende ophaaldag"** gaan altijd alleen over rest, papier en PMD. Datums van GFT en kerstbomen tellen nergens mee.
>   - **De gemeentebron** wordt in Unit, Int en E2E altijd nagebootst:
>     - met de echte P0-antwoorden van het openbare testadres (`probe/fixtures-2591BB-87.json`);
>     - voor rest en PMD met synthetische antwoorden in dezelfde vorm;
>     - voor een onbekende adrescode met het leeg object `{}` uit U0.2.
>     Alleen de Live-toets gebruikt de echte bron.
>   - "Huidige schermen" = de oude UI op `main` (WP3b). "Nieuwe schermen" = `v2-ui` (WP4 t/m WP9).

**A3. Nieuwe sectie direct na de sectie "## WP3 — Planner, tick, meldingen en bewaartermijnen" (na AC-078 en de `---`), gevolgd door `---`:**

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

**A4. Aan het eind van de sectie "## WP4 — …", na het laatste criterium, erbij:**

### AC-224 — Afvalgegevens in de nieuwe gegevenslaag (WP4; TD §11.2, §18.14)
GEGEVEN afvaltaken in het venster van de taken, en een gezinslid en een beheerder
WANNEER de app laadt, online en offline uit de cache
DAN:
- heeft elke afvaltaak zijn ophaaldag, richting en bakken;
- weet de app of de afvalkalender aan staat;
- zijn bij afvaltaken voor niemand de knoppen voor bewerken, verplaatsen en verwijderen beschikbaar.

Een oudere cache zonder deze gegevens toont de taak als gewone taak tot de verversing, zonder fout.
**Toets:** Unit + Int

**A5. Aan het eind van de sectie "## WP5 — …" erbij:**

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

**A6. Aan het eind van de sectie "## WP6 — …" erbij:**

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

**A7. Aan het eind van de sectie "## WP7 — …" erbij:**

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

**A8. Aan het eind van de sectie "## WP8 — …" erbij:**

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

**A9. Aan het eind van de sectie "## WP9 — …" erbij:**

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

**A10. "Dekking" › "Harde regels": deze rijen onderaan de tabel erbij:**

| Regel | AC's |
| --- | --- |
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

**A11. "Dekking" › "Harde regels": vul deze bestaande rijen aan:**
- BR-10: + AC-191
- BR-12: + AC-207, AC-212
- BR-13: + AC-207
- BR-20: + AC-219
- BR-25: + AC-223
- BR-26: + AC-190
- BR-31: + AC-194, AC-203, AC-211
- BR-40: + AC-206

**A12. "Dekking" › "Een geweigerde actie per rol": vervang de vier regels door:**
> - Gezinslid: AC-001, AC-012, AC-020, AC-048, AC-189 (afvalkalender beheren), AC-190 (adres lezen), AC-208 (afvaltaak wijzigen of verwijderen), AC-219 (zelf een afvaltaak maken).
> - Uitgezet lid: AC-022, AC-189.
> - Beheerder: AC-014 (de maker wijzigen), AC-019 (de laatste beheerder degraderen), AC-021 (zichzelf uitzetten), AC-208 (een afvaltaak wijzigen, verplaatsen of verwijderen) en AC-219.
> - Buitenstaander: AC-026, AC-027, AC-190.

**A13. "Dekking": na het blok "Aanvullingen na de plan-critic, ronde 1" erbij:**

> **Verwerkte besluiten van Jurgen (W-03):**
>
> | Besluit | AC's |
> | --- | --- |
> | V-41 t/m V-44 | AC-183, AC-192, AC-194, AC-196 |
> | V-45 | AC-183, AC-213, AC-216 |
> | V-46 | AC-217, AC-224 t/m AC-235 |
> | V-47 en V-48 | AC-193, AC-194 |
> | V-49 | AC-192, AC-194 |
> | V-50 | AC-204, AC-205, AC-211, AC-236 |
> | V-51 | AC-195, AC-201 |
> | V-52 | AC-197, AC-204, AC-237 |
> | V-53 | AC-189, AC-190, AC-205 |
> | V-54 | AC-208, AC-209, AC-210 |
> | V-55 | AC-193 |
> | V-56 | AC-215 |
>
> **Aanvullingen na de plan-critic W-03, ronde 3:**
>
> | Punt van de plan-critic | AC's |
> | --- | --- |
> | 1 (bovengrens binnenzetten D+7) | AC-210, AC-234 |
> | 2 (jaareinde geen storing) | AC-204, AC-205, AC-220, AC-237 |
> | 3 (verwijzing T-90b-variant) | AC-183 (b), AC-237 |
> | Aanbeveling 8 (kerstbomen tellen niet mee) | AC-196, AC-204, AC-220, AC-237 |
> | Aanbeveling 9 (onbekende adrescode) | AC-204 (c), AC-205 |

**A14. "Dekking" › "Open bij Jurgen": onder "V-39: AC-182." erbij:**
> - V-41 t/m V-57 (W-03): zie "Verwerkte besluiten van Jurgen (W-03)".

=== Interpretaties voor het totaalvoorstel (niet invoegen; voor de hoofdsessie, in gewone taal) ===
1. **Overslaan werkt door.** Kies je bij buitenzetten "deze keer overslaan", dan wordt binnenzetten van die dag ook overgeslagen. Ongedaan maken zet beide terug. "Toch nog doen" kan alleen tot het einde van de ophaaldag.
2. **Vergeten taken vervallen vanzelf.** Een vergeten buitenzet-taak telt als "vergeten". Binnenzetten blijft bij Verlopen staan tot de dag van de volgende buitenzet-taak, en hooguit een week (zie nr. 18). Jurgen noemde alleen het vervallen van buitenzetten.
3. **Sneller een storingsmelding bij "geen ophaaldagen meer".** Geeft de gemeente twee keer achter elkaar, minstens een uur uit elkaar, voor álle bakken samen geen enkele komende ophaaldag meer, dan komt er al na ruim een uur een melding, en niet pas na 48 uur. Een volgende papierdag die toevallig over drie weken ligt, is géén storing. Eind november en in december, na de laatste ophaaldag van het jaar, geldt een uitzondering (zie nr. 20). "Onbereikbaar" geeft pas na 48 uur een melding.
4. **Zo wordt "mag vanaf 22:00 buiten, uiterlijk 07:45" (V-49) getoond.** De lijst toont "vanaf 22:00", en na middernacht "vóór 07:45". Het detail toont "Mag buiten · ma 5 okt vanaf 22:00" en "Uiterlijk · di 6 okt 07:45". De herinnering van 21:00 noemt beide tijden. Er is geen losse omschrijving.
5. **Namen met "bak" bij binnenzetten**, bijvoorbeeld "Restafvalbak binnenzetten".
6. **Adrescode.** Naast postcode en huisnummer bewaart de app ook de adrescode van de gemeente (BAG-id). Die is alleen zichtbaar voor beheerders en verdwijnt bij uitzetten. V-45 noemde alleen postcode en huisnummer, dus **de vraag aan Jurgen loopt nog** (plan-critic ronde 3, punt 6). Zegt Jurgen nee, zie de controlelijst.
7. **Wat beheerders zien.** Beheerders zien ook de stand van het bijwerken en de storingsbalk. Gezinsleden zien alleen aan of uit, met de naam van wie hem kan aanzetten.
8. **Storingsmelding los van meldingsvoorkeuren.** Die gaat altijd naar alle beheerders, zonder eigen schakelaar.
9. **Twee keer per dag opvragen** (06:00 en 17:00), en na een mislukking ongeveer elk uur.
10. **Verschuiving door de gemeente.** Bij een verschuiving van hooguit 3 dagen met dezelfde bak blijven notities en "bezig" staan. Bij een grotere wijziging vervallen de oude taken met hun notities.
11. **Instellen rond de jaarwisseling.** Zolang de gemeente geen enkele komende ophaaldag geeft, wordt er niets bewaard. Dat is zo na de laatste ophaaldag van het jaar (eind november of december), of begin januari als de nieuwe kalender nog niet online staat. In januari ziet ook een adres zonder bakken dan "probeer het over een paar dagen opnieuw". Ligt de eerstvolgende dag alleen ver weg, dan wordt het adres gewoon bewaard, en verschijnen de taken 14 dagen vooraf.
12. **De herinneringsregel in het detail** staat er alleen voor wie herinneringen aan heeft.
13. **Geen melding "weer gelukt".** De balk verdwijnt gewoon.
14. **De lijst "wel" van V-54 is compleet.** Omschrijving, herinneringen en deadline wijzigen kan ook niet, net als omzetten naar een reeks. Slepen in de Kalender staat uit.
15. **Dubbele taken tot Jurgen zijn eigen reeks stopt** (V-56). Hij krijgt één keer een tip in de app, en één herinnering van de bouwer.
16. **Onofficiële bron.** De proef is op 29 september 2026 gedaan met een openbaar testadres: de bron werkt, mag geautomatiseerd worden opgevraagd, en blokkeert servers niet. De gemeenteregel 22:00/07:45 kon niet worden bevestigd; Jurgen kijkt daar vóór de livegang één keer zelf naar (U0.1). Wijkt die regel af, of blokkeert de site de echte server, dan stopt het werk en komt het terug bij Jurgen.
17. **Noodterugrol (TD §18.16).** Moet WP3b met spoed worden teruggedraaid, dan worden de open afvaltaken gewist, met hun notities. Het adres en de historie blijven.
18. **Vergeten binnenzetten vervalt na hooguit een week.** Een niet-afgevinkte binnenzet-taak blijft bij Verlopen staan tot de dag van de volgende buitenzet-taak, maar nooit langer dan tot het begin van de zevende dag na de ophaaldag. Daarna vervalt hij vanzelf, en telt hij als vergeten.
19. **De storingsbalk blijft tot het herstel.** Is een storing gemeld, dan blijft de balk staan tot het bijwerken weer lukt, ook als de oorzaak intussen verandert. De tekst volgt dan de nieuwe oorzaak.
20. **Jaareinde.** Eind november en in december, na de laatste ophaaldag van het jaar, geeft de app geen storing zolang de gemeente het nieuwe jaar nog niet online heeft. Een kalender met alleen kerstbomen telt daarbij als "nog niet online". Beheerders zien dan alleen een stille regel. Is de nieuwe kalender op 1 januari nog steeds leeg, dan komt er na een uur wel een melding. Een nieuw adres instellen lukt in die periode pas als de nieuwe kalender online staat.

21. **Tijdens een storing blijven de taken voor al bekende ophaaldagen gewoon verschijnen.** De app haalt dan geen taken weg en verschuift niets, en vergeten taken vervallen zoals altijd. Alleen wijzigingen van de gemeente komen er pas bij als het bijwerken weer lukt.

### Controlelijst
- **Moet-punt 1 (D+7):** staat in BR-54, BR-59 (D+7 00:00), AC-210 (geval 6 okt → 13 okt), AC-234, de §6-rij "Binnenzetten vergeten" en interpretaties 2 en 18. Nergens staat nog D+2. Dat UX §13.4, §13.7.4, §13.15 en §13.17 nog D+2 noemen, moet de designer aanpassen.
- **Moet-punt 2 (jaareinde):**
  - de §6-rij "Jaarwisseling zonder nieuwe kalender" is vervangen door twee rijen: november/december (T-73, geen storing) en december met het takenvenster over de jaargrens;
  - de rij "Leeg antwoord" zegt nu "(buiten het jaareinde)";
  - UC-15 zegt "november of december";
  - interpretatie 3 verwijst naar 20.
- **Moet-punt 3 (verwijzingen):**
  - AC-183 heeft (a) en (b), met T-90b, 0 taken en de P0-datum 27 oktober. AC-237 verwijst naar "AC-183 (b)", en AC-237 heeft geen (c) meer;
  - nagelopen verwijzingen die kloppen: AC-204 (b) en (c), AC-205 (b) naar AC-204 (b), AC-220 naar AC-204 (b) en AC-205, AC-236 naar BR-52 storing (b), AC-186 naar AC-237, AC-209 naar AC-210, AC-226 naar AC-211, AC-230 en AC-231;
  - de delen 1b, 2a en 2d zijn volledig meegenomen, met r4 punten 13–17.
- **Plan-critic ronde 4, punt 1 (planning tijdens een storing):** verwerkt in BR-50, BR-52 (onbereikbaar, leeg antwoord, "Opnieuw proberen", "Lukt het weer"), §6 (twee rijen), AC-204 (DAN, voorbeeld 20 oktober, toets), AC-205 en interpretatie 21. Voor de architect: TD §18.15 rij 204 (Int) wordt "geen taak verwijderd, verschoven of hernoemd", plus het geval "bewaarde datum schuift het venster in → taak klaargezet".
- **Aanbeveling 8:** "leeg" en "komende ophaaldag" gaan overal alleen over rest, papier en PMD. Dat staat in BR-47, BR-48, BR-52 (jaareinde, T-73, helemaal leeg), de Afspraken, AC-196, AC-204, AC-220 (c) en AC-237.
- **U0.2 (`{}`):** verwerkt in BR-52, §6, §9, de Afspraken, AC-204 (c) (met toets), de AC-205-tabel en de Dekking.
- **Andere teksten:**
  - T-45a "Den Haag" staat in UC-13 en AC-183;
  - T-90 en T-90b staan in UC-13, BR-48, AC-183 en AC-230;
  - T-64, T-77/a/b en M-04 worden alleen met hun ID genoemd, omdat UX r4 ze heeft gewijzigd;
  - alle andere letterlijke citaten heb ik vergeleken met UX r3 §13.16, en ze kloppen.
- **Adrescode (vraag loopt):**
  - Zegt Jurgen **ja**: zet in §14 onder "Besluiten van Jurgen" en in §12 een rij "V-58 (of het nummer van de hoofdsessie) | De adrescode van de gemeente mag naast postcode en huisnummer worden bewaard | BR-58, §8", en in de AC-Dekking "V-58 | AC-190, AC-212, AC-213, AC-216, AC-218".
  - Zegt Jurgen **nee**, dan moeten dit meer dan kleine wijzigingen worden:
    - BR-56 en BR-58, de §8-rij "Adrescode" en §8 "Externe partijen";
    - AC-190, AC-212, AC-213, AC-216 en AC-218;
    - BR-52/AC-204 (c): dan eerst het adres opnieuw opzoeken.
    Dan volgt een nieuwe korte ronde.
- **Bewust weggelaten uit de invoegtekst:** statussen, vragen, wijzigingslijsten, de UX-teksttabel uit r3, "Aansluiting op TD" (`isWindowEmpty`/`hasNoUpcoming` hoort in TD) en de interpretaties (die staan apart hierboven).
- **Niet mijn deel, wel nog open voor de freeze:** UX D+2 → D+7 (designer), de U3-lijst (architect, punt 4), PROGRESS (punt 5), het antwoord over de adrescode (punt 6), en het U5-gedrag van de live functie (aanbeveling 10, architect).

### Vragen voor Jurgen
Geen nieuwe. De vraag over de adrescode (plan-critic punt 6) stelt de hoofdsessie al.

### Aannames
Geen.

### Status
**KLAAR VOOR PLANREVIEW (ronde 4)** voor PRODUCT_SPEC en ACCEPTANCE_CRITERIA. De enige voorwaarde is het antwoord van Jurgen over de adrescode.

Bronbestanden:
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-analyst-r3.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-analyst-r4.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-analyst-r4b.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-analyst-r4c.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-designer-r4.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/probe/P0-uitkomst.md
- /home/user/takenlijstje/docs/reviews/plan-critic.md
- /home/user/takenlijstje/docs/PRODUCT_SPEC.md
- /home/user/takenlijstje/docs/ACCEPTANCE_CRITERIA.md