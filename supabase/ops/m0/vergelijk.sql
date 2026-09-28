-- =============================================================================
-- M0 — vergelijk public met de back-up (__BACKUP__), per tabel en per kolom
-- van de back-up. Kolomvolgorde en enumtypen tellen niet mee (alles als tekst).
-- =============================================================================
create temporary table m0_vergelijking (tabel text primary key, back_up bigint, nu bigint, identiek boolean);

do $$
declare
  t text;
  cols text;
  n_b bigint;
  n_p bigint;
  h_b text;
  h_p text;
begin
  for t in select table_name from information_schema.tables where table_schema = '__BACKUP__' order by table_name loop
    select string_agg(format('%I::text', column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns where table_schema = '__BACKUP__' and table_name = t;
    execute format('select count(*), coalesce(md5(string_agg(x::text, %L order by x::text)), %L) from (select %s from %I.%I) x', '|', '', cols, '__BACKUP__', t)
      into n_b, h_b;
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('select count(*), coalesce(md5(string_agg(x::text, %L order by x::text)), %L) from (select %s from public.%I) x', '|', '', cols, t)
        into n_p, h_p;
    else
      n_p := null; h_p := null;
    end if;
    insert into m0_vergelijking values (t, n_b, n_p, n_b = n_p and h_b = h_p);
  end loop;
end;
$$;

select * from m0_vergelijking order by identiek nulls first, tabel;
select case when bool_and(identiek) then 'M0-VERGELIJKING: IDENTIEK' else 'M0-VERGELIJKING: VERSCHIL' end as uitkomst from m0_vergelijking;
