## Visueel ontwerp: W-03 afvalkalender (aanvulling op het design system), ronde 2
Documenten: DESIGN_SYSTEM.md is NIET gewijzigd, want het is bevroren. De volledige bijgewerkte invoegtekst staat hieronder en vervangt de tekst uit `docs/wijzigingen/W-03/visual-designer-r1.md` in zijn geheel. Sla dit rapport op als `docs/wijzigingen/W-03/visual-designer-r2.md`.

**Prototype:** `/home/user/takenlijstje/docs/prototype/w03/`
- **Bijgewerkt:** 01 (T-52 nieuw), 02 (T-46 nieuw), 05 (H1 met T-75/T-76 en de regel T-78), 06 (T-40 nieuw; de ondertitel "Uit" is weg, zoals in wireframe A).
- **Nieuw:** 07-storing-leeg-te-snel (H2 met T-77/T-77b, T-79 in de balk en drie bakken met T-45b), 08-storing-adres-weg (H3 met twee tekstknoppen), 09-nog-geen-ophaaldagen (F2 met T-64, 2 januari), 10-adres-onbekend (D zonder rode rand), 11-instellingen-hapering (G′ met T-71 en "Gedeeltelijk" met T-45b).
- **w03.css:** alleen aangevuld, zonder nieuwe tokens.
- **Ongewijzigd, want de teksten kloppen nog met UX r3:** 03 en 04.

**Screenshots:** allemaal met Read bekeken, 390×844, in `/home/user/takenlijstje/docs/screenshots/prototype/`:
- w03-01-instellingen-aan (+ -donker)
- w03-02-klopt-dit (+ -donker)
- w03-05-instellingen-storing (+ -donker)
- w03-06-adres-leeg
- w03-07-storing-leeg-te-snel
- w03-08-storing-adres-weg (+ -donker)
- w03-09-nog-geen-ophaaldagen
- w03-10-adres-onbekend
- w03-11-instellingen-hapering

Alle screenshots gaven 0 consolefouten, 0 paginafouten en 0 mislukte verzoeken. w03-03 en w03-04 zijn van ronde 1 en blijven geldig.

**Karakter in één zin:** een afvaltaak is een gewone taak in de rustige lijst. Hij valt alleen op door een grijs kenmerk en een eigen tijd. Een storing wordt eerlijk en zonder alarm gemeld, en het resultaat van "opnieuw proberen" staat in de balk zelf in plaats van in een melding die weer verdwijnt.

### Na het eerste beeld aangepast
- **H3:** het adres "2517 AB 12A" brak midden in de uitleg af ("2517 / AB 12A"). Het staat nu op één regel (`white-space: nowrap`).
- **H2:** de titel liet "weken" als los woord op de tweede regel staan. De balktitel krijgt nu `text-wrap: balance`.
- **G′:** de stille regel liet "opnieuw." alleen op de tweede regel staan. Die regel krijgt nu `text-wrap: pretty`.

### Opgelost ten opzichte van plan-critic ronde 2, punt 3
- `too_soon` is geen melding onderin meer, maar de regel T-79 in de balk (§7.13.4).
- "geen ophaaldag in de komende weken" is vervallen. Er staat nu T-45b "nog geen ophaaldag bekend" (§7.13.5, prototype 07 en 11).
- D in de oude UI heeft geen rode rand meer. Het is één regel in de tekststijl van de veldfout, en de velden krijgen geen `aria-invalid` (sectie (5)).
- F2, H1, H2 en H3 zijn nu beschreven, ook de twee tekstknoppen van H3 (§7.13.4).
- De §8-regel noemt nu ook het aanhoudend lege antwoord (BR-52 b) en het geval zonder foutcode.
- Teksten in de screenshots: w03-01 toont T-52, w03-02 toont T-46 en w03-05 toont T-75/T-76/T-78, allemaal letterlijk uit UX §13.16. In het prototype staat geen enkele vervallen tekst meer; "21:00" komt alleen voor in T-46, waar het hoort.

---

# TEKST VOOR DESIGN_SYSTEM (letterlijk invoegen; vervangt de invoegtekst van ronde 1 volledig)

Teksten staan hier alleen met hun ID uit UX §13.16. Dat is de enige bron, zodat DS en UX niet uit elkaar kunnen lopen.

## (1) §7.10 Iconografie — nieuwe regel in de tabel (na `repeat (↻)`)

| recycle | afvaltaak / Afvalkalender: meta in de rij, bovenregel in het taakdetail, sectie-icoon in de oude instellingen, informatierij in Taken › Terugkerend. **Niet** trash-2: een prullenbak betekent in deze app "verwijderen", en dat kan bij een afvaltaak juist niet |

Regel eronder: *"♻" in de documenten is een afkorting. In de app staat altijd het Lucide-icoon `Recycle` en nooit het Unicode-teken ♻ of een emoji. Dat teken wordt op iOS en Android als groene emoji getoond, verschilt per toestel en zou kleur zonder functie in de lijst brengen.*

## (2) Nieuwe §7.13 Afvalkalender (W-03)

### 7.13.1 Kenmerk in de lijstrij (aanvulling op §7.4)
- **Meta (2e regel):** icoon `recycle` 14 px, lijndikte 2, in `currentColor`, met 5 px afstand tot het woord **Afvalkalender** (T-15). Stijl `text-meta` (14/18, 400) in `text-3`, precies zoals "↻ wekelijks". Het kenmerk vervangt ritme en categorie, dus er staat geen ↻ en geen "Buiten".
- **Met bezig:** `[recycle] Afvalkalender [bezig]`. Het label "bezig" volgt direct, zonder "·", zoals in vis-01.
- **Geen badge, geen vlak, geen eigen kleur.** Het is geen vierde badge; §7.9 blijft bij drie badges.
- **Verlopen:** de rij staat in het vlak Verlopen, volgens het bestaande patroon. Het kenmerk blijft `text-3`; alleen de tijdkolom en de rand van het rondje worden `overdue`.
- **Gedaan en overgeslagen:** zoals elke rij. Het kenmerk blijft staan.
- **Toegankelijk:**
  - het icoon is `aria-hidden`; het zichtbare woord "Afvalkalender" draagt de betekenis en komt zo mee in de naam van de rijknop;
  - het rondje heeft `aria-label` T-99 ("<taaknaam> afvinken");
  - er is geen `title` en geen tooltip op het icoon.

### 7.13.2 Taakdetail (aanvulling op §7.7)
- **Bovenregel:** `[recycle 14 px]` + T-20 ("Afvalkalender · ophaaldag di 6 okt"), 14/18, gewicht 500, in `text-2`. Dit is dezelfde regel als "↻ Elke zaterdag · …" bij een reeks.
- **Geen omschrijving.**
- **Infolijst:** het bestaande patroon (label links in `text-2`, waarde rechts in `text`, `tabular-nums`, de regel **Uiterlijk** vet).
  - Buitenzetten: T-21, T-22 en T-25.
  - Binnenzetten: T-23, T-24 en T-25.
  - Verlopen: de waarde van Uiterlijk staat in `overdue`, met daaronder "1 uur te laat" in `overdue`.
  - De rij **Herinnering** (T-25) staat er alleen als de eigen instelling Herinneringen aan staat, de taak open is en het moment nog komt. Anders ontbreekt de rij helemaal: geen "(uit)" en geen lege rij.
- **Uitlegregel** onder de infolijst: T-27 in `text-meta` `text-3`, zonder icoon en zonder vlak.
- **Knoppen (T-28):**
  - hoofdactie: de bestaande primaire knop "Afvinken"; bij een gedane taak "Terugzetten";
  - daaronder twee `secondary`-knoppen naast elkaar (1fr 1fr, 8 px tussenruimte): "Ik ben ermee bezig" of "Niet meer bezig", en "Deze keer overslaan";
  - er is geen ⋯;
  - "Toch nog doen" vervangt bij een overgeslagen taak de overslaan-knop, alleen zolang de ophaaldag niet voorbij is.

### 7.13.3 Tijdkolom voor afvaltaken (aanvulling op §7.4 "Tijd")
Dit is dezelfde stijl `text-when`:
- het voorzetsel in `text-3`, gewicht 500;
- de tijd in `text`, gewicht 600;
- `tabular-nums`, rechts uitgelijnd, 12 px afstand tot de titel.

| Taak en moment | Groep | Rechterkolom |
| --- | --- | --- |
| buitenzetten, vóór D−1 | Binnenkort | de dagnotatie van D−1: **morgen** of **ma 5 okt** |
| buitenzetten, op D−1 | Vandaag | <span>vanaf</span> **22:00** (T-16) |
| buitenzetten, D 00:00–07:45 | Vandaag | <span>vóór</span> **07:45** (T-17) |
| buitenzetten, D na 07:45 | Verlopen | het bestaande verlopen-patroon: "**1 uur**" / "te laat" in `overdue`, op twee regels |
| binnenzetten, vóór D−1 | Binnenkort | **di 6 okt** |
| binnenzetten, op D−1 | Binnenkort | **morgen** (T-19) |
| binnenzetten, D vóór 12:00 | Binnenkort, bovenaan | <span>vanaf</span> **12:00** (T-18) |
| binnenzetten, D vanaf 12:00 | Vandaag | leeg (gewoon vandaag) |
| binnenzetten, D+1 | Verlopen | het bestaande patroon ("9 uur" / "te laat", "1 dag" / "te laat") |

- "vanaf" en "vóór" zijn altijd kleine letters in `text-3`.
- **Nooit "21:00" in een rij, kaart of kalendervak.** 21:00 is alleen het herinneringsmoment.
- **Geen deadlinebadges** ("verloopt over …") bij afvaltaken.
- Bij een grotere tekstinstelling geldt §9: de tijdkolom gaat onder de titel staan.

### 7.13.4 Balken en regels op de pagina Afvalkalender (F, F2, H, G′, G″, D)
**Het vlak** (voor F, F2 en H):
- `sunken`, radius 16 (`r-lg`), zonder rand en zonder schaduw;
- afstand tot de kop: 16 px;
- twee kolommen: 16 px icoon | tekst, met 10 px tussenruimte;
- icoon `circle-alert` 16 px, lijndikte 2, in `text-2`, 2 px omlaag zodat het op de eerste tekstregel staat;
- **nooit rood**, ook het icoon niet. Het is geen fout van de gebruiker (§8);
- `role="status"`: een schermlezer meldt de balk één keer.

**Balk H (storing), met titel:**
- **Binnenruimte:** 12 px boven, 12 px links, 14 px rechts, 4 px onder (de tekstknop heeft zelf 44 px raakvlak).
- **Titel:** 15/20, gewicht 600, in `text`, met `text-wrap: balance`.
- **Uitleg:** `text-meta` 14/18 in `text-2`, 2 px onder de titel.
- **Resultaatregel** (T-78 of T-79): 14/18, gewicht 500, in `text-2`, 8 px onder de uitleg.
  - Staat binnen de balk, dus binnen `role="status"`.
  - Blijft staan tot de volgende poging of tot de pagina opnieuw geladen wordt.
  - **Er komt geen melding onderin, ook niet bij `too_soon`.**
- **Knoppen:** tekstknop(pen) in `accent`, variant `text`, 44 px hoog, links uitgelijnd met de tekst.

| Variant | Titel | Uitleg | Knoppen |
| --- | --- | --- | --- |
| H1 (`UNREACHABLE`, `FORMAT` of geen foutcode) | T-75 | T-76 | Opnieuw proberen |
| H2 (`SUSPECT_EMPTY`) | T-77 | T-77a (dec/jan) of T-77b | Opnieuw proberen |
| H3 (`ADDRESS_GONE`) | T-77c | T-77d; het adres `tabular-nums` en `nowrap` | **Adres controleren** · Opnieuw proberen: twee tekstknoppen naast elkaar in één rij (8 px tussenruimte), "Adres controleren" eerst |

- **In een `sunken`-vlak komen nooit `secondary`- of `primary`-knoppen.** Ze zouden op het vlak wegvallen of het vlak zwaarder maken dan de storing is. Ook bij H3 zijn het twee tekstknoppen.
- **Bezig:** "Opnieuw proberen" wordt "Bezig…" (T-77e) in `text-3` en is uitgeschakeld. "Adres controleren" blijft bruikbaar, en de rest van de pagina ook.
- **Offline:** de knoppen zijn uitgeschakeld (`text-3`), met T-67 eronder in `text-meta` `text-3`.
- **Blijft staan tot het bijwerken weer gelukt is.** Alleen de variant wisselt mee met de laatste oorzaak (bijvoorbeeld H2 → H1). De balk maakt nooit plaats voor een stille regel.
- **Weer gelukt:** de balk verdwijnt zonder animatie, en de melding onderin T-94 volgt alleen na een handmatige poging.
- **Kop bij H:** T-72: "**Aan** · laatst bijgewerkt za 26 sep 06:15", met de sectiekop "Volgende ophaaldagen", gevolgd door "· stand za 26 sep" in `text-3`, gewicht 500.
- **Rij "Afvalkalender" in Instellingen bij H:** de waarde rechts is `[circle-alert 16 px] Niet bijgewerkt` (T-37) in `text-2`. Ook hier geen rood.

**Balk F en F2 (antwoord van de bron bij zoeken), zonder titel en zonder knop:**
- hetzelfde vlak boven het formulier, met binnenruimte 12 px rondom (14 px rechts);
- één tekstblok in 15/20, gewicht 400, in `text`: bij F T-63 of T-63b, bij F2 T-64 of T-64b. Er is geen titel, omdat dit de enige boodschap op het scherm is;
- 20 px onder de balk staan de velden, gevuld;
- de hoofdactie staat als `primary` onder het formulier: bij F "Opnieuw proberen", bij F2 "Adres zoeken".

**Stille regel onder de kop (G′: T-71 of T-71b; G″: T-73):**
- `text-meta` 14/18 in `text-3`, 4 px onder de kopregel, met `text-wrap: pretty`;
- geen icoon, geen vlak en geen knop;
- hooguit één stille regel of balk onder de kop. H gaat voor alles.

**D (adres onbekend of buiten Den Haag, T-60):**
- dit is geen storing maar een antwoord op wat de gebruiker invulde. Daarom geldt het bestaande patroon "serverfout als regel bovenaan" (§8);
- een regel boven de velden: `circle-alert` 16 px + de tekst in `overdue`, 14/18, gewicht 500, twee kolommen (16 px | tekst, 6 px tussenruimte), met `role="alert"`;
- 16 px eronder de velden, gevuld;
- **zonder rode rand om de velden** en zonder `aria-invalid`, want geen enkel veld is fout ingevuld.

**Opslaan mislukt (T-65):** een regel bovenaan C, zoals bij D.

### 7.13.5 Adresformulier, "Klopt dit?" en status
**Formulier (toestand A en A′):**
- **Uitleg:** T-40 in `text-sub` (15/20) `text-2`, met **buitenzetten** en **binnenzetten** in 600 `text`.
- **Kop bij A:** geen ondertitel; de waarde "Uit" staat al in de rij van Instellingen. Bij A′ is de titel "Ander adres", met T-47 als ondertitel.
- **Raster:** postcode en huisnummer naast elkaar, `grid-template-columns: 3fr 2fr` (60/40), 12 px tussen de kolommen en 16 px tussen de regels. De toevoeging staat op de tweede regel in de **linkerkolom**, even breed als de postcode.
- **Velden:** het bestaande invoerveld (§7.2), met de labels en plaatshouders uit T-41:
  - label `text-label` boven het veld, 48 px hoog, `surface` met `line`-rand;
  - waarde 17 px, `tabular-nums`; postcode in hoofdletters;
  - plaatshouders in `text-3`.
- **Vormfout per veld** (T-43, T-44, T-44b): 2 px `overdue`-rand + foutregel onder dat veld (icoon + tekst in `overdue`). De foutregel loopt binnen de eigen kolom door.
- **Knop "Adres zoeken"** (T-41b): `primary`, volle breedte, 24 px onder het formulier.
  - Eronder de privacyregel T-42 in `text-meta` `text-3`.
  - Uitgeschakeld zolang postcode of huisnummer leeg is: `sunken` + `text-3`.
  - Bezig: "Zoeken…", en de velden zijn uitgeschakeld.
  - Bij A′ staat eronder de tekstknop "Annuleren".
- **Offline:** de knoppen zijn uitgeschakeld, met T-67.

**Klopt dit? (toestand C):**
- **Kop:** subpaginakop "‹ Instellingen", titel "Klopt dit?" (`text-title` 22/28), ondertitel in `text-sub` `text-2` (T-45).
- **Adres** (T-45a): 17/24, gewicht 600, in `text`, 14 px onder de kop, zonder vlak of kaart.
- **Sectiekop "Eerstvolgende ophaaldagen"** (`text-section`, 26 px erboven), met daaronder de bestaande **infolijst**:
  - vaste volgorde: Restafval, Papier, PMD;
  - datum rechts in `text`, `tabular-nums`;
  - een bak zonder datum: T-45b "nog geen ophaaldag bekend" in `text-3`.
- **Uitleg:** T-46 als één alinea `text-sub` `text-2`, met **buitenzetten** en **binnenzetten** in 600. Bij wijzigen volgt T-48 als tweede alinea.
- **Knoppen (T-46b):** 28 px eronder "Ja, aanzetten" of "Ja, dit adres gebruiken" (`primary`, volle breedte, 48 px), met daaronder gecentreerd de tekstknop "Ander adres".
  - Bezig: "Bezig…".
  - Opslaan mislukt: regel T-65 bovenaan.

**Meerdere adressen (C2):**
- T-61 als `text-sub`;
- daaronder de bestaande aantikbare lijstrij per adres (`tabular-nums`, chevron rechts, 44 px of meer);
- daaronder de tekstknop "Ander adres".

**Geen bakken (E):** T-62 als `text-sub` `text-2`, zonder vlak, met de tekstknop "Ander adres".

**Status (toestand G, G′, G″):**
- **Kop:** T-70, "**Aan** · bijgewerkt vandaag 06:15". "Aan" staat in 600 `text`; er is geen groene stip of badge.
- **Adres:** infolijstrij "Adres | 2517 AB 12A **Wijzigen**" (T-50). "Wijzigen" is een tekstknop in `accent`, 15/600, zonder onderstreping, met `aria-label="Adres wijzigen"`.
- **Ophaaldagen:** sectiekop "Volgende ophaaldagen" + infolijst, gesorteerd op datum. Een bak zonder datum ("Gedeeltelijk") toont T-45b in `text-3`.
- **Uitleg:** daaronder T-52 als één alinea `text-sub` `text-2`.
- **Tip:** de eenmalige tip T-53 is de bestaande tipkaart (§7.5: `sunken`, radius 16, ✕ rechtsboven met 44 px raakvlak en `aria-label` "Tip sluiten").
- **Uitzetten:** onderaan T-55 "Afvalkalender uitzetten…" als `danger-quiet`, op eigen breedte en niet schermbreed. De bevestiging is de bestaande sheet (T-80, T-81/T-81b/T-81c) met een `danger`-knop "Uitzetten" en de tekstknop "Annuleren" (T-82).
- **Hoofdactie:** bewust geen. G en H hebben geen primaire knop.
- **Laden:** skelet met titel + 3 rijen. **Laden mislukt:** T-68 met de tekstknop "Opnieuw".

**Gezinslid (toestand J):**
- de rij "Afvalkalender" met de waarde "Aan" of "Uit" in `text-2`, zonder pijl;
- de regel eronder (T-38 of T-39) in `text-meta` `text-3`.

## (3) §8 States — nieuwe regels in de tabel
| Storing externe bron (afvalkalender: > 48 uur zonder succes om welke reden ook, ook als de achtergrondtaak stil lag; of een aanhoudend leeg antwoord, BR-52) | balk H volgens §7.13.4: `sunken`, radius 16, `circle-alert` in `text-2`, titel 15/600, uitleg 14/18 `text-2`, resultaatregel in de balk (geen melding onderin), tekstknop "Opnieuw proberen" (H3 ook "Adres controleren"); geen rood. Blijft staan tot het bijwerken weer gelukt is |
| Hapering externe bron (nog geen storing) | alleen een stille regel in `text-meta` `text-3` onder de kop (T-71 of T-71b); geen balk, geen knop. Zonder foutcode en zonder storing: gewoon G, met het eerlijke tijdstip in de kop |
| Antwoord van de bron bij zoeken | D: regel in `overdue` boven de velden, zonder rode rand. F en F2: `sunken`-balk zonder titel boven het formulier, met de hoofdactie onder het formulier |

## (4) §12 Prototype — nieuwe regels
| W03-01 | `w03/01-instellingen-aan.html` | `w03-01-instellingen-aan-390x844.png`, `…-donker-…` | Afvalkalender aan (G), met tip | Geen hoofdactie. "Wijzigen" eerst onderstreept in 17 px → 15/600 zonder onderstreping. Ronde 2: T-52 |
| W03-02 | `w03/02-klopt-dit.html` | `w03-02-klopt-dit-390x844.png`, `…-donker-…` | Klopt dit? (C) | Adres als onderwerp zonder kaart; één hoofdactie. Ronde 2: T-46 |
| W03-03 | `w03/03-vandaag-avond.html` | `w03-03-vandaag-avond-390x844.png` | Vandaag, avond vóór de ophaaldag | "vanaf 22:00"; het kenmerk even rustig als ↻ |
| W03-04 | `w03/04-vandaag-ophaaldag.html` | `w03-04-vandaag-ophaaldag-390x844.png` | Vandaag, ophaaldag 07:05 | "vóór 07:45" met bezig; binnenzetten "vanaf 12:00" bovenaan Binnenkort |
| W03-05 | `w03/05-instellingen-storing.html` | `w03-05-instellingen-storing-390x844.png`, `…-donker-…` | Storing H1, na "nog steeds fout" | Zonder alarm, ook in donker; resultaatregel T-78 in de balk |
| W03-06 | `w03/06-adres-leeg.html` | `w03-06-adres-leeg-390x844.png` | Formulier (A) met veldfout | 60/40 werkt op 390 breed; de foutregel loopt door binnen de kolom |
| W03-07 | `w03/07-storing-leeg-te-snel.html` | `w03-07-storing-leeg-te-snel-390x844.png` | H2 met T-79 ("te snel") en drie bakken met T-45b | T-79 in de balk, geen toast; titel met `text-wrap: balance` (anders stond "weken" alleen) |
| W03-08 | `w03/08-storing-adres-weg.html` | `w03-08-storing-adres-weg-390x844.png`, `…-donker-…` | H3 | Twee tekstknoppen in `sunken`; het adres brak eerst af → `nowrap` |
| W03-09 | `w03/09-nog-geen-ophaaldagen.html` | `w03-09-nog-geen-ophaaldagen-390x844.png` | F2 (2 januari) | Balk zonder titel, hoofdactie onder het formulier |
| W03-10 | `w03/10-adres-onbekend.html` | `w03-10-adres-onbekend-390x844.png` | D | Regel in `overdue` boven de velden, zonder rode rand |
| W03-11 | `w03/11-instellingen-hapering.html` | `w03-11-instellingen-hapering-390x844.png` | G′ + Gedeeltelijk | Stille regel `text-3` zonder knop; T-45b in de infolijst |

## (5) OUDE UI (main, WP3b): wat er minimaal moet om het niet onaf te laten ogen
Uitgangspunt: gebruik alleen bestaande componenten en klassen van de oude UI, en voeg geen nieuwe kleuren of badges toe. Het moet eruitzien alsof het er altijd al bij hoorde. De teksten komen uit UX §13.16.

1. **Taakkaart (`task-card.tsx`):**
   - **Kenmerk:** voor afvaltaken `<Recycle className="size-3" aria-hidden />` + "Afvalkalender" in dezelfde meta-span als de categorie (`text-xs text-muted-foreground`, `inline-flex items-center gap-1`). Er is geen `Repeat`-icoon en geen categorie.
   - **Tijd:** het bestaande `Clock`-span toont "vanaf 22:00", "vóór 07:45" of "vanaf 12:00" in plaats van "21:00", met dezelfde klassen.
   - **Binnenkort:** binnenzetten op D vóór 12:00 toont "Vandaag" + "vanaf 12:00". Op D−1 toont het "Morgen" (bestaande `relativeDayLabel`).
   - **Verlopen:** alleen de bestaande badge "… te laat", zonder klokje.
   - **Badges:** geen andere deadlinebadges en geen nieuwe `Badge`. "Bezig" gebruikt de bestaande badge.
   - Altijd het Lucide-icoon, nooit het teken ♻.
2. **Instellingen (`afval-section.tsx`):**
   - `SettingsSection id="afvalkalender" icon={Recycle} title="Afvalkalender" description={T-34}`, direct na Huishouden, plus de springlink "Afval" (T-34b). Alle toestanden staan inline, en C vervangt het formulier in de sectie.
   - **Formulier:**
     - `Field` + `Input` in `grid grid-cols-[3fr_2fr] gap-3`, met de toevoeging op de tweede regel in de linkerkolom;
     - knop "Adres zoeken" rechts uitgelijnd (`flex justify-end`, standaard `Button`), zoals "Opslaan" in Huishouden;
     - privacyregel T-42 in `text-xs text-muted-foreground`;
     - vormfouten: de bestaande veldfout van `Field` (`text-sm text-destructive` onder het veld, met `aria-invalid` op dat ene veld).
   - **D:** één regel `<p role="alert" className="text-sm text-destructive">` met T-60 **boven** de velden. De velden blijven gevuld en krijgen **geen** `aria-invalid`, dus **geen rode rand**.
   - **Klopt dit? en C2:**
     - adres in `font-semibold`;
     - een lijst `divide-y` met rijen `flex justify-between py-2 text-sm` (bak in `text-muted-foreground`, datum `tabular-nums`, T-45b in `text-muted-foreground`);
     - uitleg T-46 (en T-48) in `text-sm text-muted-foreground`;
     - knoppen rechts: `variant="ghost"` "Ander adres" + standaard "Ja, aanzetten";
     - C2: per adres een `Button variant="outline"` op volle breedte, links uitgelijnd.
   - **Balken F, F2 en H:**
     - een `div role="status"` met `flex gap-2 rounded-xl bg-muted p-3 text-sm`, en `AlertCircle` `size-4 shrink-0 text-muted-foreground`;
     - **niet** `destructive`, `bg-overdue-bg` of rood;
     - F en F2: alleen de tekst; de hoofdactie staat onder het formulier;
     - H: titel `font-medium`, uitleg `text-muted-foreground`, resultaatregel T-78 of T-79 als `<p className="text-muted-foreground font-medium">` in de balk (**geen toast**);
     - knoppen in de balk: `Button variant="outline" size="sm"`. H3 heeft er twee naast elkaar (`flex gap-2`): "Adres controleren" en "Opnieuw proberen". Bezig: "Bezig…" en `disabled`.
   - **G′ en G″:** de stille regel (T-71, T-71b of T-73) als `text-sm text-muted-foreground` direct onder de statusregel; geen knop.
   - **Tip:** T-54 in de bestaande tipstijl van de oude UI.
   - **Uitzetten:** `Button variant="ghost"` met `text-destructive` en T-55, links onderaan. De bevestiging gebruikt de bestaande `Dialog` met `variant="destructive"` "Uitzetten".
   - **Gezinslid:** alleen `<p className="text-sm">` T-38b of T-39b, met één regel `text-sm text-muted-foreground`, zoals de niet-beheerdervariant van HouseholdSection.
3. **Taakdetail:**
   - kopregel: de bestaande statusbadge + meta-tekst "[Recycle] Afvalkalender · ophaaldag di 6 okt" (geen nieuwe badge);
   - geen omschrijving;
   - het ⋯-menu bevat alleen Ik ben ermee bezig / Niet meer bezig / Deze keer overslaan / Toch nog doen. Bewerken, Verwijderen en de scheidingslijn zijn weg. Controleer dat er geen leeg menu of verweesde knop overblijft;
   - de rijen Wanneer, Beschikbaar, Uiterlijk en Categorie worden vervangen door de afval-infolijst (T-21 t/m T-25); de rij Gedaan blijft;
   - daaronder de uitlegregel T-27 in `text-sm text-muted-foreground`.
4. **Kalender:** "vanaf 22:00" en "vanaf 12:00" in plaats van "21:00"; `useDraggable` staat uit voor afvaltaken.
5. **Niet doen in de oude UI:** geen nieuw kleurtoken, geen "Afval"-badge, geen emoji, geen eigen kaartstijl voor afvaltaken, geen toast voor "te snel" en geen herontwerp van gewone taken.

**Controle bij CP-W03** (de lijst van UX §13.13.3). Op de screenshots moet vooral te zien zijn:
- dat geen enkele storing (F, F2, H1/H2/H3) rood is;
- dat D geen rode rand om de velden heeft;
- dat T-78 en T-79 in de balk staan en niet als toast;
- dat "21:00" nergens in een rij staat;
- dat het recycle-icoon even groot en even grijs is als ↻.

---

### Onderzoek
Geen nieuw internetonderzoek. Dit is een bijwerking binnen een bevroren systeem, en de principes uit DS §2 zijn gebruikt: status zonder alarmkleur, niet alleen kleur, en resultaat op de plek van de handeling.

### Zelfcontrole op anti-patronen
- **Witte kaarten / overal dezelfde grote afgeronde rechthoeken:** niet aanwezig. Alleen tip, balk H en balk F/F2 zijn `sunken` en nooit tegelijk met elkaar. D is bewust een regel en geen vlak.
- **Overal schaduwen, gradients, glassmorphism:** niet aanwezig.
- **Hero-koppen, KPI-tegels, sidebar:** niet aanwezig.
- **Overmatige badges:** niet aanwezig. Het kenmerk en de status "Aan" zijn geen badge.
- **Iconen zonder functie:** niet aanwezig. `circle-alert` staat alleen bij storing en fout, `recycle` alleen bij de herkomst. De stille regel heeft bewust geen icoon.
- **Kleur zonder functie:** niet aanwezig. Rood staat alleen bij D, vormfouten en Uitzetten (gebruikersactie of -invoer), nooit bij een storing van de bron.
- **Lege ruimte zonder hiërarchie:** onder de inhoud staat alleen de onderbalk; dat is het natuurlijke einde van de inhoud.
- **Aandachtspunt (bewust zo gelaten):** in H2 (w03-07) staan drie keer "nog geen ophaaldag bekend" onder elkaar. Dat is herhalend, maar eerlijk per bak en in `text-3` rustig. Samenvoegen zou een nieuwe tekst vragen, en die hoort bij de product-designer.

### Punten voor de hoofdsessie (geen vraag voor Jurgen)
1. **F en F2 hebben geen titel,** anders dan H (T-63/T-64 hebben er geen). De hele tekst staat daarom in 15/20 `text` in plaats van 14/18 `text-2`, zodat het vlak niet vaag oogt. Dit is een visuele keuze, geen tekstwijziging.
2. **"Opnieuw proberen" in F** is volgens UX de primaire knop onder het formulier en staat niet in de balk. Zo staat er nooit een primaire knop in een `sunken`-vlak.
3. **Oude UI, H3:** twee `outline sm`-knoppen naast elkaar in `bg-muted`. De eerste beeldcontrole daarvan valt bij CP-W03.
4. **Niet als prototype gebouwd:** het taakdetail, de uitzet-sheet, C2, E, A′ en offline. Ze volgen 1-op-1 bestaande patronen, en de beeldcontrole daarvan valt bij CP-W03.

### Vragen voor Jurgen
Geen.

### Oordeel
**GEREED VOOR ARCHITECTUUR EN PLANREVIEW.** Visueel is W-03 klaar voor de freeze zodra deze invoegtekst in DESIGN_SYSTEM.md staat (§7.10-regel, nieuwe §7.13, §8-regels, §12-regels, en sectie (5) als referentie voor WP3b). DS en UX r3 spreken elkaar niet meer tegen over `too_soon`, T-45b, D, F2 en H1/H2/H3. De prototype-screenshots tonen alleen de definitieve teksten uit UX §13.16 en zijn licht en (01, 02, 05, 08) donker op het beeld beoordeeld.
