# Voortgang

AAE v3.2-local actief sinds 2026-10-01: één GO per werkpakket (zie `.claude/aae/docs/LOCAL_CHANGES.md`). Leg hier alleen besluiten, blockers en de eerstvolgende stap vast.

## Audit repository/host (2026-09-30): PASS
Read-only controle van hooks, de 13 aae-agents, de AAE doctor en de Supabase-projectverbinding. Alles PASS. Geen blockers.

Aandachtspunten:
- Volledige LIVE_CHECK/praktijktest (`.claude/aae/docs/LIVE_CHECK.md`) nog niet uitgevoerd.

## Taak WP3-LIVE-001 (2026-09-30): WP3 live zetten — gesloten, PARTIAL
- WP3 bleek al sinds 2026-09-29 live; AC-063/AC-064 gehaald; rooktest Jurgen OK (tevens M7 WP2b). Rechten op schema `net` niet intrekbaar (platformbeperking), bewust geaccepteerd als V-58 (hercontrole WP9).
- Input voor WP6: voltooide taken in "Alles" herkenbaar tonen; filterbolletje niet bij een snelkeuze.

## Taak MERGE-WP3-001 (2026-09-30): merge naar main
- `main` fast-forward 9e37764 → 572d263 (alleen docs + migratiebestand). Planner na de uitrol gecontroleerd: runs 21:00/21:15/21:30 UTC 200, geen fouten. Vercel: Jurgen stuurde een screenshot van een oudere deployment ("Stale"); de bevestiging van de nieuwe deployment is niet ontvangen. Taak niet formeel gesloten (opgevolgd door AAE-V32-001).

## Taak AAE-V32-001 (2026-09-30 – 2026-10-01): AAE v3.2-local
- Patch in `scripts/aae-v3.2/` (apply/verify/rollback met back-up); toegepast 2026-10-01, payload e551e6230f45b83e, back-up in `.aae-backups/local-2026-10-01T07-39-14-732Z`.
- Drie onafhankelijke code-reviews (sonnet): ronde 1 BLOCKED (B1 doelwissel/publicerende argv, B2 lichter bewijs), ronde 2 BLOCKED (B3 denylist → allowlist, B4 tolerantie alleen lokale commando's), ronde 3 BLOCKED (B5 gate kon vervallen, B6 `node --test` op willekeurig bestand). Alle zes hersteld met tests, exact volgens de voorgestelde remedie; B5/B6 niet door een vierde review nagelezen (budget op), wel bewezen met tests.
- Zelftest (toepassen, verify, testsuite, terugdraaien op een kopie): 131/131. Na toepassen: testsuite 131/131, doctor alle checks PASS (managed_integrity incl.), praktijkproef: amendement binnen de envelop bleef `active` zonder nieuwe GO; gate-commando geweigerd zonder READY.
- Bewust zo gelaten (gedocumenteerd): leesscope mag ruimer bij een amendement; alleen-lezende git-operanden niet tegen leesscope; een amendement laat een aparte GEVOELIG GO vervallen; `close` geeft het verzoek niet vrij (geen budgetreset).
- Leerpunten: een GO telt alleen als los bericht `AAE GO`; onder v3.1 liet elk vervolgbericht de GO vervallen (nu opgelost); het rapport van een subagent komt soms alleen als laatste ~2500 tekens in de AAE-state binnen; vraag reviewers om een compacte eindlijst.

## Taak AAE-V33-001 (2026-10-01): AAE v3.3 gebouwd en getest, nog niet geïnstalleerd — PARTIAL
- Gebouwd in `tools/aae-v33` op branch `claude/aae-v33-001-gxlax8` (vanaf de v3.2-baseline f9bf120, geen W-03). Live systeem, `main`, W-03-branch en app onaangeroerd; `hook.mjs` en `settings.json` nooit bewerkt.
- Tests: v3.3-suite 209/209 (scenario's T1–T23, bewaking, runner, integraties, levenscyclus, overgang, opdrachtregel), eigen tests 29/29 (baseline, P3, pariteit, installer, terugdraaien, overgang met een kopie van de echte state). v3.2-referentiesuite op de baseline: 130 van 131 tests slagen; de ene mislukte (`visual: no automatic browser…`) hangt af van of Playwright is geïnstalleerd en heeft in v3.3 een omgevingsonafhankelijke vervanger (V05).
- Pariteit: alle 131 v3.2-tests staan in de matrix (103 behouden, 22 aangepast, 6 vervallen met benoemde vervanger); B1 t/m B6 hebben elk een test.
- P3 (ongewijzigde hook): `tool_response.content` en het transcript van de agent bevatten de volledige tekst, de staart komt ook in `last_assistant_message`; `agent_transcript_path` is onbewezen en v3.3 steunt er niet op. Een run is pas COMPLETED als twee bronnen overeenkomen.
- Reviews (8 agentaanroepen, budget op; zacht plafond 3 overschreden): zes rondes vonden telkens echte punten, allemaal hersteld met tests: DB-C-omzeiling (DO/EXECUTE/E-strings/commentaar in strings/Unicode), legacy-overname zonder geldige goedkeuring, PR-merge niet aan het werkpakket gebonden, merge-gate niet aan de commit gebonden, preflight-validatie, geheimen in commits, branchnamen, hoofdlettergevoelige paden, REPORT_LOST-afhandeling in reconcile, `.gitignore` bij terugdraaien, bijwerkingenfuncties in SQL. **De allerlaatste ronde vond nog twee blokkerende punten (geciteerde functienamen zoals `"dblink_exec"(...)` en een WHERE in een subquery bij UPDATE); die zijn hersteld en getest, maar niet meer door een onafhankelijke reviewer bevestigd.** Daarom is acceptatiecriterium AC8 niet gehaald en is het eindresultaat PARTIAL, niet READY.
- Incident (tweede echte reproductie van het stale-slot-probleem): reviewagents werden ondanks `run_in_background: false` als achtergrondagent gestart; de gebruiker moest PAUZE/HERSTEL/GO sturen. v3.3 blokkeert vervolgberichten niet meer en stemt stille agents vanzelf af (regressietest T23). De agents van ~50–90 s kwamen synchroon terug, de langere niet; een verband met de looptijd is onbewezen. Vastgelegd in `payload/.claude/aae/docs/PROBES.md`.
- Beperking van v3.2 die dit pakket raakte: de bronvingerafdruk (READY-bewijs) negeert elke map met de naam `.claude`, dus ook `tools/aae-v33/payload/.claude`. Wijzigingen aan de payload zijn daardoor niet in de v3.2-hash zichtbaar; v3.3 telt een geneste `.claude` wel mee (test aanwezig).
- Verbruik: 8 van 8 agentaanroepen, circa 60 van 80 commando's, 7 van 7 pushes; alle pushes naar `claude/aae-v33-001-gxlax8`.
- Bewuste ontwerpkeuzes: geen sessie-eigenaarschap (vervangen door één bouwer per werkmap); geen OS-sandbox. (De eerdere keuzes "LIGHT keurt zichzelf goed" en "GO niet aan een hash gebonden" zijn op 2026-10-01 door Jurgen vervangen: zie AAE-V33-001B.)

## Taak AAE-V33-001B (2026-10-01): besluiten van Jurgen verwerkt in de v3.3-bron, nog niet geïnstalleerd
- Gedaan (alleen in `tools/aae-v33`, `docs/PROGRESS.md`, dit bestand): (1) ook LIGHT vraagt precies één `AAE GO`; alleen een pure analyse start zonder GO en kan niets gevolgds wijzigen. (2) De GO is gebonden aan werkpakket-ID + volledige canonieke envelop-hash; `cli present <id>` toont ID + korte hash, een GO voor een ander of gewijzigd voorstel wordt geweigerd. Doel zit in de hash, titel niet; plan, zachte budgetten, volgorde/opmaak van de JSON niet. (3) Elke bewakingshandeling (schrijven, agent, runner, gates, externe wijziging, `cli project`) controleert de goedgekeurde hash én dat het huidige contract binnen de envelop valt. (4) Eén simpele regel voor gevolgde bestanden: zonder GO niet (ook `docs/aae/PROGRESS.md`, DECISIONS, PROJECT_PROFILE en gevolgde notities); lokale genegeerde administratie en het eigen voorstel blijven vrij; een in een vrij pad toch gevolgd bestand valt onder GO; preflight schrijft `docs/aae/project.json` niet meer vóór een GO.
- Bewijs: nieuwe tests GB01–GB17 (doel verandert, materiële wijziging, alleen titel, alleen plan, JSON-volgorde, zacht/hard budget, hash-binding van alle materiële onderdelen, elke bewakingshandeling, LIGHT/analyse, administratieregel) en de bestaande suite op de nieuwe regels aangepast; zie het eindbericht voor de uitkomst van de suites.
- Bewust zo gelaten: een herschreven omschrijving van een bestaande controle in `test_plan` blijft een materiële wijziging (bewijs wordt niet stil lichter, bevinding B2); aannames staan niet in de hash maar nieuwe aannames blijven wel een materiële wijziging.
- Onafhankelijke eindreview: nog niet gedaan. Die loopt in een aparte, read-only sessie zonder subagents op een schone kloon, gebonden aan de commit-sha uit het eindbericht: `tools/aae-v33/REVIEW-OPDRACHT.md`.

Eerstvolgende stap: Jurgen start de aparte review en plakt het rapport terug. Daarna werkpakket AAE-V33-002 met een eigen GO: bewijs van de review (gebonden aan de commit-sha), installatie (`tools/aae-v33/installer/install.mjs`), terugdraaicontrole, rooktest en de merge naar `main` met gate. W-03 afvalkalender blijft geparkeerd tot v3.3 live is. M8 ≈ 2026-10-29.
