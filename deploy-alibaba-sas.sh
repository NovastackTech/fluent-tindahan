#!/usr/bin/env bash
# Fluent Tindahan — deploy to Alibaba Cloud Simple Application Server (SAS)
# Novastack standard remote deploy via SSH + Docker Compose.
#
# Prerequisites on your machine: ssh, rsync, bash
# Prerequisites on SAS: Docker Engine + Compose plugin (Docker app image is fine)
#
# Setup:
#   cp deploy/alibaba-sas.env.example deploy/alibaba-sas.env
#   # edit deploy/alibaba-sas.env
#   ./deploy-alibaba-sas.sh
#
# Flags:
#   --skip-sync    Only restart/rebuild on the remote (no rsync)
#   --bootstrap    Install Docker on a fresh Ubuntu/Debian SAS if missing
#   --force-vhost  Re-render edge nginx vhost from template and re-apply TLS

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT/deploy/alibaba-sas.env"
SKIP_SYNC=0
BOOTSTRAP=0
FORCE_VHOST=0

for arg in "$@"; do
  case "$arg" in
    --skip-sync) SKIP_SYNC=1 ;;
    --bootstrap) BOOTSTRAP=1 ;;
    --force-vhost) FORCE_VHOST=1 ;;
    --help|-h)
      sed -n '2,17p' "$0"
      exit 0
      ;;
    *)
      echo "[ERROR] Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[ERROR] Missing $ENV_FILE" >&2
  echo "        cp deploy/alibaba-sas.env.example deploy/alibaba-sas.env && edit it." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

: "${SAS_HOST:?SAS_HOST is required in deploy/alibaba-sas.env}"
: "${SAS_USER:=root}"
: "${SAS_PORT:=22}"
: "${SAS_APP_DIR:=/opt/fluent-tindahan}"
: "${PUBLIC_HOST:=tindahan-dev.novastack-inc.online}"
: "${PUBLIC_ORIGIN:=https://${PUBLIC_HOST}}"
# Unique port on shared Novastack SAS (8086–8088, 8090 occupied)
: "${HOST_HTTP_PORT:=8089}"
: "${POSTGRES_DB:=fluent_tindahan}"
: "${POSTGRES_USER:=fluent}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${ASPNETCORE_ENVIRONMENT:=Production}"
: "${FIREBASE_PROJECT_ID:=fluent-tindahan-dev}"
: "${PAYMONGO_SECRET_KEY:?PAYMONGO_SECRET_KEY is required for Production}"
: "${PAYMONGO_WEBHOOK_SECRET:?PAYMONGO_WEBHOOK_SECRET is required for Production}"
: "${PAYMONGO_FRONTEND_ORIGIN:=${PUBLIC_ORIGIN}}"

SSH_OPTS=(-p "$SAS_PORT" -o StrictHostKeyChecking=accept-new)
if [[ -n "${SAS_SSH_KEY:-}" ]]; then
  SSH_OPTS+=(-i "$SAS_SSH_KEY")
fi

ssh_cmd() {
  ssh "${SSH_OPTS[@]}" "${SAS_USER}@${SAS_HOST}" "$@"
}

rsync_ssh() {
  local rsh="ssh -p ${SAS_PORT}"
  if [[ -n "${SAS_SSH_KEY:-}" ]]; then
    rsh="ssh -p ${SAS_PORT} -i ${SAS_SSH_KEY}"
  fi
  rsync -az --delete \
    --exclude '.git/' \
    --exclude 'node_modules/' \
    --exclude 'frontend/node_modules/' \
    --exclude 'frontend/dist/' \
    --exclude 'frontend/dev-dist/' \
    --exclude 'frontend/coverage/' \
    --exclude 'backend/**/bin/' \
    --exclude 'backend/**/obj/' \
    --exclude 'backend/**/TestResults/' \
    --exclude '.run/' \
    --exclude 'tindahan/' \
    --exclude '.obsidian/' \
    --exclude 'deploy/alibaba-sas.env' \
    --exclude 'docker-compose.override.yml' \
    --exclude '.env' \
    --exclude 'backups/' \
    -e "$rsh" \
    "$@"
}

echo "=========================================================="
echo "  Fluent Tindahan — deploy-alibaba-sas"
echo "  Target: ${SAS_USER}@${SAS_HOST}:${SAS_PORT}"
echo "  Public: ${PUBLIC_ORIGIN}  (host port ${HOST_HTTP_PORT})"
echo "  App dir: ${SAS_APP_DIR}"
echo "=========================================================="

echo "[INFO] Ensuring remote app directory exists..."
ssh_cmd "mkdir -p '${SAS_APP_DIR}'"

if [[ "$BOOTSTRAP" -eq 1 ]]; then
  echo "[INFO] Bootstrapping Docker on SAS (Ubuntu/Debian) if missing..."
  ssh_cmd 'bash -s' <"$ROOT/deploy/remote-bootstrap.sh"
fi

if ! ssh_cmd "command -v docker >/dev/null 2>&1"; then
  echo "[ERROR] Docker not found on ${SAS_HOST}." >&2
  echo "        Re-run with --bootstrap, or install the Docker SAS application image." >&2
  exit 1
fi

if [[ "$SKIP_SYNC" -eq 0 ]]; then
  echo "[INFO] Syncing project files to SAS..."
  rsync_ssh "$ROOT/" "${SAS_USER}@${SAS_HOST}:${SAS_APP_DIR}/"
else
  echo "[INFO] Skipping rsync (--skip-sync)"
fi

echo "[INFO] Writing remote .env (umask 077, 0600)..."
# shellcheck disable=SC2087
ssh_cmd "umask 077 && cat > '${SAS_APP_DIR}/.env' && chmod 600 '${SAS_APP_DIR}/.env'" <<EOF
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
ASPNETCORE_ENVIRONMENT=${ASPNETCORE_ENVIRONMENT}
FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}
PAYMONGO_SECRET_KEY=${PAYMONGO_SECRET_KEY}
PAYMONGO_WEBHOOK_SECRET=${PAYMONGO_WEBHOOK_SECRET}
PAYMONGO_FRONTEND_ORIGIN=${PAYMONGO_FRONTEND_ORIGIN}
HOST_HTTP_PORT=${HOST_HTTP_PORT}
EOF

echo "[INFO] Checking for running database to snapshot..."
ssh_cmd "cd '${SAS_APP_DIR}' && if docker compose -f docker-compose.yml ps --status running -q db 2>/dev/null | grep -q .; then mkdir -p backups && ts=\$(date +%Y%m%d_%H%M%S) && echo \"[INFO] Snapshotting database to backups/db_\${ts}.sql.gz...\" && docker compose -f docker-compose.yml exec -T db pg_dump -U \"\${POSTGRES_USER:-fluent}\" \"\${POSTGRES_DB:-fluent_tindahan}\" | gzip > \"backups/db_\${ts}.sql.gz\" && echo \"[OK] Database snapshot complete.\" || echo \"[WARN] Database snapshot failed or skipped.\"; else echo \"[INFO] Database not running yet — skipping pre-deploy backup.\"; fi"

echo "[INFO] Building and starting stack on SAS (compose file only — no local overrides)..."
ssh_cmd "cd '${SAS_APP_DIR}' && docker compose -f docker-compose.yml --env-file .env up -d --build --remove-orphans"

echo "[INFO] Waiting for health on host port ${HOST_HTTP_PORT}..."
for i in $(seq 1 36); do
  if ssh_cmd "curl -fsS --max-time 3 http://127.0.0.1:${HOST_HTTP_PORT}/api/health >/dev/null 2>&1"; then
    echo "[OK] Health check passed on :${HOST_HTTP_PORT}."
    break
  fi
  if [[ "$i" -eq 36 ]]; then
    echo "[ERROR] Health check timed out. Inspect: ssh ${SAS_USER}@${SAS_HOST} 'cd ${SAS_APP_DIR} && docker compose -f docker-compose.yml logs --tail=200'" >&2
    exit 1
  fi
  sleep 5
done

vhost_args=""
if [[ "$FORCE_VHOST" -eq 1 ]]; then
  vhost_args="--force-vhost"
fi
ssh_cmd "PUBLIC_HOST='${PUBLIC_HOST}' HOST_HTTP_PORT='${HOST_HTTP_PORT}' SAS_APP_DIR='${SAS_APP_DIR}' SAS_CERTBOT_EMAIL='${SAS_CERTBOT_EMAIL:-}' bash '${SAS_APP_DIR}/deploy/install-host-vhost.sh' ${vhost_args}"

echo ""
echo "=========================================================="
echo "  Deploy complete"
echo "  - Public:  ${PUBLIC_ORIGIN}"
echo "  - Health:  ${PUBLIC_ORIGIN}/api/health"
echo "  Reminder: SAS Firewall must allow TCP 80/443 (edge nginx)."
echo "=========================================================="
