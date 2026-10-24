#!/usr/bin/env bash
# ZECKATHON — update an existing VM deployment to the latest code.
#
# Safe to run any time: it keeps the existing database password and JWT secret,
# backs up the database first, and never deletes Docker volumes.
#
# Usage (on the VM):
#   cd /opt/zecathon && sudo git pull --ff-only origin main && sudo bash gcp/update-vm.sh
#
# Pull first, then run: this script does not pull, so it never rewrites itself mid-run.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=gcp/lib-vm.sh
source "${SCRIPT_DIR}/lib-vm.sh"

require_root
cd "$APP_DIR"

log_info "ZECKATHON update starting at commit $(git log -1 --format='%h %s')"

ensure_env_file
ensure_disk_space
backup_database
build_frontend
remove_legacy_backend_env
install_unit
patch_nginx_timeouts
build_and_start

echo
log_ok "ZECKATHON updated to $(git log -1 --format='%h')."
echo "  Status:        sudo systemctl status zecathon"
echo "  Backend logs:  sudo docker logs -f zecathon-backend"
echo "  Backups:       ${BACKUP_DIR}"
echo "  Free disk:     $(free_mb) MB"
