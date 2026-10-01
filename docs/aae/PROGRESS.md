# Voortgang

AAE v3.1 geinstalleerd. Leg hier alleen besluiten, blockers en de eerstvolgende stap vast.

## Audit repository/host (2026-09-30): PASS
Read-only controle van hooks, de 13 aae-agents, de AAE doctor en de Supabase-projectverbinding. Alles PASS. Geen blockers.

Aandachtspunten:
- Volledige LIVE_CHECK/praktijktest (`.claude/aae/docs/LIVE_CHECK.md`) nog niet uitgevoerd.
- Geen blockers.

## Taak WP3-LIVE-001 (2026-09-30): WP3 live zetten — gesloten, PARTIAL
- Route: implementation / standard / normal / low, vlag `migration`, 0 specialisten (1 supervisor-bootstrap, haiku), 16 van 20 Supabase-aanroepen, 6 git-commando's (twee commits). Supervisor bevestigde de route; correctie hoofdsessie: herstelpad per migratie i.p.v. de WP2b-terugzetscripts.
- Uitkomst: WP3 bleek al sinds 2026-09-29 volledig live (migraties + planner); `docs/PROGRESS.md` was niet bijgewerkt. AC-063/AC-064 gehaald (96 runs/24 u, 0 mislukt, 200). Rooktest Jurgen OK (tevens M7 WP2b).
- Migratie `net_rechten` (repo `_320`) live toegepast, zonder effect: rechten door `supabase_admin` toegekend, `postgres` mag ze niet intrekken. Besluit Jurgen V-58: bewust geaccepteerd, hercontrole bij WP9. Daarom eindstatus PARTIAL (AC3), functioneel volledig.
- Input voor WP6 (uit de rooktest): voltooide taken in "Alles" herkenbaar tonen; filterbolletje niet bij een snelkeuze.
- Leerpunten AAE: `execute_sql` met de tekst `vault.` wordt als gevoelig geblokkeerd, ook alleen-lezen; `mcp__github__*`-leestools zijn niet geclassificeerd; externe aanroepen niet parallel; `get_project_url` per gebruikersvraag opnieuw; `AAE GO` alleen als los bericht; elke nieuwe gebruikersvraag vraagt `route` opnieuw; publish-commando's zijn eenmalig per route (slotcommit vergt een nieuwe route + GO); TASK/RESULT/evidence staan in `.gitignore`.

## Taak W03-AFVAL-001 (2026-10-01): W-03 fixture-probe huisvuilkalender — gesloten, PARTIAL (functioneel volledig)
- Route: implementation / standard / low / normal, vlag `external_effects`, 0 agents, 1 probe-commando (`scripts/waste-probe.mjs`, curl) + git status/add/diff/commit/push; GO van Jurgen als los bericht.
- Uitkomst: bron voor het eerst echt gezien (testadres 2591 BB 87): A/B/C 200, `application/json`, 0,6–0,8 s; `robots.txt` sluit niets uit. Ontwerp r2 op hoofdpunten bevestigd; correcties in D-046 (veldnamen `openbareRuimteNaam`/`woonplaatsNaam`, lege strings bij letter/toevoeging, BR-52 letterlijk in de leeg-bewaking). Fixtures: `docs/wijzigingen/W-03/probe/`; notitie `probe-r1.md`.
- Niet gecontroleerd: onbekend adres, meerdere kandidaten, onbekend `bagId`, 5xx/429; `www.denhaag.nl` blijft geblokkeerd (gemeenteregels bij de rooktest).
- Leerpunt AAE: een commando-watchbestand moet bestaan vóór `route`; daarom eerst een route zonder commando's (schrijfscope), dan herrouteren met commando's en GO. De headerbestanden van de probe bevatten sessiecookies van de bron; die zijn vóór de commit weggelaten. Eindstatus PARTIAL en niet READY, omdat de functionele controle als `command` gepland stond en de probe zélf de bronbestanden schrijft: zo'n receipt heeft nooit een gelijke bronhash vóór en ná. Volgende keer de controle als `inspection` plannen of een los alleen-lezen controlecommando opnemen. `docs/aae/PROGRESS.md` zelf stond niet in het git-add van deze route en wordt met de volgende W-03-route gecommit.

## Taak W03-AFVAL-002 (2026-10-01): W-03 ontwerp afronden na de probe — gesloten, PARTIAL
- Route: implementation / standard / low / normal, 3 agents (architect opus ×2, visual-designer sonnet ×1, plan-critic opus ×2 gepland), budget 5 agentaanroepen, 6 commando's (git). Vier keer GO van Jurgen nodig: eerste route faalde op leesscope `src` (pad met blokhaken `src/app/invite/[token]`), daarna nieuwe GO per nieuw gebruikersbericht, plus PAUZE/HERSTEL.
- Uitkomst: `solution-architect-r3.md` (reconstructie door de hoofdsessie, zie onder), `visual-designer-r1.md` (letterlijk), PROGRESS bijgewerkt. **Plan-critic niet geleverd**: run 1 afgebroken door PAUZE/HERSTEL, run 2 stopte op de beurtlimiet (maxTurns 14) zonder rapport. Totaalvoorstel daarom nog niet geschreven. Budget 5/5 gebruikt.
- Leerpunten AAE: (1) leesscope nooit op heel `src` (blokhaken in app-routes); (2) lange agentrapporten (architect ±90k tokens, 6 min) komen via de host niet in de hoofdsessie aan; alleen het slot (~2500 tekens) blijft in `state/local.json`; korte rapporten (visual, 45 s) komen wel aan; `SendMessage` naar een agent is door AAE geblokkeerd, dus een gemist rapport kost een nieuwe aanroep; (3) de plan-critic heeft met 14 beurten te weinig ruimte voor vijf documenten + code: splits de vraag (product/UX-consistentie apart van techniek/rechten) of beperk de bestanden; (4) elk nieuw gebruikersbericht tijdens een route dwingt `route` + GO opnieuw af, ook bij ongewijzigde route, omdat opus-agents altijd goedkeuring vragen; vraag Jurgen daarom pas iets als er niets meer loopt.

Eerstvolgende stap: W-03: plan-critic in een eigen kleine route (gesplitste vraag, beperkte bestanden) → totaalvoorstel → `/design-go`; bouwen als WP3b. M8 ≈ 2026-10-29.
