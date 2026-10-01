#!/usr/bin/env bash
# Eenmalige voorbereiding van de lokale testomgeving (geen productie):
#  - PostgreSQL (16 of nieuwer) installeren als die ontbreekt en starten;
#  - rol "root" (superuser, alleen lokaal) voor supabase/tests/run.sh via de socket;
#  - Supabase Auth (GoTrue) als release-binary naar /opt/takenlijstje-gotrue.
# Idempotent: bestaande onderdelen worden hergebruikt. Schrijft niets in de repository.
set -euo pipefail

GOTRUE_DIR=${GOTRUE_DIR:-/opt/takenlijstje-gotrue}

echo "== PostgreSQL"
if ! command -v pg_ctlcluster >/dev/null 2>&1 && ! ls /usr/lib/postgresql/*/bin/postgres >/dev/null 2>&1; then
  echo "PostgreSQL ontbreekt; installeren via apt"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq postgresql postgresql-contrib >/dev/null
fi
PGVER=$(ls /usr/lib/postgresql | sort -V | tail -1)
echo "PostgreSQL-versie: $PGVER"
if command -v pg_lsclusters >/dev/null 2>&1; then
  if ! pg_lsclusters -h | grep -q .; then pg_createcluster "$PGVER" main >/dev/null; fi
  CLUSTER=$(pg_lsclusters -h | awk 'NR==1{print $1" "$2}')
  pg_ctlcluster $CLUSTER start 2>/dev/null || true
  pg_lsclusters
else
  service postgresql start
fi
for _ in $(seq 1 30); do su postgres -c "psql -Xqtc 'select 1'" >/dev/null 2>&1 && break; sleep 0.5; done
su postgres -c "psql -Xqtc 'select version()'"
su postgres -c "psql -Xq -c \"do \\\$\\\$ begin if not exists (select 1 from pg_roles where rolname='root') then create role root superuser login; end if; end \\\$\\\$\""
echo "rol root aanwezig"

echo "== Supabase Auth (GoTrue)"
if [[ -x "$GOTRUE_DIR/auth" && -d "$GOTRUE_DIR/migrations" ]]; then
  echo "al aanwezig: $GOTRUE_DIR"
else
  mkdir -p "$GOTRUE_DIR"
  # De GitHub-API is via de proxy van de ontwikkelomgeving niet bereikbaar (403);
  # de tag komt daarom uit de redirect van de gewone releasepagina.
  LATEST=$(curl -fsSL -o /dev/null -w '%{url_effective}' https://github.com/supabase/auth/releases/latest)
  TAG=${LATEST##*/}
  [[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "onverwachte tag: $TAG"; exit 1; }
  echo "release: $TAG"
  for NAME in "auth-$TAG-x86.tar.gz" "auth-$TAG-amd64.tar.gz" "gotrue-$TAG-x86.tar.gz"; do
    URL="https://github.com/supabase/auth/releases/download/$TAG/$NAME"
    if curl -fsSL "$URL" -o "$GOTRUE_DIR/auth.tar.gz"; then echo "download: $NAME"; break; fi
    rm -f "$GOTRUE_DIR/auth.tar.gz"
  done
  [[ -s "$GOTRUE_DIR/auth.tar.gz" ]] || { echo "geen x86-asset gevonden voor $TAG"; exit 1; }
  tar -xzf "$GOTRUE_DIR/auth.tar.gz" -C "$GOTRUE_DIR"
  BIN=$(find "$GOTRUE_DIR" -maxdepth 3 -type f \( -name auth -o -name gotrue \) | head -1)
  [[ -n "$BIN" ]] || { echo "binary niet gevonden"; ls -R "$GOTRUE_DIR" | head -50; exit 1; }
  [[ "$BIN" == "$GOTRUE_DIR/auth" ]] || cp "$BIN" "$GOTRUE_DIR/auth"
  chmod +x "$GOTRUE_DIR/auth"
  MIG=$(find "$GOTRUE_DIR" -maxdepth 3 -type d -name migrations | head -1)
  if [[ -z "$MIG" ]]; then
    echo "migraties niet in de release; ophalen uit bron $TAG"
    curl -fsSL "https://codeload.github.com/supabase/auth/tar.gz/refs/tags/$TAG" -o "$GOTRUE_DIR/src.tar.gz"
    mkdir -p "$GOTRUE_DIR/src" && tar -xzf "$GOTRUE_DIR/src.tar.gz" -C "$GOTRUE_DIR/src" --strip-components=1
    MIG="$GOTRUE_DIR/src/migrations"
  fi
  [[ "$MIG" == "$GOTRUE_DIR/migrations" ]] || cp -r "$MIG" "$GOTRUE_DIR/migrations"
  rm -f "$GOTRUE_DIR"/*.tar.gz
fi
"$GOTRUE_DIR/auth" version 2>/dev/null || "$GOTRUE_DIR/auth" --help 2>&1 | head -3 || true
echo "migraties: $(ls "$GOTRUE_DIR/migrations" | wc -l) bestanden"
echo "== KLAAR: PostgreSQL $PGVER, GoTrue in $GOTRUE_DIR"
