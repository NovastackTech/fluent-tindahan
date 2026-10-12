#!/usr/bin/env bash
# Install/update the edge nginx vhost for Fluent Tindahan on the SAS host.
# Expected env: PUBLIC_HOST, HOST_HTTP_PORT, SAS_APP_DIR, SAS_CERTBOT_EMAIL (optional)

set -euo pipefail

: "${PUBLIC_HOST:?PUBLIC_HOST required}"
: "${HOST_HTTP_PORT:?HOST_HTTP_PORT required}"
: "${SAS_APP_DIR:?SAS_APP_DIR required}"

TEMPLATE="${SAS_APP_DIR}/deploy/nginx/host-vhost.conf.template"
SITE_AVAILABLE="/etc/nginx/sites-available/${PUBLIC_HOST}"
SITE_ENABLED="/etc/nginx/sites-enabled/${PUBLIC_HOST}"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "[ERROR] Missing template: $TEMPLATE" >&2
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "[WARN] nginx not installed on host — skipping edge vhost (app still on :${HOST_HTTP_PORT})."
  exit 0
fi

tmp="$(mktemp)"
sed \
  -e "s/{{PUBLIC_HOST}}/${PUBLIC_HOST}/g" \
  -e "s/{{HOST_HTTP_PORT}}/${HOST_HTTP_PORT}/g" \
  "$TEMPLATE" >"$tmp"

# Preserve certbot-managed 443 blocks if the site already has SSL configured
if [[ -f "$SITE_AVAILABLE" ]] && grep -q "listen 443" "$SITE_AVAILABLE"; then
  echo "[INFO] Existing TLS server block detected — refreshing proxy_pass port/host only."
  # Update any proxy_pass to the app port and server_name occurrences carefully:
  # Replace proxy_pass targets that point at 127.0.0.1:*
  sed -i -E "s|proxy_pass http://127\.0\.0\.1:[0-9]+;|proxy_pass http://127.0.0.1:${HOST_HTTP_PORT};|g" "$SITE_AVAILABLE"
  # Ensure server_name includes our host (leave certbot structure intact)
  rm -f "$tmp"
else
  install -m 0644 "$tmp" "$SITE_AVAILABLE"
  rm -f "$tmp"
fi

ln -sfn "$SITE_AVAILABLE" "$SITE_ENABLED"
nginx -t
systemctl reload nginx
echo "[OK] Edge vhost enabled: http://${PUBLIC_HOST} → 127.0.0.1:${HOST_HTTP_PORT}"

# Issue / renew Let's Encrypt cert when certbot is available and cert is missing
if command -v certbot >/dev/null 2>&1; then
  if [[ ! -d "/etc/letsencrypt/live/${PUBLIC_HOST}" ]]; then
    email_args=(--register-unsafely-without-email)
    if [[ -n "${SAS_CERTBOT_EMAIL:-}" ]]; then
      email_args=(-m "$SAS_CERTBOT_EMAIL")
    fi
    echo "[INFO] Requesting Let's Encrypt certificate for ${PUBLIC_HOST}..."
    certbot --nginx -d "$PUBLIC_HOST" --non-interactive --agree-tos --redirect "${email_args[@]}" || {
      echo "[WARN] certbot failed — HTTP vhost remains on port 80. Retry later once DNS/firewall are ready."
      exit 0
    }
  else
    echo "[OK] TLS cert already present for ${PUBLIC_HOST}"
  fi
else
  echo "[WARN] certbot not found — configure TLS manually for https://${PUBLIC_HOST}"
fi
