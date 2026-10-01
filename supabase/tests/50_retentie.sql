-- =============================================================================
-- Tests: WP3 — bewaartermijnen en index voor de tick (…_300_retentie)
-- ACCEPTANCE_CRITERIA AC-077, AC-078; TECHNICAL_DESIGN §3.4, §11.3; DECISIONS D-040
-- Draait ná 10_ … 40_ in dezelfde database, met eigen accounts en eigen
-- huishoudens. Grensdatums liggen vast rond één referentiemoment (:'nu'), dat
-- aan private.purge_expired_data(p_now) wordt meegegeven: deterministisch.
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

create or replace function pg_temp.systeem()
returns void language sql as $$
  select set_config('request.jwt.claims', '', false);
$$;

-- Bestaat een rij nog (ongeacht RLS; eigenaar is de superuser)
create or replace function pg_temp.bestaat(p_table text, p_id uuid)
returns boolean language plpgsql security definer as $$
declare v boolean;
begin
  execute format('select exists (select 1 from public.%I where id = %L)', p_table, p_id) into v;
  return v;
end;
$$;

grant execute on all functions in schema pg_temp to authenticated, anon;

-- -----------------------------------------------------------------------------
-- Testdata: twee accounts, elk een eigen huishouden
-- -----------------------------------------------------------------------------
\set u_ret  '50000000-0000-0000-0000-0000000000c1'
\set u_lid  '50000000-0000-0000-0000-0000000000c2'

insert into auth.users (id, email, raw_user_meta_data) values
  (:'u_ret', 'jurgen.ret@example.com', '{"display_name":"Jurgen"}'),
  (:'u_lid', 'lynn.ret@example.com',   '{"display_name":"Lynn"}');

set role authenticated;
select pg_temp.als(:'u_ret');
select public.create_household('Familie retentie', 'Jurgen') as fam \gset
select id as jurgen from public.household_members where user_id = :'u_ret' \gset
insert into public.household_invitations (household_id, email, role, invited_by_member_id)
  values (:'fam', 'lynn.ret@example.com', 'member', :'jurgen');
select token as tok_lynn from public.household_invitations where email = 'lynn.ret@example.com' \gset
select pg_temp.als(:'u_lid');
select public.accept_invitation(:'tok_lynn', 'Lynn');
reset role;
select pg_temp.systeem();
select id as lynn from public.household_members where user_id = :'u_lid' \gset

-- Vast referentiemoment (in de zomertijd niet relevant: de grenzen zijn intervallen)
select '2026-09-29 10:00:00+00'::timestamptz as nu \gset
select ((:'nu'::timestamptz) at time zone 'Europe/Amsterdam')::date as vandaag \gset

-- Een reeks voor de uitvoeringen
insert into public.task_recurrences (household_id, title, rule, starts_on, created_by_member_id)
values (:'fam', 'Ret reeks', '{"freq":"daily","interval":1}', '2025-01-01', :'jurgen')
returning id as reeks \gset

-- ---- Afvinkhistorie: 2 jaar ----
insert into public.task_completions (household_id, title, completed_at)
values (:'fam', 'Ret historie oud', :'nu'::timestamptz - interval '2 years' - interval '1 minute') returning id as c_oud \gset
insert into public.task_completions (household_id, title, completed_at)
values (:'fam', 'Ret historie net binnen', :'nu'::timestamptz - interval '2 years' + interval '1 minute') returning id as c_nieuw \gset

-- ---- Meldingen: 90 dagen ----
insert into public.notifications (household_id, member_id, type, title, created_at)
values (:'fam', :'jurgen', 'reminder', 'Ret melding oud', :'nu'::timestamptz - interval '90 days' - interval '1 minute') returning id as n_oud \gset
insert into public.notifications (household_id, member_id, type, title, created_at)
values (:'fam', :'lynn', 'reminder', 'Ret melding net binnen', :'nu'::timestamptz - interval '90 days' + interval '1 minute') returning id as n_nieuw \gset

-- ---- Lijsten: gearchiveerd 1 jaar (producten gaan mee), actieve lijst blijft ----
select id as l_actief from public.shopping_lists where household_id = :'fam' and archived_at is null \gset
insert into public.shopping_lists (household_id, name, archived_at)
values (:'fam', 'Ret lijst oud', :'nu'::timestamptz - interval '1 year' - interval '1 minute') returning id as l_oud \gset
insert into public.shopping_lists (household_id, name, archived_at)
values (:'fam', 'Ret lijst net binnen', :'nu'::timestamptz - interval '1 year' + interval '1 minute') returning id as l_nieuw \gset
insert into public.shopping_items (household_id, list_id, name) values (:'fam', :'l_oud', 'Ret melk oud') returning id as p_oud \gset
insert into public.shopping_items (household_id, list_id, name) values (:'fam', :'l_nieuw', 'Ret melk nieuw') returning id as p_nieuw \gset
insert into public.shopping_items (household_id, list_id, name) values (:'fam', :'l_actief', 'Ret melk actief') returning id as p_actief \gset

-- ---- Uitnodigingen: 30 dagen na gebruik of verlopen ----
-- open (nog niet verlopen, niet gebruikt): blijft, hoe oud ook aangemaakt
insert into public.household_invitations (household_id, role, expires_at, created_at)
values (:'fam', 'member', :'nu'::timestamptz + interval '3 days', :'nu'::timestamptz - interval '400 days') returning id as i_open \gset
-- verlopen, net voorbij de grens: weg
insert into public.household_invitations (household_id, role, expires_at)
values (:'fam', 'member', :'nu'::timestamptz - interval '30 days' - interval '1 minute') returning id as i_verlopen_oud \gset
-- verlopen, net binnen de grens: blijft
insert into public.household_invitations (household_id, role, expires_at)
values (:'fam', 'member', :'nu'::timestamptz - interval '30 days' + interval '1 minute') returning id as i_verlopen_nieuw \gset
-- gebruikt, net voorbij de grens (vervaldatum nog in de toekomst): weg
insert into public.household_invitations (household_id, role, expires_at, accepted_at)
values (:'fam', 'member', :'nu'::timestamptz + interval '10 days', :'nu'::timestamptz - interval '30 days' - interval '1 minute') returning id as i_gebruikt_oud \gset
-- gebruikt, net binnen de grens (vervaldatum al lang voorbij): blijft — gebruik telt, niet verloop
insert into public.household_invitations (household_id, role, expires_at, accepted_at)
values (:'fam', 'member', :'nu'::timestamptz - interval '60 days', :'nu'::timestamptz - interval '30 days' + interval '1 minute') returning id as i_gebruikt_nieuw \gset

-- ---- Zacht verwijderde taken (TD §3.4 + D-040) ----
-- losse taak, 90 dagen + 1 min verwijderd: weg; de historie blijft (task_id → null)
insert into public.tasks (household_id, title, scheduled_date, deleted_at)
values (:'fam', 'Ret los oud', '2026-01-10', :'nu'::timestamptz - interval '90 days' - interval '1 minute') returning id as t_los_oud \gset
insert into public.task_completions (household_id, task_id, title, completed_at)
values (:'fam', :'t_los_oud', 'Ret los oud', :'nu'::timestamptz - interval '100 days') returning id as c_hist \gset
-- losse taak, net binnen de 90 dagen: blijft
insert into public.tasks (household_id, title, scheduled_date, deleted_at)
values (:'fam', 'Ret los net binnen', '2026-01-10', :'nu'::timestamptz - interval '90 days' + interval '1 minute') returning id as t_los_nieuw \gset
-- actieve losse taak, lang geleden gepland: blijft
insert into public.tasks (household_id, title, scheduled_date, created_at)
values (:'fam', 'Ret los actief', '2024-01-01', :'nu'::timestamptz - interval '3 years') returning id as t_actief \gset
-- reeksuitvoering, 90 d + 1 min verwijderd, datum 31 dagen voorbij: weg
insert into public.tasks (household_id, recurrence_id, occurrence_date, title, scheduled_date, deleted_at)
values (:'fam', :'reeks', :'vandaag'::date - 31, 'Ret reeks oud', :'vandaag'::date - 31,
        :'nu'::timestamptz - interval '90 days' - interval '1 minute') returning id as t_reeks_weg \gset
-- reeksuitvoering, 90 d + 1 min verwijderd, datum precies 30 dagen voorbij: blijft (grens is "meer dan 30")
insert into public.tasks (household_id, recurrence_id, occurrence_date, title, scheduled_date, deleted_at)
values (:'fam', :'reeks', :'vandaag'::date - 30, 'Ret reeks grens', :'vandaag'::date - 30,
        :'nu'::timestamptz - interval '90 days' - interval '1 minute') returning id as t_reeks_grens \gset
-- reeksuitvoering, lang verwijderd maar datum nog in de horizon: blijft (planner maakt hem anders opnieuw)
insert into public.tasks (household_id, recurrence_id, occurrence_date, title, scheduled_date, deleted_at)
values (:'fam', :'reeks', :'vandaag'::date + 5, 'Ret reeks toekomst', :'vandaag'::date + 5,
        :'nu'::timestamptz - interval '200 days') returning id as t_reeks_toekomst \gset
-- reeksuitvoering, datum lang voorbij maar pas 89 dagen verwijderd: blijft
insert into public.tasks (household_id, recurrence_id, occurrence_date, title, scheduled_date, deleted_at)
values (:'fam', :'reeks', :'vandaag'::date - 100, 'Ret reeks recent verwijderd', :'vandaag'::date - 100,
        :'nu'::timestamptz - interval '89 days') returning id as t_reeks_recent \gset

-- =============================================================================
-- AC-078 — Opruimen alleen door het systeem
-- =============================================================================
select pg_temp.assert(not has_function_privilege('authenticated', 'public.run_purge()', 'execute'),
  'AC-078: authenticated heeft geen execute op run_purge');
select pg_temp.assert(not has_function_privilege('anon', 'public.run_purge()', 'execute'),
  'AC-078: anon heeft geen execute op run_purge');
select pg_temp.assert(not has_function_privilege('authenticated', 'private.purge_expired_data(timestamptz)', 'execute'),
  'AC-078: authenticated heeft geen execute op purge_expired_data');
select pg_temp.assert(not has_function_privilege('anon', 'private.purge_expired_data(timestamptz)', 'execute'),
  'AC-078: anon heeft geen execute op purge_expired_data');
select pg_temp.assert(has_function_privilege('service_role', 'public.run_purge()', 'execute'),
  'AC-078: service_role (de tick) mag run_purge aanroepen');
select pg_temp.assert((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.run_purge()'::regprocedure),
  'AC-078: run_purge is security definer met lege search_path');
select pg_temp.assert((select prosecdef and proconfig @> array['search_path=""'] from pg_proc
                       where oid = 'private.purge_expired_data(timestamptz)'::regprocedure),
  'AC-078: purge_expired_data is security definer met lege search_path');

set role authenticated;
select pg_temp.als(:'u_ret');  -- beheerder
select pg_temp.expect_sqlstate('select public.run_purge()', '42501', 'AC-078: beheerder roept run_purge aan');
select pg_temp.expect_sqlstate('select private.purge_expired_data()', '42501', 'AC-078: beheerder roept purge_expired_data aan');
select pg_temp.expect_sqlstate(format('select private.purge_expired_data(%L::timestamptz)', '2100-01-01'), '42501',
  'AC-078: beheerder roept purge_expired_data aan met een datum ver in de toekomst');
select pg_temp.als(:'u_lid');  -- gezinslid
select pg_temp.expect_sqlstate('select public.run_purge()', '42501', 'AC-078: gezinslid roept run_purge aan');
reset role;
set role anon;
select pg_temp.systeem();
select pg_temp.expect_sqlstate('select public.run_purge()', '42501', 'AC-078: anon roept run_purge aan');
select pg_temp.expect_sqlstate('select private.purge_expired_data()', '42501', 'AC-078: anon roept purge_expired_data aan');
reset role;
select pg_temp.systeem();
-- Geen bijeffect van de weigeringen
select pg_temp.assert(pg_temp.bestaat('task_completions', :'c_oud') and pg_temp.bestaat('notifications', :'n_oud')
                      and pg_temp.bestaat('shopping_lists', :'l_oud') and pg_temp.bestaat('tasks', :'t_los_oud'),
  'AC-078: na de geweigerde aanroepen is niets opgeruimd');

-- =============================================================================
-- AC-077 — Bewaartermijnen, rijen net vóór en net ná elke grens
-- =============================================================================
select private.purge_expired_data(:'nu'::timestamptz) as uitkomst \gset

-- Afvinkhistorie
select pg_temp.assert(not pg_temp.bestaat('task_completions', :'c_oud'), 'AC-077: afvinking ouder dan 2 jaar is weg');
select pg_temp.assert(pg_temp.bestaat('task_completions', :'c_nieuw'), 'AC-077: afvinking net binnen 2 jaar blijft');
-- Meldingen
select pg_temp.assert(not pg_temp.bestaat('notifications', :'n_oud'), 'AC-077: melding ouder dan 90 dagen is weg');
select pg_temp.assert(pg_temp.bestaat('notifications', :'n_nieuw'), 'AC-077: melding net binnen 90 dagen blijft');
-- Lijsten en producten
select pg_temp.assert(not pg_temp.bestaat('shopping_lists', :'l_oud'), 'AC-077: lijst langer dan 1 jaar gearchiveerd is weg');
select pg_temp.assert(not pg_temp.bestaat('shopping_items', :'p_oud'), 'AC-077: producten van die lijst gaan mee');
select pg_temp.assert(pg_temp.bestaat('shopping_lists', :'l_nieuw') and pg_temp.bestaat('shopping_items', :'p_nieuw'),
  'AC-077: lijst net binnen 1 jaar blijft, met producten');
select pg_temp.assert(pg_temp.bestaat('shopping_lists', :'l_actief') and pg_temp.bestaat('shopping_items', :'p_actief'),
  'AC-077: de actieve lijst blijft, met producten');
-- Uitnodigingen
select pg_temp.assert(pg_temp.bestaat('household_invitations', :'i_open'), 'AC-077: open uitnodiging blijft (ook als hij lang geleden gemaakt is)');
select pg_temp.assert(not pg_temp.bestaat('household_invitations', :'i_verlopen_oud'), 'AC-077: uitnodiging > 30 dagen verlopen is weg');
select pg_temp.assert(pg_temp.bestaat('household_invitations', :'i_verlopen_nieuw'), 'AC-077: uitnodiging net binnen 30 dagen na verlopen blijft');
select pg_temp.assert(not pg_temp.bestaat('household_invitations', :'i_gebruikt_oud'), 'AC-077: uitnodiging > 30 dagen na gebruik is weg');
select pg_temp.assert(pg_temp.bestaat('household_invitations', :'i_gebruikt_nieuw'),
  'AC-077: uitnodiging net binnen 30 dagen na gebruik blijft, ook al is de vervaldatum lang voorbij');
-- Zacht verwijderde taken
select pg_temp.assert(not pg_temp.bestaat('tasks', :'t_los_oud'), 'D-040: losse taak > 90 dagen verwijderd is weg');
select pg_temp.assert(pg_temp.bestaat('tasks', :'t_los_nieuw'), 'D-040: losse taak net binnen 90 dagen verwijderd blijft');
select pg_temp.assert(pg_temp.bestaat('tasks', :'t_actief'), 'AC-077: actieve (niet verwijderde) taak blijft, hoe oud ook');
select pg_temp.assert(not pg_temp.bestaat('tasks', :'t_reeks_weg'), 'TD §3.4: reeksuitvoering > 90 d verwijderd en datum > 30 d voorbij is weg');
select pg_temp.assert(pg_temp.bestaat('tasks', :'t_reeks_grens'), 'TD §3.4: reeksuitvoering met datum precies 30 dagen voorbij blijft');
select pg_temp.assert(pg_temp.bestaat('tasks', :'t_reeks_toekomst'), 'TD §3.4: verwijderde reeksuitvoering binnen de horizon blijft');
select pg_temp.assert(pg_temp.bestaat('tasks', :'t_reeks_recent'), 'TD §3.4: reeksuitvoering pas 89 dagen verwijderd blijft');
-- Historie blijft na het verwijderen van de oude taak
select pg_temp.assert((select task_id is null and title = 'Ret los oud' from public.task_completions where id = :'c_hist'),
  'AC-077: historie van de verwijderde taak blijft, zonder koppeling (task_id null)');

-- Tellingen: minstens onze eigen rijen, en alleen gehele getallen per tabel
select pg_temp.assert(
  (:'uitkomst'::jsonb ->> 'completions')::int >= 1 and (:'uitkomst'::jsonb ->> 'notifications')::int >= 1
  and (:'uitkomst'::jsonb ->> 'shopping_lists')::int >= 1 and (:'uitkomst'::jsonb ->> 'invitations')::int >= 2
  and (:'uitkomst'::jsonb ->> 'tasks')::int >= 2,
  'TD §3.4: purge geeft tellingen per tabel terug: ' || :'uitkomst');
select pg_temp.assert((select array_agg(k order by k) from jsonb_object_keys(:'uitkomst'::jsonb) k)
                      = array['completions', 'households_without_admin', 'households_without_members', 'invitations',
                              'notifications', 'shopping_lists', 'tasks'],
  'TD §3.4: de uitkomst bevat alleen tellingen per tabel (+ huishoudens zonder leden/beheerder): ' || :'uitkomst');
select pg_temp.assert((select bool_and(jsonb_typeof(v) = 'number') from jsonb_each(:'uitkomst'::jsonb) e(k, v)),
  'TD §3.4: alle waarden in de uitkomst zijn getallen');

-- Idempotent: een tweede keer op hetzelfde moment verwijdert niets meer
-- (households_without_admin is een telling van wat blijft, geen verwijdering)
select pg_temp.assert(
  (select bool_and(v::int = 0) from jsonb_each_text(private.purge_expired_data(:'nu'::timestamptz)) e(k, v)
   where k <> 'households_without_admin'),
  'TD §3.4: tweede keer opruimen op hetzelfde moment verwijdert niets');

-- Het systeem (service_role, zoals de tick) kan run_purge wél aanroepen, met de echte klok
set role service_role;
select public.run_purge() as uitkomst_sr \gset
reset role;
select pg_temp.assert(:'uitkomst_sr'::jsonb ? 'tasks', 'AC-078: run_purge als service_role werkt en geeft tellingen');

-- =============================================================================
-- Index voor de meldingenstap van de tick (TD §11.3, D-040)
-- =============================================================================
select pg_temp.assert((select count(*) = 1 from pg_indexes
                       where schemaname = 'public' and tablename = 'tasks' and indexname = 'tasks_open_sched_idx'
                         and indexdef ilike '%(scheduled_date)%'
                         and indexdef ilike '%deleted_at IS NULL%'
                         and indexdef ilike '%todo%' and indexdef ilike '%in_progress%'),
  'TD §11.3: tasks_open_sched_idx bestaat op scheduled_date, alleen open en niet verwijderde taken');
select pg_temp.assert((select count(*) = 1 from pg_indexes
                       where schemaname = 'public' and tablename = 'notifications' and indexname = 'notifications_task_idx'
                         and indexdef ilike '%(task_id)%'),
  'D-043: notifications_task_idx op task_id (FK "set null" bij hard verwijderen van taken)');

-- =============================================================================
-- Huishoudens zonder leden en zonder actieve beheerder (security-review WP2b, punt 2)
-- Accounts die buiten delete_my_account om verdwijnen (Supabase-dashboard,
-- auth.users of public.users): het lid gaat via de cascade mee.
-- =============================================================================
select pg_temp.systeem();
-- Nulmeting: wat er nu (na de vorige runs) nog zonder beheerder is
select (private.purge_expired_data(:'nu'::timestamptz) ->> 'households_without_admin')::int as zonder_admin_voor \gset

\set u_adm  '50000000-0000-0000-0000-0000000000d1'
\set u_kind '50000000-0000-0000-0000-0000000000d2'
\set u_solo '50000000-0000-0000-0000-0000000000d3'
insert into auth.users (id, email, raw_user_meta_data) values
  (:'u_adm',  'adm.ret@example.com',  '{"display_name":"Adm"}'),
  (:'u_kind', 'kind.ret@example.com', '{"display_name":"Kind"}'),
  (:'u_solo', 'solo.ret@example.com', '{"display_name":"Solo"}');

set role authenticated;
select pg_temp.als(:'u_adm');
select public.create_household('Zonder beheerder', 'Adm') as h_geen_admin \gset
select id as m_adm from public.household_members where user_id = :'u_adm' \gset
insert into public.household_invitations (household_id, email, role, invited_by_member_id)
  values (:'h_geen_admin', 'kind.ret@example.com', 'member', :'m_adm');
select token as tok_kind from public.household_invitations where email = 'kind.ret@example.com' \gset
select pg_temp.als(:'u_kind');
select public.accept_invitation(:'tok_kind', 'Kind');
select pg_temp.als(:'u_solo');
select public.create_household('Solo', 'Solo') as h_solo \gset
reset role;
select pg_temp.systeem();
select id as m_kind from public.household_members where user_id = :'u_kind' \gset
select id as m_solo from public.household_members where user_id = :'u_solo' \gset
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
  values (:'h_geen_admin', 'Ret zonder beheerder', :'vandaag', :'m_adm') returning id as t_geen_admin \gset
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
  values (:'h_solo', 'Ret solo', :'vandaag', :'m_solo') returning id as t_solo \gset

-- Een huishouden dat al zonder leden bestaat, met een taak en een lijst
insert into public.households (name, timezone, created_by) values ('Ret leeg', 'Europe/Amsterdam', :'u_ret') returning id as h_leeg \gset
insert into public.tasks (household_id, title, scheduled_date) values (:'h_leeg', 'Ret leeg taak', :'vandaag') returning id as t_leeg \gset
insert into public.shopping_lists (household_id) values (:'h_leeg') returning id as l_leeg \gset

-- De enige actieve beheerder verdwijnt via auth.users (buiten de app om)
delete from auth.users where id = :'u_adm';
select pg_temp.assert(not pg_temp.bestaat('household_members', :'m_adm'), 'SR-WP2b-2: lid van het verwijderde account is weg (cascade)');
select pg_temp.assert(pg_temp.bestaat('household_members', :'m_kind'), 'SR-WP2b-2: het andere lid blijft');
select pg_temp.assert(pg_temp.bestaat('households', :'h_geen_admin'), 'SR-WP2b-2: huishouden met leden blijft na verwijderen beheerder');
select pg_temp.assert((select created_by is null from public.households where id = :'h_geen_admin'),
  'SR-WP2b-2: households.created_by wordt leeg (set null), geen FK-fout');
select pg_temp.assert((select created_by_member_id is null from public.tasks where id = :'t_geen_admin'),
  'SR-WP2b-2: maker van de taak wordt leeg; de taak blijft');
-- Het enige lid verdwijnt via public.users
delete from public.users where id = :'u_solo';
select pg_temp.assert(not pg_temp.bestaat('household_members', :'m_solo'), 'SR-WP2b-2: enige lid weg via public.users (cascade)');

select private.purge_expired_data(:'nu'::timestamptz) as uitkomst_h \gset
select pg_temp.assert((:'uitkomst_h'::jsonb ->> 'households_without_members')::int = 2,
  'SR-WP2b-2: precies de twee huishoudens zonder leden zijn opgeruimd: ' || :'uitkomst_h');
select pg_temp.assert((:'uitkomst_h'::jsonb ->> 'households_without_admin')::int = :zonder_admin_voor + 1,
  'SR-WP2b-2: het huishouden zonder actieve beheerder wordt geteld (+1): ' || :'uitkomst_h' || ', vooraf ' || :zonder_admin_voor);
select pg_temp.assert(not pg_temp.bestaat('households', :'h_leeg') and not pg_temp.bestaat('tasks', :'t_leeg')
                      and not pg_temp.bestaat('shopping_lists', :'l_leeg'),
  'SR-WP2b-2: huishouden zonder leden weg, met taken en lijsten (cascade)');
select pg_temp.assert(not pg_temp.bestaat('households', :'h_solo') and not pg_temp.bestaat('tasks', :'t_solo'),
  'SR-WP2b-2: huishouden van het verwijderde enige lid is opgeruimd');
select pg_temp.assert(pg_temp.bestaat('households', :'h_geen_admin') and pg_temp.bestaat('tasks', :'t_geen_admin')
                      and pg_temp.bestaat('household_members', :'m_kind'),
  'SR-WP2b-2: huishouden met leden maar zonder beheerder blijft (alleen geteld)');
select pg_temp.assert(pg_temp.bestaat('households', :'fam'), 'SR-WP2b-2: gewone huishoudens blijven');
-- Een uitgezette beheerder telt niet als actieve beheerder
update public.household_members set role = 'admin' where id = :'m_kind';
select pg_temp.assert((private.purge_expired_data(:'nu'::timestamptz) ->> 'households_without_admin')::int = :zonder_admin_voor,
  'SR-WP2b-2: met een actieve beheerder telt het huishouden niet meer mee');
update public.household_members set is_active = false where id = :'m_kind';
select pg_temp.assert((private.purge_expired_data(:'nu'::timestamptz) ->> 'households_without_admin')::int = :zonder_admin_voor + 1,
  'SR-WP2b-2: een uitgezette beheerder telt niet als actieve beheerder');

-- =============================================================================
-- Witte lijst: verwijzingen naar personen (security-review WP2b, punt 5)
-- Elke FK naar household_members, public.users of auth.users (zonder de
-- household_id-kolom van samengestelde sleutels) moet op deze lijst staan.
-- =============================================================================
select coalesce(string_agg(x, ', ' order by x), '') as fk_onverwacht from (
  select c.conrelid::regclass::text || '.' || a.attname as x
  from pg_constraint c
  join lateral unnest(c.conkey) k(n) on true
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.n
  where c.contype = 'f'
    and c.confrelid in ('public.household_members'::regclass, 'public.users'::regclass, 'auth.users'::regclass)
    and a.attname <> 'household_id'
  except
  select unnest(array[
    'tasks.created_by_member_id', 'task_recurrences.created_by_member_id', 'task_comments.member_id',
    'notifications.member_id', 'user_preferences.member_id', 'household_invitations.invited_by_member_id',
    'household_invitations.accepted_by', 'household_members.user_id', 'households.created_by',
    'push_subscriptions.user_id', 'users.id'])
) v \gset
select pg_temp.assert(:'fk_onverwacht' = '', 'SR-WP2b-5: onverwachte verwijzing naar een persoon: ' || :'fk_onverwacht');

-- Kolomnamen die op een persoon wijzen, zonder FK (bijv. een losse uuid of tekst)
select coalesce(string_agg(x, ', ' order by x), '') as kol_onverwacht from (
  select table_name || '.' || column_name as x from information_schema.columns
  where table_schema = 'public'
    and column_name ~ '(member|user|_by$|_by_|email|assign|author|owner|person|points|completed_by)'
  except
  select unnest(array[
    'tasks.created_by_member_id', 'task_recurrences.created_by_member_id', 'task_comments.member_id',
    'notifications.member_id', 'user_preferences.member_id', 'household_invitations.invited_by_member_id',
    'household_invitations.accepted_by', 'household_members.user_id', 'households.created_by',
    'push_subscriptions.user_id',
    'households.members_can_create_tasks',   -- vlag, geen persoon
    'household_invitations.email',           -- bewust gebleven (PROGRESS, WP2b M6)
    'users.email',                           -- het eigen account
    'task_comments.author_name',             -- schrijver van een notitie blijft (V-25, V-34)
    'push_subscriptions.user_agent'])        -- toestel, geen persoon
) v \gset
select pg_temp.assert(:'kol_onverwacht' = '', 'SR-WP2b-5: onverwachte kolom die naar een persoon wijst: ' || :'kol_onverwacht');

-- =============================================================================
-- Aanroepbare functies in public (AC-078, security-review WP2b)
-- =============================================================================
select coalesce(string_agg(p.oid::regprocedure::text, ', '), '') as anon_fn from pg_proc p
where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')
  and p.oid <> 'public.get_invitation(text)'::regprocedure \gset
select pg_temp.assert(:'anon_fn' = '', 'Voor anon is alleen get_invitation(text) aanroepbaar, ook: ' || :'anon_fn');
select pg_temp.assert(has_function_privilege('anon', 'public.get_invitation(text)', 'execute'), 'anon mag get_invitation (uitnodigingspagina)');

select coalesce(string_agg(x, ', ' order by x), '') as auth_fn from (
  select p.oid::regprocedure::text as x from pg_proc p
  where p.pronamespace = 'public'::regnamespace and has_function_privilege('authenticated', p.oid, 'execute')
  except
  select unnest(array[
    'create_household(text,text,text,text,text)', 'accept_invitation(text,text)', 'get_invitation(text)',
    'undo_complete_task(uuid)', 'my_membership()', 'clear_series_occurrences(uuid,date,date,boolean)',
    'pause_series(uuid,date,date)', 'resume_series(uuid)', 'stop_series(uuid)', 'delete_task(uuid,text)',
    'complete_task(uuid,uuid,text,timestamp with time zone)', 'archive_shopping_list(uuid)',
    'unarchive_shopping_list(uuid)', 'delete_household(text)',
    -- W-03 (…_410): eigen rechtencheck; waste_save/waste_sync blijven alleen voor service_role
    'disable_waste_calendar()', 'waste_calendar_enabled()'])
) v \gset
select pg_temp.assert(:'auth_fn' = '', 'Onverwachte functie aanroepbaar voor authenticated: ' || :'auth_fn');
select pg_temp.assert(not has_function_privilege('authenticated', 'public.run_purge()', 'execute'),
  'AC-078: run_purge niet voor authenticated (generiek)');

\o
select 'WP3-tests (…_300 retentie) geslaagd' as resultaat;
