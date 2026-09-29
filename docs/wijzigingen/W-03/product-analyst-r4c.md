## Product-analyse: W-03 afvalkalender, ronde 4c (verwerking van TD r6)
Documenten bijgewerkt: geen. BR-52, AC-204, AC-220 en AC-237 staan hieronder volledig uitgeschreven. Ze vervangen de gelijknamige teksten in `product-analyst-r4.md` en `product-analyst-r4b.md`.

**Wat verandert:** TD r6 §18.8.4 (stap 2 en 3) corrigeert r4.
- **Jaareinde, bij het bijwerken:** ná de laatste ophaaldag van het jaar is er in november en december géén storing, zolang de kalender van volgend jaar nog niet online staat. De beheerder ziet dan alleen de stille regel T-73.
- **Wel een storing:** alleen als de kalender van het lopende jaar helemaal leeg is, bijvoorbeeld op 1 januari.
- **Bij het instellen** geldt de uitzondering niet. Daar blijft het F2/T-64 (TD r6 §18.8.1).

### BR-52 — Nooit gokken, nooit stil falen (vervangt r4)
- **De bron is onbereikbaar, geeft een onbruikbaar antwoord, of kent het adres niet meer:**
  - de afvaltaken, het adres en de bekende ophaaldagen blijven ongewijzigd;
  - de app maakt **nooit** zelf ophaaldagen aan op basis van een vermoed patroon;
  - de andere taken van de achtergrondtaak lopen gewoon door;
  - later volgt een nieuwe poging.
- **Een leeg antwoord:** de bron geeft voor rest, papier en PMD **samen geen enkele komende ophaaldag** (vandaag of later), en het jaareinde hieronder geldt niet. Dat is een verdacht leeg antwoord, en niet "alle ophaaldagen vervallen". De afvaltaken, het adres en de bekende ophaaldagen blijven ongewijzigd, en er volgt later een nieuwe poging.
  - Is de kalender van het lopende jaar voor rest, papier en PMD **helemaal leeg**, dan is dat altijd een leeg antwoord, in elke maand. Voorbeeld: op 1 januari, als de gemeente voor het nieuwe jaar nog niets geeft.
  - Er geldt geen voorwaarde over wat er eerder bekend was. Een adres wordt alleen bewaard als er minstens één komende ophaaldag is (BR-48). "Geen enkele komende ophaaldag" is daarna dus altijd een verandering.
  - Datums van andere soorten (GFT, kerstbomen) tellen niet mee.
- **Geen leeg antwoord:**
  - **Alleen ophaaldagen verder dan 14 dagen weg.** Voorbeeld: papier eens per 4 weken, met de eerstvolgende dag over ruim drie weken. Er komen dan nog geen taken (BR-50), maar er is geen storing en geen stille regel.
  - **Een enkele bak zonder ophaaldagen.** Voorbeeld: papier wordt van eind november tot half januari niet opgehaald.
  - **Het jaareinde:**
    - **Situatie:** het is november of december, de laatste ophaaldag van dit jaar is geweest, en de kalender van volgend jaar staat nog niet online.
    - **Gevolg:** dat is **geen storing**. Het bijwerken geldt als gelukt, en de beheerder ziet alleen de stille regel T-73. Er komt geen melding.
    - **Voorbeeld:** een adres met papier tot 24 november, op 26 november.
    - — waarom: in november en december kan "geen komende datum dit jaar" normaal zijn, en de gemeente publiceert het nieuwe jaar meestal pas in december.
    - **Bewuste grens:** stopt een adres in november of december echt met ophalen, dan ziet de beheerder tot 1 januari alleen T-73. In die periode gaan geen taken verloren.
    - **Alleen bij het bijwerken:** deze uitzondering geldt niet bij het instellen (BR-48: dan F2/T-64).
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
  - elke actieve beheerder krijgt **één** melding: M-03, M-04 of M-05, afhankelijk van de oorzaak bij het versturen (zonder vastgelegde mislukte poging: M-03).
    - De melding linkt naar de instellingen van de afvalkalender (BR-25).
    - Hij wordt pas opnieuw verstuurd na een nieuwe storing, dus nadat het bijwerken eerst weer gelukt is.
    - Verandert de oorzaak tijdens de storing, dan komt er geen tweede melding;
  - gezinsleden krijgen geen melding en zien geen waarschuwing of stille regel (V-53).
- **"Opnieuw proberen"** (alleen beheerders, in balk H):
  - tijdens de poging staat er "Bezig…" (T-77e);
  - is het gelukt, dan verdwijnt de balk en verschijnt melding T-94;
  - lukt het nog steeds niet, dan komt regel T-78 in de balk;
  - heeft iemand anders of de achtergrondtaak het binnen de minuut al geprobeerd, dan komt regel T-79 in de balk. Er komt dan geen melding onderin en geen extra opvraging bij de gemeente.
- **Lukt het weer,** dan verdwijnen de balk en de stille regel vanzelf, en wordt de planning aangevuld. Er komt geen melding "weer gelukt".
- **Stille regel T-73.** De beheerder ziet T-73 als de laatste bijwerking gelukt is, de app nog geen enkele ophaaldag van het nieuwe jaar kent, en een van deze twee geldt:
  - het is december, en de komende 14 dagen lopen al over de jaargrens; of
  - het is november of december, en er is geen enkele komende ophaaldag meer (het jaareinde hierboven).
  
  Er komt geen melding, en een gezinslid ziet niets.
- — waarom: stil wegvallende taken zijn erger dan geen functie, omdat het gezin erop vertrouwt. Een onterechte storingsmelding elke maand, of elk jaareinde, zou de echte melding waardeloos maken.

### AC-204 — Bron tijdelijk onbereikbaar, onbruikbaar of leeg (WP3b; BR-52)
GEGEVEN een bewaard adres met afvaltaken, en de gemeentebron geeft een van deze antwoorden:
- (a) een fout, een time-out of een onbegrijpelijk antwoord;
- (b) voor rest, papier en PMD samen **geen enkele komende ophaaldag** (vandaag of later), buiten het jaareinde (zie "Geen storing zijn"). Dit geldt ook in deze gevallen:
  - op 1 januari, als de kalender van het nieuwe jaar nog helemaal leeg is. Een helemaal lege kalender van het lopende jaar is in elke maand een leeg antwoord;
  - in juni, als de kalender van dit jaar alleen datums in het verleden heeft;
  - als er alleen komende datums voor GFT of kerstbomen zijn;
- (c) het adres is onbekend geworden
WANNEER het bijwerken draait
DAN:
- verandert er niets aan de afvaltaken, het adres en de bekende ophaaldagen;
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
  - Op donderdag 26 november 2026 geeft de bron geen enkele komende ophaaldag in 2026, en is de kalender van 2027 nog leeg.
  - Dat is geen storing, ook niet na meerdere rondes. De beheerder ziet alleen de stille regel T-73 (AC-220).
  - Hetzelfde geldt in december, ná de laatste ophaaldag van het jaar, zolang de kalender van volgend jaar nog niet online staat.
- **Eén bak zonder dagen.** Geeft de bron alleen voor papier geen dagen, terwijl rest of PMD wel komende dagen heeft, dan is dat geen leeg antwoord. De open papiertaken voor verdwenen dagen vervallen dan volgens AC-199.
**Toets:** Unit + DB + Int (met regressietoetsen op de P0-fixture: 5 oktober en 26 november)

### AC-220 — Kalender volgend jaar ontbreekt nog (WP3b; BR-52)
GEGEVEN het bijwerken lukt, de gemeente heeft nog geen ophaaldagen voor het nieuwe jaar online, en een van deze situaties:
- (a) het is 20 december 2026, en de komende 14 dagen lopen over de jaargrens;
- (b) het is 26 november 2026, en het adres heeft geen enkele komende ophaaldag meer in 2026 (het P0-adres: papier tot 24 november)
WANNEER een beheerder de instellingen van de afvalkalender opent
DAN:
- ziet hij de stille regel T-73 "De kalender voor 2027 staat nog niet online. Ophaaldagen vanaf 1 januari komen erbij zodra hij er is.";
- ziet hij bij (b) geen balk en geen T-71, want het bijwerken is gelukt (AC-204, "Geen storing zijn");
- komt er geen melding;
- ziet een gezinslid niets.

In deze gevallen staat de regel er **niet**:
- op 10 december, als er nog een komende ophaaldag is en de komende 14 dagen niet over de jaargrens lopen;
- in november, als er nog een komende ophaaldag in dit jaar is;
- zodra er ophaaldagen van het nieuwe jaar bekend zijn.

Is de kalender van het nieuwe jaar op 1 januari nog steeds leeg, dan geldt AC-204 (b), en na een uur AC-205 (H2 met T-77a).
**Toets:** Unit + E2E

### AC-237 — Instellen zonder komende ophaaldagen (WP3b; BR-48, BR-52)
GEGEVEN een Haags adres waarvoor de gemeente voor rest, papier en PMD samen **geen enkele komende ophaaldag** (vandaag of later) geeft. Bijvoorbeeld:
- 26 november, als de laatste ophaaldag van het jaar geweest is (het P0-adres: papier tot 24 november) en de kalender van volgend jaar nog leeg is;
- 28 december, na de laatste ophaaldag van het jaar, als de kalender van het nieuwe jaar nog niet online staat;
- 2 januari, als de kalender van het nieuwe jaar nog niet online staat. Dat geldt **zowel** als de kalender van het vorige jaar voor dit adres datums had, **als** wanneer die geen datums had
WANNEER Jurgen het adres zoekt, (a) zonder bestaand adres of (b) als wijziging
DAN:
- ziet hij bij (a) de balk T-64, en bij (b) T-64b (UX §13.16). Ook op 26 november en 2 januari ziet hij F2, en **niet** T-62 "geen bakken". De jaareinde-uitzondering uit BR-52 geldt bij het instellen niet;
- is de hoofdknop "Adres zoeken", en blijven de velden gevuld;
- is er niets bewaard, en zijn er geen taken ontstaan of verdwenen;
- bij (b) blijven het oude adres en de oude taken staan. Verkeert het bewaarde adres zelf in dezelfde jaareindesituatie, dan ziet de beheerder daar alleen T-73 (AC-220).

**Tegenvoorbeeld:** ligt de eerstvolgende ophaaldag alleen ver weg (over ruim drie weken), dan is dat geen F2. Het adres wordt bewaard, met T-90b en 0 taken (AC-183 b). Bij het bijwerken volgt daarna geen stille regel en geen storing (AC-204).
**Toets:** Unit + Int + E2E

### Wijzigingslijst (ronde 4c, ten opzichte van r4/r4b)
| # | Plek | Was | Wordt | Reden |
| --- | --- | --- | --- | --- |
| 28 | BR-52, leeg antwoord | "ná de laatste ophaaldag van december, zolang het nieuwe jaar ontbreekt" telde als leeg antwoord | geschrapt als leeg; nieuw: "een helemaal lege kalender van het lopende jaar is altijd leeg" | TD r6 §18.8.4, stap 2 en 3 |
| 29 | BR-52, "Geen leeg antwoord" | twee gevallen | + het jaareinde (november/december, alleen T-73), met waarom, bewuste grens en "alleen bij bijwerken" | TD r6 §18.8.4; architectpunt 2 |
| 30 | BR-52, T-73 | alleen december met het venster over de jaargrens | + november/december zonder komende ophaaldag | TD r6 §18.8.5 |
| 31 | AC-204 (b) | met "ná de laatste decemberdatum" als leeg | jaareinde uitgezonderd; voorbeelden "1 januari helemaal leeg" en "juni alleen datums in het verleden" erbij | TD r6 §18.8.4 |
| 32 | AC-204, "Geen storing zijn" | 5 oktober en "één bak" | + het P0-adres op 26 november (kalender 2027 leeg, alleen T-73) en de variant in december; toets met twee regressiedata | TD r6 punt 2 |
| 33 | AC-220 | alleen 20 december | + (b) 26 november zonder komende ophaaldag → T-73, geen balk; "niet"-gevallen uitgebreid; verwijzing naar 1 januari (H2) | TD r6 punt 2, §18.15 rij 220 |
| 34 | AC-237 | 28 december en 2 januari | + 26 november (P0-adres) → F2/T-64; expliciet: de jaareinde-uitzondering geldt niet bij het instellen; bij (b) toont het bewaarde adres in die situatie T-73 | TD r6 §18.8.1, §18.15 rij 237 |

**Interpretatie voor het totaalvoorstel, nr. 20:** "Eind november en in december, na de laatste ophaaldag van het jaar, geeft de app geen storing zolang de gemeente het nieuwe jaar nog niet online heeft. Beheerders zien dan alleen een stille regel. Is de nieuwe kalender op 1 januari nog steeds leeg, dan komt er na een uur wel een melding. Een nieuw adres instellen lukt in die periode pas als de nieuwe kalender online staat."

### Vragen voor Jurgen
Geen.

### Aannames
Geen.

### Status
**KLAAR VOOR PLANREVIEW.** Met r4, r4b en r4c zijn alle analistpunten uit r4-D5, r5 en r6 verwerkt. Het architectpunt over eind november is gesloten.

Bronbestanden:
- /home/user/takenlijstje/docs/wijzigingen/W-03/solution-architect-r6.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-analyst-r4.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-analyst-r4b.md
