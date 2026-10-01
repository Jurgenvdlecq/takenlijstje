# AAE v3.2-local patch

Lokale aanpassing van AAE 3.1 naar "één GO per werkpakket" (regels R1–R12, zie `files/LOCAL_CHANGES.md`).

## Opbouw
- `apply.mjs`: patchprogramma (`--selftest`, `--plan`, `--apply`, `--verify`, `--rollback-latest`). Geen shell, geen netwerk.
- `edits.json`: geordende lijst operaties. Alle doelen liggen onder `.claude/aae/`.
  - `replace`: `edits/<id>.old` moet precies één keer voorkomen en wordt vervangen door `edits/<id>.new` (een afsluitende regelovergang in het fragmentbestand telt niet mee).
  - `append`: `edits/<id>.txt` wordt achteraan toegevoegd.
  - `write`: volledig bestand uit `files/`.
- De `.old`/`.new`-paren vormen samen de volledige diff van de runtime en tests.

## Veiligheid
- Vóór schrijven controleert `apply.mjs` dat elk bestaand doel nog exact gelijk is aan de hash in `.claude/aae/managed.json` (geen stille overschrijving van lokale wijzigingen) en dat nieuwe bestanden nog niet bestaan.
- `--apply` maakt eerst een back-up met `RESTORE.json` in `.aae-backups/local-<tijd>/` en draait bij een schrijffout zelf terug.
- `--rollback-latest` zet alles terug, maar weigert als een bestand na het toepassen is gewijzigd.
- `--selftest` werkt op een tijdelijke kopie buiten de repository (inclusief de beheerde agentdefinities): toepassen met dezelfde code als `--apply`, verifiëren, de volledige AAE-testsuite draaien, terugdraaien, controleren dat alles weer exact de oude inhoud heeft en dat een tweede terugdraai wordt geweigerd.
- `--plan` en `--apply` controleren ook dat alle overige beheerde bestanden nog met `managed.json` kloppen, zodat `--verify` na het toepassen niet onverwacht faalt.
- `--rollback-latest` toetst eerst alle back-upbestanden tegen `before_sha256` en schrijft pas daarna; een ontbrekende of onleesbare `RESTORE.json` geeft een duidelijke fout.
- Symbolische links worden in elk deel van het pad geweigerd (doelen, bovenliggende mappen en `managed.json`).
- `--plan`, `--selftest` en `--apply` tonen een vingerafdruk (sha256) van de hele payload; `--apply` bewaart die in `RESTORE.json`.
- Mislukt het schrijven halverwege, dan wordt alles teruggezet en krijgt `RESTORE.json` een `restored_at`. `--rollback-latest` is herhaalbaar: bestanden die al de oude inhoud hebben worden overgeslagen; alleen een derde toestand geeft een conflict.
- `.aae-backups/` staat bewust in `.gitignore`: back-ups zijn lokaal en kunnen oude instructies bevatten.

## Codecodes
| Code | Bestand | Inhoud |
|---|---|---|
| c01–c14 | `runtime/core.mjs` | versie, schema (decision_points, gate, runlimieten), commando-goedkeuring (shape/refs), envelopcontrole, amendementen in `route`, GO/VERTROUW, vervolgbericht |
| r01–r03 | `runtime/runner.mjs` | `commandApproved`, gate-controle `assertReady` |
| e01–e03 | `runtime/events.mjs` | Supabase-verificatie per taak, sessiestarttekst |
| g01–g04, i01–i02, rt01 | `tests/*.test.mjs` | aangepaste en nieuwe tests |
| w01, k01–k02, n01–n02, t01 | docs en template | documentatie v3.2-local |
