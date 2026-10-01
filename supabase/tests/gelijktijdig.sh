#!/usr/bin/env bash
# Gelijktijdigheidstests WP2a (security-review WP2a "Doorgeven aan test-writer", D-037):
#  1. twee beheerders heffen tegelijk hun lidmaatschap op (delete_my_account)
#     → er blijft minstens één actieve beheerder over (BR-24);
#  2. dezelfde gebruiker maakt twee keer tegelijk een huishouden → één lidmaatschap (BR-44);
#  3. dezelfde gebruiker accepteert tegelijk twee uitnodigingen → één lidmaatschap (BR-44);
#  4. (WP2b) twee leden vinken dezelfde taak tegelijk af, elk met een eigen mutationId
#     → één registratie (BR-11, AC-036/AC-037; unique (task_id) uit …_210 + rijlock);
#  5. (WP2b-herstel, …_220) undo terwijl de taak tussen lezen en lock zacht verwijderd
#     wordt → "Taak niet gevonden" en de historie blijft (security-review WP2b, punt 4).
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
# 1. delete_my_account is tot WP7 dicht voor authenticated (D-037); de logica als eigenaar met de claim
race 60000000-0000-0000-0000-0000000000a1 60000000-0000-0000-0000-0000000000a2 \
  "select public.delete_my_account()" "select public.delete_my_account()" eigenaar
# 2. twee keer tegelijk een huishouden maken
race 60000000-0000-0000-0000-0000000000a3 60000000-0000-0000-0000-0000000000a3 \
  "select public.create_household('Dubbel een', 'C')" "select public.create_household('Dubbel twee', 'C')"
# 3. twee uitnodigingen tegelijk accepteren
race 60000000-0000-0000-0000-0000000000a4 60000000-0000-0000-0000-0000000000a4 \
  "select public.accept_invitation('gelijk-tok-d1', 'D')" "select public.accept_invitation('gelijk-tok-d2', 'D')"
# 6. (W-03, AC-191) twee keer tegelijk een afvaladres opslaan (systeem, zoals na requireAdmin):
#    het slot op het huishouden serialiseert; precies één adres en alleen taken van dat adres
afval_save() {
  local postcode="$1" bag="$2" bak="$3"
  echo "select public.waste_save(h.id, m.id, '$postcode', 1, '', '$bag', jsonb_build_object('$bak', jsonb_build_array()),
    jsonb_build_array(
      jsonb_build_object('title', 'Afval buitenzetten', 'description', 'x', 'scheduled_date', current_date + 1, 'scheduled_time', '21:00',
        'due_at', now() + interval '2 days', 'waste_pickup_date', current_date + 2, 'waste_direction', 'out', 'waste_streams', jsonb_build_array('$bak')),
      jsonb_build_object('title', 'Afvalbak binnenzetten', 'description', 'x', 'scheduled_date', current_date + 2,
        'due_at', now() + interval '3 days', 'waste_pickup_date', current_date + 2, 'waste_direction', 'in', 'waste_streams', jsonb_build_array('$bak'))),
    now())
    from public.households h join public.household_members m on m.household_id = h.id
    where h.name = 'Gelijk twee' and m.user_id = '60000000-0000-0000-0000-0000000000a5'"
}
race 60000000-0000-0000-0000-0000000000a5 60000000-0000-0000-0000-0000000000a5 \
  "$(afval_save 2511AB 0518200000000011 rest)" "$(afval_save 2512AB 0518200000000012 pmd)" eigenaar

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
  select count(*) into v_d from public.household_members where user_id = '60000000-0000-0000-0000-0000000000a4';
  if v_d <> 1 then
    raise exception 'ASSERT MISLUKT: BR-44 gelijktijdig: % lidmaatschappen na twee uitnodigingen tegelijk', v_d;
  end if;
  -- 6. afvaladres tegelijk opslaan (AC-191)
  select count(*) into v_t from public.waste_calendars w join public.households h on h.id = w.household_id where h.name = 'Gelijk twee';
  if v_t <> 1 then
    raise exception 'ASSERT MISLUKT: AC-191 gelijktijdig: % adressen na twee keer tegelijk opslaan', v_t;
  end if;
  select count(*) into v_t
  from public.tasks t join public.households h on h.id = t.household_id join public.waste_calendars w on w.household_id = h.id
  where h.name = 'Gelijk twee' and t.waste_direction is not null
    and t.waste_streams <> case when w.postcode = '2511AB' then array['rest'] else array['pmd'] end;
  if v_t <> 0 then
    raise exception 'ASSERT MISLUKT: AC-191 gelijktijdig: % afvaltaken van het andere adres', v_t;
  end if;
  select count(*) into v_t from public.tasks t join public.households h on h.id = t.household_id
  where h.name = 'Gelijk twee' and t.waste_direction is not null;
  if v_t <> 2 then
    raise exception 'ASSERT MISLUKT: AC-191 gelijktijdig: % afvaltaken (verwacht 2: één buiten, één binnen)', v_t;
  end if;
end;
$$;
\o
select 'Gelijktijdigheidstests geslaagd';
SQL
