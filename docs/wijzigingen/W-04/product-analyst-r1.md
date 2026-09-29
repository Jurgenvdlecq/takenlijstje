## Product-analyse: W-04 huishoud-assistent — ronde 1
Documenten bijgewerkt: geen, want `docs/PRODUCT_SPEC.md` en `docs/ACCEPTANCE_CRITERIA.md` zijn bevroren. Hieronder staat de concept-invoegtekst, per plek letterlijk, in de vorm van W-03 (`docs/wijzigingen/W-03/samengevoegd/…`).
Niveau-advies: 2 blijft. Het is een interne gezinsapp, maar W-04 voegt opnieuw persoonsgebonden gegevens toe (wie deed wat, wie is wanneer weg), dus de security-review blijft verplicht.

**Basis (bindend):** `docs/wijzigingen/W-04/product-review.md` (fases A–E, principes §3, keuzes §11) en de antwoorden K-1 t/m K-4 in `docs/PROGRESS.md`. K-1 vervangt V-21 en de bijbehorende delen van V-19 en V-22. Alle andere besluiten (V-05 t/m V-58) blijven staan; waar W-04 daarvan afwijkt, staat dat erbij met de reden.

**Wat dit concept doet:**
- nieuwe sectie §15 in PRODUCT_SPEC met UC-16 t/m UC-21 en BR-60 t/m BR-71;
- exacte vervanginstructies voor §0, §5, §6, §7, §8, §10, §11, §12 en §13;
- acceptatiecriteria AC-238 t/m AC-284 (de hoogste in gebruik is AC-237), plus de lijst van bestaande criteria die door W-04 vervallen of veranderen;
- vragen V-60 t/m V-66, interpretaties en aannames, en een status.

**Wat er bewust niet in staat:** schermteksten en tekst-ID's (die komen van de product-designer in UX_SPEC; hier staan alleen strekkingen tussen aanhalingstekens), techniek (kolomnamen, tabellen), en de fases A1 en A2 uit de review (afvalkalender live en Ellen uitnodigen: geen productwijziging).

---

=== PRODUCT_SPEC.md ===

**P1. Nieuwe sectie §15, na §14 "Afvalkalender (W-03)":**

## 15. Huishoud-assistent (W-04)

**Probleem en doel.** Het doel uit §1 blijft: minder vergeten, en minder gevoel van oneerlijke verdeling (V-19). De productreview (`docs/wijzigingen/W-04/product-review.md` §0) vond drie feiten die dat doel nu in de weg staan:
1. de app maakt van elke routine alle keren van de komende 14 dagen alvast aan, waardoor 10 routines 47 open taken geven ("Vaatwasser inruimen" 15 keer). Niemand ziet meer wat er nú telt;
2. een gemiste keer wordt voor elke routine gelijk behandeld: hij vervalt zodra de volgende komt. Dat klopt voor de vaatwasser, niet voor de badkamer of het bed;
3. sinds V-21 is niets van iemand. "Als het niemands taak is, is het niemands verantwoordelijkheid", en dan wordt er vergeten (review §4 C1).

Jurgen heeft daarom (K-1) besloten terug te gaan naar **"de app zegt wie aan de beurt is en onthoudt wie iets deed"**, in de eenvoudigste vorm: om de beurt, met overnemen in één tik. Geen algoritme, geen punten, geen scorebord.

**Productprincipes (review §3, toetssteen voor elke regel hieronder):**
1. de app onthoudt, jullie doen: een routine wordt één keer ingesteld;
2. Vandaag is het product;
3. laat alleen zien wat nu telt: een routine staat één keer in beeld;
4. voorspelbaar boven slim: elke automatische keuze is in één zin uit te leggen en met één tik te corrigeren;
5. uitzonderingen kosten één tik;
6. samen, niet tegen elkaar: geen winnaars, geen rood omdat iemand "achterloopt";
7. minder instellingen, betere standaarden.

**Besluiten van Jurgen (bindend):**

| Vraag | Besluit |
| --- | --- |
| K-1 | Ja: terug naar "de app zegt wie aan de beurt is en onthoudt wie iets deed", in de vorm om de beurt + overnemen in één tik. Vervangt V-21 ("niemand toegewezen", "niet bijhouden wie") en de bijbehorende delen van V-19 en V-22 |
| K-2 | Basis voor twee (Ellen en Jurgen), optioneel voor vier; "kinderen doen echt een stuk minder" |
| K-3 | Eerst de afvalkalender (WP3b) afmaken en live, daarna W-04 |
| K-4 | Het goedgekeurde nieuwe schermontwerp (WP4–WP9) wordt vóór het bouwen aangepast met W-04; de schermen worden één keer gebouwd |

**Wat blijft van eerdere besluiten:** iedereen mag afvinken (V-10) en terugdraaien (V-22; alleen het deel "de app onthoudt niet wie" vervalt); geen punten en geen spaardoel (V-21, dat deel blijft); de maker wordt bewaard maar niet getoond (V-25); de succescriteria (V-27) worden aangevuld, niet vervangen; de afvalkalender (§14) verandert niet.

### 15.1 Gebruikers

| Gebruiker | Rol in W-04 | Wat verandert voor hem |
| --- | --- | --- |
| **Ellen en Jurgen** (beheerders) | **Beurtdeelnemers:** zij wisselen elkaar af en zien de balans | Vandaag toont per taak wie aan de beurt is en ±duur; één dagmoment per persoon in plaats van losse meldingen; overnemen in één tik; "even weg" |
| **Lynn (15) en Kai (13)** (gezinsleden, optioneel) | Zien alles, vinken af, kunnen overnemen. Of zij ook beurtdeelnemer zijn: `[OPEN: V-60]` | Een routine kan "Altijd Lynn" zijn (K-2). Zij tellen **niet** mee in de balans van Ellen en Jurgen, tenzij V-60 anders zegt |
| Wie het resultaat ziet zonder te gebruiken | Niemand buiten het huishouden. Er gaat niets naar externe partijen (§8) | — |

**Voorwaarde die geen functie is:** verdelen werkt pas als Ellen de app gebruikt (review §0.1, fase A2). Zolang er minder dan twee beurtdeelnemers actief zijn, toont de app geen namen bij "om de beurt" en geen balans (BR-64). Zo is er nooit een scherm dat alles aan Jurgen "toewijst".

### 15.2 Jobs-to-be-done (aanvulling op §3)
- Als **Jurgen** wil ik bij het openen zien wat er vandaag van **mij** verwacht wordt, zodat ik het niet hoef uit te zoeken of te onthouden, **wanneer** ik 's ochtends of 's avonds even kijk.
- Als **Ellen** wil ik dat de app onthoudt wie de badkamer de vorige keer deed, zodat we daar geen discussie over hebben, **wanneer** een klus weer aan de beurt is.
- Als **beheerder** wil ik een klus als "3 maanden na de vorige keer" kunnen instellen, zodat de app onthoudt wanneer de filters weer moeten, **wanneer** ik hem eenmaal doe en afvink.
- Als **huisgenoot met tijd** wil ik een taak van de ander met één tik overnemen, zodat de ander dat weet en de balans klopt, **wanneer** ik eerder thuis ben.
- Als **gezin** willen we rustig kunnen zien of het over een paar weken ongeveer eerlijk verdeeld was, zonder scorebord, **wanneer** een van ons het gevoel heeft dat het scheef loopt.

### 15.3 Use cases

*UC-16: Een routine staat één keer in beeld (iedereen; kernflow, aanvulling op UC-01 en UC-02)*
- **Begin:** de gebruiker opent Vandaag.
- **Inhoud:** per routine staat er hooguit één open keer: de eerstvolgende. Bij een routine met beurten staat de naam erbij, plus ±duur als die bekend is.
- **Stappen:** afvinken (één tik). De rij verdwijnt; de volgende keer van de routine ontstaat direct met de nieuwe datum (BR-60) en de volgende beurt (BR-64).
- **Eind:** de lijst toont alleen wat nu telt. Bij 10 routines staan er ongeveer 10 tot 12 open taken, niet 47.
- **Wat kan misgaan:**
  - offline afvinken: de volgende keer verschijnt zodra de wachtrij verwerkt is, en in elk geval binnen 15 minuten via de achtergrondtaak (BR-30);
  - twee mensen vinken tegelijk af: één registratie (BR-11), één afvinker (BR-65);
  - de volgende keer ontstaat nooit dubbel (BR-10, BR-60).

*UC-17: Een gemiste keer (iedereen)*
- **Snel ritme** (bijvoorbeeld vaatwasser, dagelijks): de gemiste keer van gisteren is vandaag weg en telt als vergeten; alleen die van vandaag staat er (BR-61).
- **Langzaam ritme** (bijvoorbeeld badkamer, wekelijks): de gemiste keer blijft staan onder "Nog open" met "sinds zaterdag", zonder rood alarm. De volgende keer wordt pas gepland als deze gedaan of overgeslagen is. In het detail: **Gedaan · Morgen · Deze keer overslaan** (BR-61).
- **Eind:** een gemiste vaatwasser hoeft niet "ingehaald", een gemiste badkamer verdwijnt nooit stil.

*UC-18: Een routine "na de vorige keer" instellen (beheerder of maker; aanvulling op UC-04)*
- **Begin:** een nieuwe of bestaande terugkerende taak.
- **Stappen:**
  1. Kies bij herhalen **"op vaste dagen"** (zoals nu, BR-01) of **"… na de vorige keer"** met een aantal dagen, weken of maanden (BR-62).
  2. Kies bij **"Wanneer?"** één van: op een dag, ergens in een venster (deze week, dit weekend, van–tot), of vóór een tijdstip (BR-63).
  3. Kies bij **"Wie?"**: Om de beurt (standaard) · Altijd <naam> · Samen (BR-64).
- **Eind:** de samenvattende regel zegt bijvoorbeeld "3 maanden na de vorige keer · volgende ± 12 jan · om de beurt".
- **Slimme invoer:** "afzuigkapfilter elke 3 maanden" wordt een routine "na de vorige keer" (interpretatie 4); "badkamer dit weekend" wordt een venster za–zo; een voornaam ("… Ellen") wordt weer herkend als "Altijd Ellen" of, bij een losse taak, als naam (vervangt UC-03, laatste bullet).
- **Wat kan misgaan:** een gezinslid zonder recht (BR-22) kan de verdeling of het ritme van andermans routine niet wijzigen; geweigerd zonder dat er iets verandert.

*UC-19: Overnemen (iedereen)*
- **Begin:** een open taak met een naam erbij, op Vandaag of in het detail.
- **Stappen:** één tik op "Ik doe hem" (als hij bij de ander staat) of "Aan <naam> geven" (als hij bij mij staat). Bij meer dan twee mogelijke personen kiest de gebruiker de naam (één tik extra).
- **Eind:** de taak staat nu bij de ander, alleen voor deze keer. De ander krijgt een stille melding ("Jurgen nam 'Badkamer' over" of "Ellen gaf je 'Badkamer'"). Wie hem afvinkt, telt voor de balans (BR-66).
- **Wat kan misgaan:** twee keer tikken of tegelijk overnemen: de laatste actie geldt, nooit een dubbele melding (BR-10); offline: via de wachtrij; de taak is intussen afgevinkt: nette melding, niets verandert.

*UC-20: Balans en "even weg" (beurtdeelnemers; beheerders voor anderen)*
- **Balans:** op het Overzicht (en als de designer dat kiest als kaart onderaan Vandaag, V-28) staat één regel: "Afgelopen 4 weken: Jurgen ± 3 u · Ellen ± 3 u 20 — ongeveer in balans" (BR-67). Tekst, geen grafiek, geen kleur, geen melding.
- **Even weg:** Instellingen › Gezin › <naam> › "Weg van … t/m …". Beurten in die periode gaan naar de ander en tellen niet mee in de balans (BR-68).
- **Wat kan misgaan:** beide beurtdeelnemers tegelijk weg: de taken staan zonder naam ("wie tijd heeft"), en het advies blijft: reeksen pauzeren bij een gezinsvakantie (BR-09; V-24 blijft voor dat deel).

*UC-21: Het dagmoment (iedereen met meldingen aan; vervangt in UC-08 het dag- en avondoverzicht)*
- Elke persoon krijgt hooguit **één** melding per dag op een vaste tijd (BR-69): "Nog open voor jou: badkamer (sinds za), vaatwasser". Wie niets open heeft, krijgt niets.
- Herinneringen per taak blijven alleen voor taken met een tijdstip (afval, een afspraak).
- Meldingsinstellingen worden: push aan/uit, dagmoment (tijd of uit), herinneringen (voor taken met een tijdstip) aan/uit, "taak gedaan" aan/uit.
- **Wat kan misgaan:** push op de iPhone alleen vanaf het beginscherm (bestaand); knoppen in de melding zijn fase D2 (later, §15.7).

### 15.4 Businessregels

- **BR-60 — Eén keer per routine in beeld (vervangt BR-02 voor routines).**
  - Per routine bestaat er hooguit **één open uitvoering**: de eerstvolgende. Latere keren bestaan alleen als planning (projectie in de Kalender, zoals de bestaande "spookjes"), niet als taak.
  - **De volgende keer ontstaat** zodra de eerstvolgende is afgevinkt, overgeslagen, vervallen (BR-61) of verwijderd ("alleen deze"), en zodra een pauze afloopt (BR-09). Dat gebeurt direct bij de actie, en anders uiterlijk bij de volgende achtergrondronde (BR-30).
  - **Welke datum de volgende keer krijgt:**
    - "op vaste dagen": de eerstvolgende reeksdatum ná de geplande dag van de afgehandelde keer **én** ná de dag van afhandelen. Voorbeeld: badkamer elke zaterdag, die van za 26 sep gedaan op di 29 sep → volgende za 3 okt; die van za 3 okt gedaan op do 1 okt → volgende za 10 okt;
    - "na de vorige keer": BR-62.
  - **Nooit dubbel:** per routine en reeksdatum bestaat nooit meer dan één uitvoering (was BR-02), ook niet bij dubbel afvinken, overlappende achtergrondrondes of offline wachtrijen.
  - **Een verplaatste of aangepaste keer** ("alleen deze", BR-08) blijft de eerstvolgende tot hij is afgehandeld; de app maakt er geen tweede naast.
  - **"Mag al vanaf" en "uiterlijk"** (BR-18) blijven werken op de eerstvolgende keer: hij staat onder Binnenkort tot de "vanaf"-dag, en daarna op Vandaag.
  - **Herinneringen vooruit** ("2 dagen van tevoren") blijven werken, omdat de eerstvolgende keer altijd bestaat zodra de vorige is afgehandeld.
  - **Kalender:** toekomstige keren staan als planning; dagelijkse routines staan standaard niet in de Kalender (ze zijn elke dag), alleen op Vandaag. De precieze weergave is werk voor de product-designer.
  - **Uitzondering:** afvaltaken volgen BR-50 (14 dagen vooruit, per ophaaldag). Ze zijn geen routine.
  - — waarom: bij 10 routines stonden er 47 open taken. Toekomst is planning, geen werk (principe 3).

- **BR-61 — Gemiste keer per ritme (vervangt BR-16).**
  - **Snel ritme** (gemiddeld minder dan 7 dagen tussen twee keren: dagelijks, elke 2 t/m 6 dagen, vaste weekdagen met twee of meer dagen per week): een verlopen keer wordt **automatisch overgeslagen zodra de volgende reeksdatum aanbreekt**, en telt als vergeten. Precies zoals BR-16.
  - **Langzaam ritme** (gemiddeld 7 dagen of meer: wekelijks, één vaste weekdag, elke X weken, maandelijks, jaarlijks) en **alle routines "na de vorige keer"**: een verlopen keer **blijft open** tot hij is afgevinkt of bewust overgeslagen. De volgende keer wordt pas gepland na afvinken of overslaan (BR-60). Hij wordt getoond als "nog open sinds <dag>", niet als alarm (principe 6); "verlopen" blijft wel afgeleid (BR-17), zodat "te laat" in de historie klopt.
  - **Vergeten tellen:** een automatisch overgeslagen snelle keer en een bewust overgeslagen langzame keer tellen allebei als "vergeten" in het Overzicht (UC-06). Een langzame keer die laat maar wél gedaan is, telt als "te laat", niet als vergeten.
  - **Het ritme wijzigen** ("deze en volgende") past de regel direct toe op de open keer.
  - — waarom: een gemiste vaatwasser hoeft niet ingehaald (morgen is er weer een); een gemiste badkamer mag nooit stil verdwijnen. Eén regel op basis van de frequentie, geen instelling (principe 7).

- **BR-62 — Herhaling "na de vorige keer" (aanvulling op BR-01).**
  - Een routine heeft één van twee herhaalwijzen: **"op vaste dagen"** (alle ritmes van BR-01, zoals nu) of **"X dagen/weken/maanden na de vorige keer"** (X van 1 t/m 365 dagen, 1 t/m 52 weken of 1 t/m 24 maanden).
  - **Volgende datum** = de dag van afvinken + X. Voorbeeld: "3 maanden na de vorige keer", afgevinkt op 20 januari → volgende 20 april. Maandrekenen volgt de bestaande domeinregel (maandeinde: laatste dag van de maand, §13 aanname).
  - **Deze keer overslaan** bij "na de vorige keer": `[OPEN: V-63]`. Voorstel (review B3): overslaan telt voor het ritme als gedaan, dus volgende = dag van overslaan + X.
  - **Pauzeren** (BR-09): valt de berekende datum in een pauze, dan wordt het de eerste dag ná de pauze.
  - **Verplaatsen "alleen deze"**: verandert alleen deze keer; de volgende blijft gerekend vanaf de dag van afvinken.
  - **Omzetten** tussen de twee wijzen ("deze en volgende"): de open keer houdt zijn datum; de daaropvolgende volgt de nieuwe wijze.
  - Geen combinaties ("elke 2 weken, maar niet eerder dan …"), geen "X na de vorige keer, op een zaterdag".
  - — waarom: bed, filters, ontkalken en rookmelders horen te tellen vanaf de laatste keer; anders vraagt de app ze te vroeg of dubbel, en daalt het vertrouwen (review §2.2.2).

- **BR-63 — "Wanneer?" is één keuze (vervangt in UC-03/UC-04 de losse velden "mag al vanaf", "uiterlijk" en "tijd" bovenaan het formulier).**
  - De gebruiker kiest één van drie:
    - **Op een dag** (met optioneel een tijd): geplande dag = die dag; uiterlijk = einde van die dag, of het tijdstip;
    - **Ergens in een venster** ("deze week", "dit weekend", of van–tot): geplande dag = eerste dag van het venster; "mag al vanaf" = die dag; uiterlijk = einde van de laatste dag. "Deze week" loopt t/m zondag; "dit weekend" is zaterdag t/m zondag (op zondag: alleen zondag);
    - **Vóór een tijdstip** (dag + tijd): geplande dag = vandaag, uiterlijk = dat moment.
  - Het vult de **bestaande** velden; er komt geen nieuw model. BR-18 blijft gelden.
  - De taak staat op Vandaag vanaf de eerste dag van het venster, met de uiterste dag erbij, en is verlopen na het einde (BR-17).
  - Voor routines geldt hetzelfde per keer ("wekelijks, ergens in het weekend" = vanaf zaterdag, uiterlijk zondag); dat is het bestaande "X dagen vooraf / Y dagen na" in één keuze.
  - Slimme invoer: "dit weekend", "deze week", "voor vrijdag 18u" vullen dezelfde keuze.
  - Afvaltaken houden hun eigen tijden (BR-49).
  - — waarom: de techniek bestond al, maar als drie losse velden. Eén vraag is sneller en minder fout (review §2.1.7).

- **BR-64 — Wie is aan de beurt (K-1; vervangt in §0 "Toewijzen aan een persoon" en "Automatische verdeling").**
  - **Beurtdeelnemers** zijn de actieve leden die meedraaien in "om de beurt" en in de balans. Standaard: Ellen en Jurgen (K-2). Of en hoe Lynn en Kai meedraaien: `[OPEN: V-60]`.
  - **Per routine** kiest de maker of een beheerder één verdeling:
    - **Om de beurt** (standaard voor elke nieuwe routine, ook uit de bibliotheek en de onboarding);
    - **Altijd <naam>** (elk actief lid, ook een gezinslid; K-2);
    - **Samen** (geen naam; iedereen doet mee).
  - **Losse taak:** wie hem aanmaakt kiest optioneel een naam; standaard geen naam ("wie tijd heeft"). Slimme invoer herkent een voornaam weer.
  - **De regel van "om de beurt"**, in deze volgorde, per keer, op het moment dat de keer ontstaat (BR-60):
    1. is een beurtdeelnemer "even weg" op de geplande dag (BR-68), dan doet hij niet mee voor deze keer;
    2. loopt de balans **20% of meer** uit elkaar (BR-67), dan krijgt de beurtdeelnemer die minder deed de beurt;
    3. anders krijgt de beurt wie de **vorige keer van deze routine níet afvinkte** (BR-65). Telt de vorige keer niet (onbekende persoon, overgeslagen, vervallen, "samen"), dan kijkt de app naar de laatst bekende afvinker van deze routine;
    4. is er geen enkele bekende afvinker, dan de beurtdeelnemer die het langst geen beurt van deze routine had; en anders de deelnemer die het eerst lid werd.
  - **Minder dan twee actieve beurtdeelnemers** (bijvoorbeeld zolang Ellen de app niet gebruikt, of als één van beiden is uitgezet): "om de beurt" toont geen naam ("wie tijd heeft"), en de balans wordt niet getoond. Zodra er weer twee zijn, begint de afwisseling bij de eerstvolgende keer.
  - **"Altijd <naam>" en die persoon is uitgezet of verwijderd:** de routine valt terug op "om de beurt"; in Taken › Terugkerend is dat te zien. Er verdwijnt niets.
  - **Uitleg in het detail, altijd in één zin:** "Om de beurt · vorige keer Ellen (za 26 sep)", "Om de beurt · Ellen deed de laatste weken meer", "Altijd Jurgen", "Samen", "Overgenomen door Ellen", "Jurgen is even weg". Nergens een score.
  - **De naam op een keer is een voorstel**, geen slot: iedereen mag elke taak afvinken (V-10), ook die van een ander, en iedereen mag overnemen (BR-66).
  - Geen voorkeuren, geen beschikbaarheid per weekdag, geen "automatisch balanceren"-schakelaar, geen minutenoptimalisatie (review §2.1.2).
  - — waarom: voor twee personen is om de beurt voorspelbaar, uitlegbaar en bijna altijd eerlijk genoeg (principe 4). Het balansgebruik in stap 2 is de enige compensatie, en die is in één zin uit te leggen.

- **BR-65 — Onthouden wie afvinkte (K-1; vervangt in BR-12 "Wat de app nooit vastlegt: wie afvinkte", en de betreffende delen van §0, BR-13, BR-14 en BR-31).**
  - **Wat wordt vastgelegd:** bij elke afvinking het lid dat afvinkte, náást wat BR-12 al vastlegt. Dat is **wie op de knop drukte**, niet wie aan de beurt was.
  - **De database bepaalt het lid** uit de ingelogde sessie. Een meegestuurde persoon wordt genegeerd; het is niet te vervalsen en niet te wijzigen (zoals de schrijversnaam bij notities, V-34).
  - **Namens een ander afvinken** bestaat niet in W-04 (`[OPEN: V-66]`, voorstel: nee). Heeft de ander het gedaan, dan vinkt die het zelf af, of neemt hij eerst over (BR-66) en vinkt daarna af.
  - **Terugdraaien** (BR-13, V-22): iedereen mag het; de registratie verdwijnt in zijn geheel, dus ook de persoon. De taak krijgt dan opnieuw de naam die hij had vóór het afvinken.
  - **"Bezig"** (BR-14) blijft zonder persoon; de naam bij de taak is de beurt, niet wie op "bezig" drukte.
  - **Waar de persoon te zien is:** in de gedaan-lijst en de historie ("Ellen · 14:02"), in het detail van de routine ("vorige keer Ellen"), en samengeteld in de balansregel (BR-67). **Nergens** een ranglijst, telling per persoon per week, "meest gedaan door", of kleur.
  - **In meldingen:** "taak gedaan" mag de naam noemen ("Ellen heeft 'Badkamer' gedaan"); de ontvangers blijven volgens V-38 (ook de afvinker). De overname-melding noemt de naam (BR-66). Herinneringen en het dagmoment noemen alleen de ontvanger zelf ("voor jou").
  - **Bestaande afvinkingen** van vóór W-04 (op live 8) hebben geen persoon, tonen "onbekend" en tellen niet mee in beurt of balans. `[OPEN: V-64]`.
  - **Bewaren:** de persoon bij een afvinking wordt na **90 dagen** losgekoppeld; de afvinking zelf blijft 2 jaar (BR-45). Beurt en balans hebben hooguit 4 weken nodig. `[OPEN: V-65]`.
  - **Verwijderd lid:** verdwijnt het lid of zijn account, dan wordt de persoon bij zijn afvinkingen "onbekend" (V-15; anders dan bij notities, want een naam bij een afvinking heeft zonder balans geen doel).
  - **Logs:** de eigen logregels van de app bevatten nog steeds geen persoon (BR-12 blijft daarvoor gelden); de platformlogs blijven zoals in BR-12 beschreven.
  - — waarom: zonder "wie deed het" bestaat er geen beurt en geen balans (review C2). De app bewaart het minimum (alleen de naam bij de afvinking, kort) en toont het nooit als score (principe 6).

- **BR-66 — Overnemen in één tik (K-1; vervangt "Ruilen" in §0).**
  - Iedereen in het huishouden mag een open taak **voor deze keer** aan zichzelf ("Ik doe hem") of aan een ander lid ("Aan <naam> geven") zetten. Ook een taak van "Altijd <naam>" of zonder naam.
  - Het kost **één tik** vanuit het detail of via lang indrukken op Vandaag; bij meer dan één mogelijke ander één tik extra om de naam te kiezen.
  - **Gevolg:** de naam op de keer verandert, met de reden "overgenomen". De routine zelf verandert niet; de volgende keer volgt weer BR-64, gerekend met wie deze keer **afvinkt** (BR-65). Voorbeeld: Jurgen was aan de beurt, Ellen nam over en vinkte af → de volgende beurt is voor Jurgen.
  - **Melding:** de persoon van wie de taak was, krijgt één stille melding in de app ("Ellen nam 'Badkamer' over"); wie een taak krijgt, ook ("Jurgen gaf je 'Badkamer'"). Push volgens de eigen pushinstelling. Nooit een melding aan wie zelf tikte. Geen verzoek, geen accepteren, geen weigeren.
  - **Idempotent:** overnemen van een taak die al bij jou staat doet niets en geeft geen melding. Twee mensen tegelijk: de laatste actie geldt, en er is per wisseling hooguit één melding per ontvanger (BR-10).
  - **Al afgevinkt of verwijderd:** geweigerd met een nette melding; er verandert niets.
  - **Balans:** overnemen verandert de balans niet; alleen afvinken telt.
  - **"Even weg":** wie even weg is, kan wel overnemen (hij weet zelf of hij tijd heeft).
  - — waarom: "kan jij hem doen?" moet net zo makkelijk zijn als het zeggen (principe 5). Een verzoek-en-accepteer-flow was het oude "ruilen" en is bewust weg.

- **BR-67 — Balans over 4 weken (K-1).**
  - **Wat telt:** alle afvinkingen met een bekende persoon in de **afgelopen 28 dagen**, van taken én afvaltaken, met als gewicht de **duur** van de taak; is die leeg, dan **15 minuten**. Er is geen apart veld "inspanning".
  - **Wat niet telt:** afvinkingen zonder persoon; afvinkingen van taken die gepland stonden op een dag waarop een van de beurtdeelnemers "even weg" was (BR-68); "samen"-taken (die deden ze samen; de afvinker krijgt er geen voordeel van); afvinkingen van wie geen beurtdeelnemer is (tenzij V-60).
  - **De regel:** verschil = |A − B| / max(A, B).
    - verschil < 20%: "Afgelopen 4 weken: Jurgen ± 3 u · Ellen ± 3 u 20 — ongeveer in balans";
    - verschil ≥ 20%: "Afgelopen 4 weken: Ellen ± 4 u · Jurgen ± 2 u 40 — Ellen deed wat meer; de app geeft Jurgen de volgende beurten" (en BR-64 stap 2 doet dat);
    - minder dan 4 weken sinds de start van W-04, of minder dan 5 afvinkingen met persoon in die 28 dagen: "Nog weinig gegevens; over een paar weken zie je hier of het in balans is".
  - **Vorm:** tekst, afgerond op 10 minuten; geen grafiek, geen kleur voor "achter", geen melding, geen geschiedenis van vorige periodes. Het is een rustige constatering (principe 6).
  - **Wie het ziet:** ieder actief lid van het huishouden, op het Overzicht (en optioneel als kaart op Vandaag, UX).
  - **Niet getoond** bij minder dan twee actieve beurtdeelnemers (BR-64).
  - — waarom: één week is te schokkerig (één badkamerbeurt verschuift alles); 4 weken en tekst houden het een gesprek, geen scorebord (review §2.1.4).

- **BR-68 — Even weg (K-1; vervangt V-24 gedeeltelijk: alleen voor beurten, zonder "opnieuw verdelen, doorschuiven of vrijgeven").**
  - Een lid kan voor **zichzelf** een periode "even weg" zetten (van–t/m, hele dagen); een **beheerder** kan dat ook voor een ander lid. Meerdere periodes per lid mogen; ze mogen overlappen (worden samengevoegd).
  - **Gevolg voor beurten:** op dagen in de periode krijgt de afwezige geen beurt (BR-64 stap 1). Keren van "Altijd <afwezige>" gaan die dagen naar een andere beurtdeelnemer, met de reden "even weg"; is er geen andere, dan zonder naam.
  - **Al bestaande open keren** in de periode worden bij het invoeren opnieuw toebedeeld, behalve keren die iemand bewust heeft overgenomen (BR-66). Wordt de periode ingekort of verwijderd, dan worden de nog open keren in de vrijgekomen dagen opnieuw toebedeeld volgens BR-64.
  - **Balans:** taken gepland op een dag in iemands afwezigheid tellen voor niemand mee (BR-67).
  - **Daarna** loopt de afwisseling gewoon door: de eerste beurt na de periode volgt BR-64 stap 3, dus meestal krijgt de teruggekeerde hem.
  - **Zichtbaar** voor het hele huishouden (bij de naam in Instellingen › Gezin, en in het detail: "Ellen is even weg"). Niet in meldingen aan anderen.
  - **Bewaren:** tot 35 dagen na de einddatum (nodig voor de balans van 4 weken), daarna automatisch weg (BR-45).
  - **Geen** "drukke week", geen reden of bestemming, geen halve dagen. Voor een gezinsvakantie blijft pauzeren (BR-09) het middel.
  - — waarom: zonder afwezigheid klopt verdelen niet (review C5). Dit is de kleinste vorm die dat oplost.

- **BR-69 — Eén dagmoment in plaats van losse meldingen (vervangt in BR-31 "Dagoverzicht", "Avondoverzicht", en beperkt "Herinnering", "Deadline nadert" en "Verlopen").**
  - **Dagmoment:** per persoon hooguit **één** melding per dag, op een vaste tijd. Standaardtijd: `[OPEN: V-62]` (voorstel 19:30). Inhoud: de taken die op dat moment open zijn en vandaag of eerder gepland: eerst die op de eigen naam, daarna die zonder naam en "samen". Taken op de naam van een ander staan er niet in. Bij niets open: geen melding.
  - **Herinnering per taak** (BR-31): alleen voor taken **met een tijdstip** (afvaltaken, "vóór een tijdstip", "op een dag om …"). Voor taken zonder tijdstip is er geen herinnering; het dagmoment dekt ze.
  - **"Deadline nadert" en "verlopen" vervallen** voor taken zonder tijdstip. Voor taken met een tijdstip blijft alleen "deadline nadert" (BR-31), nooit "verlopen": het dagmoment noemt wat nog open is.
  - **Meldingsvoorkeuren per persoon:** push aan/uit · dagmoment (tijd, of uit) · herinneringen (taken met tijdstip) aan/uit · "taak gedaan" aan/uit. De schakelaars "deadline nadert", "verlopen", "dagoverzicht" en "avondoverzicht" verdwijnen.
  - **Standaard** (V-23 blijft): beheerders alles aan behalve "taak gedaan"; gezinsleden alles uit. Bij de overgang krijgt wie het avondoverzicht aan had het dagmoment aan op de standaardtijd; wie beide overzichten uit had, heeft het dagmoment uit.
  - **Nieuwe soort "overgenomen"** (BR-66): altijd in de app; push volgens de pushinstelling.
  - **Afvalkalender:** BR-55 blijft ongewijzigd (21:00 en 18:00 zijn tijdstippen).
  - **Grens:** op een normale dag krijgt een persoon hooguit 2 meldingen (dagmoment + hooguit één herinnering of overname); nooit dubbel (BR-31).
  - — waarom: 6 schakelaars, 3 tijden en losse meldingen per taak zijn beheerwerk en werken slechter dan één moment dat zegt wat er van jou nog open staat (review §2.2.4).

- **BR-70 — Rechten (K-1; aanvulling op §7).**
  - **Iedereen in het huishouden:** afvinken (ook van een ander), terugdraaien, overnemen, zien wie iets deed, de balans zien, eigen "even weg" zetten.
  - **Maker of beheerder** (BR-22): de verdeling en de herhaalwijze van een routine wijzigen.
  - **Beheerder:** "even weg" voor een ander lid.
  - **Wie de naam op een losse taak kiest:** wie hem aanmaakt (BR-20), en daarna iedereen via overnemen.
  - **Isolatie** (BR-26): afvinkers, beurten, afwezigheid en balans zijn nooit zichtbaar voor een ander huishouden, ook niet via een direct verzoek.
  - **Mag nooit:** iemand zet een afvinking op naam van een ander; iemand wijzigt de persoon bij een bestaande afvinking; een gezinslid zet "even weg" voor een ander; de app stuurt een melding "jij loopt achter".

- **BR-71 — Overgang van de live gegevens (aanvulling op BR-46).**
  1. **Eerst een back-up** zoals bij BR-46.1 (kopie in het eigen project, 30 dagen, restore-test).
  2. **Routines blijven** (op live 10), met ritme, duur en maker. Ze krijgen "op vaste dagen" en "om de beurt". Jurgen kiest zelf daarna per routine "na de vorige keer" waar hij dat wil (bijvoorbeeld bed verschonen); de bouwer noemt in het eindrapport welke routines daarvoor in aanmerking komen (ritme langzamer dan wekelijks).
  3. **Open toekomstige keren** van dezelfde routine worden opgeruimd tot alleen de eerstvolgende open keer over is (BR-60). **Blijven staan:** keren die zijn verplaatst of aangepast ("alleen deze"), keren met een notitie, keren op "bezig", en alle afvaltaken (§14). Opgeruimde keren komen niet in de historie en tellen niet als vergeten.
  4. **Vlak vóór het opruimen** ziet Jurgen de aantallen (opnieuw geteld) en geeft hij uitdrukkelijk bevestiging, zoals bij BR-46.2. Zonder bevestiging wordt niets opgeruimd.
  5. **Historie blijft** onaangetast (op live 8 afvinkingen), zonder persoon (BR-65; V-64).
  6. **Meldingsvoorkeuren** worden omgezet volgens BR-69; bestaande meldingen blijven.
  7. **Beurten starten** bij de eerstvolgende keer van elke routine volgens BR-64 stap 4, zodra er twee actieve beurtdeelnemers zijn.
  8. **Terugweg:** nieuwe gegevens komen er alleen bij; het opruimen van open toekomstige keren is het enige onomkeerbare deel en valt onder de back-up.
  - — waarom: het opruimen raakt gegevens van het gezin, ook al is het "alleen planning". Dezelfde zorgvuldigheid als bij BR-46.

### 15.5 Gegevens (aanvulling op §8)

| Gegeven | Waarom nodig | Bron | Persoonsgegeven | Bewaren tot |
| --- | --- | --- | --- | --- |
| Herhaalwijze van een routine ("vaste dagen" of "X na de vorige keer") | BR-62 | Maker | Nee | Als de routine |
| Verdeling van een routine (om de beurt, altijd <lid>, samen) | BR-64 | Maker | Indirect (verwijst naar een lid) | Als de routine |
| Naam op een keer, met reden (beurt, altijd, overgenomen, even weg) | Tonen wie aan de beurt is, dagmoment, uitleg in het detail | Systeem en overnemen | Ja (verwijst naar een lid) | Als de taak; na afvinken blijft alleen de afvinker (BR-65) |
| Wie afvinkte | Beurt en balans | Afvinken (door de database gezet) | Ja | 90 dagen na de afvinking, daarna losgekoppeld (`[OPEN: V-65]`); de afvinking zelf 2 jaar (BR-45) |
| "Even weg"-periodes (lid, van, t/m) | Beurten en balans (BR-68) | Het lid of een beheerder | Ja: afwezigheid van het gezin (met minderjarigen) is gevoelig; daarom alleen binnen het huishouden zichtbaar, nooit in meldingen, geen reden of bestemming | 35 dagen na de einddatum |
| Meldingsvoorkeur "dagmoment" (tijd of uit) | BR-69 | Lid | Ja | Als de andere voorkeuren |
| Melding "overgenomen" | BR-66 | Systeem | Ja (ontvanger; noemt een naam) | 90 dagen (BR-45) |

- **Bewust niet opgeslagen:** punten, scores of ranglijsten; een telling per persoon per week; wie op "bezig" drukte; wie overnam (alleen de huidige naam en de reden); voorkeuren of beschikbaarheid per weekdag; de reden van een afwezigheid; wie een afwezigheid invoerde.
- **Berekend, niet opgeslagen:** de balans (BR-67) en "wie is aan de beurt" worden uit de afvinkingen afgeleid; alleen de naam op de open keer wordt bewaard.
- **Verwijderen:** bij het verwijderen van een lid of account worden zijn afvinkingen "onbekend" en zijn afwezigheden gewist; bij het verwijderen van het huishouden verdwijnt alles.
- **Externe partijen:** ongewijzigd. Namen van leden gaan alleen via de bestaande, versleutelde pushmeldingen naar Apple en Google (zoals nu al bij notities).
- **Wijziging in §8, rij "Afvinkhistorie":** "zonder persoon" wordt "met de afvinker, 90 dagen (BR-65)"; en in "Bewust niet opgeslagen" vervallen de bullets "wie een taak afvinkte (V-21)", "toewijzingen en toewijzingshistorie" en "afwezigheid (V-24)" (zie P11).

### 15.6 Afhankelijkheden (aanvulling op §9)

| Afhankelijkheid | Waarvoor | Risico |
| --- | --- | --- |
| Ellen gebruikt de app (fase A2; S1 in de review) | Beurten en balans hebben twee beurtdeelnemers nodig | Zonder Ellen toont de app geen namen en geen balans (BR-64). Geen bouwwerk; Jurgen nodigt haar uit |
| Afvalkalender live (K-3) | Afvaltaken tellen mee in balans en dagmoment | Geen; W-04 raakt §14 niet |
| Nieuwe schermen WP4–WP9 (K-4) | Alle schermwijzigingen uit review §7 | De UX_SPEC moet worden aangepast vóór het bouwen; anders worden schermen twee keer gebouwd |

### 15.7 Bewust niet (W-04)

- **Workflows** (was starten → ophangen → opvouwen): veel bouwwerk voor weinig winst in een huishouden van twee; de stappen passen in de omschrijving van één taak.
- **"Geef me een taak":** met 5 tot 8 taken op Vandaag zie je zelf wat moet; de volgorde van Vandaag ís de logische volgende taak.
- **Instellingen voor automatisch verdelen, balanceren of herplannen:** precies het beheerwerk dat we schrappen; één goede standaard, per routine te corrigeren (principe 7).
- **"Drukke week"** (niet-kritieke taken verschuiven): vaag en onvoorspelbaar; pauzeren, "morgen" en "deze keer overslaan" dekken het.
- **Kamers** in de onboarding of als indeling: een extra scherm zonder beslissing die het mogelijk maakt.
- **Punten, badges, streaks, ranglijsten, een telling "wie deed meer" per week, kleuren voor "achter":** besluit van Jurgen (V-21, dat deel blijft) en principe 6.
- **AI-chat of een AI-dienst:** kosten, privacy (gezinsgegevens naar buiten) en geen enkele flow die erom vraagt.
- **Automatisch een nieuw moment kiezen** voor een gemiste taak: onvoorspelbaar; "Morgen" in één tik is genoeg.
- **Vijf verdeelstrategieën, voorkeuren en beschikbaarheid per dag:** niemand snapt dan meer waarom hij iets krijgt (review §2.1.2).
- **Een aparte "inspanning" naast duur:** één getal is genoeg; duur bestaat al.
- **Kalendergroepering als eigen functie:** met één keer per routine is de kalender al rustig.
- **Namens een ander afvinken:** `[OPEN: V-66]`; voorstel nee, want overnemen + zelf afvinken dekt het en houdt de registratie eerlijk.
- **Later, pas na 4 tot 6 weken gebruik (review fase E):** onderhoud in de bibliotheek (E1), knoppen "Gedaan · Morgen" in de pushmelding (D2), de leerregel "4 keer overgeslagen, minder vaak?" (E2), "ik heb even tijd" (E3), slimme invoer "over 3 maanden". Ze staan niet in W-04.

### 15.8 Succescriteria (aanvulling op §11; zie P17)

Drie maanden na de livegang van W-04, gemeten door de bouwer op dag 30 en dag 90 met alleen-lezen queries, resultaat in `docs/PROGRESS.md`:
1. **Rust:** bij 10 actieve routines staan er op elk moment hooguit 12 open uitvoeringen van routines (BR-60).
2. **Balans:** in de laatste 4 weken van de meetperiode ligt het verschil tussen Ellen en Jurgen onder 20% (BR-67), zonder dat een van beiden dat "handmatig" hoefde te sturen.
3. **Beiden actief:** in de laatste 4 weken vinken Ellen én Jurgen elk op minstens 4 van de 7 dagen per week iets af. Dit vervangt voor W-04 de zin in §11.3 dat per persoon meten "niet kan en mag".
4. **Niets verdwijnt stil:** geen enkele langzame routine (BR-61) is in de periode automatisch overgeslagen; elke gemiste badkamer is door iemand gedaan of bewust overgeslagen.
5. **Ervaren:** Ellen en Jurgen geven na drie maanden aan dat de naam bij de taak helpt en niet als controle voelt. Dat is een gesprek, geen meting.

**P2. §0 "Scopewijziging in ronde 2": zet direct onder de kop, vóór "**Kern van het besluit**", dit blok:**
> **Herzien in W-04 (K-1, 2026-09-29).** Jurgen heeft het besluit V-21 voor W-04 teruggedraaid: de app zegt weer wie aan de beurt is en onthoudt wie afvinkte, in de eenvoudige vorm "om de beurt + overnemen in één tik" (§15). De tekst hieronder blijft staan als geschiedenis van WP1–WP3 (de gegevens zijn op 2026-09-29 volgens BR-46 gewist). Per rij van de tabel geldt nu:
>
> | Rij in de tabel | Stand na W-04 |
> | --- | --- |
> | Toewijzen aan een persoon ("Wie?") | **Komt terug**, als "Wie?" = Om de beurt · Altijd <naam> · Samen (BR-64). Slimme invoer herkent voornamen weer |
> | Automatische verdeling en taakbelasting | **Alleen "om de beurt"** met een 4-wekenbalans (BR-64, BR-67). Geen vast/willekeurig/eerlijk-algoritme, geen taakbelasting |
> | Ruilen en ruilverzoeken | **Blijft vervallen.** In plaats daarvan overnemen in één tik, zonder verzoek (BR-66) |
> | Punten, spaardoel, "Samen sparen" | **Blijft vervallen.** Duur wordt wel gewicht voor de balans (BR-67) |
> | Registratie van wie afvinkte, "namens een ander" | **Wie afvinkte komt terug** (BR-65); "namens een ander" blijft vervallen (V-66) |
> | Statistieken per persoon | **Alleen de balansregel** over 4 weken (BR-67); geen andere cijfers per persoon |
> | "Mijn taken" tegenover "Iedereen" | **Blijft vervallen:** één lijst, met namen bij de taken |
> | Filter per persoon | **Blijft vervallen** |
> | Melding "Nieuwe taak voor jou", ruilmeldingen | **Blijft vervallen;** nieuw is alleen "overgenomen" (BR-66) |
> | Dag- en avondoverzicht | **Vervangen door één dagmoment per persoon** met "voor jou" (BR-69) |
> | Lid zonder account | **Blijft vervallen** |
> | Afwezigheid | **Komt terug als "even weg"**, alleen voor beurten en balans, zonder opnieuw verdelen, doorschuiven of vrijgeven (BR-68) |
> | Uitnodiging aan een lid zonder account | **Blijft vervallen** |
> | Instelling "Gezinsleden mogen aan anderen toewijzen" | **Blijft vervallen:** een naam op een losse taak kiest wie hem maakt; overnemen mag iedereen (BR-70) |
>
> De alinea "Wat 'niet bijhouden wie' wel en niet betekent" geldt nog voor de maker (V-25), de schrijver van een notitie (V-34) en boodschappen (V-25); voor afvinken geldt BR-65.

**P3. §1 "Probleem": vervang de bullet "**Hoe de app dat oplost (V-19, V-21):** …" door:**
> - **Hoe de app dat oplost (V-19, K-1):** door zichtbaar te maken **wat er moet gebeuren, vóór wanneer, en wie aan de beurt is**, en te onthouden wie het deed. De app verdeelt niet slim: elke routine gaat om de beurt (of altijd dezelfde, of samen), en iedereen kan met één tik overnemen (§15). Daardoor:
>   - hoeft niemand alles te onthouden;
>   - is elke taak van iemand, en dus niet van niemand;
>   - is minder discussie nodig over wie wat "had moeten doen", omdat de app rustig laat zien of het over 4 weken ongeveer in balans was.

**P4. §2 Gebruikers, rij "Lynn (15) en Kai (13)": voeg aan "Doel" toe:**
> ; kunnen een routine "Altijd <naam>" krijgen (K-2). Of zij in beurten en balans meetellen: `[OPEN: V-60]`

**P5. §4, UC-03, laatste bullet "**Slimme invoer met een naam van een persoon** …": vervang door:**
> - **Slimme invoer met een voornaam** ("Badkamer zaterdag Ellen"): het woord wordt weer herkend als naam op de taak (BR-64), alleen als het een actief lid is. Anders blijft het deel van de naam.

**P6. §4, UC-06 "Overzicht huishouden": vervang "**Wat er niet in staat:** statistieken per persoon, punten en spaardoel (vervallen, §0)." door:**
> - **Per persoon staat er alleen de balansregel** over 4 weken (BR-67). Geen andere cijfers per persoon, geen punten, geen spaardoel (§0, §15).

**P7. §4, UC-08 "Meldingen": vervang de lijst "Soorten" door:**
> - **Soorten:** herinnering (alleen taken met een tijdstip), deadline nadert (idem), taak gedaan (met naam), overgenomen, dagmoment (BR-69), en de storingsmelding van de afvalkalender (BR-52).

**P8. §5: zet deze notities bij de bestaande regels:**
- na BR-02, als laatste zin: *(sinds W-04 geldt voor routines BR-60: alleen de eerstvolgende keer; BR-02 blijft alleen voor afvaltaken via BR-50)*
- na BR-16, als laatste zin: *(sinds W-04 vervangen door BR-61: alleen bij een snel ritme)*
- BR-12, vervang de subbullet "**Wat de app nooit vastlegt:** wie afvinkte (V-21)." en haar sub-subbullets door: "**Wie afvinkte wordt vastgelegd** (K-1, BR-65), 90 dagen. De eigen logregels van de app bevatten nog steeds geen persoon; de platformlogs (Supabase, Vercel) blijven zoals hieronder beschreven:" en laat de tekst over de platformlogs staan.
- BR-13, vervang "Terugdraaien verwijdert de registratie in de historie en zet de taak weer open." door "Terugdraaien verwijdert de registratie in de historie, inclusief de afvinker, en zet de taak weer open met de naam van vóór het afvinken (BR-65)."
- BR-31, "Taak gedaan": vervang "**zonder naam**" door "met de naam van de afvinker (K-1)"; de ontvangersregel (V-38) blijft.
- BR-31, "Dagoverzicht" en "Avondoverzicht": vervang beide bullets door: "**Dagmoment** (per persoon één vaste tijd, standaard `[OPEN: V-62]`): 'Nog open voor jou: …', alleen als er iets open is (BR-69)."
- BR-31, "Herinnering", "Deadline nadert", "Verlopen": zet erachter *(sinds W-04 alleen voor taken met een tijdstip; "verlopen" vervalt; BR-69)*.
- BR-31, "Gevolg van V-21": vervang door "**Gevolg van K-1:** de enige persoonsgebonden meldingen zijn 'overgenomen' (BR-66) en het dagmoment (BR-69). Er is geen 'Nieuwe taak voor jou' en geen 'jij loopt achter'."
- BR-45, tabel: twee rijen erbij: "| Wie afvinkte (persoon bij de historie) | 90 dagen (`[OPEN: V-65]`) |" en "| 'Even weg'-periodes | 35 dagen na de einddatum |"; en vervang de zin "De termijn voor afwezigheid uit V-18 vervalt, omdat afwezigheid zelf vervalt (V-24)." door "Afwezigheid is in W-04 terug als 'even weg' (BR-68)."
- §5 "Overig", onderaan een regel erbij: "- **BR-60 t/m BR-71 — Huishoud-assistent:** zie §15 (W-04)."

**P9. §6 Randgevallen: deze rijen onderaan de tabel erbij:**

| Geval | Bedoeld gedrag |
| --- | --- |
| Dagelijkse routine, gisteren niet gedaan | Gisteren is vanzelf overgeslagen (vergeten); alleen vandaag staat er (BR-61) |
| Wekelijkse routine, zaterdag niet gedaan | Blijft staan als "nog open sinds za"; de volgende zaterdag wordt pas gepland na afvinken of overslaan (BR-61). Gedaan op dinsdag → volgende zaterdag (BR-60) |
| Langzame routine drie weken niet gedaan | Blijft één keer staan; er komen geen drie keren bij (BR-60, BR-61) |
| Routine gedaan vóór de geplande dag | Telt als die keer; de volgende komt ná de geplande dag (BR-60) |
| "3 maanden na de vorige keer", afgevinkt op 31 januari | Volgende op 30 april (maandeinde-regel, §13) |
| "Na de vorige keer" en de datum valt in een pauze | Eerste dag na de pauze (BR-62) |
| Overslaan bij "na de vorige keer" | `[OPEN: V-63]`; voorstel: telt als gedaan voor het ritme |
| "Dit weekend" gekozen op zondag | Venster is alleen zondag (BR-63) |
| Om de beurt, nog nooit afgevinkt | Wie het langst geen beurt had, anders het oudste lid (BR-64) |
| Om de beurt, vorige keer overgeslagen of vervallen | De laatst bekende afvinker telt; is er geen, dan als hierboven (BR-64) |
| Om de beurt, balans ≥ 20% uit elkaar | Wie minder deed krijgt de beurt, ongeacht wie de vorige deed; het detail zegt waarom (BR-64, BR-67) |
| Maar één actieve beurtdeelnemer | Geen namen bij "om de beurt", geen balans (BR-64) |
| "Altijd Lynn" en Lynn wordt uitgezet | De routine valt terug op "om de beurt"; niets verdwijnt (BR-64) |
| Overnemen van een taak die al bij jou staat | Niets gebeurt, geen melding (BR-66) |
| Twee mensen nemen tegelijk over | De laatste actie geldt; hooguit één melding per ontvanger (BR-66) |
| Overnemen en daarna terugdraaien van een afvinking | De taak staat weer open bij de naam van vóór het afvinken (BR-65) |
| Ellen neemt over en Jurgen vinkt af | De afvinking staat op Jurgen; de balans telt bij Jurgen; de volgende beurt is voor Ellen (BR-64, BR-65) |
| Afvinker verwijdert zijn account | Zijn afvinkingen worden "onbekend"; de balans telt ze niet meer (BR-65) |
| Even weg: beide beurtdeelnemers tegelijk | Keren zonder naam ("wie tijd heeft"); advies: pauzeren (BR-68) |
| Even weg ingevoerd terwijl er al keren op jouw naam staan | Die keren in de periode gaan naar de ander, behalve bewust overgenomen keren (BR-68) |
| Even weg wordt ingekort | De vrijgekomen dagen worden opnieuw toebedeeld (BR-68) |
| Balans met minder dan 4 weken gegevens | "Nog weinig gegevens" (BR-67) |
| Taak zonder duur | Telt als 15 minuten (BR-67) |
| Dagmoment, niets open | Geen melding (BR-69) |
| Dagmoment valt samen met een herinnering | Beide komen; hooguit 2 per normale dag (BR-69) |
| Migratie: open toekomstige keer met notitie of "bezig" | Blijft staan (BR-71) |
| Migratie: 14 open keren "Vaatwasser inruimen" | Alleen de eerstvolgende blijft; de andere 13 verdwijnen zonder historie (BR-71), na back-up en bevestiging |

**P10. §7 Rollen en rechten: deze rijen onderaan de tabel erbij:**

| Actie | Beheerder | Gezinslid |
| --- | --- | --- |
| Verdeling (om de beurt / altijd / samen) en herhaalwijze van een routine wijzigen | Ja | Alleen zelf gemaakt (BR-22) |
| Naam op een losse taak kiezen bij aanmaken | Ja | Als hij mag aanmaken (BR-20) |
| Een taak overnemen of aan een ander geven (deze keer) | Ja | Ja (BR-66) |
| Zien wie een taak deed, en de balansregel | Ja | Ja |
| "Even weg" voor zichzelf | Ja | Ja |
| "Even weg" voor een ander lid | Ja | Nee (BR-68) |
| Een afvinking op naam van een ander zetten, of de afvinker wijzigen | Nee | Nee (BR-65) |

**P10b. §7 "Mag nooit": vervang "de app legt vast wie een taak gedaan heeft." door:**
> - de app toont wie iets deed als score, ranglijst of "wie loopt achter";
> - iemand zet een afvinking op naam van een ander, of wijzigt de afvinker;
> - een gezinslid zet "even weg" voor een ander.

**P10c. §7 "Isolatie", tweede bullet: voeg toe aan het eind:** "Afvinkers, beurten, afwezigheden en de balans zijn binnen het huishouden voor iedereen zichtbaar, en buiten het huishouden voor niemand (BR-70)."

**P11. §8 Gegevens:**
- de rijen uit §15.5 onderaan de tabel erbij;
- rij "Afvinkhistorie": vervang "**zonder persoon**" door "**met de afvinker** (BR-65)", en in de kolom Persoonsgegeven "Nee (alleen de vrije notitie …)" door "Ja, 90 dagen; daarna alleen de vrije notitie";
- "Bewust niet opgeslagen": verwijder "wie een taak afvinkte (V-21);", "toewijzingen en toewijzingshistorie;" en "afwezigheid (V-24);"; laat "punten en taakbelasting;" en "ruilverzoeken;" staan; voeg de bullets uit §15.5 "Bewust niet opgeslagen" toe.

**P12. §9 Afhankelijkheden: de rijen uit §15.6 onderaan de tabel erbij.**

**P13. §10 Bewust niet: vervang de eerste twee bullets ("Taken aan personen toewijzen, …" en "Bijhouden wie iets gedaan heeft, …") door:**
> - **Slim automatisch verdelen, ruilen met verzoek en accepteren, taakbelasting:** de app doet alleen "om de beurt" met overnemen in één tik (K-1, §15). Alles wat slimmer is, snapt niemand meer.
> - **Ranglijsten, punten, spaardoel, tellingen per persoon:** besluit van Jurgen (V-21, dat deel blijft; K-1). De balans is één rustige regel over 4 weken (BR-67), geen scorebord.

**P14. §10: onderaan de bullets uit §15.7 erbij (zonder de laatste bullet "Later").**

**P15. §11 Succescriteria:**
- punt 3: vervang "Dit is gemeten voor het huishouden als geheel; per persoon kan en mag het niet (V-21)." door "Sinds W-04 ook per beurtdeelnemer: zie W-04 punt 3."
- punt 4: vervang door "**Ervaren eerlijkheid:** Ellen en Jurgen geven na drie maanden aan dat er minder discussie is over wie wat doet. De balansregel (BR-67) is daarbij een hulpmiddel in het gesprek, geen meting van 'eerlijk'."
- punt 7: vervang door "**Privacy klopt:** de database bevat per afvinking hooguit de afvinker, door de database zelf gezet, niet te vervalsen, en na 90 dagen losgekoppeld (BR-65). Er is geen kolom, telling of melding waaruit een ranglijst of 'wie loopt achter' te maken is. De toegangslogs van de platforms vallen erbuiten (BR-12)."
- onderaan: het blok uit §15.8 als "**Huishoud-assistent (W-04).**".

**P16. §12: vervang de kop door "## 12. Verwerkte antwoorden (V-04, V-05 t/m V-27, V-41 t/m V-58, K-1 t/m K-4)", en zet deze rijen onderaan de tabel:**

| Vraag | Antwoord (zie `docs/PROGRESS.md`) | Verwerkt in |
| --- | --- | --- |
| K-1 | Ja: om de beurt, onthouden wie afvinkte, overnemen in één tik; vervangt V-21 en de betreffende delen van V-19 en V-22 | §0 (P2), §1, §15, BR-64 t/m BR-70 |
| K-2 | Basis voor twee, optioneel voor vier; kinderen doen een stuk minder | §2, §15.1, BR-64 ("Altijd <naam>"), V-60 |
| K-3 | Eerst de afvalkalender (WP3b) live | §15.6 |
| K-4 | Het nieuwe schermontwerp wordt vóór het bouwen aangepast | §15.6; UX_SPEC |

**P17. §13 Aannames en open vragen: vervang "**Open vragen:** geen." door:**
> **Open vragen (W-04):** V-60 (kinderen in beurt en balans), V-61 (Ellen draagt K-1 mee), V-62 (dagmoment: tijd, en vervangt hij beide overzichten), V-63 (overslaan bij "na de vorige keer"), V-64 (de 8 bestaande afvinkingen), V-65 (bewaartermijn afvinker 90 dagen), V-66 (namens een ander afvinken). Zie `docs/PROGRESS.md`.
> Aanvullende aanname (W-04): `[AANNAME]` "±duur" in de lijst en het gewicht in de balans gebruiken hetzelfde veld "duur" dat al op de bibliotheektaken staat; er wordt geen nieuwe schatting ingevoerd. Zonder invloed op rechten, gegevens of scope.

**P18. §14: geen wijziging.** W-04 raakt de afvalkalender niet; afvaltaken tellen alleen mee in balans en dagmoment (BR-67, BR-69).

=== ACCEPTANCE_CRITERIA.md ===

**A1. "Bronnen": vervang de rij `docs/PROGRESS.md` door:**

| Document | Wat eruit komt |
| --- | --- |
| `docs/PROGRESS.md` | Besluiten van Jurgen V-05 t/m V-39, V-41 t/m V-58 (W-03) en K-1 t/m K-4 (W-04) |

**A2. "Afspraken": onderaan, vóór de `---`, een punt erbij:**
> - **W-04 — huishoud-assistent.**
>   - De criteria zijn AC-238 t/m AC-284. Ze staan in één sectie "W-04" direct na WP3b; de solution-architect verdeelt ze over de work packages van W-04 (review §10, S3 t/m S9) en zet het WP-nummer erbij. Tot dan staat er "W-04".
>   - Ze volgen PRODUCT_SPEC §15 (BR-60 t/m BR-71), de aangepaste UX_SPEC (K-4) en de antwoorden K-1 t/m K-4.
>   - **Beurtdeelnemers** in de voorbeelddata: Jurgen en Ellen. Lynn is gezinslid en geen beurtdeelnemer (tot V-60 anders zegt). Bas blijft de buitenstaander.
>   - "Snel ritme" en "langzaam ritme" zijn gedefinieerd in BR-61. "Vaste `now`" betekent dat de test de klok zet.
>   - **Vervallen door K-1:** AC-034, AC-035 (het schemadeel), AC-045 (het deel "afwezigheid" en "Wie?"), AC-074 en AC-111 gelden niet meer als eis; ze worden vervangen door AC-262, AC-263, AC-272 en AC-283. Ze blijven in het document met de notitie *(vervallen door W-04, K-1; zie AC-…)* zodat de tests van WP1–WP3 na te lezen blijven. AC-073 blijft, met naam in de tekst (AC-275).
>   - **Aangepast door W-04:** AC-044 en AC-066 (BR-02 → BR-60: zie AC-238, AC-239), AC-068 (BR-16 → BR-61: zie AC-244, AC-245), AC-072 (overzichten → dagmoment: zie AC-273), AC-092, AC-105, AC-115, AC-126, AC-144, AC-161 (schermen: de product-designer en de architect noemen bij het aanpassen van UX_SPEC en TD welke DAN-regels veranderen; de nummers blijven).

**A3. Nieuwe sectie direct na de sectie "## WP3b — Afvalkalender (W-03)" (na AC-237 en de `---`), gevolgd door `---`:**

## W-04 — Huishoud-assistent

### AC-238 — Eén open keer per routine (W-04; BR-60; vervangt AC-066)
GEGEVEN een dagelijkse routine, een wekelijkse routine (zaterdag), een maandelijkse routine en een routine "2 weken na de vorige keer", allemaal zonder open keren, en een vaste `now` van maandag 5 oktober 2026 09:00
WANNEER de planner draait, en daarna nog twee keer op dezelfde en op een latere `now`
DAN:
- heeft elke routine precies **één** open uitvoering: ma 5 okt, za 10 okt, de eerstvolgende maanddatum, en voor "na de vorige keer" de startdatum die bij het aanmaken is gekozen;
- bestaat er per routine geen tweede open uitvoering, ook niet na de extra rondes (per routine en reeksdatum nooit twee);
- staan er voor de wekelijkse routine in de Kalender wél projecties voor 17 en 24 oktober (planning), zonder dat er taken voor bestaan.
**Toets:** Unit (planner) + Int

### AC-239 — De volgende keer ontstaat direct na afvinken (W-04; BR-60; UC-16; vervangt AC-044)
GEGEVEN een dagelijkse routine met alleen de keer van vandaag open
WANNEER Ellen die afvinkt, (a) online en (b) offline met verwerking van de wachtrij daarna
DAN:
- is de keer van vandaag gedaan en bestaat er direct één open keer voor morgen;
- maakt een tweede afvinkpoging met dezelfde `mutationId` geen extra keer;
- ontstaat er bij (b) ook zonder open app binnen 15 minuten een keer voor morgen via de achtergrondtaak, en ook dan maar één.
**Toets:** DB + Int

### AC-240 — Datum van de volgende keer bij "op vaste dagen" (W-04; BR-60)
GEGEVEN een wekelijkse routine op zaterdag
WANNEER de keer van za 26 sep (a) op di 29 sep wordt afgevinkt, (b) op do 24 sep wordt afgevinkt, (c) op za 3 okt wordt afgevinkt
DAN is de volgende open keer bij (a) za 3 okt, bij (b) za 3 okt, bij (c) za 10 okt
**Toets:** Unit

### AC-241 — Een verplaatste keer blijft de eerstvolgende (W-04; BR-60, BR-08)
GEGEVEN een wekelijkse routine (zaterdag) waarvan de keer van za 10 okt met "alleen deze" naar ma 12 okt is verplaatst
WANNEER de planner draait op vr 9, za 10 en zo 11 okt
DAN bestaat er alleen die ene open keer (ma 12 okt, met reeksdatum 10 okt), komt er geen tweede keer voor 10 okt, en ontstaat de keer van za 17 okt pas nadat die van 12 okt is afgehandeld
**Toets:** Unit + Int

### AC-242 — Herinnering vooruit blijft werken (W-04; BR-60, BR-31)
GEGEVEN een routine "elke 2 weken op zondag" met een herinnering 2 dagen vooraf en een tijdstip 10:00, en de keer van zo 4 okt is op za 3 okt afgevinkt
WANNEER de tick draait op vr 16 okt 10:00
DAN bestaat de keer van zo 18 okt en is de herinnering voor die keer verstuurd, precies één keer
**Toets:** Int

### AC-243 — Overgang: opruimen tot de eerstvolgende (W-04; BR-71)
GEGEVEN de live-situatie nagebootst: een routine "Vaatwasser inruimen" met 15 open keren, waarvan één met een notitie en één op "bezig", een routine "Badkamer" met 2 open keren waarvan de eerste verplaatst is, 8 afvinkingen zonder persoon, en 4 open afvaltaken
WANNEER het draaiboek van W-04 wordt uitgevoerd
DAN:
- is eerst een back-up gemaakt en getest (zoals AC-056 en AC-057);
- zijn de aantallen die verdwijnen direct vóór de vraag geteld en aan Jurgen getoond, en is zonder zijn bevestiging niets opgeruimd (zoals AC-058);
- blijven van "Vaatwasser inruimen" over: de eerstvolgende open keer, de keer met de notitie en de keer op "bezig" (3); de andere 12 zijn weg zonder historie en tellen niet als vergeten;
- blijven van "Badkamer" beide keren (de verplaatste en de eerstvolgende) staan;
- zijn de 8 afvinkingen ongewijzigd, zonder persoon;
- zijn de 4 afvaltaken ongewijzigd;
- staan alle routines op "op vaste dagen" en "om de beurt".
**Toets:** DB + Proces

### AC-244 — Gemiste snelle keer vervalt (W-04; BR-61; vervangt AC-068)
GEGEVEN een dagelijkse routine en een routine "ma, wo, vr", beide met de keer van gisteren open en niet gedaan
WANNEER de dag van de volgende reeksdatum aanbreekt en de tick draait
DAN krijgt de keer van gisteren de status "overgeslagen" (telt als vergeten in het Overzicht) en bestaat er één open keer voor de nieuwe datum
**Toets:** Unit + Int

### AC-245 — Gemiste langzame keer blijft staan (W-04; BR-61; UC-17)
GEGEVEN een wekelijkse routine (zaterdag) waarvan de keer van za 26 sep niet gedaan is, en een routine "3 maanden na de vorige keer" met een keer van 1 sep
WANNEER de tick draait op za 3 okt, zo 11 okt en za 17 okt
DAN:
- blijven beide keren open, met "nog open sinds za 26 sep" respectievelijk "sinds 1 sep" in de lijst, zonder alarmkleur;
- worden ze nergens automatisch overgeslagen;
- bestaat er voor geen van beide routines een tweede open keer;
- staan ze in de historie als "te laat" zodra ze alsnog worden afgevinkt, en als "vergeten" bij bewust overslaan.
**Toets:** Unit + Int + E2E (weergave)

### AC-246 — Overslaan van een langzame keer plant de volgende (W-04; BR-61, BR-60)
GEGEVEN de open keer van za 26 sep uit AC-245 (wekelijks)
WANNEER Jurgen op di 29 sep "Deze keer overslaan" kiest
DAN is die keer "overgeslagen" (vergeten), bestaat er direct één open keer voor za 3 okt, en maakt een tweede tik niets extra
**Toets:** Int

### AC-247 — Ritme wijzigen past de regel direct toe (W-04; BR-61)
GEGEVEN een dagelijkse routine met een verlopen keer van gisteren die nog niet is overgeslagen (tick nog niet gedraaid)
WANNEER de maker het ritme wijzigt naar wekelijks ("deze en volgende")
DAN blijft de keer van gisteren open (langzaam ritme) en wordt hij bij de volgende tick niet meer automatisch overgeslagen
**Toets:** Int

### AC-248 — "X na de vorige keer" rekent vanaf de dag van afvinken (W-04; BR-62; UC-18)
GEGEVEN een routine "3 maanden na de vorige keer" met een open keer op 15 januari, en een routine "2 weken na de vorige keer"
WANNEER de eerste op 20 januari wordt afgevinkt, en de tweede op 31 januari
DAN is de volgende keer 20 april respectievelijk 14 februari; en bij "1 maand na de vorige keer" afgevinkt op 31 januari is de volgende 28 februari (maandeinde)
**Toets:** Unit + Int

### AC-249 — Overslaan bij "na de vorige keer" (W-04; BR-62) `[OPEN: V-63]`
GEGEVEN een routine "3 maanden na de vorige keer" met een open keer op 15 januari
WANNEER Ellen op 20 januari "Deze keer overslaan" kiest
DAN is de keer overgeslagen (vergeten), en ligt de volgende keer op **20 april** *(voorstel; wordt de datum die Jurgen bij V-63 kiest)*, en niet op 15 april
**Toets:** Unit + Int

### AC-250 — "Na de vorige keer" en pauzeren (W-04; BR-62, BR-09)
GEGEVEN een routine "2 weken na de vorige keer" die gepauzeerd is van 1 t/m 14 november
WANNEER de open keer op 25 oktober wordt afgevinkt
DAN ligt de volgende keer op 15 november, en wordt hij niet in de pauze gepland
**Toets:** Unit

### AC-251 — Wisselen tussen de twee herhaalwijzen (W-04; BR-62, BR-08, BR-22)
GEGEVEN een wekelijkse routine (zaterdag) met een open keer op za 10 okt, en Jurgen als maker
WANNEER hij met "deze en volgende" kiest voor "1 week na de vorige keer", en de keer op ma 12 okt afvinkt
DAN houdt de keer van 10 okt zijn datum, en ligt de volgende op ma 19 okt. Probeert Lynn (geen maker) dezelfde wijziging, dan wordt dat geweigerd en verandert er niets
**Toets:** Int

### AC-252 — Slimme invoer kiest de herhaalwijze (W-04; BR-62; UC-18; interpretatie 4)
GEGEVEN het invoerveld voor een nieuwe taak
WANNEER Jurgen typt (a) "afzuigkapfilter elke 3 maanden", (b) "bed verschonen elke 2 weken", (c) "vaatwasser dagelijks", (d) "badkamer elke zaterdag"
DAN toont de uitleg onder het veld bij (a) en (b) "… na de vorige keer" en bij (c) en (d) "op vaste dagen", herkent (a) de bibliotheektaak met duur, en staat elke nieuwe routine op "om de beurt". De gebruiker kan de wijze vóór Toevoegen nog omzetten
**Toets:** Unit (parser) + E2E

### AC-253 — "Wanneer?" als venster (W-04; BR-63; UC-18)
GEGEVEN het is donderdag 8 oktober 2026
WANNEER Ellen "ramen" toevoegt met "dit weekend", en Jurgen "stofzuigen" met "deze week"
DAN:
- heeft "ramen" geplande dag za 10 okt, "mag al vanaf" za 10 okt en uiterlijk zo 11 okt einde van de dag; hij staat donderdag en vrijdag onder Binnenkort, vanaf zaterdag op Vandaag, en is maandag verlopen;
- heeft "stofzuigen" geplande dag do 8 okt en uiterlijk zo 11 okt einde van de dag, en staat vanaf nu op Vandaag;
- geeft "dit weekend" op zondag alleen zondag;
- vult de slimme invoer "ramen dit weekend" dezelfde velden;
- blijft de regel BR-18 gelden (AC-116).
**Toets:** Unit + Int + E2E

### AC-254 — "Wanneer?" op een dag en vóór een tijdstip (W-04; BR-63)
GEGEVEN het formulier
WANNEER Jurgen kiest (a) "Op een dag" vrijdag 18:00, (b) "Vóór een tijdstip" vrijdag 18:00, (c) "Op een dag" vrijdag zonder tijd
DAN is bij (a) de geplande dag vrijdag met tijd 18:00 en uiterlijk 18:00; bij (b) de geplande dag vandaag en uiterlijk vrijdag 18:00 (de taak staat vanaf vandaag op Vandaag); bij (c) uiterlijk het einde van vrijdag. Er zijn geen losse velden "mag al vanaf", "uiterlijk" en "tijd" meer boven "Meer"
**Toets:** Unit + E2E

### AC-255 — Om de beurt wisselt (W-04; BR-64; UC-16)
GEGEVEN Jurgen en Ellen als actieve beurtdeelnemers, een balans onder 20%, en een dagelijkse routine "om de beurt" waarvan de keer van vandaag op Jurgens naam staat
WANNEER Jurgen hem afvinkt, en de dag erna Ellen de nieuwe keer afvinkt, en zo vier dagen lang
DAN staan de opeenvolgende keren op Jurgen, Ellen, Jurgen, Ellen, Jurgen; en zegt het detail van elke keer "Om de beurt · vorige keer <naam> (<dag>)"
**Toets:** Unit (pure functie) + Int + E2E (detailregel)

### AC-256 — Om de beurt na overnemen (W-04; BR-64, BR-66; UC-19)
GEGEVEN de routine uit AC-255 met de keer van vandaag op Jurgens naam
WANNEER Ellen "Ik doe hem" tikt en daarna afvinkt
DAN staat de afvinking op Ellen, en staat de volgende keer op **Jurgen** (wie de vorige keer niet afvinkte). Vinkt daarentegen Jurgen af nadat Ellen had overgenomen, dan staat de afvinking op Jurgen en de volgende keer op Ellen
**Toets:** Unit + Int

### AC-257 — Om de beurt zonder bekende vorige afvinker (W-04; BR-64)
GEGEVEN een nieuwe routine "om de beurt" zonder enige afvinking, Jurgen (lid sinds 2025) en Ellen (lid sinds 2026), en (a) Ellen had de laatste beurt van een andere routine niet, want ze had nog nooit een beurt; (b) beide hebben nooit een beurt gehad
WANNEER de eerste keer ontstaat
DAN staat hij bij (a) op Ellen (langst geen beurt) en bij (b) op Jurgen (eerst lid geworden); en als de vorige keer van de routine "overgeslagen" was zonder persoon, telt de laatst bekende afvinker van die routine
**Toets:** Unit

### AC-258 — Balans stuurt de beurt bij 20% of meer (W-04; BR-64, BR-67)
GEGEVEN in de afgelopen 28 dagen: Ellen 240 minuten aan afvinkingen, Jurgen 160 minuten (verschil 33%), en een routine "om de beurt" waarvan Jurgen de vorige keer afvinkte
WANNEER de volgende keer ontstaat
DAN staat hij tóch op Jurgen, en zegt het detail "Om de beurt · Ellen deed de laatste weken meer". Zodra het verschil onder 20% komt, geldt weer de gewone afwisseling
**Toets:** Unit + Int

### AC-259 — Altijd <naam> en Samen (W-04; BR-64; K-2)
GEGEVEN een routine "Altijd Lynn" en een routine "Samen"
WANNEER de keren ontstaan, Lynn de eerste afvinkt en Jurgen de tweede
DAN staat elke keer van de eerste routine op Lynn met uitleg "Altijd Lynn", en heeft de tweede geen naam met uitleg "Samen"; de afvinking van Lynn telt niet in de balans van Ellen en Jurgen, en de "samen"-afvinking van Jurgen ook niet (BR-67)
**Toets:** Unit + Int

### AC-260 — Altijd <naam> als die persoon wegvalt (W-04; BR-64)
GEGEVEN de routine "Altijd Lynn" met een open keer op Lynn
WANNEER een beheerder Lynn uitzet
DAN valt de routine terug op "om de beurt", krijgt de open keer een beurtdeelnemer volgens BR-64, verdwijnt er niets, en toont Taken › Terugkerend "om de beurt"
**Toets:** Int

### AC-261 — Minder dan twee beurtdeelnemers (W-04; BR-64; §15.1)
GEGEVEN een huishouden waarin alleen Jurgen actief is (Ellen nog niet aangesloten, of uitgezet)
WANNEER routines "om de beurt" hun keren krijgen en het Overzicht wordt geopend
DAN staat er bij die keren geen naam ("wie tijd heeft"), is er geen balansregel, en begint de afwisseling bij de eerstvolgende nieuwe keer zodra Ellen actief lid is
**Toets:** Unit + Int + E2E

### AC-262 — Afvinken registreert de afvinker, door de database gezet (W-04; BR-65; vervangt AC-034)
GEGEVEN een open taak
WANNEER Ellen hem afvinkt, (a) gewoon en (b) met een verzoek waarin een andere persoon (Jurgen) wordt meegestuurd
DAN bevat de historie-rij in beide gevallen **Ellen** als afvinker, naast titel, categorie, `completed_at`, geplande dag, deadline, te laat, duur en notitie; het meegestuurde lid is genegeerd; de afvinker is daarna door niemand te wijzigen, ook niet door een beheerder of rechtstreeks op de tabel
**Toets:** DB + Int

### AC-263 — Terugdraaien verwijdert ook de afvinker en herstelt de naam (W-04; BR-65, BR-13)
GEGEVEN een keer die op Jurgens naam stond en door Ellen is afgevinkt
WANNEER Lynn (gezinslid) de afvinking terugdraait
DAN is de historie-rij inclusief afvinker weg, staat de taak weer open op **Jurgens** naam, en is de balans weer gelijk aan vóór het afvinken
**Toets:** DB + Int

### AC-264 — Bestaande afvinkingen zonder persoon (W-04; BR-65, BR-71) `[OPEN: V-64]`
GEGEVEN de 8 afvinkingen van vóór W-04
WANNEER de gedaan-lijst, het routinedetail en de balans worden bekeken
DAN tonen ze "onbekend" als afvinker, tellen ze niet mee in de balans, en bepalen ze geen beurt *(voorstel; V-64 kan dit veranderen)*
**Toets:** DB + Int

### AC-265 — Waar de afvinker wel en niet te zien is (W-04; BR-65; principe 6)
GEGEVEN een huishouden met afvinkingen van Ellen en Jurgen
WANNEER alle schermen worden doorlopen en alle leesverzoeken worden nagelopen
DAN staat de naam alleen in de gedaan-lijst en historie ("Ellen · 14:02"), in het routinedetail ("vorige keer Ellen") en samengeteld in de balansregel; er bestaat nergens een ranglijst, telling per persoon per week, "meest gedaan door", kleur of melding "jij loopt achter"
**Toets:** E2E + Vis + code-review

### AC-266 — Afvinker na 90 dagen losgekoppeld (W-04; BR-65, BR-45) `[OPEN: V-65]`
GEGEVEN afvinkingen van 89 en 91 dagen oud met een afvinker
WANNEER het opruimen draait
DAN heeft de afvinking van 91 dagen geen afvinker meer en die van 89 dagen wel; beide afvinkingen zelf bestaan nog
**Toets:** DB

### AC-267 — Afvinker verdwijnt met het lid (W-04; BR-65; V-15)
GEGEVEN afvinkingen van Ellen in de afgelopen 4 weken
WANNEER Ellen haar account verwijdert
DAN zijn haar afvinkingen "onbekend", telt de balans ze niet meer, zijn haar "even weg"-periodes weg, en blijven haar notities met naam staan (V-34)
**Toets:** DB + Int

### AC-268 — Overnemen in één tik, met melding (W-04; BR-66; UC-19; V-37)
GEGEVEN een open keer op Jurgens naam, en Ellen en Jurgen met push aan
WANNEER Ellen in het detail "Ik doe hem" tikt, en later bij een andere keer op haar naam "Aan Jurgen geven"
DAN:
- staat de keer na één tik op Ellen met uitleg "Overgenomen door Ellen"; de routine zelf is niet veranderd;
- krijgt Jurgen één melding "Ellen nam '<taak>' over", en bij de tweede actie één melding "Ellen gaf je '<taak>'"; Ellen krijgt geen melding;
- kost het vanaf Vandaag hooguit twee tikken (lang indrukken of detail + knop; V-37);
- verandert de balans niet.
**Toets:** Int + E2E

### AC-269 — Overnemen: dubbel, tegelijk, al gedaan, offline (W-04; BR-66, BR-10)
GEGEVEN een open keer op Jurgens naam
WANNEER (a) Ellen twee keer snel "Ik doe hem" tikt; (b) Ellen en Lynn tegelijk overnemen; (c) Ellen overneemt nadat Jurgen hem net heeft afgevinkt; (d) Ellen offline overneemt en later online komt
DAN staat bij (a) de keer op Ellen met één melding aan Jurgen; geldt bij (b) de laatste actie, met per ontvanger hooguit één melding; verandert bij (c) niets en ziet Ellen een nette melding; komt bij (d) de actie via de wachtrij precies één keer aan
**Toets:** DB + Int

### AC-270 — Overnemen mag iedereen, ook bij "Altijd" en "even weg" (W-04; BR-66, BR-70)
GEGEVEN een keer van "Altijd Jurgen", en Ellen die "even weg" is
WANNEER Lynn (gezinslid) "Ik doe hem" tikt op de eerste, en Ellen op een andere keer
DAN lukken beide voor deze keer alleen; de routine blijft "Altijd Jurgen", en Bas (ander huishouden) krijgt bij elk overnameverzoek een weigering zonder dat er iets verandert
**Toets:** DB + Int

### AC-271 — Balansregel: tekst per situatie (W-04; BR-67; UC-20)
GEGEVEN afvinkingen met afvinker in de afgelopen 28 dagen, en een vaste `now`
WANNEER het Overzicht wordt geopend met (a) Jurgen 180 min en Ellen 200 min; (b) Ellen 240 min en Jurgen 160 min; (c) W-04 minder dan 4 weken live, of minder dan 5 afvinkingen met persoon; (d) een afvinking van 29 dagen geleden erbij
DAN toont de regel bij (a) "Afgelopen 4 weken: Jurgen ± 3 u · Ellen ± 3 u 20 — ongeveer in balans"; bij (b) "… Ellen ± 4 u · Jurgen ± 2 u 40 — Ellen deed wat meer; de app geeft Jurgen de volgende beurten"; bij (c) de tekst "nog weinig gegevens"; en telt (d) niet mee. Er is geen grafiek, geen kleur en er ontstaat nooit een melding over de balans
**Toets:** Unit (pure functie) + E2E + Vis

### AC-272 — Gewicht van een afvinking (W-04; BR-67)
GEGEVEN afvinkingen van een taak met duur 30, een taak zonder duur, een afvaltaak, een "samen"-taak, een taak van Lynn, en een taak gepland op een dag waarop Ellen "even weg" was
WANNEER de balans wordt berekend
DAN telt de eerste 30 minuten, de tweede 15, de afvaltaak haar duur (of 15), en tellen de "samen"-taak, Lynns taak en de taak in de afwezigheid voor niemand mee
**Toets:** Unit

### AC-273 — Dagmoment (W-04; BR-69; UC-21; vervangt AC-072)
GEGEVEN Jurgen met dagmoment 19:30 en Ellen met dagmoment uit; open vandaag: "Badkamer" (Jurgen, sinds za), "Vaatwasser" (Ellen), "Boodschappen" (geen naam), en een afvaltaak buitenzetten
WANNEER de tick draait om 19:30, 19:45 en de volgende dag 19:30
DAN:
- krijgt Jurgen om 19:30 precies één melding "Nog open voor jou: Badkamer (sinds za), Boodschappen, <afvaltaak>", zonder "Vaatwasser";
- krijgt Ellen niets;
- komt om 19:45 geen tweede melding;
- krijgt Jurgen de volgende dag niets als er niets open is.
**Toets:** Unit + Int

### AC-274 — Herinneringen alleen bij een tijdstip; "verlopen" vervalt (W-04; BR-69; vervangt de delen van AC-070)
GEGEVEN een taak zonder tijdstip met deadline einde van de dag, een taak "vóór vrijdag 18:00" met herinnering 60 min vooraf, en een afvaltaak
WANNEER de tick draait rond alle momenten
DAN ontstaat voor de eerste taak geen herinnering, geen "deadline nadert" en geen "verlopen"; komt voor de tweede de herinnering en "deadline nadert" (binnen 120 min) en nooit "verlopen"; en gelden voor de afvaltaak AC-194 en AC-211 onveranderd
**Toets:** Unit + Int

### AC-275 — Meldingsvoorkeuren en hun overgang (W-04; BR-69, BR-31; V-23)
GEGEVEN Jurgen (beheerder, avondoverzicht aan), Ellen (beheerder, beide overzichten uit) en Lynn (gezinslid, alles uit) vóór W-04
WANNEER de overgang draait en daarna Instellingen › Meldingen wordt geopend
DAN:
- zijn er per persoon precies vier keuzes: push, dagmoment (tijd of uit), herinneringen (taken met tijdstip), "taak gedaan";
- heeft Jurgen dagmoment aan op de standaardtijd, Ellen dagmoment uit, Lynn alles uit;
- bestaan "deadline nadert", "verlopen", "dagoverzicht" en "avondoverzicht" niet meer als schakelaar;
- noemt "taak gedaan" de afvinker ("Ellen heeft '<taak>' gedaan") en blijven de ontvangers zoals AC-073 (ook de afvinker);
- krijgt niemand op een normale dag meer dan 2 meldingen.
**Toets:** DB (migratie) + Int + E2E

### AC-276 — Even weg: geen beurt bij de afwezige (W-04; BR-68; UC-20)
GEGEVEN Ellen "even weg" van do 8 t/m zo 11 okt, een dagelijkse routine "om de beurt" en een routine "Altijd Ellen" met een keer op za 10 okt
WANNEER de keren van 8 t/m 12 oktober ontstaan
DAN staat geen enkele keer van 8 t/m 11 okt op Ellen; staan die van de dagelijkse routine op Jurgen met uitleg "Ellen is even weg"; staat de "Altijd Ellen"-keer van 10 okt op Jurgen met dezelfde uitleg; en staat de keer van ma 12 okt volgens BR-64 stap 3 weer op Ellen
**Toets:** Unit + Int

### AC-277 — Even weg: bestaande keren, inkorten, balans (W-04; BR-68, BR-67)
GEGEVEN open keren op Ellens naam voor 9 en 10 okt, waarvan die van 10 okt door Ellen bewust is overgenomen
WANNEER een beheerder "Ellen even weg 8 t/m 11 okt" invoert, en daarna inkort tot 8 t/m 9 okt
DAN gaat de keer van 9 okt naar Jurgen en blijft die van 10 okt op Ellen; na het inkorten wordt 10 okt niet opnieuw toebedeeld (was overgenomen) en worden andere open keren op 10 en 11 okt wel opnieuw toebedeeld; afvinkingen van taken gepland op 8 en 9 okt tellen voor niemand in de balans
**Toets:** Unit + Int

### AC-278 — Even weg: rechten, zichtbaarheid en bewaren (W-04; BR-68, BR-70, BR-26)
GEGEVEN Lynn (gezinslid), Jurgen (beheerder), Ellen en Bas (ander huishouden)
WANNEER Lynn "even weg" voor zichzelf zet, Lynn het voor Jurgen probeert, Jurgen het voor Ellen zet, en Bas de periodes probeert te lezen of te schrijven
DAN lukt Lynns eigen periode, wordt Lynns poging voor Jurgen geweigerd zonder wijziging, lukt Jurgens actie, ziet Bas niets en kan hij niets schrijven; het hele eigen huishouden ziet de periodes bij de naam; de periode staat in geen enkele melding; en een periode is 35 dagen na de einddatum automatisch weg
**Toets:** DB + Int

### AC-279 — Beide beurtdeelnemers weg (W-04; BR-68)
GEGEVEN Ellen en Jurgen allebei "even weg" op 10 okt
WANNEER de keren van 10 okt ontstaan
DAN staan ze zonder naam ("wie tijd heeft"), zonder fout, en tellen afvinkingen van die dag voor niemand
**Toets:** Unit

### AC-280 — Verdeling wijzigen: alleen maker of beheerder (W-04; BR-70, BR-22)
GEGEVEN een routine gemaakt door Ellen
WANNEER Lynn de verdeling naar "Altijd Jurgen" probeert te zetten (via de interface en met een direct verzoek), en daarna Jurgen (beheerder)
DAN ziet Lynn de keuze niet en wordt haar verzoek geweigerd zonder wijziging; Jurgens wijziging lukt en de eerstvolgende nieuwe keer staat op Jurgen
**Toets:** DB + Int + E2E

### AC-281 — Isolatie van W-04-gegevens (W-04; BR-26, BR-70)
GEGEVEN Bas, lid van "Buren"
WANNEER hij met elk mogelijk verzoek afvinkers, namen op keren, afwezigheden, de balans of de verdeling van routines van Jurgens huishouden probeert te lezen of te schrijven
DAN krijgt hij niets terug en verandert er niets; en de balans van "Buren" bevat geen enkele afvinking van Jurgens huishouden
**Toets:** DB + Int

### AC-282 — Uitleg in het detail, altijd in één zin (W-04; BR-64, BR-66, BR-68; principe 4)
GEGEVEN keren met de redenen beurt (vorige keer bekend), beurt (balans), altijd, samen, overgenomen en even weg
WANNEER het taakdetail wordt geopend
DAN staat er precies één uitlegregel: "Om de beurt · vorige keer Ellen (za 26 sep)", "Om de beurt · Ellen deed de laatste weken meer", "Altijd Jurgen", "Samen", "Overgenomen door Ellen", "Jurgen is even weg" (letterlijke teksten volgens de aangepaste UX_SPEC), en nergens een getal of score
**Toets:** E2E + Vis

### AC-283 — Slimme invoer herkent een voornaam weer (W-04; BR-64; UC-18; vervangt AC-111)
GEGEVEN de leden Ellen, Jurgen en Lynn, en Kai uitgezet
WANNEER Jurgen typt (a) "badkamer zaterdag Ellen", (b) "gras elke week Lynn", (c) "kaarten Kai", (d) "bellen met Ellen over vakantie"
DAN wordt (a) een losse taak op Ellens naam; (b) een routine "Altijd Lynn"; blijft bij (c) "Kai" deel van de naam (geen actief lid); en wordt bij (d) "Ellen" alleen als naam herkend als het het laatste woord is, anders blijft de tekst heel. De uitlegregel onder het veld toont wat is herkend, en de gebruiker kan het vóór Toevoegen weghalen
**Toets:** Unit (parser) + E2E

### AC-284 — Rust op Vandaag bij 10 routines (W-04; BR-60; succescriterium W-04.1; B4)
GEGEVEN 10 actieve routines (6 dagelijks, 3 wekelijks, 1 maandelijks), waarvan 2 wekelijkse "nog open sinds", en 2 losse taken
WANNEER Vandaag en Taken › Open worden geopend op 390×844
DAN staan er hooguit 12 open uitvoeringen van routines, staat elke routine één keer, toont Binnenkort hooguit 3 rijen met "Kalender ›", en zijn "Nog open" en "Vandaag" zonder scrollen zichtbaar bij ~8 taken
**Toets:** Int (telling) + E2E + Vis

**A4. "Dekking" › "Harde regels": deze rijen onderaan de tabel erbij:**

| Regel | AC's |
| --- | --- |
| BR-60 | AC-238 t/m AC-243, AC-246, AC-284 |
| BR-61 | AC-244 t/m AC-247 |
| BR-62 | AC-248 t/m AC-252 |
| BR-63 | AC-253, AC-254 |
| BR-64 | AC-255 t/m AC-261, AC-282, AC-283 |
| BR-65 | AC-262 t/m AC-267 |
| BR-66 | AC-256, AC-268, AC-269, AC-270, AC-282 |
| BR-67 | AC-258, AC-259, AC-271, AC-272 |
| BR-68 | AC-276 t/m AC-279, AC-282 |
| BR-69 | AC-273, AC-274, AC-275 |
| BR-70 | AC-270, AC-278, AC-280, AC-281 |
| BR-71 | AC-243, AC-264, AC-275 |

**A5. "Dekking" › "Harde regels": vul deze bestaande rijen aan:**
- BR-02: "AC-044, AC-066" wordt "AC-044, AC-066 (beide voor routines vervangen door AC-238, AC-239; blijven voor afvaltaken via BR-50)"
- BR-08: + AC-241, AC-251
- BR-09: + AC-250
- BR-10: + AC-239, AC-269
- BR-12: "AC-034" wordt "AC-034 (vervallen door K-1) → AC-262"
- BR-13: + AC-263
- BR-16: "AC-068" wordt "AC-068 (vervangen door AC-244)"
- BR-22: + AC-251, AC-280
- BR-26: + AC-278, AC-281
- BR-31: + AC-242, AC-273, AC-274, AC-275; "AC-072" wordt "AC-072 (vervangen door AC-273)"; "AC-074" wordt "AC-074 (vervallen door K-1)"
- BR-45: + AC-266, AC-278
- BR-46: + AC-243

**A6. "Dekking" › "Een geweigerde actie per rol": vervang de vier regels door:**
> - Gezinslid: AC-001, AC-012, AC-020, AC-048, AC-189, AC-190, AC-208, AC-219, AC-251 en AC-280 (verdeling of herhaalwijze van andermans routine), AC-278 ("even weg" voor een ander).
> - Uitgezet lid: AC-022, AC-189.
> - Beheerder: AC-014, AC-019, AC-021, AC-208, AC-219, AC-262 (de afvinker wijzigen).
> - Buitenstaander: AC-026, AC-027, AC-190, AC-270, AC-278, AC-281.

**A7. "Dekking": na het blok "Aanvullingen na de plan-critic W-03, ronde 3" erbij:**

> **Verwerkte besluiten van Jurgen (W-04):**
>
> | Besluit | AC's |
> | --- | --- |
> | K-1 | AC-255 t/m AC-272, AC-275, AC-282, AC-283 |
> | K-2 | AC-259, AC-260, AC-272 |
> | K-3 | geen eigen AC (volgorde van uitvoeren) |
> | K-4 | AC-253, AC-254, AC-265, AC-282, AC-284 (schermen); de aangepaste UX_SPEC noemt de overige |
>
> **Open bij Jurgen (W-04):** V-60 (AC-259, AC-272), V-62 (AC-273, AC-275), V-63 (AC-249), V-64 (AC-264), V-65 (AC-266), V-66 (AC-262). V-61 heeft geen eigen AC (adoptie).

**A8. "Dekking" › "Open bij Jurgen": onder "- V-41 t/m V-58 (W-03): …" erbij:**
> - K-1 t/m K-4 en V-60 t/m V-66 (W-04): zie "Verwerkte besluiten van Jurgen (W-04)".

=== Interpretaties voor het totaalvoorstel (niet invoegen; voor de hoofdsessie, in gewone taal) ===
1. **Snel of langzaam ritme** is één vaste grens: gemiddeld minder dan 7 dagen tussen twee keren is snel (vervalt vanzelf), 7 dagen of meer is langzaam (blijft staan). "Ma, wo, vr" is dus snel, "elke zaterdag" langzaam. Alles "na de vorige keer" blijft staan, want er is geen volgende die hem kan laten vervallen. Geen instelling.
2. **De volgende datum bij vaste dagen** ligt altijd ná de geplande dag én ná de dag van afvinken. Wie de badkamer op donderdag alvast doet voor zaterdag, ziet de volgende pas een week later; wie hem dinsdag te laat doet, krijgt de eerstvolgende zaterdag.
3. **De beurt wordt bepaald door wie afvinkt**, niet door wie op de taak stond. Wie overneemt en afvinkt, "gebruikt" zijn beurt; de ander is daarna aan de beurt. Dat is de eenvoudigste regel die na overnemen klopt (review C3).
4. **Slimme invoer kiest de herhaalwijze:** "elke N weken" (N ≥ 2), "elke N maanden" en "jaarlijks" worden "na de vorige keer"; dagelijks, "elke N dagen", "elke week", een vaste weekdag en bibliotheektaken met een weekritme worden "op vaste dagen". Altijd vóór Toevoegen te wisselen. (De review liet dit open: "of we stellen het voor bij routines trager dan wekelijks", §9.2.)
5. **De balans stuurt de beurt pas bij 20% of meer**, en dan krijgt wie achterloopt de beurt tot het weer onder 20% is. Bij minder dan 20% is het strikt om en om. Zo blijft het uitlegbaar in één zin.
6. **"Samen"-taken tellen voor niemand** in de balans; ze deden het samen. Een losse taak zonder naam telt wél bij wie hem afvinkt (die deed hem alleen).
7. **Kinderen tellen niet mee** in beurt of balans tot V-60 anders zegt; hun afvinkingen worden wel op naam bewaard en getoond.
8. **Bij één actieve beurtdeelnemer geen namen en geen balans.** Anders zou de app vandaag alles aan Jurgen "toewijzen".
9. **De afvinker na 90 dagen los** van de afvinking (voorstel V-65). De app heeft hooguit 4 weken nodig; langer bewaren dient niets.
10. **Overnemen vraagt niets** aan de ander; hij krijgt alleen een stille melding. Wie iets niet wil, geeft het met één tik terug.
11. **"Even weg"** kan een lid voor zichzelf zetten en een beheerder voor iedereen, zonder reden, en het is voor het hele gezin zichtbaar. Beide weg: taken zonder naam, en pauzeren blijft het advies.
12. **Het dagmoment** noemt alleen wat op jouw naam of zonder naam staat; taken van de ander niet. Losse herinneringen, "deadline nadert" en "verlopen" blijven alleen voor taken met een tijdstip; "verlopen" verdwijnt helemaal.
13. **"Taak gedaan" noemt weer de naam.** De ontvangers blijven zoals V-38.
14. **De opruimmigratie vraagt bevestiging** van Jurgen, met aantallen, net als bij BR-46, ook al gaat er "alleen planning" weg.
15. **Uitgezet of verwijderd lid bij "Altijd <naam>":** de routine valt terug op "om de beurt" in plaats van te blijven hangen zonder eigenaar.

### Vragen voor Jurgen (gebundeld per onderwerp)

**Wie doet mee**
- V-60: Tellen Lynn en Kai mee in "om de beurt" en de balans, of alleen via "Altijd Lynn"/"Altijd Kai"-routines? — waarom: bepaalt de beurtregel, de balans en wat de kinderen in de app zien. — voorstel: alleen "Altijd <naam>"-routines (K-2: ze doen echt een stuk minder); ze tellen niet in de balans van jullie twee; hun afvinkingen staan wel op naam. Klopt dat?
- V-61: Wil Ellen dit ook (namen bij taken, onthouden wie afvinkte, balans)? — waarom: K-1 raakt haar gegevens en haar ervaring net zo; de review noemde het als voorwaarde (§11 K-1). — voorstel: ja, jullie hebben het samen besproken; zo niet, bespreek het vóór de Design Freeze.

**Meldingen**
- V-62: Eén dagmoment per persoon, standaard 19:30, en dat vervangt het ochtend- én avondoverzicht (die verdwijnen als instelling)? — waarom: minder meldingen is het doel, maar het ochtendoverzicht valt weg; wie dat mist, moet dat nu zeggen. — voorstel: ja, 19:30, beide overzichten weg; de tijd is per persoon te wijzigen.

**Ritme**
- V-63: Bij "3 maanden na de vorige keer": telt "deze keer overslaan" als gedaan (volgende = 3 maanden na het overslaan), of blijft de oude teller lopen (volgende = 3 maanden na de laatste échte keer, dus meteen weer)? — waarom: bepaalt of overslaan rust geeft of de taak meteen terugbrengt. — voorstel: telt als gedaan (review B3).

**Gegevens en privacy**
- V-64: De 8 bestaande afvinkingen hebben geen persoon. Laten we die "onbekend" (tellen nergens mee), of wil je ze op jouw naam zetten? — waarom: raakt de historie en de eerste balans. — voorstel: "onbekend" laten; de balans begint schoon bij de start van W-04.
- V-65: Mag de app de naam bij een afvinking na 90 dagen loskoppelen (de afvinking zelf blijft 2 jaar)? — waarom: minder persoonsgegevens bewaren dan nodig is de regel; beurt en balans hebben hooguit 4 weken nodig. — voorstel: ja, 90 dagen.
- V-66: Moet iemand een taak "namens" de ander kunnen afvinken ("Ellen deed hem, ik vink af")? — waarom: raakt de eerlijkheid van de balans en de vervalsbaarheid van "wie deed het". — voorstel: nee; de ander vinkt zelf af, of neemt eerst over met één tik en vinkt daarna af.

### Aannames (expliciet, geen invloed op rechten/gegevens/scope)
- `[AANNAME]` "±duur" in de lijst en het gewicht in de balans gebruiken het bestaande veld "duur" (bibliotheek + handmatig); er komt geen nieuwe schatting of ander veld bij.
- `[AANNAME]` De bestaande, geteste herhalingsregels (maandeinde, schrikkeljaar, n-de weekdag) blijven ongewijzigd en gelden ook voor "X maanden na de vorige keer" (§13, bestaand).
- `[AANNAME]` De letterlijke schermteksten (uitlegregels, balansregel, dagmoment, overnamemelding) komen uit de aangepaste UX_SPEC; de teksten hierboven zijn strekking, en de tests toetsen de UX-tekst.

### Wat de andere agents hieruit nodig hebben
- **product-designer (K-4):** review §7 (schermwijzigingen) plus BR-60 (kalender: planning, dagelijkse routines verborgen), BR-61 ("nog open sinds", zonder alarm), BR-63 ("Wanneer?" als één keuze), BR-64/BR-66 (naam + ±duur in de rij; detail: uitlegregel, "Ik doe hem"/"Aan <naam> geven", Gedaan · Morgen · Deze keer overslaan), BR-67 (balansregel: tekst, plek), BR-68 (Instellingen › Gezin › even weg), BR-69 (Meldingen: vier keuzes), AC-284 (Binnenkort max 3).
- **solution-architect:** review §8 en §9; BR-60/BR-61 als één planregel; BR-64 als pure functie in `src/domain`; BR-65 (afvinker door de database gezet, 90 dagen); BR-68 (kleine tabel); BR-69 (tick leest eerstvolgende keren, nieuwe soorten "dagmoment" en "overgenomen"); BR-71 (draaiboek met back-up en bevestiging); de verdeling van AC-238 t/m AC-284 over S3 t/m S9.
- **security-reviewer:** AC-262 (afvinker niet te vervalsen), AC-278 en AC-281 (afwezigheid en isolatie), AC-266 (loskoppelen).

### Status
**WACHT OP ANTWOORDEN: V-60, V-61, V-62, V-63, V-64, V-65, V-66.** De kern (BR-60 t/m BR-64, BR-66, BR-67, BR-70, BR-71) hangt niet van die antwoorden af en kan door naar de product-designer en de solution-architect; V-60 en V-62 raken wel het ontwerp (wie er in de beurt zit; welke meldingsinstellingen er zijn) en moeten vóór de wireframes beantwoord zijn. Na de antwoorden verwerk ik ze in ronde 2 en vervalt elke `[OPEN: …]`.

Bronbestanden:
- /home/user/takenlijstje/docs/wijzigingen/W-04/product-review.md
- /home/user/takenlijstje/docs/PROGRESS.md
- /home/user/takenlijstje/docs/PRODUCT_SPEC.md
- /home/user/takenlijstje/docs/ACCEPTANCE_CRITERIA.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/samengevoegd/PRODUCT_SPEC-en-ACCEPTANCE_CRITERIA.md
- /home/user/takenlijstje/.claude/werkwijze-subagents.md
