## Product-analyse: W-03 afvalkalender, ronde 4 (verwerking van P0)
Documenten bijgewerkt: geen, zoals gevraagd. Hieronder staan alleen de gewijzigde BR's en AC's, volledig uitgeschreven. Ze vervangen de gelijknamige teksten in `docs/wijzigingen/W-03/product-analyst-r3.md`. Alles wat hier niet staat, blijft zoals in r3, behalve de kleine regelvervangingen in de wijzigingslijst onderaan.
Niveau-advies: **2 blijft**, om dezelfde reden als in r3.

**Gelezen:**
- `solution-architect-r5.md`: punt 4, §18.8.1, §18.8.4, §18.15 en §18.16;
- `probe/P0-uitkomst.md`;
- mijn eigen `product-analyst-r3.md`;
- `solution-architect-r4.md` deel D, punt 5.

**Tekstregel:** voor T-64/T-64b, T-77/T-77a/T-77b, M-04 en T-90 noem ik alleen het ID. De letterlijke tekst komt uit UX §13.16 (de designer past die nu aan). Voor de variant van T-90 bij 0 taken schrijf ik "T-90, variant bij 0 taken (UX §13.16)". Kiest de designer een eigen ID, bijvoorbeeld T-90b, dan vervangt de hoofdsessie alleen dat ID.

**Ook meegenomen uit r4-D5, omdat het precies in deze teksten valt (gemarkeerd met [r4-D5]):**
- BR-52 en AC-205: de storing blijft zichtbaar tot het herstel;
- AC-205: 48 uur zonder mislukte poging geeft H1/M-03;
- AC-205: een poging zonder uitkomst na één leeg antwoord is geen storing;
- AC-205: "bijvoorbeeld door 'Opnieuw proberen'" is geschrapt;
- AC-186 en AC-237: januari geeft F2, niet "geen bakken".

**Nog niet verwerkt uit r4-D5** (niet gevraagd; zie het punt voor de hoofdsessie onderaan): AC-217 (lijstverwijzing), BR-54 en AC-210 (grens D+7), en de laatste zin van AC-236.

---

# PRODUCT_SPEC §14: gewijzigde businessregels

- **BR-48 — Het adres.**
  - Per huishouden is er hooguit **één** adres: postcode, huisnummer en een optionele huisletter of toevoeging.
  - Alleen een **beheerder** mag het invoeren, wijzigen of verwijderen (V-53).
  - **Invoer en controle:**
    - De postcode wordt genormaliseerd: hoofdletters, met of zonder spatie ("2511ab" wordt "2511 AB"). Toegestaan zijn 4 cijfers (niet beginnend met 0) en 2 letters.
    - Het huisnummer is een geheel getal van 1 t/m 99999.
    - Een letter of toevoeging moet mogelijk zijn ("12A", "12 a", "12-2"), met hooguit 4 letters of cijfers.
    - Bij een vormfout blijft de knop "Adres zoeken" uitgeschakeld zolang postcode of huisnummer leeg is. Er wordt niets bij de gemeente opgevraagd.
  - **Wanneer het adres wordt bewaard:** pas als aan alle vier deze voorwaarden is voldaan:
    - de huisvuilkalender kent het adres;
    - hij levert precies één adres op;
    - hij geeft voor rest, papier en PMD samen **minstens één komende ophaaldag** (vandaag of later);
    - de beheerder heeft "Klopt dit?" bevestigd.
    — waarom: een fout adres geeft stil verkeerde of geen taken, en dan vergeet het gezin juist de bak.
  - **De eerstvolgende ophaaldag ligt verder dan 14 dagen weg** (bijvoorbeeld bij papier eens per 4 weken): het adres wordt **gewoon bewaard**. Er ontstaan dan nog geen taken; die komen zodra de ophaaldag binnen de 14 dagen valt (BR-50). De beheerder ziet T-90, variant bij 0 taken (UX §13.16). — waarom: een ophaaldag ver weg is normaal, en geen reden om het instellen te weigeren.
  - **Geen enkele komende ophaaldag** (bijvoorbeeld eind december na de laatste ophaaldag van het jaar, of begin januari, als de kalender van het nieuwe jaar nog niet online staat): er wordt niets bewaard, en de beheerder ziet T-64 (bij wijzigen T-64b). — waarom: dan geldt bij het instellen dezelfde regel als bij het bijwerken (BR-52), en kan een net bewaard adres niet meteen als storing gelden.
    - **In januari** geeft de gemeente voor een nieuw jaar soms nog niets. Dan ziet de beheerder T-64 en niet T-62, ook als de kalender van het vorige jaar geen datums voor dit adres had. — waarom: in januari is "de nieuwe kalender staat nog niet online" veel waarschijnlijker dan "dit adres heeft geen bakken". T-64 bewaart ook niets.
  - **Meerdere adressen onder hetzelfde nummer** (letters of toevoegingen), en geen toevoeging opgegeven: de app kiest **nooit** zelf. Hij toont T-61 met één rij per adres, en de beheerder kiest.
  - **Bron onbereikbaar of onbruikbaar tijdens het instellen:** er wordt **niets** bewaard. De beheerder ziet T-63, of T-63b als er al een adres is. Dat adres en de taken ervan blijven dan ongewijzigd.
  - **Hetzelfde adres opnieuw bevestigen:** de open afvaltaken blijven staan, met hun notities en de stand "bezig". De beheerder ziet T-92, en nooit een melding dat het te snel was.
  - Een gezinslid (of een uitgezet lid, of iemand van buiten) kan het adres niet invoeren, wijzigen of verwijderen, ook niet met een direct verzoek. Een geweigerde poging geeft T-66.

- **BR-52 — Nooit gokken, nooit stil falen.**
  - **De bron is onbereikbaar, geeft een onbruikbaar antwoord, of kent het adres niet meer:**
    - de afvaltaken, het adres en de bekende ophaaldagen blijven ongewijzigd;
    - de app maakt **nooit** zelf ophaaldagen aan op basis van een vermoed patroon;
    - de andere taken van de achtergrondtaak lopen gewoon door;
    - later volgt een nieuwe poging.
  - **Een leeg antwoord:** geeft de bron voor rest, papier en PMD **samen geen enkele komende ophaaldag** (vandaag of later), dan is dat een verdacht leeg antwoord, en niet "alle ophaaldagen vervallen". De afvaltaken, het adres en de bekende ophaaldagen blijven ongewijzigd, en er volgt later een nieuwe poging.
    - Dit geldt ook bij de jaarwisseling: ná de laatste ophaaldag van december, zolang de kalender van het nieuwe jaar nog ontbreekt, en op 1 januari, zolang de gemeente voor het nieuwe jaar nog niets geeft.
    - Er geldt geen voorwaarde over wat er eerder bekend was. Een adres wordt alleen bewaard als er minstens één komende ophaaldag is (BR-48), dus "geen enkele komende ophaaldag" is daarna altijd een verandering.
    - Datums van andere soorten (GFT, kerstbomen) tellen niet mee.
  - **Geen leeg antwoord:**
    - **Alleen ophaaldagen verder dan 14 dagen weg.** Voorbeeld: papier eens per 4 weken, met de eerstvolgende dag over ruim drie weken. Dat is normaal. Er komen dan nog geen taken (BR-50), maar er is geen storing en geen stille regel.
    - **Een enkele bak zonder ophaaldagen.** Voorbeeld: papier wordt van eind november tot half januari niet opgehaald.
  - **Wanneer het een storing is.** Er is een storing als:
    - (a) het bijwerken al meer dan 48 uur niet gelukt is (V-50), om welke reden ook, ook als er in die tijd geen mislukte poging is vastgelegd (bijvoorbeeld omdat de achtergrondtaak stil lag) [r4-D5]; of
    - (b) de bron twee of meer keer achter elkaar een leeg antwoord gaf, met minstens een uur tussen het eerste en het laatste lege antwoord, en zonder een andere uitkomst ertussen.
      - Een andere fout (bijvoorbeeld "onbereikbaar") tussen twee lege antwoorden laat de telling opnieuw beginnen.
      - Vaker "Opnieuw proberen" maakt de storing niet eerder, want de regel meet tijd, geen aantal.
  - **Korter dan een storing:** de beheerder ziet alleen de stille regel T-71, of T-71b als de gemeente het adres niet vond. Er komt geen melding en geen balk.
  - **Bij een storing:**
    - de beheerders zien in Instellingen de balk H. De tekst hangt af van de oorzaak van de laatste mislukte poging, niet van de reden van het alarm (UX §13.8.2):
      - onbereikbaar of onbruikbaar (H1): T-75 en T-76. Dat geldt ook als er geen mislukte poging is vastgelegd [r4-D5];
      - leeg antwoord (H2): T-77, met T-77a in december en januari, en T-77b in de andere maanden;
      - adres niet meer gevonden (H3): T-77c en T-77d, met de knop "Adres controleren";
    - een gemelde storing blijft zichtbaar tot het bijwerken weer lukt, ook als de oorzaak intussen verandert. De tekst volgt dan de nieuwe oorzaak [r4-D5];
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
  - **December:** valt vandaag in december, lopen de komende 14 dagen al over de jaargrens, is de laatste bijwerking gelukt, en kent de app nog geen enkele ophaaldag van het nieuwe jaar? Dan ziet de beheerder de stille regel T-73. Er komt geen melding.
  - — waarom: stil wegvallende taken zijn erger dan geen functie, omdat het gezin erop vertrouwt. Een onterechte storingsmelding elke maand (bij papier eens per 4 weken) zou de echte melding waardeloos maken.

---

# ACCEPTANCE_CRITERIA, sectie WP3b: gewijzigde criteria

### AC-183 — Adres instellen door een beheerder (WP3b; BR-48, BR-49, BR-50; UC-13)
GEGEVEN Jurgen (beheerder) en een geldig Haags adres met ophaaldagen voor rest, papier en PMD in de komende 14 dagen
WANNEER hij postcode en huisnummer invult, "Adres zoeken" kiest, bij "Klopt dit?" (T-45) het adres, de eerstvolgende ophaaldag per bak en de uitleg T-46 ziet, en "Ja, aanzetten" kiest
DAN:
- is het adres bewaard;
- ziet hij de melding T-90 (UX §13.16);
- staat er voor elke ophaaldag van vandaag t/m vandaag + 14 dagen één buitenzet-taak en één binnenzet-taak (BR-49);
- zijn die zichtbaar op Vandaag en in de Kalender van de huidige schermen.

Heeft één bak geen datum, dan staat bij die bak "nog geen ophaaldag bekend" (T-45b), en kan hij toch aanzetten. Kiest hij bij "Klopt dit?" voor "Ander adres", of verlaat hij de pagina, dan is er niets bewaard en zijn er geen taken ontstaan. Voor een adres waarvan de eerstvolgende ophaaldag verder dan 14 dagen weg ligt: zie AC-237 (c).
**Toets:** Int + E2E

### AC-186 — Adres zonder rest, papier of PMD (WP3b; BR-47, BR-48)
GEGEVEN het is geen januari, en een Haags adres waarvoor de agenda alleen GFT geeft, of niets (bijvoorbeeld bij een ondergrondse container)
WANNEER Jurgen het invult
DAN:
- ziet hij T-62 "Voor dit adres geeft de gemeente geen ophaaldagen voor restafval, papier of PMD. Gebruiken jullie een ondergrondse container? Dan hoeft er niets buiten te staan.";
- wordt er niets bewaard.

**In januari** is niet te zien of het adres geen bakken heeft, of dat de kalender van het nieuwe jaar nog niet online staat. Geeft de gemeente voor het nieuwe jaar nog geen datum voor rest, papier of PMD, dan geldt AC-237 (T-64/T-64b) en niet T-62, ook als de kalender van het vorige jaar geen datums had [r4-D5].
**Toets:** Unit + Int + E2E

### AC-204 — Bron tijdelijk onbereikbaar, onbruikbaar of leeg (WP3b; BR-52)
GEGEVEN een bewaard adres met afvaltaken, en de gemeentebron geeft een van deze antwoorden:
- (a) een fout, een time-out of een onbegrijpelijk antwoord;
- (b) voor rest, papier en PMD samen **geen enkele komende ophaaldag** (vandaag of later). Dat geldt ook in deze gevallen:
  - ná de laatste ophaaldag van december, terwijl de kalender van het nieuwe jaar nog niets geeft;
  - op 1 januari, als de kalender van het nieuwe jaar nog ontbreekt;
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
  - De beheerder ziet alleen de stille regel T-71 "De laatste poging lukte niet. De app probeert het elk uur opnieuw.", en bij (c) T-71b "Bij de laatste poging vond de gemeente het adres niet. De app probeert het elk uur opnieuw.".
  - Een gezinslid ziet niets.

**Geen leeg antwoord zijn** (het bijwerken lukt gewoon, zonder stille regel, balk of melding):
- **Alleen datums ná de komende 14 dagen.** Voorbeeld (de echte P0-gegevens van het testadres): op maandag 5 oktober 2026 geeft de bron alleen papier, met de eerstvolgende ophaaldag op dinsdag 27 oktober. Na twee rondes op die dag is er geen leeg antwoord, geen stille regel en geen melding. De taken voor 27 oktober ontstaan zodra die dag binnen de 14 dagen valt (AC-197).
- **Eén bak zonder dagen.** Geeft de bron alleen voor papier geen dagen, terwijl rest of PMD wel komende dagen heeft, dan is dat geen leeg antwoord. De open papiertaken voor verdwenen dagen vervallen dan volgens AC-199.
**Toets:** Unit + DB + Int (met regressietoets op de P0-fixture)

### AC-205 — Storing, per oorzaak (WP3b; BR-52, BR-55; V-50)
GEGEVEN Jurgen en Ellen (beheerders, Ellen met herinneringen uit) en Lynn (gezinslid), en een van deze situaties:
- (a) het bijwerken lukt al meer dan 48 uur niet;
- (b) de bron geeft om 06:00 een leeg antwoord (AC-204 b: geen enkele komende ophaaldag), en opnieuw bij de volgende automatische poging om 07:15;
- (c) het laatste geslaagde bijwerken is meer dan 48 uur geleden, zonder dat er sindsdien een mislukte poging is vastgelegd, bijvoorbeeld omdat de achtergrondtaak stil lag [r4-D5]
WANNEER de achtergrondtaak daarna nog meerdere keren draait
DAN:
- zien Jurgen en Ellen in Instellingen de balk H, met de kop "Aan · laatst bijgewerkt <tijdstip>" (T-72). De balk hoort bij de oorzaak van de laatste mislukte poging. Bij (c) is dat de rij "onbereikbaar of onbruikbaar":

| Oorzaak | Balk | Melding |
| --- | --- | --- |
| onbereikbaar of onbruikbaar, of geen vastgelegde mislukte poging | H1: "Niet bijgewerkt sinds <dag>" (T-75) + T-76 | M-03 "De afvalkalender kon niet worden bijgewerkt" |
| leeg antwoord | H2: T-77 + T-77a (december en januari) of T-77b (andere maanden) | M-04 |
| adres niet meer gevonden | H3: "Adres niet meer gevonden" (T-77c) + T-77d, met de knoppen "Adres controleren" (opent het wijzigformulier, gevuld) en "Opnieuw proberen" | M-05 "De afvalkalender vindt het adres niet meer" |

- krijgen Jurgen en Ellen elk precies één melding, met de tekst uit UX §13.10 voor de oorzaak bij het versturen.
  - De melding linkt naar de instellingen van de afvalkalender (AC-223).
  - Hij komt niet bij elke ronde opnieuw, en ook niet opnieuw als de oorzaak tijdens de storing verandert;
- blijft de balk staan tot het bijwerken weer lukt, ook als de oorzaak intussen verandert. De tekst van de balk volgt dan de nieuwe oorzaak [r4-D5];
- krijgt Lynn geen melding en ziet ze geen balk of stille regel;
- noemen de melding en de push het adres niet.

**Geen storing zijn:**
- één leeg antwoord;
- een leeg antwoord om 06:00, en opnieuw om 06:30 (minder dan een uur ertussen) [r4-D5: "bijvoorbeeld door 'Opnieuw proberen'" geschrapt];
- "onbereikbaar" om 06:00, gevolgd door een leeg antwoord om 07:15;
- een poging die gestart is maar geen uitkomst gaf, na één leeg antwoord [r4-D5];
- een bron die alleen ophaaldagen ná de komende 14 dagen geeft, hoe vaak achter elkaar ook. Voorbeeld: papier eens per 4 weken, met de eerstvolgende dag over ruim drie weken (AC-204, P0).

Lukt het bijwerken weer, dan verdwijnt de balk zonder melding "weer gelukt", en worden de taken aangevuld. Een latere, nieuwe storing geeft opnieuw één melding.
**Toets:** Unit + Int + E2E

### AC-237 — Instellen zonder komende ophaaldagen (WP3b; BR-48, BR-52)
GEGEVEN een Haags adres waarvoor de gemeente voor rest, papier en PMD samen **geen enkele komende ophaaldag** (vandaag of later) geeft. Bijvoorbeeld:
- 28 december, na de laatste ophaaldag van het jaar, terwijl de kalender van het nieuwe jaar nog niet online staat;
- 2 januari, terwijl de gemeente voor het nieuwe jaar nog niets geeft. Dat geldt **zowel** als de kalender van het vorige jaar datums had, **als** wanneer die geen datums had [r4-D5]
WANNEER Jurgen het adres zoekt, (a) zonder bestaand adres of (b) als wijziging
DAN:
- ziet hij bij (a) de balk T-64, en bij (b) de variant T-64b (UX §13.16). Hij ziet in geen van beide gevallen T-62;
- is de hoofdknop "Adres zoeken", en blijven de velden gevuld;
- is er niets bewaard, en zijn er geen taken ontstaan of verdwenen;
- bij (b) blijven het oude adres en de oude taken staan.

**Tegenvoorbeeld (c): de eerstvolgende ophaaldag ligt ver weg, en het adres wordt gewoon bewaard.**
GEGEVEN het is maandag 5 oktober 2026, en de gemeente geeft voor het adres alleen papier, met de eerstvolgende ophaaldag op dinsdag 27 oktober (ruim drie weken later)
WANNEER Jurgen het adres zoekt en bij "Klopt dit?" "Ja, aanzetten" kiest
DAN:
- toont "Klopt dit?" bij papier di 27 okt, en bij rest en PMD "nog geen ophaaldag bekend" (T-45b);
- is het adres bewaard, zonder T-64;
- zijn er 0 afvaltaken ontstaan, en ziet hij T-90, variant bij 0 taken (UX §13.16);
- ontstaan de taken voor 27 oktober zodra die dag binnen de 14 dagen valt (AC-197);
- volgt er daarna bij het bijwerken geen stille regel en geen storing (AC-204).
**Toets:** Unit + Int + E2E

---

# Wijzigingslijst ten opzichte van r3

| # | Plek | r3 | r4 | Reden |
| --- | --- | --- | --- | --- |
| 1 | BR-48, derde bewaarvoorwaarde | "minstens één ophaaldag … in de komende 14 dagen" | "minstens één **komende** ophaaldag" | TD r5 §18.8.1/§18.8.4 (P0: papier eens per 4 weken) |
| 2 | BR-48, nieuw punt | — | eerstvolgende dag > 14 dagen: gewoon bewaard, 0 taken, T-90-variant | TD r5 §18.8.1 stap 3; designer punt 3 |
| 3 | BR-48, punt "Nog geen ophaaldagen" | "in de komende 14 dagen", eind december | "Geen enkele komende ophaaldag", eind december of begin januari, plus de januariregel (T-64, niet T-62) | TD r5 §18.8.1 stap 3 en 5 |
| 4 | BR-52, leeg antwoord | "geen enkele ophaaldag van vandaag t/m vandaag + 14" | "geen enkele komende ophaaldag"; jaarwisseling uitgeschreven; GFT en kerstbomen tellen niet mee | TD r5 §18.8.4 |
| 5 | BR-52, nieuw blok "Geen leeg antwoord" | alleen "enkele bak zonder dagen" | plus "alleen dagen ná 14 dagen"; papiervoorbeeld aangepast aan P0 (eind november tot half januari) | TD r5 §18.8.4, P0 |
| 6 | BR-52, storing (a), H1, meldingen en "blijft zichtbaar" | — | zonder vastgelegde poging: H1/M-03; balk blijft tot herstel | r4-D5 |
| 7 | BR-52, "waarom" | één zin | extra zin over vals alarm | P0 |
| 8 | AC-183 | T-90 letterlijk geciteerd | alleen het ID; verwijzing naar AC-237 (c) | de designer past T-90 aan |
| 9 | AC-186 | geldt altijd | "geen januari"; in januari geldt AC-237. Toets + Unit | TD r5 §18.8.1 en §18.15 (AC-186); r4-D5 |
| 10 | AC-204 (b) | "t/m vandaag + 14 … en als er alleen datums ná die 14 dagen zijn" | "geen enkele komende ophaaldag", plus jaarwisseling en GFT/kerstbomen; "alleen datums ná 14 dagen" is nu een tegenvoorbeeld met de P0-regressie (5 okt, volgende dag 27 okt) | TD r5 §18.8.4 en §18.15 (AC-204) |
| 11 | AC-205 | (b) "leeg antwoord"; H2/M-04 letterlijk | (b) verwijst naar de nieuwe definitie; H2/M-04 alleen als ID; nieuw geval (c) → H1/M-03; balk blijft tot herstel; twee extra "geen storing"-gevallen (poging zonder uitkomst; alleen dagen ná 14 dagen); "bijvoorbeeld door 'Opnieuw proberen'" geschrapt | analistpunt 4 in r5, r4-D5 |
| 12 | AC-237 | "geen enkele van vandaag t/m vandaag + 14", 28 december; T-64 letterlijk | "geen enkele komende"; 28 december én 2 januari (met en zonder datums van vorig jaar) → F2, nooit T-62; T-64/T-64b als ID; tegenvoorbeeld (c): volgende dag over ruim 3 weken → bewaard, 0 taken | analistpunt 4 in r5, r4-D5 |

**Kleine regelvervangingen buiten de BR's en AC's (voor de samenhang; de hoofdsessie neemt ze letterlijk over):**
- **13. UC-13 "Wat kan misgaan", zesde punt:** "de gemeente geeft geen enkele komende ophaaldag, bijvoorbeeld eind december of begin januari (T-64)".
- **14. §6 Randgevallen:**
  - rij "Instellen eind december …" wordt "Instellen eind december of begin januari, nieuwe kalender nog niet online | Niets bewaard, 'over een paar dagen opnieuw' (T-64, BR-48); in januari ook bij een adres zonder bakken";
  - in rij "Jaarwisseling zonder nieuwe kalender": "wordt het venster helemaal leeg" wordt "is er geen enkele komende ophaaldag meer";
  - rij "Papier wordt rond de kerst niet opgehaald": "rond de kerst" wordt "van eind november tot half januari";
  - nieuwe rij: "Eerstvolgende ophaaldag verder dan 14 dagen weg (bijvoorbeeld papier eens per 4 weken) | Geen storing; bij instellen gewoon bewaard; taken verschijnen 14 dagen vooraf (BR-48, BR-50, BR-52)".
- **15. §9 Afhankelijkheden, rij P0 (vervangt de hele rij):** "Proef van de bron, stap P0 (TD §18.1.6) | **Uitgevoerd op 2026-09-29** met het openbare testadres (`docs/wijzigingen/W-03/probe/P0-uitkomst.md`): `robots.txt` sluit opvragen niet uit, de opvraagroutes zijn bevestigd, en er is geen blokkade vanuit het datacenter (Supabase). Niet bevestigd: de gemeenteregel 22:00/07:45, omdat de gemeentesite servers weigert. Die bekijkt Jurgen één keer zelf **vóór de livegang (U0.1)**. De bereikbaarheid vanaf de echte server (Vercel) wordt gecontroleerd bij de rooktest (U5). | Zie de beslisregel hieronder".
- **16. §9 "Beslisregel na P0":**
  - de kop wordt "Beslisregel voor U0.1 en U5 (P0 is afgerond)";
  - de stoppunten "robots.txt/voorwaarden", "geen bruikbare bron", "meer naar buiten" en "rest, papier en PMD niet herkenbaar" vervallen, omdat P0 ze heeft uitgesloten;
  - deze twee blijven: "de site blokkeert verzoeken vanaf de server van de app (U5)" en "de gemeentetijden wijken af van 22:00 en 07:45, of verschillen per bak of wijk (U0.1)";
  - de zin "vóór de freeze een vraag, erna een wijzigingsverzoek" blijft.
- **17. ACCEPTANCE_CRITERIA, "Afspraken", het punt over de gemeentebron:** "De gemeentebron wordt in Unit, Int en E2E altijd nagebootst: met de echte P0-antwoorden van het openbare testadres (`probe/fixtures-2591BB-87.json`), en voor rest en PMD met synthetische antwoorden in dezelfde vorm. Alleen de Live-toets gebruikt de echte bron."
- **18. Teksttabel (§13.16-verwijzingen):**
  - rijen T-64/T-64b, T-77/T-77a/T-77b, T-90 en M-03/M-04/M-05: de beschrijvende tekst wordt "zie UX §13.16";
  - T-90 krijgt er "(ook variant bij 0 taken; AC-237 c)" bij.
- **19. "Aansluiting op TD":** `isWindowEmpty` wordt `hasNoUpcoming` (TD r5 §18.8.4), "één leeg-antwoordregel: geen enkele komende ophaaldag".
- **20. Interpretaties voor het totaalvoorstel:**
  - **nr. 3:** "… voor álle bakken samen geen enkele komende ophaaldag meer … Een volgende papierdag die toevallig over drie weken ligt, is géén storing.";
  - **nr. 11:** "Instellen rond de jaarwisseling. Zolang de gemeente geen enkele komende ophaaldag geeft (eind december, of begin januari als de nieuwe kalender nog niet online staat), wordt er niets bewaard. In januari ziet ook een adres zonder bakken dan 'probeer het over een paar dagen opnieuw'. Ligt de eerstvolgende dag alleen ver weg, dan wordt het adres gewoon bewaard; de taken verschijnen 14 dagen vooraf.";
  - **nr. 16:** "Onofficiële bron. De proef (P0) is op 29 september 2026 gedaan met een openbaar testadres: de bron werkt, mag geautomatiseerd worden opgevraagd, en blokkeert servers niet. De gemeenteregel 22:00/07:45 kon niet worden bevestigd, omdat de gemeentesite servers weigert. Jurgen kijkt daar vóór de livegang één keer zelf naar. Wijkt die regel af, of blokkeert de site de echte server, dan stopt het werk en komt het terug bij Jurgen."
- **21. Status (r3, laatste zin):** "P0 wordt bij voorkeur vóór `/design-go` uitgevoerd" wordt "P0 is uitgevoerd op 2026-09-29; U0.1 (gemeenteregel, Jurgen) is een controle vóór de livegang, geen bouwvoorwaarde".

### Vragen voor Jurgen
Geen nieuwe. U0.1 staat al bij de architect ("Wil je één keer op de pagina van de gemeente kijken …") en is een handeling, geen beleidsvraag.

### Punten voor de hoofdsessie
1. **Nog te doen uit r4-D5** (niet gevraagd in deze ronde):
   - AC-217: de lijstverwijzing wordt alleen "TD §18.16 U3";
   - BR-54 en AC-210: de grens D+7 voor binnenzetten, met het extra geval "geen volgende buitenzet-taak";
   - AC-236: de laatste zin herschrijven als regel, met toets Unit;
   - interpretaties "D+7" en "de balk blijft tot herstel".
   Wil je dat ik die in een volgende korte ronde uitschrijf?
2. **Voor de architect (geen Jurgen-vraag, wel nagaan vóór de planreview):**
   - **Probleem:** met "J+1 alleen in december" krijgt een adres waarvan de laatste ophaaldag van het jaar vóór 1 december ligt, eind november onterecht `SUSPECT_EMPTY`, en na een uur een storing.
   - **Voorbeeld:** het P0-adres heeft papier tot 24 november, en daarna pas weer in januari.
   - **Voor ons gezin:** waarschijnlijk niet merkbaar, omdat restafval vaak genoeg komt. Toch is het het soort vals alarm dat r5 juist wil voorkomen.
   - **Voorstel:** J+1 ook ophalen zodra C(J) geen komende datum meer heeft, of vanaf november. Mijn BR-52 en AC-204 zijn zo geschreven dat ze met beide keuzes kloppen. De architect beslist en noemt het in §18.8.4.
3. De ID van de T-90-variant bij 0 taken overnemen van de designer (AC-183, AC-237 c, BR-48, teksttabel).

### Aannames
Geen.

### Status
**KLAAR VOOR PLANREVIEW**, voor analistpunt 4 uit r5 en de onderdelen van r4-D5 die in BR-52, AC-186, AC-205 en AC-237 vallen. De overige r4-D5-punten staan hierboven onder punt 1.

Bronbestanden:
- /home/user/takenlijstje/docs/wijzigingen/W-03/solution-architect-r5.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/solution-architect-r4.md (deel D, punt 5)
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-analyst-r3.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/probe/P0-uitkomst.md
