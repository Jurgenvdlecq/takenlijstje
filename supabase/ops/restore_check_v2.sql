-- =============================================================================
-- M4 (en M0) — Restore-test (TECHNICAL_DESIGN §12.4; AC-057)
--
-- Vervang __BACKUP__ door de naam van het back-upschema.
-- Zet de back-up terug in een apart schema "restore_check" en vergelijkt per
-- tabel het aantal rijen en een checksum met live. Daarna wordt restore_check
-- weer verwijderd. Alles identiek → verder; anders STOPPEN.
-- =============================================================================

begin transaction isolation level repeatable read;

drop schema if exists restore_check cascade;
create schema restore_check;
revoke all on schema restore_check from public, anon, authenticated;

do $$
declare
  t text;
begin
  for t in select table_name from information_schema.tables where table_schema = '__BACKUP__' order by table_name loop
    execute format('create table restore_check.%I as table %I.%I', t, '__BACKUP__', t);
  end loop;
end;
$$;

create temporary table restore_resultaat (
  tabel text primary key,
  live bigint,
  teruggezet bigint,
  live_md5 text,
  teruggezet_md5 text
);

do $$
declare
  t text;
  n_live bigint;
  n_back bigint;
  h_live text;
  h_back text;
begin
  for t in select table_name from information_schema.tables where table_schema = 'restore_check' order by table_name loop
    execute format('select count(*), coalesce(md5(string_agg(x::text, %L order by x::text)), %L) from public.%I x', '|', '', t)
      into n_live, h_live;
    execute format('select count(*), coalesce(md5(string_agg(x::text, %L order by x::text)), %L) from restore_check.%I x', '|', '', t)
      into n_back, h_back;
    insert into restore_resultaat values (t, n_live, n_back, h_live, h_back);
  end loop;
end;
$$;

select tabel, live, teruggezet, (live = teruggezet and live_md5 = teruggezet_md5) as identiek
from restore_resultaat
order by identiek, tabel;

drop schema restore_check cascade;

commit;
