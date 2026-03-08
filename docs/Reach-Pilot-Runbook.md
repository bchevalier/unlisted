# Knokio Reach — Pilot Operator Runbook

Step-by-step guide for running limited pilots with AI operators and organization ops teams.

---

## Prerequisites

1. Knokio server running with `ENABLE_REACH=true`
2. Database migrated and seeded (`npm run db:migrate:dev && npm run db:seed`)
3. `curl` and `jq` installed for API interaction
4. `CRON_SECRET` set in environment (required for contract expiry cron)

### Pre-flight validation

Run the automated pre-flight check to verify all prerequisites:

```bash
./scripts/reach-pilot-validate.sh                    # local dev
./scripts/reach-pilot-validate.sh https://your.host  # production
```

This validates: server reachability, Reach feature flag, seed data, API auth, all key endpoints, webhook infrastructure, and smoke test availability.

All checks must pass before onboarding operators.

### Manual health check

```bash
curl http://localhost:3333/api/reach/health | jq .
```

Expected response:
```json
{
  "ok": true,
  "status": "ready",
  "reach": {
    "enabled": true,
    "actors": { "total": 3, "byType": { ... } },
    "contracts": { "total": 2, "byStatus": { ... } },
    "policies": 5,
    "webhooks": 0
  }
}
```

### Run the smoke test

```bash
./scripts/reach-pilot-smoke.sh
```

All 10 steps should pass before onboarding pilot operators.

---

## Pilot A: AI Operator Integration

**Scenario:** An AI agent operator wants their agent to receive and fulfill contracts from humans or other AI agents via Knokio Reach.

### Step 1: Register the AI agent

```bash
curl -X POST http://localhost:3333/api/reach/actors \
  -H "Content-Type: application/json" \
  -d '{
    "type": "AI_AGENT",
    "handle": "acme-summarizer",
    "displayName": "Acme Summarizer Agent",
    "capabilities": { "intents": ["summarize", "extract-actions"] },
    "endpoint": "https://acme.example.com/knokio-webhook",
    "agentMeta": {
      "operatorName": "Acme AI Labs",
      "operatorUrl": "https://acme.example.com",
      "modelId": "gpt-4o",
      "version": "2.1.0"
    }
  }'
```

**Save the `apiKey` from the response — it is shown only once.**

### Step 2: Configure policies

Auto-accept human requests:
```bash
curl -X POST http://localhost:3333/api/reach/actors/acme-summarizer/policies \
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
    "maxWeeklyInbound": 100
  }'
```

Route AI-to-AI requests for review:
```bash
curl -X POST http://localhost:3333/api/reach/actors/acme-summarizer/policies \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Route AI-to-AI for review",
    "contractTypes": ["AI_AI"],
    "action": "ROUTE",
    "autoAcceptMatching": false,
    "requireVerifiedSender": false,
    "escalateToHuman": false,
    "priority": 50,
    "maxWeeklyInbound": 20
  }'
```

### Step 3: Register a webhook

```bash
curl -X POST http://localhost:3333/api/reach/actors/acme-summarizer/webhooks \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://acme.example.com/knokio-webhook",
    "events": ["ACCEPTED", "CANCELLED", "EXPIRED"],
    "description": "Production contract lifecycle hook"
  }'
```

Save the `secret` from the response for HMAC signature verification.

### Step 4: Receive and fulfill contracts

When a contract is auto-accepted, the webhook fires with event `contract.accepted`. The operator's agent should:

1. Parse the webhook payload
2. Verify the `X-Knokio-Signature` header (HMAC-SHA256 of body using webhook secret)
3. Process the contract purpose/message
4. POST fulfillment when done:

```bash
curl -X POST http://localhost:3333/api/reach/contracts/$CONTRACT_ID/fulfill \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "responseData": { "summary": "..." },
    "note": "Processed by Acme Summarizer v2.1.0"
  }'
```

### Step 5: Monitor metrics

```bash
curl http://localhost:3333/api/reach/metrics \
  -H "Authorization: Bearer $API_KEY" | jq .
```

Key metrics to track:
- **One-hop success rate** — should be > 70%
- **Median time-to-counterparty** — target < 5 minutes
- **Path length median** — target ≤ 3 events

---

## Pilot B: Organization Ops Team

**Scenario:** An organization wants to manage contracts on behalf of its members through Knokio Reach.

### Step 1: Register the organization

```bash
curl -X POST http://localhost:3333/api/reach/actors \
  -H "Content-Type: application/json" \
  -d '{
    "type": "ORGANIZATION",
    "handle": "acme-corp",
    "displayName": "Acme Corporation"
  }'
```

**Save the `apiKey`.**

### Step 2: Add members

Add an existing AI agent as a member:
```bash
curl -X POST http://localhost:3333/api/reach/actors/acme-corp/members \
  -H "Authorization: Bearer $ORG_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": "<agent-actor-id>",
    "role": "MEMBER"
  }'
```

Roles: `OWNER` (full control), `ADMIN` (manage members + policies), `MEMBER` (act on contracts).

### Step 3: Delegated contract operations

Org members can list and act on contracts on behalf of the org:

```bash
# List contracts for the org
curl "http://localhost:3333/api/reach/contracts?actorId=$ORG_ACTOR_ID&role=target" \
  -H "Authorization: Bearer $MEMBER_API_KEY"

# Propose a contract on behalf of the org
curl -X POST "http://localhost:3333/api/reach/contracts?actorId=$ORG_ACTOR_ID" \
  -H "Authorization: Bearer $MEMBER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "AI_AI",
    "targetHandle": "other-agent",
    "purpose": "Cross-org data sync request"
  }'
```

### Step 4: Configure org-level policies

```bash
curl -X POST http://localhost:3333/api/reach/actors/acme-corp/policies \
  -H "Authorization: Bearer $ORG_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Reject unverified senders",
    "contractTypes": ["HUMAN_HUMAN", "AI_HUMAN"],
    "action": "REJECT",
    "requireVerifiedSender": true,
    "autoAcceptMatching": false,
    "escalateToHuman": false,
    "priority": 200
  }'
```

---

## Inbound Connector (External System Integration)

For systems that receive Knokio contracts via webhook and want to respond programmatically, use the inbound connector:

```bash
curl -X POST http://localhost:3333/api/reach/connectors/inbound \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contractId": "<contract-id>",
    "action": "fulfill",
    "responseData": { "status": "processed" },
    "note": "Processed by external CRM"
  }'
```

Supported actions: `acknowledge`, `accept`, `reject`, `fulfill`.

---

## Contract Expiry Cron

Stale contracts (past `expiresAt`) need periodic cleanup. Set up a cron job to call the expiry endpoint:

### Local/dev

```bash
# Run every 15 minutes
*/15 * * * * curl -sf -X POST http://localhost:3333/api/reach/contracts/expire \
  -H "Authorization: Bearer $CRON_SECRET" >/dev/null 2>&1
```

### Production (Render cron job)

Add to `render.yaml`:
```yaml
- type: cron
  name: reach-contract-expiry
  schedule: "*/15 * * * *"
  buildCommand: ""
  startCommand: |
    curl -sf -X POST $APP_URL/api/reach/contracts/expire \
      -H "Authorization: Bearer $CRON_SECRET"
```

Set `CRON_SECRET` in your environment variables.

### Verify expiry is working

```bash
curl -X POST http://localhost:3333/api/reach/contracts/expire \
  -H "Authorization: Bearer $CRON_SECRET"
# Response: { "ok": true, "expired": 0 }
```

---

## Safety & Abuse Controls

### Block an actor

```bash
curl -X POST http://localhost:3333/api/reach/blocklist \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "targetId": "<actor-id-to-block>" }'
```

### Report abuse

```bash
curl -X POST http://localhost:3333/api/reach/abuse-reports \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contractId": "<contract-id>",
    "reason": "Spam/unwanted outreach",
    "details": "Received 5 identical contracts in one hour"
  }'
```

### Rate limits (configurable via env)

| Variable | Default | Description |
|----------|---------|-------------|
| `REACH_ACTOR_RATE_LIMIT_MAX` | `30` | Max contracts per actor per window |
| `REACH_ACTOR_RATE_LIMIT_WINDOW_MINUTES` | `60` | Rate limit window |
| `REACH_PAIR_COOLDOWN_MINUTES` | `60` | Min gap between same initiator→target |

---

## Pilot Success Criteria

Before scaling beyond pilot, confirm:

| Metric | Target | Where to check |
|--------|--------|----------------|
| One-hop success rate | > 70% | `/api/reach/metrics` or `/reach/metrics` |
| Median time-to-counterparty | < 5 min | `/api/reach/metrics` |
| Path length median | ≤ 3 events | `/api/reach/metrics` |
| Direct KPI regressions | Zero | Direct dashboard (separate) |
| Abuse report rate | < 1% | `/api/reach/abuse-reports` |

### Monitoring cadence

- **Daily:** Check `/api/reach/health` + review `/api/reach/metrics`
- **Weekly:** Review abuse reports, check blocked actors, validate rate limit headroom
- **Per-pilot:** Run smoke test before and after onboarding each new operator

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| 403 on all Reach routes | Verify `ENABLE_REACH=true` in environment |
| Contract stuck in PROPOSED | Check target actor's policies — may be missing matching policy |
| Webhook not firing | Verify webhook is active (`GET /api/reach/actors/:handle/webhooks`) and URL is reachable |
| Circuit breaker open | Webhook endpoint returning 5xx. Check `GET /api/reach/contracts/:id/delivery` for delivery logs |
| Rate limited (429) | Wait for the rate limit window to expire, or increase limits in env vars |
| "Handle already taken" on registration | Handle is globally unique — choose a different handle |
| API key lost | Rotate via `POST /api/reach/actors/:handle/key` (requires current auth) |
