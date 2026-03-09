#!/usr/bin/env bash
# =============================================================================
# Knokio Reach — Operator Integration Verification
#
# Run this after registration + configuration to verify your integration works.
# Requires: your actor handle, API key, and the Knokio Reach base URL.
#
# Usage:
#   ./scripts/reach-operator-verify.sh <handle> <api-key> [base-url]
#
# Examples:
#   ./scripts/reach-operator-verify.sh acme-agent knk_abc123...
#   ./scripts/reach-operator-verify.sh acme-agent knk_abc123... https://knokio.io
# =============================================================================

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <handle> <api-key> [base-url]"
  echo ""
  echo "  handle    Your registered actor handle"
  echo "  api-key   Your API key (knk_...)"
  echo "  base-url  Knokio Reach URL (default: http://localhost:3333)"
  exit 1
fi

HANDLE="$1"
API_KEY="$2"
BASE_URL="${3:-http://localhost:3333}"
API="${BASE_URL}/api/reach"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNED=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASSED=$((PASSED + 1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAILED=$((FAILED + 1)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; WARNED=$((WARNED + 1)); }
step() { echo -e "\n${CYAN}[$1]${NC} $2"; }

json_field() {
  local json="$1" field="$2"
  if command -v jq &>/dev/null; then
    echo "$json" | jq -r ".$field" 2>/dev/null
  else
    echo "$json" | grep -o "\"$field\":[[:space:]]*\"[^\"]*\"" | head -1 | sed 's/.*":\s*"//;s/"$//'
  fi
}

json_field_raw() {
  local json="$1" field="$2"
  if command -v jq &>/dev/null; then
    echo "$json" | jq -r ".$field" 2>/dev/null
  else
    echo "$json" | grep -o "\"$field\":[[:space:]]*[^,}]*" | head -1 | sed 's/.*":\s*//'
  fi
}

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Knokio Reach — Operator Integration Verification${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "  Handle:  @${HANDLE}"
echo "  Target:  ${BASE_URL}"

# ============================================================================
# 1. Reach availability
# ============================================================================
step "1/8" "Reach availability"

HEALTH=$(curl -sf "${API}/health" 2>&1) || HEALTH=""
if [ -z "$HEALTH" ]; then
  fail "Cannot reach ${API}/health"
  echo -e "\n  ${RED}Server must be reachable to continue.${NC}"
  exit 1
fi

HEALTH_OK=$(json_field_raw "$HEALTH" "ok")
if [ "$HEALTH_OK" = "true" ]; then
  pass "Reach is available and ready"
else
  fail "Reach health check: ok=$HEALTH_OK"
fi

# ============================================================================
# 2. API key authentication
# ============================================================================
step "2/8" "API key authentication"

AUTH_RESP=$(curl -sf -o /dev/null -w "%{http_code}" "${API}/contracts?role=both&limit=1" \
  -H "Authorization: Bearer ${API_KEY}" 2>&1) || AUTH_RESP="000"

if [ "$AUTH_RESP" = "200" ]; then
  pass "API key accepted (HTTP 200)"
elif [ "$AUTH_RESP" = "401" ]; then
  fail "API key rejected (HTTP 401) — check your key"
elif [ "$AUTH_RESP" = "403" ]; then
  fail "Access forbidden (HTTP 403) — Reach may be disabled"
else
  fail "Unexpected response: HTTP $AUTH_RESP"
fi

# ============================================================================
# 3. Actor profile
# ============================================================================
step "3/8" "Actor profile"

ACTOR_RESP=$(curl -sf "${API}/actors/${HANDLE}" \
  -H "Authorization: Bearer ${API_KEY}" 2>&1) || ACTOR_RESP=""

if [ -n "$ACTOR_RESP" ]; then
  ACTOR_OK=$(json_field_raw "$ACTOR_RESP" "ok")
  ACTOR_TYPE=$(json_field "$ACTOR_RESP" "actor.type")
  ACTOR_NAME=$(json_field "$ACTOR_RESP" "actor.displayName")

  if [ "$ACTOR_OK" = "true" ]; then
    pass "Actor found: ${ACTOR_NAME} (${ACTOR_TYPE})"
  else
    fail "Actor not found for handle: @${HANDLE}"
  fi
else
  fail "Cannot fetch actor profile"
fi

# ============================================================================
# 4. Policies
# ============================================================================
step "4/8" "Policies"

POLICY_RESP=$(curl -sf "${API}/actors/${HANDLE}/policies" \
  -H "Authorization: Bearer ${API_KEY}" 2>&1) || POLICY_RESP=""

if [ -n "$POLICY_RESP" ]; then
  POLICY_OK=$(json_field_raw "$POLICY_RESP" "ok")
  if [ "$POLICY_OK" = "true" ]; then
    if command -v jq &>/dev/null; then
      POLICY_COUNT=$(echo "$POLICY_RESP" | jq '.policies | length' 2>/dev/null)
    else
      POLICY_COUNT=$(echo "$POLICY_RESP" | grep -o '"name"' | wc -l | tr -d ' ')
    fi

    if [ "${POLICY_COUNT:-0}" -ge 1 ] 2>/dev/null; then
      pass "${POLICY_COUNT} policy(ies) configured"
    else
      warn "No policies configured — contracts won't be auto-handled"
    fi
  else
    fail "Failed to list policies"
  fi
else
  fail "Cannot fetch policies"
fi

# ============================================================================
# 5. Webhooks
# ============================================================================
step "5/8" "Webhooks"

WH_RESP=$(curl -sf "${API}/actors/${HANDLE}/webhooks" \
  -H "Authorization: Bearer ${API_KEY}" 2>&1) || WH_RESP=""

if [ -n "$WH_RESP" ]; then
  WH_OK=$(json_field_raw "$WH_RESP" "ok")
  if [ "$WH_OK" = "true" ]; then
    if command -v jq &>/dev/null; then
      WH_COUNT=$(echo "$WH_RESP" | jq '.webhooks | length' 2>/dev/null)
    else
      WH_COUNT=$(echo "$WH_RESP" | grep -o '"url"' | wc -l | tr -d ' ')
    fi

    if [ "${WH_COUNT:-0}" -ge 1 ] 2>/dev/null; then
      pass "${WH_COUNT} webhook(s) registered"
    else
      warn "No webhooks registered — you won't receive event notifications"
    fi
  else
    fail "Failed to list webhooks"
  fi
else
  fail "Cannot fetch webhooks"
fi

# ============================================================================
# 6. Contract listing
# ============================================================================
step "6/8" "Contract access"

CONTRACT_RESP=$(curl -sf "${API}/contracts?role=both&limit=5" \
  -H "Authorization: Bearer ${API_KEY}" 2>&1) || CONTRACT_RESP=""

if [ -n "$CONTRACT_RESP" ]; then
  CON_OK=$(json_field_raw "$CONTRACT_RESP" "ok")
  if [ "$CON_OK" = "true" ]; then
    pass "Can list contracts"
  else
    fail "Contract listing failed"
  fi
else
  fail "Cannot access contracts endpoint"
fi

# ============================================================================
# 7. Metrics access
# ============================================================================
step "7/8" "Metrics access"

MET_RESP=$(curl -sf "${API}/metrics" \
  -H "Authorization: Bearer ${API_KEY}" 2>&1) || MET_RESP=""

if [ -n "$MET_RESP" ]; then
  MET_OK=$(json_field_raw "$MET_RESP" "ok")
  if [ "$MET_OK" = "true" ]; then
    pass "Can access pilot metrics"
  else
    fail "Metrics endpoint returned ok=$MET_OK"
  fi
else
  fail "Cannot access metrics endpoint"
fi

# ============================================================================
# 8. Blocklist + abuse report endpoints
# ============================================================================
step "8/8" "Safety controls"

BL_RESP=$(curl -sf -o /dev/null -w "%{http_code}" "${API}/blocklist" \
  -H "Authorization: Bearer ${API_KEY}" 2>&1) || BL_RESP="000"

if [ "$BL_RESP" = "200" ]; then
  pass "Blocklist endpoint accessible"
elif [ "$BL_RESP" = "401" ] || [ "$BL_RESP" = "403" ]; then
  fail "Blocklist not accessible (HTTP $BL_RESP)"
else
  warn "Blocklist endpoint returned HTTP $BL_RESP"
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}  Integration verified ✓${NC}  ($PASSED passed, $WARNED warnings)"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "  ✅ Your integration is ready for the pilot."
  if [ "$WARNED" -gt 0 ]; then
    echo "  ⚠️  Review warnings above — they may affect your experience."
  fi
  echo ""
  echo "  Next steps:"
  echo "    1. Ensure your webhook endpoint is live and accepting POST"
  echo "    2. Ask the pilot coordinator to send a test contract"
  echo "    3. Verify you receive and can verify the webhook payload"
  echo ""
else
  echo -e "${RED}  Verification failed ✗${NC}  ($PASSED passed, $FAILED failed, $WARNED warnings)"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "  ❌ Fix the failures above before proceeding."
  echo ""
  exit 1
fi
