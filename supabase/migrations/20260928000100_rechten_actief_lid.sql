-- =============================================================================
-- WP1 — Rechtenmodel: alleen actieve leden, vaste helpers, strengere guards
-- (TECHNICAL_DESIGN §4.3, §5.1, §5.2; B-01…B-04, BR-22…BR-26, V-29)
--
-- Niet-destructief: de huidige app blijft ermee werken.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers: een uitgezet lid (is_active = false) telt niet meer als lid
-- -----------------------------------------------------------------------------
create or replace function private.is_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = p_household_id
      and m.user_id = (select auth.uid())
      and m.is_active
  );
$$;

create or replace function private.is_admin(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = p_household_id
      and m.user_id = (select auth.uid())
      and m.is_active
      and m.role = 'admin'
  );
$$;

create or replace function private.my_member_id(p_household_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id from public.household_members m
  where m.household_id = p_household_id
    and m.user_id = (select auth.uid())
    and m.is_active
  limit 1;
$$;

-- Beheerder, of actief lid dat de reeks zelf heeft gemaakt (BR-22)
create or replace function private.can_manage_series(p_recurrence_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.task_recurrences r
    where r.id = p_recurrence_id
      and (
        private.is_admin(r.household_id)
        or (private.is_member(r.household_id) and private.is_my_member(r.created_by_member_id))
      )
  );
$$;

-- Beheerder, of actief lid dat de taak zelf heeft gemaakt (BR-23)
create or replace function private.can_delete_task(p_household_id uuid, p_created_by_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin(p_household_id)
    or (private.is_member(p_household_id) and private.is_my_member(p_created_by_member_id));
$$;

-- -----------------------------------------------------------------------------
-- Rechten op functies in "private" (B-04): standaard niemand, alleen de
-- helpers die in policies worden gebruikt zijn aanroepbaar voor authenticated.
-- Triggerfuncties hebben geen execute-recht nodig om te draaien.
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

-- -----------------------------------------------------------------------------
-- Eigen lidmaatschap, ook als je uitgezet bent (voor het scherm "geen toegang")
-- -----------------------------------------------------------------------------
create or replace function public.my_membership()
returns table (member_id uuid, household_id uuid, household_name text, role public.member_role, is_active boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.household_id, h.name, m.role, m.is_active
  from public.household_members m
  join public.households h on h.id = m.household_id
  where m.user_id = (select auth.uid())
  order by m.created_at
  limit 1;
$$;

revoke execute on function public.my_membership() from public, anon;
grant execute on function public.my_membership() to authenticated;

-- -----------------------------------------------------------------------------
-- household_members
-- -----------------------------------------------------------------------------
drop policy if exists "members: leden lezen" on public.household_members;
create policy "members: leden lezen" on public.household_members
  for select to authenticated
  using (private.is_member(household_id) or user_id = (select auth.uid()));

drop policy if exists "members: beheerder of zichzelf wijzigen" on public.household_members;
create policy "members: beheerder of zichzelf wijzigen" on public.household_members
  for update to authenticated
  using (private.is_admin(household_id) or (user_id = (select auth.uid()) and private.is_member(household_id)))
  with check (private.is_admin(household_id) or (user_id = (select auth.uid()) and private.is_member(household_id)));

-- Guard (BR-24, V-29):
--  * huishouden en accountkoppeling zijn onveranderlijk voor gebruikers
--  * alleen een beheerder wijzigt rol en status
--  * jezelf uitzetten of verwijderen kan niet via ledenbeheer
--  * er blijft altijd minstens één actieve beheerder
create or replace function private.guard_member_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_via_rpc boolean := coalesce(current_setting('takenlijstje.via_rpc', true), '') = 'on';
  v_household uuid := coalesce(old.household_id, new.household_id);
  v_loses_admin boolean;
  v_active_admins integer;
begin
  if v_uid is not null and not v_via_rpc then
    if tg_op = 'UPDATE' then
      if new.household_id is distinct from old.household_id then
        raise exception 'Een gezinslid kan niet naar een ander huishouden' using errcode = '42501';
      end if;
      if new.user_id is distinct from old.user_id then
        raise exception 'De koppeling met een account kan niet worden gewijzigd' using errcode = '42501';
      end if;
      if not private.is_admin(old.household_id)
         and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
        raise exception 'Alleen een beheerder mag rol of status wijzigen' using errcode = '42501';
      end if;
      if old.user_id = v_uid and old.is_active and not new.is_active then
        raise exception 'Je kunt jezelf niet uitzetten' using errcode = '42501';
      end if;
    elsif tg_op = 'DELETE' and old.user_id = v_uid then
      raise exception 'Je kunt jezelf niet uit het huishouden verwijderen' using errcode = '42501';
    end if;
  end if;

  -- Minstens één actieve beheerder, ook voor RPC's (niet voor het systeem)
  if v_uid is not null then
    v_loses_admin := old.role = 'admin' and old.is_active and (
      tg_op = 'DELETE' or new.role <> 'admin' or not new.is_active
    );
    if v_loses_admin then
      select count(*) into v_active_admins
      from public.household_members
      where household_id = v_household and role = 'admin' and is_active and id <> old.id;
      if v_active_admins = 0 then
        raise exception 'Een huishouden heeft minimaal één actieve beheerder nodig' using errcode = '23514';
      end if;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

-- -----------------------------------------------------------------------------
-- households: alleen actieve leden lezen (helpers zijn aangepast)
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- task_recurrences: wijzigen en verwijderen door beheerder of actieve maker
-- -----------------------------------------------------------------------------
drop policy if exists "recurrences: beheerder of maker wijzigt" on public.task_recurrences;
create policy "recurrences: beheerder of maker wijzigt" on public.task_recurrences
  for update to authenticated
  using (private.is_admin(household_id) or (private.is_member(household_id) and private.is_my_member(created_by_member_id)))
  with check (private.is_admin(household_id) or (private.is_member(household_id) and private.is_my_member(created_by_member_id)));

drop policy if exists "recurrences: beheerder of maker verwijdert" on public.task_recurrences;
create policy "recurrences: beheerder of maker verwijdert" on public.task_recurrences
  for delete to authenticated
  using (private.is_admin(household_id) or (private.is_member(household_id) and private.is_my_member(created_by_member_id)));

-- De maker van een reeks is onveranderlijk (behalve via de FK bij verwijderen van het lid)
create or replace function private.guard_recurrence_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or pg_trigger_depth() > 1 then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.created_by_member_id is not null and not private.is_my_member(new.created_by_member_id) then
      raise exception 'Een reeks maak je als jezelf aan' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.household_id is distinct from old.household_id then
    raise exception 'Een reeks kan niet naar een ander huishouden' using errcode = '42501';
  end if;
  if new.created_by_member_id is distinct from old.created_by_member_id then
    raise exception 'De maker van een reeks kan niet worden gewijzigd' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists task_recurrences_guard on public.task_recurrences;
create trigger task_recurrences_guard
  before insert or update on public.task_recurrences
  for each row execute function private.guard_recurrence_changes();

-- -----------------------------------------------------------------------------
-- tasks (BR-23): ieder actief lid mag wijzigen; verwijderen alleen beheerder of maker
-- -----------------------------------------------------------------------------
drop policy if exists "tasks: wijzigen" on public.tasks;
create policy "tasks: wijzigen" on public.tasks
  for update to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));

drop policy if exists "tasks: beheerder of maker verwijdert" on public.tasks;
create policy "tasks: beheerder of maker verwijdert" on public.tasks
  for delete to authenticated
  using (private.can_delete_task(household_id, created_by_member_id));

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
  -- Systeem (service role) en FK-acties (bijv. "on delete set null") mogen door
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

  -- Toewijzen aan een ander alleen als het huishouden dat toestaat (vervalt in WP2)
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

-- -----------------------------------------------------------------------------
-- Eigen rijen alleen zolang je actief lid bent
-- -----------------------------------------------------------------------------
drop policy if exists "swaps: eigen verzoek intrekken" on public.task_swap_requests;
create policy "swaps: eigen verzoek intrekken" on public.task_swap_requests
  for update to authenticated
  using ((private.is_member(household_id) and private.is_my_member(requested_by_member_id)) or private.is_admin(household_id))
  with check (status in ('open', 'cancelled'));

drop policy if exists "comments: eigen of beheerder verwijdert" on public.task_comments;
create policy "comments: eigen of beheerder verwijdert" on public.task_comments
  for delete to authenticated
  using ((private.is_member(household_id) and private.is_my_member(member_id)) or private.is_admin(household_id));

drop policy if exists "absences: eigen of beheerder beheert" on public.member_absences;
create policy "absences: eigen of beheerder beheert" on public.member_absences
  for all to authenticated
  using (private.is_admin(household_id) or (private.is_member(household_id) and private.is_my_member(member_id)))
  with check (private.is_admin(household_id) or (private.is_member(household_id) and private.is_my_member(member_id)));

drop policy if exists "preferences: eigen instellingen" on public.user_preferences;
create policy "preferences: eigen instellingen" on public.user_preferences
  for all to authenticated
  using (private.is_member(household_id) and private.is_my_member(member_id))
  with check (private.is_member(household_id) and private.is_my_member(member_id));

-- -----------------------------------------------------------------------------
-- push_subscriptions: een uitgezet lid mag zijn apparaat alleen nog afmelden
-- (TECHNICAL_DESIGN §5.2)
-- -----------------------------------------------------------------------------
drop policy if exists "push: eigen abonnementen" on public.push_subscriptions;
create policy "push: eigen abonnementen lezen" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "push: eigen abonnementen verwijderen" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "push: aanmelden als actief lid" on public.push_subscriptions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.household_members m where m.user_id = (select auth.uid()) and m.is_active)
  );
create policy "push: bijwerken als actief lid" on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.household_members m where m.user_id = (select auth.uid()) and m.is_active)
  );

-- -----------------------------------------------------------------------------
-- notifications (BR-25, B-03): alleen het systeem maakt meldingen aan
-- -----------------------------------------------------------------------------
drop policy if exists "notifications: huisgenoten informeren" on public.notifications;

drop policy if exists "notifications: eigen lezen" on public.notifications;
create policy "notifications: eigen lezen" on public.notifications
  for select to authenticated
  using (private.is_member(household_id) and private.is_my_member(member_id));

drop policy if exists "notifications: eigen als gelezen markeren" on public.notifications;
create policy "notifications: eigen als gelezen markeren" on public.notifications
  for update to authenticated
  using (private.is_member(household_id) and private.is_my_member(member_id))
  with check (private.is_member(household_id) and private.is_my_member(member_id));

drop policy if exists "notifications: eigen verwijderen" on public.notifications;
create policy "notifications: eigen verwijderen" on public.notifications
  for delete to authenticated
  using (private.is_member(household_id) and private.is_my_member(member_id));

-- Alleen interne paden: geen "//host" of "/\host" (open redirect)
do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.notifications'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%url%'
  loop
    execute format('alter table public.notifications drop constraint %I', v_name);
  end loop;
end;
$$;

alter table public.notifications
  add constraint notifications_url_intern check (url is null or url ~ '^/([^/\\]|$)');
