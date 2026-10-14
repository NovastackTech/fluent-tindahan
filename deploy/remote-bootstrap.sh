#!/usr/bin/env bash
# Idempotent Docker + Compose install for Ubuntu/Debian Alibaba SAS instances.
# Invoked by: ./deploy-alibaba-sas.sh --bootstrap

set -euo pipefail

if command -v docker >/dev/null 2>&1; then
  echo "[OK] Docker already installed: $(docker --version)"
  docker compose version >/dev/null 2>&1 || true
  exit 0
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "[ERROR] Bootstrap must run as root on the SAS instance." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

if command -v apt-get >/dev/null 2>&1; then
  # Detect ubuntu/debian codename; fall back to jammy for SAS Ubuntu 22.04 images
  if [[ -f /etc/os-release ]]; then
    . /etc/os-release
  fi
  ID="${ID:-ubuntu}"
  CODENAME="${VERSION_CODENAME:-jammy}"
  ARCH="$(dpkg --print-architecture)"

  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
    curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
  fi

  echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${CODENAME} stable" \
    >/etc/apt/sources.list.d/docker.list

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  echo "[OK] Docker installed: $(docker --version)"
  exit 0
fi

echo "[ERROR] Unsupported OS for automatic bootstrap. Install Docker manually, or recreate the SAS instance from the Docker application image." >&2
exit 1
