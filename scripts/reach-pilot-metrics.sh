#!/usr/bin/env bash
# =============================================================================
# Knokio Reach — Pilot Metrics Capture
#
# Captures and displays pilot metrics from the Reach API. Supports:
#   - System-wide overview
#   - Per-actor metrics
#   - Threshold checks against pilot success criteria
#   - Snapshot capture for evidence log
#
# Usage:
#   ./scripts/reach-pilot-metrics.sh                              # system overview
#   ./scripts/reach-pilot-metrics.sh --actor <handle>             # per-actor metrics
#   ./scripts/reach-pilot-metrics.sh --check                      # threshold check
#   ./scripts/reach-pilot-metrics.sh --snapshot <label>           # save snapshot to evidence
#   ./scripts/reach-pilot-metrics.sh --from 2026-03-01 --to 2026-03-15  # date range
#
# Environment:
#   APP_URL       — server URL (default: http://localhost:3333)
#   REACH_API_KEY — API key for authentication (default: demo key)
# =============================================================================

set -euo pipefail

APP_URL="${APP_URL:-http://localhost:3333}"
API="${APP_URL}/api/reach"
API_KEY="${REACH_API_KEY:-knk_demo_ai_agent_key_for_local_testing_only}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
NC='\033[0m'

# Pilot success thresholds (from docs/Reach.md)
THRESHOLD_ONE_HOP_RATE=70
THRESHOLD_TIME_TO_COUNTERPARTY_SEC=300
THRESHOLD_PATH_LENGTH=3
THRESHOLD_ABUSE_RATE=1

# Parse arguments
ACTOR=""
CHECK=false
SNAPSHOT=""
FROM=""
TO=""

while [ $# -gt 0 ]; do
  case "$1" in
    --actor) ACTOR="$2"; shift 2 ;;
    --check) CHECK=true; shift ;;
    --snapshot) SNAPSHOT="$2"; shift 2 ;;
    --from) FROM="$2"; shift 2 ;;
    --to) TO="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Build query params
QUERY=""
[ -n "$FROM" ] && QUERY="${QUERY}&from=${FROM}"
[ -n "$TO" ] && QUERY="${QUERY}&to=${TO}"
[ -n "$ACTOR" ] && QUERY="${QUERY}&actorId=${ACTOR}"
QUERY="${QUERY#&}"  # Remove leading &
[ -n "$QUERY" ] && QUERY="?${QUERY}"

# ---------------------------------------------------------------------------
# Fetch data
# ---------------------------------------------------------------------------

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Knokio Reach — Pilot Metrics${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "  Server: ${APP_URL}"
[ -n "$ACTOR" ] && echo "  Actor:  ${ACTOR}"
[ -n "$FROM" ] && echo "  From:   ${FROM}"
[ -n "$TO" ] && echo "  To:     ${TO}"

# Health
HEALTH=$(curl -sf "${API}/health" 2>&1) || { echo -e "\n  ${RED}✗ Server unreachable${NC}"; exit 1; }
HEALTH_STATUS=$(echo "$HEALTH" | jq -r '.status' 2>/dev/null || echo "unknown")

if [ "$HEALTH_STATUS" != "ready" ]; then
  echo -e "\n  ${RED}✗ Reach not ready (status: $HEALTH_STATUS)${NC}"
  exit 1
fi

# Metrics
METRICS=$(curl -sf "${API}/metrics${QUERY}" \
  -H "Authorization: Bearer ${API_KEY}" 2>&1) || { echo -e "\n  ${RED}✗ Metrics endpoint unreachable${NC}"; exit 1; }

METRICS_OK=$(echo "$METRICS" | jq -r '.ok' 2>/dev/null || echo "false")
if [ "$METRICS_OK" != "true" ]; then
  echo -e "\n  ${RED}✗ Metrics returned ok=$METRICS_OK${NC}"
  exit 1
fi

# ---------------------------------------------------------------------------
# Display metrics
# ---------------------------------------------------------------------------

echo ""
echo -e "  ${CYAN}Health${NC}"
ACTOR_COUNT=$(echo "$HEALTH" | jq -r '.reach.actors.total // 0')
CONTRACT_COUNT=$(echo "$HEALTH" | jq -r '.reach.contracts.total // 0')
POLICY_COUNT=$(echo "$HEALTH" | jq -r '.reach.policies // 0')
WEBHOOK_COUNT=$(echo "$HEALTH" | jq -r '.reach.webhooks // 0')
echo "    Actors:    $ACTOR_COUNT"
echo "    Contracts: $CONTRACT_COUNT"
echo "    Policies:  $POLICY_COUNT"
echo "    Webhooks:  $WEBHOOK_COUNT"

echo ""
echo -e "  ${CYAN}Pilot Metrics${NC}"

# Extract core metrics
ONE_HOP_RATE=$(echo "$METRICS" | jq -r '.metrics.oneHopSuccessRate.rate // "N/A"')
ONE_HOP_TOTAL=$(echo "$METRICS" | jq -r '.metrics.oneHopSuccessRate.total // 0')
ONE_HOP_SUCCESS=$(echo "$METRICS" | jq -r '.metrics.oneHopSuccessRate.succeeded // 0')

TIME_MEDIAN=$(echo "$METRICS" | jq -r '.metrics.timeToCounterparty.median // "N/A"')
TIME_P95=$(echo "$METRICS" | jq -r '.metrics.timeToCounterparty.p95 // "N/A"')
TIME_COUNT=$(echo "$METRICS" | jq -r '.metrics.timeToCounterparty.count // 0')

PATH_MEDIAN=$(echo "$METRICS" | jq -r '.metrics.pathLength.median // "N/A"')
PATH_P95=$(echo "$METRICS" | jq -r '.metrics.pathLength.p95 // "N/A"')
PATH_COUNT=$(echo "$METRICS" | jq -r '.metrics.pathLength.count // 0')

echo "    One-hop success rate:       ${ONE_HOP_RATE}% ($ONE_HOP_SUCCESS/$ONE_HOP_TOTAL)"
echo "    Time to counterparty (med): ${TIME_MEDIAN}s (p95: ${TIME_P95}s, n=$TIME_COUNT)"
echo "    Path length (median):       ${PATH_MEDIAN} events (p95: ${PATH_P95}, n=$PATH_COUNT)"

# Contract breakdown (from health)
echo ""
echo -e "  ${CYAN}Contract Status Breakdown${NC}"
echo "$HEALTH" | jq -r '.reach.contracts.byStatus // {} | to_entries[] | "    \(.key): \(.value)"' 2>/dev/null || echo "    (unavailable)"

# Actor type breakdown
echo ""
echo -e "  ${CYAN}Actor Type Breakdown${NC}"
echo "$HEALTH" | jq -r '.reach.actors.byType // {} | to_entries[] | "    \(.key): \(.value)"' 2>/dev/null || echo "    (unavailable)"

# ---------------------------------------------------------------------------
# Threshold check
# ---------------------------------------------------------------------------

if [ "$CHECK" = "true" ]; then
  echo ""
  echo -e "  ${CYAN}Threshold Checks${NC}"
  PASS_COUNT=0
  FAIL_COUNT=0

  # One-hop success rate
  if [ "$ONE_HOP_RATE" != "N/A" ] && [ "$ONE_HOP_TOTAL" -gt 0 ] 2>/dev/null; then
    if (( $(echo "$ONE_HOP_RATE >= $THRESHOLD_ONE_HOP_RATE" | bc -l 2>/dev/null || echo 0) )); then
      echo -e "    ${GREEN}✓${NC} One-hop rate ${ONE_HOP_RATE}% ≥ ${THRESHOLD_ONE_HOP_RATE}%"
      PASS_COUNT=$((PASS_COUNT + 1))
    else
      echo -e "    ${RED}✗${NC} One-hop rate ${ONE_HOP_RATE}% < ${THRESHOLD_ONE_HOP_RATE}%"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  else
    echo -e "    ${YELLOW}⚠${NC} One-hop rate: insufficient data (n=$ONE_HOP_TOTAL)"
  fi

  # Time to counterparty
  if [ "$TIME_MEDIAN" != "N/A" ] && [ "$TIME_COUNT" -gt 0 ] 2>/dev/null; then
    if (( $(echo "$TIME_MEDIAN <= $THRESHOLD_TIME_TO_COUNTERPARTY_SEC" | bc -l 2>/dev/null || echo 0) )); then
      echo -e "    ${GREEN}✓${NC} Time to counterparty ${TIME_MEDIAN}s ≤ ${THRESHOLD_TIME_TO_COUNTERPARTY_SEC}s"
      PASS_COUNT=$((PASS_COUNT + 1))
    else
      echo -e "    ${RED}✗${NC} Time to counterparty ${TIME_MEDIAN}s > ${THRESHOLD_TIME_TO_COUNTERPARTY_SEC}s"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  else
    echo -e "    ${YELLOW}⚠${NC} Time to counterparty: insufficient data (n=$TIME_COUNT)"
  fi

  # Path length
  if [ "$PATH_MEDIAN" != "N/A" ] && [ "$PATH_COUNT" -gt 0 ] 2>/dev/null; then
    if (( $(echo "$PATH_MEDIAN <= $THRESHOLD_PATH_LENGTH" | bc -l 2>/dev/null || echo 0) )); then
      echo -e "    ${GREEN}✓${NC} Path length ${PATH_MEDIAN} ≤ ${THRESHOLD_PATH_LENGTH}"
      PASS_COUNT=$((PASS_COUNT + 1))
    else
      echo -e "    ${RED}✗${NC} Path length ${PATH_MEDIAN} > ${THRESHOLD_PATH_LENGTH}"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  else
    echo -e "    ${YELLOW}⚠${NC} Path length: insufficient data (n=$PATH_COUNT)"
  fi

  echo ""
  if [ "$FAIL_COUNT" -eq 0 ] && [ "$PASS_COUNT" -gt 0 ]; then
    echo -e "  ${GREEN}All thresholds passed ✓${NC} ($PASS_COUNT/$PASS_COUNT)"
  elif [ "$FAIL_COUNT" -gt 0 ]; then
    echo -e "  ${RED}Threshold failures ✗${NC} ($PASS_COUNT passed, $FAIL_COUNT failed)"
  else
    echo -e "  ${YELLOW}Insufficient data for threshold checks${NC}"
  fi
fi

# ---------------------------------------------------------------------------
# Snapshot (save to evidence log)
# ---------------------------------------------------------------------------

if [ -n "$SNAPSHOT" ]; then
  echo ""
  echo -e "  ${CYAN}Saving snapshot: ${SNAPSHOT}${NC}"

  SNAPSHOT_DATA=$(jq -n \
    --arg label "$SNAPSHOT" \
    --argjson health "$HEALTH" \
    --argjson metrics "$METRICS" \
    '{
      label: $label,
      health: $health,
      metrics: $metrics
    }')

  # Write snapshot via evidence script
  if [ -x "${SCRIPT_DIR}/reach-pilot-evidence.sh" ]; then
    RECORDED_BY="${RECORDED_BY:-$(whoami)}" \
    "${SCRIPT_DIR}/reach-pilot-evidence.sh" METRICS_SNAPSHOT system \
      "label=${SNAPSHOT}" \
      "actorCount=${ACTOR_COUNT}" \
      "contractCount=${CONTRACT_COUNT}" \
      "oneHopRate=${ONE_HOP_RATE}" \
      "timeToCounterpartyMedian=${TIME_MEDIAN}" \
      "pathLengthMedian=${PATH_MEDIAN}"
  else
    echo -e "  ${YELLOW}⚠${NC} Evidence script not found — snapshot not saved to evidence log"
  fi

  # Also save full snapshot as a standalone file
  SNAPSHOT_FILE="${SCRIPT_DIR}/../pilot-evidence/snapshot-${SNAPSHOT}-$(date -u +%Y%m%dT%H%M%SZ).json"
  mkdir -p "$(dirname "$SNAPSHOT_FILE")"
  echo "$SNAPSHOT_DATA" | jq . > "$SNAPSHOT_FILE"
  echo -e "  ${GREEN}✓${NC} Full snapshot saved to: ${SNAPSHOT_FILE}"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Captured at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
