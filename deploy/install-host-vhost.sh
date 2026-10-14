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

# Flags:
#   --force-vhost (or env FORCE_VHOST=1): Re-apply host vhost from template even if a TLS 443 block exists.

FORCE_VHOST="${FORCE_VHOST:-0}"
for arg in "$@"; do
  if [[ "$arg" == "--force-vhost" ]]; then
    FORCE_VHOST=1
  fi
done

tmp="$(mktemp)"
sed \
  -e "s/{{PUBLIC_HOST}}/${PUBLIC_HOST}/g" \
  -e "s/{{HOST_HTTP_PORT}}/${HOST_HTTP_PORT}/g" \
  "$TEMPLATE" >"$tmp"

# Preserve certbot-managed 443 blocks if the site already has SSL configured (unless --force-vhost is set).
# Note: When certbot adds the 443 block, subsequent template changes (client_max_body_size, proxy headers)
# are not auto-merged into the existing 443 block. Pass --force-vhost (or FORCE_VHOST=1) to overwrite
# the vhost from template; certbot will re-apply the 443 SSL block using the existing certificate.
if [[ -f "$SITE_AVAILABLE" ]] && grep -q "listen 443" "$SITE_AVAILABLE" && [[ "$FORCE_VHOST" -ne 1 ]]; then
  echo "[INFO] Existing TLS server block detected — refreshing proxy_pass port/host only."
  echo "       (To re-render template changes like headers/body size, pass --force-vhost or FORCE_VHOST=1)"
  # Update any proxy_pass to the app port and server_name occurrences carefully:
  # Replace proxy_pass targets that point at 127.0.0.1:*
  sed -i -E "s|proxy_pass http://127\.0\.0\.1:[0-9]+;|proxy_pass http://127.0.0.1:${HOST_HTTP_PORT};|g" "$SITE_AVAILABLE"
  # Ensure server_name includes our host (leave certbot structure intact)
  rm -f "$tmp"
else
  mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled /var/www/html

if [[ "$FORCE_VHOST" -eq 1 ]]; then
    echo "[INFO] --force-vhost set: Overwriting edge vhost from template."
  fi
  install -m 0644 "$tmp" "$SITE_AVAILABLE"
  rm -f "$tmp"
fi

ln -sfn "$SITE_AVAILABLE" "$SITE_ENABLED"
if ! nginx -t; then
  echo "[ERROR] nginx -t validation failed for ${SITE_AVAILABLE}." >&2
  exit 1
fi
systemctl reload nginx || systemctl restart nginx
echo "[OK] Edge vhost enabled: http://${PUBLIC_HOST} -> 127.0.0.1:${HOST_HTTP_PORT}"

# Issue / renew / re-apply Let's Encrypt cert when certbot is available
if command -v certbot >/dev/null 2>&1; then
  email_args=(--register-unsafely-without-email)
  if [[ -n "${SAS_CERTBOT_EMAIL:-}" ]]; then
    email_args=(-m "$SAS_CERTBOT_EMAIL")
  fi

  if [[ ! -d "/etc/letsencrypt/live/${PUBLIC_HOST}" ]]; then
    echo "[INFO] Requesting Let's Encrypt certificate for ${PUBLIC_HOST}..."
    certbot --nginx -d "$PUBLIC_HOST" --non-interactive --agree-tos --redirect "${email_args[@]}" || {
      echo "[WARN] certbot failed — HTTP vhost remains on port 80. Retry later once DNS/firewall are ready."
      exit 0
    }
  elif [[ "$FORCE_VHOST" -eq 1 ]] || ! grep -q "listen 443" "$SITE_AVAILABLE"; then
    echo "[INFO] Re-applying TLS block to refreshed vhost for ${PUBLIC_HOST} using existing cert..."
    certbot --nginx -d "$PUBLIC_HOST" --non-interactive --redirect "${email_args[@]}" || {
      echo "[WARN] certbot re-apply failed — HTTP vhost remains active."
      exit 0
    }
  else
    echo "[OK] TLS cert already present for ${PUBLIC_HOST}"
  fi
else
  echo "[WARN] certbot not found — configure TLS manually for https://${PUBLIC_HOST}"
fi
