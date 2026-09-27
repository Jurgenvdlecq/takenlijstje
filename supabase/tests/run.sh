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
echo "✓ Alle databasetests geslaagd"
