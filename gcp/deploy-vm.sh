#!/usr/bin/env bash
# ZECATHON — Self-hosted VM deployment for GCP (no gcloud CLI required).
#
# Designed to be run inside a GCP Compute Engine VM via the browser SSH terminal.
# Uses:
#   - Docker for PostgreSQL
#   - systemd to keep the stack alive
#   - gunicorn + uvicorn workers for the backend
#   - host nginx for SSL and static frontend hosting
#
# What you need before running this:
#   1. A GCP Compute Engine VM (Ubuntu 22.04/24.04 LTS recommended, e2-medium or larger).
#   2. Firewall rules in the GCP Console allowing TCP 80 and 443 to the VM.
#   3. (Optional) A DNS A record pointing a domain to the VM's external IP. If you don't
#      provide one, the script automatically detects the VM's external IP and uses a
#      self-signed certificate.
#   4. SSH into the VM using the browser terminal and run this script from the repo root.
#
# Usage:
#   sudo ./gcp/deploy-vm.sh

set -euo pipefail

APP_DIR="/opt/zecathon"
REPO_URL="https://github.com/Zethetaprojects/Zecathon.git"
DOMAIN=""
EMAIL=""
DB_PASSWORD=""
SECRET_KEY=""
GEMINI_API_KEY=""
GITHUB_TOKEN=""

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}   $1"; }

random_password() { openssl rand -base64 24 | tr '+/' '-_' | cut -c1-24; }
random_secret()   { openssl rand -hex 48; }

prompt() {
  local var_name="$1"
  local prompt_text="$2"
  local current_value="${!var_name:-}"
  if [[ -z "$current_value" ]]; then
    read -rp "$prompt_text" current_value
    eval "export $var_name=\"$current_value\""
  fi
}

is_ip() {
  [[ "$1" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]
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
    ip=$(curl -fsS -m 5 https://icanhazip.com 2>/dev/null || true)
  fi
  if [[ -z "$ip" ]]; then
    ip=$(curl -fsS -m 5 https://api.ipify.org 2>/dev/null || true)
  fi
  if is_ip "$ip"; then
    echo "$ip"
  fi
}

# -----------------------------------------------------------------------------
# Preflight
# -----------------------------------------------------------------------------
log_info "ZECATHON VM deployment starting..."

if [[ $EUID -ne 0 ]]; then
  log_error "This script must be run as root or with sudo."
  exit 1
fi

if [[ -d /opt/zecathon ]]; then
  log_warn "${APP_DIR} already exists. The script will update the code and redeploy."
fi

# Auto-detect external IP if no domain was provided
if [[ -z "$DOMAIN" ]]; then
  log_info "Detecting VM external IP address..."
  DETECTED_IP=$(detect_external_ip)
  if [[ -n "$DETECTED_IP" ]]; then
    DOMAIN="$DETECTED_IP"
    log_ok "Detected external IP: ${DOMAIN}"
  fi
fi

# Allow the user to override with a custom domain if they want
if [[ -z "$DOMAIN" ]]; then
  prompt DOMAIN "External IP could not be detected. Enter domain or IP (e.g. zecathon.example.com or 34.123.45.67): "
fi

if [[ -z "$DOMAIN" ]]; then
  log_error "A domain or IP address is required."
  exit 1
fi

USE_IP=false
if is_ip "$DOMAIN"; then
  USE_IP=true
  log_info "Using IP address ${DOMAIN}. Only a self-signed certificate is possible."
fi

prompt EMAIL "Email address for Let's Encrypt SSL (press Enter for self-signed): "
if [[ -z "$EMAIL" ]]; then
  log_warn "No email provided; SSL certificate will use a self-signed fallback."
fi
if [[ "$USE_IP" == true && -n "$EMAIL" ]]; then
  log_warn "Let's Encrypt cannot issue certificates for bare IP addresses. Reverting to self-signed."
  EMAIL=""
fi

prompt GEMINI_API_KEY "Gemini API key (optional, press Enter to skip): "
prompt GITHUB_TOKEN "GitHub token (optional, press Enter to skip): "

if [[ -z "$SECRET_KEY" ]]; then
  SECRET_KEY=$(random_secret)
  log_info "Generated a 96-char SECRET_KEY."
fi

if [[ -z "$DB_PASSWORD" ]]; then
  DB_PASSWORD=$(random_password)
  log_info "Generated a 24-char PostgreSQL password."
fi

# -----------------------------------------------------------------------------
# 1. Install system dependencies
# -----------------------------------------------------------------------------
log_info "Updating packages and installing dependencies..."
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  curl \
  wget \
  ca-certificates \
  gnupg \
  lsb-release \
  git \
  nginx \
  certbot \
  python3-certbot-nginx \
  openssl \
  unzip \
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
  curl -fsSL https://download.docker.com/linux/$(lsb_release -is | tr '[:upper:]' '[:lower:]')/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(lsb_release -is | tr '[:upper:]' '[:lower:]') $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

# Ensure docker runs on boot
systemctl enable docker
systemctl start docker

log_ok "Dependencies installed."

# -----------------------------------------------------------------------------
# 2. Clone or update the application
# -----------------------------------------------------------------------------
log_info "Setting up application directory ${APP_DIR}..."
if [[ ! -d "$APP_DIR" ]]; then
  git clone "$REPO_URL" "$APP_DIR"
  log_ok "Repository cloned."
else
  cd "$APP_DIR"
  git pull origin main
  log_ok "Repository updated."
fi

cd "$APP_DIR"

# -----------------------------------------------------------------------------
# 3. Build the frontend
# -----------------------------------------------------------------------------
log_info "Building frontend..."
cd frontend
npm ci
npm run build
cd "$APP_DIR"
log_ok "Frontend built to ${APP_DIR}/frontend/dist."

# -----------------------------------------------------------------------------
# 4. Create backend environment file
# -----------------------------------------------------------------------------
log_info "Configuring backend environment..."
cat > backend/.env <<EOF
DATABASE_URL=postgresql+psycopg2://zecathon:${DB_PASSWORD}@postgres:5432/zecathon
SECRET_KEY=${SECRET_KEY}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
AI_BACKEND_URL=http://localhost:5000
AI_BACKEND_TOKEN=
GEMINI_API_KEY=${GEMINI_API_KEY}
GEMINI_MODEL=gemini-3.5-flash-lite
GITHUB_TOKEN=${GITHUB_TOKEN}
UPLOAD_DIR=/data/uploads
MAX_UPLOAD_SIZE=20971520
EOF
log_ok "Backend .env created."

# -----------------------------------------------------------------------------
# 5. Configure nginx
# -----------------------------------------------------------------------------
log_info "Configuring nginx..."

# Backup default nginx config if it exists and is enabled
if [[ -f /etc/nginx/sites-enabled/default ]]; then
  rm -f /etc/nginx/sites-enabled/default
fi

cp gcp/nginx-zecathon.conf /etc/nginx/sites-available/zecathon
sed -i "s/{{DOMAIN}}/${DOMAIN}/g" /etc/nginx/sites-available/zecathon

if [[ ! -f /etc/nginx/sites-enabled/zecathon ]]; then
  ln -s /etc/nginx/sites-available/zecathon /etc/nginx/sites-enabled/zecathon
fi

# Test nginx config before reloading
nginx -t && systemctl reload nginx || { log_error "nginx configuration failed"; exit 1; }
log_ok "nginx configured."

# -----------------------------------------------------------------------------
# 6. SSL certificate
# -----------------------------------------------------------------------------
if [[ "$USE_IP" == true ]]; then
  log_warn "Using a self-signed SSL certificate for IP address ${DOMAIN}."
  mkdir -p /etc/nginx/ssl
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/zecathon.key \
    -out /etc/nginx/ssl/zecathon.crt \
    -subj "/CN=${DOMAIN}"

  # Patch the nginx config to listen on 443 with the self-signed cert
  sed -i '/listen 80;/a\    listen 443 ssl;\n    ssl_certificate /etc/nginx/ssl/zecathon.crt;\n    ssl_certificate_key /etc/nginx/ssl/zecathon.key;' /etc/nginx/sites-available/zecathon
  nginx -t && systemctl reload nginx
  log_ok "SSL configured for IP address."
elif [[ -n "$EMAIL" ]]; then
  log_info "Obtaining Let's Encrypt SSL certificate for ${DOMAIN}..."
  certbot --nginx --non-interactive --agree-tos --email "$EMAIL" -d "$DOMAIN" || {
    log_warn "certbot failed; falling back to a self-signed certificate."
    EMAIL=""
  }
fi

if [[ "$USE_IP" != true && -z "$EMAIL" ]]; then
  log_warn "Using a self-signed SSL certificate for ${DOMAIN}."
  mkdir -p /etc/nginx/ssl
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/zecathon.key \
    -out /etc/nginx/ssl/zecathon.crt \
    -subj "/CN=${DOMAIN}"

  # Patch the nginx config to listen on 443 with the self-signed cert
  sed -i '/listen 80;/a\    listen 443 ssl;\n    ssl_certificate /etc/nginx/ssl/zecathon.crt;\n    ssl_certificate_key /etc/nginx/ssl/zecathon.key;' /etc/nginx/sites-available/zecathon
  nginx -t && systemctl reload nginx
  log_ok "SSL configured."
fi

# -----------------------------------------------------------------------------
# 7. Create systemd service for the Docker stack
# -----------------------------------------------------------------------------
log_info "Creating systemd service..."

cat > /etc/systemd/system/zecathon.service <<EOF
[Unit]
Description=ZECATHON application stack (PostgreSQL + backend)
Requires=docker.service
After=docker.service network.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${APP_DIR}/gcp
Environment=DB_PASSWORD=${DB_PASSWORD}
Environment=SECRET_KEY=${SECRET_KEY}
Environment=GEMINI_API_KEY=${GEMINI_API_KEY}
Environment=GITHUB_TOKEN=${GITHUB_TOKEN}
ExecStart=/usr/bin/docker compose -f docker-compose.vm.yml up -d --build
ExecStop=/usr/bin/docker compose -f docker-compose.vm.yml down
ExecReload=/usr/bin/docker compose -f docker-compose.vm.yml up -d --build
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable zecathon.service
systemctl start zecathon.service

# Wait for backend health
log_info "Waiting for backend to become healthy..."
for i in {1..30}; do
  if curl -fsS http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
    log_ok "Backend is healthy."
    break
  fi
  sleep 2
  if [[ $i -eq 30 ]]; then
    log_warn "Backend health check timed out; check logs with: journalctl -u zecathon -n 100"
  fi
done

# -----------------------------------------------------------------------------
# 8. Final summary
# -----------------------------------------------------------------------------
echo
log_ok "ZECATHON deployment complete!"
echo
if [[ "$USE_IP" == true ]]; then
  echo "  HTTP URL:        http://${DOMAIN}"
  echo "  HTTPS URL:       https://${DOMAIN}  (self-signed; browser will warn)"
else
  echo "  Application URL: https://${DOMAIN}"
fi
echo "  VM directory:    ${APP_DIR}"
echo "  systemd service: zecathon.service"
echo "  nginx config:    /etc/nginx/sites-available/zecathon"
echo
echo "Useful commands:"
echo "  sudo systemctl status zecathon"
echo "  sudo systemctl restart zecathon"
echo "  sudo journalctl -u zecathon -f"
echo "  sudo docker compose -f ${APP_DIR}/gcp/docker-compose.vm.yml logs -f"
echo
echo "  View backend logs:  sudo docker logs -f zecathon-backend"
echo "  View postgres logs: sudo docker logs -f zecathon-postgres"
echo
