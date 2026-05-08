#!/bin/zsh
set -euo pipefail

SLOT="${1:-unknown}"
RUN_DATE="${2:-$(date +%Y-%m-%d)}"
CRON_TAG="${3:-openclaw-direct-pass-$RUN_DATE}"
SESSION_ID="${4:-7a16b026-636b-41de-8a0a-505503dfbe36}"
ROOT="/Users/bhopdelaquiche/openclaw/agents/chawd/unlisted"
LOG_DIR="$ROOT/artifacts/cron"
LOG_FILE="$LOG_DIR/direct-pass.log"
LOCK_DIR="/tmp/knokio-direct-pass.lock"

mkdir -p "$LOG_DIR"

if [[ "$(date +%Y-%m-%d)" != "$RUN_DATE" ]]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] slot $SLOT skipped: wrong date" >> "$LOG_FILE"
  exit 0
fi

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] slot $SLOT skipped: previous pass still running" >> "$LOG_FILE"
  exit 0
fi
trap 'rmdir "$LOCK_DIR" >/dev/null 2>&1 || true' EXIT

read -r -d '' MESSAGE <<EOF || true
Scheduled pass $SLOT/10 on the Knokio Direct landing page.

Goal for this automation block:
- focus first on improving the readability, simplicity, and conversion clarity of the "Simple billing" / pricing area
- if that area is already materially improved, move to the next highest-impact UI/UX or info-presentation weakness on the page
- make one substantial, reviewable improvement pass only (do not thrash multiple unrelated sections)

Required workflow:
1. Review the current /direct page in the repo and in the browser.
2. Identify the single highest-impact improvement to make right now.
3. Implement it cleanly.
4. Run npm run lint and npm test -- app/direct/page.test.ts.
5. If the page changed materially, capture a fresh screenshot of the changed area or a full-page review image.
6. Reply to John with a concise update and attach the screenshot if useful.
7. If there is no meaningful improvement to make without overfitting or degrading clarity, reply exactly NO_REPLY.

Constraints:
- stay inside /Users/bhopdelaquiche/openclaw/agents/chawd/unlisted
- do not reopen tiered pricing; BILLING.md is source of truth
- prefer clarity, reduction, and stronger business language over decorative copy
- avoid regressions and avoid introducing build-breaking edits
- think hard and do a serious pass; aim for a high-effort iteration
EOF

{
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] slot $SLOT starting"
  openclaw agent \
    --agent chawd \
    --session-id "$SESSION_ID" \
    --message "$MESSAGE" \
    --deliver \
    --thinking high \
    --timeout 900 \
    --json
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] slot $SLOT finished"
} >> "$LOG_FILE" 2>&1

if [[ "$SLOT" == "10" ]]; then
  TMP_CRON="$(mktemp)"
  crontab -l 2>/dev/null | grep -v "$CRON_TAG" > "$TMP_CRON" || true
  crontab "$TMP_CRON"
  rm -f "$TMP_CRON"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] cleaned cron entries for $CRON_TAG" >> "$LOG_FILE"
fi
