#!/usr/bin/env bash
# Kept so existing crontab entries keep working; see backup-world.sh.
exec bash "$(dirname "${BASH_SOURCE[0]}")/backup-world.sh" "$@"
