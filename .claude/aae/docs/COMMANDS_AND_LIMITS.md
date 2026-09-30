# Uitvoering, grenzen en gebruik

## Gewoon taalgebruik blijft de ingang
De gebruiker geeft normaal een gewone opdracht. De hoofdsessie maakt de route. Alleen echte goedkeurings-/herstelmomenten gebruiken eenvoudige tekstcommando's als apart bericht (geen slash-skill nodig):

| Tekst | Effect |
|---|---|
| `AAE GO` | Keurt alleen de gepresenteerde actuele route, commands en normale externe wijzigingen goed. |
| `AAE GEVOELIG GO <taak-id>` | Tweede, routegebonden toestemming voor exact geplande gevoelige/destructieve Supabase-acties. |
| `AAE PAUZE` | Trekt de vrijgave in. Annuleert geen reeds gestarte OS-processen. |
| `AAE VERDER` | Hervat dezelfde ongewijzigde taak, ook na sessiewissel; budget blijft bestaan. Na expliciete pauze blijft een nieuwe GO nodig. |
| `AAE VERTROUW` | Eenmalig vertrouwen van de lokale test/build/read/previewcommandoversies uit een expliciet goedgekeurde route. |
| `AAE HERSTEL` | Alleen nadat echte processen gestopt zijn: ruim onzekere agent-/commandoregistraties op, zonder budgetreset. Taak blijft gepauzeerd. |
| `AAE NIEUW` | Expliciete nieuwe opdrachtgrens. Niet door de assistent verzinnen om een limiet te omzeilen. |
| `AAE STATUS` | Korte administratie van fase, limieten en actieve registraties. |

GO kan optioneel het taak-ID vermelden: `AAE GO AUTH-001`. Een geciteerd GO in een lang bericht wordt niet als toestemming behandeld. Zonder prompt_id worden afzonderlijke prompts niet op sessie-ID gededupliceerd.

## Toegestane runnerinterface
Vanuit projectroot: `node .claude/aae/runtime/cli.mjs route`, `status`, `doctor`, `report-template`, `close`, `run <command-id>` of `packet <agentnaam>`.
Geen algemene shellparser. De hook accepteert alleen deze exacte runnerinterface voor Bash en PowerShell. Pipelines, herleidingen, inline scripts, cd-ketens en vrije npm-opdrachten worden niet als zogenaamd veilig geclassificeerd.

Projectcommands staan als executable plus losse argumenten in TASK.json en draaien met `shell:false`, vanuit projectroot. Voorbeeld: `["npm", "run", "test", "--", "tests/task.test.ts"]`. Controleer wat het script doet, zet de betrokken script-/testconfigbestanden in `watch`. Package-/lockbestanden worden aanvullend gefingerprint.

Nieuwe commands vereisen GO. De gebruiker kan ongewijzigde lokale commands via VERTROUW herbruikbaar maken. Publicatie, installatie en destructieve commands blijven routegebonden en worden niet herbruikbaar vertrouwd. Gebruik voor zulke acties zeer beperkte scope en hoogstens een uitvoering; geen wildcardtoestemming.

## Grenzen die technisch gecontroleerd worden
Geldige JSON-route; geen template als toestemming; taak-/routebinding van GO; expliciete pauze; toepasselijke bronpaden zonder symlinks; directe schrijfrechten; agent-allowlist; reservering voordat Agent/Task start; totalen inclusief mislukte starts en resumes; parallel slots; fase; runlimieten; actuele commandsignatuur; bewijsverwijzingen en bronhash bij sluiten.

Budgettellers worden lokaal atomisch met een proceslock bijgewerkt. Eén werkmap heeft één actieve eigenaar. Gebruik geen meerdere Claude-sessies/bouwers op dezelfde werkmap. Herstel wist geen verbruik. Agentteams en niet-geclassificeerde MCP/Skill-tools zijn standaard geblokkeerd. V3.1 heeft uitsluitend smalle adapters voor de expliciet gedocumenteerde Supabase-acties en GitHub `create_pull_request`; onbekende tools blijven geblokkeerd. Externe calls hebben een apart budget en receipts zonder ruwe resultaten.

## Grenzen die niet hard gegarandeerd zijn
Een hook is geen OS-sandbox. Een eenmaal goedgekeurd projectprogramma kan bestanden/netwerk/childprocessen gebruiken onder jouw account. Transitive imports zijn niet volledig in de watchhash gevangen. Hookuitval door bijvoorbeeld ontbrekende Node, uitgeschakelde hooks, globaal/managed beleid of een toekomstige incompatibele CLI kan buiten de controle van dit script vallen. Doctor en de live-check zijn daarom nodig.

Natuurlijke taal wordt door het model geclassificeerd; de code kan niet zelf bewijzen dat die classificatie jouw bedoeling goed weergeeft. Toon daarom een korte route voor substantieel werk. Het systeem is geen bescherming tegen een kwaadwillende eigenaar die zelf bestanden, toestemming of hooks verandert.

## Werkelijk gebruik versus schatting
De administratie registreert toegestane agentaanroepen, aangevraagde modellen, rollen, runs en waar beschikbaar door de host gerapporteerd model en duur. Een `totalTokens`/`usage`-veld van Agent kan alleen de laatste modelrequest beschrijven, niet het totaal van een hele agent. Dit pakket telt het niet op alsof het een volledig verbruikscijfer is.

Het hoofdsessiemodel wordt niet heimelijk gewijzigd. Agentfrontmatter heeft model en maxTurns; de route kan de ondersteunde modelalias aanpassen. Beschikbaarheid en hostoverrides verschillen. Geen niet-gemeten claims over tokens, euro's of resterend Max-tegoed. Gebruik Claude's eigen gebruiksoverzicht voor jouw abonnement.

## Lokale opslag
State, commandologs, receipts en backups zijn lokaal en in .gitignore gezet. Commandologs kunnen gevoelige uitvoer bevatten: gebruik fixtures, log geen secrets en deel de lokale state/backups niet publiek. Logoutput is begrensd; de hoofdsessie ontvangt alleen een korte staart. Er is geen cloudtelemetrie of netwerkverbinding in de runtime zelf.
