#!/usr/bin/env bash
# ==============================================================================
# Beacon - backup agent for arm-free
# ==============================================================================
# Beacon cannot reach arm-free, and arm-free opens no ports: this script calls Beacon over
# HTTPS instead. Beacon's answer is only ever { "backup": true | false }; it never sends commands.
#
#   mc-agent.sh poll        every minute from cron. Sends a heartbeat; when someone pressed
#                           "Backup now", runs a backup and reports the result.
#   mc-agent.sh scheduled   every 30 minutes from cron, in place of calling ~/mc-backup.sh
#                           directly. Runs the regular backup and reports it.
#
# A backup is: (optionally) pause autosave on Minecraft-Premium and flush the world, run
# ~/mc-backup.sh (the rsync pull), turn autosave back on, then pack-and-upload.sh so the
# dashboard's download has the new copy. Every backup holds an flock on ~/mc-backup/.lock, so
# runs never overlap.
#
# Config: ~/.config/beacon/agent.env (chmod 600), KEY=value lines, see scripts/mc-agent-env.example
#   BEACON_URL        https://<your dashboard>
#   AGENT_TOKEN       same value as the AGENT_TOKEN secret in Beacon
#   UPLOAD_URL        Object Storage pre-authenticated request with write access (ends in /o/)
#   PREMIUM_SSH       ssh target for Minecraft-Premium       default ubuntu@10.0.0.16
#   MC_TMUX_SESSION   tmux session running the server         default mc (empty: skip the flush)
#   MC_REMOTE_DIR     server folder on Minecraft-Premium      default /home/ubuntu/minecraft
#   BACKUP_ROOT       default ~/mc-backup
#   BACKUP_CMD        default ~/mc-backup.sh
#   MC_HOST           Minecraft-Premium's private IP           default 10.0.0.16
#   MC_PORT           Minecraft port                           default 25565
#
# Output goes to ~/mc-backup/agent.log (trimmed to the last 200 KB past 1 MB) unless you run it
# in a terminal. The token and upload URL are never printed or put on a command line.
# ==============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${BEACON_AGENT_ENV:-$HOME/.config/beacon/agent.env}"
ENV_KEYS=" BEACON_URL AGENT_TOKEN UPLOAD_URL PREMIUM_SSH MC_TMUX_SESSION MC_REMOTE_DIR BACKUP_ROOT BACKUP_CMD MC_HOST MC_PORT "

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] agent: $*"; }

# KEY=value lines only; nothing in the file is executed. The environment wins over the file.
load_env() {
  [ -f "$ENV_FILE" ] || return 0
  if [ -n "$(find "$ENV_FILE" -perm /077 2>/dev/null)" ]; then
    log "Error: $ENV_FILE can be read by other users. Run: chmod 600 $ENV_FILE" >&2
    exit 1
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

MODE="${1:-}"
BEACON_URL="${BEACON_URL:-}"
AGENT_TOKEN="${AGENT_TOKEN:-}"
PREMIUM_SSH="${PREMIUM_SSH:-ubuntu@10.0.0.16}"
MC_HOST="${MC_HOST:-10.0.0.16}"
MC_PORT="${MC_PORT:-25565}"
MC_TMUX_SESSION="${MC_TMUX_SESSION-mc}"
MC_REMOTE_DIR="${MC_REMOTE_DIR:-/home/ubuntu/minecraft}"
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/mc-backup}"
BACKUP_CMD="${BACKUP_CMD:-$HOME/mc-backup.sh}"
export BACKUP_ROOT

LOCK_FILE="$BACKUP_ROOT/.lock"
LAST_SUCCESS_FILE="$BACKUP_ROOT/.last_success"
ARCHIVE="$BACKUP_ROOT/upload/world-latest.tar.gz"
LOG_FILE="$BACKUP_ROOT/agent.log"
# How long a requested backup waits for a scheduled one that is already running
LOCK_WAIT=1800
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=8)

mkdir -p "$BACKUP_ROOT"

# Log to a file when cron runs us, to the terminal when you do
if [ ! -t 1 ]; then
  if [ -f "$LOG_FILE" ] && [ "$(stat -c %s "$LOG_FILE")" -gt 1048576 ]; then
    tail -c 204800 "$LOG_FILE" > "$LOG_FILE.tmp" && mv -f "$LOG_FILE.tmp" "$LOG_FILE"
  fi
  exec >>"$LOG_FILE" 2>&1
fi

for tool in curl flock; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    log "Error: $tool is not installed (sudo apt-get install -y curl util-linux)."
    exit 1
  fi
done

# --- Talking to Beacon ------------------------------------------------------------------------

beacon_ready() {
  [ -n "$BEACON_URL" ] && [ -n "$AGENT_TOKEN" ] || { log "BEACON_URL or AGENT_TOKEN missing in $ENV_FILE"; return 1; }
  case "$BEACON_URL" in https://*) ;; *) log "BEACON_URL must start with https://"; return 1 ;; esac
}

# POST JSON to a Beacon route. The token goes in through a curl config file descriptor, not argv.
api() {
  curl --fail --silent --show-error --connect-timeout 10 --max-time 30 --retry 2 --retry-delay 5 \
       -H 'Content-Type: application/json' --data-binary "$2" \
       -K <(printf 'header = "Authorization: Bearer %s"\nurl = "%s%s"\n' "$AGENT_TOKEN" "${BEACON_URL%/}" "$1")
}

# A JSON string (or null), single line, at most 200 characters
json_str() {
  [ -n "${1:-}" ] || { printf 'null'; return; }
  local s="${1:0:200}"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="$(printf '%s' "$s" | tr -d '\000-\037')"
  printf '"%s"' "$s"
}

# When ~/mc-backup.sh last succeeded, as ISO 8601 UTC. The file holds a time; fall back to its mtime.
last_success_iso() {
  [ -f "$LAST_SUCCESS_FILE" ] || return 0
  local raw
  raw="$(head -c 100 "$LAST_SUCCESS_FILE" | tr -d '\r\n')"
  if [[ "$raw" =~ ^[0-9]{9,11}$ ]]; then
    date -u -d "@$raw" +%Y-%m-%dT%H:%M:%SZ
  elif [ -n "$raw" ] && date -u -d "$raw" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null; then
    :
  else
    date -u -r "$LAST_SUCCESS_FILE" +%Y-%m-%dT%H:%M:%SZ
  fi
}

# Extra poll fields from scripts/mc-probe.py: Minecraft's status and who is online, probed over the
# private IP. The probe prints one line of JSON (or null); Beacon validates it strictly anyway.
probe_fields() {
  command -v python3 >/dev/null 2>&1 || return 0
  [ -f "$SCRIPT_DIR/mc-probe.py" ] || return 0
  local mc
  mc="$(timeout 15 python3 "$SCRIPT_DIR/mc-probe.py" ping --host "$MC_HOST" --port "$MC_PORT" 2>/dev/null | head -c 6000)"
  [ -n "$mc" ] || mc=null
  printf ',"minecraft":%s' "$mc"
}

heartbeat_json() {
  local busy="$1" last size cron sched
  last="$(last_success_iso)"
  size="$(stat -c %s "$ARCHIVE" 2>/dev/null || true)"
  if command -v systemctl >/dev/null 2>&1; then
    systemctl is-active --quiet cron && cron=true || cron=false
  else
    cron=null
  fi
  crontab -l 2>/dev/null | grep -Eq '^[^#]*mc-agent\.sh[[:space:]]+scheduled' && sched=true || sched=false
  printf '{"lastSuccess":%s,"archiveBytes":%s,"busy":%s,"cronActive":%s,"scheduleInstalled":%s%s}' \
    "$(json_str "$last")" "${size:-null}" "$busy" "$cron" "$sched" "$(probe_fields)"
}

report() { # trigger ok [error]
  beacon_ready || return 0
  local size body
  size="$(stat -c %s "$ARCHIVE" 2>/dev/null || true)"
  body="$(printf '{"trigger":"%s","ok":%s,"finishedAt":"%s","sizeBytes":%s,"error":%s}' \
    "$1" "$2" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${size:-null}" "$(json_str "${3:-}")")"
  if api /api/agent/report "$body" >/dev/null; then
    log "Reported to Beacon: trigger=$1 ok=$2${3:+ ($3)}"
  else
    log "Could not send the report to Beacon."
  fi
}

# --- Minecraft-Premium: pause autosave and flush, then always turn it back on ------------------

SAVES_PAUSED=0

# Runs on Minecraft-Premium as ubuntu (the user that owns the tmux session).
# Exit 0: paused and flushed. 2: no tmux session, nothing done. 3: paused, but no
# "Saved the game" in logs/latest.log within 30 seconds.
REMOTE_PAUSE='
session="$1"; dir="$2"; log="$dir/logs/latest.log"
tmux has-session -t "$session" 2>/dev/null || exit 2
start=$(stat -c %s "$log" 2>/dev/null || echo 0)
tmux send-keys -t "$session" "save-off" Enter
tmux send-keys -t "$session" "save-all flush" Enter
for _ in $(seq 1 30); do
  sleep 1
  now=$(stat -c %s "$log" 2>/dev/null || echo 0)
  [ "$now" -lt "$start" ] && start=0
  tail -c +"$((start + 1))" "$log" 2>/dev/null | grep -q "Saved the game" && exit 0
done
exit 3
'

pause_saves() {
  [ -n "$MC_TMUX_SESSION" ] || return 0
  local rc
  ssh "${SSH_OPTS[@]}" "$PREMIUM_SSH" "bash -s -- $(printf '%q ' "$MC_TMUX_SESSION" "$MC_REMOTE_DIR")" <<<"$REMOTE_PAUSE"
  rc=$?
  case "$rc" in
    0) SAVES_PAUSED=1; log "Autosave paused and world flushed on Minecraft-Premium." ;;
    3) SAVES_PAUSED=1; log "Autosave paused, but the flush was not confirmed within 30s; copying anyway." ;;
    2) log "No tmux session '$MC_TMUX_SESSION' on Minecraft-Premium; copying the files as they are." ;;
    255) log "Minecraft-Premium is not reachable over SSH; skipping the flush." ;;
    *) SAVES_PAUSED=1; log "Pausing autosave returned $rc; will still send save-on afterwards." ;;
  esac
}

resume_saves() {
  [ "$SAVES_PAUSED" -eq 1 ] || return 0
  SAVES_PAUSED=0
  if ssh "${SSH_OPTS[@]}" "$PREMIUM_SSH" \
       "$(printf '%q ' tmux has-session -t "$MC_TMUX_SESSION") && $(printf '%q ' tmux send-keys -t "$MC_TMUX_SESSION" save-on Enter)"; then
    log "Autosave back on."
  else
    log "WARNING: could not send save-on. The next backup retries; or run: tmux send-keys -t $MC_TMUX_SESSION save-on Enter"
  fi
}

# Autosave comes back on however this script ends
trap resume_saves EXIT
trap 'resume_saves; exit 130' INT TERM

premium_reachable() {
  ssh "${SSH_OPTS[@]}" "$PREMIUM_SSH" true >/dev/null 2>&1
}

# --- One backup (the caller holds the lock on fd 9) ---------------------------------------------

run_backup() {
  local trigger="$1" before after rc prc error="" nodata=0
  export BEACON_LOCK_HELD=1
  before="$(stat -c %Y "$LAST_SUCCESS_FILE" 2>/dev/null || echo none)"

  pause_saves
  log "Running $BACKUP_CMD"
  "$BACKUP_CMD"
  rc=$?
  resume_saves
  after="$(stat -c %Y "$LAST_SUCCESS_FILE" 2>/dev/null || echo none)"

  # Success means .last_success moved. If it did not, either Minecraft-Premium is off (normal,
  # mc-backup.sh exits harmlessly) or the copy failed.
  if [ "$before" = "$after" ]; then
    if [ "$rc" -ne 0 ] && premium_reachable; then
      error="mc-backup.sh failed (exit $rc). See ~/mc-backup/agent.log on arm-free."
    else
      nodata=1
    fi
  fi

  # Keep the download fresh: uploads only when there is a backup newer than the last upload
  "$SCRIPT_DIR/pack-and-upload.sh"
  prc=$?
  if [ "$prc" -ne 0 ] && [ "$prc" -ne 3 ]; then
    error="${error:+$error }Packing or uploading failed (exit $prc)."
  fi

  if [ -n "$error" ]; then
    log "Backup failed: $error"
    report "$trigger" false "$error"
    return 1
  fi
  if [ "$nodata" -eq 1 ]; then
    if [ "$trigger" = "scheduled" ]; then
      # Premium is off: nothing to report every 30 minutes
      log "Minecraft-Premium is off or unreachable; nothing new to copy."
      return 0
    fi
    report requested false "Minecraft-Premium is off or unreachable, so there was nothing new to copy. The download still has the last backup."
    return 0
  fi
  log "Backup finished."
  report "$trigger" true
}

# --- Modes ------------------------------------------------------------------------------------

case "$MODE" in
  poll)
    beacon_ready || exit 1
    busy=false
    flock -n "$LOCK_FILE" true 2>/dev/null || busy=true
    if ! resp="$(api /api/agent/poll "$(heartbeat_json "$busy")")"; then
      log "Poll failed: Beacon unreachable or it refused the token."
      exit 1
    fi
    [[ "$resp" == *'"backup":true'* ]] || exit 0

    log "Beacon asked for a backup."
    exec 9>>"$LOCK_FILE"
    if ! flock -w "$LOCK_WAIT" 9; then
      report requested false "Timed out waiting for another backup to finish."
      exit 1
    fi
    run_backup requested
    ;;
  scheduled)
    exec 9>>"$LOCK_FILE"
    if ! flock -n 9; then
      log "Another backup is running; skipping this scheduled run."
      exit 0
    fi
    run_backup scheduled
    ;;
  *)
    echo "Usage: $0 poll|scheduled" >&2
    exit 2
    ;;
esac
