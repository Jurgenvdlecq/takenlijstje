-- =============================================================================
-- WP3b — Grens op het opzoeken van een adres bij de gemeente (V-59; D-049)
--
-- Hooguit N opzoekingen (zoeken + bevestigen samen) per huishouden per uur.
-- Eén rij per huishouden; het venster schuift vanzelf. Alleen de service role
-- (na requireAdmin()); de teller staat los van waste_calendars, want die rij
-- bestaat pas na het aanzetten.
-- =============================================================================

begin;

create table public.waste_lookup_windows (
  household_id uuid primary key references public.households (id) on delete cascade,
  window_start timestamptz not null,
  lookups integer not null default 0 check (lookups >= 0)
);

alter table public.waste_lookup_windows enable row level security;
revoke all on public.waste_lookup_windows from public, anon, authenticated;
grant select, insert, update, delete on public.waste_lookup_windows to service_role;

-- Telt één opzoeking en zegt of hij nog binnen de grens valt.
create or replace function public.waste_lookup_allowed(p_household_id uuid, p_limit integer, p_now timestamptz)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.waste_lookup_windows as w (household_id, window_start, lookups)
  values (p_household_id, p_now, 1)
  on conflict (household_id) do update set
    window_start = case when w.window_start < p_now - interval '1 hour' then p_now else w.window_start end,
    lookups = case when w.window_start < p_now - interval '1 hour' then 1 else w.lookups + 1 end
  returning lookups into v_count;
  return v_count <= p_limit;
end;
$$;

revoke execute on function public.waste_lookup_allowed(uuid, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.waste_lookup_allowed(uuid, integer, timestamptz) to service_role;

commit;
