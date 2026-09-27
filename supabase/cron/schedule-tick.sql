-- =============================================================================
-- Optioneel: herinneringen en planning iedere 15 minuten via Supabase zelf.
-- Voer dit uit in de Supabase SQL editor (NIET als migratie), na het
-- aanzetten van de extensies pg_cron en pg_net (Database → Extensions).
-- Vervang <APP_URL> en <CRON_SECRET>.
-- =============================================================================
select cron.schedule(
  'takenlijstje-tick',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := '<APP_URL>/api/cron/tick',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);

-- Stoppen:  select cron.unschedule('takenlijstje-tick');
