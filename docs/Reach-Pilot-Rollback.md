# Knokio Reach — Rollback & Safety Guard Process

This document defines the procedures for pausing, rolling back, or terminating the Reach pilot if safety or quality thresholds are breached.

---

## Rollback Tiers

| Tier | Action | Trigger | Recovery |
|------|--------|---------|----------|
| **L1 — Pause Actor** | Deactivate a specific actor | Actor-level issues (abuse, broken webhook, bad behavior) | Re-activate after issue resolved |
| **L2 — Pause Pilot** | Stop accepting new contracts system-wide | Systemic issues (>3 actors affected, policy engine bug) | Resume after root cause fixed |
| **L3 — Disable Reach** | Set `ENABLE_REACH=false` | Critical safety issue, Direct KPI regression, data breach | Full incident review before re-enabling |
| **L4 — Emergency Rollback** | Deploy last-known-good commit without Reach migrations | Reach code causes server instability or data corruption | Full post-mortem required |

---

## L1 — Pause Actor

**When:** A specific pilot operator is causing issues — abuse reports, excessive errors, policy violations.

### Steps

1. **Deactivate the actor:**
   ```bash
   curl -X DELETE $APP_URL/api/reach/actors/<handle> \
     -H "Authorization: Bearer $ADMIN_KEY_OR_CRON_SECRET"
   ```
   This soft-deletes the actor — existing contracts remain but no new ones are accepted.

2. **Block the actor (if abusive):**
   ```bash
   curl -X POST $APP_URL/api/reach/blocklist \
     -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" \
     -d '{ "targetId": "<actor-id>" }'
   ```

3. **Record incident in evidence log:**
   ```bash
   ./scripts/reach-pilot-evidence.sh INCIDENT <handle> \
     severity=P2 \
     description="<what happened>" \
     action="Actor deactivated" \
     resolved=false
   ```

4. **Notify the operator** — explain what happened and what they need to fix.

5. **To restore:** Re-register the actor or update the actor's status. Verify the issue is resolved before re-enabling.

---

## L2 — Pause Pilot

**When:** Multiple actors are affected, or a systemic issue is found (e.g., policy engine mis-routing, webhook delivery broken globally).

### Steps

1. **Set strict rate limits to effectively pause new contracts:**
   ```bash
   # In environment / .env.local:
   REACH_ACTOR_RATE_LIMIT_MAX=0
   ```
   Restart the server. Existing contracts can still be fulfilled but no new ones accepted.

2. **Alternatively, expire all pending contracts:**
   ```bash
   curl -X POST $APP_URL/api/reach/contracts/expire \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

3. **Record in evidence log:**
   ```bash
   ./scripts/reach-pilot-evidence.sh INCIDENT system \
     severity=P1 \
     description="Pilot paused: <reason>" \
     action="Rate limits set to 0" \
     resolved=false
   ```

4. **Investigate and fix the root cause.**

5. **To resume:** Restore rate limits to normal values and restart. Run smoke test before accepting new operators.

---

## L3 — Disable Reach

**When:** Critical safety issue, or Direct KPIs are regressing due to Reach.

### Steps

1. **Set the feature flag:**
   ```bash
   # In environment / .env.local:
   ENABLE_REACH=false
   ```
   Restart the server. All Reach routes return 403. Direct is completely unaffected.

2. **Verify Direct is unaffected:**
   ```bash
   # Check Direct health
   curl $APP_URL/api/direct/auth/session
   # Check a public door
   curl $APP_URL/u/john
   ```

3. **Record in evidence log:**
   ```bash
   ./scripts/reach-pilot-evidence.sh ROLLBACK system \
     reason="<critical issue description>" \
     affectedActors="all"
   ```

4. **Notify all pilot operators** that Reach is temporarily disabled.

5. **To restore:** Fix the issue, set `ENABLE_REACH=true`, run full pre-flight validation and smoke test.

---

## L4 — Emergency Rollback

**When:** Reach code causes server instability, data corruption, or security breach.

### Steps

1. **Deploy last-known-good commit:**
   ```bash
   git log --oneline -10  # Find the last stable commit
   git checkout <stable-commit>
   # Deploy (Render auto-deploys on push, or manual deploy)
   ```

2. **If database migrations need rollback:**
   ```bash
   # List migrations
   npx prisma migrate status

   # Rollback the Reach-specific migrations
   # Reach migrations are prefixed/named for easy identification:
   #   20260308183512_reach_domain_model
   #   20260309092100_add_reach_org_members_and_permissions
   #   20260309093500_add_reach_webhooks
   #   20260309094900_add_reach_safety_controls
   ```
   ⚠️ **Migration rollback is destructive** — consult the team before proceeding.

3. **Record in evidence log and begin incident post-mortem.**

---

## Safety Guard Thresholds

These thresholds trigger automatic or manual escalation:

| Metric | L1 Threshold | L2 Threshold | L3 Threshold |
|--------|-------------|-------------|-------------|
| Abuse reports against an actor | ≥2 in 24h | ≥5 across all actors in 24h | ≥10 across all actors in 24h |
| Webhook delivery failure rate | >10% for 1 actor | >10% across ≥3 actors | — |
| One-hop success rate | <50% for 1 actor | <50% system-wide | — |
| Contract error rate (5xx) | >5% for 1 actor | >5% system-wide | Any 5xx on Direct routes |
| Rate limit violations | >3 in 1h for 1 actor | — | — |
| Direct KPI regression | — | — | Any measurable regression |
| Data breach / PII leak | — | — | Immediate L3 + security review |

### Monitoring Commands

```bash
# Check abuse reports
curl $APP_URL/api/reach/abuse-reports \
  -H "Authorization: Bearer $ADMIN_KEY" | jq '.reports | length'

# Check system metrics
curl $APP_URL/api/reach/metrics \
  -H "Authorization: Bearer $API_KEY" | jq '{
    oneHopRate: .metrics.oneHopSuccessRate.rate,
    medianTime: .metrics.timeToCounterparty.median,
    pathLength: .metrics.pathLength.median
  }'

# Check health
curl $APP_URL/api/reach/health | jq .
```

---

## Decision Matrix

```
Issue detected
     │
     ▼
Is it actor-specific?
     │
  Yes ──► L1: Pause Actor
     │
  No ──► Are ≥3 actors affected?
              │
           Yes ──► L2: Pause Pilot
              │
           No ──► Is Direct affected?
                       │
                    Yes ──► L3: Disable Reach
                       │
                    No ──► Is there data corruption or security breach?
                                │
                             Yes ──► L4: Emergency Rollback
                                │
                             No ──► L2: Pause Pilot + investigate
```

---

## Post-Incident Checklist

After any L2+ incident:

- [ ] Root cause identified and documented
- [ ] Fix implemented and tested
- [ ] Smoke test passes
- [ ] Pre-flight validation passes
- [ ] Evidence log updated with resolution
- [ ] Affected operators notified
- [ ] Decision: resume pilot / extend supervised period / terminate pilot

---

## Contact & Escalation

| Role | Who | Contact |
|------|-----|---------|
| Pilot Lead | John Mikato | Direct message |
| Engineering | Chawd (agent) | This workspace |

---

_See also: [Reach-Pilot-Onboarding.md](./Reach-Pilot-Onboarding.md) for the onboarding flow, [Reach-Pilot-Evidence.md](./Reach-Pilot-Evidence.md) for evidence format._
