# Plan-critic — W-03 afvalkalender — ronde 3 — 2026-09-29

> Deze beoordeling gaat alleen over wijzigingsverzoek **W-03 (afvalkalender, WP3b en de W-03-regels voor WP4–WP9)**. W-03 ronde 1 (NEE) en ronde 2 (NEE, 6 moet-punten, 5 aanbevelingen), en de rondes van het hoofdontwerp (laatste: ronde 4, JA), staan in de git-geschiedenis van dit bestand.

Gelezen:
- samenvoeginstructie `docs/wijzigingen/W-03/samenvoegen.md`;
- analist: `product-analyst-r3.md` (koppen, en gericht BR-48/52/54, §6, UC-13, AC-204/205/210/217/220/237, teksttabel, interpretaties), `-r4.md`, `-r4b.md`, `-r4c.md` (volledig);
- designer: `product-designer-r3.md` (volledig, §13), `-r4.md` (volledig, inclusief de twee aanvullingen onderaan);
- architect: `solution-architect-r4.md` (volledig), `-r5.md`, `-r6.md` (volledig);
- visual: `visual-designer-r2.md`, `-r3.md` (volledig);
- probe: `probe/P0-uitkomst.md`, `probe/fixtures-2591BB-87.json` (gericht: 2026-10-27, 2026-11-24, `kalender_2027: []`);
- `docs/PROGRESS.md` (V-41…V-57, antwoorden, WP3 live, D-046-bevestiging), `docs/DECISIONS.md` (D-046);
- screenshots, met Read bekeken: `w03-01`, `w03-02`, `w03-05`, `w03-07`, `w03-08`, `w03-09`, `w03-10`, `w03-11` (390×844, licht).

## Bevindingen

1. [MOET VÓÓR BOUW WORDEN OPGELOST] UX §13.4, §13.7.4, §13.15 en §13.17 (designer r3, niet aangepast in r4) tegenover BR-54/AC-210 (analist r4b) en TD §18.8.6/§18.15 (architect r4): twee verschillende bovengrenzen voor een vergeten binnenzet-taak.
   - UX: "uiterlijk begin van D+2 (do 8 okt)"; §13.7.4 "aan het begin van de dag daarna … vervalt hij vanzelf"; §13.15 "geen binnenzet-taak die dagenlang bij Verlopen blijft staan"; §13.17 "AC-210 … met bovengrens D+2".
   - BR-54, AC-210 en TD (`WASTE_IN_EXPIRE_DAYS = 7`): uiterlijk begin van D+7.
   - De designer noemde D+7 zelf als alternatief; de keuze is nergens gemaakt of vastgelegd.
   Gevolg: na samenvoegen zeggen bevroren UX en bevroren BR/AC/TD iets anders. De test-writer toetst D+7, ux-reviewer toetst D+2; het aantal "vergeten" in het Overzicht (AC-234) hangt ervan af.
   Nodig: de hoofdsessie kiest één grens (mijn advies: D+7, zoals BR/AC/TD en interpretatie nr. 18). De designer past §13.4 (tabelrij en de bullet "Bovengrens"), §13.7.4, §13.15 en §13.17 aan. Het is geen beleidsvraag voor Jurgen, wel een punt in het totaalvoorstel (interpretatie nr. 18 staat er al).

2. [MOET VÓÓR BOUW WORDEN OPGELOST] PRODUCT_SPEC §6 Randgevallen, rij "Jaarwisseling zonder nieuwe kalender" (analist r3, gewijzigd door r4 punt 14) spreekt de jaareinde-regel van r4c tegen.
   - Na r4 luidt de rij: "In december een stille regel (T-73); is er geen enkele komende ophaaldag meer, dan geldt het lege antwoord hierboven (BR-52)".
   - BR-52 (r4c), AC-204/AC-220 (r4c) en TD r6 §18.8.4 zeggen: in november en december is "geen komende ophaaldag dit jaar en J+1 nog leeg" **geen** storing, alleen T-73. Pas een helemaal lege kalender van het lopende jaar (1 januari) is een leeg antwoord.
   - r4c past deze rij niet aan. Ook interpretatie nr. 3 (r4) zegt nog zonder uitzondering "geen enkele komende ophaaldag meer → melding"; nr. 20 (r4c) corrigeert dat pas verderop.
   Gevolg: de bevroren productspec bevat een randgeval dat de bouwer of test-writer naar "SUSPECT_EMPTY eind november" stuurt, precies het valse alarm dat r6 wegneemt.
   Nodig: analist (korte r4d of in de samengevoegde tekst): rij wordt bijvoorbeeld "November/december, laatste ophaaldag geweest, nieuwe kalender nog niet online | Geen storing, stille regel T-73 (BR-52). Op 1 januari nog steeds helemaal leeg: leeg antwoord, na een uur H2 met T-77a". Interpretatie nr. 3 krijgt "(behalve eind november/december, zie nr. 20)".

3. [MOET VÓÓR BOUW WORDEN OPGELOST] `samenvoegen.md` — de instructie is niet eenduidig genoeg om letterlijk in te voegen zonder interpretatie. Twaalf gestapelde concepten, met "vervangt", "als r4", "alleen gewijzigde delen" en onderlinge verwijzingen, laten te veel over aan wie invoegt:
   - **Reikwijdte ontbreekt.** De kolom "Document" noemt alleen de nieuwe secties (PRODUCT_SPEC §14, AC-183…237, TD §18 + §15, DS §7.10/§7.13/§8/§12). Niet genoemd, maar wel nodig:
     - analist r3 deel 1b (aanvullingen in bestaande PRODUCT_SPEC-secties: §6, §9, UC-13 …), deel 2a ("Bronnen"/"Afspraken") en 2d ("Dekking"), met r4 punten 13–21;
     - architect (C) "aanvullingen in bestaande TD-secties" (§3.1, §3.2, §5.3, §6.5, §10, §11.2, §12, §15 "Uitrol"). r4 (C) zegt "gelijk aan r3 (C), met deze aanpassingen", dus r3 (C) is óók bron, en r3 staat niet in de tabel;
     - DS r2 sectie (5) "Oude UI": geen doelsectie genoemd.
     Ook ontbreekt wat er **niet** in mag (statussen, vragen, controlelijst, wijzigingslijsten, interpretaties).
   - **Dode verwijzingen:**
     - AC-183 (r4) verwijst naar "AC-237 (c)"; AC-237 (r4c) heeft geen (c) meer, alleen een ongelabeld "Tegenvoorbeeld";
     - AC-237 (r4c) verwijst naar "AC-183 b"; AC-183 heeft geen (b);
     - de variant "eerstvolgende dag over 3 weken → T-90b, 0 taken", die TD r6 §18.15 (rij 183) toetst en r6 aan de analist vroeg, staat niet in AC-183.
   - **Volgorde binnen designer r4:** r4 deel B wijzigt §13.13.3 ("Meldingen onderin: …") en de H2-zin in §13.7.5; beide worden door de aanvullingen onderaan weer vervangen. De tabel zegt alleen voor de analist "bij overlap geldt de laatste". De opsomming tussen haakjes noemt de G″-rij, §13.7.5 en de "Wanneer" van T-73 (aanvulling r6) niet.
   - **Verouderde zinnen die mee zouden gaan:**
     - DS r2 "Controle bij CP-W03 (de lijst van UX §13.13.3)" (moet worden: TD §18.16 U3);
     - TD (C) §10 "probe P0 vóór de freeze (§18.1.6)" (P0 is uitgevoerd);
     - TD §18.2: `classifyEmpty` (r6) staat niet in de modulelijst van `plan.ts`;
     - TD r6 §18.15 rij 204 "(e) alle eerdere r5-gevallen" onder `classifyEmpty`, terwijl r5 daar `hasNoUpcoming` toetst ("na de laatste decemberdatum met J+1 `[]` = ja"). Als `classifyEmpty`-geval gelezen is dat nu fout.
   Gevolg: Jurgen geeft `/design-go` op een stapel, niet op een tekst. Wat na de freeze wordt ingevoegd, is een interpretatie van de hoofdsessie, en fouten als de D+2/D+7-tegenspraak (bevinding 1) en de §6-rij (bevinding 2) glippen er stil doorheen.
   Nodig: maak vóór de volgende critic-ronde per document **één samengevoegde invoegtekst** (bijvoorbeeld `docs/wijzigingen/W-03/samengevoegd/PRODUCT_SPEC.md`, `ACCEPTANCE_CRITERIA.md`, `UX_SPEC.md`, `TECHNICAL_DESIGN.md`, `DESIGN_SYSTEM.md`), met per blok de doelplek in het bevroren document. Herstel daarbij de dode verwijzingen (AC-183 krijgt de T-90b-variant als (b); AC-237 verwijst naar AC-183 (b)) en de verouderde zinnen hierboven. Ronde 4 beoordeelt dan die vijf bestanden; de losse rondes worden archief.

4. [MOET VÓÓR BOUW WORDEN OPGELOST] TD §18.16 U3 ("de enige lijst" voor CP-W03) is niet de vereniging van beide eerdere lijsten, zoals ronde 2 punt 2 vroeg en architect r4 claimt. Omdat UX §13.13.3 nu alleen een verwijzing wordt, vallen deze punten uit de lijst van designer r3 ongemerkt weg:
   - **laden** (skelet) en **laden mislukt** (T-68 + "Opnieuw");
   - een **overgeslagen afvaltaak met "Toch nog doen"** (oude UI: ⋯-menu met alleen de toegestane acties, AC-217; de visual-designer vraagt zelf te controleren "dat er geen leeg menu of verweesde knop overblijft");
   - **Verlopen, binnenzetten op de dag na de ophaaldag** ("1 dag te laat"), het beeld dat bij de bovengrens uit bevinding 1 hoort;
   - "H blijft na een herstelpoging met een andere oorzaak" (H2 → H1). Dat is gedrag, maar het is alleen op beeld te toetsen als het in de lijst staat.
   Gevolg: visual-qa en ux-reviewer beoordelen deze toestanden niet vóór de livegang, terwijl de DoD "alle states" eist en de oude UI hier nieuwe varianten krijgt.
   Nodig: de architect voegt deze vier punten aan U3 toe (in de samengevoegde TD-tekst van bevinding 3).

5. [MOET VÓÓR BOUW WORDEN OPGELOST] `docs/PROGRESS.md` loopt achter op P0.
   - Jurgens toestemming ("Ja, probeer maar") staat alleen in `P0-uitkomst.md`, niet letterlijk onder "Antwoorden van Jurgen", zoals de werkwijze (§3.4) eist.
   - P0 als afgerond, U0.1 (gemeenteregel, Jurgen) als open controle vóór U4 en U5 (bereikbaarheid vanaf Vercel) staan er niet; "Volgende stap" noemt nog "eerste stap: probe van de bron". Architect r5 punt 5 vroeg dit al.
   Gevolg: een volgende sessie, of de poort bij de sessiestart, gaat uit van een verouderde stand en kan P0 opnieuw laten uitvoeren of U0.1 vergeten.
   Nodig: hoofdsessie werkt PROGRESS bij (antwoord letterlijk; P0 afgerond met verwijzing naar het verslag; U0.1/U0.2/U5 als open controles bij W-03).

6. [MOET VÓÓR BOUW WORDEN OPGELOST] Bewaren van de adrescode (`bag_id`, 16 cijfers) naast postcode en huisnummer — TD §18.3.1/§18.12.
   Jurgen besloot "Adres mag opgeslagen worden" (V-45: postcode + huisnummer). De adrescode is een afgeleide, openbare sleutel van hetzelfde adres; dat is een klein verschil, maar het raakt **gegevens** en is door Jurgen niet bevestigd. Zolang dat zo is, laten mijn regels geen JA toe.
   Nodig: vraag voor Jurgen, in één zin: "Mag de app naast postcode en huisnummer ook het adresnummer van de gemeente bewaren (een openbare code van jullie adres, nodig om de kalender op te halen; alleen beheerders zien het, en het verdwijnt bij uitzetten)? Nee betekent: bij elke ophaling eerst het adres opnieuw opzoeken (één extra verzoek)." Leg het antwoord letterlijk vast. Handig om in dezelfde vraag U0.1 mee te nemen (aanbeveling 4).

7. [AANBEVELING] TD r5 §18.8.1 stap 3 en §18.1.1: het ophalen van C(J−1) in januari heeft geen effect meer.
   Na r5 geeft januari met een lege C(J) **altijd** F2: met datums in C(J−1) via `hasNoUpcoming`, zonder datums via de januariregel ("`no_upcoming` als C(J−1) niet is opgehaald of `[]` gaf"). E is in januari dus nooit mogelijk, wat AC-186 ook bewust vastlegt. Het extra verzoek, de optie `includePreviousYearIfEmpty`, het stub-scenario, U0.2 (a) en twee testgevallen zijn daarmee overbodig.
   Voorstel: C(J−1) schrappen; regel: "in januari, `hadAnyDateInJ` onwaar → `no_upcoming`". Eenvoudiger en even betrouwbaar.

8. [AANBEVELING] TD r6 §18.8.4 stap 3: "C(J+1) is opgehaald en **leeg**" is niet precies.
   Het P0-adres heeft in C(2026) ook kerstboomdatums in januari. Publiceert de gemeente een C(J+1) met alleen kerstbomen of GFT, dan is die lijst niet `[]`, maar wel zonder rest, papier of PMD. Letterlijk gelezen geldt de jaareinde-uitzondering dan niet, en komt er alsnog vals alarm.
   Voorstel: "C(J+1) bevat geen datum van rest, papier of PMD", met een unittest.

9. [AANBEVELING] TD r5 §18.1.3/§18.1.7 en U0.2 (b): wat B teruggeeft voor een onbekende `bagId` is niet getest.
   De standaardregel (B `[]` of 404 → `ADDRESS_GONE`) is een aanname. Geeft B in werkelijkheid ook dan de vijf soorten, dan ziet de beheerder bij een verdwenen adres H2 ("geen komende ophaaldagen … ongebruikelijk") in plaats van H3 ("Adres controleren"). De uitwijkregel staat wel in §18.1.7, maar pas vóór U4 blijkt welke gebouwd moet worden.
   Voorstel: U0.2 (b) nu doen (één verzoek, zelfde werkwijze als P0), zodat er één route gebouwd wordt.

10. [AANBEVELING] Uitrol U0.1 en U5 (TD r5 §18.16).
    - **U0.1:** de tijden 22:00/07:45 zijn Jurgens besluit (V-49, met de toevoeging "nog te bevestigen"), dus geen stille aanname, en een controle vóór U4 is verdedigbaar. Maar een afwijking na het bouwen betekent een wijzigingsverzoek en herwerk van constanten, teksten en AC's. Vraag Jurgen de blik op de pagina nu al, in hetzelfde bericht als bevinding 6.
    - **U5:** een blokkade van Vercel blijkt pas nadat U4 de code live heeft gezet. Leg vast wat er dan met de live functie gebeurt: er wordt niets bewaard en de beheerder ziet F. Kies vooraf: laten staan tot Jurgen kiest uit (a)/(b)/(c) in §18.1.7, of de sectie verbergen. Vermeld dit in het totaalvoorstel.

11. [AANBEVELING] Prototype `w03-07` (H2): onder "Volgende ophaaldagen · stand ma 12 okt" staat drie keer "nog geen ophaaldag bekend".
    Volgens BR-52 en TD §18.8.4 blijven bij `SUSPECT_EMPTY` de bewaarde datums staan. Na een geslaagde bijwerking op 12 okt met komende datums (anders was het geen succes) toont H2 dus gewoon die datums. Het beeld kan een bouwer op het idee brengen de lijst bij een leeg antwoord te wissen.
    Voorstel: het prototype aanpassen met bewaarde datums, of in de §12-regel van de DS noteren dat het beeld alleen de balk illustreert.

12. [AANBEVELING] `probe/P0-uitkomst.md` noemt het opruimen (id 4–11), maar niet de controle "rechten op `net` vóór = na" (L4 deel 1, TD r4 §18.1.6). Het tweede deel (`net` niet exposed) is door Jurgen bevestigd (PROGRESS, D-046). Voeg één regel toe, of noteer dat P0.0b niet is uitgevoerd.

## Opgelost sinds vorige ronde
- **1. P0 niet uitgevoerd** → opgelost.
  - P0 is op 2026-09-29 uitgevoerd, met toestemming van Jurgen en alleen het openbare testadres. Er is een verslag en een fixture, en de antwoordrijen zijn opgeruimd.
  - De uitkomsten zijn verwerkt: `bagId`-vorm in zod en `CHECK`, parser met strippen, `classifyStream`-tabel, onbekend adres = `[]`, J+1 = `[]`.
  - P0 dwong een inhoudelijke correctie af (4-wekelijks papier gaf vals alarm). Die is doorgevoerd in de leeg-regel (`hasNoUpcoming`, r5), en de jaareinde-uitzondering (r6/r4c) sluit het gat eind november.
  - Wat overblijft (gemeentetijden en Vercel-bereikbaarheid) staat als controle U0.1/U5 met een beslisregel. De administratie loopt nog achter (bevinding 5).
- **2. TD volgt UX/AC niet** → opgelost.
  - §18.11 gebruikt alleen tekst-ID's: `saved.mode` → T-90/T-90b/T-91/T-92, `too_soon` → T-79 in de balk, T-65, F2 met T-64/T-64b, H1/H2/H3 per `last_error_code`.
  - AC-236/AC-237 staan in de Basis, §15 en §18.15.
  - Er is één lijst in U3, maar die is nog niet volledig (bevinding 4).
- **3. DS en screenshots achter op UX** → opgelost.
  - DS r2/r3: `too_soon` in de balk, T-45b, D zonder rode rand (ook in de oude UI), F2/H1/H2/H3 beschreven (H3 met twee tekstknoppen), §8-regel met leeg antwoord en "zonder foutcode", T-90/T-90b.
  - Op beeld nagekeken: w03-01 (T-52 nieuw), w03-02 (T-46 nieuw, "Den Haag"), w03-05 (T-75/T-76/T-78), w03-07 (T-77/T-77b, T-79 in de balk), w03-08 (H3), w03-09 (T-64 nieuw), w03-10 (D zonder rand), w03-11 (G′ + T-45b).
  - Geen vervallen tekst gezien, geen rood bij storingen, rustig en consistent met het design system. Eén verouderde verwijzing (bevinding 3) en één beeldpunt (aanbeveling 11).
- **4. Storing zonder foutcode** → opgelost. UX §13.8.2/§13.10 (H1 en M-03), TD `wasteFailureVariant(null)`, AC-205 (c) en BR-52.
- **5. T-52** → opgelost ("twee keer per dag, 's ochtends en aan het eind van de middag"), ook in w03-01.
- **6. Meetfout alarm** → opgelost.
  - `last_failure_at` wordt alleen door `waste_sync` gezet, en de gezondheid negeert `last_attempt_at` ("een claim is geen uitkomst").
  - Er zijn checks, en tests voor "claim zonder uitkomst na één leeg antwoord → geen `failed`" en "geen flitsende H2".
- **7. (aanb.) Januari: E in plaats van F2** → opgelost (AC-186/AC-237: in januari altijd F2). Het C(J−1)-verzoek is daardoor overbodig geworden (aanbeveling 7).
- **8. (aanb.) Balk verdwijnt zonder herstel** → opgelost (`alarm_since`; BR-52, AC-205, UX §13.7.5 en DS).
- **9. (aanb.) Onbereikbare E2E-scenario's** → opgelost (AC-205 zonder "Opnieuw proberen"; AC-236-regel als unittest).
- **10. (aanb.) Bovengrens binnenzetten** → in BR-54/AC-210/TD opgelost (D+7), maar UX zegt D+2 (bevinding 1).
- **11. (aanb.) Punten voor het totaalvoorstel** → opgelost als plan: architect r4 (onofficiële bron, adrescode, restgrens, noodterugrol en notities, D+7, balk tot herstel) en analist-interpretaties 1–20.

Nagelopen en in orde:
- **Leeg-regel** (`hasNoUpcoming` + `classifyEmpty`) is gelijk in BR-52/AC-204 (r4c) en TD r6 §18.8.4, met de P0-regressies 5 okt en 26 nov (de fixture bevat 27-10 en 24-11, 2027 `[]`).
- **J+1** ook zodra C(J) geen komende datum meer heeft.
- **T-90/T-90b** zijn gelijk in UX r4, TD r6 §18.11/U3 en DS r3.
- **T-64/T-64b** "rond de jaarwisseling" staan in UX r4, het prototype en de samenvoegregel voor TD r6 regel 49.
- **G″/T-73** in november en december zijn gelijk in UX-aanvulling r6, AC-220 (r4c) en TD r6 §18.8.5.
- **H1/H2/H3 en M-03/M-04/M-05** zijn gelijk in UX, AC-205 en TD.
- **AC-205 (b)**: 06:00/07:15 klopt met `dueForFetch` (> 60 min, tick per kwartier) en `last_failure_at − error_since ≥ 60`.
- **AC-217** verwijst alleen naar TD §18.16 U3.

## Onbevestigde aannames
- **Adrescode (`bag_id`) bewaren** — raakt: **gegevens**. Niet door Jurgen bevestigd (bevinding 6).
- **Gemeentetijden 22:00/07:45** — raakt: businessregels en UX. Wel Jurgens besluit (V-49, wetend dat het nog bevestigd moest worden), dus geen stille aanname. De controle is U0.1 (aanbeveling 10).
- **Bereikbaarheid vanaf Vercel `fra1`** — raakt: **scope**. De restgrens is pas bij U5 zichtbaar. Aanvaardbaar via de beslisregel, mits Jurgen het in het totaalvoorstel hoort (staat in de lijst van de architect) en het gedrag van de live code bij een blokkade is vastgelegd (aanbeveling 10).
- **Gedrag van B bij een onbekende `bagId`** — raakt: geen rechten, gegevens of scope. Wel de juiste balk (H3 tegenover H2) (aanbeveling 9).
- **Interpretaties 1–20 van de analist**, waaronder D+7 (nr. 18), "balk tot herstel" (nr. 19) en de jaareinde-uitzondering (nr. 20) — raakt: UX. Noemen in het totaalvoorstel. De D+2/D+7-keuze moet eerst eenduidig zijn (bevinding 1).

## Conclusie
DESIGN FREEZE MOGELIJK: NEE
Reden: Inhoudelijk is W-03 nu sterk:
- P0 is gedaan en verwerkt;
- de alarmregel meet de juiste tijd;
- TD, DS en prototype volgen UX;
- het valse alarm bij 4-wekelijks papier en rond het jaareinde is weg.

Er staan nog zes moet-punten open, allemaal klein maar bindend:
- tegenspraak D+2/D+7 (bevinding 1);
- verouderd randgeval in §6 (bevinding 2);
- een samenvoeginstructie die niet zonder interpretatie in te voegen is (bevinding 3);
- een onvolledige CP-W03-lijst (bevinding 4);
- PROGRESS loopt achter op P0 (bevinding 5);
- de adrescode is nog niet door Jurgen bevestigd (bevinding 6).

Voor ronde 4:
- per document één samengevoegde invoegtekst met de herstelde punten 1–4;
- PROGRESS bijgewerkt;
- Jurgens antwoord over de adrescode (en bij voorkeur ook U0.1).
