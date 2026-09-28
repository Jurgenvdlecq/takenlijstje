-- =============================================================================
-- M0 — testgegevens die op live lijken, met ALLE vervallen velden gevuld
-- (TECHNICAL_DESIGN §12.4 M0). Alleen voor de sandbox; nooit op live.
-- Draait als eigenaar (auth.uid() is null), dus de guards laten alles door.
-- =============================================================================

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'jurgen@example.com'),
  ('00000000-0000-4000-8000-00000000000b', 'ellen@example.com'),
  ('00000000-0000-4000-8000-00000000000c', 'lynn@example.com'),
  ('00000000-0000-4000-8000-00000000000d', 'bas@example.com');

insert into public.users (id, email, display_name)
select id, email, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

insert into public.households (id, name, timezone, created_by, members_can_assign_others, points_enabled, points_goal, points_goal_reward, onboarding_completed) values
  ('10000000-0000-4000-8000-000000000001', 'Familie', 'Europe/Amsterdam', '00000000-0000-4000-8000-00000000000a', true, true, 150, 'Filmavond', true),
  ('10000000-0000-4000-8000-000000000002', 'Buren', 'Europe/Amsterdam', '00000000-0000-4000-8000-00000000000d', false, false, null, null, true);

insert into public.household_members (id, household_id, user_id, display_name, color, icon, role, is_active, email, avatar_url, sort_order) values
  ('20000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'Jurgen', '#2563eb', '🧔', 'admin', true, 'jurgen@example.com', 'https://example.com/j.png', 0),
  ('20000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000b', 'Ellen', '#db2777', '👩', 'admin', true, 'ellen@example.com', null, 1),
  ('20000000-0000-4000-8000-00000000000c', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000c', 'Lynn', '#16a34a', '👧', 'member', true, 'lynn@example.com', null, 2),
  ('20000000-0000-4000-8000-00000000000e', '10000000-0000-4000-8000-000000000001', null, 'Kai', '#f59e0b', '👦', 'member', true, 'kai@example.com', null, 3),
  ('20000000-0000-4000-8000-00000000000d', '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000d', 'Bas', '#7c3aed', null, 'admin', true, null, null, 0);

-- Afwijkende voorkeuren (vervallen kolommen gevuld), zodat terugzetten meetbaar is
update public.user_preferences set notify_task_assigned = false, notify_swap_requests = true, notify_task_completed = true
where member_id = '20000000-0000-4000-8000-00000000000a';

insert into public.task_templates (id, household_id, slug, category, title, duration_minutes, points)
values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', null, 'cleaning', 'Ramen zemen', 30, 4);

insert into public.task_recurrences (id, household_id, title, category, duration_minutes, points, rule, starts_on, assignment_strategy, fixed_member_id, rotation_member_ids, generated_until, created_by_member_id) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Stofzuigen', 'cleaning', 20, 2, '{"freq":"weekly","interval":1,"weekdays":[2,6]}', '2026-09-01', 'rotation', null,
   array['20000000-0000-4000-8000-00000000000a','20000000-0000-4000-8000-00000000000c','20000000-0000-4000-8000-00000000000e']::uuid[], '2026-10-10', '20000000-0000-4000-8000-00000000000a'),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Boodschappen', 'groceries', 60, null, '{"freq":"weekly","interval":1,"weekdays":[6]}', '2026-09-01', 'fixed', '20000000-0000-4000-8000-00000000000e',
   '{}', '2026-10-10', '20000000-0000-4000-8000-00000000000b'),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'Gras maaien', 'outdoor', 45, null, '{"freq":"weekly","interval":2,"weekdays":[6]}', '2026-09-01', 'none', null, '{}', null, '20000000-0000-4000-8000-00000000000d');

insert into public.tasks (id, household_id, recurrence_id, occurrence_date, title, category, status, assigned_member_id, assignment_reason, scheduled_date, due_at, points, completed_at, completed_by_member_id, created_by_member_id) values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '2026-09-26', 'Stofzuigen', 'cleaning', 'done', '20000000-0000-4000-8000-00000000000e', 'rotation', '2026-09-26', '2026-09-26T21:59:00Z', 2, '2026-09-26T15:00:00Z', '20000000-0000-4000-8000-00000000000e', '20000000-0000-4000-8000-00000000000a'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '2026-09-29', 'Stofzuigen', 'cleaning', 'todo', '20000000-0000-4000-8000-00000000000c', 'rotation', '2026-09-29', '2026-09-29T21:59:00Z', 2, null, null, '20000000-0000-4000-8000-00000000000a'),
  ('50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '2026-10-03', 'Boodschappen', 'groceries', 'todo', '20000000-0000-4000-8000-00000000000e', 'fixed', '2026-10-03', null, null, null, null, '20000000-0000-4000-8000-00000000000b'),
  ('50000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', null, null, 'Fietsband plakken', 'other', 'done', '20000000-0000-4000-8000-00000000000a', 'manual', '2026-09-27', null, 3, '2026-09-27T10:00:00Z', '20000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-00000000000a'),
  ('50000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000003', '2026-10-03', 'Gras maaien', 'outdoor', 'todo', null, null, '2026-10-03', null, null, null, null, '20000000-0000-4000-8000-00000000000d');

insert into public.task_completions (id, household_id, task_id, recurrence_id, title, category, member_id, completed_at, scheduled_date, was_late, minutes_late, points, client_mutation_id) values
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Stofzuigen', 'cleaning', '20000000-0000-4000-8000-00000000000e', '2026-09-26T15:00:00Z', '2026-09-26', false, 0, 2, gen_random_uuid()),
  ('60000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000004', null, 'Fietsband plakken', 'other', '20000000-0000-4000-8000-00000000000b', '2026-09-27T10:00:00Z', '2026-09-27', true, 600, 3, gen_random_uuid()),
  ('60000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', null, null, 'Oude taak (verwijderd)', 'other', '20000000-0000-4000-8000-00000000000c', '2026-09-20T10:00:00Z', '2026-09-20', false, 0, 1, gen_random_uuid());

insert into public.task_assignments (household_id, task_id, member_id, assigned_by_member_id, reason) values
  ('10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-00000000000c', null, 'rotation'),
  ('10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000b', 'manual');

insert into public.task_swap_requests (household_id, task_id, requested_by_member_id, status, message, accepted_by_member_id, resolved_at) values
  ('10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-00000000000c', 'open', 'Ik heb hockey', null, null),
  ('10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-00000000000a', 'accepted', null, '20000000-0000-4000-8000-00000000000e', '2026-09-25T10:00:00Z');

insert into public.member_absences (household_id, member_id, starts_on, ends_on, strategy, note, created_by_member_id) values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-00000000000b', '2026-10-20', '2026-10-27', 'reassign', 'Vakantie', '20000000-0000-4000-8000-00000000000b'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-00000000000e', '2026-10-01', '2026-10-02', 'postpone', null, '20000000-0000-4000-8000-00000000000a');

-- Notities: ook één van Kai (lid zonder account) → member_id wordt null, author_name blijft
insert into public.task_comments (household_id, task_id, member_id, body) values
  ('10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-00000000000b', 'Zak is bijna vol'),
  ('10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-00000000000e', 'Ik doe het morgen');

insert into public.household_invitations (id, household_id, member_id, email, role, invited_by_member_id, accepted_at, accepted_by) values
  ('70000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-00000000000e', 'kai@example.com', 'member', '20000000-0000-4000-8000-00000000000a', null, null),
  ('70000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', null, 'lynn@example.com', 'member', '20000000-0000-4000-8000-00000000000a', '2026-09-10T10:00:00Z', '00000000-0000-4000-8000-00000000000c'),
  ('70000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', null, null, 'member', '20000000-0000-4000-8000-00000000000b', null, null);

insert into public.notifications (household_id, member_id, type, title, body, task_id, url, dedupe_key) values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-00000000000a', 'task_assigned', 'Nieuwe taak: Fietsband plakken', null, '50000000-0000-4000-8000-000000000004', null, 'assigned:1'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-00000000000a', 'swap_request', 'Lynn wil Stofzuigen ruilen', 'Ik heb hockey', '50000000-0000-4000-8000-000000000002', null, 'swap:1'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-00000000000c', 'swap_accepted', 'Kai neemt Stofzuigen over', null, null, null, 'swap-accepted:1'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-00000000000a', 'task_completed', '“Fietsband plakken” is gedaan door Ellen', null, '50000000-0000-4000-8000-000000000004', null, 'completed:1'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-00000000000b', 'daily_summary', 'Vandaag staan er 4 taken gepland', 'Waarvan 2 voor jou.', null, '/', 'daily:2026-09-28'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-00000000000b', 'evening_summary', 'Er staan nog 2 taken open', 'Kijk of je er nog eentje kunt afvinken.', null, '/', 'evening:2026-09-28'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-00000000000a', 'reminder', 'Herinnering: Stofzuigen', null, '50000000-0000-4000-8000-000000000002', null, 'reminder:1'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-00000000000a', 'overdue', 'Fietsband plakken is verlopen', null, '50000000-0000-4000-8000-000000000004', null, 'overdue:1'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-00000000000e', 'reminder', 'Herinnering: Boodschappen', null, '50000000-0000-4000-8000-000000000003', null, 'reminder:2');

insert into public.shopping_lists (id, household_id, created_by_member_id, archived_at) values
  ('80000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-00000000000a', null),
  ('80000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-00000000000b', '2026-09-20T12:00:00Z'),
  ('80000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', null, null);

insert into public.shopping_items (household_id, list_id, name, category, is_bought, bought_at, added_by_member_id, bought_by_member_id) values
  ('10000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', 'Melk', 'dairy', false, null, '20000000-0000-4000-8000-00000000000b', null),
  ('10000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', 'Bananen', 'produce', true, '2026-09-28T10:00:00Z', '20000000-0000-4000-8000-00000000000e', '20000000-0000-4000-8000-00000000000a'),
  ('10000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000002', 'Kaas', 'dairy', true, '2026-09-20T10:00:00Z', '20000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000b');
