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

### Herstel na code- en securityreview (2026-09-28)

- **D-016: een beheerder voegt alleen leden zonder account toe (security punt 1).**
  - Een account koppelen kan uitsluitend via `create_household` en `accept_invitation`. Dat wordt afgedwongen door de insert-policy (`user_id is null`) en de guard (`before insert`, alleen jezelf).
- **D-017: een gedane taak terugzetten kan alleen via `undo_complete_task` (security punt 2).**
  - Een nieuwe taak met `completed_at` of `completed_by` wordt geweigerd.
  - Punten blijven tot WP2a door gezinsleden wijzigbaar: dat was al zo, en punten vervallen in WP2a. Dubbel afvinken, waar het misbruik zat, is nu dicht.
- **D-018: basisbeveiligingsheaders gaan al in WP1 live (security punt 3).**
  - Het gaat om `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `object-src 'none'` en `base-uri 'self'`.
  - De CSP met nonce voor scripts blijft in WP9, volgens de WP-tabel in TD §15.
  - De app toont geen gebruikerstekst als HTML of als link-URL. Dat blijft zo.
- **D-019: sessiecookies krijgen `Secure` in productie en `SameSite=Lax` (security punt 4).**
- **D-020: de GUC-vlag `takenlijstje.via_rpc` blijft voorlopig bestaan (security punt 5, LAAG).**
  - Via PostgREST is hij niet te zetten.
  - Guards omzetten naar `current_user`-controle is defense-in-depth voor WP9 (hardening).
- **D-021: ruilverzoeken kunnen alleen worden ingetrokken (security punt 6).**
  - De guard staat alleen statuswijzigingen toe. `accepted_by` mag alleen mee veranderen bij `accepted`, en die status zet alleen `accept_swap_request`.
- **D-022: de reeks-RPC's controleren eerst het lidmaatschap, zonder lock (security punt 7).**
  - "Bestaat niet" en "ander huishouden" geven dezelfde uitkomst. `delete_task` geeft voor beide `true` (idempotent, geen orakel).
- **D-023: de systeemsleutel wordt alleen in `src/server/system/admin-client.ts` gelezen (security punt 8).**
  - ESLint blokkeert ook dynamische imports en `SUPABASE_SERVICE_ROLE_KEY` buiten die map.
  - `/api/status` gebruikt `hasSystemKey()`.
- **D-024: geen `expectRows` op twee idempotente acties.** Het gaat om `markNotificationsRead` en `deletePushSubscription`: 0 rijen betekent daar "al gebeurd", niet "geweigerd". Alle andere updates en deletes met de gebruikersclient hebben nu `expectRows`.
- **D-025: geen aparte `loadOwnMember`, `loadOwnShoppingItem` en `loadOwnInvitation` (code-review 17).**
  - Deze acties filteren op het huishouden uit de sessie en controleren met `expectRows`. Dat is gelijkwaardig.
- **D-026: "losse taak wordt terugkerend" maakt de reeks aan met de id van de taak, als upsert (code-review 8).**
  - Dubbel opslaan levert zo nooit een tweede reeks op, zonder dat de oude UI een extra id hoeft mee te sturen.
- **D-027: `pause_series` zet `generated_until` terug naar vóór de pauze; `resume_series` zet het op leeg (code-review 7).**
  - Na hervatten plant de planner dus weer vanaf vandaag in (AC-122).
- **D-028: de push-endpoint-allowlist komt in WP3 (security punt 11), bij de push-time-out.** Vrije tekst in ruilmeldingen vervalt met ruilen in WP2a.
- **D-029: de link "Account verwijderen" op `/geen-toegang` (deel van AC-023) komt in WP7.** Dan bestaat account verwijderen.
- **D-030: een wachtrij-item met een nieuwere versie dan de server kent, krijgt HTTP 503 `UNSUPPORTED_VERSION`.** De client laat het staan en probeert later opnieuw (code-review 3).
- **D-031: na het wissen van de lokale gegevens schrijven de cache en de wachtrij niets meer terug, tot de pagina opnieuw laadt (code-review 11).**
- **D-032: herstel na de herreviews (wp1-code-reviewer-r2, wp1-security-reviewer-r2), alle LAAG.**
  - Security N1: na de upsert van "losse taak wordt terugkerend" leest de actie de reeks terug. Is die door iemand anders aangemaakt, dan volgt CONFLICT en wordt de taak niet gekoppeld.
  - Security N4: ESLint blokkeert ook `process.env["SUPABASE_SERVICE_ROLE_KEY"]` en destructuring van die naam (getest via `eslint --stdin`).
  - Code-review N2: bij "geen huishouden meer zichtbaar" herlaadt de pagina maximaal één keer per sessie (vlag in `sessionStorage`, gewist na een geslaagde verversing). Zo ontstaat er geen herlaadlus.
  - Code-review N4: netwerkfouten terwijl de browser online is, krijgen een eigen backoff-teller (2 s, 4 s, 8 s … tot 60 s). Ze tellen niet mee voor de vijf pogingen.
  - Code-review N5: bij push aanzetten wordt eerst de voorkeur bijgewerkt, daarna het abonnement.
- **D-033: de foutmelding bij "deze en toekomstige" zonder recht volgt nu letterlijk AC-004:** "Dit mag je niet (meer) wijzigen. Er is niets veranderd." (test-writer r3, GEMIDDELD). Het label voor vervallen wachtrij-soorten (`OBSOLETE_LABELS`) wordt ingevuld in WP2a, zodra er soorten vervallen.
