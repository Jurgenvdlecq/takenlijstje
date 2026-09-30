# Externe integraties in AAE v3.1

AAE v3.1 voegt twee smalle adapters toe: Supabase-databasewerk en het aanmaken van een GitHub pull request. Dit is **geen generieke MCP-whitelist**. Alleen expliciet bekende acties worden herkend; onbekende tools blijven geblokkeerd.

## Supabase
De adapter is bedoeld voor de officiële Supabase MCP/connector. De hoofdsessie mag `ToolSearch` gebruiken om tools te vinden; subagents blijven read-only en mogen geen MCP-tools gebruiken.

Ondersteunde canonieke acties:
- read: `get_project_url`, `list_tables`, `list_extensions`, `list_migrations`, `query_logs`, `get_advisors`, `generate_typescript_types`, `search_docs`
- inhoudsafhankelijk: `execute_sql`
- wijziging: `apply_migration`

De toolnaam moet aantoonbaar bij Supabase horen en exact eindigen op een ondersteunde canonieke actie. Er is geen regel die alle `mcp__supabase__*`-tools vrijgeeft.

### Projectbinding
Voor normale Supabase-acties moet eerst `get_project_url` de actuele verbinding verifiëren. Alleen deze ene read-only probe mag begrensd voor de route worden uitgevoerd. De project-ref uit de URL wordt lokaal in AAE-state vastgelegd, zonder secret. Het taakcontract bevat daarna dezelfde `project_ref`. Een toolinput die expliciet naar een andere project-ref wijst wordt geblokkeerd.

Een projectref is geen credential, maar deel hem alleen wanneer nodig. Access tokens, service-role keys en Vault/cron secrets horen nooit in TASK, receipts, docs of Git.

### Read-only SQL
`execute_sql` mag zonder verandergoedkeuring alleen voor conservatief herkende read-only SQL. De classifier accepteert een enkel statement dat begint met bijvoorbeeld SELECT/SHOW/EXPLAIN/VALUES/WITH en blokkeert muterende tokens en bekende side-effectfuncties. Bij twijfel is het niet read-only.

Muterende SQL hoort normaal **niet** via `execute_sql`, maar als benoemde `apply_migration` in het taakcontract. Dit voorkomt dat een losse query stil een schema- of datawijziging uitvoert.

### Migraties
`apply_migration` vereist:
1. `risk_flags` bevat `migration`;
2. exact `project_ref` en tool in `integrations.supabase`;
3. extern toolbudget;
4. actuele projectverificatie;
5. de actuele route is met `AAE GO` goedgekeurd.

Een bekende niet-destructieve migratie is niet automatisch High Assurance. De migratiebewijssoorten blijven wel verplicht: migration, rollback en data-preservation. Autorisatie, gevoelige data of werkelijk destructieve wijzigingen kunnen alsnog High Assurance maken.

### Gevoelige/destructieve acties
Voor `execute_sql` met mutatie/destructie en duidelijk destructieve migraties geldt een tweede grens. Ze moeten **exact** in `dangerous_sql` of `sensitive_migrations` van de taak staan, de route moet High Assurance zijn en na de gewone `AAE GO` is apart nodig:

`AAE GEVOELIG GO <taak-id>`

Deze toestemming is routegebonden. Verandert TASK.json, dan vervalt zij. Gebruik dit uitzonderlijk; liever een veilige migratie of handmatige beheeractie.

### Secrets
AAE vraagt nooit om `CRON_SECRET`, service-role keys of andere secretwaarden in chat te plakken. Externe receipts bewaren alleen hashes en beperkte metadata, nooit ruwe toolresponses of SQL-resultaten. Als een secret handmatig in Supabase Vault/Vercel moet worden ingevoerd, blijft dat een handmatige stap tenzij een toekomstige adapter een veilige secret-write kan doen zonder de waarde door het model te laten lopen.

## GitHub pull request
AAE v3.1 ondersteunt alleen `create_pull_request` als externe GitHub-wijziging. Het taakcontract legt `base` en `head` exact vast en vereist `risk_flags: ["external_effects"]` plus `AAE GO`. Merge-, delete- en andere GitHub-tools blijven onbekend/geblokkeerd.

Doel: Claude kan na een gecontroleerde commit/push zelf de PR openen, zonder dat de hele GitHub-toolset wordt vrijgegeven.

## Receipts en budget
Externe tools hebben een apart `budget.external_calls` en tellen niet als agentcalls. Mislukte calls verbruiken wel een call. Per provider geldt daarnaast `max_calls`. Toolresultaten worden niet rauw opgeslagen; receipts bevatten alleen provider, actie, classificatie, input/result-digests, projectref waar veilig, status en tijdstip.

## Voorbeeld Supabase-route
Zie `.claude/aae/examples/04-supabase-migration.json`. De normale flow is:
1. `get_project_url` probe;
2. route met project-ref en benodigde tools;
3. read-only voorcontrole/list_migrations;
4. `AAE GO`;
5. apply_migration;
6. gerichte nacontrole;
7. klaar.

Geen solution-architect, security-reviewer of test-writer alleen omdat Supabase wordt gebruikt. Kies specialistische expertise uitsluitend bij een concrete onbeantwoorde risicovraag.
