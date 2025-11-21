#!/bin/bash
set -e

SRC_DIR="/data/stereotool"
BACKUP_ROOT="/data/stereotool/backups"
TS="$(date +%Y%m%d-%H%M%S)"

if [ -d "$SRC_DIR" ]; then
  mkdir -p "$BACKUP_ROOT/$TS"
  cp -a "$SRC_DIR"/*.sts "$BACKUP_ROOT/$TS/" 2>/dev/null || true
fi

exit 0
