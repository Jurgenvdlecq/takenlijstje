-- =============================================================================
-- WP3b — Afvalkalender (W-03) (TECHNICAL_DESIGN §18.3, §18.5, §18.7)
--
-- Additief: een nieuwe tabel, drie nullable kolommen op tasks (zonder
-- herschrijving), en vervangen functies/policies. De oude code blijft werken.
-- Op live via apply_migration, ná _320 en na CP-W03 en U0.1 (§18.16 U4).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. waste_calendars: hooguit één adres per huishouden (§18.3.1)
-- -----------------------------------------------------------------------------
create table public.waste_calendars (
  household_id uuid primary key references public.households (id) on delete cascade,
  postcode text not null check (postcode ~ '^[1-9][0-9]{3}[A-Z]{2}$'),
  house_number integer not null check (house_number between 1 and 99999),
  house_suffix text not null default '' check (house_suffix ~ '^[A-Z0-9]{0,4}$'),
  -- De adrescode van de gemeente (V-58)
  bag_id text not null check (bag_id ~ '^[0-9]{16}$'),
  -- Alleen gewijzigd door een geslaagde bijwerking of waste_save
  pickups jsonb not null check (jsonb_typeof(pickups) = 'object'),
  version bigint not null default 1,
  -- Alleen claim en rate limit (§18.8.3); telt niet mee in de gezondheid
  last_attempt_at timestamptz,
  last_success_at timestamptz not null,
  last_error_code text check (last_error_code in ('UNREACHABLE', 'FORMAT', 'SUSPECT_EMPTY', 'ADDRESS_GONE')),
  -- Eerste vastgelegde mislukking in de huidige reeks met dezelfde code
  error_since timestamptz,
  -- Laatste vastgelegde mislukking; alleen waste_sync zet deze kolom
  last_failure_at timestamptz,
  -- Storing vastgesteld (markWasteAlarm); alleen een succes of waste_save wist hem
  alarm_since timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((last_error_code is null) = (error_since is null)),
  check ((last_error_code is null) = (last_failure_at is null)),
  check (last_failure_at is null or last_failure_at >= error_since),
  check (alarm_since is null or alarm_since >= last_success_at)
);

create trigger waste_calendars_updated_at before update on public.waste_calendars
  for each row execute function private.set_updated_at();

-- Alleen beheerders lezen het adres (V-53); schrijven alleen via de service role
alter table public.waste_calendars enable row level security;
create policy "waste_calendars: beheerders lezen" on public.waste_calendars
  for select to authenticated using (private.is_admin(household_id));

revoke all on public.waste_calendars from anon;
revoke insert, update, delete, truncate, references, trigger on public.waste_calendars from authenticated;

-- -----------------------------------------------------------------------------
-- 2. tasks: drie kolommen voor afvaltaken (§18.3.2)
-- -----------------------------------------------------------------------------
alter table public.tasks
  add column waste_pickup_date date,
  add column waste_direction text,
  add column waste_streams text[];

alter table public.tasks
  add constraint tasks_waste_shape check (
    (waste_pickup_date is null and waste_direction is null and waste_streams is null)
    or (
      waste_direction in ('out', 'in')
      and waste_pickup_date is not null
      and recurrence_id is null
      and waste_streams is not null
      and cardinality(waste_streams) between 1 and 3
      and waste_streams <@ array['rest', 'papier', 'pmd']
    )
  ),
  -- Eén taak per dag en richting; NULL's botsen niet. Ook het on conflict-doel.
  add constraint tasks_waste_key unique (household_id, waste_pickup_date, waste_direction);

-- -----------------------------------------------------------------------------
-- 3. Guard: de regels uit _210 letterlijk, plus afvaltaken (§18.5.2)
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
  -- Systeem (service role) en FK-acties (bijv. "on delete set null") mogen door
  if (select auth.uid()) is null or pg_trigger_depth() > 1 then
    return new;
  end if;

  -- Afvaltaken (BR-53): alleen het systeem maakt ze; leden wijzigen alleen de status
  if tg_op = 'INSERT' then
    if new.waste_direction is not null or new.waste_pickup_date is not null or new.waste_streams is not null then
      raise exception 'Afvaltaken maakt alleen de afvalkalender' using errcode = '42501';
    end if;
  else
    if old.waste_direction is not null
       or row(new.waste_direction, new.waste_pickup_date, new.waste_streams)
          is distinct from row(old.waste_direction, old.waste_pickup_date, old.waste_streams) then
      if (to_jsonb(new) - array['status', 'completed_at', 'updated_at'])
         is distinct from (to_jsonb(old) - array['status', 'completed_at', 'updated_at']) then
        raise exception 'Een afvaltaak kun je niet wijzigen, verplaatsen of verwijderen' using errcode = '42501';
      end if;
    end if;
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
-- 4. Policies op tasks (§18.5.3)
-- -----------------------------------------------------------------------------
drop policy if exists "tasks: aanmaken" on public.tasks;
create policy "tasks: aanmaken" on public.tasks
  for insert to authenticated
  with check (private.can_create_tasks(household_id) and waste_direction is null and waste_pickup_date is null);

drop policy if exists "tasks: beheerder of maker verwijdert" on public.tasks;
create policy "tasks: beheerder of maker verwijdert" on public.tasks
  for delete to authenticated
  using (waste_direction is null and private.can_delete_task(household_id, created_by_member_id));

-- -----------------------------------------------------------------------------
-- 5. delete_task: afvaltaken weigeren (§18.5.4); verder gelijk aan _110
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
    raise exception 'Een afvaltaak kun je niet wijzigen, verplaatsen of verwijderen' using errcode = '42501';
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
-- 6. Buitenzetten overslaan neemt binnenzetten mee (BR-53, AC-209; §18.5.5)
--    Alleen voor een lid (niet het systeem, dus niet bij vanzelf vervallen).
-- -----------------------------------------------------------------------------
create or replace function private.waste_skip_cascade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or pg_trigger_depth() <> 1 then
    return null;
  end if;

  if new.status = 'skipped' then
    update public.tasks
    set status = 'skipped'
    where household_id = new.household_id
      and waste_pickup_date = new.waste_pickup_date
      and waste_direction = 'in'
      and status in ('todo', 'in_progress');
  elsif new.status = 'todo' and old.status = 'skipped' then
    update public.tasks
    set status = 'todo'
    where household_id = new.household_id
      and waste_pickup_date = new.waste_pickup_date
      and waste_direction = 'in'
      and status = 'skipped';
  end if;
  return null;
end;
$$;

create trigger tasks_waste_skip_cascade
  after update of status on public.tasks
  for each row
  when (new.waste_direction = 'out' and old.status is distinct from new.status)
  execute function private.waste_skip_cascade();

-- -----------------------------------------------------------------------------
-- 7. RPC's (§18.7)
-- -----------------------------------------------------------------------------

-- Nieuwe afvaltaken uit een jsonb-lijst (gedeeld door waste_save en waste_sync)
create or replace function private.waste_insert_tasks(p_household_id uuid, p_insert jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.tasks (
    household_id, title, description, category, priority, status,
    scheduled_date, scheduled_time, available_from, due_at, reminder_minutes_before,
    created_by_member_id, recurrence_id,
    waste_pickup_date, waste_direction, waste_streams
  )
  select
    p_household_id, x.title, null, 'outdoor', 'normal', 'todo',
    x.scheduled_date, x.scheduled_time, x.available_from, x.due_at, '{}',
    null, null,
    x.waste_pickup_date, x.waste_direction, x.waste_streams
  from jsonb_to_recordset(coalesce(p_insert, '[]'::jsonb)) as x(
    title text,
    scheduled_date date,
    scheduled_time time,
    available_from timestamptz,
    due_at timestamptz,
    waste_pickup_date date,
    waste_direction text,
    waste_streams text[]
  )
  on conflict on constraint tasks_waste_key do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Adres instellen of wijzigen (BR-48, BR-56). Alleen de service role, na requireAdmin().
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
  -- 1. Slot: serialiseert alle afval-schrijfacties per huishouden
  perform 1 from public.households where id = p_household_id for no key update;
  if not found then
    raise exception 'Huishouden bestaat niet' using errcode = 'P0002';
  end if;

  -- 2. Hercontrole: nog steeds een actieve beheerder van dit huishouden
  if not exists (
    select 1 from public.household_members m
    where m.id = p_member_id and m.household_id = p_household_id and m.is_active and m.role = 'admin'
  ) then
    raise exception 'Alleen een beheerder kan dit doen' using errcode = '42501';
  end if;

  -- 3. Adres en stand
  insert into public.waste_calendars as w (
    household_id, postcode, house_number, house_suffix, bag_id, pickups, version,
    last_attempt_at, last_success_at, last_error_code, error_since, last_failure_at, alarm_since
  ) values (
    p_household_id, p_postcode, p_house_number, coalesce(p_house_suffix, ''), p_bag_id, p_pickups, 1,
    p_now, p_now, null, null, null, null
  )
  on conflict (household_id) do update set
    postcode = excluded.postcode,
    house_number = excluded.house_number,
    house_suffix = excluded.house_suffix,
    bag_id = excluded.bag_id,
    pickups = excluded.pickups,
    version = w.version + 1,
    last_attempt_at = excluded.last_attempt_at,
    last_success_at = excluded.last_success_at,
    last_error_code = null,
    error_since = null,
    last_failure_at = null,
    alarm_since = null
  returning version into v_version;

  -- 4. Alle open afvaltaken weg (nooit taken van twee adressen; afgevinkt blijft)
  delete from public.tasks
  where household_id = p_household_id
    and waste_direction is not null
    and status in ('todo', 'in_progress');
  get diagnostics v_removed = row_count;

  -- 5. Nieuwe taken
  v_inserted := private.waste_insert_tasks(p_household_id, p_insert);

  return jsonb_build_object('version', v_version, 'removed', v_removed, 'inserted', v_inserted);
end;
$$;

-- Bijwerken en plannen (§18.8.6). Alleen de service role.
create or replace function public.waste_sync(
  p_household_id uuid,
  p_version bigint,
  p_result text,
  p_error_code text,
  p_pickups jsonb,
  p_remove uuid[],
  p_move jsonb,
  p_rename jsonb,
  p_insert jsonb,
  p_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cal public.waste_calendars%rowtype;
  v_removed integer := 0;
  v_moved integer := 0;
  v_renamed integer := 0;
  v_inserted integer := 0;
begin
  if p_result is not null and p_result not in ('success', 'failure') then
    raise exception 'Onbekende uitkomst' using errcode = '22023';
  end if;
  if p_result = 'failure' and (p_error_code is null
     or p_error_code not in ('UNREACHABLE', 'FORMAT', 'SUSPECT_EMPTY', 'ADDRESS_GONE')) then
    raise exception 'Onbekende foutcode' using errcode = '22023';
  end if;
  if p_result = 'success' and (p_pickups is null or jsonb_typeof(p_pickups) <> 'object') then
    raise exception 'Ophaaldagen ontbreken' using errcode = '22023';
  end if;

  -- 1. Slot op het huishouden
  perform 1 from public.households where id = p_household_id for no key update;

  -- 2. Het adres is intussen gewijzigd of uitgezet → niets doen
  select * into v_cal from public.waste_calendars where household_id = p_household_id for update;
  if not found or v_cal.version <> p_version then
    return jsonb_build_object('stale', true, 'removed', 0, 'moved', 0, 'renamed', 0, 'inserted', 0);
  end if;

  -- 3. Stand bijwerken
  if p_result = 'success' then
    update public.waste_calendars
    set pickups = p_pickups,
        last_success_at = p_now,
        last_error_code = null,
        error_since = null,
        last_failure_at = null,
        alarm_since = null
    where household_id = p_household_id;
  elsif p_result = 'failure' then
    update public.waste_calendars
    set error_since = case when last_error_code is distinct from p_error_code then p_now else error_since end,
        last_error_code = p_error_code,
        last_failure_at = p_now
    where household_id = p_household_id;
  end if;

  -- 4. Verwijderen (alleen open afvaltaken)
  if coalesce(cardinality(p_remove), 0) > 0 then
    delete from public.tasks
    where id = any (p_remove)
      and household_id = p_household_id
      and waste_direction is not null
      and status in ('todo', 'in_progress');
    get diagnostics v_removed = row_count;
  end if;

  -- 5. Verschuiven: dezelfde rij, zodat notities en "bezig" blijven (AC-198)
  update public.tasks t
  set waste_pickup_date = x.waste_pickup_date,
      scheduled_date = x.scheduled_date,
      scheduled_time = x.scheduled_time,
      available_from = x.available_from,
      due_at = x.due_at,
      title = x.title,
      waste_streams = x.waste_streams
  from jsonb_to_recordset(coalesce(p_move, '[]'::jsonb)) as x(
    id uuid,
    direction text,
    title text,
    scheduled_date date,
    scheduled_time time,
    available_from timestamptz,
    due_at timestamptz,
    waste_pickup_date date,
    waste_streams text[]
  )
  where t.id = x.id
    and t.household_id = p_household_id
    and t.waste_direction = x.direction
    and t.status in ('todo', 'in_progress');
  get diagnostics v_moved = row_count;

  -- 6. Hernoemen (andere bakken op dezelfde dag, AC-201)
  update public.tasks t
  set title = x.title,
      waste_streams = x.waste_streams
  from jsonb_to_recordset(coalesce(p_rename, '[]'::jsonb)) as x(id uuid, title text, waste_streams text[])
  where t.id = x.id
    and t.household_id = p_household_id
    and t.waste_direction is not null
    and t.status in ('todo', 'in_progress');
  get diagnostics v_renamed = row_count;

  -- 7. Nieuwe taken
  v_inserted := private.waste_insert_tasks(p_household_id, p_insert);

  return jsonb_build_object(
    'stale', false, 'removed', v_removed, 'moved', v_moved, 'renamed', v_renamed, 'inserted', v_inserted
  );
end;
$$;

-- Afvalkalender uitzetten (BR-56, AC-213): door een beheerder
create or replace function public.disable_waste_calendar()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_removed integer;
begin
  select m.household_id into v_household_id
  from public.household_members m
  where m.user_id = (select auth.uid()) and m.is_active and m.role = 'admin'
  order by m.created_at
  limit 1;
  if v_household_id is null then
    raise exception 'Alleen een beheerder kan dit doen' using errcode = '42501';
  end if;

  perform 1 from public.households where id = v_household_id for no key update;

  delete from public.tasks
  where household_id = v_household_id
    and waste_direction is not null
    and status in ('todo', 'in_progress');
  get diagnostics v_removed = row_count;

  delete from public.waste_calendars where household_id = v_household_id;

  return v_removed;
end;
$$;

-- Staat de afvalkalender aan? Voor ieder actief lid, zonder adres (V-53)
create or replace function public.waste_calendar_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members m
    join public.waste_calendars w on w.household_id = m.household_id
    where m.user_id = (select auth.uid()) and m.is_active
  );
$$;

-- -----------------------------------------------------------------------------
-- 8. Rechten
-- -----------------------------------------------------------------------------
revoke execute on function
  public.waste_save(uuid, uuid, text, integer, text, text, jsonb, jsonb, timestamptz),
  public.waste_sync(uuid, bigint, text, text, jsonb, uuid[], jsonb, jsonb, jsonb, timestamptz)
from public, anon, authenticated;
grant execute on function
  public.waste_save(uuid, uuid, text, integer, text, text, jsonb, jsonb, timestamptz),
  public.waste_sync(uuid, bigint, text, text, jsonb, uuid[], jsonb, jsonb, jsonb, timestamptz)
to service_role;

revoke execute on function
  public.disable_waste_calendar(),
  public.waste_calendar_enabled()
from public, anon;
grant execute on function
  public.disable_waste_calendar(),
  public.waste_calendar_enabled()
to authenticated;

-- Patroon _110: functies in private niet aanroepbaar, behalve de helpers voor RLS
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
