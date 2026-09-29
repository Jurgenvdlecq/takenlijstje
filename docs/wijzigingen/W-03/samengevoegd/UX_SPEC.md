## UX-ontwerp: W-03 afvalkalender, samengevoegde §13 (ronde 5, samenvoeging)
Documenten: niets geschreven, want de bestanden zijn bevroren. Hieronder staat de volledige §13, klaar om letterlijk in te voegen.
- Basis: `/home/user/takenlijstje/docs/wijzigingen/W-03/product-designer-r3.md`.
- Daarop: `/home/user/takenlijstje/docs/wijzigingen/W-03/product-designer-r4.md`, eerst de hoofdtekst (A–C), dan "Controle D1–D4", dan "Aanvulling r6". Bij overlap geldt de laatste.
- Daarop: moet-punt 1 en aanbeveling 11 uit `/home/user/takenlijstje/docs/reviews/plan-critic.md` (W-03 ronde 3).
- AC-verwijzingen gecontroleerd tegen analist r3 + r4 + r4b + r4c, met AC-183 (b) voor T-90b.

**Wireframes:** alleen als tekst (§13.14). Er zijn geen nieuwe HTML-wireframes of screenshots, dus ik heb niets nieuws op beeld beoordeeld.
**Apparaten/viewports:** telefoon 390×844 (V-07), ongewijzigd.
**Kernflow:** aanzetten kost 4 tikken plus typen; een afvaltaak afhandelen 1 tik (2 via de push). Ongewijzigd.

**Plaatsing:** `docs/UX_SPEC.md` heeft nu §0 t/m §12. Deze §13 komt direct na §12 en vervangt niets anders. Kopregel "Versie:" van UX_SPEC eventueel bijwerken; dat laat ik aan de hoofdsessie.

---

## 13. Afvalkalender (W-03)

### 13.1 Uitgangspunten
1. **Niets onthouden, niets instellen.** Je vult één keer het adres in en daarna staan de taken er vanzelf. Er zijn geen instellingen per bak en geen eigen tijden (BR-47).
2. **Een afvaltaak is een gewone taak, met drie verschillen:**
   - het rustige kenmerk "♻ Afvalkalender";
   - een eigen tijd in de rechterkolom ("vanaf 22:00", "vóór 07:45", "vanaf 12:00");
   - minder acties (V-54).

   Afvinken, terugdraaien, bezig, notitie en overslaan werken zoals bij elke taak.
3. **Verbergen, niet uitschakelen.** Verplaatsen, wijzigen en verwijderen kan bij een afvaltaak nooit, dus die knoppen zijn verborgen (§0.6). Eén uitlegregel in het detail zegt waarom.
4. **Het adres zien alleen beheerders** (V-53). In meldingen, pushberichten, historie en taakteksten staat nooit een adres en nooit een naam (BR-58, AC-212).
5. **Eén bron per tijd.** Tijden staan in de rechterkolom (lijst) en in de infolijst (detail), altijd met absolute datums. Afvaltaken hebben geen omschrijving, dus er staat geen vaste tekst die op een andere dag niet meer klopt.
6. **Eerlijk bij storingen, per oorzaak.**
   - Onder de 48 uur staat er alleen een stille regel.
   - Daarboven komen een waarschuwing en één melding aan de beheerders, met een tekst die bij de oorzaak past (V-50, BR-52).
   - Een eenmaal getoonde waarschuwing blijft staan tot het echt weer gelukt is.
   - De laatst bekende ophaaldagen blijven zichtbaar, en voor die datums blijven taken verschijnen; een storing wist niets.
7. **"♻" is een afkorting** in dit document. In de app staat altijd het Lucide-icoon `Recycle`, nooit het teken of een emoji (DS §7.10).

### 13.2 Informatiearchitectuur (aanvulling op §2)
```
Huishouden
├── Afvalkalender (0 of 1; alleen beheerder: postcode, huisnummer, toevoeging, stand van bijwerken)
│     └── Afvaltaken (gewone taken met kenmerk "Afvalkalender", zonder reeks, zonder omschrijving)
│           ├── "… buitenzetten"          (dag vóór de ophaaldag)
│           └── "…bak(ken) binnenzetten"   (ophaaldag, vanaf 12:00)
```
Mentaal model: "De gemeente bepaalt de dag, de app zet de taak klaar, wij vinken af."

### 13.3 Taaknamen (exact; tekst-ID's T-01…T-14 in §13.16)
- Vaste volgorde: restafval, papier, PMD.
- Hoofdletter aan het begin; "PMD" altijd in hoofdletters.

| Bakken op D | Buitenzetten (D−1) | Binnenzetten (D) |
| --- | --- | --- |
| rest | Restafval buitenzetten | Restafvalbak binnenzetten |
| papier | Papier buitenzetten | Papierbak binnenzetten |
| PMD | PMD buitenzetten | PMD-bak binnenzetten |
| rest + papier | Restafval en papier buitenzetten | Restafval- en papierbak binnenzetten |
| rest + PMD | Restafval en PMD buitenzetten | Restafval- en PMD-bak binnenzetten |
| papier + PMD | Papier en PMD buitenzetten | Papier- en PMD-bak binnenzetten |
| alle drie | Restafval, papier en PMD buitenzetten | Restafval-, papier- en PMD-bak binnenzetten |

- **"bak" bij binnenzetten:** de lege bak gaat naar binnen, niet het afval.
- **Enkelvoud bij meerdere bakken:** "Restafval- en papierbak" lees je als "de restafvalbak en de papierbak". De naam is hooguit 47 tekens.
- **Een bak erbij of eraf op D:** de naam van de open taak past zich aan (AC-201).

### 13.4 Tijden en plek in de lijsten (rechterkolom)
Voorbeeld: ophaaldag **di 6 okt** voor restafval en papier. Dit geldt voor Vandaag en Taken › Open.

**Buitenzetten** (gepland op D−1, deadline D 07:45; AC-192):

| Moment | Groep | Rechterkolom | Afvinken |
| --- | --- | --- | --- |
| vóór ma 5 okt | Binnenkort | dagnotatie van D−1: **morgen** (op zo 4 okt) of **ma 5 okt** | ja |
| ma 5 okt, hele dag | Vandaag (gesorteerd op 21:00) | **vanaf 22:00** | ja, niet geblokkeerd |
| di 00:00–07:45, open | Vandaag | **vóór 07:45** | ja |
| di na 07:45, open | Verlopen | bestaand verlopen-patroon, bijv. "1 uur" / "te laat" | ja, telt als te laat |
| einde di, nog open | verdwijnt: vanzelf overgeslagen, telt als vergeten (BR-54, AC-210) | — | — |

**Binnenzetten** (gepland op D, beschikbaar vanaf D 12:00, deadline einde van D; AC-193):

| Moment | Groep | Rechterkolom | Afvinken |
| --- | --- | --- | --- |
| vóór ma 5 okt | Binnenkort | **di 6 okt** | ja |
| ma 5 okt | Binnenkort | **morgen** | ja |
| di vóór 12:00 | Binnenkort, **bovenaan** | **vanaf 12:00** | ja, niet geblokkeerd |
| di vanaf 12:00 | Vandaag | leeg (gewoon vandaag) | ja |
| vanaf wo, open, tot hij vervalt (volgende rij) | Verlopen, bestaand patroon, gerekend vanaf het einde van di: wo 09:00 "9 uur" / "te laat"; vanaf wo ca. 23:30 "1 dag" / "te laat" (dus do 09:00 "1 dag" / "te laat"); daarna "2 dagen" / "te laat", enzovoort | — | ja, telt als te laat |
| begin van de dag van de volgende buitenzet-taak, **en uiterlijk begin van D+7 (di 13 okt, 00:00)**, wat het eerst komt, nog open | verdwijnt: vanzelf overgeslagen, telt als vergeten (BR-54, AC-210) | — | — |

- **Bovengrens voor binnenzetten (D+7):**
  - Een binnenzet-taak staat hooguit tot het begin van de zevende dag na de ophaaldag bij Verlopen. In het voorbeeld is dat tot en met ma 12 okt; op di 13 okt 00:00 vervalt hij.
  - Meestal komt de volgende buitenzet-taak eerder, bij wekelijks restafval al op D+6.
  - De grens is er voor een lange ophaalpauze (papier eens per 4 weken, de jaarwisseling) of een storing zonder nieuwe datums. Een rij die wekenlang rood blijft staan, helpt niemand.
  - Er komt geen melding bij het vervallen.
  - Gelijk aan BR-54, AC-210 en TD §18.8.6 (`WASTE_IN_EXPIRE_DAYS = 7`).
- **"morgen" en niet "di 6 okt" op D−1:** dat is de bestaande dagnotatie van Binnenkort (DS §7.4). Samen met "vanaf 22:00" leest het als "vanavond buiten, morgen binnen". De ophaaldag zelf staat in het detail.
- Er staat **nooit "21:00"** in een rij, kaart of kalendervak. 21:00 is alleen het moment van de herinnering.
- **Kalender** (planning, los van het huidige tijdstip): buitenzetten op D−1 met "vanaf 22:00", binnenzetten op D met "vanaf 12:00". Verlopen volgt het bestaande patroon.
- **Geen deadlinebadges** "verloopt over …" of "uiterlijk morgen" bij afvaltaken (V-50: geen deadline-nadert). Alleen "… te laat" bij Verlopen.
- **Gedaan en overgeslagen:** zoals elke rij. Het kenmerk blijft staan.

### 13.5 Het kenmerk "Afvalkalender"
- **In de rij (2e regel):** `♻ Afvalkalender` in plaats van ritme en categorie. Het is geen badge, geen kleur en geen vlak (DS §7.13.1).
- **Met bezig:** `♻ Afvalkalender bezig`, volgens het patroon van vis-01.
- **Recycle, geen prullenbak:** een prullenbak betekent in deze app "verwijderen", en dat kan hier juist niet.
- **Geen categorie "Buiten" in de rij.** In het categoriefilter valt een afvaltaak wel onder Buiten.
- **In het detail:** de bovenregel `♻ Afvalkalender · ophaaldag di 6 okt`.

### 13.6 Taakdetail van een afvaltaak (aanvulling op §5.5)
**Hoofdactie:** **Afvinken**. Bij een gedane taak staat er "Gedaan om 22:14 · op tijd" met **Terugzetten** (in de oude UI heet die knop "Afvinken ongedaan maken").

**Secundair, direct zichtbaar (nieuwe UI):**
- **Ik ben ermee bezig**, of **Niet meer bezig**;
- **Deze keer overslaan**;
- er is geen ⋯-menu.

**Verborgen voor iedereen, ook voor beheerders (AC-208):** Naar morgen, Andere dag…, Bewerken, Verwijderen, reeksacties en Vorige keren.

**Geen omschrijving.** Afvaltaken hebben een lege omschrijving. Alle tijden staan in de infolijst.

**Infolijst voor buitenzetten:**

| Label | Waarde |
| --- | --- |
| Mag buiten | ma 5 okt vanaf 22:00 |
| **Uiterlijk** | **di 6 okt 07:45** (verlopen: in `overdue`, met daaronder "1 uur te laat") |
| Herinnering* | ma 5 okt 21:00 |

**Infolijst voor binnenzetten:**

| Label | Waarde |
| --- | --- |
| Binnenzetten | di 6 okt vanaf 12:00 |
| **Uiterlijk** | **di 6 okt, einde van de dag** |
| Herinnering* | di 6 okt 18:00 |

\* **Herinnering:** deze rij staat er alleen als aan alle drie de voorwaarden is voldaan:
1. de eigen instelling "Herinneringen" van de kijker staat aan (V-50, AC-211; standaard uit voor gezinsleden);
2. de taak is open;
3. het herinneringsmoment ligt nog in de toekomst.

Anders ontbreekt de rij. Er komt dan niet "(uit)" of iets anders voor in de plaats.

**Gedaan:** er komt de bestaande rij "Gedaan" bij.

**Uitlegregel** onder de infolijst (`text-meta`, `text-3`): T-27.

**Notities:** zoals bij elke taak.

**Deze keer overslaan:**
- **Bij buitenzetten:** zonder bevestiging. De melding onderin is T-31 met **Ongedaan maken**, en dat zet beide taken terug (BR-53, AC-209).
- **Bij binnenzetten:** de bestaande overslaan-melding. Buitenzetten blijft ongemoeid.

**"Toch nog doen"** (bij een overgeslagen afvaltaak) staat er alleen zolang de ophaaldag D nog niet voorbij is. Daarna zou de taak bij de volgende ronde meteen weer vervallen.

**Directe link naar bewerken** (`/taken/<id>/bewerken`, `?bewerk=<id>`): die opent het taakdetail. Lukt een verplaatsing toch (bijvoorbeeld uit een oude offline wachtrij), dan komt melding T-33.

### 13.7 Flows

#### 13.7.1 Afvalkalender aanzetten (UC-13, AC-183), beheerder
1. Tandwiel (1) → rij **Afvalkalender · Uit** (2). In de oude UI: de springlink "Afval", of scrollen.
2. Toestand A: korte uitleg (T-40) en het formulier. Typen.
3. **Adres zoeken** (3). De knop toont "Zoeken…" en de velden zijn tijdelijk uitgeschakeld.
4. Toestand C, **Klopt dit?**:
   - het adres zoals de gemeente het kent, met als plaats altijd "Den Haag" (T-45a). Geeft de bron geen straat, dan de vorm "2517 AB 12A, Den Haag". Dit wordt niet bewaard (BR-58);
   - de eerstvolgende ophaaldag per bak;
   - de uitleg T-46.
5. **Ja, aanzetten** (4). De knop toont "Bezig…". Daarna volgt toestand G:
   - zijn er taken klaargezet: melding T-90 "… · **Bekijken**", en Bekijken opent de Kalender (week);
   - ligt de eerstvolgende ophaaldag verder dan 14 dagen weg, dan zijn er nog geen taken. Dan komt melding T-90b, zonder Bekijken (AC-183 (b)). De datum staat al onder Volgende ophaaldagen in G.

**4 tikken plus typen.** Eenmalig staat in G de tip T-53 of T-54 (V-56, BR-57), weg te tikken met ✕.

**Foutpaden.** Er wordt nooit iets bewaard, de velden blijven gevuld, en een eerder adres blijft ongewijzigd (AC-188, AC-214).

| Situatie | Toestand | Tekst | Wat kan de beheerder doen |
| --- | --- | --- | --- |
| Vorm klopt niet (bij het verlaten van een veld en bij Zoeken; AC-184) | A met veldfout | T-43, T-44, T-44b | aanpassen. Zoeken is uitgeschakeld zolang postcode of huisnummer leeg is |
| Onbekend of buiten Den Haag (AC-185) | D | T-60 | aanpassen, opnieuw zoeken |
| Meerdere adressen, geen toevoeging (AC-187) | C2 | T-61 en een rij per adres | op een rij tikken (1 tik) → C |
| Buiten januari: de gemeente kent voor dit adres **vaststaand** geen rest, papier of PMD (AC-186) | E | T-62 | Ander adres |
| Bron onbereikbaar of onbruikbaar (> 8 s, fout, formaat; AC-188) | F | T-63 of T-63b | **Opnieuw proberen** (primair) |
| De gemeente geeft voor restafval, papier en PMD samen geen enkele komende ophaaldag (vandaag of later), terwijl het adres wel bakken heeft. Dat geldt ook eind november of december na de laatste ophaaldag van het jaar: de jaareinde-uitzondering van het bijwerken geldt bij het instellen niet. Óf het is januari en de kalender van het lopende jaar is nog helemaal leeg (AC-237). Een eerstvolgende dag verder dan 14 dagen weg is géén F2: dan gewoon C, en na aanzetten T-90b (AC-183 (b)) | F2 | T-64 of T-64b | **Adres zoeken** (primair), later opnieuw |
| Opslaan mislukt | C blijft staan | T-65 | Ja, aanzetten opnieuw |
| Intussen geen beheerder meer (AC-189) | → J | T-66 (melding onderin) | — |
| Offline | A en C: knoppen uit | T-67 | — |

- **E of F2 bij twijfel:**
  - E toont de app alleen buiten januari, en alleen als vaststaat dat de gemeente voor dit adres geen rest, papier of PMD noemt (AC-186).
  - In januari is dat niet vast te stellen. Een voorbeeld is 2 januari, als de kalender van het nieuwe jaar nog niet online staat en de app dus geen enkele datum ziet. Dan toont hij F2, ook als de kalender van het vorige jaar geen datums had.
  - Liever één keer te veel "probeer het over een paar dagen" dan ten onrechte "gebruiken jullie een ondergrondse container?".
- **Twee keer tikken:** er ontstaat één adres (AC-191). Twee beheerders tegelijk: de laatste bevestiging geldt, zonder melding.
- **Terugweg:** op C staat **Ander adres** (tekstknop), terug naar A met gevulde velden. De pagina verlaten = niets bewaard, zonder vraag "Wijzigingen weggooien?".

#### 13.7.2 Adres wijzigen (verhuizen), beheerder (AC-214)
1. G → **Wijzigen** naast het adres (1). Het formulier opent gevuld met het huidige adres:
   - titel "Ander adres";
   - regel T-47;
   - knoppen **Adres zoeken** en **Annuleren**.
2. **Adres zoeken** (2) → C, met de extra regel T-48.
3. **Ja, dit adres gebruiken** (3) → G + melding T-91.

- **Hetzelfde adres als het bewaarde:** melding T-92. De taken, notities en "bezig" blijven. Er komt nooit "te snel" (AC-222).
- **Fouten:** zoals in 13.7.1, met de "huidige adres"-varianten T-63b en T-64b. Het oude adres en de oude taken blijven. Zit het bewaarde adres zelf in dezelfde jaareindesituatie, dan toont G daar alleen T-73 (AC-237, AC-220).
- **Annuleren:** terug naar G (of naar H als er een storing is).

#### 13.7.3 Afvalkalender uitzetten, beheerder (AC-213)
1. G → onderaan **Afvalkalender uitzetten…** (danger-quiet) (1).
2. Sheet I, met de titel T-80 en de tekst T-81, T-81b of T-81c, afhankelijk van het aantal open afvaltaken. Knoppen: **Uitzetten** (danger) en **Annuleren** (2).
3. Terug naar A, met melding T-93. Er is geen Ongedaan maken, want het adres is gewist.

- **Waarom bevestigen:** het adres is weg en de taken verdwijnen voor iedereen.
- **Annuleren:** er verandert niets.
- **Offline:** de knop is uitgeschakeld (T-67).

#### 13.7.4 Dagelijks gebruik (UC-14), iedereen
- **Avond vóór de ophaaldag:** Vandaag toont buitenzetten met "vanaf 22:00", en Binnenkort toont binnenzetten met "morgen".
  - Om 21:00 komt de push (M-01) naar wie Herinneringen aan heeft.
  - Tik op de push → detail → **Afvinken** (2 tikken). Of op Vandaag het rondje (1 tik).
- **Ophaaldag:**
  - tot 07:45 staat buitenzetten er nog met "vóór 07:45";
  - binnenzetten staat vóór 12:00 bovenaan Binnenkort ("vanaf 12:00"), en vanaf 12:00 onder Vandaag;
  - om 18:00 komt de push (M-02), alleen als de taak nog open is (AC-194).
- **Na de ophaaldag:** een open binnenzet-taak staat vanaf de dag erna bij Verlopen. Hij blijft daar tot de dag van de volgende buitenzet-taak begint, en uiterlijk tot het begin van de zevende dag na de ophaaldag (D+7). Daarna vervalt hij vanzelf en telt hij als vergeten (§13.4, AC-210).
- **Afvinken en terugdraaien:** de melding "Gedaan: … · Ongedaan maken" werkt zoals in §4.1 en §4.2. Buiten en binnen worden los afgevinkt (AC-207).
- **Offline:** afvinken, bezig en overslaan gaan via de wachtrij (TD §9.3). Bij offline overslaan van buitenzetten toont de app binnenzetten meteen ook als overgeslagen. De server bevestigt dat bij verzenden.

#### 13.7.5 Storing (BR-52, AC-204, AC-205), alleen beheerders
- **Minder dan 48 uur, of één enkele hapering** (er is een foutcode, maar nog geen storing):
  - onder de kop van G staat alleen de stille regel T-71 (bij `ADDRESS_GONE`: T-71b);
  - er is geen balk, geen melding en geen knop;
  - de app probeert het elk uur opnieuw;
  - de taken lopen door op de bewaarde datums, net als bij een storing (hieronder).
- **Minder dan 48 uur zonder foutcode** (de achtergrondtaak heeft het ophalen een tijd niet gedaan): gewoon G. De kop toont eerlijk het laatste tijdstip, bijvoorbeeld "bijgewerkt gisteren 06:15". Er komt geen stille regel.
- **Storing** (`health = failed`, BR-52): langer dan 48 uur zonder succes, om welke reden ook; of minstens twee vastgelegde lege antwoorden achter elkaar (geen enkele komende ophaaldag), met minstens een uur tussen het eerste en het laatste en zonder andere uitkomst ertussen. Het jaareinde telt niet: in november en december, na de laatste ophaaldag van het jaar en zolang de kalender van volgend jaar nog niet online staat, is er geen storing, alleen de stille regel T-73 (zie "Kalender van volgend jaar ontbreekt" hieronder). Bij een storing:
  - de beheerders krijgen één melding, volgens de oorzaak: M-03 (onbereikbaar, onbruikbaar, of **geen foutcode**), M-04 (leeg) of M-05 (adres niet gevonden);
  - de rij in Instellingen toont "Niet bijgewerkt" (T-37);
  - de pagina toont toestand H: de balk bovenaan, met tekst per oorzaak (§13.8.2);
  - onder de balk blijven de Volgende ophaaldagen de laatst bekende stand tonen, ook bij een leeg antwoord (H2). Een storing wist geen datums (BR-52, §13.8.2);
  - de afvaltaken lopen door op de bewaarde datums. Bestaande taken worden niet verwijderd, verschoven of hernoemd. Voor al bekende ophaaldagen die binnen de 14 dagen komen, worden wel taken klaargezet (BR-50), en het vanzelf vervallen (§13.4) loopt ook door. Alleen wijzigingen van de gemeente komen er pas bij als het weer lukt;
  - **geen foutcode** (de achtergrondtaak lag stil of sloeg het ophalen steeds over) geeft H1 met M-03. T-76 is zo geformuleerd dat hij dan ook klopt.
- **Een storing blijft een storing tot het echt weer lukt:**
  - is de storing eenmaal vastgesteld, dan blijven balk H en "Niet bijgewerkt" staan tot het bijwerken weer gelukt is;
  - verandert intussen de oorzaak (bijvoorbeeld eerst leeg, dan onbereikbaar), dan verandert alleen de tekst in de balk (H2 wordt H1). Er komt geen tweede melding;
  - de balk maakt nooit tussendoor plaats voor de stille regel T-71;
  - reden: de beheerder heeft net een storingsmelding gekregen, en er is niets hersteld.
- **Kalender van volgend jaar ontbreekt:** dit geldt in december als het venster al tot in januari loopt, of in november en december als de laatste ophaaldag van dit jaar al geweest is. De gemeente heeft dan nog geen kalender voor volgend jaar.
  - Stille regel T-73 onder de kop, geen balk en geen melding.
  - Is de kalender van het lopende jaar helemaal leeg (bijvoorbeeld op 1 januari), dan volgt H2.
  - Een lege periode van een paar weken, bijvoorbeeld papier eens per 4 weken, is geen storing.
- **Weer gelukt:** de balk en "Niet bijgewerkt" verdwijnen vanzelf, en wijzigingen van de gemeente worden verwerkt. Er komt geen melding "weer gelukt". Na een handmatige poging komt wel melding T-94. Een latere, nieuwe storing geeft opnieuw één melding.
- **Gezinsleden** zien niets van een storing (AC-205).

#### 13.7.6 "Opnieuw proberen" (alleen in balk H, en als opnieuw zoeken in toestand F)
- **Waar de knop staat:** alleen in balk H.
- **G′ heeft bewust geen knop.** Bij een enkele hapering herstelt de app zich elk uur zelf (T-71 zegt dat), en een knop nodigt alleen uit tot nerveus tikken.
- **Gevolg:** vóór er een storing is, kan niemand handmatig proberen. Een storing kan dus ook nooit door vaker tikken eerder ontstaan. De regel "vaker proberen maakt een storing niet eerder" is een regeltest op de gezondheidsregel, geen scenario in het scherm (AC-236).

**In balk H:**

| Stap | Wat de beheerder ziet | Wat hij kan doen |
| --- | --- | --- |
| Tikken | de knop wordt "Bezig…" (`text-3`, uitgeschakeld), hooguit 12 s. De rest van de pagina blijft bruikbaar | wachten |
| Gelukt | de balk verdwijnt. De kop wordt "Aan · bijgewerkt vandaag 14:32" en Volgende ophaaldagen zijn bijgewerkt. Melding onderin T-94 | niets nodig |
| Nog steeds fout | de balk **blijft**, met eventueel een andere oorzaaktekst als de oorzaak veranderd is. Onder de uitleg staat de regel T-78 met de tijd van de poging. De knop is weer actief. Volgende ophaaldagen blijven de laatst bekende stand | later opnieuw, of bij H3 "Adres controleren" |
| Te snel (`too_soon`: iemand anders of de achtergrond probeerde het binnen de minuut) | regel T-79 op dezelfde plek als T-78. Er is **geen** melding onderin | na een minuut opnieuw |
| Geen beheerder meer | melding T-66; de pagina toont J | — |
| Offline | de knop is uitgeschakeld, met T-67 eronder | — |

- De regels T-78 en T-79 staan in de balk, die `role="status"` heeft. Ze blijven staan tot de volgende poging of tot de pagina opnieuw geladen wordt.
- **Route om T-79 in het scherm te zien:** twee beheerders hebben tegelijk balk H open en tikken binnen een minuut allebei op "Opnieuw proberen". Of één beheerder tikt vlak nadat de achtergrondtaak het ophalen probeerde.

**In toestand F:** "Opnieuw proberen" is gewoon opnieuw zoeken. Je ziet "Zoeken…" en daarna C, C2, D, E, F of F2.

### 13.8 Scherm: Instellingen › Afvalkalender

**Nieuwe UI (WP7):**
- een subpagina `/instellingen/afvalkalender`, met "‹ Instellingen";
- `/instellingen#afvalkalender` stuurt door naar die subpagina (oude meldingen).

Rij in §5.8:

| Groep | Rij (rechts de waarde) | Subpagina | Wie |
| --- | --- | --- | --- |
| Huishouden | Afvalkalender · Aan / Uit / ⓘ Niet bijgewerkt (T-35…T-37) | aanzetten, status, wijzigen, uitzetten | **Beheerder:** beheren. **Gezinslid:** rij zonder pijl, waarde Aan of Uit, met de regel T-38 of T-39 eronder |

**Oude UI (WP3b):**
- `SettingsSection` "Afvalkalender" (icoon recycle, beschrijving T-34), direct na Huishouden, plus de springlink "Afval";
- dezelfde toestanden, maar inline. C vervangt het formulier in de sectie;
- de uitzet-sheet is de bestaande Dialog;
- een gezinslid ziet alleen J (T-38b of T-39b).

**Hoofdactie per toestand:**

| Toestand | Hoofdactie |
| --- | --- |
| A | Adres zoeken |
| C | Ja, aanzetten (of Ja, dit adres gebruiken) |
| F | Opnieuw proberen |
| F2 | Adres zoeken |
| G | geen hoofdactie: dit is een statusweergave |
| H | Opnieuw proberen, secundair (bij H3 ook Adres controleren) |

#### 13.8.1 Toestanden

| # | Toestand | Wat de gebruiker ziet | Wat hij kan doen |
| --- | --- | --- | --- |
| — | Laden | skelet: titel + 3 rijen | — |
| — | Laden mislukt | T-68 + **Opnieuw** | opnieuw |
| A | Uit, beheerder | uitleg T-40, velden T-41, privacyregel T-42 | Adres zoeken (uitgeschakeld zolang postcode of huisnummer leeg is) |
| A′ | Wijzigen | titel "Ander adres", T-47, velden gevuld | Adres zoeken · Annuleren |
| B | Zoeken | knop "Zoeken…", velden uitgeschakeld | wachten |
| C | Klopt dit? | T-45…T-46 (bij wijzigen + T-48) | Ja, aanzetten / Ja, dit adres gebruiken · Ander adres |
| C2 | Meerdere adressen | T-61 + een aantikbare rij per adres ("12", "12A", "12B"), met Ander adres eronder | een rij kiezen (1 tik) |
| D | Onbekend of buiten Den Haag | regel T-60 in `overdue` boven de velden, velden gevuld, **zonder** rode rand | aanpassen, opnieuw zoeken |
| E | Geen bakken (vaststaand, niet in januari) | T-62 | Ander adres |
| F | Bron onbereikbaar | `sunken`-balk T-63/T-63b boven het formulier, velden gevuld | Opnieuw proberen |
| F2 | Nog geen komende ophaaldagen (ook in januari zonder kalender, en bij het instellen na de laatste ophaaldag van het jaar) | `sunken`-balk T-64/T-64b boven het formulier, velden gevuld | Adres zoeken |
| — | Bezig (opslaan, uitzetten) | knop "Bezig…" | wachten |
| — | Opslaan mislukt | T-65 bovenaan C, invoer blijft | opnieuw |
| G | Aan, in orde | kop T-70, adresrij, Volgende ophaaldagen (op datum), uitleg T-52, eenmalige tip, Uitzetten… | Wijzigen · Uitzetten… |
| G′ | Aan, hapering (foutcode, nog geen storing) | G + stille regel T-71/T-71b onder de kop; **geen** knop | idem als G |
| G″ | Aan, kalender volgend jaar ontbreekt: in december als het venster tot in januari loopt, **of** in november en december zonder komende ophaaldag terwijl de kalender van volgend jaar nog niet online staat | G + stille regel T-73 | idem als G |
| — | Gedeeltelijk | een bak zonder datum: "nog geen ophaaldag bekend" (T-45b). In G en H alleen als er voor die bak in de bewaarde stand echt geen datum vanaf vandaag is | — |
| H | Aan, storing | kop T-72, balk per oorzaak (§13.8.2), sectiekop met "· stand za 26 sep" en daaronder de laatst bekende ophaaldagen. Blijft staan tot het bijwerken weer gelukt is | Opnieuw proberen · (H3: Adres controleren) · Wijzigen · Uitzetten… |
| — | Opnieuw proberen | §13.7.6 | — |
| I | Bevestiging uitzetten | sheet T-80 + T-81/T-81b/T-81c | Uitzetten · Annuleren |
| J | Gezinslid | Aan/Uit + regel T-38/T-39 | niets |
| — | Offline | laatst bekende stand; knoppen uit met T-67 | bekijken |

**Voorrang (hooguit één regel of balk onder de kop):**
- H gaat voor alles. T-71, T-71b en T-73 staan er dan niet.
- G′ en G″ sluiten elkaar uit, want G″ vraagt een geslaagde laatste bijwerking.
- Zonder foutcode en zonder storing: G, zonder stille regel.

**Volgende ophaaldagen (G, G′, G″ en H):** per bak de eerstvolgende bewaarde datum vanaf vandaag, gesorteerd op datum. Datums in het verleden staan er niet. Heeft een bak in de bewaarde stand geen datum vanaf vandaag, dan staat daar T-45b.

#### 13.8.2 Storingsbalk H per oorzaak
- De tekst hangt af van `last_error_code`, dus van de laatst bekende oorzaak, en niet van de reden van het alarm.
- Opmaak volgens DS §7.13.4: `sunken`, geen rood.
- De balk blijft staan tot het bijwerken weer gelukt is. Alleen de variant (H1/H2/H3) volgt de laatste oorzaak.
- **De ophaaldagen blijven zichtbaar, ook bij H2.**
  - Onder de balk staat altijd "Volgende ophaaldagen · stand <dag van de laatste geslaagde bijwerking>", met de laatst bekende datums (§13.8.1).
  - Een leeg antwoord van de gemeente wist die datums niet (BR-52: de bekende ophaaldagen blijven ongewijzigd). H2 toont dus gewoon de bewaarde datums, en **niet** drie keer "nog geen ophaaldag bekend".
  - T-45b staat er alleen bij een bak waarvoor in de bewaarde stand echt geen datum vanaf vandaag meer is. Bijvoorbeeld op 1 januari, als de laatst bekende datums allemaal in het vorige jaar lagen.
  - Hetzelfde geldt voor H1 en H3.

| # | Oorzaak (`last_error_code`) | Titel | Uitleg | Knoppen |
| --- | --- | --- | --- | --- |
| H1 | `UNREACHABLE`, `FORMAT` of **geen foutcode** (achtergrondtaak lag stil) | T-75 | T-76 | Opnieuw proberen |
| H2 | `SUSPECT_EMPTY` | T-77 | T-77a (december en januari) of T-77b (andere maanden) | Opnieuw proberen |
| H3 | `ADDRESS_GONE` | T-77c | T-77d | **Adres controleren** (opent A′, gevuld) · Opnieuw proberen |

### 13.9 Formulier adres (aanvulling op §6)

| Veld | Type | Standaard | Validatie (moment) |
| --- | --- | --- | --- |
| Postcode | tekst, `autocomplete="postal-code"`, `autocapitalize="characters"`, max 7, plaatshouder "2517 AB" | leeg (bij wijzigen: het huidige) | bij verlaten en bij Zoeken: 4 cijfers (niet beginnend met 0) + 2 letters. Bij verlaten wordt de postcode netjes gezet: "2517ab" → "2517 AB". Fout: T-43 |
| Huisnummer | `inputmode="text"`, max 8 | leeg | 1–99999. "12a" of "12 a" wordt bij verlaten stil 12 + toevoeging "A" (AC-187). Fout: T-44 |
| Toevoeging (optioneel) | tekst, max 4, plaatshouder "A of 2", `autocapitalize="characters"` | leeg | letters en cijfers, hooguit 4. Fout: T-44b |

- **Indeling:** postcode en huisnummer naast elkaar (60/40), de toevoeging eronder in de linkerkolom.
- **Waarom tekst voor huisnummer:** een numeriek toetsenbord maakt "12a" onmogelijk. De gebruiker typt zoals hij het adres kent, en de app splitst het.
- **Vormfout:** foutregel bij het veld. **Antwoord van de bron:** regel of balk boven het formulier (D, F, F2). De velden blijven altijd gevuld.
- **Dubbel tikken:** voorkomen doordat de knop tijdens het zoeken uitgeschakeld is. Een eventuele korte wachttijd tussen twee pogingen is voor de gebruiker onzichtbaar; de knop toont dan gewoon "Zoeken…".

### 13.10 Meldingen (aanvulling op §4.9)
Geen adres, geen straat, geen namen (BR-58, AC-212). Titel en tekst in de lijst Meldingen zijn gelijk aan de push. Het label in de lijst is T-39c.

| ID | Wanneer | Aan wie | Titel | Tekst | Tik opent |
| --- | --- | --- | --- | --- | --- |
| M-01 | D−1 21:00, buitenzetten open (AC-194) | wie "Herinneringen" aan heeft (V-50, AC-211) | Herinnering: <taaknaam> | Morgen ophaaldag. Mag vanaf 22:00 buiten, uiterlijk morgen 07:45. | taakdetail |
| M-02 | D 18:00, binnenzetten open | idem | Herinnering: <taaknaam> | één bak: "Vandaag was de ophaaldag. Zet de bak vandaag nog binnen." · meer bakken: "Vandaag was de ophaaldag. Zet de bakken vandaag nog binnen." | taakdetail |
| M-03 | storing, oorzaak `UNREACHABLE`/`FORMAT`, of **geen foutcode** (de achtergrondtaak lag stil) | alleen actieve beheerders, één keer per storing (AC-205) | De afvalkalender kon niet worden bijgewerkt | Laatst gelukt op <za 26 sep>. Nieuwe ophaaldagen komen er pas bij als het weer lukt. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl. | Instellingen › Afvalkalender (AC-223) |
| M-04 | storing, oorzaak `SUSPECT_EMPTY` | idem | De afvalkalender kon niet worden bijgewerkt | De gemeente geeft geen komende ophaaldagen meer. Soms staat de nieuwe kalender nog niet online. Kijk zelf op huisvuilkalender.denhaag.nl. | idem |
| M-05 | storing, oorzaak `ADDRESS_GONE` | idem | De afvalkalender vindt het adres niet meer | De gemeente kent het adres niet meer. Controleer het in Instellingen › Afvalkalender. Tot die tijd komen er geen nieuwe ophaaldagen bij. | idem |

- De oorzaak bij het versturen bepaalt de variant. Er komt één melding per storing, ook als de oorzaak tijdens de storing verandert. Een storing loopt tot het bijwerken weer gelukt is (§13.7.5).
- Geen "deadline nadert" en geen "verlopen" voor afvaltaken (V-50, AC-211). Ook geen melding bij het vanzelf vervallen van een taak.
- De storingsmelding komt altijd in de lijst, plus push als die op het toestel aan staat. Er is geen eigen schakelaar.

### 13.11 Taken, Kalender en Overzicht
- **Taken › Open:** afvaltaken in de gewone groepen, met kenmerk en rechterkolom volgens §13.4.
  - Zoeken op "afval", "papier" of "PMD" vindt ze via de naam.
  - In het filter vallen ze onder Buiten.
- **Taken › Terugkerend** (nieuwe UI, WP6): bovenaan één informatierij T-96.
  - Beheerder: met een pijl naar Instellingen › Afvalkalender.
  - Gezinslid: zonder pijl.
  - Alleen zichtbaar als de afvalkalender aan staat.
- **Kalender:**
  - afvaltaken op hun dag, met kenmerk en tijd volgens §13.4;
  - **slepen staat uit**, in de oude en de nieuwe UI;
  - "+ Taak" per dag blijft;
  - verder dan 14 dagen vooruit staan er geen stippellijnvoorbeelden. Onder de eerste week zonder afvaltaken staat eenmalig T-95.
- **Overzicht** (nieuwe UI, WP8): in "Vaak te laat of vergeten" en "Vaak gedaan" tellen alle afvaltaken samen als T-97 en T-98 (AC-234).

### 13.12 Rechten (aanvulling op §9)

| Element | Beheerder | Gezinslid | Hoe bij "nee" |
| --- | --- | --- | --- |
| Aanzetten, adres wijzigen, uitzetten (AC-189) | ja | nee | verborgen; J |
| Adres en bijwerkstatus zien (AC-190) | ja | nee (V-53) | verborgen |
| Storingsbalk, stille regels, storingsmelding, "Opnieuw proberen" (AC-205, AC-236) | ja | nee | — |
| Afvinken, terugzetten, bezig, notitie, overslaan (AC-207, AC-209) | ja | ja | — |
| Verplaatsen, bewerken, verwijderen, slepen, omzetten (AC-208) | nee | nee | verborgen + uitlegregel T-27 |
| Herinneringsrij in het detail | als de eigen "Herinneringen" aan staat | idem | rij ontbreekt |

### 13.13 Oude UI (WP3b) en nieuwe UI (WP4–WP8)

#### 13.13.1 Oude UI (live op `main`, AC-217)

| Onderdeel | Wat er verandert (alleen voor afvaltaken) |
| --- | --- |
| Instellingen | `SettingsSection id="afvalkalender"` na Huishouden, springlink "Afval", toestanden A–J inline. D gebruikt de tekststijl van de veldfout als één regel boven de velden, zonder rode rand. F, F2 en H zijn `bg-muted`-balken, niet rood |
| Taakkaart | meta: recycle-icoon + "Afvalkalender" in plaats van categorie en ↻. Klokje: "vanaf 22:00" / "vóór 07:45" / "vanaf 12:00" in plaats van "21:00". **Geen** deadlinebadge behalve "… te laat"; bij Verlopen alleen de badge, zonder klokje |
| Binnenkort | binnenzetten op D vóór 12:00: "Vandaag" + "vanaf 12:00". Op D−1: "Morgen" (bestaande `relativeDayLabel`) |
| Taakdetail | kopregel: statusbadge + meta-tekst "♻ Afvalkalender · ophaaldag di 6 okt" (geen nieuwe badge). **Geen** omschrijving. ⋯-menu alleen met Ik ben ermee bezig / Niet meer bezig / Deze keer overslaan / Toch nog doen (volgens 13.6). Bewerken, Verwijderen en de scheidingslijn zijn weg. De rijen Wanneer (met datumkiezer), Beschikbaar, Uiterlijk en Categorie worden vervangen door de afval-infolijst uit 13.6; de rij Gedaan blijft. Daaronder uitlegregel T-27 (`text-sm text-muted-foreground`) |
| Kalender | "21:00" wordt "vanaf 22:00"; binnenzetten "vanaf 12:00"; `useDraggable` uit |
| Meldingen | teksten M-01…M-05; label T-39c voor `waste_sync_failed` |
| Tip | T-54 (verwijst naar Terugkerend op dezelfde pagina) |

#### 13.13.2 Nieuwe UI (`v2-ui`): per werkpakket, zodat analist en reviewers ertegen kunnen toetsen

| WP | Onderdeel | Toetspunt |
| --- | --- | --- |
| WP4 | snapshot bevat de afvalvelden | een afvaltaak toont kenmerk en rechterkolom (anders onzichtbaar) |
| WP5 | rij en detail | §13.4, §13.5, §13.6: geen ⋯, twee secundaire knoppen, herinneringsrij volgens de instelling, geen omschrijving |
| WP6 | Taken › Terugkerend, bewerk-URL | informatierij T-96; `?bewerk=<id>` van een afvaltaak opent `?taak=<id>` |
| WP7 | subpagina | toestanden §13.8.1 en §13.8.2; doorsturen vanaf `/instellingen#afvalkalender` |
| WP8 | Kalender, Meldingen, Overzicht | slepen uit; T-95; meldingslijst M-03…M-05 met label T-39c; groepering T-97/T-98 |

#### 13.13.3 Checkpoint CP-W03: rook-screenshots WP3b
De lijst met rook-screenshots voor WP3b staat in TD §18.16 U3 (CP-W03). Dat is de enige lijst.

### 13.14 Wireframes (tekst, 390×844, nieuwe UI tenzij anders vermeld)

**A — Uit, beheerder**
```
‹ Instellingen
Afvalkalender
De app leest de huisvuilkalender van Den Haag
en zet voor restafval, papier en PMD zelf de
taken klaar: de avond ervoor buitenzetten, op
de ophaaldag binnenzetten.

Postcode            Huisnummer
[ 2517 AB        ]  [ 12        ]
Toevoeging (optioneel)
[ A of 2         ]

[        Adres zoeken             ]   ← primair
Alleen postcode en huisnummer gaan naar de
gemeente. Alleen beheerders zien het adres.
```

**C — Klopt dit?**
```
‹ Instellingen
Klopt dit?
Zo kent de gemeente jullie adres.
Laan van Meerdervoort 12A, Den Haag

Eerstvolgende ophaaldagen
  Restafval ................ di 6 okt
  Papier ................... wo 7 okt
  PMD ...................... vr 2 okt

De avond vóór elke ophaaldag staat er een taak
buitenzetten, met een herinnering om 21:00. Op
de ophaaldag vanaf 12:00 een taak binnenzetten,
met een herinnering om 18:00. Iedereen in het
huishouden ziet de taken. Het adres zien alleen
beheerders.

[        Ja, aanzetten            ]   ← primair
          Ander adres
```

**C2 — Meerdere adressen** (elke rij is een knop, 1 tik)
```
Op nummer 12 staan meerdere adressen.
Welke is van jullie?
  12                                   ›
  12A                                  ›
  12B                                  ›
          Ander adres
```

**D — Onbekend**
```
⊘ Dit adres staat niet in de huisvuilkalender    ← overdue, geen rand om velden
  van Den Haag. Controleer postcode en
  huisnummer. De afvalkalender werkt alleen
  voor adressen in Den Haag.
Postcode [ 2288 GH ]  Huisnummer [ 5 ]
[        Adres zoeken             ]
```

**F — Bron onbereikbaar / F2 — Nog geen komende ophaaldagen (ook in januari, en bij het instellen na de laatste ophaaldag van het jaar)**
```
┌ ⓘ De huisvuilkalender van de gemeente is ┐   ← sunken
│   nu niet bereikbaar. Er is niets         │
│   opgeslagen.                             │
└───────────────────────────────────────────┘
Postcode [ 2517 AB ]  Huisnummer [ 12 ]
[        Opnieuw proberen         ]
---
┌ ⓘ De gemeente geeft voor dit adres nog   ┐
│   geen komende ophaaldagen. De kalender   │
│   van het nieuwe jaar komt meestal rond   │
│   de jaarwisseling online. Er is niets    │
│   opgeslagen. Probeer het over een paar   │
│   dagen opnieuw.                          │
└───────────────────────────────────────────┘
Postcode [ 2517 AB ]  Huisnummer [ 12 ]
[        Adres zoeken             ]
```

**G — Aan (met G′-regel als voorbeeld)**
```
‹ Instellingen
Afvalkalender
Aan · bijgewerkt vandaag 06:15
De laatste poging lukte niet. De app probeert   ← alleen G′, text-3, geen knop
het elk uur opnieuw.

Adres       2517 AB 12A          Wijzigen
Volgende ophaaldagen
  PMD ...................... vr 2 okt
  Restafval ................ di 6 okt
  Papier ........ nog geen ophaaldag bekend
Taken staan 14 dagen vooraf klaar. De app kijkt
twee keer per dag, 's ochtends en aan het eind
van de middag, of de gemeente iets veranderd
heeft.
┌ Had je zelf al een terugkerende      ✕ ┐
│ afvaltaak? Die blijft gewoon staan.    │
│ Stop hem via Taken › Terugkerend als   │
│ je hem niet meer nodig hebt.           │
└────────────────────────────────────────┘
  Afvalkalender uitzetten…
```

**H1 — Storing (onbereikbaar, onbruikbaar of zonder foutcode), na "nog steeds fout"** (vandaag ma 28 sep)
```
Afvalkalender
Aan · laatst bijgewerkt za 26 sep 06:15
┌ ⓘ Niet bijgewerkt sinds za 26 sep        ┐
│ Het lukt de app al een tijd niet om de    │
│ ophaaldagen bij de gemeente op te halen.  │
│ De taken die er staan, blijven staan;     │
│ nieuwe ophaaldagen komen er pas bij als   │
│ het weer lukt. Kijk tot die tijd zelf op  │
│ huisvuilkalender.denhaag.nl.              │
│ Opnieuw geprobeerd om 14:32. Het lukt     │  ← T-78, text-2
│ nog steeds niet.                          │
│ Opnieuw proberen                          │
└───────────────────────────────────────────┘
Adres       2517 AB 12A          Wijzigen
Volgende ophaaldagen · stand za 26 sep
  PMD ...................... vr 2 okt           ← laatst bekende stand, niet gewist
  Restafval ................ di 6 okt
  Papier ................... wo 7 okt
```

**H2 — Storing, leeg antwoord (andere maand dan december/januari)** (vandaag di 13 okt)
```
Afvalkalender
Aan · laatst bijgewerkt ma 12 okt 06:15
┌ ⓘ Geen komende ophaaldagen meer bekend   ┐
│ De gemeente geeft geen enkele komende     │
│ ophaaldag meer. Dat is ongebruikelijk.    │
│ De taken die er staan, blijven staan.     │
│ Kijk tot die tijd zelf op                 │
│ huisvuilkalender.denhaag.nl.              │
│ Opnieuw proberen                          │
└───────────────────────────────────────────┘
Adres       2517 AB 12A          Wijzigen
Volgende ophaaldagen · stand ma 12 okt
  PMD ...................... vr 16 okt          ← bewaarde datums blijven staan (BR-52);
  Restafval ................ di 20 okt            T-45b alleen als er voor die bak
  Papier ................... di 27 okt            echt geen datum vanaf vandaag is
```

**H3 — Adres niet meer gevonden**
```
┌ ⓘ Adres niet meer gevonden               ┐
│ De huisvuilkalender van de gemeente kent  │
│ 2517 AB 12A niet meer. Controleer het     │
│ adres. Tot die tijd komen er geen nieuwe  │
│ ophaaldagen bij; de taken die er staan,   │
│ blijven staan.                            │
│ Adres controleren    Opnieuw proberen     │
└───────────────────────────────────────────┘
```

**I — Uitzetten, met 4 en met 0 open taken**
```
Afvalkalender uitzetten?                    ✕
Het adres wordt gewist en de 4 afvaltaken die
nog open staan, verdwijnen. Wat al gedaan is,
blijft in de historie. Weer aanzetten kan
altijd; dan vul je het adres opnieuw in.
[          Uitzetten              ]   ← danger
            Annuleren
---
Het adres wordt gewist. Wat al gedaan is, blijft
in de historie. Weer aanzetten kan altijd; dan
vul je het adres opnieuw in.
```

**J — Gezinslid**
```
Huishouden
  Gezinsleden                          ›
  Afvalkalender                      Aan
  Ophaaldagen van de gemeente komen
  vanzelf als taak in de lijst.
```

**Vandaag, maandag 5 okt 19:30**
```
Vandaag 3
( ) Vaatwasser uitruimen      vóór 20:00
    ↻ elke dag
( ) Restafval en papier      vanaf 22:00
    buitenzetten
    ♻ Afvalkalender
Binnenkort
( ) Restafval- en papierbak       morgen
    binnenzetten
    ♻ Afvalkalender
```

**Vandaag, dinsdag 6 okt 09:10**
```
Verlopen
┌ ( ) Restafval en papier       1 uur ┐   ← overdue-soft
│     buitenzetten            te laat │
│     ♻ Afvalkalender                 │
└─────────────────────────────────────┘
Binnenkort
( ) Restafval- en papierbak  vanaf 12:00
    binnenzetten
    ♻ Afvalkalender
```

**Taakdetail buitenzetten** (kijker met Herinneringen aan)
```
♻ Afvalkalender · ophaaldag di 6 okt   ✕
Restafval en papier buitenzetten
[ ✓        Afvinken                ]
[ Ik ben ermee bezig ][ Deze keer overslaan ]
Mag buiten       ma 5 okt vanaf 22:00
Uiterlijk        di 6 okt 07:45       (vet)
Herinnering      ma 5 okt 21:00       ← alleen als eigen Herinneringen aan
De ophaaldag komt uit de afvalkalender van de
gemeente. Daarom kun je deze taak niet
verplaatsen, wijzigen of verwijderen. Verschuift
de gemeente de dag, dan schuift de taak vanzelf mee.
Notities
[ Notitie toevoegen…                ]
```

**Taakdetail binnenzetten** (kijker met Herinneringen uit)
```
♻ Afvalkalender · ophaaldag di 6 okt   ✕
Restafval- en papierbak binnenzetten
[ ✓        Afvinken                ]
[ Ik ben ermee bezig ][ Deze keer overslaan ]
Binnenzetten     di 6 okt vanaf 12:00
Uiterlijk        di 6 okt, einde van de dag
(uitlegregel) · Notities
```

**Oude UI: taakdetail**
```
[Open]  ♻ Afvalkalender · ophaaldag di 6 okt
Restafval en papier buitenzetten
[ ✓ Afvinken                   ][ ⋯ ]  ⋯ = Ik ben ermee bezig · Deze keer overslaan
┌ Mag buiten     ma 5 okt vanaf 22:00 ┐
│ Uiterlijk      di 6 okt 07:45       │
│ Herinnering    ma 5 okt 21:00       │
└─────────────────────────────────────┘
(uitlegregel, text-sm muted) · Notities
```

### 13.15 Toetsvragen
- **Kernflow zonder uitleg?** Ja. A legt in één zin uit wat er gebeurt, C toont het resultaat vóór het bewaren, en afvinken werkt zoals altijd. Ook als er nog geen taken zijn (T-90b), zegt de melding waarom.
- **Hoofdactie in drie seconden?**
  - A: Adres zoeken.
  - C: Ja, aanzetten.
  - F: Opnieuw proberen.
  - F2: Adres zoeken.
  - Detail: Afvinken.
  - G en H hebben bewust geen primaire knop.
- **Onomkeerbaar zonder bevestiging?** Nee, uitzetten wordt bevestigd. Het vanzelf vervallen van een taak is geen handeling van de gebruiker en telt eerlijk als vergeten.
- **Nutteloze bevestiging?** Nee. Aanzetten gaat via C, dat zelf de controle is, en overslaan en afvinken zijn met Ongedaan maken te herstellen.
- **Overbodige informatie?**
  - Geen categorie of ↻ in de rij.
  - Nooit "21:00" of "verloopt over …" in de rij.
  - Geen omschrijving naast de infolijst.
  - Geen herinneringsrij voor wie geen herinneringen krijgt.
  - Geen "(0 taken)", en geen knop Bekijken als er niets te bekijken is (T-90b).
  - Geen knop bij een hapering die zichzelf herstelt.
  - Geen binnenzet-taak die wekenlang bij Verlopen blijft staan: uiterlijk op D+7 vervalt hij.
  - Een gezinslid ziet geen adres of status.
- **Eerlijk?**
  - T-76 klopt ook als de app zelf niet heeft geprobeerd.
  - T-52 noemt de twee vaste momenten.
  - De balk verdwijnt pas als het echt weer gelukt is.
  - Bij een storing blijven de laatst bekende ophaaldagen zichtbaar, met "stand <dag>", en voor die datums komen gewoon taken. H2 suggereert niet dat de datums weg zijn.
  - In januari zegt de app niet ten onrechte "ondergrondse container".
  - Eind november en in december, na de laatste ophaaldag, geeft de app geen vals alarm, alleen T-73.
- **Alle states?** Zie §13.8.1, §13.8.2, §13.7.6, §13.4 en §13.6:
  - leeg, laden en laden mislukt;
  - fout per oorzaak (ook zonder foutcode);
  - bezig en gelukt;
  - uitgeschakeld (offline, leeg veld);
  - gedeeltelijk (bak zonder datum, kalender volgend jaar ontbreekt);
  - storing met bewaarde datums.

### 13.16 Definitieve gebruikersteksten (enige bron; analist, architect en visual-designer nemen deze letterlijk over)

**Notatie:**
- `<dag>` = korte weekdag, dag en korte maand in kleine letters zonder punt: "di 6 okt".
- Tijden: "06:15".
- `<tijdstip>` = "vandaag 06:15", "gisteren 06:15" of "<dag> 06:15".
- `<taaknaam>` = T-01…T-14.
- `<adres>` = "2517 AB 12A".
- **Vet** = nadruk (600).

| ID | Waar | Wanneer | Tekst (exact) |
| --- | --- | --- | --- |
| T-01…T-07 | taaknaam buiten | per bakcombinatie | Restafval buitenzetten · Papier buitenzetten · PMD buitenzetten · Restafval en papier buitenzetten · Restafval en PMD buitenzetten · Papier en PMD buitenzetten · Restafval, papier en PMD buitenzetten |
| T-08…T-14 | taaknaam binnen | per bakcombinatie | Restafvalbak binnenzetten · Papierbak binnenzetten · PMD-bak binnenzetten · Restafval- en papierbak binnenzetten · Restafval- en PMD-bak binnenzetten · Papier- en PMD-bak binnenzetten · Restafval-, papier- en PMD-bak binnenzetten |
| T-15 | kenmerk rij en detail | altijd | Afvalkalender |
| T-16 | rechterkolom | buiten op D−1 | vanaf 22:00 |
| T-17 | rechterkolom | buiten op D, vóór 07:45 | vóór 07:45 |
| T-18 | rechterkolom | binnen op D, vóór 12:00; Kalender binnen | vanaf 12:00 |
| T-19 | rechterkolom Binnenkort | taak morgen | morgen (oude UI: Morgen) |
| T-20 | detail, bovenregel | altijd | Afvalkalender · ophaaldag <dag D> |
| T-21 | infolijst buiten | — | Mag buiten · <dag D−1> vanaf 22:00 |
| T-22 | infolijst buiten | — | Uiterlijk · <dag D> 07:45 |
| T-23 | infolijst binnen | — | Binnenzetten · <dag D> vanaf 12:00 |
| T-24 | infolijst binnen | — | Uiterlijk · <dag D>, einde van de dag |
| T-25 | infolijst | eigen Herinneringen aan, taak open, moment in de toekomst | Herinnering · <dag D−1> 21:00 (buiten) / <dag D> 18:00 (binnen) |
| T-27 | detail, uitlegregel | altijd | De ophaaldag komt uit de afvalkalender van de gemeente. Daarom kun je deze taak niet verplaatsen, wijzigen of verwijderen. Verschuift de gemeente de dag, dan schuift de taak vanzelf mee. |
| T-28 | detail, knoppen | — | Afvinken · Ik ben ermee bezig · Niet meer bezig · Deze keer overslaan · Toch nog doen · Terugzetten |
| T-30 | melding onderin | afvinken | Gedaan: <taaknaam> · Ongedaan maken |
| T-31 | melding onderin | buitenzetten overgeslagen | Overgeslagen, ook het binnenzetten · Ongedaan maken |
| T-33 | melding onderin | een verplaats- of wijzigactie op een afvaltaak geweigerd | Een afvaltaak kun je niet wijzigen, verplaatsen of verwijderen. |
| T-34 | oude UI, sectiebeschrijving | — | Ophaaldagen van Den Haag als taak. |
| T-34b | oude UI, springlink | — | Afval |
| T-35 / T-36 / T-37 | rij Instellingen, waarde | aan / uit / storing (alleen beheerder; blijft tot het weer gelukt is) | Aan · Uit · Niet bijgewerkt |
| T-38 | J, regel onder de rij | aan | Ophaaldagen van de gemeente komen vanzelf als taak in de lijst. |
| T-38b | J, oude UI | aan | Afvalkalender staat aan + T-38 |
| T-39 | J, regel onder de rij | uit | <Namen van de beheerders> kan de afvalkalender aanzetten. / … kunnen … (bijv. "Jurgen kan …", "Ellen en Jurgen kunnen …") |
| T-39b | J, oude UI | uit | Afvalkalender staat uit + T-39 |
| T-39c | label in de lijst Meldingen | `waste_sync_failed` | Afvalkalender |
| T-40 | A, uitleg | uit | De app leest de huisvuilkalender van Den Haag en zet voor restafval, papier en PMD zelf de taken klaar: de avond ervoor **buitenzetten**, op de ophaaldag **binnenzetten**. |
| T-41 | A, labels en plaatshouders | — | Postcode ("2517 AB") · Huisnummer · Toevoeging (optioneel) ("A of 2") |
| T-41b | A, knop | — / bezig | Adres zoeken / Zoeken… |
| T-42 | A, privacyregel | — | Alleen postcode en huisnummer gaan naar de gemeente. Alleen beheerders zien het adres. |
| T-43 | veldfout postcode | ongeldig of leeg bij Zoeken | Vul een postcode in zoals 2517 AB |
| T-44 | veldfout huisnummer | ongeldig of leeg bij Zoeken | Vul een huisnummer in, zoals 12 of 12A |
| T-44b | veldfout toevoeging | ongeldig | Een toevoeging heeft hooguit 4 letters of cijfers |
| T-45 | C, kop | — | Klopt dit? · ondertitel: Zo kent de gemeente jullie adres. · sectiekop: Eerstvolgende ophaaldagen · bakken: Restafval, Papier, PMD |
| T-45a | C, adresweergave | met of zonder straat | <straat> <nr><toev>, Den Haag · anders: <adres>, Den Haag (de plaats is altijd "Den Haag", ook als de bron "'s-Gravenhage" geeft; alleen weergave, niets bewaard) |
| T-45b | C, G en H, bak zonder datum | in C: de bron geeft voor die bak geen komende datum; in G en H: de bewaarde stand heeft voor die bak geen datum vanaf vandaag | nog geen ophaaldag bekend |
| T-46 | C, uitleg | — | De avond vóór elke ophaaldag staat er een taak **buitenzetten**, met een herinnering om 21:00. Op de ophaaldag vanaf 12:00 een taak **binnenzetten**, met een herinnering om 18:00. Iedereen in het huishouden ziet de taken. Het adres zien alleen beheerders. |
| T-46b | C, knoppen | aanzetten / wijzigen / bezig | Ja, aanzetten · Ja, dit adres gebruiken · Bezig… · Ander adres |
| T-47 | A′, titel en regel | wijzigen | Ander adres · Het huidige adres blijft gebruikt tot je het nieuwe bevestigt. · knop Annuleren |
| T-48 | C, extra regel | wijzigen | Open afvaltaken van het oude adres worden vervangen. Wat al gedaan is, blijft in de historie. |
| T-60 | D | onbekend of buiten Den Haag | Dit adres staat niet in de huisvuilkalender van Den Haag. Controleer postcode en huisnummer. De afvalkalender werkt alleen voor adressen in Den Haag. |
| T-61 | C2 | meerdere adressen | Op nummer <nr> staan meerdere adressen. Welke is van jullie? |
| T-62 | E | vaststaand geen rest, papier of PMD (niet in januari) | Voor dit adres geeft de gemeente geen ophaaldagen voor restafval, papier of PMD. Gebruiken jullie een ondergrondse container? Dan hoeft er niets buiten te staan. |
| T-63 | F | aanzetten | De huisvuilkalender van de gemeente is nu niet bereikbaar. Er is niets opgeslagen. · knop Opnieuw proberen |
| T-63b | F | wijzigen | De huisvuilkalender van de gemeente is nu niet bereikbaar. Er is niets opgeslagen; het huidige adres blijft gebruikt. |
| T-64 | F2 | aanzetten | De gemeente geeft voor dit adres nog geen komende ophaaldagen. De kalender van het nieuwe jaar komt meestal rond de jaarwisseling online. Er is niets opgeslagen. Probeer het over een paar dagen opnieuw. |
| T-64b | F2 | wijzigen | De gemeente geeft voor dit adres nog geen komende ophaaldagen. De kalender van het nieuwe jaar komt meestal rond de jaarwisseling online. Er is niets opgeslagen; het huidige adres blijft gebruikt. Probeer het over een paar dagen opnieuw. |
| T-65 | C, fout | opslaan mislukt | Opslaan lukte niet. Er is niets veranderd. Probeer het opnieuw. |
| T-66 | melding onderin | `FORBIDDEN` | Alleen een beheerder kan de afvalkalender aanpassen. Er is niets veranderd. |
| T-67 | onder een uitgeschakelde knop | offline | Hiervoor heb je internet nodig |
| T-68 | pagina | laden mislukt | De afvalkalender kon niet worden geladen. · Opnieuw |
| T-70 | G, kop | in orde (ook zonder foutcode en zonder storing) | **Aan** · bijgewerkt <tijdstip> |
| T-52 | G, uitleg | — | Taken staan 14 dagen vooraf klaar. De app kijkt twee keer per dag, 's ochtends en aan het eind van de middag, of de gemeente iets veranderd heeft. |
| T-50 | G, adresrij | — | Adres · <adres> · Wijzigen (aria-label "Adres wijzigen") · sectiekop: Volgende ophaaldagen |
| T-53 | G, tip (nieuwe UI) | eenmalig | Had je zelf al een terugkerende afvaltaak? Die blijft gewoon staan. Stop hem via Taken › Terugkerend als je hem niet meer nodig hebt. (✕: aria-label "Tip sluiten") |
| T-54 | G, tip (oude UI) | eenmalig | Had je zelf al een terugkerende afvaltaak? Die blijft gewoon staan. Stop hem hieronder bij Terugkerend als je hem niet meer nodig hebt. |
| T-55 | G, knop | — | Afvalkalender uitzetten… |
| T-71 | G′, stille regel | poging mislukt, nog geen storing | De laatste poging lukte niet. De app probeert het elk uur opnieuw. |
| T-71b | G′, stille regel | idem, `ADDRESS_GONE` | Bij de laatste poging vond de gemeente het adres niet. De app probeert het elk uur opnieuw. |
| T-72 | H, kop en sectiekop | storing | **Aan** · laatst bijgewerkt <tijdstip> · sectiekop: Volgende ophaaldagen · stand <dag> (daaronder de laatst bekende datums) |
| T-73 | G″, stille regel | december als het venster tot in januari loopt; of november en december zonder komende ophaaldag; in beide gevallen staat de kalender J+1 nog niet online | De kalender voor <jaar> staat nog niet online. Ophaaldagen vanaf 1 januari komen erbij zodra hij er is. |
| T-75 | H1, titel | `UNREACHABLE`/`FORMAT`/geen foutcode | Niet bijgewerkt sinds <dag van last_success_at> |
| T-76 | H1, uitleg | idem | Het lukt de app al een tijd niet om de ophaaldagen bij de gemeente op te halen. De taken die er staan, blijven staan; nieuwe ophaaldagen komen er pas bij als het weer lukt. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl. |
| T-77 | H2, titel | `SUSPECT_EMPTY` | Geen komende ophaaldagen meer bekend |
| T-77a | H2, uitleg | december of januari | De gemeente geeft geen enkele komende ophaaldag meer. Waarschijnlijk staat de kalender van het nieuwe jaar nog niet online. De taken die er staan, blijven staan. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl. |
| T-77b | H2, uitleg | andere maanden | De gemeente geeft geen enkele komende ophaaldag meer. Dat is ongebruikelijk. De taken die er staan, blijven staan. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl. |
| T-77c | H3, titel | `ADDRESS_GONE` | Adres niet meer gevonden |
| T-77d | H3, uitleg | idem | De huisvuilkalender van de gemeente kent <adres> niet meer. Controleer het adres. Tot die tijd komen er geen nieuwe ophaaldagen bij; de taken die er staan, blijven staan. · knoppen Adres controleren · Opnieuw proberen |
| T-77e | balk H, knop bezig | tijdens de poging | Bezig… |
| T-78 | balk H, resultaatregel | handmatige poging mislukt | Opnieuw geprobeerd om <hh:mm>. Het lukt nog steeds niet. |
| T-79 | balk H, resultaatregel | `too_soon` | Net geprobeerd. Probeer het over een minuut opnieuw. |
| T-80 | I, titel | — | Afvalkalender uitzetten? |
| T-81 | I, tekst | n ≥ 2 open | Het adres wordt gewist en de <n> afvaltaken die nog open staan, verdwijnen. Wat al gedaan is, blijft in de historie. Weer aanzetten kan altijd; dan vul je het adres opnieuw in. |
| T-81b | I, tekst | n = 1 | Het adres wordt gewist en de afvaltaak die nog open staat, verdwijnt. Wat al gedaan is, blijft in de historie. Weer aanzetten kan altijd; dan vul je het adres opnieuw in. |
| T-81c | I, tekst | n = 0 | Het adres wordt gewist. Wat al gedaan is, blijft in de historie. Weer aanzetten kan altijd; dan vul je het adres opnieuw in. |
| T-82 | I, knoppen | — / bezig | Uitzetten · Annuleren / Bezig… |
| T-90 | melding onderin | aangezet, er zijn taken klaargezet (`inserted` > 0) | Afvalkalender staat aan · taken voor 2 weken klaargezet · Bekijken |
| T-90b | melding onderin | aangezet, 0 taken klaargezet (`inserted` = 0: de eerstvolgende ophaaldag ligt verder dan 14 dagen weg; AC-183 (b)) | Afvalkalender staat aan · taken verschijnen 14 dagen vooraf |
| T-91 | melding onderin | nieuw adres | Nieuw adres opgeslagen · afvaltaken bijgewerkt |
| T-92 | melding onderin | hetzelfde adres bevestigd | Adres opgeslagen · er verandert niets |
| T-93 | melding onderin | uitgezet | Afvalkalender staat uit |
| T-94 | melding onderin | handmatige poging gelukt | Afvalkalender bijgewerkt |
| T-95 | Kalender, eenmalig | eerste week zonder afvaltaken | Ophaaldagen verschijnen 14 dagen vooraf. |
| T-96 | Taken › Terugkerend | aan | Afvalkalender · volgt de ophaaldagen van de gemeente |
| T-97 / T-98 | Overzicht, groepnaam | — | Afval buitenzetten · Bakken binnenzetten |
| T-99 | aria-label rondje | — | <taaknaam> afvinken |
| M-01…M-05 | meldingen en push | zie §13.10 | letterlijk zoals in de tabel van §13.10 |

**Vervallen teksten (niet meer gebruiken):**
- "Binnenzetten vanaf 12:00, uiterlijk vandaag." en "Mag vanaf 22:00 buiten, uiterlijk 07:45." als omschrijving;
- "De huisvuilkalender is nu niet bereikbaar. Probeer het later opnieuw.";
- "Afvalkalender niet bijgewerkt sinds <datum>";
- "De gemeente-site gaf geen antwoord.";
- "… Kijk voor de zekerheid zelf op de site van de gemeente.";
- "(4 taken)";
- "geen ophaaldag in de komende weken";
- "Vul een huisnummer in, alleen cijfers";
- de toast "Net geprobeerd…" (wordt T-79 in de balk);
- de toast "Opgeslagen" (wordt T-90, T-90b, T-91 of T-92);
- "Restafval binnenzetten" en "Restafval en papier binnenzetten";
- T-52 oud: "… De app kijkt elke ochtend of de gemeente iets veranderd heeft.";
- T-64 oud: "Meestal komt de kalender van het nieuwe jaar eind december online.";
- T-64/T-64b oud: "De gemeente heeft nog geen ophaaldagen voor de komende weken online gezet.";
- T-76 oud: "De huisvuilkalender van de gemeente geeft geen bruikbaar antwoord. …";
- T-77 oud: "Geen ophaaldagen voor de komende twee weken";
- T-77a/T-77b/M-04 oud: "De gemeente geeft voor de komende twee weken geen (enkele) ophaaldag(en).";
- T-45a oud: "<straat> <nr><toev>, <plaats>". Nooit "'s-Gravenhage" tonen.

### 13.17 Verwijzingen naar acceptatiecriteria (ACCEPTANCE_CRITERIA WP3b en WP4–WP9)
**WP3b:**
- AC-183: aanzetten. (b) Eerstvolgende ophaaldag verder dan 14 dagen weg geeft C, dan T-90b en 0 taken.
- AC-184: vorm.
- AC-185: D.
- AC-186: E; in januari altijd F2.
- AC-187: schrijfwijze, C2.
- AC-188: F.
- AC-189: gezinslid.
- AC-190: wie ziet het adres.
- AC-191: dubbel tikken.
- AC-192: buitenzetten.
- AC-193: binnenzetten.
- AC-194: herinnering alleen bij een open taak.
- AC-195: twee bakken op één dag, namenlijst §13.3.
- AC-197: 14 dagen vooruit, T-52/T-90b/T-95.
- AC-201: naam past zich aan.
- AC-204: hapering en leeg antwoord. Jaareinde en "alleen datums na 14 dagen" zijn geen storing.
- AC-205: storing per oorzaak, ook zonder foutcode (c). De balk blijft tot herstel.
- AC-207: los afvinken.
- AC-208: wel/niet.
- AC-209: overslaan werkt door.
- AC-210: verlopen/vervallen, met bovengrens D+7 voor binnenzetten.
- AC-211: wie de herinnering krijgt.
- AC-212: geen adres.
- AC-213: uitzetten.
- AC-214: wijzigen.
- AC-217: oude UI, CP-W03-lijst TD §18.16 U3.
- AC-220: kalender volgend jaar ontbreekt, G″/T-73; ook eind november zonder komende ophaaldag.
- AC-222: hetzelfde adres.
- AC-223: storingsmelding opent Instellingen › Afvalkalender.
- AC-236: "Opnieuw proberen", alleen in balk H.
- AC-237: F2, ook eind november/december bij het instellen en in januari. Tegenvoorbeeld: AC-183 (b).

**Nieuwe UI:**
- AC-224: gegevenslaag, WP4.
- AC-225: rij, WP5.
- AC-226: detail, WP5.
- AC-227: overslaan offline, WP5.
- AC-228: T-96, WP6.
- AC-229: geen bewerkformulier, WP6.
- AC-230: subpagina, WP7.
- AC-231: rij en oude links, WP7.
- AC-232: Kalender zonder slepen, WP8.
- AC-233: storingsmelding in de lijst, WP8.
- AC-234: Overzicht T-97/T-98, WP8.
- AC-235: kernflow, WP9.

---

## Wijzigingslijst ten opzichte van designer r3 (met r4 en de twee aanvullingen daarop)

1. **Samenvoeging van r4 (hoofdtekst):**
   - teksten T-45a, T-64, T-64b, T-77, T-77a, T-77b, T-90 en nieuw T-90b, en M-04;
   - §13.7.1 stap 4 en 5 en de F2-rij;
   - §13.7.5, de storingsdefinitie;
   - F2-wireframe;
   - vervallen teksten.

   De r4-regel voor §13.13.3 ("Meldingen onderin: T-90, T-90b …") is vervallen door D2.
2. **D2 (aanvulling 1):** §13.13.3 is alleen nog een verwijzing naar TD §18.16 U3. AC-217 in §13.17 verwijst naar TD §18.16 U3.
3. **Aanvulling r6:**
   - de G″-rij in §13.8.1;
   - de bullet "Kalender van volgend jaar ontbreekt" in §13.7.5. Die vervangt ook de r4-zin over H2;
   - de kolom "Wanneer" van T-73.
4. **Critic moet-punt 1 (D+2 wordt D+7):**
   - §13.4, tabelrij (uiterlijk begin van D+7, di 13 okt 00:00) en de rij Verlopen ("vanaf wo … tot hij vervalt");
   - de bullet "Bovengrens" is herschreven, met de verwijzing naar BR-54/AC-210/TD `WASTE_IN_EXPIRE_DAYS = 7`;
   - §13.7.4 "Na de ophaaldag";
   - §13.15 ("wekenlang … uiterlijk op D+7");
   - §13.17 AC-210.

   Er staat nergens meer D+2.
5. **Critic aanbeveling 11 (H2 toont bewaarde datums):**
   - §13.8.2: nieuwe bullet "De ophaaldagen blijven zichtbaar, ook bij H2";
   - §13.8.1: regel "Volgende ophaaldagen (G, G′, G″ en H)", de rij H, en de rij Gedeeltelijk met "alleen als er echt geen datum is";
   - §13.7.5: sub-bullet bij Storing;
   - §13.7.6: rij "Nog steeds fout";
   - §13.1 punt 6;
   - T-45b ("C, G en H", met een Wanneer per plek);
   - T-72;
   - H1-wireframe met datums, en een nieuw H2-wireframe met bewaarde datums.
6. **Consistentie met AC-186/AC-237 (r4, r4c):**
   - E "alleen buiten januari" (foutpadenrij E, bullet "E of F2", §13.8.1 rij E, T-62 Wanneer);
   - F2 "ook eind november/december bij het instellen" (F2-rij §13.7.1, §13.8.1 F2, wireframekop F2);
   - "begin januari" wordt "januari";
   - §13.7.2 Fouten: bewaard adres in de jaareindesituatie toont T-73.
7. **AC-verwijzingen:**
   - AC-183 (b) in §13.7.1 stap 5, de F2-rij, T-90b en §13.17;
   - AC-237 met tegenvoorbeeld AC-183 (b);
   - AC-220 uitgebreid met eind november;
   - AC-204 met de "geen storing"-gevallen;
   - toegevoegd: AC-195, AC-197 en AC-223 (ook in M-03), plus AC-224…AC-235 voor WP4–WP9, en AC-234 in §13.11.
8. **Klein:**
   - §13.15 aangevuld (T-90b zonder Bekijken, bewaarde datums, jaareinde);
   - vervallen teksten: de toast "Opgeslagen" wordt ook T-90b.

### Vragen voor Jurgen
Geen.

### Keuzes die ik zelf maakte (binnen de productspec)
- **Wat "Volgende ophaaldagen" toont:** per bak de eerstvolgende bewaarde datum vanaf vandaag. Datums in het verleden laat ik weg. T-45b komt alleen als er voor die bak geen bewaarde datum vanaf vandaag meer is, bijvoorbeeld op 1 januari. Dat geldt in G en H gelijk.
- **Het H2-voorbeeld gebruikt "andere maanden" (T-77b)**, omdat de datums daar het duidelijkst blijven staan.
- **E komt nooit in januari.** Ik heb dat expliciet in de UX-tekst gezet, zodat die gelijk loopt met AC-186 (r4).

### Punten voor de hoofdsessie
- **Architect (critic punt 4):** de punten uit de oude r3-lijst van §13.13.3 moeten in TD §18.16 U3 staan, anders vallen ze weg:
  - laden en laden mislukt (T-68);
  - een overgeslagen afvaltaak met "Toch nog doen" in het ⋯-menu van de oude UI;
  - Verlopen binnenzetten "1 dag te laat";
  - H die blijft staan na een herstelpoging met een andere oorzaak (H2 → H1).

  Mijn voorstel is om ook "H2 met bewaarde datums onder Volgende ophaaldagen" toe te voegen.
- **Visual-designer (aanbeveling 11):** prototype `w03-07` (H2) aanpassen. Onder "Volgende ophaaldagen · stand ma 12 okt" moeten de bewaarde datums staan (zoals het H2-wireframe in §13.14), niet drie keer "nog geen ophaaldag bekend". Daarna opnieuw een screenshot maken.
- **Analist:** de samengevoegde AC-183 moet de variant (b) bevatten zoals §13.17 die noemt, want §13.7.1, T-90b en §13.17 verwijzen ernaar.

### Status
**KLAAR VOOR VISUEEL ONTWERP.** Het enige open beeldpunt is w03-07 (H2 met bewaarde datums). Er zijn geen open vragen.

Relevante bestanden:
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-designer-r3.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-designer-r4.md
- /home/user/takenlijstje/docs/reviews/plan-critic.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-analyst-r4.md, -r4b.md, -r4c.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/solution-architect-r6.md
- /home/user/takenlijstje/docs/UX_SPEC.md (doel: §13 komt na §12)