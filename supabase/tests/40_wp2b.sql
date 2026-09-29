-- =============================================================================
-- Tests: WP2b — contract-migratie …_210 (TECHNICAL_DESIGN §3.1, §3.2, §12.4;
-- ACCEPTANCE_CRITERIA WP2b, BR-46; succescriterium 7)
-- Draait ná 10_, 20_ en 30_ in dezelfde database, met eigen accounts en eigen
-- huishoudens. Wat _210 met bestaande (oude) gegevens doet, staat in
-- supabase/tests/upgrade/na_210.sql (AC-059).
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

create or replace function pg_temp.als(p_user uuid)
returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, false);
$$;

-- Lezen ongeacht RLS (eigenaar is de superuser)
create or replace function pg_temp.taak(p_id uuid)
returns public.tasks language sql security definer as $$
  select * from public.tasks where id = p_id;
$$;
create or replace function pg_temp.afvinkingen(p_task uuid)
returns integer language sql security definer as $$
  select count(*)::integer from public.task_completions where task_id = p_task;
$$;
create or replace function pg_temp.leden(p_household uuid)
returns integer language sql security definer as $$
  select count(*)::integer from public.household_members where household_id = p_household;
$$;
create or replace function pg_temp.kolom_bestaat(p_table text, p_column text)
returns boolean language sql as $$
  select exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = p_table and column_name = p_column);
$$;

-- Als systeem (eigenaar, zonder RLS en zonder ingelogde gebruiker)
create or replace function pg_temp.systeem()
returns void language sql as $$
  select set_config('request.jwt.claims', '', false);
$$;

grant execute on all functions in schema pg_temp to authenticated;

-- -----------------------------------------------------------------------------
-- Testdata
-- -----------------------------------------------------------------------------
\set u_jurgen '40000000-0000-0000-0000-0000000000b1'
\set u_lynn   '40000000-0000-0000-0000-0000000000b2'
\set u_kai    '40000000-0000-0000-0000-0000000000b3'
\set u_bas    '40000000-0000-0000-0000-0000000000b4'
\set u_vreemd '40000000-0000-0000-0000-0000000000b5'
\set u_weg    '40000000-0000-0000-0000-0000000000b6'

insert into auth.users (id, email, raw_user_meta_data) values
  (:'u_jurgen', 'jurgen.wp2b@example.com', '{"display_name":"Jurgen"}'),
  (:'u_lynn',   'lynn.wp2b@example.com',   '{"display_name":"Lynn"}'),
  (:'u_kai',    'kai.wp2b@example.com',    '{"display_name":"Kai"}'),
  (:'u_bas',    'bas.wp2b@example.com',    '{"display_name":"Bas"}'),
  (:'u_vreemd', 'vreemd.wp2b@example.com', '{"display_name":"Vreemd"}'),
  (:'u_weg',    'weg.wp2b@example.com',    '{"display_name":"Weg"}');

set role authenticated;
select pg_temp.als(:'u_jurgen');
select public.create_household('Familie WP2b', 'Jurgen') as fam \gset
select id as jurgen from public.household_members where user_id = :'u_jurgen' \gset
insert into public.household_invitations (household_id, email, role, invited_by_member_id) values
  (:'fam', 'lynn.wp2b@example.com', 'member', :'jurgen'),
  (:'fam', 'weg.wp2b@example.com',  'member', :'jurgen');
select token as tok_lynn from public.household_invitations where email = 'lynn.wp2b@example.com' \gset
select token as tok_weg  from public.household_invitations where email = 'weg.wp2b@example.com' \gset
select pg_temp.als(:'u_lynn'); select public.accept_invitation(:'tok_lynn', 'Lynn');
select pg_temp.als(:'u_weg');  select public.accept_invitation(:'tok_weg', 'Weg');
select pg_temp.als(:'u_jurgen');
select id as lynn from public.household_members where user_id = :'u_lynn' \gset
select id as weg  from public.household_members where user_id = :'u_weg' \gset

select pg_temp.als(:'u_bas');
select public.create_household('Buren WP2b', 'Bas') as buren \gset

-- =============================================================================
-- Geen leden zonder account (BR-46.3, TD §3.1: user_id NOT NULL)
-- =============================================================================
reset role;
select pg_temp.systeem();
select pg_temp.assert((select is_nullable = 'NO' from information_schema.columns
                       where table_schema = 'public' and table_name = 'household_members' and column_name = 'user_id'),
  'WP2b: household_members.user_id is verplicht');
-- Ook het systeem (eigenaar, zonder RLS) kan geen lid zonder account maken
select pg_temp.expect_sqlstate(format(
  $$insert into public.household_members (household_id, display_name) values (%L, 'Baby')$$, :'fam'), '23502',
  'WP2b: lid zonder account toevoegen (ook als systeem)');
select pg_temp.expect_sqlstate(format($$update public.household_members set user_id = null where id = %L$$, :'lynn'), '23502',
  'WP2b: account loskoppelen van een bestaand lid');
select pg_temp.assert(pg_temp.leden(:'fam') = 3, 'WP2b: Familie heeft nog precies 3 leden');

-- =============================================================================
-- "members: beheerder voegt toe" is weg: niemand voegt rechtstreeks leden toe
-- =============================================================================
select pg_temp.assert((select count(*) = 0 from pg_policy where polrelid = 'public.household_members'::regclass and polcmd in ('a', '*')),
  'WP2b: er is geen insert-policy meer op household_members');
set role authenticated;
select pg_temp.als(:'u_lynn');
select pg_temp.expect_sqlstate(format(
  $$insert into public.household_members (household_id, display_name) values (%L, 'Door Lynn')$$, :'fam'), '42501',
  'WP2b: gezinslid voegt rechtstreeks een lid zonder account toe');
select pg_temp.expect_sqlstate(format(
  $$insert into public.household_members (household_id, user_id, display_name) values (%L, %L, 'Vriend')$$, :'fam', :'u_vreemd'), '42501',
  'WP2b: gezinslid voegt rechtstreeks een account toe');
select pg_temp.als(:'u_jurgen');
select pg_temp.expect_sqlstate(format(
  $$insert into public.household_members (household_id, display_name) values (%L, 'Door Jurgen')$$, :'fam'), '42501',
  'WP2b: beheerder voegt rechtstreeks een lid zonder account toe');
select pg_temp.expect_sqlstate(format(
  $$insert into public.household_members (household_id, user_id, display_name) values (%L, %L, 'Vreemd')$$, :'fam', :'u_vreemd'), '42501',
  'WP2b: beheerder voegt rechtstreeks een account toe (alleen via uitnodiging, D-016)');
select pg_temp.assert(pg_temp.leden(:'fam') = 3, 'WP2b: na de pogingen nog steeds 3 leden');
-- De enige weg erin blijft de uitnodiging
insert into public.household_invitations (household_id, email, invited_by_member_id)
values (:'fam', 'kai.wp2b@example.com', :'jurgen') returning token as tok_kai \gset
select pg_temp.als(:'u_kai');
select public.accept_invitation(:'tok_kai', 'Kai') as kai_fam \gset
select pg_temp.assert(:'kai_fam' = :'fam' and pg_temp.leden(:'fam') = 4, 'WP2b: lid worden via een uitnodiging werkt nog');
select id as kai from public.household_members where user_id = :'u_kai' \gset

-- =============================================================================
-- Eén huishouden per gebruiker als constraint (BR-44, TD §3.1: unique (user_id))
-- =============================================================================
reset role;
select pg_temp.systeem();
select pg_temp.assert((select count(*) = 1 from pg_constraint
                       where conrelid = 'public.household_members'::regclass and contype = 'u'
                         and pg_get_constraintdef(oid) = 'UNIQUE (user_id)'),
  'WP2b: unique (user_id) bestaat');
select pg_temp.assert((select count(*) = 0 from pg_constraint
                       where conrelid = 'public.household_members'::regclass and contype = 'u'
                         and pg_get_constraintdef(oid) = 'UNIQUE (household_id, user_id)'),
  'WP2b: de oude unique (household_id, user_id) is vervangen');
-- Ook buiten de RPC's om (systeem, zonder de BR-44-check in de functie) niet in twee huishoudens
select pg_temp.expect_sqlstate(format(
  $$insert into public.household_members (household_id, user_id, display_name) values (%L, %L, 'Lynn bij de buren')$$, :'buren', :'u_lynn'), '23505',
  'BR-44: tweede lidmaatschap in een ander huishouden (constraint)');
select pg_temp.expect_sqlstate(format(
  $$insert into public.household_members (household_id, user_id, display_name) values (%L, %L, 'Lynn nogmaals')$$, :'fam', :'u_lynn'), '23505',
  'BR-44: tweede lidrij in hetzelfde huishouden (constraint)');
select pg_temp.expect_sqlstate(format($$update public.household_members set user_id = %L where id = %L$$, :'u_lynn', :'kai'), '23505',
  'BR-44: bestaand lid omhangen naar een account dat al lid is');
select pg_temp.assert((select count(*) = 1 from public.household_members where user_id = :'u_lynn'), 'BR-44: Lynn heeft één lidmaatschap');

-- =============================================================================
-- Cascade bij verwijderen van een gebruiker (TD §3.1: user_id → users on delete cascade)
-- =============================================================================
select pg_temp.assert((select confdeltype = 'c' from pg_constraint
                       where conrelid = 'public.household_members'::regclass and contype = 'f'
                         and confrelid = 'public.users'::regclass and pg_get_constraintdef(oid) like 'FOREIGN KEY (user_id)%'),
  'WP2b: user_id → users met on delete cascade (was set null)');
-- "Weg" heeft een taak, een reeks, een notitie, een melding en voorkeuren
set role authenticated;
select pg_temp.als(:'u_weg');
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'fam', 'Zolder opruimen', current_date, :'weg') returning id as t_weg \gset
insert into public.task_recurrences (household_id, title, rule, starts_on, created_by_member_id)
values (:'fam', 'Planten', '{"freq":"weekly","interval":1}', current_date, :'weg') returning id as r_weg \gset
insert into public.task_comments (household_id, task_id, member_id, body)
values (:'fam', :'t_weg', :'weg', 'Dozen staan klaar') returning id as n_weg \gset
select public.complete_task(:'t_weg', gen_random_uuid());
reset role;
select pg_temp.systeem();
insert into public.notifications (household_id, member_id, type, title) values (:'fam', :'weg', 'reminder', 'Herinnering voor Weg');
select pg_temp.assert((select count(*) = 1 from public.user_preferences where member_id = :'weg'), 'setup: Weg heeft voorkeuren');
-- Het account verdwijnt (zoals auth.admin.deleteUser, TD §4.5 stap 4)
delete from auth.users where id = :'u_weg';
select pg_temp.assert((select count(*) = 0 from public.household_members where id = :'weg'), 'cascade: lidmaatschap weg met het account');
select pg_temp.assert((select count(*) = 0 from public.household_members where user_id is null), 'cascade: er blijft geen lid zonder account achter');
select pg_temp.assert((select count(*) = 0 from public.user_preferences where member_id = :'weg'), 'cascade: voorkeuren mee weg');
select pg_temp.assert((select count(*) = 0 from public.notifications where member_id = :'weg'), 'cascade: meldingen mee weg');
select pg_temp.assert((select member_id is null and author_name = 'Weg' from public.task_comments where id = :'n_weg'),
  'cascade: notitie blijft met de naam van de schrijver (V-34)');
select pg_temp.assert((select created_by_member_id is null and status = 'done' from public.tasks where id = :'t_weg'),
  'cascade: taak blijft, zonder maker');
select pg_temp.assert((select created_by_member_id is null and is_active from public.task_recurrences where id = :'r_weg'),
  'cascade: reeks blijft, zonder maker');
select pg_temp.assert(pg_temp.afvinkingen(:'t_weg') = 1, 'cascade: historie blijft');
select pg_temp.assert(pg_temp.leden(:'fam') = 3, 'cascade: de andere leden blijven');

-- =============================================================================
-- Dubbel afvinken = één registratie, ook als constraint (BR-11, TD §3.1: unique (task_id))
-- =============================================================================
select pg_temp.assert((select count(*) = 1 from pg_constraint
                       where conrelid = 'public.task_completions'::regclass and contype = 'u'
                         and pg_get_constraintdef(oid) = 'UNIQUE (task_id)'),
  'BR-11: unique (task_id) op task_completions bestaat');
set role authenticated;
select pg_temp.als(:'u_lynn');
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'fam', 'Vaatwasser', current_date, :'lynn') returning id as t_vaat \gset
-- GEGEVEN een open taak WANNEER Lynn en Kai hem kort na elkaar afvinken (andere mutationId)
select (public.complete_task(:'t_vaat', '40000000-1111-0000-0000-000000000001')).id as c1 \gset
select pg_temp.als(:'u_kai');
select (public.complete_task(:'t_vaat', '40000000-1111-0000-0000-000000000002')).id as c2 \gset
-- DAN één registratie
select pg_temp.assert(:'c1' = :'c2' and pg_temp.afvinkingen(:'t_vaat') = 1, 'BR-11: twee keer afvinken geeft één registratie');
-- Het systeem kan er ook buiten complete_task om geen tweede naast zetten
reset role;
select pg_temp.systeem();
select pg_temp.expect_sqlstate(format(
  $$insert into public.task_completions (household_id, task_id, title, completed_at, client_mutation_id) values (%L, %L, 'Vaatwasser', now(), gen_random_uuid())$$,
  :'fam', :'t_vaat'), '23505', 'BR-11: tweede registratie voor dezelfde taak (constraint)');
select pg_temp.assert(pg_temp.afvinkingen(:'t_vaat') = 1, 'BR-11: nog steeds één registratie');
-- Historie zonder taak (task_id null, BR-12) mag meerdere keren bestaan
insert into public.task_completions (household_id, task_id, title, completed_at, client_mutation_id) values
  (:'fam', null, 'Oude taak A', now() - interval '3 days', gen_random_uuid()),
  (:'fam', null, 'Oude taak B', now() - interval '2 days', gen_random_uuid());
select pg_temp.assert((select count(*) = 2 from public.task_completions where household_id = :'fam' and task_id is null),
  'BR-12: meerdere historie-rijen zonder taak blijven mogelijk');

-- =============================================================================
-- undo_complete_task werkt zonder completed_by (V-22, …_210)
-- =============================================================================
set role authenticated;
select pg_temp.als(:'u_jurgen');
-- Jurgen draait de afvinking van Lynn/Kai terug
select (public.undo_complete_task(:'t_vaat')).status as undo_status \gset
select pg_temp.assert(:'undo_status' = 'todo', 'undo: status terug naar todo');
select pg_temp.assert((select status = 'todo' and completed_at is null from pg_temp.taak(:'t_vaat')), 'undo: taak weer open, zonder afvinkmoment');
select pg_temp.assert(pg_temp.afvinkingen(:'t_vaat') = 0, 'undo: registratie verwijderd');
-- Na terugdraaien kan opnieuw worden afgevinkt: weer precies één registratie
select public.complete_task(:'t_vaat', gen_random_uuid());
select pg_temp.assert(pg_temp.afvinkingen(:'t_vaat') = 1 and (pg_temp.taak(:'t_vaat')).status = 'done',
  'undo: opnieuw afvinken na terugdraaien geeft één nieuwe registratie');
-- Buitenstaander: niet gevonden, niets veranderd
select pg_temp.als(:'u_bas');
select pg_temp.expect_sqlstate(format($$select public.undo_complete_task(%L)$$, :'t_vaat'), 'P0002', 'undo: buitenstaander');
select pg_temp.assert((pg_temp.taak(:'t_vaat')).status = 'done' and pg_temp.afvinkingen(:'t_vaat') = 1, 'undo: buitenstaander verandert niets');

-- =============================================================================
-- guard_task_changes zonder toewijzingsregel (…_210)
-- =============================================================================
-- Ieder actief lid wijzigt een taak van een ander (BR-23); er is geen toewijzing meer die de guard controleert
select pg_temp.als(:'u_kai');
update public.tasks set title = 'Zolder en schuur opruimen', scheduled_date = current_date + 1 where id = :'t_weg';
select pg_temp.assert((select title = 'Zolder en schuur opruimen' and scheduled_date = current_date + 1 from pg_temp.taak(:'t_weg')),
  'guard: gezinslid wijzigt titel en datum van een taak van een ander');
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'fam', 'Kamer stofzuigen', current_date, :'kai') returning id as t_kai \gset
update public.tasks set status = 'in_progress' where id = :'t_kai';
-- De overige regels van de guard gelden nog
select pg_temp.expect_sqlstate(format($$update public.tasks set status = 'done' where id = %L$$, :'t_kai'), '42501',
  'guard: status direct op done blijft verboden');
select pg_temp.expect_sqlstate(format($$update public.tasks set completed_at = now() where id = %L$$, :'t_kai'), '42501',
  'guard: completed_at direct invullen blijft verboden');
select pg_temp.expect_sqlstate(format($$update public.tasks set created_by_member_id = %L where id = %L$$, :'jurgen', :'t_kai'), '42501',
  'guard: maker wijzigen blijft verboden');
select pg_temp.expect_sqlstate(format($$update public.tasks set deleted_at = now() where id = %L$$, :'t_kai'), '42501',
  'guard: deleted_at direct zetten blijft verboden');
select pg_temp.expect_sqlstate(format($$update public.tasks set household_id = %L where id = %L$$, :'buren', :'t_kai'), '42501',
  'guard: taak naar ander huishouden blijft verboden');
select pg_temp.expect_sqlstate(format(
  $$insert into public.tasks (household_id, title, scheduled_date, created_by_member_id, status) values (%L, 'Al gedaan', current_date, %L, 'done')$$,
  :'fam', :'kai'), '42501', 'guard: nieuwe taak die al gedaan is blijft verboden');
select pg_temp.assert((select status = 'in_progress' and deleted_at is null and created_by_member_id = :'kai' from pg_temp.taak(:'t_kai')),
  'guard: taak van Kai na de pogingen ongewijzigd');
reset role;
select pg_temp.systeem();
-- Geen enkele functie verwijst nog naar een vervallen kolom, tabel of enumwaarde
-- (plpgsql controleert dat pas bij het uitvoeren; zo'n functie zou op live pas bij gebruik breken)
select coalesce(string_agg(distinct n.nspname || '.' || p.proname || ' → ' || w, ', '), '') as oude_verwijzingen
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace,
unnest(array['assigned_member_id', 'assignment_reason', 'completed_by_member_id', 'members_can_assign_others',
             'points_enabled', 'points_goal', 'task_swap_requests', 'member_absences', 'task_assignments',
             'assignment_strategy', 'absence_strategy', 'rotation_member_ids', 'fixed_member_id',
             'notify_task_assigned', 'notify_swap_requests', 'added_by_member_id', 'bought_by_member_id',
             'avatar_url', 'task_assigned', 'swap_request', 'swap_accepted', 'p_completed_by']) w
where n.nspname in ('public', 'private') and p.prosrc ilike '%' || w || '%' \gset
select pg_temp.assert(:'oude_verwijzingen' = '', 'WP2b: functies verwijzen nog naar vervallen onderdelen: ' || :'oude_verwijzingen');
select pg_temp.assert((select count(*) = 0 from pg_proc p where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
                       and p.prosrc ~* '\mpoints\M'),
  'WP2b: geen functie gebruikt nog punten');

-- =============================================================================
-- Oude RPC's bestaan niet meer (AC-045; TD §3.2)
-- =============================================================================
select pg_temp.assert(to_regprocedure('public.complete_task(uuid,uuid,uuid,text,timestamptz)') is null,
  'AC-045: oude complete_task (5 argumenten, met p_completed_by) bestaat niet meer');
select pg_temp.assert((select count(*) = 0 from pg_proc p where p.proname = 'complete_task' and 'p_completed_by' = any(p.proargnames)),
  'AC-045: geen enkele complete_task-variant met p_completed_by');
select pg_temp.assert((select count(*) = 1 from pg_proc p where p.proname = 'complete_task' and p.pronamespace = 'public'::regnamespace),
  'AC-045: precies één complete_task (de nieuwe)');
select pg_temp.assert(to_regprocedure('public.complete_task(uuid,uuid,text,timestamptz)') is not null,
  'AC-045: nieuwe complete_task bestaat');
select pg_temp.assert((select count(*) = 0 from pg_proc where proname = 'accept_swap_request'),
  'AC-045: accept_swap_request bestaat niet meer');
select pg_temp.assert((select count(*) = 0 from pg_proc where proname in ('check_rotation_members', 'remove_member_from_rotations', 'guard_swap_changes')),
  'WP2b: triggerfuncties voor verdeling en ruilen zijn weg');
-- Zoals de vorige app-versie (via PostgREST) ze aanriep: faalt, en verandert niets
set role authenticated;
select pg_temp.als(:'u_lynn');
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'fam', 'Ramen', current_date, :'lynn') returning id as t_ramen \gset
select pg_temp.expect_sqlstate(format(
  $$select public.complete_task(p_task_id => %L, p_mutation_id => gen_random_uuid(), p_completed_by => %L)$$, :'t_ramen', :'kai'), '42883',
  'AC-045: complete_task met p_completed_by aanroepen');
select pg_temp.expect_sqlstate('select public.accept_swap_request(gen_random_uuid())', '42883',
  'AC-045: accept_swap_request aanroepen');
select pg_temp.assert((pg_temp.taak(:'t_ramen')).status = 'todo' and pg_temp.afvinkingen(:'t_ramen') = 0,
  'AC-045: de mislukte oude aanroep vinkt niets af');
reset role;
select pg_temp.systeem();

-- =============================================================================
-- Meldingssoorten zonder task_assigned en swap_* (TD §3.1)
-- =============================================================================
select pg_temp.assert((select string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_enum e
                       where e.enumtypid = 'public.notification_type'::regtype)
                      = 'reminder,deadline_soon,overdue,task_completed,daily_summary,evening_summary,waste_sync_failed',
  'WP2b: notification_type heeft precies de zes blijvende soorten, plus waste_sync_failed (WP3b, TD §18.3.3)');
select pg_temp.expect_sqlstate(format(
  $$insert into public.notifications (household_id, member_id, type, title) values (%L, %L, 'task_assigned', 'Nieuwe taak')$$, :'fam', :'lynn'), '22P02',
  'WP2b: melding van soort task_assigned kan niet meer');
select pg_temp.expect_sqlstate(format(
  $$insert into public.notifications (household_id, member_id, type, title) values (%L, %L, 'swap_request', 'Ruilen?')$$, :'fam', :'lynn'), '22P02',
  'WP2b: melding van soort swap_request kan niet meer');
select pg_temp.expect_sqlstate(format(
  $$insert into public.notifications (household_id, member_id, type, title) values (%L, %L, 'swap_accepted', 'Overgenomen')$$, :'fam', :'lynn'), '22P02',
  'WP2b: melding van soort swap_accepted kan niet meer');
insert into public.notifications (household_id, member_id, type, title) values
  (:'fam', :'lynn', 'task_completed', 'Vaatwasser is gedaan'),
  (:'fam', :'lynn', 'daily_summary', 'Vandaag 3 taken');
select pg_temp.assert((select count(*) = 2 from public.notifications where member_id = :'lynn' and type in ('task_completed', 'daily_summary')),
  'WP2b: de blijvende soorten werken nog');
select pg_temp.assert(to_regtype('public.notification_type_old') is null, 'WP2b: het oude enumtype is opgeruimd');
select pg_temp.assert(to_regtype('public.assignment_strategy') is null and to_regtype('public.absence_strategy') is null,
  'WP2b: enums assignment_strategy en absence_strategy zijn weg');

-- =============================================================================
-- Eén actieve boodschappenlijst per huishouden (TD §3.1, partiële unieke index)
-- =============================================================================
select pg_temp.assert((select indisunique and pg_get_expr(indpred, indrelid) = '(archived_at IS NULL)'
                       from pg_index where indexrelid = 'public.shopping_lists_one_active_idx'::regclass),
  'WP2b: partiële unieke index op de actieve lijst bestaat');
select pg_temp.assert((select count(*) = 1 from public.shopping_lists where household_id = :'fam' and archived_at is null),
  'setup: Familie heeft één actieve lijst');
select pg_temp.expect_sqlstate(format($$insert into public.shopping_lists (household_id) values (%L)$$, :'fam'), '23505',
  'WP2b: tweede actieve lijst in hetzelfde huishouden (ook als systeem)');
-- Gearchiveerde lijsten mogen er zoveel zijn als nodig; een ander huishouden heeft zijn eigen actieve lijst
insert into public.shopping_lists (household_id, archived_at) values (:'fam', now() - interval '2 days'), (:'fam', now() - interval '1 day');
select pg_temp.assert((select count(*) = 1 from public.shopping_lists where household_id = :'fam' and archived_at is null)
                      and (select count(*) = 1 from public.shopping_lists where household_id = :'buren' and archived_at is null),
  'WP2b: per huishouden precies één actieve lijst, gearchiveerde erbij mag');
-- Een gearchiveerde lijst terugzetten naast een actieve lijst kan niet
select pg_temp.expect_sqlstate(format(
  $$update public.shopping_lists set archived_at = null where household_id = %L and archived_at is not null$$, :'fam'), '23505',
  'WP2b: gearchiveerde lijst direct weer actief maken naast de actieve');
-- Als gezinslid via RLS evenmin
set role authenticated;
select pg_temp.als(:'u_lynn');
select pg_temp.expect_sqlstate(format($$insert into public.shopping_lists (household_id) values (%L)$$, :'fam'), '23505',
  'WP2b: gezinslid maakt een tweede actieve lijst');
-- archive_shopping_list blijft werken met de index (precies één nieuwe actieve lijst)
select id as lijst_oud from public.shopping_lists where household_id = :'fam' and archived_at is null \gset
select (public.archive_shopping_list(:'lijst_oud')).id as lijst_nieuw \gset
select (public.archive_shopping_list(:'lijst_oud')).id as lijst_nieuw2 \gset
select pg_temp.assert(:'lijst_nieuw' = :'lijst_nieuw2' and :'lijst_nieuw' <> :'lijst_oud', 'AC-050: archiveren geeft één nieuwe lijst, ook met de index');
select (public.unarchive_shopping_list(:'lijst_oud')).id as lijst_terug \gset
select pg_temp.assert(:'lijst_terug' = :'lijst_oud', 'AC-051: terugzetten werkt ook met de index');
reset role;
select pg_temp.systeem();
select pg_temp.assert((select count(*) = 1 from public.shopping_lists where household_id = :'fam' and archived_at is null),
  'WP2b: na archiveren en terugzetten één actieve lijst');

-- =============================================================================
-- Tijdzone vast op Europe/Amsterdam (V-39; check households_timezone_amsterdam)
-- =============================================================================
select pg_temp.assert((select count(*) = 1 from pg_constraint
                       where conrelid = 'public.households'::regclass and conname = 'households_timezone_amsterdam' and contype = 'c'),
  'V-39: de tijdzonecheck bestaat');
select pg_temp.expect_sqlstate(format($$update public.households set timezone = 'America/New_York' where id = %L$$, :'fam'), '23514',
  'V-39: systeem zet een andere tijdzone');
select pg_temp.expect_sqlstate(format($$insert into public.households (name, timezone, created_by) values ('Ergens anders', 'Europe/London', %L)$$, :'u_bas'), '23514',
  'V-39: huishouden met een andere tijdzone aanmaken');
set role authenticated;
select pg_temp.als(:'u_jurgen');
select pg_temp.expect_sqlstate(format($$update public.households set timezone = 'UTC' where id = %L$$, :'fam'), '23514',
  'V-39: beheerder wijzigt de tijdzone');
select pg_temp.assert((select timezone = 'Europe/Amsterdam' from public.households where id = :'fam'), 'V-39: tijdzone ongewijzigd');
-- Andere huishoudinstellingen blijven wijzigbaar
update public.households set name = 'Familie WP2b!' where id = :'fam';
select pg_temp.assert((select name = 'Familie WP2b!' from public.households where id = :'fam'), 'V-39: naam wijzigen werkt nog');
reset role;
select pg_temp.systeem();

-- =============================================================================
-- Wat verdwijnt uit het schema (BR-46.3, TD §3.1) en de privacy-invariant (succescriterium 7)
-- =============================================================================
select pg_temp.assert((select count(*) = 0 from information_schema.columns
                       where table_schema = 'public' and table_name in ('tasks', 'task_completions', 'shopping_items')
                         and (column_name like 'completed_by%' or column_name = 'member_id'
                              or column_name like 'added_by%' or column_name like 'bought_by%')),
  'Privacy-invariant (TD §3.1): geen kolom die vastlegt wie afvinkte, kocht of toevoegde');
select pg_temp.assert(to_regclass('public.task_assignments') is null and to_regclass('public.task_swap_requests') is null
                      and to_regclass('public.member_absences') is null,
  'BR-46.3: tabellen voor toewijzing, ruilen en afwezigheid zijn weg');
select coalesce(string_agg(t || '.' || c, ', '), '') as nog_aanwezig
from (values
  ('tasks', 'assigned_member_id'), ('tasks', 'assignment_reason'), ('tasks', 'completed_by_member_id'), ('tasks', 'points'),
  ('task_completions', 'member_id'), ('task_completions', 'points'),
  ('task_recurrences', 'assignment_strategy'), ('task_recurrences', 'fixed_member_id'), ('task_recurrences', 'rotation_member_ids'),
  ('task_recurrences', 'points'), ('task_templates', 'points'),
  ('households', 'members_can_assign_others'), ('households', 'points_enabled'), ('households', 'points_goal'), ('households', 'points_goal_reward'),
  ('household_invitations', 'member_id'), ('user_preferences', 'notify_task_assigned'), ('user_preferences', 'notify_swap_requests'),
  ('shopping_lists', 'created_by_member_id'), ('shopping_items', 'added_by_member_id'), ('shopping_items', 'bought_by_member_id'),
  ('household_members', 'email'), ('household_members', 'avatar_url')
) v(t, c) where pg_temp.kolom_bestaat(t, c) \gset
select pg_temp.assert(:'nog_aanwezig' = '', 'BR-46.3: vervallen kolommen bestaan nog: ' || :'nog_aanwezig');
-- Wat blijft (V-25): makers van taken en reeksen, schrijvers van notities
select pg_temp.assert(pg_temp.kolom_bestaat('tasks', 'created_by_member_id') and pg_temp.kolom_bestaat('task_recurrences', 'created_by_member_id')
                      and pg_temp.kolom_bestaat('task_comments', 'member_id') and pg_temp.kolom_bestaat('task_comments', 'author_name'),
  'V-25: maker en schrijver blijven');
select pg_temp.assert((select count(*) = 0 from pg_publication_tables
                       where pubname = 'supabase_realtime' and tablename in ('task_swap_requests', 'task_assignments', 'member_absences')),
  'TD §3.2: realtime-publicatie bevat geen vervallen tabellen');

\o
select 'WP2b-tests (…_210) geslaagd' as resultaat;
