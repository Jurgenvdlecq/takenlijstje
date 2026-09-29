-- =============================================================================
-- WP3b — Noodterugrol afvalkalender (TECHNICAL_DESIGN §18.16 "Terugrollen")
--
-- Alleen uitvoeren DIRECT NA een Vercel Instant Rollback naar een deployment
-- zónder WP3b. De oude tick ziet afvaltaken als gewone taken met een deadline en
-- zou dezelfde nacht al "deadline nadert" en "verlopen" sturen.
--
-- Gevolg: notities bij open afvaltaken gaan verloren (cascade). Het adres en de
-- historie blijven; na opnieuw uitrollen plant de tick de taken vanzelf opnieuw.
-- Een terugrol naar een deployment die WP3b al bevat, vraagt geen actie.
-- =============================================================================

delete from public.tasks where waste_direction is not null and status in ('todo', 'in_progress');

-- Wordt de terugrol definitief, dan ook:
--   delete from public.waste_calendars;
