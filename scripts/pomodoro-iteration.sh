#!/bin/zsh
set -euo pipefail

ROOT="/Users/bhopdelaquiche/openclaw/agents/chawd/unlisted"
cd "$ROOT"

LOCKDIR="$ROOT/.pomodoro.lock"
LOGDIR="$ROOT/artifacts/pomodoro"
mkdir -p "$LOGDIR"

if ! mkdir "$LOCKDIR" 2>/dev/null; then
  echo "[$(date -Iseconds)] pomodoro skipped: lock held" >> "$LOGDIR/pomodoro.log"
  exit 0
fi
trap 'rmdir "$LOCKDIR" >/dev/null 2>&1 || true' EXIT

NEXT_ITEM=$(node "$ROOT/scripts/pomodoro-next-item.mjs")
START_TS=$(date -Iseconds)

echo "[$START_TS] starting pomodoro: $NEXT_ITEM" >> "$LOGDIR/pomodoro.log"

openclaw message send \
  --channel telegram \
  --account chawd \
  --target 5796798150 \
  --message "[[reply_to_current]] Pomodoro started: $NEXT_ITEM" >/dev/null 2>&1 || true

PROMPT=$(cat <<'EOF'
Pomodoro iteration trigger.

Follow this exact loop:
1. Read KNOKIO_DIRECT_MVP_TODO_8_PLUS.md.
2. Pick the next unchecked item.
3. Implement it in the repo.
4. Add/update tests for the new or changed behavior.
5. Run the single full-suite command: npm run test:all
6. Fix any failures caused by your changes before finishing.
7. Avoid any tests or flows that cost money or require paid external APIs. Use local/dummy requests and fixtures instead. It is fine to generate dummy requests yourself. Do not rely on OpenAI API keys for tests.
8. If all todo items are complete, then:
   a) audit test coverage completeness and add unchecked tasks for missing tests,
   b) reassess whether the MVP is 8+/10 and add new 4h tasks if not,
   c) reassess optimization/constraints and add new 4h tasks if needed,
   d) if everything is complete and good, notify John.

In your final reply to John:
- say which todo item you worked on,
- what changed,
- what tests were added/updated,
- whether npm run test:all passed,
- what the next unchecked item is.

Be concise and execution-focused.
EOF
)

openclaw agent \
  --agent chawd \
  --message "$PROMPT" \
  --deliver \
  --reply-channel telegram \
  --reply-account chawd \
  --reply-to 5796798150 \
  --timeout 1700 >> "$LOGDIR/pomodoro.log" 2>&1 || true

END_TS=$(date -Iseconds)
echo "[$END_TS] completed pomodoro: $NEXT_ITEM" >> "$LOGDIR/pomodoro.log"
