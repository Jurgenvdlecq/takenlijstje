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
Extern: Web Push-diensten van Apple/Google (versleutelde payload met taaktitel), Supabase Auth-mail.
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
| `tasks` ✱ | … `status` (todo/in_progress/done/skipped), `is_exception`, `completed_at`, `created_by_member_id`, `deleted_at`. ✖ `assigned_member_id`, `assignment_reason`, `completed_by_member_id`, `points` | `unique (recurrence_id, occurrence_date)` blijft. ✖ `tasks_assigned_idx`. ✚ `tasks_open_sched_idx (scheduled_date) where status in ('todo','in_progress') and deleted_at is null` (tick over alle huishoudens) | soft delete voor reekstaken (`deleted_at`) zodat de planner ze niet opnieuw aanmaakt; losse taak zonder historie hard delete |
| `task_completions` ✱ | id, household_id, task_id, recurrence_id, title, category, completed_at, scheduled_date, due_at, was_late, minutes_late, duration_minutes, note, client_mutation_id. **✖ `member_id`**, ✖ `points` | `client_mutation_id unique` blijft. ✚ **`unique (task_id)`** (BR-11 als constraint: er is per taak hooguit één registratie tegelijk; terugdraaien verwijdert hem) | `task_id on delete set null`: historie blijft (BR-12); na 2 jaar weg (BR-45) |
| `task_comments` ✱ | id, household_id, task_id, member_id (schrijver), body, created_at, ✚ `author_name text not null` = **de laatst bekende naam van de schrijver** (V-34) | — | cascade met de taak. `member_id` wordt `null` als het lid of account verdwijnt; `author_name` blijft staan en wordt getoond (besluit V-34). **De UI toont altijd `author_name`**; `member_id` dient alleen voor het verwijderrecht. Regels: zie hieronder |
| `notifications` ✱ | ongewijzigd, behalve ✱ `type` (enum zonder `task_assigned`, `swap_request`, `swap_accepted`) en ✱ `url` check | ✱ `check (url is null or url ~ '^/([^/\\]|$)')` (geen `//host` of `/\host`: B-03) | cascade met het lid; na 90 dagen weg |
| `push_subscriptions` | ongewijzigd | — | weg bij 404/410, bij uitloggen op dat toestel, en met het account (cascade) |
| `user_preferences` ✱ | ✖ `notify_task_assigned`, `notify_swap_requests`. Standaardwaarden per rol (V-23), zie §3.3 | — | cascade met het lid |
| `shopping_lists` ✱ | ✖ `created_by_member_id` (geen functie; dataminimalisatie) | ✚ partiële unieke index `(household_id) where archived_at is null` (altijd precies één actieve lijst; maakt archiveren idempotent) | gearchiveerd: na 1 jaar weg (items cascade) |
| `shopping_items` ✱ | ✖ `added_by_member_id`, `bought_by_member_id` (V-25) | ongewijzigd | cascade met de lijst |
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
  - lid verwijderd → `member_id` wordt null en `author_name` blijft.

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
- **Cookies** via `@supabase/ssr`: `Secure` in productie en `SameSite=Lax`, gezet door de bibliotheek.
- **Afwijking van de standaardeis "HttpOnly", bewust.** De browser-client van `@supabase/ssr` moet het token lezen voor Realtime en voor lezen onder RLS in de browser. Beperkt door:
  - geen HTML uit gebruikersinvoer;
  - een CSP met nonce in `proxy.ts` (WP8);
  - korte JWT-levensduur (Supabase-standaard 1 uur) met refresh.

  De security-reviewer beoordeelt dit in WP1.
- `proxy.ts` (bestaand) ververst de sessie met `getUser()`, dat het token valideert, en stuurt zonder sessie naar `/login?next=`. De lijst `PUBLIC_PATHS` wordt: `/login`, `/wachtwoord-vergeten`, `/auth`, `/invite`, `/offline`, `/api/cron`, `/api/status` (met Bearer, zie B-05), `/manifest.webmanifest`, `/sw.js`.
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
- **Stappen:** zie §11.3. **Antwoord:** alleen tellingen (`{ planned, skipped, notified, pushed, purged }`).

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

## 8. Domeinlogica (waar, hoe testbaar)

`src/domain/**` blijft puur (geen I/O), getest met vitest.

| Module | Wijziging |
| --- | --- |
| `recurrence/*`, `dates.ts`, `scheduling/supersede.ts`, `status.ts` | **Behouden** (aanname PROGRESS: de herhalingsregels zijn correct). `status.greeting()` vervalt (UX §5.1) |
| `scheduling/plan.ts` | **Herwerken:** zonder `assignment`, afwezigheid en punten. `planSeries({ series, today, timeZone, existingOccurrenceDates, hasOpenUpcoming, from })` geeft alleen datums en vensters terug |
| `assignment/*` (`strategies`, `load`, `absence`) + `__tests__/assignment.test.ts` | **Vervallen** (V-21, V-24) |
| `reminders.ts` | **Herwerken:** `taskMessages` ongewijzigd per taak. `summaryMessages(prefs, now, tz, { todayOpen, openIncludingOverdue })` telt voor het hele huishouden (BR-31). Nieuw: `recipientsFor(type, members, prefs)` (actief, met account, voorkeur aan) |
| `stats.ts` | **Herwerken:** alleen voor het huishouden: gedaan, op tijd, vergeten (verlopen of overgeslagen), open, "vaak te laat of vergeten", "vaak gedaan" (UC-06). Geen `MemberStats` |
| `quick-add/parser.ts` | **Herwerken:** geen herkenning van personen (UC-03); geeft de herkende datum met `matchedText` terug, zodat de UI het woord kan onderstrepen (UX §4.3) |
| ✚ `permissions.ts` | `canManageSeries`, `canDeleteTask`, `canCreateTasks`, `canDeactivate(member, members)`: voor de UI. Dezelfde regels als in de database, getest tegen dezelfde tabel |
| ✚ `notifications/text.ts` (verplaatst uit `features/notifications/format.ts` + builders) | meldingsteksten zonder namen (UX §4.9) |
| ✚ `outbox/merge.ts` | puur: pas wachtende acties toe op een verse snapshot (`applyOptimistic`, nu in `features/household/mutations.ts`) → testbaar zonder React |

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

- `runAction` logt `[action:<naam>] <ErrorName> <pgcode>`, zoals nu. **Nooit** invoer, titels, e-mailadressen, namen, tokens of `user_id`.
- De tick en de dispatcher loggen alleen tellingen en statuscodes (bestaand in `web-push.ts`).
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
  - `core`: huishouden, leden, eigen voorkeuren, standaardtaken, reeksen;
  - `work`: taken + completions;
  - `shopping`: actieve lijst + items;
  - `inbox`: eerste 30 meldingen.
- **Venster van `work`:** taken met `scheduled_date` in [vandaag − 7, vandaag + 14], **plus alle open taken** (verlopen blijven zichtbaar), limiet 1500; completions ≥ vandaag − 35 (Taken › Gedaan 30 dagen, Overzicht "30 dagen"), limiet 1500.
- **Kolommen:** alleen de kolommen die de UI gebruikt (`select` expliciet). `description` wordt alleen in het detail geladen.
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
3. **Meldingen:**
   - één query voor de open taken met `scheduled_date ≤ vandaag + 1` (nieuwe index), één voor de actieve leden met account, één voor de voorkeuren;
   - berekening met `taskMessages`/`summaryMessages`/`recipientsFor` (puur);
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
| Backend op de huidige app | `main` (= productie) | WP1, WP2a, WP2b, WP3 + herstel van bevindingen | direct na de review van elk WP, volgens de stappen hieronder |
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

0. **Alleen bij WP1, vóór `…_100` (plan-critic 7):** alleen-lezen-telling op live: `select count(*) from household_members where user_id is not null and is_active = false`. Is die groter dan 0, dan **stoppen**. De bouwer legt Jurgen per persoon (naam) voor dat die na de update geen toegang meer heeft (V-29), met de keuze: eerst weer aanzetten, of zo laten. Er wordt niets aangepast zonder zijn antwoord. Leden zonder account (`user_id is null`) tellen niet mee: zij loggen niet in en vervallen in WP2b.
1. De migratie lokaal groen (`test:db`, E2E).
2. **Niet-destructieve migratie** eerst op live, via de Supabase-koppeling (MCP `apply_migration`) of de SQL-editor. De huidige productiecode blijft ermee werken ("expand").
3. Code deployen (push naar de productiebranch; Vercel bouwt).
4. Rooktest op live: inloggen, Vandaag, afvinken en terugdraaien, `/api/status` met Bearer.
5. **Terugrollen vóór een contract-stap:** vorige Vercel-deployment terugzetten ("Instant Rollback"); de database is compatibel.

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
- **bestaande `notifications` van het type `task_completed`, `daily_summary` en `evening_summary`** (plan-critic 1). Hun opgeslagen tekst noemt wie afvinkte ("… is gedaan door <naam>") of is afgeleid van toewijzing ("waarvan N voor jou", "van jou nog open"). Dat botst met V-21 en succescriterium 7. Filteren op tekst is foutgevoelig; deze soorten zijn kortlevend (90 dagen) en hebben geen historische waarde, dus de hele soort vóór M6 gaat weg. Nieuwe meldingen van deze soorten krijgen teksten zonder naam (WP3). **De product-analyst neemt dit op in BR-46.3.** Jurgen ziet het aantal bij M5;
- `shopping_items.added_by_member_id`, `bought_by_member_id`; `shopping_lists.created_by_member_id`;
- `household_members` zonder `user_id` (leden zonder account), plus de technisch vervallen kolommen `email` en `avatar_url`;
- `user_preferences.notify_task_assigned`, `notify_swap_requests`;
- `household_invitations.member_id`, en open uitnodigingen die aan een lid zonder account gekoppeld waren.

**Stappen:**

| # | Stap | Wie | Controle |
| --- | --- | --- | --- |
| M0 | Voorbereiding in de sandbox: `…_200` en `…_210` + `restore_v2.sql` op een lokale kopie van het oude schema met seed-data die op live lijkt (alle vervallen velden gevuld, leden zonder account, ruilverzoeken, afwezigheden). Draaien: back-up → contract → restore → vergelijken | bouwer | `restore_check_v2.sql` geeft per tabel een identiek aantal rijen en een identieke checksum (`md5(string_agg(t::text, '' order by id))`) |
| M1 | **Voorcontroles op live, alleen lezen, vóór elke WP2-migratie** (plan-critic 6; `supabase/ops/precheck_v2.sql`): (a) een gebruiker in meer dan één huishouden? (b) meer dan één completion per `task_id`? (c) meer dan één actieve boodschappenlijst per huishouden (de index in `…_200` zou dan falen)? (d) leden met account en `is_active = false` (ter controle na stap 0 van §12.3)? (e) aantallen van alles wat verdwijnt? (f) een huishouden met een andere tijdzone dan `Europe/Amsterdam` (V-39) | bouwer | (a)/(b)/(c)/(f) ≠ 0 → **stoppen**, niets toepassen, de opties aan Jurgen voorleggen. Er wordt geen ontdubbelregel verzonnen. (d) ≠ 0 → melden |
| M2 | `…_200_scope_expand` op live + de WP2a-code deployen. De app schrijft geen persoonsvelden meer en leest ze niet | bouwer | rooktest; `select count(*) … where completed_by_member_id is not null and completed_at > <deploymoment>` = 0 |
| M3 | **Back-up** (besluit V-33): `supabase/ops/backup_v2.sql` kopieert **alle tabellen van `public`** 1-op-1 naar het schema `backup_v2_<datum>` in hetzelfde project (Frankfurt). Het schema wordt niet via de API ontsloten: `revoke all … from anon, authenticated`. **Geen los exportbestand** (V-33); er verlaten geen persoonsgegevens het project | bouwer | rijen in de back-up = rijen op live, per tabel |
| M4 | **Restore-test:** `restore_check_v2.sql` zet de back-up terug in een apart schema `restore_check` en vergelijkt aantallen en checksums met live. Daarna wordt `restore_check` weer gedropt | bouwer | alle tabellen identiek → verder; anders stoppen |
| M5 | **BEVESTIGINGSMOMENT, verplicht (BR-46.2, V-26).** De bouwer toont Jurgen in gewone taal: de datum en plaats van de back-up, dat het terugzetten getest is, en de exacte aantallen die verdwijnen. **Die aantallen telt hij direct vóór deze vraag opnieuw** (`precheck_v2.sql` deel e), omdat het gezin de app intussen gebruikt (aanbeveling 16). Hij vraagt letterlijk: *"Mag ik dit nu definitief wissen? Antwoord met ‘ja, wissen’."* Het antwoord gaat letterlijk in `docs/PROGRESS.md` | bouwer ↔ **Jurgen** | **Zonder dat antwoord wordt `…_210` nooit uitgevoerd.** Een eerder "ja" (bijvoorbeeld bij `/design-go`) telt niet |
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
| **WP2a — Scope uit de code + expand (aanbeveling 15)** | Code: toewijzing, verdeling, ruilen, afwezigheid, punten, "namens", `completed_by` en `added_by`/`bought_by` eruit (server, domein, store, mutaties, de schermen waar ze nu staan: minimaal verwijderen, geen herontwerp); `complete_task` v2, `undo` voor iedereen; voorkeuren per rol; `author_name` + triggers (V-34); BR-44; idempotente uitnodigingen, standaardtaken en archiveren; `migrateOutboxEntry` v0 → v1 voor de vervallen soorten; `src/types/database.ts` uit het doelschema van WP2b (§12.3.1); tijdzone vast (V-39: invoer weg + check na M1(f)); oude UI: alleen verwijderen wat vervalt, de oude E2E groen en rook-screenshots; seed en tests bijgewerkt; daarna de branch `v2-ui` aanmaken + previews uitschakelen in `vercel.json`; M0 (sandbox-proef van het draaiboek). Live: §12.4 **M1 (voorcontroles) → M2 (expand + deploy)** | WP1 | UC-02, BR-10…BR-14, BR-20, BR-31 (standaarden), BR-41, BR-42, BR-44, R-03, V-21, V-22, V-24, V-25, V-34 | geen (backend); rooktest na M2 | code, test-writer, **security**, **performance** (snapshot zonder de vervallen tabellen) |
| **WP2b — Back-up, bevestiging en wissen (contract)** | §12.4 **M3–M8**: back-up, restore-test, hertelling, **"ja, wissen" van Jurgen (M5)**, `…_210` in dezelfde sessie, rooktest, na 30 dagen de back-up opruimen. Het wachten op Jurgen houdt WP3 en verder **niet** tegen: de code van WP2a gebruikt de vervallen kolommen al niet meer | WP2a (en M0 geslaagd) | BR-46, V-26, V-33; succescriterium 7 | geen; controles M6 | code (scripts), **security** (inhoudscontrole meldingen, privacytest op live). **Bevestiging van Jurgen bij M5** |
| **WP3 — Achtergrond: planner, tick, meldingen, retentie** | `supabase/ops/planner.sql` (V-32: pg_cron + pg_net, geheim in Vault); tick set-gebaseerd (§11.3); ontvangers volgens V-23; teksten zonder namen; "taak gedaan" naar iedereen met die voorkeur aan, ook naar wie afvinkte (V-38a; `recipientsFor` krijgt geen actor-parameter); `pushed_at` op id; push-time-out; `…_300_retentie`; `vercel.json` als vangnet | **WP2a** (niet WP2b: de planner hangt niet af van het wissen) | BR-16, BR-30, BR-31, BR-45, R-01, R-02, UC-08 | geen; meting: tijd tussen het geplande moment en de melding ≤ 15 min (succescriterium 5) | code, test-writer, **security** (Bearer, Vault), **performance** (tickduur) |
| **WP4 — Fundament UI: tokens, lettertype, shell, navigatie, states, sheets** | `globals.css` volgens DESIGN_SYSTEM §4 (één bron, D-01); Figtree zelf gehost via `next/font/local` (V-31); accent `#2B4C9B` + nieuw app-icoon in die tint (V-30); componenten in `src/components/ui/*` restyled; `AppShell` (onderbalk: Vandaag · Taken · + · Kalender · Boodschappen; kop: bel + tandwiel; V-28); max. 480 px-kolom (D-05); Toaster onder; `(app)/layout` met Suspense + `DataErrorBoundary`; `loading`/`error`/`not-found`/`global-error`; `SheetHost` + `sheets.ts` + `appUrl`; offlinebalk; SW: 3 s time-out, `/offline`-fallback, `CLEAR_PAGES`; snapshot-slices + gericht Realtime (P-01); manifest `theme_color` | WP2a | S-01, S-04, D-01, D-05, P-01, UX §3, §7 | **CP1** (shell en navigatie, leeg, laden, fout, offline) | code, test-writer, **performance** (payload, LCP), **visual-qa** |
| **WP5 — Vandaag en de afvinken-kernflow + taakdetail** | Vandaag volgens UX §5.1 (Verlopen, Vandaag, gedaan-regel, Binnenkort, weekkaart); taakrij met **twee losse knoppen** (rondje + rij, A-01); optimistisch afvinken en ongedaan maken; "wacht op verbinding"; detail-sheet `?taak=` (acties, notities met laadfout S-03, Vorige keren); lege staten a/b; outbox-foutafhandeling | WP4 | UC-01, UC-02, BR-10, BR-11, BR-13, BR-14, BR-17, D-02, A-01, S-03 (notities); succescriteria 6 | **CP2** (Vandaag) → **CP3** (kernflow met leeg, laden, fout, succes, offline, bezig) | code, test-writer (+ **E2E kernflow**), **performance**, **visual-qa** (CP2 en CP3), **ux-reviewer** (CP3) |
| **WP6 — Taak maken en wijzigen, reeksen, Taken-scherm** | Nieuwe taak `?nieuw` (Naam · Wanneer, slimme invoer zonder personen, Herhalen, Meer instellingen; offline losse taak); Bewerken `?bewerk` + "Wat wil je wijzigen?"; pauzeren, hervatten, stoppen, verwijderen; Taken (Open, Gedaan, Terugkerend, filtersheet, actieve filters wissen, zoekveld met label); reeksdetail `?reeks` met **Wijzigen via `updateSeriesAction`** (ook zonder open uitvoering of tijdens een pauze); standaardtaken activeren | WP5 | UC-03, UC-04, BR-01, BR-02, BR-08, BR-09, BR-18, BR-20, BR-22, BR-23, S-03 (filters), A-03 (label), D-04 | CP3-aanvulling (formulierstates) | code, test-writer, **visual-qa**, **ux-reviewer** |
| **WP7 — Instellingen, account en auth** | Instellingen als lijst + subpagina's (D-03); profiel; meldingen instellen + push (iOS-uitleg); gezinsleden (uitzetten, weer aanzetten, rol, verwijderen, uitnodigen, intrekken); standaardtaken beheren; huishouden (+ verwijderen); account verwijderen; login zonder "Nieuw"; wachtwoord vergeten en nieuw wachtwoord; uitnodiging accepteren (account maken of inloggen, BR-44-fout); onboarding zonder verdeling en zonder Google/Apple; `/geen-toegang` definitief; het scherm "niet meer lid" vóór de onboarding (§4.6); tijdzone alleen tonen, vast `Europe/Amsterdam` (V-39, §6.2) | WP4 (WP5 voor de navigatie) | UC-09, UC-10, UC-11, UC-12, BR-24, BR-41, BR-43, BR-44, V-14, V-15, V-23, V-29 | CP3-aanvulling (instellingen, login) | code, test-writer, **security** (auth-flows, verwijderen), **visual-qa**, **ux-reviewer** |
| **WP8 — Kalender, Boodschappen, Meldingen, Overzicht** | Kalender dag/week/maand met periodes laden (S-02), spookjes, "+ Taak" per dag, slepen als extra naast "Andere dag…" (A-02); Boodschappen (onderbalk, archiveren + ongedaan maken, bewerken `?product`); Meldingen (groepen, keyset "Oudere laden", push-kaart, A-03-stip); Overzicht (`/overzicht`, huishoudcijfers, lege staat) | WP5 | UC-05, UC-06, UC-07, UC-08, BR-42, S-02, S-03, A-02, A-03, D-04 | **CP4-voorbereiding** | code, test-writer, **performance** (periodes laden, meldingen), **visual-qa**, **ux-reviewer** |
| **WP9 — Hardening en opruimen** | Alle states uit UX §7 nalopen; CSP met nonce in `proxy.ts`; ESLint bijwerken; dode code weg (`src/integrations/*`, features van toewijzing, punten en afwezigheid, `supabase/cron/schedule-tick.sql`); `docs/ARCHITECTUUR.md` vervangen door een verwijzing naar dit document (lost de vier afwijkingen op); prototypes archiveren; E2E volledig; succescriteria 5–7 meetbaar maken | WP3–WP8 | DoD niveau 2, INVENTARIS §7 "Overig" | **CP4** (volledige UI, licht en donker, 390×844) | alle verplichte reviewers voor de release gate: code, test-writer, **security** (volledig), **performance**, **ux**, **visual-qa**, accessibility (voorstel) |

**Uitrol (V-36):** WP1, WP2a, WP2b en WP3 gaan direct live op `main`, op de oude UI. WP4–WP8 worden gebouwd op de branch `v2-ui` en gaan pas samen live na WP9 (§12.3).

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
