# AAE 3.3 — gebouwd, getest, nog niet geïnstalleerd

Dit is het resultaat van werkpakket **AAE-V33-001**, aangepast in **AAE-V33-001B** (één GO ook voor LIGHT, GO gebonden aan werkpakket-ID + volledige envelop-hash, één simpele regel voor gevolgde bestanden) en hersteld in **AAE-V33-001C** (de blokkerende bevindingen van de onafhankelijke review van commit 5e64919, die BLOCKED bleef) en **AAE-V33-001D** (de drie blokkerende punten van de rereview van 5ba1e59, die ook BLOCKED bleef, plus drie hardeningpunten) en **AAE-V33-001E** (structurele vereenvoudiging na de BLOCKED-review van 467ecdd: SQL default-deny, extra commando's op een kleine toegestane lijst, vaste releasecriteria) en **AAE-V33-001F** (twee blokkerende punten van de review van b4f39b7: `pg_`-namen en `SHOW` zijn nooit vrije reads, en één gedeelde geheimencontrole voor Read, Grep en Glob; een brede Grep over een map met een geheim wordt bewust geweigerd). Een review telt nooit voor een nieuwere commit. Er is niets geïnstalleerd: het live systeem (`.claude/`, `CLAUDE.md`, instellingen) is ongewijzigd. Installeren en samenvoegen met `main` is het aparte werkpakket **AAE-V33-002** met een eigen GO, ná een onafhankelijke review in een aparte, read-only Claude Code-sessie (zie `REVIEW-OPDRACHT.md`).

## Wat zit erin
| Map | Inhoud |
| --- | --- |
| `payload/.claude/` | Het nieuwe systeem zelf: `aae/ENTRY.md` (25 regels aansturing), runtime, docs, voorbeelden, sjabloon, testsuite en de drie agents. |
| `installer/install.mjs` | Plan / toepassen / terugdraaien met back-up, archief van v3.2 en volledige herstelbaarheid. |
| `tests/` | Eigen controles: baseline, P3-meting, pariteitsmatrix, installer + terugdraaien, overgang van een lopende route. |
| `baseline/`, `pariteit/`, `evidence/` | Verschillenlijst v3.1→v3.2, de matrix van alle 131 v3.2-tests (+ B1 t/m B6) en het bewijs (P3, overgang met echte state). |

## Wat is er anders voor Jurgen
- **Eén `AAE GO` per werkpakket, ook voor LIGHT.** Daarna werkt Claude zelfstandig: bouwen, testen, reviewen, herstellen, vaak committen en pushen. Gewone berichten, screenshots en meldingen veranderen de goedkeuring niet.
- **Eén simpele regel:** zonder GO alleen sparren, onderzoeken en lezen, zonder wijzigingen aan gevolgde bestanden; met GO wijzigen binnen de envelop. Lokale, genegeerde administratie (state, logs, receipts) blijft vrij; gevolgde administratie (`docs/aae/PROGRESS.md`, besluiten, gevolgde notities) valt onder de GO.
- **De GO-opdracht is `AAE GO <werkpakket-ID> <korte hash van 12 tekens>`.** Een kale `AAE GO`, een verkeerd ID, een hash van een andere lengte (ook de oude van 8 tekens) of een andere hash wordt geweigerd. Het voorstel (`cli present`) toont alles wat je goedkeurt, ook extra commando's.
- **Je goedkeuring is duurzaam.** Het voorstel staat vóór de GO alleen lokaal (`proposal.json`, genegeerd). Bij de GO schrijft de bewaking als eerste actie een niet-overschrijfbare snapshot van precies de goedgekeurde envelop in de repository (`docs/aae/work/<id>/approved/`). Raak je sessie of container kwijt, dan brengt `cli recover <id>` het pakket terug als gepauzeerd; `AAE VERDER` hervat dan uitsluitend dezelfde envelop (geen nieuwe GO).
- **Je GO hoort bij precies het voorstel dat je zag.** Claude toont werkpakket-ID en een korte hash; verandert het doel, de schrijfruimte, het risico, de database/git-rechten, een hard budget, de criteria of een stopmoment, dan vervalt de GO en wordt opnieuw gevraagd. Een andere titel, een ander plan of een zacht budget niet.
- **Eerst denken, dan bouwen.** Sparren verandert niets aan de app. Een kritische productpartner bundelt alle vragen vóór de GO.
- **Drie agents in plaats van dertien**, alleen wanneer ze iets aantoonbaar toevoegen, altijd op de voorgrond.
- **Volledige agentrapporten blijven bewaard**; stille agents worden vanzelf afgestemd zonder dat Jurgen iets hoeft te herstellen.
- **Databasecontrole is default-deny en klein (`sql.mjs`).** Alleen een korte lijst bekende vormen (nieuwe tabel/index/kolom, INSERT, UPDATE met WHERE, smalle rechten, beleid) is klasse A of B; al het andere is klasse C en vraagt `AAE BEVESTIG`. Een functie, procedure of trigger (maken, wijzigen, vervangen) is altijd C, ook een onschuldige. Een functie-aanroep is alleen alleen-lezen als de exacte naam op een korte lijst van zuivere functies staat (inclusief exact `auth.uid`). Namen, schema's, overloads, herdefinities, Unicode en quotes hebben daardoor geen eigen regels meer. Bekende prijs: elke functie of trigger vraagt een bevestiging.
- **Extra commando's zijn een kleine toegestane lijst** (`node <script>`, `npm/pnpm/yarn` voor installeren en `run build|test|lint…`, git en `rm/mv/mkdir` voor destructieve stappen); al het andere (`gh`, `curl`, `npx`, wrappers, programma's met een pad) wordt geweigerd. Samenvoegen en uitrollen accepteren helemaal geen extra commando's. Een analyse zonder GO voert alleen alleen-lezen git uit, nooit tests of andere projectcode.
- **Vaste releasecriteria voor een review:** BLOCKED alleen bij een concreet, reproduceerbaar pad waarbij zonder GO of bevestiging destructief wordt geschreven, buiten het gebied wordt geschreven, wordt samengevoegd of uitgerold, of geheimen worden blootgelegd. De reviewer voert geen code uit (strikt read-only).
- **Schrijven is atomair:** de goedgekeurde snapshot en alle schrijfacties van de installer gaan via een tijdelijk bestand en een atomaire hernoeming, zodat een onderbreking nooit een half bestand achterlaat.
- **Samenvoegen is gebonden aan de exacte PR-versie** (owner, repo, branch en `expectedHeadSha` moeten overeenkomen met de remote PR-head, het READY-resultaat en de lokale branch) en uitrollen aan de READY-commit.
- **Samenvoegen en uitrollen zijn aparte, bewijsgebonden stappen.** Destructieve databasehandelingen vragen altijd een expliciete bevestiging.

## Controleren
```
node --test tools/aae-v33/tests/v33-suite.test.mjs   # de v3.3-suite (scenario's T1–T23, GO-binding GB01–GB17, bewaking, runner)
node --test tools/aae-v33/tests/eigen.test.mjs       # baseline, P3, pariteit, installer, terugdraaien, overgang
node --test tools/aae-v33/tests/ref-v32.test.mjs     # referentie: de v3.2-suite op de baseline
```
Let op: `ref-v32` bevat één omgevingsafhankelijke v3.2-test (`visual: no automatic browser…`) die faalt als Playwright toevallig is geïnstalleerd; v3.3 heeft daar een omgevingsonafhankelijke vervanger (V05, zie de matrix).

## Installeren (alleen in AAE-V33-002)
```
node tools/aae-v33/installer/install.mjs --project .            # plan
node tools/aae-v33/installer/install.mjs --project . --apply    # uitvoeren (na GO)
node tools/aae-v33/installer/install.mjs --project . --rollback .aae-backups/<id> --apply
```
`.claude/settings.json` hoeft niet te wijzigen (de hooks zijn gelijk gebleven). Zie `payload/.claude/aae/docs/INSTALLATION.md`.
