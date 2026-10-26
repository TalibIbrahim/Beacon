#!/usr/bin/env bash
# ==============================================================================
# Beacon - serve the latest world save straight from the VM on port 8080
# ==============================================================================
# The free fallback when no R2 bucket or BACKUP_URL is configured. Beacon's download
# button redirects to http://<vm-ip>:8080/[<VM_BACKUP_TOKEN>/]world-latest.tar.gz.
#
#   bash serve-backup.sh            # pack a fresh archive, then serve it
#   bash serve-backup.sh --no-pack  # serve the archive that is already there
#
# Only SERVE_DIR is published - never the server folder itself (it holds
# server.properties with the RCON password, ops.json and the logs).
#
# Before this works:
#   - OCI console: add an ingress rule for TCP 8080 to the instance's security list
#   - On Oracle's Ubuntu images, also open the host firewall:
#       sudo iptables -I INPUT -p tcp --dport 8080 -j ACCEPT
#   - Set VM_BACKUP_TOKEN here and in Beacon so the URL cannot be guessed
#
# The download is plain HTTP, so browsers warn about it; choose "Keep".
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MC_DIR="${MC_DIR:-/opt/minecraft}"
SERVE_DIR="${SERVE_DIR:-$MC_DIR/.beacon-serve}"
PORT="${PORT:-8080}"
VM_BACKUP_TOKEN="${VM_BACKUP_TOKEN:-}"
export MC_DIR SERVE_DIR VM_BACKUP_TOKEN

if [ "${1:-}" != "--no-pack" ]; then
  # Pack only; skip the R2 / Object Storage uploads unless they are explicitly configured
  R2_REMOTE="${R2_REMOTE:-__none__}" bash "$SCRIPT_DIR/backup-world.sh"
fi

FILE_PATH="world-latest.tar.gz"
if [ -n "$VM_BACKUP_TOKEN" ]; then FILE_PATH="$VM_BACKUP_TOKEN/world-latest.tar.gz"; fi

if [ ! -f "$SERVE_DIR/$FILE_PATH" ]; then
  echo "Error: $SERVE_DIR/$FILE_PATH not found. Run without --no-pack first." >&2
  exit 1
fi

PUBLIC_IP="$(curl -4 -s --max-time 5 https://ifconfig.me || echo '<vm-ip>')"
echo "Serving $SERVE_DIR on port $PORT (Ctrl+C to stop)."
echo "Download: http://${PUBLIC_IP}:${PORT}/${FILE_PATH}"
exec python3 -m http.server "$PORT" --directory "$SERVE_DIR"
