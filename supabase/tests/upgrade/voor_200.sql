-- =============================================================================
-- Upgrade-test …_200 (AC-053, AC-179) — deel 1: oude gegevens
-- Draait op een database met de migraties TOT …_200 (oud schema), als eigenaar
-- (auth.uid() is null). Daarna past run.sh …_200 toe en draait na_200.sql.
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

\o
select 'Upgrade-test: oude gegevens geladen' as resultaat;
