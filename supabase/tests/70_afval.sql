-- =============================================================================
-- Tests: WP3b — Afvalkalender (W-03), migraties …_320 en …_330
-- (TECHNICAL_DESIGN §18.3, §18.5, §18.7, §18.10, tabel §18.15 kolom "DB";
--  ACCEPTANCE_CRITERIA AC-189, AC-190, AC-192, AC-197, AC-198, AC-201, AC-202,
--  AC-204, AC-205, AC-207, AC-208, AC-209, AC-213, AC-214, AC-215, AC-216,
--  AC-219, AC-236)
-- Draait ná 10_ … 60_ in dezelfde database, met eigen accounts en huishoudens.
-- Races (waste_save 2× parallel, claim 2× binnen 60 s) staan in gelijktijdig.sh.
-- Iedere fout stopt het script (ON_ERROR_STOP), dus "geen output" = geslaagd.
-- =============================================================================

\o /dev/null

-- -----------------------------------------------------------------------------
-- Hulpfuncties
-- -----------------------------------------------------------------------------
create or replace function pg_temp.expect_sqlstate(p_sql text, p_state text, p_label text)
returns void language plpgsql as $$
declare
  v_state text;
  v_msg text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    if v_state <> p_state then
      raise exception 'VERKEERDE FOUT bij %: verwacht %, kreeg % (%)', p_label, p_state, v_state, v_msg;
    end if;
    return;
  end;
  raise exception 'VERWACHTE FOUT % BLEEF UIT: %', p_state, p_label;
end;
$$;

create or replace function pg_temp.assert(p_condition boolean, p_label text)
returns void language plpgsql as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'ASSERT MISLUKT: %', p_label;
  end if;
end;
$$;

create or replace function pg_temp.rows(p_sql text)
returns integer language plpgsql as $$
declare
  v_count integer;
begin
  execute p_sql;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function pg_temp.als(p_user uuid)
returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, false);
$$;

create or replace function pg_temp.systeem()
returns void language sql as $$
  select set_config('request.jwt.claims', '', false);
$$;

-- Lezen ongeacht RLS (eigenaar is de superuser)
create or replace function pg_temp.taak(p_id uuid)
returns public.tasks language sql security definer as $$
  select * from public.tasks where id = p_id;
$$;
create or replace function pg_temp.kal(p_household uuid)
returns public.waste_calendars language sql security definer as $$
  select * from public.waste_calendars where household_id = p_household;
$$;
create or replace function pg_temp.kal_bestaat(p_household uuid)
returns boolean language sql security definer as $$
  select exists (select 1 from public.waste_calendars where household_id = p_household);
$$;
create or replace function pg_temp.afvaltaken(p_household uuid, p_statuses text[] default array['todo','in_progress','done','skipped'])
returns integer language sql security definer as $$
  select count(*)::integer from public.tasks
  where household_id = p_household and waste_direction is not null and status::text = any (p_statuses);
$$;
create or replace function pg_temp.afvaltaak_id(p_household uuid, p_date date, p_dir text)
returns uuid language sql security definer as $$
  select id from public.tasks where household_id = p_household and waste_pickup_date = p_date and waste_direction = p_dir;
$$;
create or replace function pg_temp.notities(p_task uuid)
returns integer language sql security definer as $$
  select count(*)::integer from public.task_comments where task_id = p_task;
$$;
create or replace function pg_temp.afvinkingen(p_task uuid)
returns integer language sql security definer as $$
  select count(*)::integer from public.task_completions where task_id = p_task;
$$;

-- Eén afvaltaak zoals plan.ts die als jsonb aan de RPC geeft (§18.4.2)
create or replace function pg_temp.nieuw(p_date date, p_dir text, p_streams text[], p_title text default null)
returns jsonb language sql as $$
  select jsonb_build_object(
    'title', coalesce(p_title, case when p_dir = 'out' then 'Afval buitenzetten' else 'Afvalbak binnenzetten' end),
    'scheduled_date', case when p_dir = 'out' then p_date - 1 else p_date end,
    'scheduled_time', case when p_dir = 'out' then '21:00' else null end,
    'available_from', case when p_dir = 'in' then (p_date + time '12:00') at time zone 'Europe/Amsterdam' else null end,
    'due_at', case when p_dir = 'out' then (p_date + time '07:45') at time zone 'Europe/Amsterdam'
                   else ((p_date + 1) + time '00:00') at time zone 'Europe/Amsterdam' end,
    'waste_pickup_date', p_date,
    'waste_direction', p_dir,
    'waste_streams', to_jsonb(p_streams));
$$;
-- Verschuiving naar een andere dag: dezelfde velden + id en richting
create or replace function pg_temp.verschuif(p_id uuid, p_date date, p_dir text, p_streams text[])
returns jsonb language sql as $$
  select pg_temp.nieuw(p_date, p_dir, p_streams, 'Verschoven') || jsonb_build_object('id', p_id, 'direction', p_dir);
$$;

grant execute on all functions in schema pg_temp to authenticated;

-- -----------------------------------------------------------------------------
-- Testdata: Jurgen en Ellen (beheerders), Lynn (gezinslid), Kai (uitgezet
-- gezinslid), Oud (uitgezette beheerder); Bas met een eigen huishouden.
-- -----------------------------------------------------------------------------
\set u_jurgen '70000000-0000-0000-0000-0000000000c1'
\set u_ellen  '70000000-0000-0000-0000-0000000000c2'
\set u_lynn   '70000000-0000-0000-0000-0000000000c3'
\set u_kai    '70000000-0000-0000-0000-0000000000c4'
\set u_bas    '70000000-0000-0000-0000-0000000000c5'
\set u_oud    '70000000-0000-0000-0000-0000000000c6'
\set bag1 '0518200000000001'
\set bag2 '0518200000000002'

insert into auth.users (id, email, raw_user_meta_data) values
  (:'u_jurgen', 'jurgen.afval@example.com', '{"display_name":"Jurgen"}'),
  (:'u_ellen',  'ellen.afval@example.com',  '{"display_name":"Ellen"}'),
  (:'u_lynn',   'lynn.afval@example.com',   '{"display_name":"Lynn"}'),
  (:'u_kai',    'kai.afval@example.com',    '{"display_name":"Kai"}'),
  (:'u_bas',    'bas.afval@example.com',    '{"display_name":"Bas"}'),
  (:'u_oud',    'oud.afval@example.com',    '{"display_name":"Oud"}');

set role authenticated;
select pg_temp.als(:'u_jurgen');
select public.create_household('Familie Afval', 'Jurgen') as fam \gset
select id as jurgen from public.household_members where user_id = :'u_jurgen' \gset
insert into public.household_invitations (household_id, email, role, invited_by_member_id) values
  (:'fam', 'ellen.afval@example.com', 'admin',  :'jurgen'),
  (:'fam', 'lynn.afval@example.com',  'member', :'jurgen'),
  (:'fam', 'kai.afval@example.com',   'member', :'jurgen'),
  (:'fam', 'oud.afval@example.com',   'admin',  :'jurgen');
select token as tok_ellen from public.household_invitations where email = 'ellen.afval@example.com' \gset
select token as tok_lynn  from public.household_invitations where email = 'lynn.afval@example.com' \gset
select token as tok_kai   from public.household_invitations where email = 'kai.afval@example.com' \gset
select token as tok_oud   from public.household_invitations where email = 'oud.afval@example.com' \gset
select pg_temp.als(:'u_ellen'); select public.accept_invitation(:'tok_ellen', 'Ellen');
select pg_temp.als(:'u_lynn');  select public.accept_invitation(:'tok_lynn', 'Lynn');
select pg_temp.als(:'u_kai');   select public.accept_invitation(:'tok_kai', 'Kai');
select pg_temp.als(:'u_oud');   select public.accept_invitation(:'tok_oud', 'Oud');
select pg_temp.als(:'u_jurgen');
select id as ellen from public.household_members where user_id = :'u_ellen' \gset
select id as lynn  from public.household_members where user_id = :'u_lynn' \gset
select id as kai   from public.household_members where user_id = :'u_kai' \gset
select id as oud   from public.household_members where user_id = :'u_oud' \gset
-- Een handmatige taak en een handmatige reeks (AC-215: blijven ongemoeid)
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'fam', 'Container schoonmaken', current_date + 2, :'jurgen') returning id as t_hand \gset
insert into public.task_recurrences (household_id, title, rule, starts_on, created_by_member_id)
values (:'fam', 'Afvalcontainer buiten zetten', '{"freq":"weekly","interval":1,"byweekday":[0]}', current_date, :'jurgen')
returning id as r_hand \gset

select pg_temp.als(:'u_bas');
select public.create_household('Buren Afval', 'Bas') as buren \gset
select id as bas from public.household_members where user_id = :'u_bas' \gset

reset role;
select pg_temp.systeem();
update public.household_members set is_active = false where id in (:'kai', :'oud');

-- =============================================================================
-- Schema: meldingstype, kolommen, checks en sleutel (§18.3)
-- =============================================================================
select pg_temp.assert(exists (select 1 from pg_enum where enumtypid = 'public.notification_type'::regtype and enumlabel = 'waste_sync_failed'),
  '§18.3.3: notification_type kent waste_sync_failed');
select pg_temp.assert((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'tasks'
                       and column_name in ('waste_pickup_date', 'waste_direction', 'waste_streams') and is_nullable = 'YES'
                       and column_default is null) = 3,
  '§18.3.2: drie nullable kolommen zonder standaardwaarde op tasks');
select pg_temp.assert(not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'waste_calendars'),
  '§18.5.1: waste_calendars niet in Realtime');
select pg_temp.assert((select relrowsecurity from pg_class where oid = 'public.waste_calendars'::regclass),
  'V-53: RLS staat aan op waste_calendars');
select pg_temp.assert((select count(*) from pg_policies where schemaname = 'public' and tablename = 'waste_calendars') = 1
                      and (select cmd from pg_policies where schemaname = 'public' and tablename = 'waste_calendars') = 'SELECT',
  'V-53: precies één policy op waste_calendars, alleen select');

-- Vorm van een afvaltaak (tasks_waste_shape)
select pg_temp.expect_sqlstate(format($$insert into public.tasks (household_id, title, scheduled_date, waste_direction)
  values (%L, 'Half', current_date, 'out')$$, :'fam'), '23514', 'tasks_waste_shape: alleen een richting');
select pg_temp.expect_sqlstate(format($$insert into public.tasks (household_id, title, scheduled_date, waste_pickup_date, waste_direction, waste_streams)
  values (%L, 'GFT', current_date, current_date, 'out', array['gft'])$$, :'fam'), '23514', 'tasks_waste_shape: alleen rest/papier/pmd (AC-196)');
select pg_temp.expect_sqlstate(format($$insert into public.tasks (household_id, title, scheduled_date, waste_pickup_date, waste_direction, waste_streams)
  values (%L, 'Leeg', current_date, current_date, 'out', array[]::text[])$$, :'fam'), '23514', 'tasks_waste_shape: minstens één bak');
select pg_temp.expect_sqlstate(format($$insert into public.tasks (household_id, title, scheduled_date, waste_pickup_date, waste_direction, waste_streams)
  values (%L, 'Zijwaarts', current_date, current_date, 'side', array['rest'])$$, :'fam'), '23514', 'tasks_waste_shape: richting out of in');
select pg_temp.expect_sqlstate(format($$insert into public.tasks (household_id, title, scheduled_date, recurrence_id, occurrence_date, waste_pickup_date, waste_direction, waste_streams)
  values (%L, 'Reeks', current_date, %L, current_date, current_date, 'out', array['rest'])$$, :'fam', :'r_hand'), '23514',
  'tasks_waste_shape: een afvaltaak hoort nooit bij een reeks');
-- AC-197 (DB): de sleutel (huishouden, ophaaldag, richting) is uniek
insert into public.tasks (household_id, title, scheduled_date, waste_pickup_date, waste_direction, waste_streams)
values (:'buren', 'Sleutel', current_date + 40, current_date + 40, 'in', array['rest']);
select pg_temp.expect_sqlstate(format($$insert into public.tasks (household_id, title, scheduled_date, waste_pickup_date, waste_direction, waste_streams)
  values (%L, 'Sleutel 2', current_date + 40, current_date + 40, 'in', array['papier'])$$, :'buren'), '23505',
  'AC-197: tweede afvaltaak voor dezelfde dag en richting kan niet');
delete from public.tasks where household_id = :'buren' and waste_direction is not null;

-- =============================================================================
-- Rechten op functies (AC-189, §18.5.1, §18.7)
-- =============================================================================
select pg_temp.assert(not has_function_privilege('authenticated', 'public.waste_save(uuid,uuid,text,integer,text,text,jsonb,jsonb,timestamptz)', 'execute'),
  'AC-189: authenticated mag waste_save niet aanroepen');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.waste_sync(uuid,bigint,text,text,jsonb,uuid[],jsonb,jsonb,jsonb,timestamptz)', 'execute'),
  'AC-189: authenticated mag waste_sync niet aanroepen');
select pg_temp.assert(not has_function_privilege('anon', 'public.waste_save(uuid,uuid,text,integer,text,text,jsonb,jsonb,timestamptz)', 'execute')
                      and not has_function_privilege('anon', 'public.waste_sync(uuid,bigint,text,text,jsonb,uuid[],jsonb,jsonb,jsonb,timestamptz)', 'execute')
                      and not has_function_privilege('anon', 'public.disable_waste_calendar()', 'execute')
                      and not has_function_privilege('anon', 'public.waste_calendar_enabled()', 'execute'),
  'AC-189: anon mag geen enkele afvalfunctie aanroepen');
select pg_temp.assert(has_function_privilege('service_role', 'public.waste_save(uuid,uuid,text,integer,text,text,jsonb,jsonb,timestamptz)', 'execute')
                      and has_function_privilege('service_role', 'public.waste_sync(uuid,bigint,text,text,jsonb,uuid[],jsonb,jsonb,jsonb,timestamptz)', 'execute'),
  '§18.7: service_role mag waste_save en waste_sync');
select pg_temp.assert(has_function_privilege('authenticated', 'public.disable_waste_calendar()', 'execute')
                      and has_function_privilege('authenticated', 'public.waste_calendar_enabled()', 'execute'),
  '§18.7: authenticated mag disable_waste_calendar en waste_calendar_enabled');
select pg_temp.assert(not has_function_privilege('authenticated', 'private.waste_insert_tasks(uuid,jsonb)', 'execute')
                      and not has_function_privilege('authenticated', 'private.waste_skip_cascade()', 'execute'),
  '§18.3.4: private afvalfuncties niet aanroepbaar voor authenticated');
select pg_temp.assert(has_function_privilege('authenticated', 'private.is_admin(uuid)', 'execute')
                      and has_function_privilege('authenticated', 'private.can_delete_task(uuid,uuid)', 'execute'),
  '§18.3.4: de RLS-helpers blijven aanroepbaar (patroon _110)');
-- Tabelrechten (AC-189, AC-205 DB: authenticated kan geen enkele kolom schrijven)
select pg_temp.assert(not has_table_privilege('authenticated', 'public.waste_calendars', 'insert')
                      and not has_table_privilege('authenticated', 'public.waste_calendars', 'update')
                      and not has_table_privilege('authenticated', 'public.waste_calendars', 'delete')
                      and not has_column_privilege('authenticated', 'public.waste_calendars', 'last_failure_at', 'update')
                      and not has_column_privilege('authenticated', 'public.waste_calendars', 'alarm_since', 'update')
                      and not has_column_privilege('authenticated', 'public.waste_calendars', 'last_attempt_at', 'update'),
  'AC-205: authenticated kan waste_calendars (ook last_failure_at, alarm_since, last_attempt_at) niet schrijven');
select pg_temp.assert(not has_table_privilege('anon', 'public.waste_calendars', 'select'),
  'AC-190: anon kan waste_calendars niet lezen');

-- =============================================================================
-- waste_save (§18.7; AC-214, AC-215, AC-219): adres aanzetten
-- =============================================================================
-- Hercontrole: alleen een actieve beheerder van dit huishouden (AC-189)
select pg_temp.expect_sqlstate(format($$select public.waste_save(%L, %L, '2511AB', 12, '', %L, '{"rest":[],"papier":[],"pmd":[]}', '[]', now())$$,
  :'fam', :'lynn', :'bag1'), '42501', 'AC-189: waste_save met een gezinslid als p_member_id');
select pg_temp.expect_sqlstate(format($$select public.waste_save(%L, %L, '2511AB', 12, '', %L, '{"rest":[],"papier":[],"pmd":[]}', '[]', now())$$,
  :'fam', :'oud', :'bag1'), '42501', 'AC-189: waste_save met een uitgezette beheerder');
select pg_temp.expect_sqlstate(format($$select public.waste_save(%L, %L, '2511AB', 12, '', %L, '{"rest":[],"papier":[],"pmd":[]}', '[]', now())$$,
  :'fam', :'bas', :'bag1'), '42501', 'AC-189: waste_save met een beheerder van een ander huishouden');
select pg_temp.assert(not pg_temp.kal_bestaat(:'fam') and pg_temp.afvaltaken(:'fam') = 0,
  'AC-189: een geweigerde waste_save laat niets achter');

-- Aanzetten: dag +3 (rest) en +5 (rest+papier), elk buiten en binnen
select public.waste_save(:'fam', :'jurgen', '2511AB', 12, 'A', :'bag1',
  jsonb_build_object('rest', jsonb_build_array(current_date + 3, current_date + 5), 'papier', jsonb_build_array(current_date + 5), 'pmd', '[]'::jsonb),
  jsonb_build_array(
    pg_temp.nieuw(current_date + 3, 'out', array['rest']), pg_temp.nieuw(current_date + 3, 'in', array['rest']),
    pg_temp.nieuw(current_date + 5, 'out', array['rest','papier']), pg_temp.nieuw(current_date + 5, 'in', array['rest','papier'])),
  '2026-09-29 06:00+02') as save1 \gset
select (:'save1'::jsonb ->> 'version')::bigint as v1 \gset
select pg_temp.assert(:'v1'::bigint > 0 and (pg_temp.kal(:'fam')).version = :'v1'::bigint
                      and (:'save1'::jsonb ->> 'inserted')::int = 4 and (:'save1'::jsonb ->> 'removed')::int = 0,
  'waste_save: eerste keer een version uit de sequence, 4 taken, 0 weg');
select pg_temp.assert((pg_temp.kal(:'fam')).last_success_at = '2026-09-29 06:00+02' and (pg_temp.kal(:'fam')).last_attempt_at = '2026-09-29 06:00+02'
                      and (pg_temp.kal(:'fam')).last_error_code is null and (pg_temp.kal(:'fam')).alarm_since is null
                      and (pg_temp.kal(:'fam')).house_suffix = 'A' and (pg_temp.kal(:'fam')).bag_id = :'bag1',
  'waste_save: stand en adrescode bewaard, geen fout');
-- AC-219: systeem-insert lukt met maker null, ook als leden geen taken mogen maken
select pg_temp.assert(not exists (select 1 from public.tasks where household_id = :'fam' and waste_direction is not null and created_by_member_id is not null),
  'AC-219: afvaltaken hebben geen maker');
select pg_temp.assert((select bool_and(category = 'outdoor' and priority = 'normal' and description is null and reminder_minutes_before = '{}' and recurrence_id is null)
                       from public.tasks where household_id = :'fam' and waste_direction is not null),
  '§18.4.2: categorie buiten, normaal, geen omschrijving, geen eigen herinneringen, geen reeks');

select pg_temp.afvaltaak_id(:'fam', current_date + 3, 'out') as out3 \gset
select pg_temp.afvaltaak_id(:'fam', current_date + 3, 'in')  as in3 \gset
select pg_temp.afvaltaak_id(:'fam', current_date + 5, 'out') as out5 \gset
select pg_temp.afvaltaak_id(:'fam', current_date + 5, 'in')  as in5 \gset

-- =============================================================================
-- AC-190: wie het adres ziet (RLS) en waste_calendar_enabled()
-- =============================================================================
set role authenticated;
select pg_temp.als(:'u_jurgen');
select pg_temp.assert((select count(*) from public.waste_calendars) = 1 and (select postcode from public.waste_calendars) = '2511AB',
  'AC-190: Jurgen (beheerder) leest het adres');
select pg_temp.assert(public.waste_calendar_enabled(), 'AC-190: enabled() voor Jurgen = true');
select pg_temp.als(:'u_ellen');
select pg_temp.assert((select count(*) from public.waste_calendars) = 1, 'AC-190: Ellen (beheerder) leest het adres');
select pg_temp.als(:'u_lynn');
select pg_temp.assert((select count(*) from public.waste_calendars) = 0, 'AC-190: Lynn (gezinslid) leest geen adres of adrescode');
select pg_temp.assert(public.waste_calendar_enabled(), 'AC-190: enabled() voor Lynn = true (alleen aan/uit)');
select pg_temp.als(:'u_kai');
select pg_temp.assert((select count(*) from public.waste_calendars) = 0, 'AC-190: Kai (uitgezet) leest niets');
select pg_temp.assert(not public.waste_calendar_enabled(), 'AC-190: enabled() voor een uitgezet lid = false');
select pg_temp.als(:'u_oud');
select pg_temp.assert((select count(*) from public.waste_calendars) = 0, 'AC-190: uitgezette beheerder leest niets');
select pg_temp.als(:'u_bas');
select pg_temp.assert((select count(*) from public.waste_calendars) = 0, 'AC-190: Bas (ander huishouden) leest niets');
select pg_temp.assert(not public.waste_calendar_enabled(), 'AC-190: enabled() voor Bas = false (verraadt niets)');

-- AC-189: direct schrijven op de tabel wordt geweigerd, voor elke rol
select pg_temp.als(:'u_jurgen');
select pg_temp.expect_sqlstate(format($$insert into public.waste_calendars (household_id, postcode, house_number, bag_id, pickups, last_success_at)
  values (%L, '2511AB', 13, %L, '{}', now())$$, :'buren', :'bag2'), '42501', 'AC-189: beheerder insert op waste_calendars');
select pg_temp.expect_sqlstate($$update public.waste_calendars set house_number = 13$$, '42501', 'AC-189: beheerder update adres');
select pg_temp.expect_sqlstate($$update public.waste_calendars set last_failure_at = now(), last_error_code = 'FORMAT', error_since = now()$$, '42501',
  'AC-205: beheerder schrijft last_failure_at');
select pg_temp.expect_sqlstate($$update public.waste_calendars set alarm_since = null$$, '42501', 'AC-205: beheerder wist alarm_since');
select pg_temp.expect_sqlstate($$delete from public.waste_calendars$$, '42501', 'AC-189: beheerder delete op waste_calendars');
select pg_temp.als(:'u_lynn');
select pg_temp.expect_sqlstate($$update public.waste_calendars set postcode = '2511AC'$$, '42501', 'AC-189: gezinslid update adres');
select pg_temp.expect_sqlstate(format($$insert into public.waste_calendars (household_id, postcode, house_number, bag_id, pickups, last_success_at)
  values (%L, '2511AB', 13, %L, '{}', now())$$, :'fam', :'bag2'), '42501', 'AC-189: gezinslid insert op waste_calendars');
select pg_temp.expect_sqlstate('select public.disable_waste_calendar()', '42501', 'AC-189: gezinslid zet de afvalkalender uit');
select pg_temp.als(:'u_kai');
select pg_temp.expect_sqlstate('select public.disable_waste_calendar()', '42501', 'AC-189: uitgezet lid zet de afvalkalender uit');
select pg_temp.als(:'u_oud');
select pg_temp.expect_sqlstate('select public.disable_waste_calendar()', '42501', 'AC-189: uitgezette beheerder zet de afvalkalender uit');
select pg_temp.als(:'u_lynn');
select pg_temp.expect_sqlstate(format($$select public.waste_save(%L, %L, '2511AB', 12, '', %L, '{}', '[]', now())$$, :'fam', :'jurgen', :'bag2'), '42501',
  'AC-189: gezinslid roept waste_save aan (ook met de id van een beheerder)');
select pg_temp.expect_sqlstate(format($$select public.waste_sync(%L, 1, 'success', null, '{}', null, null, null, null, now())$$, :'fam'), '42501',
  'AC-189: gezinslid roept waste_sync aan');
select pg_temp.als(:'u_jurgen');
select pg_temp.expect_sqlstate(format($$select public.waste_sync(%L, 1, 'failure', 'FORMAT', null, null, null, null, null, now())$$, :'fam'), '42501',
  'AC-189: beheerder roept waste_sync direct aan');
reset role;
select pg_temp.systeem();
select pg_temp.assert((pg_temp.kal(:'fam')).postcode = '2511AB' and (pg_temp.kal(:'fam')).house_number = 12 and (pg_temp.kal(:'fam')).version = :'v1'::bigint
                      and (pg_temp.kal(:'fam')).last_error_code is null and pg_temp.afvaltaken(:'fam') = 4,
  'AC-189: na alle geweigerde verzoeken is niets veranderd');

-- =============================================================================
-- AC-219 en AC-208: guard en policies op tasks
-- =============================================================================
update public.households set members_can_create_tasks = false where id = :'fam';
set role authenticated;
select pg_temp.als(:'u_lynn');
select pg_temp.expect_sqlstate(format($$insert into public.tasks (household_id, title, scheduled_date, waste_pickup_date, waste_direction, waste_streams)
  values (%L, 'Nep', current_date + 9, current_date + 9, 'out', array['rest'])$$, :'fam'), '42501',
  'AC-219: gezinslid maakt een afvaltaak (leden mogen geen taken maken)');
select pg_temp.als(:'u_jurgen');
select pg_temp.expect_sqlstate(format($$insert into public.tasks (household_id, title, scheduled_date, created_by_member_id, waste_pickup_date, waste_direction, waste_streams)
  values (%L, 'Nep', current_date + 9, %L, current_date + 9, 'out', array['rest'])$$, :'fam', :'jurgen'), '42501',
  'AC-219: beheerder maakt een afvaltaak (policy)');
select pg_temp.expect_sqlstate(format($$insert into public.tasks (household_id, title, scheduled_date, created_by_member_id, waste_pickup_date)
  values (%L, 'Nep', current_date + 9, %L, current_date + 9)$$, :'fam', :'jurgen'), '42501',
  'AC-219: beheerder maakt een taak met alleen een ophaaldag (policy)');
reset role;
select pg_temp.systeem();
update public.households set members_can_create_tasks = true where id = :'fam';
set role authenticated;
select pg_temp.als(:'u_lynn');
select pg_temp.expect_sqlstate(format($$insert into public.tasks (household_id, title, scheduled_date, created_by_member_id, waste_pickup_date, waste_direction, waste_streams)
  values (%L, 'Nep', current_date + 9, %L, current_date + 9, 'in', array['rest'])$$, :'fam', :'lynn'), '42501',
  'AC-219: gezinslid maakt een afvaltaak (leden mogen wel taken maken)');
reset role;
select pg_temp.systeem();
-- De guard zelf, los van de policy: als eigenaar (geen RLS) met een ingelogde gebruiker
select pg_temp.als(:'u_jurgen');
select pg_temp.expect_sqlstate(format($$insert into public.tasks (household_id, title, scheduled_date, waste_streams)
  values (%L, 'Nep', current_date + 9, array['rest'])$$, :'fam'), '42501',
  'AC-219: de guard weigert een insert met afvalkolommen, ook zonder policy');
select pg_temp.systeem();
select pg_temp.assert(pg_temp.afvaltaken(:'fam') = 4, 'AC-219: geen door een lid gemaakte afvaltaak');

-- AC-208: wijzigen, verplaatsen, verwijderen en omzetten wordt geweigerd, voor beheerder en lid
set role authenticated;
select pg_temp.als(:'u_jurgen');
insert into public.task_recurrences (household_id, title, rule, starts_on, created_by_member_id)
values (:'fam', 'Reeks om te koppelen', '{"freq":"daily","interval":1}', current_date + 30, :'jurgen') returning id as r_koppel \gset
reset role;
select pg_temp.systeem();

create or replace function pg_temp.probeer_alles(p_task uuid, p_recurrence uuid, p_wie text)
returns void language plpgsql as $$
declare
  v_set text;
begin
  foreach v_set in array array[
    $s$title = 'Andere naam'$s$,
    $s$scheduled_date = scheduled_date + 1$s$,
    $s$scheduled_time = '08:00'$s$,
    $s$due_at = due_at + interval '1 hour'$s$,
    $s$description = 'Iets'$s$,
    $s$reminder_minutes_before = '{30}'$s$,
    $s$priority = 'high'$s$,
    $s$category = 'other'$s$,
    $s$available_from = now()$s$,
    $s$waste_pickup_date = waste_pickup_date + 1$s$,
    $s$waste_direction = null, waste_pickup_date = null, waste_streams = null$s$,
    $s$waste_streams = array['pmd']$s$,
    format($s$recurrence_id = %L, occurrence_date = scheduled_date$s$, p_recurrence),
    $s$deleted_at = now()$s$]
  loop
    perform pg_temp.expect_sqlstate(format('update public.tasks set %s where id = %L', v_set, p_task), '42501',
      format('AC-208: %s: update %s op een afvaltaak', p_wie, v_set));
  end loop;
end;
$$;
grant execute on all functions in schema pg_temp to authenticated;

set role authenticated;
select pg_temp.als(:'u_jurgen');
select pg_temp.probeer_alles(:'out3', :'r_koppel', 'beheerder');
select pg_temp.assert(pg_temp.rows(format('delete from public.tasks where id = %L', :'out3')) = 0, 'AC-208: beheerder REST-delete van een afvaltaak: 0 rijen');
select pg_temp.expect_sqlstate(format($$select public.delete_task(%L)$$, :'out3'), '42501', 'AC-208: beheerder delete_task op een afvaltaak');
select pg_temp.expect_sqlstate(format($$select public.delete_task(%L, 'future')$$, :'in3'), '42501', 'AC-208: beheerder delete_task future op een afvaltaak');
-- Een gewone taak omzetten naar een afvaltaak
select pg_temp.expect_sqlstate(format($$update public.tasks set waste_pickup_date = current_date + 2, waste_direction = 'out', waste_streams = array['rest'] where id = %L$$, :'t_hand'), '42501',
  'AC-219: beheerder zet een gewone taak om in een afvaltaak');
select pg_temp.als(:'u_lynn');
select pg_temp.probeer_alles(:'in3', :'r_koppel', 'gezinslid');
select pg_temp.assert(pg_temp.rows(format('delete from public.tasks where id = %L', :'in3')) = 0, 'AC-208: gezinslid REST-delete van een afvaltaak: 0 rijen');
select pg_temp.expect_sqlstate(format($$select public.delete_task(%L)$$, :'in3'), '42501', 'AC-208: gezinslid delete_task op een afvaltaak');
reset role;
select pg_temp.systeem();
select pg_temp.assert((pg_temp.taak(:'out3')).title = 'Afval buitenzetten' and (pg_temp.taak(:'out3')).scheduled_date = current_date + 2
                      and (pg_temp.taak(:'out3')).deleted_at is null and (pg_temp.taak(:'out3')).waste_pickup_date = current_date + 3
                      and (pg_temp.taak(:'in3')).deleted_at is null and (pg_temp.taak(:'in3')).recurrence_id is null
                      and pg_temp.afvaltaken(:'fam') = 4,
  'AC-208: na alle geweigerde verzoeken zijn de afvaltaken ongewijzigd');
select pg_temp.assert((pg_temp.taak(:'t_hand')).waste_direction is null, 'AC-219: de gewone taak is geen afvaltaak geworden');

-- AC-208: wat wel mag: status, afvinken, terugdraaien, notitie (door beheerder én lid)
set role authenticated;
select pg_temp.als(:'u_lynn');
select pg_temp.assert(pg_temp.rows(format($$update public.tasks set status = 'in_progress' where id = %L$$, :'out5')) = 1, 'AC-208: lid zet "bezig"');
select pg_temp.assert(pg_temp.rows(format($$update public.tasks set status = 'todo' where id = %L$$, :'out5')) = 1, 'AC-208: lid zet "niet meer bezig"');
insert into public.task_comments (household_id, task_id, member_id, body) values (:'fam', :'out5', :'lynn', 'Bak staat achter de schuur')
returning id as c_out5 \gset
select pg_temp.als(:'u_jurgen');
select pg_temp.assert(pg_temp.rows(format($$update public.tasks set status = 'in_progress' where id = %L$$, :'in5')) = 1, 'AC-208: beheerder zet "bezig"');
select pg_temp.assert(pg_temp.rows(format($$update public.tasks set status = 'todo' where id = %L$$, :'in5')) = 1, 'AC-208: beheerder zet "niet meer bezig"');
reset role;
select pg_temp.systeem();
select pg_temp.assert(pg_temp.notities(:'out5') = 1, 'AC-208: notitie op een afvaltaak kan');

-- =============================================================================
-- AC-207: buiten en binnen los afvinken; historie zonder persoon
-- =============================================================================
set role authenticated;
select pg_temp.als(:'u_lynn');
select public.complete_task(:'in3', gen_random_uuid());
reset role;
select pg_temp.systeem();
select pg_temp.assert((pg_temp.taak(:'in3')).status = 'done' and pg_temp.afvinkingen(:'in3') = 1, 'AC-207: Lynn vinkt binnenzetten af');
select pg_temp.assert((pg_temp.taak(:'out3')).status = 'todo', 'AC-207: buitenzetten blijft open');
set role authenticated;
select pg_temp.als(:'u_ellen');
select public.undo_complete_task(:'in3');
reset role;
select pg_temp.systeem();
select pg_temp.assert((pg_temp.taak(:'in3')).status = 'todo' and pg_temp.afvinkingen(:'in3') = 0, 'AC-207: Ellen draait het afvinken terug');
select pg_temp.assert((pg_temp.taak(:'out3')).status = 'todo', 'AC-207: buitenzetten nog steeds ongewijzigd');
select pg_temp.assert(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'task_completions'
                                  and column_name in ('member_id', 'completed_by_member_id', 'user_id')),
  'AC-207: de historie heeft geen kolom voor wie afvinkte');

-- =============================================================================
-- AC-192: afvinken na de deadline registreert "te laat"
-- =============================================================================
insert into public.tasks (household_id, title, scheduled_date, scheduled_time, due_at, waste_pickup_date, waste_direction, waste_streams)
values (:'buren', 'Restafval buitenzetten', current_date - 1, '21:00', now() - interval '5 minutes', current_date, 'out', array['rest'])
returning id as t_laat \gset
set role authenticated;
select pg_temp.als(:'u_bas');
select public.complete_task(:'t_laat', gen_random_uuid());
reset role;
select pg_temp.systeem();
select pg_temp.assert((select was_late and minutes_late >= 5 from public.task_completions where task_id = :'t_laat'),
  'AC-192: afvinken 5 minuten na 07:45 registreert "te laat"');
delete from public.task_completions where task_id = :'t_laat';
delete from public.tasks where id = :'t_laat';

-- =============================================================================
-- AC-209: buitenzetten overslaan neemt binnenzetten mee (trigger)
-- =============================================================================
set role authenticated;
select pg_temp.als(:'u_lynn');
update public.tasks set status = 'in_progress' where id = :'in5';
update public.tasks set status = 'skipped' where id = :'out5';
reset role;
select pg_temp.systeem();
select pg_temp.assert((pg_temp.taak(:'out5')).status = 'skipped' and (pg_temp.taak(:'in5')).status = 'skipped',
  'AC-209: lid slaat buitenzetten over → binnenzetten (ook "bezig") overgeslagen');
select pg_temp.assert((pg_temp.taak(:'out3')).status = 'todo' and (pg_temp.taak(:'in3')).status = 'todo',
  'AC-209: taken van een andere ophaaldag blijven ongemoeid');
set role authenticated;
select pg_temp.als(:'u_lynn');
update public.tasks set status = 'todo' where id = :'out5';
reset role;
select pg_temp.systeem();
select pg_temp.assert((pg_temp.taak(:'out5')).status = 'todo' and (pg_temp.taak(:'in5')).status = 'todo',
  'AC-209: ongedaan maken → beide weer open');
-- Alleen binnenzetten overslaan laat buitenzetten ongemoeid
set role authenticated;
select pg_temp.als(:'u_lynn');
update public.tasks set status = 'skipped' where id = :'in5';
reset role;
select pg_temp.systeem();
select pg_temp.assert((pg_temp.taak(:'in5')).status = 'skipped' and (pg_temp.taak(:'out5')).status = 'todo',
  'AC-209: alleen binnenzetten overslaan → buitenzetten ongewijzigd');
set role authenticated;
select pg_temp.als(:'u_lynn');
update public.tasks set status = 'todo' where id = :'in5';
reset role;
select pg_temp.systeem();
-- Een afgevinkte binnenzet-taak wordt niet door de doorwerking geraakt
set role authenticated;
select pg_temp.als(:'u_jurgen');
select public.complete_task(:'in5', gen_random_uuid());
update public.tasks set status = 'skipped' where id = :'out5';
update public.tasks set status = 'todo' where id = :'out5';
reset role;
select pg_temp.systeem();
select pg_temp.assert((pg_temp.taak(:'in5')).status = 'done', 'AC-209: afgevinkt binnenzetten blijft gedaan bij overslaan en terugzetten van buiten');
set role authenticated;
select pg_temp.als(:'u_jurgen');
select public.undo_complete_task(:'in5');
reset role;
select pg_temp.systeem();
-- Het systeem (vanzelf vervallen, BR-54) werkt niet door
select pg_temp.systeem();
update public.tasks set status = 'skipped' where id = :'out5';
select pg_temp.assert((pg_temp.taak(:'out5')).status = 'skipped' and (pg_temp.taak(:'in5')).status = 'todo',
  'AC-209: het systeem slaat buitenzetten over → binnenzetten ongewijzigd');
update public.tasks set status = 'todo' where id = :'out5';

-- =============================================================================
-- waste_sync (§18.7; AC-198, AC-201, AC-202, AC-204, AC-205, AC-215)
-- =============================================================================
-- Verouderde versie → stale, niets gedaan
select public.waste_sync(:'fam', -1, 'failure', 'FORMAT', null, array[:'out3']::uuid[], null, null,
  jsonb_build_array(pg_temp.nieuw(current_date + 7, 'out', array['pmd'])), '2026-09-29 07:00+02') as stale \gset
select pg_temp.assert((:'stale'::jsonb ->> 'stale')::boolean and (pg_temp.kal(:'fam')).last_error_code is null
                      and (pg_temp.taak(:'out3')).id is not null and pg_temp.afvaltaken(:'fam') = 4,
  '§18.10: waste_sync met een verouderde version doet niets');
select pg_temp.expect_sqlstate(format($$select public.waste_sync(%L, 1, 'iets', null, null, null, null, null, null, now())$$, :'fam'), '22023',
  'waste_sync: onbekende uitkomst');
select pg_temp.expect_sqlstate(format($$select public.waste_sync(%L, 1, 'failure', 'KAPOT', null, null, null, null, null, now())$$, :'fam'), '22023',
  'waste_sync: onbekende foutcode');
select pg_temp.expect_sqlstate(format($$select public.waste_sync(%L, 1, 'failure', null, null, null, null, null, null, now())$$, :'fam'), '22023',
  'waste_sync: failure zonder code');
select pg_temp.expect_sqlstate(format($$select public.waste_sync(%L, 1, 'success', null, null, null, null, null, null, now())$$, :'fam'), '22023',
  'waste_sync: success zonder ophaaldagen');

-- AC-204/AC-205 (DB): 'failure' zet last_failure_at = p_now en error_since; pickups en alarm_since blijven
select (pg_temp.kal(:'fam')).pickups::text as pickups_voor \gset
select public.waste_sync(:'fam', :'v1', 'failure', 'SUSPECT_EMPTY', null, null, null, null, null, '2026-09-29 06:00+02');
select pg_temp.assert((pg_temp.kal(:'fam')).last_error_code = 'SUSPECT_EMPTY'
                      and (pg_temp.kal(:'fam')).error_since = '2026-09-29 06:00+02'
                      and (pg_temp.kal(:'fam')).last_failure_at = '2026-09-29 06:00+02'
                      and (pg_temp.kal(:'fam')).pickups::text = :'pickups_voor'
                      and (pg_temp.kal(:'fam')).last_success_at = '2026-09-29 06:00+02'
                      and (pg_temp.kal(:'fam')).alarm_since is null,
  'AC-204: eerste mislukking: code, error_since = last_failure_at = p_now; pickups ongewijzigd');
-- Claim (§18.8.3) raakt alleen last_attempt_at (AC-205 DB)
select pg_temp.assert(pg_temp.rows(format($$update public.waste_calendars set last_attempt_at = '2026-09-29 07:15+02'
  where household_id = %L and version = %s and (last_attempt_at is null or last_attempt_at < timestamptz '2026-09-29 07:15+02' - interval '60 seconds')$$, :'fam', :'v1')) = 1,
  'claim lukt na > 60 s');
select pg_temp.assert((pg_temp.kal(:'fam')).last_failure_at = '2026-09-29 06:00+02' and (pg_temp.kal(:'fam')).error_since = '2026-09-29 06:00+02',
  'AC-205: de claim laat last_failure_at en error_since ongemoeid');
-- AC-236 (DB): tweede claim binnen 60 s → 0 rijen
select pg_temp.assert(pg_temp.rows(format($$update public.waste_calendars set last_attempt_at = '2026-09-29 07:15:30+02'
  where household_id = %L and version = %s and (last_attempt_at is null or last_attempt_at < timestamptz '2026-09-29 07:15:30+02' - interval '60 seconds')$$, :'fam', :'v1')) = 0,
  'AC-236: tweede claim binnen 60 s → 0 rijen');
select pg_temp.assert(pg_temp.rows(format($$update public.waste_calendars set last_attempt_at = '2026-09-29 07:17+02'
  where household_id = %L and version = %s and (last_attempt_at is null or last_attempt_at < timestamptz '2026-09-29 07:17+02' - interval '60 seconds')$$,
  :'fam', :'v1'::bigint - 1)) = 0,
  '§18.10: claim met een verouderde version → 0 rijen');
-- Zelfde code later: error_since blijft, last_failure_at schuift op
select public.waste_sync(:'fam', :'v1', 'failure', 'SUSPECT_EMPTY', null, null, null, null, null, '2026-09-29 07:15+02');
select pg_temp.assert((pg_temp.kal(:'fam')).error_since = '2026-09-29 06:00+02' and (pg_temp.kal(:'fam')).last_failure_at = '2026-09-29 07:15+02',
  'AC-204: zelfde code → error_since blijft, last_failure_at = p_now');
-- markWasteAlarm (statement uit sync.ts): verouderd last_success_at → 0 rijen; passend → 1; nog eens → 0
select pg_temp.assert(pg_temp.rows(format($$update public.waste_calendars set alarm_since = '2026-09-29 07:16+02'
  where household_id = %L and alarm_since is null and last_success_at = '2026-09-28 06:00+02'$$, :'fam')) = 0,
  'AC-205: markWasteAlarm met een verouderd last_success_at → 0 rijen');
select pg_temp.assert(pg_temp.rows(format($$update public.waste_calendars set alarm_since = '2026-09-29 07:16+02'
  where household_id = %L and alarm_since is null and last_success_at = '2026-09-29 06:00+02'$$, :'fam')) = 1,
  'AC-205: markWasteAlarm legt het alarm vast');
select pg_temp.assert(pg_temp.rows(format($$update public.waste_calendars set alarm_since = '2026-09-29 08:00+02'
  where household_id = %L and alarm_since is null and last_success_at = '2026-09-29 06:00+02'$$, :'fam')) = 0,
  'AC-205: markWasteAlarm is idempotent');
-- Andere code: error_since opnieuw, alarm_since blijft (de storing blijft vastgesteld)
select public.waste_sync(:'fam', :'v1', 'failure', 'UNREACHABLE', null, null, null, null, null, '2026-09-29 08:15+02');
select pg_temp.assert((pg_temp.kal(:'fam')).last_error_code = 'UNREACHABLE' and (pg_temp.kal(:'fam')).error_since = '2026-09-29 08:15+02'
                      and (pg_temp.kal(:'fam')).last_failure_at = '2026-09-29 08:15+02' and (pg_temp.kal(:'fam')).alarm_since = '2026-09-29 07:16+02',
  'AC-205: andere code → error_since opnieuw; alarm_since blijft');
-- AC-204: bij een mislukking geen remove/move/rename in de aanroep → taken gelijk; insert kan wel
select public.waste_sync(:'fam', :'v1', 'failure', 'UNREACHABLE', null, null, null, null,
  jsonb_build_array(pg_temp.nieuw(current_date + 14, 'out', array['papier']), pg_temp.nieuw(current_date + 14, 'in', array['papier'])),
  '2026-09-29 09:15+02') as fail_ins \gset
select pg_temp.assert((:'fail_ins'::jsonb ->> 'inserted')::int = 2 and pg_temp.afvaltaken(:'fam') = 6,
  'AC-204: tijdens een storing worden taken voor een bewaarde ophaaldag wel klaargezet');
-- Checks (§18.3.1): een ongeldige combinatie wordt geweigerd, ook voor het systeem
select pg_temp.expect_sqlstate(format($$update public.waste_calendars set last_error_code = null, error_since = null where household_id = %L$$, :'fam'), '23514',
  'AC-205: last_failure_at zonder code kan niet');
select pg_temp.expect_sqlstate(format($$update public.waste_calendars set last_failure_at = error_since - interval '1 minute' where household_id = %L$$, :'fam'), '23514',
  'AC-205: last_failure_at < error_since kan niet');
select pg_temp.expect_sqlstate(format($$update public.waste_calendars set error_since = null where household_id = %L$$, :'fam'), '23514',
  '§18.3.1: code zonder error_since kan niet');
select pg_temp.expect_sqlstate(format($$update public.waste_calendars set alarm_since = last_success_at - interval '1 minute' where household_id = %L$$, :'fam'), '23514',
  '§18.3.1: alarm_since vóór last_success_at kan niet');
select pg_temp.expect_sqlstate(format($$update public.waste_calendars set pickups = '[]' where household_id = %L$$, :'fam'), '23514',
  '§18.3.1: pickups moet een object zijn');
select pg_temp.expect_sqlstate(format($$update public.waste_calendars set bag_id = '518200000000001' where household_id = %L$$, :'fam'), '23514',
  'V-58: bag_id is 16 cijfers');
select pg_temp.expect_sqlstate(format($$update public.waste_calendars set postcode = '0511AB' where household_id = %L$$, :'fam'), '23514',
  '§18.3.1: postcode-formaat');
select pg_temp.expect_sqlstate(format($$update public.waste_calendars set house_suffix = 'ABCDE' where household_id = %L$$, :'fam'), '23514',
  '§18.3.1: toevoeging hooguit 4 tekens');
-- 'success' → alle vier null, pickups vervangen, last_success_at = p_now
select public.waste_sync(:'fam', :'v1', 'success', null,
  jsonb_build_object('rest', jsonb_build_array(current_date + 3, current_date + 5), 'papier', jsonb_build_array(current_date + 5, current_date + 14), 'pmd', '[]'::jsonb),
  null, null, null, null, '2026-09-29 10:00+02');
select pg_temp.assert((pg_temp.kal(:'fam')).last_error_code is null and (pg_temp.kal(:'fam')).error_since is null
                      and (pg_temp.kal(:'fam')).last_failure_at is null and (pg_temp.kal(:'fam')).alarm_since is null
                      and (pg_temp.kal(:'fam')).last_success_at = '2026-09-29 10:00+02'
                      and (pg_temp.kal(:'fam')).pickups -> 'papier' = jsonb_build_array(current_date + 5, current_date + 14),
  'AC-204/205: success → last_error_code, error_since, last_failure_at en alarm_since null; pickups vervangen');
-- null → alleen plannen, stand ongewijzigd
select public.waste_sync(:'fam', :'v1', null, null, null, null, null, null, null, '2026-09-29 10:15+02');
select pg_temp.assert((pg_temp.kal(:'fam')).last_success_at = '2026-09-29 10:00+02' and (pg_temp.kal(:'fam')).last_error_code is null,
  'waste_sync zonder uitkomst laat de stand ongewijzigd');

-- AC-198 (DB): move onder de guard als systeem: dezelfde rij, notitie en "bezig" blijven
update public.tasks set status = 'in_progress' where id = :'out5';
select public.waste_sync(:'fam', :'v1', 'success', null, (pg_temp.kal(:'fam')).pickups, null,
  jsonb_build_array(pg_temp.verschuif(:'out5', current_date + 6, 'out', array['rest','papier']),
                    pg_temp.verschuif(:'in5', current_date + 6, 'in', array['rest','papier'])),
  null, null, '2026-09-29 10:30+02') as mv \gset
select pg_temp.assert((:'mv'::jsonb ->> 'moved')::int = 2, 'AC-198: twee taken verschoven');
select pg_temp.assert((pg_temp.taak(:'out5')).waste_pickup_date = current_date + 6 and (pg_temp.taak(:'out5')).scheduled_date = current_date + 5
                      and (pg_temp.taak(:'out5')).status = 'in_progress' and (pg_temp.taak(:'out5')).title = 'Verschoven'
                      and (pg_temp.taak(:'in5')).waste_pickup_date = current_date + 6 and (pg_temp.taak(:'in5')).scheduled_date = current_date + 6,
  'AC-198: dezelfde rijen op de nieuwe dag, "bezig" blijft');
select pg_temp.assert(pg_temp.notities(:'out5') = 1, 'AC-198: de notitie van Lynn hangt nog aan de verschoven taak');
select pg_temp.assert(pg_temp.afvinkingen(:'out5') = 0 and pg_temp.afvinkingen(:'in5') = 0, 'AC-198: geen historie door de verschuiving');
-- move met de verkeerde richting doet niets
select public.waste_sync(:'fam', :'v1', null, null, null, null,
  jsonb_build_array(pg_temp.verschuif(:'out5', current_date + 7, 'in', array['rest'])), null, null, '2026-09-29 10:31+02') as mv_fout \gset
select pg_temp.assert((:'mv_fout'::jsonb ->> 'moved')::int = 0 and (pg_temp.taak(:'out5')).waste_pickup_date = current_date + 6,
  '§18.7: move met een andere richting raakt de taak niet');
-- Botsing bij move (unique) → hele RPC terug (§18.7)
select pg_temp.expect_sqlstate(format($$select public.waste_sync(%L, %s, 'failure', 'FORMAT', null, array[%L]::uuid[], %L::jsonb, null, null, '2026-09-29 10:32+02')$$,
  :'fam', :'v1', :'in5', jsonb_build_array(pg_temp.verschuif(:'out5', current_date + 3, 'out', array['rest']))), '23505',
  '§18.7: move naar een bezette dag geeft een unique_violation');
select pg_temp.assert((pg_temp.kal(:'fam')).last_error_code is null and (pg_temp.taak(:'in5')).id is not null
                      and (pg_temp.taak(:'out5')).waste_pickup_date = current_date + 6,
  '§18.7: na de botsing zijn ook de stand en de remove teruggedraaid');

-- AC-201: rename van open taken; AC-202: done/skipped nooit geraakt
set role authenticated;
select pg_temp.als(:'u_jurgen');
select public.complete_task(:'in3', gen_random_uuid());
select pg_temp.als(:'u_lynn');
update public.tasks set status = 'skipped' where id = :'out3';
reset role;
select pg_temp.systeem();
-- (de doorwerking zette in3 niet terug: die was al gedaan)
select pg_temp.assert((pg_temp.taak(:'in3')).status = 'done' and (pg_temp.taak(:'out3')).status = 'skipped', 'voorbereiding AC-202');
select (pg_temp.taak(:'in3')).title as titel_in3 \gset
select public.waste_sync(:'fam', :'v1', 'success', null, (pg_temp.kal(:'fam')).pickups,
  array[:'out3', :'in3']::uuid[],
  jsonb_build_array(pg_temp.verschuif(:'out3', current_date + 8, 'out', array['rest']), pg_temp.verschuif(:'in3', current_date + 8, 'in', array['rest'])),
  jsonb_build_array(jsonb_build_object('id', :'out3', 'title', 'Hernoemd', 'waste_streams', jsonb_build_array('pmd')),
                    jsonb_build_object('id', :'in3', 'title', 'Hernoemd', 'waste_streams', jsonb_build_array('pmd')),
                    jsonb_build_object('id', :'out5', 'title', 'Restafval, papier en PMD buitenzetten', 'waste_streams', jsonb_build_array('rest','papier','pmd'))),
  null, '2026-09-29 10:40+02') as dn \gset
select pg_temp.assert((:'dn'::jsonb ->> 'removed')::int = 0 and (:'dn'::jsonb ->> 'moved')::int = 0 and (:'dn'::jsonb ->> 'renamed')::int = 1,
  'AC-202: remove/move/rename op done/skipped → 0 rijen; alleen de open taak hernoemd');
select pg_temp.assert((pg_temp.taak(:'in3')).status = 'done' and (pg_temp.taak(:'in3')).title = :'titel_in3'
                      and (pg_temp.taak(:'in3')).waste_pickup_date = current_date + 3 and (pg_temp.taak(:'in3')).waste_streams = array['rest']
                      and (pg_temp.taak(:'out3')).status = 'skipped' and (pg_temp.taak(:'out3')).waste_pickup_date = current_date + 3
                      and pg_temp.afvinkingen(:'in3') = 1,
  'AC-202: datum, naam, status en historie van afgevinkte en overgeslagen afvaltaken onveranderd');
select pg_temp.assert((pg_temp.taak(:'out5')).title = 'Restafval, papier en PMD buitenzetten'
                      and (pg_temp.taak(:'out5')).waste_streams = array['rest','papier','pmd'],
  'AC-201: open taak hernoemd, met de nieuwe bakken');

-- AC-215: waste_sync raakt geen gewone taak, ook niet als het id meegegeven wordt; ander huishouden ook niet
insert into public.tasks (household_id, title, scheduled_date, waste_pickup_date, waste_direction, waste_streams)
values (:'buren', 'Buren buiten', current_date + 4, current_date + 5, 'out', array['rest']) returning id as t_buren \gset
select public.waste_sync(:'fam', :'v1', null, null, null,
  array[:'t_hand', :'t_buren']::uuid[],
  jsonb_build_array(pg_temp.verschuif(:'t_hand', current_date + 9, 'out', array['rest'])),
  jsonb_build_array(jsonb_build_object('id', :'t_hand', 'title', 'X', 'waste_streams', jsonb_build_array('rest')),
                    jsonb_build_object('id', :'t_buren', 'title', 'X', 'waste_streams', jsonb_build_array('pmd'))),
  null, '2026-09-29 10:50+02') as gewoon \gset
select pg_temp.assert((:'gewoon'::jsonb ->> 'removed')::int = 0 and (:'gewoon'::jsonb ->> 'moved')::int = 0 and (:'gewoon'::jsonb ->> 'renamed')::int = 0,
  'AC-215: waste_sync raakt geen gewone taak en geen taak van een ander huishouden');
select pg_temp.assert((pg_temp.taak(:'t_hand')).title = 'Container schoonmaken' and (pg_temp.taak(:'t_hand')).waste_direction is null
                      and (pg_temp.taak(:'t_buren')).title = 'Buren buiten',
  'AC-215: gewone taak en taak van de buren onveranderd');
delete from public.tasks where id = :'t_buren';

-- AC-197 (DB): insert van een bestaande sleutel → on conflict do nothing (elke status)
select public.waste_sync(:'fam', :'v1', null, null, null, null, null, null,
  jsonb_build_array(pg_temp.nieuw(current_date + 3, 'in', array['rest']), pg_temp.nieuw(current_date + 6, 'out', array['rest'])),
  '2026-09-29 11:00+02') as dubbel \gset
select pg_temp.assert((:'dubbel'::jsonb ->> 'inserted')::int = 0, 'AC-197: een bestaande sleutel wordt niet dubbel ingevoegd');

-- =============================================================================
-- AC-214: waste_save met een ander adres: open weg, done/skipped blijft
-- =============================================================================
select pg_temp.afvaltaken(:'fam', array['todo','in_progress']) as open_voor \gset
select public.waste_save(:'fam', :'ellen', '2512CD', 7, '', :'bag2',
  jsonb_build_object('rest', jsonb_build_array(current_date + 4), 'papier', '[]'::jsonb, 'pmd', '[]'::jsonb),
  jsonb_build_array(pg_temp.nieuw(current_date + 4, 'out', array['rest']), pg_temp.nieuw(current_date + 4, 'in', array['rest'])),
  '2026-09-29 12:00+02') as save2 \gset
select (:'save2'::jsonb ->> 'version')::bigint as v2 \gset
select pg_temp.assert(:'v2'::bigint > :'v1'::bigint and (:'save2'::jsonb ->> 'removed')::int = :'open_voor'::int
                      and (:'save2'::jsonb ->> 'inserted')::int = 2,
  'AC-214: nieuwe (hogere) version, alle open afvaltaken weg, nieuwe taken erin');
select public.waste_sync(:'fam', :'v1', 'success', null, '{"rest":[],"papier":[],"pmd":[]}', null, null, null,
  jsonb_build_array(pg_temp.nieuw(current_date + 11, 'out', array['rest'])), '2026-09-29 12:01+02') as oud_na_wissel \gset
select pg_temp.assert((:'oud_na_wissel'::jsonb ->> 'stale')::boolean and (pg_temp.kal(:'fam')).postcode = '2512CD'
                      and pg_temp.afvaltaak_id(:'fam', current_date + 11, 'out') is null,
  '§18.10: een tick met de version van het oude adres is stale na een adreswissel');
select pg_temp.assert((pg_temp.taak(:'in3')).status = 'done' and (pg_temp.taak(:'out3')).status = 'skipped',
  'AC-214: afgevinkte en overgeslagen afvaltaken blijven');
select pg_temp.assert(pg_temp.afvaltaken(:'fam', array['todo','in_progress']) = 2
                      and not exists (select 1 from public.tasks where household_id = :'fam' and waste_direction is not null
                                      and status in ('todo','in_progress') and waste_pickup_date <> current_date + 4),
  'AC-214: nooit open taken van twee adressen');
select pg_temp.assert(pg_temp.notities(:'out5') = 0 and (pg_temp.taak(:'out5')).id is null,
  'AC-214: open taak van het oude adres is hard verwijderd (met notitie)');
select pg_temp.assert((pg_temp.kal(:'fam')).postcode = '2512CD' and (pg_temp.kal(:'fam')).bag_id = :'bag2'
                      and (pg_temp.kal(:'fam')).last_success_at = '2026-09-29 12:00+02' and (pg_temp.kal(:'fam')).last_error_code is null,
  'AC-214: nieuw adres bewaard, stand opnieuw');
-- AC-215: de handmatige taak en reeks bestaan nog, onveranderd
select pg_temp.assert((pg_temp.taak(:'t_hand')).title = 'Container schoonmaken' and (pg_temp.taak(:'t_hand')).deleted_at is null
                      and exists (select 1 from public.task_recurrences where id = :'r_hand' and is_active),
  'AC-215: handmatige taak en reeks ongemoeid door waste_save');
-- Een nieuw alarm en een mislukking worden door waste_save gewist
select public.waste_sync(:'fam', :'v2', 'failure', 'ADDRESS_GONE', null, null, null, null, null, '2026-09-29 13:00+02');
update public.waste_calendars set alarm_since = '2026-09-29 13:01+02' where household_id = :'fam';
select public.waste_save(:'fam', :'jurgen', '2512CD', 7, '', :'bag2', (pg_temp.kal(:'fam')).pickups, '[]', '2026-09-29 14:00+02');
select (pg_temp.kal(:'fam')).version as v3 \gset
select pg_temp.assert(:'v3'::bigint > :'v2'::bigint and (pg_temp.kal(:'fam')).last_error_code is null and (pg_temp.kal(:'fam')).error_since is null
                      and (pg_temp.kal(:'fam')).last_failure_at is null and (pg_temp.kal(:'fam')).alarm_since is null,
  '§18.7: waste_save wist de fout, last_failure_at en alarm_since');

-- =============================================================================
-- AC-213: uitzetten
-- =============================================================================
select public.waste_sync(:'fam', :'v3', null, null, null, null, null, null,
  jsonb_build_array(pg_temp.nieuw(current_date + 10, 'out', array['pmd']), pg_temp.nieuw(current_date + 10, 'in', array['pmd'])),
  '2026-09-29 14:05+02');
select pg_temp.afvaltaken(:'fam', array['todo','in_progress']) as open_uit \gset
select pg_temp.afvaltaken(:'fam', array['done','skipped']) as dicht_uit \gset
set role authenticated;
select pg_temp.als(:'u_bas');
select pg_temp.assert(public.disable_waste_calendar() = 0, 'AC-213: beheerder zonder afvalkalender zet uit → 0');
select pg_temp.als(:'u_jurgen');
select public.disable_waste_calendar() as weg \gset
select pg_temp.assert(:'weg'::int = :'open_uit'::int and :'weg'::int = 2, 'AC-213: disable geeft het aantal verwijderde open afvaltaken');
select pg_temp.assert(not public.waste_calendar_enabled(), 'AC-213: enabled() = false na uitzetten (beheerder)');
select pg_temp.als(:'u_lynn');
select pg_temp.assert(not public.waste_calendar_enabled(), 'AC-213: enabled() = false na uitzetten (gezinslid)');
select pg_temp.als(:'u_jurgen');
select pg_temp.assert(public.disable_waste_calendar() = 0, 'AC-213: tweede keer uitzetten → 0');
reset role;
select pg_temp.systeem();
select pg_temp.assert(not pg_temp.kal_bestaat(:'fam'), 'AC-213: adres, adrescode, datums en stand zijn weg');
select pg_temp.assert(pg_temp.afvaltaken(:'fam', array['todo','in_progress']) = 0
                      and pg_temp.afvaltaken(:'fam', array['done','skipped']) = :'dicht_uit'::int and :'dicht_uit'::int = 2,
  'AC-213: open afvaltaken weg, afgevinkte en overgeslagen blijven');
select pg_temp.assert(pg_temp.afvinkingen(:'in3') = 1, 'AC-213: de historie staat er nog');
select pg_temp.assert((pg_temp.taak(:'t_hand')).deleted_at is null and exists (select 1 from public.task_recurrences where id = :'r_hand' and is_active),
  'AC-215: handmatige taak en reeks ongemoeid door uitzetten');

-- =============================================================================
-- AC-216: huishouden verwijderen wist adres en afvaltaken; ander huishouden intact
-- =============================================================================
-- Code-review WP3b punt 4 (D-048): uitzetten en direct weer aanzetten; een tick die
-- de oude rij (v3) nog had gelezen, is daarna stale en voegt niets van het oude adres in
select public.waste_save(:'fam', :'jurgen', '2511AB', 12, 'A', :'bag1',
  jsonb_build_object('rest', jsonb_build_array(current_date + 3), 'papier', '[]'::jsonb, 'pmd', '[]'::jsonb),
  jsonb_build_array(pg_temp.nieuw(current_date + 3, 'out', array['rest'])), now()) as save4 \gset
select pg_temp.assert((:'save4'::jsonb ->> 'version')::bigint > :'v3'::bigint,
  'D-048: na uitzetten en weer aanzetten valt version niet terug');
select public.waste_sync(:'fam', :'v3', 'success', null, '{"rest":[],"papier":[],"pmd":[]}', null, null, null,
  jsonb_build_array(pg_temp.nieuw(current_date + 12, 'out', array['pmd'])), now()) as oud_na_uit \gset
select pg_temp.assert((:'oud_na_uit'::jsonb ->> 'stale')::boolean
                      and (pg_temp.kal(:'fam')).pickups -> 'rest' = jsonb_build_array(current_date + 3)
                      and pg_temp.afvaltaak_id(:'fam', current_date + 12, 'out') is null,
  'D-048: waste_sync met de version van vóór het uitzetten is stale (geen taken of datums van het oude adres)');

select public.waste_save(:'buren', :'bas', '2513EF', 1, '', :'bag2',
  jsonb_build_object('rest', jsonb_build_array(current_date + 3), 'papier', '[]'::jsonb, 'pmd', '[]'::jsonb),
  jsonb_build_array(pg_temp.nieuw(current_date + 3, 'out', array['rest']), pg_temp.nieuw(current_date + 3, 'in', array['rest'])), now());

-- Security-review WP3b: de doorwerking van overslaan blijft binnen het eigen huishouden
select pg_temp.afvaltaak_id(:'fam', current_date + 3, 'out') as fam_out3 \gset
select pg_temp.afvaltaak_id(:'buren', current_date + 3, 'in') as buren_in3 \gset
set role authenticated;
select pg_temp.als(:'u_jurgen');
update public.tasks set status = 'skipped' where id = :'fam_out3';
reset role;
select pg_temp.systeem();
select pg_temp.assert((pg_temp.taak(:'fam_out3')).status = 'skipped' and (pg_temp.taak(:'buren_in3')).status = 'todo',
  'AC-209: overslaan in huishouden A laat binnenzetten van dezelfde dag in huishouden B open');
set role authenticated;
select pg_temp.als(:'u_jurgen');
update public.tasks set status = 'todo' where id = :'fam_out3';
select pg_temp.assert(pg_temp.rows(format($$update public.tasks set status = 'skipped' where id = %L$$, :'buren_in3')) = 0,
  'isolatie: Jurgen kan een afvaltaak van de buren niet overslaan');
reset role;
select pg_temp.systeem();
select pg_temp.assert((pg_temp.taak(:'buren_in3')).status = 'todo', 'isolatie: afvaltaak van de buren ongewijzigd');

-- Security-review WP3b: anon wordt overal geweigerd
set role anon;
select pg_temp.systeem();
select pg_temp.expect_sqlstate('select count(*) from public.waste_calendars', '42501', 'anon leest waste_calendars');
select pg_temp.expect_sqlstate('select public.waste_calendar_enabled()', '42501', 'anon roept waste_calendar_enabled aan');
select pg_temp.expect_sqlstate('select public.disable_waste_calendar()', '42501', 'anon roept disable_waste_calendar aan');
select pg_temp.expect_sqlstate(format($$select public.waste_sync(%L, 1, null, null, null, null, null, null, null, now())$$, :'fam'), '42501', 'anon roept waste_sync aan');
reset role;
select pg_temp.systeem();

-- Security-review WP3b: uitzetten door beheerder A laat huishouden B intact
set role authenticated;
select pg_temp.als(:'u_jurgen');
select pg_temp.assert(public.disable_waste_calendar() = 1, 'AC-213: Jurgen zet de eigen afvalkalender uit');
reset role;
select pg_temp.systeem();
select pg_temp.assert(pg_temp.kal_bestaat(:'buren') and pg_temp.afvaltaken(:'buren', array['todo']) = 2,
  'isolatie: uitzetten door Jurgen laat adres en taken van de buren intact');
select public.waste_save(:'fam', :'jurgen', '2511AB', 12, 'A', :'bag1',
  jsonb_build_object('rest', jsonb_build_array(current_date + 3), 'papier', '[]'::jsonb, 'pmd', '[]'::jsonb),
  jsonb_build_array(pg_temp.nieuw(current_date + 3, 'out', array['rest'])), now());

set role authenticated;
select pg_temp.als(:'u_bas');
select public.delete_household('Buren Afval');
reset role;
select pg_temp.systeem();
select pg_temp.assert(not pg_temp.kal_bestaat(:'buren') and pg_temp.afvaltaken(:'buren') = 0,
  'AC-216: adres en afvaltaken van het verwijderde huishouden zijn weg');
select pg_temp.assert(pg_temp.kal_bestaat(:'fam') and pg_temp.afvaltaken(:'fam', array['todo']) = 1,
  'AC-216: het andere huishouden is intact');

-- =============================================================================
-- D-048: de versiereeks is alleen voor de service role (expliciete grants)
-- =============================================================================
select pg_temp.assert(has_sequence_privilege('service_role', 'public.waste_calendar_version_seq', 'usage')
                      and not has_sequence_privilege('authenticated', 'public.waste_calendar_version_seq', 'usage')
                      and not has_sequence_privilege('anon', 'public.waste_calendar_version_seq', 'usage'),
  'D-048: alleen service_role mag de versiereeks gebruiken');
select pg_temp.assert(has_table_privilege('service_role', 'public.waste_calendars', 'select, insert, update, delete')
                      and not has_table_privilege('authenticated', 'public.waste_calendars', 'insert')
                      and not has_table_privilege('authenticated', 'public.waste_calendars', 'update')
                      and not has_table_privilege('authenticated', 'public.waste_calendars', 'delete')
                      and not has_table_privilege('anon', 'public.waste_calendars', 'select'),
  'D-048: expliciete grants op waste_calendars');
set role authenticated;
select pg_temp.als(:'u_jurgen');
select pg_temp.expect_sqlstate($$select nextval('public.waste_calendar_version_seq')$$, '42501', 'D-048: beheerder kan geen versie uit de reeks trekken');
select pg_temp.expect_sqlstate(format($$select private.waste_insert_tasks(%L, '[]'::jsonb)$$, :'fam'), '42501',
  'security-review WP3b: private.waste_insert_tasks is niet aanroepbaar voor authenticated');
set role anon;
select pg_temp.expect_sqlstate($$select nextval('public.waste_calendar_version_seq')$$, '42501', 'D-048: anon kan geen versie uit de reeks trekken');
reset role;
select pg_temp.systeem();

-- =============================================================================
-- D-049 (V-59): grens op het opzoeken van een adres — waste_lookup_windows en
-- waste_lookup_allowed(p_household_id, p_limit, p_now) (migratie …_340)
-- =============================================================================
select pg_temp.assert((select relrowsecurity from pg_class where oid = 'public.waste_lookup_windows'::regclass),
  'D-049: RLS staat aan op waste_lookup_windows');
select pg_temp.assert((select count(*) from pg_policies where schemaname = 'public' and tablename = 'waste_lookup_windows') = 0,
  'D-049: geen policy op waste_lookup_windows (alleen de service role komt erbij)');
select pg_temp.assert(not has_table_privilege('authenticated', 'public.waste_lookup_windows', 'select')
                      and not has_table_privilege('anon', 'public.waste_lookup_windows', 'select')
                      and has_table_privilege('service_role', 'public.waste_lookup_windows', 'select, insert, update, delete'),
  'D-049: tabelrechten waste_lookup_windows alleen voor service_role');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.waste_lookup_allowed(uuid,integer,timestamptz)', 'execute')
                      and not has_function_privilege('anon', 'public.waste_lookup_allowed(uuid,integer,timestamptz)', 'execute')
                      and has_function_privilege('service_role', 'public.waste_lookup_allowed(uuid,integer,timestamptz)', 'execute'),
  'D-049: waste_lookup_allowed alleen voor service_role');
select pg_temp.assert(not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'waste_lookup_windows'),
  'D-049: waste_lookup_windows niet in Realtime');

-- 20 opzoekingen binnen een uur mogen; de 21e niet; na een uur begint het venster opnieuw
select set_config('test.fam', :'fam', false);
do $$
declare
  v_fam uuid := current_setting('test.fam')::uuid;
  v_buren uuid;
  v_t0 timestamptz := timestamptz '2026-09-29 10:00+02';
  i integer;
begin
  -- Het venster begint bij de eerste opzoeking (v_t0); daarna om de minuut
  for i in 0..19 loop
    if not public.waste_lookup_allowed(v_fam, 20, v_t0 + (i || ' minutes')::interval) then
      raise exception 'ASSERT MISLUKT: D-049: opzoeking % binnen een uur moet mogen', i + 1;
    end if;
  end loop;
  if public.waste_lookup_allowed(v_fam, 20, v_t0 + interval '59 minutes') then
    raise exception 'ASSERT MISLUKT: D-049: de 21e opzoeking binnen een uur moet geweigerd worden';
  end if;
  if public.waste_lookup_allowed(v_fam, 20, v_t0 + interval '60 minutes') then
    raise exception 'ASSERT MISLUKT: D-049: ook een 22e opzoeking precies op het uur is nog geweigerd (venster nog open)';
  end if;
  if (select lookups from public.waste_lookup_windows where household_id = v_fam) <> 22 then
    raise exception 'ASSERT MISLUKT: D-049: een geweigerde opzoeking telt wel mee';
  end if;
  -- Ruim een uur later: nieuw venster, teller opnieuw op 1
  if not public.waste_lookup_allowed(v_fam, 20, v_t0 + interval '61 minutes') then
    raise exception 'ASSERT MISLUKT: D-049: na een uur mag het weer';
  end if;
  if (select lookups from public.waste_lookup_windows where household_id = v_fam) <> 1
     or (select window_start from public.waste_lookup_windows where household_id = v_fam) <> v_t0 + interval '61 minutes' then
    raise exception 'ASSERT MISLUKT: D-049: het venster schuift en de teller begint opnieuw';
  end if;
  -- Een ander huishouden heeft een eigen teller
  insert into public.households (name, created_by) values ('Teller Apart', null) returning id into v_buren;
  if not public.waste_lookup_allowed(v_buren, 1, v_t0 + interval '61 minutes') then
    raise exception 'ASSERT MISLUKT: D-049: de eerste opzoeking van een ander huishouden mag';
  end if;
  if public.waste_lookup_allowed(v_buren, 1, v_t0 + interval '62 minutes') then
    raise exception 'ASSERT MISLUKT: D-049: de grens geldt per huishouden';
  end if;
  if (select lookups from public.waste_lookup_windows where household_id = v_fam) <> 1 then
    raise exception 'ASSERT MISLUKT: D-049: de teller van een ander huishouden raakt de eigen teller niet';
  end if;
  delete from public.households where id = v_buren;
  if exists (select 1 from public.waste_lookup_windows where household_id = v_buren) then
    raise exception 'ASSERT MISLUKT: D-049: het venster verdwijnt met het huishouden';
  end if;
end;
$$;
select pg_temp.expect_sqlstate(format($$select public.waste_lookup_allowed(%L, -1, now())$$, '00000000-0000-0000-0000-000000000000'), '23503',
  'D-049: geen venster voor een onbekend huishouden');

-- Gebruikers komen er niet bij: niet lezen, niet tellen, niet resetten
set role authenticated;
select pg_temp.als(:'u_jurgen');
select pg_temp.expect_sqlstate('select count(*) from public.waste_lookup_windows', '42501', 'D-049: beheerder leest waste_lookup_windows niet');
select pg_temp.expect_sqlstate(format($$select public.waste_lookup_allowed(%L, 20, now())$$, :'fam'), '42501', 'D-049: beheerder roept waste_lookup_allowed niet aan');
select pg_temp.expect_sqlstate(format($$update public.waste_lookup_windows set lookups = 0 where household_id = %L$$, :'fam'), '42501',
  'D-049: beheerder kan de teller niet resetten');
select pg_temp.als(:'u_lynn');
select pg_temp.expect_sqlstate(format($$select public.waste_lookup_allowed(%L, 20, now())$$, :'fam'), '42501', 'D-049: gezinslid roept waste_lookup_allowed niet aan');
set role anon;
select pg_temp.systeem();
select pg_temp.expect_sqlstate('select count(*) from public.waste_lookup_windows', '42501', 'D-049: anon leest waste_lookup_windows niet');
select pg_temp.expect_sqlstate(format($$select public.waste_lookup_allowed(%L, 20, now())$$, :'fam'), '42501', 'D-049: anon roept waste_lookup_allowed niet aan');
reset role;
select pg_temp.systeem();
select pg_temp.assert((select lookups from public.waste_lookup_windows where household_id = :'fam') = 1,
  'D-049: na alle geweigerde verzoeken is de teller ongewijzigd');

-- Opruimen van de eigen gegevens (de volgende bestanden gebruiken eigen accounts)
delete from public.households where id = :'fam';
select pg_temp.assert(not exists (select 1 from public.waste_lookup_windows where household_id = :'fam'),
  'D-049: het venster verdwijnt met het huishouden (delete_household / cascade)');

\o
select 'WP3b-tests (…_320/…_330 afvalkalender) geslaagd' as resultaat;
