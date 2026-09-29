## Visueel ontwerp: W-03 afvalkalender (aanvulling op het design system), ronde 1
Documenten: DESIGN_SYSTEM.md is NIET gewijzigd, want het is bevroren. De invoegtekst staat hieronder.
Prototype: /home/user/takenlijstje/docs/prototype/w03/, met 6 schermen: 01-instellingen-aan (G), 02-klopt-dit (C), 03-vandaag-avond, 04-vandaag-ophaaldag, 05-instellingen-storing (H) en 06-adres-leeg (A met een veldfout). Daarnaast staan in die map ds.css, fonts/ en shell.js als kopie uit ../visueel (het screenshotscript serveert alleen de map van het bestand). shell.js heeft er de iconen recycle en chevron-left bij gekregen, en w03.css bevat alleen de aanvullingen, zonder nieuwe tokens.
Screenshots bekeken (390×844, allemaal met Read geopend), in /home/user/takenlijstje/docs/screenshots/prototype/:
- w03-01-instellingen-aan-390x844.png
- w03-02-klopt-dit-390x844.png
- w03-03-vandaag-avond-390x844.png
- w03-04-vandaag-ophaaldag-390x844.png
- w03-05-instellingen-storing-390x844.png
- w03-05-instellingen-storing-donker-390x844.png
- w03-06-adres-leeg-390x844.png

Alle screenshots gaven 0 consolefouten, 0 paginafouten en 0 mislukte verzoeken.

Karakter in één zin: een afvaltaak is een gewone taak in de rustige lijst. Hij valt alleen op door een grijs kenmerk en een eigen tijd in de tijdkolom, en een storing wordt gemeld zonder alarm.

Ook bekeken: DESIGN_SYSTEM.md, product-designer-r1 §13, solution-architect-r2 §18.9–18.14, wp2a/instellingen en wp2a/vandaag, vis-01 en wf-14, en de oude code (task-card.tsx, shared.tsx, household-section.tsx, button.tsx, badge.tsx).

### Na het eerste beeld aangepast
- "Wijzigen" stond onderstreept in 17 px. Nu is het 15/600 zonder onderstreping, zoals de andere tekstlinks in lijsten.
- Tussen "Afvalkalender" en het label "bezig" stond een extra " · ". Die is weg; "bezig" volgt direct, net als in vis-01.
- Donkere modus van de storingsbalk: leesbaar, geen rood, de accentlink is duidelijk.

---

# TEKST VOOR DESIGN_SYSTEM (letterlijk invoegen)

## (1) §7.10 Iconografie — nieuwe regel in de tabel (na `repeat (↻)`)

| recycle | afvaltaak / Afvalkalender: meta in de rij, bovenregel in het taakdetail, sectie-icoon in de oude instellingen, informatierij in Taken › Terugkerend. **Niet** trash-2: een prullenbak betekent in deze app "verwijderen", en dat kan bij een afvaltaak juist niet |

Regel eronder: *"♻" in de documenten is een afkorting. In de app staat altijd het Lucide-icoon `Recycle` en nooit het Unicode-teken ♻ of een emoji. Dat teken wordt op iOS en Android als groene emoji getoond, verschilt per toestel en zou kleur zonder functie in de lijst brengen.*

## (2) Nieuwe §7.13 Afvalkalender (W-03)

### 7.13.1 Kenmerk in de lijstrij (aanvulling op §7.4)
- **Meta (2e regel):** icoon `recycle` 14 px, lijndikte 2, in `currentColor`, met 5 px afstand tot het woord **Afvalkalender**. Stijl `text-meta` (14/18, 400) in `text-3`, precies zoals "↻ wekelijks". Het kenmerk vervangt ritme en categorie; er staat dus geen ↻ en geen "Buiten".
- **Met bezig:** `[recycle] Afvalkalender [bezig]`. Het label "bezig" volgt direct, zonder "·", net als in vis-01.
- **Geen badge, geen vlak, geen eigen kleur.** Het is geen vierde badge (§7.9 blijft: drie badges).
- **Verlopen:** de rij staat in het vlak Verlopen volgens het bestaande patroon. Het kenmerk blijft `text-3`, alleen de tijdkolom en de rand van het rondje worden `overdue`.
- **Gedaan:** zoals elke rij (doorgestreept `text-3`). Het kenmerk blijft staan.
- **Toegankelijk:**
  - het icoon is `aria-hidden`; het zichtbare woord "Afvalkalender" draagt de betekenis en komt zo mee in de naam van de rijknop;
  - het rondje heeft `aria-label="<taaknaam> afvinken"`, zoals elke rij;
  - er is geen `title` of tooltip op het icoon.

### 7.13.2 Kenmerk in het taakdetail (aanvulling op §7.7)
- **Bovenregel:** `[recycle 14 px] Afvalkalender · ophaaldag di 6 okt`, 14/18, gewicht 500, in `text-2`. Dit is dezelfde regel als "↻ Elke zaterdag · …" bij een reeks.
- **Infolijst:** het bestaande patroon (label links `text-2`, waarde rechts `text`, regel **Uiterlijk** vet, datums `tabular-nums`).
- **Uitlegregel onder de infolijst:** `text-meta` in `text-3`, zonder icoon en zonder vlak.
- **Secundaire knoppen:** twee `secondary`-knoppen naast elkaar (1fr 1fr, 8 px tussenruimte), "Ik ben ermee bezig" en "Deze keer overslaan". Er is geen ⋯.

### 7.13.3 Tijdkolom voor afvaltaken (aanvulling op §7.4 "Tijd")
Dit is dezelfde stijl `text-when`:
- voorzetsel in `text-3`, gewicht 500;
- tijd in `text`, gewicht 600;
- `tabular-nums`, rechts uitgelijnd, 12 px afstand tot de titel.

| Moment | Rechterkolom |
| --- | --- |
| buitenzetten, dag vóór de ophaaldag | <span>vanaf</span> **22:00** |
| buitenzetten, ophaaldag 00:00–07:45 | <span>vóór</span> **07:45** |
| buitenzetten na 07:45 (Verlopen) | het bestaande verlopen-patroon: "**1 uur**" / "te laat", in `overdue` op twee regels |
| binnenzetten, ophaaldag vóór 12:00 (Binnenkort, bovenaan) | <span>vanaf</span> **12:00** |
| binnenzetten, ophaaldag vanaf 12:00 (Vandaag) | leeg (gewoon vandaag) |
| binnenzetten, dag vóór de ophaaldag (Binnenkort) | **morgen** (de bestaande dagnotatie) |

- "vanaf" en "vóór" zijn altijd kleine letters in `text-3`.
- **Nooit "om 21:00".** 21:00 is alleen het herinneringsmoment en komt nooit in de rij.
- Bij een grotere tekstinstelling geldt §9: de tijdkolom gaat onder de titel staan.

### 7.13.4 Waarschuwingsbalk afvalkalender (toestand H) en bronfout (toestand F)
- **Vlak:** `sunken`, radius 16 (`r-lg`, want het vlak bevat een knop en is groter dan de offlinebalk van 12), zonder rand of schaduw. Binnenruimte 12 px boven, 12 px links, 14 px rechts, 4 px onder (de tekstknop heeft zelf 44 px raakvlak). Afstand tot de kop: 16 px.
- **Opbouw:** twee kolommen (16 px icoon | tekst, 10 px tussenruimte):
  - icoon `circle-alert` 16 px, lijndikte 2, in `text-2`, 2 px omlaag zodat het op de eerste tekstregel staat;
  - titel 15/20, gewicht 600, in `text`: "Niet bijgewerkt sinds za 26 sep";
  - uitleg `text-meta` 14/18 in `text-2`;
  - daaronder, gelijk met de tekst, de **tekstknop** "Opnieuw proberen" (variant `text`, `accent`, 44 px).
  - Er komt geen secundaire knop in `sunken`: die zou op het `sunken`-vlak verdwijnen.
- **Geen rood,** ook niet voor het icoon: het is geen fout van de gebruiker (§8).
- **Kopregel:** eronder staat "Aan · laatst bijgewerkt za 26 sep 06:15".
- **Sectiekop:** "Volgende ophaaldagen", met "· stand za 26 sep" in `text-3`, gewicht 500.
- **Toegankelijk:** `role="status"`, zodat een schermlezer de balk één keer meldt bij het openen.
- **Bezig:** "Opnieuw proberen" wordt "Bezig…" in `text-3` en is uitgeschakeld.
- **Te snel (`too_soon`):** de melding onderin "Net geprobeerd. Probeer het over een minuut opnieuw."
- **Offline:** de knop is uitgeschakeld (`text-3`), met de regel "Hiervoor heb je internet nodig".
- **Toestand F (bron onbereikbaar bij zoeken):**
  - hetzelfde vlak en dezelfde opbouw, boven het formulier;
  - tekst "De huisvuilkalender van de gemeente is nu niet bereikbaar. Er is niets opgeslagen.";
  - de primaire knop onder het formulier wordt "Opnieuw proberen".
- **Toestand D (adres onbekend / buiten Den Haag):** dit is geen storing maar een antwoord op wat de gebruiker invulde. Daarom geldt het bestaande patroon "serverfout als regel bovenaan" (§8): `circle-alert` + tekst in `overdue`, 14/18 gewicht 500, boven de velden, velden gevuld, zonder rode rand om de velden.
- **Rij "Afvalkalender" in Instellingen bij een storing:** de waarde rechts is `[circle-alert 16 px] Niet bijgewerkt` in `text-2`. Ook hier geen rood.

### 7.13.5 Adresformulier en "Klopt dit?"
**Formulier (toestand A):**
- De uitleg staat bovenaan in `text-sub` (15/20) `text-2`, met **buitenzetten** en **binnenzetten** in 600 `text`.
- **Raster:** postcode en huisnummer naast elkaar, `grid-template-columns: 3fr 2fr` (60/40), 12 px tussen de kolommen en 16 px tussen de regels. De toevoeging staat op de tweede regel in de **linkerkolom** (even breed als postcode), zodat de linkerranden gelijk lopen en een veld voor 4 tekens niet schermbreed wordt.
- **Velden:** het bestaande invoerveld (§7.2):
  - label `text-label` boven het veld, 48 px hoog, `surface` met `line`-rand;
  - waarde 17 px, `tabular-nums`; postcode in hoofdletters (`autocapitalize="characters"`);
  - plaatshouders "2517 AB" en "A of 2" in `text-3`;
  - label "Toevoeging (optioneel)".
- **Fout per veld:** 2 px `overdue`-rand + foutregel onder dat veld (icoon + tekst in `overdue`). De regel loopt binnen de eigen kolom door op een tweede regel (zie screenshot 06).
- **Knop "Adres zoeken":** `primary`, volle breedte, 24 px onder het formulier.
  - Eronder de privacyregel in `text-meta` `text-3`: "Alleen postcode en huisnummer gaan naar de gemeente. Alleen beheerders zien het adres."
  - Uitgeschakeld zolang postcode of huisnummer leeg is: `sunken` + `text-3`.
  - Bezig: de knop toont "Zoeken…" en de velden zijn uitgeschakeld (`sunken`, `text-3`).

**Klopt dit? (toestand C):**
- **Kop:**
  - subpaginakop "‹ Instellingen";
  - titel "Klopt dit?" (`text-title` 22/28);
  - ondertitel `text-sub` in `text-2`: "Zo kent de gemeente jullie adres." `[VOORSTEL, tekst ter bevestiging door de product-designer]`
- **Adres:** 17/24, gewicht 600, in `text`, 14 px onder de kop: "Laan van Meerdervoort 12A, Den Haag". Er is geen vlak of kaart omheen: het adres is het onderwerp van de pagina, niet een groep.
- **Sectiekop:** "Eerstvolgende ophaaldagen" (`text-section`, 26 px erboven).
- **Ophaaldagen:** in de bestaande **infolijst** (haarlijnen, bak links in `text-2`, datum rechts in `text`, `tabular-nums`).
  - Vaste volgorde: Restafval, Papier, PMD. Status G sorteert op datum, zoals UX §13.14 aangeeft.
  - Een bak zonder datum in de komende weken: "geen ophaaldag in de komende weken" in `text-3`.
- **Uitleg:** één alinea `text-sub` `text-2`, met **buitenzetten** en **binnenzetten** in 600.
- **Knoppen:** 28 px eronder staat "Ja, aanzetten" (`primary`, volle breedte, 48 px), daaronder gecentreerd de tekstknop "Ander adres".
  - Bezig: "Bezig…".
  - Opslaan mislukt: een regel bovenaan zoals bij D.

**Status (toestand G):**
- **Kop:** ondertitel "**Aan** · bijgewerkt vandaag 06:15". "Aan" staat in 600 `text`; er is geen groene stip of badge.
- **Adres:** infolijstrij "Adres | 2517 AB 12A **Wijzigen**". "Wijzigen" is een tekstknop in `accent`, 15/600, zonder onderstreping, met `aria-label="Adres wijzigen"`.
- **Ophaaldagen:** sectiekop "Volgende ophaaldagen" + infolijst, gesorteerd op datum. Daaronder één alinea uitleg.
- **Tip:** de eenmalige tip is de bestaande tipkaart (§7.5: `sunken`, radius 16, ✕ rechtsboven, 44 px raakvlak).
- **Uitzetten:** onderaan "Afvalkalender uitzetten…" als `danger-quiet`, op eigen breedte en niet schermbreed. De bevestiging is de bestaande sheet met een `danger`-knop "Uitzetten".
- **Hoofdactie:** bewust geen. Er staat geen primaire knop op dit scherm.

**Gezinslid (toestand J):**
- de rij "Afvalkalender" met de waarde "Aan" of "Uit" in `text-2`, zonder pijl;
- de regel eronder in `text-meta` `text-3`.

## (3) §8 States — nieuwe regel in de tabel
| Storing externe bron (afvalkalender > 48 uur) | balk §7.13.4: `sunken`, radius 16, `circle-alert` in `text-2`, titel 15/600, uitleg 14/18 `text-2`, tekstknop "Opnieuw proberen"; geen rood. Onder 48 uur alleen een stille regel in `text-meta` `text-3` onder de kop |

## (4) §12 Prototype — nieuwe regels
| W03-01 | `w03/01-instellingen-aan.html` | `w03-01-instellingen-aan-390x844.png` | Afvalkalender aan (G) | Geen hoofdactie; adres, ophaaldagen en tip rustig onder elkaar; "Wijzigen" eerst onderstreept en 17 px → 15/600 zonder onderstreping |
| W03-02 | `w03/02-klopt-dit.html` | `w03-02-klopt-dit-390x844.png` | Klopt dit? (C) | Adres als onderwerp zonder kaart; één duidelijke hoofdactie |
| W03-03 | `w03/03-vandaag-avond.html` | `w03-03-vandaag-avond-390x844.png` | Vandaag, avond vóór de ophaaldag | "vanaf 22:00" in de tijdkolom; kenmerk even rustig als ↻ |
| W03-04 | `w03/04-vandaag-ophaaldag.html` | `w03-04-vandaag-ophaaldag-390x844.png` | Vandaag, ophaaldag 07:05 | "vóór 07:45" met bezig; binnenzetten "vanaf 12:00" bovenaan Binnenkort; eerst "· bezig" → punt weg (zoals vis-01) |
| W03-05 | `w03/05-instellingen-storing.html` | `w03-05-instellingen-storing-390x844.png`, `…-donker-…` | Storing (H) | Balk zichtbaar maar zonder alarm, ook in donker |
| W03-06 | `w03/06-adres-leeg.html` | `w03-06-adres-leeg-390x844.png` | Formulier (A) met veldfout | 60/40 werkt op 390 breed; foutregel loopt netjes door binnen de kolom |

## (5) OUDE UI (main, WP3b): wat er minimaal moet om het niet onaf te laten ogen
Uitgangspunt: gebruik alleen bestaande componenten en klassen van de oude UI, en voeg geen nieuwe kleuren of badges toe. Het moet eruitzien alsof het er altijd al bij hoorde.

1. **Taakkaart (`task-card.tsx`):**
   - **Kenmerk:** voor afvaltaken `<Recycle className="size-3" aria-hidden />` + "Afvalkalender" in dezelfde meta-span als de categorie (`text-xs text-muted-foreground`, `inline-flex items-center gap-1`). Er is geen `Repeat`-icoon en geen categorie.
   - **Tijd:** het bestaande `Clock`-span toont "vanaf 22:00", "vóór 07:45" of "Vandaag vanaf 12:00" (dat laatste onder Binnenkort) in plaats van "21:00", met dezelfde klassen.
   - **Geen nieuwe Badge.** "Bezig" en verlopen gebruiken de bestaande badges.
   - Gebruik het Lucide-icoon, nooit het teken ♻.
2. **Instellingen (`afval-section.tsx`):**
   - `SettingsSection id="afvalkalender" icon={Recycle} title="Afvalkalender" description="Ophaaldagen van Den Haag als taak."`, direct na Huishouden, plus de springlink "Afval".
   - **Formulier:**
     - `Field` + `Input` in `grid grid-cols-[3fr_2fr] gap-3`, met de toevoeging op de tweede regel in de linkerkolom;
     - knop "Adres zoeken" rechts uitgelijnd (`flex justify-end`, standaard `Button`), zoals "Opslaan" in Huishouden;
     - de privacyregel in `text-xs text-muted-foreground`.
   - **Klopt dit?:**
     - het adres in `font-semibold`;
     - een lijst `divide-y` met rijen `flex justify-between py-2 text-sm` (bak in `text-muted-foreground`, datum `tabular-nums`);
     - de uitleg in `text-sm text-muted-foreground`;
     - de knoppen rechts: `variant="ghost"` "Ander adres" + standaard "Ja, aanzetten".
   - **Storing / F:** een `div` met `flex gap-2 rounded-xl bg-muted p-3 text-sm`, `AlertCircle` `size-4 text-muted-foreground` en `Button variant="outline" size="sm"` "Opnieuw proberen". **Niet** `destructive`, `bg-overdue-bg` of rood.
   - **D en validatie:** de bestaande foutstijl van `Field`/`Input` van de oude UI.
   - **Uitzetten:** `Button variant="ghost"` met `text-destructive` en de tekst "Afvalkalender uitzetten…", links onderaan. De bevestiging gebruikt de bestaande `Dialog` met `variant="destructive"` "Uitzetten".
   - **Gezinslid:** alleen `<p className="text-sm">Afvalkalender staat aan</p>` + één regel `text-sm text-muted-foreground`, zoals de niet-beheerdervariant van HouseholdSection.
3. **Taakdetail:**
   - de verborgen acties laten geen gat achter; controleer dat de knoprij niet één verweesde knop toont;
   - de uitlegregel in de bestaande omschrijvingsstijl (`text-sm text-muted-foreground`).
4. **Niet doen in de oude UI:** geen nieuw kleurtoken, geen "Afval"-badge, geen emoji, geen eigen kaartstijl voor afvaltaken, geen herontwerp van gewone taken.

Controle: de architect plant rook-screenshots van WP3b (A, C, G, H, J, Vandaag, detail) in `docs/screenshots/wp3b/`. Daarop moet vooral te zien zijn:
- dat de storing niet rood is;
- dat "21:00" nergens in een rij staat;
- dat het recycle-icoon even groot en even grijs is als ↻.

---

### Onderzoek
Geen nieuw internetonderzoek gedaan. Dit is een kleine aanvulling binnen een bevroren systeem; de principes uit DS §2 (Things 3: grijze meta-iconen; Apple HIG: niet alleen kleur) zijn toegepast. Het padbestand van het Lucide-icoon recycle komt uit de Lucide-set, overgenomen in shell.js.

### Zelfcontrole op anti-patronen
- Witte kaarten / grote afgeronde rechthoeken: niet aanwezig. Er zijn geen kaarten; de twee vlakken (tip, storingsbalk) zijn allebei `sunken` en hebben een reden.
- Gradients, glassmorphism, schaduwen: niet aanwezig.
- Hero-koppen: niet aanwezig; de subpaginatitel is 22 px.
- KPI-tegels: niet aanwezig.
- Overmatige badges: niet aanwezig. Het kenmerk is bewust géén badge; het blijft bij drie badges.
- Iconen zonder functie: niet aanwezig. `recycle` markeert de herkomst van de taak (en verklaart waarom verplaatsen niet kan); `circle-alert` hoort bij de storing.
- Kleur zonder functie: niet aanwezig. Geen groen voor "aan", geen rood voor de storing. Het emoji-risico (♻ als groene emoji) is expliciet uitgesloten.
- Sidebar, SaaS-look, lege ruimte zonder functie: niet aanwezig. Onder de knoppen staat lege ruimte op de instellingenschermen, maar daar volgt alleen de onderbalk; dat is natuurlijk einde van de inhoud, geen opvulling.

### Afwijkingen en voorstellen voor de hoofdsessie (geen vraag voor Jurgen)
1. **"morgen" in plaats van "di 6 okt".** In de wireframe (UX §13.14) staat "di 6 okt" voor binnenzetten op de dag ervoor. Ik gebruik de bestaande DS-notatie "morgen" (§7.4). De product-designer mag dit bevestigen.
2. **F en D zien er verschillend uit.** Toestand F (bron onbereikbaar) krijgt de `sunken`-balk. Toestand D (adres onbekend) krijgt een regel in `overdue`, omdat het een reactie is op invoer en DS §8 dat zo regelt. UX §13.14 tekent D en F met hetzelfde ⓘ-patroon; dit is een visuele verfijning, geen nieuwe beslissing.
3. **Twee voorgestelde teksten voor de product-designer.** Op "Klopt dit?" staan de ondertitel "Zo kent de gemeente jullie adres." en de zin "Iedereen in het huishouden ziet de taken; het adres zien alleen beheerders." Beide zijn een voorstel.
4. **Recycle-icoon op echte scherpte.** Het icoon is op 14 px (1× screenshot) herkenbaar maar fijner getekend dan ↻. Op 3×-schermen is dat geen probleem. Blijkt het op WP3b/CP-screenshots te vaag, dan mag het naar 16 px (lijndikte 2), zonder verdere gevolgen.

### Vragen voor Jurgen
Geen.

### Oordeel
**GEREED VOOR ARCHITECTUUR EN PLANREVIEW.** Visueel is W-03 klaar voor de freeze zodra de tekst hierboven in DESIGN_SYSTEM.md staat (§7.10-regel, nieuwe §7.13, §8-regel, §12-regels). Het ontwerp gebruikt alleen bestaande tokens en componenten en is op echte screenshots (licht, en de storingsbalk ook in donker) beoordeeld. Het taakdetail van een afvaltaak en de sheet "uitzetten" zijn niet als prototype gebouwd. Ze volgen 1-op-1 bestaande patronen (vis-04 en de bevestigingssheet); de eerste beeldcontrole daarvan valt bij de rook-screenshots van WP3b.
