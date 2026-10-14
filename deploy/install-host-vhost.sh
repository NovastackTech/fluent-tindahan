#!/usr/bin/env bash
# Install/update the edge reverse proxy vhost for Fluent Tindahan on the SAS host.
# Supports both shared Novastack Caddy (container/host) and Nginx with Certbot.
# Expected env: PUBLIC_HOST, HOST_HTTP_PORT, SAS_APP_DIR, SAS_CERTBOT_EMAIL (optional)

set -euo pipefail

: "${PUBLIC_HOST:?PUBLIC_HOST required}"
: "${HOST_HTTP_PORT:?HOST_HTTP_PORT required}"
: "${SAS_APP_DIR:?SAS_APP_DIR required}"

FORCE_VHOST="${FORCE_VHOST:-0}"
for arg in "$@"; do
  if [[ "$arg" == "--force-vhost" ]]; then
    FORCE_VHOST=1
  fi
done

# -----------------------------------------------------------------------------
# 1. Check for Novastack shared Caddy setup (container or host)
# -----------------------------------------------------------------------------
CADDY_SITES_DIR="/opt/novastack-caddy/sites"
caddy_container="$(docker ps --format '{{.Names}} {{.Image}} {{.Ports}}' 2>/dev/null | awk '$2 ~ /caddy/ && /:(80|443)->/ {print $1; exit}' || true)"

if [[ -d "$CADDY_SITES_DIR" || -n "$caddy_container" ]]; then
  echo "[INFO] Detected Caddy ingress setup on SAS host..."
  mkdir -p "$CADDY_SITES_DIR"
  site_file="${CADDY_SITES_DIR}/${PUBLIC_HOST}.caddy"
  
  cat > "$site_file" <<EOF
# Fluent Tindahan (${PUBLIC_HOST}) -> 127.0.0.1:${HOST_HTTP_PORT}
${PUBLIC_HOST} {
    encode gzip
    reverse_proxy 127.0.0.1:${HOST_HTTP_PORT}
}
EOF

  if [[ -n "$caddy_container" ]]; then
    if docker exec "$caddy_container" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
      echo "[OK] Edge Caddy container ($caddy_container) reloaded: https://${PUBLIC_HOST} -> 127.0.0.1:${HOST_HTTP_PORT}"
      exit 0
    else
      echo "[WARN] Caddy container reload reported a warning. Site configuration saved to ${site_file}."
    fi
  elif command -v caddy >/dev/null 2>&1 && systemctl is-active --quiet caddy 2>/dev/null; then
    systemctl reload caddy || true
    echo "[OK] Host Caddy service reloaded: https://${PUBLIC_HOST} -> 127.0.0.1:${HOST_HTTP_PORT}"
    exit 0
  fi
fi

# -----------------------------------------------------------------------------
# 2. Host Nginx reverse proxy setup
# -----------------------------------------------------------------------------
if ! command -v nginx >/dev/null 2>&1; then
  echo "[WARN] Neither Caddy nor Nginx detected as active host reverse proxy."
  echo "       App is listening and healthy on 127.0.0.1:${HOST_HTTP_PORT}."
  exit 0
fi

TEMPLATE="${SAS_APP_DIR}/deploy/nginx/host-vhost.conf.template"
if [[ ! -f "$TEMPLATE" ]]; then
  echo "[ERROR] Missing template: $TEMPLATE" >&2
  exit 1
fi

# Determine sites directory (Debian/Ubuntu sites-available vs generic conf.d)
if [[ -d "/etc/nginx/sites-available" ]]; then
  mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled /var/www/html
  SITE_AVAILABLE="/etc/nginx/sites-available/${PUBLIC_HOST}"
  SITE_ENABLED="/etc/nginx/sites-enabled/${PUBLIC_HOST}"
else
  mkdir -p /etc/nginx/conf.d /var/www/html
  SITE_AVAILABLE="/etc/nginx/conf.d/${PUBLIC_HOST}.conf"
  SITE_ENABLED=""
fi

tmp="$(mktemp)"
sed \
  -e "s/{{PUBLIC_HOST}}/${PUBLIC_HOST}/g" \
  -e "s/{{HOST_HTTP_PORT}}/${HOST_HTTP_PORT}/g" \
  "$TEMPLATE" >"$tmp"

# Preserve certbot-managed 443 blocks if the site already has SSL configured
if [[ -f "$SITE_AVAILABLE" ]] && grep -q "listen 443" "$SITE_AVAILABLE" && [[ "$FORCE_VHOST" -ne 1 ]]; then
  echo "[INFO] Existing TLS server block detected in $SITE_AVAILABLE - refreshing proxy_pass port/host only."
  sed -i -E "s|proxy_pass http://127\.0\.0\.1:[0-9]+;|proxy_pass http://127.0.0.1:${HOST_HTTP_PORT};|g" "$SITE_AVAILABLE"
  rm -f "$tmp"
else
  if [[ "$FORCE_VHOST" -eq 1 ]]; then
    echo "[INFO] --force-vhost set: Overwriting edge vhost from template."
  fi
  install -m 0644 "$tmp" "$SITE_AVAILABLE"
  rm -f "$tmp"
fi

if [[ -n "$SITE_ENABLED" ]]; then
  ln -sfn "$SITE_AVAILABLE" "$SITE_ENABLED"
fi

# Check nginx configuration test
if ! nginx -t 2>/tmp/nginx_test.log; then
  echo "[WARN] nginx -t validation failed. Error details:" >&2
  cat /tmp/nginx_test.log >&2
  rm -f /tmp/nginx_test.log
  echo "[WARN] Edge nginx config left in $SITE_AVAILABLE for inspection. App remains active on :${HOST_HTTP_PORT}." >&2
  exit 0
fi
rm -f /tmp/nginx_test.log

# Reload or start nginx if active
if systemctl is-active --quiet nginx 2>/dev/null; then
  if systemctl reload nginx 2>/dev/null; then
    echo "[OK] Edge nginx vhost reloaded: http://${PUBLIC_HOST} -> 127.0.0.1:${HOST_HTTP_PORT}"
  else
    systemctl restart nginx || echo "[WARN] systemctl restart nginx failed."
  fi
else
  echo "[INFO] nginx service is not running. Attempting to start..."
  if systemctl start nginx 2>/dev/null; then
    echo "[OK] Started nginx service on host."
  else
    echo "[WARN] Could not start nginx (ports 80/443 may belong to Docker Caddy). App remains active on :${HOST_HTTP_PORT}."
    exit 0
  fi
fi

# -----------------------------------------------------------------------------
# 3. Issue / renew Let's Encrypt cert via certbot if nginx is serving 80/443
# -----------------------------------------------------------------------------
if command -v certbot >/dev/null 2>&1 && systemctl is-active --quiet nginx 2>/dev/null; then
  email_args=(--register-unsafely-without-email)
  if [[ -n "${SAS_CERTBOT_EMAIL:-}" ]]; then
    email_args=(-m "$SAS_CERTBOT_EMAIL")
  fi

  if [[ ! -d "/etc/letsencrypt/live/${PUBLIC_HOST}" ]]; then
    if ! getent ahostsv4 "$PUBLIC_HOST" >/dev/null 2>&1 && ! host "$PUBLIC_HOST" >/dev/null 2>&1; then
      echo "[WARN] DNS for ${PUBLIC_HOST} does not resolve to an IP yet (NXDOMAIN)."
      echo "       Add an A record pointing '${PUBLIC_HOST}' to this server's public IP in your DNS provider (e.g. Cloudflare)."
      echo "       HTTP vhost remains active on port 80. Certbot will automatically obtain the TLS certificate on your next deploy once DNS propagates."
      echo "[OK] Edge vhost setup completed."
      exit 0
    fi

    echo "[INFO] Requesting Let's Encrypt certificate for ${PUBLIC_HOST}..."
    certbot --nginx -d "$PUBLIC_HOST" --non-interactive --agree-tos --redirect "${email_args[@]}" || {
      echo "[WARN] certbot failed - HTTP vhost remains on port 80. Retry later once DNS/firewall are ready."
      exit 0
    }
  elif [[ "$FORCE_VHOST" -eq 1 ]] || ! grep -q "listen 443" "$SITE_AVAILABLE"; then
    echo "[INFO] Re-applying TLS block to refreshed vhost for ${PUBLIC_HOST} using existing cert..."
    certbot --nginx -d "$PUBLIC_HOST" --non-interactive --redirect "${email_args[@]}" || {
      echo "[WARN] certbot re-apply failed - HTTP vhost remains active."
      exit 0
    }
  else
    echo "[OK] TLS cert already present for ${PUBLIC_HOST}"
  fi
fi

echo "[OK] Edge vhost setup completed."
exit 0
