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
C = '20260928000210_scope_contract.sql'
# WP2b: …_210 vervangt guard_task_changes en undo_complete_task en herhaalt de
# revoke in private. Mutaties op die onderdelen gelden daarom ook voor C.
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
  'reekswissel_toegestaan': [(f, """      else
        raise exception 'Een taak kan niet van reeks wisselen' using errcode = '42501';""", """      else
        null;""") for f in (A, C)],
  'maker_taak_wijzigbaar': [(f, """    if new.created_by_member_id is distinct from old.created_by_member_id then
      raise exception 'De maker van een taak kan niet worden gewijzigd' using errcode = '42501';
    end if;""", "") for f in (A, C)],
  'uitgezette_admins_tellen_mee': (A, "where household_id = v_household and role = 'admin' and is_active and id <> old.id;",
                                   "where household_id = v_household and role = 'admin' and id <> old.id;"),
  'zelf_uitzetten_mag': (A, """      if old.user_id = v_uid and old.is_active and not new.is_active then
        raise exception 'Je kunt jezelf niet uitzetten' using errcode = '42501';
      end if;""", ""),
  # BR-25
  'notificatie_insert_policy_terug': (A, 'drop policy if exists "notifications: huisgenoten informeren" on public.notifications;', ""),
  'oude_url_check': (A, "url ~ '^/([^/\\\\]|$)'", "url ~ '^/'"),
  # D-016 (security 1): beide lagen weg
  # WP2b: …_210 dropt de insert-policy; de oude mutatie op A is daarmee zinloos.
  # Nu: de policy blijft bestaan (drop weg) → moet gevangen worden.
  'insert_policy_blijft_bestaan': (C, 'drop policy if exists "members: beheerder voegt toe" on public.household_members;\n', ""),
  'vreemd_account_policy_en_guard': [(A, "  with check (private.is_admin(household_id) and user_id is null);",
                                      "  with check (private.is_admin(household_id));"),
                                     (A, """      if new.user_id is not null and new.user_id <> v_uid then
        raise exception 'Een account koppel je alleen via een uitnodiging' using errcode = '42501';
      end if;""", ""),
                                     (C, 'drop policy if exists "members: beheerder voegt toe" on public.household_members;\n', "")],
  # D-017 (security 2)
  'gedane_taak_direct_terug': [(f, """    if old.status = 'done' and new.status is distinct from 'done' and not v_via_rpc then
      raise exception 'Gebruik undo_complete_task() om afvinken ongedaan te maken' using errcode = '42501';
    end if;""", "") for f in (A, C)],
  'insert_met_completed_at': [(A, """    if (new.completed_at is not null or new.completed_by_member_id is not null) and not v_via_rpc then
      raise exception 'Gebruik complete_task() om een taak af te vinken' using errcode = '42501';
    end if;""", ""),
                              (C, """    if new.completed_at is not null and not v_via_rpc then
      raise exception 'Gebruik complete_task() om een taak af te vinken' using errcode = '42501';
    end if;""", "")],
  # D-021 (security 6): de ruiltabel bestaat sinds …_210 niet meer; de mutatie
  # 'ruilverzoek_herschrijfbaar' is vervangen door 'ruilen_blijft_bestaan' (hieronder)
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
                                    "grant execute on function"),
                                   (C, "revoke execute on all functions in schema private from public, anon, authenticated;\ngrant execute on function",
                                    "grant execute on function")],
  # ---- WP2a (…_200) ----
  # WP2b: 'afvinken_met_persoon' en 'oude_signatuur_schrijft_persoon' muteerden …_200;
  # na …_210 bestaan de kolom en de oude functie niet meer. Vervangen door:
  'historie_member_id_blijft': (C, "  drop column member_id,\n  drop column points;", "  drop column points;"),
  'oude_complete_task_blijft': (C, "drop function if exists public.complete_task(uuid, uuid, uuid, text, timestamptz);\n", ""),
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
  'undo_zonder_lidcheck': [(f, """begin
  select * into v_task from public.tasks where id = p_task_id;
  if not found or v_task.deleted_at is not null or not private.is_member(v_task.household_id) then""", """begin
  select * into v_task from public.tasks where id = p_task_id;
  if not found or v_task.deleted_at is not null then""") for f in (E, C)],
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
  'oudere_lijst_terugzetten': (E, "    raise exception 'Deze lijst kan niet meer worden teruggezet' using errcode = 'P0001';", "    null;"),
  'huishouden_verwijderen_zonder_naam': (E, "  if v_name is distinct from p_confirm_name then", "  if false then"),
  'huishouden_verwijderen_door_lid': (E, "  if v_member.role <> 'admin' then", "  if false then"),
  'account_verwijderen_laatste_beheerder': (E, """  if v_member.role = 'admin' and v_member.is_active and not exists (""", """  if false and not exists ("""),
  'account_verwijderen_alleen_actief': (E, """  select * into v_member from public.household_members
  where user_id = (select auth.uid())
  for update;""", """  select * into v_member from public.household_members
  where user_id = (select auth.uid()) and is_active
  for update;"""),
  'tijdzone_uit_invoer': (E, "  values (trim(p_name), 'Europe/Amsterdam', v_user)", "  values (trim(p_name), coalesce(p_timezone, 'Europe/Amsterdam'), v_user)"),
  # ---- D-037 ----
  'account_verwijderen_zonder_huishoudlock': (E, "  perform 1 from public.households where id = v_member.household_id for update;\n", ""),
  # WP2b: unique (user_id) uit …_210 is een tweede laag; de lock-mutaties gaan daarom samen met die constraint
  'create_household_zonder_advisory_lock': [(E, """  perform pg_advisory_xact_lock(hashtext('takenlijstje.lid:' || v_user::text));
  if exists (select 1 from public.household_members where user_id = v_user) then""", """  if exists (select 1 from public.household_members where user_id = v_user) then"""),
                                            (C, "  add constraint household_members_user_id_key unique (user_id),\n", "")],
  'accept_invitation_zonder_advisory_lock': [(E, """  perform pg_advisory_xact_lock(hashtext('takenlijstje.lid:' || v_user::text));

  select * into v_inv from public.household_invitations""", """  select * into v_inv from public.household_invitations"""),
                                             (C, "  add constraint household_members_user_id_key unique (user_id),\n", "")],
  'al_lid_verbruikt_elke_link': (E, """    if v_inv.accepted_at is null and v_inv.expires_at >= now()
       and (v_inv.email is null or lower(v_inv.email) = lower(coalesce(v_email, ''))) then""", """    if v_inv.accepted_at is null then"""),
  'delete_my_account_open': (E, "revoke execute on function public.delete_my_account() from authenticated;",
                             "grant execute on function public.delete_my_account() to authenticated;"),
  # ---- WP2b (…_210) ----
  'lid_zonder_account_mag': (C, "alter table public.household_members alter column user_id set not null;\n", ""),
  'unique_user_id_weg': (C, "  add constraint household_members_user_id_key unique (user_id),\n", ""),
  'account_weg_laat_lid_staan': (C, "references public.users (id) on delete cascade;", "references public.users (id) on delete set null;"),
  'unique_task_id_weg': (C, "alter table public.task_completions add constraint task_completions_task_id_key unique (task_id);\n", ""),
  'tegelijk_afvinken_zonder_lock_en_unique': [(C, "alter table public.task_completions add constraint task_completions_task_id_key unique (task_id);\n", ""),
                                              (E, "  select * into v_task from public.tasks where id = p_task_id for update;\n  if not found or v_task.deleted_at is not null then\n    raise exception 'Taak niet gevonden' using errcode = 'P0002';",
                                                  "  select * into v_task from public.tasks where id = p_task_id;\n  if not found or v_task.deleted_at is not null then\n    raise exception 'Taak niet gevonden' using errcode = 'P0002';")],
  'actieve_lijst_index_weg': (C, "create unique index shopping_lists_one_active_idx\n  on public.shopping_lists (household_id) where archived_at is null;\n", ""),
  'tijdzonecheck_weg': (C, "alter table public.households\n  add constraint households_timezone_amsterdam check (timezone = 'Europe/Amsterdam');\n", ""),
  'accept_swap_request_blijft': (C, "drop function if exists public.accept_swap_request(uuid);\n", ""),
  'ruilen_blijft_bestaan': [(C, "drop table public.task_swap_requests;\n", ""), (C, "drop function if exists private.guard_swap_changes();\n", "")],
  'enum_houdt_task_assigned': (C, "  'reminder', 'deadline_soon', 'overdue',", "  'task_assigned', 'reminder', 'deadline_soon', 'overdue',"),
  'oude_taak_gedaan_meldingen_blijven': (C, "where type in ('task_assigned', 'swap_request', 'swap_accepted', 'task_completed', 'daily_summary', 'evening_summary');",
                                         "where type in ('task_assigned', 'swap_request', 'swap_accepted');"),
  # (Geen mutatie op "delete from public.household_invitations where member_id is not null …":
  # equivalent, want de FK member_id → household_members is "on delete cascade" en
  # het wissen van de leden zonder account neemt die uitnodigingen al mee.)
  'wissen_raakt_bijgewerkt_op': (C, "alter table public.tasks disable trigger tasks_updated_at;\n", ""),
  'undo_niet_vervangen': (C, "create or replace function public.undo_complete_task(p_task_id uuid)", "create or replace function private.undo_ongebruikt(p_task_id uuid)"),
  'guard_taken_niet_vervangen': (C, "create or replace function private.guard_task_changes()", "create or replace function private.guard_ongebruikt()"),
  'huishouden_direct_verwijderen': (E, 'drop policy if exists "households: beheerder verwijdert" on public.households;', ""),
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
    if ok:
        r = subprocess.run(['bash', 'supabase/tests/gelijktijdig.sh', db], capture_output=True, text=True)
        if r.returncode != 0:
            ok = False
            out = 'gelijktijdig: ' + next((l[l.find('ERROR'):] for l in (r.stdout + r.stderr).splitlines() if 'ERROR' in l), (r.stdout + r.stderr).strip())
    if ok:
        # Upgrade-test (AC-053, AC-179, AC-059): oud schema + oude gegevens → …_200 → controles
        # → …_210 en verder → controles (zelfde volgorde als run.sh)
        subprocess.run(psql + ['-d', 'postgres', '-c', f'drop database if exists {db}', '-c', f'create database {db}'], capture_output=True)
        migs = sorted(os.path.join(d, x) for x in os.listdir(d))
        stappen = ['supabase/tests/00_supabase_stub.sql'] + [m for m in migs if os.path.basename(m) < '20260928000200'] + \
                  ['supabase/tests/upgrade/voor_200.sql'] + \
                  [m for m in migs if '20260928000200' <= os.path.basename(m) < '20260928000210'] + \
                  ['supabase/tests/upgrade/na_200.sql'] + \
                  [m for m in migs if os.path.basename(m) >= '20260928000210'] + \
                  ['supabase/tests/upgrade/na_210.sql']
        for sql in stappen:
            r = subprocess.run(psql + ['-d', db, '-f', sql], capture_output=True, text=True)
            if r.returncode != 0:
                ok = False
                out = 'upgrade: ' + next((l[l.find('ERROR'):] for l in r.stderr.splitlines() if 'ERROR' in l), r.stderr.strip())
                break
        subprocess.run(psql + ['-d', 'postgres', '-c', f'drop database if exists {db}'], capture_output=True)
    subprocess.run(psql + ['-d', 'postgres', '-c', f'drop database if exists {db}'], capture_output=True)
    if ok:
        print(f'{name}: NIET GEVANGEN')
    else:
        gevangen += 1
        print(f'{name}: gevangen -> {out[:160]}')
print(f'{gevangen}/{len(muts)} mutaties gevangen')
PY
