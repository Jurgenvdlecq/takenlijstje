-- =============================================================================
-- Tests: WP2a — scope uit de database, expand-migratie …_200
-- (TECHNICAL_DESIGN §3.1, §3.3, §4.5, §4.6, §6, §7; ACCEPTANCE_CRITERIA WP2)
-- Draait ná 10_ en 20_ in dezelfde database, met eigen accounts en eigen
-- huishoudens. AC-053 en AC-179 staan in supabase/tests/upgrade/ (kopie van het
-- oude schema).
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

-- Fout als tekst ("SQLSTATE: melding"), of 'GEEN FOUT'
create or replace function pg_temp.fout(p_sql text)
returns text language plpgsql as $$
declare
  v_state text;
  v_msg text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    return v_state || ': ' || v_msg;
  end;
  return 'GEEN FOUT';
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

-- Geweigerd = een fout, of 0 geraakte rijen (stille RLS-weigering)
create or replace function pg_temp.geweigerd(p_sql text)
returns boolean language plpgsql as $$
declare
  v_count integer;
begin
  begin
    execute p_sql;
    get diagnostics v_count = row_count;
  exception when others then
    return true;
  end;
  return v_count = 0;
end;
$$;

create or replace function pg_temp.als(p_user uuid)
returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, false);
$$;

-- Lezen ongeacht RLS (eigenaar is de superuser)
create or replace function pg_temp.taak(p_id uuid)
returns public.tasks language sql security definer as $$
  select * from public.tasks where id = p_id;
$$;
create or replace function pg_temp.afvinking(p_id uuid)
returns public.task_completions language sql security definer as $$
  select * from public.task_completions where id = p_id;
$$;
create or replace function pg_temp.afvinkingen(p_task uuid)
returns integer language sql security definer as $$
  select count(*)::integer from public.task_completions where task_id = p_task;
$$;
create or replace function pg_temp.notitie(p_id uuid)
returns public.task_comments language sql security definer as $$
  select * from public.task_comments where id = p_id;
$$;
create or replace function pg_temp.voorkeur(p_member uuid)
returns public.user_preferences language sql security definer as $$
  select * from public.user_preferences where member_id = p_member;
$$;
create or replace function pg_temp.lid(p_id uuid)
returns public.household_members language sql security definer as $$
  select * from public.household_members where id = p_id;
$$;
create or replace function pg_temp.lidmaatschappen(p_user uuid)
returns integer language sql security definer as $$
  select count(*)::integer from public.household_members where user_id = p_user;
$$;
create or replace function pg_temp.lijst(p_id uuid)
returns public.shopping_lists language sql security definer as $$
  select * from public.shopping_lists where id = p_id;
$$;
create or replace function pg_temp.actieve_lijsten(p_household uuid)
returns integer language sql security definer as $$
  select count(*)::integer from public.shopping_lists where household_id = p_household and archived_at is null;
$$;
create or replace function pg_temp.items(p_list uuid)
returns text language sql security definer as $$
  select coalesce(string_agg(name || case when is_bought then '+' else '-' end, ',' order by name), '')
  from public.shopping_items where list_id = p_list;
$$;
-- Vingerafdruk van alles wat bij een taak hoort (taak + historie)
create or replace function pg_temp.taak_fp(p_task uuid)
returns text language sql security definer as $$
  select md5(
    coalesce((select row(t.*)::text from public.tasks t where t.id = p_task), '-')
    || '#' || coalesce((select string_agg(row(c.*)::text, '|' order by c.id) from public.task_completions c where c.task_id = p_task), '-')
  );
$$;
-- Rijen van een huishouden in alle tabellen met household_id, ongeacht RLS
create or replace function pg_temp.rijen_van(p_household uuid)
returns text language plpgsql security definer as $$
declare
  v_table text;
  v_count integer;
  v_result text := '';
begin
  select count(*) into v_count from public.households where id = p_household;
  if v_count > 0 then v_result := v_result || 'households=' || v_count || ' '; end if;
  for v_table in
    select c.table_name from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'household_id' and t.table_type = 'BASE TABLE'
    order by 1
  loop
    execute format('select count(*) from public.%I where household_id = %L', v_table, p_household) into v_count;
    if v_count > 0 then v_result := v_result || v_table || '=' || v_count || ' '; end if;
  end loop;
  return v_result;
end;
$$;

grant execute on all functions in schema pg_temp to authenticated;

-- -----------------------------------------------------------------------------
-- Testdata
-- -----------------------------------------------------------------------------
\set u_jurgen '30000000-0000-0000-0000-0000000000a1'
\set u_ellen  '30000000-0000-0000-0000-0000000000a2'
\set u_lynn   '30000000-0000-0000-0000-0000000000a3'
\set u_kai    '30000000-0000-0000-0000-0000000000a4'
\set u_bas    '30000000-0000-0000-0000-0000000000a5'
\set u_buur   '30000000-0000-0000-0000-0000000000a6'
\set u_noor   '30000000-0000-0000-0000-0000000000a7'
\set u_mila   '30000000-0000-0000-0000-0000000000a8'
\set u_tim    '30000000-0000-0000-0000-0000000000a9'
\set u_solo   '30000000-0000-0000-0000-0000000000b1'
\set u_piet   '30000000-0000-0000-0000-0000000000b2'
\set u_nieuw  '30000000-0000-0000-0000-0000000000b3'
\set u_zonder '30000000-0000-0000-0000-0000000000b4'

insert into auth.users (id, email, raw_user_meta_data) values
  (:'u_jurgen', 'jurgen.wp2a@example.com', '{"display_name":"Jurgen"}'),
  (:'u_ellen',  'ellen.wp2a@example.com',  '{"display_name":"Ellen"}'),
  (:'u_lynn',   'lynn.wp2a@example.com',   '{"display_name":"Lynn"}'),
  (:'u_kai',    'kai.wp2a@example.com',    '{"display_name":"Kai"}'),
  (:'u_bas',    'bas.wp2a@example.com',    '{"display_name":"Bas"}'),
  (:'u_buur',   'buur.wp2a@example.com',   '{"display_name":"Buur"}'),
  (:'u_noor',   'noor.wp2a@example.com',   '{"display_name":"Noor"}'),
  (:'u_mila',   'mila.wp2a@example.com',   '{"display_name":"Mila"}'),
  (:'u_tim',    'tim.wp2a@example.com',    '{"display_name":"Tim"}'),
  (:'u_solo',   'solo.wp2a@example.com',   '{"display_name":"Solo"}'),
  (:'u_piet',   'piet.wp2a@example.com',   '{"display_name":"Piet"}'),
  (:'u_nieuw',  'nieuw.wp2a@example.com',  '{"display_name":"Nieuw"}'),
  (:'u_zonder', 'zonder.wp2a@example.com', '{"display_name":"Zonder"}');

set role authenticated;

-- Familie: Jurgen maakt aan, met een andere tijdzone als invoer (V-39)
select pg_temp.als(:'u_jurgen');
select public.create_household('Familie WP2a', 'Jurgen', '#2563eb', null, 'America/New_York') as fam \gset
select id as jurgen from public.household_members where household_id = :'fam' and user_id = :'u_jurgen' \gset

-- =============================================================================
-- Tijdzone vast op Europe/Amsterdam (V-39, TD §6.2)
-- =============================================================================
select pg_temp.assert((select timezone = 'Europe/Amsterdam' from public.households where id = :'fam'),
  'V-39: create_household negeert p_timezone');
-- De check op de tabel (households_timezone_amsterdam) staat sinds D-037 in …_210;
-- die toetst 40_wp2b.sql.

-- Leden via uitnodiging: Ellen en Tim beheerder; Lynn, Kai, Noor en Mila gezinslid
insert into public.household_invitations (household_id, email, role, invited_by_member_id) values
  (:'fam', 'ellen.wp2a@example.com', 'admin',  :'jurgen'),
  (:'fam', 'tim.wp2a@example.com',   'admin',  :'jurgen'),
  (:'fam', 'lynn.wp2a@example.com',  'member', :'jurgen'),
  (:'fam', 'kai.wp2a@example.com',   'member', :'jurgen'),
  (:'fam', 'noor.wp2a@example.com',  'member', :'jurgen'),
  (:'fam', 'mila.wp2a@example.com',  'member', :'jurgen');
select token as tok_ellen from public.household_invitations where email = 'ellen.wp2a@example.com' \gset
select token as tok_tim   from public.household_invitations where email = 'tim.wp2a@example.com' \gset
select token as tok_lynn  from public.household_invitations where email = 'lynn.wp2a@example.com' \gset
select token as tok_kai   from public.household_invitations where email = 'kai.wp2a@example.com' \gset
select token as tok_noor  from public.household_invitations where email = 'noor.wp2a@example.com' \gset
select token as tok_mila  from public.household_invitations where email = 'mila.wp2a@example.com' \gset
select pg_temp.als(:'u_ellen'); select public.accept_invitation(:'tok_ellen', 'Ellen');
select pg_temp.als(:'u_tim');   select public.accept_invitation(:'tok_tim', 'Tim');
select pg_temp.als(:'u_lynn');  select public.accept_invitation(:'tok_lynn', 'Lynn');
select pg_temp.als(:'u_kai');   select public.accept_invitation(:'tok_kai', 'Kai');
select pg_temp.als(:'u_noor');  select public.accept_invitation(:'tok_noor', 'Noor');
select pg_temp.als(:'u_mila');  select public.accept_invitation(:'tok_mila', 'Mila');
select pg_temp.als(:'u_jurgen');
select id as ellen from public.household_members where household_id = :'fam' and user_id = :'u_ellen' \gset
select id as tim   from public.household_members where household_id = :'fam' and user_id = :'u_tim' \gset
select id as lynn  from public.household_members where household_id = :'fam' and user_id = :'u_lynn' \gset
select id as kai   from public.household_members where household_id = :'fam' and user_id = :'u_kai' \gset
select id as noor  from public.household_members where household_id = :'fam' and user_id = :'u_noor' \gset
select id as mila  from public.household_members where household_id = :'fam' and user_id = :'u_mila' \gset

-- Buren: Bas (beheerder) en Buur (gezinslid) — buitenstaanders voor Familie
select pg_temp.als(:'u_bas');
select public.create_household('Buren WP2a', 'Bas') as buren \gset
select id as bas from public.household_members where household_id = :'buren' and user_id = :'u_bas' \gset
insert into public.household_invitations (household_id, email, role, invited_by_member_id)
values (:'buren', 'buur.wp2a@example.com', 'member', :'bas') returning token as tok_buur \gset
select pg_temp.als(:'u_buur'); select public.accept_invitation(:'tok_buur', 'Buur');
select pg_temp.als(:'u_bas');
select id as buur from public.household_members where household_id = :'buren' and user_id = :'u_buur' \gset

-- =============================================================================
-- AC-052 — standaard meldingsvoorkeuren per rol (V-23, TD §3.3)
-- =============================================================================
select pg_temp.assert((select notify_reminders and notify_deadline_soon and notify_overdue and daily_summary_enabled
                              and evening_summary_enabled and not notify_task_completed
                       from pg_temp.voorkeur(:'jurgen')), 'AC-052: maker (beheerder) via create_household: alles aan behalve taak gedaan');
select pg_temp.assert((select notify_reminders and notify_deadline_soon and notify_overdue and daily_summary_enabled
                              and evening_summary_enabled and not notify_task_completed
                       from pg_temp.voorkeur(:'ellen')), 'AC-052: beheerder via uitnodiging: alles aan behalve taak gedaan');
select pg_temp.assert((select not (notify_reminders or notify_deadline_soon or notify_overdue or daily_summary_enabled
                                   or evening_summary_enabled or notify_task_completed)
                       from pg_temp.voorkeur(:'lynn')), 'AC-052: gezinslid: alles uit');
select pg_temp.assert((select not (notify_reminders or notify_deadline_soon or notify_overdue or daily_summary_enabled
                                   or evening_summary_enabled or notify_task_completed)
                       from pg_temp.voorkeur(:'buur')), 'AC-052: gezinslid in ander huishouden: alles uit');
-- Een latere rolwijziging verandert de voorkeuren niet
select pg_temp.als(:'u_jurgen');
select row(pg_temp.voorkeur(:'lynn'))::text as pref_lynn_voor \gset
select row(pg_temp.voorkeur(:'ellen'))::text as pref_ellen_voor \gset
update public.household_members set role = 'admin' where id = :'lynn';
update public.household_members set role = 'member' where id = :'ellen';
select pg_temp.assert(row(pg_temp.voorkeur(:'lynn'))::text = :'pref_lynn_voor', 'AC-052: gezinslid → beheerder: voorkeuren ongewijzigd');
select pg_temp.assert(row(pg_temp.voorkeur(:'ellen'))::text = :'pref_ellen_voor', 'AC-052: beheerder → gezinslid: voorkeuren ongewijzigd');
update public.household_members set role = 'member' where id = :'lynn';
update public.household_members set role = 'admin' where id = :'ellen';

-- =============================================================================
-- AC-034 — afvinken registreert geen persoon (V-21)
-- =============================================================================
select pg_temp.als(:'u_jurgen');
insert into public.tasks (household_id, title, category, scheduled_date, due_at, duration_minutes, created_by_member_id)
values (:'fam', 'Vaatwasser uitruimen', 'cleaning', current_date, now() + interval '3 hours', 10, :'jurgen') returning id as t_vaat \gset

select pg_temp.als(:'u_ellen');
select (public.complete_task(:'t_vaat', '30000000-1111-0000-0000-000000000001', 'Tabletten zijn op')).id as c_vaat \gset
select pg_temp.assert((select title = 'Vaatwasser uitruimen' and category = 'cleaning' and scheduled_date = current_date
                              and due_at is not null and not was_late and minutes_late = 0 and duration_minutes = 10
                              and note = 'Tabletten zijn op' and completed_at is not null
                       from pg_temp.afvinking(:'c_vaat')), 'AC-034: historie-rij bevat wat, wanneer, deadline, duur en notitie');
-- WP2b: de kolommen member_id en points bestaan niet meer (40_wp2b.sql toetst dat);
-- de inhoudscontrole hieronder blijft: geen enkel veld verwijst naar Ellen
select pg_temp.assert(row(pg_temp.afvinking(:'c_vaat'))::text not like '%' || :'ellen' || '%'
                      and row(pg_temp.afvinking(:'c_vaat'))::text not like '%' || :'u_ellen' || '%',
  'AC-034: geen enkel veld van de historie verwijst naar Ellen');
select pg_temp.assert((pg_temp.taak(:'t_vaat')).status = 'done', 'AC-034: taakrij is gedaan');
select pg_temp.assert(row(pg_temp.taak(:'t_vaat'))::text not like '%' || :'ellen' || '%',
  'AC-034: geen enkel veld van de taakrij verwijst naar Ellen');

-- =============================================================================
-- AC-036 — dubbel tikken geeft één registratie (BR-10, BR-11)
-- =============================================================================
select (public.complete_task(:'t_vaat', '30000000-1111-0000-0000-000000000001', 'Tabletten zijn op')).id as c_vaat_2 \gset
select pg_temp.assert(:'c_vaat_2' = :'c_vaat', 'AC-036: dezelfde mutationId geeft dezelfde registratie terug');
select pg_temp.als(:'u_jurgen');
select (public.complete_task(:'t_vaat', '30000000-1111-0000-0000-000000000002')).id as c_vaat_3 \gset
select pg_temp.assert(:'c_vaat_3' = :'c_vaat', 'AC-036/§7: tweede afvinker (andere mutationId) krijgt de bestaande registratie');
select pg_temp.assert(pg_temp.afvinkingen(:'t_vaat') = 1, 'AC-036: precies één historie-rij');

-- =============================================================================
-- Oude signatuur met p_completed_by: sinds …_210 verdwenen (AC-045, WP2b)
-- In WP2a toetste dit blok dat de oude signatuur geen persoon meer schreef; die
-- functie bestaat niet meer. Nu: elke aanroep met p_completed_by faalt en
-- verandert niets (uitgebreider in 40_wp2b.sql).
-- =============================================================================
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'fam', 'Kattenbak', current_date, :'jurgen') returning id as t_kat \gset
select pg_temp.als(:'u_lynn');
-- Zoals de vorige app-versie het via PostgREST deed (namen), "namens" Kai
select pg_temp.expect_sqlstate(format(
  $$select public.complete_task(p_task_id => %L, p_mutation_id => gen_random_uuid(), p_completed_by => %L, p_note => 'Namens Kai')$$,
  :'t_kat', :'kai'), '42883', 'AC-045: oude signatuur met namen bestaat niet meer');
-- Positioneel met een uuid op de derde plek
select pg_temp.expect_sqlstate(format($$select public.complete_task(%L::uuid, gen_random_uuid(), %L::uuid)$$, :'t_kat', :'lynn'), '42883',
  'AC-045: oude signatuur positioneel bestaat niet meer');
select pg_temp.assert((pg_temp.taak(:'t_kat')).status = 'todo' and pg_temp.afvinkingen(:'t_kat') = 0,
  'AC-045: mislukte oude aanroepen vinken niets af');

-- =============================================================================
-- AC-038 — te laat wordt vastgelegd (deadline 12:00 → 12:07 en 11:59)
-- =============================================================================
select pg_temp.als(:'u_jurgen');
select date_trunc('minute', now()) - interval '2 hours' as deadline \gset
insert into public.tasks (household_id, title, scheduled_date, due_at, created_by_member_id)
values (:'fam', 'Afval buiten', current_date, :'deadline', :'jurgen') returning id as t_laat \gset
insert into public.tasks (household_id, title, scheduled_date, due_at, created_by_member_id)
values (:'fam', 'Papier buiten', current_date, :'deadline', :'jurgen') returning id as t_optijd \gset
select (public.complete_task(:'t_laat', gen_random_uuid(), null, (:'deadline'::timestamptz + interval '7 minutes'))).id as c_laat \gset
select (public.complete_task(:'t_optijd', gen_random_uuid(), null, (:'deadline'::timestamptz - interval '1 minute'))).id as c_optijd \gset
select pg_temp.assert((select was_late and minutes_late = 7 from pg_temp.afvinking(:'c_laat')), 'AC-038: 7 minuten na de deadline → te laat, 7');
select pg_temp.assert((select not was_late and minutes_late = 0 from pg_temp.afvinking(:'c_optijd')), 'AC-038: 1 minuut ervoor → op tijd, 0');

-- =============================================================================
-- AC-039 — offline afvinkmoment wordt begrensd (in één transactie: now() vast)
-- =============================================================================
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'fam', 'Toekomst', current_date, :'jurgen') returning id as t_toekomst \gset
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'fam', 'Lang geleden', current_date - 12, :'jurgen') returning id as t_oud \gset
begin;
select (public.complete_task(:'t_toekomst', gen_random_uuid(), null, now() + interval '1 day')).id as c_toekomst \gset
select (public.complete_task(:'t_oud', gen_random_uuid(), null, now() - interval '10 days')).id as c_oud \gset
select pg_temp.assert((pg_temp.afvinking(:'c_toekomst')).completed_at = now(), 'AC-039: moment in de toekomst wordt "nu"');
select pg_temp.assert((pg_temp.afvinking(:'c_oud')).completed_at = now() - interval '7 days', 'AC-039: 10 dagen terug wordt "nu − 7 dagen"');
select pg_temp.assert((pg_temp.taak(:'t_oud')).completed_at = now() - interval '7 days', 'AC-039: taakrij krijgt hetzelfde begrensde moment');
commit;

-- =============================================================================
-- AC-040 — historie blijft na stoppen en verwijderen
-- =============================================================================
insert into public.task_recurrences (household_id, title, rule, starts_on, generated_until, created_by_member_id)
values (:'fam', 'Planten water', '{"freq":"weekly","interval":1}', current_date - 21, current_date + 7, :'jurgen')
returning id as r_plant \gset
insert into public.tasks (household_id, recurrence_id, occurrence_date, scheduled_date, title, created_by_member_id) values
  (:'fam', :'r_plant', current_date - 21, current_date - 21, 'Planten water', :'jurgen'),
  (:'fam', :'r_plant', current_date - 14, current_date - 14, 'Planten water', :'jurgen'),
  (:'fam', :'r_plant', current_date - 7,  current_date - 7,  'Planten water', :'jurgen'),
  (:'fam', :'r_plant', current_date + 7,  current_date + 7,  'Planten water', :'jurgen');
select public.complete_task(id, gen_random_uuid()) from public.tasks where recurrence_id = :'r_plant' and scheduled_date < current_date;
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'fam', 'Fietsband plakken', current_date, :'jurgen') returning id as t_fiets \gset
select (public.complete_task(:'t_fiets', gen_random_uuid())).id as c_fiets \gset

select public.stop_series(:'r_plant');
select pg_temp.assert((select count(*) = 3 and bool_and(title = 'Planten water') from public.task_completions where recurrence_id = :'r_plant'),
  'AC-040: na stoppen bestaan de 3 historie-rijen nog, met titel');
select public.delete_task(:'t_fiets', 'this');
select pg_temp.assert((pg_temp.taak(:'t_fiets')).deleted_at is not null, 'AC-040: afgevinkte losse taak wordt zacht verwijderd');
select pg_temp.assert((select title = 'Fietsband plakken' from pg_temp.afvinking(:'c_fiets')), 'AC-040: historie van de verwijderde taak blijft');
-- Ook als de taakrij echt verdwijnt (FK set null), blijft de historie met titel
reset role;
delete from public.tasks where id = :'t_fiets';
select pg_temp.assert((select task_id is null and title = 'Fietsband plakken' from pg_temp.afvinking(:'c_fiets')),
  'AC-040: harde verwijdering laat de historie staan (task_id leeg, titel blijft)');
set role authenticated;

-- =============================================================================
-- AC-041 — iedereen mag terugdraaien, ook later (V-22)
-- =============================================================================
select pg_temp.als(:'u_ellen');
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'fam', 'Ramen zemen', current_date - 1, :'ellen') returning id as t_ramen \gset
select public.complete_task(:'t_ramen', gen_random_uuid(), null, now() - interval '1 day');
select pg_temp.als(:'u_lynn');
select (public.undo_complete_task(:'t_ramen')).status as undo_status \gset
select pg_temp.assert(:'undo_status' = 'todo', 'AC-041: gezinslid draait een afvinking van gisteren terug');
select pg_temp.assert((select status = 'todo' and completed_at is null from pg_temp.taak(:'t_ramen')),
  'AC-041: taak staat weer open');
select pg_temp.assert(pg_temp.afvinkingen(:'t_ramen') = 0, 'AC-041: historie-rij is verwijderd');
-- Ook de afvinking van een beheerder, door een ander gezinslid
select pg_temp.als(:'u_jurgen');
select public.complete_task(:'t_ramen', gen_random_uuid());
select pg_temp.als(:'u_kai');
select public.undo_complete_task(:'t_ramen');
select pg_temp.assert((pg_temp.taak(:'t_ramen')).status = 'todo' and pg_temp.afvinkingen(:'t_ramen') = 0,
  'AC-041: Kai draait de afvinking van Jurgen terug');

-- =============================================================================
-- AC-042 — terugdraaien van een open taak doet niets
-- =============================================================================
select pg_temp.taak_fp(:'t_ramen') as fp_ramen \gset
select (public.undo_complete_task(:'t_ramen')).status as undo1 \gset
select (public.undo_complete_task(:'t_ramen')).status as undo2 \gset
select pg_temp.assert(:'undo1' = 'todo' and :'undo2' = 'todo', 'AC-042: geen fout, taak blijft open');
select pg_temp.assert(pg_temp.taak_fp(:'t_ramen') = :'fp_ramen', 'AC-042: er is niets veranderd');

-- =============================================================================
-- Security-review WP1 N2: vreemde en onbekende taak geven dezelfde uitkomst
-- =============================================================================
select pg_temp.als(:'u_jurgen');
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'fam', 'Geheim', current_date, :'jurgen') returning id as t_geheim \gset
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'fam', 'Geheim gedaan', current_date, :'jurgen') returning id as t_geheim_gedaan \gset
select public.complete_task(:'t_geheim_gedaan', '30000000-1111-0000-0000-0000000000f1');
select pg_temp.taak_fp(:'t_geheim') as fp_geheim \gset
select pg_temp.taak_fp(:'t_geheim_gedaan') as fp_geheim_gedaan \gset

select pg_temp.als(:'u_bas');
select pg_temp.fout(format($$select public.complete_task(%L, gen_random_uuid())$$, gen_random_uuid())) as f_onbekend \gset
select pg_temp.fout(format($$select public.complete_task(%L, gen_random_uuid())$$, :'t_geheim')) as f_vreemd \gset
select pg_temp.fout(format($$select public.complete_task(%L, gen_random_uuid())$$, :'t_geheim_gedaan')) as f_vreemd_gedaan \gset
select pg_temp.fout(format($$select public.complete_task(%L, '30000000-1111-0000-0000-0000000000f1')$$, gen_random_uuid())) as f_vreemde_mutatie \gset
select pg_temp.assert(:'f_onbekend' like 'P0002:%', 'N2: onbekende taak → P0002, kreeg: ' || :'f_onbekend');
select pg_temp.assert(:'f_vreemd' = :'f_onbekend', 'N2: complete_task vreemd = onbekend, kreeg: ' || :'f_vreemd');
select pg_temp.assert(:'f_vreemd_gedaan' = :'f_onbekend', 'N2: complete_task op gedane vreemde taak = onbekend, kreeg: ' || :'f_vreemd_gedaan');
select pg_temp.assert(:'f_vreemde_mutatie' = :'f_onbekend', 'N2: mutationId van ander huishouden = onbekend, kreeg: ' || :'f_vreemde_mutatie');

select pg_temp.fout(format($$select public.undo_complete_task(%L)$$, gen_random_uuid())) as u_onbekend \gset
select pg_temp.fout(format($$select public.undo_complete_task(%L)$$, :'t_geheim')) as u_vreemd \gset
select pg_temp.fout(format($$select public.undo_complete_task(%L)$$, :'t_geheim_gedaan')) as u_vreemd_gedaan \gset
select pg_temp.assert(:'u_onbekend' like 'P0002:%', 'N2: undo onbekend → P0002, kreeg: ' || :'u_onbekend');
select pg_temp.assert(:'u_vreemd' = :'u_onbekend', 'N2: undo vreemd = onbekend, kreeg: ' || :'u_vreemd');
select pg_temp.assert(:'u_vreemd_gedaan' = :'u_onbekend', 'N2: undo gedane vreemde taak = onbekend, kreeg: ' || :'u_vreemd_gedaan');
select pg_temp.fout(format($$select public.complete_task(p_task_id => %L, p_mutation_id => gen_random_uuid(), p_completed_by => %L)$$, :'t_geheim', :'bas')) as f_oud_vreemd \gset
select pg_temp.fout(format($$select public.complete_task(p_task_id => %L, p_mutation_id => gen_random_uuid(), p_completed_by => %L)$$, gen_random_uuid(), :'bas')) as f_oud_onbekend \gset
-- WP2b: de oude signatuur bestaat niet meer; vreemd en onbekend geven nog steeds
-- precies dezelfde fout (42883, geen orakel)
select pg_temp.assert(:'f_oud_vreemd' like '42883:%' and :'f_oud_vreemd' = :'f_oud_onbekend',
  'N2: oude signatuur vreemd = onbekend, kreeg: ' || :'f_oud_vreemd' || ' / ' || :'f_oud_onbekend');
select pg_temp.assert(pg_temp.taak_fp(:'t_geheim') = :'fp_geheim' and pg_temp.taak_fp(:'t_geheim_gedaan') = :'fp_geheim_gedaan',
  'N2: pogingen van een buitenstaander veranderen niets');

-- Een zacht verwijderde eigen taak gedraagt zich ook als onbekend
select pg_temp.als(:'u_jurgen');
insert into public.tasks (household_id, recurrence_id, occurrence_date, scheduled_date, title, created_by_member_id)
values (:'fam', :'r_plant', current_date + 30, current_date + 30, 'Planten water', :'jurgen') returning id as t_weg \gset
select public.delete_task(:'t_weg', 'this');
select pg_temp.fout(format($$select public.complete_task(%L, gen_random_uuid())$$, :'t_weg')) as f_weg \gset
select pg_temp.assert(:'f_weg' = :'f_onbekend', 'verwijderde taak afvinken = onbekend, kreeg: ' || :'f_weg');

-- =============================================================================
-- AC-046 — één huishouden per persoon (BR-44)
-- =============================================================================
\set br44 'P0001: Je hoort al bij een ander huishouden. Je kunt maar bij één huishouden horen.'
select pg_temp.als(:'u_lynn');
select pg_temp.fout($$select public.create_household('Eigen huis', 'Lynn')$$) as f_br44_nieuw \gset
select pg_temp.assert(:'f_br44_nieuw' = :'br44', 'AC-046: lid maakt tweede huishouden, kreeg: ' || :'f_br44_nieuw');
select pg_temp.als(:'u_bas');
insert into public.household_invitations (household_id, email, invited_by_member_id)
values (:'buren', 'lynn.wp2a@example.com', :'bas') returning token as tok_buren_lynn \gset
select pg_temp.als(:'u_lynn');
select pg_temp.fout(format($$select public.accept_invitation(%L, 'Lynn')$$, :'tok_buren_lynn')) as f_br44_uitn \gset
select pg_temp.assert(:'f_br44_uitn' = :'br44', 'AC-046: lid accepteert uitnodiging van ander huishouden, kreeg: ' || :'f_br44_uitn');
select pg_temp.assert(pg_temp.lidmaatschappen(:'u_lynn') = 1, 'AC-046: geen tweede lidmaatschap');
select pg_temp.assert((select count(*) = 0 from public.households where name = 'Eigen huis'), 'AC-046: geen nieuw huishouden');
-- Ook een uitgezet lid hoort nog bij het huishouden (V-29: weer aanzetten herstelt alles)
select pg_temp.als(:'u_jurgen');
update public.household_members set is_active = false where id = :'mila';
select pg_temp.als(:'u_mila');
select pg_temp.fout($$select public.create_household('Mila huis', 'Mila')$$) as f_br44_uit \gset
select pg_temp.assert(:'f_br44_uit' = :'br44', 'AC-046: uitgezet lid maakt geen tweede huishouden, kreeg: ' || :'f_br44_uit');

-- =============================================================================
-- AC-047 — uitnodigingsregels (BR-41, UX §4.11)
-- =============================================================================
select pg_temp.als(:'u_jurgen');
insert into public.household_invitations (household_id, email, invited_by_member_id)
values (:'fam', null, :'jurgen') returning token as tok_open, expires_at as exp_open \gset
select pg_temp.assert(:'exp_open'::timestamptz between now() + interval '14 days' - interval '1 minute' and now() + interval '14 days' + interval '1 minute',
  'AC-047: een uitnodiging is 14 dagen geldig');
insert into public.household_invitations (household_id, email, invited_by_member_id, expires_at)
values (:'fam', null, :'jurgen', now() - interval '1 minute') returning token as tok_verlopen \gset
insert into public.household_invitations (household_id, email, invited_by_member_id)
values (:'fam', 'x@example.com', :'jurgen') returning token as tok_x \gset
insert into public.household_invitations (household_id, email, invited_by_member_id)
values (:'fam', 'lynn.wp2a@example.com', :'jurgen') returning id as inv_lynn2, token as tok_lynn2 \gset

select pg_temp.als(:'u_nieuw');
select pg_temp.fout(format($$select public.accept_invitation(%L, 'Nieuw')$$, :'tok_verlopen')) as f_verlopen \gset
select pg_temp.assert(:'f_verlopen' = 'P0002: Uitnodiging is ongeldig of verlopen', 'AC-047: verlopen uitnodiging, kreeg: ' || :'f_verlopen');
select pg_temp.fout(format($$select public.accept_invitation(%L, 'Nieuw')$$, :'tok_kai')) as f_gebruikt \gset
select pg_temp.assert(:'f_gebruikt' like 'P0002: Uitnodiging is ongeldig of verlopen', 'AC-047: gebruikte uitnodiging, kreeg: ' || :'f_gebruikt');
select pg_temp.fout(format($$select public.accept_invitation(%L, 'Nieuw')$$, :'tok_x')) as f_ander_adres \gset
select pg_temp.assert(:'f_ander_adres' = '42501: Deze uitnodiging is voor een ander e-mailadres. Log in met dat adres of vraag een nieuwe link.',
  'AC-047: uitnodiging voor x@example.com met een ander adres, kreeg: ' || :'f_ander_adres');
select pg_temp.fout($$select public.accept_invitation('bestaat-niet', 'Nieuw')$$) as f_onbekend_token \gset
select pg_temp.assert(:'f_onbekend_token' = 'P0002: Uitnodiging is ongeldig of verlopen', 'AC-047: onbekend token, kreeg: ' || :'f_onbekend_token');
select pg_temp.assert(pg_temp.lidmaatschappen(:'u_nieuw') = 0, 'AC-047: geweigerde pogingen maken geen lid');

-- Al lid van dit huishouden: alleen afronden, geen tweede lidrij
select pg_temp.als(:'u_lynn');
select public.accept_invitation(:'tok_lynn2', 'Lynn') as lynn_weer \gset
select pg_temp.assert(:'lynn_weer' = :'fam', 'AC-047: al lid → hetzelfde huishouden terug');
select pg_temp.assert(pg_temp.lidmaatschappen(:'u_lynn') = 1, 'AC-047: al lid → geen tweede lidrij');
select pg_temp.als(:'u_jurgen');
select pg_temp.assert((select accepted_at is not null and accepted_by = :'u_lynn' from public.household_invitations where id = :'inv_lynn2'),
  'AC-047: al lid → uitnodiging afgerond');

-- D-037 (code-review 7): al lid, maar de uitnodiging is verlopen of voor een ander adres →
-- wel het huishouden terug, geen tweede lidrij, en de uitnodiging wordt NIET verbruikt
insert into public.household_invitations (household_id, email, invited_by_member_id)
values (:'fam', 'kai.wp2a@example.com', :'jurgen') returning id as inv_voor_kai, token as tok_voor_kai \gset
insert into public.household_invitations (household_id, email, invited_by_member_id, expires_at)
values (:'fam', null, :'jurgen', now() - interval '1 minute') returning id as inv_verlopen_open, token as tok_verlopen_open \gset
-- De beheerder test zijn eigen link voor Kai
select public.accept_invitation(:'tok_voor_kai') as jurgen_test \gset
select pg_temp.assert(:'jurgen_test' = :'fam', 'D-037: al lid + link voor een ander adres → huishouden terug');
select pg_temp.assert((select accepted_at is null and accepted_by is null from public.household_invitations where id = :'inv_voor_kai'),
  'D-037: beheerder die de link voor een ander test, verbruikt hem niet');
select public.accept_invitation(:'tok_verlopen_open') as jurgen_verlopen \gset
select pg_temp.assert(:'jurgen_verlopen' = :'fam', 'D-037: al lid + verlopen link → huishouden terug, geen fout');
select pg_temp.assert((select accepted_at is null from public.household_invitations where id = :'inv_verlopen_open'),
  'D-037: verlopen link wordt niet afgerond');
select pg_temp.assert(pg_temp.lidmaatschappen(:'u_jurgen') = 1, 'D-037: geen tweede lidrij voor de beheerder');

-- Positief: een open link werkt, ook voor wie nog nergens lid is; e-mail zonder hoofdlettergevoeligheid
insert into public.household_invitations (household_id, email, invited_by_member_id)
values (:'fam', 'NIEUW.WP2A@Example.com', :'jurgen') returning token as tok_nieuw \gset
select pg_temp.als(:'u_nieuw');
select public.accept_invitation(:'tok_nieuw', 'Nieuw') as nieuw_fam \gset
select pg_temp.assert(:'nieuw_fam' = :'fam' and pg_temp.lidmaatschappen(:'u_nieuw') = 1, 'AC-047: geldige uitnodiging → lid');
select id as nieuw from public.household_members where user_id = :'u_nieuw' \gset

-- =============================================================================
-- AC-048 — alleen een beheerder maakt of trekt uitnodigingen in (BR-41)
-- =============================================================================
select pg_temp.als(:'u_lynn');
select pg_temp.expect_sqlstate(format(
  $$insert into public.household_invitations (household_id, email, invited_by_member_id) values (%L, 'vriend@example.com', %L)$$, :'fam', :'lynn'),
  '42501', 'AC-048: gezinslid maakt uitnodiging');
select pg_temp.assert(pg_temp.geweigerd(format($$delete from public.household_invitations where token = %L$$, :'tok_open')),
  'AC-048: gezinslid trekt uitnodiging in');
select pg_temp.assert(pg_temp.geweigerd(format($$update public.household_invitations set expires_at = now() + interval '1 year' where token = %L$$, :'tok_open')),
  'AC-048: gezinslid verlengt uitnodiging');
select pg_temp.als(:'u_jurgen');
select pg_temp.assert((select count(*) = 1 from public.household_invitations where token = :'tok_open' and accepted_at is null
                         and expires_at < now() + interval '15 days'), 'AC-048: uitnodiging ongewijzigd');
select pg_temp.assert(pg_temp.rows(format($$delete from public.household_invitations where token = %L$$, :'tok_open')) = 1,
  'AC-048: beheerder trekt uitnodiging in');

-- =============================================================================
-- AC-049 — dubbel aanmaken met een client-id geeft één rij (BR-10, R-03)
-- (zoals supabase-js upsert met ignoreDuplicates: on conflict do nothing)
-- =============================================================================
\set id_taak  '30000000-2222-0000-0000-000000000001'
\set id_reeks '30000000-2222-0000-0000-000000000002'
\set id_not   '30000000-2222-0000-0000-000000000003'
\set id_boods '30000000-2222-0000-0000-000000000004'
\set id_uitn  '30000000-2222-0000-0000-000000000005'
select pg_temp.als(:'u_lynn');
select id as fam_lijst from public.shopping_lists where household_id = :'fam' and archived_at is null \gset
insert into public.tasks (id, household_id, title, scheduled_date, created_by_member_id)
values (:'id_taak', :'fam', 'Dubbel', current_date, :'lynn') on conflict (id) do nothing;
insert into public.tasks (id, household_id, title, scheduled_date, created_by_member_id)
values (:'id_taak', :'fam', 'Dubbel', current_date, :'lynn') on conflict (id) do nothing;
insert into public.task_recurrences (id, household_id, title, rule, starts_on, created_by_member_id)
values (:'id_reeks', :'fam', 'Dubbele reeks', '{"freq":"daily"}', current_date, :'lynn') on conflict (id) do nothing;
insert into public.task_recurrences (id, household_id, title, rule, starts_on, created_by_member_id)
values (:'id_reeks', :'fam', 'Dubbele reeks', '{"freq":"daily"}', current_date, :'lynn') on conflict (id) do nothing;
insert into public.task_comments (id, household_id, task_id, member_id, body)
values (:'id_not', :'fam', :'id_taak', :'lynn', 'Twee keer verstuurd') on conflict (id) do nothing;
insert into public.task_comments (id, household_id, task_id, member_id, body)
values (:'id_not', :'fam', :'id_taak', :'lynn', 'Twee keer verstuurd') on conflict (id) do nothing;
insert into public.shopping_items (id, household_id, list_id, name)
values (:'id_boods', :'fam', :'fam_lijst', 'Kaas') on conflict (id) do nothing;
insert into public.shopping_items (id, household_id, list_id, name)
values (:'id_boods', :'fam', :'fam_lijst', 'Kaas') on conflict (id) do nothing;
-- Een client-id die al bij een ander huishouden hoort: de upsert maakt niets en laat niets zien
select pg_temp.als(:'u_bas');
insert into public.task_recurrences (household_id, title, rule, starts_on, created_by_member_id)
values (:'buren', 'Heg van Bas', '{"freq":"weekly","interval":1}', current_date, :'bas') returning id as r_buren \gset
select row(r.*)::text as r_buren_voor from public.task_recurrences r where id = :'r_buren' \gset
select pg_temp.als(:'u_lynn');
with x as (
  insert into public.task_recurrences (id, household_id, title, rule, starts_on, created_by_member_id)
  values (:'r_buren', :'fam', 'Kaping', '{"freq":"daily"}', current_date, :'lynn') on conflict (id) do nothing returning id
) select count(*) as vreemde_upsert from x \gset
select pg_temp.assert(:'vreemde_upsert' = '0', 'security WP2a-5: upsert met reeks-id van ander huishouden voegt niets toe');
reset role;
select pg_temp.assert((select row(r.*)::text = :'r_buren_voor' from public.task_recurrences r where id = :'r_buren'),
  'security WP2a-5: reeks van het andere huishouden ongewijzigd');
select pg_temp.assert((select count(*) = 0 from public.task_recurrences where household_id = :'fam' and title = 'Kaping'),
  'security WP2a-5: geen reeks in Familie');
set role authenticated;

select pg_temp.als(:'u_jurgen');
insert into public.household_invitations (id, household_id, email, invited_by_member_id)
values (:'id_uitn', :'fam', 'oma.wp2a@example.com', :'jurgen') on conflict (id) do nothing;
insert into public.household_invitations (id, household_id, email, invited_by_member_id)
values (:'id_uitn', :'fam', 'oma.wp2a@example.com', :'jurgen') on conflict (id) do nothing;
reset role;
select pg_temp.assert((select count(*) = 1 from public.tasks where id = :'id_taak'), 'AC-049: taak één keer');
select pg_temp.assert((select count(*) = 1 from public.task_recurrences where id = :'id_reeks'), 'AC-049: reeks één keer');
select pg_temp.assert((select count(*) = 1 from public.task_comments where id = :'id_not'), 'AC-049: notitie één keer');
select pg_temp.assert((select count(*) = 1 from public.shopping_items where id = :'id_boods'), 'AC-049: boodschap één keer');
select pg_temp.assert((select count(*) = 1 from public.household_invitations where household_id = :'fam' and email = 'oma.wp2a@example.com'),
  'AC-049: uitnodiging één keer');
set role authenticated;

-- =============================================================================
-- AC-050 — dubbel archiveren geeft één nieuwe lijst (BR-42, R-03)
-- =============================================================================
select pg_temp.als(:'u_lynn');
delete from public.shopping_items where list_id = :'fam_lijst';
insert into public.shopping_items (household_id, list_id, name, is_bought) values
  (:'fam', :'fam_lijst', 'Appels', true), (:'fam', :'fam_lijst', 'Brood', true), (:'fam', :'fam_lijst', 'Cola', true),
  (:'fam', :'fam_lijst', 'Melk', false), (:'fam', :'fam_lijst', 'Zeep', false);
select (public.archive_shopping_list(:'fam_lijst')).id as nieuwe_lijst \gset
select (public.archive_shopping_list(:'fam_lijst')).id as nieuwe_lijst_2 \gset
select pg_temp.assert(:'nieuwe_lijst' <> :'fam_lijst', 'AC-050: er is een nieuwe lijst');
select pg_temp.assert(:'nieuwe_lijst_2' = :'nieuwe_lijst', 'AC-050: tweede keer archiveren geeft dezelfde nieuwe lijst terug');
select pg_temp.assert(pg_temp.actieve_lijsten(:'fam') = 1, 'AC-050: precies één actieve lijst');
select pg_temp.assert((pg_temp.lijst(:'nieuwe_lijst')).archived_at is null, 'AC-050: de nieuwe lijst is actief');
select pg_temp.assert(pg_temp.items(:'nieuwe_lijst') = 'Melk-,Zeep-', 'AC-050: nieuwe lijst heeft de 2 niet-gekochte, kreeg: ' || pg_temp.items(:'nieuwe_lijst'));
select pg_temp.assert((pg_temp.lijst(:'fam_lijst')).archived_at is not null, 'AC-050: oude lijst is gearchiveerd');
select pg_temp.assert(pg_temp.items(:'fam_lijst') = 'Appels+,Brood+,Cola+', 'AC-050: oude lijst houdt de 3 gekochte, kreeg: ' || pg_temp.items(:'fam_lijst'));
-- (De unieke index "één actieve lijst" staat sinds D-037 in …_210; die toetst 40_wp2b.sql.)
-- Buitenstaander en uitgezet lid: niet gevonden, niets veranderd
select pg_temp.als(:'u_bas');
select pg_temp.expect_sqlstate(format($$select public.archive_shopping_list(%L)$$, :'nieuwe_lijst'), 'P0002', 'AC-050: buitenstaander archiveert');
select pg_temp.expect_sqlstate(format($$select public.unarchive_shopping_list(%L)$$, :'fam_lijst'), 'P0002', 'AC-051: buitenstaander zet terug');
select pg_temp.expect_sqlstate('select public.archive_shopping_list(gen_random_uuid())', 'P0002', 'AC-050: onbekende lijst');
select pg_temp.fout(format($$select public.archive_shopping_list(%L)$$, :'nieuwe_lijst')) as fa_vreemd \gset
select pg_temp.fout('select public.archive_shopping_list(gen_random_uuid())') as fa_onbekend \gset
select pg_temp.fout(format($$select public.unarchive_shopping_list(%L)$$, :'fam_lijst')) as fu_vreemd \gset
select pg_temp.fout('select public.unarchive_shopping_list(gen_random_uuid())') as fu_onbekend \gset
select pg_temp.assert(:'fa_vreemd' = :'fa_onbekend' and :'fu_vreemd' = :'fu_onbekend' and :'fa_vreemd' = :'fu_vreemd',
  'N2: archive/unarchive vreemd = onbekend, kreeg: ' || :'fa_vreemd' || ' / ' || :'fu_vreemd');
select pg_temp.als(:'u_mila');
select pg_temp.expect_sqlstate(format($$select public.archive_shopping_list(%L)$$, :'nieuwe_lijst'), 'P0002', 'AC-050: uitgezet lid archiveert');
select pg_temp.assert((pg_temp.lijst(:'nieuwe_lijst')).archived_at is null, 'AC-050: niets veranderd door buitenstaander of uitgezet lid');

-- =============================================================================
-- AC-051 — archiveren ongedaan maken (UX §4.8)
-- =============================================================================
select pg_temp.als(:'u_ellen');
select (public.unarchive_shopping_list(:'fam_lijst')).id as terug \gset
select pg_temp.assert(:'terug' = :'fam_lijst' and (pg_temp.lijst(:'fam_lijst')).archived_at is null, 'AC-051: oude lijst weer actief');
select pg_temp.assert(pg_temp.items(:'fam_lijst') = 'Appels+,Brood+,Cola+,Melk-,Zeep-', 'AC-051: met alle producten, kreeg: ' || pg_temp.items(:'fam_lijst'));
select pg_temp.assert((pg_temp.lijst(:'nieuwe_lijst')).id is null, 'AC-051: de nieuwe lijst is verdwenen');
select pg_temp.assert(pg_temp.actieve_lijsten(:'fam') = 1, 'AC-051: precies één actieve lijst');
select (public.unarchive_shopping_list(:'fam_lijst')).id as terug_2 \gset
select pg_temp.assert(:'terug_2' = :'fam_lijst' and pg_temp.actieve_lijsten(:'fam') = 1
                      and pg_temp.items(:'fam_lijst') = 'Appels+,Brood+,Cola+,Melk-,Zeep-', 'AC-051: tweede keer ongedaan maken doet niets');
-- Alleen de laatst afgeronde lijst kan terug
select (public.archive_shopping_list(:'fam_lijst')).id as lijst_b \gset
select (public.archive_shopping_list(:'lijst_b')).id as lijst_c \gset
select pg_temp.expect_sqlstate(format($$select public.unarchive_shopping_list(%L)$$, :'fam_lijst'), 'P0001', 'AC-051: oudere lijst terugzetten');
select pg_temp.assert(pg_temp.actieve_lijsten(:'fam') = 1 and (pg_temp.lijst(:'lijst_c')).archived_at is null, 'AC-051: na weigering niets veranderd');

-- =============================================================================
-- AC-178 — schrijversnaam niet te vervalsen of te wijzigen (V-34, TD §3.1)
-- =============================================================================
select pg_temp.als(:'u_ellen');
insert into public.task_comments (household_id, task_id, member_id, body)
values (:'fam', :'t_ramen', :'ellen', 'Zeem ligt in de schuur') returning id as n_ellen \gset
select pg_temp.als(:'u_lynn');
-- (a) vervalste naam wordt genegeerd
insert into public.task_comments (household_id, task_id, member_id, body, author_name)
values (:'fam', :'t_ramen', :'lynn', 'Ik doe het morgen', 'Jurgen') returning id as n_lynn \gset
select pg_temp.assert((pg_temp.notitie(:'n_lynn')).author_name = 'Lynn', 'AC-178a: meegestuurde author_name genegeerd, eigen naam opgeslagen');
-- (a) een andere member_id wordt geweigerd
select pg_temp.expect_sqlstate(format(
  $$insert into public.task_comments (household_id, task_id, member_id, body, author_name) values (%L, %L, %L, 'Namens Jurgen', 'Jurgen')$$,
  :'fam', :'t_ramen', :'jurgen'), '42501', 'AC-178a: notitie met andermans member_id');

-- (b) wijzigen: eigen notitie, andermans notitie, en als beheerder — steeds geweigerd, notitie ongewijzigd
select row(pg_temp.notitie(:'n_lynn'))::text as n_lynn_voor \gset
select row(pg_temp.notitie(:'n_ellen'))::text as n_ellen_voor \gset
select pg_temp.assert(pg_temp.geweigerd(format($$update public.task_comments set author_name = 'Jurgen' where id = %L$$, :'n_lynn')), 'AC-178b: eigen author_name');
select pg_temp.assert(pg_temp.geweigerd(format($$update public.task_comments set member_id = %L where id = %L$$, :'jurgen', :'n_lynn')), 'AC-178b: eigen member_id');
select pg_temp.assert(pg_temp.geweigerd(format($$update public.task_comments set body = 'Anders' where id = %L$$, :'n_lynn')), 'AC-178b: eigen tekst');
select pg_temp.assert(pg_temp.geweigerd(format($$update public.task_comments set task_id = %L where id = %L$$, :'t_vaat', :'n_lynn')), 'AC-178b: eigen taak');
select pg_temp.assert(pg_temp.geweigerd(format($$update public.task_comments set household_id = %L where id = %L$$, :'buren', :'n_lynn')), 'AC-178b: eigen huishouden');
select pg_temp.assert(pg_temp.geweigerd(format($$update public.task_comments set author_name = 'Lynn' where id = %L$$, :'n_ellen')), 'AC-178b: andermans author_name');
select pg_temp.assert(pg_temp.geweigerd(format($$update public.task_comments set body = 'Anders' where id = %L$$, :'n_ellen')), 'AC-178b: andermans tekst');
select pg_temp.als(:'u_jurgen');
select pg_temp.assert(pg_temp.geweigerd(format($$update public.task_comments set author_name = 'Jurgen' where id = %L$$, :'n_lynn')), 'AC-178b: beheerder wijzigt author_name');
select pg_temp.assert(pg_temp.geweigerd(format($$update public.task_comments set member_id = null where id = %L$$, :'n_lynn')), 'AC-178b: beheerder maakt member_id leeg');
select pg_temp.assert(pg_temp.geweigerd(format($$update public.task_comments set body = 'Gecensureerd' where id = %L$$, :'n_ellen')), 'AC-178b: beheerder wijzigt tekst');
select pg_temp.assert(row(pg_temp.notitie(:'n_lynn'))::text = :'n_lynn_voor' and row(pg_temp.notitie(:'n_ellen'))::text = :'n_ellen_voor',
  'AC-178b: notities ongewijzigd');

-- Upsert met "on conflict do update" herschrijft een bestaande notitie niet (security WP2a)
select pg_temp.assert(pg_temp.geweigerd(format(
  $$insert into public.task_comments (id, household_id, task_id, member_id, body, author_name) values (%L, %L, %L, %L, 'Overschreven', 'Jurgen')
    on conflict (id) do update set body = excluded.body, author_name = excluded.author_name$$, :'n_lynn', :'fam', :'t_ramen', :'lynn')),
  'AC-178b: upsert met on conflict do update op eigen notitie');
select pg_temp.assert(pg_temp.geweigerd(format(
  $$insert into public.task_comments (id, household_id, task_id, member_id, body) values (%L, %L, %L, %L, 'Overschreven')
    on conflict (id) do update set body = excluded.body$$, :'n_ellen', :'fam', :'t_ramen', :'lynn')),
  'AC-178b: upsert met on conflict do update op andermans notitie');
-- Een notitie zonder schrijver (member_id null) plaatsen mag niet
select pg_temp.expect_sqlstate(format(
  $$insert into public.task_comments (household_id, task_id, member_id, body, author_name) values (%L, %L, null, 'Anoniem', 'Jurgen')$$,
  :'fam', :'t_ramen'), '42501', 'AC-178a: notitie met member_id null');
select pg_temp.assert(row(pg_temp.notitie(:'n_lynn'))::text = :'n_lynn_voor' and row(pg_temp.notitie(:'n_ellen'))::text = :'n_ellen_voor',
  'AC-178: notities ongewijzigd na upsert-pogingen');

-- Tweede laag: ook zonder RLS (superuser met de sessie van een gebruiker, diepte 1) weigert de guard
reset role;
select pg_temp.als(:'u_lynn');
select pg_temp.expect_sqlstate(format($$update public.task_comments set author_name = 'Jurgen' where id = %L$$, :'n_lynn'), '42501',
  'AC-178b: guard weigert author_name ook buiten RLS om');
select pg_temp.expect_sqlstate(format($$update public.task_comments set member_id = null where id = %L$$, :'n_lynn'), '42501',
  'AC-178b: guard weigert member_id → null door een gebruiker (diepte 1)');
select pg_temp.expect_sqlstate(format($$update public.task_comments set body = 'x' where id = %L$$, :'n_ellen'), '42501',
  'AC-178b: guard weigert tekstwijziging buiten RLS om');
select pg_temp.assert(row(pg_temp.notitie(:'n_lynn'))::text = :'n_lynn_voor', 'AC-178b: notitie na guard-pogingen ongewijzigd');
set role authenticated;

-- Naamswijziging: huisgenoten zien de nieuwe naam (AC-143, sync ondanks de guard)
select pg_temp.als(:'u_lynn');
update public.household_members set display_name = 'Lynntje' where id = :'lynn';
select pg_temp.assert((pg_temp.notitie(:'n_lynn')).author_name = 'Lynntje', 'V-34: naamswijziging werkt door in de notities');
select pg_temp.assert((pg_temp.notitie(:'n_ellen')).author_name = 'Ellen', 'V-34: notities van anderen niet geraakt');
update public.household_members set display_name = 'Lynn' where id = :'lynn';

-- Verwijderen blijft mogelijk volgens AC-108
select pg_temp.assert(pg_temp.rows(format($$delete from public.task_comments where id = %L$$, :'n_ellen')) = 0, 'AC-108: andermans notitie verwijderen');
select pg_temp.assert(pg_temp.rows(format($$delete from public.task_comments where id = %L$$, :'n_lynn')) = 1, 'AC-108: eigen notitie verwijderen');
select pg_temp.als(:'u_jurgen');
select pg_temp.assert(pg_temp.rows(format($$delete from public.task_comments where id = %L$$, :'n_ellen')) = 1, 'AC-108: beheerder verwijdert notitie');

-- =============================================================================
-- AC-062 — schrijver van een notitie na vertrek (V-25, V-34)
-- =============================================================================
select pg_temp.als(:'u_kai');
insert into public.task_comments (household_id, task_id, member_id, body)
values (:'fam', :'t_ramen', :'kai', 'Ik heb de ladder gepakt') returning id as n_kai \gset
select pg_temp.als(:'u_noor');
insert into public.task_comments (household_id, task_id, member_id, body)
values (:'fam', :'t_ramen', :'noor', 'Emmer staat klaar') returning id as n_noor \gset

-- Uitgezet: de naam blijft staan
select pg_temp.als(:'u_jurgen');
update public.household_members set is_active = false where id = :'kai';
select pg_temp.assert((select author_name = 'Kai' and member_id = :'kai' from pg_temp.notitie(:'n_kai')), 'AC-062: naam blijft bij uitgezet lid');
update public.household_members set is_active = true where id = :'kai';
-- Uit het huishouden verwijderd: member_id leeg (FK-actie door de guard), author_name blijft
select pg_temp.assert(pg_temp.rows(format($$delete from public.household_members where id = %L$$, :'kai')) = 1, 'setup: Kai verwijderd');
select pg_temp.assert((select member_id is null and author_name = 'Kai' and body = 'Ik heb de ladder gepakt' from pg_temp.notitie(:'n_kai')),
  'AC-062: na verwijderen uit het huishouden: member_id leeg, "Kai" blijft');

-- =============================================================================
-- delete_my_account (TD §4.5, BR-24)
-- D-037 / security WP2a-3: tot WP7 niet aanroepbaar voor authenticated. De
-- logica wordt getoetst als eigenaar met de jwt-claim van de gebruiker (zo
-- roept de server hem in WP7 niet aan, maar de functie gebruikt alleen auth.uid()).
-- =============================================================================
select pg_temp.als(:'u_noor');
select pg_temp.expect_sqlstate('select public.delete_my_account()', '42501', 'D-037: delete_my_account dicht voor authenticated');
select pg_temp.assert(pg_temp.lidmaatschappen(:'u_noor') = 1, 'D-037: geweigerde aanroep laat het lidmaatschap staan');
reset role;
select pg_temp.assert(not has_function_privilege('authenticated', 'public.delete_my_account()', 'EXECUTE')
                      and not has_function_privilege('anon', 'public.delete_my_account()', 'EXECUTE'),
  'D-037: geen execute voor authenticated en anon');

-- Gezinslid verwijdert zijn account: lidmaatschap weg, notitie blijft met naam (AC-062)
insert into public.notifications (household_id, member_id, type, title) values (:'fam', :'noor', 'reminder', 'Herinnering voor Noor');
select pg_temp.als(:'u_noor');
select public.delete_my_account() as noor_weg \gset
select pg_temp.assert(:'noor_weg'::boolean and pg_temp.lidmaatschappen(:'u_noor') = 0, 'delete_my_account: lidmaatschap weg');
select pg_temp.assert((select count(*) = 0 from public.user_preferences where member_id = :'noor'), 'delete_my_account: voorkeuren mee weg');
select pg_temp.assert((select count(*) = 0 from public.notifications where member_id = :'noor'), 'delete_my_account: meldingen mee weg');
delete from auth.users where id = :'u_noor';  -- stap 4 (auth.admin.deleteUser)
select pg_temp.assert((select member_id is null and author_name = 'Noor' from pg_temp.notitie(:'n_noor')),
  'AC-062: na account verwijderen: member_id leeg, "Noor" blijft');

-- Uitgezet lid mag zijn account verwijderen (plan-critic 17)
select pg_temp.als(:'u_mila');
select public.delete_my_account() as mila_weg \gset
select pg_temp.assert(:'mila_weg'::boolean and pg_temp.lidmaatschappen(:'u_mila') = 0, 'delete_my_account: uitgezet lid mag');

-- Geen lidmaatschap → no-op
select pg_temp.als(:'u_zonder');
select public.delete_my_account() as zonder_weg \gset
select pg_temp.assert(:'zonder_weg'::boolean, 'delete_my_account: zonder lidmaatschap → true (no-op)');

-- Niet ingelogd → geweigerd
select set_config('request.jwt.claims', '', false);
select pg_temp.expect_sqlstate('select public.delete_my_account()', '42501', 'delete_my_account: zonder gebruiker');

-- Beheerder naast andere actieve beheerders mag
select pg_temp.als(:'u_tim');
select public.delete_my_account();
select pg_temp.assert(pg_temp.lidmaatschappen(:'u_tim') = 0, 'delete_my_account: beheerder met andere actieve beheerder mag');

-- Enige actieve beheerder wordt geweigerd, ook als er een uitgezette beheerder is
set role authenticated;
select pg_temp.als(:'u_solo');
select public.create_household('Solo WP2a', 'Solo') as solo_h \gset
select id as solo from public.household_members where user_id = :'u_solo' \gset
insert into public.household_invitations (household_id, email, role, invited_by_member_id)
values (:'solo_h', 'piet.wp2a@example.com', 'admin', :'solo') returning token as tok_piet \gset
select pg_temp.als(:'u_piet'); select public.accept_invitation(:'tok_piet', 'Piet');
select pg_temp.als(:'u_solo');
update public.household_members set is_active = false where user_id = :'u_piet';
reset role;
select pg_temp.fout('select public.delete_my_account()') as f_solo \gset
select pg_temp.assert(:'f_solo' = 'P0001: Je bent de enige beheerder. Maak eerst iemand anders beheerder, of verwijder het huishouden.',
  'BR-24: enige actieve beheerder verwijdert account, kreeg: ' || :'f_solo');
select pg_temp.assert(pg_temp.lidmaatschappen(:'u_solo') = 1, 'BR-24: lidmaatschap van de enige beheerder blijft');
-- De uitgezette beheerder zelf mag wel
select pg_temp.als(:'u_piet');
select public.delete_my_account();
select pg_temp.assert(pg_temp.lidmaatschappen(:'u_piet') = 0, 'delete_my_account: uitgezette beheerder mag');
set role authenticated;

-- =============================================================================
-- delete_household (TD §4.6, UC-12)
-- =============================================================================
select pg_temp.rijen_van(:'fam') as fam_voor \gset
select pg_temp.als(:'u_lynn');
select pg_temp.fout($$select public.delete_household('Familie WP2a')$$) as f_lid \gset
select pg_temp.assert(:'f_lid' like '42501:%', 'delete_household: gezinslid, kreeg: ' || :'f_lid');
select pg_temp.als(:'u_jurgen');
select pg_temp.fout($$select public.delete_household('familie wp2a')$$) as f_naam \gset
select pg_temp.assert(:'f_naam' = 'P0001: De naam klopt niet. Typ de naam van het huishouden precies over.',
  'delete_household: verkeerde naam (hoofdletters), kreeg: ' || :'f_naam');
select pg_temp.fout($$select public.delete_household('Familie WP2a ')$$) as f_naam2 \gset
select pg_temp.assert(:'f_naam2' like 'P0001:%', 'delete_household: naam met spatie, kreeg: ' || :'f_naam2');
select pg_temp.fout($$select public.delete_household(null)$$) as f_naam3 \gset
select pg_temp.assert(:'f_naam3' like 'P0001:%', 'delete_household: geen naam, kreeg: ' || :'f_naam3');
select pg_temp.als(:'u_bas');
select pg_temp.fout($$select public.delete_household('Familie WP2a')$$) as f_bas \gset
select pg_temp.assert(:'f_bas' like 'P0001:%', 'delete_household: buitenstaander met naam van ander huishouden (eigen huishouden, naam klopt niet), kreeg: ' || :'f_bas');
select pg_temp.als(:'u_zonder');
select pg_temp.expect_sqlstate($$select public.delete_household('Familie WP2a')$$, 'P0002', 'delete_household: zonder huishouden');
select pg_temp.assert(pg_temp.rijen_van(:'fam') = :'fam_voor', 'delete_household: na de weigeringen is niets van Familie veranderd');

-- Alleen via de RPC (TD §3.1, §4.6): een directe delete door de beheerder raakt niets
-- (was open bevinding test-writer WP2a; opgelost in …_200, verplaatst uit bevindingen/)
select pg_temp.als(:'u_jurgen');
select pg_temp.assert(pg_temp.geweigerd(format($$delete from public.households where id = %L$$, :'fam')),
  'TD §3.1: beheerder verwijdert huishouden direct, zonder delete_household en zonder naambevestiging');
select pg_temp.assert(pg_temp.rijen_van(:'fam') = :'fam_voor', 'TD §3.1: na de directe poging is niets van Familie veranderd');

-- Uitgezette beheerder: geen toegang
select pg_temp.als(:'u_jurgen');
update public.household_members set is_active = false where id = :'ellen';
select pg_temp.als(:'u_ellen');
select pg_temp.expect_sqlstate($$select public.delete_household('Familie WP2a')$$, 'P0002', 'delete_household: uitgezette beheerder');
select pg_temp.als(:'u_jurgen');
update public.household_members set is_active = true where id = :'ellen';

-- Cascade: Bas verwijdert Buren met alles erin; Familie blijft
select pg_temp.als(:'u_buur');
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'buren', 'Heg knippen', current_date, :'buur') returning id as t_heg \gset
select public.complete_task(:'t_heg', gen_random_uuid());
insert into public.task_comments (household_id, task_id, member_id, body) values (:'buren', :'t_heg', :'buur', 'Schaar is bot');
insert into public.task_recurrences (household_id, title, rule, starts_on, created_by_member_id)
values (:'buren', 'Gras', '{"freq":"weekly","interval":1}', current_date, :'buur');
insert into public.shopping_items (household_id, list_id, name)
select :'buren', id, 'Kunstmest' from public.shopping_lists where household_id = :'buren' and archived_at is null;
select pg_temp.als(:'u_bas');
insert into public.household_invitations (household_id, email, invited_by_member_id) values (:'buren', null, :'bas');
reset role;
insert into public.notifications (household_id, member_id, type, title) values (:'buren', :'buur', 'reminder', 'Herinnering');
set role authenticated;
select pg_temp.assert(pg_temp.rijen_van(:'buren') like '%tasks=%' and pg_temp.rijen_van(:'buren') like '%task_completions=%'
                      and pg_temp.rijen_van(:'buren') like '%notifications=%', 'setup: Buren heeft gegevens');
select pg_temp.als(:'u_bas');
select public.delete_household('Buren WP2a') as buren_weg \gset
select pg_temp.assert(:'buren_weg'::boolean, 'delete_household: beheerder met de exacte naam');
select pg_temp.assert(pg_temp.rijen_van(:'buren') = '', 'delete_household: cascade laat niets achter, over: ' || pg_temp.rijen_van(:'buren'));
select pg_temp.assert(pg_temp.lidmaatschappen(:'u_bas') = 0 and pg_temp.lidmaatschappen(:'u_buur') = 0, 'delete_household: geen lidmaatschappen meer');
reset role;
select pg_temp.assert((select count(*) = 2 from auth.users where id in (:'u_bas', :'u_buur'))
                      and (select count(*) = 2 from public.users where id in (:'u_bas', :'u_buur')),
  'delete_household: de accounts van de leden blijven bestaan');
set role authenticated;
select pg_temp.assert(pg_temp.rijen_van(:'fam') = :'fam_voor', 'delete_household: ander huishouden onaangeroerd');
select pg_temp.als(:'u_buur');
select pg_temp.assert((select count(*) = 0 from public.my_membership()), 'delete_household: voormalig lid heeft geen lidmaatschap meer');
-- Tweede keer: niet gevonden
select pg_temp.als(:'u_bas');
select pg_temp.expect_sqlstate($$select public.delete_household('Buren WP2a')$$, 'P0002', 'delete_household: tweede keer');
-- Na verwijderen mag Bas een nieuw huishouden maken (BR-44 blokkeert niet meer)
select public.create_household('Nieuw begin', 'Bas') as bas_nieuw \gset
select pg_temp.assert(pg_temp.lidmaatschappen(:'u_bas') = 1, 'na delete_household kan een nieuw huishouden');

-- =============================================================================
-- Rechten op de nieuwe RPC's
-- =============================================================================
reset role;
select pg_temp.assert((select count(*) = 0 from unnest(array[
    'public.complete_task(uuid,uuid,text,timestamptz)',
    'public.archive_shopping_list(uuid)', 'public.unarchive_shopping_list(uuid)',
    'public.delete_household(text)', 'public.delete_my_account()'
  ]::regprocedure[]) f where has_function_privilege('anon', f, 'EXECUTE')), 'WP2a-RPC''s niet aanroepbaar voor anon');
select pg_temp.assert((select count(*) = 0 from pg_proc p where p.pronamespace = 'private'::regnamespace
                       and p.proname in ('set_comment_author', 'guard_comment_changes', 'sync_comment_author', 'create_member_preferences')
                       and has_function_privilege('authenticated', p.oid, 'EXECUTE')), 'WP2a-triggerfuncties niet aanroepbaar (AC-028)');

\o
select 'WP2a-tests geslaagd' as resultaat;
