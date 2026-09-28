-- =============================================================================
-- M3 — Back-up vóór het wissen (TECHNICAL_DESIGN §12.4; V-33; AC-056)
--
-- Vervang __BACKUP__ door backup_v2_<JJJJMMDD> (bijv. backup_v2_20261003),
-- in KLEINE letters (create schema zet de naam om naar kleine letters, format('%I') niet).
-- Eén transactie met één momentopname (repeatable read): de back-up is ook
-- consistent tussen tabellen als het gezin de app intussen gebruikt.
-- Kopieert ALLE tabellen van "public" 1-op-1 naar dat schema, binnen hetzelfde
-- project. Geen los exportbestand; er verlaten geen gegevens het project.
-- Het schema wordt niet via de API ontsloten en is dicht voor anon/authenticated.
--
-- Enum-kolommen worden als tekst bewaard: zo blijft de back-up geldig nadat
-- …_210 enumwaarden en -typen verwijdert, en kan restore_v2.sql ze terugzetten.
-- =============================================================================

begin transaction isolation level repeatable read;

create schema __BACKUP__;
revoke all on schema __BACKUP__ from public, anon, authenticated;

do $$
declare
  t text;
  c record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' order by tablename loop
    execute format('create table %I.%I as table public.%I', '__BACKUP__', t, t);
    execute format('revoke all on table %I.%I from public, anon, authenticated', '__BACKUP__', t);
  end loop;

  for c in
    select table_name, column_name
    from information_schema.columns
    where table_schema = '__BACKUP__' and data_type = 'USER-DEFINED'
      and udt_name in (select typname from pg_type t join pg_namespace n on n.oid = t.typnamespace
                       where n.nspname = 'public' and t.typtype = 'e')
  loop
    execute format('alter table %I.%I alter column %I type text using %I::text', '__BACKUP__', c.table_name, c.column_name, c.column_name);
  end loop;
end;
$$;

-- Controle: rijen in de back-up = rijen op live, per tabel
do $$
declare
  t text;
  n_live bigint;
  n_backup bigint;
  verschil integer := 0;
begin
  for t in select tablename from pg_tables where schemaname = 'public' order by tablename loop
    execute format('select count(*) from public.%I', t) into n_live;
    execute format('select count(*) from %I.%I', '__BACKUP__', t) into n_backup;
    if n_live <> n_backup then
      verschil := verschil + 1;
      raise warning 'Back-up wijkt af voor %: live %, back-up %', t, n_live, n_backup;
    end if;
  end loop;
  if verschil > 0 then
    raise exception 'Back-up niet volledig (% tabellen wijken af)', verschil;
  end if;
end;
$$;

commit;

select t.tablename as tabel,
       (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', t.tablename), false, true, '')))[1]::text::bigint as live,
       (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from %I.%I', '__BACKUP__', t.tablename), false, true, '')))[1]::text::bigint as back_up
from pg_tables t
where t.schemaname = 'public'
order by t.tablename;
