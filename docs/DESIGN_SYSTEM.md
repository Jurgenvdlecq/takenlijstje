# Design system — Takenlijstje

Versie: ronde 1 (2026-09-28) · Kwaliteitsniveau 2 · Werkwijze §15 (bestaand project), fase 4.
Basis: `docs/PRODUCT_SPEC.md`, `docs/UX_SPEC.md` (ronde 1, wireframes 01–21), besluiten in `docs/PROGRESS.md`, `docs/INVENTARIS.md` §5 en §7 (D-01…D-05), de huidige stijl (`src/app/globals.css`, `src/components/ui/*`) en `docs/screenshots/bestaand/*-390x844.png`.
Prototype: `docs/prototype/visueel/` · screenshots: `docs/screenshots/prototype/vis-*.png` (§12).

Open plekken zijn gemarkeerd met `[OPEN: V-nr]` (zie §13).

---

## 0. Besluit: verfijnen of opnieuw ontwerpen?

**De visuele laag wordt opnieuw ontworpen. De technische basis blijft.**

Waarom opnieuw ontwerpen:
- De huidige stijl is een standaard componentbibliotheek-stijl (INVENTARIS §5): indigo als accent, elke taak een eigen witte kaart met rand en schaduw, kopjes in hoofdletters met een telbadge, avatars in kleur. Alles weegt even zwaar. Dat is precies waarom Vandaag geen hiërarchie heeft (D-02): een verlopen taak is een rode kaart tussen witte kaarten, en de tijd staat in een klein grijs regeltje.
- De kern van dit product ("in één oogopslag zien wat moet en vóór wanneer") vraagt om een **lijst**, geen stapel kaarten. Verfijnen van de kaarten lost dat niet op.
- De scopewijziging (geen personen, geen punten) haalt de kleurrijke avatars en de tegels weg; daarmee verdwijnt ook het grootste deel van wat de huidige stijl "eigen" maakte.

Wat behouden blijft:
- Tailwind 4 met tokens in `globals.css` en `@theme inline`, de Radix-componenten in `src/components/ui/*` (dialog als sheet van onderen, dropdown, switch, tabs, checkbox), `lucide-react` als iconenset, `sonner` voor meldingen. Alleen de tokenwaarden en de klassen in die componenten veranderen.
- De warme, gebroken witte achtergrond (#faf9f6 nu) als idee: die past bij "thuis". Hij wordt iets warmer en krijgt een echt systeem eromheen.
- Blauw als kleur voor "je kunt hierop tikken", in een diepere, rustiger tint dan het huidige felle indigo `[OPEN: V-30]`.
- Categorie-emoji bij Boodschappen (functioneel: sneller scannen in de winkel, en bekend bij het gezin).

## 1. Karakter en principes

**Karakter in één zin:** een rustig, warm huishoudlijstje dat in één blik laat zien wat er moet en vóór wanneer, en dat alleen kleur gebruikt als er iets te melden is.

1. **Eén blik, dan weer weg.** Ellen en Jurgen kijken tussendoor: bij het koffiezetten, in de winkel, 's avonds op de bank. De tijd ("vóór 12:00", "2 dagen te laat") staat daarom rechts in de rij, vet en in tabelcijfers, op een vaste plek; je leest de rechterkolom als een dienstregeling. Meta-informatie is kleiner en lichter.
2. **Alleen de uitzondering krijgt een vlak.** Gewone taken staan zonder kaart op het papier, gescheiden door haarlijnen. Alleen *verlopen* krijgt een zacht terracotta vlak, een kop met icoon en de woorden "te laat". Zo valt verlopen op zonder te schreeuwen, en betekent een vlak altijd "let op".
3. **Kleur is betekenis, nooit versiering.** Blauw = je kunt hierop tikken. Terracotta = verlopen of onomkeerbaar. Oker = vandaag (alleen in lijsten met meerdere dagen). Groen = gedaan. Verder alleen warme grijstinten. Geen kleur zonder woord of vorm ernaast (HIG: niet alleen kleur).
4. **Warm, maar volwassen.** Een vriendelijk, rond lettertype en warme grijstinten voor het gezinsgevoel; geen emoji-avatars, confetti, mascottes of spelelementen (punten zijn weg, V-21). Tieners (13 en 15) moeten het "gewoon een goede app" vinden, niet "een kinderapp".
5. **Duim eerst.** Alles wat vaak gebeurt, zit in de onderste helft of links in de rij: afvinkrondje links (raakvlak 44×44), onderbalk met de + in het midden, hoofdknop onderaan sheets. Minder frequente dingen (meldingen, instellingen) staan rechtsboven.

## 2. Onderzoek

Gericht bekeken: hoogwaardige takenapps, een huishoudapp en Apple's richtlijnen. Principes overgenomen, geen interfaces gekopieerd.

| Bron | Wat ik zag | Wat ik overneem |
| --- | --- | --- |
| Things 3 (Cultured Code) — [features](https://culturedcode.com/things/features/), [kritiek IXD@Pratt](https://ixd.prattsi.org/2020/02/design-critique-things-3-ios-app/), [review](https://www.thenerdystudent.com/2017/07/things-3/) | Deadlines als klein rood vlagje met tekst; eigenschappen als grijze iconen; heel veel lucht, weinig kleur, één accent | Rood alleen voor de deadline/verlopen-informatie zelf, niet voor de hele rij. Grijze meta met kleine iconen (↻). Eén accentkleur |
| Apple Herinneringen — [MacStories iOS 16](https://www.macstories.net/stories/ios-16-the-macstories-review/12/), [Apple Support slimme lijsten](https://support.apple.com/guide/iphone/use-smart-lists-iphe882772ed/ios) | Vandaag = verlopen + vandaag, gegroepeerd per dagdeel; rondje links; platte lijst met haarlijnen | Platte lijst met ingesprongen haarlijnen; rondje links als enige nadrukkelijke bediening. Verbeterpunt dat ze zelf hebben (verlopen "begraaft" vandaag, [bron](https://robinsanah.substack.com/p/apple-reminders-custom-today-list)): wij scheiden verlopen visueel met een eigen vlak |
| Todoist — [prioriteiten](https://www.todoist.com/help/articles/set-a-priority-in-todoist-Wy82Jp), [datums](https://todoist.com/help/articles/introduction-to-dates-and-time-q7VobO) | Datumkleur per nabijheid (vast, niet aanpasbaar), gekleurde rondjes per prioriteit | Vaste, niet-aanpasbare statuskleuren. **Niet** overgenomen: gekleurde rondjes per prioriteit (te veel kleur; prioriteit is hier zelden en staat in het detail) |
| Tody — [methode](https://todyapp.com/method), [review](https://www.apartmenttherapy.com/tody-cleaning-app-review-37282867) | Huishoudtaken met groen→oranje→rood voor "hoe dringend" | Bevestigt dat een gezin rood als "te laat" leest. **Niet** overgenomen: voortgangsbalken en spelelementen (passen niet bij "geen punten" en maken de lijst druk) |
| Apple HIG — [Typography](https://developer.apple.com/design/human-interface-guidelines/typography), [Color and contrast](https://developers.apple.com/design/human-interface-guidelines/accessibility/overview/color-and-contrast/) | Body 17 pt, minimaal 11 pt; raakvlak 44×44 pt; semantische kleuren die meeschakelen met donker; nooit alleen kleur | Hoofdtekst 17 px, kleinste tekst 11,5 px (alleen tablabels); raakvlak ≥ 44 px; kleuren als rol-tokens met licht- en donkerwaarde; elke status ook in woorden of vorm |

## 3. Typografie

**Lettertype: Figtree** (variabel, gewichten 300–900, SIL Open Font License), met terugval `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. `[OPEN: V-31]`

Waarom Figtree en niet alleen de systeemletter:
- Vergeleken op echte inhoud (Figtree, Instrument Sans, Hanken Grotesk, Onest, Inter; tijdelijke vergelijkingspagina, niet bewaard). Figtree heeft ronde, open vormen (warm, gezinsvriendelijk) zonder kinderachtig te worden, heldere cijfers met `tabular-nums` (de tijdkolom staat recht), en is met **20 KB** (latin, variabel) de lichtste van de vijf.
- Het gezin gebruikt mogelijk niet allemaal een iPhone; de systeemletter zou dan per toestel anders zijn (SF Pro, Roboto, Samsung One). Eén eigen letter geeft één herkenbaar beeld.
- Techniek: via `next/font/google` (Figtree) of `next/font/local`: wordt bij de build zelf gehost, dus geen verzoek naar Google bij het openen (privacy) en geen verspringende tekst (`font-display: swap` met aangepaste terugvalmaten). Alleen de subset `latin` (inclusief é, ë, ó, ü) en één variabel bestand.
- Alternatief als Jurgen liever geen eigen letter heeft: de systeemletter. Dan blijven de schaal en gewichten gelijk; op de iPhone ziet het er vrijwel even goed uit.

**Schaal** (px; 1 px = 1 pt op iPhone). Gewichten via de variabele as.

| Niveau | Token | Grootte / regelhoogte | Gewicht | Letterafstand | Gebruik |
| --- | --- | --- | --- | --- | --- |
| Paginatitel | `text-large` | 30 / 36 | 700 | −0,02 em | "Vandaag", "Taken", "Boodschappen" (één per pagina) |
| Sheettitel | `text-title` | 22 / 28 (taakdetail 24 / 30) | 700 | −0,01 em | Titel in sheets, lege en foutstaten |
| Taaknaam | `text-row` | 17 / 22 | 500 | 0 | Titel in elke lijst­rij |
| Hoofdtekst | `text-body` | 17 / 24 | 400 | 0 | Lopende tekst, invoer (invoer altijd ≥ 16 px: geen zoom op iOS) |
| Knop | `text-button` | 17 / 22 (klein 15 / 20) | 600 | 0 | Knoppen |
| Sectiekop | `text-section` | 15 / 20 | 700 | 0 | "Verlopen", "Vandaag", "Binnenkort", categorieën. Gewone schrijfwijze, **geen hoofdletters** |
| Tijd in rij | `text-when` | 15 / 20 | 600, voorzetsel 500 in text-3 | 0, `tabular-nums` | "vóór **12:00**", "om **20:00**", "**2 dagen** te laat" |
| Ondertitel | `text-sub` | 15 / 20 | 400 (nadruk 600) | 0 | Onder paginatitel, infolijst in sheets |
| Meta | `text-meta` | 14 / 18 | 400 | 0 | Tweede regel in rij, hulptekst |
| Veldlabel | `text-label` | 13 / 16 | 700 | +0,01 em | Label boven invoer ("Wat moet er gebeuren?") |
| Klein | `text-caption` | 12 / 16 | 600 | 0 | Label "bezig", teller op bel |
| Tablabel | `text-tab` | 11,5 / 14 | 600 | 0 | Onderbalk (kleinste tekst in de app) |

Regels: maximaal drie groottes per scherm-onderdeel; nadruk met gewicht, niet met kleur; getallen altijd `tabular-nums`; nooit hoofdletters voor koppen. Tekst schaalt mee met de tekstgrootte van de telefoon (rem-eenheden in de bouw); rijen groeien in hoogte, de tijdkolom mag dan onder de titel vallen.

## 4. Kleuren (tokens)

Tokens beschrijven een **rol**, niet een kleur. Contrast berekend volgens WCAG 2.x (relatieve luminantie). Normen: tekst ≥ 4,5:1, grote tekst en bedieningsranden ≥ 3:1.

### Licht

| Token | Waarde | Functie | Contrast (belangrijkste combinatie) |
| --- | --- | --- | --- |
| `bg` | `#F6F4EF` | Achtergrond van elke pagina ("papier") | — |
| `surface` | `#FFFFFF` | Sheets, invoervelden, menu's | — |
| `sunken` | `#ECE9E2` | Chips, segment, zoekveld, zachte knoppen, weekblok, skelet | — |
| `line` | `#E2DED5` | Haarlijnen tussen rijen (decoratief, geen informatie) | 1,2:1 (bewust; scheidt, draagt niets) |
| `text` | `#1C1B19` | Titels, taaknamen, tijden | 15,7 op bg · 17,2 op surface |
| `text-2` | `#5C574F` | Secundaire tekst, ondertitel, labels | 6,5 op bg · 5,9 op sunken |
| `text-3` | `#6D675E` | Meta, hulptekst, plaatshouders, voorzetsels ("vóór") | 5,1 op bg · 4,6 op sunken |
| `control` | `#8F887D` | Rand van afvinkrondjes en schakelaar (uit) | 3,2 op bg · 3,5 op surface |
| `accent` | `#2B4C9B` | Alles wat je kunt aantikken: hoofdknop, links, gekozen chip, actieve tab, + | 7,3 op bg · wit erop 8,1 |
| `accent-hover` | `#233F84` | Ingedrukt/hover van accent | — |
| `accent-soft` | `#E6ECF8` | Label "bezig", actief-filterchip, slimme-invoermarkering | accent erop 6,8 |
| `on-accent` | `#FFFFFF` | Tekst/icoon op accent | 8,1 |
| `overdue` | `#AE3A22` | Verlopen (kop, tijd, rondje-rand) én gevaarlijke acties | 5,6 op bg · 5,4 op overdue-soft · wit erop 6,1 |
| `overdue-soft` | `#FBEDE8` | Vlak achter de groep Verlopen | — |
| `on-danger` | `#FFFFFF` | Tekst op gevaarknop | 6,1 |
| `today` | `#8A5608` | "Vandaag" in lijsten met meerdere dagen (Taken, Kalender) | 5,6 op bg · 5,5 op today-soft |
| `today-soft` | `#FBF1DC` | Markering van vandaag in de kalender | — |
| `done` | `#2B6F4B` | Gedaan / op tijd / gekocht (gevuld rondje, "op tijd") | 5,5 op bg · 5,1 op done-soft |
| `done-soft` | `#E3F0E7` | Achter het vinkje in de lege staat "Alles gedaan" | — |
| `focus` | = `accent` | Focusring 2 px, 2 px afstand | 7,3 |
| `scrim` | `rgba(28,27,25,.38)` | Achter sheets | — |
| `toast` / `on-toast` / `toast-action` | `#1C1B19` / `#F3F0EA` / `#A9BDF5` | Melding onderin (omgekeerd vlak) | 15,1 · actie 9,3 |

### Donker

Ja, donkere modus hoort erbij: de app wordt 's avonds op de bank en in bed gebruikt (avondoverzicht om 20:00, BR-31), en de huidige app volgt de systeeminstelling al. **Gedrag blijft: volgt de instelling van de telefoon**, geen eigen schakelaar in de app (die bestaat nu ook niet).

| Token | Waarde | Contrast |
| --- | --- | --- |
| `bg` | `#151412` (warm bijna-zwart, geen puur zwart: minder "gat" en smearing op OLED) | — |
| `surface` | `#1F1D1B` (sheets liggen *lichter*, zo toont donker diepte zonder schaduw) | — |
| `sunken` | `#2A2825` | — |
| `line` | `#34312D` | — |
| `text` / `text-2` / `text-3` | `#F3F0EA` / `#B9B2A7` / `#9D968B` | 16,2 / 8,8 / 6,3 op bg · text-3 5,0 op sunken |
| `control` | `#7D766C` | 4,1 op bg · 3,7 op surface |
| `accent` / `on-accent` | `#9DB4F2` / `#151412` | 9,0 op bg · 9,0 |
| `accent-soft` | `#232C44` | accent erop 6,8 |
| `overdue` / `overdue-soft` / `on-danger` | `#F2917B` / `#2E1D18` / `#151412` | 8,0 op bg · 7,0 op soft · 8,0 |
| `today` / `today-soft` | `#E5B061` / `#2E2517` | 9,4 |
| `done` / `done-soft` | `#7CC79C` / `#1B2A21` | 9,2 |
| `toast` / `on-toast` / `toast-action` | `#F3F0EA` / `#1C1B19` / `#2B4C9B` | 15,1 · 7,1 |

### Waar kleur **niet** voor gebruikt wordt
Prioriteit (alleen woord in het detail, en "!" alleen bij dringend in de rij `[AANNAME: prioriteit hoog/dringend krijgt in de rij geen kleur, alleen in het detail; raakt geen gegevens of rechten]`), categorieën, gezinsleden (profielkleur verschijnt alleen in de ledenlijst en bij het eigen profiel), het weekoverzicht ("1 vergeten" blijft neutraal: reflectie, geen alarm).

### Oplossing D-01
- `theme_color` in het manifest en `themeColor` in de layout worden allebei `bg` (licht `#F6F4EF`, donker `#151412`); geen indigo meer in de statusbalk.
- De dark-tokens staan één keer: in `@media (prefers-color-scheme: dark)` op `:root`. De klasse `.dark` en de gedupliceerde blokken vervallen, tenzij de architect ze nodig heeft voor tests (dan één bron via `@custom-variant dark`).
- Geen hardgecodeerde kleuren in componenten (zoals nu `app-shell.tsx:51` en `badge.tsx` `text-[oklch(...)]`): alles via tokens. Een lintregel of zoekcontrole in de review.

### Tailwind 4 — mapping
In `globals.css` blijven de CSS-variabelen op `:root` staan, `@theme inline` koppelt ze aan utility-namen:
`--color-bg, --color-surface, --color-sunken, --color-line, --color-text, --color-text-2, --color-text-3, --color-control, --color-accent, --color-accent-hover, --color-accent-soft, --color-on-accent, --color-overdue, --color-overdue-soft, --color-on-danger, --color-today, --color-today-soft, --color-done, --color-done-soft, --color-focus` → klassen als `bg-sunken`, `text-text-3`, `border-control`, `text-overdue`.
De oude shadcn-namen (`primary`, `muted`, `card`, `destructive`, …) worden in één keer vervangen, niet naast elkaar bewaard (anders ontstaan twee systemen). Het exacte tokenbestand staat als referentie in `docs/prototype/visueel/ds.css`.

## 5. Spacing, grid en breekpunten

- **Schaal (4-puntsraster):** 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40. Tailwind-standaard (`1`=4 px) volstaat.
- **Paginamarge:** 20 px links en rechts (`gutter`). Het vlak van Verlopen steekt 12 px buiten de marge uit, zodat de tekst van alle rijen op dezelfde lijn blijft.
- **Ritme op een pagina:** kop → eerste sectie 22 px; tussen secties 26 px (Taken 20 px); sectiekop → eerste rij 2 px (de rij heeft zelf lucht).
- **Rij:** minimaal 62 px hoog (boodschappen 54 px), rondje-raakvlak 44×44, tekst begint op 44 px vanaf de marge, haarlijn begint op diezelfde 44 px (ingesprongen, zodat het rondje "vrij" staat). Tijdkolom rechts, 12 px afstand tot de titel.
- **Sheets:** 20 px zijmarge, hoofdknop onderaan; met toetsenbord open staat de hoofdknop direct boven het toetsenbord.
- **Breekpunten:** één doelapparaat, telefoon 390×844 (V-07). Ontwerp werkt van 360 tot 430 px breed zonder aanpassing (tekst loopt door, tijdkolom krimpt niet). Vanaf 600 px: kolom van maximaal 480 px gecentreerd op `bg`, onderbalk even breed als de kolom (lost D-05 op zonder aparte computerindeling, PRODUCT_SPEC §10).
- **Veilige zones:** `env(safe-area-inset-top/bottom)`; onderbalk 56 px + onderste veilige zone.

## 6. Vorm

- **Radii:** 8 (label "bezig", kleine elementen) · 12 (knoppen, invoervelden, segment 11) · 16 (vlak Verlopen, weekblok, melding 14) · 22 (bovenkant sheets) · rond (chips, rondjes, +, schakelaar). Niet alles even rond: hoe groter het vlak, hoe groter de radius.
- **Randen:** alleen haarlijnen (`line`) tussen rijen en in infolijsten, en de rand van invoervelden op `surface`. Geen randen rond groepen, geen kaarten met rand.
- **Diepte (spaarzaam, alleen waar iets echt boven iets anders ligt):**
  - sheet: lichte schaduw naar boven (licht) / lichter vlak zonder schaduw (donker);
  - melding onderin: zwevende schaduw;
  - duim van segment en schakelaar: kleine schaduw.
  Verder nergens schaduw: niet op rijen, knoppen, chips of de onderbalk.

## 7. Componenten

Alle componenten bestaan al in `src/components/ui/*` of komen erbij als dunne laag op Radix. Per component: wat, varianten, states.

### 7.1 Knoppen (`button.tsx`)
| Variant | Uiterlijk | Gebruik |
| --- | --- | --- |
| `primary` | `accent` vlak, `on-accent` tekst, 48 px (groot 54 px, taakdetail "Afvinken") | Eén per scherm/sheet: Toevoegen, Afvinken, Opslaan, Opnieuw proberen |
| `secondary` | `sunken` vlak, `text` tekst (variant `acc`: tekst in accent) | Naar morgen, Andere dag…, ⋯, Toevoegen op Boodschappen, Klaar met winkelen |
| `danger` | `overdue` vlak, `on-danger` tekst | Alleen de bevestigingsknop van onomkeerbare acties (Stoppen, Verwijderen, Alles verwijderen) |
| `danger-quiet` | `sunken` vlak, `overdue` tekst | Menu-/lijstitem dat naar een bevestiging leidt ("Verwijderen…") |
| `text` | geen vlak, `accent` tekst, 44 px hoog | Filters wissen, Meer instellingen, Aanpassen, Tonen |
| `icon` | 44×44, icoon `text-2`, geen vlak | Bel, tandwiel, sluiten (met rond `sunken` vlakje 30 px) |

States: **standaard** · **ingedrukt** (iets donkerder, schaal 0,98; vervangt hover op touch) · **hover** (alleen met muis: `accent-hover` / sunken iets donkerder) · **focus** (2 px `focus`-ring, 2 px afstand, alleen bij toetsenbord: `:focus-visible`) · **uitgeschakeld** (`sunken` vlak, `text-3` tekst, altijd met één zin reden eronder, UX §7) · **bezig** (tekst "Bezig…" met klein draaiend rondje, knop uitgeschakeld; geen spinner bij optimistische acties). Geen `opacity: 50%` voor uitgeschakeld (onleesbaar op warm papier).

### 7.2 Invoervelden (`input.tsx`, `label.tsx`)
- Label boven het veld (`text-label`, `text-2`), veld 48 px, `surface` met `line`-rand; in lijsten en zoeken de rustiger variant `sunken` zonder rand.
- **Focus:** 2 px `accent`-rand (geen gloed). **Fout:** 2 px `overdue`-rand + regel eronder met icoon ⓘ en tekst in `overdue` ("Maximaal 80 tekens (nu 86)"). **Uitgeschakeld:** `sunken`, tekst `text-3`, reden eronder. **Hulptekst:** `text-meta` in `text-3`.
- Tekst in velden altijd ≥ 16 px (geen automatische zoom op iOS; nu `md:text-sm`, dat blijft voor de computer).
- **Slimme invoer:** het herkende woord krijgt `accent-soft` achtergrond met 2 px accentlijn eronder; eronder de regel `"zaterdag" gebruikt als dag · Toch in de naam`.
- Tekenteller vanaf 70 tekens rechts onder het veld in `text-3`, boven 80 in `overdue`.

### 7.3 Keuzes
- **Chips** (nieuw gedeeld component, lost D-01 "losse chipknoppen" op): 40 px hoog (raakvlak 44 via onzichtbare rand), rond, `sunken`; gekozen = `accent` met `on-accent` tekst **en een vinkje** (niet alleen kleur). Lopen altijd door op een volgende regel (D-04). Snelle-toevoeg-chip (boodschappen) heeft een klein `+`.
- **Segment** (`tabs.tsx`): `sunken` bak, gekozen deel `surface` met kleine duimschaduw, tekst 15/600. Voor Open/Gedaan/Terugkerend en Dag/Week/Maand.
- **Schakelaar** (`switch.tsx`): 51×31, uit = `sunken` met `control`-rand, aan = `accent`. Uitgeschakeld: 45 % dekking plus reden.
- **Actief filter:** chip in `accent-soft` met ✕, gevolgd door tekstknop "Filters wissen". Filterknop toont een stip in `accent` als er een filter actief is.

### 7.4 Lijstrij (taak en boodschap) — het belangrijkste component
Opbouw: `[rondje] [titel / meta] [tijd]`. Rondje en rij zijn **twee aparte knoppen naast elkaar** (A-01).
- **Rondje:** 24 px, rand 1,75 px `control`; raakvlak 44×44.
  - open → leeg; **gedaan** → gevuld `done` met wit vinkje, titel doorgestreept in `text-3`; **verlopen** → rand `overdue`; **wacht op verbinding** → gedaan-uiterlijk + meta "wacht op verbinding" + klein sync-icoon rechts.
- **Titel:** `text-row`, maximaal twee regels, daarna afkappen met "…".
- **Meta:** `text-meta` in `text-3`: ↻-icoon + ritme · categorie · label **bezig** (`accent-soft`, het enige label in een rij). Geen avatar, geen punten, geen "door".
- **Tijd (rechts):** "vóór 12:00" / "om 20:00" / "morgen" / "do 1 okt" / "vóór zondag"; voorzetsel in `text-3` 500, tijd of dag in `text` 600, `tabular-nums`. Verlopen: "2 dagen" + "te laat" op twee regels in `overdue`. Leeg als het gewoon vandaag is.
- **Haarlijn** tussen rijen, ingesprongen vanaf de tekst.
- **Ingedrukt:** hele rij krijgt `sunken` achtergrond (rondje apart). **Focus:** ring om rondje of rij, afzonderlijk bereikbaar.

### 7.5 Groepen en containers
- **Sectiekop:** `text-section`, links; aantal in `text-3` erachter ("Vandaag 4"); rechts eventueel een tekstlink ("Kalender ›").
- **Verlopen:** kop in `overdue` met ⓘ-icoon; de rijen in één vlak `overdue-soft`, radius 16. Het enige gekleurde vlak in lijsten.
- **"Vandaag"-kop in Taken/Kalender:** kleine stip + tekst in `today`.
- **Gedaan-regel:** "✓ 2 gedaan vandaag" (vinkje in `done`) met rechts "Tonen ⌄" in accent; haarlijn erboven.
- **Weekblok (Vandaag onderaan)** en tipkaart: `sunken` vlak, radius 16, zonder rand of schaduw, met chevron. Maximaal één tipkaart tegelijk.
- **Kaarten met rand/schaduw:** worden niet gebruikt. Groeperen gebeurt met een sectiekop en witruimte.

### 7.6 Navigatie
- **Onderbalk:** `bg` met haarlijn erboven (geen blur, geen schaduw). Vier bestemmingen met icoon 24 px + label 11,5 px; actief = `accent` en iets dikkere lijn, plus `aria-current="page"`. In het midden de **+**: rond, 48 px, `accent`, zonder label maar met `aria-label="Nieuwe taak"` (de plus is universeel; een label eronder zou de balk hoger maken). Indeling volgens UX §3 `[OPEN: V-28]` (visueel geen verschil als Huishouden in plaats van Boodschappen staat).
- **Kop:** paginatitel links (`text-large`), ondertitel eronder; rechts bel en tandwiel als icoonknoppen. Ongelezen-teller op de bel: klein `accent`-rondje met cijfer (geen rood: rood betekent in deze app "verlopen").
- **Subpagina's:** "‹ Instellingen" linksboven (tekstknop in accent), titel 22 px.
- **Sheets:** greep bovenaan, titel links, ✕ rechts (rond `sunken` vlakje), `surface`, radius 22 boven; `scrim` erachter.

### 7.7 Taakdetail (sheet)
Bovenregel (↻ ritme · status) in `text-2` · titel 24/700 · **Afvinken** (primair, 54 px, vol breed, met vinkje) · rij van drie secundaire knoppen (Naar morgen · Andere dag… · ⋯) · infolijst (label links `text-2`, waarde rechts; **Uiterlijk** vet) · Notities (naam schrijver vet + tekst + "gisteren" in text-3; veld "Notitie toevoegen…") · Vorige keren (datum links; rechts "✓ op tijd" in `done`, "1 dag te laat" in `overdue`, "overgeslagen" in `text-3`). Gedane taak: de primaire knop wordt de regel "Gedaan om 08:12 · op tijd" met secundaire knop **Terugzetten**.

### 7.8 Melding onderin (toast, `sonner`)
Omgekeerd vlak (`toast`), radius 14, zwevende schaduw, 12 px boven de onderbalk. Links icoon (✓ in groen), tekst in twee regels: klein label ("Gedaan", "Verplaatst naar", "Weer open") en de taaknaam op één regel (afgekapt). Rechts de actie **Ongedaan maken** in `toast-action`, raakvlak 44 px. Ongeveer 5 s; blijft staan zolang de vinger erop ligt of de schermlezer focus heeft. `role="status"`. **Positie: onderaan** (nu bovenaan in `layout.tsx`, wordt `position="bottom-center"` met offset boven de onderbalk). Foutmelding: zelfde vorm, icoon ⓘ in `overdue`-licht, actie "Opnieuw".

### 7.9 Badges en status (spaarzaam)
Er zijn er precies drie: **bezig** (label in rij), **teller op de bel**, **stip op de filterknop**. Verder geen badges: verlopen, gedaan en vandaag worden getoond met plek, woord en kleur van de tekst, niet met pillen.

### 7.10 Iconografie
Eén set: **Lucide** (zit al in het project), lijndikte 1,75 (24 px) en 2 (14–16 px), afgeronde uiteinden. Alleen iconen met een functie:
| Icoon | Betekenis |
| --- | --- |
| sun | tab Vandaag |
| list-checks | tab Taken |
| plus | nieuwe taak / snel toevoegen |
| calendar | tab Kalender |
| shopping-basket | tab Boodschappen |
| bell / settings | meldingen / instellingen |
| repeat (↻) | terugkerende taak (in meta) |
| circle-alert | kop Verlopen, foutregels |
| circle-check / check | gedaan, gekozen chip, Afvinken |
| x / chevron-right / chevron-down / ellipsis | sluiten / verder / uitklappen / meer acties |
| search / sliders-horizontal | zoeken / filter |
| refresh-cw | laadfout, wacht op verbinding |
| wifi-off | offlinebalk |
Categorieën in Taken krijgen **geen** icoon; categorieën bij Boodschappen houden hun emoji (scanbaarheid in de winkel).

### 7.11 Lege staten
Geen illustraties. Links uitgelijnd in de flow van de pagina: klein rond icoon (44 px, zacht vlak in de passende rolkleur), titel 22/700, één of twee zinnen `text-2`, eventueel één knop. De rest van de pagina (gedaan-regel, Binnenkort) blijft eronder staan, zodat "leeg" nooit een doodlopend scherm is. Teksten volgens UX §7.

### 7.12 Grafieken
Geen. Het Overzicht toont getallen in gewone taal ("7 van 9 op tijd") en lijsten per taak; een grafiek ondersteunt hier geen beslissing (UC-06).

## 8. States en feedback

| State | Uiterlijk |
| --- | --- |
| Focus | 2 px `focus`-ring met 2 px afstand, alleen via toetsenbord (`:focus-visible`); rondje en rij elk afzonderlijk |
| Ingedrukt (touch) | rij/knop krijgt `sunken`/donkerder vlak, knop schaal 0,98; geen blauwe tik-flits (`-webkit-tap-highlight-color: transparent` blijft) |
| Hover | alleen bij muis (`@media (hover: hover)`), zelfde als ingedrukt maar lichter |
| Uitgeschakeld | `sunken` + `text-3` + één zin reden; nooit alleen grijs |
| Laden (eerste keer) | skeletrijen in de vorm van echte rijen (rondje-omtrek + twee balkjes + tijdbalkje), `sunken`, rustig pulseren (1,6 s); geen spinner |
| Laden met cache | niets zichtbaar; na 5 s regel "Bijwerken…" onder de kop in `text-3` |
| Fout zonder cache | icoon, titel, uitleg, **Opnieuw proberen** (primair), fijne tekst eronder; onderbalk blijft bruikbaar (vis-08) |
| Fout met cache / offline | balk onder de kop in `sunken` met icoon (wifi-off / refresh-cw) en tekst uit UX §7; geen rood (het is geen fout van de gebruiker) |
| Succes | melding onderin met Ongedaan maken; instellingen: kort "Opgeslagen" naast de schakelaar |
| Bezig | knop "Bezig…" uitgeschakeld; afvinken optimistisch zonder spinner |
| Validatiefout | rode rand + regel met icoon onder het veld; serverfout als regel bovenaan de sheet in `overdue` met icoon |

## 9. Responsive principes
- Alleen telefoon (390×844) is doelapparaat; getest op 390 breed. Tussen 360 en 430 breed verandert alleen de beschikbare breedte voor titels.
- Grotere tekstinstelling: rijen groeien, titel mag drie regels, tijdkolom gaat bij te weinig ruimte onder de titel staan (links uitgelijnd) in plaats van af te kappen.
- Liggend: niet ontworpen (manifest `orientation: portrait` blijft).
- Computer: gecentreerde kolom van max. 480 px, zie §5.

## 10. Motion
Alleen waar het laat zien wat er gebeurde. Easing standaard `cubic-bezier(0.2, 0, 0, 1)` (snel weg, zacht aankomen); sheets `cubic-bezier(0.32, 0.72, 0, 1)`.
| Moment | Wat | Duur |
| --- | --- | --- |
| Afvinken | rondje vult zich in `done`, vinkje verschijnt (schaal 0,8→1, geen overshoot); rij blijft 500 ms staan zodat je ziet wat je deed, daarna klapt hij in (hoogte + dekking) en telt "n gedaan" op | 160 ms + 500 ms wachten + 220 ms |
| Ongedaan maken | omgekeerd: rij klapt terug uit op zijn plek | 220 ms |
| Sheet open / dicht | schuift van onder / terug, scrim vervaagt | 300 ms / 220 ms |
| Melding | komt 8 px omhoog en vervaagt in; weg: vervaagt | 200 ms / 160 ms |
| Uitklappen (gedaan, Gekocht) | hoogte + chevron draait 180° | 200 ms |
| Skelet | zacht pulseren van dekking 1→0,6 | 1,6 s, herhaald |
De huidige `pop` met overshoot (schaal 1,15) vervalt: speels, maar onrustig bij een lijst waar je vijf dingen achter elkaar afvinkt.
**Minder beweging** (`prefers-reduced-motion: reduce`): geen verplaatsing of schaal; staten wisselen direct of met alleen een korte vervaging (≤ 100 ms); skelet pulseert niet. De bestaande globale regel in `globals.css` blijft als vangnet.

## 11. Bewust vermeden
| Anti-patroon | Hoe dit ontwerp het vermijdt |
| --- | --- |
| Verzameling witte kaarten | Rijen staan op papier met haarlijnen; alleen Verlopen en het weekblok hebben een vlak, allebei met een reden |
| Overal dezelfde grote afgeronde rechthoeken | Radius schaalt met het vlak (8/12/16/22); rijen hebben geen vorm |
| Blauw/paarse gradients | Geen gradients; blauw alleen als "tikbaar" |
| Enorme hero-koppen | Paginatitel 30 px zonder begroeting (begroeting vervalt, UX §5.1) |
| Dashboard met KPI-tegels | De vier tegels en voortgangsbalk vervallen; één regel "Deze week: 9 gedaan · 7 op tijd · 1 vergeten" |
| Overmatige badges | Drie in totaal (bezig, bel-teller, filter-stip); status via woord en plek |
| Iconen zonder functie | Iconentabel §7.10; geen iconen voor secties of categorieën in Taken |
| Onnodige sidebar | Geen; onderbalk met vier bestemmingen |
| Standaard SaaS-look | Eigen letter, warm papier, diep blauw, geen kaart-met-schaduw-per-item, geen indigo, geen hoofdletter-kopjes met telpillen |
| Lege ruimte zonder functie | Ruimte scheidt groepen (26 px) en laat de tijdkolom ademen; Vandaag toont 1 verlopen + 4 taken + gedaan-regel + begin van Binnenkort boven de vouw (vis-01) |
| Glassmorphism | Geen blur (ook de huidige `backdrop-blur` achter sheets vervalt) |
| Overal schaduwen | Alleen sheet, melding en duim van segment/schakelaar |
| Kleur zonder functie | Tabel §4; profielkleuren van leden verschijnen niet meer bij taken |

## 12. Prototype

HTML/CSS in `docs/prototype/visueel/` met gedeelde tokens `ds.css`, iconen en vaste delen in `shell.js`, lettertype `fonts/figtree.woff2`. Tijdelijk referentiemateriaal: na de release verwijderen of archiveren. Screenshots 390×844 (1×) in `docs/screenshots/prototype/`, alle met Read bekeken en na beoordeling bijgewerkt.

| # | Bestand | Screenshot | Toont | Beoordeling |
| --- | --- | --- | --- | --- |
| 01 | `01-vandaag.html` | `vis-01-vandaag-390x844.png` | Vandaag gevuld (licht) | Verlopen springt eruit via één terracotta vlak; tijdkolom leest als dienstregeling; 1 verlopen + 4 taken + gedaan-regel + 2 van Binnenkort boven de onderbalk (succescriterium 6 gehaald) |
| 01d | idem, donker | `vis-01-vandaag-donker-390x844.png` | Vandaag, donkere modus | Warm donker, verlopen-vlak bruinrood, accent lichtblauw; hiërarchie gelijk aan licht |
| 02 | `02-vandaag-afgevinkt.html` | `vis-02-vandaag-afgevinkt-390x844.png` | Na afvinken, melding met Ongedaan maken | Melding eerst op drie regels afgebroken → herontworpen naar label + één regel taaknaam |
| 03 | `03-nieuwe-taak.html` | `vis-03-nieuwe-taak-390x844.png` | Nieuwe taak, slimme invoer, toetsenbord open | Eerst viel Toevoegen onder het toetsenbord → sheet verhoogd; nu naam, wanneer, herhalen én Toevoegen boven het toetsenbord |
| 04 | `04-taakdetail.html` | `vis-04-taakdetail-390x844.png` | Taakdetail van een reeks | "mag al" stond in de gedaan-kleur (verkeerde betekenis) → neutraal gemaakt |
| 05 | `05-taken.html` | `vis-05-taken-390x844.png` | Taken › Open met actief filter | Vandaag-groep in oker onderscheidt zich van verlopen zonder te concurreren |
| 06 | `06-boodschappen.html` | `vis-06-boodschappen-390x844.png` | Boodschappen | Invoerveld rekte uit → hoogte vastgezet; categorie-emoji maken scannen makkelijk |
| 07 | `07-vandaag-alles-gedaan.html` | `vis-07-vandaag-alles-gedaan-390x844.png` | Lege staat "Alles gedaan" | Rustig, geen illustratie, pagina loopt door |
| 08 | `08-vandaag-laadfout.html` | `vis-08-vandaag-laadfout-390x844.png` | Laadfout zonder cache + skelet | Geen rood (geen fout van de gebruiker), duidelijke hoofdactie |
| 09 | `09-componenten.html` | `vis-09-componenten-390x844.png`, `vis-09-componenten-donker-390x844.png` | Kleuren, knoppen, velden, keuzes, rijen, melding in alle states (volledige pagina) | In donker was tekst op de gevaarknop onleesbaar → token `on-danger` toegevoegd; plaatshouder op `sunken` haalde 4,35:1 → `text-3` verdonkerd naar 4,6:1 |

Wat het prototype **niet** laat zien (volgt dezelfde regels, geen nieuw ontwerp nodig): Kalender, Meldingen, Instellingen en subpagina's, Overzicht, Inloggen, offlinebalk, sheets "Wat wil je wijzigen?" en bevestigingen. De bouwer gebruikt daarvoor de wireframes plus dit document.

## 13. Open vragen en aannames

**Vragen voor Jurgen**
- **V-30** — Accentkleur en app-icoon. Voorstel: de kleur voor "tikbaar" wordt een diep, rustig blauw (`#2B4C9B`) in plaats van het huidige felle indigo; het app-icoon (blauw huisje) krijgt dezelfde blauwe tint zodat icoon en app bij elkaar passen. Waarom het ertoe doet: het icoon is wat het gezin elke dag op het beginscherm ziet; een andere kleur is een merkkeuze. Alternatief: het huidige indigo en icoon houden (dan kleurt alleen de tint van knoppen feller).
- **V-31** — Eigen lettertype. Voorstel: Figtree, zelf gehost (20 KB, geen verbinding met Google). Waarom het ertoe doet: het bepaalt het gevoel van de hele app en werkt op iPhone en Android gelijk. Alternatief: de standaardletter van elke telefoon.

**Aannames (raken geen rechten, gegevens, privacy of scope)**
- `[AANNAME]` Prioriteit hoog/dringend krijgt in de rij geen kleur; alleen in het detail (en het bestaande "!" vóór de titel bij dringend blijft, in `text`).
- `[AANNAME]` Donkere modus volgt de telefooninstelling, zonder schakelaar in de app (zoals nu).
- `[AANNAME]` De + in de onderbalk heeft geen zichtbaar label, wel `aria-label` (wireframe toonde "Taak"); valt het in de UX-review tegen, dan komt het label terug zonder dat de balk verandert.

**Voor de solution-architect (geen vraag voor Jurgen)**
- Lettertype via `next/font` (self-hosted, `latin`, variabel) en tokens in één bron in `globals.css` (§4).
- `sonner` naar `bottom-center` met offset boven de onderbalk; `richColors` uit (kleuren komen uit tokens).
- Chip als gedeeld component; rondje en rij als twee knoppen (A-01).
