# Adaptive Agent Environment 3.1

## Voor subagents
Ben je een `aae-*` subagent? Voer alleen je afgebakende read-only werkpakket uit. Start geen router of andere agent. De onderstaande orchestration is voor de hoofdsessie, niet voor jou. Bestaande projectspecifieke veiligheidsregels blijven gelden.

Start Claude Code normaal, niet met `--agent aae-supervisor`. De supervisor is een specialistische subrol, niet een vervangende hoofdsessie.

## Voor de hoofdsessie
Doel: maximale relevante kwaliteit, zo min mogelijk overbodig werk. De gebruiker bepaalt de gewenste uitkomst; jij kiest automatisch de benodigde expertise. Geen vaste agentketen.

1. Begrijp eerst wat gevraagd is: uitleg, analyse, ontwerp of implementatie. Een analyseverzoek is nooit stilzwijgende bouwtoestemming. Geef alleen de belangrijkste onzekerheden terug.
2. Gebruik bestaande context en hoogstens enkele gerichte bronnen. Lees `docs/aae/PROGRESS.md` en het compacte projectprofiel als relevant. Geen automatische repositoryscan bij sessiestart/installatie.
3. Duidelijke kleine taak: routeer zelf. Nieuw/ondoorzichtig/risicovol werk: hoogstens eenmaal de `aae-supervisor` met een compacte context. De supervisor adviseert; jij registreert en voert uit. Catalogus alleen lezen als selectie nodig is.
4. Maak een ingevuld JSON-contract in `docs/aae/TASK.json` met de vorm uit `templates/TASK.template.json`. Gebruik een nieuw uniek ID per echte nieuwe gebruikersopdracht; niet om een budget te resetten. Alleen `Write` voor dit bestand.
5. Voer `node .claude/aae/runtime/cli.mjs route` uit. Vat de route in hoogstens vijf regels samen: doel/fase, agents, testdiepte, grens, wat wordt overgeslagen. `pending` betekent: stop en vraag exact `AAE GO` na de toelichting. `active` betekent: werk zelfstandig binnen de route.
6. Bouw alleen de kleinste bruikbare wijziging. Geen bijvangstfixes of infrastructuur voor later. Leg noodzakelijke scope-uitbreiding eerst in een nieuwe route vast. Nieuwe belangrijke UX: werk eerst de keuze en criteria uit en zet `design_freeze: true` voor implementatie. Kleine bekende aanpassing hoeft geen uitgebreide ontwerpronde.
7. Gebruik uitsluitend geselecteerde `aae-*` agents. Geef concrete vraag, relevante feiten/bronnen, bestaand bewijs en stopcriterium mee. De hook voegt het gezaghebbende werkpakket toe en kiest het route-model. Expliciet `run_in_background: false`. Wacht op de betreffende agent; de host kan achtergrondgedrag hebben en slots blijven dan gereserveerd. Geen nesting/agentteams/Explore/Plan/skill als omweg.
8. Een beperking betekent geen aanleiding om in een lus dezelfde poging te doen. Maximaal een gerichte correctie met nieuwe informatie; anders uitleggen wat blokkeert. Budget telt ook supervisor, mislukte toegestane starts en hervattingen. Een nieuwe route wist verbruik niet.
9. Laat geen code veranderen terwijl een reviewer of test loopt. Hergebruik een agentcontext alleen als route en bronversie gelijk zijn. Anders nieuwe gerichte vraag binnen het resterende budget.
10. Externe integraties: onbekende MCP/tools blijven geblokkeerd. Voor Supabase en GitHub-PR gebruikt v3.1 alleen de smalle regels uit `docs/INTEGRATIONS.md`. Read-only Supabase-checks tellen als extern toolbudget, niet als agents. `apply_migration` en PR-aanmaak vereisen routegoedkeuring; muterende `execute_sql` is geen normale snelweg. Secrets nooit in chat/logs/receipts.
11. Voor commandos: declareer exacte `argv`, reden, risico/doel, relevante scripts/config in `watch`, timeout en maximum aantal runs. Geen vrije Bash/PowerShell, pipelines, `cd`, `npm`-scripts of remote tools buiten de runner. Voer alleen `node .claude/aae/runtime/cli.mjs run <id>` uit. De runner gebruikt geen shell. Goedgekeurde projectprogramma's zijn nog steeds krachtige code, geen sandbox.
12. Nieuwe commandoversies vragen GO. Voor bewezen lokale test/buildcommands kan de gebruiker na GO eenmalig `AAE VERTROUW` geven; dezelfde fingerprint mag daarna worden hergebruikt. Geen publicatie/destructieve acties vertrouwen. Gewijzigde scripts/config vragen nieuwe goedkeuring. Inspecteer wat je als testcommand voorstelt.
13. Test op risico en bewijskracht, niet op het aantal tests. Een snelle brede suite kan doelmatiger zijn dan moeilijk testselecteren. Houd output klein; gebruik de runnerreceipts. Geen standaard honderden browserchecks, brede audits of afzonderlijke testagent voor een simpele wijziging.
14. Basisveiligheid, toegankelijkheid, foutafhandeling en regressiecontrole horen waar relevant bij het bouwen. High Assurance heeft verplichte bewijssoorten en een actueel onafhankelijk oordeel, maar geen volledig agentleger.
15. Gebruik `report-template` voor de actuele route-/bronhash. Vul `docs/aae/RESULT.json` in met bewijs en `READY`, `PARTIAL` of `BLOCKED`. `node .claude/aae/runtime/cli.mjs close` valideert de administratie. Maak een nieuwe hash nooit ter vervanging van opnieuw nodig bewijs. Een testontwerp is niet uitgevoerd; een screenshot is geen interactietest; READY betekent niet gedeployed.
16. Rond kort af: gedaan, bewezen/gecontroleerd, niet gecontroleerd, resterende blocker. Geen lange werklogboeken. Noem geen geschat Max-percentage, besparingspercentage of werkelijk model zonder beschikbare observatie.

## Zelfstandigheid met grenzen
Werk zelfstandig binnen de route. Geen toestemming voor iedere file-read of reguliere stap. Vraag wel bij belangrijke productkeuze, nieuwe risicovolle handeling, uitbreiding van goedgekeurde scope/budget of ontbrekend essentieel bewijs. Gebruik nooit `bypassPermissions` en schakel hooks niet uit om verder te kunnen.

## Stop/hervat
`AAE PAUZE` trekt vrijgave in. Het annuleert geen al gestart OS-proces: stop eerst lopend werk. `AAE VERDER` hervat dezelfde ongewijzigde taak zonder budgetreset. `AAE HERSTEL` mag alleen nadat de gebruiker bevestigd heeft dat lopende processen gestopt zijn; het ruimt registraties op, niet verbruik. `AAE NIEUW` is een expliciete nieuwe opdrachtgrens, geen automatische uitweg bij budgettekort.

Bij een gewone nieuwe gebruikersvraag is oude bouwtoestemming niet opnieuw geldig. Herrouteer passend. Een expliciete pauze mag niet door eigen herroutering verdwijnen.

## Lees details alleen wanneer nodig
- `docs/WORKFLOW.md`: kwaliteitsondergrens, risicorouting en besluitmomenten.
- `docs/COMMANDS_AND_LIMITS.md`: commando's, vertrouwen, telemetry, hard versus soft.
- `docs/INTEGRATIONS.md`: Supabase/GitHub-PR, projectbinding, externe budgetten en gevoelige acties.
- `docs/VISUAL_CHECKS.md`: veilige ingelogde screenshots en interactiebewijs.
- `docs/LIVE_CHECK.md`: eenmalige praktijktest in een wegwerpproject.
- `docs/INSTALLATION.md`: veilig bijwerken en terugdraaien.
