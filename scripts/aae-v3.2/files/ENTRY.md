# Adaptive Agent Environment 3.2-local

Lokale aanpassing van AAE 3.1: één GO per logisch werkpakket. Zie `docs/LOCAL_CHANGES.md` voor de verschillen met het pakket.

## Voor subagents
Ben je een `aae-*` subagent? Voer alleen je afgebakende read-only werkpakket uit. Start geen router of andere agent. De onderstaande orchestration is voor de hoofdsessie, niet voor jou. Bestaande projectspecifieke veiligheidsregels blijven gelden.

Start Claude Code normaal, niet met `--agent aae-supervisor`. De supervisor is een specialistische subrol, niet een vervangende hoofdsessie.

## Voor de hoofdsessie
Doel: maximale relevante kwaliteit, zo min mogelijk overbodig werk en zo min mogelijk onderbrekingen. De gebruiker bepaalt de gewenste uitkomst; jij kiest automatisch de benodigde expertise. Geen vaste agentketen.

Werkwijze per werkpakket: plan → één `AAE GO` → zelfstandig uitvoeren → testen/reviewen/herstellen → commit/push/PR → eventueel vooraf goedgekeurde merge/deploy → eindrapport.

1. Begrijp eerst wat gevraagd is: uitleg, analyse, ontwerp of implementatie. Een analyseverzoek is nooit stilzwijgende bouwtoestemming. Geef alleen de belangrijkste onzekerheden terug.
2. Gebruik bestaande context en hoogstens enkele gerichte bronnen. Lees `docs/aae/PROGRESS.md` en het compacte projectprofiel als relevant. Geen automatische repositoryscan bij sessiestart/installatie.
3. Duidelijke kleine taak: routeer zelf. Nieuw/ondoorzichtig/risicovol werk: hoogstens eenmaal de `aae-supervisor` met een compacte context. De supervisor adviseert; jij registreert en voert uit. Catalogus alleen lezen als selectie nodig is.
4. Maak vooraf één volledig contract in `docs/aae/TASK.json` voor het hele logische werkpakket (vorm: `templates/TASK.template.json`, voorbeeld: `examples/06-werkpakket-met-merge.json`): doel en aanpak, scope, risico en vlaggen, acceptatiecriteria, agents/reviews, benoemde databasewijzigingen, test-, build- en gitcommando's, integraties (Supabase, GitHub-PR), budgetten met ruimte voor herstelrondes, `decision_points` (menselijke beslisgrenzen) en of merge/deploy naar main erbij hoort (commando met `"gate": "ready"`). Nieuw uniek ID per echte nieuwe gebruikersopdracht; niet om een budget te resetten. Alleen `Write` voor dit bestand.
5. Voer `node .claude/aae/runtime/cli.mjs route` uit en vat het plan kort samen voor de gebruiker: doel/fase, aanpak, agents, testdiepte, databasewijzigingen, merge/deploy ja of nee, beslisgrenzen, wat wordt overgeslagen. `pending` betekent: stop en vraag één keer om exact `AAE GO` als los bericht. `active` betekent: werk zelfstandig binnen de route.
6. **Eén GO per werkpakket.** Na GO voer je de volledige route zelfstandig uit zonder tussentijds opnieuw GO te vragen: code en bestanden wijzigen, geselecteerde agents inzetten, testen, fouten herstellen en opnieuw testen en reviewen, vooraf beschreven niet-destructieve migraties toepassen (ook herhalen of corrigeren binnen hetzelfde doel), committen, pushen naar de afgesproken werkbranch, PR aanmaken en bijwerken, TASK/RESULT/PROGRESS en receipts bijwerken, en een gate-commando (merge/deploy) uitvoeren zodra het resultaat READY is. Vervolgberichten van de gebruiker (antwoord, testresultaat, screenshot, vraag) laten een actieve route en haar GO staan.
7. **Amendementen.** Een contractwijziging binnen de goedgekeurde envelop houdt de GO: herrouteer en werk door. Binnen de envelop vallen onder meer: een andere doelomschrijving of technische uitwerking met hetzelfde doel, extra acceptatiecriteria (bestaande blijven letterlijk staan), extra controles, extra leesscope, een smallere schrijfscope, lager risico, meer runs van lokale commando's en nieuwe testcommando's die volledig op de toegestane lijst staan (`node --test`, `npx vitest run`, `npx tsc --noEmit`, `npx eslint`, `npx playwright test`, alleen-lezende git, met alleen toegestane opties en eenvoudige relatieve paden). Bewijs mag niet stil lichter worden: criteria, controles (met methode en omschrijving), risicovlaggen, modus en agents (vraag, bestanden, stopcriterium) blijven minstens gelijk. De runtime controleert de envelop; `route` meldt `amended: true` of noemt de materiële wijziging (`envelope_changes`). Zie `docs/WORKFLOW.md`.
8. Bouw alleen de kleinste bruikbare wijziging. Geen bijvangstfixes of infrastructuur voor later. Nieuwe belangrijke UX: werk eerst de keuze en criteria uit en zet `design_freeze: true` voor implementatie. Kleine bekende aanpassing hoeft geen uitgebreide ontwerpronde.
9. Gebruik uitsluitend geselecteerde `aae-*` agents. Geef concrete vraag, relevante feiten/bronnen, bestaand bewijs en stopcriterium mee. De hook voegt het gezaghebbende werkpakket toe en kiest het route-model. Expliciet `run_in_background: false`. Wacht op de betreffende agent. Geen nesting/agentteams/Explore/Plan/skill als omweg.
10. **Mislukken is geen nieuwe GO.** Een mislukte test, review, build, migratie of poging vraagt geen nieuwe GO: analyseer, herstel binnen de scope, test en review opnieuw, en commit/push opnieuw, tot de acceptatiecriteria gehaald zijn of het budget op is. Na twee identieke mislukkingen zonder bronwijziging eerst de hypothese veranderen; geen blinde herhaallus. Budget telt ook supervisor, mislukte starts en hervattingen. Een nieuwe route wist verbruik niet. Is het budget op of blijkt een materiële wijziging nodig, meld dat dan met een concreet voorstel.
11. Laat geen code veranderen terwijl een reviewer of test loopt. Hergebruik een agentcontext alleen als route en bronversie gelijk zijn. Anders nieuwe gerichte vraag binnen het resterende budget.
12. Externe integraties: onbekende MCP/tools blijven geblokkeerd. Supabase en GitHub-PR volgens `docs/INTEGRATIONS.md`. Een vooraf in het contract beschreven niet-destructieve migratie valt onder de ene GO. Een tweede toestemming is alleen nodig voor een databasehandeling die niet vooraf was goedgekeurd én materieel meer risico introduceert, of voor een destructieve of moeilijk omkeerbare handeling (verwijderen of onherstelbaar wijzigen van productiegegevens): die hoort in `sensitive_migrations`/`dangerous_sql` (High Assurance) en vraagt daarnaast `AAE GEVOELIG GO <taak-id>`. Muterende `execute_sql` is geen normale snelweg. Secrets nooit in chat/logs/receipts.
13. Commando's: declareer exacte `argv`, reden, doel, relevante scripts/config in `watch`, timeout en maximum aantal runs (read/test/build/preview tot 20, publish tot 10, install/destructive 1). Geen vrije Bash/PowerShell, pipelines, `cd`, `npm`-scripts of remote tools buiten de runner. Voer alleen `node .claude/aae/runtime/cli.mjs run <id>` uit. Een goedgekeurd commando blijft goedgekeurd zolang argv, doel, timeout, gate en watchlijst gelijk blijven. Voor lokale commando's zonder gate mag een bewaakt bestand binnen de schrijfscope intussen veranderen; voor publish/install/destructive en gate-commando's moeten bewaakte bestanden ongewijzigd blijven (houd ze klein en buiten de schrijfscope, of plan een nieuwe GO). Gebruik voor git vaste argv zodat commit en push herhaald kunnen worden (zie `docs/COMMANDS_AND_LIMITS.md`). Goedgekeurde projectprogramma's zijn nog steeds krachtige code, geen sandbox.
14. `AAE VERTROUW` blijft beschikbaar om bewezen lokale test/buildcommando's over routes heen te hergebruiken. Publicatie, installatie en destructieve acties worden nooit vertrouwd. Inspecteer wat je als testcommando voorstelt.
15. Test op risico en bewijskracht, niet op het aantal tests. Een snelle brede suite kan doelmatiger zijn dan moeilijk testselecteren. Houd output klein; gebruik de runnerreceipts. Geen standaard honderden browserchecks, brede audits of afzonderlijke testagent voor een simpele wijziging.
16. Basisveiligheid, toegankelijkheid, foutafhandeling en regressiecontrole horen waar relevant bij het bouwen. High Assurance heeft verplichte bewijssoorten en een actueel onafhankelijk oordeel, maar geen volledig agentleger.
17. Gebruik `report-template` voor de actuele route-/bronhash. Vul `docs/aae/RESULT.json` in met bewijs en `READY`, `PARTIAL` of `BLOCKED`. Een commando met `"gate": "ready"` (bijvoorbeeld merge naar main) draait alleen als RESULT.json READY is op de actuele route en bron. `node .claude/aae/runtime/cli.mjs close` valideert de administratie. Maak een nieuwe hash nooit ter vervanging van opnieuw nodig bewijs. Een testontwerp is niet uitgevoerd; een screenshot is geen interactietest; READY betekent niet gedeployed.
18. Rond kort af: gedaan, bewezen/gecontroleerd, niet gecontroleerd, resterende blocker. Geen lange werklogboeken. Noem geen geschat Max-percentage, besparingspercentage of werkelijk model zonder beschikbare observatie.

## Zelfstandigheid met grenzen
Werk zelfstandig binnen de goedgekeurde route. Geen toestemming voor iedere file-read of reguliere stap. Een aanpassing van TASK.json, RESULT.json, PROGRESS.md, receipts of andere AAE-administratie laat de GO niet vervallen zolang doel, scope en risicoprofiel niet materieel veranderen. Ook een andere technische uitwerking dan verwacht vraagt geen nieuwe GO als die hetzelfde doel bereikt, binnen dezelfde scope blijft en geen hoger risico introduceert.

Vraag alleen opnieuw expliciet toestemming bij een materiële scope- of risicowijziging, of wanneer je niet verantwoord verder kunt:
- een belangrijke productkeuze die niet in het contract is vastgelegd;
- ontbrekend essentieel bewijs dat je niet zelf kunt verkrijgen;
- een databasehandeling die niet vooraf was goedgekeurd én materieel meer risico introduceert;
- een destructieve of moeilijk omkeerbare databasewijziging, of verwijderen of onherstelbaar wijzigen van productiegegevens (altijd via `AAE GEVOELIG GO`);
- een onverwachte wijziging van authenticatie, autorisatie, security of secrets;
- werk buiten het goedgekeurde werkpakket;
- een oplossing met duidelijk hoger risico dan vooraf afgesproken;
- een punt uit `decision_points` in het contract;
- twijfel of een afwijking bij een vooraf goedgekeurde merge/deploy.

Gebruik nooit `bypassPermissions` en schakel hooks niet uit om verder te kunnen.

## Stop/hervat
`AAE PAUZE` trekt vrijgave in. Het annuleert geen al gestart OS-proces: stop eerst lopend werk. `AAE VERDER` hervat dezelfde ongewijzigde taak zonder budgetreset. `AAE HERSTEL` mag alleen nadat de gebruiker bevestigd heeft dat lopende processen gestopt zijn; het ruimt registraties op, niet verbruik. `AAE NIEUW` is een expliciete nieuwe opdrachtgrens, geen automatische uitweg bij budgettekort.

Een gewoon vervolgbericht laat een actieve route en haar GO staan. Gaat het om een echt nieuwe opdracht, rond de lopende taak dan eerst af (`close`, READY/PARTIAL/BLOCKED) of herrouteer met een nieuw taak-ID; een nieuwe route vraagt dan zijn eigen GO. Een expliciete pauze mag niet door eigen herroutering verdwijnen.

## Lees details alleen wanneer nodig
- `docs/WORKFLOW.md`: kwaliteitsondergrens, risicorouting, GO-envelop en besluitmomenten.
- `docs/COMMANDS_AND_LIMITS.md`: commando's, vertrouwen, gate, telemetry, hard versus soft.
- `docs/INTEGRATIONS.md`: Supabase/GitHub-PR, projectbinding, externe budgetten en gevoelige acties.
- `docs/VISUAL_CHECKS.md`: veilige ingelogde screenshots en interactiebewijs.
- `docs/LIVE_CHECK.md`: eenmalige praktijktest in een wegwerpproject.
- `docs/INSTALLATION.md`: veilig bijwerken en terugdraaien.
- `docs/LOCAL_CHANGES.md`: lokale v3.2-afwijkingen en hoe je een pakketupdate samenvoegt.
