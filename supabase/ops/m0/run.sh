#!/usr/bin/env bash
# M0 — proef van het draaiboek in een sandbox (TECHNICAL_DESIGN §12.4; AC-057, AC-060)
#   oud schema + live-achtige data → back-up → restore-test → contract (…_210)
#   → privacycontrole → terugzetten (restore_v2) → vergelijken met de back-up
# Gebruik: su postgres -c "cd /home/user/takenlijstje && bash supabase/ops/m0/run.sh"
set -euo pipefail
cd "$(dirname "$0")/../../.."

DB=takenlijstje_m0
BK=backup_v2_m0
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)
T=("${PSQL[@]}" -d "$DB")
sub() { sed "s/__BACKUP__/$BK/g" "$1"; }

psql -q -X -d postgres -c "drop database if exists $DB" -c "create database $DB"
"${T[@]}" -f supabase/tests/00_supabase_stub.sql 2>/dev/null
for f in supabase/migrations/*.sql; do "${T[@]}" -f "$f" 2>/dev/null; done
echo "→ schema tot en met expand toegepast"
"${T[@]}" -f supabase/ops/m0/seed_oud.sql
echo "→ live-achtige testgegevens geladen"

echo "── M1 voorcontroles ──"
sed "s/__DEPLOY_MOMENT__/2026-09-28T00:00:00Z/" supabase/ops/precheck_v2.sql | "${PSQL[@]}" -d "$DB" -P pager=off -f -

echo "── M3 back-up ──"
sub supabase/ops/backup_v2.sql | "${PSQL[@]}" -d "$DB" -P pager=off -f -

echo "── M4 restore-test ──"
sub supabase/ops/restore_check_v2.sql | "${PSQL[@]}" -d "$DB" -P pager=off -f - | tee /tmp/m0_restore_check.txt
if grep -q " f$" /tmp/m0_restore_check.txt; then echo "✗ restore-test wijkt af"; exit 1; fi

echo "── M6 contract ──"
"${T[@]}" -f supabase/ops/wp2b/20260928000210_scope_contract.sql
"${PSQL[@]}" -d "$DB" -P pager=off -At <<'SQL'
select 'privacy_kolommen=' || count(*) from information_schema.columns
where table_schema = 'public' and table_name in ('tasks', 'task_completions', 'shopping_items')
  and (column_name like 'completed_by%' or column_name = 'member_id' or column_name like 'added_by%' or column_name like 'bought_by%');
select 'meldingen_met_naam=' || count(*) from public.notifications
where title ilike '%gedaan door%' or body ilike '%voor jou%' or body ilike '%van jou%';
select 'historie=' || count(*) from public.task_completions;
select 'leden_zonder_account=' || count(*) from public.household_members where user_id is null;
select 'notities_zonder_schrijver=' || count(*) from public.task_comments where author_name is null;
SQL

echo "── Terugzetten (restore_v2) ──"
sub supabase/ops/restore_v2.sql | "${PSQL[@]}" -d "$DB" -f -
sub supabase/ops/m0/vergelijk.sql | "${PSQL[@]}" -d "$DB" -P pager=off -f - | tee /tmp/m0_vergelijk.txt
grep -q "M0-VERGELIJKING: IDENTIEK" /tmp/m0_vergelijk.txt || { echo "✗ terugzetten niet identiek"; exit 1; }
echo "✓ M0 geslaagd: back-up, restore-test, contract en terugzetten kloppen"
