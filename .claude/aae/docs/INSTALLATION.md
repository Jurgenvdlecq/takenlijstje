# Installatie, overgang en terugdraaien

Gebruik `tools/aae-v33/installer/install.mjs`. Standaard toont hij alleen een **plan**; `--apply` voert uit. Geen netwerk, geen git, geen appbuild, geen agentstart.

```sh
node tools/aae-v33/installer/install.mjs --project .            # plan
node tools/aae-v33/installer/install.mjs --project . --apply    # uitvoeren
node tools/aae-v33/installer/install.mjs --project . --rollback .aae-backups/<id>          # plan
node tools/aae-v33/installer/install.mjs --project . --rollback .aae-backups/<id> --apply  # terugdraaien
```

## Wat er gebeurt
1. Controle: een bestaande v3.1- of v3.2-installatie is onveranderd (hashes uit `.claude/aae/managed.json`), geen symlinks, geen lopende lock, Node ≥ 20. Een gewijzigd beheerd bestand geeft een conflict, geen stil verlies.
2. Back-up in `.aae-backups/<id>/` (blobs met mode en `RESTORE.json` met voor/na-hashes) en een leesbaar archief van de vorige versie in `docs/archief/aae-<oude versie>/`.
3. De dertien oude `aae-*` agents en de oude docs, voorbeelden en tests worden vervangen door de v3.3-bestanden (drie agents). `.claude/settings.json` (de hooks zijn gelijk gebleven), `CLAUDE.md` en de map `.claude/aae/state/` blijven ongemoeid.
4. Het nieuwe beheermanifest `.claude/aae/managed.json` (versie 3.4.0) en een controle: de runtime laadt en `doctor` slaagt.

## Lopende route
Een lopende, goedgekeurde v3.2-route (`docs/aae/TASK.json` + `.claude/aae/state/local.json`) wordt bij het eerste hook-event overgenomen als v3.3-werkpakket, met behoud van verbruik, receipts en agentregistraties, maar nooit stil goedgekeurd: het pakket wacht op een expliciete `cli present` en `AAE GO <id> <korte hash van 12 tekens>` (eenmalige migratiegrens). Past het contract niet, dan wordt het werkpakket zichtbaar `BLOCKED` (nooit stil kwijt). De v3.2-bestanden blijven staan; terugdraaien zet de v3.2-regels terug op het punt van installeren. Voortgang daarna staat alleen in `docs/aae/work/<id>/state.json`.

## Terugdraaien
Elke schrijfactie van de installer (programmabestanden, back-upblobs, `RESTORE.json`, `.gitignore`, terugzetten) is atomair: tijdelijk bestand in dezelfde map, fsync, hernoemen. Een onderbreking (kill, stroomuitval) laat daardoor nooit een half bestand achter; `RESTORE.json` (status `in_progress`) staat al vóór de eerste wijziging op schijf en `--rollback` zet na elke onderbreking alles terug en ruimt tijdelijke restjes (`.aae-tmp-*`) op. `--rollback` weigert gewijzigde bestanden te overschrijven. Het is geen databasebackup en geen terugdraaiactie van appwijzigingen. Sluit Claude eerst, zodat geen ander proces tegelijk dezelfde bestanden wijzigt.

## Na installatie
Start een nieuwe sessie en controleer met `/hooks` en `/agents` dat alleen de drie `aae-*` agents bestaan. `node .claude/aae/runtime/cli.mjs doctor` controleert integriteit; hij start geen model en claimt geen live gedragstest. Een achtergebleven lock na een harde crash wordt niet automatisch gestolen: controleer de PID in `.claude/aae/state/lock/owner.json`.
