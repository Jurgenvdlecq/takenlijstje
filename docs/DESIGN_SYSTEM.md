# Design system — Takenlijstje

Versie: ronde 1 (2026-09-28) · Kwaliteitsniveau 2 · Werkwijze §15 (bestaand project), fase 4.
Basis: `docs/PRODUCT_SPEC.md`, `docs/UX_SPEC.md` (ronde 1, wireframes 01–21), besluiten in `docs/PROGRESS.md`, `docs/INVENTARIS.md` §5 en §7 (D-01…D-05), de huidige stijl (`src/app/globals.css`, `src/components/ui/*`) en `docs/screenshots/bestaand/*-390x844.png`.
Prototype: `docs/prototype/visueel/` · screenshots: `docs/screenshots/prototype/vis-*.png` (§12).

Besluiten van Jurgen verwerkt (2026-09-28, `docs/PROGRESS.md`): V-28 (Boodschappen in de onderbalk), V-30 (accent diep blauw `#2B4C9B`, app-icoon in dezelfde tint), V-31 (lettertype Figtree, zelf gehost). Er staan geen open vragen meer in dit document (zie §13).

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
- Blauw als kleur voor "je kunt hierop tikken", in een diepere, rustiger tint dan het huidige felle indigo: **`#2B4C9B`** (besluit V-30). Het app-icoon (het blauwe huisje) krijgt dezelfde tint, zodat icoon, statusbalk en app bij elkaar passen.
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

**Lettertype: Figtree** (variabel, gewichten 300–900, SIL Open Font License), met terugval `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Besluit V-31: Figtree, zelf gehost.

Waarom Figtree en niet alleen de systeemletter:
- Vergeleken op echte inhoud (Figtree, Instrument Sans, Hanken Grotesk, Onest, Inter; tijdelijke vergelijkingspagina, niet bewaard). Figtree heeft ronde, open vormen (warm, gezinsvriendelijk) zonder kinderachtig te worden, heldere cijfers met `tabular-nums` (de tijdkolom staat recht), en is met **20 KB** (latin, variabel) de lichtste van de vijf.
- Het gezin gebruikt mogelijk niet allemaal een iPhone; de systeemletter zou dan per toestel anders zijn (SF Pro, Roboto, Samsung One). Eén eigen letter geeft één herkenbaar beeld.
- Techniek: via **`next/font/local`**, met het bestand Figtree (variabel, subset `latin` inclusief é, ë, ó, ü, ca. 20 KB woff2) in de repository, bijvoorbeeld `src/app/fonts/figtree-latin-wght-normal.woff2`. Bron: het npm-pakket `@fontsource-variable/figtree` (OFL-licentie; licentietekst meeleveren). Geen verzoek naar een externe lettertypedienst, niet bij de build en niet bij het openen (privacy). `display: "swap"` met automatisch aangepaste terugvalmaten (`adjustFontFallback`), zodat de tekst niet verspringt. Het prototype gebruikt hetzelfde bestand (`docs/prototype/visueel/fonts/figtree.woff2`).
- De terugvalletters worden alleen gebruikt zolang Figtree nog laadt of als het bestand onverhoopt ontbreekt.

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
- **Onderbalk:** `bg` met haarlijn erboven (geen blur, geen schaduw). Vier bestemmingen met icoon 24 px + label 11,5 px; actief = `accent` en iets dikkere lijn, plus `aria-current="page"`. In het midden de **+**: rond, 48 px, `accent`, zonder label maar met `aria-label="Nieuwe taak"` (de plus is universeel; een label eronder zou de balk hoger maken). Indeling volgens UX §3 en besluit V-28: Vandaag · Taken · + · Kalender · Boodschappen.
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
| recycle | afvaltaak / Afvalkalender: meta in de rij, bovenregel in het taakdetail, sectie-icoon in de oude instellingen, informatierij in Taken › Terugkerend. **Niet** trash-2: een prullenbak betekent in deze app "verwijderen", en dat kan bij een afvaltaak juist niet |
| circle-alert | kop Verlopen, foutregels; storingsbalk en storingsstatus van de Afvalkalender (daar in `text-2`, nooit rood; §7.13.4) |
| circle-check / check | gedaan, gekozen chip, Afvinken |
| x / chevron-right / chevron-down / ellipsis | sluiten / verder / uitklappen / meer acties |
| search / sliders-horizontal | zoeken / filter |
| refresh-cw | laadfout, wacht op verbinding |
| wifi-off | offlinebalk |
Categorieën in Taken krijgen **geen** icoon; categorieën bij Boodschappen houden hun emoji (scanbaarheid in de winkel).

"♻" in de UX- en productdocumenten is een afkorting. In de app staat altijd het Lucide-icoon `Recycle`, nooit het Unicode-teken ♻ of een emoji. Dat teken wordt op iOS en Android als groene emoji getoond, verschilt per toestel en zou kleur zonder functie in de lijst brengen.

### 7.11 Lege staten
Geen illustraties. Links uitgelijnd in de flow van de pagina: klein rond icoon (44 px, zacht vlak in de passende rolkleur), titel 22/700, één of twee zinnen `text-2`, eventueel één knop. De rest van de pagina (gedaan-regel, Binnenkort) blijft eronder staan, zodat "leeg" nooit een doodlopend scherm is. Teksten volgens UX §7.

### 7.12 Grafieken
Geen. Het Overzicht toont getallen in gewone taal ("7 van 9 op tijd") en lijsten per taak; een grafiek ondersteunt hier geen beslissing (UC-06).

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
| Storing externe bron (afvalkalender: > 48 uur zonder succes om welke reden ook, ook als de achtergrondtaak stil lag; of een aanhoudend leeg antwoord, BR-52) | balk H volgens §7.13.4: `sunken`, radius 16, `circle-alert` in `text-2`, titel 15/600, uitleg 14/18 `text-2`, resultaatregel in de balk (geen melding onderin), tekstknop "Opnieuw proberen" (H3 ook "Adres controleren"); geen rood. De bewaarde ophaaldagen blijven eronder staan, ook bij een leeg antwoord. Blijft staan tot het bijwerken weer gelukt is |
| Hapering externe bron (nog geen storing) | alleen een stille regel in `text-meta` `text-3` onder de kop (T-71 of T-71b); geen balk, geen knop. Zonder foutcode en zonder storing: gewoon G, met het eerlijke tijdstip in de kop |
| Antwoord van de bron bij zoeken | D: regel in `overdue` boven de velden, zonder rode rand. F en F2: `sunken`-balk zonder titel boven het formulier, met de hoofdactie onder het formulier |

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

Wat het prototype **niet** laat zien (volgt dezelfde regels, geen nieuw ontwerp nodig): Kalender, Meldingen, Instellingen en subpagina's, Overzicht, Inloggen, offlinebalk, sheets "Wat wil je wijzigen?" en bevestigingen. De bouwer gebruikt daarvoor de wireframes plus dit document.

**W-03 (afvalkalender).** De bestanden staan in `docs/prototype/w03/`, met een kopie van `ds.css` (gelijk aan `visueel/`), een uitgebreide `shell.js` (icoon `recycle`) en `w03.css` (alleen aanvullingen, geen nieuwe tokens). Alle W03-screenshots zijn 390×844, met Read bekeken; 01, 02, 05 en 08 ook donker. Niet als prototype gebouwd, omdat ze 1-op-1 bestaande patronen volgen: het taakdetail van een afvaltaak, de uitzet-sheet, C2, E, A′, offline, en de meldingen T-90/T-90b (bestaande melding onderin, §7.8, met of zonder actie). De beeldcontrole daarvan valt bij CP-W03 (TD §18.16 U3).

## 13. Open vragen en aannames

**Besluiten van Jurgen**
Geen open vragen. Besloten door Jurgen (2026-09-28, letterlijk in `docs/PROGRESS.md`):
- **V-30** — Accentkleur diep blauw `#2B4C9B` in plaats van het felle indigo; het app-icoon krijgt dezelfde tint (§0, §4).
- **V-31** — Lettertype Figtree, zelf gehost (§3).
- **V-28** — Boodschappen in de onderbalk (§7.6).

**Aannames (raken geen rechten, gegevens, privacy of scope)**
- `[AANNAME]` Prioriteit hoog/dringend krijgt in de rij geen kleur; alleen in het detail (en het bestaande "!" vóór de titel bij dringend blijft, in `text`).
- `[AANNAME]` Donkere modus volgt de telefooninstelling, zonder schakelaar in de app (zoals nu).
- `[AANNAME]` De + in de onderbalk heeft geen zichtbaar label, wel `aria-label` (wireframe toonde "Taak"); valt het in de UX-review tegen, dan komt het label terug zonder dat de balk verandert.

**Voor de solution-architect (geen vraag voor Jurgen)**
- Lettertype via `next/font/local` (Figtree-woff2 in de repo, `latin`, variabel; §3) en tokens in één bron in `globals.css` (§4).
- `sonner` naar `bottom-center` met offset boven de onderbalk; `richColors` uit (kleuren komen uit tokens).
- Chip als gedeeld component; rondje en rij als twee knoppen (A-01).
