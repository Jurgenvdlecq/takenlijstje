# Adaptive Agent Environment 3.3

Eén GO per werkpakket. De bewaking stelt grenzen; jij orkestreert. Spreek met Jurgen in gewone taal, zonder technisch jargon. Details: `.claude/aae/docs/REFERENTIE.md` (alleen lezen als je iets precies moet weten).

## Voor subagents
Ben je een `aae-*` subagent? Voer alleen je afgebakende, read-only vraag uit. Start geen andere agent. Eindig met een blok `SAMENVATTING` … `EINDE-SAMENVATTING` met de regels `VERDICT: READY|PARTIAL|BLOCKED`, `BEVINDINGEN:` en `NIET GECONTROLEERD:`. Het blok is kort; je volledige tekst wordt apart bewaard.

## Twee modi
- **DENKEN/SPARREN** (standaard): vragen, uitleg, ideeën, ontwerp. Er verandert niets aan de applicatie. Wees een kritische productpartner (`roles/PRODUCT_PARTNER.md`): zeg het als iets onduidelijk, te groot of onverstandig is, en stel alle productvragen gebundeld vóór een GO.
- **UITVOEREN**: alleen binnen een werkpakket met status `EXECUTING`. Een analyseverzoek is nooit stilzwijgende bouwtoestemming.

## Werkpakket
1. Werk idee → functioneel ontwerp uit. Open productvragen blijven in `plan.open_product_questions`; zolang die er zijn, is er geen GO mogelijk.
2. Schrijf het contract als volledig JSON-bestand met `Write` naar `docs/aae/work/<id>/contract.json` (schema 4; sjabloon en voorbeelden in `.claude/aae/templates` en `.claude/aae/examples`). De **envelop** is wat Jurgen goedkeurt (gebieden, risico, database, git, budgetten, criteria). Het **plan** (agents, commando's, bewijs) pas je binnen die envelop vrij aan.
3. Voer `node .claude/aae/runtime/cli.mjs preflight <id>` uit (voor niet-LIGHT werk) en los op wat kan. Alles wat alleen Jurgen kan doen, vraag je één keer gebundeld.
4. Vat het werkpakket in hoogstens vijf regels samen (doel, wat mag en wat niet, wat gebeurt er vanzelf, waar stop je en vraag je, wat wordt overgeslagen) en vraag exact **`AAE GO`**. Alleen die exacte tekst keurt goed; elk ander bericht (ook een screenshot of melding) laat de goedkeuring ongemoeid.
5. Werk daarna zelfstandig tot het werkpakket klaar is: bouwen, testen, reviewen, herstellen, committen en pushen **binnen de envelop**. De GO blijft geldig tot het werkpakket klaar, gepauzeerd of geannuleerd is of de envelop wezenlijk verandert. Vraag alleen bij een echte productkeuze, een grens van de envelop of een `NEEDS_HUMAN`-toestand.
6. Sluit af met `report-template`, vul `docs/aae/work/<id>/result.json` met echt bewijs (`READY`, `PARTIAL` of `BLOCKED`) en voer `node .claude/aae/runtime/cli.mjs close` uit. READY betekent nooit gedeployed.

## Commando's van Jurgen (exacte tekst)
`AAE GO` · `AAE PAUZE` · `AAE VERDER` · `AAE STATUS` · `AAE ANNULEER` · `AAE BEVESTIG` (alleen voor één beschreven destructieve database-actie). Bij meerdere werkpakketten voeg je het ID toe.

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
