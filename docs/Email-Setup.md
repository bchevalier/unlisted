# Inbound Email Setup — Production Guide

This document covers configuring the `@knokio.io` inbound email domain so that
emails sent to `<alias>@knokio.io` are converted into Knokio requests via the
webhook at `POST /api/direct/email/inbound`.

---

## Architecture overview

```
Sender → MX record → Email provider (catch-all) → HTTP webhook → Knokio app
```

1. **DNS**: MX records point `knokio.io` to the email provider.
2. **Catch-all routing**: the provider accepts all `*@knokio.io` addresses.
3. **Webhook forwarding**: each inbound email is POSTed as JSON to the app.
4. **App processing**: the webhook endpoint parses, validates, rate-limits,
   and creates a request (or sends a form-completion link).

---

## 1. DNS configuration

Add these records to `knokio.io` DNS (exact values depend on provider):

| Type  | Host          | Value / Priority          | TTL  |
|-------|---------------|---------------------------|------|
| MX    | `knokio.io`   | Provider MX (see below)   | 3600 |
| TXT   | `knokio.io`   | `v=spf1 include:<provider> ~all` | 3600 |
| CNAME | `em._domainkey` | Provider DKIM record    | 3600 |

### Provider-specific MX examples

**Resend (recommended — already used for outbound)**

Resend supports inbound email via their API. MX setup:

```
MX  knokio.io  feedback-smtp.us-east-1.amazonses.com  10
```

Or use Resend's own inbound domain verification flow which auto-configures MX.

**SendGrid**

```
MX  knokio.io  mx.sendgrid.net  10
```

**Mailgun**

```
MX  knokio.io  mxa.mailgun.org  10
MX  knokio.io  mxb.mailgun.org  10
```

**Cloudflare Email Routing (free tier)**

Cloudflare can act as a catch-all forwarder without a separate email provider.
Enable Email Routing in the Cloudflare dashboard → set catch-all to forward to
a webhook worker or to the Knokio inbound endpoint.

---

## 2. Catch-all routing

The email provider must accept **all** addresses at `@knokio.io` — not just
pre-registered ones. This is because door aliases are dynamic (created on
signup).

### Resend

1. Verify `knokio.io` domain in the Resend dashboard.
2. Under **Inbound**, enable the domain and set destination to:
   ```
   POST https://knokio.io/api/direct/email/inbound
   ```
3. Resend automatically handles catch-all for verified inbound domains.

### SendGrid

1. Under **Inbound Parse**, add `knokio.io`.
2. Set the webhook URL to `https://knokio.io/api/direct/email/inbound`.
3. Check **POST the raw, full MIME message** or **POST parsed fields** (the
   app expects parsed JSON fields: `to`, `from`, `subject`, `text`).

### Mailgun

1. Add `knokio.io` as a receiving domain.
2. Create a catch-all route:
   ```
   match_recipient(".*@knokio.io")
   → forward("https://knokio.io/api/direct/email/inbound")
   ```
3. Enable the route.

### Cloudflare Email Routing

1. Go to **Email Routing** for the `knokio.io` zone.
2. Set the **Catch-all** action to forward to a Cloudflare Worker.
3. The Worker should POST the parsed email JSON to the Knokio webhook.

---

## 3. Webhook endpoint

**URL:** `POST /api/direct/email/inbound`

**Expected JSON body:**

```json
{
  "to": "alias@knokio.io",
  "from": "\"Sender Name\" <sender@example.com>",
  "subject": "Request title",
  "text": "Plain text body of the email",
  "cc": [],
  "bcc": [],
  "attachments": []
}
```

**Behaviour:**

| Condition | Result |
|-----------|--------|
| Alias not found or disabled | `400` — alias unavailable |
| CC/BCC present | `400` — rejected |
| Attachments present | `400` — rejected |
| Door disabled | `400` — door unavailable |
| Sender blocklisted | `403` — blocked |
| Rate limit exceeded | `429` — too many requests |
| Category has required fields | Creates request in `AWAITING_COMPLETION`, emails sender a form link |
| No required fields | Creates request in `PENDING`, notifies keeper |

---

## 4. Webhook authentication

The inbound email webhook should be protected in production. Options:

1. **Shared secret header**: set `INBOUND_EMAIL_WEBHOOK_SECRET` in env and
   require the provider to send it as a header (e.g., `x-webhook-secret`).
2. **IP allowlisting**: restrict the endpoint to known provider IPs at the
   reverse proxy or WAF level.
3. **Provider signature verification**: some providers (Resend, SendGrid) sign
   webhook payloads with HMAC. Verify the signature before processing.

> **Current status**: the endpoint is open. Add authentication before
> production launch.

---

## 5. Email deliverability (outbound)

Outbound emails (notifications, auto-replies, completion links) already use
Resend via `RESEND_API_KEY`. Ensure the following DNS records are set for
outbound deliverability:

- **SPF**: `v=spf1 include:resend.com ~all`
- **DKIM**: Resend provides a CNAME to add (check domain settings).
- **DMARC**: `v=DMARC1; p=quarantine; rua=mailto:dmarc@knokio.io`

---

## 6. Environment variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `RESEND_API_KEY` | Outbound email delivery | Yes (for notifications) |
| `AUTH_EMAIL_FROM` | Sender address for auth emails | Yes |
| `NOTIFICATION_EMAIL_FROM` | Sender address for notifications (defaults to `AUTH_EMAIL_FROM`) | No |
| `INBOUND_EMAIL_WEBHOOK_SECRET` | Shared secret for inbound webhook auth | Recommended |
| `EMAIL_SENDER_RATE_LIMIT_WINDOW_MINUTES` | Rate limit window per sender (default: 60) | No |
| `EMAIL_SENDER_RATE_LIMIT_MAX` | Max emails per sender per window (default: 5) | No |

---

## 7. Verification checklist

- [ ] MX records resolve correctly: `dig MX knokio.io`
- [ ] SPF record passes: `dig TXT knokio.io`
- [ ] DKIM record resolves: `dig CNAME em._domainkey.knokio.io`
- [ ] Catch-all is enabled (test with random address)
- [ ] Webhook receives POST on email arrival
- [ ] Alias lookup succeeds for existing door slugs
- [ ] Unknown aliases return appropriate error
- [ ] Rate limiting functions under load
- [ ] Required-field categories trigger completion email
- [ ] Outbound emails (notifications) land in inbox (not spam)
- [ ] Webhook authentication is enabled

---

## 8. Testing locally

For local development, the inbound webhook can be tested directly:

```bash
curl -X POST http://localhost:3333/api/direct/email/inbound \
  -H "Content-Type: application/json" \
  -d '{
    "to": "john@knokio.io",
    "from": "test@example.com",
    "subject": "Test inbound",
    "text": "Hello from email"
  }'
```

Use a tool like [ngrok](https://ngrok.com) to expose the local server for
end-to-end testing with a real email provider.

---

End of guide.
