-- =============================================================================
-- Upgrade-test …_210 (WP2b; AC-059, BR-46.3/4) — deel 3: na het contract
-- Draait na voor_200.sql → …_200 → na_200.sql → …_210, als eigenaar.
-- Toetst op oude, live-achtige gegevens wat verdwijnt en wat blijft.
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
-- Wat verdwijnt
-- -----------------------------------------------------------------------------
select pg_temp.assert(to_regclass('public.task_assignments') is null and to_regclass('public.task_swap_requests') is null
                      and to_regclass('public.member_absences') is null,
  'AC-059: toewijzingen, ruilverzoeken en afwezigheden zijn weg');
select pg_temp.assert((select count(*) = 0 from public.household_members where display_name = 'Kai'),
  'AC-059: lid zonder account (Kai) is weg');
select pg_temp.assert((select count(*) = 0 from public.notifications
                       where type::text in ('task_assigned', 'swap_request', 'swap_accepted', 'task_completed', 'daily_summary', 'evening_summary')),
  'AC-059: meldingen van vervallen soorten en alle "taak gedaan"/overzichten van vóór de overgang zijn weg');
select pg_temp.assert((select count(*) = 0 from public.notifications
                       where title ilike '%gedaan door%' or body ilike '%voor jou%' or body ilike '%van jou%'),
  'AC-059/M6: inhoudscontrole meldingen = 0');
select pg_temp.assert((select count(*) = 0 from public.notifications where title = 'Herinnering voor Kai'),
  'AC-059: meldingen van het lid zonder account gaan mee');
select pg_temp.assert((select count(*) = 0 from public.household_invitations where id = '47000000-0000-0000-0000-000000000001'),
  'AC-059: open uitnodiging aan een lid zonder account is weg');

-- Privacy-invariant (TD §3.1): geen kolom die vastlegt wie afvinkte, kocht of toevoegde
select pg_temp.assert((select count(*) = 0 from information_schema.columns
                       where table_schema = 'public' and table_name in ('tasks', 'task_completions', 'shopping_items')
                         and (column_name like 'completed_by%' or column_name = 'member_id'
                              or column_name like 'added_by%' or column_name like 'bought_by%')),
  'AC-059/AC-035: privacytest schema = 0 treffers');

-- -----------------------------------------------------------------------------
-- Wat blijft
-- -----------------------------------------------------------------------------
select pg_temp.assert((select count(*) from public.task_completions) = (select historie from upgrade_test.tellingen_voor),
  'AC-059: aantal historie-rijen gelijk aan vóór het wissen');
select pg_temp.assert((select title = 'Stofzuigen' and task_id = '43000000-0000-0000-0000-000000000011'
                       from public.task_completions where id = '46000000-0000-0000-0000-000000000001'),
  'AC-059: historie van Kais afvinking blijft, zonder persoon');
select pg_temp.assert((select count(*) from public.tasks) = (select taken from upgrade_test.tellingen_voor)
                      and (select count(*) from public.task_recurrences) = (select reeksen from upgrade_test.tellingen_voor),
  'AC-059: alle taken en reeksen blijven');
select pg_temp.assert((select count(*) from public.task_comments) = (select notities from upgrade_test.tellingen_voor),
  'AC-059: alle notities blijven');
select pg_temp.assert((select count(*) from public.shopping_items) = (select boodschappen from upgrade_test.tellingen_voor),
  'AC-059: boodschappen blijven (zonder door-wie)');
select pg_temp.assert((select count(*) from public.household_members) = (select leden_met_account from upgrade_test.tellingen_voor),
  'AC-059: alle leden met account blijven');

-- Makers van taken en reeksen blijven (V-25); wie door Kai gemaakt was, heeft nu geen maker
select pg_temp.assert((select created_by_member_id = '42000000-0000-0000-0000-0000000000a1' from public.tasks where id = '43000000-0000-0000-0000-000000000011'),
  'AC-059: maker van een taak blijft');
select pg_temp.assert((select created_by_member_id = '42000000-0000-0000-0000-0000000000a1' from public.task_recurrences where id = '45000000-0000-0000-0000-000000000001'),
  'AC-059: maker van een reeks blijft');
select pg_temp.assert((select created_by_member_id is null from public.tasks where id = '43000000-0000-0000-0000-000000000012')
                      and (select created_by_member_id is null from public.task_recurrences where id = '45000000-0000-0000-0000-000000000002'),
  'AC-059: taak en reeks van het lid zonder account blijven, zonder maker');
-- "Bijgewerkt op" verandert niet door het wissen (triggers tijdens het wissen uit)
select pg_temp.assert((select count(*) = 0 from public.tasks t join upgrade_test.taken_voor v using (id) where t.updated_at <> v.updated_at),
  '…_210: updated_at van taken ongewijzigd door het wissen');
select pg_temp.assert((select count(*) = 0 from public.task_recurrences r join upgrade_test.reeksen_voor v using (id) where r.updated_at <> v.updated_at),
  '…_210: updated_at van reeksen ongewijzigd door het wissen');

-- Schrijvers van notities blijven (V-25, V-34, AC-062)
select pg_temp.assert((select author_name = 'Kai' and member_id is null from public.task_comments where id = '44000000-0000-0000-0000-000000000003'),
  'AC-059/AC-062: notitie van het lid zonder account houdt "Kai"');
select pg_temp.assert((select author_name = 'Lynn L.' and member_id = '42000000-0000-0000-0000-0000000000a3' from public.task_comments where id = '44000000-0000-0000-0000-000000000002'),
  'AC-059: notitie van een lid met account ongewijzigd');

-- Meldingen van de blijvende soorten blijven
select pg_temp.assert((select count(*) = 3 from public.notifications where dedupe_key in ('upg:8', 'upg:9', 'upg:10')),
  'AC-059: herinnering, deadline nadert en verlopen blijven');
-- Uitnodigingen zonder koppeling aan een lid zonder account blijven
select pg_temp.assert((select count(*) = 2 from public.household_invitations where id in ('47000000-0000-0000-0000-000000000002', '47000000-0000-0000-0000-000000000003')),
  'AC-059: geaccepteerde en open losse uitnodiging blijven');
-- Voorkeuren van leden met account blijven (zonder de vervallen velden)
select pg_temp.assert((select count(*) = (select leden_met_account from upgrade_test.tellingen_voor) from public.user_preferences),
  'AC-059: voorkeuren van de leden met account blijven');
select pg_temp.assert((select deadline_warning_minutes = 60 and daily_summary_time = '08:15' from public.user_preferences
                       where member_id = '42000000-0000-0000-0000-0000000000a3'),
  'AC-059: instellingen van Lynn blijven');
select pg_temp.assert((select count(*) = 1 from public.task_templates where id = '49000000-0000-0000-0000-000000000001'),
  'AC-059: eigen standaardtaak blijft (zonder punten)');
select pg_temp.assert((select count(*) = 2 from public.households), 'AC-059: huishoudens blijven');

drop schema upgrade_test cascade;
\o
select 'Upgrade-test …_210 geslaagd (AC-059)' as resultaat;
