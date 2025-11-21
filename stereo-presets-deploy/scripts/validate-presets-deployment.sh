#!/bin/bash
set -e

BYTES=$(curl -s --max-time 5 http://localhost:8000/stream.mp3 | wc -c || echo 0)

if [ "$BYTES" -le 0 ]; then
  echo "No audio bytes received from Icecast stream on localhost:8000/stream.mp3"
  exit 1
fi

exit 0
