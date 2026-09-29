## Product-analyse: W-03 afvalkalender, ronde 4b (resterende punten uit r4-D5)
Ik heb niets in bestanden geschreven. Deze teksten komen naast `product-analyst-r4.md`.

**Eén ID-wijziging:** overal waar r4 "T-90, variant bij 0 taken (UX §13.16)" zegt, staat nu **T-90b**. Dat geldt voor BR-48, AC-183, AC-237 en de teksttabel. T-90b heeft geen knop "Bekijken". T-90 geldt alleen als er minstens één taak is klaargezet.

### BR-54 — Verlopen en vervallen (vervangt r3)
- **Buitenzetten:**
  - verlopen na D 07:45 (BR-17);
  - niet afgevinkt aan het einde van D? Dan wordt de taak vanzelf "overgeslagen", en telt hij als vergeten (V-54, vergelijk BR-16);
  - binnenzetten van die dag blijft daarbij gewoon staan.
- **Binnenzetten:**
  - verlopen na het einde van D;
  - blijft bij Verlopen staan tot iemand de taak afvinkt, of tot de dag van de volgende buitenzet-taak begint, en **uiterlijk tot het begin van de zevende dag na de ophaaldag (D+7, 00:00)**. Wat het eerst komt, telt. Dan wordt de taak vanzelf "overgeslagen", en telt hij als vergeten.
  - — waarom: zonder bovengrens blijft binnenzetten bij een lange pauze weken bij Verlopen staan. Voorbeelden: papier eens per 4 weken, of de jaarwisseling.

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

**Regel:** Een lege-antwoordstoring ontstaat alleen door vastgelegde lege antwoorden die minstens een uur uit elkaar liggen; vaker proberen versnelt dat niet (BR-52 b, AC-205). **Toets van deze regel:** Unit.

Offline is de knop uitgeschakeld, met "Hiervoor heb je internet nodig" (T-67).
**Toets:** Unit + Int + E2E

### Interpretaties voor het totaalvoorstel (erbij, na nr. 17)
18. **Vergeten binnenzetten vervalt na hooguit een week.** Een niet-afgevinkte binnenzet-taak blijft bij Verlopen staan tot de dag van de volgende buitenzet-taak, maar nooit langer dan tot het begin van de zevende dag na de ophaaldag. Daarna vervalt hij vanzelf, en telt hij als vergeten. Jurgen noemde alleen het vervallen van buitenzetten.
19. **De storingsbalk blijft tot het herstel.** Is een storing gemeld, dan blijft de balk staan tot het bijwerken weer lukt, ook als de oorzaak intussen verandert. De tekst volgt dan de nieuwe oorzaak.

### Wijzigingslijst ten opzichte van r3 (aanvulling op r4)
| # | Plek | r3 | r4b | Reden |
| --- | --- | --- | --- | --- |
| 22 | BR-54, binnenzetten | "… tot de dag van de volgende buitenzet-taak begint" | + "uiterlijk tot het begin van D+7", "wat het eerst komt", met waarom | r4-D5 (aanbeveling 10) |
| 23 | AC-210 | alleen het geval met een volgende ophaaldag | + geval zonder volgende buitenzet-taak: overgeslagen op D+7 00:00 (6 okt → 13 okt) | r4-D5 |
| 24 | AC-217 | "de lijst in UX §13.13.3 en TD §18.16 U3" | "de lijst in TD §18.16 U3" | r4-D5 |
| 25 | AC-236, laatste alinea | "Drie keer 'Opnieuw proberen' binnen een uur maakt een lege-antwoordstoring niet eerder (AC-205)." | vervangen door de **Regel** (letterlijk zoals opgegeven), toets Unit | r4-D5 (aanbeveling 9) |
| 26 | Interpretaties | — | nr. 18 (D+7) en nr. 19 (balk blijft tot herstel) | r4-D5 |
| 27 | BR-48, AC-183, AC-237, teksttabel | "T-90, variant bij 0 taken" | T-90b (zonder Bekijken); nieuwe tabelrij T-90b: "zie UX §13.16 (BR-48, AC-183, AC-237)" | designer r4 |

### Vragen voor Jurgen
Geen nieuwe.

### Aannames
Geen.

### Status
**KLAAR VOOR PLANREVIEW.** Met r4 en deze r4b zijn alle punten voor de analist uit r4-D5 en r5 verwerkt.

Voor de architect staat nog één punt uit r4 open:
- **Probleem:** een adres waarvan de laatste ophaaldag van het jaar vóór december ligt, zoals het P0-adres (papier tot 24 november), krijgt eind november een onterechte storing.
- **Voorstel:** de kalender van het volgende jaar ook ophalen zodra het lopende jaar geen komende ophaaldag meer heeft.

Bronbestanden:
- /home/user/takenlijstje/docs/wijzigingen/W-03/solution-architect-r4.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-designer-r4.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-analyst-r3.md
