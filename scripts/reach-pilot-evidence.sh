#!/usr/bin/env bash
# =============================================================================
# Knokio Reach — Pilot Evidence Capture
#
# Appends structured JSONL evidence records to pilot-evidence/reach-pilot-log.jsonl
#
# Usage:
#   ./scripts/reach-pilot-evidence.sh <event-type> <handle> [key=value ...]
#   ./scripts/reach-pilot-evidence.sh --summary
#   ./scripts/reach-pilot-evidence.sh --validate
#
# Examples:
#   ./scripts/reach-pilot-evidence.sh PRE_FLIGHT system validateResult=PASS smokeResult=PASS serverUrl=http://localhost:3333
#   ./scripts/reach-pilot-evidence.sh ACTOR_REGISTERED acme-summarizer actorType=AI_AGENT operatorName="Acme AI Labs"
#   ./scripts/reach-pilot-evidence.sh DAILY_CHECK acme-summarizer day=3 contractsReceived=12 issues=none
#   ./scripts/reach-pilot-evidence.sh --summary
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
EVIDENCE_DIR="${PROJECT_ROOT}/pilot-evidence"
LOG_FILE="${EVIDENCE_DIR}/reach-pilot-log.jsonl"

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
NC='\033[0m'

VALID_EVENTS=(
  "PRE_FLIGHT"
  "BASELINE_METRICS"
  "ACTOR_REGISTERED"
  "CONFIG_COMPLETE"
  "DAILY_CHECK"
  "INCIDENT"
  "METRICS_SNAPSHOT"
  "GRADUATION"
  "ROLLBACK"
  "PILOT_CLOSE"
)

# ---------------------------------------------------------------------------
# Ensure evidence directory and log file exist
# ---------------------------------------------------------------------------
ensure_log() {
  mkdir -p "$EVIDENCE_DIR"
  if [ ! -f "$LOG_FILE" ]; then
    touch "$LOG_FILE"
    echo -e "${CYAN}Created evidence log:${NC} $LOG_FILE"
  fi
}

# ---------------------------------------------------------------------------
# Show summary of evidence log
# ---------------------------------------------------------------------------
show_summary() {
  ensure_log

  if [ ! -s "$LOG_FILE" ]; then
    echo -e "${YELLOW}Evidence log is empty.${NC}"
    exit 0
  fi

  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}  Reach Pilot Evidence Summary${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  TOTAL=$(wc -l < "$LOG_FILE" | tr -d ' ')
  echo -e "  Total records: ${GREEN}${TOTAL}${NC}"
  echo ""

  echo -e "  ${CYAN}By event type:${NC}"
  if command -v jq &>/dev/null; then
    jq -r '.eventType' "$LOG_FILE" | sort | uniq -c | sort -rn | while read count event; do
      printf "    %-24s %s\n" "$event" "$count"
    done
  else
    grep -o '"eventType":"[^"]*"' "$LOG_FILE" | sort | uniq -c | sort -rn
  fi

  echo ""
  echo -e "  ${CYAN}By handle:${NC}"
  if command -v jq &>/dev/null; then
    jq -r '.handle // "system"' "$LOG_FILE" | sort | uniq -c | sort -rn | while read count handle; do
      printf "    %-24s %s\n" "$handle" "$count"
    done
  else
    grep -o '"handle":"[^"]*"' "$LOG_FILE" | sort | uniq -c | sort -rn
  fi

  echo ""
  echo -e "  ${CYAN}Recent records (last 5):${NC}"
  if command -v jq &>/dev/null; then
    tail -5 "$LOG_FILE" | jq -c '{t: .timestamp, e: .eventType, h: .handle}'
  else
    tail -5 "$LOG_FILE"
  fi

  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ---------------------------------------------------------------------------
# Validate all records in the log
# ---------------------------------------------------------------------------
validate_log() {
  ensure_log

  if [ ! -s "$LOG_FILE" ]; then
    echo -e "${YELLOW}Evidence log is empty — nothing to validate.${NC}"
    exit 0
  fi

  ERRORS=0
  LINE=0

  while IFS= read -r record; do
    LINE=$((LINE + 1))

    if ! echo "$record" | jq empty 2>/dev/null; then
      echo -e "${RED}Line $LINE: Invalid JSON${NC}"
      ERRORS=$((ERRORS + 1))
      continue
    fi

    EVENT_TYPE=$(echo "$record" | jq -r '.eventType // "MISSING"')
    TIMESTAMP=$(echo "$record" | jq -r '.timestamp // "MISSING"')

    if [ "$EVENT_TYPE" = "MISSING" ]; then
      echo -e "${RED}Line $LINE: Missing eventType${NC}"
      ERRORS=$((ERRORS + 1))
    fi

    if [ "$TIMESTAMP" = "MISSING" ]; then
      echo -e "${RED}Line $LINE: Missing timestamp${NC}"
      ERRORS=$((ERRORS + 1))
    fi
  done < "$LOG_FILE"

  if [ "$ERRORS" -eq 0 ]; then
    echo -e "${GREEN}All $LINE records are valid ✓${NC}"
  else
    echo -e "${RED}$ERRORS error(s) found in $LINE records${NC}"
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Main: append an evidence record
# ---------------------------------------------------------------------------

# Handle flags
if [ "${1:-}" = "--summary" ]; then
  show_summary
  exit 0
fi

if [ "${1:-}" = "--validate" ]; then
  validate_log
  exit 0
fi

if [ $# -lt 2 ]; then
  echo "Usage: $0 <event-type> <handle> [key=value ...]"
  echo "       $0 --summary"
  echo "       $0 --validate"
  echo ""
  echo "Valid event types: ${VALID_EVENTS[*]}"
  exit 1
fi

EVENT_TYPE="$1"
HANDLE="$2"
shift 2

# Validate event type
VALID=false
for e in "${VALID_EVENTS[@]}"; do
  if [ "$e" = "$EVENT_TYPE" ]; then
    VALID=true
    break
  fi
done

if [ "$VALID" = "false" ]; then
  echo -e "${RED}Invalid event type:${NC} $EVENT_TYPE"
  echo "Valid types: ${VALID_EVENTS[*]}"
  exit 1
fi

# Build the data object from key=value pairs
DATA_JSON="{}"
for pair in "$@"; do
  KEY="${pair%%=*}"
  VALUE="${pair#*=}"

  # Try to parse as number or boolean, else treat as string
  if [[ "$VALUE" =~ ^[0-9]+\.?[0-9]*$ ]]; then
    DATA_JSON=$(echo "$DATA_JSON" | jq --arg k "$KEY" --argjson v "$VALUE" '. + {($k): $v}')
  elif [ "$VALUE" = "true" ] || [ "$VALUE" = "false" ]; then
    DATA_JSON=$(echo "$DATA_JSON" | jq --arg k "$KEY" --argjson v "$VALUE" '. + {($k): $v}')
  else
    DATA_JSON=$(echo "$DATA_JSON" | jq --arg k "$KEY" --arg v "$VALUE" '. + {($k): $v}')
  fi
done

# Build the full record
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
RECORDED_BY="${RECORDED_BY:-$(whoami)}"

RECORD=$(jq -n \
  --arg version "1" \
  --arg eventType "$EVENT_TYPE" \
  --arg timestamp "$TIMESTAMP" \
  --arg recordedBy "$RECORDED_BY" \
  --arg pilotId "reach-v1-pilot" \
  --arg handle "$HANDLE" \
  --argjson data "$DATA_JSON" \
  '{
    version: $version,
    eventType: $eventType,
    timestamp: $timestamp,
    recordedBy: $recordedBy,
    pilotId: $pilotId,
    handle: $handle,
    data: $data
  }')

# Append to log
ensure_log
echo "$RECORD" >> "$LOG_FILE"

echo -e "${GREEN}✓${NC} Recorded ${CYAN}${EVENT_TYPE}${NC} for ${CYAN}${HANDLE}${NC} at ${TIMESTAMP}"
