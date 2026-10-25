#!/usr/bin/env bash
# ==============================================================================
# Beacon - Minecraft World Save Snapshot & Cloudflare R2 Sync
# ==============================================================================
# Usage:
#   bash vm-backup-to-r2.sh
# Can be run manually, via cron, or as a systemd pre-stop service.
# ==============================================================================

set -euo pipefail

# Configuration: Update these paths if your server directory differs
MC_DIR="${MC_DIR:-/opt/minecraft}"
BACKUP_TMP_DIR="/tmp/mc-backups"
BUCKET_NAME="beacon-backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
ARCHIVE_NAME="world-${TIMESTAMP}.tar.gz"
LATEST_NAME="world-latest.tar.gz"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Beacon world backup..."

# 1. Flush chunks to disk if server is running in screen/tmux
if command -v screen >/dev/null 2>&1 && screen -list | grep -q "minecraft"; then
    echo "Flushing world data to disk via screen session..."
    screen -S minecraft -X stuff "save-all flush^M"
    sleep 3
elif command -v tmux >/dev/null 2>&1 && tmux has-session -t minecraft 2>/dev/null; then
    echo "Flushing world data to disk via tmux session..."
    tmux send-keys -t minecraft "save-all flush" ENTER
    sleep 3
fi

# 2. Create temp backup directory
mkdir -p "$BACKUP_TMP_DIR"
cd "$MC_DIR"

echo "Creating compressed tarball of world files..."
# Archives overworld, nether, the end, and configuration
tar -czf "${BACKUP_TMP_DIR}/${ARCHIVE_NAME}" \
    --exclude="*.log" \
    --exclude="*.log.gz" \
    world world_nether world_the_end server.properties whitelist.json ops.json 2>/dev/null || \
tar -czf "${BACKUP_TMP_DIR}/${ARCHIVE_NAME}" \
    world server.properties 2>/dev/null

cp "${BACKUP_TMP_DIR}/${ARCHIVE_NAME}" "${BACKUP_TMP_DIR}/${LATEST_NAME}"
ARCHIVE_SIZE=$(du -h "${BACKUP_TMP_DIR}/${LATEST_NAME}" | cut -f1)
echo "Archive created successfully: ${ARCHIVE_NAME} (${ARCHIVE_SIZE})"

# 3. Upload to Cloudflare R2
if command -v rclone >/dev/null 2>&1; then
    echo "Uploading to Cloudflare R2 via rclone..."
    rclone copy "${BACKUP_TMP_DIR}/${LATEST_NAME}" "r2:${BUCKET_NAME}/"
    rclone copy "${BACKUP_TMP_DIR}/${ARCHIVE_NAME}" "r2:${BUCKET_NAME}/archives/"
    echo "Upload complete! World save is now available on Beacon."
elif command -v aws >/dev/null 2>&1; then
    echo "Uploading to Cloudflare R2 via aws-cli..."
    # Assumes AWS_ENDPOINT_URL is set to Cloudflare R2 endpoint
    aws s3 cp "${BACKUP_TMP_DIR}/${LATEST_NAME}" "s3://${BUCKET_NAME}/${LATEST_NAME}"
    aws s3 cp "${BACKUP_TMP_DIR}/${ARCHIVE_NAME}" "s3://${BUCKET_NAME}/archives/${ARCHIVE_NAME}"
    echo "Upload complete! World save is now available on Beacon."
else
    echo "Notice: Neither rclone nor aws-cli found."
    echo "The backup is saved locally at ${BACKUP_TMP_DIR}/${LATEST_NAME}."
    echo "Install rclone to auto-sync to Cloudflare R2: curl https://rclone.org/install.sh | sudo bash"
fi

# 4. Clean up local backups older than 3 days to save disk space
find "$BACKUP_TMP_DIR" -name "world-*.tar.gz" -mtime +3 -delete 2>/dev/null || true
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup finished."
