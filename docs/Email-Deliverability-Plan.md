# Email Deliverability Plan — Production Checklist

This document consolidates the email deliverability plan for Knokio production launch. It covers both inbound (receiving emails at `@knokio.io`) and outbound (sending notifications from Knokio).

---

## Current status

- ✅ Outbound email via Resend (`RESEND_API_KEY`)
- ✅ Inbound email webhook (`POST /api/direct/email/inbound`)
- ✅ Automated deliverability check utility (`lib/email-deliverability.ts`)
- ✅ Admin API endpoint for deliverability status
- ✅ Quote/signature stripping
- ✅ Rate limiting per sender
- ✅ Attachment/CC/BCC rejection
- ✅ Comprehensive failure mode documentation (`docs/Email-Setup.md`)

---

## Pre-launch DNS checklist

Run these verification commands after DNS changes propagate (allow 24–48 hours):

### MX (inbound routing)
```bash
dig MX knokio.io +short
```
Expected: at least one MX record pointing to the email provider.

### SPF (outbound sender authorisation)
```bash
dig TXT knokio.io +short | grep spf
```
Expected: `v=spf1 include:resend.com ~all` (or equivalent).

### DKIM (outbound message signing)
```bash
dig TXT resend._domainkey.knokio.io +short
```
Expected: DKIM public key record.

### DMARC (policy enforcement)
```bash
dig TXT _dmarc.knokio.io +short
```
Expected: `v=DMARC1; p=quarantine; rua=mailto:dmarc@knokio.io` (or `p=reject`).

### Return-Path / bounce subdomain (optional)
```bash
dig CNAME bounces.knokio.io +short
```
Expected: CNAME to provider's bounce domain (Resend configures this automatically).

---

## Automated verification

Run the built-in deliverability check against production:

```bash
# In application context
import { checkDeliverability } from '@/lib/email-deliverability';
const report = await checkDeliverability('knokio.io');
console.log(JSON.stringify(report, null, 2));
```

Or via the admin API endpoint (requires admin authentication):
```bash
curl -s https://knokio.io/api/admin/email-deliverability \
  -H "Cookie: admin_session=<token>" | jq
```

### Expected output
```json
{
  "domain": "knokio.io",
  "overall": "pass",
  "checks": [
    { "name": "MX", "status": "pass" },
    { "name": "SPF", "status": "pass" },
    { "name": "DKIM", "status": "pass" },
    { "name": "DMARC", "status": "pass" },
    { "name": "Return-Path", "status": "pass" }
  ]
}
```

---

## Outbound email testing

### Test 1: Auth emails land in inbox
1. Create a new account with a real email address
2. Verify the verification email arrives in inbox (not spam)
3. Check email headers for SPF=pass, DKIM=pass, DMARC=pass

### Test 2: Notification emails land in inbox
1. Submit a request through a door
2. Verify the Keeper notification email arrives
3. Accept the request — verify the Knocker acceptance email arrives

### Test 3: Completion-required emails
1. Submit an email to a door with required-field categories
2. Verify the auto-reply with form completion link arrives
3. Complete the form — verify the Keeper notification arrives

### Test 4: Digest notifications
1. Configure digest preferences for a door
2. Submit multiple requests
3. Verify the digest email arrives at the expected interval

---

## Inbound email testing

### Test 1: Basic email → request
```bash
# Send a real email to <slug>@knokio.io
# Verify it appears as a pending request in the Keeper inbox
```

### Test 2: Rate limiting
```bash
# Send 6 emails from the same sender within 60 minutes
# Verify the 6th is rejected (default limit: 5)
```

### Test 3: Rejection cases
- Send email with attachment → should be rejected
- Send email with CC → should be rejected
- Send email to non-existent alias → should be rejected
- Send email to disabled door → should be rejected

### Test 4: Webhook authentication
```bash
# Send request without webhook secret → should be rejected (401)
# Send request with correct secret → should be processed
```

---

## Monitoring (post-launch)

### Key metrics to watch
- **Outbound bounce rate** — should be < 2% (check Resend dashboard)
- **Outbound spam complaint rate** — should be < 0.1%
- **Inbound webhook error rate** — monitor 4xx/5xx responses
- **Completion email delivery** — track `AWAITING_COMPLETION` → expiry rate (high = delivery issue)
- **Notification delivery** — watch for `[notification:*-failed]` log patterns

### Alerting thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| Outbound bounce rate | > 2% | > 5% |
| Spam complaint rate | > 0.05% | > 0.1% |
| Inbound 5xx rate | > 1% | > 5% |
| AWAITING_COMPLETION expiry rate | > 30% | > 50% |

### DMARC reporting
Set up a DMARC aggregate report receiver (e.g., via `rua=mailto:dmarc@knokio.io`) and review reports weekly for alignment issues.

---

## Provider configuration summary

| Component | Provider | Config required |
|-----------|----------|-----------------|
| Outbound email | Resend | `RESEND_API_KEY`, domain verification, DNS records |
| Inbound email | Provider-dependent | MX records, catch-all routing, webhook URL |
| Webhook auth | Application | `INBOUND_EMAIL_WEBHOOK_SECRET` env var |
| Bounce handling | Resend | Automatic (via bounce subdomain CNAME) |

---

## Escalation

If deliverability issues arise post-launch:

1. Run `checkDeliverability('knokio.io')` to identify DNS/record issues
2. Check Resend dashboard for bounce/complaint spikes
3. Review DMARC reports for alignment failures
4. Check email provider logs for webhook delivery failures
5. If spam-classified: review email content, add List-Unsubscribe header, contact provider support

---

_See also: `docs/Email-Setup.md` for full inbound email architecture and failure mode documentation._
