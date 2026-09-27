#!/usr/bin/env bash
# Start een lokale "mini-Supabase" voor end-to-end tests zonder Docker:
#   PostgreSQL (lokaal) + Supabase Auth (GoTrue-binary) + REST-testgateway.
#
# Vereist: psql-toegang als postgres, GOTRUE_BIN (pad naar gecompileerde
# github.com/supabase/auth) en GOTRUE_MIGRATIONS (map met de auth-migraties).
# Gebruik: tests/e2e/support/local-stack.sh start|stop
set -euo pipefail
cd "$(dirname "$0")/../../.."

DB=takenlijstje_e2e
STATE=${E2E_STATE_DIR:-/tmp/takenlijstje-e2e}
JWT_SECRET=${JWT_SECRET:-super-secret-jwt-token-with-at-least-32-characters-long}
PGPASS=${PGPASSWORD:-postgres}
DB_URL="postgres://postgres:${PGPASS}@127.0.0.1:5432/${DB}?sslmode=disable"
mkdir -p "$STATE"

psql_admin() { su postgres -c "psql -v ON_ERROR_STOP=1 -q -X $*"; }

stop() {
  for name in gotrue gateway; do
    if [[ -f "$STATE/$name.pid" ]]; then kill "$(cat "$STATE/$name.pid")" 2>/dev/null || true; rm -f "$STATE/$name.pid"; fi
  done
}

start() {
  stop
  psql_admin "-d postgres -c \"alter user postgres password '${PGPASS}'\""
  psql_admin "-d postgres -c 'drop database if exists ${DB} with (force)' -c 'create database ${DB}'"
  psql_admin "-d ${DB}" <<'SQL'
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin; end if;
end $$;
create schema if not exists auth;
grant usage on schema auth, public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on functions to service_role;
SQL

  # Supabase Auth: eerst eigen migraties (schema "auth"), dan de server
  # Net als supabase_auth_admin in Supabase: zoekpad = auth
  AUTH_DB_URL="${DB_URL}&search_path=auth"
  export GOTRUE_DB_DRIVER=postgres DATABASE_URL="$AUTH_DB_URL" GOTRUE_DB_NAMESPACE=auth GOTRUE_DB_MIGRATIONS_PATH="$GOTRUE_MIGRATIONS"
  export GOTRUE_JWT_SECRET="$JWT_SECRET" API_EXTERNAL_URL=http://127.0.0.1:54321/auth/v1 GOTRUE_SITE_URL=http://localhost:3100
  "$GOTRUE_BIN" migrate > "$STATE/gotrue-migrate.log" 2>&1 || { tail -20 "$STATE/gotrue-migrate.log"; exit 1; }
  GOTRUE_DB_DRIVER=postgres DATABASE_URL="$AUTH_DB_URL" GOTRUE_DB_NAMESPACE=auth \
  GOTRUE_DB_MIGRATIONS_PATH="$GOTRUE_MIGRATIONS" \
  GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated \
  GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role \
  API_EXTERNAL_URL=http://127.0.0.1:54321/auth/v1 GOTRUE_SITE_URL=http://localhost:3100 \
  GOTRUE_URI_ALLOW_LIST="http://localhost:3100/**" \
  GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_DISABLE_SIGNUP=false \
  GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 GOTRUE_SMTP_ADMIN_EMAIL=test@example.com \
  GOTRUE_API_HOST=127.0.0.1 PORT=9999 GOTRUE_LOG_LEVEL=warn \
  nohup "$GOTRUE_BIN" > "$STATE/gotrue.log" 2>&1 &
  echo $! > "$STATE/gotrue.pid"

  for _ in $(seq 1 60); do
    curl -sf http://127.0.0.1:9999/health > /dev/null && break
    sleep 0.5
  done
  curl -sf http://127.0.0.1:9999/health > /dev/null || { echo "GoTrue start niet"; tail -20 "$STATE/gotrue.log"; exit 1; }

  # Tabellen/functies aanmaken als postgres; rechten zoals in Supabase
  psql_admin "-d ${DB} -c 'create publication supabase_realtime'"
  for f in supabase/migrations/*.sql; do
    su postgres -c "psql -v ON_ERROR_STOP=1 -q -X -d ${DB} -f $PWD/$f"
  done
  psql_admin "-d ${DB} -c 'grant all on all tables in schema public to service_role' -c 'grant all on all functions in schema public to service_role' -c 'grant usage on schema private to service_role' -c 'grant execute on all functions in schema private to service_role'"

  DATABASE_URL="$DB_URL" JWT_SECRET="$JWT_SECRET" GOTRUE_URL=http://127.0.0.1:9999 PORT=54321 \
    nohup node tests/e2e/support/rest-gateway.mjs > "$STATE/gateway.log" 2>&1 &
  echo $! > "$STATE/gateway.pid"
  for _ in $(seq 1 40); do
    curl -s http://127.0.0.1:54321/rest/v1/task_templates?select=id\&limit=1 > /dev/null && break
    sleep 0.25
  done
  echo "✓ Lokale stack draait (gateway http://127.0.0.1:54321)"
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
esac
