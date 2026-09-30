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

Eerstvolgende stap: W-03 afvalkalender (ontwerp, nieuwe route). M8 ≈ 2026-10-29.
