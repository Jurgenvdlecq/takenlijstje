# Uitvoeringsbeslissingen

Keuzes die de bouwer na de Design Freeze zelfstandig maakt binnen het goedgekeurde ontwerp. Wijzigingen aan goedgekeurde beslissingen horen hier niet: die zijn een wijzigingsverzoek in PROGRESS.md.

## WP1 — Rechtenmodel en securityfixes

- **D-001 (2026-09-28, WP1): Next 16.3.7 volgt zodra hij uitkomt.**
  - Het ontwerp noemt de securityrelease 16.3.7 (aangekondigd voor 30-09-2026). Op 2026-09-28 is 16.3.6 de nieuwste versie op npm; 16.3.7 bestaat nog niet.
  - WP1 gaat daarom live op 16.3.6. De upgrade gebeurt als losse, kleine wijziging zodra 16.3.7 er is, en uiterlijk in WP2a.
  - Afgewezen: wachten met WP1 tot de release. B-01 is een open BLOKKEREND-lek op live; dat weegt zwaarder.
- **D-002 (2026-09-28, WP1): de migraties heten `20260928000100_rechten_actief_lid.sql` en `20260928000110_reeks_rpcs.sql`.** Dit volgt de naamgeving van TD §3.2 met het datumprefix van de bouwdag.
- **D-003 (2026-09-28, WP1): de guards laten FK-acties door via `pg_trigger_depth() > 1`.**
  - Het gaat om `on delete set null` op maker, toegewezene en reeks. Dit volgt het patroon van TD §3.1 voor notities.
  - Afgewezen: in de trigger controleren of het lid nog bestaat. Dat is foutgevoeliger en vraagt een extra query per update.
- **D-004 (2026-09-28, WP1): een nieuwe guard op `task_recurrences` maakt de maker onveranderlijk.**
  - TD §5.2 regelt dit voor taken. Voor reeksen is het nodig omdat BR-22 op de maker steunt: zonder deze guard kan een beheerder of maker een ander als maker invullen.
  - Bij aanmaken moet de maker de gebruiker zelf zijn.
- **D-005 (2026-09-28, WP1): "open uitvoeringen" betekent status `todo` en `in_progress`.**
  - Dit geldt voor `clear_series_occurrences`, `pause_series`, `stop_series` en `delete_task('future')`. Gedane en overgeslagen taken en de historie blijven altijd staan.
  - Dit volgt TD §6.1 ("alle open uitvoeringen weg"). De oude code keek alleen naar `todo`.
- **D-006 (2026-09-28, WP1): afwezigheid verwerken gebeurt tijdelijk met de gebruikersclient.**
  - `applyAbsence` gebruikte tot nu toe de systeemsleutel. Dat mag niet meer (TD §5.3).
  - Tot WP2a (dan vervalt afwezigheid, V-24) beslissen RLS en de guard of een herverdeling mag.
  - Gevolg: een gezinslid zonder recht om aan anderen toe te wijzen, kan zijn eigen afwezigheid wel invoeren. De herverdeling faalt dan met een nette melding.
- **D-007 (2026-09-28, WP1): de route `/api/outbox` roept dezelfde server actions aan.**
  - Er zijn geen aparte services. Zo zijn autorisatie en validatie gegarandeerd gelijk (TD §9.3.1).
  - Een `UNAUTHENTICATED`-uitkomst wordt HTTP 401. Andere weigeringen komen als JSON met een `code`.
- **D-008 (2026-09-28, WP1): de wachtrij heeft versie 1 (`OUTBOX_VERSION = 1`).**
  - In WP1 zet `migrateOutboxEntry` versie 0 alleen om voor `shoppingAdd` zonder id. Alle soorten van de huidige app bestaan nog.
  - WP2a voegt de vervallen soorten toe (bijvoorbeeld `assign`), met een melding "functie bestaat niet meer".
- **D-009 (2026-09-28, WP1): na 5 mislukte pogingen blijft een wachtrij-item staan.**
  - De gebruiker ziet dan de melding "N wijzigingen konden niet worden verstuurd", met de knop Opnieuw.
  - Opnieuw proberen gebeurt met backoff (2 s × 2^pogingen, maximaal 60 s).
- **D-010 (2026-09-28, WP1): het vangnet bij opstarten (IDB-sleutel met `userId`, TD §4.4) komt in WP4.** Dat is het werkpakket waarin de snapshot-cache wordt herbouwd. WP1 wist de lokale gegevens bij uitloggen en bij `/geen-toegang`.
- **D-011 (2026-09-28, WP1): de service worker krijgt versie `v2`.** Daardoor worden de oude paginacaches bij de update eenmalig gewist. De cache-strategie verandert pas in WP4.
- **D-012 (2026-09-28, WP1): `deletePushSubscriptionAction` vraagt alleen een ingelogde gebruiker, geen actief lid.** Zo kan ook een uitgezet lid zijn eigen apparaat afmelden (TD §5.2: push alleen verwijderen).
- **D-013 (2026-09-28, WP1): `occurrence_date` volgt TD §5.2 ("Reekskoppeling"), niet de strengere formulering van AC-014.**
  - Een beheerder of de maker van de reeks mag de datum wijzigen; dat is nodig voor "deze en volgende". Een gezinslid mag dat niet.
  - Gevonden door de test-writer; de TD is hier de bron.
- **D-014 (2026-09-28, WP1): execute-rechten in `private` worden aan het eind van `_110` opnieuw gezet.** Daarbij geldt ook: standaard geen execute voor nieuwe functies.
  - Aanleiding: bevinding van de test-writer bij AC-028. `guard_recurrence_changes` was na de revoke aangemaakt en daardoor nog aanroepbaar.
- **D-015 (2026-09-28, WP1): pushabonnementen zijn gesplitst in vier policies.**
  - Lezen en verwijderen van je eigen abonnement mag altijd.
  - Aanmelden en bijwerken mag alleen als actief lid. Een uitgezet lid kan zijn apparaat dus alleen nog afmelden (TD §5.2).
