-- =============================================================================
-- Tests: WP3b — afvalkalender (W-03; TECHNICAL_DESIGN §18.3–§18.7, §18.15 kolom DB;
-- ACCEPTANCE_CRITERIA AC-189…AC-219). Migraties …_400 en …_410.
-- Eigen accounts en huishoudens. Iedere fout stopt het script (ON_ERROR_STOP),
-- dus "geen output" = geslaagd.
-- =============================================================================

\o /dev/null

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

create or replace function pg_temp.als(p_user uuid)
returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, false);
$$;

create or replace function pg_temp.systeem()
returns void language sql as $$
  select set_config('request.jwt.claims', '', false);
$$;

-- Lezen ongeacht RLS (eigenaar)
create or replace function pg_temp.taak(p_household uuid, p_date date, p_dir text)
returns public.tasks language sql security definer as $$
  select * from public.tasks where household_id = p_household and waste_pickup_date = p_date and waste_direction = p_dir;
$$;
create or replace function pg_temp.afvaltaken(p_household uuid, p_status text default null)
returns integer language sql security definer as $$
  select count(*)::integer from public.tasks
  where household_id = p_household and waste_direction is not null and (p_status is null or status::text = p_status);
$$;
create or replace function pg_temp.kalender(p_household uuid)
returns public.waste_calendars language sql security definer as $$
  select * from public.waste_calendars where household_id = p_household;
$$;

-- Eén rij voor p_insert, zoals de TS-planner hem maakt (tijden hier vereenvoudigd)
create or replace function pg_temp.afval(p_date date, p_dir text, p_streams text[] default array['rest'])
returns jsonb language sql as $$
  select jsonb_build_object(
    'title', case when p_dir = 'out' then 'Restafval buitenzetten' else 'Restafvalbak binnenzetten' end,
    'description', case when p_dir = 'out' then 'Mag vanaf 22:00 buiten, uiterlijk 07:45.' else 'Binnenzetten vanaf 12:00, uiterlijk vandaag.' end,
    'scheduled_date', case when p_dir = 'out' then p_date - 1 else p_date end,
    'scheduled_time', case when p_dir = 'out' then '21:00' else null end,
    'available_from', case when p_dir = 'in' then (p_date + time '12:00') at time zone 'Europe/Amsterdam' else null end,
    'due_at', case when p_dir = 'out' then (p_date + time '07:45') at time zone 'Europe/Amsterdam'
                   else (p_date + 1)::timestamp at time zone 'Europe/Amsterdam' end,
    'waste_pickup_date', p_date,
    'waste_direction', p_dir,
    'waste_streams', to_jsonb(p_streams)
  );
$$;

grant execute on all functions in schema pg_temp to authenticated;

-- -----------------------------------------------------------------------------
-- Testdata: Jurgen en Ellen (beheerders), Lynn (gezinslid), Kai (uitgezet),
-- Bas (ander huishouden)
-- -----------------------------------------------------------------------------
\set u_jurgen '70000000-0000-0000-0000-0000000000a1'
\set u_ellen  '70000000-0000-0000-0000-0000000000a2'
\set u_lynn   '70000000-0000-0000-0000-0000000000a3'
\set u_kai    '70000000-0000-0000-0000-0000000000a4'
\set u_bas    '70000000-0000-0000-0000-0000000000a5'
\set bag      '0518200000123456'

insert into auth.users (id, email, raw_user_meta_data) values
  (:'u_jurgen', 'jurgen.afval@example.com', '{"display_name":"Jurgen"}'),
  (:'u_ellen',  'ellen.afval@example.com',  '{"display_name":"Ellen"}'),
  (:'u_lynn',   'lynn.afval@example.com',   '{"display_name":"Lynn"}'),
  (:'u_kai',    'kai.afval@example.com',    '{"display_name":"Kai"}'),
  (:'u_bas',    'bas.afval@example.com',    '{"display_name":"Bas"}');

set role authenticated;
select pg_temp.als(:'u_jurgen');
select public.create_household('Familie Afval', 'Jurgen') as fam \gset
select id as jurgen from public.household_members where user_id = :'u_jurgen' \gset
insert into public.household_invitations (household_id, email, role, invited_by_member_id) values
  (:'fam', 'ellen.afval@example.com', 'admin', :'jurgen'),
  (:'fam', 'lynn.afval@example.com', 'member', :'jurgen'),
  (:'fam', 'kai.afval@example.com', 'member', :'jurgen');
select token as tok_ellen from public.household_invitations where email = 'ellen.afval@example.com' \gset
select token as tok_lynn from public.household_invitations where email = 'lynn.afval@example.com' \gset
select token as tok_kai from public.household_invitations where email = 'kai.afval@example.com' \gset
select pg_temp.als(:'u_ellen'); select public.accept_invitation(:'tok_ellen', 'Ellen');
select pg_temp.als(:'u_lynn');  select public.accept_invitation(:'tok_lynn', 'Lynn');
select pg_temp.als(:'u_kai');   select public.accept_invitation(:'tok_kai', 'Kai');
select pg_temp.als(:'u_jurgen');
select id as lynn from public.household_members where user_id = :'u_lynn' \gset
select id as kai from public.household_members where user_id = :'u_kai' \gset
-- Handmatige reeks en losse taak die ongemoeid moeten blijven (AC-215)
insert into public.task_recurrences (household_id, title, rule, starts_on, created_by_member_id)
values (:'fam', 'Afvalcontainer buiten zetten', '{"freq":"weekly","interval":1,"weekdays":[1]}', current_date, :'jurgen')
returning id as reeks \gset
insert into public.tasks (household_id, recurrence_id, occurrence_date, title, scheduled_date, created_by_member_id)
values (:'fam', :'reeks', current_date + 3, 'Afvalcontainer buiten zetten', current_date + 3, :'jurgen')
returning id as handmatig \gset
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'fam', 'Container schoonmaken', current_date + 2, :'jurgen')
returning id as los \gset

select pg_temp.als(:'u_bas');
select public.create_household('Buren Afval', 'Bas') as buren \gset
select id as bas from public.household_members where user_id = :'u_bas' \gset

reset role;
select pg_temp.systeem();
update public.household_members set is_active = false where id = :'kai';

-- =============================================================================
-- Rechten op functies: waste_save en waste_sync alleen voor de service role
-- =============================================================================
select pg_temp.assert(not has_function_privilege('authenticated', 'public.waste_save(uuid, uuid, text, integer, text, text, jsonb, jsonb, timestamptz)', 'execute'),
  'AC-189: waste_save niet uitvoerbaar voor authenticated');
select pg_temp.assert(not has_function_privilege('anon', 'public.waste_save(uuid, uuid, text, integer, text, text, jsonb, jsonb, timestamptz)', 'execute'),
  'AC-189: waste_save niet uitvoerbaar voor anon');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.waste_sync(uuid, bigint, text, text, jsonb, jsonb, jsonb, uuid[], timestamptz)', 'execute'),
  'AC-189: waste_sync niet uitvoerbaar voor authenticated');
select pg_temp.assert(has_function_privilege('service_role', 'public.waste_sync(uuid, bigint, text, text, jsonb, jsonb, jsonb, uuid[], timestamptz)', 'execute'),
  'waste_sync wel voor service_role');
select pg_temp.assert(not has_function_privilege('anon', 'public.disable_waste_calendar()', 'execute')
  and not has_function_privilege('anon', 'public.waste_calendar_enabled()', 'execute'),
  'AC-190: disable_waste_calendar en waste_calendar_enabled niet voor anon');
select pg_temp.assert(not has_function_privilege('authenticated', 'private.waste_skip_cascade()', 'execute'),
  'B-04: interne trigger-functie niet aanroepbaar');
select pg_temp.assert(not has_table_privilege('anon', 'public.waste_calendars', 'select'), 'anon leest waste_calendars niet');
select pg_temp.assert(not has_table_privilege('authenticated', 'public.waste_calendars', 'insert')
  and not has_table_privilege('authenticated', 'public.waste_calendars', 'update')
  and not has_table_privilege('authenticated', 'public.waste_calendars', 'delete'),
  'AC-189: authenticated kan waste_calendars niet schrijven');

-- Een niet-beheerder als p_member_id: de RPC weigert zelf (TOCTOU na requireAdmin)
select pg_temp.expect_sqlstate(format($q$select public.waste_save(%L, %L, '2591BB', 87, '', %L, '{"rest":[]}'::jsonb, '[]'::jsonb, now())$q$,
  :'fam', :'lynn', :'bag'), '42501', 'waste_save met een gezinslid als lid');
select pg_temp.expect_sqlstate(format($q$select public.waste_save(%L, %L, '2591BB', 87, '', %L, '{"rest":[]}'::jsonb, '[]'::jsonb, now())$q$,
  :'fam', :'bas', :'bag'), '42501', 'waste_save met een beheerder van een ander huishouden');
select pg_temp.assert(pg_temp.kalender(:'fam') is null, 'na weigeringen geen adres');

-- =============================================================================
-- Opslaan door het systeem (na requireAdmin), AC-183/AC-219: maker null
-- =============================================================================
select public.waste_save(:'fam', :'jurgen', '2591BB', 87, '', :'bag', '{"rest":[],"papier":[],"pmd":[]}'::jsonb,
  jsonb_build_array(
    pg_temp.afval(current_date + 2, 'out'), pg_temp.afval(current_date + 2, 'in'),
    pg_temp.afval(current_date + 5, 'out'), pg_temp.afval(current_date + 5, 'in'),
    pg_temp.afval(current_date + 8, 'out', array['rest', 'papier']), pg_temp.afval(current_date + 8, 'in', array['rest', 'papier'])),
  now()) as eerste \gset
select pg_temp.assert((:'eerste'::jsonb ->> 'inserted')::int = 6, 'AC-183: 6 afvaltaken aangemaakt, kreeg ' || :'eerste');
select pg_temp.assert((select bool_and(created_by_member_id is null and category = 'outdoor' and recurrence_id is null)
  from public.tasks where household_id = :'fam' and waste_direction is not null), 'AC-219: afvaltaken zonder maker, categorie buiten, geen reeks');
select (pg_temp.kalender(:'fam')).version as v1 \gset

-- Unieke sleutel: nooit twee taken per dag en richting (AC-197)
select pg_temp.expect_sqlstate(format($q$insert into public.tasks (household_id, title, scheduled_date, waste_pickup_date, waste_direction, waste_streams)
  values (%L, 'Dubbel', current_date + 1, current_date + 2, 'out', array['rest'])$q$, :'fam'), '23505', 'AC-197: dubbele sleutel');
-- Vorm: richting, bakken en geen reeks
select pg_temp.expect_sqlstate(format($q$insert into public.tasks (household_id, title, scheduled_date, waste_pickup_date, waste_direction, waste_streams)
  values (%L, 'Fout', current_date, current_date + 20, 'out', array['gft'])$q$, :'fam'), '23514', 'vorm: onbekende bak');
select pg_temp.expect_sqlstate(format($q$insert into public.tasks (household_id, title, scheduled_date, waste_direction)
  values (%L, 'Fout', current_date, 'in')$q$, :'fam'), '23514', 'vorm: richting zonder ophaaldag');

-- =============================================================================
-- Wie leest het adres (AC-190, V-53)
-- =============================================================================
set role authenticated;
select pg_temp.als(:'u_jurgen');
select pg_temp.assert((select count(*) = 1 from public.waste_calendars), 'AC-190: beheerder leest het adres');
select pg_temp.als(:'u_ellen');
select pg_temp.assert((select count(*) = 1 from public.waste_calendars), 'AC-190: tweede beheerder leest het adres');
select pg_temp.als(:'u_lynn');
select pg_temp.assert((select count(*) = 0 from public.waste_calendars), 'AC-190: gezinslid leest geen adres');
select pg_temp.assert(public.waste_calendar_enabled(), 'AC-190: gezinslid ziet dat hij aan staat');
select pg_temp.als(:'u_kai');
select pg_temp.assert((select count(*) = 0 from public.waste_calendars), 'AC-190: uitgezet lid leest niets');
select pg_temp.assert(not public.waste_calendar_enabled(), 'AC-190: uitgezet lid ziet niet dat hij aan staat');
select pg_temp.als(:'u_bas');
select pg_temp.assert((select count(*) = 0 from public.waste_calendars), 'AC-190: buitenstaander leest niets');
select pg_temp.assert(not public.waste_calendar_enabled(), 'AC-190: buitenstaander leert niets over een ander huishouden');
select pg_temp.assert((select count(*) = 0 from public.tasks where household_id = :'fam'), 'BR-26: buitenstaander ziet geen afvaltaken');

-- Schrijven op de tabel: geweigerd voor iedereen, ook beheerders (AC-189)
select pg_temp.als(:'u_jurgen');
select pg_temp.expect_sqlstate(format($q$insert into public.waste_calendars (household_id, postcode, house_number, bag_id, pickups, last_success_at)
  values (%L, '2511AB', 1, '0518200000000001', '{}'::jsonb, now())$q$, :'fam'), '42501', 'AC-189: beheerder schrijft rechtstreeks');
select pg_temp.expect_sqlstate($q$update public.waste_calendars set postcode = '2511AB'$q$, '42501', 'AC-189: beheerder wijzigt rechtstreeks');
select pg_temp.expect_sqlstate($q$delete from public.waste_calendars$q$, '42501', 'AC-189: beheerder verwijdert rechtstreeks');
select pg_temp.als(:'u_lynn');
select pg_temp.expect_sqlstate($q$update public.waste_calendars set postcode = '2511AB'$q$, '42501', 'AC-189: gezinslid wijzigt rechtstreeks');
select pg_temp.expect_sqlstate($q$select public.disable_waste_calendar()$q$, '42501', 'AC-189: gezinslid zet uit');
select pg_temp.als(:'u_kai');
select pg_temp.expect_sqlstate($q$select public.disable_waste_calendar()$q$, '42501', 'AC-189: uitgezet lid zet uit');
select pg_temp.als(:'u_bas');
select pg_temp.expect_sqlstate($q$select public.disable_waste_calendar()$q$, '42501', 'AC-189: beheerder van ander huishouden zonder afvalkalender zet uit');
reset role;
select pg_temp.systeem();
select pg_temp.assert(pg_temp.kalender(:'fam') is not null and pg_temp.afvaltaken(:'fam') = 6, 'AC-189: na alle weigeringen niets veranderd');

-- =============================================================================
-- Alleen het systeem maakt afvaltaken (AC-219), ook met aanmaken uit
-- =============================================================================
update public.households set members_can_create_tasks = false where id = :'fam';
set role authenticated;
select pg_temp.als(:'u_jurgen');
select pg_temp.expect_sqlstate(format($q$insert into public.tasks (household_id, title, scheduled_date, waste_pickup_date, waste_direction, waste_streams)
  values (%L, 'Zelf', current_date, current_date + 20, 'out', array['rest'])$q$, :'fam'), '42501', 'AC-219: beheerder maakt afvaltaak');
select pg_temp.als(:'u_lynn');
select pg_temp.expect_sqlstate(format($q$insert into public.tasks (household_id, title, scheduled_date, waste_pickup_date, waste_direction, waste_streams)
  values (%L, 'Zelf', current_date, current_date + 20, 'out', array['rest'])$q$, :'fam'), '42501', 'AC-219: gezinslid maakt afvaltaak');
reset role;
select pg_temp.systeem();
update public.households set members_can_create_tasks = true where id = :'fam';
set role authenticated;
select pg_temp.als(:'u_lynn');
-- Ook met aanmaken aan: de policy én de guard weigeren afvalvelden
select pg_temp.expect_sqlstate(format($q$insert into public.tasks (household_id, title, scheduled_date, waste_pickup_date, waste_direction, waste_streams)
  values (%L, 'Zelf', current_date, current_date + 21, 'in', array['rest'])$q$, :'fam'), '42501', 'AC-219: gezinslid met aanmaakrecht maakt afvaltaak');
-- Een gewone taak achteraf tot afvaltaak maken
select pg_temp.expect_sqlstate(format($q$update public.tasks set waste_pickup_date = current_date + 22, waste_direction = 'out', waste_streams = array['rest'] where id = %L$q$, :'los'),
  '42501', 'AC-219: gewone taak omzetten naar afvaltaak');

-- =============================================================================
-- Wat niet kan met een afvaltaak (AC-208), voor beheerder én gezinslid
-- =============================================================================
reset role;
select pg_temp.systeem();
select (pg_temp.taak(:'fam', current_date + 2, 'out')).id as out2 \gset
select (pg_temp.taak(:'fam', current_date + 2, 'in')).id as in2 \gset
select (pg_temp.taak(:'fam', current_date + 5, 'out')).id as out5 \gset
select (pg_temp.taak(:'fam', current_date + 5, 'in')).id as in5 \gset
select (pg_temp.taak(:'fam', current_date + 8, 'out')).id as out8 \gset

set role authenticated;
create temp table verboden (sql text);
insert into verboden values
  ('set title = ''Anders'''),
  ('set scheduled_date = scheduled_date + 1'),
  ('set scheduled_time = ''20:00'''),
  ('set due_at = due_at + interval ''1 hour'''),
  ('set available_from = now()'),
  ('set description = ''x'''),
  ('set reminder_minutes_before = ''{30}'''),
  ('set priority = ''high'''),
  ('set category = ''other'''),
  ('set is_exception = true'),
  ('set waste_pickup_date = waste_pickup_date + 1'),
  ('set waste_streams = array[''pmd'']'),
  ('set waste_direction = null, waste_pickup_date = null, waste_streams = null');
grant select on verboden to authenticated;
select pg_temp.als(:'u_jurgen');
select pg_temp.expect_sqlstate(format('update public.tasks %s where id = %L', sql, :'out2'), '42501', 'AC-208 beheerder: ' || sql) from verboden;
select pg_temp.als(:'u_lynn');
select pg_temp.expect_sqlstate(format('update public.tasks %s where id = %L', sql, :'out2'), '42501', 'AC-208 gezinslid: ' || sql) from verboden;
select pg_temp.expect_sqlstate(format('update public.tasks set recurrence_id = %L where id = %L', :'reeks', :'out2'), '42501', 'AC-208: omzetten naar reeks');
select pg_temp.expect_sqlstate(format($q$select public.delete_task(%L)$q$, :'out2'), '42501', 'AC-208: delete_task gezinslid');
select pg_temp.als(:'u_jurgen');
select pg_temp.expect_sqlstate(format($q$select public.delete_task(%L, 'future')$q$, :'out2'), '42501', 'AC-208: delete_task beheerder');
delete from public.tasks where id = :'out2';
reset role;
select pg_temp.systeem();
select pg_temp.assert(pg_temp.afvaltaken(:'fam') = 6, 'AC-208: rechtstreeks verwijderen raakt 0 rijen');
select pg_temp.assert((select title = 'Restafval buitenzetten' and scheduled_time = '21:00' from public.tasks where id = :'out2'),
  'AC-208: na de weigeringen is de taak ongewijzigd');

-- =============================================================================
-- Wat wel kan: elk statuspad als lid (AC-207, AC-208; plan-critic r2)
-- =============================================================================
set role authenticated;
select pg_temp.als(:'u_lynn');
update public.tasks set status = 'in_progress' where id = :'in5';
update public.tasks set status = 'todo' where id = :'in5';
select public.complete_task(:'in5', gen_random_uuid());
reset role; select pg_temp.systeem();
select pg_temp.assert((select status = 'done' and completed_at is not null from public.tasks where id = :'in5'), 'AC-207: lid vinkt binnenzetten af');
select pg_temp.assert((select status = 'todo' from public.tasks where id = :'out5'), 'AC-207: buitenzetten blijft open');
set role authenticated;
select pg_temp.als(:'u_kai');
select pg_temp.expect_sqlstate(format($q$select public.undo_complete_task(%L)$q$, :'in5'), 'P0002', 'uitgezet lid draait niet terug');
select pg_temp.als(:'u_jurgen');
select public.undo_complete_task(:'in5');
reset role; select pg_temp.systeem();
select pg_temp.assert((select status = 'todo' and completed_at is null from public.tasks where id = :'in5'), 'AC-207: terugdraaien zet binnenzetten weer open');
select pg_temp.assert((select count(*) = 0 from public.task_completions where task_id = :'in5'), 'AC-207: historie zonder registratie na terugdraaien');

-- Te laat afvinken registreert "te laat" (AC-192)
update public.tasks set due_at = now() - interval '5 minutes' where id = :'out8';
set role authenticated;
select pg_temp.als(:'u_lynn');
select (public.complete_task(:'out8', gen_random_uuid())).was_late as laat \gset
select pg_temp.assert(:'laat'::boolean, 'AC-192: afvinken na de deadline = te laat');

-- =============================================================================
-- Buitenzetten overslaan neemt binnenzetten mee (AC-209, BR-53)
-- =============================================================================
update public.tasks set status = 'skipped' where id = :'out2';
reset role; select pg_temp.systeem();
select pg_temp.assert((select status = 'skipped' from public.tasks where id = :'in2'), 'AC-209: binnenzetten mee overgeslagen');
set role authenticated;
select pg_temp.als(:'u_lynn');
update public.tasks set status = 'todo' where id = :'out2';
reset role; select pg_temp.systeem();
select pg_temp.assert((select status = 'todo' from public.tasks where id = :'in2'), 'AC-209: ongedaan maken zet beide weer open');
-- Alleen binnenzetten overslaan raakt buitenzetten niet
set role authenticated;
select pg_temp.als(:'u_lynn');
update public.tasks set status = 'skipped' where id = :'in2';
reset role; select pg_temp.systeem();
select pg_temp.assert((select status = 'todo' from public.tasks where id = :'out2'), 'AC-209: binnenzetten overslaan laat buitenzetten ongemoeid');
update public.tasks set status = 'todo' where id = :'in2';
-- Het systeem (vervallen door de tick) werkt NIET door (BR-54)
update public.tasks set status = 'skipped' where id = :'out2';
select pg_temp.assert((select status = 'todo' from public.tasks where id = :'in2'), 'BR-54: automatisch vervallen neemt binnenzetten niet mee');
update public.tasks set status = 'todo' where id = :'out2';

-- =============================================================================
-- Bijwerken (waste_sync): versie, alleen open taken (AC-201, AC-202), storingsstand
-- =============================================================================
-- Verouderde versie → niets
select public.waste_sync(:'fam', :'v1'::bigint - 1, 'success', null, '{"rest":[]}'::jsonb, '[]'::jsonb, '[]'::jsonb, array[:'out2'::uuid], now()) as oud \gset
select pg_temp.assert((:'oud'::jsonb ->> 'stale')::boolean and pg_temp.afvaltaken(:'fam') = 6, 'verouderde versie verandert niets');
-- Hernoemen en verwijderen raken afgevinkte en overgeslagen taken niet
select (pg_temp.taak(:'fam', current_date + 8, 'in')).id as in8 \gset
update public.tasks set status = 'skipped' where id = :'in8';
select public.waste_sync(:'fam', :'v1', null, null, null, '[]'::jsonb,
  jsonb_build_array(jsonb_build_object('id', :'out8', 'title', 'Papier buitenzetten', 'waste_streams', jsonb_build_array('papier')),
                    jsonb_build_object('id', :'in8', 'title', 'Papierbak binnenzetten', 'waste_streams', jsonb_build_array('papier'))),
  array[:'out8'::uuid, :'in8'::uuid], now()) as gedaan \gset
select pg_temp.assert((:'gedaan'::jsonb ->> 'renamed')::int = 0 and (:'gedaan'::jsonb ->> 'removed')::int = 0,
  'AC-202: afgevinkt en overgeslagen blijven onaangetast, kreeg ' || :'gedaan');
-- Open taak: hernoemen werkt
select public.waste_sync(:'fam', :'v1', null, null, null, '[]'::jsonb,
  jsonb_build_array(jsonb_build_object('id', :'out5', 'title', 'Restafval en PMD buitenzetten', 'waste_streams', jsonb_build_array('rest', 'pmd'))),
  '{}'::uuid[], now()) as hernoemd \gset
select pg_temp.assert((select title = 'Restafval en PMD buitenzetten' and waste_streams = array['rest', 'pmd'] from public.tasks where id = :'out5'),
  'AC-201: open taak hernoemd');
-- Mislukte poging: teller en begin van de storing; datums blijven
select public.waste_sync(:'fam', :'v1', 'failure', 'SUSPECT_EMPTY', null, '[]'::jsonb, '[]'::jsonb, '{}'::uuid[], now() - interval '2 hours');
select public.waste_sync(:'fam', :'v1', 'failure', 'SUSPECT_EMPTY', null, '[]'::jsonb, '[]'::jsonb, '{}'::uuid[], now());
select pg_temp.assert((select failure_count = 2 and last_error_code = 'SUSPECT_EMPTY' and first_failure_at < now() - interval '1 hour'
  from public.waste_calendars where household_id = :'fam'), 'BR-52: teller en begin van de storing');
select public.waste_sync(:'fam', :'v1', 'success', null, '{"rest":["2030-01-01"]}'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::uuid[], now());
select pg_temp.assert((select failure_count = 0 and last_error_code is null and first_failure_at is null and pickups ? 'rest'
  from public.waste_calendars where household_id = :'fam'), 'BR-52: na succes is de storing weg');
select pg_temp.expect_sqlstate(format($q$select public.waste_sync(%L, %s, 'onzin', null, null, '[]'::jsonb, '[]'::jsonb, '{}'::uuid[], now())$q$, :'fam', :'v1'),
  '22023', 'waste_sync: onbekend resultaat');

-- =============================================================================
-- Ander adres (AC-214): open weg, gedane blijven, nieuwe versie
-- =============================================================================
select public.waste_save(:'fam', :'jurgen', '2511AB', 12, 'A', '0518200000000002', '{"rest":[],"papier":[],"pmd":[]}'::jsonb,
  jsonb_build_array(pg_temp.afval(current_date + 3, 'out'), pg_temp.afval(current_date + 3, 'in'),
                    pg_temp.afval(current_date + 8, 'out'), pg_temp.afval(current_date + 8, 'in')),
  now()) as tweede \gset
select pg_temp.assert((:'tweede'::jsonb ->> 'removed')::int = 4, 'AC-214: open afvaltaken van het oude adres weg, kreeg ' || :'tweede');
select pg_temp.assert((select status = 'done' from public.tasks where id = :'out8') and (select status = 'skipped' from public.tasks where id = :'in8'),
  'AC-214: afgevinkt en overgeslagen blijven');
select pg_temp.assert((:'tweede'::jsonb ->> 'inserted')::int = 2, 'AC-214: dag 8 bestaat al (gedaan), alleen dag 3 erbij');
select pg_temp.assert((pg_temp.kalender(:'fam')).version > :'v1'::bigint and (pg_temp.kalender(:'fam')).postcode = '2511AB',
  'AC-214: nieuw adres met nieuwe versie');
select (pg_temp.kalender(:'fam')).version as v2 \gset

-- Handmatige taken ongemoeid (AC-215)
select pg_temp.assert((select count(*) = 2 from public.tasks where id in (:'handmatig', :'los') and status = 'todo' and deleted_at is null),
  'AC-215: handmatige reeks en losse taak ongemoeid');

-- =============================================================================
-- Uitzetten (AC-213)
-- =============================================================================
set role authenticated;
select pg_temp.als(:'u_ellen');
select public.disable_waste_calendar() as uit \gset
reset role; select pg_temp.systeem();
select pg_temp.assert(:'uit'::int = 2, 'AC-213: twee open afvaltaken vervallen, kreeg ' || :'uit');
select pg_temp.assert(pg_temp.kalender(:'fam') is null, 'AC-213: adres, datums en stand weg');
select pg_temp.assert(pg_temp.afvaltaken(:'fam', 'todo') = 0 and pg_temp.afvaltaken(:'fam', 'in_progress') = 0, 'AC-213: geen open afvaltaken meer');
select pg_temp.assert(pg_temp.afvaltaken(:'fam', 'done') = 1 and pg_temp.afvaltaken(:'fam', 'skipped') = 1, 'AC-213: historie blijft');
select pg_temp.assert((select count(*) = 2 from public.tasks where id in (:'handmatig', :'los') and deleted_at is null), 'AC-215: uitzetten raakt handmatige taken niet');
set role authenticated;
select pg_temp.als(:'u_lynn');
select pg_temp.assert(not public.waste_calendar_enabled(), 'AC-213: gezinslid ziet geen "staat aan" meer');
select pg_temp.als(:'u_jurgen');
select pg_temp.assert(public.disable_waste_calendar() = 0, 'AC-213: tweede keer uitzetten = 0');
reset role; select pg_temp.systeem();

-- Opnieuw aanzetten: de oude versie wordt nooit hergebruikt (plan-critic r3)
select public.waste_save(:'fam', :'jurgen', '2591BB', 87, '', :'bag', '{"rest":[]}'::jsonb, '[]'::jsonb, now());
select pg_temp.assert((pg_temp.kalender(:'fam')).version > :'v2'::bigint, 'na opnieuw aanzetten een nieuwe versie');
select public.waste_sync(:'fam', :'v2', 'success', null, '{"rest":[]}'::jsonb, jsonb_build_array(pg_temp.afval(current_date + 9, 'out')), '[]'::jsonb, '{}'::uuid[], now()) as abc \gset
select pg_temp.assert((:'abc'::jsonb ->> 'stale')::boolean and pg_temp.taak(:'fam', current_date + 9, 'out') is null,
  'een verouderd plan van vóór het uitzetten landt niet op het nieuwe adres');

-- =============================================================================
-- Huishouden verwijderen wist alles (AC-216), ander huishouden ongemoeid
-- =============================================================================
select public.waste_save(:'buren', :'bas', '2595AA', 1, '', '0518200000000009', '{"rest":[]}'::jsonb,
  jsonb_build_array(pg_temp.afval(current_date + 4, 'out')), now());
set role authenticated;
select pg_temp.als(:'u_jurgen');
select public.delete_household('Familie Afval');
reset role; select pg_temp.systeem();
select pg_temp.assert(pg_temp.kalender(:'fam') is null and (select count(*) = 0 from public.tasks where household_id = :'fam'),
  'AC-216: adres en afvaltaken van het verwijderde huishouden weg');
select pg_temp.assert(pg_temp.kalender(:'buren') is not null and pg_temp.afvaltaken(:'buren') = 1, 'AC-216: ander huishouden ongemoeid');

\o
select 'WP3b: afvalkalender (…_400, …_410) geslaagd' as resultaat;
