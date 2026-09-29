#!/usr/bin/env bash
# Bouwt en start de app voor de E2E-tests, met de afvalkalender-stub als bron
# (WASTE_SOURCE_BASE_URL telt alleen voor http://127.0.0.1:<poort>, TD §18.1.2).
#
# Wordt gebruikt door playwright.config.ts (webServer) als E2E_START_APP=1.
# Met E2E_APP_DIR bouwt het script in een kopie van de repo (node_modules als
# harde links), zodat een al draaiende app in de werkmap ongemoeid blijft.
#
# Omgeving (standaard tussen haakjes):
#   E2E_APP_PORT (3100), E2E_GATEWAY_PORT (54321), E2E_WASTE_STUB_PORT (4599),
#   E2E_APP_DIR (leeg = in de werkmap bouwen), E2E_SKIP_BUILD=1 (niet opnieuw bouwen),
#   CRON_SECRET (test-cron-secret), JWT_SECRET (zoals local-stack.sh)
set -euo pipefail
cd "$(dirname "$0")/../../.."
REPO=$PWD

APP_PORT=${E2E_APP_PORT:-3100}
GATEWAY_PORT=${E2E_GATEWAY_PORT:-54321}
STUB_PORT=${E2E_WASTE_STUB_PORT:-4599}

if [[ -n "${E2E_APP_DIR:-}" ]]; then
  mkdir -p "$E2E_APP_DIR"
  # Broncode kopiëren (zonder build, git en node_modules); node_modules als harde links
  tar -C "$REPO" --exclude=./node_modules --exclude=./.next --exclude=./.git -cf - . | tar -C "$E2E_APP_DIR" -xf -
  if [[ ! -d "$E2E_APP_DIR/node_modules" ]]; then cp -al "$REPO/node_modules" "$E2E_APP_DIR/node_modules"; fi
  cd "$E2E_APP_DIR"
fi

eval "$(JWT_SECRET=${JWT_SECRET:-super-secret-jwt-token-with-at-least-32-characters-long} node "$REPO/tests/e2e/support/keys.mjs" | sed 's/^/export /')"
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:${GATEWAY_PORT}"
export NEXT_PUBLIC_SITE_URL="http://localhost:${APP_PORT}"
export CRON_SECRET=${CRON_SECRET:-test-cron-secret}
export WASTE_SOURCE_BASE_URL="http://127.0.0.1:${STUB_PORT}"

if [[ "${E2E_SKIP_BUILD:-}" != "1" ]]; then
  npx next build > /dev/null
fi
exec npx next start -p "$APP_PORT"
