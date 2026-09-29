# W-04 — Productreview en verbeterplan "huishoud-assistent"

Status: **voorstel, niets gebouwd.** Wacht op keuzes en "GO" van Jurgen.
Datum: 2026-09-29. Opgesteld door de hoofdsessie, na onderzoek van de code, de live gegevens (alleen lezen) en de goedgekeurde ontwerpdocumenten.

---

## 0. Eerst dit: drie feiten die het plan bepalen

1. **Alleen Jurgen gebruikt de app.** Op live is er 1 actief lid met een account. Ellen staat er (nog) niet in. Alles over "eerlijk verdelen tussen twee personen" werkt pas als Ellen de app ook echt gebruikt. Dat is dus stap 1, niet een detail.
2. **Twee dagen geleden is bewust het tegenovergestelde besloten.** Op 28 september koos Jurgen (V-19, V-21, V-22):
   - "Niemand toegewezen": taken zijn van het hele huishouden;
   - "Nee": de app houdt niet bij wie iets deed;
   - punten en spaardoel weg.

   Die toewijzings- en afvinkgegevens zijn daarna ook echt gewist (WP2b, M6). De externe analyse bouwt juist op toewijzing en "wie deed wat". **Dat is een koerswijziging die alleen Jurgen (en eigenlijk Ellen) kan maken.** Ik vul hem niet zelf in; zie vraag K-1 in §11.
3. **Het "47 taken"-gevoel is echt, en de oorzaak is heel concreet.** Live staan 10 terugkerende taken, maar 47 open taken. "Vaatwasser inruimen" staat 15 keer klaar en "Vaatwasser uitruimen" 14 keer. De app maakt voor elke reeks alle keren van de komende 14 dagen alvast aan (BR-02). Het datamodel scheidt routine en uitvoering al wel (`task_recurrences` en `tasks`); het probleem zit in **hoeveel uitvoeringen er vooraf worden gemaakt en getoond**, niet in het ontbreken van routines.

Daarnaast:
- De vernieuwde schermen (WP4–WP9, goedgekeurd op 28 september) zijn **nog niet gebouwd**; de branch `v2-ui` bevat nog geen nieuwe schermen. Dit is dus het goede moment om bij te sturen: we veranderen een ontwerp op papier, niet gebouwde schermen.
- De afvalkalender (WP3b) is gebouwd en gereviewd, maar nog niet live. Hij past goed bij het nieuwe productprincipe ("de app onthoudt het zelf") en staat hier los van. Voorstel: eerst afmaken, zie fase A.

---

## 1. Fase 1 — Wat de app nu is (samenvatting van het onderzoek)

| Onderdeel | Nu |
| --- | --- |
| **Schermen** | Onderbalk: Vandaag · Taken · + · Kalender · Huishouden. In de kop: Boodschappen, Meldingen, Instellingen. Verder Onboarding en Uitnodigen. |
| **Vandaag** | Groet, 4 tegels (vandaag, voltooid, open, verlopen), voortgangsbalk, "Eerstvolgende deadline", snelle invoerbalk, Verlopen / Vandaag / Binnenkort (7 dagen, max 6 zichtbaar). |
| **Taken** | Zoeken, snelknoppen Open/Verlopen/Voltooid/Alles, filters (status, categorie, prioriteit, terugkerend, datum), gegroepeerd per dag. |
| **Kalender** | Dag/week/maand, slepen naar een andere dag, en "spookjes": toekomstige keren van een reeks die nog niet zijn aangemaakt. |
| **Huishouden** | Afgerond, open, te laat, % voltooid, "Meest gedaan", "Meest vergeten". Niets per persoon. |
| **Boodschappen** | Slimme invoer ("2 melk"), categorieën in looproute, "vaak gekocht", afronden met ongedaan maken, werkt offline. |
| **Taakmodel** | Een taak heeft een geplande dag (+ tijd), optioneel "mag al vanaf" en "uiterlijk", duur, prioriteit, categorie, herinneringen, notities en historie. "Verlopen" wordt berekend. |
| **Herhaling** | Dagelijks, elke X dagen/weken, vaste weekdagen, maandelijks (vaste dag of "eerste zaterdag"), jaarlijks. Pauzeren, stoppen, "alleen deze keer / deze en volgende". **Niet**: "X tijd na de laatste keer". |
| **Gemiste taken** | Een gemiste keer van een reeks wordt automatisch "vergeten/overgeslagen" zodra de volgende keer er is (BR-16). Losse taken blijven rood staan. |
| **Personen** | Geen toewijzing, geen "wie deed het", geen punten (bewust weggehaald). Wel: wie een notitie schreef, en de maker (alleen voor rechten). |
| **Meldingen** | Herinnering per taak (instellen per taak), "deadline nadert", "verlopen", ochtend- en avondoverzicht, "taak gedaan", push. 6 schakelaars + 3 tijden per persoon. |
| **Snelle invoer** | Begrijpt al veel: "badkamer zaterdag", "morgen 18u", "elke 2 weken zondag", "dagelijks", "!!"; herkent ook standaardtaken ("wc" → "WC schoonmaken" met duur). Herkent technisch ook personen, maar dat staat uit. |
| **Bibliotheek** | 44 standaardtaken met standaardritme en duur (o.a. vaatwasser, badkamer, bed verschonen). Onderhoud (rookmelders, filters, ontkalken) ontbreekt. Geen indeling per kamer. |
| **Onboarding** | Naam huishouden → taken kiezen (populaire staan aan) → hoe vaak → klaar. |
| **Automatisch** | Reeksen aanvullen, gemiste reekstaken overslaan, herinneringen versturen, opruimen, straks de afvalkalender. |
| **Voorbereid, niet zichtbaar** | Duur staat op 57 taken maar wordt nergens voor gebruikt; meerdere herinneringen per taak (UI zet er één); notitie bij afvinken; herkenning van personen in de snelle invoer; eigen standaardtaken. |

---

## 2. Fase 2 — Kritiek op de externe analyse, punt voor punt

Legenda: **ONDERSCHRIJF** · **DEELS** · **NIET DOEN** · **BESTAAT AL** · **LATER** · (ontbrekende punten staan in §2.2).

### 2.1 De 22 punten

| # | Punt uit de analyse | Oordeel | Waarom |
| --- | --- | --- | --- |
| 1 | Routines scheiden van uitvoeringen | **DEELS / BESTAAT AL** | Het model scheidt ze al (reeks ↔ taak), en het goedgekeurde ontwerp heeft "Taken › Terugkerend" als routine-overzicht. Wat wél moet veranderen: **niet 14 dagen aan uitvoeringen vooraf aanmaken en tonen**. Per routine alleen de *eerstvolgende* keer als echte taak; de rest alleen als planning in de kalender. Dat lost "47 taken" op zonder een nieuw datamodel. |
| 2 | Automatische verdeling tussen personen | **DEELS — keuze K-1** | De grootste waarde, én de grootste botsing met V-21. Mijn advies als het doorgaat: **"om de beurt" als standaard**, niet een slim algoritme. Voor twee personen is om de beurt voorspelbaar, uitlegbaar ("vorige keer deed Ellen hem") en bijna altijd eerlijk genoeg. "Automatisch balanceren op minuten, voorkeuren en beschikbaarheid" is voor twee mensen te veel magie: niemand snapt meer waarom hij iets krijgt. Vijf strategieën per routine (auto, beurt, A, B, samen) is ook te veel keuze. Voorstel: **om de beurt** (standaard) · **altijd dezelfde** · **samen/wie tijd heeft**. |
| 3 | Duur/inspanning meetellen | **ONDERSCHRIJF, klein** | Duur bestaat al (op 57 taken, uit de bibliotheek). Hergebruiken als *gewicht* voor de balans, niet als nieuw veld. Geen aparte "inspanning" naast duur: één getal is genoeg. De gebruiker vult het bijna nooit zelf in (bibliotheek + standaard 15 min). |
| 4 | Huishouden-scherm richten op balans | **DEELS — hangt aan K-1** | Eén rustige regel "Afgelopen 4 weken: Jurgen ± 3 u · Ellen ± 3 u 20 — ongeveer in balans" is waardevol. Maar: per week is te schokkerig (één badkamerbeurt verschuift alles), dus over 4 weken. En "automatisch compenseren" alleen via de beurtvolgorde, nooit als melding "jij moet meer doen". De tegels "% voltooid" en "meest gedaan" mogen weg. |
| 5 | Vandaag als primair scherm | **ONDERSCHRIJF / grotendeels in ontwerp** | Het goedgekeurde ontwerp haalt de tegels, de begroeting en "Samen sparen" al weg. Toevoegen als K-1 ja is: de naam bij de taak ("Ellen · vandaag · ±5 min"). |
| 6 | Minder visuele overload (Binnenkort 22) | **ONDERSCHRIJF** | Volgt vanzelf uit punt 1 (alleen de eerstvolgende keer). Daarbovenop: Binnenkort toont hooguit 3 rijen en "Kalender ›". Geen extra samenvattingslogica ("Dit weekend: 5") bouwen; dat is weer iets om te lezen. |
| 7 | Hard / dag / venster | **DEELS / BESTAAT AL (verborgen)** | De techniek bestaat al: geplande dag, "mag al vanaf" en "uiterlijk". Het probleem is dat je dat nu als drie losse velden moet invullen. Voorstel: bij het aanmaken één keuze **"Wanneer?" → Op een dag · Ergens deze week/dit weekend · Vóór een tijdstip**, die de bestaande velden vult. Geen nieuw model. |
| 8 | Slimme herinneringen als opvolgflow | **DEELS** | Goed idee, maar in een eenvoudige vorm: **één vast herinneringsmoment per dag per persoon** ("Vanavond nog open voor jou: badkamer, vaatwasser") in plaats van losse meldingen per taak, plus knoppen in de melding **Gedaan · Morgen**. Knoppen in pushmeldingen werken op Android goed; op iPhone (webapp) beperkt. Zonder werkende knop opent de melding de taak; dat is ook 1 tik. "Overdragen" in de melding: te veel. |
| 9 | Slim automatisch herplannen | **DEELS / BESTAAT AL voor routines** | Voor routines bestaat het al: een gemiste keer vervalt als de volgende eraan komt (BR-16). Dat is eigenlijk de juiste, rustige regel: een gemiste vaatwasser hoeft niet "ingehaald" te worden. Wat ontbreekt: routines met een **lange** frequentie (badkamer, bed, onderhoud) moeten niet stil vervallen maar **blijven staan tot ze gedaan zijn**, en losse taken krijgen **"Naar morgen"** (1 tik). "Automatisch een nieuw moment kiezen" niet doen: dat is onvoorspelbaar. |
| 10 | Kalender rustiger (groeperen) | **DEELS** | Met punt 1 staan dagelijkse routines niet meer 14× in de kalender, alleen als rustige planning. Een aparte "Keukenroutine · 2 taken"-groepering kost veel en helpt weinig. Liever: dagelijkse routines standaard niet in de kalender tonen (ze zijn elke dag), alleen op Vandaag. |
| 11 | Snel toevoegen behouden en uitbreiden | **BESTAAT AL (grotendeels)** | Datum, tijd, herhaling, prioriteit en standaardtaak worden al herkend. Personen ook (code staat uit). Toe te voegen: "over drie maanden", "volgende maand", "elke 3 maanden" en — als K-1 ja — personen weer aanzetten. Dat is klein werk. |
| 12 | Taken als workflows (was starten → ophangen → …) | **NIET DOEN** | Klinkt slim, maar is veel bouwwerk (afhankelijkheden, timing tussen stappen) voor weinig winst in een huishouden van twee. Eén taak "Was" met in de omschrijving de stappen is genoeg. Uitzondering die wél past: "Boodschappenlijst → boodschappen doen" wordt opgelost door de boodschappenlijst zelf, niet door een workflow. |
| 13 | Snelle overdracht ("Ik pak hem" / "Kan jij?") | **ONDERSCHRIJF — als K-1 ja** | Eén tik op de naam wisselt de persoon voor deze keer. "Kan jij hem doen?" wordt gewoon: de taak staat nu bij de ander (met een melding). Geen verzoek-en-accepteer-flow (dat was het oude "ruilen"; bewust weg). |
| 14 | "Ik heb even tijd" (5/15/30/60 min) | **LATER** | Leuk, maar het vraagt dat duur overal klopt en het gebruik is onzeker. Pas als duur via balans toch al overal staat. |
| 15 | "Geef me een taak" | **NIET DOEN (voorlopig)** | Met 5–8 taken per dag op Vandaag zie je zelf in één oogopslag wat moet. De volgorde van Vandaag (verlopen → nu → later) ís al "de logische volgende taak". |
| 16 | Leren van werkelijk gebruik | **LATER, en dan heel beperkt** | Eén simpele regel is nuttig: "Deze taak is de laatste 4 keer overgeslagen — ritme aanpassen?". Patronen als "jullie doen hem meestal maandag" zijn foutgevoelig en voelen snel als bemoeien. |
| 17 | Onboarding met huishoudbibliotheek | **BESTAAT AL (grotendeels)** | Er is een bibliotheek van 44 taken met standaardritme, en de onboarding laat ze aanvinken. Kamers kiezen als tussenstap voegt een scherm toe; niet nodig. Wel: **onderhoud** aan de bibliotheek toevoegen en de onboarding voor een tweede persoon (Ellen) bijna tikloos maken. |
| 18 | Onderhoudsroutines | **ONDERSCHRIJF** | Hier is de app echt beter dan het hoofd. Vraagt twee kleine dingen: (a) onderhoudstaken in de bibliotheek, (b) herhaling **"X tijd na de laatste keer"** (ontbreekt nu). Zie §2.2. |
| 19 | Afwezig / vakantie / drukke week | **DEELS — hangt aan K-1** | Als er beurten zijn: "Ellen is weg do t/m zo" → haar beurten gaan naar Jurgen en tellen niet tegen de balans. Dat is nodig, anders klopt verdelen niet. "Drukke week" (niet-kritieke taken verschuiven): **niet doen**, dat is vaag en moeilijk voorspelbaar; "Pauzeren" en "deze keer overslaan" dekken het. |
| 20 | Instellingen voor automatische planning | **NIET DOEN** | Schakelaars als "automatisch verdelen", "automatisch balanceren", "automatisch herplannen" zijn precies het beheerwerk dat we willen schrappen. Eén goede standaard, per routine te corrigeren. Meldingsinstellingen juist **inkorten** (zie §2.2). |
| 21 | Competitie vermijden | **ONDERSCHRIJF / BESTAAT AL** | Punten, spaardoel en ranglijsten zijn al weg. Zo houden. Ook de balansregel geen kleuren "wie wint". |
| 22 | Prioriteitsvolgorde van de analyse | **DEELS** | De volgorde begint bij techniek (routines scheiden). Mijn volgorde begint bij **adoptie** (Ellen erbij) en **rust** (minder taken tonen), omdat verdelen zonder tweede gebruiker niets oplevert. Zie §5. |

### 2.2 Wat in de analyse ontbreekt

1. **Adoptie door de tweede persoon.** De app faalt niet op features maar op gebruik: 8 afvinkingen in totaal, één account. Nodig: Ellen uitnodigen en haar eerste gebruik bijna tikloos maken (link → naam → push aan → klaar), en de app op het beginscherm van beide telefoons met meldingen aan. Zonder dit is de rest zinloos.
2. **Herhaling "X tijd na de laatste keer".** Voor bed verschonen, filters, ontkalken en rookmelders is "elke 3 maanden vanaf 1 januari" fout: als je hem twee weken te laat doet, moet de volgende ook later. Nu ontbreekt dat helemaal. Kleine uitbreiding, grote winst voor "de app onthoudt het".
3. **Onderscheid "dagelijkse routine" en "periodieke klus".** De regel voor gemiste keren moet verschillen: een gemiste vaatwasser vervalt (morgen is er weer een), een gemiste badkamer blijft staan tot hij gedaan is. Nu vervallen beide. Dit is één regel op basis van de frequentie; geen nieuwe instelling.
4. **Minder meldingsinstellingen.** Nu: 6 schakelaars, 3 tijden en een herinnering per taak. Voorstel: per persoon één **dagmoment** ("vanavond nog open voor jou") en push aan/uit; herinneringen per taak alleen voor echte tijdstippen (afval, afspraak). Dat is minder beheer én effectiever.
5. **Eén bron van waarheid voor de nieuwe schermen.** Er ligt een goedgekeurd ontwerp (WP4–WP9) dat hier op veel punten mee overlapt maar het uitgangspunt "niemand toegewezen" heeft. Het plan moet dat ontwerp **aanpassen**, niet ernaast bouwen. Anders bouwen we de schermen twee keer.
6. **Uitleg zonder drukte.** "Waarom sta ik hierop?" moet beantwoord worden, maar niet in de lijst: in het detail één regel ("Om de beurt · vorige keer Ellen, di 29 sep"). Stond niet concreet in de analyse.
7. **Succes meten.** De bestaande succescriteria (PRODUCT_SPEC §11) gaan uit van "per persoon kan en mag het niet". Bij K-1 ja komen daar één of twee bij (balans binnen ±20% over 4 weken, en "beiden vinken op ≥ 4 van 7 dagen af").

### 2.3 Waar de analyse de app ingewikkelder zou maken

- Vijf verdeelstrategieën per routine, plus voorkeuren, plus beschikbaarheid → vervangen door **drie** keuzes met "om de beurt" als standaard.
- Workflows, "geef me een taak", "ik heb even tijd", "drukke week", patronen leren, instellingen voor automatisering → niet of later.
- Kamers in de onboarding, aparte "inspanning" naast duur, kalendergroepering als eigen functie → niet nodig; eenvoudiger alternatieven hierboven.
- Balans per week met compensatiemeldingen → alleen een rustige 4-wekenregel en een beurtvolgorde die vanzelf compenseert.

---

## 3. Fase 3 — Productprincipes (toetssteen voor elke feature)

1. **De app onthoudt, jullie doen.** Elke routine wordt één keer ingesteld en daarna niet meer onderhouden. Als iets vaker dan eens per maand handwerk vraagt, is het ontwerp fout.
2. **Vandaag is het product.** 90% van het gebruik is: Vandaag openen, afvinken, dicht. Alles wat niet helpt om vandaag het goede te doen, staat een laag dieper.
3. **Laat alleen zien wat nu telt.** Een routine staat één keer in beeld (de eerstvolgende keer), niet veertien keer. Toekomst is planning, geen werk.
4. **Voorspelbaar boven slim.** Een regel die je in één zin kunt uitleggen ("om de beurt", "3 maanden na de vorige keer") wint van een algoritme dat nét iets eerlijker is. Elke automatische keuze is in het detail in één zin te lezen en met één tik te corrigeren.
5. **Uitzonderingen kosten 1 tik.** Overnemen, morgen, deze keer overslaan, even weg: allemaal direct bij de taak of persoon, zonder formulier.
6. **Samen, niet tegen elkaar.** Geen punten, geen winnaars, geen rood omdat iemand "achterloopt". Balans is een rustige constatering over weken, geen scorebord.
7. **Minder instellingen, betere standaarden.** Een nieuwe schakelaar moet bewijzen dat een goede standaard niet kan.

---

## 4. Fase 4 — Verbeterplan

De fases volgen de principes. Fase C is voorwaardelijk: die hangt aan keuze K-1.

### Fase A — Afmaken en aan boord krijgen

**A1. Afvalkalender live (WP3b afronden)**
1. *Probleem:* gebouwd en gereviewd, nog niet live; tests half af.
2. *Waarom:* dit is precies "de app onthoudt het zelf", en de vervanging van Jurgens handmatige afvalreeks.
3. *Oplossing:* tests afmaken, schermafbeeldingen (CP-W03) en beoordeling, U0.1 (tijden gecontroleerd door Jurgen), live, rooktest.
4. *UX:* zoals goedgekeurd.
5. *Hergebruik:* alles is er.
6. *Complexiteitsrisico:* laag; de oude schermen worden later toch vervangen, maar de logica blijft.
7. *Niet:* geen nieuwe afvalfuncties.
8. *Afhankelijk:* V-59 (grens op opzoeken) en U0.1.
9. *Acceptatie:* de bestaande AC-183…AC-237 zijn groen; Jurgen ziet de juiste ophaaldagen.

**A2. Ellen aan boord**
1. *Probleem:* één gebruiker; verdelen en "samen" zijn nu theorie.
2. *Waarom:* zonder tweede gebruiker levert geen enkel ander onderdeel iets op.
3. *Oplossing:* uitnodiging versturen (bestaat), eerste keer: naam → "Meldingen aanzetten" (met iPhone-uitleg "Zet op beginscherm") → Vandaag. Geen onboarding-wizard voor Ellen.
4. *UX:* 3 schermen, geen keuzes.
5. *Hergebruik:* uitnodigingslink, profielstap, pushinstructies.
6. *Risico:* nihil.
7. *Niet:* geen rondleiding, geen tutorial.
8. *Afhankelijk:* niets; kan vandaag al.
9. *Acceptatie:* Ellen is actief lid met push aan; beide vinken minstens één week lang af.

### Fase B — Rust: alleen tonen wat nu telt (**MUST, onafhankelijk van K-1**)

**B1. Eén keer per routine in beeld ("eerstvolgende keer")**
1. *Probleem:* dagelijkse routines staan 14× klaar; 47 open taken voor 10 routines.
2. *Waarom:* visuele druk, onoverzichtelijke Taken-lijst, statistiek "open" betekenisloos.
3. *Oplossing:* per routine bestaat alleen de eerstvolgende keer als echte taak. Is die gedaan of vervallen, dan maakt de app de volgende. De kalender toont verdere keren als planning (de "spookjes" bestaan al).
4. *UX:* Vandaag: "Vaatwasser uitruimen" één keer. Taken › Open: één regel per routine. Kalender: toekomstige keren gestippeld; dagelijkse routines standaard niet in de kalender.
5. *Hergebruik:* `task_recurrences`, planner (`topUp`), projecties in de kalender, BR-16.
6. *Risico:* middel. Herinneringen vooruit en "verplaats deze keer naar volgende week" moeten blijven werken; meldingen lezen nu 7 dagen vooruit.
7. *Niet:* geen nieuw "routine"-object, geen herschrijving van het model.
8. *Afhankelijk:* B2 (welke regel bij missen).
9. *Acceptatie:* bij 10 actieve routines staan er hooguit ~12 open taken; een routine verschijnt na afvinken direct met de volgende datum; een verplaatste keer blijft staan; de kalender toont de volgende 4 weken van wekelijkse routines als planning.

**B2. Gemiste keer: vervalt of blijft staan, afhankelijk van het ritme**
1. *Probleem:* nu vervalt elke gemiste reekstaak als de volgende komt, ook de badkamer.
2. *Waarom:* dagelijkse dingen hoeven niet ingehaald; grote klussen wel.
3. *Oplossing:* ritme vaker dan 1× per week → gemiste keer vervalt (zoals nu). Ritme wekelijks of trager → blijft open ("sinds ma") tot hij gedaan of bewust overgeslagen is; de volgende keer wordt pas gepland na afvinken of overslaan.
4. *UX:* op Vandaag onder "Nog open" met "sinds zaterdag", zonder rood alarm. In het detail: **Gedaan · Morgen · Deze keer overslaan**.
5. *Hergebruik:* BR-16-logica, status "overgeslagen".
6. *Risico:* laag.
7. *Niet:* geen "automatisch nieuw moment kiezen".
8. *Afhankelijk:* B1.
9. *Acceptatie:* een gemiste vaatwasser verdwijnt de volgende dag; een gemiste badkamer blijft staan en de volgende badkamer verschijnt pas na afvinken.

**B3. Herhaling "X tijd na de vorige keer"**
1. *Probleem:* onderhoud en bed verschonen horen te tellen vanaf de laatste keer.
2. *Waarom:* anders worden ze te vroeg of dubbel gevraagd, en daalt het vertrouwen.
3. *Oplossing:* bij herhalen de keuze **"op vaste dagen"** of **"… na de vorige keer"**.
4. *UX:* in de herhaalkeuze één extra optie; de samenvattende zin zegt "3 maanden na de vorige keer (volgende: ± 12 jan)".
5. *Hergebruik:* regels, planner, snelle invoer ("elke 3 maanden").
6. *Risico:* laag.
7. *Niet:* geen combinaties als "elke 2 weken maar niet eerder dan …".
8. *Afhankelijk:* B1.
9. *Acceptatie:* afvinken op 20 jan bij "3 maanden na de vorige keer" → volgende op 20 apr; overslaan telt als "gedaan" voor het ritme.

**B4. Vandaag rustiger (samen met het nieuwe ontwerp)**
- Het goedgekeurde ontwerp (UX §5.1) schrapt al tegels, begroeting en snelle invoerbalk. Aanvulling: "Binnenkort" hooguit 3 rijen; per rij optioneel duur ("±15 min"); bij K-1 ja de naam.
- *Acceptatie:* op 390×844 zijn "Nog open" en "Vandaag" zonder scrollen zichtbaar bij ~8 taken.

**B5. "Wanneer?" als één keuze**
- Op een dag / Ergens deze week / Vóór een tijdstip. Vult de bestaande velden (gepland, mag al vanaf, uiterlijk). Snelle invoer blijft: "badkamer dit weekend" → venster za–zo.
- *Acceptatie:* "ramen dit weekend" geeft een taak die vanaf zaterdag op Vandaag staat en zondag avond "uiterlijk" heeft.

### Fase C — Wie is aan de beurt (**alleen als K-1 = ja**)

**C1. Beurt per routine**
1. *Probleem:* "oneerlijke verdeling, vergeten taken (met name door Jurgen)" (V-19).
2. *Waarom:* als het niemands taak is, is het ook niemands verantwoordelijkheid; dat is de klassieke oorzaak van vergeten.
3. *Oplossing:* elke routine heeft een eenvoudige verdeling: **Om de beurt** (standaard) · **Altijd <naam>** · **Samen**. Om de beurt houdt rekening met wie het vorige keer deed én met de balans over 4 weken (bij gelijke beurt krijgt wie minder gedaan heeft hem). Losse taken: wie hem aanmaakt kiest, standaard "wie tijd heeft" (geen naam).
4. *UX:* rij: "Vaatwasser uitruimen · Ellen · ±10 min". Detail: "Om de beurt · vorige keer Jurgen (za 26 sep)". Geen avatars nodig; voornaam volstaat.
5. *Hergebruik:* de oude code voor om-en-om (`occurrenceIndex`) staat nog in de domeinlaag; herkenning van personen in de snelle invoer.
6. *Risico:* middel: nieuwe kolommen en regels, en het ontwerp moet opnieuw door de reviewronde.
7. *Niet:* geen voorkeuren, geen beschikbaarheid per dag, geen "automatisch balanceren"-schakelaar, geen vijf strategieën.
8. *Afhankelijk:* A2, B1, C2.
9. *Acceptatie:* een dagelijkse routine met "om de beurt" wisselt elke dag; na overnemen blijft de afwisseling kloppen; in het detail staat altijd waarom iemand aan de beurt is.

**C2. Bijhouden wie iets deed (terugdraaien van V-21 "Nee")**
- Nodig voor om de beurt én balans. Alleen de naam bij de afvinking; nergens een ranglijst.
- *Acceptatie:* elke nieuwe afvinking heeft een persoon; oude afvinkingen blijven "onbekend" en tellen niet mee.

**C3. Overnemen in 1 tik**
- Op Vandaag: lang indrukken of in het detail "Ik doe hem" / "Aan <naam> geven". De ander krijgt een stille melding ("Jurgen nam 'Badkamer' over"). Telt voor de balans bij wie hem afvinkt.
- *Niet:* geen verzoeken of accepteren.
- *Acceptatie:* 1–2 tikken; de balans volgt wie afvinkt.

**C4. Balansregel**
- Onderaan Vandaag (kaart) of op het Overzicht: "Afgelopen 4 weken: Jurgen ± 3 u · Ellen ± 3 u 20 — ongeveer in balans." Tekst, geen grafiek, geen kleur voor "achter".
- Gewicht = duur van de taak (standaard 15 min als hij leeg is).
- *Acceptatie:* verschil < 20% → "ongeveer in balans"; anders "Ellen deed wat meer; de app geeft Jurgen de volgende beurten". Nooit een melding hierover.

**C5. Even weg**
- Instellingen › Gezin: "<naam> is weg van … t/m …". Beurten in die periode gaan naar de ander en tellen niet mee in de balans.
- *Niet:* geen "drukke week".
- *Acceptatie:* tijdens afwezigheid staat geen enkele beurt bij de afwezige; daarna loopt de afwisseling normaal verder.

### Fase D — Opvolging die werkt

**D1. Eén dagmoment in plaats van losse meldingen**
- Per persoon één melding op een vaste tijd (standaard 19:30): "Nog open voor jou: vaatwasser, badkamer (sinds za)". Zonder K-1: "Nog open: …". Herinneringen per taak blijven alleen voor taken met een tijdstip (afval, afspraken).
- Meldingsinstellingen worden: push aan/uit, dagmoment (tijd of uit), "taak gedaan" aan/uit.
- *Acceptatie:* bij een normale dag hooguit 2 meldingen per persoon; iemand zonder open taken krijgt niets.

**D2. Knoppen in de melding**
- "Gedaan" en "Morgen" direct in de push (waar het toestel dat ondersteunt); anders opent de melding de taak.
- *Acceptatie:* op Android afvinken zonder de app te openen; op iPhone opent de melding het taakdetail.

### Fase E — Later (pas na 4–6 weken echt gebruik)

- **E1. Onderhoud in de bibliotheek** (rookmelders, afzuigkap, vaatwasser/wasmachine reinigen, koffieapparaat ontkalken, koelkast/vriezer) met "na de vorige keer". Klein; kan ook eerder als B3 er is.
- **E2. Eén leerregel:** "Deze taak is de laatste 4 keer overgeslagen — minder vaak?" met Ja/Nee.
- **E3. "Ik heb even tijd"** als er genoeg duur-gegevens zijn.

---

## 5. Fase 5 — Prioritering

| | Onderdelen |
| --- | --- |
| **MUST HAVE** | A1 afvalkalender live · A2 Ellen aan boord · B1 één keer per routine · B2 gemiste keer per ritme · B4 rustiger Vandaag · D1 één dagmoment |
| **SHOULD HAVE** | B3 "na de vorige keer" · B5 "Wanneer?" als één keuze · C1–C5 (als K-1 = ja; dan wordt C1+C2+C3 MUST) · E1 onderhoud in bibliotheek |
| **LATER** | D2 knoppen in meldingen · E2 leerregel · E3 "ik heb even tijd" · snelle invoer "over 3 maanden" |
| **NIET BOUWEN** | workflows · "geef me een taak" · instellingen voor automatisering · "drukke week" · kamers in onboarding · aparte inspanning naast duur · kalendergroepering als functie · punten/badges/streaks · AI-chat |

**Samen uitvoeren (afhankelijk van elkaar):**
- B1 + B2 (samen één planregel) + meldingen die 7 dagen vooruit lezen.
- C1 + C2 (beurt kan niet zonder "wie deed het"), C4 + C5 (balans klopt niet zonder afwezigheid).
- Alles in fase B–D + het goedgekeurde nieuwe ontwerp (WP4–WP9): **één nieuwe ontwerpronde**, zodat de schermen één keer gebouwd worden.

---

## 6. Fase 6 — Nieuwe user flows

*(Met K-1 = ja. Zonder K-1 vervallen namen, beurten en balans; de rest blijft.)*

**1. Doordeweekse dag.** 07:45 Ellen opent de app: Vandaag toont 4 regels — "Vaatwasser uitruimen · Ellen · ±10 min", "Afval binnenzetten · vanaf 12:00", "Badkamer · Jurgen · sinds za", "Boodschappenlijst · wie tijd heeft". Ze tikt het rondje bij de vaatwasser. Klaar. 19:30 krijgt Jurgen: "Nog open voor jou: badkamer (sinds za)". Hij doet hem, tikt de melding aan, tikt "Gedaan". Twee tikken.

**2. Terugkerende taak gedaan.** Jurgen vinkt "Bed verschonen" af (ritme: 2 weken na de vorige keer). De rij verdwijnt; in Taken › Terugkerend staat "volgende: ± di 13 okt · Ellen". Niemand plant iets.

**3. Taak niet gedaan.** De vaatwasser van dinsdag is niet gedaan: woensdag is hij weg; alleen de nieuwe staat er. De badkamer (wekelijks) is zaterdag niet gedaan: hij blijft staan als "sinds za", zonder rood. Het dagmoment noemt hem. In het detail: Gedaan · Morgen · Deze keer overslaan. Na 4 keer overslaan (later, E2): "Minder vaak?".

**4. Overnemen.** Ellen ziet "Badkamer · Jurgen · sinds za", heeft tijd, opent het detail en tikt "Ik doe hem". De naam wordt Ellen; Jurgen krijgt een stille melding. Ze vinkt af; de balans telt bij Ellen. De volgende beurt gaat naar Jurgen.

**5. Scheve verdeling.** Over 4 weken: Ellen ± 4 u, Jurgen ± 2 u 40. Het Overzicht zegt rustig: "Ellen deed wat meer; de app geeft Jurgen de volgende beurten." Bij "om de beurt" krijgt Jurgen bij gelijke stand de beurt, tot het weer in balans is. Geen melding, geen rood.

**6. Nieuwe taak.** Jurgen tikt +, typt "afzuigkapfilter elke 3 maanden", tikt Toevoegen. De app herkent de standaardtaak (duur 10 min), zet "3 maanden na de vorige keer" en "om de beurt". Eén regel onder het invoerveld laat zien wat hij begreep.

**7. Even weg.** Instellingen › Gezin › Ellen › "Weg van do 8 t/m zo 11 okt". Alles wat in die dagen bij Ellen zou komen, staat bij Jurgen, en telt niet mee in de balans. Maandag loopt het om de beurt gewoon door.

**8. Nieuw huishouden.** Naam → "Welke taken hebben jullie?" (populaire staan aan, met ritme; onderhoud apart) → "Wie doen er mee?" (uitnodigen of later) → Vandaag. Standaard staat alles op "om de beurt". Geen verdere keuzes.

---

## 7. Fase 7 — Schermwijzigingen (bovenop het goedgekeurde ontwerp WP4–WP9)

| Scherm | Blijft | Verdwijnt | Aangepast | Nieuw | Minder prominent | Direct beschikbaar |
| --- | --- | --- | --- | --- | --- | --- |
| **Vandaag** | Nog open / Vandaag / Binnenkort, 1-tik afvinken, ongedaan maken | tegels, begroeting, voortgangsbalk, "eerstvolgende deadline", snelle invoerbalk (zat al in ontwerp) | één keer per routine; "sinds za" i.p.v. rood; Binnenkort max 3 | naam + ±duur (K-1); balansregel onderaan (K-1) | gedaan-lijst (ingeklapt) | afvinken; detail: Morgen, Ik doe hem, Overslaan |
| **Taken** | zoeken, Open / Gedaan / Terugkerend | 14× dezelfde routine in Open | Open toont één regel per routine | in Terugkerend: "om de beurt · volgende: Ellen" (K-1) | filters (weinig nodig) | zoeken, routine openen |
| **Kalender** | dag/week/maand, + Taak | dagelijkse routines als volle kaarten | toekomst als planning (gestippeld) | — | dagelijkse routines (standaard verborgen) | taak openen, + Taak op een dag |
| **Huishouden / Overzicht** | periode | % voltooid, "meest gedaan"-tegels | "vaak vergeten" blijft (nuttig om ritme aan te passen) | balansregel over 4 weken (K-1) | cijfers | tik op "vaak vergeten" → routine aanpassen |
| **Boodschappen** | alles | — | "Boodschappenlijst maken" als routine kan weg (de lijst ís de lijst) | — | — | toevoegen, afvinken |
| **Instellingen** | profiel, gezin, uitnodigen, afvalkalender, account | "deadline nadert", "te laat", ochtend- én avondoverzicht als losse schakelaars | Meldingen: push + dagmoment + "taak gedaan" | "Even weg" per persoon (K-1) | standaardtaken | uitnodigen, dagmoment |
| **Taak aanmaken/bewerken** | naam, slimme invoer, herhalen | "Mag al eerder", "Uiterlijk", "Tijd" als losse velden bovenaan | "Wanneer?" = Op een dag · Deze week · Vóór tijdstip; herhalen met "na de vorige keer" | "Wie?" = Om de beurt · <naam> · Samen (K-1) | duur, prioriteit, omschrijving (onder "Meer") | Toevoegen in 2 tikken + typen |

---

## 8. Fase 8 — Datamodel en techniek (hoofdlijnen, geen code)

| Onderdeel | Wijziging |
| --- | --- |
| **Routines** (`task_recurrences`) | + `repeat_mode`: `fixed` (zoals nu) of `after_completion`. + (K-1) `assignment`: `rotate` · `fixed` · `together`, en `fixed_member_id`. Geen nieuwe tabel. |
| **Uitvoeringen** (`tasks`) | Planner maakt per routine alleen de eerstvolgende open keer (horizon per routine i.p.v. 14 dagen). + (K-1) `assigned_member_id` en `assignment_reason` (`rotate`, `fixed`, `took_over`, `away`). |
| **Historie** (`task_completions`) | + (K-1) `member_id` (wie afvinkte). Oude rijen blijven zonder persoon. |
| **Duur** | Bestaat (`duration_minutes`). Gebruikt als gewicht; leeg = 15 min. Geen nieuw veld. |
| **Afwezigheid** (K-1) | Kleine tabel `member_absences(member_id, from, until)` (bestond vóór WP2b; nu eenvoudiger: zonder strategie). |
| **Gemiste keer** | BR-16 wordt: vervalt alleen bij ritme vaker dan wekelijks; anders blijft open. De volgende keer van een langzame routine pas na afvinken/overslaan. |
| **Herinneringen/meldingen** | Nieuwe soort "dagmoment" (vervangt ochtend- en avondoverzicht); `deadline_soon` en `overdue` vervallen of worden alleen voor taken met een tijdstip. Voorkeuren: push, dagmoment (tijd), taak gedaan. Tick leest de eerstvolgende keren i.p.v. 7 dagen vooruit. |
| **Kalender** | Projecties bestaan al; worden de normale weergave voor toekomstige keren. |
| **Snelle invoer** | Personen weer aan (K-1); "over N maanden", "elke N maanden", "dit weekend". |
| **Bewuste keuzes** | Geen workflowmotor, geen scoring-engine, geen AI-dienst. Om de beurt + balans is een pure functie in `src/domain`, testbaar zonder database. |

---

## 9. Fase 9 — Migratie van bestaande gegevens

1. **Back-up eerst** (zoals bij WP2b: kopie binnen het eigen project, restore-test).
2. **Routines blijven** (10 stuks, met ritme en duur). Standaard `repeat_mode = fixed`; Jurgen kan bij bed/badkamer kiezen voor "na de vorige keer" (of we stellen het voor bij routines trager dan wekelijks).
3. **Open toekomstige keren** van dezelfde routine (bv. 14× vaatwasser) worden opgeruimd tot alleen de eerstvolgende over is. Het zijn open taken zonder historie; er gaat niets verloren. Taken met een notitie of "bezig" blijven staan.
4. **Historie blijft** onaangetast (8 afvinkingen). Zonder persoon; telt niet mee in de balans. De balans begint "vanaf de start van W-04" en zegt dat de eerste 4 weken ("nog weinig gegevens").
5. **Afvaltaken** (als A1 eerst live gaat) blijven zoals ze zijn; die maken al alleen 14 dagen vooruit en zijn per ophaaldag.
6. **Beurten starten** bij de eerstvolgende keer: afwisselend beginnen bij wie de app als eerste koos, of (eenvoudiger) Jurgen begint en het draait vanzelf bij.
7. **Terugweg:** migraties additief (nieuwe kolommen nullable), opruimen van open toekomstige keren is het enige destructieve deel en valt onder de back-up.

---

## 10. Fase 10 — Uitvoeringsplan in kleine stappen

Elke stap is los te testen, breekt de bestaande app zo min mogelijk, en gaat (op niveau 2) door de werkwijze: ontwerp → plan-critic → `/design-go` → bouwen → reviews.

| Stap | Wat | Raakt | Acceptatie (kern) |
| --- | --- | --- | --- |
| **S0** | WP3b afmaken en live (tests, CP-W03, U0.1, livegang, rooktest) | afvalkalender, tick | AC-183…237 groen; rooktest Jurgen |
| **S1** | Ellen uitnodigen en aan boord (geen code nodig) | — | Ellen actief met push; 1 week beide gebruik |
| **S2** | Ontwerpronde W-04: aanpassen PRODUCT_SPEC / UX_SPEC / TD voor fase B–D (en C bij K-1) + plan-critic + `/design-go` | documenten | "DESIGN FREEZE MOGELIJK: JA" |
| **S3** | Planner: één keer per routine + gemiste keer per ritme (B1+B2), inclusief opruimmigratie | planner, tick, BR-02/BR-16, meldingen | ≤ ~12 open taken bij 10 routines; badkamer blijft staan, vaatwasser vervalt; herinneringen komen nog |
| **S4** | Herhaling "na de vorige keer" (B3) + snelle invoer "elke 3 maanden" | regels, planner, formulier, parser | 20 jan → 20 apr; overslaan telt mee |
| **S5** | (K-1) Beurt + wie afvinkte (C1+C2), zonder UI-balans | model, planner, afvinken, detail | om de beurt wisselt; detail zegt waarom |
| **S6** | (K-1) Overnemen in 1 tik (C3) + personen in snelle invoer | detail, Vandaag, parser | 1–2 tikken; melding aan de ander |
| **S7** | (K-1) Afwezigheid (C5) + balansregel (C4) | instellingen, overzicht | geen beurt bij afwezige; tekst "in balans" < 20% |
| **S8** | Meldingen vereenvoudigen: dagmoment (D1) | voorkeuren, tick | ≤ 2 meldingen per persoon per normale dag |
| **S9** | Nieuwe schermen (WP4–WP9, aangepast): Vandaag, Taken, Kalender, Overzicht, Instellingen, formulier met "Wanneer?" (B4, B5) | alle schermen | CP1–CP4, E2E kernflow |
| **S10** | Later: onderhoud in bibliotheek (E1), knoppen in meldingen (D2), leerregel (E2) | bibliotheek, push | na 4–6 weken gebruik beslissen |

S3–S8 kunnen in de huidige schermen worden gebouwd (functioneel, klein) óf direct in S9 worden meegenomen. Advies: **S3 en S4 in de huidige app** (grote winst, weinig UI), de rest samen met S9 zodat de schermen één keer gebouwd worden.

---

## 11. Keuzes voor Jurgen (alleen jij kunt deze maken)

- **K-1 (bepalend):** Willen jullie terug naar *"de app zegt wie aan de beurt is en onthoudt wie iets deed"*? Dat draait V-21 ("niemand toegewezen", "niet bijhouden wie") terug. Voorstel: **ja, in de eenvoudige vorm "om de beurt" met overnemen in 1 tik**, maar alleen als Ellen dat ook wil. Zonder K-1 vervalt fase C en blijft het plan nuttig (rust, ritme, onderhoud, betere herinneringen).
- **K-2:** Voor twee personen of voor vier? Nu staan Lynn en Kai als optioneel. Voorstel: ontwerpen voor twee volwassenen; Lynn en Kai kunnen later "altijd <naam>"-routines krijgen, maar tellen niet in de balans.
- **K-3:** Eerst de afvalkalender live (S0), dan W-04? Voorstel: ja.
- **K-4:** Het goedgekeurde nieuwe ontwerp (WP4–WP9) wordt aangepast met W-04 vóór we schermen bouwen. Voorstel: ja (anders bouwen we twee keer).
- **Open van eerder:** V-59 (grens op adres opzoeken) en U0.1 (tijden op denhaag.nl).
