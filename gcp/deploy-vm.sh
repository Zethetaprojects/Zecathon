#!/usr/bin/env bash
# ZECKATHON — Self-hosted VM deployment for GCP (no gcloud CLI required).
#
# Designed to be run inside a GCP Compute Engine VM via the browser SSH terminal.
# Uses:
#   - Docker for PostgreSQL and the backend (gunicorn + uvicorn workers)
#   - systemd to keep the stack alive
#   - host nginx for SSL and static frontend hosting
#
# What you need before running this:
#   1. A GCP Compute Engine VM (Ubuntu 22.04/24.04 or Debian 12, e2-medium or larger)
#      with a boot disk of at least 30 GB. 10 GB fills up with Docker images and caches.
#   2. Firewall rules in the GCP Console allowing TCP 80 and 443 to the VM.
#   3. (Optional) A DNS A record pointing a domain to the VM's external IP. If you don't
#      provide one, the script detects the VM's external IP and uses a self-signed certificate.
#
# Usage (first install):
#   sudo ./gcp/deploy-vm.sh
#
# Re-running is safe: secrets are stored once in /etc/zecathon/zecathon.env and reused,
# so the database password never changes. For routine code updates use gcp/update-vm.sh.
#
# Non-interactive use: preset DOMAIN, EMAIL, GEMINI_API_KEY, GITHUB_TOKEN in the environment
# (sudo -E) to skip their prompts.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=gcp/lib-vm.sh
source "${SCRIPT_DIR}/lib-vm.sh"

REPO_URL="https://github.com/Zethetaprojects/Zecathon.git"
DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
GEMINI_API_KEY="${GEMINI_API_KEY:-}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

# Ask for a value unless it is already set. Uses printf -v instead of eval so
# input can never be executed as shell code.
prompt() {
  local var_name="$1"
  local prompt_text="$2"
  local current_value="${!var_name:-}"
  if [[ -z "$current_value" ]]; then
    read -rp "$prompt_text" current_value
    printf -v "$var_name" '%s' "$current_value"
  fi
}

is_ip() {
  [[ "$1" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]
}

detect_external_ip() {
  local ip=""
  # Try GCP metadata service first
  ip=$(curl -fsS -m 5 -H "Metadata-Flavor: Google" \
    http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip 2>/dev/null || true)
  # Fallback to public IP discovery services
  if [[ -z "$ip" ]]; then
    ip=$(curl -fsS -m 5 https://ifconfig.me 2>/dev/null || true)
  fi
  if [[ -z "$ip" ]]; then
    ip=$(curl -fsS -m 5 https://api.ipify.org 2>/dev/null || true)
  fi
  if is_ip "$ip"; then
    echo "$ip"
  fi
}

write_self_signed_cert() {
  mkdir -p /etc/nginx/ssl
  # Keep an existing certificate so browsers that already accepted it keep working.
  if [[ ! -f /etc/nginx/ssl/zecathon.crt ]]; then
    openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/zecathon.key \
      -out /etc/nginx/ssl/zecathon.crt \
      -subj "/CN=${DOMAIN}"
  fi
  sed -i '/listen 80;/a\    listen 443 ssl;\n    ssl_certificate /etc/nginx/ssl/zecathon.crt;\n    ssl_certificate_key /etc/nginx/ssl/zecathon.key;' /etc/nginx/sites-available/zecathon
  nginx -t && systemctl reload nginx
}

# -----------------------------------------------------------------------------
# Preflight
# -----------------------------------------------------------------------------
log_info "ZECKATHON VM deployment starting..."
require_root

if [[ -d "$APP_DIR" ]]; then
  log_warn "${APP_DIR} already exists. The script will update the code and redeploy, keeping existing secrets."
fi

if [[ -z "$DOMAIN" ]]; then
  log_info "Detecting VM external IP address..."
  DETECTED_IP=$(detect_external_ip)
  if [[ -n "$DETECTED_IP" ]]; then
    DOMAIN="$DETECTED_IP"
    log_ok "Detected external IP: ${DOMAIN}"
  fi
fi

if [[ -z "$DOMAIN" ]]; then
  prompt DOMAIN "External IP could not be detected. Enter domain or IP (e.g. zeckathon.example.com or 34.123.45.67): "
fi

if [[ -z "$DOMAIN" ]]; then
  log_error "A domain or IP address is required."
  exit 1
fi
if ! [[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]]; then
  log_error "Invalid domain or IP: ${DOMAIN}"
  exit 1
fi

USE_IP=false
if is_ip "$DOMAIN"; then
  USE_IP=true
  log_info "Using IP address ${DOMAIN}. Only a self-signed certificate is possible."
fi

if [[ "$USE_IP" != true ]]; then
  prompt EMAIL "Email address for Let's Encrypt SSL (press Enter for self-signed): "
fi
if [[ -z "$EMAIL" ]]; then
  log_warn "No email provided; SSL certificate will use a self-signed fallback."
fi

# Reuse saved optional keys on re-runs instead of prompting again.
GEMINI_API_KEY="${GEMINI_API_KEY:-$(env_get GEMINI_API_KEY)}"
GITHUB_TOKEN="${GITHUB_TOKEN:-$(env_get GITHUB_TOKEN)}"
prompt GEMINI_API_KEY "Gemini API key from aistudio.google.com/apikey (starts with AQ.; press Enter to skip): "
prompt GITHUB_TOKEN "GitHub token (optional, press Enter to skip): "

# -----------------------------------------------------------------------------
# 1. Install system dependencies
# -----------------------------------------------------------------------------
log_info "Updating packages and installing dependencies..."
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  curl \
  ca-certificates \
  gnupg \
  lsb-release \
  git \
  nginx \
  certbot \
  python3-certbot-nginx \
  openssl \
  xz-utils

# Install Node.js 20 LTS from the official binary distribution.
# This works on both Debian and Ubuntu and avoids distro-specific package names.
if ! command -v node >/dev/null 2>&1; then
  log_info "Installing Node.js 20..."
  NODE_VERSION="20.18.0"
  NODE_ARCH="linux-x64"
  TMP_NODE_DIR=$(mktemp -d)
  curl -fsS "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-${NODE_ARCH}.tar.xz" -o "${TMP_NODE_DIR}/node.tar.xz"
  tar -xJf "${TMP_NODE_DIR}/node.tar.xz" -C /usr/local --strip-components=1
  rm -rf "$TMP_NODE_DIR"
  log_ok "Node.js $(node --version) installed."
fi

# Install Docker Engine if not already present.
if ! command -v docker >/dev/null 2>&1; then
  log_info "Installing Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$(lsb_release -is | tr '[:upper:]' '[:lower:]')/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(lsb_release -is | tr '[:upper:]' '[:lower:]') $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

systemctl enable docker
systemctl start docker
apt-get clean
log_ok "Dependencies installed."

# -----------------------------------------------------------------------------
# 2. Clone or update the application
# -----------------------------------------------------------------------------
log_info "Setting up application directory ${APP_DIR}..."
if [[ ! -d "$APP_DIR" ]]; then
  git clone "$REPO_URL" "$APP_DIR"
  log_ok "Repository cloned."
else
  # The checkout may be owned by the login user; let root's git operate on it.
  git config --global --get-all safe.directory | grep -qx "$APP_DIR" || git config --global --add safe.directory "$APP_DIR"
  git -C "$APP_DIR" pull --ff-only origin main
  log_ok "Repository updated."
fi
cd "$APP_DIR"

# -----------------------------------------------------------------------------
# 3. Secrets (created once, reused forever) and disk space
# -----------------------------------------------------------------------------
ensure_env_file
env_set GEMINI_API_KEY "$GEMINI_API_KEY"
env_set GITHUB_TOKEN "$GITHUB_TOKEN"
if [[ "$USE_IP" != true ]]; then
  # Only the site's own domain may call the API from a browser.
  env_set CORS_ORIGINS "https://${DOMAIN},http://${DOMAIN}"
fi
if [[ -z "$GEMINI_API_KEY" ]]; then
  log_warn "No GEMINI_API_KEY: evaluations will be refused until one is added to ${ENV_FILE}."
fi
ensure_disk_space
backup_database

# -----------------------------------------------------------------------------
# 4. Build the frontend
# -----------------------------------------------------------------------------
build_frontend
remove_legacy_backend_env

# -----------------------------------------------------------------------------
# 5. Configure nginx
# -----------------------------------------------------------------------------
log_info "Configuring nginx..."
rm -f /etc/nginx/sites-enabled/default
cp gcp/nginx-zecathon.conf /etc/nginx/sites-available/zecathon
sed -i "s/{{DOMAIN}}/${DOMAIN}/g" /etc/nginx/sites-available/zecathon
ln -sf /etc/nginx/sites-available/zecathon /etc/nginx/sites-enabled/zecathon
nginx -t && systemctl reload nginx || { log_error "nginx configuration failed"; exit 1; }
install_cloudflare_realip
log_ok "nginx configured."

# -----------------------------------------------------------------------------
# 6. SSL certificate
# -----------------------------------------------------------------------------
if [[ "$USE_IP" != true && -n "$EMAIL" ]]; then
  # Let's Encrypt can only verify the domain once its DNS points at this VM. Check
  # first: repeated failed attempts hit Let's Encrypt rate limits for an hour or more.
  VM_IP=$(detect_external_ip)
  DNS_IP=$(getent ahostsv4 "$DOMAIN" | awk 'NR==1 {print $1}')
  if curl -fsSI -m 10 "https://${DOMAIN}" 2>/dev/null | grep -qi '^server: *cloudflare'; then
    # Cloudflare already serves the trusted certificate to browsers; a Let's Encrypt
    # HTTP check would also fail because the DNS points at Cloudflare, not this VM.
    log_warn "${DOMAIN} is proxied by Cloudflare: skipping Let's Encrypt on the VM."
    log_warn "In Cloudflare set SSL/TLS mode to 'Full' (the VM keeps a self-signed certificate for the Cloudflare-to-VM hop)."
    EMAIL=""
  elif [[ -z "$DNS_IP" ]]; then
    log_error "${DOMAIN} does not resolve yet. Add a DNS A record pointing to ${VM_IP:-the VM external IP}, wait for it to propagate, then re-run this script."
    EMAIL=""
  elif [[ -n "$VM_IP" && "$DNS_IP" != "$VM_IP" ]]; then
    log_error "${DOMAIN} points to ${DNS_IP}, but this VM is ${VM_IP}. Fix the DNS A record, wait for it to propagate, then re-run this script."
    EMAIL=""
  else
    log_info "Obtaining Let's Encrypt SSL certificate for ${DOMAIN}..."
    # --redirect sends all http:// traffic to https://. certbot renews automatically via its systemd timer.
    if ! certbot --nginx --non-interactive --agree-tos --redirect --email "$EMAIL" -d "$DOMAIN"; then
      log_warn "certbot failed; falling back to a self-signed certificate."
      EMAIL=""
    fi
  fi
fi
if [[ -z "$EMAIL" ]]; then
  log_warn "Using a self-signed SSL certificate for ${DOMAIN} (browsers will warn)."
  write_self_signed_cert
fi
log_ok "SSL configured."

# -----------------------------------------------------------------------------
# 7. systemd service, backend image, start
# -----------------------------------------------------------------------------
install_unit
build_and_start

# -----------------------------------------------------------------------------
# 8. Final summary
# -----------------------------------------------------------------------------
echo
log_ok "ZECKATHON deployment complete!"
echo
if [[ "$USE_IP" == true ]]; then
  echo "  HTTP URL:        http://${DOMAIN}"
  echo "  HTTPS URL:       https://${DOMAIN}  (self-signed; browser will warn)"
else
  echo "  Application URL: https://${DOMAIN}"
fi
echo "  VM directory:    ${APP_DIR}"
echo "  Secrets:         ${ENV_FILE} (root-only)"
echo "  systemd service: zecathon.service"
echo
echo "Next steps:"
echo "  Create the first superadmin:"
echo "    sudo docker exec -it zecathon-backend python -m scripts.create_superadmin <username> <email>"
echo "  Update later:"
echo "    cd ${APP_DIR} && sudo git pull --ff-only origin main && sudo bash gcp/update-vm.sh"
echo "  Set up an uptime check on https://${DOMAIN}/api/health (see gcp/README.md)."
echo
echo "Useful commands:"
echo "  sudo systemctl status zecathon"
echo "  sudo docker logs -f zecathon-backend"
echo "  sudo docker compose --env-file ${ENV_FILE} -f ${COMPOSE_FILE} ps"
