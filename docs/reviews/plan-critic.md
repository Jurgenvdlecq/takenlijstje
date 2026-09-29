# Plan-critic — W-03 afvalkalender — ronde 4 — 2026-09-29

> Deze beoordeling gaat alleen over wijzigingsverzoek **W-03 (afvalkalender, WP3b en de W-03-regels voor WP4–WP9)**. De eerdere W-03-rondes 1, 2 en 3 (alle drie NEE), en de rondes van het hoofdontwerp (laatste: ronde 4, JA), staan in de git-geschiedenis van dit bestand.

Gelezen:
- samenvoeginstructie `docs/wijzigingen/W-03/samenvoegen.md`;
- de vier samengevoegde invoegteksten, volledig:
  - `samengevoegd/PRODUCT_SPEC-en-ACCEPTANCE_CRITERIA.md`;
  - `samengevoegd/UX_SPEC.md`;
  - `samengevoegd/TECHNICAL_DESIGN.md`;
  - `samengevoegd/DESIGN_SYSTEM.md`;
- probe: `probe/P0-uitkomst.md` (P0 en U0.2, `{}` bij een onbekende adrescode, rechten vóór = na);
- `docs/PROGRESS.md` ("Antwoorden van Jurgen", "Open vragen", "Volgende stap", "Wijzigingsverzoeken");
- ter controle van de doelplekken in de bevroren documenten: `docs/PRODUCT_SPEC.md` (§5–§13), `docs/ACCEPTANCE_CRITERIA.md` (Bronnen, Afspraken, WP-koppen, Dekking), `docs/DESIGN_SYSTEM.md` (§7.10, §7.12, §8, §12), `docs/TECHNICAL_DESIGN.md` (§2, §3.2, §5.2, §5.3, §6.5, §10, §11, §12.3.1, §15, §17);
- ter controle van de verlopen-tekst: `src/domain/status.ts` (`durationText`);
- screenshot, met Read bekeken: `docs/screenshots/prototype/w03-07-storing-leeg-te-snel-390x844.png` (vernieuwd). Aanwezig: alle 15 w03-screenshots (11 licht, 4 donker).

## Bevindingen

1. [MOET VÓÓR BOUW WORDEN OPGELOST] PRODUCT_SPEC BR-52 en ACCEPTANCE_CRITERIA AC-204/AC-205 tegenover TD §18.8.4 en §18.8.6: wat er tijdens een hapering of storing met de afvaltaken gebeurt.
   - **PS/AC zeggen:**
     - BR-52 (onbereikbaar en leeg antwoord): "de afvaltaken, het adres en de bekende ophaaldagen blijven ongewijzigd";
     - BR-52: "**Lukt het weer**, dan … wordt de planning aangevuld";
     - AC-204: "DAN verandert er niets aan de afvaltaken";
     - AC-205: "Lukt het bijwerken weer, dan … worden de taken aangevuld".
     Samen lezen die als: tijdens een storing komen er geen taken bij.
   - **TD zegt:**
     - §18.8.6: "plannen met de effectieve datums: de nieuwe bij succes, anders de **bewaarde**";
     - §18.8.4: "de planning draait door op de bewaarde datums".
     Tijdens een storing komen er dus wél taken bij, voor al bekende ophaaldagen die binnen de 14 dagen vallen. Ook het vanzelf vervallen (BR-54) loopt gewoon door, en dat wijzigt afvaltaken ook.
   - TD §18.15 rij 204 (Int) toetst "taken … gelijk", terwijl de eigen planningsregel dat alleen waarmaakt als er geen bewaarde datum het venster in schuift.
   Gevolg: de test-writer toetst AC-204 letterlijk ("er komt geen taak bij") en de bouwer volgt TD, of andersom. Volgt iemand de PS-lezing, dan ontbreekt bij een storing van een paar dagen de taak voor een ophaaldag die de app al kende. Dat is precies de "stil ontbrekende ophaaldag" uit succescriterium 3.
   Nodig: de analist maakt de tekst precies, in lijn met TD (dat is het veilige gedrag, en het is geen gokken, want de datums komen van de gemeente):
   - BR-52 en AC-204: "bestaande afvaltaken worden niet verwijderd, verschoven of hernoemd; voor al bekende ophaaldagen die binnen de 14 dagen komen, worden wel taken klaargezet (BR-50); vervallen volgens BR-54 loopt door";
   - "wordt de planning aangevuld" (BR-52) en "worden de taken aangevuld" (AC-205) worden: "worden wijzigingen van de gemeente verwerkt";
   - architect: §18.15 rij 204 (Int) wordt "geen taak verwijderd, verschoven of hernoemd", met een geval "bewaarde datum schuift tijdens een storing het venster in → taak wordt klaargezet".
   Geen vraag voor Jurgen. Wel één zin in het totaalvoorstel: "Tijdens een storing blijven de taken voor al bekende ophaaldagen gewoon verschijnen."

2. [MOET VÓÓR BOUW WORDEN OPGELOST] Bewaren van de adrescode (`bag_id`), V-58 (eerder punt 6). De vraag is aan Jurgen gesteld; het antwoord is er nog niet.
   - De invoegteksten zijn hierop voorbereid:
     - `[OPEN: V-58]` staat in TD (Basis, §18.3.1, §18.12, §15, §3.1, §17);
     - TD §18.3.1 beschrijft de "nee"-route technisch;
     - de controlelijst van de analist noemt per antwoord wat er in PS en AC moet veranderen.
   - Zolang het antwoord ontbreekt:
     - raakt dit **gegevens** en is het onbevestigd;
     - staan er `[OPEN]`-markeringen in tekst die bevroren moet worden;
     - is de "nee"-route in PS/AC nog niet uitgeschreven. De analist zegt zelf: "dan volgt een nieuwe korte ronde".
   Nodig:
   - antwoord van Jurgen, letterlijk in PROGRESS ("Antwoorden van Jurgen"), met het nummer V-58;
   - **bij "ja":** markeringen vervangen en de V-58-rijen toevoegen, precies zoals de controlelijst van de analist en de TD-statusregel ("Na het antwoord op V-58 …") aangeven. Daarna volstaat een korte ronde 5 die alleen die verwerking en bevinding 1 nakijkt;
   - **bij "nee":** eerst een ronde van analist en architect (BR-56, BR-58, §8, AC-190/212/213/216/218, BR-52/AC-204 (c)), daarna opnieuw de plan-critic.

3. [AANBEVELING] Verlopen-tekst van binnenzetten op D+1: TD §18.16 U3 punt 34 en DS §7.13.6 ("Controle bij CP-W03") tegenover DS §7.13.3 en UX §13.4.
   - U3 punt 34: "Vandaag wo (D+1): binnenzetten … met '1 dag te laat'".
   - DS §7.13.6: "binnenzetten bij Verlopen toont '1 dag te laat' op D+1".
   - DS §7.13.3 en UX §13.4: "9 uur" / "te laat" op D+1.
   - De bestaande code (`durationText` in `src/domain/status.ts`) toont op woensdag 09:00 "9 uur te laat". "1 dag" verschijnt pas vanaf ongeveer 23:30. Dit komt uit mijn eigen formulering in ronde 3.
   Voorstel: in U3 punt 34 en DS §7.13.6 een tijdstip noemen, bijvoorbeeld "wo 09:00: '9 uur te laat'" (of "do 09:00: '1 dag te laat'"). Dan kan visual-qa correcte code niet als fout aanmerken. Dit kan in dezelfde bewerking als bevinding 2.

4. [AANBEVELING] Metatekst die in de bevroren documenten terecht zou komen:
   - UX §13.17: de kop "(definitieve nummering: analist r3 met r4, r4b en r4c)" en de slotzin "In §13 staat geen enkele verwijzing naar de nummering van ronde 1." Voorstel: de kop wordt "Verwijzingen naar acceptatiecriteria (ACCEPTANCE_CRITERIA WP3b en WP4–WP9)", en de slotzin vervalt;
   - TD §18: de zin "Deze sectie vervangt de concepten … r1 t/m r6. De verschillen staan in §18.17." en de hele §18.17 (versiegeschiedenis per ronde). Dat is niet fout, want de bestanden blijven als archief bestaan, maar het hoort eerder in git of DECISIONS dan in een bevroren ontwerp. Voorstel: §18.17 inkorten tot de tabel "r6 → samengevoegde tekst", of weglaten;
   - DS: de zin "Er zijn vijf blokken" moet "zeven blokken (1a–1c, 2, 3, 4a–4b)" zijn. Blok (4b) laat een keuze open ("Zet je liever het volledige pad neer …"): kies er één, bijvoorbeeld `docs/prototype/w03/`.

5. [AANBEVELING] UX §13.7.5, kop "Storing": de omschrijving "minstens twee vastgelegde antwoorden achter elkaar zonder enige komende ophaaldag" mist "met minstens een uur tussen het eerste en het laatste" en "buiten het jaareinde". BR-52 en TD §18.8.5 zijn wel volledig, en de UX verwijst ernaar. Voorstel: aanvullen, of vervangen door "zie BR-52".

6. [AANBEVELING] `docs/PROGRESS.md`, sectie "Open vragen":
   - V-48…V-57 staan daar nog als open, maar zijn beantwoord (zie "Antwoorden van Jurgen");
   - V-58 (adrescode) en U0.1 (gemeentetijden, door de architect als V-59 voorgesteld) staan er niet, terwijl ze wel zijn gesteld;
   - de regel onder "Wijzigingsverzoeken" noemt nog "plan-critic ronde 3: NEE".
   Voorstel: bijwerken bij het vastleggen van het antwoord op V-58.

## Opgelost sinds vorige ronde
- **1. D+2 tegenover D+7** → opgelost.
  - UX §13.4 (tabelrij en bullet "Bovengrens", met di 13 okt 00:00), §13.7.4, §13.15 en §13.17 noemen D+7.
  - D+7 staat ook in BR-54, BR-59, AC-210 (6 okt → 13 okt, klopt), AC-234, de §6-rij "Binnenzetten vergeten", DS §7.13.3 en TD (`WASTE_IN_EXPIRE_DAYS = 7`, `vandaag ≥ D + 7`).
  - Nergens staat nog D+2.
- **2. §6 jaarwisseling en interpretatie 3** → opgelost.
  - De oude rij is vervangen door twee rijen: november/december met T-73 en geen storing, en december met een venster over de jaargrens.
  - De rij "Leeg antwoord" zegt "(buiten het jaareinde)".
  - Interpretatie 3 verwijst naar nr. 20.
  - Het gedrag is gelijk in BR-48, BR-52, AC-204, AC-220, AC-237, UX §13.7.5/§13.8.1 G″ en TD `classifyEmpty` stap 3.
- **3. Eén invoegtekst per document** → opgelost.
  - Er zijn vier bestanden (PS en AC samen, met aparte blokken), met per blok een doelplek. Alle doelplekken die ik heb nagekeken, bestaan letterlijk in de bevroren documenten.
  - AC-183 heeft (a) en (b). AC-237 verwijst naar AC-183 (b), zonder (c).
  - TD §10 zegt "P0 uitgevoerd", `classifyEmpty` staat in §18.2 en rij 204 is per functie uitgeschreven.
  - De DS verwijst naar TD §18.16 U3.
  - De delen 1b, 2a, 2d (PS/AC) en (C) (TD) zijn meegenomen.
  - Wat overblijft is kleine metatekst (aanbeveling 4).
- **4. CP-W03-lijst** → opgelost.
  - U3 heeft 41 punten: laden (1), laden mislukt (2), "Toch nog doen" zonder leeg menu (38), Verlopen op D+1 (34; zie aanbeveling 3 voor de tekst), H2 → H1 zonder tweede melding (26), plus T-90b en de eerstvolgende dag over 3 weken (9, 29), en bewaarde datums bij H2 (21).
  - De WP7-regel in §15 herhaalt punt 1–30 in de nieuwe UI.
- **5. PROGRESS achter op P0** → opgelost.
  - "Ja, probeer maar" staat letterlijk onder de antwoorden.
  - P0 en U0.2 staan als afgerond.
  - U0.1 en U5 staan als open controles in "Volgende stap". Kleine administratieve rest in aanbeveling 6.
- **6. Adrescode** → vraag gesteld, antwoord open (bevinding 2).
- **Aanbeveling 7 (C(J−1) schrappen)** → overgenomen. Er is één veld `hadAnyDateInJ`, januari geeft altijd F2, en de stub-teller toetst "geen `/kalender/<J−1>`".
- **Aanbeveling 8 (J+1 met alleen kerstbomen)** → overgenomen: `nextYearHasDate`, AC-220 (c), unittest (e) en een stub-scenario.
- **Aanbeveling 9 (onbekende adrescode)** → U0.2 uitgevoerd: B geeft `{}`. Dit is verwerkt in de parser (`z.strictObject({})` → `NOT_FOUND`, een niet-leeg object → FORMAT), in BR-52, AC-204 (c), de AC-205-tabel en de regressietoets. De uitwijkregel is vervallen.
- **Aanbeveling 10 (U0.1/U5)** → vastgelegd.
  - U0.1 wordt bij voorkeur vóór `/design-go` gevraagd.
  - Bij een U5-blokkade blijft de functie uit, zonder adres, terugrol of vlag. Het wijzigingsverzoek heeft de opties (a)/(b)/(c), en dit staat klaar voor het totaalvoorstel.
- **Aanbeveling 11 (w03-07)** → opgelost.
  - Het screenshot toont onder "Volgende ophaaldagen · stand ma 12 okt" drie bewaarde datums (PMD vr 16 okt, Restafval di 20 okt, Papier wo 4 nov). De balk is grijs zonder rood, met T-79 in de balk en geen melding onderin.
  - Het beeld klopt nu met UX §13.8.2, DS §7.13.4 en TD §18.6/§18.11.
- **Aanbeveling 12 (rechten vóór = na)** → opgelost in `P0-uitkomst.md` en TD §18.1.6.

Nagelopen en in orde:
- **Datums in de voorbeelden** kloppen met de kalender: di 6 okt 2026, di 27 okt, di 24 nov, do 26 nov, vr 25 dec, wintertijd zo 25 okt, ma 29 mrt 2027.
- **Tijden in AC-203 en AC-205 (b)** kloppen met `dueForFetch` (> 60 min, tick per kwartier) en de 90-minutenregel.
- **Rechten:**
  - `waste_calendars` alleen select voor beheerders;
  - `waste_calendar_enabled()` alleen voor het eigen lidmaatschap (AC-190: Bas ziet niets);
  - guard, policies en `delete_task` voor afvaltaken;
  - hercontrole van de beheerder in `waste_save`;
  - `last_failure_at`/`alarm_since` alleen via de service role.
  Dit is gelijk in PS §7, UX §13.12, AC-189/190/208/219 en TD §18.5.
- **Tekst-ID's** zijn gelijk in UX §13.16, AC, TD §18.11 en DS: T-64 "rond de jaarwisseling", T-77a/b per maand, T-90/T-90b, T-45a "Den Haag", T-73 november/december.
- **Oude UI** is gelijk in UX §13.13.1, DS §7.13.6, TD §18.14 en AC-217: het ⋯-menu met alleen de toegestane acties plus "Toch nog doen", en D zonder rode rand.

## Onbevestigde aannames
- **Adrescode (`bag_id`) bewaren** — raakt: **gegevens**. De vraag ligt bij Jurgen (bevinding 2).
- **Gemeentetijden 22:00/07:45** — raakt: businessregels en UX. Dit is Jurgens besluit (V-49), met een controle U0.1 en een stoppunt bij een afwijking. Geen stille aanname.
- **Bereikbaarheid vanaf Vercel `fra1`** — raakt: **scope**. Aanvaardbaar, want het gedrag bij een blokkade ligt vast (de functie blijft uit, zonder gegevens, en er komt een wijzigingsverzoek), mits het in het totaalvoorstel staat.
- **Doorplannen op bewaarde datums tijdens een storing** — raakt: UX, en indirect de gegevens van het gezin (welke taken er zijn). Nu tegenstrijdig vastgelegd (bevinding 1). Na het rechttrekken is het een uitvoeringsregel binnen BR-50/BR-52, te noemen in het totaalvoorstel.
- **Interpretaties 1–20 van de analist** — raakt: UX. Ze staan apart, voor het totaalvoorstel.

## Conclusie
Reden: de moet-punten 1 tot en met 5 van ronde 3 zijn opgelost, en de vier invoegteksten zijn nu bijna letterlijk invoegbaar en onderling consistent. Er staan nog twee moet-punten open:
- een tegenspraak tussen PS/AC en TD over het doorplannen tijdens een storing (bevinding 1, één tot drie zinnen per document);
- het ontbrekende antwoord van Jurgen over de adrescode, waarvoor nog `[OPEN]`-markeringen in de te bevriezen tekst staan (bevinding 2).

Na herstel van bevinding 1 en een "ja" op V-58 (verwerkt zoals al beschreven) volstaat een korte ronde 5.

DESIGN FREEZE MOGELIJK: NEE
