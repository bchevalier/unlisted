# Knokio Reach — Pilot Guide

Knokio Reach is a consent-based routing layer that connects humans, AI agents, and organizations through policy-governed contracts. It runs as a parallel pilot alongside Knokio Direct, with strict isolation guardrails.

---

## Quick Start (Local)

```bash
# 1. Ensure ENABLE_REACH=true in .env.local (default)
# 2. Run migrations and seed
npm run db:migrate:dev
npm run db:seed

# 3. Start dev server
npm run dev

# 4. Verify Reach is ready
curl http://localhost:3333/api/reach/health
```

The seed creates three demo actors:

| Actor | Type | Handle | Auth |
|-------|------|--------|------|
| Demo Keeper | HUMAN | `john` | Browser session (login as john@knokio.local) |
| Demo AI Agent | AI_AGENT | `demo-ai-agent` | API key: `knk_demo_ai_agent_key_for_local_testing_only` |
| Demo Organization | ORGANIZATION | `demo-org` | API key: `knk_demo_org_key_for_local_testing_only` |

> ⚠️ Demo API keys are **for local testing only**. In production, keys are generated at actor creation and shown once.

---

## Concepts

### Actors

Every participant in Reach is an **actor**. Three types:

- **HUMAN** — linked to a Knokio user account, authenticated via session cookie
- **AI_AGENT** — headless, authenticated via API key (`Bearer knk_...`)
- **ORGANIZATION** — headless, authenticated via API key; can have members

### Contracts

A **contract** is a structured reach attempt from one actor to another. Four types based on actor combination:

| Type | Initiator → Target |
|------|-------------------|
| `HUMAN_HUMAN` | Human reaches a human |
| `HUMAN_AI` | Human reaches an AI agent |
| `AI_HUMAN` | AI agent reaches a human |
| `AI_AI` | AI agent reaches another AI agent |

Contract lifecycle: `PROPOSED → ACTIVE → FULFILLED` (happy path)

Other terminal states: `REJECTED`, `CANCELLED`, `EXPIRED`

### Policies

Each actor configures **policies** that govern how inbound contracts are handled:

- **ACCEPT** — accept (optionally auto-accept matching contracts)
- **REJECT** — reject at the gate
- **ROUTE** — route to the target for manual review
- **ESCALATE** — flag for human review (useful for AI actors)

Policies are evaluated by priority (highest first). They support:
- Contract type filtering
- Verified sender requirements
- Weekly inbound caps
- Structured filters (JSON)

### Webhooks

Actors can register webhook endpoints to receive lifecycle events. Each webhook:
- Has its own HMAC signing secret
- Can filter to specific event types
- Logs delivery attempts for debugging

---

## Feature Flag

Reach is controlled by the `ENABLE_REACH` environment variable:

```bash
ENABLE_REACH=true   # enabled (default)
ENABLE_REACH=false  # disabled — all Reach routes return 403
```

When disabled, Direct is completely unaffected.

---

## API Reference

All Reach API routes are under `/api/reach/`. Authentication is required for all endpoints except `/api/reach/health`.

### Authentication

**Human actors:** Standard browser session cookie (same as Direct login)

**Headless actors (AI/Org):**
```
Authorization: Bearer knk_<your-api-key>
```

### Health Check

```
GET /api/reach/health
```

No auth required. Returns system readiness, actor/contract/policy counts.

### Actors

```
POST /api/reach/actors
```

Register a new actor. Human type requires keeper session. AI/Org types return an API key (shown once).

```json
{
  "type": "AI_AGENT",
  "handle": "my-agent",
  "displayName": "My AI Agent",
  "capabilities": { "intents": ["summarize"] },
  "endpoint": "https://example.com/webhook"
}
```

```
GET    /api/reach/actors/:handle          — Get actor profile
PATCH  /api/reach/actors/:handle          — Update profile
DELETE /api/reach/actors/:handle          — Deactivate actor
POST   /api/reach/actors/:handle/key      — Rotate API key
```

### Organization Members

```
GET    /api/reach/actors/:handle/members              — List members
POST   /api/reach/actors/:handle/members              — Add member
PATCH  /api/reach/actors/:handle/members/:memberId    — Update role
DELETE /api/reach/actors/:handle/members/:memberId    — Remove member
```

### Policies

```
GET    /api/reach/actors/:handle/policies   — List actor's policies
POST   /api/reach/actors/:handle/policies   — Create policy
PATCH  /api/reach/policies/:policyId        — Update policy
DELETE /api/reach/policies/:policyId        — Deactivate policy
```

### Contracts

```
POST   /api/reach/contracts                           — Propose a contract
GET    /api/reach/contracts                           — List contracts
GET    /api/reach/contracts/:contractId               — Get contract + events
POST   /api/reach/contracts/:contractId/transition    — Transition status
POST   /api/reach/contracts/:contractId/override      — Override rejected decision
POST   /api/reach/contracts/expire                    — Expire stale contracts (cron)
```

**Propose a contract:**
```json
{
  "type": "HUMAN_AI",
  "targetHandle": "demo-ai-agent",
  "purpose": "Summarize my inbox",
  "message": "Focus on action items from this week",
  "expiresInHours": 48
}
```

**Query params for listing:**
- `role` — `initiator`, `target`, or `both` (default)
- `status` — filter by status (e.g., `PROPOSED`, `ACTIVE`)
- `escalated=true` — show only escalated contracts
- `limit` / `offset` — pagination

### Webhooks

```
GET    /api/reach/actors/:handle/webhooks              — List webhooks
POST   /api/reach/actors/:handle/webhooks              — Create webhook
PATCH  /api/reach/actors/:handle/webhooks/:webhookId   — Update webhook
DELETE /api/reach/actors/:handle/webhooks/:webhookId   — Delete webhook
POST   /api/reach/actors/:handle/webhooks/:webhookId/rotate — Rotate secret
```

**Create a webhook:**
```json
{
  "url": "https://example.com/knokio-hook",
  "events": ["ACCEPTED", "REJECTED"],
  "description": "Production notification hook"
}
```

Empty `events` array = subscribe to all events.

**Webhook payload:**
```json
{
  "event": "contract.accepted",
  "contractId": "clx...",
  "contractType": "HUMAN_AI",
  "contractStatus": "ACTIVE",
  "purpose": "Summarize my inbox",
  "message": "...",
  "initiator": { "handle": "john", "displayName": "John", "type": "HUMAN" },
  "target": { "handle": "demo-ai-agent", "displayName": "Demo AI Agent", "type": "AI_AGENT" },
  "eventType": "ACCEPTED",
  "eventActor": "SYSTEM",
  "eventNote": "Auto-accepted by policy",
  "timestamp": "2026-03-09T09:00:00.000Z"
}
```

**Signature verification:** Webhooks include an `X-Knokio-Signature` header (HMAC-SHA256). Verify against the signing secret provided at webhook creation.

### Blocklist

```
POST   /api/reach/blocklist    — Block an actor
DELETE /api/reach/blocklist    — Unblock an actor
GET    /api/reach/blocklist    — List blocked actors
```

### Abuse Reports

```
POST /api/reach/abuse-reports   — Report a contract
GET  /api/reach/abuse-reports   — List reports (admin)
```

### Pilot Metrics

```
GET /api/reach/metrics
```

Returns three core pilot metrics:

1. **Path length** — event count per resolved contract (lower = more efficient)
2. **Time-to-qualified-counterparty** — seconds from creation to acceptance
3. **One-hop success rate** — fraction of contracts that succeeded without escalation

Query params: `from`, `to` (ISO dates), `actorId` (org delegation)

---

## UI Routes

| Route | Description |
|-------|-------------|
| `/reach` | Dashboard with contract summary |
| `/reach/register` | Register as a Reach actor |
| `/reach/contracts` | List and filter contracts |
| `/reach/contracts/:id` | Contract detail + actions |
| `/reach/escalations` | Contracts pending human review |
| `/reach/policies` | View policies |
| `/reach/metrics` | Pilot metrics dashboard |
| `/reach/settings` | Actor profile and org memberships |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_REACH` | `true` | Feature flag — set `false` to disable |
| `REACH_ACTOR_RATE_LIMIT_MAX` | `30` | Max contracts per actor per window |
| `REACH_ACTOR_RATE_LIMIT_WINDOW_MINUTES` | `60` | Rate limit window |
| `REACH_PAIR_COOLDOWN_MINUTES` | `60` | Min gap between same initiator→target |
| `REACH_ABUSE_REPORT_RATE_LIMIT_MAX` | `10` | Max abuse reports per actor per window |
| `REACH_ABUSE_REPORT_RATE_LIMIT_WINDOW_MINUTES` | `60` | Abuse report rate limit window |
| `REACH_WEBHOOK_SECRET` | _(none)_ | Global HMAC secret (per-webhook secrets preferred) |
| `EMBEDDING_PROVIDER_ORDER` | `openai,voyage,google` | Provider failover order for embeddings |
| `EMBEDDING_TIMEOUT_MS` | `12000` | Timeout per provider request |
| `EMBEDDINGS_OPENAI_MODEL` | `text-embedding-3-small` | OpenAI default embedding model |
| `EMBEDDINGS_VOYAGE_MODEL` | `voyage-3-lite` | Voyage fallback embedding model |
| `EMBEDDINGS_GOOGLE_MODEL` | `text-embedding-004` | Google fallback embedding model |

---

## Embeddings + Retrieval Strategy

Reach now includes a provider-agnostic embedding client in `lib/reach/embeddings.ts`.

Design goals:
- **Provider portability** — OpenAI/Voyage/Google adapters normalize to one output shape.
- **Failover-first** — `EMBEDDING_PROVIDER_ORDER` controls fallback sequence.
- **Cost-aware default** — start with a small model for stage-1 recall, then rerank downstream.

Recommended retrieval pipeline:
1. Generate query embedding (`generateEmbeddings`) with configured provider chain.
2. ANN/vector search for top-K candidates.
3. Optional reranker/LLM pass over top candidates for final precision.

Helper implementation is available in `lib/reach/retrieval.ts` via `retrieveTopK(...)`:
- plugs into any vector adapter (`hnsw`, `ivf`, `exact`, `hybrid`)
- supports optional rerank hook with non-strict fallback
- returns debug metadata (provider/model/index kind/reranker usage)

A ready-to-use PostgreSQL adapter exists at `lib/vector/pgvector.ts` (`createDoorPgvectorAdapter`).

This keeps stage-1 fast/cheap while preserving nuance in stage-2 selection.

---

## Pilot Evaluation Criteria

Before scaling Reach beyond pilot:

1. **One-hop success rate > 70%** — policies are routing accurately
2. **Median time-to-counterparty < 5 min** — the system is responsive
3. **Path length median ≤ 3 events** — no unnecessary hops
4. **Zero Direct KPI regressions** — Direct clarity, privacy, and trust unaffected
5. **Abuse report rate < 1%** — safety controls are working

Monitor via `/reach/metrics` or `GET /api/reach/metrics`.

---

## Isolation Guardrails

Reach operates with strict isolation from Direct:

- **Bounded contexts:** Separate DB models, routes, services, and UI
- **Feature flag gated:** `ENABLE_REACH=false` fully disables Reach
- **No UX bleed:** Reach complexity never appears in Direct flows
- **Trust separation:** Direct privacy defaults cannot be weakened by Reach
- **Independent release gates:** Reach changes are blocked if Direct KPIs regress

---

## Pilot Rollout

### Operational documents

| Document | Purpose |
|----------|---------|
| [Reach-Pilot-Onboarding.md](./Reach-Pilot-Onboarding.md) | Step-by-step onboarding flow for AI operators and org ops teams |
| [Reach-Pilot-Runbook.md](./Reach-Pilot-Runbook.md) | API-level runbook for pilot operations |
| [Reach-Pilot-Evidence.md](./Reach-Pilot-Evidence.md) | Structured evidence capture format (JSONL) |
| [Reach-Pilot-Rollback.md](./Reach-Pilot-Rollback.md) | Rollback tiers (L1–L4) and safety guard thresholds |

### Operational scripts

| Script | Purpose |
|--------|---------|
| `./scripts/reach-pilot-validate.sh` | Pre-flight validation (10 checks) |
| `./scripts/reach-pilot-smoke.sh` | End-to-end smoke test (10 steps) |
| `./scripts/reach-pilot-metrics.sh` | Metrics capture, threshold checks, and snapshots |
| `./scripts/reach-pilot-evidence.sh` | Evidence log recording and summary |

For step-by-step operator onboarding, see **[Reach-Pilot-Onboarding.md](./Reach-Pilot-Onboarding.md)**.

### Pre-flight validation

Before onboarding any operators, run the pre-flight check:

```bash
./scripts/reach-pilot-validate.sh                    # local dev (http://localhost:3333)
./scripts/reach-pilot-validate.sh https://your.host  # production URL
```

This checks 10 prerequisites: server reachability, feature flag, seed data, API auth, endpoints, webhook infra, and more. All checks must pass.

### Smoke test

Run the end-to-end pilot smoke test to validate the full contract lifecycle:

```bash
./scripts/reach-pilot-smoke.sh                    # local dev (http://localhost:3333)
./scripts/reach-pilot-smoke.sh https://your.host  # production URL
CLEANUP=1 ./scripts/reach-pilot-smoke.sh          # auto-remove test actor after run
```

### Production deployment (Render)

The `render.yaml` blueprint includes:
- Web service with Reach env vars (`ENABLE_REACH`, rate limits)
- Cron job for Reach contract expiry (every 15 minutes)
- Cron job for Direct request expiry (every 15 minutes)
- Health check path pointing to `/api/reach/health`

Required secrets to set in Render dashboard:
- `CRON_SECRET` — shared auth for cron endpoints
- `APP_URL` — public URL of the deployed service
- All other secrets from `.env.example`

### Contract expiry cron

Stale contracts require periodic cleanup. On Render, this is handled automatically by the `reach-contract-expiry` cron service defined in `render.yaml`.

For non-Render deployments, add a cron job:

```bash
# Every 15 minutes
*/15 * * * * curl -sf -X POST $APP_URL/api/reach/contracts/expire \
  -H "Authorization: Bearer $CRON_SECRET" >/dev/null 2>&1
```

Set `CRON_SECRET` in your environment variables (same secret used by Direct expiry).

---

## Testing

```bash
# Run all Reach unit tests
npx vitest run lib/reach/

# Run specific test file
npx vitest run lib/reach/contracts.test.ts
```

Existing test coverage:
- `contracts.test.ts` — actor type validation, transitions, schemas
- `policy-engine.test.ts` — policy evaluation, cap enforcement, matching
- `router.test.ts` — webhook delivery, email notification, dispatch
- `metrics.test.ts` — distribution stats, metric computation
- `safety.test.ts` — blocklist, rate limits, cooldowns, abuse reports
- `auth.test.ts` — API key auth, session auth, feature flag gating
- `webhooks.test.ts` — webhook CRUD, HMAC signing, delivery logging
- `permissions.test.ts` — RBAC, org delegation, permission checks
