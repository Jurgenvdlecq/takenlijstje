#!/usr/bin/env bash
# Gelijktijdigheidstests WP2a (security-review WP2a "Doorgeven aan test-writer", D-037):
#  1. twee beheerders heffen tegelijk hun lidmaatschap op (delete_my_account)
#     → er blijft minstens één actieve beheerder over (BR-24);
#  2. dezelfde gebruiker maakt twee keer tegelijk een huishouden → één lidmaatschap (BR-44);
#  3. dezelfde gebruiker accepteert tegelijk twee uitnodigingen → één lidmaatschap (BR-44);
#  4. (WP2b) twee leden vinken dezelfde taak tegelijk af, elk met een eigen mutationId
#     → één registratie (BR-11, AC-036/AC-037; unique (task_id) uit …_210 + rijlock);
#  5. (WP2b-herstel, …_220) undo terwijl de taak tussen lezen en lock zacht verwijderd
#     wordt → "Taak niet gevonden" en de historie blijft (security-review WP2b, punt 4);
#  6. (WP3b) twee beheerders bevestigen tegelijk een ander adres → één adres (AC-191);
#  7. (WP3b) twee claims binnen 60 s → één claim (AC-236, §18.8.3).
# Twee echte sessies: sessie 1 houdt zijn transactie 1,5 s open, sessie 2 start 0,3 s later.
# Gebruik: bash supabase/tests/gelijktijdig.sh <database of connectiestring>
set -uo pipefail
DB="$1"
P=(psql -v ON_ERROR_STOP=1 -q -X -At -d "$DB")

"${P[@]}" >/dev/null <<'SQL'
insert into auth.users (id, email) values
  ('60000000-0000-0000-0000-0000000000a1', 'a.gelijk@example.com'),
  ('60000000-0000-0000-0000-0000000000a2', 'b.gelijk@example.com'),
  ('60000000-0000-0000-0000-0000000000a3', 'c.gelijk@example.com'),
  ('60000000-0000-0000-0000-0000000000a4', 'd.gelijk@example.com'),
  ('60000000-0000-0000-0000-0000000000a5', 'e.gelijk@example.com');
set role authenticated;
-- Huishouden met twee actieve beheerders (A en B)
select set_config('request.jwt.claims', '{"sub":"60000000-0000-0000-0000-0000000000a1"}', false);
select public.create_household('Gelijk', 'A');
insert into public.household_invitations (household_id, email, role, invited_by_member_id, token)
select household_id, 'b.gelijk@example.com', 'admin', id, 'gelijk-tok-b' from public.household_members
where user_id = '60000000-0000-0000-0000-0000000000a1';
select set_config('request.jwt.claims', '{"sub":"60000000-0000-0000-0000-0000000000a2"}', false);
select public.accept_invitation('gelijk-tok-b', 'B');
-- Een open taak in "Gelijk" (voor 4)
insert into public.tasks (id, household_id, title, scheduled_date, created_by_member_id)
select '61000000-0000-0000-0000-000000000001', household_id, 'Tegelijk afvinken', current_date, id
from public.household_members where user_id = '60000000-0000-0000-0000-0000000000a2';
-- Twee huishoudens die D uitnodigen
select set_config('request.jwt.claims', '{"sub":"60000000-0000-0000-0000-0000000000a1"}', false);
insert into public.household_invitations (household_id, email, invited_by_member_id, token)
select household_id, 'd.gelijk@example.com', id, 'gelijk-tok-d1' from public.household_members
where user_id = '60000000-0000-0000-0000-0000000000a1';
select set_config('request.jwt.claims', '{"sub":"60000000-0000-0000-0000-0000000000a5"}', false);
select public.create_household('Gelijk twee', 'E');
insert into public.household_invitations (household_id, email, invited_by_member_id, token)
select household_id, 'd.gelijk@example.com', id, 'gelijk-tok-d2' from public.household_members
where user_id = '60000000-0000-0000-0000-0000000000a5';
SQL

# sessie <uid> <sql> [eigenaar]: één transactie die 1,5 s open blijft
sessie() {
  local uid="$1" sql="$2" rol="${3:-authenticated}"
  local role_cmd="set role authenticated"
  [[ "$rol" == "eigenaar" ]] && role_cmd="select 1"
  psql -q -X -At -d "$DB" \
    -c "begin" -c "$role_cmd" \
    -c "select set_config('request.jwt.claims', '{\"sub\":\"$uid\"}', true)" \
    -c "$sql" -c "select pg_sleep(1.5)" -c "commit" >/dev/null 2>&1
}

race() {
  sessie "$1" "$3" "${5:-}" &
  local p1=$!
  sleep 0.3
  sessie "$2" "$4" "${5:-}" &
  local p2=$!
  wait "$p1" "$p2" 2>/dev/null
  true
}

# 4. twee leden vinken tegelijk dezelfde taak af (vóór 1, want daarna is A of B geen lid meer)
race 60000000-0000-0000-0000-0000000000a1 60000000-0000-0000-0000-0000000000a2 \
  "select public.complete_task('61000000-0000-0000-0000-000000000001', gen_random_uuid())" \
  "select public.complete_task('61000000-0000-0000-0000-000000000001', gen_random_uuid())"
# 5. (WP2b-herstel, …_220) undo terwijl de taak tussen de eerste lezing en de lock
#    zacht verwijderd wordt → "Taak niet gevonden" (P0002) en de historie blijft.
#    Sessie 1 (systeem, zonder gebruiker) houdt de rij vast en verwijdert hem;
#    sessie 2 (lid B) leest hem nog als niet verwijderd en wacht dan op de lock.
UNDO_OUT="$(mktemp)"
psql -q -X -At -d "$DB" -c "begin" \
  -c "select id from public.tasks where id = '61000000-0000-0000-0000-000000000001' for update" \
  -c "update public.tasks set deleted_at = now() where id = '61000000-0000-0000-0000-000000000001'" \
  -c "select pg_sleep(1.5)" -c "commit" >/dev/null 2>&1 &
p_lock=$!
sleep 0.3
psql -X -At -d "$DB" -c "set role authenticated" \
  -c "select set_config('request.jwt.claims', '{\"sub\":\"60000000-0000-0000-0000-0000000000a2\"}', false)" \
  -c "select public.undo_complete_task('61000000-0000-0000-0000-000000000001')" >"$UNDO_OUT" 2>&1
wait "$p_lock" 2>/dev/null
if ! grep -q "Taak niet gevonden" "$UNDO_OUT"; then
  echo "ERROR:  ASSERT MISLUKT: undo-race (…_220): verwacht 'Taak niet gevonden', kreeg: $(tr '\n' ' ' < "$UNDO_OUT")" >&2
  rm -f "$UNDO_OUT"
  exit 1
fi
rm -f "$UNDO_OUT"
# 6. (WP3b, AC-191) twee beheerders bevestigen tegelijk een ander adres (waste_save als
#    service role, ná requireAdmin) → één adres, alleen taken van dat adres, geen dubbele
#    (ophaaldag, richting). Sessie 1 houdt zijn transactie open; sessie 2 wacht op de rij.
HH="$("${P[@]}" -c "select household_id from public.household_members where user_id = '60000000-0000-0000-0000-0000000000a1'")"
LID_A="$("${P[@]}" -c "select id from public.household_members where user_id = '60000000-0000-0000-0000-0000000000a1'")"
LID_B="$("${P[@]}" -c "select id from public.household_members where user_id = '60000000-0000-0000-0000-0000000000a2'")"
afval_taak() { # <dagen vooruit> <out|in>
  local d="$1" dir="$2"
  if [[ "$dir" == "out" ]]; then
    echo "jsonb_build_object('title','Restafval buitenzetten','scheduled_date',current_date + $d - 1,'scheduled_time','21:00','available_from',null,'due_at',((current_date + $d) + time '07:45') at time zone 'Europe/Amsterdam','waste_pickup_date',current_date + $d,'waste_direction','out','waste_streams',jsonb_build_array('rest'))"
  else
    echo "jsonb_build_object('title','Restafvalbak binnenzetten','scheduled_date',current_date + $d,'scheduled_time',null,'available_from',((current_date + $d) + time '12:00') at time zone 'Europe/Amsterdam','due_at',((current_date + $d + 1) + time '00:00') at time zone 'Europe/Amsterdam','waste_pickup_date',current_date + $d,'waste_direction','in','waste_streams',jsonb_build_array('rest'))"
  fi
}
SAVE_A="select public.waste_save('$HH', '$LID_A', '2511AB', 12, '', '0518200000000001', jsonb_build_object('rest', jsonb_build_array(current_date + 3), 'papier', '[]'::jsonb, 'pmd', '[]'::jsonb), jsonb_build_array($(afval_taak 3 out), $(afval_taak 3 in)), now())"
SAVE_B="select public.waste_save('$HH', '$LID_B', '2513EF', 1, '', '0518200000000002', jsonb_build_object('rest', jsonb_build_array(current_date + 5), 'papier', '[]'::jsonb, 'pmd', '[]'::jsonb), jsonb_build_array($(afval_taak 5 out), $(afval_taak 5 in)), now())"
# Als de service role: zonder gebruikersclaim (de guard laat afvaltaken alleen zonder `sub` toe)
SAVE_OUT="$(mktemp)"
psql -X -At -d "$DB" -c "begin" -c "$SAVE_A" -c "select pg_sleep(1.5)" -c "commit" >"$SAVE_OUT" 2>&1 &
p_s1=$!
sleep 0.3
psql -X -At -d "$DB" -c "begin" -c "$SAVE_B" -c "commit" >>"$SAVE_OUT" 2>&1 &
p_s2=$!
wait "$p_s1" "$p_s2" 2>/dev/null
if grep -q "ERROR" "$SAVE_OUT"; then
  echo "ERROR:  ASSERT MISLUKT: AC-191 waste_save-race: een van beide sessies gaf een fout: $(grep -m1 ERROR "$SAVE_OUT")" >&2
  rm -f "$SAVE_OUT"
  exit 1
fi
rm -f "$SAVE_OUT"
# 7. (WP3b, AC-236, §18.8.3) twee claims binnen 60 s (twee ticks, of tick + "Opnieuw proberen")
#    → precies één sessie krijgt de claim; de andere 0 rijen en dus geen verzoek naar buiten.
VERSIE="$("${P[@]}" -c "select version from public.waste_calendars where household_id = '$HH'")"
# waste_save zette zelf al een claim (last_attempt_at = p_now); die vervalt eerst, anders wint niemand
"${P[@]}" -c "update public.waste_calendars set last_attempt_at = null where household_id = '$HH'" >/dev/null
CLAIM="update public.waste_calendars set last_attempt_at = now() where household_id = '$HH' and version = $VERSIE and (last_attempt_at is null or last_attempt_at < now() - interval '60 seconds') returning 1"
CLAIM1="$(mktemp)"; CLAIM2="$(mktemp)"
psql -X -At -d "$DB" -c "begin" -c "$CLAIM" -c "select pg_sleep(1.5)" -c "commit" >"$CLAIM1" 2>&1 &
p_c1=$!
sleep 0.3
psql -X -At -d "$DB" -c "begin" -c "$CLAIM" -c "commit" >"$CLAIM2" 2>&1 &
p_c2=$!
wait "$p_c1" "$p_c2" 2>/dev/null
CLAIMS=$(( $(grep -c '^1$' "$CLAIM1") + $(grep -c '^1$' "$CLAIM2") ))
rm -f "$CLAIM1" "$CLAIM2"
if [[ "$CLAIMS" -ne 1 ]]; then
  echo "ERROR:  ASSERT MISLUKT: AC-236 claim-race: $CLAIMS sessies kregen de claim binnen 60 s (verwacht 1)" >&2
  exit 1
fi
# 1. delete_my_account is tot WP7 dicht voor authenticated (D-037); de logica als eigenaar met de claim
race 60000000-0000-0000-0000-0000000000a1 60000000-0000-0000-0000-0000000000a2 \
  "select public.delete_my_account()" "select public.delete_my_account()" eigenaar
# 2. twee keer tegelijk een huishouden maken
race 60000000-0000-0000-0000-0000000000a3 60000000-0000-0000-0000-0000000000a3 \
  "select public.create_household('Dubbel een', 'C')" "select public.create_household('Dubbel twee', 'C')"
# 3. twee uitnodigingen tegelijk accepteren
race 60000000-0000-0000-0000-0000000000a4 60000000-0000-0000-0000-0000000000a4 \
  "select public.accept_invitation('gelijk-tok-d1', 'D')" "select public.accept_invitation('gelijk-tok-d2', 'D')"

"${P[@]}" <<'SQL'
\o /dev/null
do $$
declare
  v_admins integer;
  v_c integer;
  v_d integer;
  v_t integer;
begin
  select count(*) into v_t from public.task_completions where task_id = '61000000-0000-0000-0000-000000000001';
  if v_t <> 1 or not exists (select 1 from public.tasks where id = '61000000-0000-0000-0000-000000000001' and status = 'done') then
    raise exception 'ASSERT MISLUKT: BR-11 gelijktijdig: % registraties na twee keer tegelijk afvinken', v_t;
  end if;
  -- 5. na de undo-race: de taak is verwijderd, nog gedaan, en de historie (1 registratie) staat er nog
  if not exists (select 1 from public.tasks where id = '61000000-0000-0000-0000-000000000001' and deleted_at is not null and completed_at is not null) then
    raise exception 'ASSERT MISLUKT: undo-race (…_220): taak is niet meer verwijderd-en-gedaan';
  end if;
  select count(*) into v_admins from public.household_members m join public.households h on h.id = m.household_id
  where h.name = 'Gelijk' and m.role = 'admin' and m.is_active;
  if v_admins < 1 then
    raise exception 'ASSERT MISLUKT: BR-24 gelijktijdig: huishouden zonder actieve beheerder na twee gelijktijdige delete_my_account';
  end if;
  select count(*) into v_c from public.household_members where user_id = '60000000-0000-0000-0000-0000000000a3';
  if v_c <> 1 then
    raise exception 'ASSERT MISLUKT: BR-44 gelijktijdig: % lidmaatschappen na twee keer tegelijk create_household', v_c;
  end if;
  -- 6. na twee gelijktijdige waste_save: één adres, en alleen open taken voor de ophaaldag van dat adres
  select count(*) into v_t from public.waste_calendars c join public.households h on h.id = c.household_id where h.name = 'Gelijk';
  if v_t <> 1 then
    raise exception 'ASSERT MISLUKT: AC-191 gelijktijdig: % adressen na twee gelijktijdige waste_save', v_t;
  end if;
  select count(*) into v_t from public.tasks t join public.households h on h.id = t.household_id
  where h.name = 'Gelijk' and t.waste_direction is not null and t.status in ('todo', 'in_progress')
    and not exists (select 1 from public.waste_calendars c where c.household_id = t.household_id
                    and c.pickups -> 'rest' ? t.waste_pickup_date::text);
  if v_t <> 0 then
    raise exception 'ASSERT MISLUKT: AC-191 gelijktijdig: % open afvaltaken van het verliezende adres', v_t;
  end if;
  select count(*) into v_t from public.tasks t join public.households h on h.id = t.household_id
  where h.name = 'Gelijk' and t.waste_direction is not null and t.status in ('todo', 'in_progress');
  if v_t <> 2 then
    raise exception 'ASSERT MISLUKT: AC-191 gelijktijdig: % open afvaltaken (verwacht buiten + binnen van één adres)', v_t;
  end if;
  select count(*) into v_t from (select household_id, waste_pickup_date, waste_direction from public.tasks
    where waste_direction is not null group by 1, 2, 3 having count(*) > 1) d;
  if v_t <> 0 then
    raise exception 'ASSERT MISLUKT: AC-191 gelijktijdig: dubbele (ophaaldag, richting)';
  end if;
  select count(*) into v_d from public.household_members where user_id = '60000000-0000-0000-0000-0000000000a4';
  if v_d <> 1 then
    raise exception 'ASSERT MISLUKT: BR-44 gelijktijdig: % lidmaatschappen na twee uitnodigingen tegelijk', v_d;
  end if;
end;
$$;
\o
select 'Gelijktijdigheidstests geslaagd';
SQL
