# AAE 3.3 — naslag

Alleen lezen als je iets precies moet weten. De korte werkwijze staat in `ENTRY.md`.

## Eén statusbron per werkpakket
`docs/aae/work/<id>/contract.json` (wat is afgesproken) en `docs/aae/work/<id>/state.json` (wat is er gebeurd). Niets anders is een statusbron: `docs/aae/PROGRESS.md` is een gegenereerde projectie (`cli project`), een chatbericht verandert niets.

Statussen: `PLANNING` (plan wordt klaargemaakt of heeft blokkades) → `WAITING_FOR_APPROVAL` → `EXECUTING` (activiteit: BUILDING, TESTING, WAITING_FOR_AGENT, REVIEWING, MERGING, DEPLOYING) → `READY`. Daarnaast `NEEDS_HUMAN` (wacht op een beslissing), `PAUSED`, `BLOCKED` (ook een gedeeltelijk afgerond pakket), `CANCELLED`. Er is één actief pakket per werkmap.

## Commando's van de gebruiker
Alleen de exacte tekst (hoofdletters) telt: `AAE GO`, `AAE PAUZE`, `AAE VERDER`, `AAE STATUS`, `AAE ANNULEER`, `AAE BEVESTIG`, optioneel gevolgd door een werkpakket-ID. Een GO is gebonden aan het werkpakket en zijn envelop, niet aan het laatste bericht. `AAE BEVESTIG` geldt eenmalig voor de ene beschreven destructieve database-actie en vervalt bij het volgende gewone bericht.

## Contract (schema 4)
`envelope` (de gebruiker keurt dit goed):
- `phase` (`analysis` of `implementation`), `areas[]` (`name`, `write` = mappen of bestanden waarbinnen alles vrij is, `support` = vooraf goedgekeurde categorieën: `tests`, `lockfile`, `types`, `docs`).
- `db_max` (`none`, `A`, `B`), `providers` (`supabase` met `project_ref`, `tools`, `max_calls`; `github` met `tools`, `max_calls`, `base`, `head`).
- `git`: `commit`, `push` (werkbranches, nooit main), `merge` (`{"to": "..."}` of `null`), `deploy` (`none`, `verify`, `trigger`).
- `budgets`: `agent_calls` `{soft, hard}`, `command_runs`, `external_calls`, `max_parallel`.
- `acceptance`, `assumptions`, `decision_defaults`, `decision_points`, `extra_commands` (exact goedgekeurde niet-lokale commando's).
`plan` (vrij aan te passen binnen de envelop): `test_plan`, `agents`, `commands`, `read`, `open_product_questions`, `keep_raw`, `preflight`.

Een wijziging van het contract tijdens uitvoering is vrij zolang `materialChanges` niets meldt (breder gebied, hoger risico of lichter bewijs, meer database, git, budget, providers, criteria of beslisgrenzen). Anders wordt het een voorstel (`NEEDS_HUMAN`) dat een nieuwe `AAE GO` vraagt.

Risicoklasse: `LIGHT` (klein, lokaal, geen externe effecten: geen apart GO-moment), `STANDARD`, `HIGH` (onafhankelijk READY-oordeel van een reviewer op de actuele bron verplicht). Autorisatie, financieel en gevoelige gegevens zijn altijd `HIGH`.

## Commando's en git
Elk commando staat in `plan.commands` (`argv`, `purpose`, `why`, `watch`, `timeout_ms`, `max_runs`) en wordt alleen via `cli run <id>` zonder shell uitgevoerd.
- Lokaal (`read`, `test`, `build`, `preview`): allowlist (bijvoorbeeld `node --test <testbestand>`, `npx vitest run`, `git status`). `node --test` accepteert nooit een map of script.
- `commit`: alleen `git add -A -- <toegestane paden>` en `git commit -m <tekst>`.
- `push`: alleen naar een branch uit `git.push`, geen force, geen refspec, nooit main.
- `merge`: alleen `git push origin <werkbranch>:<doel>` met doel uit `git.merge`; vereist READY-bewijs op de actuele bron; naar een branch die (mogelijk) automatisch uitrolt ook `git.deploy` ≠ `none`.
- `deploy`, `install`, `destructive`: eenmalig (`max_runs` 1), exact in `extra_commands`, aan een vingerafdruk van argv en bronnen gebonden; een wijziging daarvan vraagt een nieuwe GO.
Twee identieke mislukte pogingen zonder bronwijziging worden geweigerd (verander de hypothese).

## Bewijs en READY
`cli report-template` geeft de actuele envelop- en bronhash. Vul `result.json` met criteria en controles; `command`-bewijs moet een geslaagde receipt op de actuele bron zijn. `cli close` valideert alles. READY betekent nooit gedeployed.

## Agents
`aae-product-partner`, `aae-architect`, `aae-reviewer` (focus). Voorgrond, één tegelijk (standaard), nooit resume. Elke aanroep begint met `WAAROM-AGENT:`. Een identieke vraag naast een lopende of na een niet afgeronde run wordt geweigerd. Soft plafond: bespreek; hard plafond: stop.

Rapporten in lagen: laag 0 volledige tekst in `.claude/aae/state/raw/<id>/` (niet in git, met checksum; ruwe laag verdwijnt 7 dagen na READY via `cli prune`), laag 1 samenvatting ≤ 4 KB in `docs/aae/work/<id>/runs/` (in git), optioneel `keep_raw` (≤ 64 KB per run, ≤ 512 KB per pakket) in `docs/aae/work/<id>/raw/`. Bronnen: `tool_response.content`, het transcript van de agent (op agent-id, onder de Claude-map) en de staart van `last_assistant_message`. Een run is `COMPLETED` als minstens twee bronnen overeenkomen; `REPORT_UNVERIFIED` bij één bron, `REPORT_CONFLICT` bij verschil, `REPORT_LOST` als opslag mislukt (wordt vanzelf hersteld uit het transcript).

Afstemming (`cli reconcile`, ook automatisch bij sessiestart): tijd is alleen aanleiding. Een agent die ≥ 15 minuten stil is, wordt `unverified`. Pas bij een stilstaand transcript over twee metingen én (host kent hem niet meer of onderbrekingshint) of een plafond van 60 minuten wordt hij `presumed_dead`. Late resultaten worden altijd nog verwerkt.

## Database
Klasse **A** additief (nieuwe tabel, kolom, index, beleid), **B** middel (backfill met WHERE, constraint, security definer, grants, cron, onbekend statement), **C** destructief (DROP, TRUNCATE, DELETE, UPDATE zonder WHERE, RLS uit, auth/vault, typewijziging). A en B volgen `db_max`; C stopt altijd vóór uitvoering en wacht op `AAE BEVESTIG`. Muterende `execute_sql` is niet toegestaan; gebruik `apply_migration` met een naam.

## Preflight en deploy-detectie
`cli preflight <id>` controleert tools, netwerk, configuratienamen (geen waarden), fixtures en branch, en legt vast of een doelbranch automatisch uitrolt (`docs/aae/project.json`). Onbekend telt als automatisch. Wat alleen de gebruiker kan oplossen, wordt in één keer gebundeld gemeld.

## Beperkingen
Lokale workflowbewaking, geen OS-sandbox: goedgekeurde projectcommando's zijn krachtige code. Geen tegoed- of tokenmeting. Hooks van het hostproduct, globale en managed instellingen kunnen aanvullend gelden. Er is geen Stop-hook.
