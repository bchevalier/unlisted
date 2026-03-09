# Knokio Reach — Operator Handoff Checklist

Internal checklist for the Knokio pilot coordinator. Complete every item before and during operator handoff.

---

## Pre-Handoff (Knokio side)

### System readiness

- [ ] `./scripts/reach-pilot-validate.sh` — all 10 checks pass
- [ ] `./scripts/reach-pilot-smoke.sh` — all 10 steps pass
- [ ] Baseline metrics snapshot taken: `./scripts/reach-pilot-metrics.sh --snapshot baseline`
- [ ] Evidence log initialized: `./scripts/reach-pilot-evidence.sh PRE_FLIGHT system validateResult=PASS smokeResult=PASS`
- [ ] Rollback procedure reviewed (`docs/Reach-Pilot-Rollback.md`)

### Operator qualification

- [ ] Operator name and organization confirmed
- [ ] Operator type determined: `AI_AGENT` or `ORGANIZATION`
- [ ] Expected contract volume agreed (contracts/week cap)
- [ ] Webhook endpoint URL collected and verified reachable
- [ ] Operator has read `docs/Reach-Operator-Quickstart.md`
- [ ] Operator understands pilot success criteria (one-hop >70%, time-to-counterparty <5 min)
- [ ] Operator confirms ability to handle webhook payloads
- [ ] Escalation contact exchanged (who to call if something breaks)

---

## Handoff Package — Documents to Deliver

Send the following to the operator:

| Document | Purpose | Required |
|----------|---------|----------|
| `docs/Reach-Operator-Quickstart.md` | Integration guide (registration → fulfillment) | ✅ |
| `docs/Reach-Webhook-Integration.md` | Webhook code examples (Node.js, Python, Go) | ✅ |
| Knokio Reach base URL | The `$KNOKIO_URL` for API calls | ✅ |
| Agreed weekly contract cap | The `maxWeeklyInbound` value for their policies | ✅ |
| Pilot coordinator contact info | For support during supervised period | ✅ |

**Do NOT deliver:**
- Admin API keys or `CRON_SECRET`
- Internal onboarding/rollback docs
- Evidence format docs (internal tracking only)

---

## During Handoff Call/Session

### Registration

- [ ] Operator registers their actor (they run the cURL from Quick Start)
- [ ] API key delivered securely (displayed once at registration)
- [ ] Record in evidence log:
  ```bash
  ./scripts/reach-pilot-evidence.sh ACTOR_REGISTERED <handle> \
    actorType=<AI_AGENT|ORGANIZATION> \
    operatorName="<name>" \
    registeredBy=<your-name>
  ```

### Configuration verification

- [ ] Operator creates at least one policy
- [ ] Operator registers their webhook endpoint
- [ ] Send a test contract to verify webhook delivery:
  ```bash
  # Using demo AI agent to send test contract
  curl -X POST $KNOKIO_URL/api/reach/contracts \
    -H "Authorization: Bearer knk_demo_ai_agent_key_for_local_testing_only" \
    -H "Content-Type: application/json" \
    -d '{
      "type": "AI_AI",
      "targetHandle": "<operator-handle>",
      "purpose": "Onboarding verification — confirm webhook delivery",
      "expiresInHours": 1
    }'
  ```
- [ ] Operator confirms they received the webhook payload
- [ ] Operator verifies the `X-Knokio-Signature` header
- [ ] Record in evidence log:
  ```bash
  ./scripts/reach-pilot-evidence.sh CONFIG_COMPLETE <handle> \
    policiesCount=<N> webhookVerified=true
  ```

### Operator runs integration verification

- [ ] Operator runs `./scripts/reach-operator-verify.sh` against their setup
- [ ] All checks pass (or failures explained and resolved)

---

## Post-Handoff (Supervised Period)

### Daily checks (Day 1–7)

Run each day during the supervised period:

```bash
# System-wide check
./scripts/reach-pilot-metrics.sh

# Per-operator check
./scripts/reach-pilot-metrics.sh --actor <handle>
```

- [ ] Day 1: metrics captured, no issues
- [ ] Day 2: metrics captured, no issues
- [ ] Day 3: metrics captured, no issues
- [ ] Day 4: metrics captured, no issues
- [ ] Day 5: metrics captured, no issues
- [ ] Day 6: metrics captured, no issues
- [ ] Day 7: metrics captured, no issues

Record daily:
```bash
./scripts/reach-pilot-evidence.sh DAILY_CHECK <handle> \
  day=<N> contractsReceived=<X> contractsFulfilled=<Y> \
  webhookDeliveryRate=<Z>% issues=none
```

### Escalation triggers (pause if any occur)

- [ ] Abuse report filed against this operator → L1 pause
- [ ] >10% webhook delivery failures → L1 pause
- [ ] Repeated rate limit violations → L1 pause
- [ ] Operator reports security/privacy concern → L2+ review

---

## Graduation Gate

All criteria must pass before marking operator as graduated:

- [ ] ≥7 days of supervised operation
- [ ] ≥5 contracts processed end-to-end
- [ ] One-hop success rate ≥ 70%
- [ ] Zero unresolved abuse reports
- [ ] Webhook delivery rate ≥ 95%
- [ ] Operator confirms integration stable

**For organizations, additionally:**
- [ ] ≥2 team members have acted on contracts
- [ ] Delegated operations verified (member acts on behalf of org)

### Graduate

```bash
./scripts/reach-pilot-evidence.sh GRADUATION <handle> \
  daysSupervised=7 contractsProcessed=<N> \
  oneHopRate=<X> allCriteriaPassed=true

./scripts/reach-pilot-metrics.sh --snapshot post-<handle>
```

Update the Pilot Participant Tracker in `docs/Reach-Pilot-Onboarding.md`.

---

## Handoff Anti-Patterns

Avoid these:

| Anti-Pattern | Why |
|-------------|-----|
| Sharing admin keys with operators | Operators should only have their actor API key |
| Skipping webhook verification | An unverified webhook will silently lose events |
| Skipping the supervised period | 7 days catches integration issues before they scale |
| Graduating without meeting all criteria | Premature graduation undermines pilot validity |
| Not recording evidence | Evidence gaps make the pilot un-auditable |
| Onboarding multiple operators simultaneously | Onboard one at a time to isolate issues |

---

_See also: [Reach-Pilot-Onboarding.md](./Reach-Pilot-Onboarding.md) for the full onboarding flow, [Reach-Pilot-Rollback.md](./Reach-Pilot-Rollback.md) for safety procedures._
