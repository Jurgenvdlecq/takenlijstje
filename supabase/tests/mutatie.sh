#!/usr/bin/env bash
# Mutatiecontrole voor de databasetests: bewijst dat de tests falen als een
# rechtenregel uit de migraties verdwijnt. Per mutatie wordt een kopie van de
# migraties in een tijdelijke map aangepast en de volledige testsuite gedraaid.
# Verwacht: elke mutatie geeft een FOUT. "NIET GEVANGEN" = gat in de tests.
# Gebruik (als postgres): bash supabase/tests/mutatie.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
ROOT="$(pwd)"
WORK="$(mktemp -d /tmp/takenlijstje-mutatie.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT

python3 - "$ROOT" "$WORK" <<'PY'
import os, shutil, subprocess, sys
root, work = sys.argv[1], sys.argv[2]
R = '20260928000110_reeks_rpcs.sql'
A = '20260928000100_rechten_actief_lid.sql'
muts = {
  # B-01: reeks-RPC's zonder rechtencheck
  'reeks_rpc_zonder_rechtencheck': (R, """  if not private.can_manage_series(p_recurrence_id) then
    raise exception 'Alleen een beheerder of wie de reeks maakte mag dit' using errcode = '42501';
  end if;""", ""),
  'delete_task_zonder_check': (R, """  if not private.can_delete_task(v_task.household_id, v_task.created_by_member_id) then
    raise exception 'Alleen een beheerder of wie de taak maakte mag hem verwijderen' using errcode = '42501';
  end if;""", ""),
  # V-29
  'is_member_zonder_actief': (A, """      and m.user_id = (select auth.uid())
      and m.is_active
  );
$$;

create or replace function private.is_admin""", """      and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_admin"""),
  'eigen_lidrij_onleesbaar': (A, "using (private.is_member(household_id) or user_id = (select auth.uid()));",
                              "using (private.is_member(household_id));"),
  # Reekskoppeling / maker / BR-24
  'reekswissel_toegestaan': (A, """      else
        raise exception 'Een taak kan niet van reeks wisselen' using errcode = '42501';""", """      else
        null;"""),
  'maker_taak_wijzigbaar': (A, """    if new.created_by_member_id is distinct from old.created_by_member_id then
      raise exception 'De maker van een taak kan niet worden gewijzigd' using errcode = '42501';
    end if;""", ""),
  'uitgezette_admins_tellen_mee': (A, "where household_id = v_household and role = 'admin' and is_active and id <> old.id;",
                                   "where household_id = v_household and role = 'admin' and id <> old.id;"),
  'zelf_uitzetten_mag': (A, """      if old.user_id = v_uid and old.is_active and not new.is_active then
        raise exception 'Je kunt jezelf niet uitzetten' using errcode = '42501';
      end if;""", ""),
  # BR-25
  'notificatie_insert_policy_terug': (A, 'drop policy if exists "notifications: huisgenoten informeren" on public.notifications;', ""),
  'oude_url_check': (A, "url ~ '^/([^/\\\\]|$)'", "url ~ '^/'"),
  # D-016 (security 1): beide lagen weg
  'insert_policy_zonder_user_id_null': (A, "  with check (private.is_admin(household_id) and user_id is null);",
                                        "  with check (private.is_admin(household_id));"),
  'vreemd_account_policy_en_guard': [(A, "  with check (private.is_admin(household_id) and user_id is null);",
                                      "  with check (private.is_admin(household_id));"),
                                     (A, """      if new.user_id is not null and new.user_id <> v_uid then
        raise exception 'Een account koppel je alleen via een uitnodiging' using errcode = '42501';
      end if;""", "")],
  # D-017 (security 2)
  'gedane_taak_direct_terug': (A, """    if old.status = 'done' and new.status is distinct from 'done' and not v_via_rpc then
      raise exception 'Gebruik undo_complete_task() om afvinken ongedaan te maken' using errcode = '42501';
    end if;""", ""),
  'insert_met_completed_at': (A, """    if (new.completed_at is not null or new.completed_by_member_id is not null) and not v_via_rpc then
      raise exception 'Gebruik complete_task() om een taak af te vinken' using errcode = '42501';
    end if;""", ""),
  # D-021 (security 6)
  'ruilverzoek_herschrijfbaar': (A, """create trigger task_swap_requests_guard
  before update on public.task_swap_requests
  for each row execute function private.guard_swap_changes();""", ""),
  # D-027 (code-review 7)
  'pauze_zonder_generated_until': (R, """      generated_until = least(coalesce(generated_until, p_from - 1), p_from - 1)
  where id = v_series.id""", """      generated_until = generated_until
  where id = v_series.id"""),
  'hervatten_zonder_generated_until': (R, "set paused_from = null, paused_until = null, generated_until = null",
                                       "set paused_from = null, paused_until = null"),
  # FK-cascade door guard_member_changes
  'guard_leden_blokkeert_cascade': (A, """  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if v_uid is not null and not v_via_rpc then""", """  if v_uid is not null and not v_via_rpc then"""),
  # D-015
  'push_aanmelden_als_uitgezet': (A, """    user_id = (select auth.uid())
    and exists (select 1 from public.household_members m where m.user_id = (select auth.uid()) and m.is_active)
  );
create policy "push: bijwerken als actief lid\"""", """    user_id = (select auth.uid())
  );
create policy "push: bijwerken als actief lid\""""),
  # AC-028 (B-04)
  'private_functies_aanroepbaar': (R, "revoke execute on all functions in schema private from public, anon, authenticated;\ngrant execute on function",
                                   "grant execute on function"),
}
gevangen = 0
for name, spec in muts.items():
    d = os.path.join(work, name)
    shutil.copytree(os.path.join(root, 'supabase/migrations'), d)
    past = True
    for f, old, new in (spec if isinstance(spec, list) else [spec]):
        path = os.path.join(d, f)
        s = open(path).read()
        if old not in s:
            past = False
            break
        open(path, 'w').write(s.replace(old, new, 1))
    if not past:
        print(f'{name}: MUTATIE PAST NIET MEER OP DE MIGRATIE (bijwerken)')
        continue
    db = 'mut_' + name[:50]
    psql = ['psql', '-v', 'ON_ERROR_STOP=1', '-q', '-X']
    subprocess.run(psql + ['-d', 'postgres', '-c', f'drop database if exists {db}', '-c', f'create database {db}'], capture_output=True)
    out = ''
    ok = True
    for sql in ['supabase/tests/00_supabase_stub.sql'] + sorted(os.path.join(d, x) for x in os.listdir(d)) + \
               sorted(os.path.join('supabase/tests', x) for x in os.listdir('supabase/tests') if x[0] in '123456789' and x.endswith('.sql')):
        r = subprocess.run(psql + ['-d', db, '-f', sql], capture_output=True, text=True)
        if r.returncode != 0:
            ok = False
            out = next((l[l.find('ERROR'):] for l in r.stderr.splitlines() if 'ERROR' in l), r.stderr.strip())
            break
    subprocess.run(psql + ['-d', 'postgres', '-c', f'drop database if exists {db}'], capture_output=True)
    if ok:
        print(f'{name}: NIET GEVANGEN')
    else:
        gevangen += 1
        print(f'{name}: gevangen -> {out[:160]}')
print(f'{gevangen}/{len(muts)} mutaties gevangen')
PY
