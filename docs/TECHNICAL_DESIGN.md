# Technisch ontwerp — Takenlijstje (herwerking van de live app)

Versie: ronde 1 (2026-09-28) · Kwaliteitsniveau 2 · Werkwijze §15 (bestaand project), fase 5.
Auteur: solution-architect. Document voor de bouwer (Claude); technische termen zijn bewust.

**Basis (gelezen):** `docs/PROGRESS.md` (bindende besluiten V-01…V-35), `docs/PRODUCT_SPEC.md` (ronde 3, BR/UC), `docs/UX_SPEC.md` (ronde 4, §12 punten voor de architect), `docs/ACCEPTANCE_CRITERIA.md` (ronde 1), `docs/reviews/plan-critic.md` (ronde 1), `docs/DESIGN_SYSTEM.md` (ronde 1), `docs/INVENTARIS.md` (§3, §7), `docs/ARCHITECTUUR.md`, en de code: `supabase/migrations/2026092700{0100,0200,0300,0400}_*.sql`, `supabase/tests/*`, `supabase/cron/schedule-tick.sql`, `src/server/**`, `src/lib/**`, `src/domain/**`, `src/features/household/*`, `src/app/**` (layouts, auth-routes, api), `public/sw.js`, `vercel.json`, `tests/e2e/**`.

**Uitgangspunt.** Dit is een herwerking, geen nieuwbouw. De stack, het datamodel-principe (alles aan `household_id`, samengestelde FK's `(id, household_id)`), RLS op elke tabel, de pure domeinlaag, de offline-wachtrij en het idempotente afvinken blijven. Wat verandert:
1. het rechtenmodel wordt dichtgezet (B-01…B-05, V-29);
2. het datamodel volgt de scopewijziging (V-21/V-22/V-24/V-25): geen toewijzing, punten, ruilen, afwezigheid, "wie afvinkte" en leden zonder account;
3. de planner draait echt elke 15 minuten (R-01) en de tick wordt set-gebaseerd (R-02);
4. laden, fouten, offline en sheets krijgen een vaste structuur (S-01…S-04, UX §12);
5. de visuele laag wordt vervangen volgens `DESIGN_SYSTEM.md`.

Ronde 2 (2026-09-28): Jurgen heeft V-30 t/m V-35 beantwoord met "Volg je voorstellen" (letterlijk in `docs/PROGRESS.md`). Ronde 3 (2026-09-28): de bevindingen van de plan-critic (ronde 1) die bij het technisch ontwerp horen, zijn verwerkt. Ronde 4: V-36 t/m V-39 verwerkt; er zijn geen open plekken meer (zie §17).

---

## 1. Stack en versies (met bron)

| Onderdeel | Versie nu (package.json) | Besluit | Bron / controle |
| --- | --- | --- | --- |
| Next.js (App Router, Server Actions, `proxy.ts`) | 16.3.6 | **Behouden.** In WP1 bijwerken naar **16.3.7** (geplande securityrelease van 30-09-2026, "critical upstream issue") | [Next.js blog, security update 22-09-2026](https://nextjs.org/blog/upcoming-nextjs-security-release-september-22-2026), [Next.js 16](https://nextjs.org/blog/next-16), [Upgrading to 16](https://nextjs.org/docs/app/guides/upgrading/version-16) |
| React | 19.2.8 | Behouden | package.json |
| TypeScript | ^5 | Behouden | — |
| Supabase JS / SSR | supabase-js 2.117.2, @supabase/ssr 0.12.7 | Behouden. Auth-flows (PKCE, `verifyOtp` met `token_hash`, `resetPasswordForEmail`, `updateUser`) | [Supabase password reset (docs op GitHub)](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/passwords.mdx), [resetPasswordForEmail](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail) |
| PostgreSQL | Supabase-project `nmorjuafndteklvobrmt`, **eu-central-1** (V-20); lokaal PG 16.13 | Behouden; geen Prisma (de app gebruikt supabase-js + RLS; een tweede datalaag voegt niets toe) | PROGRESS V-20 |
| Planner | nu Vercel Cron 1×/dag (`vercel.json`, 05:30 UTC) | **Vervangen** door Supabase Cron (pg_cron + pg_net) elke 15 min in het eigen project, geheim in Vault (besluit V-32; gratis op alle plannen) | [Supabase Cron](https://supabase.com/docs/guides/cron), [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions). Vercel Hobby: cron maximaal 1× per dag, en de aanroep valt ergens binnen het opgegeven uur: [Vercel cron usage & pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing), [samenvatting](https://steadycron.com/guides/vercel-cron-limits/) |
| Zod | 4.6.5 | Behouden (invoerschema's in `src/lib/validation.ts`) | — |
| Tailwind | 4 | Behouden; tokens volgens `DESIGN_SYSTEM.md` §4 (één bron in `globals.css`) | DESIGN_SYSTEM §4 |
| Radix (`radix-ui`), lucide-react, sonner, dnd-kit, idb-keyval, web-push, date-fns(-tz) | zie package.json | Behouden | — |
| Lettertype | systeemletter | Figtree via `next/font/local` (zelf gehost), variabel, subset latin (besluit V-31). Accentkleur `#2B4C9B` en app-icoon in die tint (besluit V-30) | DESIGN_SYSTEM §3 |
| Tests | vitest 5, Playwright 1.56, `supabase/tests/run.sh` (PG 16), lokale stack `tests/e2e/support/` | Behouden en uitbreiden (§13) | INVENTARIS §4 |
| ESLint | 9 (niet meer ondersteund) | Bijwerken in de hardening-WP naar de versie die `eslint-config-next@16.3.x` ondersteunt; keuze in `DECISIONS.md` | INVENTARIS §7 |

**Gecontroleerd en relevant voor dit ontwerp:**
- **Supabase Free heeft geen downloadbare platform-back-up.** Een eigen export (`pg_dump` / `supabase db dump`) is daar de aanbevolen weg. Pro heeft dagelijkse back-ups. ([Supabase backups](https://supabase.com/docs/guides/platform/backups), [Backup/restore via CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)) → gebruikt in §12.4.
- **pg_cron is beschikbaar op alle plannen.** Samen met pg_net kan het een HTTP-aanroep plannen; het geheim hoort in Supabase Vault. (Supabase Cron-docs, zie boven.)
- **Vercel Hobby:** cron maximaal één keer per dag, met een precisie van een uur. Een schema met een hogere frequentie laat de deployment mislukken.
- De webdocumentatie van vercel.com en supabase.com was vanuit deze omgeving niet rechtstreeks te openen (egress geblokkeerd). De punten hierboven komen uit zoekresultaten die naar die pagina's verwijzen. **Controleer ze bij WP3** in het dashboard van het project zelf.

## 2. Systeemgrenzen (client / server / extern)

```
Telefoon (PWA)                         Vercel (Next.js, server)                        Supabase (eu-central-1)
──────────────                         ────────────────────────                        ───────────────────────
Service worker (public/sw.js)          proxy.ts: sessie verversen, /login-redirect     PostgreSQL + RLS (laatste verdediging)
  • statisch: cache-first                                                                • RPC's (security definer, eigen rechtencheck)
  • pagina's: netwerk-eerst, 3 s       (app)/layout.tsx: shell + <Suspense> data       • triggers (guards, standaardvoorkeuren)
    time-out → cache → /offline        Server actions (formulieren) + POST /api/outbox  Auth (wachtwoord, magic link, herstel)
  • push tonen, klik → interne URL       zod → requireMember/Admin → service →          Realtime (postgres_changes, RLS)
HouseholdProvider (client store)         user-client (RLS) of RPC                      Vault (CRON_SECRET) + pg_cron + pg_net
  • snapshot + slices, optimistisch    src/server/system/** (ENIGE plek service role):  (V-32)
  • outbox (IndexedDB), cache (IDB)      planner (alleen invoegen), tick, dispatcher,
  • Realtime-abonnement                  push, account verwijderen (auth-admin)
  • leest RLS-data met anon-sleutel    /api/cron/tick (Bearer CRON_SECRET) ◄──────────── pg_cron elke 15 min → pg_net
                                                                                         (vercel.json 1×/dag blijft als vangnet)
Extern: Web Push-diensten van Apple/Google (versleutelde payload met taaktitel), Supabase Auth-mail,
        huisvuilkalender.denhaag.nl (alleen vanaf de server; W-03, §18.1).
```

- **Client-side JavaScript blijft nodig voor de kernflow.** Afvinken moet optimistisch en offline werken, en Realtime ververst de stand. Alles wat niet interactief is, blijft server component: statische delen van de instellingenpagina's, de uitnodiging, inloggen en de foutpagina's.
- **Schrijven** gaat altijd via een server action of een RPC. De client schrijft nooit rechtstreeks naar tabellen. **Lezen** kan in de browser met de anon-sleutel en de gebruikerssessie; RLS filtert. Dat gebeurt bij verversen, meer laden en periodes laden.
- **De service role bestaat alleen in `src/server/system/**`** (§5.3). Geen user-flow krijgt er een algemene client van.

## 3. Datamodel

### 3.1 Doelmodel (na WP2b)

Alle tabellen hebben RLS. `(id, household_id)`-FK's blijven de isolatiegrens (BR-26). ✱ = gewijzigd, ✚ = nieuw, ✖ = vervalt.

| Tabel | Kolommen (relevant) | Constraints / indexen | Verwijdergedrag |
| --- | --- | --- | --- |
| `users` | id → auth.users, email, display_name, created_at | — | cascade vanuit `auth.users` |
| `households` ✱ | id, name, timezone, members_can_create_tasks, onboarding_completed, created_by, timestamps. ✖ `members_can_assign_others`, `points_enabled`, `points_goal`, `points_goal_reward` | — | verwijderen = alles van het huishouden weg (cascade), alleen via RPC `delete_household` |
| `household_members` ✱ | id, household_id, **user_id NOT NULL**, display_name, color, icon, role, is_active, sort_order, created_at. ✖ `email` (dubbel met `users.email`), ✖ `avatar_url` (ongebruikt; de UI toont emoji en kleur) | ✚ `unique (user_id)` (BR-44: één huishouden per persoon; vervangt `unique (household_id, user_id)`), `unique (id, household_id)` | ✱ `user_id → users on delete cascade` (was `set null`: een lid zonder account bestaat niet meer) |
| `household_invitations` ✱ | id (✱ mag door de client worden gegenereerd), household_id, email, role, token, invited_by_member_id, expires_at, accepted_at, accepted_by, created_at. ✖ `member_id` | token uniek | cascade met het huishouden; opruimen na 30 dagen (§3.4) |
| `task_templates` ✱ | ✖ `points` | ongewijzigd | ongewijzigd |
| `task_recurrences` ✱ | id (✱ mag door de client worden gegenereerd), rule, window, starts/ends, paused_from/until, reminder_minutes_before, is_active, generated_until, **created_by_member_id** (maker, niet getoond; V-25). ✖ `assignment_strategy`, `fixed_member_id`, `rotation_member_ids`, `points` | ongewijzigd | `created_by_member_id on delete set null` → daarna beheren alleen beheerders (PRODUCT_SPEC §6) |
| `tasks` ✱ | … `status` (todo/in_progress/done/skipped), `is_exception`, `completed_at`, `created_by_member_id`, `deleted_at`. ✖ `assigned_member_id`, `assignment_reason`, `completed_by_member_id`, `points`. ✚ (W-03) waste_pickup_date, waste_direction, waste_streams | `unique (recurrence_id, occurrence_date)` blijft. ✖ `tasks_assigned_idx`. ✚ `tasks_open_sched_idx (scheduled_date) where status in ('todo','in_progress') and deleted_at is null` (tick over alle huishoudens). ✚ (W-03) tasks_waste_key unique (household_id, waste_pickup_date, waste_direction) + check tasks_waste_shape; zie §18.3.2 | soft delete voor reekstaken (`deleted_at`) zodat de planner ze niet opnieuw aanmaakt; losse taak zonder historie hard delete; vervallen open afvaltaken: hard delete door het systeem (§18.3.2) |
| `task_completions` ✱ | id, household_id, task_id, recurrence_id, title, category, completed_at, scheduled_date, due_at, was_late, minutes_late, duration_minutes, note, client_mutation_id. **✖ `member_id`**, ✖ `points` | `client_mutation_id unique` blijft. ✚ **`unique (task_id)`** (BR-11 als constraint: er is per taak hooguit één registratie tegelijk; terugdraaien verwijdert hem) | `task_id on delete set null`: historie blijft (BR-12); na 2 jaar weg (BR-45) |
| `task_comments` ✱ | id, household_id, task_id, member_id (schrijver), body, created_at, ✚ `author_name text not null` = **de laatst bekende naam van de schrijver** (V-34) | — | cascade met de taak. `member_id` wordt `null` als het lid of account verdwijnt; `author_name` blijft staan en wordt getoond (besluit V-34). **De UI toont altijd `author_name`**; `member_id` dient alleen voor het verwijderrecht. Regels: zie hieronder |
| `notifications` ✱ | ongewijzigd, behalve ✱ `type` (enum zonder `task_assigned`, `swap_request`, `swap_accepted`; ✚ waste_sync_failed, W-03) en ✱ `url` check | ✱ `check (url is null or url ~ '^/([^/\\]|$)')` (geen `//host` of `/\host`: B-03) | cascade met het lid; na 90 dagen weg |
| `push_subscriptions` | ongewijzigd | — | weg bij 404/410, bij uitloggen op dat toestel, en met het account (cascade) |
| `user_preferences` ✱ | ✖ `notify_task_assigned`, `notify_swap_requests`. Standaardwaarden per rol (V-23), zie §3.3 | — | cascade met het lid |
| `shopping_lists` ✱ | ✖ `created_by_member_id` (geen functie; dataminimalisatie) | ✚ partiële unieke index `(household_id) where archived_at is null` (altijd precies één actieve lijst; maakt archiveren idempotent) | gearchiveerd: na 1 jaar weg (items cascade) |
| `shopping_items` ✱ | ✖ `added_by_member_id`, `bought_by_member_id` (V-25) | ongewijzigd | cascade met de lijst |
| waste_calendars ✚ (W-03) | household_id (PK), postcode, house_number, house_suffix, bag_id (V-58), pickups (jsonb), version, last_attempt_at, last_success_at, last_error_code, error_since, last_failure_at (alleen waste_sync), alarm_since; error_since, last_failure_at en alarm_since in plaats van failure_count | checks op vorm en storingskolommen; RLS alleen select voor beheerders; zie §18.3.1 | cascade met het huishouden; weg bij uitzetten |
| ✖ `task_assignments`, `task_swap_requests`, `member_absences` | vervallen (V-21, V-24) | — | gewist na back-up en bevestiging (§12.4) |
| ✖ enums `assignment_strategy`, `absence_strategy` | vervallen | — | — |

**`task_comments.author_name` — regels** (plan-critic punt 5, AC-143, V-34):
- **Gezet door de database, nooit door de client.** De trigger `private.set_comment_author()` (before insert) zet `author_name` op de `display_name` van `new.member_id` en negeert elke meegestuurde waarde. De trigger `private.guard_comment_changes()` (before update) weigert elke wijziging van `author_name`, `member_id`, `body`, `task_id` en `household_id` door een gebruiker. Er is ook geen update-policy. **Uitzondering (plan-critic r2, aanbeveling 3):** updates die uit een andere trigger of een FK-actie komen, mogen door. Dat zijn de naamsynchronisatie hieronder en `member_id → null` via `on delete set null`. Herkenbaar aan `pg_trigger_depth() > 1`: bij een directe update van een gebruiker draait de guard op diepte 1. Ook dan zijn alleen deze twee wijzigingen toegestaan: `author_name` bij een ongewijzigd `member_id`, en `member_id` naar `null`. Al het andere blijft geweigerd.
- **Naamswijziging:** de trigger `private.sync_comment_author()` (after update of `display_name` on `household_members`) zet `author_name` van alle notities met die `member_id` op de nieuwe naam. Een paar rijen per lid.
- **Keuze: "laatst bekende naam" in plaats van "momentopname bij plaatsen" of "actuele naam, anders momentopname".**
  - AC-143 vraagt dat huisgenoten de nieuwe naam zien. Een momentopname zou de oude naam blijven tonen.
  - V-34 vraagt dat de naam blijft staan als het lid verdwijnt. De laatst bekende naam blijft dan gewoon in de kolom.
  - Eén veld dat altijd getoond wordt, is eenvoudiger dan een UI-regel die tussen twee bronnen kiest. Die regel zou ook falen bij notities die niet in de snapshot staan.
- **DB-tests:**
  - insert met een vervalste `author_name` → de naam van het lid wordt opgeslagen;
  - naamswijziging → de notities tonen de nieuwe naam;
  - lid verwijderd → `member_id` wordt null (FK-actie, niet geweigerd door de guard) en `author_name` blijft;
  - naamswijziging via `household_members` → de synchronisatie slaagt ondanks de guard;
  - directe update van `author_name` of `member_id` door een gebruiker (diepte 1) → geweigerd.

**Afgeleid, niet opgeslagen:** "verlopen" (BR-17, `src/domain/status.ts`), "te laat" wordt bij afvinken vastgelegd als historisch feit (dat is geen afleiding achteraf), tellingen voor Overzicht en het dag- en avondoverzicht.

**Privacy-invariant (succescriterium 7):** na WP2b bestaat er **geen kolom** die vastlegt wie iets afvinkte, kocht of toevoegde. Een databasetest (`supabase/tests/30_privacy.sql`) bevraagt `information_schema.columns` op de tabellen `tasks`, `task_completions` en `shopping_items`. Hij faalt als een van deze kolommen bestaat: `completed_by*`, `member_id`, `added_by*`, `bought_by*`.

### 3.2 Migraties (bestandsnamen; datumprefix bij bouwen)

Alle migraties staan in `supabase/migrations/` en draaien in `supabase/tests/run.sh` en in `tests/e2e/support/local-stack.sh`. Voor live geldt: eerst lokaal groen, dan toepassen. Een destructieve stap alleen volgens §12.4.

| Bestand | WP | Soort | Inhoud |
| --- | --- | --- | --- |
| `…_100_rechten_actief_lid.sql` | WP1 | niet-destructief | `private.is_member`/`is_admin`/`my_member_id` eisen `is_active` (V-29); nieuwe helpers (§5.2); policies herschreven; `household_members`: eigen rij altijd leesbaar; `guard_member_changes` uitgebreid (minstens één **actieve** beheerder, jezelf niet uitzetten of verwijderen via ledenbeheer, `created_by`/`household_id` onveranderlijk); `guard_task_changes` uitgebreid (maker, `household_id`, `recurrence_id`, `occurrence_date`, `deleted_at` alleen via RPC of door wie mag verwijderen); **policy `notifications: huisgenoten informeren` vervalt** (B-03); `url`-check; `revoke execute` op triggerfuncties en niet-policyfuncties in `private` voor `authenticated` (B-04) |
| `…_110_reeks_rpcs.sql` | WP1 | niet-destructief | RPC's `stop_series`, `pause_series`, `resume_series`, `clear_series_occurrences`, `delete_task` (§6), elk met eigen rechtencheck en in één transactie |
| `…_200_scope_expand.sql` | WP2a | niet-destructief, compatibel met de oude code | nieuwe signatuur `complete_task(p_task_id, p_mutation_id, p_note, p_completed_at)` (de oude functie blijft tijdelijk bestaan, maar negeert `p_completed_by` en schrijft geen persoon meer); `undo_complete_task`: ieder actief lid (V-22); `author_name` toevoegen, vullen uit `household_members.display_name` (bestaande notities; notities zonder lid krijgen "Gezinslid"), plus de triggers `set_comment_author`, `guard_comment_changes` en `sync_comment_author` (§3.1, V-34); standaardvoorkeuren per rol via trigger; `archive_shopping_list`/`unarchive_shopping_list`; `accept_invitation`/`create_household` met BR-44-check; `delete_household`, `delete_my_account` (§6); partiële unieke index actieve boodschappenlijst |
| `…_210_scope_contract.sql` | WP2b | **DESTRUCTIEF** — alleen na back-up, restore-test en **bevestiging van Jurgen** (§12.4) | gegevens wissen volgens BR-46 (inclusief de bestaande meldingen `task_completed`, `daily_summary` en `evening_summary`, §12.4), daarna de kolommen, tabellen en enumwaarden uit §3.1 droppen, `household_members.user_id not null` en `unique (user_id)`, `unique (task_id)` op `task_completions`, oude `complete_task`-signatuur droppen, realtime-publicatie bijwerken (zonder `task_swap_requests`) |
| `…_300_retentie.sql` | WP3 | niet-destructief (de functie zelf wist pas als hij wordt aangeroepen) | `private.purge_expired_data()` + `public.run_purge()` (alleen `service_role`) (§3.4) |
| …_320_afval_meldingstype.sql | WP3b | niet-destructief | alleen alter type … add value if not exists 'waste_sync_failed'; apart bestand, omdat de waarde pas na de commit bruikbaar is. Zie §18.3.4 |
| …_330_afvalkalender.sql | WP3b | niet-destructief (additief; de oude code blijft werken) | waste_calendars met last_failure_at, alarm_since en checks op de storingskolommen + RLS + grants; drie tasks-kolommen, check en sleutel; guard, policies en delete_task vervangen; trigger waste_skip_cascade; RPC's waste_save, waste_sync (met p_move), disable_waste_calendar, waste_calendar_enabled; daarna opnieuw revoke execute op private (patroon …_110). Zie §18.3.4 |
| supabase/ops/waste_rollback.sql (geen migratie) | WP3b | ops-script, alleen bij een noodterugrol | verwijdert open afvaltaken (§18.16) |
| `supabase/ops/planner.sql` (geen migratie) | WP3 | ops-script, eenmalig op live | pg_cron en pg_net aanzetten, geheim in Vault, `cron.schedule` elke 15 minuten (V-32). Geen migratie: de lokale test-PG heeft geen pg_cron, en de URL verschilt per omgeving. Vervangt `supabase/cron/schedule-tick.sql` |
| `supabase/ops/precheck_v2.sql`, `backup_v2.sql`, `restore_v2.sql`, `restore_check_v2.sql` | WP2a/WP2b | ops-scripts | voorcontroles (alleen lezen), back-up, terugzetten en de controle daarop (§12.4) |

### 3.3 Standaardvoorkeuren meldingen (V-23)

Trigger `private.create_member_preferences()` zet bij een nieuw lid, afhankelijk van `new.role`:
- beheerder: `notify_reminders`, `notify_deadline_soon`, `notify_overdue`, `daily_summary_enabled` en `evening_summary_enabled` staan aan;
- gezinslid: al deze soorten staan uit;
- `notify_task_completed` staat voor iedereen uit.

Een rolwijziging achteraf verandert de voorkeuren niet: het zijn de voorkeuren van de persoon.

**Bij de migratie** (`…_200`) krijgen bestaande gezinsleden (`role = 'member'`) eenmalig de nieuwe standaard. Zo volgt het "standaard uit voor Lynn en Kai" uit V-23. De rijen van beheerders blijven ongewijzigd.

### 3.4 Bewaartermijnen (BR-45) — hoe opgeruimd

`private.purge_expired_data()` draait via `public.run_purge()` (security definer, `execute` alleen voor `service_role`). Aanroep: bij elke tick, als stap 4. De functie is idempotent en goedkoop (een handvol deletes met een indexfilter). Een apart schema voor dit opruimen voegt niets toe.

| Gegevens | Regel (SQL-filter) |
| --- | --- |
| Afvinkhistorie | `task_completions.completed_at < now() - interval '2 years'` |
| Meldingen | `notifications.created_at < now() - interval '90 days'` |
| Gearchiveerde lijsten | `shopping_lists.archived_at < now() - interval '1 year'` (items cascade) |
| Uitnodigingen | `coalesce(accepted_at, expires_at) < now() - interval '30 days'` |
| Zacht verwijderde taken (technisch) | `tasks.deleted_at < now() - interval '90 days' and occurrence_date < current_date - 30` → hard delete. De historie blijft via `task_id set null` |
| Pushabonnementen | geen tijdtermijn: weg bij 404/410 (bestaand, `channels/web-push.ts`), bij uitloggen op dat toestel (nieuw, §4.4) en met het account |

De functie geeft tellingen per tabel terug. De tick logt alleen die tellingen.

## 4. Authenticatie

Supabase Auth blijft de enige identiteitsbron. De app slaat nooit wachtwoorden op. Hashing (bcrypt), tokens en rate limits op inloggen, OTP en herstel liggen bij Supabase Auth.

### 4.1 Sessies
- **Cookies** via `@supabase/ssr`: `Secure` in productie en `SameSite=Lax`. De bibliotheek zet `Secure` niet zelf; de app geeft dit mee via `cookieOptions` in de server-, browser- en proxyclient (W-02, akkoord Jurgen 2026-09-28; D-019).
- **Afwijking van de standaardeis "HttpOnly", bewust.** De browser-client van `@supabase/ssr` moet het token lezen voor Realtime en voor lezen onder RLS in de browser. Beperkt door:
  - geen HTML uit gebruikersinvoer;
  - een CSP met nonce in `proxy.ts` (WP8);
  - korte JWT-levensduur (Supabase-standaard 1 uur) met refresh.

  De security-reviewer beoordeelt dit in WP1.
- `proxy.ts` (bestaand) ververst de sessie met `getUser()`, dat het token valideert, en stuurt zonder sessie naar `/login?next=`. **Uitzondering (plan-critic r2, aanbeveling 4):** `/api/outbox` staat in de lijst waarvoor de proxy niet doorstuurt. Zonder sessie komt er dan een **401 in JSON** terug in plaats van een redirect naar de HTML van `/login`. De wachtrij herkent die 401 en laat de entry staan (§9.3.1). De route controleert de sessie zelf met `requireMember()`. De lijst `PUBLIC_PATHS` wordt: `/api/outbox` (authenticatie in de route zelf), `/login`, `/wachtwoord-vergeten`, `/auth`, `/invite`, `/offline`, `/api/cron`, `/api/status` (met Bearer, zie B-05), `/manifest.webmanifest`, `/sw.js`.
- **Uitloggen** maakt het refresh-token ongeldig (`signOut()`, scope `local`). Na een wachtwoordwijziging: `signOut({ scope: 'others' })`, zodat andere toestellen hun sessie verliezen.

### 4.2 Inloggen, registreren, wachtwoord vergeten (UC-11, V-14, V-05)
- **`/login`:** e-mail + wachtwoord (`signInWithPassword`) of een inloglink (`signInWithOtp`, `shouldCreateUser: false`). De tab "Nieuw" verdwijnt. Registreren (`signUp`) blijft alleen in `/invite/[token]` en in `/onboarding` (V-05: de open registratie blijft technisch bestaan).
- **Foutmelding:** altijd dezelfde tekst ("E-mailadres of wachtwoord klopt niet"). Bij de rate limit van Supabase (429): "Te veel pogingen. Wacht even en probeer het opnieuw."
- **Wachtwoord vergeten:**
  1. `/wachtwoord-vergeten` → server action `requestPasswordResetAction(email)` → `supabase.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL + '/auth/confirm?next=/wachtwoord/nieuw' })`. Het antwoord is altijd hetzelfde, dus het bestaan van een adres lekt niet.
  2. Mailtemplate "Reset password" in Supabase met de `token_hash`-variant: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/wachtwoord/nieuw`. De tekst wordt Nederlands. **V-35:** de bouwer past de template, de minimale wachtwoordlengte (8) en de redirect-allowlist (`SITE_URL/auth/confirm`) aan via de Supabase-koppeling. Kan de koppeling dat niet, dan krijgt Jurgen een korte stappenlijst (Authentication → Emails / Sign In / URL Configuration). Het resultaat wordt gecontroleerd met een echte herstelmail naar Jurgens adres.
  3. `/auth/confirm` (bestaat al) → `verifyOtp` → sessie → `/wachtwoord/nieuw` → `updatePasswordAction(password)`: zod, minimaal 8 tekens. Dan volgt `updateUser({ password })`, `signOut({ scope: 'others' })` en een redirect naar `/`.
  4. Verlopen link: `/auth/confirm` stuurt door naar `/login?fout=link-verlopen` met "Nieuwe link sturen".
  5. De Supabase-instelling "minimale wachtwoordlengte" wordt 8, gelijk aan de UI. De geldigheid van de link is 1 uur (standaard e-mail-OTP-verloop 3600 s).
- **Onboarding-tekst over Google/Apple** verdwijnt (V-14).

### 4.3 Uitgezet lid (V-29) — afgedwongen in de database
- `is_active = false` betekent: `private.is_member()` geeft `false`. Daarmee geven alle policies op huishouddata nul rijen, en weigeren alle RPC's die `private.my_member_id()` gebruiken. Realtime levert niets meer (RLS). De dispatcher en de tick sturen niets meer (ze filteren al op `is_active`).
- Het lid kan zijn **eigen** `household_members`-rij blijven lezen (policy: `user_id = auth.uid()`). Zo weet de app dat hij uitgezet is. De naam van het huishouden voor het scherm komt uit de RPC `public.my_membership()`, die `household_name`, `is_active` en `role` alleen voor de eigen rij teruggeeft.
- **Server:** `getHouseholdContext()` ziet `member.is_active === false` en `requirePageContext()` stuurt dan door naar `/geen-toegang`. `requireMember()` gooit `UserError("Je hebt op dit moment geen toegang tot dit huishouden.")` met code `FORBIDDEN`.
- **Client:**
  - `/geen-toegang` roept `clearLocalData()` aan (§4.4) en toont het scherm uit UX §4.15, met Uitloggen en een link naar Account verwijderen.
  - Faalt een snapshot-refresh met "geen huishouden" (0 rijen of PGRST116), dan doet de store `location.assign('/')` en beslist de server.
  - Entries in de outbox die daarna `FORBIDDEN` krijgen, worden verwijderd, niet opnieuw geprobeerd.
- **Weer aanzetten** herstelt alles, want er is niets verwijderd.

### 4.4 Uitloggen en de offline-gegevens (BR-43)
- **Nieuw: `src/lib/offline/clear.ts` → `clearLocalData()`.** Wist in deze volgorde:
  - IndexedDB `takenlijstje-cache` en `takenlijstje-outbox` (`indexedDB.deleteDatabase`);
  - `postMessage({ type: 'CLEAR_PAGES' })` aan de service worker (die wist `pages-*`);
  - het eigen pushabonnement (`deletePushSubscriptionAction(endpoint)` + `subscription.unsubscribe()`).
- **Uitloggen** wordt een client-handler in plaats van een kale `<form>`-POST:
  1. Is de outbox niet leeg, dan eerst de waarschuwing uit UX §4.12.
  2. Daarna `clearLocalData()`.
  3. Daarna POST `/auth/signout`.
  4. De bestaande SW-regel (`PAGE_CACHE` wissen bij POST `/auth/signout`) blijft als tweede vangnet.
- **Vangnet bij opstarten.** De cache (IDB) krijgt `userId` in de sleutel. Past die niet bij de huidige gebruiker, dan eerst `clearLocalData()`. Dat vangt een verlopen sessie of een ander account op hetzelfde toestel op.

### 4.5 Account verwijderen (UC-11, V-15, BR-24)
- **Herauthenticatie met het eigen wachtwoord.** Er komt geen e-mailcode: dat zou de magic-link-template veranderen en een tweede mechanisme toevoegen. Inloglinkgebruikers zonder wachtwoord zien "Stel eerst een wachtwoord in via Wachtwoord vergeten". **Uitvoeringskeuze:** UX §4.13 liet dit aan de architect.
- **`deleteAccountAction({ password })`:**
  1. `requireUser()`.
  2. Controle met een aparte, niet-persistente supabase-client: `signInWithPassword(user.email, password)`. Mislukt dit, dan "Wachtwoord klopt niet".
  3. RPC `delete_my_account()`. Hij zoekt de eigen rij met `user_id = auth.uid()` en **niet** met `private.my_member_id()`: die geeft voor een uitgezet lid `null`, en een uitgezet lid mag zijn account wel verwijderen (plan-critic 17). Hij weigert als je de enige actieve beheerder bent (BR-24): hij telt de actieve beheerders behalve jezelf. Anders verwijdert hij de eigen `household_members`-rij (via de RPC-vlag); voorkeuren en meldingen gaan mee door cascade. Zonder lidmaatschap (bijvoorbeeld na een verwijderd huishouden) is hij een no-op, zodat stap 4 kan volgen.
  4. `system/account.ts → deleteAuthUser(user.id)`, via `auth.admin.deleteUser`. De id komt uit de sessie, nooit uit invoer.
  5. Client: `clearLocalData()` → `/login?melding=account-verwijderd`.
- **Volgorde:** eerst de RPC, dan de auth-verwijdering. Andersom zou tijdelijk een lid zonder account ontstaan. Faalt stap 4, dan heeft het account geen lidmaatschap meer en kan de gebruiker het opnieuw proberen. De fout wordt gelogd met alleen een code.

### 4.6 Huishouden verwijderen (UC-12, V-15)
- `deleteHouseholdAction({ confirmName })` → `requireAdmin()` → RPC `delete_household(p_confirm_name)`.
- De RPC controleert dat de gebruiker een actieve beheerder is en dat de naam exact overeenkomt. Daarna volgt `delete from households`, met cascade over alles.
- De accounts van de andere leden blijven bestaan. Bij hun volgende verzoek hebben ze geen lidmaatschap meer.

**"Je hoort niet meer bij dit huishouden"** (plan-critic 12). Dit geldt voor een lid dat is verwijderd en voor de leden van een verwijderd huishouden. Het scherm en de tekst legt de UX-spec vast; technisch werkt het zo:
- **Server:** `requirePageContext()` zonder lidmaatschap → `/onboarding`, zoals nu.
- **Client, vóór `clearLocalData()`:** `/onboarding` leest eerst de IDB-cache. Staat daar een snapshot van **deze** gebruiker (`userId`-sleutel, §4.4), dan was hij lid op dit toestel. `/onboarding` toont dan eerst het scherm "niet meer lid" met de naam uit de cache, en pas daarna de keuze voor een nieuw huishouden. Daarna volgt `clearLocalData()`.
- **Grens, bewust geaccepteerd:** er is geen tombstone in de database (dat zou een persoonsgegeven na verwijdering bewaren). Op een toestel zonder cache ziet de gebruiker direct de onboarding.
- **Test:** E2E "Ellen verwijdert Kai → Kai opent de app → het scherm met de naam van het huishouden → daarna de onboarding; IDB leeg".
- De beheerder zelf: `clearLocalData()` → uitloggen → `/login?melding=huishouden-verwijderd`.

## 5. Autorisatie — het vaste patroon en de helpers bij naam

### 5.1 Het patroon (elke server action, zonder uitzondering)

```ts
export async function xAction(raw: unknown): Promise<ActionResult<X>> {
  return runAction("x", async () => {
    const ctx = await requireMember();            // of requireAdmin(); huishouden en lid ALTIJD uit de sessie
    const input = parse(xInput, raw);             // zod; household_id komt NOOIT uit invoer
    const task = await loadOwnTask(ctx, input.taskId);   // elke id uit invoer getoetst op eigendom
    // schrijven: user-client (RLS) met expectRows(), of een RPC met eigen rechtencheck
    // systeem: alleen via src/server/system/* en alleen invoegen van planning
  });
}
```

Afwijken van dit patroon geldt vanaf nu als securitybevinding.

**Helpers (TypeScript):**

| Helper | Plek | Doet |
| --- | --- | --- |
| `requireUser()` | `src/server/context.ts` | ingelogde gebruiker, anders een `UserError` (code `UNAUTHENTICATED`) |
| `requireMember()` | idem | **actief** lid + huishouden uit de sessie. Het cookie `tl_household` en `switchHouseholdAction` vervallen (BR-44) |
| `requireAdmin()` | idem | `requireMember()` + `role = 'admin'` |
| `loadOwnTask(ctx, id)` | `src/server/guards.ts` (was `getTaskForMember`) | leest met de user-client, `household_id = ctx.household.id`, niet verwijderd; anders `NOT_FOUND` |
| `loadOwnSeries(ctx, id)` | idem | idem voor een reeks |
| `loadOwnShoppingItem(ctx, id)`, `loadOwnInvitation(ctx, id)`, `loadOwnMember(ctx, id)` | idem | idem |
| `canManageSeries(ctx, series)` / `canDeleteTask(ctx, task)` | `src/domain/permissions.ts` (puur) | beheerder of maker (BR-22/23). **Alleen voor de UI** (verbergen). De database beslist |
| `expectRows(result, msg)` | `src/server/errors.ts` | zoals `check()`, maar gooit `FORBIDDEN` als een update of delete **0 rijen** raakte. Lost de stille RLS-weigering op die B-01 veroorzaakte. **Verplicht bij elke update/delete met de user-client** (met `.select('id')`) |
| `appUrl.task(id)`, `appUrl.today()`, `appUrl.notifications()` | `src/lib/navigation/app-url.ts` | de enige bron van meldings-URL's, altijd intern (BR-25) |

**Helpers (database, schema `private`, security definer, `search_path = ''`):**

| Functie | Betekenis |
| --- | --- |
| `private.is_member(h)` ✱ | actief lid van h (`user_id = auth.uid() and is_active`) |
| `private.is_admin(h)` ✱ | actief lid met rol admin |
| `private.my_member_id(h)` ✱ | eigen actieve lid-id |
| `private.is_my_member(m)` | eigen rij (ongeacht actief; alleen gebruikt voor eigen meldingen, voorkeuren en de eigen rij) |
| `private.can_create_tasks(h)` | beheerder, of actief lid als `members_can_create_tasks` aan staat (BR-20) |
| `private.can_manage_series(r)` ✚ | `is_admin(r.household_id) or (is_member(...) and is_my_member(r.created_by_member_id))` (BR-22) |
| `private.can_delete_task(t)` ✚ | idem voor de taak (BR-23) |

### 5.2 RLS en rechten per regel

| Regel | Beheerder | Gezinslid (actief) | Uitgezet lid | Waar afgedwongen |
| --- | --- | --- | --- | --- |
| BR-26 isolatie | eigen huishouden | eigen huishouden | niets (alleen de eigen lidrij) | `is_member()` in elke select-policy; samengestelde FK's |
| Lezen taken, reeksen, historie, boodschappen, leden | ja | ja | nee | select-policies `is_member()` |
| Eigen meldingen, voorkeuren, push | eigen | eigen | nee (voorkeuren en meldingen: nee, `is_member` in `with check`; push: alleen verwijderen) | policies `is_my_member()` + `is_member()` |
| BR-20 taak of reeks aanmaken, standaardtaken activeren | ja | als toegestaan | nee | insert-policy `can_create_tasks()` op `tasks` en `task_recurrences`. **Er is geen enkele aanmaakroute met de service role** (B-02 vervalt met autoAssign) |
| BR-23 losse taak of uitvoering wijzigen, verplaatsen, bezig, overslaan | ja | ja | nee | update-policy `is_member()`; `guard_task_changes`: maker en `household_id` onveranderlijk; `status → done` en `completed_at` alleen via `complete_task`; `deleted_at` alleen via `delete_task`; `recurrence_id` en `occurrence_date` volgens de regel **"Reekskoppeling"** hieronder |
| BR-23 taak verwijderen | ja | alleen zelf gemaakt | nee | delete-policy `can_delete_task`; RPC `delete_task` controleert hetzelfde |
| BR-22 reeks wijzigen, pauzeren, stoppen, verwijderen | ja | alleen eigen reeks | nee | update/delete-policy `can_manage_series`; RPC's `stop_series`, `pause_series`, `resume_series` en `clear_series_occurrences` controleren **eerst** `can_manage_series` en raken **niets** bij een weigering (42501). Lost B-01 op |
| BR-11/BR-13 afvinken en terugdraaien | ja | ja | nee | `complete_task` / `undo_complete_task` (security definer, `my_member_id()` verplicht); `unique (task_id)` op completions; directe insert op `task_completions` heeft geen policy |
| BR-14 bezig | ja | ja | nee | status `in_progress` via update (zonder persoon) |
| Notities plaatsen / verwijderen | alle | eigen | nee | insert `is_member() and is_my_member(member_id)`; delete `is_my_member(member_id) or is_admin()` |
| BR-42 boodschappen | alles | alles | nee | policies `is_member()`; archiveren via RPC |
| Huishoudinstellingen | ja | nee | nee | `households` update `is_admin()` |
| BR-24 leden (de)activeren, rol, verwijderen | ja (niet de laatste actieve beheerder, niet jezelf) | eigen profiel (naam, kleur, emoji) | nee | policies + `guard_member_changes`: telt **actieve** beheerders na de wijziging; `new.user_id = auth.uid()` bij uitzetten of verwijderen van jezelf → weigeren (behalve via `delete_my_account`) |
| BR-41 uitnodigingen | ja | nee | nee | policy `is_admin()`; accepteren via RPC |
| BR-44 één huishouden | — | — | — | `unique (user_id)` + checks in `create_household` en `accept_invitation` (duidelijke fout) |
| BR-25 meldingen alleen door het systeem | — | — | — | **geen insert-policy voor `authenticated`**; alleen `service_role` via de dispatcher; `url`-check; de SW accepteert alleen dezelfde origin |
| Afvalkalender beheren en adres lezen (W-03) | ja | nee | nee | waste_calendars select is_admin, geen schrijfpolicies, RPC disable_waste_calendar, actions requireAdmin (§18.5.1) |
| Afvaltaak wijzigen, verplaatsen, verwijderen, omzetten (W-03) | nee | nee | nee | guard_task_changes, policies op tasks, delete_task (§18.5.2–18.5.4) |
| Afvaltaak status: afvinken, bezig, overslaan (W-03) | ja | ja | nee | bestaande update-policy + trigger waste_skip_cascade (§18.5.5) |
| Huishouden verwijderen | ja | nee | nee | RPC `delete_household` (+ delete-policy `is_admin()`) |
| Account verwijderen | ja, niet als enige actieve beheerder | ja | ja (het eigen account) | RPC `delete_my_account` + `system/account.ts` |

**Reekskoppeling in `guard_task_changes`** (plan-critic punt 4). Dit is de enige uitzondering op "onveranderlijk" voor gebruikers; systeem en RPC's (`auth.uid() is null` of de RPC-vlag) volgen de bestaande regel.
- **`recurrence_id` van `null` naar een waarde:** alleen als `private.can_create_tasks(new.household_id)` en `private.can_manage_series(new.recurrence_id)` waar zijn. De samengestelde FK garandeert hetzelfde huishouden. Dit is de route "losse taak wordt terugkerend": de gebruiker heeft de reeks net zelf aangemaakt, dus hij is maker.
- **`recurrence_id` van een waarde naar een andere waarde:** altijd geweigerd (42501).
- **`recurrence_id` van een waarde naar `null`:** alleen als de reeks niet meer bestaat. Dat is de FK-actie `on delete set null`, die als update door deze trigger loopt.
- **`occurrence_date` wijzigen:** alleen als `private.can_manage_series(coalesce(new.recurrence_id, old.recurrence_id))`. Dit is nodig voor "losse taak wordt terugkerend" en voor "deze en volgende" met een nieuw ritme (§6.1).
- **DB-tests (`20_rechten_br.sql`):**
  - een gezinslid zonder aanmaakrecht koppelt een taak aan een eigen reeks → geweigerd;
  - een gezinslid koppelt aan andermans reeks → geweigerd;
  - een beheerder of maker ontkoppelt een reeks, of wisselt naar een andere reeks → geweigerd;
  - de reeks wordt verwijderd → de FK zet `null` zonder fout.

**B-04 afgehandeld:**
- De maker is onveranderlijk (guard).
- "Namens afvinken" verdwijnt (parameter weg).
- `revoke execute on function private.<trigger- en interne functies> from authenticated`. `execute` blijft alleen op de helpers die in policies worden aangeroepen; de aanroepende rol heeft dat recht nodig om de policy te evalueren.
- Het schema `private` wordt niet via de API ontsloten.

**B-05:** `/api/status` eist dezelfde Bearer als de tick (`CRON_SECRET`). Zonder header volgt een 401.

### 5.3 De service role (systeemsleutel): waar wel en waar nooit

- **Nieuwe map `src/server/system/`**, de enige plek die `SUPABASE_SERVICE_ROLE_KEY` gebruikt:
  - `admin-client.ts`: verplaatst uit `src/lib/supabase/admin.ts`;
  - `planner.ts`;
  - `tick.ts`: verplaatst uit `services/tick.ts`;
  - `dispatcher.ts` en `channels/web-push.ts`: verplaatst uit `notifications/`;
  - `account.ts`: auth-admin delete.
- **Afgedwongen met ESLint** `no-restricted-imports`: `@/server/system/admin-client` is alleen toegestaan binnen `src/server/system/**`. De code-reviewer controleert dit per WP.
- **`systemDb(fallback)` en `fallbackDb` vervallen.** Is de service-sleutel niet geconfigureerd, dan faalt de systeemstap met een logregel. De user-client wordt nooit stil gebruikt als vervanger.
- **Toegestane systeemhandelingen:**
  1. `planner.topUp(householdId, recurrenceIds?)`: **alleen invoegen** van geplande uitvoeringen (upsert met `ignoreDuplicates` op `(recurrence_id, occurrence_date)`) en het bijwerken van `generated_until`. Wordt vanuit een user-flow pas aangeroepen **nadat** de reeks met de user-client is gelezen (`loadOwnSeries`) en de rechtenstap via RLS of RPC geslaagd is.
  2. De tick: planning, `skipped` voor ingehaalde verlopen taken (BR-16), meldingen en `run_purge()`.
  3. `dispatcher.notify()`: meldingen invoegen en pushen. Ontvangers worden server-side bepaald uit de database. De inhoud komt uit getypte builders met de taaktitel uit de database, nooit uit vrije invoer.
  4. `account.deleteAuthUser(sessionUserId)`.
  5. `system/waste/sync.ts` (W-03, §18.7–§18.8): opvragen bij de gemeente; `waste_save` na `requireAdmin()` met hercontrole in de RPC; `waste_sync`: afvaltaken invoegen, verschuiven, hernoemen of verwijderen als ze open zijn, en de storingsstand bijwerken; `markWasteAlarm`: alleen `alarm_since`; afvaltaken laten vervallen (BR-54); de storingsmelding via de dispatcher (§18.8.6).
- **Nooit met de service role:** een update of delete die een gebruiker aanvraagt, rechtenbeslissingen, of het lezen van gegevens voor de UI.

## 6. Server actions en RPC's

Gemeenschappelijk:
- **Resultaattype** `ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'UNKNOWN' }`. De `code` is nieuw. Zo kan de UI onderscheid maken tussen "de rij verdwijnt" (`NOT_FOUND`), "terugspringen + Opnieuw" (`UNKNOWN`) en "er is niets veranderd" (`FORBIDDEN`), zie UX §4.1 en §4.5.
- **`friendlyMessage()`** vertaalt ook `P0001` (eigen RPC-fouten met een Nederlandse tekst). Er verschijnt nooit een policynaam of stacktrace.
- **Invoerschema's** staan in `src/lib/validation.ts`. Titel 1–80, omschrijving ≤ 1000, notitie ≤ 1000, uuid's, `isoDate`, `time`. Zie PRODUCT_SPEC §6.
- **Idempotentie** via door de client gegenereerde uuid's (`id` / `mutationId`), unieke constraints, of RPC's die "al gedaan" teruggeven.

### 6.1 Taken en reeksen (`src/server/actions/tasks.ts`, services in `src/server/services/tasks.ts` en `series.ts`)

| Actie | Invoer (zod) | Autorisatie | Transactie | Idempotentie | Resultaat | Offline |
| --- | --- | --- | --- | --- | --- | --- |
| `createTaskAction` | `taskInput` zonder `assignedMemberId`/`autoAssign`/`points`; verplicht `id` (client-uuid); optioneel `recurrence` met verplicht `recurrenceId` (client-uuid) | `requireMember`; RLS `can_create_tasks` | losse taak: één upsert. Reeks: insert van de reeks met de user-client (RLS), daarna `planner.topUp` (alleen invoegen) | upsert op `id` met `ignoreDuplicates`; reeks idem op `recurrenceId` | `TaskRow[]` (nieuw of bestaand) | **losse taak: ja** (optimistisch, in de wachtrij). **Reeks: nee** ("Hiervoor heb je internet nodig") |
| `completeTaskAction` | `{ taskId, mutationId, completedAt, note? }` | `requireMember`; RPC `complete_task` (lidmaatschap, `for update` op de taak) | RPC (één transactie): completion + status. Daarna `planner.topUp([recurrence])` en `notify(task_completed)`; ontvangers: **ieder actief lid met account dat "taak gedaan" aan heeft staan, inclusief wie afvinkte** (besluit V-38a). De actor-id wordt dus niet gebruikt om ontvangers te filteren, en de ontvangerslijst verraadt niet wie afvinkte (fouten daarin worden gelogd; de actie slaagt) | `client_mutation_id unique` + `unique (task_id)` + "al done → bestaande terug" | `{ completionId, taskId, wasLate }` | ja |
| `undoCompleteAction` | `{ taskId }` | `requireMember`; RPC `undo_complete_task` (ieder actief lid, V-22) | RPC | niet `done` → no-op | `TaskRow` | ja (haalt een nog niet verstuurde afvinking uit de wachtrij, bestaand) |
| `setTaskStatusAction` | `{ taskId, status: 'todo'\|'in_progress'\|'skipped' }` | `loadOwnTask`; RLS update | één update met `expectRows`; bij `skipped` in een reeks daarna `planner.topUp` | gelijke status → no-op | `TaskRow` | ja |
| `moveTaskAction` | `{ taskId, date }` | `loadOwnTask`; RLS | één update: `scheduled_date`; `available_from` en `due_at` schuiven met hetzelfde aantal dagen (`shiftInstant`, **bevestigt de UX-aanname** §4.6); `is_exception = true` in een reeks | zelfde datum → no-op | `TaskRow` | ja |
| `updateTaskAction` scope `this` | `taskUpdateInput` (zonder persoon/punten) | `loadOwnTask`; RLS | één update met `expectRows`; `is_exception = true` in een reeks | laatste schrijver wint (§7) | `TaskRow` | nee |
| `updateTaskAction` scope `future` | idem + `recurrence?` | `loadOwnSeries` + **RLS `can_manage_series`** bij het bijwerken van de reeks (`expectRows`; 0 rijen = `FORBIDDEN`, en er gebeurt verder **niets**) → RPC `clear_series_occurrences(r, from, null, false)` (controleert opnieuw, zet `generated_until = from - 1`) → `planner.topUp(from)` | 3 stappen; volgorde zo gekozen dat een fout halverwege door de volgende tick of een herhaalde poging **zelf herstelt**: de reeks is al nieuw, `generated_until` is teruggezet, de planner vult aan | herhalen = hetzelfde resultaat | `TaskRow` | nee |
| `updateTaskAction` "losse taak wordt terugkerend" | idem met `recurrence` + `recurrenceId` | `loadOwnTask` + RLS `can_create_tasks` (insert reeks) | insert reeks (user-client, RLS) → update taak `recurrence_id` + `occurrence_date = scheduled_date` (user-client + `expectRows`; toegestaan door de regel "Reekskoppeling", §5.2) → `planner.topUp` | upsert reeks op id; taak al aan deze reeks gekoppeld → no-op | `TaskRow` | nee |
| `deleteTaskAction` | `{ taskId, scope }` | `requireMember`; RPC `delete_task(p_task_id, p_scope)`: `can_delete_task`, en voor `future` ook `can_manage_series` | RPC: losse taak zonder historie → delete; met historie of in een reeks → `deleted_at`; `future` → reeks `is_active = false` + open uitvoeringen vanaf die datum weg (inclusief uitzonderingen) | al verwijderd → no-op | `true` | nee |
| `pauseSeriesAction` / `resumeSeriesAction` | `{ recurrenceId, from, until }` / `{ recurrenceId }` | RPC `pause_series` / `resume_series` (`can_manage_series`) | RPC: pauzevelden + open, niet-aangepaste uitvoeringen in de periode weg (BR-09); daarna `planner.topUp` | zelfde periode → zelfde resultaat | `RecurrenceRow` | nee |
| `updateSeriesAction` ✚ (reeksdetail › Wijzigen, UX §5.2; plan-critic punt 10) | `{ recurrenceId, changes }` (`seriesUpdateInput`: titel, omschrijving, categorie, prioriteit, duur, tijd, deadline-venster, herinneringen, `rule`, `endsOn`) | `loadOwnSeries` + **RLS `can_manage_series`** (`expectRows`; 0 rijen = `FORBIDDEN`, verder **niets**) → RPC `clear_series_occurrences(r, from = vandaag in de tijdzone van het huishouden, null, false)` → `planner.topUp(from)` | dezelfde volgorde en hetzelfde zelfherstel als `updateTaskAction` scope `future`. Uitzonderingen (`is_exception`) en gedane taken blijven. Een pauze blijft staan (pauzevelden zitten niet in `changes`). Werkt ook als de reeks geen open uitvoering heeft of gepauzeerd is | herhalen = hetzelfde resultaat | `RecurrenceRow` | nee |
| `stopSeriesAction` | `{ recurrenceId }` | RPC `stop_series` (`can_manage_series`) | RPC: `is_active = false` + alle open uitvoeringen weg (historie blijft) | al gestopt → no-op | `true` | nee |
| `addCommentAction` | `{ id, taskId, body ≤1000 }` | `loadOwnTask`; RLS `is_my_member(member_id)` | upsert | op `id` | `true` | nee |
| `deleteCommentAction` | `{ commentId }` | RLS (eigen of beheerder) + `expectRows` | delete | al weg → `NOT_FOUND` wordt in de UI stil genegeerd | `true` | nee |

**Vervallen:** `assignTaskAction`, `requestSwapAction`, `acceptSwapAction`, `cancelSwapAction`, de RPC `accept_swap_request`, en `notifyAssigned`.

### 6.2 Huishouden, leden, uitnodigingen, account (`src/server/actions/household.ts`, `account.ts`)

| Actie | Autorisatie | Uitvoering | Idempotentie |
| --- | --- | --- | --- |
| `createHouseholdAction` | `requireUser`; RPC weigert als al lid (BR-44) | RPC `create_household` | het tweede verzoek weigert "al lid" → de UI stuurt door naar `/` |
| `updateHouseholdAction` (naam, `membersCanCreateTasks`) | `requireAdmin` | update + `expectRows`. **Tijdzone vast op `Europe/Amsterdam` (besluit V-39):** het invoerschema kent geen `timezone` meer. De UI toont de tijdzone alleen, zonder bediening. `create_household` negeert `p_timezone` en zet altijd `Europe/Amsterdam`. In de database: `check (timezone = 'Europe/Amsterdam')` in `…_200`, na voorcontrole M1(f). De kolom blijft bestaan, omdat de domeincode (`todayIn`, `zonedInstant`) de tijdzone als parameter gebruikt; zo blijft die code ongewijzigd en getest. Herplannen bij een tijdzonewissel is daarmee niet nodig | natuurlijk idempotent |
| `completeOnboardingAction` | `requireAdmin` | update | idem |
| `updateMemberAction` (profiel: naam, kleur, emoji / beheerder: rol, `isActive`) | `requireMember`; eigen rij of `requireAdmin`; guard (BR-24, V-29) | update + `expectRows` | idem |
| `removeMemberAction` | `requireAdmin`; niet jezelf; guard | delete + `expectRows` | al weg → `NOT_FOUND` |
| `createInvitationAction` | `requireAdmin` | upsert met client-`id` → `{ url, expiresAt }`. ✖ `sendEmail` en ✖ `memberId` (UX §4.11: delen of kopiëren) | op `id` |
| `revokeInvitationAction` | `requireAdmin` | delete + `expectRows` | — |
| `acceptInvitationAction` | `requireUser`; RPC (token, e-mail, BR-44, al lid → afronden) | RPC `accept_invitation(p_token, p_display_name)` | al geaccepteerd door dezelfde gebruiker → `household_id` terug |
| `activateTemplatesAction` | `requireMember` + RLS `can_create_tasks` (BR-20) | insert reeksen met client-`recurrenceId` per item → `planner.topUp` | upsert op id |
| `saveTemplateAction` / `deleteTemplateAction` (eigen standaardtaken) | `requireAdmin` | upsert/delete | op id |
| `deleteHouseholdAction` | `requireAdmin` + RPC | §4.6 | tweede keer → `NOT_FOUND` |
| `deleteAccountAction` | `requireUser` + wachtwoordcheck + RPC | §4.5 | — |
| `requestPasswordResetAction`, `updatePasswordAction` | publiek (rate limit Supabase) / sessie uit de herstellink | §4.2 | — |

**Vervallen:** `switchHouseholdAction`, `addMemberAction` (lid zonder account), `createAbsenceAction`, `deleteAbsenceAction`.

### 6.3 Meldingen (`src/server/actions/notifications.ts`)

- `markNotificationsReadAction({ ids? })`: eigen meldingen (RLS). Idempotent.
- `savePreferencesAction`: upsert van de eigen rij, zonder `notify_task_assigned` en `notify_swap_requests`. Zodra een lid uitgezet is, weigert RLS dit.
- `savePushSubscriptionAction` en `deletePushSubscriptionAction`: bestaand. Upsert op `endpoint`.
- **Oudere meldingen laden** is een leesactie in de browser (RLS): `notifications where member_id = me and created_at < :cursor order by created_at desc limit 30`. Geen action.
- `sendTestNotificationAction` vervalt: hij staat niet in de UX en gebruikte een fallback-pad.

### 6.4 Boodschappen (`src/server/actions/shopping.ts`)

| Actie | Uitvoering | Idempotentie | Offline |
| --- | --- | --- | --- |
| `addShoppingItemAction` | upsert met client-`id` op de actieve lijst (zonder `added_by`) | op `id` | ja |
| `toggleShoppingItemAction` | update `is_bought`, `bought_at` (zonder `bought_by`) + `expectRows` | gelijke waarde | ja |
| `updateShoppingItemAction` / `deleteShoppingItemAction` | update/delete + `expectRows` | — | ja |
| `archiveShoppingListAction({ listId })` | RPC `archive_shopping_list(p_list_id)`: archiveert **alleen als `p_list_id` nog de actieve lijst is**; maakt de nieuwe lijst en verplaatst de niet-gekochte items, in één transactie | tweede aanroep met dezelfde `listId` → geeft de bestaande nieuwe lijst terug (R-03). De unieke index op de actieve lijst is het vangnet | nee |
| `unarchiveShoppingListAction({ archivedListId })` | RPC `unarchive_shopping_list`: voor "Lijst afgerond · Ongedaan maken" (UX §4.8). Zet de gearchiveerde lijst terug als actief, verplaatst de items van de nieuwe lijst terug en verwijdert de nieuwe, lege lijst | al teruggezet → no-op | nee |

### 6.5 Achtergrond (`src/app/api/cron/tick/route.ts` → `src/server/system/tick.ts`)

- **Authenticatie:** `Authorization: Bearer ${CRON_SECRET}`, vergeleken met `timingSafeEqual` (bestaand). `export const maxDuration = 60`.
- **Stappen:** zie §11.3. **Antwoord:** alleen tellingen (`{ planned, skipped, notified, pushed, purged, waste }`), met `waste = { calendars, fetched, fetchFailed, inserted, moved, renamed, removed, expired, alerted }` (W-03, §18.8.6).

### 6.6 Afvalkalender (W-03)
Actions `lookupWasteAddressAction`, `confirmWasteAddressAction`, `retryWasteSyncAction` en `disableWasteCalendarAction`, en de RPC's `waste_save`, `waste_sync`, `disable_waste_calendar` en `waste_calendar_enabled`: zie §18.6 en §18.7.

## 7. Gelijktijdigheid en idempotentie

| Situatie | Mechanisme | Uitkomst |
| --- | --- | --- |
| Dubbel tikken op het rondje / offline + opnieuw | `client_mutation_id unique` + `unique (task_id)` + `select … for update` op de taak in `complete_task` | één registratie (BR-10/11) |
| Twee mensen vinken tegelijk af | rijlock in `complete_task`; de tweede krijgt de bestaande completion terug | één registratie; beiden zien "gedaan" (Realtime) |
| De een vinkt af, de ander draait terug | beide RPC's serialiseren op de taakrij | de laatste actie geldt (PRODUCT_SPEC §6); Realtime werkt beiden bij |
| Afvinken tijdens bewerken | het bewerkformulier stuurt nooit `status` of `completed_at`; de guard verbiedt `status → done` buiten de RPC | de bewerking wordt opgeslagen, de taak blijft gedaan |
| Twee tabbladen bewerken dezelfde taak | laatste schrijver wint, per veld dat in de patch zit (alleen gewijzigde velden gaan mee) | geen versieveld. **Versimpeltoets:** vier gebruikers, zelden gelijktijdig op dezelfde taak; een versieveld met een conflictscherm kost meer dan het oplevert |
| Dubbel aanmaken (taak, reeks, boodschap, notitie, uitnodiging, standaardtaken) | door de client gegenereerde uuid + upsert `ignoreDuplicates` | één rij (BR-10, R-03) |
| Dubbel archiveren | `p_list_id` + partiële unieke index op de actieve lijst | één nieuwe lijst (R-03) |
| Planner en tick tegelijk (twee triggers, overlap) | `unique (recurrence_id, occurrence_date)` + upsert `ignoreDuplicates`; `unique (member_id, dedupe_key)` voor meldingen; pushen alleen voor **nieuw ingevoegde** rijen (id's uit `returning`) | geen dubbele taken of pushes. Geen lease of lock nodig (versimpeltoets §14) |
| Reeks wijzigen terwijl de tick plant | `clear_series_occurrences` zet `generated_until` terug; de tick vult aan met de nieuwe regel | eventueel één tick lang oude uitvoeringen; herstelt zichzelf |
| Offline afgevinkt, dagen later online | `completedAt` begrensd: nooit in de toekomst, maximaal 7 dagen terug (bestaand in de RPC) | BR-12 |
| Volgorde in de wachtrij | de outbox verstuurt FIFO; per taak wint de laatste actie | UX §7 |

Afvalkalender (W-03): zie §18.10.

## 8. Domeinlogica (waar, hoe testbaar)

`src/domain/**` blijft puur (geen I/O), getest met vitest.

| Module | Wijziging |
| --- | --- |
| `recurrence/*`, `dates.ts`, `scheduling/supersede.ts`, `status.ts` | **Behouden** (aanname PROGRESS: de herhalingsregels zijn correct). `status.greeting()` vervalt (UX §5.1) |
| `scheduling/plan.ts` | **Herwerken:** zonder `assignment`, afwezigheid en punten. `planSeries({ series, today, timeZone, existingOccurrenceDates, hasOpenUpcoming, from })` geeft alleen datums en vensters terug |
| `assignment/*` (`strategies`, `load`, `absence`) + `__tests__/assignment.test.ts` | **Vervallen** (V-21, V-24) |
| `reminders.ts` | **Herwerken:** `taskMessages` ongewijzigd per taak. `summaryMessages(prefs, now, tz, { todayOpen, openIncludingOverdue })` telt voor het hele huishouden (BR-31). Nieuw: `recipientsFor(type, members, prefs)` (actief, met account, voorkeur aan); recipientsFor kent waste_sync_failed (actieve beheerders met account, los van voorkeuren); voor afvaltaken wasteReminder in plaats van taskMessages (W-03, §18.9) |
| `stats.ts` | **Herwerken:** alleen voor het huishouden: gedaan, op tijd, vergeten (verlopen of overgeslagen), open, "vaak te laat of vergeten", "vaak gedaan" (UC-06). Geen `MemberStats` |
| `quick-add/parser.ts` | **Herwerken:** geen herkenning van personen (UC-03); geeft de herkende datum met `matchedText` terug, zodat de UI het woord kan onderstrepen (UX §4.3) |
| ✚ `permissions.ts` | `canManageSeries`, `canDeleteTask`, `canCreateTasks`, `canDeactivate(member, members)`: voor de UI. Dezelfde regels als in de database, getest tegen dezelfde tabel |
| ✚ `notifications/text.ts` (verplaatst uit `features/notifications/format.ts` + builders) | meldingsteksten zonder namen (UX §4.9) |
| ✚ `outbox/merge.ts` | puur: pas wachtende acties toe op een verse snapshot (`applyOptimistic`, nu in `features/household/mutations.ts`) → testbaar zonder React |
| ✚ waste/* (W-03) | zie §18.2: address, streams, plan (incl. hasNoUpcoming, classifyEmpty), expire, health, messages |

Services (`src/server/services/*`) krijgen `(db, ctx, input)` als parameters. Daardoor zijn ze in integratietests aan te roepen zonder Next-requestcontext (§13).

## 9. Foutafhandeling, states en logging

### 9.1 Routes en bestanden (S-01, S-04, UX §5.14)

```
src/app/
  layout.tsx            root: Figtree (next/font/local), tokens, Toaster onder (boven de onderbalk), SW-registrar
  global-error.tsx  ✚   vangt fouten in de root-layout; eenvoudige HTML, "Opnieuw proberen"
  error.tsx         ✚   algemene fout buiten (app)
  not-found.tsx     ✚   "Deze pagina bestaat niet · Naar Vandaag"
  login/  wachtwoord-vergeten/ ✚  wachtwoord/nieuw/ ✚  geen-toegang/ ✚  invite/[token]/  onboarding/  offline/
  auth/{callback,confirm,signout}
  (app)/
    layout.tsx      ✱   AppShell direct renderen; <Suspense fallback={<ScreenSkeleton/>}><HouseholdData>{children}</HouseholdData></Suspense>
                        binnen <DataErrorBoundary> (client) → wireframe 18 met "Opnieuw proberen" en een bruikbare onderbalk
    loading.tsx     ✚   skelet per pagina (kop + 4 rijen) bij navigeren
    error.tsx       ✚   paginafout binnen de shell
    not-found.tsx   ✚
    page.tsx (Vandaag) · taken/ · kalender/ · boodschappen/ · meldingen/ · overzicht/ ✚ (was huishouden/)
    instellingen/ · instellingen/{profiel,meldingen,gezinsleden,standaardtaken,huishouden,huishouden/verwijderen,account-verwijderen} ✚
  api/cron/tick · api/status (met Bearer)
```

`AppShell` heeft alleen `ctx.member.role` en `can_create_tasks` nodig (+ knop, UX §9). Die komen uit de lichte `getHouseholdContext()`. De zware snapshot laadt binnen de Suspense-boundary, zodat er nooit een wit scherm staat.

### 9.2 Sheets met een eigen URL (UX §3, §12)

- **Keuze: zoekparameters op de huidige route**, verwerkt door één `<SheetHost/>` in `(app)/layout.tsx`:
  - `?taak=<id>`: detail;
  - `?nieuw=1[&dag=YYYY-MM-DD]`;
  - `?bewerk=<id>`;
  - `?reeks=<id>`;
  - `?pauzeer=<reeksId>`;
  - `?product=<id>`;
  - `?lid=<id>`;
  - `?uitnodigen=1`.

  Open = `router.push` (terug sluit de sheet), sluiten = `router.back()` als de sheet in de eigen historie is geopend, anders `router.replace` zonder parameter. Na vernieuwen blijft de sheet open.
- **Helper:** `src/lib/navigation/sheets.ts`, met `sheetHref(kind, params)` en `useSheet()`.
- **Meldings-URL's:** `appUrl.task(id) = '/?taak=<id>'`. Oude meldingen met `/taken?taak=` blijven werken, want de `SheetHost` staat op elke pagina.
- **Bevestigingen** ("Stoppen?", "Wijzigingen weggooien?") en de keuze "Wat wil je wijzigen?" zijn tijdelijke dialogen zonder URL, want na vernieuwen hebben ze geen betekenis. De ux-reviewer bevestigt dit bij CP3.
- **Waarom geen intercepting/parallel routes:** het detail moet **offline** openen uit de snapshot. Een intercepting route vraagt een RSC-verzoek dat offline faalt. Zoekparameters zijn één mechanisme dat online en offline werkt (versimpeltoets §14).
- **Taak niet in de snapshot** (ouder, of buiten de periode): de sheet haalt hem op met de browser-client (RLS). Niets gevonden → "Deze taak bestaat niet meer … · Naar Vandaag" (UX §7).

### 9.3 Laden, fout, offline (UX §7)

| State | Technisch |
| --- | --- |
| Eerste keer laden | streaming: shell + `ScreenSkeleton` (het bestaande `Skeleton`-component, restyled) |
| Laden met cache | SW: navigatie **netwerk-eerst met 3 s time-out**, daarna de gecachte pagina. De client toont direct de IDB-snapshot als die nieuwer is (bestaand) en ververst op de achtergrond; na > 5 s "Bijwerken…" |
| Fout zonder cache | `DataErrorBoundary` / `(app)/error.tsx`: uitleg + "Opnieuw proberen" (`reset()` + `router.refresh()`) |
| Fout met cache | store-veld `refreshError` + `loadedAt` → balk "Kon niet bijwerken · stand van 08:12 · Opnieuw" |
| Offline | `online` + `pending` uit de store (bestaand): balk; rij "wacht op verbinding" (per entry-`taskId` in de outbox); acties die online moeten zijn uitgeschakeld via `useOnlineOnly()` met de reden |
| Nooit bezochte pagina offline | SW-fallback **alleen** `/offline` (niet meer `/`): lost S-04 op. De pagecache-sleutel is het pad zonder query, zodat `/?taak=` de gecachte `/` gebruikt |
| Outbox-fout na online komen | zie §9.3.1: **nooit stil weggooien** |

**Welke acties offline in de wachtrij kunnen (bindend, ook voor UX §7):**
- afvinken, terugzetten, bezig/niet bezig, **overslaan**, **verplaatsen** (Naar morgen, Andere dag…, slepen in de kalender);
- **nieuwe losse taak** (nieuw toegestaan, UX §12 "wenselijk");
- boodschap toevoegen, afvinken, wijzigen en verwijderen;
- meldingen als gelezen markeren.

Al het andere is online-only. **Waarom nieuwe losse taak wel en reeks niet:** een losse taak is één idempotente upsert. Een reeks vraagt planning op de server.

**Taakdetail offline** (plan-critic 13; UX §7 wordt hierop gelijkgetrokken):

| Werkt (via de wachtrij) | Uitgeschakeld, met "Hiervoor heb je internet nodig" |
| --- | --- |
| Afvinken / Terugzetten, Ik ben ermee bezig / Niet meer bezig, **Deze keer overslaan**, **Naar morgen**, **Andere dag…** | Bewerken, notitie plaatsen of verwijderen, "Op boodschappenlijst" vanuit een notitie, Reeks pauzeren/hervatten/stoppen, Verwijderen |

De notities en "Vorige keren" tonen offline de laatst geladen stand, als die er is.

#### 9.3.1 Wachtrij over deploys heen (plan-critic 9)

Het probleem: server-action-id's veranderen per build. Een open PWA met een oude bundel, of oude entries in IndexedDB, raken na een deploy hun doel kwijt. De huidige flush gooit ze dan weg (`store.tsx:119-124`). Oplossing:

1. **Eén stabiel endpoint voor de wachtrij in plaats van server actions:**
   - `POST /api/outbox` (route handler, `src/app/api/outbox/route.ts`) met `{ v: number, id, kind, payload }`.
   - Zod per `kind`, daarna dezelfde services en dezelfde autorisatie als de server actions (`requireMember()` uit de cookies).
   - **CSRF:** `Origin` moet gelijk zijn aan `NEXT_PUBLIC_SITE_URL`, en `Content-Type: application/json` is verplicht (een cross-origin-aanroep vraagt dan een preflight, die niet wordt toegestaan).
   - Directe (online) snelle acties gaan via **hetzelfde endpoint**. Zo is er één pad; formulieren blijven server actions.
2. **Versie per entry:** `OUTBOX_VERSION` (begint op 1; entries zonder `v` zijn versie 0 van de huidige app).
   - De server heeft `migrateOutboxEntry(v, kind, payload)` (puur, `src/domain/outbox/migrate.ts`). Die zet oude vormen om. Voorbeeld: v0 `complete` met `completedBy` → het veld vervalt; v0 `shoppingAdd` zonder `id` → er wordt een id gegenereerd.
   - Soorten die niet meer bestaan (v0 `assign`) worden **niet stil** verwijderd. Ze krijgen de uitkomst `DISCARDED_OBSOLETE`, met een zichtbare melding: "1 offline wijziging hoort bij een functie die niet meer bestaat (toewijzen) en is niet uitgevoerd."
3. **Uitkomst per entry, en wat de client doet:**

   | Uitkomst | Client |
   | --- | --- |
   | `ok` | verwijderen |
   | netwerkfout, 5xx, 408, 429 | laten staan, later opnieuw (backoff) |
   | 401 | laten staan, melding "Log opnieuw in om 2 wijzigingen te versturen" |
   | `FORBIDDEN` / `NOT_FOUND` / `VALIDATION` / `DISCARDED_OBSOLETE` | verwijderen **met** een zichtbare melding per taak (UX §7) |
   | onbekend antwoord (bijvoorbeeld een HTML-foutpagina tijdens een deploy) | laten staan, maximaal 5 pogingen, daarna **laten staan** met de balk "2 wijzigingen konden niet worden verstuurd · Opnieuw" |

   Er wordt dus nooit een entry verwijderd zonder dat de gebruiker het ziet.
4. **Buildwissel:**
   - De SW-versie is de build-id (`VERSION` in `sw.js`, bij de build ingevuld).
   - Een nieuwe SW activeert pas na `skipWaiting` op een moment dat de outbox leeg is of net geflusht, en laadt dan de pagina opnieuw.
   - Het endpoint accepteert oude versies, dus ook een oude bundel kan zijn wachtrij kwijt.
5. **Eenmalig restrisico, bewust:** de allereerste deploy (WP1) vervangt code die zelf nog server actions gebruikt en weggooit. Entries die op dat moment in een oude, open PWA wachten, kunnen nog één keer verloren gaan. **Beperking:** WP1 's avonds laat deployen en de gezinsleden vooraf vragen de app te openen terwijl ze online zijn. De bouwer meldt dit aan Jurgen bij de eerste deploy.
6. **Tests:**
   - unit `migrateOutboxEntry` (alle v0-soorten);
   - integratie `POST /api/outbox` (auth, CSRF-weigering, dubbele entry = één registratie);
   - E2E "offline afgevinkt vóór een deploy (entry v0 in IDB geïnjecteerd) → online na de deploy → precies één registratie". De product-analyst neemt dit op als AC.

**Versimpeltoets:** één stabiel route-endpoint is eenvoudiger dan server-action-id's per build bijhouden of Vercel skew protection. Of die op het huidige plan beschikbaar is, is niet gecontroleerd; bovendien helpt ze niet voor entries die al in IndexedDB staan.

### 9.4 Logging

- `runAction` logt `[action:{actienaam}] {ErrorName} {pgcode}`, zoals nu. **Nooit** invoer, titels, e-mailadressen, namen, tokens of `user_id`.
- De tick en de dispatcher loggen alleen tellingen en statuscodes (bestaand in `web-push.ts`).
- **Afvalkalender (W-03):** nooit postcode, huisnummer, adrescode, straat, bron-URL's of `error.message` van een fetch; alleen tellingen, codes en `fetchMs` (§18.12).
- **Nieuw:** `console.error` in de client alleen met een foutcode. Geen externe errortracking (geen extra verwerker; PRODUCT_SPEC §8).
- De eigen logs van de app zijn de enige logbron die de app beheert (Vercel-functielogs).
- **Eerlijke grens (plan-critic 3):** de app slaat nergens op wie afvinkte, ook niet in de eigen logs. De **toegangslogs van de platforms** (Supabase API-logs, Vercel-requestlogs) leggen wel per verzoek vast welke gebruiker (JWT) welk endpoint aanriep, bijvoorbeeld `rpc/complete_task` of `POST /api/outbox`, en wanneer. Die logs beheert de app niet. Ze worden door de platforms kort bewaard, afhankelijk van het plan. De exacte termijn is niet gecontroleerd; dat hoort bij WP3 in het dashboard. De product-analyst formuleert BR-12 en §8 hierop. Er is geen extra techniek nodig.

## 10. Externe diensten

| Dienst | Time-out | Bij falen | Geheimen (alleen namen) |
| --- | --- | --- | --- |
| Supabase DB/REST/RPC | supabase-js standaard; server actions eindigen binnen de standaardlimiet van de Vercel-functie | foutresultaat met `code`; optimistische acties rollen terug of gaan in de wachtrij | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publiek, RLS), `SUPABASE_SERVICE_ROLE_KEY` (alleen `src/server/system/**`) |
| Supabase Auth (mail) | standaard | generieke melding; "Opnieuw sturen" na 60 s (UX §4.12). De standaard-SMTP van Supabase heeft een lage verzendlimiet: voldoende voor één gezin. Eigen SMTP is niet nodig (dat zou een extra dienst en kosten betekenen) | beheerd in Supabase |
| Web Push (Apple/Google) | `webpush.sendNotification(…, { timeout: 10_000, TTL: 6 h })`; per tick maximaal 5 tegelijk | 404/410 → abonnement verwijderen; overige fouten → loggen met de statuscode; de in-app-melding staat er al | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| Planner → tick | `net.http_post(…, timeout_milliseconds := 55000)` (de pg_net-standaard is enkele seconden: te kort) | de tick is idempotent; de volgende run haalt in. Het Vercel-cron-vangnet 1×/dag blijft | `CRON_SECRET` in Vercel **en** in Supabase Vault (`vault.create_secret`). Nooit in een migratie of in git (V-32) |
| Huisvuilkalender Den Haag (platform Opzet, onofficieel; W-03) | 8 s per verzoek, 12 s totaal per action of tickstap; redirect: 'error'; ≤ 1 MB | niets wijzigen; twee keer per dag opgehaald (06:00/17:00), na een mislukking elk uur opnieuw; storing na > 48 uur of aanhoudend geen komende ophaaldag → één melding aan de beheerders (§18.8.5). Contract bevestigd door probe P0, uitgevoerd op 2026-09-29 (§18.1.6) | geen geheimen |
| Realtime | — | bij verbroken verbinding: verversen bij terugkeren (bestaand, `visibilitychange`) | — |

**Geen `NEXT_PUBLIC_` voor geheimen.** `src/lib/server-env.ts` importeert `server-only` (bestaand).

## 11. Performance

### 11.1 Volumes (werkelijk gebruik)
- **Eén huishouden**, 2–4 leden, ~20–40 reeksen.
- **Taken:** ~10–20 open taken per dag, ~15 afvinkingen per dag, ~8k taakrijen per jaar.
- **Meldingen:** ~5 per lid per dag.

Alles is klein. Het risico zit in **herhaald** laden (P-01), niet in de volumes.

### 11.2 Snapshot en Realtime (P-01, S-02, S-03)

- **Snapshot opdelen** in slices (`src/lib/data/snapshot.ts`):
  - `core`: huishouden, leden, eigen voorkeuren, standaardtaken, reeksen, wasteCalendarEnabled (W-03, via rpc('waste_calendar_enabled'));
  - `work`: taken + completions;
  - `shopping`: actieve lijst + items;
  - `inbox`: eerste 30 meldingen.
- **Venster van `work`:** taken met `scheduled_date` in [vandaag − 7, vandaag + 14], **plus alle open taken** (verlopen blijven zichtbaar), limiet 1500; completions ≥ vandaag − 35 (Taken › Gedaan 30 dagen, Overzicht "30 dagen"), limiet 1500.
- **Kolommen:** alleen de kolommen die de UI gebruikt (`select` expliciet). `description` wordt alleen in het detail geladen. Vanaf WP4 bevat de kolomlijst van work ook waste_pickup_date, waste_direction en waste_streams (W-03).
- **Periodes laden:** `loadTaskRange(from, to)` in de browser (RLS), voor de Kalender buiten het venster (S-02) en voor Overzicht "Vorige week / 30 dagen". Het resultaat komt in een in-memory map per week (niet in IDB: offline geldt "Niet beschikbaar zonder verbinding", UX §7).
- **Realtime → gericht verversen:** een wijziging in `tasks`/`task_completions` ververst alleen `work` (2 queries); `shopping_*` alleen `shopping`; `household_members`/`households`/`task_recurrences` alleen `core`; `notifications` alleen `inbox`; `task_comments` alleen de notities van een open detail. Debounce 750 ms, gebundeld per slice. **Versimpeltoets:** rij-patches uit de payload (DELETE-payloads bevatten zonder `REPLICA IDENTITY FULL` alleen de sleutel) zijn complexer en foutgevoeliger dan een gerichte herlaadactie van 1–2 kleine queries.
- **Meldingen:** keyset-paginering (`created_at < cursor`, 30 per pagina); de index `notifications_member_idx (member_id, created_at desc)` bestaat.
- **Doelen** (door de performance-reviewer gemeten op seed-volume, telefoonemulatie 390×844, 4G-throttling):
  - HTML + RSC-payload van Vandaag ≤ 200 KB ongecomprimeerd;
  - LCP ≤ 2,5 s;
  - afvinken zichtbaar ≤ 100 ms (optimistisch);
  - Realtime-verversing ≤ 2 queries.

### 11.3 Tick (R-02)

`src/server/system/tick.ts`, **set-gebaseerd over alle huishoudens** in plaats van N+1 per huishouden en per taak:
1. **Plannen:**
   - één query voor de actieve, niet-gepauzeerde reeksen van alle huishoudens (+ tijdzone via een join);
   - één query voor de bestaande `occurrence_date ≥ vandaag − 1` van die reeksen;
   - `planSeries` in het geheugen;
   - één bulk-upsert (`ignoreDuplicates`);
   - `generated_until` alleen bijwerken voor reeksen waarvan hij veranderde.
2. **BR-16 overslaan:** één query voor de open reekstaken, `findSupersededTasks`, één update `in (...)`.
2b. **Afval (W-03):** zie §18.8.6. Eigen try/catch; ophalen alleen als de tick nog geen 10 s loopt.
3. **Meldingen:**
   - één query voor de open taken met `scheduled_date ≤ vandaag + 1` (nieuwe index), één voor de actieve leden met account, één voor de voorkeuren;
   - berekening met `taskMessages`/`summaryMessages`/`recipientsFor` (puur); voor afvaltaken wasteReminder in plaats van taskMessages (§18.9.1);
   - **één** bulk-upsert in `notifications` met `on conflict (member_id, dedupe_key) do nothing returning id, member_id`;
   - push alleen voor die nieuwe id's, gegroepeerd per gebruiker, met maximaal 5 parallel;
   - `pushed_at` bijwerken **op id** (vervangt de huidige update op `title`, die ook oudere meldingen met dezelfde titel raakte).
4. `run_purge()`.
- **Elke stap in een eigen try/catch.** Een fout in stap 3 blokkeert stap 4 niet.
- **Tijdsbudget:** 45 s, daarna stoppen met pushen. De meldingen staan dan al in de app; de volgende run pusht niet opnieuw (dedupe). Een bewuste, geaccepteerde beperking: één run lang mist dan een push.
- **Verwacht:** < 3 s voor één huishouden.

### 11.4 Overig
- **Cold start:** de tick om de 15 minuten houdt de functie warm. Voor gebruikers is streaming + skelet de mitigatie.
- **Supabase Free pauzeert** een project na een week zonder verkeer. Een tick om de 15 minuten voorkomt dat als bijeffect.
- **Geen extra caching laag** (geen `unstable_cache` / `use cache`): alle data is per huishouden en verandert per tik. De IDB-cache is de cache.

## 12. Deployment

### 12.1 Omgevingen
- **Lokaal / sandbox:** `npm run test:db` (kale PG 16 met de stub) en `tests/e2e/support/local-stack.sh` (PG + GoTrue + REST-gateway, zonder Realtime).
- **Productie:** Vercel (Hobby) + Supabase `nmorjuafndteklvobrmt` (eu-central-1).
- **Geen staging-project.** Zie de versimpeltoets. Vercel-previewdeployments zouden de **productiedatabase** gebruiken. Daarom:
  - worden previews niet voor handmatig testen met echte data gebruikt;
  - E2E draait alleen lokaal;
  - na elke productiedeploy volgt een rooktest met Jurgens account. Hij wordt vooraf gevraagd bij destructieve stappen.

### 12.2 Geheimen (alleen namen)
- **Vercel:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.
- **Supabase Vault:** `takenlijstje_cron_secret` (dezelfde waarde als `CRON_SECRET`), `takenlijstje_tick_url`.
- **`CRON_SECRET` roteren:** eerst Vault, dan Vercel. In de tussentijd faalt de tick met 401 en haalt de volgende run in.
- **Nooit geheimen in de repository, in migraties of in `docs/`.**

### 12.3 Volgorde per WP met een databasewijziging

#### 12.3.1 Uitrolstrategie (besluit V-36)

**Twee sporen:**

| Spoor | Branch | Werkpakketten | Live |
| --- | --- | --- | --- |
| Backend op de huidige app | `main` (= productie) | WP1, WP2a, WP2b, WP3, WP3b (W-03) + herstel van bevindingen | direct na de review van elk WP, volgens de stappen hieronder |
| Nieuwe schermen | `v2-ui` (afgetakt van `main` zodra WP2a live is) | WP4–WP8, daarna WP9 | **pas samen** na WP9 en de release gate, via de release-stappen R1–R5 |

**Waarom een branch en geen feature-vlag:** met een vlag staan twee UI's met twee tokensystemen in dezelfde code. DESIGN_SYSTEM §4 verbiedt dat ("in één keer vervangen, niet naast elkaar"). Het zou ook elke review verdubbelen. Een branch houdt `main` precies de huidige app plus de backend-fixes.

**De oude UI blijft werken tijdens WP1–WP3.** Regel: in de oude UI **alleen verwijderen of uitschakelen wat niet meer bestaat, niets herontwerpen**.
- **WP1:**
  - de store van de oude UI verstuurt snelle acties via `POST /api/outbox` (§9.3.1);
  - uitloggen roept `clearLocalData()` aan;
  - er komt een minimale pagina `/geen-toegang`.
- **WP2a** haalt de vervallen onderdelen uit de oude schermen:
  - "Wie?", toewijzen, de tabs "Mijn taken / Iedereen" (er blijft één lijst), avatars bij taken, filters per persoon;
  - de kaart "Samen sparen" en de puntinstellingen;
  - "Ik kan deze taak niet doen", ruilverzoeken, afwezigheid;
  - "lid toevoegen zonder account", "Gezinsleden mogen aan anderen toewijzen";
  - "gedaan door …" in toasts, historie en meldingen;
  - persoonsherkenning in de snelle invoer.

  Het tijdzoneveld wordt alleen-lezen (V-39).
- **Vangnet tegen verwijzingen naar vervallen kolommen:** in WP2a worden de types in `src/types/database.ts` al gegenereerd uit het **doelschema van WP2b**. Een overgebleven verwijzing in de oude UI of de server is dan een typefout (`npm run typecheck` rood), geen runtimefout na het wissen.
- **Bewijs dat de oude UI werkt:** de bestaande E2E-tests (`tests/e2e/tasks.spec.ts`, `onboarding.spec.ts`), bijgewerkt voor wat verdwijnt, zijn groen per WP op `main`. Daarnaast worden rook-screenshots gemaakt van de oude schermen Vandaag, Taken, Kalender, Boodschappen en Instellingen (`docs/screenshots/wp2a/`). Die bekijkt de bouwer zelf; het is geen visual-qa-checkpoint, want die UI wordt vervangen.

**Regels voor `v2-ui`:**
- `main` wordt in `v2-ui` gemerged na elke merge op `main`, en minstens wekelijks.
- Migraties die WP4–WP8 nodig hebben, zijn **alleen additief** en werken ook met de oude UI. Voorbeelden: extra RPC's zoals `unarchive_shopping_list` als die nog niet in `…_200` zit, of indexen.
- Zulke migraties mogen eerder op live worden gezet als dat een risico wegneemt. Anders gebeurt het bij R2. Destructieve migraties zijn op `v2-ui` niet toegestaan.
- **Geen Vercel-previews van `v2-ui`.** Previews gebruiken de productievariabelen en dus de **live database**. Uitschakelen met `vercel.json` → `"git": { "deploymentEnabled": { "v2-ui": false } }`.
- Checkpoints CP1–CP4 en E2E draaien lokaal (`tests/e2e/support/local-stack.sh`).

**Release van de nieuwe schermen (na WP9 en de release gate):**

| # | Stap | Controle |
| --- | --- | --- |
| R1 | `main` volledig gemerged in `v2-ui`; alle tests groen (unit, DB, integratie, E2E) | CI/lokaal groen |
| R2 | Additieve migraties van `v2-ui` die nog niet live staan, toepassen (de oude UI werkt ermee) | rooktest op de oude UI |
| R3 | `v2-ui` → `main` mergen en deployen; de SW-versie (= build-id) wist de oude pagecache. Wachtende outbox-entries blijven geldig (hetzelfde endpoint, `migrateOutboxEntry`) | rooktest: inloggen, Vandaag, afvinken + ongedaan maken, offline afvinken → online |
| R4 | Rooktest met Jurgen op zijn telefoon (PWA op het beginscherm) | zijn akkoord in `PROGRESS.md` |
| R5 | **Rollback:** Vercel Instant Rollback naar de laatste deployment met de oude UI. Dat kan, want alle migraties van `v2-ui` zijn additief | — |

Voor elke WP die op `main` live gaat, en voor R2, geldt de volgorde hieronder.

0. **Alleen bij WP1, vóór `…_100` (plan-critic 7):** alleen-lezen-telling op live: `select count(*) from household_members where user_id is not null and is_active = false`. Is die groter dan 0, dan **stoppen**. De bouwer legt Jurgen per persoon (naam) voor dat die na de update geen toegang meer heeft (V-29), met **twee keuzes** (AC-055/AC-170):
- **"weer aanzetten":** de bouwer zet `is_active = true`, vóór `…_100`;
- **"uitgezet laten":** er verandert niets.

Verwijderen hoort niet bij dit draaiboek; dat kan Jurgen later zelf via Gezinsleden. Er wordt niets aangepast zonder zijn antwoord. **Zijn keuzes worden letterlijk bewaard in `docs/PROGRESS.md`**, in de sectie "Antwoorden van Jurgen", onder de kop "Stap 0 WP1 — uitgezette leden", per naam met `household_members.id` en de keuze. M1(d) gebruikt die lijst. Leden zonder account (`user_id is null`) tellen niet mee: zij loggen niet in en vervallen in WP2b.
1. De migratie lokaal groen (`test:db`, E2E).
2. **Niet-destructieve migratie** eerst op live, via de Supabase-koppeling (MCP `apply_migration`) of de SQL-editor. De huidige productiecode blijft ermee werken ("expand").
3. Code deployen (push naar de productiebranch; Vercel bouwt).
4. Rooktest op live: inloggen, Vandaag, afvinken en terugdraaien, `/api/status` met Bearer.
5. **Terugrollen vóór een contract-stap:** vorige Vercel-deployment terugzetten ("Instant Rollback"); de database is compatibel. Voor WP3b (W-03): Instant Rollback en **direct daarna** `supabase/ops/waste_rollback.sql` (§18.16).

**Live-databasewijzigingen gebeuren pas na de Design Freeze, per WP.** De poort blokkeert MCP-aanroepen niet. Dit is dus een afspraak die de code-reviewer per WP controleert in het verslag van de bouwer.

### 12.4 Datamigratie van de live database (BR-46, V-26) — draaiboek

**Wat blijft:**
- huishouden, leden **met account**, reeksen en taken (zonder persoonsvelden);
- afvinkhistorie (wat, wanneer, geplande dag, deadline, te laat en hoeveel, notitie; zonder persoon en punten);
- notities met schrijver (V-25), boodschappen (zonder door-wie);
- meldingen van de soorten herinnering, deadline nadert en verlopen (hun tekst bevat geen persoon);
- voorkeuren (zonder de vervallen velden), pushabonnementen, uitnodigingen (zonder `member_id`), eigen standaardtaken (zonder punten).
- Makers van taken en reeksen blijven (V-25).

**Wat verdwijnt (BR-46.3):**
- `task_assignments` (alles), `task_swap_requests` (alles), `member_absences` (alles);
- `tasks.assigned_member_id`, `assignment_reason`, `completed_by_member_id`, `points`;
- `task_completions.member_id`, `points`;
- reeksen: `assignment_strategy`, `fixed_member_id`, `rotation_member_ids`, `points`;
- `households.members_can_assign_others`, `points_*`;
- `notifications` van het type `task_assigned`, `swap_request` en `swap_accepted`;
- **bestaande `notifications` van het type `task_completed`, `daily_summary` en `evening_summary`** (plan-critic 1). Hun opgeslagen tekst noemt wie afvinkte ("… is gedaan door {naam}") of is afgeleid van toewijzing ("waarvan N voor jou", "van jou nog open"). Dat botst met V-21 en succescriterium 7. Filteren op tekst is foutgevoelig; deze soorten zijn kortlevend (90 dagen) en hebben geen historische waarde, dus de hele soort vóór M6 gaat weg. Nieuwe meldingen van deze soorten krijgen **vanaf WP2a** teksten zonder naam. "Taak gedaan" gaat vanaf WP2a naar alle leden die hem aan hebben staan, **ook naar wie afvinkte** (V-38a). Zo ontstaan na M6 nooit meldingen waaruit af te leiden is wie afvinkte (plan-critic r2, punt 2). De controle van de ontvangers van `task_completed`-meldingen van na de WP2a-deploy gebeurt **vóór M5** (zie M5), zodat Jurgen niet toestemt terwijl er nog een lek is. **De product-analyst neemt dit op in BR-46.3.** Jurgen ziet het aantal bij M5;
- `shopping_items.added_by_member_id`, `bought_by_member_id`; `shopping_lists.created_by_member_id`;
- `household_members` zonder `user_id` (leden zonder account), plus de technisch vervallen kolommen `email` en `avatar_url`;
- `user_preferences.notify_task_assigned`, `notify_swap_requests`;
- `household_invitations.member_id`, en open uitnodigingen die aan een lid zonder account gekoppeld waren.

**Stappen:**

| # | Stap | Wie | Controle |
| --- | --- | --- | --- |
| M0 | Voorbereiding in de sandbox: `…_200` en `…_210` + `restore_v2.sql` op een lokale kopie van het oude schema met seed-data die op live lijkt (alle vervallen velden gevuld, leden zonder account, ruilverzoeken, afwezigheden). Draaien: back-up → contract → restore → vergelijken | bouwer | `restore_check_v2.sql` geeft per tabel een identiek aantal rijen en een identieke checksum (`md5(string_agg(t::text, '' order by id))`) |
| M1 | **Voorcontroles op live, alleen lezen, vóór elke WP2-migratie** (plan-critic 6; `supabase/ops/precheck_v2.sql`): (a) een gebruiker in meer dan één huishouden? (b) meer dan één completion per `task_id`? (c) meer dan één actieve boodschappenlijst per huishouden (de index in `…_200` zou dan falen)? (d) leden met account en `is_active = false` (ter controle na stap 0 van §12.3)? (e) aantallen van alles wat verdwijnt? (f) een huishouden met een andere tijdzone dan `Europe/Amsterdam` (V-39) | bouwer | (a)/(b)/(c)/(f) ≠ 0 → **stoppen**, niets toepassen, de opties aan Jurgen voorleggen. Er wordt geen ontdubbelregel verzonnen. (d): vergelijk de gevonden leden met de lijst van stap 0 in `docs/PROGRESS.md`. **Stoppen alleen voor namen die Jurgen nog niet bij stap 0 beoordeelde en die niet na WP1 bewust via de app zijn uitgezet.** Die krijgen dezelfde twee keuzes als bij stap 0 ("weer aanzetten" / "uitgezet laten"; AC-055/AC-170), en de keuzes gaan in dezelfde PROGRESS-lijst. Eerder beoordeelde leden en leden die na WP1 in de app zijn uitgezet, worden alleen gemeld. Een bewuste uitzetting herkent de bouwer doordat Jurgen of Ellen die zelf noemde. Is dat niet vast te stellen, dan geldt de naam als "nog niet beoordeeld" |
| M2 | `…_200_scope_expand` op live + de WP2a-code deployen. De app schrijft geen persoonsvelden meer en leest ze niet | bouwer | rooktest; `select count(*) … where completed_by_member_id is not null and completed_at > <deploymoment>` = 0 |
| M3 | **Back-up** (besluit V-33): `supabase/ops/backup_v2.sql` kopieert **alle tabellen van `public`** 1-op-1 naar het schema `backup_v2_<datum>` in hetzelfde project (Frankfurt). Het schema wordt niet via de API ontsloten: `revoke all … from anon, authenticated`. **Geen los exportbestand** (V-33); er verlaten geen persoonsgegevens het project | bouwer | rijen in de back-up = rijen op live, per tabel |
| M4 | **Restore-test:** `restore_check_v2.sql` zet de back-up terug in een apart schema `restore_check` en vergelijkt aantallen en checksums met live. Daarna wordt `restore_check` weer gedropt | bouwer | alle tabellen identiek → verder; anders stoppen |
| M5 | **BEVESTIGINGSMOMENT, verplicht (BR-46.2, V-26).** De bouwer toont Jurgen in gewone taal: de datum en plaats van de back-up, dat het terugzetten getest is, en de exacte aantallen die verdwijnen. **Die aantallen telt hij direct vóór deze vraag opnieuw** (`precheck_v2.sql` deel e), omdat het gezin de app intussen gebruikt (aanbeveling 16). **Ook vóór de vraag, controle van de ontvangers (plan-critic r3, aanbeveling 2):**
- Doel: nagaan dat "taak gedaan" na de WP2a-deploy naar iedereen met die voorkeur aan gaat, ook naar de afvinker (V-38a).
- Methode: per `dedupe_key` van de `task_completed`-meldingen van na de WP2a-deploy de set ontvangende `member_id`'s vergelijken met de set actieve leden met account en `notify_task_completed = true`. Dit is een alleen-lezen-query in `precheck_v2.sql`, deel g.
- Ruis: een voorkeur die ná de melding is gewijzigd (`user_preferences.updated_at` > `created_at` van de melding), geldt niet als afwijking.
- Bij een afwijking: **eerst uitzoeken en herstellen** (codefout = bevinding + regressietest), dan pas de vraag aan Jurgen. Hij vraagt letterlijk: *"Mag ik dit nu definitief wissen? Antwoord met ‘ja, wissen’."* Het antwoord gaat letterlijk in `docs/PROGRESS.md` | bouwer ↔ **Jurgen** | **Zonder dat antwoord wordt `…_210` nooit uitgevoerd.** Een eerder "ja" (bijvoorbeeld bij `/design-go`) telt niet |
| M6 | `…_210_scope_contract` op live, in één transactie, **in dezelfde sessie als Jurgens "ja, wissen"** (aanbeveling 16). Loopt de sessie af of zit er een nacht tussen, dan eerst opnieuw M3–M5 | bouwer | na afloop: `test 30_privacy.sql`-query's op live (alleen lezen) + inhoudscontrole: `select count(*) from notifications where title ilike '%gedaan door%' or body ilike '%voor jou%' or body ilike '%van jou%'` = 0; aantallen van wat blijft = telling vóór M5 − verwacht |
| M7 | Rooktest met Jurgen (Vandaag, afvinken, historie zichtbaar in Taken › Gedaan) | bouwer + Jurgen | — |
| M8 | Back-upschema opruimen na 30 dagen (V-33), alleen na een melding aan Jurgen | bouwer | `drop schema backup_v2_<datum> cascade` |

**Rollback:**
- **Tussen M2 en M6:** de vorige Vercel-deployment terugzetten. De databasekolommen bestaan nog; de oude code werkt (`…_200` is compatibel, de oude `complete_task`-signatuur bestaat nog).
- **Na M6:** `supabase/ops/restore_v2.sql`:
  1. de vervallen kolommen, tabellen en enumwaarden opnieuw aanmaken (definities uit de oorspronkelijke migraties);
  2. de data terugkopiëren uit `backup_v2_<datum>`: `update … from` voor kolommen, `insert` voor tabellen en rijen;
  3. de vorige Vercel-deployment terugzetten.

  Wijzigingen die ná M6 in de app zijn gedaan, gaan daarbij verloren voor de teruggezette kolommen. Dit is in M0 getest.
- **Na M8 (30 dagen, V-33):** het back-upschema bestaat niet meer, en terugzetten van de gewiste gegevens is dan niet meer mogelijk. Er is geen los exportbestand. De melding aan Jurgen bij M8 noemt dit expliciet.

## 13. Teststrategie

| Laag | Waar | Wat (minimaal) | Database |
| --- | --- | --- | --- |
| **Unit** (vitest) | `src/domain/**/__tests__`, `src/lib/**` | `planSeries` zonder toewijzing (horizon 14 d, eerstvolgende, geen duplicaat, `from`); `reminders` (ontvangers volgens V-23, tellingen voor het huishouden, geen namen); `stats` (huishouden, lege periode); `quick-add` (geen persoon, `matchedText`); `permissions`; `outbox/merge`; `appUrl` (altijd intern); tekstbuilders zonder naam | — |
| **Database / RLS** (SQL, `supabase/tests/`) | `10_rls_and_functions.sql` (bijwerken), ✚ `20_rechten_br.sql`, ✚ `30_privacy.sql`, ✚ `40_retentie.sql`, ✚ `50_rpc.sql` | per regel uit §5.2 een positieve en een negatieve test, onder meer: **B-01-regressie** (gezinslid → `stop_series`/`pause_series`/`clear_series_occurrences`/`delete_task future` op andermans reeks → 42501 **en het aantal open taken is ongewijzigd**); BR-20 met de instelling uit (insert taak **en** reeks geweigerd); BR-24 (laatste actieve beheerder niet te degraderen, uit te zetten, te verwijderen of zijn account te verwijderen); V-29 (uitgezet lid: 0 rijen overal, eigen rij leesbaar, RPC's weigeren); BR-25 (insert `notifications` als `authenticated` geweigerd; `url = '//x.nl'` geweigerd door de check); BR-11 (`unique (task_id)`); BR-13 (ieder lid mag terugdraaien); BR-44 (tweede huishouden of uitnodiging geweigerd); maker onveranderlijk; `archive_shopping_list` twee keer → één nieuwe lijst; `delete_household` cascade; `purge_expired_data` op grensdatums; privacy-schema | kale PG 16 + stub (`run.sh`) |
| **Integratie** (vitest, ✚ `tests/integration/`) | services + RPC's tegen de lokale stack (GoTrue + gateway), met echte sessies van de seed-gebruikers | `completeTask` dubbel en gelijktijdig (`Promise.all`) → één registratie; `updateTask future` door een gezinslid zonder recht → `FORBIDDEN`, reeks en taken ongewijzigd; tick op een vaste `now`: planning, overslaan, meldingen naar de juiste ontvangers, **tweede tick maakt niets dubbel**; account verwijderen (laatste beheerder geweigerd; anders lid + auth weg) | `local-stack.sh` |
| **E2E** (Playwright, iPhone 13 → 390×844, Chromium) | `tests/e2e/*.spec.ts` (herschreven naar de nieuwe UI) | **Kernflow:** inloggen → Vandaag → afvinken → toast → Ongedaan maken → opnieuw → herladen = gedaan. **Offline:** `context.setOffline(true)` → afvinken → "wacht op verbinding" → online → één registratie. **Tweede gebruiker** (tweede context, Ellen) ziet het na herladen (Realtime ontbreekt lokaal, bekend). **Rechten in de UI:** een gezinslid ziet geen reeksacties op andermans reeks. **Uitgezet:** beheerder zet Kai uit → Kai ziet `/geen-toegang` en de IDB is leeg. **Wachtwoord vergeten:** link via `auth.admin.generateLink({ type: 'recovery' })` → `/auth/confirm?token_hash=…` → nieuw wachtwoord → Vandaag. **Uitloggen** wist de IDB. **Sheet-URL:** `/?taak=<id>` direct openen en vernieuwen | `local-stack.sh` + `npm run seed` (seed bijgewerkt: geen leden zonder account, geen toewijzing) |
| **Screenshots** | `scripts/visual-check.mjs` → `docs/screenshots/cp1…cp4/` | 390×844, licht en donker, alle states uit UX §7 van de schermen in dat checkpoint | lokale stack |

- **Testdatabase:** nooit productie.
- **Regressietests:** elke bevinding uit een review krijgt een test op de passende laag.
- **WP3b (W-03):** zie §18.15 (stub `tests/e2e/support/waste-stub.mjs`, `supabase/tests/70_afval.sql`, `tests/integration/waste.test.ts`, `tests/e2e/waste.spec.ts`).

## 14. Versimpeltoets per onderdeel

| Onderdeel | Eenvoudigste variant die even betrouwbaar is | Gekozen? Waarom |
| --- | --- | --- |
| Planner 15 min | pg_cron + pg_net → bestaande route | **Ja** (besluit V-32). Geen nieuwe dienst, gratis, één regel SQL. Tick-logica in SQL herschrijven kan niet goed: Web Push vraagt Node (VAPID-ondertekening) |
| Twee triggers (pg_cron + Vercel 1×/dag) | alleen pg_cron | **Nee, beide houden.** Het vangnet kost niets en is idempotent. Valt pg_cron uit, dan draaien planning en opruimen nog dagelijks |
| Lock of lease tegen overlappende ticks | geen lock, unieke constraints | **Geen lock.** Alle schrijfstappen zijn idempotent; pushen alleen voor nieuw ingevoegde rijen |
| Rechtencontrole | alleen RLS + `expectRows` | **Deels.** Voor losse updates en deletes volstaat RLS + `expectRows`. Voor stoppen, pauzeren en verwijderen met meerdere stappen: een RPC, want atomisch en "geweigerd = er verandert niets" moet gegarandeerd zijn (B-01) |
| "Deze en volgende" wijzigen | één grote RPC met een jsonb-patch | **Nee.** User-update (RLS) → clear-RPC → planner. Dat herstelt zichzelf bij een fout halverwege (§6.1) en houdt de planningslogica in de geteste TS-domeinlaag |
| Service role | overal de user-client, ook voor planning | **Nee.** Planning na afvinken door een gezinslid zonder aanmaakrecht zou falen. Daarom één smalle systeemfunctie die alleen invoegt, afgeschermd met ESLint |
| Sheets met URL | zoekparameters + één `SheetHost` | **Ja.** Werkt offline uit de snapshot; intercepting routes niet |
| Realtime-verversen | gericht per slice | **Ja** boven rij-patches (§11.2) |
| Gelijktijdig bewerken | laatste schrijver wint | **Ja**, geen versieveld (§7) |
| Back-up | kopie-schema in dezelfde database | **Ja** (besluit V-33). Test het terugzetten zonder dat persoonsgegevens het project verlaten en zonder een databasewachtwoord te delen. Geen los exportbestand |
| Staging-omgeving | geen; lokale stack + expand/contract + back-up | **Ja.** De lokale stack draait dezelfde migraties en RLS. Wat ontbreekt (Realtime, auth-mail) wordt na de deploy op live gecontroleerd |
| Opruimen (retentie) | als stap in de tick | **Ja**, één mechanisme |
| Account verwijderen bevestigen | wachtwoord | **Ja**, boven een e-mailcode (geen tweede mailtemplate) |
| Uitgezet lid | `is_active` in de bestaande helpers | **Ja.** Eén wijziging in drie functies dekt alle policies en RPC's |
| Snapshot | één groot object (nu) | **Nee.** Slices + een kleiner venster: P-01 is een gemeten risico |
| Prisma (standaardstack) | supabase-js + RLS (bestaand) | **Geen Prisma.** Een tweede datalaag zou RLS omzeilen of dubbel moeten bewaken |
| Losse taak offline aanmaken | ja, één upsert | **Ja**, reeksen niet (planning op de server) |
| Wachtrij over deploys | één stabiel endpoint `/api/outbox` + versie per entry | **Ja** (§9.3.1), boven server-action-id's per build of skew protection |
| "Losse taak wordt terugkerend" | één uitzondering in de bestaande guard | **Ja** (§5.2 "Reekskoppeling"), boven een extra RPC: dezelfde rechten, één plek |
| Schrijvernaam bij notities | één kolom `author_name` = laatst bekende naam | **Ja** (§3.1), boven een UI-regel die tussen twee bronnen kiest |
| "Niet meer lid"-melding | detectie via de eigen IDB-cache | **Ja** (§4.6), boven een tombstone in de database (die een persoonsgegeven zou bewaren) |
| Afvalkalender (W-03) | zie §18.17 | — |

## 15. Work packages

**Volgorde volgens werkwijze §15.6:** eerst wat aantoonbaar nodig is. Dat zijn de securitygaten op de live app, het datamodel van de scopewijziging en de planner. Daarna de UI, van fundament naar kernflow naar de rest.

**Reviews op niveau 2:**
- **code-review** en **test-writer:** elke WP;
- **security-review:** hier verplicht (login, meerdere gebruikers, persoonsgegevens van minderjarigen) bij WP1, WP2a, WP2b, WP3, WP7 en de release;
- **performance-review:** na WP's met data of zware schermen, en vóór de release;
- **ux-reviewer:** vanaf CP3 en vóór de release;
- **visual-qa:** bij elk checkpoint;
- **accessibility-reviewer:** conditioneel. Voorstel: één ronde bij CP4, omdat A-01/A-02 open staan en de kalender toetsenbordbediening krijgt.

| WP | Doel en inhoud | Afhankelijk van | BR / UC / bevindingen | Checkpoint | Reviews |
| --- | --- | --- | --- | --- | --- |
| **WP1 — Rechtenmodel en securityfixes (live, niet-destructief)** | **Eerst stap 0 van §12.3** (telling van uitgezette leden met account op live; > 0 → Jurgen). Migraties `…_100`, `…_110` (inclusief de regel "Reekskoppeling"); **wachtrij-endpoint `POST /api/outbox` + `OUTBOX_VERSION` + `migrateOutboxEntry` + "nooit stil weggooien" (§9.3.1)**, zodat elke latere deploy de offline-wachtrij niet meer kan breken; `src/server/system/**` + ESLint-regel; `expectRows`; `ActionResult.code`; `stopSeries`, `pauseSeries`, `deleteTask` en `updateTask future` via RPC's zonder service role; `systemDb` en `fallbackDb` weg; notificatie-insert alleen door het systeem + URL-check + SW-originecheck; `/api/status` achter Bearer; `is_active` in de helpers + `/geen-toegang` (minimaal) + `clearLocalData()` bij uitloggen en uitzetten; Next 16.3.7. Op de **huidige** UI (alleen de minimaal nodige UI-aanpassing) | — | B-01, B-02 (route vervalt pas in WP2; tot dan: `autoAssign` met de user-client en een weigering als het niet mag), B-03, B-04, B-05, BR-22, BR-23, BR-24, BR-25, BR-26, BR-43, V-29 | geen (backend) | code, test-writer, **security**. Live na de review |
| **WP2a — Scope uit de code + expand (aanbeveling 15)** | Code: toewijzing, verdeling, ruilen, afwezigheid, punten, "namens", `completed_by` en `added_by`/`bought_by` eruit (server, domein, store, mutaties, de schermen waar ze nu staan: minimaal verwijderen, geen herontwerp); `complete_task` v2, `undo` voor iedereen; voorkeuren per rol; `author_name` + triggers (V-34); BR-44; idempotente uitnodigingen, standaardtaken en archiveren; **meldingen (plan-critic r2, punt 2):** `completeTaskAction` stuurt "taak gedaan" via `recipientsFor` naar ieder actief lid met account dat hem aan heeft, **ook naar wie afvinkte** (V-38a); er gaat geen afvinker mee in de aanroep, en dit vervangt de uitsluiting in `src/server/actions/tasks.ts:59-74`. De teksten van "taak gedaan" en van het dag- en avondoverzicht bevatten geen naam en geen "voor jou" (de tickteksten gaan daarom al in WP2a mee; WP3 maakt de tick daarna set-gebaseerd). Integratietest: Jurgen vinkt af → Jurgen en Ellen (beiden aan) krijgen de melding, Lynn (uit) niet; `migrateOutboxEntry` v0 → v1 voor de vervallen soorten; `src/types/database.ts` uit het doelschema van WP2b (§12.3.1); tijdzone vast (V-39: invoer weg + check na M1(f)); oude UI: alleen verwijderen wat vervalt, de oude E2E groen en rook-screenshots; seed en tests bijgewerkt; daarna de branch `v2-ui` aanmaken + previews uitschakelen in `vercel.json`; M0 (sandbox-proef van het draaiboek). Live: §12.4 **M1 (voorcontroles) → M2 (expand + deploy)** | WP1 | UC-02, BR-10…BR-14, BR-20, BR-31 (standaarden), BR-41, BR-42, BR-44, R-03, V-21, V-22, V-24, V-25, V-34 | geen (backend); rooktest na M2 | code, test-writer, **security**, **performance** (snapshot zonder de vervallen tabellen) |
| **WP2b — Back-up, bevestiging en wissen (contract)** | §12.4 **M3–M8**: back-up, restore-test, hertelling, **"ja, wissen" van Jurgen (M5)**, `…_210` in dezelfde sessie, rooktest, na 30 dagen de back-up opruimen. Het wachten op Jurgen houdt WP3 en verder **niet** tegen: de code van WP2a gebruikt de vervallen kolommen al niet meer | WP2a (en M0 geslaagd) | BR-46, V-26, V-33; succescriterium 7 | geen; controles M6 | code (scripts), **security** (inhoudscontrole meldingen, privacytest op live). **Bevestiging van Jurgen bij M5** |
| **WP3 — Achtergrond: planner, tick, meldingen, retentie** | `supabase/ops/planner.sql` (V-32: pg_cron + pg_net, geheim in Vault); tick set-gebaseerd (§11.3); ontvangers volgens V-23; teksten zonder namen; "taak gedaan" naar iedereen met die voorkeur aan, ook naar wie afvinkte (V-38a; `recipientsFor` krijgt geen actor-parameter); `pushed_at` op id; push-time-out; `…_300_retentie`; `vercel.json` als vangnet | **WP2a** (niet WP2b: de planner hangt niet af van het wissen) | BR-16, BR-30, BR-31, BR-45, R-01, R-02, UC-08 | geen; meting: tijd tussen het geplande moment en de melding ≤ 15 min (succescriterium 5) | code, test-writer, **security** (Bearer, Vault), **performance** (tickduur) |
| **WP3b — Afvalkalender (W-03), live op `main` in de oude UI** | **P0 en U0.2 uitgevoerd op 2026-09-29** (§18.1.6; `docs/wijzigingen/W-03/probe/`: contract A/B/C bevestigd; onbekend adres A `[]`, onbekende adrescode B `{}`, ongepubliceerd jaar C `[]`; geen datacenterblokkade). **Vóór U4: U0.1** (gemeenteregel 22:00/07:45 door Jurgen). **Bij U5:** bereikbaarheid vanaf Vercel `fra1` (bij een blokkade §18.16 U5). **Bouwen:** fixtures uit `probe/` plus synthetische in dezelfde vorm; migraties `…_320` en `…_330` (§18.3–18.7, inclusief `last_failure_at` en `alarm_since`); `src/domain/waste/*` (move; `hasNoUpcoming` en `classifyEmpty` met de jaareinde-uitzondering in november/december en notice T-73; gezondheid met `last_failure_at`/`alarm_since`; `wasteFailureVariant` inclusief `null` → H1; twee ophaalmomenten; J+1 in december of als C(J) geen komende datum meer heeft; geen C(J−1); bovengrens binnenzetten D+7); `src/server/waste/*` (parser met strippen en herkenning van B `{}`); `system/waste/sync.ts` (+ `markWasteAlarm`); `actions/waste.ts` (`saved.mode`, `inserted` → T-90/T-90b, `too_soon` zonder verzoek); tickstap; `wasteReminder`; `recipientsFor`; route `instellingen/afvalkalender` (redirect); `supabase/ops/waste_rollback.sql`; oude UI volgens §18.14 en de tekst-ID's uit §18.11; tests §18.15 met stub-scenario's. **Checkpoint CP-W03 (U3) vóór de livegang.** Uitrol U4–U8 | **WP3 live** (pg_net via `planner.sql`, tick elke 15 min); P0 en U0.2 afgerond (2026-09-29). Niet WP4+ | BR-47…BR-59, UC-13…UC-15, **AC-183…AC-223, AC-236, AC-237**, V-41…V-58, D-046 | **CP-W03**: de 41 punten uit §18.16 U3 (de enige lijst), 390×844, ◐ ook donker, in `docs/screenshots/wp3b/`; checkpoint in PROGRESS | code, test-writer, **security** (bron, SSRF/allowlist, adres = persoonsgegeven, strippen van coördinaten en ids uit A, RLS/guard/RPC's, `last_failure_at`/`alarm_since` alleen via de service role, platformlogs §18.12, L4 volgens D-046), **performance** (tickduur met en zonder ophalen), **visual-qa + ux-reviewer (licht) op CP-W03 vóór U4**; rooktest Jurgen (AC-217) |
| **WP4 — Fundament UI: tokens, lettertype, shell, navigatie, states, sheets** | `globals.css` volgens DESIGN_SYSTEM §4 (één bron, D-01); Figtree zelf gehost via `next/font/local` (V-31); accent `#2B4C9B` + nieuw app-icoon in die tint (V-30); componenten in `src/components/ui/*` restyled; `AppShell` (onderbalk: Vandaag · Taken · + · Kalender · Boodschappen; kop: bel + tandwiel; V-28); max. 480 px-kolom (D-05); Toaster onder; `(app)/layout` met Suspense + `DataErrorBoundary`; `loading`/`error`/`not-found`/`global-error`; `SheetHost` + `sheets.ts` + `appUrl`; offlinebalk; SW: 3 s time-out, `/offline`-fallback, `CLEAR_PAGES`; snapshot-slices + gericht Realtime (P-01); manifest `theme_color` ✚ W-03: de expliciete kolomlijst van `work` bevat `waste_pickup_date`, `waste_direction` en `waste_streams` (`description` blijft alleen in het detail). De `core`-slice krijgt `wasteCalendarEnabled` via `rpc('waste_calendar_enabled')`. De IDB-cache werkt ook met oudere items zonder deze velden (die worden als gewone taak getoond tot de verversing). `isWasteTask` en de permissiehelpers gelden in de nieuwe store. | WP2a | S-01, S-04, D-01, D-05, P-01, UX §3, §7, **AC-224** | **CP1** (shell en navigatie, leeg, laden, fout, offline) | code, test-writer, **performance** (payload, LCP), **visual-qa** |
| **WP5 — Vandaag en de afvinken-kernflow + taakdetail** | Vandaag volgens UX §5.1 (Verlopen, Vandaag, gedaan-regel, Binnenkort, weekkaart); taakrij met **twee losse knoppen** (rondje + rij, A-01); optimistisch afvinken en ongedaan maken; "wacht op verbinding"; detail-sheet `?taak=` (acties, notities met laadfout S-03, Vorige keren); lege staten a/b; outbox-foutafhandeling ✚ W-03: lijstrij met kenmerk T-15, rechterkolom T-16…T-19 en plek volgens UX §13.4; taakdetail volgens UX §13.6 (T-20…T-28; T-25 alleen bij de eigen instelling aan); overslaan-melding T-31 met Ongedaan maken van beide; optimistisch overslaan van `out` neemt `in` mee, ook via de wachtrij; verplaatsen of bewerken van een afvaltaak komt nooit in de wachtrij (anders T-33). | WP4 | UC-01, UC-02, BR-10, BR-11, BR-13, BR-14, BR-17, D-02, A-01, S-03 (notities); succescriteria 6, **AC-225, AC-226, AC-227** | **CP2** (Vandaag) → **CP3** (kernflow met leeg, laden, fout, succes, offline, bezig) Screenshots van de afvalrij en het afvaldetail horen bij CP2 en CP3. | code, test-writer (+ **E2E kernflow**), **performance**, **visual-qa** (CP2 en CP3), **ux-reviewer** (CP3) |
| **WP6 — Taak maken en wijzigen, reeksen, Taken-scherm** | Nieuwe taak `?nieuw` (Naam · Wanneer, slimme invoer zonder personen, Herhalen, Meer instellingen; offline losse taak); Bewerken `?bewerk` + "Wat wil je wijzigen?"; pauzeren, hervatten, stoppen, verwijderen; Taken (Open, Gedaan, Terugkerend, filtersheet, actieve filters wissen, zoekveld met label); reeksdetail `?reeks` met **Wijzigen via `updateSeriesAction`** (ook zonder open uitvoering of tijdens een pauze); standaardtaken activeren ✚ W-03: Taken › Terugkerend toont bovenaan T-96 als `wasteCalendarEnabled` (pijl alleen voor beheerders, naar `/instellingen/afvalkalender`); `?bewerk=<id>` van een afvaltaak opent `?taak=<id>`; 'Wat wil je wijzigen?' en omzetten naar terugkerend zijn nooit bereikbaar voor afvaltaken; zoeken en het categoriefilter vinden afvaltaken. | WP5 | UC-03, UC-04, BR-01, BR-02, BR-08, BR-09, BR-18, BR-20, BR-22, BR-23, S-03 (filters), A-03 (label), D-04, **AC-228, AC-229** | CP3-aanvulling (formulierstates) | code, test-writer, **visual-qa**, **ux-reviewer** |
| **WP7 — Instellingen, account en auth** | Instellingen als lijst + subpagina's (D-03); profiel; meldingen instellen + push (iOS-uitleg); gezinsleden (uitzetten, weer aanzetten, rol, verwijderen, uitnodigen, intrekken); standaardtaken beheren; huishouden (+ verwijderen); account verwijderen; login zonder "Nieuw"; wachtwoord vergeten en nieuw wachtwoord; uitnodiging accepteren (account maken of inloggen, BR-44-fout); onboarding zonder verdeling en zonder Google/Apple; `/geen-toegang` definitief; het scherm "niet meer lid" vóór de onboarding (§4.6); tijdzone alleen tonen, vast `Europe/Amsterdam` (V-39, §6.2) ✚ W-03: de route `/instellingen/afvalkalender` wordt de echte subpagina (vervangt de redirect uit WP3b), met **alle toestanden en tekst-ID's uit §18.11** (laden en laden mislukt, A, A′, B, C, C2, D, E, F, F2, G, G′, G″, H1/H2/H3 inclusief T-77e/T-78/T-79 in de balk en de bewaarde datums bij H, I met T-81/T-81b/T-81c, J, offline, meldingen onderin T-90, T-90b, T-91…T-94); de rij T-35/T-36/T-37 in de groep Huishouden (gezinslid: rij zonder pijl + T-38/T-39); hergebruikt de actions en `getWasteSettings` uit WP3b ongewijzigd. | WP4 (WP5 voor de navigatie) | UC-09, UC-10, UC-11, UC-12, BR-24, BR-41, BR-43, BR-44, V-14, V-15, V-23, V-29, **AC-230, AC-231** (die AC-236 en AC-237 in de nieuwe UI meenemen) | CP3-aanvulling (instellingen, login) Hoort bij de CP3-aanvulling (instellingen). De screenshotpunten 1–30 uit CP-W03 (§18.16 U3) worden daar in de nieuwe UI herhaald. | code, test-writer, **security** (auth-flows, verwijderen), **visual-qa**, **ux-reviewer** |
| **WP8 — Kalender, Boodschappen, Meldingen, Overzicht** | Kalender dag/week/maand met periodes laden (S-02), spookjes, "+ Taak" per dag, slepen als extra naast "Andere dag…" (A-02); Boodschappen (onderbalk, archiveren + ongedaan maken, bewerken `?product`); Meldingen (groepen, keyset "Oudere laden", push-kaart, A-03-stip); Overzicht (`/overzicht`, huishoudcijfers, lege staat) ✚ W-03: Kalender dag, week en maand zonder slepen voor afvaltaken ('+ Taak' blijft; T-95 volgens UX §13.11); meldingenlijst met label T-39c en icoon voor `waste_sync_failed`, link naar `/instellingen/afvalkalender`; Overzicht groepeert afvaltaken onder T-97/T-98. Een vanzelf overgeslagen buitenzet- of binnenzet-taak telt als vergeten; een vervallen (verwijderde) afvaltaak telt niet mee. | WP5 | UC-05, UC-06, UC-07, UC-08, BR-42, S-02, S-03, A-02, A-03, D-04, **AC-232, AC-233, AC-234** | **CP4-voorbereiding** Hoort bij de CP4-voorbereiding. | code, test-writer, **performance** (periodes laden, meldingen), **visual-qa**, **ux-reviewer** |
| **WP9 — Hardening en opruimen** | Alle states uit UX §7 nalopen; CSP met nonce in `proxy.ts`; ESLint bijwerken; dode code weg (`src/integrations/*`, features van toewijzing, punten en afwezigheid, `supabase/cron/schedule-tick.sql`); `docs/ARCHITECTUUR.md` vervangen door een verwijzing naar dit document (lost de vier afwijkingen op); prototypes archiveren; E2E volledig; succescriteria 5–7 meetbaar maken ✚ W-03: E2E-kernflow afvalkalender in de nieuwe UI (aanzetten, Vandaag, detail, overslaan, een storing die de beheerder wel en het gezinslid niet ziet, uitzetten) met de stub; CP4 bevat de afvaltoestanden. | WP3–WP8 | DoD niveau 2, INVENTARIS §7 "Overig", **AC-235** | **CP4** (volledige UI, licht en donker, 390×844) | alle verplichte reviewers voor de release gate: code, test-writer, **security** (volledig), **performance**, **ux**, **visual-qa**, accessibility (voorstel) |

**Uitrol (V-36):** WP1, WP2a, WP2b, WP3 **en WP3b (W-03)** gaan direct live op `main`, op de oude UI. WP4–WP8 worden gebouwd op de branch `v2-ui` en gaan pas samen live na WP9 (§12.3).

**Waarom WP1–WP3 vóór de UI:**
- B-01 is een open BLOKKEREND-bevinding op de live app.
- R-01 raakt de kern van het doel ("minder vergeten").
- Het datamodel bepaalt wat de nieuwe schermen kunnen tonen. Bouw je de UI op het oude model, dan moet dat werk opnieuw.

## 16. Behouden / Herwerken / Vervangen (voorstel voor INVENTARIS §8)

| Onderdeel | Oordeel | Reden |
| --- | --- | --- |
| Stack (Next 16, React 19, Supabase, Tailwind 4, Radix, Vercel) | **Behouden** | Past, is actueel en werkt; alleen de patch 16.3.7 |
| Datamodel-principe (`household_id`, samengestelde FK's, unieke sleutels) | **Behouden** | Sterke basis voor isolatie en idempotentie (INVENTARIS §6) |
| Tabellen `task_assignments`, `task_swap_requests`, `member_absences` en de persoons- en puntvelden | **Vervangen (verwijderen)** | Scopewijziging V-21/V-24/V-25; BR-46 |
| RLS-basis (policies per tabel, helpers in `private`) | **Herwerken** | Actief-lidcheck (V-29), `can_manage_series`/`can_delete_task`, geen insert op meldingen, maker onveranderlijk, revoke op interne functies |
| RPC's `complete_task`/`undo_complete_task` | **Herwerken** | Zonder persoon; iedereen mag terugdraaien; `unique (task_id)` |
| RPC `accept_swap_request` | **Vervangen (verwijderen)** | Ruilen vervalt |
| RPC's `create_household`, `accept_invitation`, `get_invitation` | **Herwerken** | BR-44; zonder koppeling aan leden zonder account |
| Nieuwe RPC's (reeksacties, `delete_task`, archiveren, account en huishouden verwijderen, purge) | **Nieuw** | Atomisch en met eigen rechtencheck (B-01, R-03, V-15, BR-45) |
| `src/server/context.ts` (`requireMember`/`requireAdmin`) | **Herwerken** | Actief lid; geen cookie om van huishouden te wisselen |
| `src/server/errors.ts` | **Herwerken** | `expectRows`, `code` in `ActionResult` |
| Server actions taken | **Herwerken** | Zonder service role; RPC's; zonder toewijzen en ruilen |
| `services/tasks.ts` (`systemDb`, `autoAssignOnce`, `notifyAssigned`) | **Vervangen** | Bron van B-01/B-02; scope |
| `services/scheduling.ts` | **Herwerken** → `system/planner.ts` | Alleen invoegen; set-gebaseerd; zonder toewijzing en afwezigheid |
| `services/tick.ts` | **Herwerken** → `system/tick.ts` | R-02; V-23; retentie |
| Dispatcher en Web Push-kanaal | **Behouden, herwerken** | Het goede kanaalontwerp blijft; weg: fallback, `task_assigned`/`swap_*`, `pushed_at` op titel; nieuw: een time-out |
| Planner (`vercel.json` 1×/dag, `supabase/cron/schedule-tick.sql`) | **Vervangen** | R-01; pg_cron + pg_net (V-32); Vercel blijft als vangnet |
| `src/domain/recurrence`, `dates`, `supersede`, `status` | **Behouden** | Getest en correct (aanname PROGRESS) |
| `src/domain/scheduling/plan.ts`, `reminders.ts`, `stats.ts`, `quick-add` | **Herwerken** | Zonder personen en punten |
| `src/domain/assignment/*` | **Vervangen (verwijderen)** | V-21 |
| Snapshot (`src/lib/data/snapshot.ts`) | **Herwerken** | Slices, kleiner venster, periodes laden, meldingen pagineren (P-01, S-02, S-03) |
| Offline-wachtrij en cache (`src/lib/offline/*`, `store.tsx`, `mutations.ts`) | **Behouden, herwerken** | Principe en idempotentie blijven; nieuw: `clearLocalData`, userId-sleutel, foutcodes, losse taak offline, gericht verversen |
| Service worker | **Herwerken** | S-04, 3 s time-out, `CLEAR_PAGES`, controle op eigen origin bij meldingsklik (B-03) |
| Auth-routes (`callback`, `confirm`, `signout`), `proxy.ts` | **Behouden, herwerken** | Wachtwoord vergeten via `confirm`; uitloggen via client-handler; CSP |
| Loginscherm, onboarding, uitnodiging | **Herwerken** | V-05, V-14, BR-44, UX |
| Schermen Vandaag, Taken, Instellingen, Overzicht | **Herwerken** | UX §5 (D-02, D-03, UC-06) |
| Kalender, Boodschappen, Meldingen | **Behouden met aanpassingen** | UX §5.3, §5.6, §5.7 |
| Visuele laag (`globals.css`, `src/components/ui/*`) | **Vervangen (waarden en klassen), structuur behouden** | DESIGN_SYSTEM §0: Radix-basis blijft, stijl opnieuw |
| Dialogen zonder URL | **Vervangen** | Sheets via zoekparameters (UX §3) |
| Globale states (`loading`/`error`/`not-found`) | **Nieuw** | S-01 |
| Unit- en databasetests, lokale stack | **Behouden, uitbreiden** | §13; E2E herschrijven naar de nieuwe UI |
| `src/integrations/*`, `Skeleton` (ongebruikt) | `integrations`: **verwijderen**; `Skeleton`: **behouden en gebruiken** | Dode code; skelet nodig voor S-01 |
| `docs/ARCHITECTUUR.md` | **Vervangen** door een verwijzing naar dit document | Vier afwijkingen tegenover de code (INVENTARIS §7) |

## 17. Besluiten van Jurgen (verwerkt) en open punten

**Open punten:**
- Geen. Jurgen besliste op 2026-09-28 ("Volg voorstellen", letterlijk in `docs/PROGRESS.md`):
  - **V-36:** WP1–WP3 gaan direct live; WP4–WP8 gaan pas samen live na WP9 (§12.3, §15).
  - **V-37:** een taak wijzigen mag 4–5 tikken kosten (geen gevolgen voor dit ontwerp).
  - **V-38 (a):** "taak gedaan" gaat ook naar wie afvinkte (§6.1, WP3).
  - **V-39:** tijdzone vast op `Europe/Amsterdam`, alleen zichtbaar (§6.2).
- **W-03 afvalkalender (§18):** besluiten V-41…V-58, letterlijk in `docs/PROGRESS.md` (V-58: de adrescode mag worden bewaard; §18.3.1, §18.12). Open controles vóór de livegang van WP3b: **U0.1** (gemeenteregel 22:00/07:45, Jurgen) en **U5** (bereikbaarheid vanaf Vercel, §18.16).

**Verwerkt uit de plan-critic ronde 1 (TD-deel):** punten 1 (meldingen met namen wissen, §12.4), 3 (eerlijke grens van de platformlogs, §9.4), 4 (Reekskoppeling, §5.2), 5 (`author_name`, §3.1), 6 (voorcontroles vóór expand, §12.4 M1), 7 (telling van uitgezette leden vóór WP1, §12.3 stap 0), 9 (wachtrij over deploys, §9.3.1), 10 (`updateSeriesAction`, §6.1), 12 (technische detectie "niet meer lid", §4.6), 13 (offline in het taakdetail, §9.3), 15 (WP2a/WP2b, §15), 16 (hertellen vóór M5, M6 in dezelfde sessie), 17 (`delete_my_account` via `user_id`, §4.5), 19 (tijdzone: vervangen door V-39, vast, §6.2).

Jurgen antwoordde op 2026-09-28 op V-30 t/m V-35: "Volg je voorstellen" (letterlijk in `docs/PROGRESS.md`).

| Nr | Besluit | Verwerkt in |
| --- | --- | --- |
| **V-30** | Accentkleur `#2B4C9B` (rustig diep blauw), app-icoon in dezelfde tint | §1, WP4 (tokens, icoon, manifest `theme_color`) |
| **V-31** | Figtree, door de app zelf gehost (`next/font/local`), geen verbinding met Google | §1, WP4 |
| **V-32** | Planner: Supabase Cron (pg_cron + pg_net) in het eigen Supabase-project, elke 15 minuten; `CRON_SECRET` in Supabase Vault. Het Vercel-cron-vangnet (1×/dag) blijft | §1, §2, §3.2 (`supabase/ops/planner.sql`), §10, §12.2, WP3 |
| **V-33** | Back-up vóór het wissen als kopie binnen het eigen Supabase-project (schema `backup_v2_<datum>`, Frankfurt), 30 dagen bewaren, daarna verwijderen na een melding aan Jurgen. **Geen los exportbestand** | §12.4 M3, M4, M8, §14 |
| **V-34** | De naam van de schrijver blijft bij notities staan, ook na account verwijderen of verwijderen uit het huishouden (kolom `task_comments.author_name`) | §3.1, §3.2 (`…_200`), §4.5 |
| **V-35** | De bouwer past de Supabase-inloginstellingen aan via de koppeling (Nederlandse herstelmail met `token_hash`-link, minimaal 8 tekens, redirect-allowlist); lukt dat niet, dan een korte stappenlijst voor Jurgen | §4.2, WP7 |

Er zijn geen andere product-, privacy- of scopebeslissingen ingevuld. De uitvoeringskeuzes (wachtwoord als herbevestiging, meeschuivende deadline, zoekparameters voor sheets, geen staging) staan onderbouwd in §4.5, §6.1, §9.2 en §14. Ze horen na de freeze in `docs/DECISIONS.md`.

## 18. Afvalkalender (W-03)

**Basis:**
- PRODUCT_SPEC §14 (BR-47…BR-59, UC-13…UC-15);
- UX_SPEC §13, met de tekstentabel §13.16 als **enige bron** voor zichtbare teksten;
- ACCEPTANCE_CRITERIA WP3b (**AC-183…AC-223, AC-236, AC-237**) en de W-03-aanvullingen in WP4–WP9 (AC-224…AC-235);
- de besluiten V-41…V-58 (V-58: de adrescode mag worden bewaard);
- D-046 (rechten van pg_net op live);
- de uitkomst van P0 en U0.2 (`docs/wijzigingen/W-03/probe/P0-uitkomst.md`, 2026-09-29).

**Uitgangspunten:**
- Afvaltaken zijn gewone rijen in `tasks`, met drie extra kolommen. Alleen het systeem maakt ze, verschuift ze, hernoemt ze en verwijdert ze.
- Leden wijzigen alleen de status: afvinken, terugdraaien, bezig en overslaan. Notities gaan zoals altijd via `task_comments`.
- De planning is een pure functie in `src/domain/waste/`. Toepassen gebeurt atomisch in één RPC.
- **Teksten:** deze sectie legt alleen vast welke uitkomst tot welke toestand en welk tekst-ID leidt (T-xx/M-xx uit UX §13.16). De code bevat die teksten één keer, in `src/domain/waste/messages.ts`, met de ID als commentaar.

### 18.1 De bron: koppelcontract, allowlist en SSRF

#### 18.1.1 Endpoints (platform Opzet, onofficieel en ongedocumenteerd; bevestigd door P0 en U0.2 op 2026-09-29)

| # | Verzoek | Doel | Gedrag volgens P0/U0.2 | Gebruik |
| --- | --- | --- | --- | --- |
| A | `GET /rest/adressen/{POSTCODE}-{huisnummer}` | adres → kandidaten met `bagId`, `huisletter`, `huisnummerToevoeging` | 200, JSON-array; onbekend adres → 200 `[]` (geen 404) | alleen bij het instellen (opzoeken en bevestigen) |
| B | `GET /rest/adressen/{bagId}/afvalstromen` | soorten: `id`, `title`, `menu_title`, `icon` | 200, array met alle 5 soorten, ook zonder datums (~20 KB); **onbekende adrescode → 200 `{}`** (een leeg object, geen lijst en geen 404) | bij elke ophaling: vertaling van `afvalstroom_id` naar een bak, en herkennen van "adres weg" |
| C | `GET /rest/adressen/{bagId}/kalender/{jaar}` | ophaaldagen van een jaar: `afvalstroom_id`, `ophaaldatum` | 200, array; nog niet gepubliceerd jaar → `[]`; onbekende adrescode → `[]`; een vorig jaar blijft opvraagbaar | jaar J altijd. **J+1 in december, en ook zodra C(J) voor rest, papier en PMD geen komende datum meer heeft (in elke maand).** J−1 wordt **nooit** opgehaald (§18.8.1) |

Endpoint D (meldingen van de gemeente) valt buiten de scope (PRODUCT_SPEC §10).

#### 18.1.2 Vaste host, geen redirects, beperkte invoer (SSRF)

- **Basis-URL:** de constante `WASTE_SOURCE_BASE_URL = "https://huisvuilkalender.denhaag.nl"` in `src/server/waste/source.ts`. Er gaat nooit een URL of host uit invoer mee.
  - **Uitzondering, alleen voor tests en E2E:** de omgevingsvariabele `WASTE_SOURCE_BASE_URL` telt alleen als hij exact voldoet aan `^http://127\.0\.0\.1:\d{2,5}$`. Elke andere waarde wordt genegeerd, met de logregel `[waste] override genegeerd`.
- **Paden:** alleen uit gevalideerde waarden:
  - postcode `^[1-9][0-9]{3}[A-Z]{2}$`;
  - huisnummer 1–99999;
  - `bagId` `^[0-9]{16}$` (P0: string met voorloopnul);
  - jaar 2020–2100;
  - elk segment gaat door `encodeURIComponent`;
  - de toevoeging gaat **nooit** naar de bron.
- **Fetch:** `method: "GET"`, `redirect: "error"`, `cache: "no-store"`, geen credentials en geen cookies.
  - Headers alleen `Accept: application/json` en `User-Agent: Takenlijstje/1 (prive gezinsapp)`.
  - Nooit een naam, e-mailadres, huishoud-id of lid-id (AC-218).
- **Antwoord:** status 200, een `content-type` met `json`, body via de stream met een grens van 1 MB, daarna `JSON.parse` en zod.
- **Time-outs:** per verzoek `AbortSignal.timeout(8000)`, samen met een totaalbudget via `AbortSignal.any`. Het totaalbudget is 12 s per server action en 12 s voor de ophaalstap in de tick.

#### 18.1.3 Resultaattype (gooit nooit bij netwerk- of formaatfouten)

```ts
type SourceError = "UNREACHABLE" | "FORMAT" | "NOT_FOUND";
type SourceResult<T> = { ok: true; value: T } | { ok: false; code: SourceError; http?: number };
lookupAddress(postcode, houseNumber, deps)   // A; 200 [] → ok [] (onbekend adres, geen fout)
fetchStreams(bagId, deps)                     // B; 200 {} (U0.2), 200 [] of 404 → NOT_FOUND
fetchYear(bagId, year, deps)                  // C; 200 [] of 404 → ok [] (geen fout)
fetchPickups(bagId, today, deps):
  SourceResult<{ pickups: WastePickups;
                 unknownStreams: number;
                 hadAnyDateInJ: boolean;     // minstens één datum van rest/papier/pmd in jaar J, ook in het verleden
                 fetchedNextYear: boolean;   // C(J+1) is opgehaald zonder fout
                 nextYearHasDate: boolean }> // C(J+1) bevat minstens één datum van rest/papier/pmd
```

**Volgorde:**
- B en C(J) gaan parallel.
- C(J+1) wordt ook opgehaald als het december is (dan parallel), of als C(J) geen komende datum van rest, papier of PMD heeft (dan daarna, alleen in dat geval).
- Alles valt binnen het totaalbudget van 12 s.
- Er wordt nooit een C(J−1) opgehaald.

**Hoe de foutcodes ontstaan:**
- netwerkfout, time-out, 5xx, 429 of een andere 4xx → `UNREACHABLE`;
- kapotte JSON, zod-fout, verkeerde `content-type` of te groot → `FORMAT`;
- A geeft 200 `[]` → geen kandidaten → `not_found`. Dat is geen fout;
- **B geeft 200 `{}`** (U0.2: onbekende adrescode), **200 `[]` of 404 → `NOT_FOUND`**:
  - bij het instellen wordt dat `not_found`;
  - bij het bijwerken wordt dat `ADDRESS_GONE`;
  - bij een bestaand adres geeft B altijd de volledige lijst soorten, dus een lege B is geen normale toestand;
- een fout bij C(J) of C(J+1) (`UNREACHABLE`/`FORMAT`) maakt de hele ophaling `UNREACHABLE`;
- C geeft 404 of `[]`, voor welk jaar ook → leeg, en dat is **geen** fout. C geeft ook `[]` bij een onbekende adrescode. "Adres weg" wordt daarom **alleen** via B herkend. Of een leeg antwoord verdacht is, beslist één regel (§18.8.4).

#### 18.1.4 Parser (zod, `src/server/waste/schema.ts`)

Er worden alleen de velden uit de tabel gelezen. Alles daarbuiten wordt door zod gestript, en wordt nooit bewaard, gelogd of naar de client gestuurd.

| Endpoint | Gelezen velden | Gestript (in P0 gezien) |
| --- | --- | --- |
| A | `bagId` (string `^[0-9]{16}$`; komt er een number, dan links aanvullen met nullen tot 16 cijfers, anders weigeren), `huisletter` (string, `""` = geen), `huisnummerToevoeging` (string, `""` = geen). Alleen voor de weergave T-45a: `openbareRuimteNaam`, `huisnummer`, `woonplaatsNaam` | `postcode` (we gebruiken de ingevoerde), `latitude`, `longitude`, `woonplaatsId`, `gemeenteId` |
| B | `id` (number), `title` (string), `menu_title` (string, optioneel), `icon` (string, optioneel), `ophaaldatum` (`YYYY-MM-DD` of `null`; wordt geparsed maar **niet** voor de planning gebruikt) | `content` (HTML), `icon_data` (base64-SVG), `page_title`, `slug`, `tags`, `parent_id` |
| C | `afvalstroom_id` (number), `ophaaldatum` (`YYYY-MM-DD`; `null` → rij overslaan) | — |

- **B: "adres onbekend" expliciet herkennen, niet als FORMAT.**
  - De body mag een array van soorten zijn **of** precies een leeg object `{}` (U0.2).
  - `{}` en `[]` → `NOT_FOUND`.
  - Een niet-leeg object of elke andere vorm → `FORMAT`.

  Illustratie (geen implementatie):
  ```ts
  const StreamsBody = z.union([z.strictObject({}), z.array(StreamSchema)]);
  // {} → NOT_FOUND; [] → NOT_FOUND; niet-lege array → soorten; anders → FORMAT
  ```
- **Grootte:** B is ~20 KB, ruim onder de grens van 1 MB. De streamgrens blijft staan.
- **`classifyStream`** (`src/domain/waste/streams.ts`, puur), tabel uit P0:

  | `icon` | `title` | Bak |
  | --- | --- | --- |
  | `zak-grijs-rest` | Rest | rest |
  | `doos-karton-papier` | Papier | papier |
  | `petfles-blik-drankpak_pmd` | PMD | pmd |
  | `appel-gft` | GFT | `null` (genegeerd, geteld; AC-196) |
  | `kerstboom-zonder-kruis` | Kerstbomen | `null` (genegeerd, geteld; AC-196) |

  Een onbekend icon valt terug op een trefwoord in `title` of `menu_title`: `rest`, `papier`, `pmd`/`plastic`, tenzij er `grof`, `gft`, `kerst` of `textiel` in staat. Twee stromen die op dezelfde bak uitkomen, worden samengevoegd.
- **Resultaat:** `WastePickups = { rest; papier; pmd }` als gesorteerde, unieke ISO-datums ≥ vandaag, uit de opgehaalde jaren.

#### 18.1.5 Adres kiezen (`src/domain/waste/address.ts`, puur; AC-184, AC-187)

- `normalizeWasteAddress`:
  - postcode in hoofdletters zonder spatie;
  - "12a", "12 a", "12-2" en "12 bis" → nummer + toevoeging;
  - toevoeging maximaal 4 tekens `[A-Z0-9]`.
- `suffix: string | null`: `null` = niet opgegeven, `""` = bewust het adres zonder letter gekozen.
- De letter en toevoeging van een kandidaat = `(huisletter ?? "") + (huisnummerToevoeging ?? "")`, in hoofdletters. `""` is het adres zonder letter of toevoeging.
- `matchCandidate` vergelijkt die waarde met de genormaliseerde invoer:
  - 0 kandidaten → `not_found`;
  - `null` en 1 kandidaat → die kandidaat;
  - `null` en meerdere → `choose`;
  - gegeven → exacte match of `not_found`.
- De app kiest nooit zelf.

#### 18.1.6 P0 en U0.2: probe van de bron, uitgevoerd op 2026-09-29

**Uitvoering:**
- met toestemming van Jurgen ("Ja, probeer maar", letterlijk in PROGRESS);
- via `net.http_get` vanuit het live Supabase-project (AWS eu-central-1, IPv6);
- met User-Agent `Takenlijstje/1 (prive gezinsapp)` en een time-out van 20 s;
- **alleen met het openbare testadres 2591 BB 87**, en voor U0.2 een verzonnen adrescode.

Na afloop zijn de antwoordrijen (P0: id 4–11; U0.2: id 14–16) uit `net._http_response` verwijderd.

**Rechten vóór = na (L4, D-046):** de probe draaide alleen `net.http_get` en `select`/`delete` op `net._http_response`, zonder schema-, rechten- of app-gegevenswijziging.
- Verslag: `docs/wijzigingen/W-03/probe/P0-uitkomst.md`.
- Gegevens: `docs/wijzigingen/W-03/probe/fixtures-2591BB-87.json`.

| Onderdeel | Uitkomst | Gevolg in dit ontwerp |
| --- | --- | --- |
| `robots.txt` | `User-agent: *` / `Disallow:` (leeg) | geautomatiseerd opvragen niet uitgesloten |
| Datacenter | geen blokkade vanuit Supabase/AWS Frankfurt | datacentertoets gehaald. Vercel `fra1` is niet getest → controle U5 |
| A (adres) | 200 JSON-array; `bagId` "0518200000813196" (string, 16 cijfers); `huisletter`/`huisnummerToevoeging` `""`; ook straat, woonplaats ("'s-Gravenhage"), coördinaten en ids | §18.1.4, §18.1.5; `CHECK (bag_id ~ '^[0-9]{16}$')` |
| A, onbekend adres | 200 `[]` | `not_found` |
| B (afvalstromen) | 5 soorten (GFT, PMD, Papier, Rest, Kerstbomen), ook zonder datums; ~20 KB | herkennen op `icon`; strippen; B zegt **niet** welke bakken een adres gebruikt, en is dus geen bron voor `no_streams` |
| B, onbekende adrescode (U0.2) | 200 `{}` | `NOT_FOUND` → `ADDRESS_GONE` (bijwerken) of `not_found` (instellen); §18.1.4 |
| C 2026 | 200 `[{afvalstroom_id, ophaaldatum}]`; voor het testadres alleen papier (elke 4 weken, niet 24 nov – 20 jan) en kerstbomen | contract bevestigd; leeg-regel "geen komende datum" met jaareinde-uitzondering (§18.8.4) |
| C 2027 | 200 `[]` | J+1 is leeg zolang niet gepubliceerd; geen fout |
| C, onbekende adrescode (U0.2) | 200 `[]` | C is geen bron voor "adres weg" |
| C 2025, vorig jaar (U0.2) | 200, 15 datums | opvraagbaar, maar niet gebruikt (§18.8.1: geen C(J−1)) |
| www.denhaag.nl | 403 (botbescherming) | 22:00/07:45 niet op de pagina bevestigd → controle U0.1 |

**Fixtures (U1):**
- `fixtures-2591BB-87.json` gaat ongewijzigd naar `src/server/waste/__tests__/fixtures/p0-2591BB-87.json`, met een `README.md`: herkomst, 2026-09-29, openbaar testadres, `content`/`icon_data` weggelaten. De test-helper splitst het bestand per endpoint.
- Synthetische fixtures `synthetisch-*.json` krijgen **exact dezelfde vorm**:
  - B **met** `content` en `icon_data` van ± 20 KB, om het strippen en de grootte te toetsen;
  - een adres met rest (wekelijks), papier (4-wekelijks) en PMD (2-wekelijks);
  - alleen GFT;
  - meerdere kandidaten (`huisletter` "A"/"B");
  - december zonder J+1;
  - januari met een lege C(J);
  - eerstvolgende dag over 3 weken;
  - verschuiving;
  - leeg (C `[]`);
  - **adres weg: B = `{}`, letterlijk zoals U0.2**;
  - **C(J+1) met alleen kerstbomen** (§18.8.4 stap 3).
- Alleen voor rest en PMD bestaan geen echte voorbeelddata. De parser is voor alle soorten gelijk.

**Wat van P0 rest, als controle vóór de livegang (geen bouwvoorwaarde):**
- **U0.1 Gemeenteregel.** Jurgen bekijkt één keer `https://www.denhaag.nl/nl/afval/huisvuil-aanbieden/`, omdat de site servers weigert. Bij voorkeur vóór `/design-go`, uiterlijk vóór U4. Tot dan geldt het besluit V-49 (22:00/07:45). Een afwijking is een stoppunt (§18.1.7).
- **U5 Bereikbaarheid vanuit Vercel `fra1`.** pg_net en Vercel gebruiken niet dezelfde IP-adressen. De eerste echte opzoeking (Jurgens rooktest) is de controle. Bij een blokkade geldt §18.16 U5.
- **Responstijd:** is in P0 en U0.2 niet apart gemeten. Na U5 wordt hij gevolgd via `fetchMs` (alleen een getal) in de tick-log.

#### 18.1.7 Beslisregel voor latere afwijkingen van de bron (U0.1, U5 en daarna)

P0 en U0.2 zijn afgerond. Al hun uitkomsten waren uitvoeringskeuzes, en zijn verwerkt in §18.1.1–§18.1.6, §18.3.1 en §18.8. Na de freeze is de rechterkolom een **wijzigingsverzoek** in PROGRESS.

| Uitvoeringskeuze (na de freeze in `DECISIONS.md`) | Stoppunt: wijzigingsverzoek, naar Jurgen |
| --- | --- |
| andere veldnamen, hoofdletters of typen in A, B of C (bijv. `date` in plaats van `ophaaldatum`, id als number) | **U0.1:** andere gemeentetijden dan 22:00 en 07:45, of regels per bak of wijk (BR-49, AC-192, UX §13.4/§13.6, T-16/T-17/T-21/T-22, M-01) |
| andere icon- of titelnamen van de drie bakken; extra stromen | **U5:** blokkade vanaf Vercel `fra1` (403, captcha, WAF), of 429 bij minder dan ~10 verzoeken per uur (gevolg: §18.16 U5) |
| `content-type`-variant (`charset`, `application/hal+json`); grootte tot 5 MB; responstijd tot 8 s | `robots.txt` of voorwaarden gaan `/rest/` of geautomatiseerd opvragen uitsluiten |
| postcode met spatie of kleine letters, of een ander scheidingsteken in het pad van A | geen JSON-API meer, alleen HTML, of een sleutel of login nodig |
| extra verplichte header zonder persoonsgegevens | een adresflow waarvoor **meer** naar buiten moet dan postcode + huisnummer of adrescode, of waarbij iets anders dan de adrescode bewaard moet worden (BR-58, AC-218) |
| — | rest, papier en PMD zijn niet apart te herkennen |
| — | responstijden structureel boven 8 s |

Twijfel over de indeling is geen uitvoeringskeuze: de hoofdsessie legt het voor.

### 18.2 Modules en systeemgrenzen

```
src/domain/waste/                 puur, vitest
  address.ts    normalizeWasteAddress, formatPostcode, matchCandidate
  streams.ts    classifyStream, WASTE_STREAMS = ['rest','papier','pmd']
  plan.ts       wasteTitle, wasteTaskFields, planWasteTasks (insert/move/rename/remove),
                hasNoUpcoming, classifyEmpty (§18.8.4),
                WASTE_HORIZON_DAYS = 14, MAX_SHIFT_DAYS = 3,
                WASTE_OUT_FROM/DEADLINE, WASTE_IN_FROM, WASTE_*_REMINDER
  expire.ts     findExpiredWasteTasks (BR-54), WASTE_IN_EXPIRE_DAYS = 7
  health.ts     dueForFetch, FETCH_SLOTS, wasteSyncHealth (+ notice), wasteFailureVariant
  messages.ts   T-/M-teksten uit UX §13.16 (enige plek in de code), wasteReminder-, wasteFailureMessage-teksten
src/server/waste/                 server-only, GEEN service role
  source.ts, schema.ts, lookup.ts
src/server/system/waste/          service role (TD §5.3)
  sync.ts       saveWasteCalendar, applyWasteSync, syncHousehold, markWasteAlarm, runWasteStep
src/server/actions/waste.ts       lookup-, confirm-, retry- en disable-action
src/server/services/waste-read.ts getWasteSettings (user-client, RLS)
src/app/(app)/instellingen/afvalkalender/page.tsx   oude UI: alleen redirect (§18.9.3)
supabase/ops/waste_rollback.sql   terugrolstap (§18.16)
```

- **Browser:** formulier, uitkomsten van de actions en het tonen van afvaltaken. De telefoon doet nooit een verzoek naar de gemeente.
- **Server:** alle opvragingen, altijd na `requireAdmin()` of vanuit de tick.
- **Extern:** alleen de vaste host.
- **Geheimen:** geen.

### 18.3 Datamodel en migraties

#### 18.3.1 Tabel `waste_calendars` (hooguit één per huishouden)

| Kolom | Type en regel |
| --- | --- |
| `household_id` | `uuid primary key references households(id) on delete cascade` |
| `postcode` | `text not null check (postcode ~ '^[1-9][0-9]{3}[A-Z]{2}$')` |
| `house_number` | `integer not null check (house_number between 1 and 99999)` |
| `house_suffix` | `text not null default '' check (house_suffix ~ '^[A-Z0-9]{0,4}$')` |
| `bag_id` | `text not null check (bag_id ~ '^[0-9]{16}$')` (V-58) |
| `pickups` | `jsonb not null check (jsonb_typeof(pickups) = 'object')`: `{"rest":[…],"papier":[…],"pmd":[…]}`. Alleen gewijzigd door een **geslaagde** bijwerking of `waste_save`; een mislukte poging (ook `SUSPECT_EMPTY`) laat hem ongemoeid |
| `version` | `bigint not null default 1`: +1 bij elk nieuw adres |
| `last_attempt_at` | `timestamptz`: **alleen** claim en rate limit (§18.8.3). Telt niet mee in de gezondheid |
| `last_success_at` | `timestamptz not null` |
| `last_error_code` | `text check (last_error_code in ('UNREACHABLE','FORMAT','SUSPECT_EMPTY','ADDRESS_GONE'))` |
| `error_since` | `timestamptz`: moment van de **eerste** vastgelegde mislukking in de huidige reeks met **dezelfde** code |
| `last_failure_at` | `timestamptz`: moment van de **laatste vastgelegde** mislukking. **Alleen `waste_sync` zet deze kolom**, bij `p_result = 'failure'` (= `p_now`). Een succes en `waste_save` wissen hem |
| `alarm_since` | `timestamptz`: moment waarop de server voor het eerst sinds `last_success_at` `failed` vaststelde (§18.8.5). Gezet door `markWasteAlarm` (tick of "Opnieuw proberen"). Alleen gewist door een succes (`waste_sync 'success'`) en `waste_save` |
| `created_at`, `updated_at` | standaard + `set_updated_at` |

**Checks:**
- `(last_error_code is null) = (error_since is null)`;
- `(last_error_code is null) = (last_failure_at is null)`;
- `last_failure_at is null or last_failure_at >= error_since`;
- `alarm_since is null or alarm_since >= last_success_at`.

**Overig:**
- **Adrescode (V-58).** Jurgen besloot dat naast postcode en huisnummer (V-45) ook `bag_id` bewaard mag worden. Een ophaling gebruikt daarom direct B met de bewaarde adrescode, zonder eerst A.
- **Niet bewaard:** straat, plaats, coördinaten, ids uit A, ruwe antwoorden en wie het adres invoerde.
- **"Storingsmelding verstuurd"** is afgeleid uit de dedupe-sleutel (§18.9.3). `alarm_since` zegt alleen dat de storing is vastgesteld, niet of de melding al verstuurd is.
- **Versimpeltoets:** één `jsonb`-kolom in plaats van een cachetabel, want het gaat om ≤ ~150 datums per jaar die altijd in hun geheel worden gelezen. De keuze voor `last_failure_at` en `alarm_since` staat in §18.17.

#### 18.3.2 `tasks`: drie kolommen erbij

| Kolom | Betekenis |
| --- | --- |
| `waste_pickup_date date` | ophaaldag D |
| `waste_direction text` | `'out'` of `'in'` |
| `waste_streams text[]` | bakken op D, in de vaste volgorde |

- `check tasks_waste_shape`: alle drie null, **of**: direction in (`out`, `in`), een datum, `recurrence_id is null`, 1–3 bakken en `waste_streams <@ array['rest','papier','pmd']`.
- `constraint tasks_waste_key unique (household_id, waste_pickup_date, waste_direction)`: niet-partieel, bruikbaar als `on conflict`-doel en als index. NULL's botsen niet.
- Nullable, zonder standaardwaarde: geen herschrijving van de tabel, en de oude code blijft werken.
- Vervallen open afvaltaken worden door het systeem **hard** verwijderd. Afgevinkte en overgeslagen taken blijven staan. Een verschuiving is een update van dezelfde rij (§18.8.2).

#### 18.3.3 Meldingstype
`notification_type` krijgt er `'waste_sync_failed'` bij.

#### 18.3.4 Migraties (nummers na `…_310`)

| Bestand | Inhoud |
| --- | --- |
| `…_320_afval_meldingstype.sql` | alleen `alter type … add value if not exists 'waste_sync_failed'`. Apart bestand, omdat de waarde pas na de commit bruikbaar is |
| `…_330_afvalkalender.sql` | `waste_calendars` (met `last_failure_at`, `alarm_since` en de checks) + RLS + grants; `tasks`-kolommen, check en sleutel; guard, policies en `delete_task` vervangen; trigger `waste_skip_cascade`; RPC's `waste_save`, `waste_sync`, `disable_waste_calendar`, `waste_calendar_enabled`; daarna opnieuw `revoke execute on all functions in schema private …` + de bestaande grants op de helpers (patroon `…_110`) |

Beide gaan pas na CP-W03 en U0.1 op live via `apply_migration` (D-040): eerst `_320`, dan `_330`.

### 18.4 Afvaltaken: naam en tijden

#### 18.4.1 Naam
`wasteTitle(streams, direction)` geeft T-01…T-14 (UX §13.3/§13.16) voor alle 7 combinaties × 2 richtingen, en is maximaal 80 tekens.

#### 18.4.2 Velden (`wasteTaskFields(D, direction, streams, tz)`, `Europe/Amsterdam`, via `zonedInstant`)

| Veld | `out` | `in` |
| --- | --- | --- |
| `scheduled_date` | D−1 | D |
| `scheduled_time` | `21:00` (alleen voor het sorteren; de UI toont nooit "21:00") | `null` |
| `available_from` | `null` | D 12:00 |
| `due_at` | D 07:45 | (D+1) 00:00 |
| `reminder_minutes_before` | `'{}'` | `'{}'` |
| `description` | `null` | `null` |
| `category` / `priority` | `outdoor` / `normal` | idem |
| maker / `recurrence_id` | `null` / `null` | idem |
| `waste_*` | D, `out`, bakken | D, `in`, bakken |

- De UI leidt de rechterkolom (T-16…T-19), de bovenregel (T-20) en de infolijst (T-21…T-25) af uit `waste_*` en de tijden. Een omschrijving in de database was op D−1 of D+1 onjuist.
- Constanten in `plan.ts`:
  - `WASTE_OUT_FROM = "22:00"`;
  - `WASTE_OUT_DEADLINE = "07:45"`;
  - `WASTE_IN_FROM = "12:00"`;
  - `WASTE_IN_REMINDER = "18:00"`;
  - `WASTE_OUT_REMINDER = "21:00"`.
- Wijkt de gemeenteregel bij U0.1 af, dan is dat een stoppunt (§18.1.7).

### 18.5 Rechten: RLS, guard, policies en RPC-checks

#### 18.5.1 `waste_calendars` (V-53)
- RLS aan, met één policy: `for select to authenticated using (private.is_admin(household_id))`. Geen schrijfpolicies.
- `revoke all … from anon`; `revoke insert, update, delete … from authenticated`. Niet in Realtime.
- Gevolg: `last_failure_at` en `alarm_since` zijn alleen via de service role te schrijven: `waste_sync`/`waste_save` en `markWasteAlarm` (§18.7).
- `public.waste_calendar_enabled()`: security definer, `stable`, `execute` alleen voor `authenticated`. Geeft `exists` voor het eigen actieve lidmaatschap, anders `false`.

#### 18.5.2 `private.guard_task_changes` (vervangen; de bestaande regels uit `…_210` letterlijk + dit)

```sql
if tg_op = 'INSERT' then
  if new.waste_direction is not null or new.waste_pickup_date is not null or new.waste_streams is not null then
    raise exception 'Afvaltaken maakt alleen de afvalkalender' using errcode = '42501';
  end if;
else
  if old.waste_direction is not null
     or row(new.waste_direction, new.waste_pickup_date, new.waste_streams)
        is distinct from row(old.waste_direction, old.waste_pickup_date, old.waste_streams) then
    if (to_jsonb(new) - array['status','completed_at','updated_at'])
       is distinct from (to_jsonb(old) - array['status','completed_at','updated_at']) then
      raise exception 'Een afvaltaak kun je niet wijzigen, verplaatsen of verwijderen' using errcode = '42501';
    end if;
  end if;
end if;
```

Het systeem (`auth.uid() is null`) en FK-acties (`pg_trigger_depth() > 1`) gaan eerst door, zoals nu.

#### 18.5.3 Policies op `tasks` (vervangen)
- `tasks: aanmaken` krijgt erbij: `and waste_direction is null and waste_pickup_date is null`.
- `tasks: beheerder of maker verwijdert`: `using (waste_direction is null and private.can_delete_task(…))`.

#### 18.5.4 `public.delete_task` (vervangen)
Na de lidmaatschapscheck: `if v_task.waste_direction is not null then raise … '42501'`.

#### 18.5.5 Trigger `tasks_waste_skip_cascade` (BR-53, AC-209)
- `after update of status … when (new.waste_direction = 'out' and old.status is distinct from new.status)`.
- Werkt alleen als `auth.uid() is not null` en `pg_trigger_depth() = 1`:
  - `out` naar `skipped` → `in` van dezelfde D naar `skipped` (als die open is);
  - terug naar `todo` → `in` terug naar `todo` (als die `skipped` is).
- Automatisch vervallen door de tick werkt niet door.

#### 18.5.6 Server-side vroeg weigeren
`assertNotWasteTask(task)` in `moveTask`, `updateTask` (alle scopes, vóór het maken van een reeks), `deleteTask` en de wachtrij-soort `move` → `UserError FORBIDDEN`. De client toont dan T-33.

#### 18.5.7 UI-helpers
`isWasteTask`, en `canEditTask`, `canMoveTask` en `canDeleteTask` geven `false` voor afvaltaken. Ze dienen alleen om knoppen te verbergen.

### 18.6 Server actions (`src/server/actions/waste.ts`)

Alle vier volgen `runAction` → `requireAdmin()` → zod → pas daarna een opvraging of schrijfactie. Ze zijn online-only (`useOnlineOnly()`, anders T-67) en staan niet in de wachtrij.

| Actie | Wat hij doet | Resultaat (`data.kind`) |
| --- | --- | --- |
| `lookupWasteAddressAction` `{postcode, houseNumber, suffix}` | `lookupWasteCalendar` (§18.8.1). **Schrijft niets** | `found` (weergave, eerstvolgende datum per bak of `null`) · `choose` (kandidaten) · `not_found` · `no_streams` · `no_upcoming` · `unreachable` |
| `confirmWasteAddressAction` idem | vraagt **opnieuw** op (de client levert nooit `bag_id` of datums aan). Bij `found`:<br>**(a) geen bewaard adres** → `waste_save` → `saved`, `mode: 'enabled'`;<br>**(b) ander adres** → `waste_save` → `saved`, `mode: 'changed'` (BR-56);<br>**(c) zelfde adres** (`bag_id`, postcode, nummer en toevoeging gelijk) → `applyWasteSync` met de net opgehaalde datums, `p_result = 'success'`, **zonder claim**, met de gelezen `version` → `saved`, `mode: 'unchanged'` | `saved` (`{mode, inserted, removed}`), of dezelfde niet-gevonden-uitkomsten als lookup (niets bewaard). Een botsing op `version` bij (c), of een fout in de RPC, geeft `UNKNOWN` |
| `retryWasteSyncAction` `{}` | claim (≥ 60 s). Lukt de claim niet, dan `too_soon`, **zonder** verzoek naar buiten. Anders `syncHousehold(…, { manual: true })`, daarna `wasteSyncHealth`. Is die `failed`, dan volgt `markWasteAlarm` | `done` (`health`, `lastSuccessAt`, `attemptedAt`) · `too_soon` |
| `disableWasteCalendarAction` `{}` | RPC `disable_waste_calendar()` | `{ removed }` |

- **Te-snel-bescherming niet bij bevestigen:** alleen "Opnieuw proberen" gebruikt de claim. Bevestigen krijgt dus nooit T-79 (AC-222).
- **`inserted`** wordt altijd teruggegeven. De client kiest daarmee alleen tussen T-90 en T-90b (§18.11), en leidt verder niets af.
- **`getWasteSettings`** (server, user-client):
  - **de beheerder krijgt:**
    - adres;
    - `health` (§18.8.5: `state`, `variant`, `lastErrorCode`, `lastSuccessAt`, `notice`);
    - de eerstvolgende datum per bak;
    - het aantal open afvaltaken (voor T-81/T-81b/T-81c).
  - **De eerstvolgende datum per bak komt altijd uit de bewaarde `pickups` (≥ vandaag), ook tijdens een storing, ook bij H2.** Een mislukte poging wist nooit datums uit beeld. `null` (→ T-45b) alleen voor een bak zonder komende datum in de bewaarde stand;
  - een gezinslid krijgt alleen `waste_calendar_enabled` en de namen van de beheerders (T-39).
- **Foutcodes:** alleen `FORBIDDEN`, `VALIDATION` en `UNKNOWN`. Uitkomsten van de bron zijn `kind`-waarden, geen fouten.
- **Budget:** 12 s per action. Staat Fluid compute uit, dan `maxDuration = 30` op het segment.

### 18.7 RPC's en schrijfstatements

| RPC / statement | Wie | Wat (één transactie) |
| --- | --- | --- |
| `waste_save(p_household_id, p_member_id, p_postcode, p_house_number, p_house_suffix, p_bag_id, p_pickups, p_insert, p_now)` → `{version, removed, inserted}` | alleen `service_role` | 1. `households`-rij `for no key update` (serialiseert alle afval-schrijfacties per huishouden). <br>2. Hercontrole: `p_member_id` is een actieve beheerder, anders 42501. <br>3. Upsert `waste_calendars`: `version + 1` bij conflict; `last_success_at = last_attempt_at = p_now`; `last_error_code`, `error_since`, `last_failure_at` en `alarm_since` op `null`. <br>4. `delete` van **alle** open afvaltaken van het huishouden. <br>5. Insert van `p_insert` (`household_id` uit de parameter), met `on conflict (…tasks_waste_key) do nothing` |
| `waste_sync(p_household_id, p_version, p_result, p_error_code, p_pickups, p_remove uuid[], p_move jsonb, p_rename jsonb, p_insert jsonb, p_now)` → `{stale, removed, moved, renamed, inserted}` | alleen `service_role` | 1. Slot op de `households`-rij. <br>2. `waste_calendars … for update`; ontbreekt de rij of klopt `version` niet → `{stale:true}` en niets doen. <br>3. Stand bijwerken: <br>• `'success'` → `pickups = p_pickups`, `last_success_at = p_now`; `last_error_code`, `error_since`, `last_failure_at` en `alarm_since` op `null`; <br>• `'failure'` → `error_since = case when last_error_code is distinct from p_error_code then p_now else error_since end`, `last_error_code = p_error_code`, **`last_failure_at = p_now`**. `pickups` en `alarm_since` blijven; <br>• `null` → alleen plannen. <br>4. **remove:** `delete … where id = any(p_remove) and household_id = p and waste_direction is not null and status in ('todo','in_progress')`. <br>5. **move:** `update tasks t set waste_pickup_date, scheduled_date, scheduled_time, available_from, due_at, title, waste_streams from jsonb_to_recordset(p_move) x where t.id = x.id and t.household_id = p and t.waste_direction = x.direction and t.status in ('todo','in_progress')`. <br>6. **rename:** idem, alleen `title` en `waste_streams`. <br>7. **insert** zoals bij `waste_save`. <br>Volgorde 4 → 5 → 6 → 7 |
| `markWasteAlarm(h, lastSuccessAt, now)` (statement in `sync.ts`, service role) | tick en retry-action | `update waste_calendars set alarm_since = :now where household_id = :h and alarm_since is null and last_success_at = :lastSuccessAt`. De voorwaarde op `last_success_at` voorkomt dat een alarm blijft hangen na een gelijktijdig succes. Idempotent |
| `disable_waste_calendar()` → `integer` | `authenticated` | huishouden uit het **eigen actieve beheerderslidmaatschap**, anders 42501; slot; open afvaltaken weg; `waste_calendars`-rij weg |
| `waste_calendar_enabled()` → `boolean` | `authenticated` | §18.5.1 |

- **Alleen `waste_sync` zet `last_failure_at`.** De claim (§18.8.3) raakt alleen `last_attempt_at`. `waste_save` en een succes zetten hem op `null`. Er is geen ander pad. Dit wordt getoetst in §18.15 (AC-205, DB).
- **Idempotentie:** alle stappen controleren de status opnieuw, dus wat intussen is afgevinkt of overgeslagen blijft ongemoeid (AC-202). Bij twee ticks tegelijk serialiseert het slot; de tweede plant op de nieuwe stand (leeg plan), en inserts botsen op de sleutel.
- **Botsing bij move:** een `unique_violation` geeft een rollback van de hele RPC. De tick logt `[waste] sync mislukt code=CONFLICT` en de volgende tick plant opnieuw.

### 18.8 De achtergrondstap "afval"

#### 18.8.1 Opzoeken bij het instellen (`lookupWasteCalendar`)
1. A → `matchCandidate`. Bij `not_found` of `choose` → terug.
2. `fetchPickups` (§18.1.3): B + C(J); C(J+1) in december of als C(J) geen komende datum van rest, papier of PMD heeft. **Geen C(J−1).**
3. Uitkomst, in deze volgorde:
   - B geeft `NOT_FOUND` (`{}`, `[]` of 404) → `not_found` (D, T-60);
   - `UNREACHABLE` of `FORMAT` van B of een C-verzoek → `unreachable`;
   - `hasNoUpcoming(pickups)` (§18.8.4) is onwaar → `found`. Dat geldt ook als de eerstvolgende datum verder dan 14 dagen weg ligt. Dan ontstaan er na aanzetten nog geen taken (`inserted = 0` → T-90b);
   - `hasNoUpcoming` waar, en de maand van vandaag (Europe/Amsterdam) is **januari** → `no_upcoming` (F2, T-64/T-64b), **altijd**, of het adres in J (of vorig jaar) datums had of niet. In januari is "de nieuwe kalender staat nog niet online" veel waarschijnlijker, en F2 bewaart ook niets (AC-186, AC-237);
   - `hasNoUpcoming` waar en `hadAnyDateInJ` onwaar → `no_streams` (E, T-62). Het adres heeft dit jaar geen enkele datum van rest, papier of PMD, bijvoorbeeld bij een ondergrondse container;
   - anders → `no_upcoming` (F2).
4. **Geen jaareinde-uitzondering bij het instellen:** een adres zonder komende datum in J én J+1 krijgt ook in november of december `no_upcoming` (F2). Er valt nog niets te plannen, en T-64 zegt al "De kalender van het nieuwe jaar komt meestal rond de jaarwisseling online."
5. `display` komt uit A, alleen voor de beheerder. Woonplaats wordt als "Den Haag" getoond (T-45a). Het wordt nooit bewaard of gelogd.
6. B is **geen** bron voor `no_streams`: B noemt altijd alle soorten, ook als het adres er geen dagen voor heeft (P0).

#### 18.8.2 Plannen (`planWasteTasks`, puur)

```ts
planWasteTasks({ pickups, existing, now, timeZone }):
  { insert: NewWasteTask[]; move: MoveWasteTask[]; rename: {id,title,streams}[]; remove: string[] }
// existing = alle afvaltaken van het huishouden met waste_pickup_date >= vandaag (elke status)
```

1. **Venster:** D in [vandaag, vandaag + 14] (V-52).
2. **Gewenst:** per D in het venster de bakken op D, dus de sleutels `(D,out)` en `(D,in)`.
3. **Invoegbaar:** een gewenste sleutel zonder bestaande taak (elke status telt), en het moment is nog niet voorbij: `out` alleen als `now < D 07:45`; `in` altijd binnen het venster.
4. **Wees:** een bestaande **open** taak met D in het venster en **geen** ophaling meer op D. Uitzondering: `in` als `out` van dezelfde D `done` is; die blijft staan (BR-51, AC-200).
5. **Verschuiving koppelen, per dag:**
   - *weesdagen* = dagen D met minstens één wees;
   - *nieuwe dagen* = dagen D′ in het venster met minstens één invoegbare sleutel;
   - neem de weesdagen op volgorde. Koppel elke weesdag D aan een nog niet gekoppelde D′ waarvoor geldt: `|D′ − D| ≤ MAX_SHIFT_DAYS (3)`, en minstens één bak gemeen met de wezen op D. Bij meerdere kandidaten de kleinste afstand, en bij gelijke afstand de vroegste D′;
   - per wees van een gekoppelde dag, per richting: is `(D′, richting)` invoegbaar, dan **move** (dezelfde rij, `wasteTaskFields(D′, richting, bakken(D′))`, naam T-01…T-14). Die sleutel is daarna niet meer invoegbaar;
   - is `(D′, richting)` níet invoegbaar, dan **remove** van de wees.
6. **remove:** alle wezen die niet verschoven zijn (AC-199).
7. **rename:** een bestaande open taak met een gewenste sleutel maar andere bakken (AC-201).
8. **insert:** alle overgebleven invoegbare sleutels.
9. Taken met D < vandaag worden hier nooit geraakt (BR-54). Een leeg plan betekent: geen RPC.

**Waarom zo (versimpeltoets):**
- "Verwijderen + opnieuw aanmaken" is niet even betrouwbaar, want `task_comments` hangt met `on delete cascade` aan `tasks`.
- Koppelen per dag houdt buiten- en binnenzetten samen.
- De twee grenzen voorkomen dat een notitie aan een ophaaldag gaat hangen die er niets mee te maken heeft.

**Gevolgen die bewust zo blijven:**
- de herinnering volgt het nieuwe anker;
- is buitenzetten op D′ al voorbij, dan vervalt de oude buitenzet-taak, en schuift binnenzetten wel mee.

#### 18.8.3 Wanneer ophalen: twee vaste momenten, claim en rate limit

- **`FETCH_SLOTS = ["06:00", "17:00"]`** in `Europe/Amsterdam`.
- **`dueForFetch(cal, now, tz)`:**
  - `lastSlot` = het laatste slotmoment ≤ `now`;
  - ophalen als `last_success_at < lastSlot` **en** (`last_attempt_at` is null of ligt meer dan 60 min terug);
  - na een mislukking wordt er dus elk uur opnieuw geprobeerd. Bij een tick elk kwartier is de tweede automatische poging na 06:00 die van 07:15 (AC-205 b).
- **Claim** (lease en rate limit, zonder lock):
  ```sql
  update waste_calendars set last_attempt_at = :now
  where household_id = :h and version = :v
    and (last_attempt_at is null or last_attempt_at < :now - interval '60 seconds')
  returning household_id
  ```
  Geen rij betekent: niet ophalen (tick) of `too_soon` (retry). Bevestigen gebruikt de claim niet.
- **Een claim is geen uitkomst.** Wordt een poging na de claim afgebroken (time-out van de functie, een fout vóór de RPC), dan blijven `last_error_code`, `error_since` en `last_failure_at` ongewijzigd. De gezondheid verandert dus niet (§18.8.5).

#### 18.8.4 Regel voor "geen komende ophaaldagen" (BR-48, BR-52, AC-204, AC-220, AC-237)

- **`hasNoUpcoming(pickups)`** = de bron geeft voor rest, papier en PMD **samen geen enkele komende ophaaldag** (vandaag of later) in de opgehaalde jaren (J, en J+1 als die is opgehaald). Dit wordt bepaald op de **net opgehaalde** datums. Datums van andere soorten (GFT, kerstbomen) tellen niet mee.

**Bij het bijwerken bepaalt `classifyEmpty(result, today, tz)` (puur, `plan.ts`) de uitkomst, in deze volgorde:**
1. `hasNoUpcoming(pickups)` is onwaar → gewone uitkomst `success`.
2. `hadAnyDateInJ` is onwaar: het lopende jaar is voor rest, papier en PMD helemaal leeg (bijvoorbeeld op 1 januari zonder nieuwe kalender, of een bron die `[]` geeft) → `failure`, `SUSPECT_EMPTY`.
3. De maand van vandaag (Europe/Amsterdam) is november of december, `fetchedNextYear` is waar, **en C(J+1) bevat geen datum van rest, papier of PMD** (`nextYearHasDate` onwaar; een C(J+1) met alleen kerstbomen of GFT telt dus als "nog niet online") → **`success`, geen storing.** Dit is het jaareinde: de laatste ophaling van dit jaar is al geweest, en de kalender van volgend jaar staat nog niet online.
   - `pickups` wordt bewaard. Die bevat dan geen komende datums, dus er is niets te plannen. Bestaande open taken zijn al verleden tijd en vallen onder BR-54.
   - `notice = 'next_year_missing'` (§18.8.5) zorgt voor de stille regel T-73. Er komt geen melding.
   - Bij stap 3 is C(J+1) altijd opgehaald, omdat C(J) geen komende datum meer had (§18.1.3). `fetchedNextYear` staat er als verdediging.
4. In alle andere gevallen (bijvoorbeeld in juni: C(J) heeft alleen datums in het verleden en J+1 is leeg) → `failure`, `SUSPECT_EMPTY`.

**Gevolgen van `SUSPECT_EMPTY`:**
- de bewaarde datums (`pickups`) en het adres blijven ongewijzigd;
- bestaande afvaltaken worden **niet** verwijderd, verschoven of hernoemd;
- de planning draait door op de bewaarde datums, en past daarbij **alleen nieuwe taken** toe (§18.8.6): komt een al bekende ophaaldag tijdens de storing binnen de 14 dagen, dan worden de taken ervoor gewoon klaargezet (BR-50);
- vanzelf vervallen volgens BR-54 loopt door;
- **de instellingen tonen onder "Volgende ophaaldagen · stand <dag>" gewoon de bewaarde datums van de laatste geslaagde bijwerking, ook in G′ en H2** (§18.6 `getWasteSettings`, §18.11). Een leeg antwoord wist nooit datums, niet in de database en niet in beeld.

**Bij het instellen:** `no_upcoming` (F2) volgens §18.8.1. Er wordt niets bewaard, en de uitzondering uit stap 3 geldt hier niet.

**Geen voorwaarde "eerder bekend":** een adres wordt alleen bewaard als er minstens één komende ophaaldag is (BR-48). "Geen enkele komende ophaaldag" is daarna dus altijd een verandering, behalve het jaareinde uit stap 3.

**Waarom deze regel:**
- **Geen 14-dagenvenster:** P0 laat zien dat papier eens per 4 weken komt, met een pauze van bijna 2 maanden rond de jaarwisseling. Een venster van 14 dagen gaf bij adressen met weinig ophalingen elke maand een onterechte storing. Een datum verder dan 14 dagen weg is normaal; de taken verschijnen dan pas 14 dagen vooraf (V-52).
- **Jaareinde:** J+1 eerder ophalen helpt alleen als de gemeente het nieuwe jaar al gepubliceerd heeft. Dat gebeurt meestal pas in december. Het P0-adres heeft zijn laatste ophaling op 24 november, dus zonder stap 3 kwam er tussen 24 november en de publicatie alsnog vals alarm. November en december zijn de enige maanden waarin "geen komende datum dit jaar" normaal kan zijn.
- **Het echte gevaar blijft gedekt:** een lege of kapotte bron, en een nieuwe kalender die op 1 januari nog ontbreekt. Dan is C(J) helemaal leeg, en na een uur volgt H2 met T-77a.

**Eén bak zonder dagen** is geen storing.

**Bewuste grenzen:**
- stopt een adres in november of december echt met ophalen (bijvoorbeeld door een ondergrondse container), dan ziet de beheerder tot 1 januari alleen T-73. Daarna volgt `SUSPECT_EMPTY` en H2. In die periode gaan geen taken verloren;
- een afgekapte, maar niet lege lijst van de bron is niet te herkennen. De taken volgen dan de bron.

#### 18.8.5 Gezondheid (`wasteSyncHealth`, puur; UI én tick)

**Invoer:** `last_success_at`, `last_error_code`, `error_since`, `last_failure_at`, `alarm_since`, `pickups`, `now`. **`last_attempt_at` telt niet mee**, zodat een lopende of afgebroken poging de toestand niet verandert.

| Toestand | Regel (in deze volgorde; de eerste die klopt, bepaalt `reason`) |
| --- | --- |
| `failed`, reden `empty` | `last_error_code = 'SUSPECT_EMPTY'` **en** `last_failure_at − error_since ≥ 60 min`: minstens twee **vastgelegde** antwoorden zonder komende ophaaldag achter elkaar, zonder andere uitkomst ertussen, waarvan de eerste en de laatste minstens een uur uit elkaar liggen |
| `failed`, reden `stale` | `now − last_success_at > 48 h` (V-50), met welke `last_error_code` ook, **ook `null`** |
| `failed`, reden `held` | `alarm_since is not null`: de storing is al vastgesteld, en sindsdien is er geen succes geweest |
| `retrying` | `last_error_code` gezet, maar niet `failed` |
| `ok` | anders |

**Variant voor tekst en melding** (`wasteFailureVariant(lastErrorCode)`, puur; UX §13.8.2 en §13.10):

| `last_error_code` | Balk | Melding |
| --- | --- | --- |
| `UNREACHABLE`, `FORMAT`, **of `null`** | H1: T-75 + T-76 | M-03 |
| `SUSPECT_EMPTY` | H2: T-77 + T-77a (maand van `now` in Amsterdam is 12 of 1) of T-77b | M-04 |
| `ADDRESS_GONE` | H3: T-77c + T-77d, knoppen Adres controleren · Opnieuw proberen | M-05 |

**"Stil gelegen", technisch:**
- Het is de toestand `failed` met reden `stale` **en** `last_error_code is null`: sinds het laatste succes heeft geen enkele poging een uitkomst vastgelegd.
- Dat gebeurt als:
  - (1) de tick niet draaide (planner of Vercel weg). De beheerder die de pagina opent, ziet dan H1, ook zonder tick;
  - (2) de ophaalstap steeds werd overgeslagen, omdat de tick al ≥ 10 s liep;
  - (3) de claim steeds niet lukte;
  - (4) pogingen tussen claim en `waste_sync` werden afgebroken.
- In al die gevallen geldt H1 + M-03. T-75 ("Niet bijgewerkt sinds <dag>") en M-03 ("Laatst gelukt op …") kloppen dan letterlijk.
- Draait de tick na een stilstand weer, dan probeert hij eerst op te halen (§18.8.6, stap 3). Lukt die poging niet, dan volgt de variant de nieuwe code. De melding gaat pas daarna.

**Verdere regels:**
- **Per soort geteld:** een andere foutcode zet `error_since` opnieuw.
  - "Onbereikbaar" gevolgd door "leeg" geeft dus geen alarm; pas een tweede vastgelegd leeg antwoord minstens een uur na het eerste wel.
  - "Opnieuw proberen" kan het alarm niet versnellen: de claim staat hooguit één poging per minuut toe, en de regel meet tijd, geen aantal.
- **De balk blijft tot herstel:** is `failed` eenmaal door de server vastgesteld (`alarm_since`), dan blijft `failed` staan tot het eerstvolgende succes, ook als een latere andere foutcode `error_since` opnieuw zet. De tekst volgt dan de huidige code, bijvoorbeeld H1 na een alarm door een leeg antwoord (H2 → H1), zonder tweede melding.
- **Waarschuwing kalender volgend jaar:** `notice = 'next_year_missing'` als `last_error_code is null`, de bewaarde `pickups` geen datum in J+1 bevatten (`pickups` bevat alleen rest, papier en PMD), en een van deze twee geldt:
  - (a) het is december en vandaag + 14 ≥ 1 januari J+1;
  - (b) het is november of december en er is geen enkele komende datum (het jaareinde uit §18.8.4, stap 3).

  Dit wordt afgeleid, zonder kolom, en alleen getoond bij `state = ok` (G″, T-73). Er komt geen melding.
- **Terugkoppeling aan de UI:** `health = { state, reason?, variant?, lastErrorCode, lastSuccessAt, notice? }`.

#### 18.8.6 Tickstap (`runWasteStep`)
Nieuwe stap in `runTick`, **tussen "overslaan" en "meldingen"**, met een eigen `step("afval")` en try/catch.
1. `select * from waste_calendars` (service role). Leeg → klaar.
2. Eén query voor de afvaltaken van die huishoudens: open, of `waste_pickup_date ≥ vandaag − 35`.
3. Per kalender:
   - **ophalen** als `dueForFetch` klopt, de tick nog geen 10 s loopt en de claim lukt. Budget 12 s. De uitkomst is een van deze:
     - `success` (ook het jaareinde uit §18.8.4 stap 3);
     - `failure` met `UNREACHABLE`;
     - `failure` met `FORMAT`;
     - `failure` met `ADDRESS_GONE` (B `{}`, `[]` of 404);
     - `failure` met `SUSPECT_EMPTY` (via `classifyEmpty`).
     
     `fetchMs` gaat als getal naar de tick-log;
   - **plannen** met de effectieve datums: de nieuwe bij succes, anders de bewaarde. **Verwijderen, verschuiven en hernoemen (`remove`, `move`, `rename`) worden alleen toegepast na een geslaagde ophaling in dezelfde ronde.** Na een mislukte ophaling (`UNREACHABLE`, `FORMAT`, `ADDRESS_GONE` of `SUSPECT_EMPTY`), of als er deze ronde niet is opgehaald, gaat alleen `insert` naar `waste_sync`, met `p_remove`, `p_move` en `p_rename` leeg. Zo komen er tijdens een storing wel taken bij voor al bekende ophaaldagen die binnen de 14 dagen komen, en verandert er niets aan bestaande afvaltaken. Hetzelfde geldt voor `syncHousehold` vanuit "Opnieuw proberen";
   - **`waste_sync`** als er een ophaaluitkomst is of het plan niet leeg is;
   - **vervallen (BR-54):**
     - `out` open en vandaag > D → `skipped`;
     - `in` open, vandaag > D **en** (er is een `out` met een latere D waarvan `scheduled_date ≤ vandaag`, **of** vandaag ≥ D + `WASTE_IN_EXPIRE_DAYS` (7)) → `skipped`;
     - alleen `where status in ('todo','in_progress')`;
   - **storing:** `wasteSyncHealth` op de stand ná `waste_sync`. Bij `failed` eerst `markWasteAlarm`, dan `dispatcher.notify` (§18.9.3).
4. `TickReport.waste = { calendars, fetched, fetchFailed, inserted, moved, renamed, removed, expired, alerted }`. Alleen tellingen en een foutcode.

BR-16 raakt afvaltaken niet. Het Vercel-vangnet dekt de stap mee.

### 18.9 Meldingen

#### 18.9.1 Herinneringen (BR-55)
- Voor afvaltaken vervangt `wasteReminder(task, now, tz)` `taskMessages` volledig. Er komt dus nooit "deadline nadert" of "verlopen" (AC-211).
- Anker: `out` om (D−1) 21:00, `in` om D 18:00. Alleen voor open taken, en alleen als `0 ≤ now − anker < 90 min`.
- Type `reminder` (voorkeur `notify_reminders`), dedupe-sleutel `waste:<taskId>:<anker-ISO>`.
- Tekst: **M-01** (`out`) en **M-02** (`in`, enkel- of meervoud op basis van `cardinality(waste_streams)`).

#### 18.9.2 Overig
Afvaltaken tellen mee in het dag- en avondoverzicht. "Taak gedaan" volgt de eigen voorkeur.

#### 18.9.3 Storingsmelding
- Type `waste_sync_failed`. `recipientsFor` heeft er een eigen tak voor: ieder actief lid met account en `role = 'admin'`, los van de voorkeuren. Push als die aan staat. Het label in de lijst is T-39c.
- Dedupe-sleutel `waste-failed:<last_success_at ISO>` per ontvanger. Dat is één melding per storing, ook als de oorzaak of de reden tijdens de storing verandert.
- Tekst: `wasteFailureMessage(variant, lastSuccessAt, tz)` → **M-03 / M-04 / M-05** volgens de variant bij het versturen (§18.8.5; `null` → M-03). Nooit een adres of naam.
- **URL:** `appUrl.wasteSettings()` = `/instellingen/afvalkalender`, al in WP3b.
  - In de oude UI is dat een server-`redirect` naar `/instellingen#afvalkalender`. De sectie brengt zichzelf in beeld bij `location.hash === '#afvalkalender'`.
  - In WP7 wordt dezelfde route de echte subpagina.

### 18.10 Gelijktijdigheid en idempotentie

| Situatie | Mechanisme | Uitkomst |
| --- | --- | --- |
| Twee ticks tegelijk | claim; slot; sleutel + `on conflict do nothing`; dedupe | één taak per dag en richting, geen dubbele meldingen (AC-197) |
| Dubbel tikken op "Ja, aanzetten" | slot in `waste_save` | één adres, één set taken (AC-191) |
| Dubbel tikken bij hetzelfde adres | `waste_sync` onder het slot | geen extra taken; beide keren T-92 |
| Twee beheerders, verschillende adressen | slot; laatste commit geldt | nooit taken van twee adressen (AC-214) |
| Tick plant terwijl het adres wijzigt | `version` in de claim en in `waste_sync` | `stale` → niets doen |
| Afvinken tijdens verschuiven, hernoemen of opruimen | elke stap alleen `where status in (todo, in_progress)` | afgevinkt blijft staan (AC-202) |
| Notitie tijdens een verschuiving | move is een update | de notitie blijft (AC-198) |
| Overslaan en ongedaan maken, ook offline | trigger; de wachtrij is FIFO | eindstand volgt de laatste actie (AC-209) |
| "Opnieuw proberen" vaak achter elkaar, of vlak na de tick | claim ≥ 60 s | hooguit één opvraging per minuut; de tweede ziet T-79 (AC-236 c) |
| Pagina open tijdens een lopende poging | gezondheid negeert `last_attempt_at` | geen kort flitsende H2 |
| Claim zonder uitkomst na één leeg antwoord | alarm op `last_failure_at` | geen `failed`, geen melding (AC-205) |
| Storing terwijl een bewaarde ophaaldag het venster in schuift | na een mislukte ophaling alleen `insert` (§18.8.6) | taken voor die dag worden klaargezet; geen bestaande afvaltaak verwijderd, verschoven of hernoemd; BR-54 loopt door (AC-204) |
| Alarm en daarna een gelijktijdig succes | `markWasteAlarm … and last_success_at = :lastSuccessAt` | geen blijvend alarm na herstel |

### 18.11 Foutafhandeling: van uitkomst naar toestand en tekst-ID
Alle teksten komen uit UX §13.16. "Melding onderin" = toast; "regel" = tekst in de pagina.

**Instellingen (beheerder):**

| Uitkomst | Toestand (UX §13.8.1) | Tekst-ID's | Bewaard? |
| --- | --- | --- | --- |
| laden bezig / mislukt | skelet / "Laden mislukt" + Opnieuw | — / T-68 | — |
| zod-fout (client of server) | A met veldfout | T-43, T-44, T-44b | nee |
| lookup of confirm bezig | B | T-41b "Zoeken…" | — |
| `found` | C | T-45, T-45a, T-46, T-46b; per bak zonder datum T-45b; bij wijzigen + T-48 | nee |
| `choose` | C2 | T-61 + rij per kandidaat | nee |
| `not_found` (A zonder passende kandidaat, of B geeft `{}`, `[]` of 404) | D (regel boven de velden, zonder rode rand) | T-60 | nee |
| `no_streams` | E | T-62 | nee |
| `no_upcoming` | F2 | T-64 (aanzetten) / T-64b (wijzigen) | nee; een bestaand adres blijft |
| `unreachable` | F | T-63 (aanzetten) / T-63b (wijzigen) | nee; een bestaand adres blijft |
| `saved`, `mode: 'enabled'`, `inserted > 0` | G + melding onderin | **T-90** (Bekijken → Kalender week); tip T-54 eenmalig | ja |
| `saved`, `mode: 'enabled'`, `inserted = 0` (eerstvolgende ophaaldag verder dan 14 dagen weg) | G + melding onderin | **T-90b** (zonder Bekijken); tip T-54 eenmalig; de datum staat onder Volgende ophaaldagen | ja |
| `saved`, `mode: 'changed'` | G + melding onderin | T-91 | ja |
| `saved`, `mode: 'unchanged'` | G + melding onderin | T-92, nooit T-79 | ja (stand bijgewerkt) |
| `UNKNOWN` bij opslaan (ook een botsing op `version`) | C blijft, invoer blijft | T-65 | nee |
| `FORBIDDEN` (elke actie) | melding onderin, pagina → J | T-66 | nee |
| offline | laatst bekende stand; knoppen uit | T-67 onder de uitgeschakelde knop | — |
| `health.ok` | G | T-70, T-50, T-52, T-55; bak zonder datum T-45b | — |
| `health.ok` + `notice` | G″ | T-73 | — |
| `health.retrying` | G′, met de bewaarde datums | T-71; bij `ADDRESS_GONE` T-71b | — |
| `health.failed` | H + rij "Niet bijgewerkt". **Onder "Volgende ophaaldagen · stand <dag>" staan de bewaarde datums van de laatste geslaagde bijwerking, ook bij H2**; T-45b alleen voor een bak zonder komende datum in de bewaarde stand | T-72 (kop, sectiekop "stand <dag>"), T-37; balk per variant: H1 T-75/T-76 (ook bij `last_error_code null`), H2 T-77 + T-77a/T-77b, H3 T-77c/T-77d | — |
| retry bezig | balk H, knop uit | T-77e | — |
| retry `done`, `state = ok` | G (balk weg) + melding onderin | T-70, T-94 | — |
| retry `done`, `state = failed` | balk H blijft (variant kan wisselen) + regel in de balk | T-78 met `attemptedAt` (hh:mm) | — |
| retry `done`, `state = retrying` | alleen mogelijk als de storing nog niet was vastgesteld (§18.8.5); G′ | T-71/T-71b | — |
| retry `too_soon` | balk H blijft; regel in de balk op de plek van T-78; **geen melding onderin** | T-79 | — |
| H3 "Adres controleren" | A′, gevuld | T-47 | — |
| uitzetten: sheet | I | T-80 + T-81 (n ≥ 2) / T-81b (n = 1) / T-81c (n = 0), T-82 | — |
| uitzetten: `{removed}` | A + melding onderin | T-93 | adres weg |

**Gezinslid:** J, met T-38/T-38b (aan) of T-39/T-39b (uit). Het gezinslid ziet nooit health, balk of stille regels.

**Taken en meldingen:**

| Uitkomst | Tekst-ID's |
| --- | --- |
| afvinken | T-30 |
| buitenzetten overslaan (doorwerking) | T-31 |
| `FORBIDDEN` op wijzigen, verplaatsen of verwijderen (ook uit de wachtrij, 42501) | T-33 |
| detail | T-20…T-25 (T-25 alleen bij de eigen instelling Herinneringen aan, een open taak en een moment in de toekomst), T-27, T-28 |
| lijst en kalender | T-15…T-19 |
| herinneringen | M-01, M-02 |
| storing | M-03 / M-04 / M-05 (variant), label T-39c |

### 18.12 Privacy en logging (BR-58, AC-212, AC-218)
- **Bewaard:** postcode, huisnummer, toevoeging en `bag_id` (de adrescode van de gemeente; V-58), alleen in `waste_calendars`, alleen leesbaar voor beheerders.
- **Nooit bewaard of doorgegeven:** de coördinaten (`latitude`/`longitude`), `woonplaatsId` en `gemeenteId` uit A, en `content`/`icon_data` uit B. zod stript ze vóór elk ander gebruik.
- **Weg:** bij uitzetten, bij het verwijderen van het huishouden (cascade), en bij terugrollen alleen de open taken (§18.16).
- **Nooit in eigen logs:** postcode, nummer, `bag_id`, straat, bron-URL's, `error.message` van een fetch en het huishoud-id. Logregels bevatten alleen tellingen, codes en `fetchMs`. `next.config` zet geen `logging.fetches.fullUrl`.
- **Platformlogs, controle door de security-reviewer in WP3b:**
  - **Vercel Observability, tab External APIs:** per hostname voor elk plan, per pad alleen met Observability Plus (betaald). Het pad bevat postcode en huisnummer (A) of de `bag_id` (B, C). Dit blijft binnen Jurgens eigen Vercel-account. De reviewer noteert wat het huidige plan werkelijk bewaart en hoe lang.
  - **Supabase:** de body van RPC-aanroepen door de service role komt niet in de API-logs. Controleren.
  - **pg_net:** P0 en U0.2 gebruikten alleen het openbare testadres en een verzonnen adrescode; de antwoordrijen zijn verwijderd. De app zelf gebruikt pg_net nooit voor de afvalkalender.
- **Naar buiten:** alleen postcode + nummer (A) of `bag_id` (B, C), alleen naar de vaste host, vanaf Vercel `fra1`.

### 18.13 Performance-impact
- **Tick normaal:** 2 kleine query's, planning in het geheugen, 0 schrijfacties zonder verandering; ≈ 20–40 ms.
- **Twee keer per dag** (en elk uur bij een storing): 2–3 GET's parallel (hard maximaal 12 s) en 1 RPC. `markWasteAlarm` is hooguit één update per storing.
- **C(J+1) buiten december** kost één extra GET per ophaling, alleen als C(J) geen komende datum meer heeft (in de praktijk alleen eind november, en begin januari tot de publicatie). De budgetten blijven gelijk.
- **Geen C(J−1)**, dus geen extra GET bij het instellen in januari.
- **B is ~20 KB** per ophaling; het strippen gebeurt direct na het parsen.
- Ophalen start alleen als de tick nog geen 10 s loopt. Meting in WP3b: p95 van de tickduur < 5 s zonder ophalen.
- **Snapshot:** geen extra query in de oude UI. In WP4 komen de drie kolommen in de kolomlijst, en `waste_calendar_enabled` in `core`.
- **Volume:** ± 200 afvaltaken per jaar.

### 18.14 Oude UI (WP3b, `main`) en nieuwe UI (`v2-ui`)

**Oude UI (volgens UX §13.13.1):**
- `afval-section.tsx` + springlink T-34b: toestanden volgens §18.11, inline, met beschrijving T-34.
  - D gebruikt de tekststijl van de veldfout als één regel boven de velden, **zonder** rode rand.
  - F, F2 en H zijn `bg-muted`-balken.
  - Bevestigen bij uitzetten gaat via de bestaande Dialog.
  - Een gezinslid ziet alleen J.
- `task-card.tsx`:
  - meta met recycle-icoon + T-15;
  - rechterkolom T-16/T-17/T-18;
  - geen deadlinebadge behalve "… te laat";
  - nooit "21:00".
- `selectors.ts#dashboardData`, alleen voor afvaltaken:
  - open `out` van D−1 blijft tot D 07:45 onder Vandaag;
  - `in` met `available_from > now` staat onder Binnenkort.
- `task-detail-sheet.tsx`:
  - geen omschrijving;
  - ⋯-menu alleen met Ik ben ermee bezig / Niet meer bezig / Deze keer overslaan / Toch nog doen (dat laatste alleen tot het einde van D);
  - infolijst T-20…T-25 en uitlegregel T-27;
  - overslaan-melding T-31.
- `calendar-items.tsx`: slepen uit; "vanaf 22:00" en "vanaf 12:00".
- `notifications/format.ts`: label T-39c en icoon.
- `mutations.ts`: optimistisch overslaan en ongedaan maken van `out` neemt `in` mee.
- Route `instellingen/afvalkalender` (redirect, §18.9.3).

**Nieuwe UI:** zie de W-03-regels bij WP4–WP9 in §15 en AC-224…AC-235. Er komt geen nieuwe migratie.

### 18.15 Tests per acceptatiecriterium

- **De bron wordt altijd nagebootst:**
  - unit en integratie via `deps.fetch`, met de P0-fixture (`p0-2591BB-87.json`) en de `synthetisch-*.json` uit §18.1.6;
  - E2E via de stub `tests/e2e/support/waste-stub.mjs` op `127.0.0.1`.
- **Stub-scenario's:**
  - normaal;
  - meerdere adressen;
  - onbekend (A `[]`);
  - alleen GFT;
  - onbereikbaar;
  - leeg (C(J) `[]`);
  - adres weg (B `{}`);
  - jaareinde (P0-vorm op 26 november, C(J+1) `[]`);
  - C(J+1) met alleen kerstbomen;
  - december zonder J+1;
  - januari met lege C(J);
  - eerstvolgende dag over 3 weken;
  - verschuiving;
  - traag (10 s);
  - teller (telt verzoeken per pad, voor "geen verzoek" en "geen C(J−1)").
- **Waar de tests staan:**
  - DB: `supabase/tests/70_afval.sql`, plus `gelijktijdig.sh`;
  - integratie: `tests/integration/waste.test.ts`;
  - E2E: `tests/e2e/waste.spec.ts`.
- Een tekst-ID in de E2E-kolom betekent: de exacte tekst uit UX §13.16 is zichtbaar.

| AC | Unit | DB | Int | E2E |
| --- | --- | --- | --- | --- |
| 183 | — | — | (a) confirm → adres + taken vandaag…+14; `mode: 'enabled'`, `inserted > 0`; (b) adres met eerstvolgende dag over 21 dagen → `saved`, `inserted = 0`, 0 afvaltaken | (a) invullen → C (T-46) → aanzetten → **T-90** (met Bekijken); (b) eerstvolgende dag over 3 weken → C (geen F2) → aanzetten → **T-90b** (zonder Bekijken), 0 afvaltaken |
| 184 | `normalizeWasteAddress` | — | geen fetch bij een zod-fout (spy 0) | T-43/T-44/T-44b; Zoeken uit bij lege velden |
| 185 | `matchCandidate` → `not_found`; A `[]` (P0-fixture `adres_onbekend`) → `not_found`; lookup met B `{}` → `not_found` | — | bestaand adres ongewijzigd | D, T-60, velden gevuld |
| 186 | alleen GFT → `no_streams`; oktober zonder enkele datum van rest/papier/PMD in J → `no_streams`; **januari, lege C(J) → `no_upcoming`**, ongeacht het vorige jaar | — | niets bewaard; stub-teller: **geen** verzoek naar `/kalender/<J−1>` | E, T-62 |
| 187 | `huisletter`/`huisnummerToevoeging` `""` = geen; `choose` bij "A"/"B"; `suffix ""` | — | via de action | C2 → rij tikken → C |
| 188 | time-out, 503, kapotte JSON, te groot, redirect, niet-leeg object uit B → `unreachable` | — | niets bewaard; oud adres + `version` gelijk | F, T-63; bij wijzigen T-63b |
| 189 | — | schrijven geweigerd; RPC-rechten | actions als lid → `FORBIDDEN`, fetch-spy 0 | lid ziet geen formulier; T-66 bij degradatie |
| 190 | — | select per rol; `enabled()` | `getWasteSettings` als lid: geen adres of health | — |
| 191 | — | `waste_save` 2× parallel | twee adressen tegelijk | — |
| 192 | `wasteTaskFields` out; `description = null` | `complete_task` 07:50 → te laat | — | T-16 "vanaf 22:00", T-21/T-22 |
| 193 | `in`-velden | — | — | vóór 12:00 onder Binnenkort (T-18), T-23/T-24 |
| 194 | `wasteReminder` | — | tick 21:00/18:00 | — |
| 195 | `wasteTitle` 7 × 2 = T-01…T-14 | — | 1 herinnering per ontvanger | — |
| 196 | `classifyStream` op de P0-fixture: 5 soorten → rest/papier/pmd + 2× `null` | — | — | — |
| 197 | +3/+14/+15 | sleutel | 2× na elkaar en 2× parallel | — |
| 198 | `planWasteTasks`: (a) 25-12 → 26-12 = move van beide, zelfde id; (b) doel-`out` bestaat al (done) → `out` remove, `in` move; (c) 4 dagen → remove + insert; (d) geen gemeenschappelijke bak → remove + insert; (e) `out` op D′ voorbij → `out` remove, `in` move | move onder de guard (service role) lukt; als lid → 42501 | notitie en `in_progress` blijven; geen historie; herinnering op het nieuwe anker | — |
| 199 | remove beide | — | hard weg | — |
| 200 | `out` done → `in` blijft | — | idem | — |
| 201 | rename | rename raakt done niet | — | — |
| 202 | — | remove/move/rename op done/skipped → 0 rijen | — | — |
| 203 | (a)–(e) | — | tick op die tijden | — |
| 204 | **Parser:** B `{}` (letterlijk U0.2) → `NOT_FOUND`; B `[]` → `NOT_FOUND`; B niet-leeg object → `FORMAT`. <br>**`hasNoUpcoming`:** alle drie leeg = ja; alleen papier met een datum over 25 dagen = nee; alleen komende GFT- of kerstboomdatums = ja. <br>**`classifyEmpty`:** (a) P0-fixture op 2026-11-26: C(2026) alleen datums in het verleden, C(2027) `[]` → `success` + notice, geen `SUSPECT_EMPTY`; (b) dezelfde vorm op 2026-06-15 → `SUSPECT_EMPTY`; (c) 2027-01-01 met C(2027) `[]` → `SUSPECT_EMPTY`; (d) 2026-11-26 met C(2027) met datums van rest/papier/PMD → `success` + planning; (e) 2026-11-26 met C(2027) met **alleen kerstbomen** → `success` + notice; (f) 2026-12-28, na de laatste decemberdatum, C(2027) `[]` → `success` + notice; (g) 2026-10-05 met P0-fixture (volgende dag 27-10) → `success` | `waste_sync 'failure'`: `last_failure_at = p_now`; zelfde code → `error_since` blijft; andere code → reset; `'success'` → alle vier null; `'failure'` laat `pickups` ongewijzigd | 500/time-out/leeg/adres weg (B `{}`) → adres en `pickups` gelijk; **geen bestaande afvaltaak verwijderd, verschoven of hernoemd** (`removed = moved = renamed = 0`, ook als het nieuwe antwoord een andere dag zou geven); **bewaarde datum schuift tijdens de storing het venster in**: bewaarde ophaaldag D = vandaag + 15, volgende dag een tick met stub "onbereikbaar" en apart met stub "leeg" → `out` en `in` voor D worden klaargezet (`inserted = 2`); **BR-54 loopt door**: een open `out` van gisteren wordt tijdens de storing `skipped`; adres weg → `last_error_code = 'ADDRESS_GONE'`; andere tickstappen draaien; volgende poging ≤ 75 min; console zonder adres. **Regressies:** P0-fixture door twee ticks op 2026-10-05 → geen `SUSPECT_EMPTY`, geen melding; tick eind november (P0-vorm) → geen melding, T-73. **Fetch-spy:** op 2026-11-26 wordt `/kalender/2027` opgehaald; in oktober met komende datums **niet** | G′ met T-71, met de bewaarde datums onder Volgende ophaaldagen; adres weg: T-71b; gezinslid ziet niets |
| 205 | `wasteSyncHealth`: (a) leeg 06:00, claim om 07:15 zonder uitkomst, now 07:20 → `retrying` (geen `failed`); (b) leeg 06:00 + leeg 07:15 → `failed/empty`, variant H2; (c) leeg 06:00 + 06:30 → `retrying`; (d) UNREACHABLE 06:00 + leeg 07:15 → `retrying`; (e) 48 h + 1 min, `last_error_code null` → `failed/stale`, variant H1; (f) `alarm_since` gezet, daarna UNREACHABLE (reset, < 48 h) → `failed/held`, H1; (g) succes → `ok`; (h) leeg 06:00/06:20/06:40 → `retrying`; `wasteFailureVariant` voor alle codes en `null`; teksten zonder adres | claim-update laat `last_failure_at` ongemoeid; checks weigeren `last_failure_at` zonder code en `last_failure_at < error_since`; `authenticated` kan geen van de kolommen schrijven; `markWasteAlarm` met een verouderd `last_success_at` → 0 rijen | over meerdere ticks elk 1 melding voor Jurgen en Ellen (M-03/M-04/M-05 per variant), 0 voor Lynn; tick met overgeslagen ophaalstap (budget) en 48 h stil → M-03; na succes + nieuwe storing opnieuw 1; na een alarm door leeg en daarna UNREACHABLE blijft `failed`; `getWasteSettings` bij H2 geeft de bewaarde eerstvolgende datums per bak | stub "leeg" twee keer met een klok ≥ 60 min → H2 (T-77 + T-77b), **bewaarde datums blijven onder "Volgende ophaaldagen · stand <dag>"**; stub "onbereikbaar" + 48 h → H1 (T-75/T-76); stub "adres weg" + 48 h → H3 (T-77c/T-77d, twee knoppen); gezinslid geen balk |
| 206 | zomer- en wintertijd | — | — | — |
| 207 | — | `in` afvinken + terugdraaien door lid; `out` ongewijzigd | idem, historie zonder persoon | ja |
| 208 | `permissions`: afvaltaak niet te bewerken, verplaatsen of verwijderen | beheerder én lid: update van title, scheduled_date, due_at, description, reminders, prioriteit, `recurrence_id`, `waste_*` → 42501; REST-delete 0 rijen; `delete_task` → 42501; status todo/in_progress/skipped en complete/undo lukken | `moveTask`/`updateTask` (ook "wordt terugkerend": geen weesreeks)/`deleteTask` → `FORBIDDEN`; wachtrij `move` → `FORBIDDEN` → T-33 | knoppen verborgen; T-27 |
| 209 | — | lid slaat `out` over → `in` skipped; ongedaan → beide todo; service role slaat `out` over → `in` ongewijzigd; alleen `in` overslaan → `out` ongewijzigd | 18:00-herinnering komt niet na overslaan | T-31 + Ongedaan maken |
| 210 | `findExpiredWasteTasks`: out na D; in na de volgende `out`-dag; in uiterlijk op D+7 zonder volgende `out` (bovengrens); opeenvolgende dagen | — | tick di 07:46 / wo / do; lange pauze → in op D+7 skipped | — |
| 211 | reminder alleen voor `notify_reminders`; nooit deadline/overdue voor afvaltaken | — | Jurgen/Ellen wel, Lynn (uit) niet, Kai (uitgezet) niet; Lynn aan → wel | T-25 alleen bij de eigen instelling aan |
| 212 | alle builders: grep op postcode, nummer, bagId en namen = 0 | — | meldingen, push-payload (spy), titels, completions en console bevatten geen fixture-adres | — |
| 213 | — | `disable_waste_calendar`: rij weg, open afvaltaken weg, done/skipped blijven; tweede keer 0 | daarna tick: fetch-spy 0, geen afvaltaken; lid: `enabled = false` | I met T-80 + T-81 (n = 4) en T-81c (n = 0); T-93; annuleren |
| 214 | — | `waste_save` met een ander adres: open weg, done blijft | nooit twee adressen; ongeldig nieuw adres → oude blijft | A′ (T-47) → C (T-48) → T-91 |
| 215 | — | `waste_sync`/`waste_save`/`disable` raken geen taak met `waste_direction is null` | idem | tip T-54 één keer |
| 216 | — | `delete_household` → `waste_calendars` en afvaltaken weg; ander huishouden intact | — | — |
| 217 | — | — | — | UC-13/14/15 in de oude UI + CP-W03 (§18.16 U3) + live-rooktest Jurgen |
| 218 | source: host = constante, pad alleen postcode-nummer of bagId, headers alleen Accept/UA, `redirect: 'error'`, override alleen loopback; zod stript lat/lon/ids uit A en `content`/`icon_data` uit B; een synthetische B van ~20 KB wordt geparsed | — | fetch-spy over lookup, confirm, sync en retry | — |
| 219 | — | insert met `waste_direction` door lid en beheerder → 42501 (policy én guard), ook met `members_can_create_tasks` uit; systeem-insert lukt met maker `null` | — | — |
| 220 | `notice`: (a) 20 december zonder J+1 = ja; (b) 26 november zonder komende datum en zonder J+1 = ja; 10 december met een komende datum en een venster vóór januari = nee; november met een komende datum = nee; met J+1-datums = nee; `retrying` → geen notice | — | — | G″ met T-73 (december en november) |
| 221 | `dueForFetch`: 05:59 nee, 06:00 ja, 12:00 nee na succes om 06:05, 17:00 ja, na een mislukking elk uur | — | verschuiving om 14:00 → taak om 17:xx aanwezig | — |
| 222 | — | — | zelfde adres bevestigen direct na een tick → `saved`, `mode: 'unchanged'`, geen claim, notitie en `in_progress` blijven; `version` gewijzigd → `UNKNOWN` | T-92; nooit T-79; botsing → T-65 |
| 223 | — | — | `appUrl.wasteSettings()` = `/instellingen/afvalkalender` | melding openen → sectie in beeld |
| 236 | `wasteFailureVariant`; (h) uit 205 (drie keer binnen een uur versnelt niets) | claim 2× binnen 60 s → tweede 0 rijen | retry in H1: (a) stub ok → `done`, `state ok`, stub-teller 1; (b) stub fout → `done`, `state failed`, `attemptedAt`; (c) claim < 60 s → `too_soon`, **stub-teller 0**; retry vanuit `failed` zet `alarm_since` | balk H1 → "Opnieuw proberen" → T-77e, knop uit, rest van de pagina bruikbaar → (a) balk weg, T-70, T-94; (b) balk blijft, T-78 in de balk; (c) na een tweede retry binnen 60 s: T-79 in de balk en geen toast (assert: geen toast-element); offline: knop uit + T-67 |
| 237 | `lookupWasteCalendar`: geen komende datum → `no_upcoming`; alleen papier over 25 dagen → `found` (eerstvolgende datum, 0 taken); 2 januari, lege C(J) → `no_upcoming`, zowel als het vorige jaar datums had als niet (er wordt geen C(J−1) opgehaald); 26 november, P0-vorm, J+1 `[]` → `no_upcoming` (geen jaareinde-uitzondering bij instellen) | — | confirm bij `no_upcoming` → niets bewaard, `version` en taken gelijk; bij een bestaand adres blijft het oude | F2 met T-64 en hoofdknop "Adres zoeken", velden gevuld; bij wijzigen T-64b |
| 224–235 | in hun WP (§15) | | | |

Daarnaast:
- regressie `30_wp2a`;
- privacyschema: geen persoonskolommen buiten `waste_calendars`;
- `route.test.ts` van de tick met `waste.moved` en `waste.alerted`.

### 18.16 Uitrol (live op `main`, oude UI)

| # | Stap | Controle |
| --- | --- | --- |
| **P0** | Probe van de bron **en U0.2: uitgevoerd op 2026-09-29** (§18.1.6) | verslag en fixture in `docs/wijzigingen/W-03/probe/`; antwoordrijen verwijderd; rechten vóór = na |
| **U0** | **U0.1** gemeenteregel 22:00/07:45 op de pagina zelf (Jurgen). Bij voorkeur vóór `/design-go`, uiterlijk vóór U4 | uitkomst letterlijk in PROGRESS; een afwijking volgens §18.1.7 |
| U1 | Bouwen en lokaal groen: `test:db` (`70_afval.sql`, `gelijktijdig.sh`), vitest, integratie, E2E (oude UI + stub, alle scenario's). Fixtures op basis van `p0-2591BB-87.json` plus `synthetisch-*.json` | alles groen |
| U2 | Reviews: code, test-writer, security, performance; herstellen | GO |
| **U3** | **Checkpoint CP-W03** (beeldreview vóór de livegang): zie de lijst hieronder. Dit is **de enige lijst**; UX §13.13.3 en AC-217 verwijzen ernaar. visual-qa en ux-reviewer (licht) beoordelen; BLOKKEREND en GEMIDDELD worden hersteld vóór U4. Rapporten: `docs/reviews/wp3b-visual-qa.md`, `wp3b-ux-reviewer.md`; checkpoint in PROGRESS | GO van beide |
| U4 | `…_320`, dan `…_330` via `apply_migration`; push naar `main` (`fra1`) | beveiligingsadvies; RLS aan op `waste_calendars`; **L4 volgens D-046**: rechten van `anon`/`authenticated`/`public` op `net` gelijk aan de stand vóór P0, en `net` niet bij de exposed schemas; `/api/status`; tick 200 met `waste.calendars = 0` |
| U5 | Rooktest met Jurgen (AC-217): zijn adres, vergelijken met de site, taken zichtbaar, de volgende dag "bijgewerkt", en de herinnering om 21:00. **De eerste echte opzoeking is ook de controle op bereikbaarheid vanuit Vercel `fra1`**; `fetchMs` uit de tick-log noteren. Bij een blokkade: zie hieronder | akkoord in PROGRESS |
| U6 | Jurgen één keer herinneren aan het stoppen van zijn handmatige reeks (BR-57). **Niet** bij een blokkade in U5 | PROGRESS |
| U7 | `main` → `v2-ui` mergen | — |
| U8 | Succescriteria op dag 30 en 90 | PROGRESS |

**Blokkade vanuit Vercel bij U5 (403, captcha, WAF, of structureel time-out):**
- **De afvalkalender blijft uit.** De opzoeking geeft F (T-63), en er wordt **geen adres bewaard**: bevestigen bewaart alleen bij `found`. `waste_calendars` blijft leeg, dus de tickstap doet niets (`waste.calendars = 0`), en er ontstaan geen afvaltaken en geen storingsmeldingen.
- **Geen terugrol nodig.** De migraties zijn additief, en de sectie is zonder adres onschadelijk. De rest van de app blijft zoals hij is. De sectie blijft zichtbaar in toestand A/F, zonder verbergen of vlag.
- **Jurgen houdt zijn handmatige reeks** (U6 vervalt tot er een oplossing is).
- **De hoofdsessie zet een wijzigingsverzoek in PROGRESS**, met voor Jurgen deze opties:
  - (a) ophalen via een andere route (bijvoorbeeld vanuit de database, waar P0 wel werkte). Dat is een ontwerpwijziging;
  - (b) de gemeente om toestemming vragen;
  - (c) de functie verwijderen en bij gewone terugkerende taken blijven.
- **Ontstaat een blokkade pas later** (met een bewaard adres), dan geldt de gewone storingsroute: H1 na 48 uur en M-03 (§18.8.5).

**CP-W03, de enige lijst** (oude UI; 390×844 licht; de met ◐ gemarkeerde ook donker via `--donker`; lokale stack met stub; `docs/screenshots/wp3b/`; bestandsnaam `cpw03-<nr>-<naam>`):

*Instellingen, beheerder*
1. Laden (skelet)
2. Laden mislukt (T-68 + Opnieuw)
3. A — uit (T-40, T-41, T-42, T-34) ◐
4. A met veldfouten (T-43, T-44; T-44b)
5. A′ — wijzigen (T-47, Annuleren)
6. B — zoeken (T-41b "Zoeken…", velden uit)
7. C — Klopt dit? (T-45, T-45a met "Den Haag", T-46, T-46b) ◐
8. C "gedeeltelijk": één bak met T-45b
9. C bij een adres waarvan de eerstvolgende ophaaldag over 3 weken ligt: C (geen F2), met de datum onder Eerstvolgende ophaaldagen. Daarna "Ja, aanzetten" → G met melding **T-90b** (zonder Bekijken) en 0 afvaltaken
10. C bij wijzigen (T-48, "Ja, dit adres gebruiken")
11. C2 — meerdere adressen (T-61)
12. D — onbekend (T-60, zonder rode rand) ◐
13. E — geen bakken (T-62)
14. F — onbereikbaar (T-63)
15. F2 — geen komende ophaaldagen (T-64, hoofdknop Adres zoeken), ook in januari ("kalender ontbreekt") ◐
16. C met opslaan mislukt (T-65)
17. G — aan, met tip (T-70, T-50, T-52, T-54, T-55) ◐
18. G′ — hapering (T-71) en G′ met adres weg (T-71b), met de bewaarde datums
19. G″ — december (T-73), en eind november zonder komende ophaaldag (T-73)
20. H1 (T-72, T-75, T-76); ook H1 zonder foutcode (achtergrondtaak lag stil; zelfde beeld) ◐
21. H2 (T-77 + T-77b) en H2 in december/januari (T-77 + T-77a). **Onder "Volgende ophaaldagen · stand <dag>" staan de bewaarde datums van de laatste geslaagde bijwerking**, geen T-45b bij bakken met een komende bewaarde datum ◐
22. H3 (T-77c, T-77d, Adres controleren + Opnieuw proberen)
23. H tijdens een poging (T-77e)
24. H na "nog steeds fout" (T-78)
25. H na `too_soon` (T-79 in de balk, geen melding onderin)
26. H die blijft staan als de oorzaak verandert: na een alarm door een leeg antwoord (H2) volgt een onbereikbare poging → balk blijft, tekst wordt H1 (T-75/T-76), geen tweede melding
27. I — uitzetten, n = 4 (T-80, T-81, T-82) en n = 0 (T-81c)
28. Offline (T-67 onder de uitgeschakelde knoppen)
29. Meldingen onderin: T-90 (met Bekijken), T-90b (zonder Bekijken), T-91, T-92, T-93, T-94

*Instellingen, gezinslid*

30. J aan (T-38b) en J uit (T-39b)

*Lijsten, detail, kalender, meldingen*

31. Vandaag ma 19:30: buitenzetten "vanaf 22:00" (T-16) onder Vandaag, binnenzetten "Morgen" (T-19) onder Binnenkort ◐
32. Vandaag di 06:30: buitenzetten "vóór 07:45" (T-17)
33. Vandaag di 09:10: buitenzetten onder Verlopen ("… te laat", zonder klokje), binnenzetten "vanaf 12:00" (T-18) onder Binnenkort
34. Vandaag wo 09:00 (D+1): binnenzetten van di onder Verlopen met "9 uur te laat" (deadline wo 00:00; bestaande weergave, "1 dag te laat" verschijnt pas vanaf wo ± 23:30; UX §13.4); nog niet vervallen, want er is geen volgende buitenzet-taak begonnen en D+7 is niet bereikt
35. Taakdetail buitenzetten, beheerder met Herinneringen aan (T-20, T-21, T-22, T-25, T-27, ⋯-menu) ◐
36. Taakdetail buitenzetten, gezinslid zonder herinneringsrij
37. Taakdetail binnenzetten (T-23, T-24), met en zonder herinneringsrij
38. Overgeslagen afvaltaak (vóór het einde van D): ⋯-menu met "Toch nog doen" en alleen de toegestane acties (AC-217). Geen leeg menu en geen verweesde knop of scheidingslijn
39. Melding onderin na overslaan (T-31)
40. Kalender week en dag met afvaltaken ("vanaf 22:00", "vanaf 12:00")
41. Meldingenlijst met een storingsmelding (M-03, label T-39c) en een herinnering (M-01)

**Terugrollen:**
1. Vercel Instant Rollback naar een deployment **zonder** WP3b.
2. **Direct daarna** `supabase/ops/waste_rollback.sql` via de koppeling:
   ```sql
   delete from public.tasks where waste_direction is not null and status in ('todo','in_progress');
   ```
   - **Reden:** de oude tick ziet afvaltaken als gewone taken met `due_at`, en kan dezelfde nacht al "deadline nadert" en "verlopen" sturen.
   - **Wat blijft:** de adresrij. De eerstvolgende tick na het opnieuw uitrollen plant de taken vanzelf opnieuw.
   - **Gevolg:** notities bij open afvaltaken gaan verloren (cascade). Dat is aanvaardbaar bij een noodterugrol, en komt in het totaalvoorstel.
   - **Wordt de terugrol definitief,** dan ook `delete from public.waste_calendars;`.
3. Een terugrol naar een deployment die WP3b al bevat, vraagt geen actie.

**Versimpeltoets terugrol:** "afvalkalender uitzetten" wist meer dan nodig en dwingt de beheerder het adres opnieuw in te voeren. Alleen de open taken verwijderen is de kleinste ingreep die betrouwbaar werkt.

### 18.17 Versimpeltoets

| Onderdeel | Eenvoudigste variant | Gekozen? Waarom |
| --- | --- | --- |
| Ophaaldagen bewaren | niet bewaren | **Nee.** Bij een storing moeten de bekende dagen blijven gelden en zichtbaar blijven. Wel de kleinste vorm: één `jsonb`-kolom |
| Plannen tijdens een storing | niets plannen, of het volledige plan op de bewaarde datums | **Alleen `insert`.** Niets plannen laat een al bekende ophaaldag stil ontbreken. Een volledig plan zou in theorie taken kunnen weghalen of verschuiven op basis van verouderde gegevens. "Alleen nieuwe taken na een mislukte ophaling" is één voorwaarde en goed te toetsen |
| Ophalen | stap in de bestaande tick | **Ja** |
| Tweede ophaalmoment | alleen 06:00 | **Nee.** Een wijziging overdag komt dan te laat voor 21:00 |
| Lock | voorwaardelijke update op `last_attempt_at` | **Ja.** Lease en rate limit tegelijk |
| Leeg-regel | venster van 14 dagen, of "geen komende dag" | **"Geen komende dag".** Eenvoudiger (drie lege lijsten) en zonder vals alarm bij 4-wekelijks papier (P0) |
| Jaareinde | J+1 altijd ophalen | **Nee.** Kost het hele jaar extra GET's en lost het probleem niet op zolang J+1 leeg is. Gekozen: J+1 alleen als het nodig is, plus één maanduitzondering in een pure functie |
| C(J−1) in januari | ophalen om te zien of het adres vorig jaar datums had | **Nee.** Januari zonder komende datum geeft altijd F2, dus C(J−1) verandert de uitkomst nooit. Minder verzoeken, één optie en één stub-scenario minder |
| Datums-vlaggen | `hadAnyDate` (meerdere jaren) + `hadAnyDateInJ` | **Eén veld `hadAnyDateInJ`.** Zonder C(J−1) is het verschil weg. Elke datum in J+1 is komend, dus als `hasNoUpcoming` waar is, heeft J+1 geen relevante datums |
| "Adres weg" herkennen | extra A-verzoek na een leeg antwoord | **Nee.** B geeft voor een onbekende adrescode eenduidig `{}` (U0.2); één vormcontrole in de parser volstaat |
| `no_streams` via B | B zonder rest/papier/PMD | **Nee.** B noemt ook soorten zonder dagen (P0) |
| Meetpunt van het lege-antwoordalarm | `last_attempt_at` hergebruiken | **Nee.** Dat is de claimtijd en geen uitkomst, wat een onterecht alarm geeft. Eén kolom `last_failure_at`, die alleen `waste_sync` schrijft, is de kleinste juiste oplossing |
| Alarm vasthouden tot herstel | niets doen (de balk kan verdwijnen) of afleiden uit de meldingentabel | **Nee.** Verdwijnen verwart na een melding. Afleiden uit meldingen hangt af van de ontvanger en vraagt een extra query via RLS. Eén kolom `alarm_since` met één voorwaardelijke update is deterministisch en rolonafhankelijk |
| Storing zonder foutcode | eigen tekst | **Nee.** H1/M-03 kloppen letterlijk; geen extra tekst of variant |
| Bovengrens binnenzetten | geen | **Nee.** Een taak zou dan onbeperkt bij Verlopen blijven. Eén constante (7 dagen) in dezelfde regel |
| Verschuiving | remove + insert | **Nee.** Stil verlies van notities en "bezig" |
| Storingsteller | `failure_count` over alle soorten | **Nee.** `error_since` per code |
| Waarschuwing kalender volgend jaar | kolom of melding | **Nee.** Afgeleid, alleen een stille regel |
| Probe-route | allowlist in de ontwikkelomgeving | **Nee als enige route.** pg_net testte tegelijk de datacentertoegang (uitgevoerd) |
| Vercel-proef vóór het bouwen | aparte deploy met een testroute | **Nee.** Dat vraagt een ongereviewde productiedeploy; de restgrens wordt bij U5 zichtbaar, met een vastgelegd gevolg |
| Gedrag bij een U5-blokkade | sectie verbergen met een vlag | **Nee.** Zonder bewaard adres is de sectie onschadelijk; een vlag is extra code voor een geval dat misschien niet optreedt. Een definitieve keuze loopt via het wijzigingsverzoek |
| `saved`-varianten | client leidt T-90/T-90b/T-91/T-92 af uit de vorige stand | **Nee.** De server weet het zeker (`mode`, `inserted`) |
| Omschrijving op de taak | vaste tekst in de database | **Nee.** Onjuist op D−1/D+1 |
| Meldings-URL | anker + client-omleiding | **Nee.** Een vaste route werkt in beide UI's |
| Terugrollen | adres + taken wissen | **Nee.** Alleen open taken wissen is voldoende |
| Doorwerking van overslaan | in de service | **Nee.** Een trigger dekt REST, de wachtrij en de actions |
| Verbod op wijzigen | alleen UI + service | **Nee.** De DB-guard is de grens |
| Eén of twee migraties | één | **Twee** (enum eerst committen) |
