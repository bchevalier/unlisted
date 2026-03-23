#!/bin/zsh
set -euo pipefail

ROOT="/Users/bhopdelaquiche/openclaw/agents/chawd/unlisted"
cd "$ROOT"

LOGDIR="$ROOT/artifacts/pomodoro"
mkdir -p "$LOGDIR"

echo "[$(date -Iseconds)] pomodoro loop booted" >> "$LOGDIR/pomodoro.log"

sleep 30

while true; do
  "$ROOT/scripts/pomodoro-iteration.sh"
  sleep 1800
done
