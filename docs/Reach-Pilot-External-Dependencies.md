# Knokio Reach — External Dependency Matrix

What must be in place **outside this codebase** before actual pilot execution begins.  
Everything inside the codebase (code, tests, docs, scripts, operational tooling) is complete.

---

## Infrastructure Dependencies

| # | Dependency | Owner | Status | Blocks |
|---|-----------|-------|--------|--------|
| I1 | **Production PostgreSQL** (Neon or equivalent) | John | Required | All Reach API routes |
| I2 | **Production deployment** (Render or equivalent) with `ENABLE_REACH=true` | John | Required | Pilot onboarding |
| I3 | **Inbound email domain** (`@knokio.io` DNS + webhook routing) | John | Required | Email-to-request flow |
| I4 | **Outbound email provider** (Resend, Postmark, etc.) configured | John | Required | Notifications, webhook alerts |
| I5 | **Contract expiry cron job** running in production | John | Required | Stale contract cleanup |
| I6 | **TLS/HTTPS** on production URL | Render (auto) | Required | Webhook signature verification, operator trust |

## Secret / Config Dependencies

| # | Dependency | Where | Notes |
|---|-----------|-------|-------|
| S1 | `DATABASE_URL` | Production env | Pooled connection string |
| S2 | `NEXTAUTH_SECRET` | Production env | ≥32 chars, random |
| S3 | `APP_URL` / `NEXTAUTH_URL` | Production env | Public URL of deployed instance |
| S4 | `CRON_SECRET` | Production env | For contract expiry endpoint auth |
| S5 | `ENABLE_REACH` | Production env | Must be `true` |
| S6 | `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Production env | If paid Reach features are enabled |
| S7 | `REACH_ACTOR_RATE_LIMIT_MAX` (optional) | Production env | Default 30; tune per pilot volume |

## Operator Dependencies (per pilot participant)

| # | Dependency | Provider | Status | Notes |
|---|-----------|----------|--------|-------|
| O1 | **Identified AI operator** willing to pilot | John (sourcing) | Not started | Need ≥1 AI agent operator |
| O2 | **Identified org ops team** willing to pilot | John (sourcing) | Not started | Need ≥1 organization |
| O3 | **Operator webhook endpoint** (HTTPS, publicly reachable) | Operator | Per-operator | Must support HMAC signature verification |
| O4 | **Operator reads Quickstart + Webhook docs** | Operator | Per-operator | `docs/Reach-Operator-Quickstart.md` + `docs/Reach-Webhook-Integration.md` |
| O5 | **Agreed weekly contract cap** | John + Operator | Per-operator | Sets `maxWeeklyInbound` in policies |
| O6 | **Escalation contact** exchanged | John + Operator | Per-operator | Who to call if something breaks |

## Validation Gates (pre-pilot)

These scripts must pass against the **production** deployment before onboarding any operator:

```bash
# All 10 checks must pass
./scripts/reach-pilot-validate.sh https://<production-url>

# All 10 steps must pass
./scripts/reach-pilot-smoke.sh https://<production-url>

# Baseline snapshot
./scripts/reach-pilot-metrics.sh --snapshot baseline
```

## Sequence: What to Do in What Order

```
1. Deploy to production with ENABLE_REACH=true          [I1, I2, I6, S1–S5]
2. Configure email + outbound provider                   [I3, I4]
3. Set up contract expiry cron                           [I5, S4]
4. Run validate + smoke against production               [Validation Gates]
5. Source first AI operator                              [O1]
6. Run handoff checklist (docs/Reach-Operator-Handoff-Checklist.md)  [O3–O6]
7. 7-day supervised period                               [Daily checks]
8. Graduate or extend                                    [Graduation gate]
9. Source first org ops team                             [O2]
10. Repeat steps 6–8 for org track
```

## What Is NOT an External Dependency

These are **already complete** in the codebase:

- ✅ Reach domain model + migrations
- ✅ All 4 contract types (human↔human, human↔AI, AI↔human, AI↔AI)
- ✅ Policy engine with auto-accept/reject/route/escalate
- ✅ Webhook delivery with HMAC signatures + circuit breaker
- ✅ Org membership + RBAC + delegated operations
- ✅ Rate limiting + blocklist + abuse reporting
- ✅ Pilot metrics (one-hop success, time-to-counterparty, path length)
- ✅ Health endpoint
- ✅ Smoke test, validation, metrics, evidence, and operator verification scripts
- ✅ Onboarding flow, runbook, handoff checklist, rollback procedure
- ✅ Operator quickstart + webhook integration guide (Node/Python/Go)
- ✅ Feature flag isolation (Reach disabled = zero impact on Direct)
- ✅ 622 tests passing, lint clean, typecheck clean, build clean

---

_This document closes the T6 Reach pilot execution scope. All implementable work is done. Actual pilot execution depends on the external dependencies listed above._
