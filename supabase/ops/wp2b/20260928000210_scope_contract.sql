-- =============================================================================
-- WP2b — Scopewijziging, stap "contract" (TECHNICAL_DESIGN §3.1, §3.2, §12.4 M6)
--
-- !!! DESTRUCTIEF !!!
-- Alleen uitvoeren na:
--   M1 voorcontroles (supabase/ops/precheck_v2.sql) zonder blokkade,
--   M3 back-up (backup_v2.sql), M4 restore-test (restore_check_v2.sql),
--   M5 het letterlijke antwoord "ja, wissen" van Jurgen in dezelfde sessie.
-- Dit bestand staat daarom NIET in supabase/migrations/. Het gaat daar pas
-- heen (en draait lokaal mee) in WP2b, na M6 op live.
--
-- Terugrollen: supabase/ops/restore_v2.sql (getest in M0).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Gegevens wissen volgens BR-46.3
-- -----------------------------------------------------------------------------

-- Meldingen van vervallen soorten, en alle "taak gedaan" en dag-/avondoverzichten
-- van vóór de overgang: hun tekst kan een naam of "voor jou" bevatten (plan-critic 1)
delete from public.notifications
where type in ('task_assigned', 'swap_request', 'swap_accepted', 'task_completed', 'daily_summary', 'evening_summary');

-- Open uitnodigingen die aan een lid zonder account gekoppeld waren
delete from public.household_invitations where member_id is not null and accepted_at is null;

-- Leden zonder account (hun voorkeuren en meldingen gaan mee; notities houden author_name).
-- Verwijzingen naar hen worden leeg (FK "set null"); "bijgewerkt op" blijft staan.
alter table public.tasks disable trigger tasks_updated_at;
alter table public.task_recurrences disable trigger task_recurrences_updated_at;
delete from public.household_members where user_id is null;
alter table public.tasks enable trigger tasks_updated_at;
alter table public.task_recurrences enable trigger task_recurrences_updated_at;

-- -----------------------------------------------------------------------------
-- 2. Functies en triggers die naar vervallen kolommen verwijzen, eerst vervangen
-- -----------------------------------------------------------------------------
drop trigger if exists task_recurrences_check_rotation on public.task_recurrences;
drop trigger if exists household_members_cleanup_rotations on public.household_members;
drop function if exists private.check_rotation_members();
drop function if exists private.remove_member_from_rotations();

drop function if exists public.accept_swap_request(uuid);
drop function if exists public.complete_task(uuid, uuid, uuid, text, timestamptz);

-- Guard zonder de toewijzingsregel (die vervalt met de kolom)
create or replace function private.guard_task_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_via_rpc boolean := coalesce(current_setting('takenlijstje.via_rpc', true), '') = 'on';
begin
  -- Systeem (service role) en FK-acties (bijv. "on delete set null") mogen door
  if (select auth.uid()) is null or pg_trigger_depth() > 1 then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'done' and not v_via_rpc then
      raise exception 'Nieuwe taak kan niet al voltooid zijn' using errcode = '42501';
    end if;
    if new.deleted_at is not null and not v_via_rpc then
      raise exception 'Nieuwe taak kan niet al verwijderd zijn' using errcode = '42501';
    end if;
    if new.completed_at is not null and not v_via_rpc then
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

    -- Reekskoppeling (TECHNICAL_DESIGN §5.2)
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

  return new;
end;
$$;

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
  set status = 'todo', completed_at = null
  where id = v_task.id
  returning * into v_task;
  perform set_config('takenlijstje.via_rpc', 'off', true);

  return v_task;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Tabellen en kolommen droppen
-- -----------------------------------------------------------------------------
drop table public.task_assignments;
drop table public.task_swap_requests;
drop table public.member_absences;
drop function if exists private.guard_swap_changes();

alter table public.tasks
  drop column assigned_member_id,
  drop column assignment_reason,
  drop column completed_by_member_id,
  drop column points;

alter table public.task_completions
  drop column member_id,
  drop column points;
-- BR-11 als constraint: per taak hooguit één registratie tegelijk (M1(b) = 0)
alter table public.task_completions add constraint task_completions_task_id_key unique (task_id);

alter table public.task_recurrences
  drop column assignment_strategy,
  drop column fixed_member_id,
  drop column rotation_member_ids,
  drop column points;

alter table public.task_templates drop column points;

alter table public.households
  drop column members_can_assign_others,
  drop column points_enabled,
  drop column points_goal,
  drop column points_goal_reward;

alter table public.household_invitations drop column member_id;

alter table public.user_preferences
  drop column notify_task_assigned,
  drop column notify_swap_requests;

alter table public.shopping_lists drop column created_by_member_id;
alter table public.shopping_items
  drop column added_by_member_id,
  drop column bought_by_member_id;

-- household_members: altijd een account, één huishouden per persoon (BR-44)
alter table public.household_members
  drop column email,
  drop column avatar_url;
alter table public.household_members alter column user_id set not null;

do $$
declare
  v_name text;
begin
  -- unique (household_id, user_id) → unique (user_id)
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.household_members'::regclass and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (household_id, user_id)'
  loop
    execute format('alter table public.household_members drop constraint %I', v_name);
  end loop;
  -- user_id → users: on delete cascade (was set null)
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.household_members'::regclass and contype = 'f'
      and pg_get_constraintdef(oid) like 'FOREIGN KEY (user_id)%'
  loop
    execute format('alter table public.household_members drop constraint %I', v_name);
  end loop;
end;
$$;

alter table public.household_members
  add constraint household_members_user_id_key unique (user_id),
  add constraint household_members_user_id_fkey foreign key (user_id) references public.users (id) on delete cascade;

-- -----------------------------------------------------------------------------
-- 4. Enums
-- -----------------------------------------------------------------------------
alter type public.notification_type rename to notification_type_old;
create type public.notification_type as enum (
  'reminder', 'deadline_soon', 'overdue', 'task_completed', 'daily_summary', 'evening_summary'
);
alter table public.notifications
  alter column type type public.notification_type using type::text::public.notification_type;
drop type public.notification_type_old;

drop type public.assignment_strategy;
drop type public.absence_strategy;

-- -----------------------------------------------------------------------------
-- 5. Rechten (nieuwe of vervangen functies)
-- -----------------------------------------------------------------------------
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
