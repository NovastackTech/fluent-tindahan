#!/usr/bin/env bash
#
# Build and (re)start Fluent Tindahan on the Alibaba Simple Application Server via Docker Compose.
#
# Usage (from the install dir, normally called by install.sh):
#   bash deploy/alibaba-sas/deploy.sh
#
# Options:
#   --no-cache   rebuild images without cache
#   --no-backup  skip the pre-deploy pg_dump snapshot
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${APP_DIR}/.env"
COMPOSE_FILE="${APP_DIR}/docker-compose.yml"
SAS_COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.sas.yml"

NO_CACHE=false
BACKUP=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-cache) NO_CACHE=true; shift ;;
    --no-backup) BACKUP=false; shift ;;
    -h|--help)
      sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

log() { printf '[sas-deploy] %s\n' "$*"; }
fail() { log "ERROR: $*"; exit 1; }

command -v docker >/dev/null 2>&1 || fail "Docker not found. Run: sudo bash deploy/alibaba-sas/setup-server.sh"
docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin required."
[[ -f "${COMPOSE_FILE}" ]] || fail "Missing ${COMPOSE_FILE}."
[[ -f "${ENV_FILE}" ]] || fail "Missing ${ENV_FILE} - run install.sh first."

cd "${APP_DIR}"
sed -i 's/\r$//' "${ENV_FILE}"

# Read values instead of sourcing: secrets may contain shell metacharacters. Compose parses the file itself.
env_value() { sed -n "s/^$1=//p" "${ENV_FILE}" | tail -n 1; }

PROJECT="$(env_value COMPOSE_PROJECT_NAME)"; PROJECT="${PROJECT:-fluent-tindahan}"
APP_PORT="$(env_value HOST_HTTP_PORT)"; APP_PORT="${APP_PORT:-8089}"
APP_URL="$(env_value APP_URL)"
ASPNETCORE_ENVIRONMENT="$(env_value ASPNETCORE_ENVIRONMENT)"
POSTGRES_DB="$(env_value POSTGRES_DB)"
POSTGRES_USER="$(env_value POSTGRES_USER)"
POSTGRES_PASSWORD="$(env_value POSTGRES_PASSWORD)"
PAYMONGO_SECRET_KEY="$(env_value PAYMONGO_SECRET_KEY)"
PAYMONGO_WEBHOOK_SECRET="$(env_value PAYMONGO_WEBHOOK_SECRET)"

compose() {
  docker compose -p "${PROJECT}" --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" -f "${SAS_COMPOSE_FILE}" "$@"
}

is_missing_or_mock() {
  [[ -z "$1" || "${1,,}" == "mock-secret" || "${1,,}" == mock_* ]]
}

[[ -n "${POSTGRES_PASSWORD:-}" ]] || fail "POSTGRES_PASSWORD is empty in ${ENV_FILE}"
if [[ "${ASPNETCORE_ENVIRONMENT:-Production}" != "Development" ]]; then
  missing=()
  is_missing_or_mock "${PAYMONGO_SECRET_KEY:-}" && missing+=(PAYMONGO_SECRET_KEY)
  is_missing_or_mock "${PAYMONGO_WEBHOOK_SECRET:-}" && missing+=(PAYMONGO_WEBHOOK_SECRET)
  if (( ${#missing[@]} )); then
    fail "The API refuses to start in ${ASPNETCORE_ENVIRONMENT:-Production} without ${missing[*]}. Set them in deploy/alibaba-sas/secrets.env on your machine and redeploy, or edit ${ENV_FILE} on the server."
  fi
fi

docker network inspect novastack-edge >/dev/null 2>&1 || docker network create novastack-edge >/dev/null

if [[ "${BACKUP}" == "true" ]] && compose ps --status running -q db 2>/dev/null | grep -q .; then
  mkdir -p "${APP_DIR}/backups"
  chmod 700 "${APP_DIR}/backups"
  snapshot="${APP_DIR}/backups/db_$(date +%Y%m%d_%H%M%S).sql.gz"
  log "Snapshotting database to ${snapshot}..."
  if compose exec -T db pg_dump -U "${POSTGRES_USER:-fluent}" "${POSTGRES_DB:-fluent_tindahan}" | gzip > "${snapshot}"; then
    chmod 600 "${snapshot}"
    log "Database snapshot complete."
  else
    rm -f "${snapshot}"
    fail "pg_dump failed; aborting before touching the running stack. Pass --no-backup to skip."
  fi
else
  log "Database not running (or --no-backup) - skipping pre-deploy snapshot."
fi

BUILD_ARGS=()
[[ "${NO_CACHE}" == "true" ]] && BUILD_ARGS+=(--no-cache)

log "Building images (this may take several minutes on SAS)..."
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
compose build "${BUILD_ARGS[@]+"${BUILD_ARGS[@]}"}"

log "Starting containers..."
compose up -d --remove-orphans

log "Waiting for http://127.0.0.1:${APP_PORT}/api/health ..."
ready=false
for _ in $(seq 1 40); do
  if curl -fsS --max-time 3 "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 3
done

compose ps

if [[ "${ready}" != "true" ]]; then
  compose logs --tail=100 api web >&2 || true
  fail "Health check did not pass on 127.0.0.1:${APP_PORT}/api/health."
fi

log ""
log "Deployment complete."
log "  Project: ${PROJECT}"
log "  Web UI:  ${APP_URL:-https://tindahan-dev.novastack-inc.online}"
log "  Health:  http://127.0.0.1:${APP_PORT}/api/health"
