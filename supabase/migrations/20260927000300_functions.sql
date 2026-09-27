-- =============================================================================
-- Database-functies (RPC) voor acties die in één transactie moeten slagen
-- Alle functies controleren zelf het lidmaatschap (security definer).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Nieuw huishouden aanmaken; de maker wordt beheerder
-- -----------------------------------------------------------------------------
create or replace function public.create_household(
  p_name text,
  p_display_name text,
  p_color text default '#6366f1',
  p_icon text default null,
  p_timezone text default 'Europe/Amsterdam'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_household uuid;
  v_member uuid;
begin
  if v_user is null then
    raise exception 'Niet ingelogd' using errcode = '42501';
  end if;

  insert into public.users (id) values (v_user) on conflict (id) do nothing;

  insert into public.households (name, timezone, created_by)
  values (trim(p_name), coalesce(nullif(p_timezone, ''), 'Europe/Amsterdam'), v_user)
  returning id into v_household;

  insert into public.household_members (household_id, user_id, display_name, color, icon, role, email)
  select v_household, v_user, trim(p_display_name), coalesce(p_color, '#6366f1'), p_icon, 'admin', u.email
  from public.users u where u.id = v_user
  returning id into v_member;

  insert into public.shopping_lists (household_id, created_by_member_id) values (v_household, v_member);

  return v_household;
end;
$$;

-- -----------------------------------------------------------------------------
-- Uitnodiging accepteren
-- -----------------------------------------------------------------------------
create or replace function public.accept_invitation(p_token text, p_display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text;
  v_inv public.household_invitations%rowtype;
  v_member uuid;
begin
  if v_user is null then
    raise exception 'Niet ingelogd' using errcode = '42501';
  end if;

  select * into v_inv from public.household_invitations
  where token = p_token
  for update;

  if not found or v_inv.accepted_at is not null or v_inv.expires_at < now() then
    raise exception 'Uitnodiging is ongeldig of verlopen' using errcode = 'P0002';
  end if;

  select email into v_email from auth.users where id = v_user;
  if v_inv.email is not null and lower(v_inv.email) <> lower(coalesce(v_email, '')) then
    raise exception 'Deze uitnodiging is voor een ander e-mailadres' using errcode = '42501';
  end if;

  insert into public.users (id, email) values (v_user, v_email) on conflict (id) do nothing;

  -- Al lid? Dan alleen de uitnodiging afronden.
  select id into v_member from public.household_members
  where household_id = v_inv.household_id and user_id = v_user;

  if v_member is null and v_inv.member_id is not null then
    perform set_config('takenlijstje.via_rpc', 'on', true);
    update public.household_members
    set user_id = v_user, email = coalesce(email, v_email), role = v_inv.role
    where id = v_inv.member_id and user_id is null
    returning id into v_member;
    perform set_config('takenlijstje.via_rpc', 'off', true);
  end if;

  if v_member is null then
    insert into public.household_members (household_id, user_id, display_name, role, email)
    select v_inv.household_id, v_user,
           left(coalesce(nullif(trim(p_display_name), ''), u.display_name, split_part(v_email, '@', 1), 'Gezinslid'), 50),
           v_inv.role, v_email
    from public.users u where u.id = v_user
    returning id into v_member;
  end if;

  update public.household_invitations
  set accepted_at = now(), accepted_by = v_user
  where id = v_inv.id;

  return v_inv.household_id;
end;
$$;

-- Openbare info over een uitnodiging (naam huishouden + uitnodiger) voor de
-- welkomstpagina. Geeft niets terug bij een ongeldige token.
create or replace function public.get_invitation(p_token text)
returns table (household_name text, invited_by text, email text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select h.name, m.display_name, i.email, i.expires_at
  from public.household_invitations i
  join public.households h on h.id = i.household_id
  left join public.household_members m on m.id = i.invited_by_member_id
  where i.token = p_token and i.accepted_at is null and i.expires_at > now();
$$;

-- -----------------------------------------------------------------------------
-- Taak afvinken (idempotent)
--  * status → done, tijd en persoon registreren
--  * historie (task_completions) bijwerken, inclusief "te laat"
--  * dezelfde p_mutation_id levert nooit een tweede registratie op
-- Het inplannen van de volgende uitvoering gebeurt in de app-laag
-- (src/server/services/scheduling), waar de planningslogica woont.
-- -----------------------------------------------------------------------------
create or replace function public.complete_task(
  p_task_id uuid,
  p_mutation_id uuid,
  p_note text default null,
  p_completed_at timestamptz default null,
  p_completed_by uuid default null
)
returns public.task_completions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
  v_member uuid;
  v_by uuid;
  v_at timestamptz;
  v_completion public.task_completions%rowtype;
  v_minutes_late integer;
  v_points integer;
begin
  -- Idempotentie: bestaat deze mutatie al, geef hem terug
  select * into v_completion from public.task_completions where client_mutation_id = p_mutation_id;
  if found then
    if not private.is_member(v_completion.household_id) then
      raise exception 'Geen toegang' using errcode = '42501';
    end if;
    return v_completion;
  end if;

  select * into v_task from public.tasks where id = p_task_id and deleted_at is null for update;
  if not found then
    raise exception 'Taak niet gevonden' using errcode = 'P0002';
  end if;

  v_member := private.my_member_id(v_task.household_id);
  if v_member is null then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;

  -- Al voltooid (bijv. tegelijk door iemand anders)? Dan niet dubbel registreren.
  if v_task.status = 'done' then
    select * into v_completion from public.task_completions
    where task_id = v_task.id order by completed_at desc limit 1;
    if found then
      return v_completion;
    end if;
  end if;

  -- Afvinken namens een ander gezinslid (bijv. een kind zonder account) mag
  -- alleen binnen hetzelfde huishouden.
  v_by := coalesce(p_completed_by, v_member);
  if not exists (select 1 from public.household_members where id = v_by and household_id = v_task.household_id) then
    raise exception 'Onbekend gezinslid' using errcode = '23503';
  end if;

  -- Offline afgevinkt? Gebruik die tijd, maar nooit in de toekomst of > 7 dagen terug.
  v_at := least(greatest(coalesce(p_completed_at, now()), now() - interval '7 days'), now());

  v_minutes_late := case
    when v_task.due_at is not null and v_at > v_task.due_at
      then ceil(extract(epoch from (v_at - v_task.due_at)) / 60)::integer
    else 0
  end;

  -- Punten: expliciet, anders afgeleid van de duur (5 min = 1, 30 min = 3, 60 min = 6)
  v_points := coalesce(v_task.points, greatest(1, round(coalesce(v_task.duration_minutes, 10) / 10.0))::integer);

  insert into public.task_completions (
    household_id, task_id, recurrence_id, title, category, member_id, completed_at,
    scheduled_date, due_at, was_late, minutes_late, points, duration_minutes, note, client_mutation_id
  ) values (
    v_task.household_id, v_task.id, v_task.recurrence_id, v_task.title, v_task.category, v_by, v_at,
    v_task.scheduled_date, v_task.due_at, v_minutes_late > 0, v_minutes_late, v_points,
    v_task.duration_minutes, nullif(trim(p_note), ''), p_mutation_id
  )
  returning * into v_completion;

  perform set_config('takenlijstje.via_rpc', 'on', true);
  update public.tasks
  set status = 'done', completed_at = v_at, completed_by_member_id = v_by
  where id = v_task.id;
  perform set_config('takenlijstje.via_rpc', 'off', true);

  -- Openstaand ruilverzoek vervalt
  update public.task_swap_requests set status = 'cancelled', resolved_at = now()
  where task_id = v_task.id and status = 'open';

  return v_completion;
end;
$$;

-- -----------------------------------------------------------------------------
-- Afvinken ongedaan maken ("Taak voltooid — Ongedaan maken")
-- -----------------------------------------------------------------------------
create or replace function public.undo_complete_task(p_task_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
  v_member uuid;
begin
  select * into v_task from public.tasks where id = p_task_id and deleted_at is null for update;
  if not found then
    raise exception 'Taak niet gevonden' using errcode = 'P0002';
  end if;

  v_member := private.my_member_id(v_task.household_id);
  if v_member is null then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;

  if v_task.status <> 'done' then
    return v_task;
  end if;

  -- Terugdraaien mag: beheerder, degene die afvinkte, of iedereen als het
  -- namens een gezinslid zonder account (bijv. een kind) is afgevinkt.
  if not private.is_admin(v_task.household_id)
     and v_task.completed_by_member_id is distinct from v_member
     and not exists (
       select 1 from public.household_members m
       where m.id = v_task.completed_by_member_id and m.user_id is null
     ) then
    raise exception 'Alleen wie de taak afvinkte kan dit terugdraaien' using errcode = '42501';
  end if;

  delete from public.task_completions
  where id = (
    select id from public.task_completions
    where task_id = v_task.id order by completed_at desc limit 1
  );

  perform set_config('takenlijstje.via_rpc', 'on', true);
  update public.tasks
  set status = 'todo', completed_at = null, completed_by_member_id = null
  where id = v_task.id
  returning * into v_task;
  perform set_config('takenlijstje.via_rpc', 'off', true);

  return v_task;
end;
$$;

-- -----------------------------------------------------------------------------
-- Taak ruilen: verzoek overnemen
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Rechten: functies alleen voor ingelogde gebruikers
-- -----------------------------------------------------------------------------
revoke execute on function public.create_household(text, text, text, text, text) from public, anon;
revoke execute on function public.accept_invitation(text, text) from public, anon;
revoke execute on function public.complete_task(uuid, uuid, text, timestamptz, uuid) from public, anon;
revoke execute on function public.undo_complete_task(uuid) from public, anon;
revoke execute on function public.accept_swap_request(uuid) from public, anon;
revoke execute on function public.get_invitation(text) from public;

grant execute on function public.create_household(text, text, text, text, text) to authenticated;
grant execute on function public.accept_invitation(text, text) to authenticated;
grant execute on function public.complete_task(uuid, uuid, text, timestamptz, uuid) to authenticated;
grant execute on function public.undo_complete_task(uuid) to authenticated;
grant execute on function public.accept_swap_request(uuid) to authenticated;
grant execute on function public.get_invitation(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: wijzigingen direct zichtbaar bij andere gezinsleden (RLS geldt ook hier)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.tasks,
      public.task_completions,
      public.task_comments,
      public.task_swap_requests,
      public.notifications,
      public.shopping_items,
      public.shopping_lists,
      public.household_members;
  end if;
end;
$$;
