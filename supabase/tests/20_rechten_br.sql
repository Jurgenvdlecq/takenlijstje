-- =============================================================================
-- Tests: rechten per regel (TECHNICAL_DESIGN §5.2) voor WP1
-- Positief én negatief per regel; AC-nummers staan bij elke test.
-- Draait ná 10_rls_and_functions.sql in dezelfde database, maar gebruikt
-- eigen accounts en een eigen huishouden "Familie" (en "Buren", "Solo").
-- Iedere fout stopt het script (ON_ERROR_STOP), dus "geen output" = geslaagd.
-- =============================================================================

\o /dev/null

-- -----------------------------------------------------------------------------
-- Hulpfuncties (pg_temp is per sessie, dus opnieuw definiëren)
-- -----------------------------------------------------------------------------
create or replace function pg_temp.expect_error(p_sql text, p_label text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return;
  end;
  raise exception 'VERWACHTE FOUT BLEEF UIT: %', p_label;
end;
$$;

-- Verwacht een fout met precies deze SQLSTATE (bijv. 42501 = geen recht)
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

-- Aantal geraakte rijen van een update/delete (voor stille RLS-weigeringen)
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

-- Als deze gebruiker ingelogd zijn
create or replace function pg_temp.als(p_user uuid)
returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, false);
$$;

-- Vingerafdruk van een reeks, haar taken en haar historie. Security definer
-- (eigenaar is de superuser), zodat hij onafhankelijk van RLS alles ziet:
-- "er verandert niets" = zelfde vingerafdruk.
create or replace function pg_temp.reeks_fp(p_recurrence uuid)
returns text language sql security definer as $$
  select md5(
    coalesce((select row(r.*)::text from public.task_recurrences r where r.id = p_recurrence), '-')
    || '#' || coalesce((select string_agg(row(t.*)::text, '|' order by t.id) from public.tasks t where t.recurrence_id = p_recurrence), '-')
    || '#' || coalesce((select string_agg(row(c.*)::text, '|' order by c.id) from public.task_completions c where c.recurrence_id = p_recurrence), '-')
  );
$$;

-- Open (todo of bezig, niet verwijderde) uitvoeringen van een reeks, ongeacht RLS
create or replace function pg_temp.open_uitvoeringen(p_recurrence uuid)
returns integer language sql security definer as $$
  select count(*)::integer from public.tasks
  where recurrence_id = p_recurrence and status in ('todo', 'in_progress') and deleted_at is null;
$$;

-- Eén rij lezen ongeacht RLS
create or replace function pg_temp.taak(p_id uuid)
returns public.tasks language sql security definer as $$
  select * from public.tasks where id = p_id;
$$;

create or replace function pg_temp.reeks(p_id uuid)
returns public.task_recurrences language sql security definer as $$
  select * from public.task_recurrences where id = p_id;
$$;

create or replace function pg_temp.lid(p_id uuid)
returns public.household_members language sql security definer as $$
  select * from public.household_members where id = p_id;
$$;

-- Rijen van huishouden p_household die de HUIDIGE gebruiker ziet, over alle
-- tabellen in public met een kolom household_id (behalve household_members).
create or replace function pg_temp.zichtbare_huishoudrijen(p_household uuid)
returns text language plpgsql as $$
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
    where c.table_schema = 'public' and c.column_name = 'household_id'
      and t.table_type = 'BASE TABLE' and c.table_name <> 'household_members'
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
-- Testdata: eigen accounts (los van 10_), rollen volgens ACCEPTANCE_CRITERIA
-- -----------------------------------------------------------------------------
\set u_jurgen '20000000-0000-0000-0000-0000000000a1'
\set u_ellen  '20000000-0000-0000-0000-0000000000a2'
\set u_lynn   '20000000-0000-0000-0000-0000000000a3'
\set u_kai    '20000000-0000-0000-0000-0000000000a4'
\set u_bas    '20000000-0000-0000-0000-0000000000a5'
\set u_noor   '20000000-0000-0000-0000-0000000000a6'
\set u_solo   '20000000-0000-0000-0000-0000000000a7'
\set u_zonder '20000000-0000-0000-0000-0000000000a8'

insert into auth.users (id, email, raw_user_meta_data) values
  (:'u_jurgen', 'jurgen.br@example.com', '{"display_name":"Jurgen"}'),
  (:'u_ellen',  'ellen.br@example.com',  '{"display_name":"Ellen"}'),
  (:'u_lynn',   'lynn.br@example.com',   '{"display_name":"Lynn"}'),
  (:'u_kai',    'kai.br@example.com',    '{"display_name":"Kai"}'),
  (:'u_bas',    'bas.br@example.com',    '{"display_name":"Bas"}'),
  (:'u_noor',   'noor.br@example.com',   '{"display_name":"Noor"}'),
  (:'u_solo',   'solo.br@example.com',   '{"display_name":"Solo"}'),
  (:'u_zonder', 'zonder.br@example.com', '{"display_name":"Zonder"}');

set role authenticated;

-- Familie: Jurgen en Ellen beheerder, Lynn, Kai en Noor gezinslid
select pg_temp.als(:'u_jurgen');
select public.create_household('Familie', 'Jurgen') as fam \gset
select id as jurgen from public.household_members where household_id = :'fam' and user_id = :'u_jurgen' \gset

-- Leden met account komen er alleen via een uitnodiging in (D-016)
insert into public.household_invitations (household_id, email, role, invited_by_member_id) values
  (:'fam', 'ellen.br@example.com', 'admin',  :'jurgen'),
  (:'fam', 'lynn.br@example.com',  'member', :'jurgen'),
  (:'fam', 'kai.br@example.com',   'member', :'jurgen'),
  (:'fam', 'noor.br@example.com',  'member', :'jurgen');
select token as tok_ellen from public.household_invitations where email = 'ellen.br@example.com' \gset
select token as tok_lynn  from public.household_invitations where email = 'lynn.br@example.com' \gset
select token as tok_kai   from public.household_invitations where email = 'kai.br@example.com' \gset
select token as tok_noor  from public.household_invitations where email = 'noor.br@example.com' \gset
select pg_temp.als(:'u_ellen'); select public.accept_invitation(:'tok_ellen', 'Ellen');
select pg_temp.als(:'u_lynn');  select public.accept_invitation(:'tok_lynn', 'Lynn');
select pg_temp.als(:'u_kai');   select public.accept_invitation(:'tok_kai', 'Kai');
select pg_temp.als(:'u_noor');  select public.accept_invitation(:'tok_noor', 'Noor');
select pg_temp.als(:'u_jurgen');
select id as ellen from public.household_members where household_id = :'fam' and user_id = :'u_ellen' \gset
select id as lynn  from public.household_members where household_id = :'fam' and user_id = :'u_lynn' \gset
select id as kai   from public.household_members where household_id = :'fam' and user_id = :'u_kai' \gset
select id as noor  from public.household_members where household_id = :'fam' and user_id = :'u_noor' \gset
select pg_temp.assert((select (l).role = 'admin' from (select pg_temp.lid(:'ellen') as l) x), 'setup: Ellen beheerder via uitnodiging');
select pg_temp.assert((select (l).role = 'member' from (select pg_temp.lid(:'lynn') as l) x), 'setup: Lynn gezinslid via uitnodiging');

-- =============================================================================
-- D-016 / security punt 1: een beheerder koppelt geen vreemd account
-- =============================================================================
select pg_temp.expect_sqlstate(format(
  $$insert into public.household_members (household_id, user_id, display_name) values (%L, %L, 'Vreemd')$$, :'fam', :'u_zonder'), '42501',
  'D-016: beheerder voegt vreemd account toe');
select pg_temp.expect_sqlstate(format(
  $$insert into public.household_members (household_id, user_id, display_name, role) values (%L, %L, 'Vreemd', 'admin')$$, :'fam', :'u_zonder'), '42501',
  'D-016: beheerder voegt vreemd account toe als beheerder');
select pg_temp.expect_sqlstate(format(
  $$insert into public.household_members (household_id, user_id, display_name) values (%L, gen_random_uuid(), 'Onbekend')$$, :'fam'), '42501',
  'D-016: beheerder voegt onbekende uuid toe (zelfde uitkomst)');
select pg_temp.expect_sqlstate(format(
  $$insert into public.household_members (household_id, user_id, display_name) values (%L, %L, 'Nogmaals ik')$$, :'fam', :'u_jurgen'), '42501',
  'D-016: beheerder voegt eigen account nogmaals toe');
select pg_temp.assert((select count(*) = 0 from public.household_members where user_id = :'u_zonder'), 'D-016: geen vreemd account gekoppeld');
-- Een lid zonder account toevoegen mag wel; een account eraan hangen niet
insert into public.household_members (household_id, display_name) values (:'fam', 'Baby') returning id as baby \gset
select pg_temp.expect_sqlstate(format($$update public.household_members set user_id = %L where id = %L$$, :'u_zonder', :'baby'), '42501',
  'D-016: beheerder koppelt account aan lid zonder account');
select pg_temp.als(:'u_lynn');
select pg_temp.expect_sqlstate(format(
  $$insert into public.household_members (household_id, display_name) values (%L, 'Door Lynn')$$, :'fam'), '42501',
  'BR-24: gezinslid voegt lid toe');
select pg_temp.expect_sqlstate(format(
  $$insert into public.household_members (household_id, user_id, display_name) values (%L, %L, 'Lynn 2')$$, :'fam', :'u_lynn'), '42501',
  'D-016: gezinslid koppelt zichzelf nogmaals');

-- Buren: Bas (buitenstaander)
select pg_temp.als(:'u_bas');
select public.create_household('Buren', 'Bas') as buren \gset
select id as bas from public.household_members where household_id = :'buren' \gset

-- =============================================================================
-- B-01-regressie / BR-22: reeksacties door een gezinslid dat niet de maker is
-- (AC-001, AC-002, AC-003, AC-005)
-- =============================================================================
select pg_temp.als(:'u_jurgen');
insert into public.task_recurrences (household_id, title, rule, starts_on, generated_until, created_by_member_id)
values (:'fam', 'Badkamer schoonmaken', '{"freq":"weekly","interval":1}', current_date - 21, current_date + 14, :'jurgen')
returning id as r_jurgen \gset

insert into public.tasks (household_id, recurrence_id, occurrence_date, scheduled_date, title, created_by_member_id)
values (:'fam', :'r_jurgen', current_date - 21, current_date - 21, 'Badkamer schoonmaken', :'jurgen') returning id as rj_m21 \gset
insert into public.tasks (household_id, recurrence_id, occurrence_date, scheduled_date, title, created_by_member_id)
values (:'fam', :'r_jurgen', current_date - 14, current_date - 14, 'Badkamer schoonmaken', :'jurgen') returning id as rj_m14 \gset
insert into public.tasks (household_id, recurrence_id, occurrence_date, scheduled_date, title, created_by_member_id)
values (:'fam', :'r_jurgen', current_date - 7, current_date - 7, 'Badkamer schoonmaken', :'jurgen') returning id as rj_m7 \gset
insert into public.tasks (household_id, recurrence_id, occurrence_date, scheduled_date, title, created_by_member_id)
values (:'fam', :'r_jurgen', current_date + 7, current_date + 7, 'Badkamer schoonmaken', :'jurgen') returning id as rj_p7 \gset
insert into public.tasks (household_id, recurrence_id, occurrence_date, scheduled_date, title, created_by_member_id)
values (:'fam', :'r_jurgen', current_date + 14, current_date + 14, 'Badkamer schoonmaken', :'jurgen') returning id as rj_p14 \gset

select public.complete_task(:'rj_m21', '20000000-1111-0000-0000-000000000021');
select public.complete_task(:'rj_m14', '20000000-1111-0000-0000-000000000014');
select public.complete_task(:'rj_m7',  '20000000-1111-0000-0000-000000000007');

select pg_temp.assert(pg_temp.open_uitvoeringen(:'r_jurgen') = 2, 'setup: 2 open uitvoeringen');
select pg_temp.assert((select count(*) = 3 from public.task_completions where recurrence_id = :'r_jurgen'), 'setup: 3 afvinkingen');
select pg_temp.reeks_fp(:'r_jurgen') as fp_rj \gset

-- Lynn (gezinslid, niet de maker)
select pg_temp.als(:'u_lynn');
select pg_temp.expect_sqlstate(format($$select public.stop_series(%L)$$, :'r_jurgen'), '42501',
  'AC-001: gezinslid stopt andermans reeks');
select pg_temp.expect_sqlstate(format($$select public.pause_series(%L, current_date, current_date + 30)$$, :'r_jurgen'), '42501',
  'AC-002: gezinslid pauzeert andermans reeks');
select pg_temp.expect_sqlstate(format($$select public.resume_series(%L)$$, :'r_jurgen'), '42501',
  'AC-002: gezinslid hervat andermans reeks');
select pg_temp.expect_sqlstate(format($$select public.clear_series_occurrences(%L, current_date)$$, :'r_jurgen'), '42501',
  'AC-005: gezinslid ruimt uitvoeringen van andermans reeks op');
select pg_temp.expect_sqlstate(format($$select public.clear_series_occurrences(%L, current_date, current_date + 30, true)$$, :'r_jurgen'), '42501',
  'AC-005: gezinslid ruimt periode incl. uitzonderingen op');
select pg_temp.expect_sqlstate(format($$select public.delete_task(%L, 'future')$$, :'rj_p7'), '42501',
  'AC-003: gezinslid verwijdert "deze en volgende" van andermans reeks');
select pg_temp.expect_sqlstate(format($$select public.delete_task(%L, 'this')$$, :'rj_p7'), '42501',
  'BR-23: gezinslid verwijdert één uitvoering die hij niet maakte');
select pg_temp.expect_sqlstate('select public.stop_series(gen_random_uuid())', 'P0002', 'D-022: lid, onbekende reeks → niet gevonden');
-- Ongeldige invoer verandert de weigering niet: de rechtencheck komt eerst
select pg_temp.expect_sqlstate(format($$select public.pause_series(%L, current_date, current_date - 5)$$, :'r_jurgen'), '42501',
  'rechtencheck vóór invoercontrole in pause_series');

-- Directe schrijfacties op de reeks raken 0 rijen (stille RLS-weigering)
select pg_temp.assert(pg_temp.rows(format($$update public.task_recurrences set title = 'Gehackt' where id = %L$$, :'r_jurgen')) = 0,
  'BR-22: gezinslid wijzigt andermans reeks direct');
select pg_temp.assert(pg_temp.rows(format($$delete from public.task_recurrences where id = %L$$, :'r_jurgen')) = 0,
  'BR-22: gezinslid verwijdert andermans reeks direct');
select pg_temp.assert(pg_temp.rows(format($$delete from public.tasks where id = %L$$, :'rj_p7')) = 0,
  'BR-23: gezinslid verwijdert andermans uitvoering direct');

select pg_temp.assert(pg_temp.reeks_fp(:'r_jurgen') = :'fp_rj', 'AC-001..005: er is niets veranderd aan reeks, taken en historie');
select pg_temp.assert(pg_temp.open_uitvoeringen(:'r_jurgen') = 2, 'AC-001..005: nog steeds 2 open uitvoeringen');
select pg_temp.assert((pg_temp.reeks(:'r_jurgen')).is_active, 'AC-001: reeks nog actief');

-- Buitenstaander (BR-26, AC-027) evenmin. D-022: "ander huishouden" gedraagt zich
-- als "bestaat niet" (P0002 bij reeks-RPC's, true zonder wijziging bij delete_task).
select pg_temp.als(:'u_bas');
select pg_temp.expect_sqlstate(format($$select public.stop_series(%L)$$, :'r_jurgen'), 'P0002', 'AC-027: buitenstaander stopt reeks');
select pg_temp.expect_sqlstate(format($$select public.pause_series(%L, current_date, null)$$, :'r_jurgen'), 'P0002', 'AC-027: buitenstaander pauzeert reeks');
select pg_temp.expect_sqlstate(format($$select public.resume_series(%L)$$, :'r_jurgen'), 'P0002', 'AC-027: buitenstaander hervat reeks');
select pg_temp.expect_sqlstate(format($$select public.clear_series_occurrences(%L, current_date)$$, :'r_jurgen'), 'P0002', 'AC-027: buitenstaander ruimt op');
select pg_temp.expect_sqlstate('select public.stop_series(gen_random_uuid())', 'P0002', 'D-022: onbekende reeks geeft dezelfde uitkomst');
select public.delete_task(:'rj_p7', 'future') as bas_delete \gset
select pg_temp.assert(:'bas_delete'::boolean, 'D-022: delete_task op taak van ander huishouden geeft true (geen orakel)');
select public.delete_task(gen_random_uuid(), 'this') as onbekend_delete \gset
select pg_temp.assert(:'onbekend_delete'::boolean, 'D-022: delete_task op onbekende id geeft true');
select pg_temp.expect_error(format($$select public.complete_task(%L, gen_random_uuid())$$, :'rj_p7'), 'AC-027: buitenstaander vinkt af');
select pg_temp.assert(pg_temp.reeks_fp(:'r_jurgen') = :'fp_rj', 'AC-027: niets veranderd na pogingen van buitenstaander');

-- =============================================================================
-- BR-23 wijzigen en verplaatsen mag ieder actief lid (AC-013)
-- =============================================================================
select pg_temp.als(:'u_ellen');
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'fam', 'Planten water geven', current_date, :'ellen') returning id as t_ellen \gset

select pg_temp.als(:'u_lynn');
select pg_temp.reeks(:'r_jurgen') as rj_rij_voor \gset
select pg_temp.assert(pg_temp.rows(format($$update public.tasks set title = 'Planten water geven (binnen)' where id = %L$$, :'t_ellen')) = 1,
  'AC-013: gezinslid wijzigt titel van andermans losse taak');
select pg_temp.assert(pg_temp.rows(format(
  $$update public.tasks set scheduled_date = scheduled_date + 1, is_exception = true where id = %L$$, :'rj_p7')) = 1,
  'AC-013: gezinslid verplaatst uitvoering van andermans reeks');
select pg_temp.assert((select (t).scheduled_date = current_date + 8 and (t).is_exception and (t).occurrence_date = current_date + 7
                       from (select pg_temp.taak(:'rj_p7') as t) x), 'AC-013: verplaatst, uitzondering, occurrence_date gelijk');
select pg_temp.assert((pg_temp.reeks(:'r_jurgen'))::text = :'rj_rij_voor', 'AC-013: de reeks zelf is ongewijzigd');
-- BR-14 "bezig" mag ook
select pg_temp.assert(pg_temp.rows(format($$update public.tasks set status = 'in_progress' where id = %L$$, :'t_ellen')) = 1,
  'BR-14: gezinslid zet taak op bezig');
update public.tasks set status = 'todo' where id = :'t_ellen';

-- =============================================================================
-- Onveranderlijke velden (AC-014) en afvinken alleen via complete_task (AC-015)
-- =============================================================================
-- Maker van een taak: ook een beheerder kan hem niet wijzigen
select pg_temp.als(:'u_jurgen');
select pg_temp.expect_sqlstate(format($$update public.tasks set created_by_member_id = %L where id = %L$$, :'jurgen', :'t_ellen'), '42501',
  'AC-014: beheerder wijzigt maker van taak');
select pg_temp.expect_sqlstate(format($$update public.tasks set created_by_member_id = null where id = %L$$, :'t_ellen'), '42501',
  'AC-014: beheerder wist maker van taak');
select pg_temp.expect_sqlstate(format($$update public.tasks set household_id = %L where id = %L$$, :'buren', :'t_ellen'), '42501',
  'AC-014: taak naar ander huishouden');
select pg_temp.als(:'u_lynn');
select pg_temp.expect_sqlstate(format($$update public.tasks set created_by_member_id = %L where id = %L$$, :'lynn', :'t_ellen'), '42501',
  'AC-014: gezinslid maakt zichzelf maker');
select pg_temp.expect_sqlstate(format(
  $$insert into public.tasks (household_id, title, scheduled_date, created_by_member_id) values (%L, 'Vals', current_date, %L)$$, :'fam', :'ellen'), '42501',
  'AC-014: taak aanmaken op naam van een ander');
select pg_temp.assert((pg_temp.taak(:'t_ellen')).created_by_member_id = :'ellen', 'AC-014: maker van taak ongewijzigd');

-- Maker van een reeks: ook voor een beheerder onveranderlijk
select pg_temp.als(:'u_jurgen');
select pg_temp.expect_sqlstate(format($$update public.task_recurrences set created_by_member_id = %L where id = %L$$, :'lynn', :'r_jurgen'), '42501',
  'AC-014: beheerder wijzigt maker van reeks');
select pg_temp.als(:'u_lynn');
select pg_temp.expect_sqlstate(format(
  $$insert into public.task_recurrences (household_id, title, rule, starts_on, created_by_member_id) values (%L, 'Vals', '{"freq":"daily"}', current_date, %L)$$,
  :'fam', :'jurgen'), '42501', 'AC-014: reeks aanmaken op naam van een ander');
select pg_temp.assert((pg_temp.reeks(:'r_jurgen')).created_by_member_id = :'jurgen', 'AC-014: maker van reeks ongewijzigd');

-- deleted_at alleen via delete_task (ook niet voor een beheerder)
select pg_temp.als(:'u_jurgen');
select pg_temp.expect_sqlstate(format($$update public.tasks set deleted_at = now() where id = %L$$, :'t_ellen'), '42501',
  'BR-23: beheerder zet deleted_at direct');
select pg_temp.als(:'u_lynn');
select pg_temp.expect_sqlstate(format($$update public.tasks set deleted_at = now() where id = %L$$, :'t_ellen'), '42501',
  'BR-23: gezinslid zet deleted_at direct');
select pg_temp.expect_sqlstate(format(
  $$insert into public.tasks (household_id, title, scheduled_date, created_by_member_id, deleted_at) values (%L, 'Al weg', current_date, %L, now())$$,
  :'fam', :'lynn'), '42501', 'BR-23: taak aanmaken die al verwijderd is');
select pg_temp.assert((pg_temp.taak(:'t_ellen')).deleted_at is null, 'deleted_at nog leeg');

-- AC-015: status done / completed_at alleen via complete_task
select pg_temp.expect_sqlstate(format($$update public.tasks set status = 'done' where id = %L$$, :'t_ellen'), '42501',
  'AC-015: status direct op done');
select pg_temp.expect_sqlstate(format($$update public.tasks set completed_at = now() where id = %L$$, :'t_ellen'), '42501',
  'AC-015: completed_at direct invullen');
select pg_temp.als(:'u_jurgen');
select pg_temp.expect_sqlstate(format($$update public.tasks set status = 'done' where id = %L$$, :'t_ellen'), '42501',
  'AC-015: ook een beheerder zet status niet direct op done');
select pg_temp.als(:'u_lynn');
select public.complete_task(:'t_ellen', '20000000-1111-0000-0000-0000000000e1');
select pg_temp.assert((pg_temp.taak(:'t_ellen')).status = 'done', 'AC-015: afvinken via complete_task lukt');

-- =============================================================================
-- BR-23 verwijderen: alleen maker of beheerder (AC-012)
-- =============================================================================
select pg_temp.als(:'u_ellen');
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'fam', 'Ramen lappen', current_date, :'ellen') returning id as t_ellen2 \gset
select pg_temp.als(:'u_lynn');
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'fam', 'Fiets pompen', current_date, :'lynn') returning id as t_lynn \gset

select pg_temp.expect_sqlstate(format($$select public.delete_task(%L, 'this')$$, :'t_ellen2'), '42501',
  'AC-012: gezinslid verwijdert taak die hij niet maakte');
select pg_temp.assert(pg_temp.rows(format($$delete from public.tasks where id = %L$$, :'t_ellen2')) = 0,
  'AC-012: directe delete op andermans taak raakt niets');
select pg_temp.assert((pg_temp.taak(:'t_ellen2')).id is not null and (pg_temp.taak(:'t_ellen2')).deleted_at is null,
  'AC-012: taak van Ellen nog aanwezig');
select pg_temp.expect_sqlstate(format($$select public.delete_task(%L, 'iets')$$, :'t_lynn'), '22023', 'delete_task: onbekende scope');

select public.delete_task(:'t_lynn', 'this');
select pg_temp.assert((pg_temp.taak(:'t_lynn')).id is null, 'AC-012: eigen losse taak zonder historie is echt weg');
select public.delete_task(:'t_lynn', 'this') as nogmaals \gset
select pg_temp.assert(:'nogmaals'::boolean, 'delete_task is idempotent');

select pg_temp.als(:'u_jurgen');
select public.delete_task(:'t_ellen2', 'this');
select pg_temp.assert((pg_temp.taak(:'t_ellen2')).id is null, 'AC-012: beheerder verwijdert taak van een ander');
-- Met historie: zacht verwijderd, afvinking blijft
select public.delete_task(:'t_ellen', 'this');
select pg_temp.assert((pg_temp.taak(:'t_ellen')).deleted_at is not null, 'losse taak met historie wordt zacht verwijderd');
select pg_temp.assert((select count(*) = 1 from public.task_completions where task_id = :'t_ellen'), 'historie blijft na verwijderen');

-- =============================================================================
-- De maker beheert de eigen reeks, een beheerder elke reeks (AC-006, AC-007)
-- =============================================================================
select pg_temp.als(:'u_lynn');
insert into public.task_recurrences (household_id, title, rule, starts_on, created_by_member_id)
values (:'fam', 'Kattenbak', '{"freq":"weekly","interval":1}', current_date - 7, :'lynn') returning id as r_lynn1 \gset
insert into public.tasks (household_id, recurrence_id, occurrence_date, scheduled_date, title, created_by_member_id)
values (:'fam', :'r_lynn1', current_date - 7, current_date - 7, 'Kattenbak', :'lynn') returning id as rl1_m7 \gset
insert into public.tasks (household_id, recurrence_id, occurrence_date, scheduled_date, title, created_by_member_id)
values (:'fam', :'r_lynn1', current_date + 7, current_date + 7, 'Kattenbak', :'lynn') returning id as rl1_p7 \gset
insert into public.tasks (household_id, recurrence_id, occurrence_date, scheduled_date, title, created_by_member_id)
values (:'fam', :'r_lynn1', current_date + 14, current_date + 14, 'Kattenbak', :'lynn');
select public.complete_task(:'rl1_m7', '20000000-1111-0000-0000-0000000001a1');
-- Eén open uitvoering staat op "bezig": ook die hoort bij "alle open uitvoeringen" (TD §6.1)
update public.tasks set status = 'in_progress' where id = :'rl1_p7';
select pg_temp.assert(pg_temp.open_uitvoeringen(:'r_lynn1') = 2, 'setup: 2 open uitvoeringen (1 bezig)');

select public.stop_series(:'r_lynn1');
select pg_temp.assert(not (pg_temp.reeks(:'r_lynn1')).is_active, 'AC-006: maker stopt eigen reeks → inactief');
select pg_temp.assert(pg_temp.open_uitvoeringen(:'r_lynn1') = 0, 'AC-006: open uitvoeringen weg');
select pg_temp.assert((pg_temp.taak(:'rl1_p7')).id is null, 'TD §6.1: ook de uitvoering die bezig was is weg');
select pg_temp.assert((select count(*) = 1 from public.task_completions where recurrence_id = :'r_lynn1'), 'AC-006: afvinking blijft in historie');

-- Maker: pauzeren, hervatten en "deze en volgende" op een eigen reeks
insert into public.task_recurrences (household_id, title, rule, starts_on, created_by_member_id)
values (:'fam', 'Planten', '{"freq":"weekly","interval":1}', current_date, :'lynn') returning id as r_lynn3 \gset
insert into public.tasks (household_id, recurrence_id, occurrence_date, scheduled_date, title, created_by_member_id)
values (:'fam', :'r_lynn3', current_date + 7, current_date + 7, 'Planten', :'lynn') returning id as rl3_p7 \gset
insert into public.tasks (household_id, recurrence_id, occurrence_date, scheduled_date, title, created_by_member_id)
values (:'fam', :'r_lynn3', current_date + 14, current_date + 14, 'Planten', :'lynn') returning id as rl3_p14 \gset
insert into public.tasks (household_id, recurrence_id, occurrence_date, scheduled_date, title, created_by_member_id)
values (:'fam', :'r_lynn3', current_date + 21, current_date + 21, 'Planten', :'lynn') returning id as rl3_p21 \gset
select public.pause_series(:'r_lynn3', current_date + 30, current_date + 40);
select pg_temp.assert((pg_temp.reeks(:'r_lynn3')).paused_from = current_date + 30, 'BR-22: maker pauzeert eigen reeks');
select public.resume_series(:'r_lynn3');
select pg_temp.assert((pg_temp.reeks(:'r_lynn3')).paused_from is null, 'BR-22: maker hervat eigen reeks');
select public.delete_task(:'rl3_p14', 'future');
select pg_temp.assert((pg_temp.taak(:'rl3_p14')).deleted_at is not null, 'delete future: gekozen uitvoering zacht verwijderd');
select pg_temp.assert((pg_temp.taak(:'rl3_p21')).id is null, 'delete future: latere open uitvoering weg');
select pg_temp.assert((pg_temp.taak(:'rl3_p7')).deleted_at is null and (pg_temp.taak(:'rl3_p7')).id is not null, 'delete future: eerdere uitvoering blijft');
select pg_temp.assert(not (pg_temp.reeks(:'r_lynn3')).is_active, 'delete future: reeks gestopt');

-- AC-007: Ellen (beheerder) beheert Lynns reeks
insert into public.task_recurrences (household_id, title, rule, starts_on, created_by_member_id)
values (:'fam', 'Vaatwasser', '{"freq":"weekly","interval":1}', current_date, :'lynn') returning id as r_lynn2 \gset
insert into public.tasks (household_id, recurrence_id, occurrence_date, scheduled_date, title, created_by_member_id)
values (:'fam', :'r_lynn2', current_date + 7, current_date + 7, 'Vaatwasser', :'lynn') returning id as rl2_p7 \gset
insert into public.tasks (household_id, recurrence_id, occurrence_date, scheduled_date, title, created_by_member_id)
values (:'fam', :'r_lynn2', current_date + 14, current_date + 14, 'Vaatwasser', :'lynn') returning id as rl2_p14 \gset
insert into public.tasks (household_id, recurrence_id, occurrence_date, scheduled_date, title, created_by_member_id, is_exception)
values (:'fam', :'r_lynn2', current_date + 15, current_date + 15, 'Vaatwasser', :'lynn', true) returning id as rl2_p15 \gset

select pg_temp.als(:'u_ellen');
select public.pause_series(:'r_lynn2', current_date + 10, current_date + 20);
select pg_temp.assert((select (r).paused_from = current_date + 10 and (r).paused_until = current_date + 20
                       from (select pg_temp.reeks(:'r_lynn2') as r) x), 'AC-007: beheerder pauzeert reeks van een ander');
select pg_temp.assert((pg_temp.taak(:'rl2_p14')).id is null, 'BR-09: open uitvoering in de pauze vervalt');
select pg_temp.assert((pg_temp.taak(:'rl2_p15')).id is not null, 'BR-09: aangepaste uitvoering (uitzondering) blijft');
select pg_temp.assert((pg_temp.taak(:'rl2_p7')).id is not null, 'BR-09: uitvoering buiten de pauze blijft');
select public.resume_series(:'r_lynn2');
select pg_temp.assert((pg_temp.reeks(:'r_lynn2')).paused_from is null, 'AC-007: beheerder hervat');
select public.clear_series_occurrences(:'r_lynn2', current_date) as opgeruimd \gset
select pg_temp.assert(:'opgeruimd'::integer = 1, 'clear_series_occurrences: alleen de niet-aangepaste open uitvoering');
select pg_temp.assert((pg_temp.reeks(:'r_lynn2')).generated_until = current_date - 1, 'clear_series_occurrences: generated_until teruggezet');
select public.stop_series(:'r_lynn2');
select pg_temp.assert(not (pg_temp.reeks(:'r_lynn2')).is_active and pg_temp.open_uitvoeringen(:'r_lynn2') = 0,
  'AC-007: beheerder stopt reeks; ook uitzonderingen weg');

-- =============================================================================
-- Maker uitgezet of verwijderd: alleen beheerders beheren de reeks (AC-008)
-- =============================================================================
select pg_temp.als(:'u_kai');
insert into public.task_recurrences (household_id, title, rule, starts_on, created_by_member_id)
values (:'fam', 'Hond uitlaten', '{"freq":"daily"}', current_date, :'kai') returning id as r_kai \gset
insert into public.tasks (household_id, recurrence_id, occurrence_date, scheduled_date, title, created_by_member_id)
values (:'fam', :'r_kai', current_date + 1, current_date + 1, 'Hond uitlaten', :'kai') returning id as rk_p1 \gset
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'fam', 'Kamer opruimen', current_date, :'kai') returning id as t_kai \gset
select pg_temp.als(:'u_noor');
insert into public.task_recurrences (household_id, title, rule, starts_on, created_by_member_id)
values (:'fam', 'Gras maaien', '{"freq":"weekly","interval":1}', current_date, :'noor') returning id as r_noor \gset

-- Kai heeft meldingen, voorkeuren en er staan boodschappen (voor V-29 hieronder)
reset role;
insert into public.notifications (household_id, member_id, type, title, url)
values (:'fam', :'kai', 'reminder', 'Herinnering voor Kai', '/');
set role authenticated;
select pg_temp.als(:'u_jurgen');
select id as fam_lijst from public.shopping_lists where household_id = :'fam' \gset
insert into public.shopping_items (household_id, list_id, name) values (:'fam', :'fam_lijst', 'Melk');

-- Jurgen zet Kai uit, verwijdert Noor
select pg_temp.assert(pg_temp.rows(format($$update public.household_members set is_active = false where id = %L$$, :'kai')) = 1,
  'V-29: beheerder zet gezinslid uit');
select pg_temp.assert(pg_temp.rows(format($$delete from public.household_members where id = %L$$, :'noor')) = 1,
  'BR-24: beheerder verwijdert gezinslid');
select pg_temp.assert((pg_temp.reeks(:'r_noor')).created_by_member_id is null, 'AC-008: maker verwijderd → maker leeg (FK)');
select pg_temp.assert((pg_temp.reeks(:'r_kai')).is_active and pg_temp.open_uitvoeringen(:'r_kai') = 1,
  'AC-008: reeks van uitgezet lid loopt gewoon door');

select pg_temp.als(:'u_lynn');
select pg_temp.reeks_fp(:'r_kai') as fp_rk \gset
select pg_temp.expect_sqlstate(format($$select public.stop_series(%L)$$, :'r_kai'), '42501', 'AC-008: gezinslid stopt reeks van uitgezette maker');
select pg_temp.expect_sqlstate(format($$select public.stop_series(%L)$$, :'r_noor'), '42501', 'AC-008: gezinslid stopt reeks van verwijderde maker');
select pg_temp.assert(pg_temp.reeks_fp(:'r_kai') = :'fp_rk', 'AC-008: niets veranderd');

-- Uitgezette maker zelf mag zijn reeks niet meer beheren (V-29)
select pg_temp.als(:'u_kai');
select pg_temp.expect_sqlstate(format($$select public.stop_series(%L)$$, :'r_kai'), 'P0002', 'V-29: uitgezette maker stopt eigen reeks (D-022: geen lid = niet gevonden)');
select pg_temp.expect_sqlstate(format($$select public.pause_series(%L, current_date, null)$$, :'r_kai'), 'P0002', 'V-29: uitgezette maker pauzeert eigen reeks');
select pg_temp.expect_sqlstate(format($$select public.clear_series_occurrences(%L, current_date)$$, :'r_kai'), 'P0002', 'V-29: uitgezette maker ruimt op');
select public.delete_task(:'t_kai', 'this') as kai_delete \gset
select pg_temp.assert(:'kai_delete'::boolean, 'V-29/D-022: delete_task door uitgezet lid geeft true zonder wijziging');
select pg_temp.assert(pg_temp.reeks_fp(:'r_kai') = :'fp_rk', 'V-29: niets veranderd door uitgezette maker');
select pg_temp.assert((pg_temp.taak(:'t_kai')).deleted_at is null, 'V-29: eigen taak van uitgezet lid niet verwijderd');

select pg_temp.als(:'u_ellen');
select public.stop_series(:'r_noor');
select pg_temp.assert(not (pg_temp.reeks(:'r_noor')).is_active, 'AC-008: beheerder stopt reeks van verwijderde maker');

-- =============================================================================
-- V-29: uitgezet lid ziet en doet niets meer (AC-022), weer aanzetten (AC-025)
-- =============================================================================
select pg_temp.als(:'u_kai');
select pg_temp.zichtbare_huishoudrijen(:'fam') as kai_ziet \gset
select pg_temp.assert(:'kai_ziet' = '', 'AC-022: uitgezet lid ziet 0 rijen huishouddata, zag: ' || :'kai_ziet');
select pg_temp.assert((select count(*) = 0 from public.households), 'AC-022: uitgezet lid ziet geen huishouden');
select pg_temp.assert((select count(*) = 0 from public.tasks), 'AC-022: geen taken');
select pg_temp.assert((select count(*) = 0 from public.task_recurrences), 'AC-022: geen reeksen');
select pg_temp.assert((select count(*) = 0 from public.shopping_items), 'AC-022: geen boodschappen');
select pg_temp.assert((select count(*) = 0 from public.shopping_lists), 'AC-022: geen boodschappenlijsten');
select pg_temp.assert((select count(*) = 0 from public.notifications), 'AC-022: geen meldingen (ook niet de eigen)');
select pg_temp.assert((select count(*) = 0 from public.user_preferences), 'AC-022: geen voorkeuren');
select pg_temp.assert((select count(*) = 1 from public.users), 'AC-022: alleen het eigen profiel');
select pg_temp.assert((select count(*) = 1 and bool_and(id = :'kai') from public.household_members), 'V-29: alleen de eigen lidrij leesbaar');
select pg_temp.assert((select not is_active from public.household_members where id = :'kai'), 'V-29: eigen rij toont is_active = false');
select pg_temp.assert((select member_id = :'kai' and household_id = :'fam' and household_name = 'Familie' and not is_active and role = 'member'
                       from public.my_membership()), 'V-29: my_membership() geeft is_active = false en de naam van het huishouden');

select pg_temp.expect_sqlstate(format($$select public.complete_task(%L, gen_random_uuid())$$, :'rk_p1'), '42501', 'AC-022: uitgezet lid vinkt af');
select pg_temp.expect_sqlstate(format($$select public.undo_complete_task(%L)$$, :'rj_m7'), '42501', 'AC-022: uitgezet lid draait terug');
select pg_temp.expect_error(format(
  $$insert into public.tasks (household_id, title, scheduled_date) values (%L, 'Stiekem', current_date)$$, :'fam'), 'AC-022: uitgezet lid maakt taak');
select pg_temp.expect_sqlstate(format(
  $$insert into public.shopping_items (household_id, list_id, name) values (%L, %L, 'Snoep')$$, :'fam', :'fam_lijst'), '42501',
  'AC-022: uitgezet lid voegt boodschap toe');
select pg_temp.assert(pg_temp.rows(format($$update public.tasks set title = 'Weg' where id = %L$$, :'t_kai')) = 0, 'AC-022: uitgezet lid wijzigt taak');
select pg_temp.assert(pg_temp.rows(format($$update public.household_members set is_active = true where id = %L$$, :'kai')) = 0,
  'V-29: uitgezet lid zet zichzelf niet weer aan');
select pg_temp.assert(not (pg_temp.lid(:'kai')).is_active, 'V-29: nog steeds uitgezet');

-- Weer aanzetten herstelt alles (AC-025)
select pg_temp.als(:'u_jurgen');
update public.household_members set is_active = true where id = :'kai';
select pg_temp.als(:'u_kai');
select pg_temp.assert((select count(*) = 1 from public.households), 'AC-025: ziet huishouden weer');
select pg_temp.assert((select count(*) > 0 from public.tasks), 'AC-025: ziet taken weer');
select pg_temp.assert((select count(*) = 1 from public.notifications), 'AC-025: ziet eigen melding weer');
select pg_temp.assert((select count(*) = 1 from public.user_preferences), 'AC-025: voorkeuren weer actief');
select pg_temp.assert((select is_active from public.my_membership()), 'AC-025: my_membership() actief');

-- =============================================================================
-- BR-24 leden: eigen rol/status (AC-020), jezelf (AC-021), laatste beheerder (AC-019)
-- =============================================================================
select pg_temp.als(:'u_lynn');
select pg_temp.expect_sqlstate(format($$update public.household_members set role = 'admin' where id = %L$$, :'lynn'), '42501',
  'AC-020: gezinslid maakt zichzelf beheerder');
select pg_temp.expect_sqlstate(format($$update public.household_members set is_active = false where id = %L$$, :'lynn'), '42501',
  'AC-020: gezinslid wijzigt eigen status');
select pg_temp.expect_sqlstate(format($$update public.household_members set user_id = %L where id = %L$$, :'u_zonder', :'lynn'), '42501',
  'BR-24: gezinslid wijzigt eigen accountkoppeling');
select pg_temp.assert(pg_temp.rows(format($$update public.household_members set display_name = 'Lynn ☀', color = '#16a34a' where id = %L$$, :'lynn')) = 1,
  'AC-020: gezinslid wijzigt eigen naam en kleur');
select pg_temp.assert(pg_temp.rows(format($$update public.household_members set display_name = 'Ellie' where id = %L$$, :'ellen')) = 0,
  'BR-24: gezinslid wijzigt profiel van een ander');
select pg_temp.assert(pg_temp.rows(format($$delete from public.household_members where id = %L$$, :'kai')) = 0,
  'BR-24: gezinslid verwijdert een ander');
select pg_temp.assert((select (l).role = 'member' and (l).is_active from (select pg_temp.lid(:'lynn') as l) x), 'AC-020: rol en status ongewijzigd');

-- AC-021: beheerder zet zichzelf niet uit / verwijdert zichzelf niet (Ellen is tweede beheerder)
select pg_temp.als(:'u_jurgen');
select pg_temp.expect_sqlstate(format($$update public.household_members set is_active = false where id = %L$$, :'jurgen'), '42501',
  'AC-021: beheerder zet zichzelf uit');
select pg_temp.expect_sqlstate(format($$delete from public.household_members where id = %L$$, :'jurgen'), '42501',
  'AC-021: beheerder verwijdert zichzelf');
select pg_temp.expect_sqlstate(format($$update public.household_members set user_id = %L where id = %L$$, :'u_zonder', :'lynn'), '42501',
  'BR-24: ook een beheerder wijzigt geen accountkoppeling');
select pg_temp.assert((pg_temp.lid(:'jurgen')).is_active, 'AC-021: Jurgen nog actief');

-- AC-019: telt alleen ACTIEVE beheerders. Ellen zet Jurgen uit (mag: zij blijft).
select pg_temp.als(:'u_ellen');
select pg_temp.assert(pg_temp.rows(format($$update public.household_members set is_active = false where id = %L$$, :'jurgen')) = 1,
  'BR-24: beheerder zet andere beheerder uit als er een actieve overblijft');
-- Nu is Ellen de enige actieve beheerder (Jurgen is nog wel admin, maar uitgezet)
select pg_temp.expect_sqlstate(format($$update public.household_members set role = 'member' where id = %L$$, :'ellen'), '23514',
  'AC-019: laatste actieve beheerder degradeert zichzelf');
select pg_temp.expect_sqlstate(format($$update public.household_members set is_active = false where id = %L$$, :'ellen'), '42501',
  'AC-019: laatste actieve beheerder zet zichzelf uit');
select pg_temp.expect_sqlstate(format($$delete from public.household_members where id = %L$$, :'ellen'), '42501',
  'AC-019: laatste actieve beheerder verwijdert zichzelf');
select pg_temp.assert((select (l).role = 'admin' and (l).is_active from (select pg_temp.lid(:'ellen') as l) x), 'AC-019: Ellen nog actieve beheerder');
-- Een uitgezette beheerder telt niet, maar mag wel gedegradeerd worden
select pg_temp.assert(pg_temp.rows(format($$update public.household_members set is_active = true where id = %L$$, :'jurgen')) = 1,
  'BR-24: beheerder zet andere beheerder weer aan');
-- Met twee actieve beheerders mag degraderen wel
select pg_temp.assert(pg_temp.rows(format($$update public.household_members set role = 'member' where id = %L$$, :'jurgen')) = 1,
  'BR-24: beheerder degradeert andere beheerder als er een overblijft');
update public.household_members set role = 'admin' where id = :'jurgen';
select pg_temp.assert((pg_temp.lid(:'jurgen')).role = 'admin', 'Jurgen weer beheerder');

-- Solo: de enige beheerder van een huishouden
select pg_temp.als(:'u_solo');
select public.create_household('Solo', 'Solo') as solo_h \gset
select id as solo from public.household_members where household_id = :'solo_h' \gset
select pg_temp.expect_sqlstate(format($$update public.household_members set role = 'member' where id = %L$$, :'solo'), '23514',
  'AC-019: enige beheerder degradeert zichzelf');

-- =============================================================================
-- BR-25 meldingen alleen door het systeem (AC-016) + url-check (AC-017)
-- =============================================================================
select pg_temp.als(:'u_lynn');
select pg_temp.expect_sqlstate(format(
  $$insert into public.notifications (household_id, member_id, type, title) values (%L, %L, 'reminder', 'Zelf')$$, :'fam', :'lynn'), '42501',
  'AC-016: lid plaatst melding voor zichzelf');
select pg_temp.expect_sqlstate(format(
  $$insert into public.notifications (household_id, member_id, type, title, url) values (%L, %L, 'reminder', 'Klik!', '//x.nl')$$, :'fam', :'jurgen'), '42501',
  'AC-016: lid plaatst melding voor huisgenoot');
select pg_temp.als(:'u_jurgen');
select pg_temp.expect_sqlstate(format(
  $$insert into public.notifications (household_id, member_id, type, title) values (%L, %L, 'reminder', 'Beheerder')$$, :'fam', :'ellen'), '42501',
  'AC-016: ook een beheerder plaatst geen melding');

reset role;  -- het systeem (service role / superuser)
select pg_temp.expect_sqlstate(format(
  $$insert into public.notifications (household_id, member_id, type, title, url) values (%L, %L, 'reminder', 'x', '//x.nl')$$, :'fam', :'lynn'), '23514',
  'AC-017: url //x.nl');
select pg_temp.expect_sqlstate(format(
  $$insert into public.notifications (household_id, member_id, type, title, url) values (%L, %L, 'reminder', 'x', '/\x.nl')$$, :'fam', :'lynn'), '23514',
  'AC-017: url /\x.nl');
select pg_temp.expect_sqlstate(format(
  $$insert into public.notifications (household_id, member_id, type, title, url) values (%L, %L, 'reminder', 'x', 'https://x.nl')$$, :'fam', :'lynn'), '23514',
  'AC-017: url https://x.nl');
select pg_temp.expect_sqlstate(format(
  $$insert into public.notifications (household_id, member_id, type, title, url) values (%L, %L, 'reminder', 'x', '')$$, :'fam', :'lynn'), '23514',
  'AC-017: lege url');
insert into public.notifications (household_id, member_id, type, title, url) values
  (:'fam', :'lynn', 'reminder', 'Naar de taak', '/?taak=' || :'rj_p14'),
  (:'fam', :'lynn', 'reminder', 'Naar start', '/'),
  (:'fam', :'lynn', 'reminder', 'Zonder link', null);
set role authenticated;
select pg_temp.als(:'u_lynn');
select pg_temp.assert((select count(*) = 3 from public.notifications), 'AC-017: interne urls geaccepteerd, lid ziet eigen meldingen');
select pg_temp.assert(pg_temp.rows($$update public.notifications set read_at = now()$$) = 3, 'BR-25: eigen meldingen als gelezen markeren');
select pg_temp.expect_sqlstate($$update public.notifications set url = '//x.nl' where url = '/'$$, '23514',
  'AC-017: url-check geldt ook bij bijwerken');
select pg_temp.als(:'u_jurgen');
select pg_temp.assert(pg_temp.rows(format($$update public.notifications set read_at = now() where member_id = %L$$, :'lynn')) = 0,
  'BR-25: meldingen van een ander niet te wijzigen');

-- =============================================================================
-- BR-20 aanmaken met de instelling uit (AC-010) en aan (AC-011); huishoudinstellingen
-- =============================================================================
select pg_temp.als(:'u_lynn');
insert into public.task_recurrences (household_id, title, rule, starts_on, created_by_member_id)
values (:'fam', 'Bed opmaken', '{"freq":"daily"}', current_date, :'lynn') returning id as r_lynn4 \gset
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'fam', 'Kast opruimen', current_date, :'lynn') returning id as t_lynn2 \gset
select pg_temp.assert(pg_temp.rows(format($$update public.households set members_can_create_tasks = false where id = %L$$, :'fam')) = 0,
  'Huishoudinstellingen: gezinslid wijzigt instelling niet');

select pg_temp.als(:'u_jurgen');
select pg_temp.assert(pg_temp.rows(format($$update public.households set members_can_create_tasks = false where id = %L$$, :'fam')) = 1,
  'Huishoudinstellingen: beheerder zet aanmaken uit');

select pg_temp.als(:'u_lynn');
select count(*) as taken_voor from public.tasks \gset
select pg_temp.expect_sqlstate(format(
  $$insert into public.tasks (household_id, title, scheduled_date, created_by_member_id) values (%L, 'Mag niet', current_date, %L)$$, :'fam', :'lynn'), '42501',
  'AC-010: gezinslid maakt losse taak terwijl instelling uit staat');
select pg_temp.expect_sqlstate(format(
  $$insert into public.task_recurrences (household_id, title, rule, starts_on, created_by_member_id) values (%L, 'Mag niet', '{"freq":"daily"}', current_date, %L)$$,
  :'fam', :'lynn'), '42501', 'AC-010: gezinslid maakt reeks terwijl instelling uit staat');
-- Reekskoppeling (a): zonder aanmaakrecht een taak aan de eigen reeks koppelen
select pg_temp.expect_sqlstate(format(
  $$update public.tasks set recurrence_id = %L, occurrence_date = scheduled_date where id = %L$$, :'r_lynn4', :'t_lynn2'), '42501',
  'Reekskoppeling: zonder aanmaakrecht aan eigen reeks koppelen');
select pg_temp.assert((select count(*) = :'taken_voor' from public.tasks), 'AC-010: geen taak aangemaakt');
select pg_temp.assert((pg_temp.taak(:'t_lynn2')).recurrence_id is null, 'Reekskoppeling: taak nog los');
-- Wijzigen blijft wel mogen (BR-23 hangt niet af van BR-20)
select pg_temp.assert(pg_temp.rows(format($$update public.tasks set title = 'Kast uitmesten' where id = %L$$, :'t_lynn2')) = 1,
  'BR-23: wijzigen mag ook als aanmaken uit staat');

select pg_temp.als(:'u_jurgen');
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'fam', 'Beheerder mag', current_date, :'jurgen');
update public.households set members_can_create_tasks = true where id = :'fam';

-- AC-011: instelling aan → aanmaken lukt, maker vastgelegd
select pg_temp.als(:'u_lynn');
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'fam', 'Lynn mag', current_date, :'lynn') returning id as t_lynn3 \gset
insert into public.task_recurrences (household_id, title, rule, starts_on, created_by_member_id)
values (:'fam', 'Lynn mag reeks', '{"freq":"daily"}', current_date, :'lynn') returning id as r_lynn5 \gset
select pg_temp.assert((pg_temp.taak(:'t_lynn3')).created_by_member_id = :'lynn', 'AC-011: losse taak aangemaakt met Lynn als maker');
select pg_temp.assert((pg_temp.reeks(:'r_lynn5')).created_by_member_id = :'lynn', 'AC-011: reeks aangemaakt met Lynn als maker');

-- =============================================================================
-- Reekskoppeling (TECHNICAL_DESIGN §5.2): de vier gevallen + de toegestane route
-- =============================================================================
-- Toegestaan: "losse taak wordt terugkerend" door de maker met aanmaakrecht
select pg_temp.assert(pg_temp.rows(format(
  $$update public.tasks set recurrence_id = %L, occurrence_date = scheduled_date where id = %L$$, :'r_lynn4', :'t_lynn2')) = 1,
  'Reekskoppeling: maker met aanmaakrecht koppelt losse taak aan eigen reeks');
-- (b) koppelen aan andermans reeks
select pg_temp.expect_sqlstate(format(
  $$update public.tasks set recurrence_id = %L, occurrence_date = current_date + 100 where id = %L$$, :'r_jurgen', :'t_lynn3'), '42501',
  'Reekskoppeling (b): gezinslid koppelt aan andermans reeks');
select pg_temp.expect_sqlstate(format(
  $$insert into public.tasks (household_id, recurrence_id, occurrence_date, scheduled_date, title, created_by_member_id) values (%L, %L, current_date + 100, current_date + 100, 'Erbij', %L)$$,
  :'fam', :'r_jurgen', :'lynn'), '42501',
  'Reekskoppeling: gezinslid voegt uitvoering toe aan andermans reeks');
-- occurrence_date alleen voor wie de reeks beheert
select pg_temp.expect_sqlstate(format($$update public.tasks set occurrence_date = current_date + 15 where id = %L$$, :'rj_p14'), '42501',
  'Reekskoppeling: gezinslid wijzigt occurrence_date in andermans reeks');
-- (c) maker ontkoppelt eigen taak
select pg_temp.expect_sqlstate(format($$update public.tasks set recurrence_id = null where id = %L$$, :'t_lynn2'), '42501',
  'Reekskoppeling (c): maker ontkoppelt taak van eigen reeks');
select pg_temp.assert((pg_temp.taak(:'t_lynn2')).recurrence_id = :'r_lynn4', 'Reekskoppeling: koppeling onveranderd');

select pg_temp.als(:'u_jurgen');
insert into public.task_recurrences (household_id, title, rule, starts_on, created_by_member_id)
values (:'fam', 'Afval buiten zetten', '{"freq":"weekly","interval":1}', current_date, :'jurgen') returning id as r_jurgen2 \gset
insert into public.tasks (household_id, recurrence_id, occurrence_date, scheduled_date, title, created_by_member_id)
values (:'fam', :'r_jurgen2', current_date + 3, current_date + 3, 'Afval buiten zetten', :'jurgen') returning id as rj2_p3 \gset
-- (c) beheerder én maker: ontkoppelen of wisselen van reeks
select pg_temp.expect_sqlstate(format($$update public.tasks set recurrence_id = null where id = %L$$, :'rj_p14'), '42501',
  'Reekskoppeling (c): beheerder ontkoppelt uitvoering');
select pg_temp.expect_sqlstate(format($$update public.tasks set recurrence_id = %L where id = %L$$, :'r_jurgen2', :'rj_p14'), '42501',
  'Reekskoppeling (c): beheerder wisselt uitvoering naar andere reeks');
select pg_temp.assert((pg_temp.taak(:'rj_p14')).recurrence_id = :'r_jurgen', 'Reekskoppeling: uitvoering hoort nog bij haar reeks');
-- occurrence_date mag voor wie de reeks beheert (§5.2, nodig voor "deze en volgende")
select pg_temp.assert(pg_temp.rows(format($$update public.tasks set occurrence_date = current_date + 15 where id = %L$$, :'rj_p14')) = 1,
  'Reekskoppeling: beheerder/maker wijzigt occurrence_date');
-- (d) reeks verwijderd → FK zet recurrence_id op null zonder fout
select pg_temp.assert(pg_temp.rows(format($$delete from public.task_recurrences where id = %L$$, :'r_jurgen2')) = 1,
  'Reekskoppeling (d): beheerder verwijdert reeks');
select pg_temp.assert((select (t).id is not null and (t).recurrence_id is null from (select pg_temp.taak(:'rj2_p3') as t) x),
  'Reekskoppeling (d): FK zet recurrence_id op null');

-- =============================================================================
-- Notities: plaatsen als jezelf, verwijderen eigen of beheerder (TD §5.2)
-- =============================================================================
select pg_temp.als(:'u_ellen');
insert into public.task_comments (household_id, task_id, member_id, body) values (:'fam', :'rj_p14', :'ellen', 'Schoonmaakmiddel is op')
returning id as c_ellen \gset
select pg_temp.als(:'u_lynn');
select pg_temp.expect_sqlstate(format(
  $$insert into public.task_comments (household_id, task_id, member_id, body) values (%L, %L, %L, 'Namens Ellen')$$, :'fam', :'rj_p14', :'ellen'), '42501',
  'Notities: plaatsen namens een ander');
insert into public.task_comments (household_id, task_id, member_id, body) values (:'fam', :'rj_p14', :'lynn', 'Ik neem het mee')
returning id as c_lynn \gset
select pg_temp.assert(pg_temp.rows(format($$delete from public.task_comments where id = %L$$, :'c_ellen')) = 0, 'Notities: andermans notitie verwijderen');
select pg_temp.assert(pg_temp.rows(format($$delete from public.task_comments where id = %L$$, :'c_lynn')) = 1, 'Notities: eigen notitie verwijderen');
select pg_temp.als(:'u_jurgen');
select pg_temp.assert(pg_temp.rows(format($$delete from public.task_comments where id = %L$$, :'c_ellen')) = 1, 'Notities: beheerder verwijdert notitie van een ander');

-- =============================================================================
-- BR-26 isolatie: Bas ziet en raakt niets van Familie (AC-026, AC-027)
-- =============================================================================
select pg_temp.als(:'u_bas');
select pg_temp.zichtbare_huishoudrijen(:'fam') as bas_ziet \gset
select pg_temp.assert(:'bas_ziet' = '', 'AC-026: buitenstaander ziet 0 rijen van Familie, zag: ' || :'bas_ziet');
select pg_temp.assert((select count(*) = 0 from public.household_members where household_id = :'fam'), 'AC-026: geen leden van Familie');
select pg_temp.assert((select count(*) = 0 from public.users where id in (:'u_jurgen', :'u_ellen', :'u_lynn')), 'AC-026: geen profielen van Familie');
select pg_temp.expect_error(format(
  $$insert into public.task_comments (household_id, task_id, member_id, body) values (%L, %L, %L, 'Hallo')$$, :'buren', :'rj_p14', :'bas'),
  'AC-027: notitie in eigen huishouden die naar taak van Familie wijst');
select pg_temp.expect_error(format(
  $$insert into public.tasks (household_id, recurrence_id, occurrence_date, scheduled_date, title) values (%L, %L, current_date + 200, current_date, 'Inbraak')$$, :'buren', :'r_jurgen'),
  'AC-027: taak in eigen huishouden aan reeks van Familie koppelen');
select pg_temp.assert(pg_temp.rows(format($$update public.tasks set title = 'Gehackt' where household_id = %L$$, :'fam')) = 0,
  'AC-027: taken van Familie wijzigen');
select pg_temp.assert(pg_temp.rows(format($$delete from public.shopping_items where household_id = %L$$, :'fam')) = 0,
  'AC-027: boodschappen van Familie verwijderen');

-- Iemand zonder huishouden
select pg_temp.als(:'u_zonder');
select pg_temp.assert((select count(*) = 0 from public.my_membership()), 'my_membership(): geen lidmaatschap = geen rij');
select pg_temp.expect_sqlstate(format($$select public.stop_series(%L)$$, :'r_jurgen'), 'P0002', 'BR-26/D-022: zonder huishouden stopt reeks');

-- =============================================================================
-- B-04: interne functies in "private" niet aanroepbaar, helpers wel (AC-028)
-- =============================================================================
reset role;
select coalesce(string_agg(p.oid::regprocedure::text, ', '), '') as fout_rechten
from pg_proc p
where p.pronamespace = 'private'::regnamespace
  and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      <> (p.proname in ('is_member', 'is_admin', 'my_member_id', 'is_my_member', 'can_create_tasks', 'can_manage_series', 'can_delete_task')) \gset
select pg_temp.assert(:'fout_rechten' = '', 'AC-028: execute-rechten in private kloppen niet voor: ' || :'fout_rechten');
select pg_temp.assert((select count(*) = 0 from pg_proc p where p.pronamespace = 'private'::regnamespace
                       and has_function_privilege('anon', p.oid, 'EXECUTE')), 'AC-028: anon kan niets in private aanroepen');
select pg_temp.assert((select count(*) = 0 from unnest(array[
    'public.clear_series_occurrences(uuid,date,date,boolean)', 'public.pause_series(uuid,date,date)',
    'public.resume_series(uuid)', 'public.stop_series(uuid)', 'public.delete_task(uuid,text)', 'public.my_membership()'
  ]::regprocedure[]) f where has_function_privilege('anon', f, 'EXECUTE')), 'nieuwe RPC''s niet aanroepbaar voor anon');
select pg_temp.assert((select count(*) = 6 from unnest(array[
    'public.clear_series_occurrences(uuid,date,date,boolean)', 'public.pause_series(uuid,date,date)',
    'public.resume_series(uuid)', 'public.stop_series(uuid)', 'public.delete_task(uuid,text)', 'public.my_membership()'
  ]::regprocedure[]) f where has_function_privilege('authenticated', f, 'EXECUTE')), 'nieuwe RPC''s aanroepbaar voor authenticated');

set role authenticated;
select pg_temp.als(:'u_lynn');
select pg_temp.expect_sqlstate('select private.guard_task_changes()', '42501', 'AC-028: guard_task_changes aanroepen');
select pg_temp.expect_sqlstate('select private.guard_member_changes()', '42501', 'AC-028: guard_member_changes aanroepen');
select pg_temp.expect_sqlstate('select private.guard_recurrence_changes()', '42501', 'AC-028: guard_recurrence_changes aanroepen');
select pg_temp.expect_sqlstate('select private.handle_new_auth_user()', '42501', 'AC-028: handle_new_auth_user aanroepen');
select pg_temp.expect_sqlstate('select private.set_updated_at()', '42501', 'AC-028: set_updated_at aanroepen');
select pg_temp.assert(private.is_member(:'fam') and not private.is_admin(:'fam') and private.my_member_id(:'fam') = :'lynn',
  'AC-028: helpers voor policies blijven aanroepbaar');
select pg_temp.assert(private.can_manage_series(:'r_lynn4') and not private.can_manage_series(:'r_jurgen'), 'can_manage_series (BR-22)');
select pg_temp.assert(private.can_delete_task(:'fam', :'lynn') and not private.can_delete_task(:'fam', :'ellen'), 'can_delete_task (BR-23)');

reset role;
\o
select 'Rechtentests (TECHNICAL_DESIGN §5.2) geslaagd' as resultaat;
