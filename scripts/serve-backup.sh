#!/usr/bin/env bash
# ==============================================================================
# Beacon - Direct World Save Pack & Download Server (100% Free)
# ==============================================================================
# Packs the Minecraft world save and serves it on port 8080 for direct download.
# Run on your Oracle VM:
#   bash serve-backup.sh
# ==============================================================================

set -euo pipefail

MC_DIR="${MC_DIR:-/opt/minecraft}"
cd "$MC_DIR"

echo "[$(date '+%H:%M:%S')] Flushing live world data to disk..."
if command -v screen >/dev/null 2>&1 && screen -list | grep -q "minecraft"; then
    screen -S minecraft -X stuff "save-all flush^M"
    sleep 2
elif command -v tmux >/dev/null 2>&1 && tmux has-session -t minecraft 2>/dev/null; then
    tmux send-keys -t minecraft "save-all flush" ENTER
    sleep 2
fi

echo "[$(date '+%H:%M:%S')] Compressing world files into world-latest.tar.gz..."
tar -czf world-latest.tar.gz \
    --exclude="*.log" \
    --exclude="*.log.gz" \
    world world_nether world_the_end server.properties whitelist.json ops.json 2>/dev/null || \
tar -czf world-latest.tar.gz \
    world server.properties 2>/dev/null

ARCHIVE_SIZE=$(du -h world-latest.tar.gz | cut -f1)
echo "[$(date '+%H:%M:%S')] Snapshot created successfully (${ARCHIVE_SIZE})."
echo "[$(date '+%H:%M:%S')] Serving direct download on port 8080..."
echo "Click 'DOWNLOAD SAVE (.TAR.GZ)' in Beacon or visit http://$(curl -s ifconfig.me):8080/world-latest.tar.gz"

python3 -m http.server 8080
