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
"${T[@]}" -f supabase/tests/00_supabase_stub.sql
# Eerst het schema van vóór WP2a, dan de oude gegevens, dan pas expand (…_200):
# zo wordt ook de omzetting van bestaande gegevens beproefd (AC-053, AC-179)
for f in supabase/migrations/*.sql; do
  [[ "$(basename "$f")" > "20260928000110_zzz" ]] && continue
  "${T[@]}" -f "$f"
done
echo "→ schema tot en met WP1 (…_110) toegepast"
"${T[@]}" -f supabase/ops/m0/seed_oud.sql
echo "→ live-achtige testgegevens geladen"
for f in supabase/migrations/*.sql; do
  [[ "$(basename "$f")" > "20260928000110_zzz" ]] || continue
  # Alleen tot vóór het contract: M0 beproeft het draaiboek van WP2b, latere
  # migraties (WP3 en verder) horen niet in deze proef
  [[ "$(basename "$f")" < "20260928000210" ]] || continue
  "${T[@]}" -f "$f"
done
echo "→ expand (…_200) toegepast op de bestaande gegevens"
"${PSQL[@]}" -d "$DB" -At <<'SQL'
select 'AC-053 gezinsleden_met_meldingen_aan=' || count(*) from public.user_preferences p
join public.household_members m on m.id = p.member_id
where m.role = 'member' and (p.notify_reminders or p.notify_deadline_soon or p.notify_overdue
  or p.daily_summary_enabled or p.evening_summary_enabled or p.notify_task_completed);
select 'AC-053 beheerders_ongewijzigd=' || bool_and(p.notify_reminders and p.daily_summary_enabled) from public.user_preferences p
join public.household_members m on m.id = p.member_id where m.role = 'admin';
select 'AC-179 notities_zonder_schrijver=' || count(*) from public.task_comments where author_name is null;
select 'AC-179 schrijvers=' || string_agg(author_name, ',' order by author_name) from public.task_comments;
SQL

echo "── M1 voorcontroles ──"
sed "s/__DEPLOY_MOMENT__/2026-09-28T00:00:00Z/" supabase/ops/precheck_v2.sql | "${PSQL[@]}" -d "$DB" -P pager=off -f -

echo "── M3 back-up ──"
sub supabase/ops/backup_v2.sql | "${PSQL[@]}" -d "$DB" -P pager=off -f -

echo "── M4 restore-test ──"
sub supabase/ops/restore_check_v2.sql | "${PSQL[@]}" -d "$DB" -P pager=off -f - | tee /tmp/m0_restore_check.txt
if grep -q " f$" /tmp/m0_restore_check.txt; then echo "✗ restore-test wijkt af"; exit 1; fi

echo "── M6 contract ──"
"${T[@]}" -f supabase/migrations/20260928000210_scope_contract.sql
echo "→ contract (…_210) uitgevoerd in één transactie"
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
