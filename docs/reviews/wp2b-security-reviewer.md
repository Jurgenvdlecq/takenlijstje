## Security-review: WP2b (contract `…_210`, back-up en terugzetten, tests)

**Scope**
- `supabase/migrations/20260928000210_scope_contract.sql` (live uitgevoerd)
- Context daarbij: `_100`, `_200`, `_rls`, `_functions`
- `supabase/ops/backup_v2.sql`, `restore_check_v2.sql`, `restore_v2.sql`
- `supabase/tests/40_wp2b.sql`, `upgrade/na_210.sql` en de wijzigingen in `10_`/`20_`/`30_`/`gelijktijdig.sh`
- `git diff fe7c7da HEAD -- src` (alleen `activateTemplatesAction`)
- Nagelopen op persoonskoppeling: `src/server/actions/tasks.ts`, `src/server/system/dispatcher.ts`, `src/features/household/store.tsx`, `src/server/errors.ts`

**Stack:** standaard (Next.js + Supabase/PostgreSQL). **npm audit:** 0 hoog, 0 kritiek (0 in totaal).

**Verplicht op grond van:** niveau 2, met login, meerdere gebruikers, persoonsgegevens (minderjarigen) en rollen.

**Beperking:** ik kan live niet bereiken. Wat alleen live vast te stellen is, staat onder "Query's voor live". Deze keer heb ik geen eigen aanvalsproeven op een database gedaan. Het oordeel steunt op het lezen van de SQL en op de tests.

### Toegangstabel (wat `_210` raakt)
| Endpoint/action | Huidige gebruiker uit | Id's uit invoer | Eigendom gecontroleerd? |
|---|---|---|---|
| RPC `undo_complete_task` (`_210`:119) | `auth.uid()` via `is_member` | task_id | ja: vreemd, onbekend en uitgezet geven P0002, pas daarna lock. Wel een regressie na de lock, zie punt 4 |
| RPC `complete_task` v2 (`_200`, ongewijzigd) | `is_member` | task_id, mutation_id | ja. `unique (task_id)` vangt nu ook dubbel afvinken buiten de RPC om af |
| Oude `complete_task` (5 argumenten), `accept_swap_request` | — | — | weggehaald. Aanroepen geeft 42883, en dat is gelijk voor vreemd en onbekend (getest) |
| `household_members` INSERT via REST | — | household_id, user_id | geen insert-policy meer, dus altijd geweigerd, ook voor een beheerder (getest, `40_wp2b.sql`:130-147) |
| `household_members` UPDATE/DELETE via REST | sessie (RLS + `guard_member_changes`) | id | ja (ongewijzigd sinds WP1). Account omhangen → 42501/23505 (getest) |
| RPC `create_household` / `accept_invitation` | `auth.uid()` | token | ja. Er is nu een advisory lock plus `unique (user_id)`, dus BR-44 is ook bij gelijktijdigheid dicht (`gelijktijdig.sh`) |
| RPC `delete_my_account` | — | — | niet aanroepbaar voor authenticated/anon tot WP7 (`_200`:609, getest in `30_wp2a.sql`:773-778) |
| RPC `get_invitation` (anon) | geen (token) | token | bewust zo: token van 64 hex-tekens, geeft alleen naam van het huishouden, naam van de uitnodiger, e-mail en vervaldatum |
| Back-upschema `backup_v2_20260929` | — | — | revoke op schema en tabellen voor public/anon/authenticated. Live nog bevestigen (query B1-B5) |

### Bevindingen

Er zijn geen BLOKKEREND- en geen GEMIDDELD-punten.

1. **[LAAG] De back-up heeft geen afdwingbare opruiming (M8, AC-061). Hij bevat precies de gegevens die V-21 verbiedt.**
   - **Plek:** `supabase/ops/backup_v2.sql`:26-29; `docs/PROGRESS.md`:104 ("M8 … open").
   - **Probleem:** het schema is een volledige kopie van alle 17 `public`-tabellen, zonder RLS. Daarin staan:
     - `task_completions.member_id` en `tasks.completed_by_member_id` (7 afvinkingen met persoon);
     - `notifications` met "gedaan door {naam}";
     - `household_members.email` van het gewiste lid "Ellen";
     - `users.email`;
     - `push_subscriptions` (endpoint, `p256dh`, `auth`);
     - uitnodigingstokens.

     Dat dit na ≈ 2026-10-29 verdwijnt, hangt alleen af van één regel in PROGRESS. AC-061 eist "blijft niet ongemerkt staan", maar er is geen mechanisme dat dat bewaakt.
   - **Gevolg:** wordt het vergeten, dan blijft "wie deed wat" onbeperkt bewaard. Dat botst met V-21 en succescriterium 7.
   - **Verbetering:**
     - WP2b niet als afgerond markeren vóór M8, en M8 met datum bovenaan "Volgende stap" zetten.
     - Liefst ook een technische waarschuwing: in WP3 laat `/api/status` of de tick een logregel of fout geven zolang er een schema `backup_v2_%` bestaat dat ouder is dan 30 dagen.
     - Defense-in-depth: `alter table backup_v2_20260929.<t> enable row level security` op alle back-uptabellen. Voor rollen zonder bypassrls is dan alles dicht, ook als er ooit per ongeluk USAGE wordt gegeven. Voor de eigenaar en `restore_v2` verandert er niets.

2. **[LAAG] Account verwijderen via Supabase (dashboard of `auth.admin.deleteUser`) kan een huishouden zonder beheerder achterlaten.**
   - **Plek:** `_210`:225-227 (`user_id → users on delete cascade`) en `_100`:163-166: `guard_member_changes` laat FK-acties door (`pg_trigger_depth() > 1`), en `auth.uid()` is dan null.
   - **Probleem:** alleen `delete_my_account` controleert "enige beheerder". Wordt het account van de enige actieve beheerder buiten die RPC om verwijderd, dan gaat de lidrij mee door de cascade. Vóór `_210` bleef er een lidrij zonder account over; nu blijft er een huishouden over zonder beheerder, of zonder leden.
   - **Gevolg:** niemand kan het huishouden nog beheren of verwijderen. Er blijven dan persoonsgegevens (notities met `author_name`, historie) achter zonder eigenaar en zonder verwijderroute. Dit is niet te misbruiken door gebruikers. Het vraagt een handeling van de projecteigenaar.
   - **Verbetering (één van beide):**
     - in WP3 `purge_expired_data()` huishoudens zonder leden laten opruimen, en huishoudens zonder actieve beheerder melden;
     - of een `before delete`-trigger op `public.users` die weigert als die gebruiker de laatste actieve beheerder is van een huishouden met andere leden. `delete_my_account` loopt eerst, dus de normale route blijft werken.

     Voeg een test toe: `delete from auth.users` van de enige beheerder, met daarna de verwachte uitkomst.

3. **[LAAG] `restore_v2.sql` breekt (of zou gegevens herstellen van iemand die zijn account liet verwijderen) zodra na M6 een account is verwijderd.**
   - **Plek:** `supabase/ops/restore_v2.sql`:61-65, 116-122, 193-204 (en 139, 188).
   - **Probleem:**
     - de insert en de `update … set <member>_id = b.…` gaan ervan uit dat alle leden uit de back-up nog bestaan;
     - nadat een account na M6 is verwijderd (cascade, zie punt 2), geeft het terugzetten FK-fouten (23503) en rolt de hele transactie terug;
     - bij een lid dat opnieuw wordt ingevoegd met een bestaande `user_id` komt een persoon terug die zich heeft laten verwijderen.

     Daarnaast krijgen de opnieuw aangemaakte tabellen (`task_assignments`, `task_swap_requests`, `member_absences`) de standaardrechten van Supabase voor `anon`. `_rls`:86 trok die in, maar `restore_v2` doet dat niet. RLS houdt het dicht; dit is dus defense-in-depth.
   - **Gevolg:** de terugvaloptie werkt misschien niet op het moment dat je hem nodig hebt. Geen lek.
   - **Verbetering:**
     - filter overal op bestaande leden en gebruikers (`and exists (select 1 from public.users u where u.id = b.user_id)`, `and exists (… household_members m where m.id = b.<kolom>)`);
     - voeg `revoke all on public.task_assignments, public.task_swap_requests, public.member_absences from anon` toe;
     - neem een verwijderd account op in het M0-scenario.

4. **[LAAG] Regressie in `undo_complete_task`: de hercontrole na de lock is verdwenen.**
   - **Plek:** `_210`:133-136 tegenover `_200`:145-148. Dezelfde regressie staat in `restore_v2.sql`:472-475.
   - **Probleem:** na `select … for update` ontbreekt `if not found or v_task.deleted_at is not null then raise … P0002`.
     - Wordt de taak tussen de twee selects zacht verwijderd (`delete_task`), dan wist undo toch de historie en zet het de verwijderde taak op `todo`.
     - Wordt hij hard verwijderd, dan geeft de functie een rij met alleen null-waarden terug in plaats van P0002.
   - **Gevolg:** een klein race-venster met historieverlies of een onverwacht antwoord aan de client. Geen toegang over de grens van het huishouden.
   - **Verbetering:** zet de hercontrole uit `_200` terug in een nieuwe migratie (niet in `_210`, die is al live), en voeg een test of mutant toe.

5. **[LAAG] De privacy-invariant-test is een zwarte lijst op namen, en dekt maar drie tabellen.**
   - **Plek:** `40_wp2b.sql`:426-430 en `upgrade/na_210.sql`:36-41.
   - **Probleem:** een toekomstige kolom zoals `done_by`, `completer_id` of `last_actor_member_id`, of een FK naar `household_members` op een andere tabel (bijvoorbeeld `shopping_lists`, `task_completions`), glipt erdoorheen.
   - **Verbetering:** een witte lijst op FK's naar `household_members` en `users`: `select conrelid::regclass, pg_get_constraintdef(oid) from pg_constraint where confrelid in ('public.household_members'::regclass,'public.users'::regclass) and contype='f'`. Die moet exact gelijk zijn aan:
     - `tasks.created_by_member_id`
     - `task_recurrences.created_by_member_id`
     - `task_comments.member_id`
     - `notifications.member_id`
     - `user_preferences.member_id`
     - `household_invitations.invited_by_member_id`
     - `household_invitations.accepted_by`
     - `household_members.user_id`
     - `households.created_by`
     - `push_subscriptions.user_id`

     Plus een controle dat geen kolom in `public` op `%_by%`/`%member%`/`%actor%` eindigt buiten die lijst.

6. **[ONZEKER] Platformlogs kunnen tijdelijk vastleggen wie afvinkte.**
   - `completeTaskAction` (`src/server/actions/tasks.ts`:49) roept PostgREST `rpc/complete_task` aan met de JWT van de gebruiker. Supabase API-/edge-logs bewaren per verzoek pad en tijd, en (vermoedelijk) de JWT-claims (`sub`).
   - Samen met `task_completions.completed_at` is dan af te leiden wie afvinkte, zolang die logs bewaard blijven (Free ± 1 dag, Pro ± 7 dagen). Alleen de projecteigenaar kan erbij; huisgenoten niet.
   - De app zelf logt geen persoon: `errors.ts`:67 logt alleen actie en code, en de dispatcher logt geen ontvanger.
   - **Nodig om het vast te stellen:** de hoofdsessie bekijkt met de Supabase-koppeling de logs van service "api" en controleert of regels voor `/rest/v1/rpc/complete_task` een `sub`/user-id bevatten. Zo ja, dan is dit een beleidsvraag (zie Vragen).

**Per categorie**
- **A. Wachtwoorden:** niet geraakt; dit ligt bij Supabase Auth. V-40 (leaked-password-protection) staat bekend open. Verder niets gevonden.
- **B. Sessies:** niet geraakt. Niets gevonden.
- **C. Autorisatie en isolatie:**
  - de insert-policy op leden is weg, `user_id` is verplicht, en `unique (user_id)` sluit de BR-44-race uit WP2a;
  - de guard zonder toewijzingsregel houdt maker, `household_id`, `done`, `completed_at`, `deleted_at` en reekskoppeling vast (getest `40_wp2b.sql`:266-292);
  - `private` na de revoke/grant: alleen de 7 policyhelpers, generiek getest in `20_rechten_br.sql`:892-899, dat na `_210` draait;
  - zie punten 2 en 4.
- **D. Geheimen:** er staan geen geheimen in de migratie of de ops-scripts. De back-up bevat pushsleutels; die blijven binnen het project (punt 1). Niets gevonden.
- **E. Invoer:** er zijn geen nieuwe invoerpunten. Tijdzone-check en unieke index geven bij een fout een nette melding (`errors.ts`: 23505 → "Dit bestaat al.", 23514-tekst gefilterd). Niets gevonden.
- **F. Extern:** niet geraakt.
- **G. Afhankelijkheden:** npm audit schoon.
- **H. Informatielek:** oude signaturen geven dezelfde 42883 voor vreemd en onbekend. P0002 is gelijk voor vreemd, onbekend en uitgezet. Niets gevonden.
- **I. AVG:**
  - de privacy-invariant geldt in het schema;
  - meldingen: ontvangers worden alleen op voorkeur bepaald, zonder actor (`dispatcher.ts`:56), met een tekst zonder naam (`tasks.ts`:66);
  - `client_mutation_id` is `crypto.randomUUID()` (`utils.ts`:10) en is niet te koppelen;
  - `updated_at` bevat geen persoon;
  - realtime: alleen RLS-gefilterde rijen zonder persoon; de toast bij wie afvinkte wordt alleen in het geheugen onderdrukt;
  - `push_subscriptions.last_used_at` wordt gezet bij het versturen, niet door de handelende persoon;
  - de meldingen vallen weg met de hele soort (`_210`:23-24);
  - rest: punten 1 en 6.
- **J.** Niet van toepassing (niveau 2).

**Herreview van de WP2a-punten**

Opgelost (gelezen in de code):
- 1: `households … for update` in `delete_my_account`, `_200`:569
- 2: advisory lock plus `unique (user_id)`
- 3: revoke, `_200`:609
- 4: policy weggehaald, `_210`:230
- 5: `activateTemplatesAction` leest de eigen reeksen terug met de user-client
- 7: `begin`/`commit` in `_210` en `restore_v2`

Nog open, bewust uitgesteld in PROGRESS: 6 (DoS door vooraf geclaimde id's) en 8 (CSP, WP9).

**Back-up (vraag 2), op basis van de code**
- De schema-ACL is alleen voor de eigenaar: een nieuw schema geeft geen USAGE aan PUBLIC. De revoke is expliciet. Ook de tabelrechten van public/anon/authenticated worden per tabel ingetrokken.
- Voor `service_role` wordt niets ingetrokken, maar zonder USAGE op het schema kan die er ook niet bij.
- PostgREST en pg_graphql kunnen niets tonen zonder USAGE op het schema.
- Toekomstige tabellen maakt niemand daar aan. Een wereldwijde default-ACL (namespace 0) zou alleen tabelrechten geven, en nog steeds geen USAGE op het schema. Live controleren (B3).
- `restore_check_v2.sql` gooit zijn schema binnen dezelfde transactie weer weg. In orde.
- Let op, voor de melding bij M8: dagelijkse Supabase-back-ups en PITR bevatten dit schema. Na de drop kan het er dus nog tot de bewaartermijn van het platform in zitten.

### Query's voor live (alleen lezen, voor de hoofdsessie)

```sql
-- B1 schema-ACL en eigenaar (verwacht: eigenaar postgres, acl null of alleen eigenaar; restore_check bestaat niet)
select nspname, nspowner::regrole, nspacl from pg_namespace where nspname like 'backup_v2%' or nspname = 'restore_check';
-- B2 USAGE per rol (verwacht: alles false)
select r, has_schema_privilege(r, 'backup_v2_20260929', 'USAGE') usage, has_schema_privilege(r, 'backup_v2_20260929', 'CREATE') "create"
from unnest(array['anon','authenticated','service_role','authenticator']) r;
-- B3 tabelrechten en wereldwijde default-ACL's (verwacht: 0 rijen grants; geen defaclnamespace=0 met anon/authenticated)
select table_name, grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'backup_v2_20260929' and grantee in ('anon','authenticated','PUBLIC','service_role','authenticator');
select defaclrole::regrole, defaclnamespace::regnamespace, defaclobjtype, defaclacl from pg_default_acl
where defaclnamespace = 0 or defaclnamespace = 'backup_v2_20260929'::regnamespace;
-- B4 niet ontsloten (verwacht: pgrst.db_schemas zonder backup_v2_…)
select rolname, rolconfig from pg_roles where rolname = 'authenticator';
-- B5 niet in realtime, geen verwijzingen (verwacht: puballtables=false; 0 rijen buiten public; 0 views/functies)
select pubname, puballtables from pg_publication;
select pubname, schemaname, tablename from pg_publication_tables order by 1,2,3;
select 'view' soort, schemaname||'.'||viewname from pg_views where definition ilike '%backup_v2%'
union all select 'functie', oid::regprocedure::text from pg_proc where prosrc ilike '%backup_v2%';
-- B6 aantal tabellen in de back-up (verwacht 17)
select count(*) from pg_tables where schemaname = 'backup_v2_20260929';

-- C1 leden: policies (verwacht: select, update, delete; GEEN insert 'a' of '*')
select polname, polcmd from pg_policy where polrelid = 'public.household_members'::regclass;
-- C2 constraints leden (verwacht: UNIQUE (user_id), FK user_id … ON DELETE CASCADE, geen UNIQUE (household_id, user_id); user_id NOT NULL)
select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.household_members'::regclass order by 1;
select is_nullable from information_schema.columns where table_schema='public' and table_name='household_members' and column_name='user_id';
-- C3 functierechten (verwacht: anon alleen get_invitation; private alleen de 7 helpers; delete_my_account niet voor authenticated;
--    elke prosecdef met search_path='' in proconfig)
select p.oid::regprocedure, p.prosecdef, p.proconfig,
       has_function_privilege('anon', p.oid, 'EXECUTE') anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') authenticated
from pg_proc p where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace) order by 1;
-- C4 triggers weer aan na het wissen (verwacht tgenabled='O' voor alle, incl. tasks_updated_at, tasks_guard, household_members_guard)
select tgrelid::regclass, tgname, tgenabled from pg_trigger
where not tgisinternal and tgrelid in ('public.tasks'::regclass,'public.task_recurrences'::regclass,'public.household_members'::regclass,'public.task_comments'::regclass)
order by 1,2;
-- C5 alle public-tabellen RLS aan (verwacht 0 rijen)
select relname from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p') and not relrowsecurity;
-- C6 huishoudens zonder actieve beheerder (verwacht 0)
select h.id from public.households h
where not exists (select 1 from public.household_members m where m.household_id = h.id and m.role = 'admin' and m.is_active);

-- P1 privacy: FK's naar leden/gebruikers (verwacht exact de witte lijst uit punt 5)
select conrelid::regclass, pg_get_constraintdef(oid) from pg_constraint
where contype = 'f' and confrelid in ('public.household_members'::regclass, 'public.users'::regclass) order by 1;
-- P2 privacy: verdachte kolommen (verwacht alleen: tasks/task_recurrences.created_by_member_id, task_comments.member_id,
--    notifications.member_id, user_preferences.member_id, household_invitations.invited_by_member_id/accepted_by, households.created_by)
select table_name, column_name from information_schema.columns
where table_schema = 'public' and (column_name ~* '(_by|member|actor|user_id)' ) order by 1,2;
-- P3 meldingsinhoud (verwacht 0)
select count(*) from public.notifications
where title ilike '%gedaan door%' or body ilike '%gedaan door%' or body ilike '%voor jou%' or body ilike '%van jou%' or body ilike '%jouw naam%';
```

Daarnaast, geen SQL: Supabase-logs service "api" controleren op `sub` bij `rpc/complete_task` (punt 6).

### Wat goed is
- `_210` is atomair (`begin`/`commit`), en de `updated_at`-triggers staan tijdens het wissen uit en daarna weer aan. De upgrade-test controleert dat `updated_at` ongewijzigd is (`na_210.sql`:69-72).
- BR-44 en BR-11 zijn nu databaseconstraints (`unique (user_id)`, `unique (task_id)`), getest als systeem, dus buiten de RPC's om.
- Leden komen er alleen nog in via `create_household` en `accept_invitation`. Er is geen enkele insert-policy meer.
- `40_wp2b.sql`:297-309 zoekt in alle functiebronnen naar vervallen kolommen en typen. Zo wordt een plpgsql-functie die pas bij gebruik zou breken vooraf gevonden.
- Het back-upscript is consistent (repeatable read), telt de rijen na en maakt geen exportbestand.

### Doorgeven aan test-writer
- `undo_complete_task` met een taak die tussen de check en de lock zacht verwijderd wordt → P0002 en de historie blijft (na herstel van punt 4; mutant op de hercontrole).
- `delete from auth.users` van de enige actieve beheerder van een huishouden met andere leden → verwachte uitkomst volgens de keuze bij punt 2.
- Witte-lijsttest op FK's en kolommen naar leden en gebruikers (punt 5).
- Generieke test: van alle functies in `public` is voor `anon` alleen `get_invitation(text)` aanroepbaar. Houdt nieuwe RPC's in WP3 en later automatisch in het oog.
- M0/`restore_v2`: scenario met een verwijderd account tussen M6 en het terugzetten (punt 3).

### Vragen voor de hoofdsessie
- **Punt 6 (beleid, voor Jurgen):** bevatten de Supabase-API-logs de gebruikers-id bij `complete_task`? Dan is de vraag of Jurgen accepteert dat het platform dit korte tijd (± 1-7 dagen, alleen zichtbaar voor de projecteigenaar) bewaart. V-21 zegt "ook niet onzichtbaar". Mijn voorstel: accepteren en vastleggen in "Bewust geaccepteerde open punten"; technisch alternatief is afvinken via de systeemsleutel, maar dat gaat in tegen TD §5.3.
- **Punt 1 / M8:** in de melding aan Jurgen ook zeggen dat de platformback-ups van Supabase het back-upschema nog tot hun eigen bewaartermijn bevatten.
- **Punt 2:** welke route heeft de voorkeur: opruimen in de purge van WP3, of een blokkade op `public.users`? Dat is een uitvoeringskeuze; vastleggen in DECISIONS.

### Conclusie
**GO.** Er staat geen BLOKKEREND- of GEMIDDELD-punt open. De contractstap sluit de rechtenregels die hij raakt goed af. In het schema is geen persoon meer aan een afvinking te koppelen. Voorwaarden:
- de query's B1-B5 bevestigen op live dat de back-up dicht is;
- M8 (punt 1) wordt aantoonbaar bewaakt.

Het precieze antwoord over de platformlogs (punt 6) ligt bij Jurgen.
