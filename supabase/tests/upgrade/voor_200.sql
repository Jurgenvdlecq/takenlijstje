-- =============================================================================
-- Upgrade-test …_200 (AC-053, AC-179) — deel 1: oude gegevens
-- Draait op een database met de migraties TOT …_200 (oud schema), als eigenaar
-- (auth.uid() is null). Daarna past run.sh alleen …_200 toe en draait na_200.sql
-- (het tussenstadium, zoals live tussen M2 en M6), dan …_210 en na_210.sql (AC-059).
-- =============================================================================
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data) values
  ('40000000-0000-0000-0000-0000000000a1', 'jurgen.upg@example.com', '{"display_name":"Jurgen"}'),
  ('40000000-0000-0000-0000-0000000000a2', 'ellen.upg@example.com',  '{"display_name":"Ellen"}'),
  ('40000000-0000-0000-0000-0000000000a3', 'lynn.upg@example.com',   '{"display_name":"Lynn"}'),
  ('40000000-0000-0000-0000-0000000000a4', 'bas.upg@example.com',    '{"display_name":"Bas"}'),
  ('40000000-0000-0000-0000-0000000000a5', 'rik.upg@example.com',    '{"display_name":"Rik"}');

insert into public.households (id, name, timezone, created_by) values
  ('41000000-0000-0000-0000-000000000001', 'Familie', 'Europe/Amsterdam', '40000000-0000-0000-0000-0000000000a1'),
  ('41000000-0000-0000-0000-000000000002', 'Buren',   'Europe/Amsterdam', '40000000-0000-0000-0000-0000000000a4');

-- Oud trigger maakt voorkeuren met de oude standaard: alles aan
insert into public.household_members (id, household_id, user_id, display_name, role) values
  ('42000000-0000-0000-0000-0000000000a1', '41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-0000000000a1', 'Jurgen', 'admin'),
  ('42000000-0000-0000-0000-0000000000a2', '41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-0000000000a2', 'Ellen', 'admin'),
  ('42000000-0000-0000-0000-0000000000a3', '41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-0000000000a3', 'Lynn', 'member'),
  ('42000000-0000-0000-0000-0000000000a6', '41000000-0000-0000-0000-000000000001', null, 'Kai', 'member'),
  ('42000000-0000-0000-0000-0000000000a7', '41000000-0000-0000-0000-000000000001', null, 'Opa', 'member'),
  ('42000000-0000-0000-0000-0000000000a4', '41000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-0000000000a4', 'Bas', 'admin'),
  ('42000000-0000-0000-0000-0000000000a5', '41000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-0000000000a5', 'Rik', 'member');

-- Lynn (gezinslid) heeft zelf herinneringen aan en ook "taak gedaan"; haar deadline-venster is 60
update public.user_preferences
set notify_reminders = true, notify_task_completed = true, deadline_warning_minutes = 60, daily_summary_time = '08:15'
where member_id = '42000000-0000-0000-0000-0000000000a3';
-- Ellen (beheerder) heeft een eigen mix; die moet ongewijzigd blijven
update public.user_preferences
set daily_summary_enabled = false, notify_overdue = false, notify_task_completed = true, deadline_warning_minutes = 30
where member_id = '42000000-0000-0000-0000-0000000000a2';
-- Rik (gezinslid in Buren) alleen het avondoverzicht
update public.user_preferences
set notify_reminders = false, notify_deadline_soon = false, notify_overdue = false, daily_summary_enabled = false,
    evening_summary_enabled = true, notify_task_completed = false
where member_id = '42000000-0000-0000-0000-0000000000a5';

-- Momentopname van de beheerders, ter vergelijking na de migratie
create schema upgrade_test;
create table upgrade_test.voorkeuren_voor as select * from public.user_preferences;

insert into public.tasks (id, household_id, title, scheduled_date, created_by_member_id) values
  ('43000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'Ramen zemen', current_date, '42000000-0000-0000-0000-0000000000a1'),
  ('43000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000002', 'Heg knippen', current_date, '42000000-0000-0000-0000-0000000000a4');

insert into public.task_comments (id, household_id, task_id, member_id, body) values
  ('44000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-0000000000a1', 'Van Jurgen'),
  ('44000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-0000000000a3', 'Van Lynn'),
  ('44000000-0000-0000-0000-000000000003', '41000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-0000000000a6', 'Van Kai zonder account'),
  ('44000000-0000-0000-0000-000000000004', '41000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-0000000000a7', 'Van Opa, later verwijderd'),
  ('44000000-0000-0000-0000-000000000005', '41000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000001', null, 'Al zonder schrijver'),
  ('44000000-0000-0000-0000-000000000006', '41000000-0000-0000-0000-000000000002', '43000000-0000-0000-0000-000000000002', '42000000-0000-0000-0000-0000000000a5', 'Van Rik');

-- Opa wordt verwijderd: zijn notitie houdt member_id = null (oud gedrag)
delete from public.household_members where id = '42000000-0000-0000-0000-0000000000a7';

-- -----------------------------------------------------------------------------
-- WP2b (AC-059, BR-46.3/4): gegevens die …_210 moet wissen of juist laten staan.
-- Alle vervallen velden gevuld, ook met verwijzingen naar Kai (zonder account).
-- -----------------------------------------------------------------------------
update public.households set members_can_assign_others = true, points_enabled = true, points_goal = 100, points_goal_reward = 'Pizza'
where id = '41000000-0000-0000-0000-000000000001';

insert into public.task_recurrences (id, household_id, title, rule, starts_on, points, assignment_strategy, fixed_member_id, rotation_member_ids, created_by_member_id) values
  ('45000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'Stofzuigen', '{"freq":"weekly","interval":1}', current_date - 14, 2,
   'rotation', null, array['42000000-0000-0000-0000-0000000000a1', '42000000-0000-0000-0000-0000000000a6']::uuid[], '42000000-0000-0000-0000-0000000000a1'),
  -- Reeks gemaakt door Kai (zonder account): blijft, maker wordt leeg (V-25)
  ('45000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000001', 'Kattenbak', '{"freq":"daily"}', current_date - 3, null,
   'fixed', '42000000-0000-0000-0000-0000000000a6', '{}', '42000000-0000-0000-0000-0000000000a6');

insert into public.tasks (id, household_id, recurrence_id, occurrence_date, title, status, scheduled_date, assigned_member_id, assignment_reason,
                          points, completed_at, completed_by_member_id, created_by_member_id, updated_at) values
  -- Afgevinkt door Kai, toegewezen aan Kai
  ('43000000-0000-0000-0000-000000000011', '41000000-0000-0000-0000-000000000001', '45000000-0000-0000-0000-000000000001', current_date - 7, 'Stofzuigen', 'done',
   current_date - 7, '42000000-0000-0000-0000-0000000000a6', 'rotation', 2, now() - interval '7 days', '42000000-0000-0000-0000-0000000000a6',
   '42000000-0000-0000-0000-0000000000a1', '2026-01-02T03:04:05Z'),
  -- Open, gemaakt door Kai
  ('43000000-0000-0000-0000-000000000012', '41000000-0000-0000-0000-000000000001', '45000000-0000-0000-0000-000000000002', current_date, 'Kattenbak', 'todo',
   current_date, '42000000-0000-0000-0000-0000000000a6', 'fixed', null, null, null, '42000000-0000-0000-0000-0000000000a6', '2026-01-02T03:04:05Z'),
  -- Afgevinkt door Lynn (met account), toegewezen aan Lynn
  ('43000000-0000-0000-0000-000000000013', '41000000-0000-0000-0000-000000000001', null, null, 'Fietsband plakken', 'done',
   current_date - 1, '42000000-0000-0000-0000-0000000000a3', 'manual', 3, now() - interval '1 day', '42000000-0000-0000-0000-0000000000a3',
   '42000000-0000-0000-0000-0000000000a1', '2026-01-02T03:04:05Z');

insert into public.task_completions (id, household_id, task_id, recurrence_id, title, member_id, completed_at, scheduled_date, points, client_mutation_id) values
  ('46000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000011', '45000000-0000-0000-0000-000000000001',
   'Stofzuigen', '42000000-0000-0000-0000-0000000000a6', now() - interval '7 days', current_date - 7, 2, gen_random_uuid()),
  ('46000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000013', null,
   'Fietsband plakken', '42000000-0000-0000-0000-0000000000a3', now() - interval '1 day', current_date - 1, 3, gen_random_uuid());

insert into public.task_assignments (household_id, task_id, member_id, assigned_by_member_id, reason) values
  ('41000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000012', '42000000-0000-0000-0000-0000000000a6', null, 'fixed'),
  ('41000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000013', '42000000-0000-0000-0000-0000000000a3', '42000000-0000-0000-0000-0000000000a1', 'manual');
insert into public.task_swap_requests (household_id, task_id, requested_by_member_id, status, accepted_by_member_id) values
  ('41000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000012', '42000000-0000-0000-0000-0000000000a3', 'open', null);
insert into public.member_absences (household_id, member_id, starts_on, ends_on, strategy, created_by_member_id) values
  ('41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-0000000000a2', current_date + 10, current_date + 17, 'reassign', '42000000-0000-0000-0000-0000000000a2');

-- Uitnodigingen: open aan Kai gekoppeld (weg), al geaccepteerd met member_id (blijft, zonder member_id), open los (blijft)
insert into public.household_invitations (id, household_id, member_id, email, invited_by_member_id, accepted_at, accepted_by) values
  ('47000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-0000000000a6', 'kai.upg@example.com',
   '42000000-0000-0000-0000-0000000000a1', null, null),
  ('47000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-0000000000a3', 'lynn.upg@example.com',
   '42000000-0000-0000-0000-0000000000a1', now() - interval '30 days', '40000000-0000-0000-0000-0000000000a3'),
  ('47000000-0000-0000-0000-000000000003', '41000000-0000-0000-0000-000000000001', null, null, '42000000-0000-0000-0000-0000000000a2', null, null);

-- Meldingen: vervallen soorten + "taak gedaan" en overzichten (weg), herinnering/deadline/verlopen (blijven)
insert into public.notifications (household_id, member_id, type, title, body, dedupe_key) values
  ('41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-0000000000a1', 'task_assigned',   'Nieuwe taak: Fietsband plakken', null, 'upg:1'),
  ('41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-0000000000a1', 'swap_request',    'Lynn wil Kattenbak ruilen', null, 'upg:2'),
  ('41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-0000000000a3', 'swap_accepted',   'Jurgen neemt Kattenbak over', null, 'upg:3'),
  ('41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-0000000000a1', 'task_completed',  '"Stofzuigen" is gedaan door Kai', null, 'upg:4'),
  ('41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-0000000000a2', 'daily_summary',   'Vandaag 3 taken', 'Waarvan 1 voor jou.', 'upg:5'),
  ('41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-0000000000a2', 'evening_summary', 'Nog 1 open', 'Van jou nog open: 1', 'upg:6'),
  ('41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-0000000000a6', 'reminder',        'Herinnering voor Kai', null, 'upg:7'),
  ('41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-0000000000a1', 'reminder',        'Herinnering: Kattenbak', null, 'upg:8'),
  ('41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-0000000000a1', 'deadline_soon',   'Deadline nadert: Kattenbak', null, 'upg:9'),
  ('41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-0000000000a2', 'overdue',         'Kattenbak is verlopen', null, 'upg:10');

-- Boodschappen met "wie"
insert into public.shopping_lists (id, household_id, created_by_member_id, archived_at) values
  ('48000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-0000000000a6', now() - interval '3 days');
insert into public.shopping_items (household_id, list_id, name, is_bought, added_by_member_id, bought_by_member_id) values
  ('41000000-0000-0000-0000-000000000001', '48000000-0000-0000-0000-000000000001', 'Kattenvoer', true, '42000000-0000-0000-0000-0000000000a6', '42000000-0000-0000-0000-0000000000a3');

-- Eigen standaardtaak met punten
insert into public.task_templates (id, household_id, slug, category, title, duration_minutes, points)
values ('49000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', null, 'cleaning', 'Ramen zemen', 30, 4);

-- Momentopname van wat moet blijven (vergelijking in na_210.sql)
create table upgrade_test.tellingen_voor as
select (select count(*) from public.task_completions) as historie,
       (select count(*) from public.tasks) as taken,
       (select count(*) from public.task_recurrences) as reeksen,
       (select count(*) from public.task_comments) as notities,
       (select count(*) from public.shopping_items) as boodschappen,
       (select count(*) from public.household_members where user_id is not null) as leden_met_account;
create table upgrade_test.taken_voor as select id, updated_at from public.tasks;
create table upgrade_test.reeksen_voor as select id, updated_at from public.task_recurrences;

\o
select 'Upgrade-test: oude gegevens geladen' as resultaat;
