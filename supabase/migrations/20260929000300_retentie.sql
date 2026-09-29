-- =============================================================================
-- WP3 — Bewaartermijnen (BR-45; TECHNICAL_DESIGN §3.4) en index voor de tick (§11.3)
--
-- Niet-destructief: de functie wist pas iets als het systeem hem aanroept
-- (stap 4 van de tick, via public.run_purge(), alleen service_role).
-- =============================================================================

-- Open taken per geplande datum: de meldingenstap van de tick leest alle open
-- taken met scheduled_date ≤ morgen, over alle huishoudens (§11.3 stap 3)
create index if not exists tasks_open_sched_idx
  on public.tasks (scheduled_date)
  where status in ('todo', 'in_progress') and deleted_at is null;

-- Voor de opruimstap: zacht verwijderde taken en afgelopen uitnodigingen
create index if not exists tasks_deleted_idx on public.tasks (deleted_at) where deleted_at is not null;
create index if not exists task_completions_completed_idx on public.task_completions (completed_at);
create index if not exists notifications_created_idx on public.notifications (created_at);
-- Het hard verwijderen van taken zet notifications.task_id leeg (FK "set null");
-- zonder index is dat per taak een volledige scan (performance-review WP3, punt 3)
create index if not exists notifications_task_idx on public.notifications (task_id) where task_id is not null;
create index if not exists shopping_lists_archived_idx on public.shopping_lists (archived_at) where archived_at is not null;

create or replace function private.purge_expired_data(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_completions integer;
  v_notifications integer;
  v_lists integer;
  v_invitations integer;
  v_tasks integer;
  v_households integer;
  v_without_admin integer;
  v_today date := (p_now at time zone 'Europe/Amsterdam')::date;
begin
  -- Afvinkhistorie: 2 jaar
  delete from public.task_completions where completed_at < p_now - interval '2 years';
  get diagnostics v_completions = row_count;

  -- Meldingen: 90 dagen
  delete from public.notifications where created_at < p_now - interval '90 days';
  get diagnostics v_notifications = row_count;

  -- Gearchiveerde lijsten: 1 jaar (producten gaan mee via de FK)
  delete from public.shopping_lists where archived_at < p_now - interval '1 year';
  get diagnostics v_lists = row_count;

  -- Uitnodigingen: 30 dagen na gebruik of verlopen
  delete from public.household_invitations where coalesce(accepted_at, expires_at) < p_now - interval '30 days';
  get diagnostics v_invitations = row_count;

  -- Zacht verwijderde taken: na 90 dagen hard weg. Een uitvoering van een reeks
  -- pas als de datum meer dan 30 dagen voorbij is, zodat de planner een bewust
  -- verwijderde uitvoering binnen de horizon niet opnieuw aanmaakt. Losse taken
  -- hebben geen uitvoeringsdatum (D-040). De historie blijft (task_id → null).
  delete from public.tasks
  where deleted_at < p_now - interval '90 days'
    and (occurrence_date is null or occurrence_date < v_today - 30);
  get diagnostics v_tasks = row_count;

  -- Huishoudens zonder leden (bijv. na het verwijderen van het laatste account
  -- via Supabase zelf, buiten delete_my_account om): alles gaat mee via de FK's
  -- (security-review WP2b, punt 2)
  delete from public.households h
  where not exists (select 1 from public.household_members m where m.household_id = h.id);
  get diagnostics v_households = row_count;

  -- Alleen tellen, niet wissen: een huishouden met leden maar zonder actieve
  -- beheerder. De tick logt dit getal; de bouwer lost het met Jurgen op.
  select count(*) into v_without_admin
  from public.households h
  where not exists (
    select 1 from public.household_members m where m.household_id = h.id and m.role = 'admin' and m.is_active
  );

  return jsonb_build_object(
    'completions', v_completions,
    'notifications', v_notifications,
    'shopping_lists', v_lists,
    'invitations', v_invitations,
    'tasks', v_tasks,
    'households_without_members', v_households,
    'households_without_admin', v_without_admin
  );
end;
$$;

-- Alleen het systeem (de tick, met de service role) mag opruimen (AC-078)
create or replace function public.run_purge()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.purge_expired_data(now());
$$;

revoke execute on function private.purge_expired_data(timestamptz) from public, anon, authenticated;
revoke execute on function public.run_purge() from public, anon, authenticated;
grant execute on function public.run_purge() to service_role;
