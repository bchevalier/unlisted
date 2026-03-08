#!/usr/bin/env bash
# =============================================================================
# Knokio Reach — Pilot Pre-flight Validation
#
# Checks all prerequisites before onboarding pilot operators:
#   1. Environment variables
#   2. Database connectivity
#   3. Reach feature flag
#   4. Health endpoint
#   5. Seed data (actors, policies)
#   6. API authentication
#   7. Cron secret configured
#   8. Contract expiry endpoint
#   9. Metrics endpoint
#  10. Smoke test availability
#
# Usage:
#   ./scripts/reach-pilot-validate.sh                    # default: http://localhost:3333
#   ./scripts/reach-pilot-validate.sh https://your.host  # production URL
# =============================================================================

set -euo pipefail

BASE_URL="${1:-http://localhost:3333}"
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
section() { echo -e "\n${CYAN}[$1]${NC} $2"; }

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
echo -e "${CYAN}  Knokio Reach — Pilot Pre-flight Validation${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "  Target: ${BASE_URL}"

# ============================================================================
# 1. Server reachability
# ============================================================================
section "1/10" "Server reachability"

HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "${BASE_URL}/" 2>&1) || HTTP_CODE="000"

if [ "$HTTP_CODE" = "000" ]; then
  fail "Server unreachable at ${BASE_URL}"
  echo -e "\n  ${RED}Cannot continue — server must be running.${NC}"
  exit 1
else
  pass "Server responding (HTTP $HTTP_CODE)"
fi

# ============================================================================
# 2. Reach health endpoint
# ============================================================================
section "2/10" "Reach health endpoint"

HEALTH=$(curl -sf "${API}/health" 2>&1) || HEALTH=""

if [ -z "$HEALTH" ]; then
  fail "Health endpoint unreachable at ${API}/health"
else
  HEALTH_OK=$(json_field_raw "$HEALTH" "ok")
  HEALTH_STATUS=$(json_field "$HEALTH" "status")

  if [ "$HEALTH_OK" = "true" ] && [ "$HEALTH_STATUS" = "ready" ]; then
    pass "Reach is ready"
  elif [ "$HEALTH_STATUS" = "disabled" ]; then
    fail "Reach is disabled (ENABLE_REACH=false)"
  else
    fail "Health check: ok=$HEALTH_OK, status=$HEALTH_STATUS"
  fi
fi

# ============================================================================
# 3. Database — actor count
# ============================================================================
section "3/10" "Seed data verification"

if [ -n "$HEALTH" ]; then
  ACTOR_COUNT=$(json_field_raw "$HEALTH" "reach.actors.total")
  CONTRACT_COUNT=$(json_field_raw "$HEALTH" "reach.contracts.total")
  POLICY_COUNT=$(json_field_raw "$HEALTH" "reach.policies")

  if [ "${ACTOR_COUNT:-0}" -ge 3 ] 2>/dev/null; then
    pass "Actors seeded ($ACTOR_COUNT active)"
  else
    fail "Expected ≥3 actors, found ${ACTOR_COUNT:-0}. Run: npm run db:seed"
  fi

  if [ "${POLICY_COUNT:-0}" -ge 3 ] 2>/dev/null; then
    pass "Policies seeded ($POLICY_COUNT active)"
  else
    warn "Only $POLICY_COUNT policies found. Expected ≥3 from seed"
  fi

  if [ "${CONTRACT_COUNT:-0}" -ge 1 ] 2>/dev/null; then
    pass "Sample contracts present ($CONTRACT_COUNT)"
  else
    warn "No sample contracts. Run: npm run db:seed"
  fi
else
  fail "Skipped — health endpoint not available"
fi

# ============================================================================
# 4. API key authentication
# ============================================================================
section "4/10" "API key authentication"

DEMO_AI_KEY="knk_demo_ai_agent_key_for_local_testing_only"
AUTH_RESP=$(curl -sf "${API}/contracts?role=both&limit=1" \
  -H "Authorization: Bearer ${DEMO_AI_KEY}" 2>&1) || AUTH_RESP=""

if [ -n "$AUTH_RESP" ]; then
  AUTH_OK=$(json_field_raw "$AUTH_RESP" "ok")
  if [ "$AUTH_OK" = "true" ]; then
    pass "API key auth working (demo-ai-agent)"
  else
    fail "API key auth returned ok=$AUTH_OK"
  fi
else
  fail "API key auth failed — no response"
fi

# ============================================================================
# 5. Actor registration endpoint
# ============================================================================
section "5/10" "Actor registration endpoint"

REG_CHECK=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "${API}/actors" \
  -H "Content-Type: application/json" \
  -d '{"type":"AI_AGENT","handle":"__validate_check__"}' 2>&1) || REG_CHECK="000"

# We expect 400 (missing required fields) or 409 (handle taken), not 404 or 500
if [ "$REG_CHECK" = "400" ] || [ "$REG_CHECK" = "409" ]; then
  pass "Actor registration endpoint responding (HTTP $REG_CHECK)"
elif [ "$REG_CHECK" = "403" ]; then
  fail "Actor registration blocked — check Reach feature flag"
else
  warn "Unexpected response: HTTP $REG_CHECK"
fi

# ============================================================================
# 6. Contract proposal endpoint
# ============================================================================
section "6/10" "Contract proposal endpoint"

PROP_CHECK=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "${API}/contracts" \
  -H "Authorization: Bearer ${DEMO_AI_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"type":"AI_AI","targetHandle":"__nonexistent__","purpose":"validate"}' 2>&1) || PROP_CHECK="000"

# Expect 404 (target not found) or 400, not 500
if [ "$PROP_CHECK" = "404" ] || [ "$PROP_CHECK" = "400" ]; then
  pass "Contract proposal endpoint responding (HTTP $PROP_CHECK)"
elif [ "$PROP_CHECK" = "403" ]; then
  fail "Contract proposal blocked — check Reach feature flag"
else
  warn "Unexpected response: HTTP $PROP_CHECK"
fi

# ============================================================================
# 7. Metrics endpoint
# ============================================================================
section "7/10" "Metrics endpoint"

METRICS_RESP=$(curl -sf "${API}/metrics" \
  -H "Authorization: Bearer ${DEMO_AI_KEY}" 2>&1) || METRICS_RESP=""

if [ -n "$METRICS_RESP" ]; then
  MET_OK=$(json_field_raw "$METRICS_RESP" "ok")
  if [ "$MET_OK" = "true" ]; then
    pass "Metrics endpoint working"
  else
    fail "Metrics returned ok=$MET_OK"
  fi
else
  fail "Metrics endpoint unreachable"
fi

# ============================================================================
# 8. Contract expiry endpoint
# ============================================================================
section "8/10" "Contract expiry (cron) endpoint"

# Try without auth first — should get 401
EXPIRE_NOAUTH=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "${API}/contracts/expire" 2>&1) || EXPIRE_NOAUTH="000"

if [ "$EXPIRE_NOAUTH" = "401" ]; then
  pass "Expiry endpoint requires auth (HTTP 401)"
elif [ "$EXPIRE_NOAUTH" = "200" ]; then
  warn "Expiry endpoint accessible without auth — set CRON_SECRET"
else
  warn "Expiry endpoint returned HTTP $EXPIRE_NOAUTH"
fi

# ============================================================================
# 9. Webhook infrastructure
# ============================================================================
section "9/10" "Webhook infrastructure"

WH_LIST=$(curl -sf "${API}/actors/demo-ai-agent/webhooks" \
  -H "Authorization: Bearer ${DEMO_AI_KEY}" 2>&1) || WH_LIST=""

if [ -n "$WH_LIST" ]; then
  WH_OK=$(json_field_raw "$WH_LIST" "ok")
  if [ "$WH_OK" = "true" ]; then
    pass "Webhook CRUD endpoint working"
  else
    fail "Webhook list returned ok=$WH_OK"
  fi
else
  fail "Webhook endpoint unreachable"
fi

# ============================================================================
# 10. Smoke test script
# ============================================================================
section "10/10" "Smoke test availability"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SMOKE_SCRIPT="${SCRIPT_DIR}/reach-pilot-smoke.sh"

if [ -x "$SMOKE_SCRIPT" ]; then
  pass "Smoke test script available and executable"
else
  warn "Smoke test script not found or not executable at ${SMOKE_SCRIPT}"
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}  Pre-flight passed ✓${NC}  ($PASSED passed, $WARNED warnings)"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "  ✅ Ready to onboard pilot operators."
  echo "  Next steps:"
  echo "    1. Run the full smoke test:  ./scripts/reach-pilot-smoke.sh ${BASE_URL}"
  echo "    2. Follow the Pilot Runbook: docs/Reach-Pilot-Runbook.md"
  echo ""
else
  echo -e "${RED}  Pre-flight failed ✗${NC}  ($PASSED passed, $FAILED failed, $WARNED warnings)"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "  ❌ Fix the failures above before onboarding operators."
  echo ""
  exit 1
fi
