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

## Taak W03-AFVAL-001 (2026-10-01): W-03 afvalkalender (WP3b) — loopt, PARTIAL
- Ontwerp bevroren in PRODUCT_SPEC §14, AC WP3b, UX §13, TD §18, DS §7.10; plan-critic ronde 3 verwerkt (D-047).
- Gebouwd en gepusht (f71cc0f): migraties `_400`/`_410`, domein, bron, tickstap, actions, huidige schermen.
- Groen: typecheck, lint, unit (437), volledige DB-suite incl. `70_afval.sql`, gelijktijdigheid en upgrade, productiebuild. Security-review READY; code-review: twee BELANGRIJK hersteld (D-049).
- Niet uitgevoerd: integratie- en E2E-tests (Supabase Auth niet te downloaden: GitHub 403 via de proxy), probe van de bron (huisvuilkalender 403), rook-screenshots, UX-review, code-review ronde 2, live migraties, merge.
- Blocker: netwerk van de ontwikkelomgeving. Beslisvraag aan Jurgen staat open.
- Leerpunten AAE: een subagent die zijn stappenlimiet haalt, blijft als "running" staan (alleen AAE HERSTEL helpt; Jurgen wil technisch herstel zonder menselijke stap: apart werkpakket na W-03); reviewers een rapport van ≤ 2000 tekens laten geven; schrijfscope max 30 paden.

Eerstvolgende stap: antwoord van Jurgen op de netwerkvraag; daarna probe, integratie/E2E, screenshots, UX- en code-review, live migraties, merge. M8 ≈ 2026-10-29. Daarna: AAE-werkpakket "technisch herstel van vastgelopen agentregistraties".
