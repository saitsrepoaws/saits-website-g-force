#!/bin/bash
set -e

if command -v docker >/dev/null 2>&1; then
  if docker ps --format '{{.Names}}' | grep -q '^liquidsoap$'; then
    docker restart liquidsoap >/dev/null 2>&1 || true
  fi
fi

if command -v systemctl >/dev/null 2>&1; then
  if systemctl list-units --type=service --all 2>/dev/null | grep -q 'stereotool-relay.service'; then
    systemctl restart stereotool-relay.service || true
  fi
fi

exit 0
