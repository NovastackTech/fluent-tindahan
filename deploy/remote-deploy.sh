#!/usr/bin/env bash
# Remote deploy runner for Fluent Tindahan on Alibaba Cloud SAS.
# Executed on the remote server inside the single SSH session.

set -euo pipefail

SAS_APP_DIR="${1:-/opt/fluent-tindahan}"
HOST_HTTP_PORT="${2:-8089}"
PUBLIC_HOST="${3:-tindahan-dev.novastack-inc.online}"
PUBLIC_ORIGIN="${4:-https://${PUBLIC_HOST}}"
SAS_CERTBOT_EMAIL="${5:-}"
BOOTSTRAP="${6:-0}"
FORCE_VHOST="${7:-0}"

cd "${SAS_APP_DIR}"

# 1. Promote temporary .env to .env with strict permissions
umask 077
if [[ -f .env.remote.tmp ]]; then
  mv -f .env.remote.tmp .env
fi
if [[ -f .env ]]; then
  chmod 600 .env
fi

# 2. Bootstrap Docker if requested
if [[ "${BOOTSTRAP}" == "1" ]]; then
  echo "[INFO] Bootstrapping Docker on SAS..."
  bash deploy/remote-bootstrap.sh
fi

# 3. Check Docker
if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] Docker not found on host. Re-run deploy with -Bootstrap." >&2
  exit 1
fi

# 4. Snapshot database if running
echo "[INFO] Checking for running database to snapshot..."
if docker compose -f docker-compose.yml ps --status running -q db 2>/dev/null | grep -q .; then
  mkdir -p backups
  ts=$(date +%Y%m%d_%H%M%S)
  db_user="$(grep -E '^POSTGRES_USER=' .env 2>/dev/null | cut -d= -f2- | tr -d '\r\n ' || echo 'fluent')"
  db_name="$(grep -E '^POSTGRES_DB=' .env 2>/dev/null | cut -d= -f2- | tr -d '\r\n ' || echo 'fluent_tindahan')"
  db_user="${db_user:-fluent}"
  db_name="${db_name:-fluent_tindahan}"
  echo "[INFO] Snapshotting database to backups/db_${ts}.sql.gz..."
  if docker compose -f docker-compose.yml exec -T db pg_dump -U "$db_user" "$db_name" | gzip > "backups/db_${ts}.sql.gz"; then
    echo "[OK] Database snapshot complete: backups/db_${ts}.sql.gz"
  else
    echo "[WARN] Database snapshot failed or skipped."
  fi
else
  echo "[INFO] Database not running yet - skipping pre-deploy backup."
fi

# 5. Build and start stack on SAS
echo "[INFO] Building and starting stack on SAS..."
docker compose -f docker-compose.yml --env-file .env up -d --build --remove-orphans

# 6. Health check loop
echo "[INFO] Waiting for health on host port ${HOST_HTTP_PORT}..."
healthy=0
for i in $(seq 1 36); do
  if curl -fsS --max-time 3 "http://127.0.0.1:${HOST_HTTP_PORT}/api/health" >/dev/null 2>&1; then
    healthy=1
    echo "[OK] Health check passed on :${HOST_HTTP_PORT}."
    break
  fi
  sleep 5
done

if [[ "$healthy" -ne 1 ]]; then
  echo "[ERROR] Health check timed out on http://127.0.0.1:${HOST_HTTP_PORT}/api/health" >&2
  echo "[INFO] Last container logs:" >&2
  docker compose -f docker-compose.yml logs --tail=100 >&2
  exit 1
fi

# 7. Configure edge reverse proxy / vhost
echo "[INFO] Configuring edge nginx vhost for ${PUBLIC_HOST} -> 127.0.0.1:${HOST_HTTP_PORT}..."
vhost_args=()
if [[ "${FORCE_VHOST}" == "1" ]]; then
  vhost_args+=(--force-vhost)
fi

PUBLIC_HOST="${PUBLIC_HOST}" \
HOST_HTTP_PORT="${HOST_HTTP_PORT}" \
SAS_APP_DIR="${SAS_APP_DIR}" \
SAS_CERTBOT_EMAIL="${SAS_CERTBOT_EMAIL}" \
bash deploy/install-host-vhost.sh "${vhost_args[@]}" || {
  echo "[WARN] Edge vhost configuration exited with warning/error." >&2
  echo "[WARN] Container stack is running on 127.0.0.1:${HOST_HTTP_PORT}." >&2
}

echo ""
echo "=========================================================="
echo "  Deploy complete"
echo "  - Public:  ${PUBLIC_ORIGIN}"
echo "  - Health:  ${PUBLIC_ORIGIN}/api/health"
echo "  Reminder: SAS Firewall must allow TCP 80/443 (edge nginx)."
echo "=========================================================="
