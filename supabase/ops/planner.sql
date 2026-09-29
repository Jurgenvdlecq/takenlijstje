-- =============================================================================
-- WP3 — Planner elke 15 minuten via Supabase Cron (V-32; TECHNICAL_DESIGN §3.2, §10, §12.2)
--
-- Geen migratie: de lokale test-PG heeft geen pg_cron, en de URL verschilt per
-- omgeving. Eenmalig op live uitvoeren (via de Supabase-koppeling of de SQL-editor).
-- Vervangt supabase/cron/schedule-tick.sql.
--
-- Geheimen staan ALLEEN in Supabase Vault, nooit in dit bestand of in git:
--   takenlijstje_tick_url     = https://<productie-domein>/api/cron/tick
--   takenlijstje_cron_secret  = dezelfde waarde als CRON_SECRET in Vercel
-- Aanmaken (waarde zelf invullen, niet in git):
--   select vault.create_secret('<waarde>', 'takenlijstje_cron_secret');
-- Roteren: eerst Vault (vault.update_secret), dan Vercel. In de tussentijd faalt
-- de tick met 401 en haalt de volgende run in (§12.2).
-- =============================================================================

-- Schema's zoals Supabase adviseert (niet in public; security-review WP3, punt 6)
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- pg_net geeft bij installatie EXECUTE op net.http_* aan anon/authenticated
-- (event trigger van Supabase). Niemand anders dan de planner hoeft dit (D-042).
revoke execute on all functions in schema net from anon, authenticated;

-- Idempotent: een bestaande taak met dezelfde naam wordt vervangen
select cron.unschedule(jobid) from cron.job where jobname = 'takenlijstje-tick';

select cron.schedule(
  'takenlijstje-tick',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := u.decrypted_secret,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'takenlijstje_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    -- De pg_net-standaard (enkele seconden) is te kort voor de tick (§10)
    timeout_milliseconds := 55000
  )
  from vault.decrypted_secrets u
  -- Alleen via https: het geheim gaat nooit onversleuteld over de lijn (security-review WP3, punt 3)
  where u.name = 'takenlijstje_tick_url' and u.decrypted_secret like 'https://%';
  $$
);

-- Controle (AC-063): de taak en de laatste runs
--   select jobname, schedule, active from cron.job;
--   select status, start_time, end_time from cron.job_run_details order by start_time desc limit 10;
--   select status_code, created from net._http_response order by created desc limit 10;
-- Stoppen:
--   select cron.unschedule('takenlijstje-tick');
