-- =============================================================================
-- WP3b — Afvalkalender (W-03): meldingstype voor de storingsmelding
-- (TECHNICAL_DESIGN §18.3.3, §18.3.4)
--
-- Apart bestand: een nieuwe enumwaarde is pas na de commit bruikbaar.
-- =============================================================================

alter type public.notification_type add value if not exists 'waste_sync_failed';
