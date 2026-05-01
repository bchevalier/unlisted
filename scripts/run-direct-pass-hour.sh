#!/bin/zsh
set -euo pipefail

ROOT="/Users/bhopdelaquiche/openclaw/agents/chawd/unlisted"
LOG_DIR="$ROOT/artifacts/cron"
RUNNER_LOG="$LOG_DIR/direct-pass-runner.log"
RUN_DATE="$(date +%Y-%m-%d)"
SESSION_ID="${1:-7a16b026-636b-41de-8a0a-505503dfbe36}"
TAG="direct-hour-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$LOG_DIR"

START_EPOCH=$(( ( $(date +%s) / 60 + 1 ) * 60 ))

echo "[$(date '+%Y-%m-%d %H:%M:%S')] scheduler $TAG starting for session $SESSION_ID" >> "$RUNNER_LOG"

for SLOT in {1..10}; do
  TARGET_EPOCH=$(( START_EPOCH + (SLOT - 1) * 360 ))
  NOW_EPOCH=$(date +%s)
  SLEEP_SECS=$(( TARGET_EPOCH - NOW_EPOCH ))
  if (( SLEEP_SECS > 0 )); then
    sleep "$SLEEP_SECS"
  fi

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] scheduler $TAG running slot $SLOT" >> "$RUNNER_LOG"
  "$ROOT/scripts/scheduled-direct-pass.sh" "$SLOT" "$RUN_DATE" "$TAG" "$SESSION_ID" >> "$RUNNER_LOG" 2>&1 || true
done

echo "[$(date '+%Y-%m-%d %H:%M:%S')] scheduler $TAG finished" >> "$RUNNER_LOG"
