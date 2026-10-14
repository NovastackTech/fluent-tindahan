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

tar_path="$(mktemp -t fluent-deploy-XXXXXX.tgz)"
temp_env="${ROOT}/.env.remote.tmp"

cleanup() {
  rm -f "$tar_path" "$temp_env"
}
trap cleanup EXIT

echo "[INFO] Staging remote configuration..."
cat > "$temp_env" <<EOF
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
chmod 600 "$temp_env"

echo "[INFO] Packaging project files (tar.gz)..."
(
  cd "$ROOT"
  tar -czf "$tar_path" \
    --exclude=.git \
    --exclude=node_modules \
    --exclude=frontend/node_modules \
    --exclude=frontend/dist \
    --exclude=frontend/dev-dist \
    --exclude=frontend/coverage \
    --exclude="*/bin" \
    --exclude="*/obj" \
    --exclude="*TestResults*" \
    --exclude=.run \
    --exclude=tindahan \
    --exclude=.obsidian \
    --exclude="*.obsidian*" \
    --exclude=deploy/alibaba-sas.env \
    --exclude=docker-compose.override.yml \
    --exclude=.env \
    --exclude=backups \
    .
)

remote_cmd="set -euo pipefail; mkdir -p '${SAS_APP_DIR}'; cat > /tmp/fluent-deploy.tgz; tar -xzf /tmp/fluent-deploy.tgz -C '${SAS_APP_DIR}'; rm -f /tmp/fluent-deploy.tgz; chmod +x '${SAS_APP_DIR}/deploy/'*.sh 2>/dev/null || true; cd '${SAS_APP_DIR}' && bash deploy/remote-deploy.sh '${SAS_APP_DIR}' '${HOST_HTTP_PORT}' '${PUBLIC_HOST}' '${PUBLIC_ORIGIN}' '${SAS_CERTBOT_EMAIL:-}' '${BOOTSTRAP}' '${FORCE_VHOST}'"

echo "[INFO] Connecting via single SSH session (enter password once)..."
echo "  Target: ${SAS_USER}@${SAS_HOST}"
ssh "${SSH_OPTS[@]}" "${SAS_USER}@${SAS_HOST}" "$remote_cmd" < "$tar_path"

echo ""
echo "=========================================================="
echo "  Deploy complete"
echo "  - Public:  ${PUBLIC_ORIGIN}"
echo "  - Health:  ${PUBLIC_ORIGIN}/api/health"
echo "  Reminder: SAS Firewall must allow TCP 80/443 (edge nginx)."
echo "=========================================================="
