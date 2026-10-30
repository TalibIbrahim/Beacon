#!/usr/bin/env bash
# ==============================================================================
# Beacon - pack arm-free's copy of the world as a ready-to-play singleplayer save and upload it
# ==============================================================================
# Runs on arm-free. mc-agent.sh calls it after every backup (requested or scheduled).
# By hand:
#   ~/beacon/pack-and-upload.sh           # only if there is a backup newer than the last upload
#   ~/beacon/pack-and-upload.sh --force   # pack and upload regardless
#
# Builds a .zip whose only top-level entry is the active world folder (level-name in
# server.properties), so extracting it into .minecraft/saves gives <world>/level.dat directly:
#
#   1. Stage a hardlink copy (cp -al) of $SRC_DIR/<world> in a temp folder under $BACKUP_ROOT.
#      $SRC_DIR itself is never written to: the staged copy only gains new files and loses links.
#   2. Copy dimensions/minecraft/overworld/data/minecraft/world_gen_settings.dat into
#      <world>/data/minecraft/. Paper keeps it only inside the dimension folder; vanilla and Fabric
#      clients need it in the world root.
#   3. Check for a non-empty level.dat, data/minecraft/world_gen_settings.dat and at least one .mca
#      file in dimensions/minecraft/overworld/region. Anything missing stops here: nothing is uploaded
#      and the error names what is missing (mc-agent.sh passes it on to Beacon).
#   4. Zip it (Python's zipfile; arm-free has no zip), test every entry's CRC, and list the archive to
#      confirm the single top-level folder and <world>/data/minecraft/world_gen_settings.dat.
#
# The download is named world-<world>-<level.dat time, UTC>.zip, e.g.
# world-survival-2026-10-29T19-30-12Z.zip. The object is always world-latest.zip; the real name rides
# along as its Content-Disposition, which Beacon also reads to show how old the save is.
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
# On failure the last line is "... pack: Error: <reason>".
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
LATEST_NAME="world-latest.zip"

[ -n "$UPLOAD_URL" ] || fail "UPLOAD_URL is not set (see $ENV_FILE)."
case "$UPLOAD_URL" in https://*) ;; *) fail "UPLOAD_URL must start with https://" ;; esac
command -v curl >/dev/null 2>&1 || fail "curl is not installed: sudo apt-get install -y curl"
command -v python3 >/dev/null 2>&1 || fail "python3 is not installed: sudo apt-get install -y python3"
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

# The active world: level-name in the backed-up server.properties. No default, so a missing or odd
# setting stops the run instead of packing the wrong folder.
[ -f "$SRC_DIR/server.properties" ] || fail "server.properties is missing from $SRC_DIR, so the active world is unknown."
LEVEL_NAME="$(grep -m 1 -E '^level-name=' "$SRC_DIR/server.properties" | cut -d= -f2- | tr -d '\r' || true)"
[ -n "$LEVEL_NAME" ] || fail "level-name is not set in server.properties, so the active world is unknown."
[[ "$LEVEL_NAME" =~ ^[A-Za-z0-9][A-Za-z0-9._\ -]{0,63}$ ]] || fail "Unexpected level-name in server.properties."
[ -d "$SRC_DIR/$LEVEL_NAME" ] || fail "World folder '$LEVEL_NAME' not found in $SRC_DIR."
[ -s "$SRC_DIR/$LEVEL_NAME/level.dat" ] || fail "$LEVEL_NAME is incomplete, missing level.dat"

# The backup's own time: level.dat's mtime, in UTC
SAVED_EPOCH="$(stat -c %Y "$SRC_DIR/$LEVEL_NAME/level.dat")"
SAVED_STAMP="$(date -u -d "@$SAVED_EPOCH" +%Y-%m-%dT%H-%M-%SZ)"
DOWNLOAD_NAME="world-$LEVEL_NAME-$SAVED_STAMP.zip"

# The stage must sit on the same filesystem as $SRC_DIR for cp -al. Leftovers from a killed run are
# safe to drop: we hold the lock.
rm -rf "$BACKUP_ROOT"/.stage.*
STAGE="$(mktemp -d "$BACKUP_ROOT/.stage.XXXXXX")"
TMP="$OUT_DIR/.$LATEST_NAME.tmp"
trap 'rm -f "$TMP"; rm -rf "$STAGE"' EXIT

log "Staging $LEVEL_NAME (hardlinks, level.dat from $SAVED_STAMP)"
cp -al "$SRC_DIR/$LEVEL_NAME" "$STAGE/"
WORLD="$STAGE/$LEVEL_NAME"

# Removing a hardlink, or writing a brand-new file, leaves the original in $SRC_DIR untouched.
# --remove-destination makes sure cp never writes into an inode shared with $SRC_DIR.
rm -f "$WORLD/session.lock"
WGS_SRC="$WORLD/dimensions/minecraft/overworld/data/minecraft/world_gen_settings.dat"
if [ -f "$WGS_SRC" ]; then
  mkdir -p "$WORLD/data/minecraft"
  cp --remove-destination "$WGS_SRC" "$WORLD/data/minecraft/world_gen_settings.dat"
fi

# Nothing incomplete leaves arm-free. The error stays short (Beacon shows up to 200 characters,
# after mc-agent.sh's prefix); the log gets the full paths.
MISSING=()
if [ ! -s "$WORLD/level.dat" ]; then
  MISSING+=("level.dat"); log "Missing or empty: $LEVEL_NAME/level.dat"
fi
if [ ! -s "$WORLD/data/minecraft/world_gen_settings.dat" ]; then
  MISSING+=("world_gen_settings.dat")
  log "Missing: $LEVEL_NAME/data/minecraft/world_gen_settings.dat (and none in dimensions/minecraft/overworld/data/minecraft to copy)"
fi
if [ -z "$(find "$WORLD/dimensions/minecraft/overworld/region" -maxdepth 1 -type f -name '*.mca' -print -quit 2>/dev/null)" ]; then
  MISSING+=("overworld region files"); log "Missing: $LEVEL_NAME/dimensions/minecraft/overworld/region/*.mca"
fi
if [ "${#MISSING[@]}" -gt 0 ]; then
  fail "$LEVEL_NAME is incomplete, missing $(IFS=';'; printf '%s' "${MISSING[*]}" | sed 's/;/, /g')"
fi

log "Packing $LEVEL_NAME into $DOWNLOAD_NAME"
python3 -I - "$STAGE" "$LEVEL_NAME" "$TMP" <<'PY' || fail "Building the zip failed."
import os, sys, zipfile
stage, level, out = sys.argv[1:4]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=6, strict_timestamps=False) as zf:
    for dirpath, dirnames, filenames in os.walk(os.path.join(stage, level)):
        dirnames.sort()
        rel = os.path.relpath(dirpath, stage)
        zf.write(dirpath, rel)  # folder entry, so empty folders survive
        for name in sorted(filenames):
            path = os.path.join(dirpath, name)
            if os.path.isfile(path) and not os.path.islink(path):
                zf.write(path, f'{rel}/{name}')
PY

# List the archive and check it: every CRC, one top-level folder, and the files a client needs
CHECK="$(python3 -I - "$TMP" "$LEVEL_NAME" <<'PY' 2>&1
import sys, zipfile
out, level = sys.argv[1:3]
with zipfile.ZipFile(out) as zf:
    names = zf.namelist()
    bad = zf.testzip()
if bad:
    sys.exit(f'CRC check failed for {bad}')
tops = sorted({n.split('/', 1)[0] for n in names})
if tops != [level]:
    sys.exit(f'top-level entries are {tops}, expected only {level}')
for need in (f'{level}/level.dat', f'{level}/data/minecraft/world_gen_settings.dat'):
    if need not in names:
        sys.exit(f'{need} is not in the zip')
    print(f'  {need}')
print(f'  {len(names)} entries, all under {level}/')
PY
)" || fail "The zip failed its check: ${CHECK##*$'\n'}"
log "Zip contents check:"
printf '%s\n' "$CHECK"

rm -rf "$STAGE"
mv -f "$TMP" "$OUT_DIR/$LATEST_NAME"
rm -f "$OUT_DIR/world-latest.tar.gz"  # the old format, no longer uploaded
SIZE="$(stat -c %s "$OUT_DIR/$LATEST_NAME")"
log "Archive ready: $OUT_DIR/$LATEST_NAME ($(du -h "$OUT_DIR/$LATEST_NAME" | cut -f1))"

log "Uploading to Oracle Object Storage..."
curl --fail --retry 3 --silent --show-error --connect-timeout 20 \
     -T "$OUT_DIR/$LATEST_NAME" -H "Content-Type: application/zip" \
     -H "Content-Disposition: attachment; filename=\"$DOWNLOAD_NAME\"" \
     -K <(printf 'url = "%s/%s"\n' "${UPLOAD_URL%/}" "$LATEST_NAME") \
  || fail "Upload failed. Check that UPLOAD_URL is a write-enabled pre-authenticated request that has not expired."

echo "$STAMP" > "$STAMP_FILE"
log "Uploaded $LATEST_NAME as $DOWNLOAD_NAME ($SIZE bytes)."
