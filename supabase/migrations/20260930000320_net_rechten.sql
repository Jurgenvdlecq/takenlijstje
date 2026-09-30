-- =============================================================================
-- WP3-nazorg (security-review WP3 r2, punt B; live-controle L3/L4, 2026-09-30):
-- de rechten op het interne schema net (pg_net) terugtrekken van de clientrollen.
-- Supabase geeft bij installatie van pg_net execute op net.http_* en select op de
-- tabellen aan anon/authenticated; niemand anders dan de planner (als postgres)
-- hoeft dit (D-042). De planner wordt niet geraakt.
-- No-op op een database zonder pg_net (lokale tests, TECHNICAL_DESIGN §12.1).
-- Herstel: grant execute on function net.http_get/net.http_post/
-- net.http_collect_response to anon, authenticated; grant select on
-- net.http_request_queue, net._http_response to anon, authenticated.
-- =============================================================================

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'net') then
    execute 'revoke execute on all functions in schema net from public, anon, authenticated';
    execute 'revoke all on all tables in schema net from public, anon, authenticated';
  end if;
end
$$;
