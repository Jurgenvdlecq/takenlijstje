# AAE 3.3 — naslag

Alleen lezen als je iets precies moet weten. De korte werkwijze staat in `ENTRY.md`.

## Eén statusbron per werkpakket
`docs/aae/work/<id>/proposal.json` (het voorstel vóór de GO: lokaal en ongevolgd), `docs/aae/work/<id>/approved/<volgnr>-<hash>.json` (de duurzame, gevolgde snapshot van wat is goedgekeurd) en `docs/aae/work/<id>/state.json` (wat is er gebeurd; lokaal en ongevolgd). Niets anders is een statusbron: `docs/aae/PROGRESS.md` is een gegenereerde projectie (`cli project`), een chatbericht verandert niets.

Statussen: `PLANNING` (plan wordt klaargemaakt of heeft blokkades) → `WAITING_FOR_APPROVAL` → `EXECUTING` (activiteit: BUILDING, TESTING, WAITING_FOR_AGENT, REVIEWING, MERGING, DEPLOYING) → `READY`. Daarnaast `NEEDS_HUMAN` (wacht op een beslissing), `PAUSED`, `BLOCKED` (ook een gedeeltelijk afgerond pakket), `CANCELLED`. Er is één actief pakket per werkmap.

## Commando's van de gebruiker
Alleen de exacte tekst (hoofdletters) telt: `AAE GO`, `AAE PAUZE`, `AAE VERDER`, `AAE STATUS`, `AAE ANNULEER`, `AAE BEVESTIG`, optioneel gevolgd door een werkpakket-ID. Een GO is gebonden aan `werkpakket-ID + volledige envelop-hash`, niet aan het laatste bericht. De hash (`envelopeOf` in `core.mjs`, sha-256 over een canonieke vorm) bindt: ID, doel, fase, acceptatiecriteria, schrijfgebieden en ondersteunende categorieën (niet de gebiedsnaam), risicoklasse en -vlaggen, DB-maximum, providers, git (commit/push/merge/deploy), harde budgetten (agent hard, commando's, extern, parallel), beslisgrenzen, beslisstandaarden en extra commando's. Niet in de hash: titel, gebiedsnamen, zachte budgetten, plan (agents, commando's, leesscope, bewijsbeschrijving, productvragen) en aannames. Verzamelingen staan op volgorde en witruimte in tekst is genormaliseerd, dus JSON-volgorde of opmaak verandert de hash niet. `cli present <id>` toont ID + korte hash (eerste 12 tekens, alleen ter herkenning; een GO met een andere lengte, ook de oude van 8, wordt geweigerd) en legt de volledige hash vast als getoond; `AAE GO` keurt alleen goed als het huidige voorstel precies die hash heeft. Bij elke bewakingshandeling (schrijven, agent, runner, gates, externe wijziging, `cli project`, `cli close`) controleert `guardApproval` (via `assertApproval`) dat de goedgekeurde hash bij het goedgekeurde contract hoort én dat het huidige contract binnen die envelop valt (`materialChanges`). Klopt dat niet, dan wordt de handeling geweigerd en gaat het pakket naar `NEEDS_HUMAN`: Jurgen beslist met `cli present` + `AAE GO`. Het opslaan van een agentrapport (ontvangst door de hooks) blokkeert nooit en controleert dit dus niet; het rapport wordt bewaard en pas bij `close`/gates weegt het mee. `AAE BEVESTIG` geldt eenmalig voor de ene beschreven destructieve database-actie en vervalt bij het volgende gewone bericht.

## Contract (schema 4)
`envelope` (de gebruiker keurt dit goed):
- `phase` (`analysis` of `implementation`), `areas[]` (`name`, `write` = mappen of bestanden waarbinnen alles vrij is, `support` = vooraf goedgekeurde categorieën: `tests`, `lockfile`, `types`, `docs`).
- `db_max` (`none`, `A`, `B`), `providers` (`supabase` met `project_ref`, `tools`, `max_calls`; `github` met `tools`, `max_calls`, `base`, `head`).
- `git`: `commit`, `push` (werkbranches, nooit main), `merge` (`{"to": "..."}` of `null`), `deploy` (`none`, `verify`, `trigger`).
- `budgets`: `agent_calls` `{soft, hard}`, `command_runs`, `external_calls`, `max_parallel`.
- `acceptance`, `assumptions`, `decision_defaults`, `decision_points`, `extra_commands` (exact goedgekeurde niet-lokale commando's).
`plan` (vrij aan te passen binnen de envelop): `test_plan`, `agents`, `commands`, `read`, `open_product_questions`, `keep_raw`, `preflight`.

Een wijziging van het contract tijdens uitvoering is vrij zolang `materialChanges` niets meldt (breder gebied, hoger risico of lichter bewijs, meer database, git, budget, providers, criteria of beslisgrenzen). Anders wordt het een voorstel (`NEEDS_HUMAN`) dat een nieuwe `AAE GO` vraagt.

Risicoklasse: `LIGHT` (klein, lokaal, geen externe effecten: minder bewijs, maar wel precies één GO), `STANDARD`, `HIGH` (onafhankelijk READY-oordeel van een reviewer op de actuele bron verplicht). Autorisatie, financieel en gevoelige gegevens zijn altijd `HIGH`.

## Commando's en git
Elk commando staat in `plan.commands` (`argv`, `purpose`, `why`, `watch`, `timeout_ms`, `max_runs`) en wordt alleen via `cli run <id>` zonder shell uitgevoerd.
- Lokaal (`read`, `test`, `build`, `preview`): allowlist (bijvoorbeeld `node --test <testbestand>`, `npx vitest run`, `git status`). `node --test` accepteert nooit een map of script. In een analyse zonder GO (fase `analysis`) bestaat de lijst alleen uit alleen-lezen git (`git status`, `git log`, `git diff` en `git show` alleen met `--stat` of `--name-only`, `git rev-parse`, `git merge-base`): nooit `node --test`, `npx vitest/playwright/eslint/tsc` of een extra commando; dat wordt bij het opstellen, bij de automatische start en vlak vóór uitvoering geweigerd. `git diff` en `git show` accepteren geen operand met `:`, een pad met `..` of een beginnende `/`, dus geen `.env` of ander geheim bestand.
- `commit`: alleen `git add -A -- <toegestane paden>` en `git commit -m <tekst>`.
- `push`: alleen naar een branch uit `git.push`, geen force, geen refspec, nooit main.
- `merge`: alleen `git push origin <werkbranch>:<doel>` met doel uit `git.merge`; vereist READY-bewijs op de actuele bron; naar een branch die (mogelijk) automatisch uitrolt ook `git.deploy` ≠ `none`.
- `install`, `destructive`: eenmalig (`max_runs` 1), exact in `extra_commands`, aan een vingerafdruk van argv en bronnen gebonden; een wijziging daarvan vraagt een nieuwe GO.
- `deploy` bestaat niet als commando: uitrollen loopt uitsluitend via de deploy-capability (`git.deploy`) en haar gate, bijvoorbeeld via de merge naar een automatisch uitrollende branch. `merge` en `deploy` accepteren helemaal geen `extra_commands`.
- Extra commando's (`extra_commands` en commando's buiten de allowlist) kennen één kleine toegestane lijst (`extraRefusal` in `core.mjs`, bij het valideren van de envelop én vlak vóór uitvoering, voor elk doel dezelfde functie): `node <relatief scriptbestand>` (elk lokaal doel, `install`, `destructive`); `npm/pnpm/yarn install|ci|add|remove|update` (alleen `install`) en `run <build|test|lint|typecheck|check|format|preview[:variant]>` of `test`/`build` (lokale doelen); git met een vast subcommando en een vaste vlaggenlijst (alleen `destructive`); `rm`/`mv` (alleen `destructive`) en `mkdir` (`build` of `destructive`) met relatieve paden zonder `..`, `.git` of jokertekens. Al het andere wordt geweigerd: er is geen denylist van programma's of wrappers meer, dus een onbekend programma, een wrapper (`env`, `sh`, `xargs`…), `npx` of een programma met een pad kan nooit een extra commando zijn. Een nieuw programma toevoegen is een bewuste codewijziging. Een goedgekeurd projectscript blijft projectcode: de bewaking is geen sandbox.
Twee identieke mislukte pogingen zonder bronwijziging worden geweigerd (verander de hypothese).

## Bewijs en READY
`cli report-template` geeft de actuele envelop- en bronhash. Vul `result.json` met criteria en controles; `command`-bewijs moet een geslaagde receipt op de actuele bron zijn. `cli close` valideert alles. READY betekent nooit gedeployed.

## Agents
`aae-product-partner`, `aae-architect`, `aae-reviewer` (focus). Voorgrond, één tegelijk (standaard), nooit resume. Elke aanroep begint met `WAAROM-AGENT:`. Een identieke vraag naast een lopende of na een niet afgeronde run wordt geweigerd. Soft plafond: bespreek; hard plafond: stop.

Rapporten in lagen: laag 0 volledige tekst in `.claude/aae/state/raw/<id>/` (niet in git, met checksum; ruwe laag verdwijnt 7 dagen na READY via `cli prune`), laag 1 samenvatting ≤ 4 KB in `docs/aae/work/<id>/runs/` (in git), optioneel `keep_raw` (≤ 64 KB per run, ≤ 512 KB per pakket) in `docs/aae/work/<id>/raw/`. Bronnen: `tool_response.content`, het transcript van de agent (op agent-id, onder de Claude-map) en de staart van `last_assistant_message`. Een run is `COMPLETED` als minstens twee bronnen overeenkomen; `REPORT_UNVERIFIED` bij één bron, `REPORT_CONFLICT` bij verschil, `REPORT_LOST` als opslag mislukt (wordt vanzelf hersteld uit het transcript).

Afstemming (`cli reconcile`, ook automatisch bij sessiestart): tijd is alleen aanleiding. Een agent die ≥ 15 minuten stil is, wordt `unverified`. Pas bij een stilstaand transcript over twee metingen én (host kent hem niet meer of onderbrekingshint) of een plafond van 60 minuten wordt hij `presumed_dead`. Late resultaten worden altijd nog verwerkt.

## Database
De classificatie (`sql.mjs`, ongeveer 100 regels) is **default-deny**: een statement is A of B alleen als het precies op één vorm uit een korte tabel past, al het andere is **C**. Er is geen poging om SQL of functies te begrijpen.
- **A** (additief): `CREATE TABLE/INDEX/VIEW/SCHEMA`, `ALTER TABLE … ADD COLUMN` of `ENABLE ROW LEVEL SECURITY` (één actie), `COMMENT ON`, `BEGIN`/`COMMIT`.
- **B** (middel): `INSERT INTO`, `UPDATE` met een WHERE op hoofdniveau (niet `true`/`1 = 1`), `CREATE/ALTER POLICY` (niet `USING (true)`), `CREATE OR REPLACE VIEW`, een smalle `GRANT/REVOKE SELECT|INSERT|UPDATE|DELETE ON <tabel> TO|FROM <rol>` (niet `PUBLIC`, geen `GRANT OPTION`), `ALTER TABLE … ADD CONSTRAINT | ALTER COLUMN … SET NOT NULL/DEFAULT | RENAME` (één actie).
- **C** (alles anders, stopt altijd en wacht op `AAE BEVESTIG`): onder meer DROP, DELETE, TRUNCATE, MERGE, COPY, SET, rollen en rechten buiten de smalle vorm, cron, `net.http`, een tabelverwijzing naar `auth`/`vault`/`net`/`cron`, en statements die niet te lezen zijn.
- **Functies, procedures, triggers en vergelijkbare uitvoerbare objecten** (CREATE/ALTER/DROP FUNCTION, PROCEDURE, TRIGGER, RULE, OPERATOR, AGGREGATE, CAST, EXTENSION, DO, CALL, EXECUTE) zijn altijd C, zonder uitzondering en zonder te kijken naar de body.
- **Aanroepen:** een functieaanroep telt alleen als zuiver als de exacte naam op `PURE_FUNCTIONS` staat (kleine lijst, inclusief exact `auth.uid`, `auth.jwt` en `auth.role`). Een andere naam, een ander schema, een geciteerde of niet-ASCII naam, of een andere functie uit `auth` is nooit zuiver: in een migratie C, via `execute_sql` een wijziging. Namen worden nooit bijgehouden, vergeleken of afgeleid.
- `execute_sql` is alleen read-only voor één `SELECT/SHOW/EXPLAIN/VALUES/WITH` zonder schrijfwoorden en met uitsluitend zuivere aanroepen; al het andere is een wijziging en hoort via `apply_migration` met een naam. A en B volgen `db_max`.
Geaccepteerde false positives: elke functie, procedure of trigger (ook onschuldig) en elke onbekende functieaanroep vraagt `AAE BEVESTIG` of een migratie; `REFERENCES auth.users` en andere verwijzingen naar gevoelige schema's zijn C; een `ALTER TABLE` met meer dan één actie, `CREATE TYPE/SEQUENCE` en een kale `SELECT` in een migratie zijn C. Bekende grenzen (geen blokkeerpunt voor een review): of een WHERE selectief is wordt niet beoordeeld (B geeft dat vrij binnen `db_max`); `USING (1 = 1)` is geen `USING (true)`; operators, casts en triggers die eerder met C zijn goedgekeurd draaien impliciet mee.

## Preflight en deploy-detectie
`cli preflight <id>` controleert tools, netwerk, configuratienamen (geen waarden), fixtures en branch, en legt vast of een doelbranch automatisch uitrolt (`docs/aae/project.json`). Onbekend telt als automatisch. Wat alleen de gebruiker kan oplossen, wordt in één keer gebundeld gemeld.

## Beperkingen
Lokale workflowbewaking, geen OS-sandbox: goedgekeurde projectcommando's zijn krachtige code. Geen tegoed- of tokenmeting. Hooks van het hostproduct, globale en managed instellingen kunnen aanvullend gelden. Er is geen Stop-hook.
