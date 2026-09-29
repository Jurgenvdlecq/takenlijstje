# Plan-critic — W-03 afvalkalender — ronde 2 — 2026-09-29

> Deze beoordeling gaat alleen over wijzigingsverzoek **W-03 (afvalkalender, WP3b en de W-03-regels voor WP4–WP9)**. Ronde 1 van W-03 (NEE, 9 moet-punten en 8 aanbevelingen) en de rondes van het hoofdontwerp (laatste: ronde 4, JA) staan in de git-geschiedenis van dit bestand.

Gelezen:
- concepten `docs/wijzigingen/W-03/`: `product-analyst-r3.md` (volledig: PRODUCT_SPEC §14 met BR-47…BR-59, aanvullingen §5–§13, AC-183…AC-237, dekking, controlelijst), `product-designer-r2.md` (volledig: UX §13 r2 met tekstentabel §13.16 en §13.17), `solution-architect-r3.md` (volledig: TD §18 r3, §15-regels WP3b en WP4–WP9, deel C en D), `visual-designer-r1.md` (DS-aanvulling, ongewijzigd sinds ronde 1);
- `docs/PROGRESS.md` (V-41…V-57, WP3 live sinds 2026-09-29 met `planner.sql`, pg_net in `extensions`, restpunt L3/L4), `docs/DECISIONS.md` D-040…D-046;
- bestaande documenten op aansluiting: kopjesstructuur van `PRODUCT_SPEC.md` (§0–§13), `UX_SPEC.md` (§0–§12), `DESIGN_SYSTEM.md` (§7.10–§7.12, §8, §12, §13), `TECHNICAL_DESIGN.md` (§15 volledig, §17 laatste sectie), `ACCEPTANCE_CRITERIA.md` (hoogste nummer AC-182, WP-secties), en "vergeten" in PRODUCT_SPEC/UX/TD (BR-16, Overzicht);
- screenshots (met Read bekeken): `docs/screenshots/prototype/w03-01`, `w03-02`, `w03-03`, `w03-04`, `w03-05`;
- controle: `docs/wijzigingen/W-03/probe/` bestaat niet; P0 is dus nog niet uitgevoerd.

## Bevindingen

1. [MOET VÓÓR BOUW WORDEN OPGELOST] TD §18.1.6/§18.16 (P0), PRODUCT_SPEC §9 "Beslisregel na P0" — de bron is nog steeds door niemand gezien, terwijl de probe nu wél kan.
   Wat goed is: P0 staat als harde eerste stap vóór elke migratie, code en UI. De beslisregel (TD §18.1.7 en PRODUCT_SPEC §9) is concreet, legt vooraf vast wat een uitvoeringskeuze is en wat stoppen-en-naar-Jurgen is, en maakt de restgrens eerlijk zichtbaar (de IP-adressen van Vercel zijn niet exact die van pg_net; dat blijkt pas bij U5). Het grootste risico uit ronde 1, "alles bouwen en dan pas ontdekken dat de bron niet werkt", is daarmee weg.
   Wat nog niet goed is: sinds 2026-09-29 staat pg_net op live (PROGRESS, WP3 livegang deel 2). Route (b) is dus nu uitvoerbaar, vóór `/design-go`, met alleen leesbare verzoeken en schrijfwerk in `docs/wijzigingen/W-03/probe/` (dat mag de poort vóór de freeze). De kosten zijn ongeveer een uur. Toch ligt het plan klaar om te bevriezen op een aanname die **scope** (is de functie haalbaar en toegestaan) en **gegevens** raakt (wat er naar buiten gaat, wat er bewaard wordt, het BAG-formaat als `CHECK`), en op gemeentetijden die in BR-49, AC-192, T-16/T-17/T-21/T-22 en M-01 staan.
   Antwoord op de vraag "mag de freeze met P0 als harde eerste bouwstap en een vooraf vastgelegde beslisregel?":
   - **Als terugvaloptie: ja, verantwoord.** Er wordt niets gebouwd vóór P0, dus een stoppunt kost na de freeze alleen een wijzigingsverzoek en een nieuwe `/design-go`, geen weggegooid werk. Voor de restgrens (blokkade alleen van Vercel-IP's, pas zichtbaar bij U5) is dit ook de enige redelijke aanpak.
   - **Als standaardroute: nee, niet nu.** P0 is goedkoop en nu mogelijk. Bevriezen vóór P0 betekent bewust tekenen voor een document dat misschien direct na de freeze al niet meer klopt (vooral de tijden 22:00/07:45 en het adrescodeformaat). Dat gaat in tegen "eerst begrijpen, dan ontwerpen". Mijn regels laten ook geen JA toe zolang een onbevestigde aanname scope of gegevens raakt.
   Gevolg: bevriezen vóór P0 geeft een reële kans op een wijzigingsverzoek op dag 1, en de tijden in bevroren BR's, AC's en teksten zijn nooit aan de bron getoetst.
   Nodig:
   - P0 nu uitvoeren (P0.1–P0.6), met het verslag in `docs/wijzigingen/W-03/probe/`, en de uitkomsten volgens §18.1.7 in de concepten verwerken;
   - het uitgaande verzoek vanuit productie in één zin bij Jurgen melden, zoals de architect voorstelt. Het is geen databasewijziging, dus het valt niet vanzelf onder de toestemming "wijzigingen aan de live database";
   - de controle "na afloop L4 (D-042: geen `execute` op `net.*`)" in TD §18.1.6 klopt niet meer. Volgens D-046 zijn die rechten op live niet in te trekken, en hebben `anon`/`authenticated` zelfs SELECT op `net._http_response`. Formuleer de controle zoals in D-046 (`net` niet bij de exposed schemas), en voer P0.6 (opruimen op id) direct na het lezen uit;
   - kan P0 om een onvoorziene reden niet vóór de freeze, dan is bevriezen een expliciete keuze van Jurgen in het totaalvoorstel ("ik accepteer dat een stoppunt uit de beslisregel na de freeze een wijzigingsverzoek wordt"), vastgelegd in PROGRESS. Het is dan geen stille aanname.

2. [MOET VÓÓR BOUW WORDEN OPGELOST] TD §18.11, §18.15 (rij AC-222), §18.16 (U3) en §15 (WP3b-regel) volgen UX r2 en analist r3 nog niet. De architect schreef r3 vóór die twee rondes.
   - §18.11: `saved`/`saved unchanged` → "toast 'Opgeslagen'". UX en AC zeggen T-90 (aanzetten), T-91 (nieuw adres) of T-92 (hetzelfde adres).
   - §18.11: `too_soon` → "toast". UX §13.7.6 en AC-236 (c) zeggen uitdrukkelijk: regel T-79 **in de balk, geen melding onderin**.
   - §18.11: "Fout bij opslaan" → T-65. `no_upcoming` → "rij no_upcoming" → toestand F2 (T-64/T-64b).
   - §18.15, rij 222: E2E "toast 'Opgeslagen'" → T-92.
   - §18.16 U3 vraagt screenshots van "toasts (opgeslagen, `too_soon`, …)". Die `too_soon`-toast bestaat volgens UX niet.
   - §15 WP3b-regel en de "Basis" van §18 noemen "AC-183…AC-223". AC-236 ("Opnieuw proberen") en AC-237 (instellen zonder komende ophaaldagen) ontbreken, en §18.15 heeft voor die twee geen testregels (bijvoorbeeld claim → `too_soon`, T-78 na mislukking; `isWindowEmpty` bij lookup → `no_upcoming`).
   - Twee lijsten voor CP-W03: UX §13.13.3 en TD §18.16 U3 zijn niet gelijk. UX mist onder meer H2, G″ (december), offline, "opslaan mislukt" en de meldingenlijst. TD mist "H na nog steeds fout" en I bij n = 0 niet, maar noemt H per `reason` (`stale`/`empty`) in plaats van per `last_error_code` (H1/H2/H3). AC-217 verwijst naar beide.
   Gevolg: de bouwer en de test-writer vinden in het bevroren TD een andere terugkoppeling dan in UX en de AC's (toast tegenover regel in de balk). visual-qa krijgt twee verschillende checkpointlijsten, en voor twee WP3b-criteria is geen test gepland.
   Nodig: een korte r4 van de architect die §18.11, §18.15 en §18.16 U3 omzet naar de tekst-ID's en toestanden van UX §13.16/§13.8, AC-236/AC-237 opneemt in §15, de "Basis" en §18.15, en voor CP-W03 één lijst vastlegt: de vereniging van beide, met H1/H2/H3. AC-217 en UX §13.13.3 verwijzen dan naar die ene lijst.

3. [MOET VÓÓR BOUW WORDEN OPGELOST] DESIGN_SYSTEM-aanvulling (`visual-designer-r1.md`) en prototype-screenshots zijn niet bijgewerkt na UX r2. De product-designer vroeg daarom ("KLAAR VOOR VISUEEL ONTWERP, als lichte bijwerking"), maar dat is niet gebeurd.
   Tegenstrijdigheden in de invoegtekst voor DS:
   - §7.13.4: "Te snel (`too_soon`): de melding onderin …". UX §13.7.6 zegt: regel T-79 in de balk, geen melding onderin;
   - §7.13.5: bak zonder datum "geen ophaaldag in de komende weken". UX §13.16 vervangt dat door T-45b "nog geen ophaaldag bekend" en zet de oude tekst bij de vervallen teksten;
   - (5) oude UI, punt 2: "D en validatie: de bestaande foutstijl van `Field`/`Input`". UX §13.8.1/§13.13.1 en DS §7.13.4 zelf zeggen: D zonder rode rand om de velden, alleen de tekststijl van de veldfout. Dit is precies de tegenspraak uit ronde 1, punt 4, die nu in UX is opgelost maar in de DS-tekst niet;
   - F2 (sunken-balk met primaire knop "Adres zoeken"), H2 en H3 (twee tekstknoppen "Adres controleren" en "Opnieuw proberen" in het vlak) zijn in DS §7.13.4 niet beschreven. De regel "geen secundaire knop in `sunken`" laat open hoe H3 eruitziet;
   - §8-regel "Storing externe bron (afvalkalender > 48 uur)": een storing ontstaat ook na een aanhoudend leeg antwoord van ruim een uur (BR-52 b).
   Screenshots met teksten die volgens UX §13.16 vervallen of anders zijn:
   - w03-05: "De site van de gemeente gaf geen antwoord." (vervallen) en "geen ophaaldag in de komende weken" (vervallen); H1 moet T-75/T-76 tonen;
   - w03-02: de oude uitleg met puntkomma ("… huishouden ziet de taken; het adres zien alleen beheerders."), zonder de herinnering van 18:00 (T-46 is anders);
   - w03-01: de uitleg "De avond ervoor komt er een taak buitenzetten …" in plaats van T-52.
   Gevolg: DS en UX spreken elkaar na de freeze tegen over een toestand (too_soon), een tekst en de weergave van D. Jurgen keurt in het totaalvoorstel schermen goed met teksten die niet gebouwd worden, en visual-qa toetst bij CP-W03 tegen een design system dat iets anders zegt dan UX.
   Nodig: een lichte r2 van de visual-designer: de invoegtekst gelijktrekken met UX §13.16/§13.8 (too_soon, T-45b, D zonder rode rand in de oude UI, F2, H2, H3, §8-regel), en w03-01, w03-02 en w03-05 (ook donker) opnieuw renderen met de definitieve teksten. Bekijk ze daarna met Read.

4. [MOET VÓÓR BOUW WORDEN OPGELOST] UX §13.8.2 en §13.10 tegenover TD §18.8.5: een storing zonder foutcode heeft geen balk en geen melding.
   TD §18.8.5 geeft `failed`, reden `stale`, ook "zonder poging (bijv. als de tick stil lag)". Dan is `last_error_code` null. Dat gebeurt bijvoorbeeld als de planner 48 uur niet draaide, of als de ophaalstap steeds wordt overgeslagen omdat de tick al 10 s loopt. UX kiest de balk (H1/H2/H3) en de melding (M-03/M-04/M-05) alleen op `last_error_code`. Voor null is er niets vastgelegd. De analist meldde dit zelf (punt 3), maar de designer heeft het niet verwerkt, en de tick kan in dit geval wel `dispatcher.notify` aanroepen.
   Gevolg: in precies de situatie waarin het meest mis is (de achtergrondtaak ligt stil), kiest de bouwer zelf een tekst, of toont de beheerder een lege of kapotte balk.
   Nodig: de product-designer legt vast dat `last_error_code` null bij `failed` H1 (T-75/T-76) en M-03 gebruikt (voorstel van de analist; de tekst past). Dat komt in §13.8.2 en §13.10, en als geval in AC-205 of §18.15.

5. [MOET VÓÓR BOUW WORDEN OPGELOST] UX §13.16 T-52 en wireframe G: "De app kijkt elke ochtend of de gemeente iets veranderd heeft."
   BR-51, AC-221 en TD §18.8.3 zeggen twee keer per dag (06:00 en 17:00), en na een mislukking elk uur. De tekst die de gebruiker ziet, is dus feitelijk onjuist.
   Gevolg: een bevroren, zichtbare tekst spreekt de businessregel tegen, en de beheerder verwacht een wijziging van de middag pas de volgende ochtend.
   Nodig: T-52 aanpassen, bijvoorbeeld "Taken staan 14 dagen vooraf klaar. De app kijkt 's ochtends en aan het eind van de middag of de gemeente iets veranderd heeft." Neem dit mee in dezelfde korte designerronde als punt 4, en in de nieuwe render van w03-01 (punt 3).

6. [MOET VÓÓR BOUW WORDEN OPGELOST] TD §18.8.5, regel `failed`/`empty`: "`last_attempt_at − error_since ≥ 60 min`" meet de verkeerde tijd.
   `last_attempt_at` wordt door de **claim** gezet (§18.8.3), vóórdat de uitkomst bekend is. `error_since` wordt pas in `waste_sync` bijgewerkt. Twee gevallen gaan daardoor mis:
   - (a) Een poging die na de claim niet tot `waste_sync` komt, bijvoorbeeld door een time-out of afbreken van de server action of de tick, of een onverwachte fout vóór de RPC. Dan staat `last_attempt_at` op 07:15 en `last_error_code = SUSPECT_EMPTY` met `error_since = 06:00`. De volgende tick berekent `failed/empty` en stuurt de storingsmelding, terwijl er maar **één** leeg antwoord was. Dat is in strijd met BR-52 (b) en met "geen storing: één leeg antwoord" in AC-205.
   - (b) In de ≤ 12 s tussen claim en uitkomst geeft `getWasteSettings` al `failed`. Een beheerder die op dat moment de pagina opent, ziet dan kort balk H2.
   Gevolg: een onterecht alarm aan alle beheerders, precies het "alarm na één leeg antwoord" dat de regel moest voorkomen. Omdat de dedupe-sleutel per `last_success_at` is, komt er daarna bij een echte storing ook geen melding meer.
   Nodig: de tijd van het laatste **vastgelegde** lege antwoord gebruiken, niet de claimtijd. Bijvoorbeeld een kolom `last_failure_at`, die alleen `waste_sync` bij `'failure'` zet, met de regel `last_failure_at − error_since ≥ 60 min`. Of laat `waste_sync` de alarmtoestand zelf vastleggen. Voeg in §18.15 bij AC-205 een test toe: "claim zonder uitkomst na één leeg antwoord → geen `failed`".

7. [AANBEVELING] TD §18.8.1, volgorde `no_streams` vóór `no_upcoming`, en `fetchYear` "404 of [] → ok []".
   In januari wordt C(J+1) niet opgehaald. Instellen op bijvoorbeeld 2 januari, als de kalender van het nieuwe jaar nog niet online staat, geeft C(J) = `[]`, dus `hadAnyDate = false` en daarmee `no_streams`. De beheerder ziet dan T-62 ("Gebruiken jullie een ondergrondse container?") in plaats van F2 (T-64, "de kalender van het nieuwe jaar komt meestal eind december online"). De F2-toestand is juist voor dit geval ontworpen.
   Voorstel: `no_streams` baseren op de afvalstromen uit B (rest, papier of PMD staat er niet in), of in januari ook C(J−1) meenemen voor `hadAnyDate`. Zet het geval in de unittest van AC-186/AC-237.

8. [AANBEVELING] TD §18.8.5: na een alarm door een leeg antwoord kan de balk verdwijnen zonder dat het weer gelukt is.
   Scenario: eerst twee lege antwoorden, dus `failed/empty` en een melding. Daarna geeft een poging `UNREACHABLE`. Dan zet `error_since` opnieuw, `failed` vervalt (minder dan 48 uur), en de beheerder ziet alleen de stille regel T-71. Dat is terwijl hij net een storingsmelding kreeg en er niets hersteld is. Het is letterlijk in lijn met BR-52 (b), maar verwarrend.
   Voorstel: `failed` blijft staan tot het eerstvolgende succes zodra het alarm is gegeven. Dat kan bijvoorbeeld afgeleid worden uit het bestaan van de melding met dedupe-sleutel `waste-failed:<last_success_at>`. Leg anders bewust vast dat dit gedrag zo blijft.

9. [AANBEVELING] AC-205 ("leeg om 06:00 en 06:30 … bijvoorbeeld door 'Opnieuw proberen'") en AC-236 ("drie keer 'Opnieuw proberen' binnen een uur maakt een lege-antwoordstoring niet eerder").
   "Opnieuw proberen" bestaat volgens UX alleen in balk H, dus alleen als er al een storing is. In toestand G′ is er geen knop. Het scenario is via de interface niet te bereiken en dus niet als E2E te toetsen.
   Voorstel: formuleer beide als regel-/unittest (`wasteSyncHealth`), zonder "Opnieuw proberen" als oorzaak, of noem een route die wel bestaat (bijvoorbeeld twee beheerders in balk H1 tijdens een 48-uurstoring).

10. [AANBEVELING] BR-54 / TD §18.8.6, vervallen van binnenzetten: "tot de dag van de volgende buitenzet-taak".
    Bestaat er geen volgende buitenzet-taak binnen het venster (een lange pauze, of tijdens een storing zonder nieuwe datums), dan blijft binnenzetten onbeperkt bij Verlopen staan.
    Voorstel: een bovengrens, bijvoorbeeld uiterlijk aan het begin van D+7, of vastleggen dat dit zo bedoeld is.

11. [AANBEVELING] Totaalvoorstel aan Jurgen: naast de 17 interpretaties van de analist en de lijst van de architect ook in gewone taal noemen:
    - dat P0 een verzoek vanuit de live database naar de gemeentesite is, met een openbaar testadres;
    - dat de restgrens (blokkade van alleen Vercel) pas bij zijn eigen rooktest zichtbaar wordt;
    - dat bij een noodterugrol notities bij open afvaltaken verloren gaan (analist punt 17).

## Opgelost sinds vorige ronde
- **1. Probe pas na het bouwen** → deels opgelost. P0 is de harde eerste stap vóór migraties, code en UI, met datacentertoets, gemeenteregel, opruimen en een vooraf vastgelegde beslisregel (TD §18.1.6–§18.1.7, PRODUCT_SPEC §9). De pg_net-zin is gecorrigeerd. P0 zelf is nog niet uitgevoerd: zie bevinding 1.
- **2. Taaknamen met "bak"** → opgelost. BR-49, AC-193 en AC-195 gebruiken T-01…T-14 uit UX §13.3. De aanname in §13 vervalt.
- **3. Letterlijke teksten in BR/AC** → opgelost aan de kant van de analist. UX §13.16 is de enige bron, de BR's en AC's noemen tekst-ID's met letterlijke kopieën, en er is een controlelijst. Nagelopen: T-60, T-62, T-63/T-63b, T-64, T-71/T-71b, T-73, T-75, T-78, T-79, T-81, T-90…T-94 en M-01/M-02 zijn gelijk. De TD- en DS-kant loopt nog achter (bevindingen 2 en 3).
- **4. UX niet gelijkgetrokken** → grotendeels opgelost:
  - "morgen" in §13.4;
  - D en F apart;
  - F2 voor `no_upcoming`;
  - terugkoppeling van "Opnieuw proberen" in de balk;
  - H1/H2/H3 per oorzaak;
  - geen omschrijving;
  - herinneringsrij volgens de eigen instelling.
  Nog open: storing zonder code (bevinding 4) en T-52 (bevinding 5).
- **5. AC-verwijzingen in UX** → opgelost (§13.17). De nummering is in r3 niet verschoven.
- **6. Notities weg bij een verschuiving** → opgelost. Een verschuiving is een update van dezelfde rij (≤ 3 dagen, een gemeenschappelijke bak, doelsleutel vrij), met volgorde remove → move → rename → insert onder het slot. AC-198 toetst notitie en "bezig". De guard laat de service role door.
- **7. Lege-antwoordregel** → opgelost in spec en AC (`isWindowEmpty` zonder "eerder bekend", `error_since` per code, ook bij het instellen). Er is wel een nieuwe fout in de meetregel ontstaan (bevinding 6).
- **8. W-03 in WP4–WP8** → opgelost. Er zijn regels in TD §15 bij WP4–WP9, en AC-224…AC-235.
- **9. Geen beeldreview op WP3b** → opgelost. CP-W03 staat in U3, met visual-qa en ux-reviewer (licht) vóór de livegang, en in AC-217. Er zijn wel twee verschillende lijsten (bevinding 2).
- **10. Terugrollen** → opgelost (`waste_rollback.sql` direct na de rollback).
- **11. Tweede ophaalmoment** → opgelost (06:00 en 17:00, AC-221). T-52 loopt achter (bevinding 5).
- **12. December** → opgelost (`notice`, T-73, AC-220).
- **13. Herinneringsrij** → opgelost (T-25 alleen bij eigen instelling aan, AC-211).
- **14. Bevestigen van hetzelfde adres** → opgelost (zonder claim, T-92, AC-222). TD §18.11 noemt nog "Opgeslagen" (bevinding 2).
- **15. Platformlogs** → opgelost (TD §18.12: Vercel External APIs en `net._http_response`).
- **16. Punten voor het totaalvoorstel** → opgelost als plan (analist, 17 interpretaties; architect, lijst). Aanvulling in bevinding 11.
- **17. Uitzetten met 0 taken** → opgelost (T-81c, AC-213).

Aansluiting op de bevroren documenten (letterlijk invoegen):
- De nummers en koppen botsen niet:
  - PRODUCT_SPEC heeft §0–§13, dus §14 is nieuw;
  - UX_SPEC eindigt op §12, dus §13 is nieuw;
  - TECHNICAL_DESIGN eindigt op §17, dus §18 is nieuw;
  - DESIGN_SYSTEM heeft §7.12 als laatste component, dus §7.13 is nieuw;
  - ACCEPTANCE_CRITERIA eindigt op AC-182, dus AC-183…AC-237 zijn vrij;
  - de WP3b-regel past in de zes kolommen van TD §15.
- "Vergeten = verlopen of overgeslagen" (UX §5, TD `stats.ts`) past bij het vanzelf overslaan uit BR-54.
- Wat na invoegen wél botst, staat in de bevindingen 2, 3, 4 en 5 (TD ↔ UX, DS ↔ UX, T-52 ↔ BR-51).

## Onbevestigde aannames
- **Koppelcontract en toegang tot huisvuilkalender.denhaag.nl** (endpoints, velden, iconen, adrescodeformaat, J+1-gedrag, `robots.txt`/voorwaarden, geen blokkade vanuit het datacenter) — raakt: **scope** en **gegevens**. Op te heffen met P0, dat nu kan (bevinding 1).
- **Gemeentetijden 22:00 en 07:45 voor minicontainers** (alleen via zoekresultaten gezien) — raakt: businessregels en UX (BR-49, AC-192, T-16/T-17/T-21/T-22, M-01). Op te heffen met P0.4.
- **Blokkade van alleen de IP-adressen van Vercel** (restgrens na P0.3) — raakt: **scope**. Pas zichtbaar bij U5; aanvaardbaar via de beslisregel, mits Jurgen dit in het totaalvoorstel hoort (bevinding 11).
- **Adrescode (BAG-id) bewaren naast postcode en huisnummer** — raakt: **gegevens**. Staat als punt voor het totaalvoorstel, maar is door Jurgen nog niet bevestigd.
- **Uitgaand verzoek vanuit de productiedatabase voor P0** — raakt: toestemming en externe partij. Valt niet vanzelf onder "wijzigingen aan de live database"; in één zin melden (bevinding 1).
- **De interpretaties van de analist (1–17)** — raakt: UX. Geen rechten of gegevens, behalve nr. 6 (adrescode, zie hierboven). Noemen in het totaalvoorstel.

## Conclusie
Het plan is inhoudelijk sterk vooruitgegaan: rechten, privacy, idempotentie, verschuiving met behoud van notities, P0 vóór het bouwen en de beeldreview op WP3b zijn goed geregeld, en de analist heeft de teksten sluitend gemaakt. Freeze is toch nog niet mogelijk om drie redenen:
- de concepten van architect en visual-designer zijn niet gelijkgetrokken met UX r2 (toast tegenover balkregel, vervallen teksten in DS en screenshots, AC-236/AC-237 zonder tests);
- er ontbreken twee dingen in UX (storing zonder foutcode, T-52) en de alarmregel heeft een meetfout;
- P0 wordt uitgesteld tot na de freeze terwijl het nu kan, en de aanname over de bron raakt scope en gegevens.

Nodig voor ronde 3:
- P0 uitvoeren en verwerken;
- architect r4 (bevindingen 2 en 6);
- een korte designerronde (bevindingen 4 en 5);
- visual-designer r2 met nieuwe screenshots (bevinding 3).

Bevriezen met P0 als eerste bouwstap is alleen verantwoord als P0 vóór de freeze aantoonbaar niet kan, en dan als expliciete keuze van Jurgen.

DESIGN FREEZE MOGELIJK: NEE
