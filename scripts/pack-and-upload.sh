#!/usr/bin/env bash
# ==============================================================================
# Beacon - pack arm-free's copy of the server into world-latest.tar.gz and upload it
# ==============================================================================
# Runs on arm-free. mc-agent.sh calls it after every backup (requested or scheduled).
# By hand:
#   ~/beacon/pack-and-upload.sh           # only if there is a backup newer than the last upload
#   ~/beacon/pack-and-upload.sh --force   # pack and upload regardless
#
# Packs ~/mc-backup/latest with the same selection as backup-world.sh: the world named by
# level-name in server.properties, its _nether and _the_end folders, server.properties,
# whitelist.json, ops.json, the ban lists and usercache.json. Logs and session.lock are left out,
# and so are any other world folders.
#
# Uploads to UPLOAD_URL: an Oracle Object Storage pre-authenticated request with write access,
# ending in /o/. The URL is passed to curl through a config file descriptor, so it never shows
# up in `ps`.
#
# Settings (from the env file, default ~/.config/beacon/agent.env, or the environment):
#   UPLOAD_URL    required
#   BACKUP_ROOT   default ~/mc-backup
#   SRC_DIR       default $BACKUP_ROOT/latest
#   OUT_DIR       default $BACKUP_ROOT/upload
#
# Exit status: 0 uploaded, 3 skipped (already uploaded this backup), anything else failed.
# ==============================================================================

set -euo pipefail

ENV_FILE="${BEACON_AGENT_ENV:-$HOME/.config/beacon/agent.env}"
ENV_KEYS=" UPLOAD_URL BACKUP_ROOT SRC_DIR OUT_DIR "

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] pack: $*"; }
fail() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] pack: Error: $*" >&2; exit 1; }

# KEY=value lines only; nothing in the file is executed. The environment wins over the file.
load_env() {
  [ -f "$ENV_FILE" ] || return 0
  if [ -n "$(find "$ENV_FILE" -perm /077 2>/dev/null)" ]; then
    fail "$ENV_FILE can be read by other users. Run: chmod 600 $ENV_FILE"
  fi
  local line key value
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in '' | '#'*) continue ;; esac
    key="${line%%=*}"
    value="${line#*=}"
    case "$ENV_KEYS" in *" $key "*) ;; *) continue ;; esac
    value="${value#\"}"; value="${value%\"}"; value="${value#\'}"; value="${value%\'}"
    if [ -z "${!key:-}" ]; then printf -v "$key" '%s' "$value"; fi
  done < "$ENV_FILE"
}

load_env

FORCE=0
case "${1:-}" in
  --force) FORCE=1 ;;
  '') ;;
  *) echo "Usage: $0 [--force]" >&2; exit 2 ;;
esac

UPLOAD_URL="${UPLOAD_URL:-}"
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/mc-backup}"
SRC_DIR="${SRC_DIR:-$BACKUP_ROOT/latest}"
OUT_DIR="${OUT_DIR:-$BACKUP_ROOT/upload}"
LOCK_FILE="$BACKUP_ROOT/.lock"
LAST_SUCCESS_FILE="$BACKUP_ROOT/.last_success"
STAMP_FILE="$OUT_DIR/.uploaded_stamp"
LATEST_NAME="world-latest.tar.gz"

[ -n "$UPLOAD_URL" ] || fail "UPLOAD_URL is not set (see $ENV_FILE)."
case "$UPLOAD_URL" in https://*) ;; *) fail "UPLOAD_URL must start with https://" ;; esac
command -v curl >/dev/null 2>&1 || fail "curl is not installed: sudo apt-get install -y curl"
[ -d "$SRC_DIR" ] || fail "$SRC_DIR does not exist yet. Has ~/mc-backup.sh run?"
mkdir -p "$OUT_DIR"

# Never pack while ~/mc-backup.sh is writing into $SRC_DIR. mc-agent.sh already holds the lock
# when it calls this, and sets BEACON_LOCK_HELD so we do not wait on ourselves.
if [ -z "${BEACON_LOCK_HELD:-}" ]; then
  exec 9>>"$LOCK_FILE"
  flock -w 1800 9 || fail "Timed out waiting for a running backup to finish."
fi

# Which backup is this? The time ~/mc-backup.sh last finished successfully.
STAMP="$(stat -c %Y "$LAST_SUCCESS_FILE" 2>/dev/null || echo none)"
if [ "$FORCE" -eq 0 ] && [ -f "$OUT_DIR/$LATEST_NAME" ] && [ "$(cat "$STAMP_FILE" 2>/dev/null)" = "$STAMP" ]; then
  log "Already uploaded this backup; nothing to do."
  exit 3
fi

cd "$SRC_DIR"

LEVEL_NAME="world"
if [ -f server.properties ]; then
  LEVEL_NAME="$(grep -E '^level-name=' server.properties | cut -d= -f2- | tr -d '\r' || true)"
  LEVEL_NAME="${LEVEL_NAME:-world}"
fi
[ -d "$LEVEL_NAME" ] || fail "World folder '$SRC_DIR/$LEVEL_NAME' not found (level-name in server.properties)."

PATHS=()
for p in "$LEVEL_NAME" "${LEVEL_NAME}_nether" "${LEVEL_NAME}_the_end" \
         server.properties whitelist.json ops.json banned-players.json banned-ips.json usercache.json; do
  if [ -e "$p" ]; then PATHS+=("$p"); fi
done

TMP="$OUT_DIR/.$LATEST_NAME.tmp"
trap 'rm -f "$TMP"' EXIT

log "Packing: ${PATHS[*]}"
# Exit status 1 from GNU tar only means "a file changed while being read"; anything higher is a real error
set +e
tar -czf "$TMP" --warning=no-file-changed \
    --exclude='*.log' --exclude='*.log.gz' --exclude='session.lock' \
    "${PATHS[@]}"
TAR_STATUS=$?
set -e
[ "$TAR_STATUS" -le 1 ] || fail "tar failed with status $TAR_STATUS"

gzip -t "$TMP" || fail "The archive failed gzip -t."
mv -f "$TMP" "$OUT_DIR/$LATEST_NAME"
SIZE="$(stat -c %s "$OUT_DIR/$LATEST_NAME")"
log "Archive ready: $OUT_DIR/$LATEST_NAME ($(du -h "$OUT_DIR/$LATEST_NAME" | cut -f1))"

log "Uploading to Oracle Object Storage..."
curl --fail --retry 3 --silent --show-error --connect-timeout 20 \
     -T "$OUT_DIR/$LATEST_NAME" -H "Content-Type: application/gzip" \
     -K <(printf 'url = "%s/%s"\n' "${UPLOAD_URL%/}" "$LATEST_NAME") \
  || fail "Upload failed. Check that UPLOAD_URL is a write-enabled pre-authenticated request that has not expired."

echo "$STAMP" > "$STAMP_FILE"
log "Uploaded $LATEST_NAME ($SIZE bytes)."
