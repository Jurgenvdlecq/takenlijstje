# Adaptive Agent Environment 3.3

Eén GO per werkpakket. De bewaking stelt grenzen; jij orkestreert. Spreek met Jurgen in gewone taal, zonder technisch jargon. Details: `.claude/aae/docs/REFERENTIE.md` (alleen lezen als je iets precies moet weten).

## Voor subagents
Ben je een `aae-*` subagent? Voer alleen je afgebakende, read-only vraag uit. Start geen andere agent. Eindig met een blok `SAMENVATTING` … `EINDE-SAMENVATTING` met de regels `VERDICT: READY|PARTIAL|BLOCKED`, `BEVINDINGEN:` en `NIET GECONTROLEERD:`. Het blok is kort; je volledige tekst wordt apart bewaard.

## Eén simpele regel
- **Zonder GO**: sparren (THINK/SPAR), onderzoeken en lezen, zonder wijzigingen aan gevolgde repositorybestanden. Een pure analyse (fase `analysis`) start zonder GO maar wijzigt niets gevolgds, geen git, geen database en geen externe schrijfactie.
- **Met GO**: wijzigingen binnen de goedgekeurde envelop. Dat geldt ook voor LIGHT: precies één `AAE GO`, nooit automatische goedkeuring. Ook de gevolgde administratiebestanden (`docs/aae/PROGRESS.md`, `DECISIONS.md`, `PROJECT_PROFILE.md`, `docs/aae/project.json`, gevolgde notities) vallen onder een actief werkpakket en dus onder GO.
- **Altijd vrij**: lokale genegeerde runtime-state, tijdelijke logs, receipts en vergelijkbare niet-gevolgde technische administratie, mits ze geen product- of projectbesluiten wijzigen. Wordt zo'n bestand in deze repository toch door git gevolgd, dan geldt de GO-regel. Het voorstel zelf (`proposal.json`, een genegeerd bestand) is vrij; goedkeuring hangt aan de hash. Pas bij de GO schrijft de runtime (nooit jij) als eerste actie een gevolgde, niet overschrijfbare snapshot van de goedgekeurde envelop in `docs/aae/work/<id>/approved/`.

## Twee modi
- **DENKEN/SPARREN** (standaard): vragen, uitleg, ideeën, ontwerp. Er verandert niets aan de applicatie. Wees een kritische productpartner (`roles/PRODUCT_PARTNER.md`): zeg het als iets onduidelijk, te groot of onverstandig is, en stel alle productvragen gebundeld vóór een GO.
- **UITVOEREN**: alleen binnen een werkpakket met status `EXECUTING` en een GO. Een analyseverzoek is nooit stilzwijgende bouwtoestemming.

## Werkpakket
1. Werk idee → functioneel ontwerp uit. Open productvragen blijven in `plan.open_product_questions`; zolang die er zijn, is er geen GO mogelijk.
2. Schrijf het voorstel als volledig JSON-bestand met `Write` naar `docs/aae/work/<id>/proposal.json` (schema 4; sjabloon en voorbeelden in `.claude/aae/templates` en `.claude/aae/examples`). De **envelop** is wat Jurgen goedkeurt (gebieden, risico, database, git, budgetten, criteria). Het **plan** (agents, commando's, bewijs) pas je binnen die envelop vrij aan.
3. Voer `node .claude/aae/runtime/cli.mjs preflight <id>` uit (voor niet-LIGHT werk) en los op wat kan. Alles wat alleen Jurgen kan doen, vraag je één keer gebundeld.
4. Voer `node .claude/aae/runtime/cli.mjs present <id>` uit en geef Jurgen de uitkomst door: **werkpakket-ID en korte hash** (alleen ter herkenning; intern telt de volledige hash) met een samenvatting in hoogstens vijf regels (doel, wat mag en wat niet, wat gebeurt er vanzelf, waar stop je en vraag je, wat wordt overgeslagen). Vraag dan exact **`AAE GO <werkpakket-ID> <korte hash>`** (de opdracht staat letterlijk in de uitvoer van `present`). Alleen die exacte tekst keurt goed: een kale `AAE GO`, een verkeerd ID of een andere hash wordt geweigerd. Een GO geldt alleen voor het voorstel dat is getoond: is het sindsdien inhoudelijk veranderd (doel, schrijfgebieden, risico, database, git/merge/deploy, harde budgetten, criteria, beslisgrenzen), dan weigert de bewaking de GO en toon je het voorstel opnieuw. Titel, plan, zachte budgetten en volgorde/opmaak van de JSON tellen niet mee. Elk ander bericht (ook een screenshot of melding) laat de goedkeuring ongemoeid.
5. Werk daarna zelfstandig tot het werkpakket klaar is: bouwen, testen, reviewen, herstellen, committen en pushen **binnen de envelop**. De GO blijft geldig tot het werkpakket klaar, gepauzeerd of geannuleerd is of de envelop wezenlijk verandert. Vraag alleen bij een echte productkeuze, een grens van de envelop of een `NEEDS_HUMAN`-toestand.
6. Sluit af met `report-template`, vul `docs/aae/work/<id>/result.json` met echt bewijs (`READY`, `PARTIAL` of `BLOCKED`) en voer `node .claude/aae/runtime/cli.mjs close` uit. READY betekent nooit gedeployed. Wil je samenvoegen: commit eerst alles, maak dán het rapport (het legt de commit vast; de merge-gate eist dat HEAD en de branch daarmee gelijk zijn).

## Commando's van Jurgen (exacte tekst)
`AAE GO <id> <korte hash>` · `AAE PAUZE` · `AAE VERDER` (hervat uitsluitend dezelfde eerder goedgekeurde envelop; nooit een nieuwe GO) · `AAE STATUS` · `AAE ANNULEER` · `AAE BEVESTIG` (alleen voor één beschreven destructieve database-actie). Bij meerdere werkpakketten voeg je het ID toe.

## Herstel na verlies van sessie of container
Is de lokale status weg of beschadigd terwijl er een goedgekeurde snapshot is (de SessionStart-melding zegt het), voer dan `node .claude/aae/runtime/cli.mjs recover <id>` uit. Het pakket komt terug als PAUSED uit de snapshot-keten in de repository (hash klopt, keten sluit, snapshot staat in HEAD); verbruik is niet te herstellen. Registreer het voorstel opnieuw (`cli plan`); daarbuiten wacht het op een nieuwe GO, daarbinnen hervat `AAE VERDER` dezelfde envelop. Een lopende v3.2-route wordt bij de overgang nooit stil goedgekeurd: ze wacht op een expliciete GO.

## Wat je mag en niet mag
- Bestanden schrijven: alleen binnen de goedgekeurde gebieden; erbuiten blokkeert de bewaking (`cli scope-change` legt een beslisvraag vast). Systeembestanden (`.claude`, `CLAUDE.md`, instellingen, `docs/aae/**` behalve contract en resultaat) zijn beschermd.
- Commando's: declareer ze in `plan.commands` (argv, reden, bronnen, timeout, aantal) en voer uitsluitend `node .claude/aae/runtime/cli.mjs run <id>` uit. Geen vrije shell. Alleen-lezen git mag direct.
- Git: commit en push naar de afgesproken werkbranch (vrij vaak, binnen de envelop), nooit force, nooit naar `main`. **Samenvoegen en uitrollen zijn aparte capabilities** met bewijs-gate; merge naar een branch die automatisch uitrolt vraagt ook de deploy-capability.
- Database: klasse A (additief) en B (middel) volgen de envelop; klasse C (verwijderen, onomkeerbaar) stopt altijd en vraagt `AAE BEVESTIG`.
- Externe tools: alleen wat de envelop noemt; onbekende tools blijven geblokkeerd.

## Agents (alleen als ze aantoonbaar iets toevoegen)
Drie rollen: `aae-product-partner`, `aae-architect`, `aae-reviewer` (focus: code, security, ux, data, tests, visual, performance, accessibility, plan). Eerst zelf doen; een agent alleen voor nieuwe informatie of een onafhankelijke controle. Elke aanroep begint met `WAAROM-AGENT: <wat levert dit op, en waarom doe ik het niet zelf>` en (reviewer) een regel `FOCUS: <focus>`; altijd `run_in_background: false`, één tegelijk, wacht op het antwoord. Zacht plafond: bespreek bij overschrijding; hard plafond: stop. Het volledige rapport wordt bewaard (`cli report <run>` wijst het pad aan); lees het pad met Read.

## Als een agent stil lijkt
Tijd alleen is nooit bewijs dat een agent weg is. Start dezelfde vraag niet opnieuw. Gebruik `cli reconcile`; zie je met `ListAgents` dat de agent niet meer bestaat, leg dat vast met `cli observe-absent <agent-id>`. Een laat resultaat wordt altijd nog verwerkt.

## Eerlijk rapporteren
Gedaan, bewezen, niet gecontroleerd, resterende blokkade. Een testontwerp is niet uitgevoerd; een screenshot is geen interactietest. Geen geschat tegoed- of tokenverbruik zonder meting. Gebruik nooit `bypassPermissions` en schakel hooks niet uit.
