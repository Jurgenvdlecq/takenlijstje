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
E = '20260928000200_scope_expand.sql'
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
  # WP2a: …_200 herhaalt de revoke, dus de mutatie moet in beide migraties
  'private_functies_aanroepbaar': [(R, "revoke execute on all functions in schema private from public, anon, authenticated;\ngrant execute on function",
                                    "grant execute on function"),
                                   (E, "revoke execute on all functions in schema private from public, anon, authenticated;\ngrant execute on function",
                                    "grant execute on function")],
  # ---- WP2a (…_200) ----
  'afvinken_met_persoon': [(E, "duration_minutes, note, client_mutation_id\n  ) values (", "duration_minutes, note, client_mutation_id, member_id\n  ) values ("),
                           (E, "nullif(trim(p_note), ''), p_mutation_id\n  )", "nullif(trim(p_note), ''), p_mutation_id, private.my_member_id(v_task.household_id)\n  )")],
  'oude_signatuur_schrijft_persoon': (E, """  select * from public.complete_task(
    p_task_id => p_task_id,
    p_mutation_id => p_mutation_id,
    p_note => p_note,
    p_completed_at => p_completed_at
  );
$$;""", """  select * from public.complete_task(
    p_task_id => p_task_id,
    p_mutation_id => p_mutation_id,
    p_note => p_note,
    p_completed_at => p_completed_at
  );
  update public.task_completions set member_id = p_completed_by where client_mutation_id = p_mutation_id;
  select * from public.task_completions where client_mutation_id = p_mutation_id;
$$;"""),
  'begrenzing_afvinkmoment_weg': (E, "v_at := least(greatest(coalesce(p_completed_at, now()), now() - interval '7 days'), now());",
                                  "v_at := coalesce(p_completed_at, now());"),
  'n2_vreemd_geeft_42501': (E, """  select * into v_task from public.tasks where id = p_task_id;
  if not found or v_task.deleted_at is not null or not private.is_member(v_task.household_id) then
    raise exception 'Taak niet gevonden' using errcode = 'P0002';
  end if;""", """  select * into v_task from public.tasks where id = p_task_id;
  if found and not private.is_member(v_task.household_id) then
    raise exception 'Geen toegang' using errcode = '42501';
  end if;
  if not found or v_task.deleted_at is not null then
    raise exception 'Taak niet gevonden' using errcode = 'P0002';
  end if;"""),
  'undo_zonder_lidcheck': (E, """  select * into v_task from public.tasks where id = p_task_id;
  if not found or v_task.deleted_at is not null or not private.is_member(v_task.household_id) then
    raise exception 'Taak niet gevonden' using errcode = 'P0002';
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task.status <> 'done' then""", """  select * into v_task from public.tasks where id = p_task_id;
  if not found or v_task.deleted_at is not null then
    raise exception 'Taak niet gevonden' using errcode = 'P0002';
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task.status <> 'done' then"""),
  'schrijversnaam_van_client': (E, "  new.author_name := coalesce(\n", "  new.author_name := coalesce(new.author_name,\n"),
  'guard_notitie_laat_alles_door': (E, "  raise exception 'Een notitie kan niet worden gewijzigd' using errcode = '42501';", "  return new;"),
  'naam_sync_weg': (E, """create trigger household_members_sync_comment_author
  after update of display_name on public.household_members
  for each row execute function private.sync_comment_author();""", ""),
  'gezinslid_standaard_aan': (E, "  v_on boolean := new.role = 'admin';", "  v_on boolean := true;"),
  'migratie_zet_gezinsleden_niet_uit': (E, "where m.id = p.member_id and m.role = 'member';", "where m.id = p.member_id and false;"),
  'migratie_raakt_beheerders': (E, "where m.id = p.member_id and m.role = 'member';", "where m.id = p.member_id;"),
  'migratie_notitie_zonder_lid_leeg': (E, """  'Gezinslid'
)
where c.author_name is null;""", """  'Onbekend'
)
where c.author_name is null;"""),
  'br44_create_household': (E, """  if exists (select 1 from public.household_members where user_id = v_user) then
    raise exception 'Je hoort al bij een ander huishouden. Je kunt maar bij één huishouden horen.'
      using errcode = 'P0001';
  end if;

  insert into public.users (id) values""", """  insert into public.users (id) values"""),
  'br44_accept_invitation': (E, """  if exists (select 1 from public.household_members where user_id = v_user) then
    raise exception 'Je hoort al bij een ander huishouden. Je kunt maar bij één huishouden horen.'
      using errcode = 'P0001';
  end if;

  insert into public.users (id, email)""", """  insert into public.users (id, email)"""),
  'uitnodiging_ander_adres': (E, "  if v_inv.email is not null and lower(v_inv.email) <> lower(coalesce(v_email, '')) then",
                              "  if false then"),
  'archiveren_niet_idempotent': (E, """  if v_list.archived_at is not null then
    select * into v_new from public.shopping_lists""", """  if false then
    select * into v_new from public.shopping_lists"""),
  'geen_unieke_actieve_lijst': (E, """create unique index if not exists shopping_lists_one_active_idx
  on public.shopping_lists (household_id) where archived_at is null;""", ""),
  'oudere_lijst_terugzetten': (E, "    raise exception 'Deze lijst kan niet meer worden teruggezet' using errcode = 'P0001';", "    null;"),
  'huishouden_verwijderen_zonder_naam': (E, "  if v_name is distinct from p_confirm_name then", "  if false then"),
  'huishouden_verwijderen_door_lid': (E, "  if v_member.role <> 'admin' then", "  if false then"),
  'account_verwijderen_laatste_beheerder': (E, """  if v_member.role = 'admin' and v_member.is_active and not exists (""", """  if false and not exists ("""),
  'account_verwijderen_alleen_actief': (E, """  select * into v_member from public.household_members
  where user_id = (select auth.uid())
  for update;""", """  select * into v_member from public.household_members
  where user_id = (select auth.uid()) and is_active
  for update;"""),
  'tijdzonecheck_weg': (E, """alter table public.households
  add constraint households_timezone_amsterdam check (timezone = 'Europe/Amsterdam');""", ""),
  'tijdzone_uit_invoer': (E, "  values (trim(p_name), 'Europe/Amsterdam', v_user)", "  values (trim(p_name), coalesce(p_timezone, 'Europe/Amsterdam'), v_user)"),
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
        # Upgrade-test (AC-053, AC-179): oud schema + oude gegevens → …_200 → controles
        subprocess.run(psql + ['-d', 'postgres', '-c', f'drop database if exists {db}', '-c', f'create database {db}'], capture_output=True)
        migs = sorted(os.path.join(d, x) for x in os.listdir(d))
        stappen = ['supabase/tests/00_supabase_stub.sql'] + [m for m in migs if os.path.basename(m) < '20260928000200'] + \
                  ['supabase/tests/upgrade/voor_200.sql'] + [m for m in migs if os.path.basename(m) >= '20260928000200'] + \
                  ['supabase/tests/upgrade/na_200.sql']
        for sql in stappen:
            r = subprocess.run(psql + ['-d', db, '-f', sql], capture_output=True, text=True)
            if r.returncode != 0:
                ok = False
                out = 'upgrade: ' + next((l[l.find('ERROR'):] for l in r.stderr.splitlines() if 'ERROR' in l), r.stderr.strip())
                break
        subprocess.run(psql + ['-d', 'postgres', '-c', f'drop database if exists {db}'], capture_output=True)
    if ok:
        print(f'{name}: NIET GEVANGEN')
    else:
        gevangen += 1
        print(f'{name}: gevangen -> {out[:160]}')
print(f'{gevangen}/{len(muts)} mutaties gevangen')
PY
