-- =============================================================================
-- Upgrade-test …_200 (AC-053, AC-179) — deel 2: controles na de migratie
-- =============================================================================
\o /dev/null

create or replace function pg_temp.assert(p_condition boolean, p_label text)
returns void language plpgsql as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'ASSERT MISLUKT: %', p_label;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- AC-053: gezinsleden krijgen de nieuwe standaard, beheerders ongewijzigd
-- -----------------------------------------------------------------------------
select pg_temp.assert((select count(*) = 3 and bool_and(not (notify_reminders or notify_deadline_soon or notify_overdue
                                                          or daily_summary_enabled or evening_summary_enabled or notify_task_completed))
                       from public.user_preferences p join public.household_members m on m.id = p.member_id where m.role = 'member'),
  'AC-053: alle genoemde soorten uit voor ieder gezinslid (Lynn, Kai, Rik)');
select pg_temp.assert((select not notify_reminders and not notify_task_completed from public.user_preferences
                       where member_id = '42000000-0000-0000-0000-0000000000a3'),
  'AC-053: ook als het gezinslid herinneringen en "taak gedaan" zelf aan had');
select pg_temp.assert((select deadline_warning_minutes = 60 and daily_summary_time = '08:15' from public.user_preferences
                       where member_id = '42000000-0000-0000-0000-0000000000a3'),
  'AC-053: andere instellingen van het gezinslid blijven staan');
select pg_temp.assert((select count(*) = 3 from public.user_preferences p
                       join upgrade_test.voorkeuren_voor v on v.member_id = p.member_id
                       join public.household_members m on m.id = p.member_id
                       where m.role = 'admin' and row(p.*)::text = row(v.*)::text),
  'AC-053: voorkeuren van de 3 beheerders (Jurgen, Ellen, Bas) zijn exact ongewijzigd');

-- -----------------------------------------------------------------------------
-- AC-179: elke notitie heeft een schrijver
-- -----------------------------------------------------------------------------
select pg_temp.assert((select count(*) = 0 from public.task_comments where author_name is null or author_name = ''),
  'AC-179: geen notitie zonder schrijver');
select pg_temp.assert((select author_name = 'Jurgen' from public.task_comments where id = '44000000-0000-0000-0000-000000000001'), 'AC-179: Jurgen');
select pg_temp.assert((select author_name = 'Lynn' from public.task_comments where id = '44000000-0000-0000-0000-000000000002'), 'AC-179: Lynn');
select pg_temp.assert((select author_name = 'Kai' from public.task_comments where id = '44000000-0000-0000-0000-000000000003'), 'AC-179: bestaand lid zonder account');
select pg_temp.assert((select author_name = 'Gezinslid' and member_id is null from public.task_comments where id = '44000000-0000-0000-0000-000000000004'),
  'AC-179: verwijderd lid → "Gezinslid"');
select pg_temp.assert((select author_name = 'Gezinslid' from public.task_comments where id = '44000000-0000-0000-0000-000000000005'),
  'AC-179: notitie zonder schrijver → "Gezinslid"');
select pg_temp.assert((select author_name = 'Rik' from public.task_comments where id = '44000000-0000-0000-0000-000000000006'), 'AC-179: ander huishouden');
select pg_temp.assert((select is_nullable = 'NO' from information_schema.columns
                       where table_schema = 'public' and table_name = 'task_comments' and column_name = 'author_name'),
  'AC-179: author_name is verplicht na de migratie');
select pg_temp.assert((select count(*) = 6 from public.task_comments), 'AC-179: geen notitie verloren');

-- Bestaande notities volgen daarna een naamswijziging (trigger na migratie)
update public.household_members set display_name = 'Lynn L.' where id = '42000000-0000-0000-0000-0000000000a3';
select pg_temp.assert((select author_name = 'Lynn L.' from public.task_comments where id = '44000000-0000-0000-0000-000000000002'),
  'V-34: naamswijziging na de migratie werkt door in een oude notitie');

-- Tussenstadium (alleen …_200, zoals live tussen M2 en M6): de vervallen gegevens
-- bestaan nog, zodat terugrollen naar de oude code kan (TD §12.4)
select pg_temp.assert((select count(*) = 1 from public.household_members where user_id is null),
  'tussenstadium: lid zonder account (Kai) bestaat nog');
select pg_temp.assert((select count(*) = 2 from public.task_completions where member_id is not null),
  'tussenstadium: "wie afvinkte" staat nog in de historie');
select pg_temp.assert(to_regprocedure('public.complete_task(uuid,uuid,uuid,text,timestamptz)') is not null
                      and to_regprocedure('public.accept_swap_request(uuid)') is not null,
  'tussenstadium: oude RPC''s bestaan nog voor de vorige app-versie');

-- upgrade_test blijft staan voor na_210.sql
\o
select 'Upgrade-test …_200 geslaagd (AC-053, AC-179)' as resultaat;
