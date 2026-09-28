-- =============================================================================
-- WP1 — Reeksacties en verwijderen als RPC met eigen rechtencheck (B-01)
-- (TECHNICAL_DESIGN §5.2, §6.1; BR-09, BR-22, BR-23)
--
-- Iedere functie controleert EERST de rechten en verandert niets bij een
-- weigering (42501). Alles gebeurt in één transactie. Het opnieuw inplannen
-- (alleen invoegen) doet daarna de app via de planner.
-- =============================================================================

-- Open, nog niet begonnen uitvoeringen van een reeks weghalen (optioneel binnen
-- een periode). Zonder einddatum wordt generated_until teruggezet, zodat de
-- planner vanaf p_from opnieuw aanvult.
create or replace function public.clear_series_occurrences(
  p_recurrence_id uuid,
  p_from date,
  p_until date default null,
  p_include_exceptions boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_series public.task_recurrences%rowtype;
  v_count integer;
begin
  select * into v_series from public.task_recurrences where id = p_recurrence_id for update;
  if not found then
    raise exception 'Reeks niet gevonden' using errcode = 'P0002';
  end if;
  if not private.can_manage_series(v_series.id) then
    raise exception 'Alleen een beheerder of wie de reeks maakte mag dit' using errcode = '42501';
  end if;

  delete from public.tasks t
  where t.household_id = v_series.household_id
    and t.recurrence_id = v_series.id
    and t.status in ('todo', 'in_progress')
    and t.occurrence_date >= p_from
    and (p_until is null or t.occurrence_date <= p_until)
    and (p_include_exceptions or not t.is_exception);
  get diagnostics v_count = row_count;

  if p_until is null then
    update public.task_recurrences
    set generated_until = least(coalesce(generated_until, p_from - 1), p_from - 1)
    where id = v_series.id;
  end if;

  return v_count;
end;
$$;

-- Pauzeren (p_from/p_until gevuld) of een pauze aanpassen
create or replace function public.pause_series(p_recurrence_id uuid, p_from date, p_until date)
returns public.task_recurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_series public.task_recurrences%rowtype;
begin
  select * into v_series from public.task_recurrences where id = p_recurrence_id for update;
  if not found then
    raise exception 'Reeks niet gevonden' using errcode = 'P0002';
  end if;
  if not private.can_manage_series(v_series.id) then
    raise exception 'Alleen een beheerder of wie de reeks maakte mag dit' using errcode = '42501';
  end if;
  if p_from is null then
    raise exception 'Kies een startdatum voor de pauze' using errcode = '22023';
  end if;
  if p_until is not null and p_until < p_from then
    raise exception 'De pauze eindigt vóór hij begint' using errcode = '22023';
  end if;

  update public.task_recurrences
  set paused_from = p_from, paused_until = p_until
  where id = v_series.id
  returning * into v_series;

  -- Open, niet handmatig aangepaste uitvoeringen in de pauze vervallen (BR-09)
  delete from public.tasks t
  where t.household_id = v_series.household_id
    and t.recurrence_id = v_series.id
    and t.status in ('todo', 'in_progress')
    and not t.is_exception
    and t.occurrence_date >= p_from
    and (p_until is null or t.occurrence_date <= p_until);

  return v_series;
end;
$$;

create or replace function public.resume_series(p_recurrence_id uuid)
returns public.task_recurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_series public.task_recurrences%rowtype;
begin
  select * into v_series from public.task_recurrences where id = p_recurrence_id for update;
  if not found then
    raise exception 'Reeks niet gevonden' using errcode = 'P0002';
  end if;
  if not private.can_manage_series(v_series.id) then
    raise exception 'Alleen een beheerder of wie de reeks maakte mag dit' using errcode = '42501';
  end if;

  update public.task_recurrences
  set paused_from = null, paused_until = null
  where id = v_series.id
  returning * into v_series;
  return v_series;
end;
$$;

-- Stoppen: reeks inactief en alle open, niet begonnen uitvoeringen weg; historie blijft
create or replace function public.stop_series(p_recurrence_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_series public.task_recurrences%rowtype;
begin
  select * into v_series from public.task_recurrences where id = p_recurrence_id for update;
  if not found then
    raise exception 'Reeks niet gevonden' using errcode = 'P0002';
  end if;
  if not private.can_manage_series(v_series.id) then
    raise exception 'Alleen een beheerder of wie de reeks maakte mag dit' using errcode = '42501';
  end if;

  update public.task_recurrences set is_active = false where id = v_series.id;

  delete from public.tasks t
  where t.household_id = v_series.household_id
    and t.recurrence_id = v_series.id
    and t.status in ('todo', 'in_progress');

  return true;
end;
$$;

-- Taak verwijderen (BR-23). Scope 'future' stopt ook de reeks vanaf deze uitvoering.
--  * losse taak zonder historie → echt weg
--  * met historie of in een reeks → zacht verwijderd (deleted_at)
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

  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or v_task.deleted_at is not null then
    return true; -- al weg: idempotent
  end if;
  if not private.is_member(v_task.household_id) then
    raise exception 'Taak niet gevonden' using errcode = 'P0002';
  end if;
  if not private.can_delete_task(v_task.household_id, v_task.created_by_member_id) then
    raise exception 'Alleen een beheerder of wie de taak maakte mag hem verwijderen' using errcode = '42501';
  end if;
  if p_scope = 'future' and v_task.recurrence_id is not null
     and not private.can_manage_series(v_task.recurrence_id) then
    raise exception 'Alleen een beheerder of wie de reeks maakte mag dit' using errcode = '42501';
  end if;

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

revoke execute on function
  public.clear_series_occurrences(uuid, date, date, boolean),
  public.pause_series(uuid, date, date),
  public.resume_series(uuid),
  public.stop_series(uuid),
  public.delete_task(uuid, text)
from public, anon;

grant execute on function
  public.clear_series_occurrences(uuid, date, date, boolean),
  public.pause_series(uuid, date, date),
  public.resume_series(uuid),
  public.stop_series(uuid),
  public.delete_task(uuid, text)
to authenticated;

-- -----------------------------------------------------------------------------
-- B-04 / AC-028: ook functies die ná de revoke in migratie _100 zijn aangemaakt
-- (bijv. guard_recurrence_changes) zijn niet aanroepbaar; toekomstige functies
-- in "private" krijgen standaard geen execute-recht voor PUBLIC.
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
alter default privileges in schema private revoke execute on functions from public;
