-- =============================================================================
-- Tests: huishouden-isolatie (RLS), rechten en database-functies
-- Iedere fout stopt het script (ON_ERROR_STOP), dus "geen output" = geslaagd.
-- =============================================================================

\o /dev/null

-- Testaccounts
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'jurgen@example.com', '{"display_name":"Jurgen"}'),
  ('00000000-0000-0000-0000-00000000000b', 'ellen@example.com',  '{"display_name":"Ellen"}'),
  ('00000000-0000-0000-0000-00000000000c', 'buurman@example.com', '{}'),
  ('00000000-0000-0000-0000-00000000000d', 'lynn@example.com', '{}'),
  ('00000000-0000-0000-0000-00000000000e', 'kai@example.com', '{"display_name":"Kai"}');

-- Hulpfunctie: verwacht dat een statement faalt
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

create or replace function pg_temp.assert(p_condition boolean, p_label text)
returns void language plpgsql as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'ASSERT MISLUKT: %', p_label;
  end if;
end;
$$;

grant execute on all functions in schema pg_temp to authenticated;

-- Profielen zijn automatisch aangemaakt
select pg_temp.assert((select count(*) = 5 from public.users), 'trigger maakt users-profiel aan');
select pg_temp.assert((select display_name = 'Jurgen' from public.users where email = 'jurgen@example.com'), 'display_name uit metadata');

-- -----------------------------------------------------------------------------
-- Jurgen maakt huishouden aan
-- -----------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);

select public.create_household('Van der Lecq', 'Jurgen', '#2563eb') as h1 \gset
select pg_temp.assert((select count(*) = 1 from public.households), 'Jurgen ziet 1 huishouden');
select id as jurgen from public.household_members where display_name = 'Jurgen' \gset
select pg_temp.assert((select role = 'admin' from public.household_members where id = :'jurgen'), 'maker is beheerder');
select pg_temp.assert((select count(*) = 1 from public.shopping_lists), 'boodschappenlijst aangemaakt');
select pg_temp.assert((select count(*) = 1 from public.user_preferences), 'voorkeuren aangemaakt');

-- Gezinsleden toevoegen: Ellen en Kai, beiden met account via een uitnodiging
-- (WP2a: een lid zonder account toevoegen vervalt, TECHNICAL_DESIGN §6.2)
-- Een account koppelen kan alleen via een uitnodiging (security punt 1, D-016).
-- Vroeger voegde de beheerder Ellen direct met user_id toe; dat is nu een negatieve test.
select pg_temp.expect_error(format(
  $$insert into public.household_members (household_id, user_id, display_name) values (%L, '00000000-0000-0000-0000-00000000000b', 'Ellen')$$, :'h1'),
  'beheerder koppelt direct een account (D-016)');
insert into public.household_invitations (household_id, email, invited_by_member_id)
values (:'h1', 'ellen@example.com', :'jurgen') returning token as ellen_token \gset
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select public.accept_invitation(:'ellen_token', 'Ellen');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select id as ellen from public.household_members where household_id = :'h1' and user_id = '00000000-0000-0000-0000-00000000000b' \gset
update public.household_members set color = '#db2777' where id = :'ellen';
insert into public.household_invitations (household_id, email, invited_by_member_id)
values (:'h1', 'kai@example.com', :'jurgen') returning token as kai_token \gset
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e"}', false);
select public.accept_invitation(:'kai_token', 'Kai');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select id as kai from public.household_members where household_id = :'h1' and user_id = '00000000-0000-0000-0000-00000000000e' \gset
select pg_temp.assert((select count(*) = 0 from public.user_preferences where member_id = :'ellen'), 'voorkeuren van ander niet zichtbaar');

-- Taak van het huishouden (niemand toegewezen, V-21)
insert into public.tasks (household_id, title, category, scheduled_date, due_at, created_by_member_id, duration_minutes)
values (:'h1', 'WC schoonmaken', 'cleaning', current_date, now() - interval '2 hours', :'jurgen', 15)
returning id as task1 \gset

-- Standaardbibliotheek is zichtbaar
select pg_temp.assert((select count(*) > 30 from public.task_templates where household_id is null), 'standaardtaken zichtbaar');

-- -----------------------------------------------------------------------------
-- Buurman (ander huishouden) ziet niets van Van der Lecq
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select public.create_household('Buren', 'Buurman') as h2 \gset
select id as buurman from public.household_members where household_id = :'h2' \gset

select pg_temp.assert((select count(*) = 1 from public.households), 'buurman ziet alleen eigen huishouden');
select pg_temp.assert((select count(*) = 0 from public.tasks), 'buurman ziet geen taken van ander huishouden');
select pg_temp.assert((select count(*) = 1 from public.household_members), 'buurman ziet alleen zichzelf');
select pg_temp.assert((select count(*) = 0 from public.users where email = 'jurgen@example.com'), 'buurman ziet profiel Jurgen niet');

select pg_temp.expect_error(format(
  $$insert into public.tasks (household_id, title, scheduled_date) values (%L, 'Inbraak', current_date)$$, :'h1'),
  'taak in ander huishouden aanmaken');
-- Samengestelde FK: eigen huishouden, maar gezinslid van een ander huishouden als maker
select pg_temp.expect_error(format(
  $$insert into public.tasks (household_id, title, scheduled_date, created_by_member_id) values (%L, 'Truc', current_date, %L)$$, :'h2', :'kai'),
  'gezinslid uit ander huishouden als maker');
select pg_temp.expect_error(format(
  $$select public.complete_task(%L, gen_random_uuid())$$, :'task1'),
  'taak van ander huishouden afvinken');

-- Updates op andermans rijen raken niets
update public.tasks set title = 'Gehackt' where id = :'task1';
update public.household_members set role = 'admin' where id = :'ellen';

-- -----------------------------------------------------------------------------
-- Ellen (gezinslid) – rechten
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select pg_temp.assert((select title = 'WC schoonmaken' from public.tasks where id = :'task1'), 'titel niet gewijzigd door buurman');
select pg_temp.assert((select count(*) = 3 from public.household_members), 'Ellen ziet haar gezinsleden');

-- Eigen rol aanpassen mag niet
select pg_temp.expect_error(format(
  $$update public.household_members set role = 'admin' where id = %L$$, :'ellen'), 'gezinslid maakt zichzelf beheerder');
-- Eigen naam wel
update public.household_members set display_name = 'Ellen ❤' where id = :'ellen';
-- Taak van een ander wijzigen mag: ieder actief lid wijzigt een losse taak
-- (BR-23, V-13, AC-013; update-policy is_member). Vroeger filterde RLS dit weg.
update public.tasks set title = 'WC schoonmaken (grondig)' where id = :'task1';
select pg_temp.assert((select title = 'WC schoonmaken (grondig)' from public.tasks where id = :'task1'),
  'actief lid wijzigt taak van een ander (BR-23)');
insert into public.tasks (household_id, title, scheduled_date, created_by_member_id)
values (:'h1', 'Stofzuigen', current_date, :'ellen') returning id as task2 \gset
-- Direct op 'done' zetten mag niet (historie moet kloppen)
select pg_temp.expect_error(format(
  $$update public.tasks set status = 'done' where id = %L$$, :'task2'), 'status direct op done');

-- -----------------------------------------------------------------------------
-- Afvinken: idempotent, historie, te laat
-- -----------------------------------------------------------------------------
-- WP2a: complete_task v2 zonder persoon (p_task_id, p_mutation_id, p_note, p_completed_at)
select (public.complete_task(:'task1', '11111111-1111-1111-1111-111111111111', 'Nieuwe rol wc-papier nodig')).id as c1 \gset
select (public.complete_task(:'task1', '11111111-1111-1111-1111-111111111111')).id as c1_again \gset
select (public.complete_task(:'task1', '22222222-2222-2222-2222-222222222222')).id as c1_other \gset
select pg_temp.assert(:'c1' = :'c1_again', 'zelfde mutatie → zelfde registratie');
select pg_temp.assert(:'c1' = :'c1_other', 'al voltooide taak wordt niet dubbel geregistreerd');
select pg_temp.assert((select count(*) = 1 from public.task_completions where task_id = :'task1'), 'precies één registratie');
-- WP2b: member_id, points en completed_by_member_id bestaan niet meer; dat ze
-- weg zijn, toetst 40_wp2b.sql (privacy-invariant, TD §3.1)
select pg_temp.assert((select was_late and minutes_late >= 119
                              and note = 'Nieuwe rol wc-papier nodig' and duration_minutes = 15
                       from public.task_completions where id = :'c1'), 'te laat, met notitie en duur (AC-034)');
select pg_temp.assert((select status = 'done' and completed_at is not null from public.tasks where id = :'task1'), 'taak staat op done');

-- Direct schrijven in historie mag niet
select pg_temp.expect_error(format(
  $$insert into public.task_completions (household_id, title) values (%L, 'nep')$$, :'h1'), 'historie direct schrijven');

-- Ongedaan maken: ieder actief lid (V-22)
select (public.undo_complete_task(:'task1')).status as undo_status \gset
select pg_temp.assert(:'undo_status' = 'todo', 'undo zet status terug');
select pg_temp.assert((select count(*) = 0 from public.task_completions where task_id = :'task1'), 'undo verwijdert registratie');

-- (Ruilen is vervallen, V-21: de oude ruiltests zijn in WP2a verwijderd.)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);

-- Laatste beheerder kan niet weg
select pg_temp.expect_error(format(
  $$update public.household_members set role = 'member' where id = %L$$, :'jurgen'), 'laatste beheerder degraderen');

-- -----------------------------------------------------------------------------
-- Meldingen: alleen eigen meldingen zichtbaar
-- -----------------------------------------------------------------------------
-- Meldingen maakt alleen het systeem aan (BR-25, AC-016). Vroeger mocht een lid
-- huisgenoten een melding sturen; dat is nu een negatieve test.
select pg_temp.expect_error(format(
  $$insert into public.notifications (household_id, member_id, type, title) values (%L, %L, 'reminder', 'Herinnering: WC schoonmaken')$$, :'h1', :'ellen'),
  'lid plaatst melding voor huisgenoot (BR-25)');
reset role;
insert into public.notifications (household_id, member_id, type, title) values
  (:'h1', :'ellen', 'reminder', 'Herinnering voor Ellen'),
  (:'h1', :'jurgen', 'reminder', 'Herinnering voor Jurgen');
set role authenticated;
select pg_temp.assert((select count(*) = 1 from public.notifications), 'Jurgen ziet alleen eigen melding');
select pg_temp.expect_error(format(
  $$insert into public.notifications (household_id, member_id, type, title) values (%L, %L, 'reminder', 'spam')$$, :'h1', :'buurman'),
  'melding naar ander huishouden');

-- -----------------------------------------------------------------------------
-- Uitnodiging
-- -----------------------------------------------------------------------------
-- WP2a: een uitnodiging hoort niet meer bij een bestaand lid zonder account (✖ member_id)
insert into public.household_invitations (household_id, email, invited_by_member_id)
values (:'h1', 'lynn@example.com', :'jurgen') returning token \gset

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select pg_temp.assert((select household_name = 'Van der Lecq' and invited_by = 'Jurgen' from public.get_invitation(:'token')), 'uitnodiging-info');
select pg_temp.expect_error(format($$select public.accept_invitation(%L)$$, :'token'), 'uitnodiging met verkeerd e-mailadres');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d"}', false);
select public.accept_invitation(:'token') as joined \gset
select pg_temp.assert(:'joined' = :'h1', 'Lynn is lid geworden');
select id as lynn from public.household_members where household_id = :'h1' and user_id = '00000000-0000-0000-0000-00000000000d' \gset
select pg_temp.assert((select role = 'member' and display_name = 'lynn' from public.household_members where id = :'lynn'),
  'Lynn is gezinslid met account, naam uit het e-mailadres');
-- AC-047: al lid van dit huishouden → alleen afronden, geen tweede lidrij
select public.accept_invitation(:'token') as joined_again \gset
select pg_temp.assert(:'joined_again' = :'h1', 'tweede keer accepteren geeft hetzelfde huishouden');
select pg_temp.assert((select count(*) = 1 from public.household_members where user_id = '00000000-0000-0000-0000-00000000000d'),
  'tweede keer accepteren maakt geen tweede lidrij (AC-047)');

-- Boodschappen: ieder lid mag toevoegen en afvinken
insert into public.shopping_items (household_id, list_id, name, category)
select :'h1', id, 'Toiletpapier', 'drugstore' from public.shopping_lists where household_id = :'h1' and archived_at is null;
update public.shopping_items set is_bought = true where name = 'Toiletpapier';
select pg_temp.assert((select is_bought from public.shopping_items where name = 'Toiletpapier'), 'boodschap afgevinkt');

reset role;
\o
select 'RLS- en functietests geslaagd' as resultaat;
