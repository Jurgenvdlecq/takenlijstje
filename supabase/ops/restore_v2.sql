-- =============================================================================
-- Terugrollen NA M6 (TECHNICAL_DESIGN §12.4 "Rollback"; AC-060; getest in M0)
--
-- Vervang __BACKUP__ door de naam van het back-upschema (backup_v2_<datum>).
-- Daarna de vorige Vercel-deployment terugzetten.
--
--  1. vervallen typen, kolommen en tabellen opnieuw aanmaken (definities uit
--     de oorspronkelijke migraties, inclusief de WP1-rechten);
--  2. gegevens terugkopiëren uit de back-up: update…from voor kolommen,
--     insert voor tabellen en gewiste rijen;
--  3. de functies van vóór …_210 terugzetten, zodat de code van WP2a (en de
--     code daarvóór) weer werkt.
-- Wijzigingen die ná M6 zijn gedaan aan de teruggezette kolommen gaan verloren.
-- Eén transactie (begin … commit); zie de opmerking in …_210 over hulpmiddelen
-- die zelf een transactie openen.
-- =============================================================================

begin;

-- Verwijzingen naar leden of accounts die na M6 zijn verwijderd, worden leeg
-- (in plaats van een FK-fout die alles terugdraait), en een verwijderd account
-- komt nooit terug (security-review WP2b, punt 3)
create function pg_temp.lid(p_id uuid) returns uuid language sql stable as
  $f$ select id from public.household_members where id = p_id $f$;
create function pg_temp.gebruiker(p_id uuid) returns uuid language sql stable as
  $f$ select id from public.users where id = p_id $f$;

-- Wat …_210 extra toevoegde, weer weghalen; de insert-policy van WP1 terug
drop index if exists public.shopping_lists_one_active_idx;
alter table public.households drop constraint if exists households_timezone_amsterdam;
create policy "members: beheerder voegt toe" on public.household_members
  for insert to authenticated
  with check (private.is_admin(household_id) and user_id is null);

-- Tijdens het terugzetten blijven "bijgewerkt op"-tijden zoals in de back-up
alter table public.households disable trigger households_updated_at;
alter table public.task_recurrences disable trigger task_recurrences_updated_at;
alter table public.tasks disable trigger tasks_updated_at;
alter table public.user_preferences disable trigger user_preferences_updated_at;

-- -----------------------------------------------------------------------------
-- 1a. Typen
-- -----------------------------------------------------------------------------
create type public.assignment_strategy as enum ('none', 'fixed', 'rotation', 'random', 'fair');
create type public.absence_strategy as enum ('reassign', 'postpone', 'unassign');

alter type public.notification_type rename to notification_type_new;
create type public.notification_type as enum (
  'task_assigned', 'reminder', 'deadline_soon', 'overdue', 'task_completed',
  'daily_summary', 'evening_summary', 'swap_request', 'swap_accepted'
);
alter table public.notifications
  alter column type type public.notification_type using type::text::public.notification_type;
drop type public.notification_type_new;

-- -----------------------------------------------------------------------------
-- 1b. household_members: weer leden zonder account mogelijk
-- -----------------------------------------------------------------------------
alter table public.household_members drop constraint household_members_user_id_key;
alter table public.household_members drop constraint household_members_user_id_fkey;
alter table public.household_members alter column user_id drop not null;
alter table public.household_members
  add constraint household_members_user_id_fkey foreign key (user_id) references public.users (id) on delete set null,
  add constraint household_members_household_id_user_id_key unique (household_id, user_id),
  add column avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  add column email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- Gewiste leden zonder account terug (vóór de kolommen die naar hen verwijzen)
insert into public.household_members (id, household_id, user_id, display_name, color, icon, role, is_active, sort_order, created_at)
select b.id, b.household_id, b.user_id, b.display_name, b.color, b.icon, b.role::public.member_role, b.is_active, b.sort_order, b.created_at
from __BACKUP__.household_members b
where not exists (select 1 from public.household_members m where m.id = b.id)
  and exists (select 1 from public.households h where h.id = b.household_id)
  and (b.user_id is null or exists (select 1 from public.users u where u.id = b.user_id));

update public.household_members m
set avatar_url = b.avatar_url, email = b.email
from __BACKUP__.household_members b
where b.id = m.id;

-- -----------------------------------------------------------------------------
-- 1c. Kolommen terug
-- -----------------------------------------------------------------------------
alter table public.households
  add column members_can_assign_others boolean not null default false,
  add column points_enabled boolean not null default false,
  add column points_goal integer check (points_goal is null or points_goal between 1 and 100000),
  add column points_goal_reward text check (char_length(points_goal_reward) <= 120);
update public.households h
set members_can_assign_others = b.members_can_assign_others,
    points_enabled = b.points_enabled,
    points_goal = b.points_goal,
    points_goal_reward = b.points_goal_reward
from __BACKUP__.households b
where b.id = h.id;

alter table public.task_templates add column points integer check (points between 0 and 100);
update public.task_templates t set points = b.points from __BACKUP__.task_templates b where b.id = t.id;

alter table public.task_recurrences
  add column points integer check (points between 0 and 100),
  add column assignment_strategy public.assignment_strategy not null default 'none',
  add column fixed_member_id uuid,
  add column rotation_member_ids uuid[] not null default '{}',
  add constraint task_recurrences_fixed_member_id_household_id_fkey
    foreign key (fixed_member_id, household_id) references public.household_members (id, household_id) on delete set null (fixed_member_id);
update public.task_recurrences r
set points = b.points,
    assignment_strategy = b.assignment_strategy::public.assignment_strategy,
    fixed_member_id = pg_temp.lid(b.fixed_member_id),
    rotation_member_ids = array(select x from unnest(b.rotation_member_ids) x where pg_temp.lid(x) is not null)
from __BACKUP__.task_recurrences b
where b.id = r.id;

alter table public.tasks
  add column assigned_member_id uuid,
  add column assignment_reason text check (assignment_reason in ('manual', 'fixed', 'rotation', 'random', 'fair', 'swap', 'absence')),
  add column completed_by_member_id uuid,
  add column points integer check (points between 0 and 100),
  add constraint tasks_assigned_member_id_household_id_fkey
    foreign key (assigned_member_id, household_id) references public.household_members (id, household_id) on delete set null (assigned_member_id),
  add constraint tasks_completed_by_member_id_household_id_fkey
    foreign key (completed_by_member_id, household_id) references public.household_members (id, household_id) on delete set null (completed_by_member_id);
create index tasks_assigned_idx on public.tasks (assigned_member_id, status) where deleted_at is null;
update public.tasks t
set assigned_member_id = pg_temp.lid(b.assigned_member_id),
    assignment_reason = b.assignment_reason,
    completed_by_member_id = pg_temp.lid(b.completed_by_member_id),
    points = b.points
from __BACKUP__.tasks b
where b.id = t.id;

alter table public.task_completions drop constraint task_completions_task_id_key;
alter table public.task_completions
  add column member_id uuid,
  add column points integer not null default 0,
  add constraint task_completions_member_id_household_id_fkey
    foreign key (member_id, household_id) references public.household_members (id, household_id) on delete set null (member_id);
update public.task_completions c
set member_id = pg_temp.lid(b.member_id), points = b.points
from __BACKUP__.task_completions b
where b.id = c.id;

alter table public.household_invitations
  add column member_id uuid,
  add constraint household_invitations_member_id_household_id_fkey
    foreign key (member_id, household_id) references public.household_members (id, household_id) on delete cascade;
update public.household_invitations i set member_id = pg_temp.lid(b.member_id) from __BACKUP__.household_invitations b where b.id = i.id;
insert into public.household_invitations (id, household_id, member_id, email, role, token, invited_by_member_id, expires_at, accepted_at, accepted_by, created_at)
select b.id, b.household_id, pg_temp.lid(b.member_id), b.email, b.role::public.member_role, b.token, pg_temp.lid(b.invited_by_member_id), b.expires_at, b.accepted_at, pg_temp.gebruiker(b.accepted_by), b.created_at
from __BACKUP__.household_invitations b
where not exists (select 1 from public.household_invitations i where i.id = b.id)
  and exists (select 1 from public.households h where h.id = b.household_id);

alter table public.user_preferences
  add column notify_task_assigned boolean not null default true,
  add column notify_swap_requests boolean not null default true;
insert into public.user_preferences (
  member_id, household_id, push_enabled, notify_task_assigned, notify_reminders, notify_deadline_soon,
  notify_overdue, notify_task_completed, notify_swap_requests, daily_summary_enabled, daily_summary_time,
  evening_summary_enabled, evening_summary_time, deadline_warning_minutes, updated_at
)
select b.member_id, b.household_id, b.push_enabled, b.notify_task_assigned, b.notify_reminders, b.notify_deadline_soon,
       b.notify_overdue, b.notify_task_completed, b.notify_swap_requests, b.daily_summary_enabled, b.daily_summary_time,
       b.evening_summary_enabled, b.evening_summary_time, b.deadline_warning_minutes, b.updated_at
from __BACKUP__.user_preferences b
where exists (select 1 from public.household_members m where m.id = b.member_id)
on conflict (member_id) do update
set push_enabled = excluded.push_enabled,
    notify_task_assigned = excluded.notify_task_assigned,
    notify_reminders = excluded.notify_reminders,
    notify_deadline_soon = excluded.notify_deadline_soon,
    notify_overdue = excluded.notify_overdue,
    notify_task_completed = excluded.notify_task_completed,
    notify_swap_requests = excluded.notify_swap_requests,
    daily_summary_enabled = excluded.daily_summary_enabled,
    daily_summary_time = excluded.daily_summary_time,
    evening_summary_enabled = excluded.evening_summary_enabled,
    evening_summary_time = excluded.evening_summary_time,
    deadline_warning_minutes = excluded.deadline_warning_minutes,
    updated_at = excluded.updated_at;

alter table public.shopping_lists
  add column created_by_member_id uuid,
  add constraint shopping_lists_created_by_member_id_household_id_fkey
    foreign key (created_by_member_id, household_id) references public.household_members (id, household_id) on delete set null (created_by_member_id);
update public.shopping_lists l set created_by_member_id = pg_temp.lid(b.created_by_member_id) from __BACKUP__.shopping_lists b where b.id = l.id;

alter table public.shopping_items
  add column added_by_member_id uuid,
  add column bought_by_member_id uuid,
  add constraint shopping_items_added_by_member_id_household_id_fkey
    foreign key (added_by_member_id, household_id) references public.household_members (id, household_id) on delete set null (added_by_member_id),
  add constraint shopping_items_bought_by_member_id_household_id_fkey
    foreign key (bought_by_member_id, household_id) references public.household_members (id, household_id) on delete set null (bought_by_member_id);
update public.shopping_items i
set added_by_member_id = pg_temp.lid(b.added_by_member_id), bought_by_member_id = pg_temp.lid(b.bought_by_member_id)
from __BACKUP__.shopping_items b
where b.id = i.id;

-- Verwijzingen naar teruggezette leden die bij het wissen op null zijn gezet
update public.tasks t set created_by_member_id = pg_temp.lid(b.created_by_member_id)
from __BACKUP__.tasks b
where b.id = t.id and t.created_by_member_id is null and b.created_by_member_id is not null;
update public.task_recurrences r set created_by_member_id = pg_temp.lid(b.created_by_member_id)
from __BACKUP__.task_recurrences b
where b.id = r.id and r.created_by_member_id is null and b.created_by_member_id is not null;
update public.task_comments c set member_id = pg_temp.lid(b.member_id)
from __BACKUP__.task_comments b
where b.id = c.id and c.member_id is null and b.member_id is not null;
update public.household_invitations i set invited_by_member_id = pg_temp.lid(b.invited_by_member_id)
from __BACKUP__.household_invitations b
where b.id = i.id and i.invited_by_member_id is null and b.invited_by_member_id is not null;

-- -----------------------------------------------------------------------------
-- 1d. Tabellen terug (met RLS zoals na WP1)
-- -----------------------------------------------------------------------------
create table public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  task_id uuid not null,
  member_id uuid,
  assigned_by_member_id uuid,
  reason text not null check (reason in ('manual', 'fixed', 'rotation', 'random', 'fair', 'swap', 'absence', 'unassigned')),
  created_at timestamptz not null default now(),
  foreign key (task_id, household_id) references public.tasks (id, household_id) on delete cascade,
  foreign key (member_id, household_id) references public.household_members (id, household_id) on delete set null (member_id),
  foreign key (assigned_by_member_id, household_id) references public.household_members (id, household_id) on delete set null (assigned_by_member_id)
);
create index task_assignments_task_idx on public.task_assignments (task_id);
alter table public.task_assignments enable row level security;
revoke all on public.task_assignments from anon;  -- zoals _rls voor alle tabellen (security-review WP2b, punt 3)
create policy "assignments: leden lezen" on public.task_assignments
  for select to authenticated using (private.is_member(household_id));
create policy "assignments: leden registreren" on public.task_assignments
  for insert to authenticated
  with check (private.is_member(household_id) and (assigned_by_member_id is null or private.is_my_member(assigned_by_member_id)));
insert into public.task_assignments
select b.id, b.household_id, b.task_id, pg_temp.lid(b.member_id), pg_temp.lid(b.assigned_by_member_id), b.reason, b.created_at
from __BACKUP__.task_assignments b
where exists (select 1 from public.tasks t where t.id = b.task_id);

create table public.task_swap_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  task_id uuid not null,
  requested_by_member_id uuid not null,
  status text not null default 'open' check (status in ('open', 'accepted', 'cancelled')),
  message text check (char_length(message) <= 300),
  accepted_by_member_id uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key (task_id, household_id) references public.tasks (id, household_id) on delete cascade,
  foreign key (requested_by_member_id, household_id) references public.household_members (id, household_id) on delete cascade,
  foreign key (accepted_by_member_id, household_id) references public.household_members (id, household_id) on delete set null (accepted_by_member_id)
);
create unique index task_swap_requests_one_open_idx on public.task_swap_requests (task_id) where status = 'open';
alter table public.task_swap_requests enable row level security;
revoke all on public.task_swap_requests from anon;  -- zoals _rls voor alle tabellen (security-review WP2b, punt 3)
create policy "swaps: leden lezen" on public.task_swap_requests
  for select to authenticated using (private.is_member(household_id));
create policy "swaps: eigen verzoek indienen" on public.task_swap_requests
  for insert to authenticated
  with check (private.is_member(household_id) and private.is_my_member(requested_by_member_id) and status = 'open');
create policy "swaps: eigen verzoek intrekken" on public.task_swap_requests
  for update to authenticated
  using ((private.is_member(household_id) and private.is_my_member(requested_by_member_id)) or private.is_admin(household_id))
  with check (
    status in ('open', 'cancelled')
    and ((private.is_member(household_id) and private.is_my_member(requested_by_member_id)) or private.is_admin(household_id))
  );
insert into public.task_swap_requests
select b.id, b.household_id, b.task_id, b.requested_by_member_id, b.status, b.message, pg_temp.lid(b.accepted_by_member_id), b.created_at, b.resolved_at
from __BACKUP__.task_swap_requests b
where exists (select 1 from public.tasks t where t.id = b.task_id)
  and exists (select 1 from public.household_members m where m.id = b.requested_by_member_id);

create table public.member_absences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  member_id uuid not null,
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  strategy public.absence_strategy not null default 'reassign',
  note text check (char_length(note) <= 200),
  created_by_member_id uuid,
  created_at timestamptz not null default now(),
  foreign key (member_id, household_id) references public.household_members (id, household_id) on delete cascade,
  foreign key (created_by_member_id, household_id) references public.household_members (id, household_id) on delete set null (created_by_member_id)
);
create index member_absences_member_idx on public.member_absences (member_id, starts_on, ends_on);
alter table public.member_absences enable row level security;
revoke all on public.member_absences from anon;  -- zoals _rls voor alle tabellen (security-review WP2b, punt 3)
create policy "absences: leden lezen" on public.member_absences
  for select to authenticated using (private.is_member(household_id));
create policy "absences: eigen of beheerder beheert" on public.member_absences
  for all to authenticated
  using (private.is_admin(household_id) or (private.is_member(household_id) and private.is_my_member(member_id)))
  with check (private.is_admin(household_id) or (private.is_member(household_id) and private.is_my_member(member_id)));
insert into public.member_absences
select b.id, b.household_id, b.member_id, b.starts_on, b.ends_on, b.strategy::public.absence_strategy, b.note, pg_temp.lid(b.created_by_member_id), b.created_at
from __BACKUP__.member_absences b
where exists (select 1 from public.household_members m where m.id = b.member_id);

-- Gewiste meldingen terug
insert into public.notifications (id, household_id, member_id, type, title, body, task_id, url, dedupe_key, read_at, pushed_at, created_at)
select b.id, b.household_id, b.member_id, b.type::public.notification_type, b.title, b.body,
       case when exists (select 1 from public.tasks t where t.id = b.task_id) then b.task_id end,
       b.url, b.dedupe_key, b.read_at, b.pushed_at, b.created_at
from __BACKUP__.notifications b
where not exists (select 1 from public.notifications n where n.id = b.id)
  and exists (select 1 from public.household_members m where m.id = b.member_id)
on conflict (member_id, dedupe_key) do nothing;

-- -----------------------------------------------------------------------------
-- 3. Functies en triggers van vóór …_210
-- -----------------------------------------------------------------------------
create or replace function private.check_rotation_members()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if cardinality(new.rotation_member_ids) > 0 and exists (
    select 1
    from unnest(new.rotation_member_ids) as r(member_id)
    where not exists (
      select 1 from public.household_members m
      where m.id = r.member_id and m.household_id = new.household_id
    )
  ) then
    raise exception 'rotation_member_ids bevat een onbekend gezinslid' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger task_recurrences_check_rotation
  before insert or update of rotation_member_ids, household_id on public.task_recurrences
  for each row execute function private.check_rotation_members();

create or replace function private.remove_member_from_rotations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.task_recurrences
  set rotation_member_ids = array_remove(rotation_member_ids, old.id)
  where household_id = old.household_id and old.id = any (rotation_member_ids);
  return old;
end;
$$;

create trigger household_members_cleanup_rotations
  after delete on public.household_members
  for each row execute function private.remove_member_from_rotations();

create or replace function private.guard_swap_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or pg_trigger_depth() > 1
     or coalesce(current_setting('takenlijstje.via_rpc', true), '') = 'on' then
    return new;
  end if;
  if new.task_id is distinct from old.task_id
     or new.requested_by_member_id is distinct from old.requested_by_member_id
     or new.household_id is distinct from old.household_id
     or (new.accepted_by_member_id is distinct from old.accepted_by_member_id and new.status <> 'accepted') then
    raise exception 'Een ruilverzoek kan alleen worden ingetrokken' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger task_swap_requests_guard
  before update on public.task_swap_requests
  for each row execute function private.guard_swap_changes();

-- guard_task_changes zoals na WP1 (…_100), inclusief de toewijzingsregel
create or replace function private.guard_task_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_via_rpc boolean := coalesce(current_setting('takenlijstje.via_rpc', true), '') = 'on';
  v_is_admin boolean;
  v_can_assign_others boolean;
  v_my_member uuid;
begin
  if (select auth.uid()) is null or pg_trigger_depth() > 1 then
    return new;
  end if;

  v_is_admin := private.is_admin(new.household_id);

  if tg_op = 'INSERT' then
    if new.status = 'done' and not v_via_rpc then
      raise exception 'Nieuwe taak kan niet al voltooid zijn' using errcode = '42501';
    end if;
    if new.deleted_at is not null and not v_via_rpc then
      raise exception 'Nieuwe taak kan niet al verwijderd zijn' using errcode = '42501';
    end if;
    if (new.completed_at is not null or new.completed_by_member_id is not null) and not v_via_rpc then
      raise exception 'Gebruik complete_task() om een taak af te vinken' using errcode = '42501';
    end if;
    if new.created_by_member_id is not null and not private.is_my_member(new.created_by_member_id) then
      raise exception 'Een taak maak je als jezelf aan' using errcode = '42501';
    end if;
    if new.recurrence_id is not null and not private.can_manage_series(new.recurrence_id) then
      raise exception 'Je mag deze reeks niet aanpassen' using errcode = '42501';
    end if;
  else
    if new.household_id is distinct from old.household_id then
      raise exception 'Een taak kan niet naar een ander huishouden' using errcode = '42501';
    end if;
    if new.created_by_member_id is distinct from old.created_by_member_id then
      raise exception 'De maker van een taak kan niet worden gewijzigd' using errcode = '42501';
    end if;
    if (new.completed_at is distinct from old.completed_at
        or new.completed_by_member_id is distinct from old.completed_by_member_id
        or (new.status = 'done' and old.status <> 'done'))
       and not v_via_rpc then
      raise exception 'Gebruik complete_task() om een taak af te vinken' using errcode = '42501';
    end if;
    if old.status = 'done' and new.status is distinct from 'done' and not v_via_rpc then
      raise exception 'Gebruik undo_complete_task() om afvinken ongedaan te maken' using errcode = '42501';
    end if;
    if new.deleted_at is distinct from old.deleted_at and not v_via_rpc then
      raise exception 'Gebruik delete_task() om een taak te verwijderen' using errcode = '42501';
    end if;
    if new.recurrence_id is distinct from old.recurrence_id and not v_via_rpc then
      if old.recurrence_id is null then
        if not (private.can_create_tasks(new.household_id) and private.can_manage_series(new.recurrence_id)) then
          raise exception 'Je mag deze taak niet aan een reeks koppelen' using errcode = '42501';
        end if;
      else
        raise exception 'Een taak kan niet van reeks wisselen' using errcode = '42501';
      end if;
    end if;
    if new.occurrence_date is distinct from old.occurrence_date and not v_via_rpc
       and coalesce(new.recurrence_id, old.recurrence_id) is not null
       and not private.can_manage_series(coalesce(new.recurrence_id, old.recurrence_id)) then
      raise exception 'Je mag deze reeks niet aanpassen' using errcode = '42501';
    end if;
  end if;

  if not v_is_admin and not v_via_rpc and new.assigned_member_id is not null
     and (tg_op = 'INSERT' or new.assigned_member_id is distinct from old.assigned_member_id) then
    v_my_member := private.my_member_id(new.household_id);
    select h.members_can_assign_others into v_can_assign_others
    from public.households h where h.id = new.household_id;
    if new.assigned_member_id is distinct from v_my_member and not coalesce(v_can_assign_others, false) then
      raise exception 'Je mag taken alleen aan jezelf toewijzen' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- undo zoals in …_200 (wist ook completed_by_member_id)
create or replace function public.undo_complete_task(p_task_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
begin
  select * into v_task from public.tasks where id = p_task_id;
  if not found or v_task.deleted_at is not null or not private.is_member(v_task.household_id) then
    raise exception 'Taak niet gevonden' using errcode = 'P0002';
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task.status <> 'done' then
    return v_task;
  end if;

  delete from public.task_completions where task_id = v_task.id;

  perform set_config('takenlijstje.via_rpc', 'on', true);
  update public.tasks
  set status = 'todo', completed_at = null, completed_by_member_id = null
  where id = v_task.id
  returning * into v_task;
  perform set_config('takenlijstje.via_rpc', 'off', true);

  return v_task;
end;
$$;

-- Oude signatuur van complete_task zoals in …_200 (negeert de persoon)
create or replace function public.complete_task(
  p_task_id uuid,
  p_mutation_id uuid,
  p_completed_by uuid,
  p_note text default null,
  p_completed_at timestamptz default null
)
returns public.task_completions
language sql
security definer
set search_path = ''
as $$
  select * from public.complete_task(
    p_task_id => p_task_id,
    p_mutation_id => p_mutation_id,
    p_note => p_note,
    p_completed_at => p_completed_at
  );
$$;

-- accept_swap_request zoals in …_000300
create or replace function public.accept_swap_request(p_request_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.task_swap_requests%rowtype;
  v_member uuid;
  v_task public.tasks%rowtype;
begin
  select * into v_req from public.task_swap_requests where id = p_request_id for update;
  if not found or v_req.status <> 'open' then
    raise exception 'Ruilverzoek is niet meer open' using errcode = 'P0002';
  end if;

  v_member := private.my_member_id(v_req.household_id);
  if v_member is null then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if v_member = v_req.requested_by_member_id then
    raise exception 'Je kunt je eigen ruilverzoek niet overnemen' using errcode = '22023';
  end if;

  perform set_config('takenlijstje.via_rpc', 'on', true);
  update public.tasks
  set assigned_member_id = v_member, assignment_reason = 'swap', is_exception = true
  where id = v_req.task_id and status in ('todo', 'in_progress') and deleted_at is null
  returning * into v_task;
  perform set_config('takenlijstje.via_rpc', 'off', true);

  if v_task.id is null then
    raise exception 'Taak is al afgerond of verwijderd' using errcode = 'P0002';
  end if;

  update public.task_swap_requests
  set status = 'accepted', accepted_by_member_id = v_member, resolved_at = now()
  where id = v_req.id;

  insert into public.task_assignments (household_id, task_id, member_id, assigned_by_member_id, reason)
  values (v_req.household_id, v_req.task_id, v_member, v_member, 'swap');

  return v_task;
end;
$$;

-- Rechten
revoke execute on function
  public.complete_task(uuid, uuid, uuid, text, timestamptz),
  public.accept_swap_request(uuid)
from public, anon;
grant execute on function
  public.complete_task(uuid, uuid, uuid, text, timestamptz),
  public.accept_swap_request(uuid)
to authenticated;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_member(uuid),
  private.is_admin(uuid),
  private.my_member_id(uuid),
  private.is_my_member(uuid),
  private.can_create_tasks(uuid),
  private.can_manage_series(uuid),
  private.can_delete_task(uuid, uuid)
to authenticated;

-- Realtime zoals vóór …_210
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.task_swap_requests;
  end if;
end;
$$;

alter table public.households enable trigger households_updated_at;
alter table public.task_recurrences enable trigger task_recurrences_updated_at;
alter table public.tasks enable trigger tasks_updated_at;
alter table public.user_preferences enable trigger user_preferences_updated_at;

commit;
