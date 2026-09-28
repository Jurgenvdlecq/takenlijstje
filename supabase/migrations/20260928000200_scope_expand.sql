-- =============================================================================
-- WP2a — Scopewijziging, stap "expand" (TECHNICAL_DESIGN §3.1, §3.2, §3.3, §6)
--
-- Niet-destructief en compatibel met de vorige code: er verdwijnt geen kolom
-- en geen tabel. Die stap volgt pas in WP2b (…_210), na back-up en na
-- bevestiging van Jurgen.
--
-- Inhoud:
--  * complete_task v2 (zonder persoon); de oude signatuur blijft tijdelijk en
--    negeert p_completed_by
--  * undo_complete_task: ieder actief lid (V-22)
--  * notities: author_name + triggers (V-34)
--  * standaardvoorkeuren per rol (V-23), ook eenmalig voor bestaande gezinsleden
--  * boodschappen: archive/unarchive als RPC (de unieke index "één actieve
--    lijst" volgt pas in …_210: de oude code maakt eerst een nieuwe lijst aan
--    en zou anders falen bij terugrollen tussen M2 en M6)
--  * create_household / accept_invitation met BR-44; tijdzone vast (V-39; de
--    check op de tabel volgt pas in …_210, om dezelfde reden)
--  * delete_household, delete_my_account
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Afvinken zonder persoon (BR-10…BR-12, V-21)
-- Eerst lidmaatschap zonder lock: een taak van een ander huishouden gedraagt
-- zich als een taak die niet bestaat (security-review WP1, N2).
-- -----------------------------------------------------------------------------
drop function if exists public.complete_task(uuid, uuid, text, timestamptz, uuid);

create or replace function public.complete_task(
  p_task_id uuid,
  p_mutation_id uuid,
  p_note text default null,
  p_completed_at timestamptz default null
)
returns public.task_completions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
  v_at timestamptz;
  v_completion public.task_completions%rowtype;
  v_minutes_late integer;
begin
  -- Idempotentie: bestaat deze mutatie al, geef hem terug
  select * into v_completion from public.task_completions where client_mutation_id = p_mutation_id;
  if found then
    if not private.is_member(v_completion.household_id) then
      raise exception 'Taak niet gevonden' using errcode = 'P0002';
    end if;
    return v_completion;
  end if;

  select * into v_task from public.tasks where id = p_task_id;
  if not found or v_task.deleted_at is not null or not private.is_member(v_task.household_id) then
    raise exception 'Taak niet gevonden' using errcode = 'P0002';
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or v_task.deleted_at is not null then
    raise exception 'Taak niet gevonden' using errcode = 'P0002';
  end if;

  -- Al gedaan (bijv. tegelijk door iemand anders)? Dan niet dubbel registreren.
  if v_task.status = 'done' then
    select * into v_completion from public.task_completions
    where task_id = v_task.id order by completed_at desc limit 1;
    if found then
      return v_completion;
    end if;
  end if;

  -- Offline afgevinkt? Gebruik die tijd, maar nooit in de toekomst of > 7 dagen terug.
  v_at := least(greatest(coalesce(p_completed_at, now()), now() - interval '7 days'), now());

  v_minutes_late := case
    when v_task.due_at is not null and v_at > v_task.due_at
      then ceil(extract(epoch from (v_at - v_task.due_at)) / 60)::integer
    else 0
  end;

  insert into public.task_completions (
    household_id, task_id, recurrence_id, title, category, completed_at,
    scheduled_date, due_at, was_late, minutes_late, duration_minutes, note, client_mutation_id
  ) values (
    v_task.household_id, v_task.id, v_task.recurrence_id, v_task.title, v_task.category, v_at,
    v_task.scheduled_date, v_task.due_at, v_minutes_late > 0, v_minutes_late,
    v_task.duration_minutes, nullif(trim(p_note), ''), p_mutation_id
  )
  returning * into v_completion;

  perform set_config('takenlijstje.via_rpc', 'on', true);
  update public.tasks
  set status = 'done', completed_at = v_at
  where id = v_task.id;
  perform set_config('takenlijstje.via_rpc', 'off', true);

  return v_completion;
end;
$$;

-- Oude signatuur, alleen zolang de vorige code nog kan draaien (terugrollen
-- tussen M2 en M6). p_completed_by staat nu als verplichte parameter op de
-- derde plek: aanroepen met namen blijven werken, en een aanroep zonder
-- p_completed_by kiest altijd de nieuwe functie (geen dubbelzinnigheid in
-- PostgREST). De persoon wordt genegeerd. Vervalt in …_210.
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

-- -----------------------------------------------------------------------------
-- Terugdraaien: ieder actief lid, ook later (BR-13, V-22)
-- -----------------------------------------------------------------------------
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
  if not found or v_task.deleted_at is not null then
    raise exception 'Taak niet gevonden' using errcode = 'P0002';
  end if;
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

-- -----------------------------------------------------------------------------
-- Notities: laatst bekende naam van de schrijver (V-25, V-34; §3.1)
-- -----------------------------------------------------------------------------
alter table public.task_comments add column if not exists author_name text;

update public.task_comments c
set author_name = coalesce(
  (select m.display_name from public.household_members m where m.id = c.member_id),
  'Gezinslid'
)
where c.author_name is null;

alter table public.task_comments alter column author_name set not null;
alter table public.task_comments
  add constraint task_comments_author_name_length check (char_length(author_name) between 1 and 50);

-- Altijd gezet door de database; een meegestuurde waarde wordt genegeerd
create or replace function private.set_comment_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.author_name := coalesce(
    (select m.display_name from public.household_members m
     where m.id = new.member_id and m.household_id = new.household_id),
    'Gezinslid'
  );
  return new;
end;
$$;

drop trigger if exists task_comments_set_author on public.task_comments;
create trigger task_comments_set_author
  before insert on public.task_comments
  for each row execute function private.set_comment_author();

-- Een notitie is onveranderlijk. Alleen vanuit een andere trigger of een
-- FK-actie (diepte > 1) mogen twee dingen: de naam bijwerken bij een gelijk
-- member_id, en member_id leegmaken (lid of account verdwenen).
create or replace function private.guard_comment_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null and pg_trigger_depth() = 1 then
    return new;
  end if;
  if pg_trigger_depth() > 1
     and new.id = old.id
     and new.household_id = old.household_id
     and new.task_id is not distinct from old.task_id
     and new.body = old.body
     and new.created_at = old.created_at
     and (
       (new.member_id is not distinct from old.member_id)
       or (new.member_id is null and new.author_name = old.author_name)
     ) then
    return new;
  end if;
  raise exception 'Een notitie kan niet worden gewijzigd' using errcode = '42501';
end;
$$;

drop trigger if exists task_comments_guard on public.task_comments;
create trigger task_comments_guard
  before update on public.task_comments
  for each row execute function private.guard_comment_changes();

create or replace function private.sync_comment_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.task_comments
  set author_name = new.display_name
  where member_id = new.id and household_id = new.household_id and author_name is distinct from new.display_name;
  return new;
end;
$$;

drop trigger if exists household_members_sync_comment_author on public.household_members;
create trigger household_members_sync_comment_author
  after update of display_name on public.household_members
  for each row execute function private.sync_comment_author();

-- -----------------------------------------------------------------------------
-- Standaardvoorkeuren per rol (V-23, §3.3)
-- -----------------------------------------------------------------------------
create or replace function private.create_member_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_on boolean := new.role = 'admin';
begin
  insert into public.user_preferences (
    member_id, household_id,
    notify_reminders, notify_deadline_soon, notify_overdue,
    daily_summary_enabled, evening_summary_enabled, notify_task_completed
  )
  values (new.id, new.household_id, v_on, v_on, v_on, v_on, v_on, false)
  on conflict (member_id) do nothing;
  return new;
end;
$$;

-- Eenmalig: bestaande gezinsleden krijgen de nieuwe standaard (AC-053).
-- Beheerders blijven ongewijzigd.
update public.user_preferences p
set notify_reminders = false,
    notify_deadline_soon = false,
    notify_overdue = false,
    daily_summary_enabled = false,
    evening_summary_enabled = false,
    notify_task_completed = false
from public.household_members m
where m.id = p.member_id and m.role = 'member';

-- -----------------------------------------------------------------------------
-- Boodschappen: archiveren idempotent (BR-42, R-03). De rijlock op p_list_id
-- maakt dubbel archiveren veilig; de unieke index volgt in …_210.
-- -----------------------------------------------------------------------------

create or replace function public.archive_shopping_list(p_list_id uuid)
returns public.shopping_lists
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_list public.shopping_lists%rowtype;
  v_new public.shopping_lists%rowtype;
begin
  select * into v_list from public.shopping_lists where id = p_list_id;
  if not found or not private.is_member(v_list.household_id) then
    raise exception 'Lijst niet gevonden' using errcode = 'P0002';
  end if;

  select * into v_list from public.shopping_lists where id = p_list_id for update;

  -- Al gearchiveerd (tweede tik, of tegelijk door iemand anders): de actieve lijst terug
  if v_list.archived_at is not null then
    select * into v_new from public.shopping_lists
    where household_id = v_list.household_id and archived_at is null;
    if not found then
      insert into public.shopping_lists (household_id) values (v_list.household_id)
      returning * into v_new;
    end if;
    return v_new;
  end if;

  update public.shopping_lists set archived_at = now() where id = v_list.id;

  insert into public.shopping_lists (household_id, name) values (v_list.household_id, v_list.name)
  returning * into v_new;

  update public.shopping_items
  set list_id = v_new.id
  where list_id = v_list.id and household_id = v_list.household_id and not is_bought;

  return v_new;
end;
$$;

-- "Lijst afgerond · Ongedaan maken" (UX §4.8): alleen de laatst afgeronde lijst
create or replace function public.unarchive_shopping_list(p_archived_list_id uuid)
returns public.shopping_lists
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.shopping_lists%rowtype;
  v_active public.shopping_lists%rowtype;
begin
  select * into v_old from public.shopping_lists where id = p_archived_list_id;
  if not found or not private.is_member(v_old.household_id) then
    raise exception 'Lijst niet gevonden' using errcode = 'P0002';
  end if;

  select * into v_old from public.shopping_lists where id = p_archived_list_id for update;
  if v_old.archived_at is null then
    return v_old;
  end if;

  if exists (
    select 1 from public.shopping_lists
    where household_id = v_old.household_id and archived_at > v_old.archived_at
  ) then
    raise exception 'Deze lijst kan niet meer worden teruggezet' using errcode = 'P0001';
  end if;

  select * into v_active from public.shopping_lists
  where household_id = v_old.household_id and archived_at is null
  for update;

  if found then
    update public.shopping_items
    set list_id = v_old.id
    where list_id = v_active.id and household_id = v_old.household_id;
    delete from public.shopping_lists where id = v_active.id;
  end if;

  update public.shopping_lists set archived_at = null where id = v_old.id
  returning * into v_old;
  return v_old;
end;
$$;

-- -----------------------------------------------------------------------------
-- Eén huishouden per persoon (BR-44); tijdzone vast (V-39). De advisory lock per
-- gebruiker voorkomt dat een dubbeltik twee lidmaatschappen maakt, tot
-- unique (user_id) in …_210 bestaat.
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
begin
  if v_user is null then
    raise exception 'Niet ingelogd' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('takenlijstje.lid:' || v_user::text));
  if exists (select 1 from public.household_members where user_id = v_user) then
    raise exception 'Je hoort al bij een ander huishouden. Je kunt maar bij één huishouden horen.'
      using errcode = 'P0001';
  end if;

  insert into public.users (id) values (v_user) on conflict (id) do nothing;

  -- p_timezone wordt genegeerd (V-39)
  insert into public.households (name, timezone, created_by)
  values (trim(p_name), 'Europe/Amsterdam', v_user)
  returning id into v_household;

  insert into public.household_members (household_id, user_id, display_name, color, icon, role)
  values (v_household, v_user, trim(p_display_name), coalesce(p_color, '#6366f1'), p_icon, 'admin');

  insert into public.shopping_lists (household_id) values (v_household);

  return v_household;
end;
$$;

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
begin
  if v_user is null then
    raise exception 'Niet ingelogd' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('takenlijstje.lid:' || v_user::text));

  select * into v_inv from public.household_invitations
  where token = p_token
  for update;

  if not found then
    raise exception 'Uitnodiging is ongeldig of verlopen' using errcode = 'P0002';
  end if;

  select email into v_email from auth.users where id = v_user;

  -- Al lid van dit huishouden? Dan geen tweede lidrij. De uitnodiging wordt
  -- alleen afgerond als hij voor deze persoon geldig is, zodat een beheerder
  -- die zijn eigen link test, hem niet verbruikt voor de echte ontvanger.
  if exists (
    select 1 from public.household_members
    where household_id = v_inv.household_id and user_id = v_user
  ) then
    if v_inv.accepted_at is null and v_inv.expires_at >= now()
       and (v_inv.email is null or lower(v_inv.email) = lower(coalesce(v_email, ''))) then
      update public.household_invitations
      set accepted_at = now(), accepted_by = v_user
      where id = v_inv.id;
    end if;
    return v_inv.household_id;
  end if;

  if v_inv.accepted_at is not null or v_inv.expires_at < now() then
    raise exception 'Uitnodiging is ongeldig of verlopen' using errcode = 'P0002';
  end if;

  if v_inv.email is not null and lower(v_inv.email) <> lower(coalesce(v_email, '')) then
    raise exception 'Deze uitnodiging is voor een ander e-mailadres. Log in met dat adres of vraag een nieuwe link.'
      using errcode = '42501';
  end if;

  if exists (select 1 from public.household_members where user_id = v_user) then
    raise exception 'Je hoort al bij een ander huishouden. Je kunt maar bij één huishouden horen.'
      using errcode = 'P0001';
  end if;

  insert into public.users (id, email) values (v_user, v_email) on conflict (id) do nothing;

  insert into public.household_members (household_id, user_id, display_name, role)
  select v_inv.household_id, v_user,
         left(coalesce(nullif(trim(p_display_name), ''), u.display_name, split_part(v_email, '@', 1), 'Gezinslid'), 50),
         v_inv.role
  from public.users u where u.id = v_user;

  update public.household_invitations
  set accepted_at = now(), accepted_by = v_user
  where id = v_inv.id;

  return v_inv.household_id;
end;
$$;

-- Verwijderen alleen via de RPC hieronder (met naambevestiging, TD §3.1); geen
-- oude of nieuwe code verwijdert een huishouden rechtstreeks
drop policy if exists "households: beheerder verwijdert" on public.households;

-- -----------------------------------------------------------------------------
-- Huishouden verwijderen (UC-12, §4.6): alleen een actieve beheerder, met de
-- exacte naam als bevestiging. Alles gaat mee door cascade.
-- -----------------------------------------------------------------------------
create or replace function public.delete_household(p_confirm_name text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.household_members%rowtype;
  v_name text;
begin
  select * into v_member from public.household_members
  where user_id = (select auth.uid()) and is_active
  order by created_at limit 1;
  if not found then
    raise exception 'Huishouden niet gevonden' using errcode = 'P0002';
  end if;
  if v_member.role <> 'admin' then
    raise exception 'Alleen een beheerder mag het huishouden verwijderen' using errcode = '42501';
  end if;

  select name into v_name from public.households where id = v_member.household_id for update;
  if v_name is distinct from p_confirm_name then
    raise exception 'De naam klopt niet. Typ de naam van het huishouden precies over.' using errcode = 'P0001';
  end if;

  delete from public.households where id = v_member.household_id;
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Eigen lidmaatschap opheffen vóór het verwijderen van het account (§4.5).
-- Zoekt op user_id: ook een uitgezet lid mag zijn account verwijderen.
-- Geen lidmaatschap → no-op.
-- -----------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.household_members%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Niet ingelogd' using errcode = '42501';
  end if;

  select * into v_member from public.household_members
  where user_id = (select auth.uid())
  for update;
  if not found then
    return true;
  end if;

  -- Het huishouden locken vóór de telling: twee beheerders die tegelijk hun
  -- account opheffen, kunnen het huishouden zo niet zonder beheerder laten
  perform 1 from public.households where id = v_member.household_id for update;

  if v_member.role = 'admin' and v_member.is_active and not exists (
    select 1 from public.household_members
    where household_id = v_member.household_id and role = 'admin' and is_active and id <> v_member.id
  ) then
    raise exception 'Je bent de enige beheerder. Maak eerst iemand anders beheerder, of verwijder het huishouden.'
      using errcode = 'P0001';
  end if;

  perform set_config('takenlijstje.via_rpc', 'on', true);
  delete from public.household_members where id = v_member.id;
  perform set_config('takenlijstje.via_rpc', 'off', true);
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Rechten
-- -----------------------------------------------------------------------------
revoke execute on function
  public.complete_task(uuid, uuid, text, timestamptz),
  public.complete_task(uuid, uuid, uuid, text, timestamptz),
  public.archive_shopping_list(uuid),
  public.unarchive_shopping_list(uuid),
  public.delete_household(text),
  public.delete_my_account()
from public, anon;

grant execute on function
  public.complete_task(uuid, uuid, text, timestamptz),
  public.complete_task(uuid, uuid, uuid, text, timestamptz),
  public.archive_shopping_list(uuid),
  public.unarchive_shopping_list(uuid),
  public.delete_household(text)
to authenticated;

-- delete_my_account hoort bij "Account verwijderen" (wachtwoordcheck + het
-- account zelf, TECHNICAL_DESIGN §4.5) en gaat pas in WP7 open. Tot dan kan
-- niemand via de API zijn lidmaatschap los opheffen (security-review WP2a, 3).
revoke execute on function public.delete_my_account() from authenticated;

-- Nieuwe functies in "private" (triggers) zijn niet aanroepbaar (B-04, AC-028)
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
