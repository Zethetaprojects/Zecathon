#!/usr/bin/env bash
# Shared helpers for deploy-vm.sh (first install) and update-vm.sh (routine updates).
# Source this file; do not run it directly.

APP_DIR="/opt/zecathon"
ENV_DIR="/etc/zecathon"
ENV_FILE="${ENV_DIR}/zecathon.env"
UNIT_FILE="/etc/systemd/system/zecathon.service"
COMPOSE_FILE="${APP_DIR}/gcp/docker-compose.vm.yml"
BACKUP_DIR="/var/backups/zecathon"
PG_VOLUME="gcp_zecathon_pg_data"
# A backend image build plus the frontend build needs roughly this much headroom.
MIN_FREE_MB=2500

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}   $1"; }

random_password() { openssl rand -base64 24 | tr '+/' '-_' | tr -d '=' | cut -c1-24; }
random_secret()   { openssl rand -hex 48; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root or with sudo."
    exit 1
  fi
}

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

# Read KEY from the env file (empty if missing).
env_get() {
  [[ -f "$ENV_FILE" ]] || return 0
  { grep -E "^$1=" "$ENV_FILE" || true; } | tail -n1 | cut -d= -f2-
}

# Set KEY=VALUE in the env file, replacing any existing line.
env_set() {
  local key="$1" value="$2" tmp
  tmp=$(mktemp)
  if [[ -f "$ENV_FILE" ]]; then
    grep -vE "^${key}=" "$ENV_FILE" > "$tmp" || true
  fi
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  install -m 600 -o root -g root "$tmp" "$ENV_FILE"
  rm -f "$tmp"
}

# Make sure /etc/zecathon/zecathon.env exists and holds the secrets the running
# database was created with. Secrets are only generated on a brand-new install.
ensure_env_file() {
  mkdir -p "$ENV_DIR"
  chmod 700 "$ENV_DIR"

  if [[ -f "$ENV_FILE" ]]; then
    chmod 600 "$ENV_FILE"
    log_ok "Using existing secrets from ${ENV_FILE}."
  elif [[ -f "$UNIT_FILE" ]] && grep -q '^Environment=DB_PASSWORD=' "$UNIT_FILE"; then
    # Older deploys stored secrets inline in the systemd unit. Move them out.
    log_info "Migrating secrets from the old systemd unit into ${ENV_FILE}..."
    local tmp
    tmp=$(mktemp)
    grep -E '^Environment=' "$UNIT_FILE" | sed -E 's/^Environment=//' > "$tmp"
    install -m 600 -o root -g root "$tmp" "$ENV_FILE"
    rm -f "$tmp"
    log_ok "Secrets migrated (the database password is unchanged)."
  elif docker volume inspect "$PG_VOLUME" >/dev/null 2>&1; then
    log_error "Database volume ${PG_VOLUME} exists but no saved secrets were found."
    log_error "Generating a new DB password would lock the backend out of the existing database."
    log_error "Recreate ${ENV_FILE} with the original DB_PASSWORD and SECRET_KEY, then re-run."
    exit 1
  else
    log_info "New install: generating secrets in ${ENV_FILE}."
    env_set DB_PASSWORD "$(random_password)"
    env_set SECRET_KEY "$(random_secret)"
  fi

  if [[ -z "$(env_get DB_PASSWORD)" || -z "$(env_get SECRET_KEY)" ]]; then
    log_error "${ENV_FILE} is missing DB_PASSWORD or SECRET_KEY."
    exit 1
  fi
}

free_mb() { df -Pm / | awk 'NR==2 {print $4}'; }

# Free space safely: never touches Docker volumes (database, uploads, logs).
reclaim_disk() {
  log_info "Reclaiming disk space (caches, old logs, unused Docker images)..."
  apt-get clean || true
  journalctl --vacuum-size=200M >/dev/null 2>&1 || true
  rm -rf /root/.npm/_cacache || true
  # Images not used by any container (running or stopped) can be rebuilt or re-pulled.
  docker image prune -af >/dev/null 2>&1 || true
  docker builder prune -af >/dev/null 2>&1 || true
}

ensure_disk_space() {
  local free
  free=$(free_mb)
  if (( free < MIN_FREE_MB )); then
    log_warn "Only ${free} MB free on /; need ${MIN_FREE_MB} MB."
    reclaim_disk
    free=$(free_mb)
  fi
  if (( free < MIN_FREE_MB )); then
    log_error "Still only ${free} MB free on /. Grow the VM disk (see gcp/README.md, 'Disk size'), then re-run."
    exit 1
  fi
  log_ok "${free} MB free on /."
}

# Dump the database if Postgres is running. Keeps the 7 most recent dumps.
backup_database() {
  if ! docker ps --format '{{.Names}}' | grep -qx zecathon-postgres; then
    log_warn "Postgres is not running; skipping pre-deploy database dump."
    return 0
  fi
  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"
  local out="${BACKUP_DIR}/zecathon-$(date +%Y%m%d-%H%M%S).sql.gz"
  local db_user db_name
  db_user=$(env_get DB_USER); db_user=${db_user:-zecathon}
  db_name=$(env_get DB_NAME); db_name=${db_name:-zecathon}
  if docker exec zecathon-postgres pg_dump -U "$db_user" "$db_name" 2>/dev/null | gzip > "$out" && [[ $(stat -c %s "$out") -gt 100 ]]; then
    log_ok "Database backed up to ${out}."
    ls -1t "${BACKUP_DIR}"/zecathon-*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm -f
  else
    rm -f "$out"
    log_error "Database backup failed; not continuing."
    exit 1
  fi
}

build_frontend() {
  log_info "Building frontend..."
  (cd "${APP_DIR}/frontend" && npm ci --no-audit --no-fund && npm run build)
  npm cache clean --force >/dev/null 2>&1 || true
  log_ok "Frontend built to ${APP_DIR}/frontend/dist."
}

install_unit() {
  install -m 644 "${APP_DIR}/gcp/zecathon.service" "$UNIT_FILE"
  systemctl daemon-reload
  systemctl enable zecathon.service >/dev/null
  log_ok "systemd unit installed (secrets loaded from ${ENV_FILE})."
}

# Older deploys wrote a world-readable backend/.env with the secrets. The
# container never read it (.dockerignore excludes it), so remove it.
remove_legacy_backend_env() {
  local legacy="${APP_DIR}/backend/.env"
  if [[ -f "$legacy" ]] && grep -q '^UPLOAD_DIR=/data/uploads' "$legacy"; then
    rm -f "$legacy"
    log_ok "Removed legacy ${legacy} (secrets now live only in ${ENV_FILE})."
  fi
}

# Bump timeouts in an existing nginx site in place, keeping certbot/SSL edits.
patch_nginx_timeouts() {
  local site="/etc/nginx/sites-available/zecathon"
  [[ -f "$site" ]] || return 0
  if grep -q 'proxy_read_timeout 120s;' "$site"; then
    sed -i 's/proxy_read_timeout 120s;/proxy_read_timeout 180s;/g' "$site"
    nginx -t && systemctl reload nginx
    log_ok "nginx proxy timeout raised to 180s."
  fi
}

build_and_start() {
  log_info "Building backend image..."
  compose build backend
  log_info "Starting stack..."
  systemctl restart zecathon.service
  wait_for_health
  # Only after a healthy start: drop images no container uses (old backend builds).
  docker image prune -af >/dev/null 2>&1 || true
  docker builder prune -f --filter until=168h >/dev/null 2>&1 || true
}

wait_for_health() {
  log_info "Waiting for backend to become healthy..."
  for _ in {1..60}; do
    if curl -fsS http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
      log_ok "Backend is healthy."
      return 0
    fi
    sleep 2
  done
  log_error "Backend did not become healthy. Recent backend logs:"
  docker logs --tail 60 zecathon-backend 2>&1 || true
  exit 1
}
