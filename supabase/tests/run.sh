#!/usr/bin/env bash
# Draait alle migraties + RLS/functietests op een lokale PostgreSQL.
# Gebruik: DATABASE_URL=postgres://... supabase/tests/run.sh
# (standaard: lokale socket als gebruiker postgres, database takenlijstje_test)
set -euo pipefail
cd "$(dirname "$0")/../.."

DB_NAME="${TEST_DB_NAME:-takenlijstje_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)
if [[ -n "${DATABASE_URL:-}" ]]; then
  ADMIN=("${PSQL[@]}" "$DATABASE_URL")
  TARGET=("${PSQL[@]}" "${DATABASE_URL%/*}/$DB_NAME")
else
  ADMIN=("${PSQL[@]}" -d postgres)
  TARGET=("${PSQL[@]}" -d "$DB_NAME")
fi

"${ADMIN[@]}" -c "drop database if exists $DB_NAME" -c "create database $DB_NAME"
"${TARGET[@]}" -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  echo "→ migratie $(basename "$f")"
  "${TARGET[@]}" -f "$f"
done
for f in supabase/tests/[1-9]*.sql; do
  echo "→ test $(basename "$f")"
  "${TARGET[@]}" -f "$f"
done

# Upgrade-test (AC-053, AC-179): oud schema (migraties vóór …_200) + oude
# gegevens, dan …_200 en verder, dan de controles.
UPG_NAME="${DB_NAME}_upgrade"
if [[ -n "${DATABASE_URL:-}" ]]; then
  UPG=("${PSQL[@]}" "${DATABASE_URL%/*}/$UPG_NAME")
else
  UPG=("${PSQL[@]}" -d "$UPG_NAME")
fi
"${ADMIN[@]}" -c "drop database if exists $UPG_NAME" -c "create database $UPG_NAME"
"${UPG[@]}" -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  [[ "$(basename "$f")" < "20260928000200" ]] && "${UPG[@]}" -f "$f" 2>/dev/null
done
echo "→ upgrade: oude gegevens"
"${UPG[@]}" -f supabase/tests/upgrade/voor_200.sql
for f in supabase/migrations/*.sql; do
  [[ "$(basename "$f")" < "20260928000200" ]] || { echo "→ upgrade: migratie $(basename "$f")"; "${UPG[@]}" -f "$f" 2>/dev/null; }
done
"${UPG[@]}" -f supabase/tests/upgrade/na_200.sql
"${ADMIN[@]}" -c "drop database if exists $UPG_NAME"

echo "✓ Alle databasetests geslaagd"

# Open bevindingen: tests die een bekende afwijking van het ontwerp aantonen.
# Ze draaien na de suite in de testdatabase; een falende bevinding maakt het
# resultaat rood, maar houdt de rest niet tegen. Na de fix verhuizen ze naar de suite.
OPEN=0
ERR="$(mktemp)"
for f in supabase/tests/bevindingen/*.sql; do
  [[ -e "$f" ]] || continue
  if "${TARGET[@]}" -f "$f" >/dev/null 2>"$ERR"; then
    echo "✓ bevinding opgelost: $(basename "$f") (verplaats naar de suite)"
  else
    OPEN=$((OPEN + 1))
    echo "✗ OPEN BEVINDING: $(basename "$f"): $(grep -m1 ERROR "$ERR")"
  fi
done
[[ $OPEN -eq 0 ]] || { echo "✗ $OPEN open bevinding(en)"; exit 1; }
