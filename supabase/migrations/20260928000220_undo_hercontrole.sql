-- =============================================================================
-- WP2b-herstel (security-review WP2b, punt 4): in …_210 viel de hercontrole na
-- de lock weg uit undo_complete_task. Wordt de taak tussen de eerste lezing en
-- de lock (zacht) verwijderd, dan geeft de functie weer "Taak niet gevonden" en
-- blijft de historie staan. …_210 zelf is al op live uitgevoerd en blijft ongewijzigd.
-- =============================================================================

create or replace function public.undo_complete_task(p_task_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
begin
  select * into v_task from public.tasks where id = p_task_id;
  if not found or v_task.deleted_at is not null or not private.is_member(v_task.household_id) then
    raise exception 'Taak niet gevonden' using errcode = 'P0002';
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or v_task.deleted_at is not null then
    raise exception 'Taak niet gevonden' using errcode = 'P0002';
  end if;
  if v_task.status <> 'done' then
    return v_task;
  end if;

  delete from public.task_completions where task_id = v_task.id;

  perform set_config('takenlijstje.via_rpc', 'on', true);
  update public.tasks
  set status = 'todo', completed_at = null
  where id = v_task.id
  returning * into v_task;
  perform set_config('takenlijstje.via_rpc', 'off', true);

  return v_task;
end;
$$;
