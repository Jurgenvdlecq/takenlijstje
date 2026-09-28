## Security-review: WP2a (scope-expand `_200`, ops-scripts, server actions)

**Scope**
- `git diff 48acc79 HEAD -- src supabase scripts vercel.json`.
- Nadruk op `supabase/migrations/20260928000200_scope_expand.sql` en `supabase/ops/**` (`backup_v2`, `restore_check_v2`, `restore_v2`, `precheck_v2`, `wp2b/…_210_scope_contract.sql`).
- Verder: `src/server/actions/{tasks,household,shopping,notifications}.ts`, `src/server/services/tasks.ts`, `src/server/system/{dispatcher,tick,planner}.ts`, `src/app/api/outbox/route.ts`, `src/domain/outbox/migrate.ts`, `src/features/household/store.tsx`, `src/server/context.ts` en `vercel.json`.

**Stack:** standaard (Next.js 16 + Supabase/PostgreSQL). **npm audit:** 0 hoog, 0 kritiek (in totaal 0 kwetsbaarheden).

**Verplicht op grond van:** niveau 2, met login, meerdere huishoudens, persoonsgegevens van minderjarigen en rollen.

**Omgeving:**
- HEAD is 091b522. Tussen 4324a46 en HEAD zijn alleen tests gewijzigd; `src`, migraties en ops zijn gelijk aan HEAD.
- `src/server/actions/tasks.ts` was tijdens de review kort anders op schijf, waarschijnlijk door `supabase/tests/mutatie.sh` van de test-writer. Ik heb met een md5 nagegaan dat wat ik gelezen heb gelijk is aan HEAD.
- Aanvalsproeven gedaan op mijn eigen databases `sec_wp2a` en `sec_wp2a_m0` (stub + alle migraties, en de M0-stappen). Beide zijn verwijderd, net als `/tmp/secwp2a`.
- Een eigen database uit de onderbroken sessie was er niet. De overige databases (`takenlijstje_m0`, `mut_*`, `takenlijstje_test` enzovoort) zijn niet van mij en heb ik laten staan. `supabase/ops/m0/run.sh` heb ik bewust niet zelf gedraaid, omdat het de gedeelde database `takenlijstje_m0` weggooit. Ik heb dezelfde stappen op mijn eigen database uitgevoerd.

### Toegangstabel
| Endpoint/action | Huidige gebruiker uit | Id's uit invoer | Eigendom gecontroleerd? |
|---|---|---|---|
| RPC `complete_task` v2 (`_200`:26) | `auth.uid()` via `is_member` | task_id, mutation_id | ja: eerst lidmaatschap zonder lock, daarna `for update`. Vreemd en onbekend geven allebei P0002 (getest). Het idempotentiepad met een vreemde mutation-id geeft ook P0002 (getest) |
| RPC `complete_task` oude signatuur (`_200`:105) | idem (roept v2 aan) | + p_completed_by | ja. De persoon wordt genegeerd: Lynn vinkte af "namens Ellen" en het resultaat was `member_id = null`, `completed_by_member_id = null` (getest) |
| RPC `undo_complete_task` (`_200`:128) | `is_member` | task_id | ja. Vreemd, onbekend en uitgezet geven P0002; ieder actief lid mag (V-22) |
| RPC `archive_/unarchive_shopping_list` | `is_member` | list_id | ja. Vreemd, onbekend en uitgezet geven P0002; de lock komt na de check. Dubbel archiveren geeft dezelfde nieuwe lijst (getest) |
| RPC `create_household` | `auth.uid()` | geen | BR-44-check ja: een uitgezet lid en een actief lid worden allebei geweigerd (getest). Race: zie bevinding 2 |
| RPC `accept_invitation` | `auth.uid()` | token (geheim) | ja: token, e-mail en BR-44. Race: zie bevinding 2 |
| RPC `delete_household` | `auth.uid()`, actief lid | naam | ja: alleen een actieve beheerder en de exacte naam. Lid → 42501, uitgezet → P0002, en de cascade is volledig (getest) |
| RPC `delete_my_account` | `auth.uid()` (ook uitgezet) | geen | ja, maar de enige-beheerdercheck is raceable: zie bevinding 1 |
| `createTaskAction` / service | sessie (`requireMember`) | id, recurrenceId (client) | ja: RLS `can_create_tasks`, en teruglezen gefilterd op het huishouden |
| `updateTaskAction` (losse taak wordt terugkerend) | sessie | taskId, en de reeks-id is gelijk aan de taak-id | ja: `loadOwnTask` en `loadOwnSeries` met de makercheck (N1-fix; een vooraf geclaimde reeks, ook met maker = null, geeft CONFLICT) |
| `createInvitationAction` | sessie (`requireAdmin`) | id (client) | ja: RLS `is_admin` en teruglezen met `household_id` |
| `activateTemplatesAction` | sessie | templateId, recurrenceId (client) | gedeeltelijk: zie bevinding 5 |
| `addShoppingItemAction` | sessie | id (client) | ja: RLS; bij een fallback-select verbergt RLS een vreemde rij |
| `completeTaskAction` → `notify` | sessie | geen (ontvangers uit de database) | ja |
| `/api/outbox` POST | sessie via dezelfde actions; Origin- en JSON-check | kind, payload | ja: alleen bekende kinds; `assign` → DISCARDED_OBSOLETE; bij v<2 vervalt `completedBy` en strip zod onbekende velden |

### Bevindingen

1. **[LAAG] `supabase/migrations/20260928000200_scope_expand.sql:544-561` — race bij `delete_my_account`: het huishouden kan zonder beheerder en zonder leden achterblijven.**
   - **Wat er misgaat:** de functie lockt alleen de eigen rij. De telling van de andere actieve beheerders (r. 551-554, en ook in `guard_member_changes`) lockt niets.
   - **Bewijs:** ik heb een tweede beheerder aan "Buren" toegevoegd. Daarna riepen twee sessies met 1 s tussentijd `delete_my_account()` aan. Beide gaven `true`, en "Buren" houdt 0 actieve beheerders en 0 leden over. Zijn taken, notities (met `author_name`) en lijsten blijven bestaan, en niemand kan ze nog inzien of verwijderen.
   - **Misbruikscenario:** geen aanval, maar een ongelukkige gelijktijdigheid (bijvoorbeeld twee ouders die tegelijk hun account opheffen). Het gevolg is persoonsgegevens zonder eigenaar en zonder verwijderroute (AVG: bewaartermijn).
   - **Verbetering:** lock vóór de telling de huishoudrij (`select … from households where id = v_member.household_id for update`) of alle beheerdersrijen van het huishouden (`… where role='admin' for update`). Voeg een concurrencytest toe.

2. **[LAAG] `_200_scope_expand.sql:404-407` en `:471-474` — BR-44 is tot M6 te omzeilen met gelijktijdige verzoeken.**
   - **Bewijs:** gebruiker `e` accepteerde twee uitnodigingen van verschillende huishoudens tegelijk. Beide gaven OK, en `e` heeft nu 2 lidmaatschappen.
   - **Waarom LAAG:** de check is een `exists` zonder lock, en de constraint `unique (user_id)` komt pas in `_210`. Er is geen lek: `getMembership` (`src/server/context.ts`) neemt het oudste lidmaatschap. Bovendien laat M1(a) M6 dan stoppen, en daarna vangt de unique-constraint het af.
   - **Verbetering:** optioneel `pg_advisory_xact_lock(hashtext(v_user::text))` bovenaan beide RPC's. Of laat het bewust zo tot `_210`, en zet het in PROGRESS.

3. **[LAAG] `delete_my_account` is vanaf M2 via REST los aan te roepen.**
   - **Wat er gebeurt:** `deleteAccountAction` (wachtwoordcheck en auth-delete) bestaat nog niet; volgens D-029 komt die in WP7. De RPC heeft `grant execute to authenticated`. Ieder lid, ook een kind of een uitgezet lid, kan daarmee zijn lidmaatschap opheffen zonder zijn account te verwijderen. Dat is in feite "huishouden verlaten".
   - **Bewijs:** het uitgezette lid riep de RPC aan, kreeg `true` en maakte daarna een eigen huishouden aan.
   - **Waarom LAAG:** er is geen toegang tot andermans data. Het is wel een functie die niet in de spec staat. De guard verbiedt "jezelf verwijderen" via ledenbeheer juist, dus dit gaat daar omheen.
   - **Verbetering:** revoke tot WP7, of leg het bewust vast. Zie "Vragen".

4. **[LAAG] Policy `members: beheerder voegt toe` (`with check … user_id IS NULL`, uit WP1) bestaat nog.**
   - **Tussen M2 en M6:** een beheerder kan via REST nog leden zonder account aanmaken. Die verdwijnen bij M6. M5 telt opnieuw, dus dat is in orde.
   - **Na `_210`:** de policy is dode code (door `user_id not null` slaagt geen enkele insert).
   - **Verbetering:** drop de policy in `_210` en neem hem in `restore_v2.sql` op zoals nu.

5. **[LAAG] `src/server/actions/household.ts` (`activateTemplatesAction`) wijkt af van TD §5.3.**
   - **Wat er gebeurt:** `topUp(household.id, rows.map(r => r.id))` draait met de service role op client-id's, zonder dat de reeksen na de upsert worden teruggelezen (`loadOwnSeries`). Bestaat een id al, dan negeert `ignoreDuplicates` de insert, en plant de planner toch in voor die id.
   - **Waarom de impact klein is:** `topUpSeries` filtert op `household_id` en `is_active` (`services/scheduling.ts:34-35`). Een id van een ander huishouden doet dus niets. Een id uit het eigen huishouden plant alleen in wat de tick toch zou inplannen.
   - **Verbetering:** voer `topUp` alleen uit op de id's die de upsert werkelijk heeft teruggegeven (`.select('id')`). Of lees ze terug met de user-client, zoals in `updateTaskAction`.

6. **[LAAG] Vooraf claimen van id's door een ex-lid (DoS, geen lek).**
   - **Scenario:** een verwijderd lid kent task-id's uit zijn cache van het oude huishouden, maakt een eigen huishouden en maakt daarin een reeks met `id` gelijk aan zo'n oude task-id. Zet een beheerder van het oude huishouden die taak daarna om naar terugkerend, dan negeert de upsert de insert en geeft `loadOwnSeries` NOT_FOUND. Het omzetten van die ene taak mislukt dan steeds.
   - **Geen lek:** er komt geen koppeling en er lekt niets. Andere client-id's (taak, reeks, uitnodiging, boodschap, notitie) worden vlak vóór gebruik op het toestel van het slachtoffer gemaakt en zijn dus niet vooraf te claimen.
   - **Verbetering (optioneel):** een afgeleide reeks-id (uuidv5 van taak-id en huishouden-id).

7. **[LAAG] Ops-scripts zijn niet atomair.** `_210_scope_contract.sql` en `restore_v2.sql` hebben geen `begin; … commit;`.
   - **Risico:** TD M6 eist "in één transactie". Via de SQL-editor of `apply_migration` gebeurt dat impliciet, maar met `psql -f` (zoals in M0) niet. Faalt `restore_v2` halverwege, dan blijven de `updated_at`-triggers uitgeschakeld en is het schema half teruggezet.
   - **Geen securitygat**, wel een risico voor de gegevensintegriteit.
   - **Verbetering:** zet expliciet `begin;`/`commit;` in beide bestanden.

8. **[LAAG] N3 uit WP1 staat nog open.** TD §4.1 (r. 156) noemt de CSP met nonce nog bij "WP8"; D-018 en §15 zeggen WP9. Dit is documentatie en hoeft niet in WP2a. Er is nog steeds geen `script-src`-beperking.

**Per categorie:**
- **A. Wachtwoorden:** niet geraakt in WP2a; Supabase Auth, ongewijzigd. Niets gevonden.
- **B. Sessies:** het cookie `tl_household` en de huishoudenkeuze zijn weg (`context.ts`). Het lidmaatschap komt alleen uit de sessie. Niets gevonden.
- **C. Autorisatie en isolatie:** zie de tabel, en bevindingen 1-6. Wat is getest en dicht:
  - vreemd en onbekend geven hetzelfde antwoord bij `complete`, `undo`, `archive` en `unarchive`;
  - een uitgezet lid wordt overal geweigerd;
  - alleen de beheerder kan het huishouden verwijderen, en de cascade is volledig (0 rijen over);
  - de BR-44-check werkt (buiten de race);
  - de rechten zijn in orde: anon kan alleen `get_invitation` uitvoeren, in `private` zijn alleen de 7 policyhelpers aanroepbaar, en elke security definer heeft `search_path=''`.
- **Notities / `author_name` (vraag 2), alles getest:**
  - een vervalste `author_name` wordt overschreven met de naam van het lid;
  - een insert als Ellen of met `member_id = null` wordt door RLS geweigerd;
  - een directe update raakt 0 rijen;
  - een upsert met `do update` wordt door RLS geweigerd;
  - de naamsynchronisatie werkt, zowel bij een eigen naamswijziging als wanneer de beheerder de naam wijzigt;
  - lid verwijderd → `member_id` wordt null en `author_name` blijft staan;
  - de uitzondering voor diepte > 1 is alleen bereikbaar via `sync_comment_author` en de FK-actie. Er is geen andere trigger die naar `task_comments` schrijft.
  - Niets gevonden.
- **Voorkeuren (vraag 3):**
  - een nieuwe beheerder krijgt alles aan en `task_completed` uit; een nieuw gezinslid krijgt alles uit (getest via `accept_invitation`);
  - de eenmalige update raakt alleen `role='member'`, en niet `push_enabled` of de tijden;
  - een uitgezet lid kan zijn voorkeuren niet wijzigen (0 rijen).
  - Niets gevonden.
- **D. Geheimen:** geen nieuwe geheimen. `vercel.json` schakelt previews uit voor `v2-ui` en `claude/**` (D-035), zodat de live database niet vanuit een preview wordt geraakt. Niets gevonden.
- **E. Invoer:** zod in alle actions, en de database-constraints vangen directe RPC-aanroepen op (note ≤ 500, naam ≤ 80, display_name ≤ 50, tijdzone vast). `/api/outbox`: een onbekende kind komt terug in de JSON-fouttekst; dat is onschuldig (JSON, en React escapet) en bestond al. Niets nieuws.
- **F. Extern:** niet geraakt.
- **G. Afhankelijkheden:** npm audit schoon.
- **H. Informatielek:** het bestaat-orakel (N2) is dicht. Er is een orakel op mutation-id's (vreemde id → P0002, onbekende id → succes), maar die id's zijn niet te raden. Te verwaarlozen.
- **I. AVG / meldingen (vraag 4):**
  - `notify` bepaalt de ontvangers met `recipientsFor`: actief, met account, voorkeur aan, zonder actorfilter. "Taak gedaan" gaat dus ook naar wie afvinkte (V-38a). De teksten zijn "X is gedaan", "X is verlopen" en tellingen voor het hele huishouden, zonder "voor jou". De toast in `store.tsx:381` toont alleen de titel.
  - De database zet geen persoonsvelden meer: er is geen default of trigger op `completed_by`, `bought_by` of `added_by`, en v2 schrijft ze niet.
  - Wel een aandachtspunt: tussen M2 en M6 blijven de historische `task_completions.member_id`, `tasks.completed_by_member_id` en `shopping_items.bought_by/added_by` via REST leesbaar voor huisgenoten. Dat is bekend en verdwijnt bij M6, maar houd het venster M2–M6 kort.
  - De realtime-toast verschijnt niet op het toestel van wie afvinkte. Dat hoort bij realtime en is geen opgeslagen gegeven.
- **Ops (vraag 6), op een eigen database getest:**
  - **Back-up:** het schema heeft geen USAGE voor anon, authenticated of service_role, en er staan 0 tabelrechten voor anon, authenticated, PUBLIC of service_role. Het schema staat ook niet in de exposed schemas. In orde (V-33, AC-056).
  - **Contract:**
    - gewist volgens BR-46.3: de 6 meldingssoorten, de open uitnodiging die aan een lid zonder account hing, het lid zonder account (zijn voorkeur en zijn herinnering gingen mee door cascade, conform de TD), de drie tabellen en de kolommen;
    - behouden: taken, historie, notities, reeksen, makers, boodschappen en pushabonnementen (ongewijzigd);
    - na afloop: 0 privacykolommen en geen functies die nog naar vervallen kolommen verwijzen.
    - Randgeval: een al geaccepteerde uitnodiging met `member_id` van een lid waarvan het account later verwijderd is, verdwijnt ook door de cascade. Dat valt formeel buiten BR-46.3, maar het is onschuldig.
  - **Terugzetten:** RLS staat aan, de policies zijn gelijk aan de WP1-stand (`_100`), er zijn geen security-definerfuncties zonder `search_path`, en alleen de 7 private-helpers zijn aanroepbaar. De teruggezette `accept_swap_request` heeft het oude lock-vóór-check-patroon. Dat is aanvaardbaar, want het geldt alleen na een rollback.
  - `restore_check_v2`: revoke op het schema en een drop aan het eind. In orde.
- **J.** Niet van toepassing op niveau 2 zonder publieke bereikbaarheid, afgezien van N3.
- **`/api/outbox` (vraag 7):** `assign` wordt DISCARDED_OBSOLETE met een vast label, v2 van een oude server → 503 future, en de Origin- en content-type-check blijft. Niets gevonden.

### Wat goed is
- Het N2-orakel is aantoonbaar dicht: "Taak niet gevonden" is identiek voor vreemd, onbekend en uitgezet, en er wordt pas gelockt na de lidmaatschapscheck, bij alle nieuwe RPC's.
- `author_name` wordt altijd door de database gezet. De guard laat alleen synchronisatie en de FK-actie door, en er is geen update-policy.
- De oude `complete_task`-signatuur negeert de persoon echt (getest). Een terugrol tussen M2 en M6 schrijft dus geen persoon meer.
- Het back-upschema is dicht voor alle API-rollen, en het terugzetscript herstelt de WP1-rechten exact.
- De ontvangers van meldingen worden server-side bepaald zonder actor, en de teksten bevatten geen namen.

### Doorgeven aan test-writer
- Concurrency: twee beheerders tegelijk `delete_my_account` → er blijft minstens één actieve beheerder over (na de fix van bevinding 1).
- BR-44: twee `accept_invitation`-aanroepen of `create_household` tegelijk voor dezelfde gebruiker → hooguit één lidmaatschap (na de fix, of na `_210`).
- Regressie N2: `complete_task` v2, de oude signatuur, `undo`, `archive` en `unarchive` op een vreemd en een onbekend id → identieke SQLSTATE en tekst.
- Oude signatuur met `p_completed_by` gelijk aan een ander lid → `member_id` null in de completion en in de taak.
- Notities: vervalste `author_name`, een upsert met `on conflict do update`, en `member_id` null bij de insert → geweigerd of overschreven.
- `activateTemplatesAction` met een bestaande recurrenceId van een ander huishouden → geen planning en geen fout die iets lekt.
- Outbox: v1 `complete` met `completedBy` → er wordt geen persoon opgeslagen; v1 `assign` → DISCARDED_OBSOLETE.

### Vragen voor de hoofdsessie
- **Bevinding 3:** mag een lid vanaf M2 via de API zelf het huishouden verlaten zonder zijn account te verwijderen, of moet `delete_my_account` tot WP7 dicht? Mijn voorstel: `revoke` tot WP7. Dit is een productkeuze voor Jurgen, omdat het ook kinderen betreft.
- Bevindingen 1 en 2 (LAAG): herstellen in WP2a/WP2b, of bewust uitstellen in PROGRESS? Mijn advies voor 1: herstellen, want de fix is één `for update`.

### Conclusie
**GO** voor livegang van WP2a (M2 = expand + deploy). Er staat geen enkel BLOKKEREND- of GEMIDDELD-punt open. De isolatie tussen huishoudens, het uitgezette lid, het dichte N2-orakel en de privacyregels voor meldingen en notities zijn met aanvalsproeven bevestigd. Wat overblijft is LAAG. Voorwaarde voor M6 (niet voor M2): M1(a) opnieuw draaien vlak vóór M5, vanwege bevinding 2.
