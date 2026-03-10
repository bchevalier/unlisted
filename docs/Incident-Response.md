# Incident Response Playbook — Knokio

Procedures for handling incidents during and after launch. This is a living document — update it as operational patterns emerge.

---

## Severity levels

| Level | Description | Response time | Examples |
|-------|-------------|---------------|---------|
| **P0** | Service down / data loss | Immediate | App crash, DB unreachable, data corruption |
| **P1** | Core flow broken | < 1 hour | Can't signup, can't submit requests, can't accept |
| **P2** | Feature degraded | < 4 hours | Email not sending, Stripe webhook failing, admin panel down |
| **P3** | Minor issue | < 24 hours | UI glitch, non-critical log errors, copy typo |

---

## Incident response steps

### 1. Detect

**Automated signals:**
- Render health check failures (auto-alerts)
- Error tracking spikes (Sentry/Bugsink/GlitchTip if enabled)
- Stripe webhook delivery failures (Stripe dashboard)
- Resend bounce rate spike (Resend dashboard)

**Manual signals:**
- Pilot user reports issue
- Smoke test fails
- Monitoring dashboard anomaly

### 2. Assess

Determine severity using the table above. Key questions:
- Is the service responding at all?
- Can users sign up and log in?
- Can requests be submitted and processed?
- Is data being lost or corrupted?

### 3. Communicate

For P0/P1:
- Notify affected pilot users directly (within 30 min)
- Post status update if public status page exists

For P2/P3:
- Note in internal tracker
- Notify affected users if they reported the issue

### 4. Mitigate

Apply the fastest available fix. See scenario playbooks below.

### 5. Resolve

- Deploy fix
- Verify fix in production
- Update incident log

### 6. Post-mortem

For P0/P1 incidents:
- Write a brief post-mortem within 48 hours
- Include: timeline, root cause, impact, fix, preventive actions
- Store in `docs/incidents/` directory

---

## Scenario playbooks

### S1: Application won't start / health check failing

**Symptoms:** Render shows unhealthy, `/api/reach/health` returns 5xx or timeout

**Diagnosis:**
```bash
# Check Render logs
# Look for: startup crash, missing env var, DB connection error, build failure
```

**Actions:**
1. Check Render logs for the error message
2. If env var missing → add it in Render dashboard → redeploy
3. If DB unreachable → check Neon status page and connection string
4. If build failure → check latest commit for syntax/type errors
5. If persistent → rollback to last known good deployment in Render

**Rollback:**
```bash
# In Render dashboard: Manual Deploy → select previous commit SHA
# Or from git:
git revert HEAD
git push origin main
```

---

### S2: Database connection failures

**Symptoms:** 500 errors on all authenticated routes, "connection refused" in logs

**Diagnosis:**
```bash
# Check Neon status: status.neon.tech
# Verify DATABASE_URL is correct
# Check connection pool limits
```

**Actions:**
1. Check Neon dashboard — is the project active?
2. If Neon is in sleep mode (free tier), wake it by visiting the console
3. Verify `DATABASE_URL` hasn't changed (Neon regenerates on certain operations)
4. If connection pool exhausted → restart the Render service
5. If Neon outage → wait for resolution or failover to backup

**Mitigation:**
- Neon free tier can auto-suspend after inactivity — enable "always on" for production
- Connection pooling (`pgbouncer=true`) helps prevent pool exhaustion

---

### S3: Email delivery failures

**Symptoms:** Users not receiving verification/notification emails, high bounce rate

**Diagnosis:**
```bash
# Check Resend dashboard for delivery status
# Run deliverability check
curl -s https://knokio.io/api/admin/email-deliverability \
  -H "Cookie: admin_session=<token>" | jq

# Check DNS records
dig MX knokio.io +short
dig TXT knokio.io +short | grep spf
```

**Actions:**
1. Check Resend dashboard for bounces/complaints
2. If SPF/DKIM/DMARC records missing → re-add DNS records (see Deployment-Runbook.md)
3. If domain flagged as spam → contact Resend support
4. If Resend outage → check status.resend.com
5. If emails landing in spam → review email content, add `List-Unsubscribe` header

**Temporary workaround:**
- Pilot users can sign up without email verification if you disable the verification requirement via admin
- Manually verify users in the database:
  ```sql
  UPDATE users SET email_verified = NOW() WHERE email = 'user@example.com';
  ```

---

### S4: Inbound email webhook failing

**Symptoms:** Emails to `@knokio.io` not creating requests, webhook 4xx/5xx in email provider logs

**Diagnosis:**
```bash
# Check application logs for inbound email errors
# Look for: auth failures, parsing errors, rate limit hits
```

**Actions:**
1. Verify `INBOUND_EMAIL_WEBHOOK_SECRET` matches between app and email provider
2. Check if webhook URL is correct: `https://knokio.io/api/direct/email/inbound`
3. Check for rate limiting — sender may be throttled
4. Check for parsing errors in logs (malformed email)
5. If webhook endpoint is down → restart Render service

---

### S5: Stripe webhook failures

**Symptoms:** Subscriptions not activating after checkout, plan not reverting after cancellation

**Diagnosis:**
```bash
# Check Stripe dashboard → Developers → Webhooks → Event logs
# Look for: signature verification failures, 5xx responses, timeouts
```

**Actions:**
1. Check Stripe webhook event logs — are events being sent?
2. Verify `STRIPE_WEBHOOK_SECRET` matches the signing secret in Stripe
3. Check webhook URL: `https://knokio.io/api/direct/billing/webhook`
4. If events are failing → replay them from Stripe dashboard
5. If signature mismatch → regenerate webhook secret and update env var

**Manual fix for stuck subscriptions:**
```sql
-- Find the user
SELECT id, email, stripe_customer_id FROM users WHERE email = 'user@example.com';

-- Manually sync subscription status (after verifying in Stripe dashboard)
UPDATE doors SET plan = 'PAID' WHERE user_id = '<user_id>';
```

---

### S6: High error rate / error-tracking spike

**Symptoms:** Error tracker (if configured) shows sudden increase in errors

**Diagnosis:**
1. Open your error tracking dashboard → check top errors by count
2. Look at error details — which route/function is failing?
3. Check if correlates with a recent deployment

**Actions:**
1. If caused by recent deploy → rollback
2. If caused by external service (DB, email, Stripe) → see relevant playbook
3. If new edge case → hotfix and deploy
4. If rate-limiting related → may be legitimate traffic spike, check for abuse

---

### S7: Suspected abuse / bot attack

**Symptoms:** Spike in signups, requests, or API calls; rate limit logs firing frequently

**Diagnosis:**
```bash
# Check recent signups
# Check rate limit logs
# Check abuse reports in admin
```

**Actions:**
1. Check admin dashboard for suspicious activity patterns
2. If specific IP → it should already be rate-limited; verify limits are working
3. If bypassing rate limits → add IP to blocklist or increase Turnstile difficulty
4. If specific sender abusing doors → add to per-door blocklist via admin
5. If DDoS → enable Render's DDoS protection or put Cloudflare in front

**Emergency block:**
```bash
# If Cloudflare is configured, add a firewall rule
# Otherwise, the application-level rate limiting should handle it
```

---

### S8: Data integrity concern

**Symptoms:** Requests showing wrong status, duplicate entries, missing records

**Diagnosis:**
```sql
-- Check for orphaned records
SELECT r.id, r.door_id, d.id as door_exists
FROM requests r
LEFT JOIN doors d ON r.door_id = d.id
WHERE d.id IS NULL;

-- Check for status inconsistencies
SELECT id, status, created_at, updated_at
FROM requests
WHERE status NOT IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'AWAITING_COMPLETION');

-- Check event history for a request
SELECT * FROM request_events WHERE request_id = '<id>' ORDER BY created_at;
```

**Actions:**
1. Identify scope of corruption
2. If caused by a bug → fix the bug first
3. If fixable via SQL → run corrective queries
4. If data loss → check Neon point-in-time recovery (available on paid plans)

---

## Monitoring checklist (daily during pilot)

Run through these checks daily during the first 2 weeks:

- [ ] Render health check: green
- [ ] Error tracking: no new P0/P1 errors (or logs reviewed if provider disabled)
- [ ] Resend: bounce rate < 2%, complaint rate < 0.1%
- [ ] Stripe: no failed webhooks
- [ ] Cron jobs: last run succeeded (check Render cron logs)
- [ ] Pilot user feedback: no blocking issues reported

---

## Contact escalation

| Service | Status page | Support |
|---------|------------|---------|
| Render | status.render.com | Render dashboard → Support |
| Neon | status.neon.tech | Neon dashboard → Support |
| Resend | status.resend.com | support@resend.com |
| Stripe | status.stripe.com | Stripe dashboard → Support |
| Error tracking provider | provider status page | provider dashboard/support |

---

## Incident log template

When a P0/P1 incident occurs, create a file in `docs/incidents/`:

```markdown
# Incident: [TITLE]

**Date:** YYYY-MM-DD
**Severity:** P0/P1
**Duration:** X minutes/hours
**Impact:** [who/what was affected]

## Timeline
- HH:MM — [event]
- HH:MM — [event]

## Root cause
[description]

## Resolution
[what fixed it]

## Preventive actions
- [ ] [action item]
```

---

_Review and update this playbook after each incident. Keep it practical._
