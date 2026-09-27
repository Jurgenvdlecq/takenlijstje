-- =============================================================================
-- Takenlijstje – basisschema
--
-- Kernprincipes:
--  * Alles hangt aan een household_id; RLS (volgende migratie) zorgt dat een
--    gebruiker nooit gegevens van een ander huishouden ziet.
--  * Gezinsleden (household_members) staan los van inlogaccounts (users):
--    een kind zonder e-mailadres kan wel taken krijgen.
--  * Verwijzingen naar gezinsleden/taken zijn samengestelde foreign keys
--    (id, household_id), zodat een rij nooit naar een ander huishouden kan
--    verwijzen – ook niet via een gemanipuleerd verzoek.
--  * Terugkerende taken = een reeks (task_recurrences) + concrete taken
--    (tasks) die vooruit worden ingepland. Iedere uitvoering komt als
--    onveranderlijke regel in task_completions (historie).
-- =============================================================================

create schema if not exists private;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.member_role as enum ('admin', 'member');
create type public.task_status as enum ('todo', 'in_progress', 'done', 'skipped');
create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.assignment_strategy as enum ('none', 'fixed', 'rotation', 'random', 'fair');
create type public.absence_strategy as enum ('reassign', 'postpone', 'unassign');
create type public.notification_type as enum (
  'task_assigned', 'reminder', 'deadline_soon', 'overdue', 'task_completed',
  'daily_summary', 'evening_summary', 'swap_request', 'swap_accepted'
);

-- Categorieën als tekst + check: makkelijk uit te breiden zonder enum-migratie.
create domain public.task_category as text
  check (value in ('cleaning', 'laundry', 'groceries', 'kitchen', 'outdoor', 'pets', 'admin', 'other'));

create domain public.shopping_category as text
  check (value in ('produce', 'meat', 'dairy', 'bread', 'drinks', 'frozen', 'drugstore', 'household', 'other'));

create domain public.hex_color as text
  check (value ~ '^#[0-9a-fA-F]{6}$');

-- -----------------------------------------------------------------------------
-- Hulpfunctie: updated_at automatisch bijwerken
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- users: publiek profiel van een inlogaccount (1-op-1 met auth.users)
-- -----------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text check (char_length(display_name) between 1 and 50),
  created_at timestamptz not null default now()
);

-- Automatisch een profiel aanmaken bij registratie.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    new.email,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), 50), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- households
-- -----------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  timezone text not null default 'Europe/Amsterdam' check (char_length(timezone) between 1 and 64),
  -- Rechten voor gezinsleden (uitbreidbaar: nieuwe kolommen of later een permissions-tabel)
  members_can_create_tasks boolean not null default true,
  members_can_assign_others boolean not null default false,
  -- Optioneel puntensysteem
  points_enabled boolean not null default false,
  points_goal integer check (points_goal is null or points_goal between 1 and 100000),
  points_goal_reward text check (char_length(points_goal_reward) <= 120),
  onboarding_completed boolean not null default false,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger households_updated_at before update on public.households
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- household_members: een persoon binnen een huishouden (met of zonder account)
-- -----------------------------------------------------------------------------
create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 50),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  color public.hex_color not null default '#6366f1',
  icon text check (char_length(icon) <= 16),
  role public.member_role not null default 'member',
  is_active boolean not null default true,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (household_id, user_id),
  -- Doel voor samengestelde foreign keys
  unique (id, household_id)
);

create index household_members_user_idx on public.household_members (user_id);

-- -----------------------------------------------------------------------------
-- household_invitations: uitnodigen via e-mail / link
-- -----------------------------------------------------------------------------
create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- Optioneel: koppel de uitnodiging aan een al bestaand gezinslid (bijv. "Lynn")
  member_id uuid,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.member_role not null default 'member',
  -- 244 bits willekeur, geen extensie nodig
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invited_by_member_id uuid,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (member_id, household_id) references public.household_members (id, household_id) on delete cascade,
  foreign key (invited_by_member_id, household_id) references public.household_members (id, household_id) on delete set null (invited_by_member_id)
);

-- -----------------------------------------------------------------------------
-- task_templates: bibliotheek met standaardtaken
-- household_id null = globale bibliotheek, anders eigen sjabloon van huishouden
-- -----------------------------------------------------------------------------
create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade,
  slug text,
  category public.task_category not null default 'other',
  title text not null check (char_length(title) between 1 and 80),
  description text check (char_length(description) <= 1000),
  duration_minutes integer check (duration_minutes between 1 and 1440),
  points integer check (points between 0 and 100),
  -- Voorgestelde planning (zelfde vorm als task_recurrences.rule)
  default_rule jsonb,
  default_time time,
  icon text check (char_length(icon) <= 16),
  -- Zoekwoorden voor snelle invoer ("badkamer" → Badkamer schoonmaken)
  keywords text[] not null default '{}',
  popular boolean not null default false,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create unique index task_templates_global_slug_idx on public.task_templates (slug) where household_id is null;
create index task_templates_household_idx on public.task_templates (household_id);

-- -----------------------------------------------------------------------------
-- task_recurrences: definitie van een terugkerende taak (de "reeks")
-- -----------------------------------------------------------------------------
create table public.task_recurrences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  template_id uuid references public.task_templates (id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  description text check (char_length(description) <= 1000),
  category public.task_category not null default 'other',
  priority public.task_priority not null default 'normal',
  duration_minutes integer check (duration_minutes between 1 and 1440),
  points integer check (points between 0 and 100),
  -- Planningsregel, bijv. {"freq":"weekly","interval":2,"weekdays":[7]}
  -- Wordt server-side gevalideerd met zod (src/domain/recurrence).
  rule jsonb not null check (jsonb_typeof(rule) = 'object' and rule ? 'freq'),
  time_of_day time,
  -- Deadline-venster rond de geplande dag
  available_days_before smallint not null default 0 check (available_days_before between 0 and 30),
  due_days_after smallint not null default 0 check (due_days_after between 0 and 30),
  due_time time,
  starts_on date not null,
  ends_on date check (ends_on is null or ends_on >= starts_on),
  -- Tijdelijk pauzeren (bijv. gras maaien 1 nov – 1 mrt); daarna vanzelf hervat
  paused_from date,
  paused_until date check (paused_until is null or paused_from is null or paused_until >= paused_from),
  assignment_strategy public.assignment_strategy not null default 'none',
  fixed_member_id uuid,
  rotation_member_ids uuid[] not null default '{}',
  reminder_minutes_before integer[] not null default '{}',
  is_active boolean not null default true,
  -- Tot en met welke datum er al taken zijn ingepland
  generated_until date,
  created_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (fixed_member_id, household_id) references public.household_members (id, household_id) on delete set null (fixed_member_id),
  foreign key (created_by_member_id, household_id) references public.household_members (id, household_id) on delete set null (created_by_member_id),
  check (cardinality(reminder_minutes_before) <= 5)
);

create index task_recurrences_household_idx on public.task_recurrences (household_id) where is_active;

create trigger task_recurrences_updated_at before update on public.task_recurrences
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- tasks: concrete taak (eenmalig of één uitvoering van een reeks)
-- -----------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  recurrence_id uuid,
  -- Oorspronkelijke datum binnen de reeks (blijft gelijk als de taak wordt verplaatst)
  occurrence_date date,
  title text not null check (char_length(title) between 1 and 80),
  description text check (char_length(description) <= 1000),
  category public.task_category not null default 'other',
  priority public.task_priority not null default 'normal',
  status public.task_status not null default 'todo',
  assigned_member_id uuid,
  assignment_reason text check (assignment_reason in ('manual', 'fixed', 'rotation', 'random', 'fair', 'swap', 'absence')),
  scheduled_date date not null,
  scheduled_time time,
  available_from timestamptz,
  due_at timestamptz,
  duration_minutes integer check (duration_minutes between 1 and 1440),
  points integer check (points between 0 and 100),
  reminder_minutes_before integer[] not null default '{}',
  -- true = handmatig aangepast binnen een reeks; wordt niet overschreven bij herplannen
  is_exception boolean not null default false,
  completed_at timestamptz,
  completed_by_member_id uuid,
  created_by_member_id uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  -- Voorkomt dubbel inplannen van dezelfde uitvoering
  unique (recurrence_id, occurrence_date),
  foreign key (recurrence_id, household_id) references public.task_recurrences (id, household_id) on delete set null (recurrence_id),
  foreign key (assigned_member_id, household_id) references public.household_members (id, household_id) on delete set null (assigned_member_id),
  foreign key (completed_by_member_id, household_id) references public.household_members (id, household_id) on delete set null (completed_by_member_id),
  foreign key (created_by_member_id, household_id) references public.household_members (id, household_id) on delete set null (created_by_member_id),
  check (due_at is null or available_from is null or due_at >= available_from),
  check (cardinality(reminder_minutes_before) <= 5)
);

create index tasks_household_date_idx on public.tasks (household_id, scheduled_date) where deleted_at is null;
create index tasks_assigned_idx on public.tasks (assigned_member_id, status) where deleted_at is null;
create index tasks_open_due_idx on public.tasks (due_at) where status in ('todo', 'in_progress') and deleted_at is null;

create trigger tasks_updated_at before update on public.tasks
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- task_assignments: historie van (her)toewijzingen
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

-- -----------------------------------------------------------------------------
-- task_swap_requests: "Ik kan deze taak niet doen" → iemand anders neemt over
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- task_completions: onveranderlijke historie van iedere uitvoering
-- Blijft bestaan als de taak of reeks later wordt verwijderd (titel als snapshot).
-- -----------------------------------------------------------------------------
create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  task_id uuid,
  recurrence_id uuid,
  title text not null,
  category public.task_category not null default 'other',
  member_id uuid,
  completed_at timestamptz not null default now(),
  scheduled_date date,
  due_at timestamptz,
  was_late boolean not null default false,
  minutes_late integer not null default 0,
  points integer not null default 0,
  duration_minutes integer,
  note text check (char_length(note) <= 500),
  -- Idempotentie-sleutel: een offline afgevinkte taak telt nooit dubbel
  client_mutation_id uuid unique,
  created_at timestamptz not null default now(),
  foreign key (task_id, household_id) references public.tasks (id, household_id) on delete set null (task_id),
  foreign key (recurrence_id, household_id) references public.task_recurrences (id, household_id) on delete set null (recurrence_id),
  foreign key (member_id, household_id) references public.household_members (id, household_id) on delete set null (member_id)
);

create index task_completions_household_time_idx on public.task_completions (household_id, completed_at desc);
create index task_completions_task_idx on public.task_completions (task_id);
create index task_completions_recurrence_idx on public.task_completions (recurrence_id, completed_at desc);

-- -----------------------------------------------------------------------------
-- task_comments: notities bij een taak
-- -----------------------------------------------------------------------------
create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  task_id uuid not null,
  member_id uuid,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  foreign key (task_id, household_id) references public.tasks (id, household_id) on delete cascade,
  foreign key (member_id, household_id) references public.household_members (id, household_id) on delete set null (member_id)
);

create index task_comments_task_idx on public.task_comments (task_id, created_at);

-- -----------------------------------------------------------------------------
-- member_absences: afwezigheid / vakantie
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- notifications: in-app meldingen (en bron voor push)
-- -----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  member_id uuid not null,
  type public.notification_type not null,
  title text not null check (char_length(title) <= 120),
  body text check (char_length(body) <= 500),
  task_id uuid,
  url text check (url is null or url ~ '^/'),
  -- Voorkomt dubbele herinneringen (bijv. 'deadline:<task>:<due>')
  dedupe_key text,
  read_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (member_id, dedupe_key),
  foreign key (member_id, household_id) references public.household_members (id, household_id) on delete cascade,
  foreign key (task_id, household_id) references public.tasks (id, household_id) on delete set null (task_id)
);

create index notifications_member_idx on public.notifications (member_id, created_at desc);

-- -----------------------------------------------------------------------------
-- push_subscriptions: Web Push abonnementen per apparaat
-- -----------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- -----------------------------------------------------------------------------
-- user_preferences: meldingsinstellingen per gezinslid
-- -----------------------------------------------------------------------------
create table public.user_preferences (
  member_id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  push_enabled boolean not null default false,
  notify_task_assigned boolean not null default true,
  notify_reminders boolean not null default true,
  notify_deadline_soon boolean not null default true,
  notify_overdue boolean not null default true,
  notify_task_completed boolean not null default false,
  notify_swap_requests boolean not null default true,
  daily_summary_enabled boolean not null default true,
  daily_summary_time time not null default '07:30',
  evening_summary_enabled boolean not null default true,
  evening_summary_time time not null default '20:00',
  deadline_warning_minutes integer not null default 120 check (deadline_warning_minutes between 5 and 2880),
  updated_at timestamptz not null default now(),
  foreign key (member_id, household_id) references public.household_members (id, household_id) on delete cascade
);

create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function private.set_updated_at();

-- Ieder nieuw gezinslid krijgt standaard meldingsinstellingen
create or replace function private.create_member_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_preferences (member_id, household_id)
  values (new.id, new.household_id)
  on conflict (member_id) do nothing;
  return new;
end;
$$;

create trigger household_members_preferences
  after insert on public.household_members
  for each row execute function private.create_member_preferences();

-- -----------------------------------------------------------------------------
-- Boodschappen
-- -----------------------------------------------------------------------------
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null default 'Boodschappen' check (char_length(name) between 1 and 60),
  archived_at timestamptz,
  created_by_member_id uuid,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (created_by_member_id, household_id) references public.household_members (id, household_id) on delete set null (created_by_member_id)
);

create index shopping_lists_household_idx on public.shopping_lists (household_id, created_at desc);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid not null,
  name text not null check (char_length(name) between 1 and 80),
  quantity text check (char_length(quantity) <= 30),
  category public.shopping_category not null default 'other',
  note text check (char_length(note) <= 200),
  is_bought boolean not null default false,
  bought_at timestamptz,
  added_by_member_id uuid,
  bought_by_member_id uuid,
  created_at timestamptz not null default now(),
  foreign key (list_id, household_id) references public.shopping_lists (id, household_id) on delete cascade,
  foreign key (added_by_member_id, household_id) references public.household_members (id, household_id) on delete set null (added_by_member_id),
  foreign key (bought_by_member_id, household_id) references public.household_members (id, household_id) on delete set null (bought_by_member_id)
);

create index shopping_items_list_idx on public.shopping_items (list_id);
create index shopping_items_household_name_idx on public.shopping_items (household_id, lower(name));

-- -----------------------------------------------------------------------------
-- Integriteit: rotatielijst mag alleen gezinsleden van hetzelfde huishouden bevatten
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

-- Bij verwijderen van een gezinslid: uit rotatielijsten halen
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
