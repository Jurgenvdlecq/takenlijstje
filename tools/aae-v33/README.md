# AAE 3.3 — gebouwd, getest, nog niet geïnstalleerd

Dit is het resultaat van werkpakket **AAE-V33-001**. Er is niets geïnstalleerd: het live systeem (`.claude/`, `CLAUDE.md`, instellingen) is ongewijzigd. Installeren en samenvoegen met `main` is het aparte werkpakket **AAE-V33-002** met een eigen GO.

## Wat zit erin
| Map | Inhoud |
| --- | --- |
| `payload/.claude/` | Het nieuwe systeem zelf: `aae/ENTRY.md` (25 regels aansturing), runtime, docs, voorbeelden, sjabloon, testsuite en de drie agents. |
| `installer/install.mjs` | Plan / toepassen / terugdraaien met back-up, archief van v3.2 en volledige herstelbaarheid. |
| `tests/` | Eigen controles: baseline, P3-meting, pariteitsmatrix, installer + terugdraaien, overgang van een lopende route. |
| `baseline/`, `pariteit/`, `evidence/` | Verschillenlijst v3.1→v3.2, de matrix van alle 131 v3.2-tests (+ B1 t/m B6) en het bewijs (P3, overgang met echte state). |

## Wat is er anders voor Jurgen
- **Eén `AAE GO` per werkpakket.** Daarna werkt Claude zelfstandig: bouwen, testen, reviewen, herstellen, vaak committen en pushen. Gewone berichten, screenshots en meldingen veranderen de goedkeuring niet.
- **Eerst denken, dan bouwen.** Sparren verandert niets aan de app. Een kritische productpartner bundelt alle vragen vóór de GO.
- **Drie agents in plaats van dertien**, alleen wanneer ze iets aantoonbaar toevoegen, altijd op de voorgrond.
- **Volledige agentrapporten blijven bewaard**; stille agents worden vanzelf afgestemd zonder dat Jurgen iets hoeft te herstellen.
- **Samenvoegen en uitrollen zijn aparte, bewijsgebonden stappen.** Destructieve databasehandelingen vragen altijd een expliciete bevestiging.

## Controleren
```
node --test tools/aae-v33/tests/v33-suite.test.mjs   # de v3.3-suite (scenario's T1–T22, bewaking, runner, installer-onafhankelijk)
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
