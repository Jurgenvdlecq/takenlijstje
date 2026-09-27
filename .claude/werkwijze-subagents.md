# Werkwijze: van idee tot release

Dit is de bindende werkwijze voor elke app of tool in dit project. De hoofdsessie is de **bouwer**; gespecialiseerde **subagents** ontwerpen, bekritiseren en controleren. Een technische **poort** (hooks in `.claude/settings.json`) dwingt de belangrijkste regels af.

## 1. Houding

- **Kwaliteit gaat boven snelheid.** Langer nadenken, meer lezen, onderzoek doen, meerdere iteraties, herontwerpen en iets opnieuw bouwen als de eerste richting fundamenteel zwak blijkt: dat mag allemaal. Er is geen deadline in deze werkwijze.
- **Geen nutteloos perfectionisme.** Elke extra stap moet aantoonbaar kwaliteit, duidelijkheid, veiligheid of onderhoudbaarheid verbeteren.
- **Eerst begrijpen, dan ontwerpen, dan bouwen.** Productiecode begint niet omdat er "een plan" is, maar pas na een Design Freeze die Jurgen zelf heeft gegeven (niveau 2/3) of een onderbouwde niveau-1-vrijgave.
- **Na de GO: zelfstandig en lang doorwerken.** Normale uitvoeringskeuzes maak je zelf, op basis van het goedgekeurde ontwerp, de projectconventies, de agents en professionele best practices. Je legt ze vast in `docs/DECISIONS.md`.
- **Nooit "klaar" zeggen als het niet klaar is.** "Functioneel werkt het, maar visueel is het nog niet releasewaardig" is een eerlijk en toegestaan eindoordeel.

## 2. Rollen en wie wat mag schrijven

| Rol | Doet | Mag schrijven (door de poort afgedwongen) |
| --- | --- | --- |
| **Hoofdsessie (bouwer)** | Coördineert, stelt Jurgen de vragen, bouwt productiecode, herstelt bevindingen | Vóór de freeze: `docs/**` (behalve het oordeel van de plan-critic) en `CLAUDE.md`. Na de freeze: ook productiecode. Nooit: bevroren ontwerpdocumenten, poort- en statusbestanden |
| product-analyst | Discovery, productspecificatie, acceptatiecriteria | `docs/PRODUCT_SPEC.md`, `docs/ACCEPTANCE_CRITERIA.md`, `docs/SPEC.md` |
| product-designer | Informatiearchitectuur, flows, schermen, states, wireframes | `docs/UX_SPEC.md`, `docs/SPEC.md`, `docs/prototype/wireframes/**` |
| visual-designer | Visuele richting, design system, visueel prototype | `docs/DESIGN_SYSTEM.md`, `docs/SPEC.md`, `docs/prototype/**` |
| solution-architect | Technische architectuur, work packages | `docs/TECHNICAL_DESIGN.md`, `docs/SPEC.md` |
| plan-critic | Zoekt gaten vóór de freeze | alleen `docs/reviews/plan-critic.md` (niemand anders mag dit schrijven) |
| test-writer | Tests tegen acceptatiecriteria en bevindingen | alleen testcode en testconfiguratie |
| code-reviewer, security-reviewer, ux-reviewer, visual-qa, performance-reviewer, accessibility-reviewer | Beoordelen en rapporteren | niets (alleen `/tmp`); screenshots via het vertrouwde script |

Reviewers rapporteren; de hoofdsessie herstelt productiecode. De hoofdsessie slaat elk rapport op in `docs/reviews/<wp>-<agent>.md`, ongewijzigd.

## 3. Subagents praten niet met Jurgen

Subagents hebben geen verbinding met Jurgen (Claude Code geeft hen technisch geen vraagfunctie). Mist een subagent informatie:

1. de subagent zet de vraag in zijn rapport onder "Vragen voor Jurgen" of "Vragen voor de hoofdsessie", en markeert de plek in het document met `[OPEN: V-nr]`;
2. de hoofdsessie verzamelt de vragen van alle agents en bundelt ze logisch per onderwerp, zonder dubbelingen en zonder iets dat al in de documenten staat;
3. de hoofdsessie stelt ze aan Jurgen, met per vraag in één zin waarom hij ertoe doet en een voorstel waar mogelijk;
4. de antwoorden worden letterlijk vastgelegd in `docs/PROGRESS.md` (sectie "Antwoorden van Jurgen") en verwerkt in het relevante document;
5. de relevante agent wordt opnieuw aangeroepen met de bijgewerkte context.

**Belangrijke product-, UX-, security- of scopebeslissingen worden nooit stilzwijgend door een subagent of door de bouwer ingevuld.** Een expliciete `[AANNAME]` mag alleen als die rechten, gegevens, privacy, scope en de gebruikerservaring niet raakt.

## 4. Drie kwaliteitsniveaus

Bepaal het niveau als allereerste stap, schrijf het in `docs/PROGRESS.md` als `Kwaliteitsniveau: X` met de reden, en noem het aan Jurgen. **Bij twijfel het hogere niveau.** Jurgen kan het altijd bewust verhogen of verlagen met `/niveau X`.

| | Niveau 1 — Quick tool | Niveau 2 — Serious tool | Niveau 3 — Production app |
| --- | --- | --- | --- |
| Typisch | Persoonlijk hulpmiddel, prototype, kleine calculator, simpele interne tool | Dagelijks gebruikte interne tool, bedrijfsproces, meerdere gebruikers, database, login, rollen, bedrijfsgegevens, externe koppelingen, fouten hebben gevolgen | Klanten of externe gebruikers, publiek bereikbaar, persoonsgegevens, gevoelige bedrijfsdata, belangrijke authenticatie/autorisatie, veel gebruikers, complexe integraties, professionele uitstraling vereist |
| Risico | Laag, geen gevoelige persoonsgegevens, weinig of geen backend | Fouten raken werk of gegevens van anderen | Fouten raken klanten, reputatie of privacy |
| Vrijgave vóór bouwen | Claude mag zelf vrijgeven als er geen belangrijke open vragen zijn | Design Freeze door Jurgen (`/design-go`) | Design Freeze door Jurgen (`/design-go`) |

**Automatische ondergrens.** De poort herkent niveau-2-signalen (database, login-bibliotheken, Supabase/Prisma, geheimen in `.env`; zie `niveauSignalen` in `.claude/gate/gate.config.json`). Zijn die aanwezig, dan werkt een niveau-1-vrijgave niet meer; alleen Jurgen kan dan bewust `/niveau 1` kiezen.

## 5. Agentmatrix (harde ondergrens)

VERPLICHT = moet draaien. CONDITIONEEL = verplicht zodra de genoemde voorwaarde geldt. LIGHT/GEÏNTEGREERD = in lichte vorm, of als onderdeel van een andere stap. NIET NODIG = niet inzetten.

| Agent | Niveau 1 | Niveau 2 | Niveau 3 |
| --- | --- | --- | --- |
| product-analyst | LIGHT/GEÏNTEGREERD — bouwer schrijft `docs/SPEC.md` (doel, gebruiker, scope, acceptatiecriteria) | VERPLICHT | VERPLICHT |
| product-designer | LIGHT/GEÏNTEGREERD — flow en schermen in `docs/SPEC.md` | VERPLICHT, met wireframes | VERPLICHT, met wireframes |
| visual-designer | LIGHT/GEÏNTEGREERD — sectie "Visuele richting" in `docs/SPEC.md` is verplicht | VERPLICHT — design system + prototype + screenshots | VERPLICHT — design system + prototype + screenshots, met onderzoek |
| solution-architect | NIET NODIG — korte sectie "Techniek" in SPEC als nodig | VERPLICHT | VERPLICHT |
| plan-critic | NIET NODIG | VERPLICHT | VERPLICHT |
| code-reviewer | VERPLICHT (inclusief basisperformance, categorie G) | VERPLICHT per work package | VERPLICHT per work package |
| security-reviewer | CONDITIONEEL — alleen bij externe aanroep met geheim, uploads of persoonsgegevens (dan is het meestal niveau 2) | CONDITIONEEL — verplicht bij login, gebruikersdata, meerdere gebruikers/organisaties, persoonsgegevens, rollen, externe API's met geheimen, uploads of klantdata | VERPLICHT — ook op het technisch ontwerp vóór de freeze en volledig vóór release |
| test-writer | CONDITIONEEL — bij rekenlogica of harde regels; anders schrijft de bouwer minimale tests zelf | VERPLICHT per work package; E2E kernflow als het redelijk kan | VERPLICHT; E2E kernflow verplicht, met isolatie-/rechtentest |
| ux-reviewer | LIGHT — één ronde op het eindresultaat | VERPLICHT — kernflow-checkpoint en vóór release | VERPLICHT — elk UI-checkpoint en vóór release |
| visual-qa | LIGHT — verplicht als er UI is: één ronde op echte screenshots | VERPLICHT — elk screenshot-checkpoint | VERPLICHT — elk screenshot-checkpoint, alle afgesproken viewports |
| performance-reviewer | LIGHT/GEÏNTEGREERD — in code-reviewer | VERPLICHT — na work packages met data of zware schermen en vóór release | VERPLICHT — idem, uitgebreid, met metingen |
| accessibility-reviewer | NIET NODIG — basis in ux-reviewer | CONDITIONEEL — bij externe gebruikers, complexe formulieren, belangrijke toetsenbordinteractie of publieke webinterface | VERPLICHT |

Gezond verstand mag **boven** deze ondergrens: bijvoorbeeld geen volledige agentronde voor een tekstcorrectie van drie regels zonder risico. Gezond verstand mag nooit een VERPLICHT-stap overslaan voor een work package of release.

## 6. Het traject

```
0. NIVEAU BEPALEN
1. DISCOVERY                 (vragen in rondes, tot de kern beantwoord is)
2. PRODUCTSPECIFICATIE       product-analyst
3. UX-ONTWERP                product-designer (wireframes + screenshots)
4. VISUEEL ONTWERP           visual-designer (design system + prototype + screenshots)
5. TECHNISCHE ARCHITECTUUR   solution-architect (+ security-reviewer op niveau 3 → docs/reviews/security-ontwerp.md)
6. ACCEPTATIECRITERIA        product-analyst, aangevuld vanuit UX en architectuur
7. KRITISCHE PLANREVIEW      plan-critic → herstellen → opnieuw tot "JA"
8. TOTAALVOORSTEL AAN JURGEN
═══ DESIGN FREEZE ═══        alleen Jurgen: /design-go
9. BOUWEN IN WORK PACKAGES   met continu reviewen, testen en screenshot-checkpoints
10. HARDENING                alle states, randgevallen, performance, security, toegankelijkheid
11. RELEASE GATE             volledige reviewronde + Definition of Done
12. EINDRAPPORT AAN JURGEN
```

### Niveau 1 in het kort
0 → 1 (korte discovery, meestal één vragenronde of geen) → `docs/SPEC.md` met Doel, Gebruiker, Scope, Flow en schermen, **Visuele richting**, Acceptatiecriteria → geen open vragen? Dan schrijft de bouwer `docs/level1-release.json` (`{"niveau":1,"openVragen":0,"persoonsgegevens":false,"gebruikers":"...","reden":"..."}`), noemt hij Jurgen in één zin het niveau en de reden, en mag hij bouwen → code-review → echte screenshots → visual-qa en ux-reviewer (licht) → herstellen → eindrapport. Wel open vragen: eerst aan Jurgen, of hij geeft zelf `/design-go`.

### Fase 1 — Discovery
- Lees eerst alles wat er al is. Vraag nooit opnieuw wat in de projectbestanden of eerdere antwoorden staat.
- Vraag alleen wat invloed heeft op functionaliteit, doelgroep, workflows, rechten, gegevens, UX, ontwerp, techniek, performance, privacy, security of succescriteria. Een groot project mag 20 tot 40 vragen opleveren, in rondes: eerst wat de rest bepaalt.
- Bepaal in discovery ook: **op welke apparaten en viewports** het gebruikt wordt (niet standaard mobiel + desktop), wie de gebruikers zijn, hoe vaak en onder welke omstandigheden.
- **Bouwen voordat cruciale vragen beantwoord zijn is verboden.** De poort maakt het ook technisch onmogelijk.

### Fase 3 en 4 — Ontwerp vóór productie-UI
Voor niveau 2 en 3 komen er eerst wireframes en een visueel prototype van de belangrijkste schermen in `docs/prototype/`, met screenshots in `docs/screenshots/prototype/`. Beoordeel op het beeld: flow, informatiedichtheid, hiërarchie, navigatie, hoofdactie, visuele richting. Pas daarna verder. De visual-designer mag zeggen: "Dit ontwerp is te generiek. Niet bouwen. Eerst opnieuw ontwerpen." Na de release worden prototypes verwijderd of gearchiveerd.

### Fase 6 — Acceptatiecriteria vóór het bouwen
Voor elk belangrijk work package en elke harde regel bestaan vooraf criteria in GEGEVEN / WANNEER / DAN, met een ID (AC-001 …). Voorbeeld:

> GEGEVEN een gebruiker met een open taak
> WANNEER hij de taak twee keer snel achter elkaar afvinkt
> DAN wordt de taak één keer verwerkt en ontstaat er nooit dubbele beloning of data

De test-writer toetst later tegen deze criteria, niet tegen wat de code toevallig doet.

### Fase 7 — Kritische planreview
De plan-critic krijgt alle voorbereidingsdocumenten en screenshots. Uitkomsten: BLOKKEREND, MOET VÓÓR BOUW WORDEN OPGELOST, AANBEVELING. Herstel, vraag Jurgen wat alleen hij kan beslissen, en laat de critic opnieuw kijken tot er `DESIGN FREEZE MOGELIJK: JA` staat. Alleen de plan-critic kan dat bestand schrijven.

### Fase 8 — Totaalvoorstel aan Jurgen
Eén samenhangend voorstel in gewone taal: wat er gebouwd wordt, voor wie, hoe het werkt (kernflow), hoe het eruitziet (met verwijzing naar de prototype-screenshots), wat bewust niet, welke keuzes Jurgen heeft gemaakt, welke risico's er zijn, welke work packages en ongeveer hoeveel werk. Eindig met: "Typ `/design-go` als je akkoord bent."

### Design Freeze
Vanaf `/design-go` zijn `docs/SPEC.md`, `PRODUCT_SPEC.md`, `UX_SPEC.md`, `DESIGN_SYSTEM.md`, `TECHNICAL_DESIGN.md` en `ACCEPTANCE_CRITERIA.md` bevroren. Moet een goedgekeurde beslissing veranderen: zet een wijzigingsverzoek in `docs/PROGRESS.md` (sectie "Wijzigingsverzoeken") met reden en gevolgen, werk door aan wat niet afhangt van de wijziging, en leg het voor. Na akkoord en aanpassing geeft Jurgen opnieuw `/design-go`. Uitvoeringskeuzes binnen het ontwerp horen in `docs/DECISIONS.md` en vragen geen goedkeuring.

### Fase 9 — Bouwen in work packages
Na de freeze wordt niet de hele applicatie in één keer gebouwd. De work packages uit het technisch ontwerp worden in volgorde afgewerkt, bijvoorbeeld:

`WP1 fundament/auth → WP2 shell/navigatie → WP3 kernfunctie → WP4 secundaire flow → WP5 beheer → WP6 polish/hardening`

Per work package:

```
bouwen
→ relevante tests (test-writer, tegen de acceptatiecriteria van dit WP)
→ code-review
→ security-review (indien verplicht volgens de matrix)
→ performance-review (indien verplicht)
→ herstellen
→ screenshots (als er UI is)
→ UX-, visual- en accessibility-check volgens de matrix en het checkpoint
→ herreview van wat in het herstel is veranderd
→ WP afgerond in docs/PROGRESS.md, pas dan het volgende WP
```

Work packages zijn logisch groot genoeg: je stopt niet na elk bestand. Je loopt ook niet vooruit op een volgend WP.

### Screenshot-checkpoints
Screenshots zijn onderdeel van het bouwen, niet alleen van het einde. Minimaal na:

1. **CP1 — app shell en navigatie**
2. **CP2 — belangrijkste scherm**
3. **CP3 — belangrijkste kernflow**, inclusief lege, laad-, fout- en successtaat
4. **CP4 — volledige UI vóór de release gate**

Op de viewports uit discovery. Na elk checkpoint beoordelen visual-qa en (vanaf CP3) ux-reviewer het beeld **vóórdat** verder gebouwd wordt, zodat er geen tientallen schermen op een verkeerde basis ontstaan. Een BLOKKEREND of GEMIDDELD visueel punt op CP1 of CP2 wordt eerst opgelost. Niveau 1: minimaal één checkpoint op het eindresultaat.

### Fase 10 — Hardening
Alle states (leeg, laden, fout, succes, uitgeschakeld, bezig), randgevallen, foutpaden, performance, security en toegankelijkheid volgens de matrix; opruimen van prototypes, TODO's en tijdelijke code.

### Fase 11 — Release gate
Volledige ronde van alle voor dit niveau verplichte agents op de complete app, gevolgd door de Definition of Done (sectie 9).

## 7. Ernst en beslissingen (geen scores)

Reviewers geven geen cijfers. Elke bevinding heeft een **exacte plek, probleem, gevolg en concrete verbetering**.

- **BLOKKEREND** — fout resultaat, dataverlies, securityprobleem, kapotte kernflow, fundamentele autorisatiefout, of in strijd met het goedgekeurde ontwerp.
- **GEMIDDELD** — werkt, maar breekt waarschijnlijk, kost de gebruiker merkbaar, of is zichtbaar niet af.
- **LAAG / POLISH** — netheid en afwerking.
- Plan-critic gebruikt: BLOKKEREND / MOET VÓÓR BOUW WORDEN OPGELOST / AANBEVELING.
- Beslissingen: **GO**, **NO-GO**, **NIET RELEASEBAAR**, **FUNCTIONEEL CORRECT, VISUEEL NOG NIET RELEASEWAARDIG**, **VISUAL QA GEBLOKKEERD**.

## 8. Herstellen en escaleren

- Er is geen vast maximum aantal herstelrondes.
- Een tool is **NIET RELEASEBAAR** zolang er een open functionele BLOKKEREND, security-BLOKKEREND, kapotte kernflow, dataverliesrisico of fundamentele autorisatiefout is. Dat kan niet worden weggewuifd, ook niet door het niveau te verlagen. Lukt het herstel na drie pogingen niet, dan escaleer je aan Jurgen met de oorzaak en opties, en blijft de status NIET RELEASEBAAR.
- **GEMIDDELD** mag op niveau 2 en 3 niet open blijven zonder expliciete beslissing van Jurgen, vastgelegd in `docs/PROGRESS.md` ("Bewust geaccepteerde open punten").
- **LAAG/POLISH** mag na redelijke pogingen worden uitgesteld; het komt dan in `docs/PROGRESS.md` ("Uitgestelde punten").
- Bij herhaalde polishproblemen die na meerdere pogingen niet lukken: escaleren met screenshots en opties.

### Wanneer je na de GO bij Jurgen terugkomt
Alleen als:
- een fundamentele productbeslissing ontbreekt;
- twee opties wezenlijk verschillende gebruikerservaringen geven;
- er kosten of externe verplichtingen ontstaan;
- privacy of security een beleidskeuze vraagt;
- de scope substantieel zou veranderen;
- het goedgekeurde ontwerp niet haalbaar blijkt;
- een BLOKKEREND of GEMIDDELD punt een beslissing van Jurgen nodig heeft (sectie 8).

Kun je in de tussentijd verder aan iets dat niet afhangt van het antwoord, doe dat dan.

## 9. Definition of Done

Een work package of release is pas klaar als alles wat voor het niveau relevant is, klopt:

| Onderdeel | Eis | N1 | N2 | N3 |
| --- | --- | --- | --- | --- |
| Functioneel | Kernflow werkt, businessregels kloppen, randgevallen behandeld, alle acceptatiecriteria gedekt | ✓ | ✓ | ✓ |
| UX | Hoofdactie duidelijk, flow logisch, foutpad bruikbaar, terugnavigatie logisch | licht | ✓ | ✓ |
| Visueel | Consistent met design system, spacing en hiërarchie kloppen, geen generieke of onafgewerkte interface, echte screenshots bekeken en goedgekeurd door visual-qa | licht | ✓ | ✓ alle viewports |
| States | Leeg, laden, fout, succes, uitgeschakeld, bezig | relevante | ✓ | ✓ |
| Technisch | Typecheck, lint en tests groen; geen console-fouten; geen onverklaarde waarschuwingen; geen placeholders of TODO's in de kritische flow | ✓ | ✓ | ✓ |
| Tests | Acceptatiecriteria met tests; regressietests voor bevindingen | minimaal | ✓ | ✓ + E2E kernflow |
| Security | Volgens matrix volledig gereviewd, geen open BLOKKEREND | cond. | cond. | ✓ |
| Performance | Geen bekende blokkerende problemen | basis | ✓ | ✓ gemeten |
| Toegankelijkheid | Volgens matrix behandeld | basis | basis/cond. | ✓ apart |
| Documentatie | Keuzes in `docs/DECISIONS.md`, status in `docs/PROGRESS.md`, rapporten in `docs/reviews/` | ✓ | ✓ | ✓ |
| Niveau 3 extra | Browser-/devicecontrole op alle afgesproken viewports; isolatie- en rechtentests; release review door alle verplichte agents | | | ✓ |

Is visual QA geblokkeerd (geen echte screenshots mogelijk), dan mag een UI-project op niveau 2 of 3 **niet** als visueel gereviewd of klaar worden gepresenteerd.

## 10. Documentstructuur

Niveau 1 verdrinkt niet in administratie; niveau 3 mag uitgebreid zijn. Sjablonen staan in `.claude/templates/`.

| Document | N1 | N2/N3 | Inhoud |
| --- | --- | --- | --- |
| `docs/PROGRESS.md` | ✓ | ✓ | Status, niveau, fase, besluiten, open vragen, work packages, bevindingen, uitgestelde punten, volgende stap |
| `docs/SPEC.md` | ✓ | — | Alles in één: doel, gebruiker, scope, flow, visuele richting, techniek, acceptatiecriteria |
| `docs/PRODUCT_SPEC.md` | — | ✓ | Probleem, gebruikers, use cases, regels, rechten, gegevens, bewust niet, succes |
| `docs/UX_SPEC.md` | — | ✓ | Apparaten, IA, navigatie, flows, schermen, states, wireframes |
| `docs/DESIGN_SYSTEM.md` | — | ✓ | Principes, tokens, componenten, states, responsive, motion |
| `docs/TECHNICAL_DESIGN.md` | — | ✓ | Architectuur, datamodel, auth, acties, fouten, deployment, tests, work packages |
| `docs/ACCEPTANCE_CRITERIA.md` | — | ✓ | GEGEVEN/WANNEER/DAN per criterium |
| `docs/DECISIONS.md` | ✓ | ✓ | Uitvoeringskeuzes na de freeze |
| `docs/reviews/` | ✓ | ✓ | Rapporten per work package en agent |
| `docs/screenshots/` | ✓ | ✓ | `_capability/`, `prototype/`, `cp1` … `cp4`, `e2e/` |
| `docs/prototype/` | — | ✓ | Wireframes en visueel prototype (tijdelijk) |

## 11. Contextbehoud

Lange trajecten gaan over meerdere sessies en context-compactie heen. `docs/PROGRESS.md` is de bron van waarheid en wordt bijgewerkt na elke fase, elk work package en elk besluit. Bij de start van elke sessie injecteert de poort automatisch de status. Een nieuwe sessie leest eerst `docs/PROGRESS.md` en gaat verder bij "Volgende stap". **Besluiten worden nooit stil opnieuw geïnterpreteerd**; twijfel over een besluit is een vraag aan Jurgen.

## 12. Onderzoek op internet

Op niveau 2 en 3 wordt internetonderzoek gebruikt waar het kwaliteit verbetert: actuele framework- en bibliotheekdocumentatie, UX-patronen, browsergedrag, toegankelijkheid, security, en visuele inspiratie. Voor visuele inspiratie: meerdere hoogwaardige voorbeelden, principes destilleren, nooit een complete interface kopiëren. Jurgens voorkeur voor Apple-achtige verfijning is een kwaliteitsreferentie, geen verplichte huisstijl. Noteer bronnen in het betreffende document.

## 13. Technische poort

De poort is `.claude/gate/gate.mjs`, aangestuurd door hooks in `.claude/settings.json`. Configuratie (toegestane, beschermde en bevroren paden, agentrechten, niveausignalen) staat in `.claude/gate/gate.config.json`.

**Wat hij doet**
- **Vóór de freeze** blokkeert hij elke schrijfactie buiten `docs/**`, `CLAUDE.md`, `README.md` en `.gitignore`: via Write/Edit, maar ook via Bash (redirects, `tee`, `cp`, `mv`, `sed -i`, inline `node -e`/`python -c` met schrijfcode, zelfgeschreven scripts uit `docs/`, scaffolders, migraties, projectinstallaties). Hij geeft Claude terug waarom.
- **Altijd** beschermt hij de poort zelf, de status (`.claude/state/`), de instellingen en de drie Jurgen-opdrachten. Agents en werkwijze zijn alleen te wijzigen tijdens `/onderhoud-go`.
- **Per agent** dwingt hij de schrijfrechten uit sectie 2 af (herkend aan het agenttype in de hook-invoer).
- **Na de freeze** blokkeert hij wijzigingen aan bevroren documenten. Hij controleert bij elke schrijfactie de vingerafdruk (hash) van die documenten: zijn ze buiten de poort om gewijzigd, dan vervalt de freeze automatisch.
- **Bij elke sessiestart** zet hij de actuele status in de context.
- Het starten van een geneste Claude-sessie (`claude ...`) is geblokkeerd, zodat Claude niet zelf een "gebruikersopdracht" kan versturen.

**De drie opdrachten van Jurgen** (skills met `disable-model-invocation: true`: Claude kan ze niet zelf starten)
- `/design-go` — registreert de Design Freeze. De hook `UserPromptSubmit`/`UserPromptExpansion` draait alleen op invoer die Jurgen zelf typt. Hij controleert eerst of de verplichte documenten voor het niveau bestaan, of de plan-critic `JA` heeft gegeven en of er prototype-screenshots zijn (niveau 2/3). Ontbreekt iets, dan krijgt Jurgen de lijst te zien en wordt niets geregistreerd. `/design-go --forceer` registreert toch, met de open punten vastgelegd. `/design-go intrekken` trekt de freeze in.
- `/niveau 1|2|3 [reden]` — zet het niveau bewust vast. Verhogen na een freeze laat de freeze vervallen.
- `/onderhoud-go` — geeft 30 minuten om het agentensysteem zelf te wijzigen (alleen de hoofdsessie).

Na een wijziging aan de poort draait altijd `node .claude/gate/test-gate.mjs`. Een mislukte test betekent: terugdraaien.

## 14. Screenshot-capability

Bij het inrichten van elk project, en als de omgeving verandert: `node scripts/visual-check.mjs capability`. Dat start een browser, opent een lokale testpagina, zet twee viewports, maakt screenshots en controleert afmetingen. Daarna **moet** de hoofdsessie `docs/screenshots/_capability/capability-390x844.png` met Read openen en in `docs/PROGRESS.md` (sectie "Capabilities") noteren wat ze werkelijk ziet. Pas dan geldt screenshot-driven development als bewezen. Mislukt het, dan meldt het script **VISUAL QA GEBLOKKEERD** met oplossingen, en geldt sectie 9 voor UI-projecten.

## 15. Bestaand project onder dit systeem brengen

Voor een project dat al code heeft (zoals Klusjes & Punten, dat onder dit systeem niveau 2 is):

1. **Inventariseren** — lees de huidige implementatie, draai de bestaande tests, maak screenshots van de huidige schermen (`docs/screenshots/bestaand/`), en schrijf `docs/INVENTARIS.md`: wat er is, wat werkt, bekende gaten.
2. **Featurebouw stilzetten** — gebeurt automatisch: zonder freeze blokkeert de poort productiecode.
3. **Ontbrekende fases alsnog uitvoeren** — product, UX, visueel en architectuur, gebruikmakend van wat al bestaat en al besloten is (bijvoorbeeld een bestaand `PLAN.md`: overnemen, niet opnieuw vragen).
4. **Vergelijken** — per onderdeel: bestaande implementatie tegenover het nieuwe ontwerp, in `docs/INVENTARIS.md` onder "Behouden / Herwerken / Vervangen", met de reden.
5. **Planreview en Design Freeze** — de plan-critic beoordeelt ook de vergelijking; Jurgen geeft `/design-go`.
6. **Alleen herwerken wat aantoonbaar nodig is** — als eerste work packages.
7. **Daarna pas nieuwe productiecode.**

## 16. Eindrapport aan Jurgen

Geen technisch boekwerk. Een korte, begrijpelijke samenvatting:
- wat er gebouwd is en hoe het werkt (in een paar zinnen);
- wat de reviewers vonden en wat er hersteld is;
- wat bewust niet is gedaan, en welke open punten Jurgen heeft geaccepteerd;
- of het **echt** klaar is: GO, of eerlijk wat er nog ontbreekt (bijvoorbeeld "functioneel klaar, visueel nog niet releasewaardig" of "visual QA geblokkeerd").

De volledige rapporten blijven in `docs/reviews/`.
