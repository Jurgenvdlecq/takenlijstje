#!/usr/bin/env bash
# Gelijktijdigheidstests WP2a (security-review WP2a "Doorgeven aan test-writer", D-037):
#  1. twee beheerders heffen tegelijk hun lidmaatschap op (delete_my_account)
#     → er blijft minstens één actieve beheerder over (BR-24);
#  2. dezelfde gebruiker maakt twee keer tegelijk een huishouden → één lidmaatschap (BR-44);
#  3. dezelfde gebruiker accepteert tegelijk twee uitnodigingen → één lidmaatschap (BR-44).
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
begin
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
end;
$$;
\o
select 'Gelijktijdigheidstests geslaagd';
SQL
