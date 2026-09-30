# Voortgang

AAE v3.1 geinstalleerd. Leg hier alleen besluiten, blockers en de eerstvolgende stap vast.

## Audit repository/host (2026-09-30): PASS
Read-only controle van hooks, de 13 aae-agents, de AAE doctor en de Supabase-projectverbinding. Alles PASS. Geen blockers.

Aandachtspunten:
- Volledige LIVE_CHECK/praktijktest (`.claude/aae/docs/LIVE_CHECK.md`) nog niet uitgevoerd.
- Geen blockers.

## Taak WP3-LIVE-001 (2026-09-30): WP3 live zetten
- Route: implementation / standard / normal / low, vlag `migration`, 0 specialisten (1 supervisor-bootstrap, haiku), extern budget 20 Supabase-aanroepen, 3 git-commando's (add/commit/push, elk 1×). Supervisor bevestigde de route; correctie hoofdsessie: herstelpad per migratie i.p.v. de WP2b-terugzetscripts.
- Uitkomst leescontroles: WP3 bleek al sinds 2026-09-29 volledig live (migraties + planner); `docs/PROGRESS.md` was niet bijgewerkt. Geen `apply_migration` voor _220/_300/_310 nodig geweest. AC-063/AC-064 gehaald (96 runs/24 u, 0 mislukt, 200).
- Na `AAE GO`: migratie `net_rechten` (repo `_320`) live toegepast om de rechten van `anon`/`authenticated` op schema `net` in te trekken. Geen effect: de rechten zijn door `supabase_admin` toegekend en `postgres` mag ze niet intrekken (platformbeperking). Planner draait ongewijzigd door (run 21:00 UTC na de migratie: 200, geen gefaalde stappen). Gegevens ongewijzigd (60/11/8/1/1, meldingen 8→12 door de gewone avondmeldingen, 0 pushabonnementen). Voorgelegd als V-58 in `docs/PROGRESS.md`.
- Open: V-58 (besluit Jurgen) en rooktest WP3/M7 door Jurgen. RESULT.json daarom `PARTIAL`.
- Leerpunten AAE: `execute_sql` met de tekst `vault.` wordt als gevoelig geblokkeerd, ook alleen-lezen (L6 indirect bewezen); `mcp__github__*`-leestools zijn niet geclassificeerd; externe aanroepen mogen niet parallel; de projectverificatie (`get_project_url`) moet per gebruikersvraag opnieuw.

Eerstvolgende stap: V-58 en rooktest afwachten; daarna RESULT.json op READY zetten en de taak sluiten (nieuwe kleine commandoroute voor de slotcommit). Daarna W-03 afvalkalender via een nieuwe route.
