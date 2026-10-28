#!/usr/bin/env bash
# ==============================================================================
# Beacon - restore the active world on Minecraft-Premium from one of arm-free's daily snapshots
# ==============================================================================
#   mc-restore.sh --check <snapshot-file-name>   validate and show what would happen; changes nothing
#   mc-restore.sh <snapshot-file-name>           restore
#
# mc-agent.sh runs this when someone confirms a restore in Beacon. Beacon only sends a file name;
# this script accepts it only if it is exactly the name of a file in ~/mc-backup/daily. Nothing in
# the name is ever run or interpreted, and every step below is fixed:
#
#   1. Find the active world (level-name in Minecraft-Premium's server.properties) and the matching
#      folders in the snapshot: <level>, <level>_nether, <level>_the_end. Nothing else is restored;
#      plugins and config stay as they are.
#   2. Make sure nobody is online (server-list ping), then extract those folders here on arm-free.
#   3. Stop Minecraft: sudo -n /usr/bin/systemctl stop minecraft (needs the sudoers drop-in in
#      scripts/beacon-minecraft.sudoers), and wait until no java process and no tmux "mc" remain.
#   4. Move the current folders to ~/mc-pre-restore/<time>/ on Minecraft-Premium (the last 2 are kept).
#   5. rsync the snapshot's folders into place. If that fails, the previous world is moved back.
#   6. Leave Minecraft stopped. Restart it from Beacon (Restart) when you are ready.
#
# Prints progress, then a last line "OK: ..." (exit 0) or "FAILED: <reason>" (exit 1).
# Settings come from ~/.config/beacon/agent.env (see scripts/mc-agent-env.example).
# ==============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${BEACON_AGENT_ENV:-$HOME/.config/beacon/agent.env}"
ENV_KEYS=" PREMIUM_SSH MC_REMOTE_DIR BACKUP_ROOT MC_HOST MC_PORT PRE_RESTORE_DIR "

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] restore: $*"; }
fail() { echo "FAILED: $*"; exit 1; }

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

PREMIUM_SSH="${PREMIUM_SSH:-ubuntu@10.0.0.16}"
MC_REMOTE_DIR="${MC_REMOTE_DIR:-/home/ubuntu/minecraft}"
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/mc-backup}"
MC_HOST="${MC_HOST:-10.0.0.16}"
MC_PORT="${MC_PORT:-25565}"
# On Minecraft-Premium, outside the server folder so ~/mc-backup.sh does not copy it
PRE_RESTORE_DIR="${PRE_RESTORE_DIR:-/home/ubuntu/mc-pre-restore}"
DAILY="$BACKUP_ROOT/daily"
WORK="$BACKUP_ROOT/restore-work"
KEEP_PRE=2
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=8)

CHECK=0
if [ "${1:-}" = "--check" ]; then
  CHECK=1
  shift
fi
REQUESTED="${1:-}"

# Run a fixed command on Minecraft-Premium; every argument is quoted for the remote shell
remote() {
  ssh "${SSH_OPTS[@]}" "$PREMIUM_SSH" "$(printf '%q ' "$@")"
}

# --- 1. Validate the request against real files --------------------------------------------------

[[ "$REQUESTED" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] || fail "Not a valid snapshot name."
SNAPSHOT=""
while IFS= read -r -d '' path; do
  if [ "${path##*/}" = "$REQUESTED" ]; then SNAPSHOT="$path"; fi
done < <(find "$DAILY" -maxdepth 1 -type f -print0 2>/dev/null)
[ -n "$SNAPSHOT" ] || fail "Snapshot $REQUESTED is not in $DAILY."

case "$SNAPSHOT" in
  *.tar.zst | *.tzst)
    command -v zstd >/dev/null 2>&1 || fail "zstd is not installed on arm-free (sudo apt-get install -y zstd)."
    COMPRESS=(--zstd) ;;
  *.tar.gz | *.tgz) COMPRESS=(-z) ;;
  *.tar) COMPRESS=() ;;
  *) fail "Unknown archive type: $REQUESTED" ;;
esac

remote true || fail "Minecraft-Premium is not reachable over SSH. Is the VM running?"

LEVEL="$(remote grep -m 1 '^level-name=' "$MC_REMOTE_DIR/server.properties" 2>/dev/null | cut -d= -f2- | tr -d '\r')"
LEVEL="${LEVEL:-world}"
[[ "$LEVEL" =~ ^[A-Za-z0-9][A-Za-z0-9._\ -]{0,63}$ ]] || fail "Unexpected level-name in server.properties."
log "Active world: $LEVEL"

# Find <level>/level.dat in the archive; whatever comes before it is the archive's own prefix
mapfile -t ENTRIES < <(tar "${COMPRESS[@]}" -tf "$SNAPSHOT" 2>/dev/null)
[ "${#ENTRIES[@]}" -gt 0 ] || fail "Could not read $REQUESTED (damaged archive?)."
PREFIXES=()
for entry in "${ENTRIES[@]}"; do
  case "$entry" in
    "$LEVEL/level.dat") PREFIXES+=("") ;;
    */"$LEVEL/level.dat") PREFIXES+=("${entry%"$LEVEL/level.dat"}") ;;
  esac
done
[ "${#PREFIXES[@]}" -eq 1 ] || fail "Expected one $LEVEL/level.dat in the snapshot, found ${#PREFIXES[@]}."
PREFIX="${PREFIXES[0]}"
case "/$PREFIX" in */../* | *//*) fail "Unsafe path inside the snapshot." ;; esac
STRIP=0
if [ -n "$PREFIX" ]; then STRIP="$(awk -F/ '{print NF-1}' <<<"$PREFIX")"; fi

DIMENSIONS=()
for dim in "$LEVEL" "${LEVEL}_nether" "${LEVEL}_the_end"; do
  for entry in "${ENTRIES[@]}"; do
    if [ "${entry#"$PREFIX$dim/"}" != "$entry" ]; then
      DIMENSIONS+=("$dim")
      break
    fi
  done
done
log "Snapshot $REQUESTED holds: ${DIMENSIONS[*]}"

if [ "$CHECK" -eq 1 ]; then
  echo "OK: would stop Minecraft, keep the current ${DIMENSIONS[*]} in $PRE_RESTORE_DIR, and restore them from $REQUESTED."
  exit 0
fi

# Same lock as every backup, so ~/mc-backup.sh never copies a half-restored world. mc-agent.sh
# already holds it when it runs this, and says so with BEACON_LOCK_HELD.
if [ -z "${BEACON_LOCK_HELD:-}" ]; then
  exec 9>>"$BACKUP_ROOT/.lock"
  flock -w 1800 9 || fail "Timed out waiting for a running backup to finish. Nothing was changed."
fi

# --- 2. Nobody online, then extract here --------------------------------------------------------

if command -v python3 >/dev/null 2>&1 && [ -f "$SCRIPT_DIR/mc-probe.py" ]; then
  PING="$(timeout 20 python3 "$SCRIPT_DIR/mc-probe.py" ping --host "$MC_HOST" --port "$MC_PORT" 2>/dev/null)"
  if [[ "$PING" =~ \"count\":([0-9]+) ]] && [ "${BASH_REMATCH[1]}" -gt 0 ]; then
    fail "${BASH_REMATCH[1]} player(s) joined since the restore was requested. Nothing was changed."
  fi
fi

rm -rf "$WORK"
mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT
MEMBERS=()
for dim in "${DIMENSIONS[@]}"; do MEMBERS+=("$PREFIX$dim"); done
log "Extracting ${DIMENSIONS[*]}..."
tar "${COMPRESS[@]}" -xf "$SNAPSHOT" -C "$WORK" --strip-components="$STRIP" --no-same-owner -- "${MEMBERS[@]}" \
  || fail "Could not extract the snapshot. Nothing was changed."
[ -f "$WORK/$LEVEL/level.dat" ] || fail "The extracted world has no level.dat. Nothing was changed."

# --- 3. Stop Minecraft --------------------------------------------------------------------------

log "Stopping Minecraft (minecraft.service)..."
remote sudo -n /usr/bin/systemctl stop minecraft \
  || fail "Could not stop Minecraft with sudo. Is scripts/beacon-minecraft.sudoers installed on Minecraft-Premium? Nothing was changed."
# Stopped means: no java process and no tmux session "mc" (ExecStop waits for both)
STOPPED_CHECK='if pgrep -x java >/dev/null; then exit 1; fi; if tmux has-session -t mc 2>/dev/null; then exit 1; fi; exit 0'
STOPPED=0
for _ in $(seq 1 36); do
  if ssh "${SSH_OPTS[@]}" "$PREMIUM_SSH" "$STOPPED_CHECK" 2>/dev/null; then
    STOPPED=1
    break
  fi
  sleep 5
done
[ "$STOPPED" -eq 1 ] || fail "Minecraft did not stop within 3 minutes. Nothing was restored; check minecraft.service."
log "Minecraft is stopped."

# --- 4. Keep the current world aside, 5. copy the snapshot in ----------------------------------

STAMP="$(date -u +%Y%m%d-%H%M%S)"

# Runs on Minecraft-Premium with fixed arguments: move the current folders aside, keep the newest 2
PRESERVE='
set -eu
level="$1"; dir="$2"; pre="$3"; stamp="$4"; keep="$5"
mkdir -p "$pre/$stamp"
for d in "$level" "${level}_nether" "${level}_the_end"; do
  if [ -e "$dir/$d" ]; then mv -- "$dir/$d" "$pre/$stamp/$d"; fi
done
ls -1d "$pre"/*/ 2>/dev/null | sort -r | tail -n +"$((keep + 1))" | while IFS= read -r old; do rm -rf -- "$old"; done
'

# Undo: put the moved folders back (used only when the copy fails)
ROLLBACK='
set -u
level="$1"; dir="$2"; pre="$3"; stamp="$4"
for d in "$level" "${level}_nether" "${level}_the_end"; do
  if [ -e "$pre/$stamp/$d" ]; then rm -rf -- "$dir/$d"; mv -- "$pre/$stamp/$d" "$dir/$d"; fi
done
'

run_remote_script() { # script args...
  local script="$1"
  shift
  ssh "${SSH_OPTS[@]}" "$PREMIUM_SSH" "bash -s -- $(printf '%q ' "$@")" <<<"$script"
}

log "Keeping the current world in $PRE_RESTORE_DIR/$STAMP..."
run_remote_script "$PRESERVE" "$LEVEL" "$MC_REMOTE_DIR" "$PRE_RESTORE_DIR" "$STAMP" "$KEEP_PRE" \
  || fail "Could not move the current world aside. Minecraft is stopped; nothing was restored."

COPY_OK=1
for dim in "${DIMENSIONS[@]}"; do
  log "Copying $dim..."
  if ! rsync -a --delete --protect-args -e "ssh ${SSH_OPTS[*]}" "$WORK/$dim/" "$PREMIUM_SSH:$MC_REMOTE_DIR/$dim/"; then
    COPY_OK=0
    break
  fi
done

if [ "$COPY_OK" -ne 1 ]; then
  if run_remote_script "$ROLLBACK" "$LEVEL" "$MC_REMOTE_DIR" "$PRE_RESTORE_DIR" "$STAMP"; then
    fail "Copying the snapshot failed; the previous world was put back. Minecraft is stopped."
  fi
  fail "Copying the snapshot failed and putting the previous world back failed too. It is in $PRE_RESTORE_DIR/$STAMP on Minecraft-Premium. Minecraft is stopped."
fi

echo "OK: restored ${DIMENSIONS[*]} from $REQUESTED. The previous world is in $PRE_RESTORE_DIR/$STAMP. Minecraft is stopped: use Restart in Beacon."
