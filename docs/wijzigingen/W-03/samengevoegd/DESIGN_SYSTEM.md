## Visueel ontwerp: W-03 afvalkalender, samengevoegde DS-invoegtekst (ronde 4)

**Documenten.** Ik heb DESIGN_SYSTEM.md niet aangeraakt, want het is bevroren. De invoegtekst staat hieronder en kan letterlijk worden overgenomen, per doelplek.

Mijn schrijfrechten dekken `docs/wijzigingen/` niet. Sla dit rapport daarom zelf op als `docs/wijzigingen/W-03/samengevoegd/DESIGN_SYSTEM.md`, de plek die de plan-critic voorstelde. Hiermee vervallen `visual-designer-r1/r2/r3.md` als bron; ze worden archief.

**Prototype aangepast:** `/home/user/takenlijstje/docs/prototype/w03/07-storing-leeg-te-snel.html` (H2).

**Screenshot vernieuwd en met Read bekeken:** `/home/user/takenlijstje/docs/screenshots/prototype/w03-07-storing-leeg-te-snel-390x844.png`. Het script meldde 0 consolefouten, 0 paginafouten en 0 mislukte verzoeken.

**Karakter in één zin:** een afvaltaak is een gewone taak in de rustige lijst, alleen herkenbaar aan een grijs kenmerk en een eigen tijd. Een storing wordt eerlijk en zonder alarm gemeld, en de laatst bekende ophaaldagen blijven altijd zichtbaar.

### Wat er in deze ronde veranderd is
**Samengevoegd.** r2 is de basis. Daarop zijn de r3-wijzigingen gezet: T-90/T-90b in §7.13.5, de toast in de oude UI en de §12-regels W03-02/07/09. Er zit geen losse "wijzigingen op"-tekst meer in; alles staat op zijn eindplek.

**Verwerkt uit plan-critic W-03 ronde 3:**
- **Bevinding 3, dode verwijzing:** "de lijst van UX §13.13.3" is nu "TD §18.16 U3", in §7.13.6. De r3-zin "beeldcontrole bij CP-W03 (TD §18.16 U3)" staat nu in §12.
- **Bevinding 3, doelplek oude UI:** de oude UI is **§7.13.6 "Oude UI (WP3b, `main`)"** geworden, als onderdeel van §7.13. Het is dus geen bijlage.
  - Reden: een bijlage valt buiten de nummering en wordt bij het bouwen makkelijk overgeslagen.
  - Onder die kop staat expliciet dat §7.13.6 alleen voor de oude UI geldt.
- **Bevinding 1, bovengrens binnenzetten:** mijn tijdkolomtabel (§7.13.3) noemde geen bovengrens. Er stond alleen "D+1, Verlopen". Ze was dus niet in strijd met D+7, maar wel onvolledig. Nu staan er in de tabel:
  - D+1 t/m D+6 bij Verlopen, van "9 uur" tot "6 dagen" te laat;
  - een rij voor het verdwijnen aan het begin van de dag van de volgende buitenzet-taak, en uiterlijk op **D+7 00:00**, volgens BR-54 r4b, AC-210 en TD `WASTE_IN_EXPIRE_DAYS = 7`;
  - een rij voor buitenzetten dat na het einde van D verdwijnt.
  - Nergens in DS of prototype staat nog D+2.
- **Aanbeveling 11, prototype w03-07:** onder "Volgende ophaaldagen · stand ma 12 okt" staan nu de bewaarde datums (PMD vr 16 okt, Restafval di 20 okt, Papier wo 4 nov) in plaats van drie keer T-45b.
  - Er is ook een regel bijgekomen in §7.13.4 en §8: een leeg antwoord wist geen datums.
  - T-45b blijft in beeld in w03-11, bij een bak die echt geen datum heeft.
- **Bevinding 4, lijst voor CP-W03:** de drie beeldpunten die de critic miste en die bij mij horen, staan nu als aandachtspunten in §7.13.6. Ze komen bovenop de lijst in U3 en vervangen die niet: het ⋯-menu zonder leeg menu, "9 uur te laat" (wo 09:00) en "1 dag te laat" (do 09:00) bij binnenzetten, en de bewaarde datums bij H2. De architect moet ze nog wel in U3 zelf opnemen.
- **Toegevoegd, klein:** de bestaande §7.10-regel voor `circle-alert` krijgt het gebruik in de storingsbalk erbij. Zonder die aanvulling zou de iconentabel onvolledig zijn. Dit staat als aparte, duidelijk gemarkeerde regelwijziging (1b).

### Wat ik op het nieuwe screenshot zie (w03-07)
- De balk is rustig en grijs, zonder rood:
  - titel T-77 op één regel;
  - uitleg T-77b;
  - T-79 als resultaatregel in de balk;
  - "Opnieuw proberen" als tekstknop.
- Daaronder staan de adresrij en "Volgende ophaaldagen · stand ma 12 okt", met drie datums rechts in tabelcijfers.
- De uitzetknop staat vrij boven de onderbalk.
- Het beeld leest nu als "de bron geeft niets, maar wat we wisten blijft staan". Dat past bij de balktekst "De taken die er staan, blijven staan."
- De herhaling van drie keer T-45b, die ik in r2 als aandachtspunt noemde, is daarmee ook weg.

---

# INVOEGTEKST VOOR DESIGN_SYSTEM.md

Er zijn zeven blokken: (1a), (1b) en (1c) in §7.10, (2) een nieuwe §7.13, (3) in §8, en (4a) en (4b) in §12. Buiten deze plekken verandert er niets in DESIGN_SYSTEM.md.

---

## (1a) §7.10 Iconografie — doelplek: tabel, nieuwe regel direct na de regel `| repeat (↻) | terugkerende taak (in meta) |`

```
| recycle | afvaltaak / Afvalkalender: meta in de rij, bovenregel in het taakdetail, sectie-icoon in de oude instellingen, informatierij in Taken › Terugkerend. **Niet** trash-2: een prullenbak betekent in deze app "verwijderen", en dat kan bij een afvaltaak juist niet |
```

## (1b) §7.10 Iconografie — doelplek: de bestaande regel `| circle-alert | kop Verlopen, foutregels |` wordt vervangen door

```
| circle-alert | kop Verlopen, foutregels; storingsbalk en storingsstatus van de Afvalkalender (daar in `text-2`, nooit rood; §7.13.4) |
```

## (1c) §7.10 Iconografie — doelplek: nieuwe alinea direct na de zin "Categorieën in Taken krijgen **geen** icoon; …"

```
"♻" in de UX- en productdocumenten is een afkorting. In de app staat altijd het Lucide-icoon `Recycle`, nooit het Unicode-teken ♻ of een emoji. Dat teken wordt op iOS en Android als groene emoji getoond, verschilt per toestel en zou kleur zonder functie in de lijst brengen.
```

---

## (2) Nieuwe §7.13 — doelplek: direct na §7.12 Grafieken, vóór "## 8. States en feedback"

```
### 7.13 Afvalkalender (W-03)

Teksten staan hier alleen met hun ID uit UX §13.16. Dat is de enige bron, zodat DS en UX niet uit elkaar kunnen lopen. §7.13.1–7.13.5 gelden voor de nieuwe UI; §7.13.6 geldt alleen voor de oude UI op `main` (WP3b).

#### 7.13.1 Kenmerk in de lijstrij (aanvulling op §7.4)
- **Meta (2e regel):** icoon `recycle` 14 px, lijndikte 2, in `currentColor`, met 5 px afstand tot het woord **Afvalkalender** (T-15). Stijl `text-meta` (14/18, 400) in `text-3`, precies zoals "↻ wekelijks". Het kenmerk vervangt ritme en categorie: er staat geen ↻ en geen "Buiten".
- **Met bezig:** `[recycle] Afvalkalender [bezig]`. Het label "bezig" volgt direct, zonder "·", zoals in vis-01.
- **Geen badge, geen vlak, geen eigen kleur.** Het is geen vierde badge; §7.9 blijft bij drie badges.
- **Verlopen:** de rij staat in het vlak Verlopen, volgens het bestaande patroon. Het kenmerk blijft `text-3`; alleen de tijdkolom en de rand van het rondje worden `overdue`.
- **Gedaan en overgeslagen:** zoals elke rij. Het kenmerk blijft staan.
- **Toegankelijk:**
  - het icoon is `aria-hidden`; het zichtbare woord "Afvalkalender" draagt de betekenis en komt zo mee in de naam van de rijknop;
  - het rondje heeft `aria-label` T-99 ("<taaknaam> afvinken");
  - er is geen `title` en geen tooltip op het icoon.

#### 7.13.2 Taakdetail (aanvulling op §7.7)
- **Bovenregel:** `[recycle 14 px]` + T-20 ("Afvalkalender · ophaaldag di 6 okt"), 14/18, gewicht 500, in `text-2`. Dit is dezelfde regel als "↻ Elke zaterdag · …" bij een reeks.
- **Geen omschrijving.**
- **Infolijst:** het bestaande patroon (label links in `text-2`, waarde rechts in `text`, `tabular-nums`, de regel **Uiterlijk** vet).
  - Buitenzetten: T-21, T-22 en T-25.
  - Binnenzetten: T-23, T-24 en T-25.
  - Verlopen: de waarde van Uiterlijk staat in `overdue`, met daaronder "1 uur te laat" (of "1 dag te laat" enz.) in `overdue`.
  - De rij **Herinnering** (T-25) staat er alleen als de eigen instelling Herinneringen aan staat, de taak open is en het moment nog komt. Anders ontbreekt de rij helemaal: geen "(uit)" en geen lege rij.
- **Uitlegregel** onder de infolijst: T-27 in `text-meta` `text-3`, zonder icoon en zonder vlak.
- **Knoppen (T-28):**
  - hoofdactie: de bestaande primaire knop "Afvinken"; bij een gedane taak "Terugzetten";
  - daaronder twee `secondary`-knoppen naast elkaar (1fr 1fr, 8 px tussenruimte): "Ik ben ermee bezig" of "Niet meer bezig", en "Deze keer overslaan";
  - er is geen ⋯;
  - "Toch nog doen" vervangt bij een overgeslagen taak de overslaan-knop, alleen zolang de ophaaldag niet voorbij is.

#### 7.13.3 Tijdkolom voor afvaltaken (aanvulling op §7.4 "Tijd")
Dit is dezelfde stijl `text-when`:
- het voorzetsel in `text-3`, gewicht 500;
- de tijd in `text`, gewicht 600;
- `tabular-nums`, rechts uitgelijnd, 12 px afstand tot de titel.

Voorbeeld: ophaaldag D = di 6 okt.

| Taak en moment | Groep | Rechterkolom |
| --- | --- | --- |
| buitenzetten, vóór D−1 | Binnenkort | de dagnotatie van D−1: **morgen** of **ma 5 okt** |
| buitenzetten, op D−1 | Vandaag | <span>vanaf</span> **22:00** (T-16) |
| buitenzetten, D 00:00–07:45 | Vandaag | <span>vóór</span> **07:45** (T-17) |
| buitenzetten, D na 07:45, open | Verlopen | het bestaande verlopen-patroon: "**1 uur**" / "te laat" in `overdue`, op twee regels |
| buitenzetten, na het einde van D, nog open | — | de rij verdwijnt: vanzelf overgeslagen, telt als vergeten (BR-54, AC-210); geen melding |
| binnenzetten, vóór D−1 | Binnenkort | **di 6 okt** |
| binnenzetten, op D−1 | Binnenkort | **morgen** (T-19) |
| binnenzetten, D vóór 12:00 | Binnenkort, bovenaan | <span>vanaf</span> **12:00** (T-18) |
| binnenzetten, D vanaf 12:00 | Vandaag | leeg (gewoon vandaag) |
| binnenzetten, D+1 t/m D+6, open | Verlopen | het bestaande patroon (gerekend vanaf het einde van D): op D+1 tot 23:30 in minuten of uren, bijv. wo 09:00 "**9 uur**" / "te laat"; vanaf D+1 23:30 "**1 dag**" / "te laat", oplopend tot hooguit "**6 dagen**" / "te laat" |
| binnenzetten, begin van de dag van de volgende buitenzet-taak, en **uiterlijk D+7 00:00** (wat eerst komt), nog open | — | de rij verdwijnt: vanzelf overgeslagen, telt als vergeten (BR-54, AC-210); geen melding |

- "vanaf" en "vóór" zijn altijd kleine letters in `text-3`.
- **Nooit "21:00" in een rij, kaart of kalendervak.** 21:00 is alleen het herinneringsmoment.
- **Geen deadlinebadges** ("verloopt over …") bij afvaltaken.
- Bij een grotere tekstinstelling geldt §9: de tijdkolom gaat onder de titel staan.

#### 7.13.4 Balken en regels op de pagina Afvalkalender (F, F2, H, G′, G″, D)
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
- **Ophaaldagen bij H:** onder de sectiekop staat dezelfde infolijst als in G, met de bewaarde datums van de laatste geslaagde bijwerking (BR-52, TD §18.8.4). **Ook bij H2 (leeg antwoord) blijven die datums staan;** een storing wist nooit datums uit beeld. T-45b staat er alleen bij een bak die ook in de bewaarde stand geen datum heeft.
- **Rij "Afvalkalender" in Instellingen bij H:** de waarde rechts is `[circle-alert 16 px] Niet bijgewerkt` (T-37) in `text-2`. Ook hier geen rood.

**Balk F en F2 (antwoord van de bron bij zoeken), zonder titel en zonder knop:**
- hetzelfde vlak boven het formulier, met binnenruimte 12 px rondom (14 px rechts);
- één tekstblok in 15/20, gewicht 400, in `text`: bij F T-63 of T-63b, bij F2 T-64 of T-64b. Er is geen titel, omdat dit de enige boodschap op het scherm is; daarom 15/20 `text` en niet 14/18 `text-2`, zodat het vlak niet vaag oogt;
- 20 px onder de balk staan de velden, gevuld;
- de hoofdactie staat als `primary` onder het formulier: bij F "Opnieuw proberen", bij F2 "Adres zoeken". Zo staat er nooit een primaire knop in een `sunken`-vlak.

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

#### 7.13.5 Adresformulier, "Klopt dit?" en status
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
- **Melding na aanzetten:** de bestaande melding onderin (§7.8), in twee varianten:
  - **T-90** met de actie **Bekijken** in `toast-action`, die de Kalender (week) opent. Dit geldt als er taken zijn klaargezet (`inserted` > 0).
  - **T-90b** zonder actie en zonder lege actieruimte; de tekst loopt dan over de volle breedte. Dit geldt als er 0 taken zijn klaargezet, omdat de eerstvolgende ophaaldag verder dan 14 dagen weg ligt. De datum staat al in G onder "Volgende ophaaldagen", dus er is geen knop nodig.
  - Beide varianten: het ✓-icoon, `role="status"`, ongeveer 5 s in beeld, geen afwijkende kleur.
- **Laden:** skelet met titel + 3 rijen. **Laden mislukt:** T-68 met de tekstknop "Opnieuw".

**Gezinslid (toestand J):**
- de rij "Afvalkalender" met de waarde "Aan" of "Uit" in `text-2`, zonder pijl;
- de regel eronder (T-38 of T-39) in `text-meta` `text-3`.

#### 7.13.6 Oude UI (WP3b, `main`)
Geldt alleen voor de oude UI op `main` zolang WP3b daar live staat; in de nieuwe UI gelden §7.13.1–7.13.5. Uitgangspunt: alleen bestaande componenten en klassen van de oude UI, geen nieuwe kleuren of badges. Het moet eruitzien alsof het er altijd al bij hoorde. De teksten komen uit UX §13.16.

1. **Taakkaart (`task-card.tsx`):**
   - **Kenmerk:** voor afvaltaken `<Recycle className="size-3" aria-hidden />` + "Afvalkalender" in dezelfde meta-span als de categorie (`text-xs text-muted-foreground`, `inline-flex items-center gap-1`). Er is geen `Repeat`-icoon en geen categorie.
   - **Tijd:** het bestaande `Clock`-span toont "vanaf 22:00", "vóór 07:45" of "vanaf 12:00" in plaats van "21:00", met dezelfde klassen.
   - **Binnenkort:** binnenzetten op D vóór 12:00 toont "Vandaag" + "vanaf 12:00". Op D−1 toont het "Morgen" (bestaande `relativeDayLabel`).
   - **Verlopen:** alleen de bestaande badge "… te laat", zonder klokje (binnenzetten: op D+1 tot 23:30 in minuten of uren, bijv. wo 09:00 "9 uur te laat"; vanaf D+1 23:30 "1 dag te laat", oplopend tot hooguit "6 dagen te laat"; daarna verdwijnt de kaart, §7.13.3).
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
     - knoppen in de balk: `Button variant="outline" size="sm"`. H3 heeft er twee naast elkaar (`flex gap-2`): "Adres controleren" en "Opnieuw proberen". Bezig: "Bezig…" en `disabled`;
     - onder de balk blijft de lijst met bewaarde ophaaldagen staan, ook bij H2 (§7.13.4).
   - **G′ en G″:** de stille regel (T-71, T-71b of T-73) als `text-sm text-muted-foreground` direct onder de statusregel; geen knop.
   - **Tip:** T-54 in de bestaande tipstijl van de oude UI.
   - **Uitzetten:** `Button variant="ghost"` met `text-destructive` en T-55, links onderaan. De bevestiging gebruikt de bestaande `Dialog` met `variant="destructive"` "Uitzetten".
   - **Melding na aanzetten:** de bestaande `toast` (sonner). Voor T-90 komt er `action: { label: "Bekijken" }`; voor T-90b **geen** `action`. Geen nieuwe toastvariant.
   - **Gezinslid:** alleen `<p className="text-sm">` T-38b of T-39b, met één regel `text-sm text-muted-foreground`, zoals de niet-beheerdervariant van HouseholdSection.
3. **Taakdetail:**
   - kopregel: de bestaande statusbadge + meta-tekst "[Recycle] Afvalkalender · ophaaldag di 6 okt" (geen nieuwe badge);
   - geen omschrijving;
   - het ⋯-menu bevat alleen Ik ben ermee bezig / Niet meer bezig / Deze keer overslaan / Toch nog doen. Bewerken, Verwijderen en de scheidingslijn zijn weg. Er blijft geen leeg menu of verweesde knop over;
   - de rijen Wanneer, Beschikbaar, Uiterlijk en Categorie worden vervangen door de afval-infolijst (T-21 t/m T-25); de rij Gedaan blijft;
   - daaronder de uitlegregel T-27 in `text-sm text-muted-foreground`.
4. **Kalender:** "vanaf 22:00" en "vanaf 12:00" in plaats van "21:00"; `useDraggable` staat uit voor afvaltaken.
5. **Niet doen in de oude UI:** geen nieuw kleurtoken, geen "Afval"-badge, geen emoji, geen eigen kaartstijl voor afvaltaken, geen toast voor "te snel" en geen herontwerp van gewone taken.

**Controle bij CP-W03.** De lijst is die van TD §18.16 U3 (de enige lijst). Visuele aandachtspunten daarbinnen:
- geen enkele storing (F, F2, H1/H2/H3) is rood;
- D heeft geen rode rand om de velden;
- T-78 en T-79 staan in de balk en niet als toast;
- bij H (ook H2) blijven de bewaarde ophaaldagen onder "Volgende ophaaldagen · stand …" staan;
- "21:00" staat nergens in een rij;
- het recycle-icoon is even groot en even grijs als ↻;
- binnenzetten bij Verlopen toont op wo 09:00 (D+1) "9 uur te laat" en op do 09:00 (D+2) "1 dag te laat", en is uiterlijk op D+7 00:00 uit de lijst;
- het ⋯-menu van een overgeslagen afvaltaak toont "Toch nog doen" en is nooit leeg.
```

---

## (3) §8 States en feedback — doelplek: drie nieuwe regels onderaan de tabel, na de regel `| Validatiefout | … |`

```
| Storing externe bron (afvalkalender: > 48 uur zonder succes om welke reden ook, ook als de achtergrondtaak stil lag; of een aanhoudend leeg antwoord, BR-52) | balk H volgens §7.13.4: `sunken`, radius 16, `circle-alert` in `text-2`, titel 15/600, uitleg 14/18 `text-2`, resultaatregel in de balk (geen melding onderin), tekstknop "Opnieuw proberen" (H3 ook "Adres controleren"); geen rood. De bewaarde ophaaldagen blijven eronder staan, ook bij een leeg antwoord. Blijft staan tot het bijwerken weer gelukt is |
| Hapering externe bron (nog geen storing) | alleen een stille regel in `text-meta` `text-3` onder de kop (T-71 of T-71b); geen balk, geen knop. Zonder foutcode en zonder storing: gewoon G, met het eerlijke tijdstip in de kop |
| Antwoord van de bron bij zoeken | D: regel in `overdue` boven de velden, zonder rode rand. F en F2: `sunken`-balk zonder titel boven het formulier, met de hoofdactie onder het formulier |
```

---

## (4) §12 Prototype — twee doelplekken

**(4a) Tabel: elf nieuwe regels onderaan, na de regel `| 09 | 09-componenten.html | … |`**

```
| W03-01 | `docs/prototype/w03/01-instellingen-aan.html` | `w03-01-instellingen-aan-390x844.png`, `…-donker-…` | Afvalkalender aan (G), met tip en T-52 | Geen hoofdactie. "Wijzigen" eerst onderstreept in 17 px → 15/600 zonder onderstreping |
| W03-02 | `docs/prototype/w03/02-klopt-dit.html` | `w03-02-klopt-dit-390x844.png`, `…-donker-…` | Klopt dit? (C), T-45a met "Den Haag", T-46 | Adres als onderwerp zonder kaart; één hoofdactie |
| W03-03 | `docs/prototype/w03/03-vandaag-avond.html` | `w03-03-vandaag-avond-390x844.png` | Vandaag, avond vóór de ophaaldag | "vanaf 22:00"; het kenmerk even rustig als ↻ |
| W03-04 | `docs/prototype/w03/04-vandaag-ophaaldag.html` | `w03-04-vandaag-ophaaldag-390x844.png` | Vandaag, ophaaldag 07:05 | "vóór 07:45" met bezig; binnenzetten "vanaf 12:00" bovenaan Binnenkort |
| W03-05 | `docs/prototype/w03/05-instellingen-storing.html` | `w03-05-instellingen-storing-390x844.png`, `…-donker-…` | Storing H1 (T-75/T-76), na "nog steeds fout" | Zonder alarm, ook in donker; resultaatregel T-78 in de balk |
| W03-06 | `docs/prototype/w03/06-adres-leeg.html` | `w03-06-adres-leeg-390x844.png` | Formulier (A, T-40) met veldfout | 60/40 werkt op 390 breed; de foutregel loopt door binnen de kolom |
| W03-07 | `docs/prototype/w03/07-storing-leeg-te-snel.html` | `w03-07-storing-leeg-te-snel-390x844.png` | H2 (oktober: T-77/T-77b) met T-79 ("te snel") en de bewaarde ophaaldagen onder "stand ma 12 okt" | T-79 in de balk, geen melding onderin; `text-wrap: balance` op de titel. Eerst stond er drie keer T-45b, wat suggereerde dat een leeg antwoord de datums wist → nu de bewaarde datums (BR-52, TD §18.8.4) |
| W03-08 | `docs/prototype/w03/08-storing-adres-weg.html` | `w03-08-storing-adres-weg-390x844.png`, `…-donker-…` | H3 | Twee tekstknoppen in `sunken`; het adres brak eerst af → `nowrap` |
| W03-09 | `docs/prototype/w03/09-nog-geen-ophaaldagen.html` | `w03-09-nog-geen-ophaaldagen-390x844.png` | F2 (2 januari, aanzetten: T-64) | Balk zonder titel, vijf regels zonder weesregel; hoofdactie onder het formulier |
| W03-10 | `docs/prototype/w03/10-adres-onbekend.html` | `w03-10-adres-onbekend-390x844.png` | D | Regel in `overdue` boven de velden, zonder rode rand |
| W03-11 | `docs/prototype/w03/11-instellingen-hapering.html` | `w03-11-instellingen-hapering-390x844.png` | G′ + Gedeeltelijk | Stille regel `text-3` zonder knop (`text-wrap: pretty`); T-45b in de infolijst |
```

**(4b) Nieuwe alinea direct na de alinea "Wat het prototype **niet** laat zien …"**

```
**W-03 (afvalkalender).** De bestanden staan in `docs/prototype/w03/`, met een kopie van `ds.css` (gelijk aan `visueel/`), een uitgebreide `shell.js` (icoon `recycle`) en `w03.css` (alleen aanvullingen, geen nieuwe tokens). Alle W03-screenshots zijn 390×844, met Read bekeken; 01, 02, 05 en 08 ook donker. Niet als prototype gebouwd, omdat ze 1-op-1 bestaande patronen volgen: het taakdetail van een afvaltaak, de uitzet-sheet, C2, E, A′, offline, en de meldingen T-90/T-90b (bestaande melding onderin, §7.8, met of zonder actie). De beeldcontrole daarvan valt bij CP-W03 (TD §18.16 U3).
```

---

### Onderzoek
Ik heb geen nieuw internetonderzoek gedaan. Dit is een samenvoeging binnen een bevroren systeem, gebaseerd op de principes uit DS §2: status zonder alarmkleur, niet alleen kleur, en resultaat op de plek van de handeling.

### Zelfcontrole op anti-patronen
- **Witte kaarten / overal dezelfde grote afgeronde rechthoeken:** niet aanwezig. Alleen tip, balk H en balk F/F2 zijn `sunken`, en nooit tegelijk. D is bewust een regel en geen vlak.
- **Overal schaduwen, gradients, glassmorphism:** niet aanwezig.
- **Hero-koppen, KPI-tegels, sidebar:** niet aanwezig.
- **Overmatige badges:** niet aanwezig. Het kenmerk en "Aan" zijn geen badge; §7.9 blijft bij drie badges.
- **Iconen zonder functie:** niet aanwezig. `circle-alert` staat alleen bij storing en fout (nu ook zo in §7.10), `recycle` alleen bij de herkomst. De stille regel heeft geen icoon.
- **Kleur zonder functie:** niet aanwezig. Rood staat alleen bij D, vormfouten, Verlopen en Uitzetten, nooit bij een storing van de bron.
- **Lege ruimte zonder hiërarchie:** niet aanwezig. In w03-07 staat de lijst nu gevuld, en de ruimte onder de uitzetknop is het natuurlijke einde van de inhoud.
- **Vervallen aandachtspunt uit r2:** drie keer "nog geen ophaaldag bekend" in w03-07 is opgelost door de bewaarde datums.

### Punten voor de hoofdsessie (geen vraag voor Jurgen)
1. **Samenvoeginstructie.** In `samenvoegen.md` moet de DS-regel verwijzen naar dit ene bestand: `samengevoegd/DESIGN_SYSTEM.md`, zonder "basis r2 + r3".
2. **CP-W03-lijst (critic-bevinding 4).** De architect moet in TD §18.16 U3 nog opnemen:
   - laden en laden mislukt;
   - een overgeslagen afvaltaak met "Toch nog doen";
   - binnenzetten "9 uur te laat" op wo 09:00 (D+1) en "1 dag te laat" op do 09:00 (D+2);
   - H2 → H1.

   Ik voeg daar voor de architect één punt aan toe: "bij H2 blijven de bewaarde datums staan". In §7.13.6 staan deze punten al als aandachtspunten, maar U3 blijft de enige lijst.
3. **D+7 staat nu in de DS.** De designer moet UX §13.4, §13.7.4, §13.15 en §13.17 nog van D+2 naar D+7 zetten (critic-bevinding 1). Anders zegt UX iets anders dan DS en BR/AC/TD.

### Vragen voor Jurgen
Geen.

### Oordeel
**GEREED VOOR ARCHITECTUUR EN PLANREVIEW.** Er is nu één invoegtekst voor de DS, met een doelplek per blok, ook voor de oude UI (§7.13.6). De verwijzing naar CP-W03 wijst naar TD §18.16 U3. De tijdkolom volgt de bovengrens D+7. Het H2-prototype laat zien dat bewaarde datums blijven staan. Het vernieuwde screenshot heb ik op het beeld beoordeeld en het voldoet.

Bestanden:
- /home/user/takenlijstje/docs/prototype/w03/07-storing-leeg-te-snel.html (aangepast)
- /home/user/takenlijstje/docs/screenshots/prototype/w03-07-storing-leeg-te-snel-390x844.png (vernieuwd, bekeken)
