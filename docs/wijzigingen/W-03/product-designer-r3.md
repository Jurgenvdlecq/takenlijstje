## UX-ontwerp: W-03 afvalkalender, ronde 3 (kort)

**Documenten:** ik heb niets geschreven. UX_SPEC.md is bevroren en de opdracht was geen bestanden aan te raken. Hieronder staat de volledige, bijgewerkte §13. Die kan letterlijk de §13 van r2 vervangen (bron r2: `/home/user/takenlijstje/docs/wijzigingen/W-03/product-designer-r2.md`).

**Wireframes:** alleen als tekst (§13.14). Er zijn geen nieuwe HTML-wireframes of screenshots, omdat schrijven niet mocht. Ik heb daarom **niets nieuws op beeld beoordeeld**. De nieuwe teksten moeten nog in beeld komen bij de nieuwe render van de visual-designer (w03-01, w03-02, w03-05).

**Gelezen:**
- `/home/user/takenlijstje/docs/reviews/plan-critic.md` (W-03 ronde 2);
- mijn eigen r2;
- van `/home/user/takenlijstje/docs/wijzigingen/W-03/product-analyst-r3.md`: BR-48, BR-51, BR-52, BR-54 en AC-185 t/m AC-237;
- van `/home/user/takenlijstje/docs/wijzigingen/W-03/solution-architect-r3.md`: §18.8 t/m §18.11 en §18.16 U3.

**Apparaten/viewports:** telefoon 390×844 (V-07), ongewijzigd.

**Kernflow:** ongewijzigd.
- Aanzetten: 4 tikken plus typen.
- Een afvaltaak afhandelen: 1 tik, of 2 via de push.

### Vragen voor Jurgen
Geen. Twee keuzes raken wel regels van de analist: de bovengrens voor binnenzetten (punt 6) en het neutraler maken van T-76 (punt 1). Ze staan hieronder als eigen keuze met reden, zodat de hoofdsessie ze kan terugdraaien of kan voorleggen.

### Wijzigingen ten opzichte van r2

1. **Storing zonder foutcode (moet-punt 4)**
   - **Regel:** `health = failed` met `last_error_code` null (de achtergrondtaak lag stil of sloeg het ophalen steeds over) toont **balk H1** (T-75 + T-76) en stuurt **M-03**.
   - **Waar:** §13.7.5, §13.8.1 (rij H), §13.8.2 (tabel H1: "`UNREACHABLE`, `FORMAT` of geen foutcode") en §13.10 (rij M-03).
   - **T-76 is neutraler geformuleerd**, zodat de tekst ook klopt als het probleem bij de app zelf lag. Oud: "De huisvuilkalender van de gemeente geeft geen bruikbaar antwoord." Nieuw: "Het lukt de app al een tijd niet om de ophaaldagen bij de gemeente op te halen." Anders kijkt Jurgen op de gemeentesite, ziet hij dat die werkt, en snapt hij de balk niet. De rest van T-76 is ongewijzigd.
   - Geen BR of AC citeert T-76 letterlijk, dus alleen de render van w03-05 moet mee.
   - **Voorstel voor de analist:** in AC-205 een regel "(c) de achtergrondtaak draaide 48 uur niet → H1 + M-03".
2. **T-52 (moet-punt 5)**
   - Nieuw: "Taken staan 14 dagen vooraf klaar. De app kijkt twee keer per dag, 's ochtends en aan het eind van de middag, of de gemeente iets veranderd heeft."
   - Aangepast in §13.16 en wireframe G.
3. **Begin januari: F2 in plaats van E (aanbeveling 7)**
   - **Regel in §13.7.1:** E (T-62, "ondergrondse container?") alleen als vaststaat dat de gemeente voor dit adres geen rest, papier of PMD kent. Kan dat niet worden vastgesteld, omdat de kalender van het lopende jaar nog helemaal leeg is (begin januari), dan volgt **F2**. Liever één keer te veel "probeer het over een paar dagen" dan ten onrechte "jullie hebben een ondergrondse container".
   - **T-64 en T-64b** zeggen nu "komt meestal rond de jaarwisseling online" in plaats van "eind december". Op 2 januari zou "eind december" verwarrend zijn.
   - Voor de analist: AC-237 citeert T-64 letterlijk en moet mee. Voorstel: in AC-186/AC-237 ook het geval "2 januari, kalender nieuw jaar ontbreekt → F2, niet E".
4. **De balk verdwijnt alleen bij echt herstel (aanbeveling 8)**
   - **Regel:** is de storing eenmaal vastgesteld (H getoond, melding verstuurd), dan blijven H en "Niet bijgewerkt" staan tot het bijwerken weer gelukt is.
   - Tussendoor volgt alleen de tekst in de balk de laatste oorzaak. Bijvoorbeeld: eerst H2, daarna een onbereikbare poging, dan H1. De stille regel T-71 vervangt de balk nooit.
   - **Waar:** §13.7.5, §13.7.6, §13.8.1 en §13.8.2.
   - Voor de architect (r4): `failed` moet "plakken" tot een nieuw `last_success_at`. Dat past bij de dedupe-sleutel `waste-failed:<last_success_at>`.
5. **"Opnieuw proberen" bereikbaar (aanbeveling 9)**
   - **Keuze:** de knop blijft **alleen in balk H** (en als opnieuw zoeken in F). G′ krijgt bewust **geen** knop. Bij een enkele hapering herstelt de app zich elk uur zelf, en een knop nodigt uit tot nerveus tikken zonder dat het iets oplevert.
   - **Gevolg:** voordat er een storing is, kan niemand handmatig proberen. Een storing kan dus ook niet door tikken eerder ontstaan. Vastgelegd in §13.7.6.
   - **Voorstel voor de analist:**
     - AC-205, voorbeeld "06:00 en 06:30": "een leeg antwoord om 06:00 en opnieuw om 06:30 (minder dan een uur ertussen; regeltest op de gezondheidsregel)", zonder "bijvoorbeeld door 'Opnieuw proberen'".
     - AC-236, laatste zin: "In toestand G′ staat geen knop 'Opnieuw proberen'; de app probeert het zelf elk uur. Vaker proberen maakt een lege-antwoordstoring niet eerder (regeltest)."
     - BR-52 (b): "Vaker 'Opnieuw proberen'" wordt "Vaker proberen".
6. **Bovengrens voor een verlopen binnenzet-taak (aanbeveling 10)**
   - **Regel:** de taak vervalt vanzelf (telt als vergeten) aan het begin van de dag van de volgende buitenzet-taak, **en uiterlijk aan het begin van D+2**, wat het eerst komt. Er komt geen melding en geen nieuwe tekst.
   - **Reden:** na één volle dag bij Verlopen ("1 dag te laat") staat de bak vrijwel zeker binnen. Een rij die dagenlang rood blijft staan (lange pauze, storing) helpt niemand.
   - Het voorbeeld in AC-210 (dinsdag, vervalt donderdag) blijft precies gelijk.
   - **Waar:** §13.4.
   - Voor de analist (BR-54, AC-210 als extra geval) en de architect (§18.8.6: "of vandaag ≥ D+2").
   - **Alternatief** als de hoofdsessie dit te ver vindt gaan: D+7, zoals de critic voorstelde.
7. **Eén lijst voor CP-W03**
   - §13.13.3 is nu de vereniging van mijn r2-lijst en TD §18.16 U3, met H1/H2/H3, H1 zonder foutcode, "H blijft na herstelpoging met andere oorzaak", G″, offline, opslaan mislukt, de meldingenlijst en F2 in januari.
   - De "too_soon-toast" is vervangen door regel T-79 in de balk, en "Opgeslagen" door T-90/T-91/T-92.
   - Voorstel: TD §18.16 U3 en AC-217 verwijzen naar deze lijst.
8. **Kleinigheden**
   - §13.8.1: de voorrang van stille regels en balk is vastgelegd (H verbergt T-71 en T-73; G′ en G″ sluiten elkaar uit).
   - "Storing zonder foutcode, minder dan 48 uur" is gewoon G, met het eerlijke tijdstip in de kop.
   - §13.17 verwijst nu naar de nummering van ronde 3 (niet verschoven).
   - De lijst met vervallen teksten is aangevuld met de oude T-52, T-64 en T-76.

### Keuzes die ik zelf maakte (binnen de productspec)
- T-76 neutraal gemaakt, zodat H1 eerlijk is voor onbereikbaar, onbruikbaar en "geen poging".
- Geen knop "Opnieuw proberen" bij een hapering (G′).
- Bovengrens D+2 voor binnenzetten.
- Bij twijfel tussen E en F2 kies ik F2.
- T-64 zegt "rond de jaarwisseling".

### Punten voor de hoofdsessie, analist, architect en visual-designer
- **Analist:**
  - AC-237: letterlijke tekst T-64/T-64b bijwerken;
  - AC-205: geval (c) toevoegen en het voorbeeld 06:00/06:30 herformuleren;
  - AC-236: laatste zin aanpassen;
  - BR-52 (b): "Vaker proberen";
  - BR-54 en AC-210: bovengrens D+2 toevoegen;
  - AC-186/AC-237: het januari-geval.
- **Architect (r4):**
  - `failed` blijft staan tot er weer een succes is;
  - `failed` met code null → H1 en M-03 (`wasteFailureMessage`);
  - `no_streams` niet afleiden uit een lege C(J) in januari (F2);
  - vervallen van binnenzetten uiterlijk vanaf D+2;
  - U3 verwijst naar UX §13.13.3.
- **Visual-designer:** in w03-01 T-52 (nieuw), in w03-05 T-76 (nieuw), en F2 met T-64 (nieuw).

### Status
**KLAAR VOOR VISUEEL ONTWERP**, als lichte bijwerking van de teksten in w03-01, w03-02 en w03-05. Daarna volgt planreview ronde 3.

---

# TEKST VOOR UX_SPEC: §13 Afvalkalender (W-03), ronde 3, vervangt ronde 2 volledig

## 13.1 Uitgangspunten
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
7. **"♻" is een afkorting** in dit document. In de app staat altijd het Lucide-icoon `Recycle`, nooit het teken of een emoji (DS §7.10).

## 13.2 Informatiearchitectuur (aanvulling op §2)
```
Huishouden
├── Afvalkalender (0 of 1; alleen beheerder: postcode, huisnummer, toevoeging, stand van bijwerken)
│     └── Afvaltaken (gewone taken met kenmerk "Afvalkalender", zonder reeks, zonder omschrijving)
│           ├── "… buitenzetten"          (dag vóór de ophaaldag)
│           └── "…bak(ken) binnenzetten"   (ophaaldag, vanaf 12:00)
```
Mentaal model: "De gemeente bepaalt de dag, de app zet de taak klaar, wij vinken af."

## 13.3 Taaknamen (exact; tekst-ID's T-01…T-14 in §13.16)
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

## 13.4 Tijden en plek in de lijsten (rechterkolom)
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
| wo, open | Verlopen, bestaand patroon ("9 uur" / "te laat", "1 dag" / "te laat") | — | ja, telt als te laat |
| begin van de dag van de volgende buitenzet-taak, **en uiterlijk begin van D+2 (do 8 okt)**, wat het eerst komt, nog open | verdwijnt: vanzelf overgeslagen, telt als vergeten (BR-54, AC-210) | — | — |

- **Bovengrens voor binnenzetten:** een binnenzet-taak staat hooguit één volle dag bij Verlopen. Daarna staat de bak vrijwel zeker al binnen, en een rij die dagenlang rood blijft staan (bij een lange ophaalpauze of een storing zonder nieuwe datums) helpt niemand. Er komt geen melding bij het vervallen.
- **"morgen" en niet "di 6 okt" op D−1:** dat is de bestaande dagnotatie van Binnenkort (DS §7.4). Samen met "vanaf 22:00" leest het als "vanavond buiten, morgen binnen". De ophaaldag zelf staat in het detail.
- Er staat **nooit "21:00"** in een rij, kaart of kalendervak. 21:00 is alleen het moment van de herinnering.
- **Kalender** (planning, los van het huidige tijdstip): buitenzetten op D−1 met "vanaf 22:00", binnenzetten op D met "vanaf 12:00". Verlopen volgt het bestaande patroon.
- **Geen deadlinebadges** "verloopt over …" of "uiterlijk morgen" bij afvaltaken (V-50: geen deadline-nadert). Alleen "… te laat" bij Verlopen.
- **Gedaan en overgeslagen:** zoals elke rij. Het kenmerk blijft staan.

## 13.5 Het kenmerk "Afvalkalender"
- **In de rij (2e regel):** `♻ Afvalkalender` in plaats van ritme en categorie. Het is geen badge, geen kleur en geen vlak (DS §7.13.1).
- **Met bezig:** `♻ Afvalkalender bezig`, volgens het patroon van vis-01.
- **Recycle, geen prullenbak:** een prullenbak betekent in deze app "verwijderen", en dat kan hier juist niet.
- **Geen categorie "Buiten" in de rij.** In het categoriefilter valt een afvaltaak wel onder Buiten.
- **In het detail:** de bovenregel `♻ Afvalkalender · ophaaldag di 6 okt`.

## 13.6 Taakdetail van een afvaltaak (aanvulling op §5.5)
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

## 13.7 Flows

### 13.7.1 Afvalkalender aanzetten (UC-13, AC-183), beheerder
1. Tandwiel (1) → rij **Afvalkalender · Uit** (2). In de oude UI: de springlink "Afval", of scrollen.
2. Toestand A: korte uitleg (T-40) en het formulier. Typen.
3. **Adres zoeken** (3). De knop toont "Zoeken…" en de velden zijn tijdelijk uitgeschakeld.
4. Toestand C, **Klopt dit?**:
   - het adres zoals de gemeente het kent. Geeft de bron geen straat, dan de vorm "2517 AB 12A, Den Haag". Dit wordt niet bewaard (BR-58);
   - de eerstvolgende ophaaldag per bak;
   - de uitleg T-46.
5. **Ja, aanzetten** (4). De knop toont "Bezig…". Daarna volgt toestand G met melding T-90 "… · **Bekijken**", en Bekijken opent de Kalender (week).

**4 tikken plus typen.** Eenmalig staat in G de tip T-53 of T-54 (V-56, BR-57), weg te tikken met ✕.

**Foutpaden.** Er wordt nooit iets bewaard, de velden blijven gevuld, en een eerder adres blijft ongewijzigd (AC-188, AC-214).

| Situatie | Toestand | Tekst | Wat kan de beheerder doen |
| --- | --- | --- | --- |
| Vorm klopt niet (bij het verlaten van een veld en bij Zoeken; AC-184) | A met veldfout | T-43, T-44, T-44b | aanpassen. Zoeken is uitgeschakeld zolang postcode of huisnummer leeg is |
| Onbekend of buiten Den Haag (AC-185) | D | T-60 | aanpassen, opnieuw zoeken |
| Meerdere adressen, geen toevoeging (AC-187) | C2 | T-61 en een rij per adres | op een rij tikken (1 tik) → C |
| De gemeente kent voor dit adres **vaststaand** geen rest, papier of PMD (AC-186) | E | T-62 | Ander adres |
| Bron onbereikbaar of onbruikbaar (> 8 s, fout, formaat; AC-188) | F | T-63 of T-63b | **Opnieuw proberen** (primair) |
| Geen enkele ophaaldag van vandaag t/m vandaag + 14, terwijl het adres wel bakken heeft; óf het is begin januari en de kalender van het lopende jaar is nog helemaal leeg (AC-237) | F2 | T-64 of T-64b | **Adres zoeken** (primair), later opnieuw |
| Opslaan mislukt | C blijft staan | T-65 | Ja, aanzetten opnieuw |
| Intussen geen beheerder meer (AC-189) | → J | T-66 (melding onderin) | — |
| Offline | A en C: knoppen uit | T-67 | — |

- **E of F2 bij twijfel:** E toont de app alleen als vaststaat dat de gemeente voor dit adres geen rest, papier of PMD noemt. Kan dat niet worden vastgesteld, bijvoorbeeld op 2 januari als de kalender van het nieuwe jaar nog niet online staat en de app dus geen enkele datum ziet, dan toont hij F2. Liever één keer te veel "probeer het over een paar dagen" dan ten onrechte "gebruiken jullie een ondergrondse container?".
- **Twee keer tikken:** er ontstaat één adres (AC-191). Twee beheerders tegelijk: de laatste bevestiging geldt, zonder melding.
- **Terugweg:** op C staat **Ander adres** (tekstknop), terug naar A met gevulde velden. De pagina verlaten = niets bewaard, zonder vraag "Wijzigingen weggooien?".

### 13.7.2 Adres wijzigen (verhuizen), beheerder (AC-214)
1. G → **Wijzigen** naast het adres (1). Het formulier opent gevuld met het huidige adres:
   - titel "Ander adres";
   - regel T-47;
   - knoppen **Adres zoeken** en **Annuleren**.
2. **Adres zoeken** (2) → C, met de extra regel T-48.
3. **Ja, dit adres gebruiken** (3) → G + melding T-91.

- **Hetzelfde adres als het bewaarde:** melding T-92. De taken, notities en "bezig" blijven. Er komt nooit "te snel".
- **Fouten:** zoals in 13.7.1, met de "huidige adres"-varianten T-63b en T-64b. Het oude adres en de oude taken blijven.
- **Annuleren:** terug naar G (of naar H als er een storing is).

### 13.7.3 Afvalkalender uitzetten, beheerder (AC-213)
1. G → onderaan **Afvalkalender uitzetten…** (danger-quiet) (1).
2. Sheet I, met de titel T-80 en de tekst T-81, T-81b of T-81c, afhankelijk van het aantal open afvaltaken. Knoppen: **Uitzetten** (danger) en **Annuleren** (2).
3. Terug naar A, met melding T-93. Er is geen Ongedaan maken, want het adres is gewist.

- **Waarom bevestigen:** het adres is weg en de taken verdwijnen voor iedereen.
- **Annuleren:** er verandert niets.
- **Offline:** de knop is uitgeschakeld (T-67).

### 13.7.4 Dagelijks gebruik (UC-14), iedereen
- **Avond vóór de ophaaldag:** Vandaag toont buitenzetten met "vanaf 22:00", en Binnenkort toont binnenzetten met "morgen".
  - Om 21:00 komt de push (M-01) naar wie Herinneringen aan heeft.
  - Tik op de push → detail → **Afvinken** (2 tikken). Of op Vandaag het rondje (1 tik).
- **Ophaaldag:**
  - tot 07:45 staat buitenzetten er nog met "vóór 07:45";
  - binnenzetten staat vóór 12:00 bovenaan Binnenkort ("vanaf 12:00"), en vanaf 12:00 onder Vandaag;
  - om 18:00 komt de push (M-02), alleen als de taak nog open is (AC-194).
- **Dag na de ophaaldag:** een open binnenzet-taak staat bij Verlopen. Aan het begin van de dag daarna (of eerder, bij een nieuwe buitenzet-taak) vervalt hij vanzelf (§13.4).
- **Afvinken en terugdraaien:** de melding "Gedaan: … · Ongedaan maken" werkt zoals in §4.1 en §4.2. Buiten en binnen worden los afgevinkt (AC-207).
- **Offline:** afvinken, bezig en overslaan gaan via de wachtrij (TD §9.3). Bij offline overslaan van buitenzetten toont de app binnenzetten meteen ook als overgeslagen. De server bevestigt dat bij verzenden.

### 13.7.5 Storing (BR-52, AC-204, AC-205), alleen beheerders
- **Minder dan 48 uur, of één enkele hapering** (er is een foutcode, maar nog geen storing):
  - onder de kop van G staat alleen de stille regel T-71 (bij `ADDRESS_GONE`: T-71b);
  - er is geen balk, geen melding en geen knop;
  - de app probeert het elk uur opnieuw.
- **Minder dan 48 uur zonder foutcode** (de achtergrondtaak heeft het ophalen een tijd niet gedaan): gewoon G. De kop toont eerlijk het laatste tijdstip, bijvoorbeeld "bijgewerkt gisteren 06:15". Er komt geen stille regel.
- **Storing** (`health = failed`: langer dan 48 uur zonder succes, om welke reden ook, of een aanhoudend leeg antwoord):
  - de beheerders krijgen één melding, volgens de oorzaak: M-03 (onbereikbaar, onbruikbaar, of **geen foutcode**), M-04 (leeg) of M-05 (adres niet gevonden);
  - de rij in Instellingen toont "Niet bijgewerkt" (T-37);
  - de pagina toont toestand H: de balk bovenaan, met tekst per oorzaak (§13.8.2);
  - **geen foutcode** (de achtergrondtaak lag stil of sloeg het ophalen steeds over) geeft H1 met M-03. T-76 is zo geformuleerd dat hij dan ook klopt.
- **Een storing blijft een storing tot het echt weer lukt:**
  - is de storing eenmaal vastgesteld, dan blijven balk H en "Niet bijgewerkt" staan tot het bijwerken weer gelukt is;
  - verandert intussen de oorzaak (bijvoorbeeld eerst leeg, dan onbereikbaar), dan verandert alleen de tekst in de balk (H2 wordt H1). Er komt geen tweede melding;
  - de balk maakt nooit tussendoor plaats voor de stille regel T-71;
  - reden: de beheerder heeft net een storingsmelding gekregen, en er is niets hersteld.
- **Kalender van volgend jaar ontbreekt** (december: het venster loopt al door tot in januari, maar de gemeente heeft nog geen kalender voor dat jaar):
  - stille regel T-73 onder de kop, geen balk en geen melding;
  - wordt het venster helemaal leeg, dan volgt H2.
- **Weer gelukt:** de balk en "Niet bijgewerkt" verdwijnen vanzelf. Er komt geen melding "weer gelukt". Na een handmatige poging komt wel melding T-94. Een latere, nieuwe storing geeft opnieuw één melding.
- **Gezinsleden** zien niets van een storing (AC-205).

### 13.7.6 "Opnieuw proberen" (alleen in balk H, en als opnieuw zoeken in toestand F)
- **Waar de knop staat:** alleen in balk H.
- **G′ heeft bewust geen knop.** Bij een enkele hapering herstelt de app zich elk uur zelf (T-71 zegt dat), en een knop nodigt alleen uit tot nerveus tikken.
- **Gevolg:** vóór er een storing is, kan niemand handmatig proberen. Een storing kan dus ook nooit door vaker tikken eerder ontstaan. De regel "vaker proberen maakt een storing niet eerder" is een regeltest op de gezondheidsregel, geen scenario in het scherm.

**In balk H:**

| Stap | Wat de beheerder ziet | Wat hij kan doen |
| --- | --- | --- |
| Tikken | de knop wordt "Bezig…" (`text-3`, uitgeschakeld), hooguit 12 s. De rest van de pagina blijft bruikbaar | wachten |
| Gelukt | de balk verdwijnt. De kop wordt "Aan · bijgewerkt vandaag 14:32" en Volgende ophaaldagen zijn bijgewerkt. Melding onderin T-94 | niets nodig |
| Nog steeds fout | de balk **blijft**, met eventueel een andere oorzaaktekst als de oorzaak veranderd is. Onder de uitleg staat de regel T-78 met de tijd van de poging. De knop is weer actief | later opnieuw, of bij H3 "Adres controleren" |
| Te snel (`too_soon`: iemand anders of de achtergrond probeerde het binnen de minuut) | regel T-79 op dezelfde plek als T-78. Er is **geen** melding onderin | na een minuut opnieuw |
| Geen beheerder meer | melding T-66; de pagina toont J | — |
| Offline | de knop is uitgeschakeld, met T-67 eronder | — |

- De regels T-78 en T-79 staan in de balk, die `role="status"` heeft. Ze blijven staan tot de volgende poging of tot de pagina opnieuw geladen wordt.
- **Route om T-79 in het scherm te zien:** twee beheerders hebben tegelijk balk H open en tikken binnen een minuut allebei op "Opnieuw proberen". Of één beheerder tikt vlak nadat de achtergrondtaak het ophalen probeerde.

**In toestand F:** "Opnieuw proberen" is gewoon opnieuw zoeken. Je ziet "Zoeken…" en daarna C, C2, D, E, F of F2.

## 13.8 Scherm: Instellingen › Afvalkalender

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

### 13.8.1 Toestanden

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
| E | Geen bakken (vaststaand) | T-62 | Ander adres |
| F | Bron onbereikbaar | `sunken`-balk T-63/T-63b boven het formulier, velden gevuld | Opnieuw proberen |
| F2 | Nog geen komende ophaaldagen (ook begin januari zonder kalender) | `sunken`-balk T-64/T-64b boven het formulier, velden gevuld | Adres zoeken |
| — | Bezig (opslaan, uitzetten) | knop "Bezig…" | wachten |
| — | Opslaan mislukt | T-65 bovenaan C, invoer blijft | opnieuw |
| G | Aan, in orde | kop T-70, adresrij, Volgende ophaaldagen (op datum), uitleg T-52, eenmalige tip, Uitzetten… | Wijzigen · Uitzetten… |
| G′ | Aan, hapering (foutcode, nog geen storing) | G + stille regel T-71/T-71b onder de kop; **geen** knop | idem als G |
| G″ | Aan, kalender volgend jaar ontbreekt | G + stille regel T-73 | idem als G |
| — | Gedeeltelijk | een bak zonder datum: "nog geen ophaaldag bekend" (T-45b) | — |
| H | Aan, storing | kop T-72, balk per oorzaak (§13.8.2), sectiekop met "· stand za 26 sep". Blijft staan tot het bijwerken weer gelukt is | Opnieuw proberen · (H3: Adres controleren) · Wijzigen · Uitzetten… |
| — | Opnieuw proberen | §13.7.6 | — |
| I | Bevestiging uitzetten | sheet T-80 + T-81/T-81b/T-81c | Uitzetten · Annuleren |
| J | Gezinslid | Aan/Uit + regel T-38/T-39 | niets |
| — | Offline | laatst bekende stand; knoppen uit met T-67 | bekijken |

**Voorrang (hooguit één regel of balk onder de kop):**
- H gaat voor alles. T-71, T-71b en T-73 staan er dan niet.
- G′ en G″ sluiten elkaar uit, want G″ vraagt een geslaagde laatste bijwerking.
- Zonder foutcode en zonder storing: G, zonder stille regel.

### 13.8.2 Storingsbalk H per oorzaak
- De tekst hangt af van `last_error_code`, dus van de laatst bekende oorzaak, en niet van de reden van het alarm.
- Opmaak volgens DS §7.13.4: `sunken`, geen rood.
- De balk blijft staan tot het bijwerken weer gelukt is. Alleen de variant (H1/H2/H3) volgt de laatste oorzaak.

| # | Oorzaak (`last_error_code`) | Titel | Uitleg | Knoppen |
| --- | --- | --- | --- | --- |
| H1 | `UNREACHABLE`, `FORMAT` of **geen foutcode** (achtergrondtaak lag stil) | T-75 | T-76 | Opnieuw proberen |
| H2 | `SUSPECT_EMPTY` | T-77 | T-77a (december en januari) of T-77b (andere maanden) | Opnieuw proberen |
| H3 | `ADDRESS_GONE` | T-77c | T-77d | **Adres controleren** (opent A′, gevuld) · Opnieuw proberen |

## 13.9 Formulier adres (aanvulling op §6)

| Veld | Type | Standaard | Validatie (moment) |
| --- | --- | --- | --- |
| Postcode | tekst, `autocomplete="postal-code"`, `autocapitalize="characters"`, max 7, plaatshouder "2517 AB" | leeg (bij wijzigen: het huidige) | bij verlaten en bij Zoeken: 4 cijfers (niet beginnend met 0) + 2 letters. Bij verlaten wordt de postcode netjes gezet: "2517ab" → "2517 AB". Fout: T-43 |
| Huisnummer | `inputmode="text"`, max 8 | leeg | 1–99999. "12a" of "12 a" wordt bij verlaten stil 12 + toevoeging "A" (AC-187). Fout: T-44 |
| Toevoeging (optioneel) | tekst, max 4, plaatshouder "A of 2", `autocapitalize="characters"` | leeg | letters en cijfers, hooguit 4. Fout: T-44b |

- **Indeling:** postcode en huisnummer naast elkaar (60/40), de toevoeging eronder in de linkerkolom.
- **Waarom tekst voor huisnummer:** een numeriek toetsenbord maakt "12a" onmogelijk. De gebruiker typt zoals hij het adres kent, en de app splitst het.
- **Vormfout:** foutregel bij het veld. **Antwoord van de bron:** regel of balk boven het formulier (D, F, F2). De velden blijven altijd gevuld.
- **Dubbel tikken:** voorkomen doordat de knop tijdens het zoeken uitgeschakeld is. Een eventuele korte wachttijd tussen twee pogingen is voor de gebruiker onzichtbaar; de knop toont dan gewoon "Zoeken…".

## 13.10 Meldingen (aanvulling op §4.9)
Geen adres, geen straat, geen namen (BR-58, AC-212). Titel en tekst in de lijst Meldingen zijn gelijk aan de push. Het label in de lijst is T-39c.

| ID | Wanneer | Aan wie | Titel | Tekst | Tik opent |
| --- | --- | --- | --- | --- | --- |
| M-01 | D−1 21:00, buitenzetten open (AC-194) | wie "Herinneringen" aan heeft (V-50, AC-211) | Herinnering: <taaknaam> | Morgen ophaaldag. Mag vanaf 22:00 buiten, uiterlijk morgen 07:45. | taakdetail |
| M-02 | D 18:00, binnenzetten open | idem | Herinnering: <taaknaam> | één bak: "Vandaag was de ophaaldag. Zet de bak vandaag nog binnen." · meer bakken: "Vandaag was de ophaaldag. Zet de bakken vandaag nog binnen." | taakdetail |
| M-03 | storing, oorzaak `UNREACHABLE`/`FORMAT`, of **geen foutcode** (de achtergrondtaak lag stil) | alleen actieve beheerders, één keer per storing (AC-205) | De afvalkalender kon niet worden bijgewerkt | Laatst gelukt op <za 26 sep>. Nieuwe ophaaldagen komen er pas bij als het weer lukt. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl. | Instellingen › Afvalkalender |
| M-04 | storing, oorzaak `SUSPECT_EMPTY` | idem | De afvalkalender kon niet worden bijgewerkt | De gemeente geeft voor de komende twee weken geen ophaaldagen. Soms staat de nieuwe kalender nog niet online. Kijk zelf op huisvuilkalender.denhaag.nl. | idem |
| M-05 | storing, oorzaak `ADDRESS_GONE` | idem | De afvalkalender vindt het adres niet meer | De gemeente kent het adres niet meer. Controleer het in Instellingen › Afvalkalender. Tot die tijd komen er geen nieuwe ophaaldagen bij. | idem |

- De oorzaak bij het versturen bepaalt de variant. Er komt één melding per storing, ook als de oorzaak tijdens de storing verandert. Een storing loopt tot het bijwerken weer gelukt is (§13.7.5).
- Geen "deadline nadert" en geen "verlopen" voor afvaltaken (V-50, AC-211). Ook geen melding bij het vanzelf vervallen van een taak.
- De storingsmelding komt altijd in de lijst, plus push als die op het toestel aan staat. Er is geen eigen schakelaar.

## 13.11 Taken, Kalender en Overzicht
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
- **Overzicht** (nieuwe UI, WP8): in "Vaak te laat of vergeten" en "Vaak gedaan" tellen alle afvaltaken samen als T-97 en T-98.

## 13.12 Rechten (aanvulling op §9)

| Element | Beheerder | Gezinslid | Hoe bij "nee" |
| --- | --- | --- | --- |
| Aanzetten, adres wijzigen, uitzetten (AC-189) | ja | nee | verborgen; J |
| Adres en bijwerkstatus zien (AC-190) | ja | nee (V-53) | verborgen |
| Storingsbalk, stille regels, storingsmelding, "Opnieuw proberen" (AC-205, AC-236) | ja | nee | — |
| Afvinken, terugzetten, bezig, notitie, overslaan (AC-207, AC-209) | ja | ja | — |
| Verplaatsen, bewerken, verwijderen, slepen, omzetten (AC-208) | nee | nee | verborgen + uitlegregel T-27 |
| Herinneringsrij in het detail | als de eigen "Herinneringen" aan staat | idem | rij ontbreekt |

## 13.13 Oude UI (WP3b) en nieuwe UI (WP4–WP8)

### 13.13.1 Oude UI (live op `main`, AC-217)

| Onderdeel | Wat er verandert (alleen voor afvaltaken) |
| --- | --- |
| Instellingen | `SettingsSection id="afvalkalender"` na Huishouden, springlink "Afval", toestanden A–J inline. D gebruikt de tekststijl van de veldfout als één regel boven de velden, zonder rode rand. F, F2 en H zijn `bg-muted`-balken, niet rood |
| Taakkaart | meta: recycle-icoon + "Afvalkalender" in plaats van categorie en ↻. Klokje: "vanaf 22:00" / "vóór 07:45" / "vanaf 12:00" in plaats van "21:00". **Geen** deadlinebadge behalve "… te laat"; bij Verlopen alleen de badge, zonder klokje |
| Binnenkort | binnenzetten op D vóór 12:00: "Vandaag" + "vanaf 12:00". Op D−1: "Morgen" (bestaande `relativeDayLabel`) |
| Taakdetail | kopregel: statusbadge + meta-tekst "♻ Afvalkalender · ophaaldag di 6 okt" (geen nieuwe badge). **Geen** omschrijving. ⋯-menu alleen met Ik ben ermee bezig / Niet meer bezig / Deze keer overslaan / Toch nog doen (volgens 13.6). Bewerken, Verwijderen en de scheidingslijn zijn weg. De rijen Wanneer (met datumkiezer), Beschikbaar, Uiterlijk en Categorie worden vervangen door de afval-infolijst uit 13.6; de rij Gedaan blijft. Daaronder uitlegregel T-27 (`text-sm text-muted-foreground`) |
| Kalender | "21:00" wordt "vanaf 22:00"; binnenzetten "vanaf 12:00"; `useDraggable` uit |
| Meldingen | teksten M-01…M-05; label T-39c voor `waste_sync_failed` |
| Tip | T-54 (verwijst naar Terugkerend op dezelfde pagina) |

### 13.13.2 Nieuwe UI (`v2-ui`): per werkpakket, zodat analist en reviewers ertegen kunnen toetsen

| WP | Onderdeel | Toetspunt |
| --- | --- | --- |
| WP4 | snapshot bevat de afvalvelden | een afvaltaak toont kenmerk en rechterkolom (anders onzichtbaar) |
| WP5 | rij en detail | §13.4, §13.5, §13.6: geen ⋯, twee secundaire knoppen, herinneringsrij volgens de instelling, geen omschrijving |
| WP6 | Taken › Terugkerend, bewerk-URL | informatierij T-96; `?bewerk=<id>` van een afvaltaak opent `?taak=<id>` |
| WP7 | subpagina | toestanden §13.8.1 en §13.8.2; doorsturen vanaf `/instellingen#afvalkalender` |
| WP8 | Kalender, Meldingen, Overzicht | slepen uit; T-95; meldingslijst M-03…M-05 met label T-39c; groepering T-97/T-98 |

### 13.13.3 Checkpoint CP-W03: rook-screenshots WP3b (de enige lijst; TD §18.16 U3 en AC-217 verwijzen hiernaar)
Op 390×844, oude UI, gemaakt op de lokale stack met de stub. Ook donker, als de oude UI dat heeft. Beoordeeld door visual-qa en ux-reviewer (licht) vóór U4.

**Instellingen, beheerder:**
- A, A met veldfout, B, C, C bij wijzigen (met T-48), C2, D, E, F, F2 (ook "2 januari, kalender ontbreekt"), "opslaan mislukt" (T-65);
- G (met tip), "Gedeeltelijk" (bak met T-45b), G′ (T-71 en T-71b), G″ (T-73);
- H1 (onbereikbaar), H1 zonder foutcode (achtergrondtaak lag stil), H2 (T-77a en T-77b), H3;
- H tijdens "Bezig…", H na "nog steeds fout" (T-78), H na "te snel" (T-79 in de balk, geen melding onderin), H die blijft staan na een herstelpoging met een andere oorzaak (H2 wordt H1);
- I (n = 4 en n = 0), offline (knoppen uit met T-67), laden mislukt (T-68).

**Instellingen, gezinslid:** J aan en J uit.

**Meldingen onderin:** T-90, T-91, T-92, T-93, T-94, T-31.

**Lijsten:**
- Vandaag op ma 19:30 (buiten "vanaf 22:00", binnen "Morgen");
- Vandaag na middernacht (buiten "vóór 07:45");
- Vandaag op di 09:10 (buiten verlopen, binnen "vanaf 12:00" in Binnenkort);
- Verlopen op wo (binnenzetten "1 dag te laat").

**Detail:** taakdetail buitenzetten en binnenzetten, als beheerder (met herinneringsrij) en als gezinslid (zonder), en een overgeslagen taak met "Toch nog doen".

**Overig:** Kalenderweek met afvaltaken; meldingenlijst met storingsmelding (label T-39c).

## 13.14 Wireframes (tekst, 390×844, nieuwe UI tenzij anders vermeld)

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

**F — Bron onbereikbaar / F2 — Nog geen komende ophaaldagen (ook begin januari)**
```
┌ ⓘ De huisvuilkalender van de gemeente is ┐   ← sunken
│   nu niet bereikbaar. Er is niets         │
│   opgeslagen.                             │
└───────────────────────────────────────────┘
Postcode [ 2517 AB ]  Huisnummer [ 12 ]
[        Opnieuw proberen         ]
---
┌ ⓘ De gemeente heeft nog geen ophaaldagen ┐
│   voor de komende weken online gezet. De  │
│   kalender van het nieuwe jaar komt       │
│   meestal rond de jaarwisseling online.   │
│   Er is niets opgeslagen. Probeer het     │
│   over een paar dagen opnieuw.            │
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

**H1 — Storing (onbereikbaar, onbruikbaar of zonder foutcode), na "nog steeds fout"**
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

## 13.15 Toetsvragen
- **Kernflow zonder uitleg?** Ja. A legt in één zin uit wat er gebeurt, C toont het resultaat vóór het bewaren, en afvinken werkt zoals altijd.
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
  - Geen "(0 taken)".
  - Geen knop bij een hapering die zichzelf herstelt.
  - Geen binnenzet-taak die dagenlang bij Verlopen blijft staan.
  - Een gezinslid ziet geen adres of status.
- **Eerlijk?**
  - T-76 klopt ook als de app zelf niet heeft geprobeerd.
  - T-52 noemt de twee vaste momenten.
  - De balk verdwijnt pas als het echt weer gelukt is.
  - Begin januari zegt de app niet ten onrechte "ondergrondse container".
- **Alle states?** Zie §13.8.1, §13.8.2, §13.7.6, §13.4 en §13.6. Leeg, laden, laden mislukt, fout per oorzaak (ook zonder foutcode), bezig, gelukt, uitgeschakeld (offline, leeg veld), gedeeltelijk (bak zonder datum, kalender volgend jaar ontbreekt).

## 13.16 Definitieve gebruikersteksten (enige bron; analist, architect en visual-designer nemen deze letterlijk over)

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
| T-45a | C, adresweergave | met of zonder straat | <straat> <nr><toev>, <plaats> · anders: <adres>, Den Haag |
| T-45b | C en G, bak zonder datum | — | nog geen ophaaldag bekend |
| T-46 | C, uitleg | — | De avond vóór elke ophaaldag staat er een taak **buitenzetten**, met een herinnering om 21:00. Op de ophaaldag vanaf 12:00 een taak **binnenzetten**, met een herinnering om 18:00. Iedereen in het huishouden ziet de taken. Het adres zien alleen beheerders. |
| T-46b | C, knoppen | aanzetten / wijzigen / bezig | Ja, aanzetten · Ja, dit adres gebruiken · Bezig… · Ander adres |
| T-47 | A′, titel en regel | wijzigen | Ander adres · Het huidige adres blijft gebruikt tot je het nieuwe bevestigt. · knop Annuleren |
| T-48 | C, extra regel | wijzigen | Open afvaltaken van het oude adres worden vervangen. Wat al gedaan is, blijft in de historie. |
| T-60 | D | onbekend of buiten Den Haag | Dit adres staat niet in de huisvuilkalender van Den Haag. Controleer postcode en huisnummer. De afvalkalender werkt alleen voor adressen in Den Haag. |
| T-61 | C2 | meerdere adressen | Op nummer <nr> staan meerdere adressen. Welke is van jullie? |
| T-62 | E | vaststaand geen rest, papier of PMD | Voor dit adres geeft de gemeente geen ophaaldagen voor restafval, papier of PMD. Gebruiken jullie een ondergrondse container? Dan hoeft er niets buiten te staan. |
| T-63 | F | aanzetten | De huisvuilkalender van de gemeente is nu niet bereikbaar. Er is niets opgeslagen. · knop Opnieuw proberen |
| T-63b | F | wijzigen | De huisvuilkalender van de gemeente is nu niet bereikbaar. Er is niets opgeslagen; het huidige adres blijft gebruikt. |
| T-64 | F2 | aanzetten | De gemeente heeft nog geen ophaaldagen voor de komende weken online gezet. De kalender van het nieuwe jaar komt meestal rond de jaarwisseling online. Er is niets opgeslagen. Probeer het over een paar dagen opnieuw. |
| T-64b | F2 | wijzigen | De gemeente heeft nog geen ophaaldagen voor de komende weken online gezet. De kalender van het nieuwe jaar komt meestal rond de jaarwisseling online. Er is niets opgeslagen; het huidige adres blijft gebruikt. Probeer het over een paar dagen opnieuw. |
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
| T-72 | H, kop en sectiekop | storing | **Aan** · laatst bijgewerkt <tijdstip> · sectiekop: Volgende ophaaldagen · stand <dag> |
| T-73 | G″, stille regel | december, kalender J+1 ontbreekt, venster loopt tot in januari | De kalender voor <jaar> staat nog niet online. Ophaaldagen vanaf 1 januari komen erbij zodra hij er is. |
| T-75 | H1, titel | `UNREACHABLE`/`FORMAT`/geen foutcode | Niet bijgewerkt sinds <dag van last_success_at> |
| T-76 | H1, uitleg | idem | Het lukt de app al een tijd niet om de ophaaldagen bij de gemeente op te halen. De taken die er staan, blijven staan; nieuwe ophaaldagen komen er pas bij als het weer lukt. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl. |
| T-77 | H2, titel | `SUSPECT_EMPTY` | Geen ophaaldagen voor de komende twee weken |
| T-77a | H2, uitleg | december of januari | De gemeente geeft voor de komende twee weken geen enkele ophaaldag. Waarschijnlijk staat de kalender van het nieuwe jaar nog niet online. De taken die er staan, blijven staan. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl. |
| T-77b | H2, uitleg | andere maanden | De gemeente geeft voor de komende twee weken geen enkele ophaaldag. Dat is ongebruikelijk. De taken die er staan, blijven staan. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl. |
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
| T-90 | melding onderin | aangezet | Afvalkalender staat aan · taken voor 2 weken klaargezet · Bekijken |
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
- de toast "Opgeslagen" (wordt T-90, T-91 of T-92);
- "Restafval binnenzetten" en "Restafval en papier binnenzetten";
- T-52 oud: "… De app kijkt elke ochtend of de gemeente iets veranderd heeft.";
- T-64 oud: "Meestal komt de kalender van het nieuwe jaar eind december online.";
- T-76 oud: "De huisvuilkalender van de gemeente geeft geen bruikbaar antwoord. …".

## 13.17 Verwijzingen naar acceptatiecriteria (nummering analist ronde 3; niet verschoven ten opzichte van ronde 2)
- AC-183 (aanzetten), AC-184 (vorm), AC-185 (D), AC-186 (E; bij twijfel F2), AC-187 (schrijfwijze, C2), AC-188 (F);
- AC-189 (gezinslid), AC-190 (wie ziet het adres), AC-191 (dubbel tikken), AC-192 (buitenzetten), AC-193 (binnenzetten), AC-194 (herinnering alleen bij een open taak);
- AC-201 (naam past zich aan), AC-204 (hapering), AC-205 (storing per oorzaak, ook zonder foutcode; balk blijft tot herstel);
- AC-207 (los afvinken), AC-208 (wel/niet), AC-209 (overslaan werkt door), AC-210 (verlopen/vervallen, met bovengrens D+2 voor binnenzetten), AC-211 (wie de herinnering krijgt), AC-212 (geen adres);
- AC-213 (uitzetten), AC-214 (wijzigen), AC-217 (oude UI, CP-W03-lijst §13.13.3), AC-220 (december), AC-222 (hetzelfde adres), AC-236 ("Opnieuw proberen", alleen in balk H), AC-237 (F2, ook begin januari).

In §13 staat geen enkele verwijzing naar de nummering van ronde 1.