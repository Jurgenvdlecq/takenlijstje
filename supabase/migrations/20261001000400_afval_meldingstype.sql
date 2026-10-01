-- =============================================================================
-- WP3b — Afvalkalender (W-03), stap 1 van 2: nieuw meldingstype
-- (TECHNICAL_DESIGN §18.3.3, §18.3.4).
--
-- Niet-destructief. Apart bestand, omdat een nieuwe enumwaarde pas na de commit
-- bruikbaar is; de volgende migratie (…_410) kan hem dan in één transactie gebruiken.
-- =============================================================================

alter type public.notification_type add value if not exists 'waste_sync_failed';
