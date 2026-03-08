#!/usr/bin/env bash
# =============================================================================
# Knokio Reach — Pilot Smoke Test
#
# Exercises the full pilot lifecycle against a running server:
#   1. Health check
#   2. Register AI agent actor
#   3. Create a policy (auto-accept HUMAN_AI contracts)
#   4. Register a webhook
#   5. Propose a contract (HUMAN_AI)
#   6. List contracts
#   7. Fulfill the contract
#   8. Check delivery status
#   9. Query pilot metrics
#  10. Cleanup (optional)
#
# Prerequisites:
#   - Server running (npm run dev)
#   - Database seeded (npm run db:seed)
#   - curl and jq installed
#
# Usage:
#   ./scripts/reach-pilot-smoke.sh                    # default: http://localhost:3333
#   ./scripts/reach-pilot-smoke.sh https://your.host  # custom base URL
#   CLEANUP=1 ./scripts/reach-pilot-smoke.sh          # delete test actor after run
# =============================================================================

set -euo pipefail

BASE_URL="${1:-http://localhost:3333}"
API="${BASE_URL}/api/reach"
CLEANUP="${CLEANUP:-0}"

# Unique handle to avoid collisions with existing actors.
SMOKE_HANDLE="smoke-agent-$(date +%s)"

# Colors for output.
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

pass() { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; exit 1; }
step() { echo -e "\n${CYAN}[$1]${NC} $2"; }

# ---------------------------------------------------------------------------
# Helper: extract JSON field (uses jq if available, else grep fallback)
# ---------------------------------------------------------------------------
json_field() {
  local json="$1" field="$2"
  if command -v jq &>/dev/null; then
    echo "$json" | jq -r ".$field"
  else
    echo "$json" | grep -o "\"$field\":[[:space:]]*\"[^\"]*\"" | head -1 | sed 's/.*":\s*"//;s/"$//'
  fi
}

json_field_raw() {
  local json="$1" field="$2"
  if command -v jq &>/dev/null; then
    echo "$json" | jq -r ".$field"
  else
    echo "$json" | grep -o "\"$field\":[[:space:]]*[^,}]*" | head -1 | sed 's/.*":\s*//'
  fi
}

# ============================================================================
# 1. Health Check
# ============================================================================
step "1/10" "Health check"

HEALTH=$(curl -sf "${API}/health" 2>&1) || fail "Health endpoint unreachable at ${API}/health"
HEALTH_OK=$(json_field_raw "$HEALTH" "ok")
HEALTH_STATUS=$(json_field "$HEALTH" "status")

[ "$HEALTH_OK" = "true" ] || fail "Health check returned ok=$HEALTH_OK"
[ "$HEALTH_STATUS" = "ready" ] || fail "Reach status is '$HEALTH_STATUS' (expected 'ready')"
pass "Reach is ready"

# ============================================================================
# 2. Register AI Agent Actor
# ============================================================================
step "2/10" "Register AI agent actor (@${SMOKE_HANDLE})"

REGISTER_RESP=$(curl -sf -X POST "${API}/actors" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "AI_AGENT",
    "handle": "'"${SMOKE_HANDLE}"'",
    "displayName": "Smoke Test Agent",
    "capabilities": { "intents": ["smoke-test"] },
    "endpoint": "https://httpbin.org/post",
    "agentMeta": {
      "operatorName": "Knokio Smoke Test",
      "modelId": "smoke-test-v1"
    }
  }') || fail "Failed to register actor"

REG_OK=$(json_field_raw "$REGISTER_RESP" "ok")
[ "$REG_OK" = "true" ] || fail "Register returned ok=$REG_OK — $(echo "$REGISTER_RESP" | head -c 200)"

# Extract the API key (shown only once on creation).
SMOKE_KEY=$(json_field "$REGISTER_RESP" "apiKey")
[ -n "$SMOKE_KEY" ] && [ "$SMOKE_KEY" != "null" ] || fail "No API key returned"
pass "Registered — API key starts with ${SMOKE_KEY:0:8}..."

# ============================================================================
# 3. Create Policy (auto-accept HUMAN_AI)
# ============================================================================
step "3/10" "Create auto-accept policy for @${SMOKE_HANDLE}"

POLICY_RESP=$(curl -sf -X POST "${API}/actors/${SMOKE_HANDLE}/policies" \
  -H "Authorization: Bearer ${SMOKE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Accept all inbound contracts",
    "contractTypes": ["HUMAN_AI", "AI_AI"],
    "action": "ACCEPT",
    "autoAcceptMatching": true,
    "requireVerifiedSender": false,
    "escalateToHuman": false,
    "priority": 100,
    "maxWeeklyInbound": 50
  }') || fail "Failed to create policy"

POL_OK=$(json_field_raw "$POLICY_RESP" "ok")
[ "$POL_OK" = "true" ] || fail "Policy creation returned ok=$POL_OK — $(echo "$POLICY_RESP" | head -c 200)"
pass "Policy created"

# ============================================================================
# 4. Register Webhook
# ============================================================================
step "4/10" "Register webhook for @${SMOKE_HANDLE}"

WEBHOOK_RESP=$(curl -sf -X POST "${API}/actors/${SMOKE_HANDLE}/webhooks" \
  -H "Authorization: Bearer ${SMOKE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://httpbin.org/post",
    "events": [],
    "description": "Smoke test webhook — receives all events"
  }') || fail "Failed to create webhook"

WH_OK=$(json_field_raw "$WEBHOOK_RESP" "ok")
[ "$WH_OK" = "true" ] || fail "Webhook creation returned ok=$WH_OK — $(echo "$WEBHOOK_RESP" | head -c 200)"
pass "Webhook registered"

# ============================================================================
# 5. Propose Contract (HUMAN_AI) as demo-ai-agent → smoke agent
#    Using the demo AI agent's seeded API key.
# ============================================================================
step "5/10" "Propose HUMAN_AI contract → @${SMOKE_HANDLE}"

# We use the seeded demo AI agent to propose (since it has an API key).
# This exercises AI→AI_AGENT which will be treated as AI_AI.
# For a HUMAN_AI contract, we'd need a browser session. Instead, let's
# use the AI-to-AI flow which covers the same pipeline.

DEMO_AI_KEY="knk_demo_ai_agent_key_for_local_testing_only"

PROPOSE_RESP=$(curl -sf -X POST "${API}/contracts" \
  -H "Authorization: Bearer ${DEMO_AI_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "AI_AI",
    "targetHandle": "'"${SMOKE_HANDLE}"'",
    "purpose": "Smoke test: validate full contract lifecycle",
    "message": "This is an automated pilot smoke test.",
    "expiresInHours": 1
  }') || fail "Failed to propose contract"

PROP_OK=$(json_field_raw "$PROPOSE_RESP" "ok")
[ "$PROP_OK" = "true" ] || fail "Contract proposal returned ok=$PROP_OK — $(echo "$PROPOSE_RESP" | head -c 200)"

CONTRACT_ID=$(json_field "$PROPOSE_RESP" "contract.id")
[ -n "$CONTRACT_ID" ] && [ "$CONTRACT_ID" != "null" ] || fail "No contract ID returned"

CONTRACT_STATUS=$(json_field "$PROPOSE_RESP" "contract.status")
pass "Contract proposed (id=${CONTRACT_ID:0:12}…, status=$CONTRACT_STATUS)"

# ============================================================================
# 6. List Contracts for Smoke Agent
# ============================================================================
step "6/10" "List contracts for @${SMOKE_HANDLE}"

LIST_RESP=$(curl -sf "${API}/contracts?role=target" \
  -H "Authorization: Bearer ${SMOKE_KEY}") || fail "Failed to list contracts"

LIST_OK=$(json_field_raw "$LIST_RESP" "ok")
[ "$LIST_OK" = "true" ] || fail "Contract listing returned ok=$LIST_OK"

TOTAL=$(json_field_raw "$LIST_RESP" "pagination.totalCount")
[ "$TOTAL" -ge 1 ] 2>/dev/null || fail "Expected at least 1 contract, got $TOTAL"
pass "Listed $TOTAL contract(s)"

# ============================================================================
# 7. Accept contract (if PROPOSED) then Fulfill
# ============================================================================
step "7/10" "Accept + fulfill contract"

# If the policy auto-accepted, status should be ACTIVE already.
# Otherwise, transition to ACTIVE first.
if [ "$CONTRACT_STATUS" = "PROPOSED" ]; then
  ACCEPT_RESP=$(curl -sf -X POST "${API}/contracts/${CONTRACT_ID}/transition" \
    -H "Authorization: Bearer ${SMOKE_KEY}" \
    -H "Content-Type: application/json" \
    -d '{ "status": "ACTIVE", "note": "Accepted via smoke test" }') || fail "Failed to accept contract"

  ACC_OK=$(json_field_raw "$ACCEPT_RESP" "ok")
  [ "$ACC_OK" = "true" ] || fail "Accept returned ok=$ACC_OK — $(echo "$ACCEPT_RESP" | head -c 200)"
  pass "Contract accepted"
fi

# Fulfill.
FULFILL_RESP=$(curl -sf -X POST "${API}/contracts/${CONTRACT_ID}/fulfill" \
  -H "Authorization: Bearer ${SMOKE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "responseData": { "result": "smoke-test-passed", "timestamp": "'"$(date -u +%FT%TZ)"'" },
    "note": "Fulfilled by smoke test script"
  }') || fail "Failed to fulfill contract"

FUL_OK=$(json_field_raw "$FULFILL_RESP" "ok")
[ "$FUL_OK" = "true" ] || fail "Fulfill returned ok=$FUL_OK — $(echo "$FULFILL_RESP" | head -c 200)"
pass "Contract fulfilled"

# ============================================================================
# 8. Check Delivery Status
# ============================================================================
step "8/10" "Check delivery status"

DELIVERY_RESP=$(curl -sf "${API}/contracts/${CONTRACT_ID}/delivery" \
  -H "Authorization: Bearer ${SMOKE_KEY}") || fail "Failed to get delivery status"

DEL_OK=$(json_field_raw "$DELIVERY_RESP" "ok")
[ "$DEL_OK" = "true" ] || fail "Delivery status returned ok=$DEL_OK"
pass "Delivery status retrieved"

# ============================================================================
# 9. Query Pilot Metrics
# ============================================================================
step "9/10" "Query pilot metrics"

METRICS_RESP=$(curl -sf "${API}/metrics" \
  -H "Authorization: Bearer ${SMOKE_KEY}") || fail "Failed to get metrics"

MET_OK=$(json_field_raw "$METRICS_RESP" "ok")
[ "$MET_OK" = "true" ] || fail "Metrics returned ok=$MET_OK"
pass "Pilot metrics retrieved"

# ============================================================================
# 10. Verify Final Contract State
# ============================================================================
step "10/10" "Verify final contract state"

FINAL_RESP=$(curl -sf "${API}/contracts/${CONTRACT_ID}" \
  -H "Authorization: Bearer ${SMOKE_KEY}") || fail "Failed to get contract"

FINAL_STATUS=$(json_field "$FINAL_RESP" "contract.status")
[ "$FINAL_STATUS" = "FULFILLED" ] || fail "Expected FULFILLED, got $FINAL_STATUS"
pass "Contract status: FULFILLED ✓"

# ============================================================================
# Cleanup (optional)
# ============================================================================
if [ "$CLEANUP" = "1" ]; then
  step "cleanup" "Deactivating smoke test actor @${SMOKE_HANDLE}"
  curl -sf -X DELETE "${API}/actors/${SMOKE_HANDLE}" \
    -H "Authorization: Bearer ${SMOKE_KEY}" >/dev/null 2>&1 && pass "Actor deactivated" || echo "  (cleanup skipped)"
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Reach pilot smoke test passed ✓${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Base URL:    ${BASE_URL}"
echo "  Actor:       @${SMOKE_HANDLE}"
echo "  Contract:    ${CONTRACT_ID}"
echo "  API Key:     ${SMOKE_KEY:0:12}…"
echo ""
[ "$CLEANUP" = "0" ] && echo "  Tip: CLEANUP=1 ./scripts/reach-pilot-smoke.sh to auto-remove test data"
echo ""
