-- =============================================================================
-- Row Level Security
--
-- Iedere tabel heeft RLS aan. Toegang loopt altijd via lidmaatschap van het
-- huishouden (household_members.user_id = auth.uid()).
-- Helperfuncties staan in het schema "private" (niet via de API bereikbaar) en
-- zijn security definer, zodat ze zelf niet in een RLS-lus terechtkomen.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
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
    where m.household_id = p_household_id and m.user_id = (select auth.uid())
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
  where m.household_id = p_household_id and m.user_id = (select auth.uid())
  limit 1;
$$;

-- Is dit gezinslid "van mij" (mijn eigen rij)?
create or replace function private.is_my_member(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.id = p_member_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.can_create_tasks(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin(p_household_id) or (
    private.is_member(p_household_id)
    and coalesce((select h.members_can_create_tasks from public.households h where h.id = p_household_id), false)
  );
$$;

grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Rechten op tabellen (RLS bepaalt welke rijen)
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------
alter table public.users enable row level security;

create policy "users: zichzelf en huisgenoten lezen" on public.users
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.household_members other
      where other.user_id = users.id and private.is_member(other.household_id)
    )
  );

create policy "users: eigen profiel wijzigen" on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- households (aanmaken gaat via create_household())
-- -----------------------------------------------------------------------------
alter table public.households enable row level security;

create policy "households: leden lezen" on public.households
  for select to authenticated using (private.is_member(id));

create policy "households: beheerder wijzigt" on public.households
  for update to authenticated using (private.is_admin(id)) with check (private.is_admin(id));

create policy "households: beheerder verwijdert" on public.households
  for delete to authenticated using (private.is_admin(id));

-- -----------------------------------------------------------------------------
-- household_members
-- -----------------------------------------------------------------------------
alter table public.household_members enable row level security;

create policy "members: leden lezen" on public.household_members
  for select to authenticated using (private.is_member(household_id));

create policy "members: beheerder voegt toe" on public.household_members
  for insert to authenticated with check (private.is_admin(household_id));

create policy "members: beheerder of zichzelf wijzigen" on public.household_members
  for update to authenticated
  using (private.is_admin(household_id) or user_id = (select auth.uid()))
  with check (private.is_admin(household_id) or user_id = (select auth.uid()));

create policy "members: beheerder verwijdert" on public.household_members
  for delete to authenticated using (private.is_admin(household_id));

-- Gezinsleden mogen hun eigen rol/koppeling niet aanpassen; de laatste
-- beheerder kan niet worden gedegradeerd of verwijderd.
create or replace function private.guard_member_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_count integer;
begin
  -- Service role (geen ingelogde gebruiker) en eigen RPC's mogen alles
  if (select auth.uid()) is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' and not private.is_admin(old.household_id)
     and current_setting('takenlijstje.via_rpc', true) is distinct from 'on' then
    if new.role is distinct from old.role
       or new.user_id is distinct from old.user_id
       or new.is_active is distinct from old.is_active
       or new.household_id is distinct from old.household_id then
      raise exception 'Alleen een beheerder mag rol, koppeling of status wijzigen' using errcode = '42501';
    end if;
  end if;

  if (tg_op = 'DELETE' and old.role = 'admin')
     or (tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin') then
    select count(*) into v_admin_count
    from public.household_members
    where household_id = old.household_id and role = 'admin' and id <> old.id;
    if v_admin_count = 0 then
      raise exception 'Een huishouden heeft minimaal één beheerder nodig' using errcode = '23514';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger household_members_guard
  before update or delete on public.household_members
  for each row execute function private.guard_member_changes();

-- -----------------------------------------------------------------------------
-- household_invitations (accepteren gaat via accept_invitation())
-- -----------------------------------------------------------------------------
alter table public.household_invitations enable row level security;

create policy "invitations: beheerder beheert" on public.household_invitations
  for all to authenticated
  using (private.is_admin(household_id))
  with check (private.is_admin(household_id));

-- -----------------------------------------------------------------------------
-- task_templates
-- -----------------------------------------------------------------------------
alter table public.task_templates enable row level security;

create policy "templates: globaal of eigen huishouden lezen" on public.task_templates
  for select to authenticated
  using (household_id is null or private.is_member(household_id));

create policy "templates: beheerder beheert eigen sjablonen" on public.task_templates
  for all to authenticated
  using (household_id is not null and private.is_admin(household_id))
  with check (household_id is not null and private.is_admin(household_id));

-- -----------------------------------------------------------------------------
-- task_recurrences
-- -----------------------------------------------------------------------------
alter table public.task_recurrences enable row level security;

create policy "recurrences: leden lezen" on public.task_recurrences
  for select to authenticated using (private.is_member(household_id));

create policy "recurrences: aanmaken" on public.task_recurrences
  for insert to authenticated with check (private.can_create_tasks(household_id));

create policy "recurrences: beheerder of maker wijzigt" on public.task_recurrences
  for update to authenticated
  using (private.is_admin(household_id) or private.is_my_member(created_by_member_id))
  with check (private.is_admin(household_id) or private.is_my_member(created_by_member_id));

create policy "recurrences: beheerder of maker verwijdert" on public.task_recurrences
  for delete to authenticated
  using (private.is_admin(household_id) or private.is_my_member(created_by_member_id));

-- -----------------------------------------------------------------------------
-- tasks
-- -----------------------------------------------------------------------------
alter table public.tasks enable row level security;

create policy "tasks: leden lezen" on public.tasks
  for select to authenticated using (private.is_member(household_id));

create policy "tasks: aanmaken" on public.tasks
  for insert to authenticated with check (private.can_create_tasks(household_id));

-- Wijzigen: beheerder, of als de taak van jou is, door jou is gemaakt of nog
-- niemand heeft. Welke velden een gezinslid mag wijzigen bewaakt de trigger.
create policy "tasks: wijzigen" on public.tasks
  for update to authenticated
  using (
    private.is_admin(household_id)
    or assigned_member_id is null
    or private.is_my_member(assigned_member_id)
    or private.is_my_member(created_by_member_id)
  )
  with check (private.is_member(household_id));

create policy "tasks: beheerder of maker verwijdert" on public.tasks
  for delete to authenticated
  using (private.is_admin(household_id) or private.is_my_member(created_by_member_id));

-- Een gezinslid mag een taak alleen aan een ander toewijzen als het huishouden
-- dat toestaat. Afvinken loopt via complete_task() zodat de historie klopt.
create or replace function private.guard_task_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_can_assign_others boolean;
  v_my_member uuid;
begin
  if (select auth.uid()) is null or private.is_admin(new.household_id) then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.household_id is distinct from old.household_id then
    raise exception 'Een taak kan niet naar een ander huishouden' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and (
       new.completed_at is distinct from old.completed_at
       or new.completed_by_member_id is distinct from old.completed_by_member_id
       or (new.status = 'done' and old.status <> 'done')
     ) and current_setting('takenlijstje.via_rpc', true) is distinct from 'on' then
    raise exception 'Gebruik complete_task() om een taak af te vinken' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' and new.status = 'done'
     and current_setting('takenlijstje.via_rpc', true) is distinct from 'on' then
    raise exception 'Nieuwe taak kan niet al voltooid zijn' using errcode = '42501';
  end if;

  if new.assigned_member_id is not null
     and (tg_op = 'INSERT' or new.assigned_member_id is distinct from old.assigned_member_id) then
    v_my_member := private.my_member_id(new.household_id);
    select h.members_can_assign_others into v_can_assign_others
    from public.households h where h.id = new.household_id;
    if new.assigned_member_id <> v_my_member and not coalesce(v_can_assign_others, false)
       and current_setting('takenlijstje.via_rpc', true) is distinct from 'on' then
      raise exception 'Je mag taken alleen aan jezelf toewijzen' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger tasks_guard
  before insert or update on public.tasks
  for each row execute function private.guard_task_changes();

-- -----------------------------------------------------------------------------
-- task_assignments (historie; alleen toevoegen)
-- -----------------------------------------------------------------------------
alter table public.task_assignments enable row level security;

create policy "assignments: leden lezen" on public.task_assignments
  for select to authenticated using (private.is_member(household_id));

create policy "assignments: leden registreren" on public.task_assignments
  for insert to authenticated
  with check (private.is_member(household_id) and (assigned_by_member_id is null or private.is_my_member(assigned_by_member_id)));

-- -----------------------------------------------------------------------------
-- task_swap_requests (overnemen gaat via accept_swap_request())
-- -----------------------------------------------------------------------------
alter table public.task_swap_requests enable row level security;

create policy "swaps: leden lezen" on public.task_swap_requests
  for select to authenticated using (private.is_member(household_id));

create policy "swaps: eigen verzoek indienen" on public.task_swap_requests
  for insert to authenticated
  with check (private.is_member(household_id) and private.is_my_member(requested_by_member_id) and status = 'open');

create policy "swaps: eigen verzoek intrekken" on public.task_swap_requests
  for update to authenticated
  using (private.is_my_member(requested_by_member_id) or private.is_admin(household_id))
  with check (status in ('open', 'cancelled'));

-- -----------------------------------------------------------------------------
-- task_completions: alleen lezen; schrijven uitsluitend via complete_task()
-- -----------------------------------------------------------------------------
alter table public.task_completions enable row level security;

create policy "completions: leden lezen" on public.task_completions
  for select to authenticated using (private.is_member(household_id));

-- -----------------------------------------------------------------------------
-- task_comments
-- -----------------------------------------------------------------------------
alter table public.task_comments enable row level security;

create policy "comments: leden lezen" on public.task_comments
  for select to authenticated using (private.is_member(household_id));

create policy "comments: plaatsen als jezelf" on public.task_comments
  for insert to authenticated
  with check (private.is_member(household_id) and private.is_my_member(member_id));

create policy "comments: eigen of beheerder verwijdert" on public.task_comments
  for delete to authenticated
  using (private.is_my_member(member_id) or private.is_admin(household_id));

-- -----------------------------------------------------------------------------
-- member_absences
-- -----------------------------------------------------------------------------
alter table public.member_absences enable row level security;

create policy "absences: leden lezen" on public.member_absences
  for select to authenticated using (private.is_member(household_id));

create policy "absences: eigen of beheerder beheert" on public.member_absences
  for all to authenticated
  using (private.is_admin(household_id) or private.is_my_member(member_id))
  with check (private.is_admin(household_id) or private.is_my_member(member_id));

-- -----------------------------------------------------------------------------
-- notifications: je ziet alleen je eigen meldingen
-- -----------------------------------------------------------------------------
alter table public.notifications enable row level security;

create policy "notifications: eigen lezen" on public.notifications
  for select to authenticated using (private.is_my_member(member_id));

create policy "notifications: eigen als gelezen markeren" on public.notifications
  for update to authenticated
  using (private.is_my_member(member_id))
  with check (private.is_my_member(member_id));

create policy "notifications: eigen verwijderen" on public.notifications
  for delete to authenticated using (private.is_my_member(member_id));

create policy "notifications: huisgenoten informeren" on public.notifications
  for insert to authenticated with check (private.is_member(household_id));

-- -----------------------------------------------------------------------------
-- push_subscriptions: alleen eigen apparaten
-- -----------------------------------------------------------------------------
alter table public.push_subscriptions enable row level security;

create policy "push: eigen abonnementen" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- user_preferences: alleen eigen instellingen
-- -----------------------------------------------------------------------------
alter table public.user_preferences enable row level security;

create policy "preferences: eigen instellingen" on public.user_preferences
  for all to authenticated
  using (private.is_my_member(member_id))
  with check (private.is_my_member(member_id) and private.is_member(household_id));

-- -----------------------------------------------------------------------------
-- Boodschappen: ieder gezinslid mag alles
-- -----------------------------------------------------------------------------
alter table public.shopping_lists enable row level security;

create policy "shopping_lists: leden" on public.shopping_lists
  for all to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));

alter table public.shopping_items enable row level security;

create policy "shopping_items: leden" on public.shopping_items
  for all to authenticated
  using (private.is_member(household_id))
  with check (private.is_member(household_id));
