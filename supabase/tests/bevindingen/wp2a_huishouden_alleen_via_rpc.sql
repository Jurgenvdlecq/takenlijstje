-- =============================================================================
-- OPEN BEVINDING (test-writer WP2a): een huishouden verwijderen kan alleen via
-- de RPC delete_household, met de naam als bevestiging (TECHNICAL_DESIGN §3.1
-- "alleen via RPC delete_household", §4.6).
-- Faalt zolang de policy "households: beheerder verwijdert" bestaat.
-- Na de fix: verplaatsen naar supabase/tests/30_wp2a.sql.
-- =============================================================================
\o /dev/null
create or replace function pg_temp.assert(p_condition boolean, p_label text)
returns void language plpgsql as $$
begin
  if not coalesce(p_condition, false) then raise exception 'ASSERT MISLUKT: %', p_label; end if;
end;
$$;
create or replace function pg_temp.geweigerd(p_sql text)
returns boolean language plpgsql as $$
declare v_count integer;
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
grant execute on all functions in schema pg_temp to authenticated;

insert into auth.users (id, email) values ('50000000-0000-0000-0000-0000000000a1', 'direct.bevinding@example.com');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-0000000000a1"}', false);
select public.create_household('Direct weg', 'Beheerder') as h \gset
select pg_temp.assert(pg_temp.geweigerd(format($$delete from public.households where id = %L$$, :'h')),
  'TD §3.1: beheerder verwijdert huishouden direct, zonder delete_household en zonder naambevestiging');
select pg_temp.assert((select count(*) = 1 from public.households where id = :'h'), 'huishouden bestaat nog');
reset role;
\o
