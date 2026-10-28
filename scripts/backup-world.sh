#!/usr/bin/env bash
# ==============================================================================
# Beacon - pack the Minecraft world into world-latest.tar.gz and publish it
# ==============================================================================
# Run on the VM (manually, from cron, or before shutdown):
#   bash backup-world.sh
#
# Where the archive goes depends on what is configured (any combination):
#   R2_REMOTE / R2_BUCKET   rclone remote + bucket  -> Beacon's BACKUP_BUCKET binding
#   UPLOAD_URL              Oracle Object Storage pre-authenticated request with
#                           write access (ends in /o/)  -> Beacon's BACKUP_URL
#   SERVE_DIR               folder that serve-backup.sh publishes on port 8080
#
# Settings (environment variables):
#   MC_DIR        server folder                     default /opt/minecraft
#   MC_SESSION    screen/tmux session running it    default minecraft
#   OUT_DIR       where archives are kept           default /var/backups/minecraft
#   KEEP_DAYS     delete dated archives older than  default 3
#   R2_REMOTE     rclone remote name                default r2 (skipped if not configured)
#   R2_BUCKET     bucket name                       default beacon-backups
#   UPLOAD_URL    PAR URL for Oracle Object Storage (optional)
#   SERVE_DIR     folder for serve-backup.sh        default $MC_DIR/.beacon-serve
#   VM_BACKUP_TOKEN  secret path segment, must match Beacon's VM_BACKUP_TOKEN (optional)
# ==============================================================================

set -euo pipefail

MC_DIR="${MC_DIR:-/opt/minecraft}"
MC_SESSION="${MC_SESSION:-minecraft}"
OUT_DIR="${OUT_DIR:-/var/backups/minecraft}"
KEEP_DAYS="${KEEP_DAYS:-3}"
R2_REMOTE="${R2_REMOTE:-r2}"
R2_BUCKET="${R2_BUCKET:-beacon-backups}"
UPLOAD_URL="${UPLOAD_URL:-}"
SERVE_DIR="${SERVE_DIR:-$MC_DIR/.beacon-serve}"
VM_BACKUP_TOKEN="${VM_BACKUP_TOKEN:-}"

LATEST_NAME="world-latest.tar.gz"
DATED_NAME="world-$(date +%Y%m%d_%H%M%S).tar.gz"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Send a console command to the running server, if we can find it
mc_cmd() {
  if command -v screen >/dev/null 2>&1 && screen -list 2>/dev/null | grep -q "[.]${MC_SESSION}[[:space:]]"; then
    screen -S "$MC_SESSION" -p 0 -X stuff "$1^M"
    return 0
  elif command -v tmux >/dev/null 2>&1 && tmux has-session -t "$MC_SESSION" 2>/dev/null; then
    tmux send-keys -t "$MC_SESSION" "$1" ENTER
    return 0
  fi
  return 1
}

cd "$MC_DIR"
mkdir -p "$OUT_DIR"

# 1. Pause autosave and flush chunks so the archive is consistent; always turn autosave back on
SAVE_PAUSED=0
if mc_cmd "save-off"; then
  SAVE_PAUSED=1
  trap 'mc_cmd "save-on" || true' EXIT
  mc_cmd "save-all flush"
  log "Paused autosave and flushed the world to disk."
  sleep 5
else
  log "No '$MC_SESSION' screen/tmux session found; packing the files as they are on disk."
fi

# 2. Collect what exists: the level folder named in server.properties, its nether and end
#    folders (Paper/Spigot keep them separate), and the files that make a server yours
LEVEL_NAME="world"
if [ -f server.properties ]; then
  LEVEL_NAME="$(grep -E '^level-name=' server.properties | cut -d= -f2- | tr -d '\r' || true)"
  LEVEL_NAME="${LEVEL_NAME:-world}"
fi

PATHS=()
for p in "$LEVEL_NAME" "${LEVEL_NAME}_nether" "${LEVEL_NAME}_the_end" \
         whitelist.json ops.json banned-players.json banned-ips.json usercache.json; do
  if [ -e "$p" ]; then PATHS+=("$p"); fi
done

if [ ! -d "$LEVEL_NAME" ]; then
  echo "Error: world folder '$MC_DIR/$LEVEL_NAME' not found. Set MC_DIR to your server folder." >&2
  exit 1
fi

# server.properties goes in with rcon.password blanked: the archive is meant to be downloaded
REDACTED_DIR="$(mktemp -d)"
EXTRA=()
if [ -f server.properties ]; then
  sed -E 's/^(rcon\.password=).*/\1/' server.properties > "$REDACTED_DIR/server.properties"
  EXTRA=(-C "$REDACTED_DIR" server.properties)
fi

log "Packing: ${PATHS[*]}${EXTRA:+ server.properties (rcon.password blanked)}"
# Exit status 1 from GNU tar only means "a file changed while being read"; anything higher is a real error
set +e
tar -czf "$OUT_DIR/$DATED_NAME" --warning=no-file-changed \
    --exclude='*.log' --exclude='*.log.gz' --exclude='session.lock' \
    "${PATHS[@]}" "${EXTRA[@]}"
TAR_STATUS=$?
set -e
rm -rf "$REDACTED_DIR"
if [ "$TAR_STATUS" -gt 1 ]; then
  echo "Error: tar failed with status $TAR_STATUS" >&2
  exit "$TAR_STATUS"
fi

if [ "$SAVE_PAUSED" -eq 1 ]; then
  mc_cmd "save-on" || true
  trap - EXIT
fi

cp "$OUT_DIR/$DATED_NAME" "$OUT_DIR/$LATEST_NAME"
gzip -t "$OUT_DIR/$LATEST_NAME"
log "Archive ready: $OUT_DIR/$LATEST_NAME ($(du -h "$OUT_DIR/$LATEST_NAME" | cut -f1))"

# 3. Publish
PUBLISHED=0

if command -v rclone >/dev/null 2>&1 && rclone listremotes 2>/dev/null | grep -qx "${R2_REMOTE}:"; then
  log "Uploading to R2 (${R2_REMOTE}:${R2_BUCKET})..."
  rclone copyto "$OUT_DIR/$LATEST_NAME" "${R2_REMOTE}:${R2_BUCKET}/${LATEST_NAME}"
  rclone copyto "$OUT_DIR/$DATED_NAME" "${R2_REMOTE}:${R2_BUCKET}/archives/${DATED_NAME}"
  PUBLISHED=1
fi

if [ -n "$UPLOAD_URL" ]; then
  log "Uploading to Oracle Object Storage..."
  BASE="${UPLOAD_URL%/}"
  curl --fail --silent --show-error -X PUT -T "$OUT_DIR/$LATEST_NAME" \
       -H "Content-Type: application/gzip" "$BASE/$LATEST_NAME"
  PUBLISHED=1
fi

if [ -n "$SERVE_DIR" ]; then
  TARGET_DIR="$SERVE_DIR"
  if [ -n "$VM_BACKUP_TOKEN" ]; then TARGET_DIR="$SERVE_DIR/$VM_BACKUP_TOKEN"; fi
  mkdir -p "$TARGET_DIR"
  # An empty index page stops http.server from listing the folder (and the token)
  [ -f "$SERVE_DIR/index.html" ] || : > "$SERVE_DIR/index.html"
  cp "$OUT_DIR/$LATEST_NAME" "$TARGET_DIR/$LATEST_NAME"
  log "Copied to $TARGET_DIR for serve-backup.sh."
fi

if [ "$PUBLISHED" -eq 0 ]; then
  log "Not uploaded anywhere: configure rclone remote '$R2_REMOTE' or set UPLOAD_URL (see README)."
fi

# 4. Keep the disk tidy
find "$OUT_DIR" -name 'world-2*.tar.gz' -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true
log "Backup finished."
