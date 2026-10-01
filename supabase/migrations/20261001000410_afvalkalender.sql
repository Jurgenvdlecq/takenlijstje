-- =============================================================================
-- WP3b — Afvalkalender (W-03), stap 2 van 2 (TECHNICAL_DESIGN §18.3–§18.7).
--
-- Niet-destructief en compatibel met de huidige code:
--  * nieuwe tabel waste_calendars (alleen beheerders lezen, schrijven alleen via
--    de service role of disable_waste_calendar);
--  * drie nullable kolommen op tasks + vormcontrole + unieke sleutel per
--    huishouden, ophaaldag en richting (bestaande rijen blijven ongewijzigd);
--  * guard_task_changes, de policies "aanmaken" en "verwijdert" en delete_task
--    vervangen: niemand anders dan het systeem maakt, wijzigt of verwijdert een
--    afvaltaak; de status (afvinken, bezig, overslaan) blijft voor ieder lid;
--  * trigger: buitenzetten overslaan neemt binnenzetten mee (BR-53);
--  * RPC's waste_save, waste_sync (alleen service_role), disable_waste_calendar
--    en waste_calendar_enabled (authenticated, eigen rechtencheck).
--
-- Terugrollen: Vercel Instant Rollback + de operator-SQL uit TD §18.16.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Adres en opgehaalde ophaaldagen (§18.3.1)
-- -----------------------------------------------------------------------------
-- Versie uit een sequence: nooit hergebruikt, ook niet na uitzetten en opnieuw
-- aanzetten, zodat een verouderd plan van de tick nooit op een nieuw adres landt
create sequence public.waste_calendar_version_seq;

create table public.waste_calendars (
  household_id uuid primary key references public.households (id) on delete cascade,
  postcode text not null check (postcode ~ '^[1-9][0-9]{3}[A-Z]{2}$'),
  house_number integer not null check (house_number between 1 and 99999),
  house_suffix text not null default '' check (house_suffix ~ '^[A-Z0-9]{0,4}$'),
  bag_id text not null check (bag_id ~ '^[0-9]{16}$'),
  pickups jsonb not null check (jsonb_typeof(pickups) = 'object'),
  version bigint not null default nextval('public.waste_calendar_version_seq'),
  last_attempt_at timestamptz,
  last_success_at timestamptz not null,
  last_error_code text check (last_error_code in ('UNREACHABLE', 'FORMAT', 'SUSPECT_EMPTY', 'ADDRESS_GONE')),
  failure_count integer not null default 0 check (failure_count >= 0),
  first_failure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger waste_calendars_updated_at before update on public.waste_calendars
  for each row execute function private.set_updated_at();

alter table public.waste_calendars enable row level security;

-- Alleen beheerders zien het adres (V-53); geen policies voor schrijven
create policy "waste_calendars: beheerder leest" on public.waste_calendars
  for select to authenticated using (private.is_admin(household_id));

revoke all on public.waste_calendars from anon, authenticated;
grant select on public.waste_calendars to authenticated;
grant select, insert, update, delete on public.waste_calendars to service_role;
revoke all on sequence public.waste_calendar_version_seq from anon, authenticated;
grant usage on sequence public.waste_calendar_version_seq to service_role;

-- -----------------------------------------------------------------------------
-- 2. tasks: drie kolommen, vorm en sleutel (§18.3.2)
-- -----------------------------------------------------------------------------
alter table public.tasks
  add column waste_pickup_date date,
  add column waste_direction text,
  add column waste_streams text[];

alter table public.tasks
  add constraint tasks_waste_shape check (
    (waste_direction is null and waste_pickup_date is null and waste_streams is null)
    or (waste_direction in ('out', 'in') and waste_pickup_date is not null and recurrence_id is null
        and cardinality(waste_streams) between 1 and 3
        and waste_streams <@ array['rest', 'papier', 'pmd']::text[])
  ),
  add constraint tasks_waste_key unique (household_id, waste_pickup_date, waste_direction);

-- -----------------------------------------------------------------------------
-- 3. Guard (§18.5.2): de regels uit …_210 letterlijk, met het afvalblok ervoor
-- -----------------------------------------------------------------------------
create or replace function private.guard_task_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_via_rpc boolean := coalesce(current_setting('takenlijstje.via_rpc', true), '') = 'on';
begin
  -- Afvaltaken (BR-49, BR-53, AC-208, AC-219): alleen het systeem maakt en wijzigt
  -- ze. Ook geneste updates zijn hier niet vrijgesteld; alleen de overslaan-trigger
  -- (private.waste_skip_cascade) zet de transactielokale vlag.
  if (select auth.uid()) is not null
     and coalesce(current_setting('takenlijstje.waste_cascade', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      if new.waste_direction is not null or new.waste_pickup_date is not null or new.waste_streams is not null then
        raise exception 'Afvaltaken maakt alleen de afvalkalender' using errcode = '42501';
      end if;
    elsif old.waste_direction is not null
       or row(new.waste_direction, new.waste_pickup_date, new.waste_streams)
          is distinct from row(old.waste_direction, old.waste_pickup_date, old.waste_streams) then
      -- Alleen de status (en completed_at via de afvink-RPC's) mag veranderen
      if (to_jsonb(new) - array['status', 'completed_at', 'updated_at'])
         is distinct from (to_jsonb(old) - array['status', 'completed_at', 'updated_at']) then
        raise exception 'Een afvaltaak kun je niet wijzigen, verplaatsen of verwijderen' using errcode = '42501';
      end if;
    end if;
  end if;

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

-- -----------------------------------------------------------------------------
-- 4. Policies op tasks (§18.5.3): RLS + guard, bewust dubbel
-- -----------------------------------------------------------------------------
drop policy if exists "tasks: aanmaken" on public.tasks;
create policy "tasks: aanmaken" on public.tasks
  for insert to authenticated
  with check (
    private.can_create_tasks(household_id)
    and waste_direction is null and waste_pickup_date is null and waste_streams is null
  );

drop policy if exists "tasks: beheerder of maker verwijdert" on public.tasks;
create policy "tasks: beheerder of maker verwijdert" on public.tasks
  for delete to authenticated
  using (waste_direction is null and private.can_delete_task(household_id, created_by_member_id));

-- -----------------------------------------------------------------------------
-- 5. delete_task (§18.5.4): weigert afvaltaken (security definer omzeilt RLS)
-- -----------------------------------------------------------------------------
create or replace function public.delete_task(p_task_id uuid, p_scope text default 'this')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
  v_from date;
begin
  if p_scope not in ('this', 'future') then
    raise exception 'Onbekende keuze' using errcode = '22023';
  end if;

  -- Eerst lidmaatschap zonder lock: een taak van een ander huishouden gedraagt
  -- zich als een taak die niet bestaat (idempotent "al weg", geen lock)
  select * into v_task from public.tasks where id = p_task_id;
  if not found or v_task.deleted_at is not null or not private.is_member(v_task.household_id) then
    return true;
  end if;
  if v_task.waste_direction is not null then
    raise exception 'Een afvaltaak kun je niet verwijderen' using errcode = '42501';
  end if;
  if not private.can_delete_task(v_task.household_id, v_task.created_by_member_id) then
    raise exception 'Alleen een beheerder of wie de taak maakte mag hem verwijderen' using errcode = '42501';
  end if;
  if p_scope = 'future' and v_task.recurrence_id is not null
     and not private.can_manage_series(v_task.recurrence_id) then
    raise exception 'Alleen een beheerder of wie de reeks maakte mag dit' using errcode = '42501';
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;

  perform set_config('takenlijstje.via_rpc', 'on', true);

  if v_task.recurrence_id is null then
    if exists (select 1 from public.task_completions c where c.task_id = v_task.id) then
      update public.tasks set deleted_at = now() where id = v_task.id;
    else
      delete from public.tasks where id = v_task.id;
    end if;
  else
    update public.tasks set deleted_at = now() where id = v_task.id;
    if p_scope = 'future' then
      v_from := coalesce(v_task.occurrence_date, v_task.scheduled_date);
      update public.task_recurrences set is_active = false where id = v_task.recurrence_id;
      delete from public.tasks t
      where t.household_id = v_task.household_id
        and t.recurrence_id = v_task.recurrence_id
        and t.status in ('todo', 'in_progress')
        and t.occurrence_date >= v_from
        and t.id <> v_task.id;
    end if;
  end if;

  perform set_config('takenlijstje.via_rpc', 'off', true);
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Buitenzetten overslaan neemt binnenzetten mee (§18.5.5, BR-53, AC-209)
-- -----------------------------------------------------------------------------
create or replace function private.waste_skip_cascade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Alleen handmatig (een lid), niet het automatisch vervallen door de tick (BR-54)
  if (select auth.uid()) is null or pg_trigger_depth() > 1 then
    return null;
  end if;

  perform set_config('takenlijstje.waste_cascade', 'on', true);
  if old.status in ('todo', 'in_progress') and new.status = 'skipped' then
    update public.tasks
    set status = 'skipped'
    where household_id = new.household_id
      and waste_pickup_date = new.waste_pickup_date
      and waste_direction = 'in'
      and status in ('todo', 'in_progress');
  elsif old.status = 'skipped' and new.status in ('todo', 'in_progress') then
    update public.tasks
    set status = 'todo'
    where household_id = new.household_id
      and waste_pickup_date = new.waste_pickup_date
      and waste_direction = 'in'
      and status = 'skipped';
  end if;
  perform set_config('takenlijstje.waste_cascade', 'off', true);
  return null;
end;
$$;

create trigger tasks_waste_skip_cascade
  after update of status on public.tasks
  for each row when (new.waste_direction = 'out' and old.status is distinct from new.status)
  execute function private.waste_skip_cascade();

-- -----------------------------------------------------------------------------
-- 7. RPC's (§18.7)
-- -----------------------------------------------------------------------------

-- Nieuw adres opslaan (na requireAdmin + opvraging in de server action).
-- Alleen service_role; hercontroleert dat het lid nu nog actieve beheerder is.
create or replace function public.waste_save(
  p_household_id uuid,
  p_member_id uuid,
  p_postcode text,
  p_house_number integer,
  p_house_suffix text,
  p_bag_id text,
  p_pickups jsonb,
  p_insert jsonb,
  p_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version bigint;
  v_removed integer;
  v_inserted integer;
begin
  -- Serialiseert alle afval-schrijfacties per huishouden (no key: gewone inserts gaan door)
  perform 1 from public.households where id = p_household_id for no key update;
  if not found then
    raise exception 'Huishouden niet gevonden' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.household_members m
    where m.id = p_member_id and m.household_id = p_household_id and m.is_active and m.role = 'admin'
  ) then
    raise exception 'Alleen een beheerder kan de afvalkalender aanpassen' using errcode = '42501';
  end if;

  insert into public.waste_calendars (
    household_id, postcode, house_number, house_suffix, bag_id, pickups,
    last_attempt_at, last_success_at, last_error_code, failure_count, first_failure_at
  ) values (
    p_household_id, p_postcode, p_house_number, coalesce(p_house_suffix, ''), p_bag_id, p_pickups,
    p_now, p_now, null, 0, null
  )
  on conflict (household_id) do update set
    postcode = excluded.postcode,
    house_number = excluded.house_number,
    house_suffix = excluded.house_suffix,
    bag_id = excluded.bag_id,
    pickups = excluded.pickups,
    version = nextval('public.waste_calendar_version_seq'),
    last_attempt_at = excluded.last_attempt_at,
    last_success_at = excluded.last_success_at,
    last_error_code = null,
    failure_count = 0,
    first_failure_at = null
  returning version into v_version;

  -- BR-56: alle open afvaltaken van het vorige adres weg (geen historie)
  delete from public.tasks
  where household_id = p_household_id and waste_direction is not null and status in ('todo', 'in_progress');
  get diagnostics v_removed = row_count;

  insert into public.tasks (
    household_id, title, description, category, priority, scheduled_date, scheduled_time,
    available_from, due_at, reminder_minutes_before, waste_pickup_date, waste_direction, waste_streams
  )
  select p_household_id, x.title, x.description, 'outdoor', 'normal', x.scheduled_date, x.scheduled_time,
         x.available_from, x.due_at, '{}', x.waste_pickup_date, x.waste_direction, x.waste_streams
  from jsonb_to_recordset(coalesce(p_insert, '[]'::jsonb)) as x(
    title text, description text, scheduled_date date, scheduled_time time, available_from timestamptz,
    due_at timestamptz, waste_pickup_date date, waste_direction text, waste_streams text[]
  )
  on conflict (household_id, waste_pickup_date, waste_direction) do nothing;
  get diagnostics v_inserted = row_count;

  return jsonb_build_object('version', v_version, 'removed', v_removed, 'inserted', v_inserted);
end;
$$;

-- Bijwerken door de tick of bij bevestigen van hetzelfde adres. Alleen service_role.
-- Een andere versie (adres intussen gewijzigd of uitgezet) → niets doen.
create or replace function public.waste_sync(
  p_household_id uuid,
  p_version bigint,
  p_result text,
  p_error_code text,
  p_pickups jsonb,
  p_insert jsonb,
  p_rename jsonb,
  p_remove uuid[],
  p_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version bigint;
  v_inserted integer;
  v_renamed integer;
  v_removed integer;
begin
  if p_result is not null and p_result not in ('success', 'failure') then
    raise exception 'Onbekend resultaat' using errcode = '22023';
  end if;

  perform 1 from public.households where id = p_household_id for no key update;
  select version into v_version from public.waste_calendars where household_id = p_household_id for update;
  if not found or v_version is distinct from p_version then
    return jsonb_build_object('stale', true);
  end if;

  if p_result = 'success' then
    update public.waste_calendars
    set pickups = p_pickups, last_success_at = p_now, last_error_code = null, failure_count = 0, first_failure_at = null
    where household_id = p_household_id;
  elsif p_result = 'failure' then
    update public.waste_calendars
    set last_error_code = p_error_code, failure_count = failure_count + 1, first_failure_at = coalesce(first_failure_at, p_now)
    where household_id = p_household_id;
  end if;

  -- Alleen open afvaltaken; wat intussen is afgevinkt of overgeslagen blijft (AC-202)
  delete from public.tasks
  where id = any(coalesce(p_remove, '{}'::uuid[]))
    and household_id = p_household_id and waste_direction is not null and status in ('todo', 'in_progress');
  get diagnostics v_removed = row_count;

  update public.tasks t
  set title = x.title, waste_streams = x.waste_streams
  from jsonb_to_recordset(coalesce(p_rename, '[]'::jsonb)) as x(id uuid, title text, waste_streams text[])
  where t.id = x.id and t.household_id = p_household_id and t.waste_direction is not null
    and t.status in ('todo', 'in_progress');
  get diagnostics v_renamed = row_count;

  insert into public.tasks (
    household_id, title, description, category, priority, scheduled_date, scheduled_time,
    available_from, due_at, reminder_minutes_before, waste_pickup_date, waste_direction, waste_streams
  )
  select p_household_id, x.title, x.description, 'outdoor', 'normal', x.scheduled_date, x.scheduled_time,
         x.available_from, x.due_at, '{}', x.waste_pickup_date, x.waste_direction, x.waste_streams
  from jsonb_to_recordset(coalesce(p_insert, '[]'::jsonb)) as x(
    title text, description text, scheduled_date date, scheduled_time time, available_from timestamptz,
    due_at timestamptz, waste_pickup_date date, waste_direction text, waste_streams text[]
  )
  on conflict (household_id, waste_pickup_date, waste_direction) do nothing;
  get diagnostics v_inserted = row_count;

  return jsonb_build_object('stale', false, 'inserted', v_inserted, 'renamed', v_renamed, 'removed', v_removed);
end;
$$;

-- Uitzetten door een beheerder (AC-213): adres, datums en stand weg, open afvaltaken weg
create or replace function public.disable_waste_calendar()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid;
  v_removed integer;
begin
  -- Eén lidmaatschap per account (BR-44: unique (user_id)), dus hooguit één huishouden
  select m.household_id into v_household
  from public.household_members m
  where m.user_id = (select auth.uid()) and m.is_active and m.role = 'admin';
  if v_household is null then
    raise exception 'Alleen een beheerder kan de afvalkalender aanpassen' using errcode = '42501';
  end if;

  perform 1 from public.households where id = v_household for no key update;
  delete from public.tasks
  where household_id = v_household and waste_direction is not null and status in ('todo', 'in_progress');
  get diagnostics v_removed = row_count;
  delete from public.waste_calendars where household_id = v_household;
  return v_removed;
end;
$$;

-- Staat de afvalkalender aan voor het eigen huishouden? (gezinsleden; geen adres)
create or replace function public.waste_calendar_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.waste_calendars w
    join public.household_members m on m.household_id = w.household_id
    where m.user_id = (select auth.uid()) and m.is_active
  );
$$;

revoke execute on function
  public.waste_save(uuid, uuid, text, integer, text, text, jsonb, jsonb, timestamptz),
  public.waste_sync(uuid, bigint, text, text, jsonb, jsonb, jsonb, uuid[], timestamptz),
  public.disable_waste_calendar(),
  public.waste_calendar_enabled()
from public, anon, authenticated;

grant execute on function
  public.waste_save(uuid, uuid, text, integer, text, text, jsonb, jsonb, timestamptz),
  public.waste_sync(uuid, bigint, text, text, jsonb, jsonb, jsonb, uuid[], timestamptz)
to service_role;

grant execute on function
  public.disable_waste_calendar(),
  public.waste_calendar_enabled()
to authenticated;

-- Interne functies blijven onbereikbaar (B-04 / AC-028), helpers voor de policies wel
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

commit;
