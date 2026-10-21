#!/usr/bin/env bash
#
# Idempotent bootstrap for an Alibaba Cloud Simple Application Server (SAS).
# Installs Docker + Compose plugin when missing and adds swap on 1-2 GiB instances.
# The shared Novastack SAS already has Docker, so this is normally a no-op there.
#
set -euo pipefail

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

log() { printf '[sas-setup] %s\n' "$*"; }

ensure_swap() {
  local mem_mb current_swap_mb target_swap_mb=0
  mem_mb="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
  if [[ "${mem_mb}" -lt 4096 ]]; then
    target_swap_mb=4096
  fi

  current_swap_mb="$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)"
  if [[ "${target_swap_mb}" -eq 0 ]] || [[ "${current_swap_mb}" -ge $((target_swap_mb - 128)) ]]; then
    return
  fi

  log "Low memory (${mem_mb} MiB, current swap ${current_swap_mb} MiB). Configuring ${target_swap_mb} MiB swap..."
  swapoff /swapfile 2>/dev/null || true
  fallocate -l "${target_swap_mb}M" /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count="${target_swap_mb}" status=progress
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  log "Swap enabled (${target_swap_mb} MiB)."
}

install_docker_apt() {
  # shellcheck disable=SC1091
  . /etc/os-release
  local distro="${ID:-ubuntu}"
  local codename="${VERSION_CODENAME:-${UBUNTU_CODENAME:-jammy}}"

  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl --proto '=https' --proto-redir '=https' -fsSL "https://download.docker.com/linux/${distro}/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${distro} ${codename} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

install_docker_yum() {
  yum install -y yum-utils curl
  yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
  yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

ensure_swap

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  log "Docker ready: $(docker --version)"
  exit 0
fi

# shellcheck disable=SC1091
OS="$( . /etc/os-release 2>/dev/null && echo "${ID:-unknown}" || echo unknown)"
log "Installing Docker (detected OS: ${OS})..."
case "${OS}" in
  ubuntu|debian) install_docker_apt ;;
  alinux|centos|rhel|rocky|almalinux|anolis) install_docker_yum ;;
  *) log "Unsupported OS '${OS}'. Install Docker manually, then redeploy."; exit 1 ;;
esac

systemctl enable --now docker
log "Docker: $(docker --version)"
log "Compose: $(docker compose version)"
log "IMPORTANT: In the Alibaba SAS console -> Firewall, allow TCP 22, 80 and 443."
