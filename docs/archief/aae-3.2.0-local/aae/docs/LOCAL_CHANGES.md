# Lokale wijzigingen: AAE 3.2-local

Dit project draait een lokaal aangepaste AAE 3.1: **één GO per logisch werkpakket**. Besluit van Jurgen op 2026-09-30. Toegepast met `scripts/aae-v3.2/apply.mjs`; terugzetten met `node scripts/aae-v3.2/apply.mjs --rollback-latest` (weigert als bestanden sindsdien gewijzigd zijn). `managed.json` staat op versie `3.2.0-local`, zodat `doctor` groen blijft.

## Regels
- **R1 Eén GO per taakroute.** Het contract beschrijft vooraf het hele werkpakket: doel, aanpak, scope, risico, acceptatiecriteria, agents/reviews, migraties, test- en gitcommando's, integraties, budgetten, beslisgrenzen en eventuele merge/deploy.
- **R2 GO-envelop.** GO dekt taak-ID, fase, modus, risico, vlaggen, schrijfscope, agents, commando's, integraties, budgetplafonds en beslisgrenzen. Daarbinnen werkt de hoofdsessie zelfstandig.
- **R3 Vervolgberichten laten de GO staan.** Een gewoon bericht koppelt de actieve route van dezelfde sessie aan dat bericht. Alleen `AAE PAUZE` trekt in. De aparte gevoelige GO vervalt wel.
- **R4 Amendementen binnen de envelop houden de GO.** De runtime controleert dit (`envelopeChanges` in `runtime/core.mjs`); daarbuiten wordt de route `pending`. Bewijs mag niet stil lichter worden (criteria, controles, vlaggen, modus, agents blijven minstens gelijk) en een commando kan niet van doel wisselen; een nieuw lokaal commando binnen de envelop moet een bekend testprogramma zijn (`safeLocalArgv`).
- **R5 Herhaalbare publicatie.** Publish tot 10 runs per route, lokaal tot 20; install en destructive blijven 1. Publish wordt nooit vertrouwd over routes heen.
- **R6 Gate.** `"gate": "ready"` laat een commando (merge/deploy) pas draaien als RESULT.json READY is op de actuele route en bron.
- **R7 Beslisgrenzen.** Optioneel `decision_points` in het contract; de hoofdsessie stopt daar. Verwijderen is een materiële wijziging.
- **R8 Databasewijzigingen.** Een vooraf beschreven niet-destructieve migratie valt onder de ene GO, ook bij herhalen of corrigeren binnen hetzelfde doel. Een nieuwe GO alleen bij een niet vooraf goedgekeurde handeling met materieel meer risico, of bij een destructieve/moeilijk omkeerbare handeling (via `AAE GEVOELIG GO`).
- **R8a Overige grenzen.** Onverwachte wijziging van authenticatie, autorisatie, security of secrets; werk buiten het pakket; duidelijk hoger risico; een beslisgrens.
- **R9 Taakgrens.** Een nieuwe opdracht: eerst afronden (`close`) of herrouteren met een nieuw ID; die route vraagt zijn eigen GO. Een nieuw taak-ID kan alleen als eerste route na een gebruikersbericht (of na `AAE NIEUW`), zodat een budget niet binnen één verzoek kan worden gereset; `close` geeft het verzoek bewust niet vrij.
- **R10 Supabase-verificatie per taak** in plaats van per bericht.
- **R11 Workflow.** plan → GO → zelfstandig bouwen → testen/reviewen/herstellen → commit/push/PR → gate-merge bij READY → eindrapport.
- **R12 Mislukken is geen nieuwe GO.** Herstel, test, review, commit en push opnieuw binnen de scope tot de criteria gehaald zijn of het budget op is. Na twee identieke mislukkingen zonder bronwijziging eerst de hypothese veranderen. Een goedgekeurd lokaal commando zonder gate blijft goedgekeurd als gewijzigde bewaakte bestanden binnen de schrijfscope liggen; publish/install/destructive en gate-commando's vragen een nieuwe GO zodra een bewaakt bestand verandert.

## Gewijzigde bestanden
| Bestand | Wijziging |
|---|---|
| `runtime/core.mjs` | versie; `LOCAL_PURPOSES`; `decision_points` en `gate` in het schema; runlimieten 20/10/1 en budget 80; `commandRefs`, `commandShape`, `approveCommand`, `commandApproved`; `safeLocalArgv`; `envelopeChanges`; amendementen in `route`; vervolgbericht houdt actieve route vast |
| `runtime/runner.mjs` | goedkeuring via `commandApproved`; `assertReady` voor gate-commando's |
| `runtime/events.mjs` | Supabase-verificatie per taak; tekst bij sessiestart |
| `tests/*.test.mjs` | aangepaste verwachtingen (A11/A12, vervolgbericht, I17, sessiestarttekst) en nieuwe tests voor R3–R12 |
| `ENTRY.md` | volledige nieuwe werkinstructie voor de hoofdsessie |
| `docs/WORKFLOW.md`, `docs/COMMANDS_AND_LIMITS.md`, `docs/INTEGRATIONS.md` | aanvullingen v3.2-local |
| `templates/TASK.template.json` | veld `decision_points` |
| `examples/06-werkpakket-met-merge.json` | nieuw volledig voorbeeld |
| `docs/LOCAL_CHANGES.md` | dit bestand |

Niet gewijzigd: `CLAUDE.md`, `.claude/settings.json`, hooks, agentdefinities, `CATALOG.md`, `runtime/hook.mjs`, `runtime/cli.mjs`, `runtime/integrations.mjs`, `runtime/visual.mjs`.

## Pakketupdate samenvoegen
De officiële installer ziet de gewijzigde bestanden als lokale afwijking. Werkwijze bij een nieuwe AAE-versie:
1. `node scripts/aae-v3.2/apply.mjs --rollback-latest` (alleen als er sindsdien niets aan AAE is gewijzigd), dan de installer volgens `docs/INSTALLATION.md`;
2. daarna deze patch opnieuw beoordelen: `--selftest`, `--plan`, en pas bij een schone zelftest `--apply`. Past een fragment niet meer, dan meldt de patch welk bestand; voeg dat bewust samen in plaats van te forceren.
