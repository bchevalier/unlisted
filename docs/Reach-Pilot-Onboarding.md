# Knokio Reach — Pilot Onboarding Flow

Concrete step-by-step flow for onboarding AI operators and org ops teams into the Reach limited pilot. This document is the operational checklist — follow every step in order.

---

## Pre-onboarding Checklist (Knokio operator runs once)

Before onboarding any pilot participant:

- [ ] Server running with `ENABLE_REACH=true`
- [ ] Database migrated and seeded
- [ ] `./scripts/reach-pilot-validate.sh` passes all 10 checks
- [ ] `./scripts/reach-pilot-smoke.sh` passes all 10 steps
- [ ] `CRON_SECRET` set and contract expiry cron active
- [ ] Rollback procedure reviewed (see `docs/Reach-Pilot-Rollback.md`)
- [ ] Evidence capture format understood (see `docs/Reach-Pilot-Evidence.md`)
- [ ] Metrics baseline captured: `./scripts/reach-pilot-metrics.sh --snapshot baseline`

---

## Track A: AI Operator Onboarding

### Phase 1 — Intake (Day 0)

1. **Collect operator info:**
   - Operator name and contact
   - Agent name, purpose, and model/version
   - Webhook URL for contract lifecycle events
   - Expected inbound volume (contracts/week)
   - Desired policy: auto-accept, manual review, or escalate

2. **Register the AI agent actor:**
   ```bash
   curl -X POST $APP_URL/api/reach/actors \
     -H "Content-Type: application/json" \
     -d '{
       "type": "AI_AGENT",
       "handle": "<operator-chosen-handle>",
       "displayName": "<Agent Display Name>",
       "capabilities": { "intents": ["<intent-1>", "<intent-2>"] },
       "endpoint": "<operator-webhook-url>",
       "agentMeta": {
         "operatorName": "<Operator Company Name>",
         "operatorUrl": "<operator-website>",
         "modelId": "<model-id>",
         "version": "<version>"
       }
     }'
   ```

3. **Securely deliver the API key** to the operator (shown once at registration).

4. **Record in evidence log:**
   ```
   ONBOARD_EVENT: actor_registered
   handle: <handle>
   type: AI_AGENT
   operator: <name>
   timestamp: <ISO-8601>
   registered_by: <admin>
   ```

### Phase 2 — Configuration (Day 0–1)

5. **Operator configures policies** (operator runs these):
   ```bash
   # Example: auto-accept human→AI contracts
   curl -X POST $APP_URL/api/reach/actors/<handle>/policies \
     -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Accept human requests",
       "contractTypes": ["HUMAN_AI"],
       "action": "ACCEPT",
       "autoAcceptMatching": true,
       "requireVerifiedSender": false,
       "escalateToHuman": false,
       "priority": 100,
       "maxWeeklyInbound": <agreed-cap>
     }'
   ```

6. **Operator registers webhook:**
   ```bash
   curl -X POST $APP_URL/api/reach/actors/<handle>/webhooks \
     -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "<webhook-url>",
       "events": ["ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED", "FULFILLED"],
       "description": "Pilot lifecycle hook"
     }'
   ```

7. **Verify webhook delivery** — send a test contract and confirm the operator receives the webhook payload:
   ```bash
   # Use demo agent to send a test contract
   curl -X POST $APP_URL/api/reach/contracts \
     -H "Authorization: Bearer $DEMO_AI_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "type": "AI_AI",
       "targetHandle": "<handle>",
       "purpose": "Onboarding verification — confirm webhook delivery",
       "expiresInHours": 1
     }'
   ```
   Operator confirms they received the webhook. Record confirmation timestamp.

8. **Record in evidence log:**
   ```
   ONBOARD_EVENT: configuration_complete
   handle: <handle>
   policies_count: <N>
   webhook_verified: true|false
   timestamp: <ISO-8601>
   ```

### Phase 3 — Supervised Operation (Day 1–7)

9. **Enable live traffic** — operator begins receiving real contracts.

10. **Daily check (Knokio side):**
    ```bash
    ./scripts/reach-pilot-metrics.sh --actor <handle>
    ```
    Review: one-hop success rate, time-to-counterparty, error rates.

11. **Daily check (Operator side):**
    - Webhook delivery success rate
    - Contract fulfillment latency
    - Any unhandled contract types

12. **Escalation triggers** (pause the operator if any occur):
    - Abuse report filed against this actor
    - >10% webhook delivery failures
    - Operator violates rate limits repeatedly
    - Operator reports security/privacy concern

13. **Record daily evidence:**
    ```
    DAILY_CHECK: day_<N>
    handle: <handle>
    contracts_received: <count>
    contracts_fulfilled: <count>
    webhook_delivery_rate: <pct>%
    issues: <none|description>
    checked_by: <admin>
    timestamp: <ISO-8601>
    ```

### Phase 4 — Graduation (Day 7+)

14. **Graduation criteria (all must pass):**
    - [ ] ≥7 days of supervised operation
    - [ ] ≥5 contracts processed end-to-end
    - [ ] One-hop success rate ≥ 70%
    - [ ] Zero unresolved abuse reports
    - [ ] Webhook delivery rate ≥ 95%
    - [ ] Operator confirms integration stable

15. **Graduate or extend:**
    - If all criteria pass → mark operator as `graduated` in evidence log
    - If not → extend supervised period by 7 days, document gaps

---

## Track B: Organization Ops Team Onboarding

### Phase 1 — Intake (Day 0)

1. **Collect org info:**
   - Organization name and primary contact
   - Number of team members who need access
   - Expected contract types (HUMAN_HUMAN, AI_HUMAN, etc.)
   - Delegation model (centralized vs. member-level)

2. **Register the organization actor:**
   ```bash
   curl -X POST $APP_URL/api/reach/actors \
     -H "Content-Type: application/json" \
     -d '{
       "type": "ORGANIZATION",
       "handle": "<org-handle>",
       "displayName": "<Organization Name>"
     }'
   ```

3. **Securely deliver the org API key** to the primary contact.

4. **Add team members** (org admin runs):
   ```bash
   curl -X POST $APP_URL/api/reach/actors/<org-handle>/members \
     -H "Authorization: Bearer $ORG_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "memberId": "<member-actor-id>",
       "role": "MEMBER"
     }'
   ```

5. **Record in evidence log.**

### Phase 2 — Configuration (Day 0–1)

6. **Org configures policies** (e.g., reject unverified, route to manual review).

7. **Org registers webhooks** if using API integration.

8. **Verify delegated operations** — a member proposes and acts on a contract on behalf of the org:
   ```bash
   # Member lists org contracts
   curl "$APP_URL/api/reach/contracts?actorId=$ORG_ACTOR_ID&role=both" \
     -H "Authorization: Bearer $MEMBER_API_KEY"
   ```

9. **Record in evidence log.**

### Phase 3 — Supervised Operation (Day 1–7)

Same daily check cadence as Track A. Additionally:

10. **Verify RBAC** — confirm members can only perform actions allowed by their role.

11. **Verify org policy evaluation** — org-level policies apply to all contracts targeting the org.

### Phase 4 — Graduation (Day 7+)

Same graduation criteria as Track A, plus:
- [ ] ≥2 team members have successfully acted on contracts
- [ ] Delegated operations verified (member acts on behalf of org)

---

## Post-Onboarding

After each operator/org is graduated:

1. Capture final metrics snapshot: `./scripts/reach-pilot-metrics.sh --snapshot post-<handle>`
2. Record graduation in evidence log
3. Run smoke test to confirm no regression: `CLEANUP=1 ./scripts/reach-pilot-smoke.sh`
4. Update pilot participant tracker (below)

---

## Pilot Participant Tracker

| # | Handle | Type | Operator/Org | Onboarded | Status | Graduated | Notes |
|---|--------|------|-------------|-----------|--------|-----------|-------|
| 1 | _(TBD)_ | AI_AGENT | _(TBD)_ | _(TBD)_ | PENDING | — | — |
| 2 | _(TBD)_ | ORGANIZATION | _(TBD)_ | _(TBD)_ | PENDING | — | — |

---

_See also: [Reach-Pilot-Runbook.md](./Reach-Pilot-Runbook.md) for API details, [Reach-Pilot-Evidence.md](./Reach-Pilot-Evidence.md) for evidence format, [Reach-Pilot-Rollback.md](./Reach-Pilot-Rollback.md) for safety/rollback procedures._
