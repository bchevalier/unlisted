# Deployment Runbook — Knokio First Deploy

Step-by-step commands for deploying Knokio to production for the first time. This runbook assumes Render as the hosting provider and Neon for PostgreSQL.

---

## Prerequisites

Before starting, ensure you have:

- [ ] A Render account with billing enabled
- [ ] A Neon account (or other managed PostgreSQL provider)
- [ ] Access to the `knokio.io` domain DNS settings
- [ ] A Resend account with a verified domain
- [ ] A Stripe account in live mode
- [ ] A Sentry project for error tracking

---

## Phase 1: Database

### 1.1 Provision Neon database

1. Create a new Neon project at [console.neon.tech](https://console.neon.tech)
2. Select region closest to your Render service (e.g., `us-west-2` for Oregon)
3. Copy the connection string:
   ```
   postgresql://user:password@ep-xxx.us-west-2.aws.neon.tech/knokio?sslmode=require
   ```
4. For pooled connections (recommended), use the pooled endpoint:
   ```
   postgresql://user:password@ep-xxx-pooler.us-west-2.aws.neon.tech/knokio?sslmode=require&pgbouncer=true
   ```

### 1.2 Run migrations

From your local machine (with access to the production DATABASE_URL):

```bash
# Set production DATABASE_URL temporarily
export DATABASE_URL="postgresql://user:password@ep-xxx.us-west-2.aws.neon.tech/knokio?sslmode=require"

# Deploy migrations (does NOT reset data like migrate dev)
npx prisma migrate deploy

# Verify tables exist
npx prisma db pull --print | head -20
```

### 1.3 Seed initial data (optional)

Only run this if you need default categories and test data:

```bash
DATABASE_URL="$DATABASE_URL" node prisma/seed.mjs
```

> ⚠️ Do NOT run the seed in production with demo user data. If needed, create a production-specific seed.

---

## Phase 2: DNS

### 2.1 Configure domain records

Add the following DNS records for `knokio.io`:

| Type  | Host                      | Value                                    | TTL  |
|-------|---------------------------|------------------------------------------|------|
| CNAME | `www`                     | `knokio-web.onrender.com`              | 3600 |
| A     | `@`                       | _(Render IP — see Render dashboard)_     | 3600 |
| MX    | `@`                       | _(Resend / email provider MX value)_     | 3600 |
| TXT   | `@`                       | `v=spf1 include:resend.com ~all`         | 3600 |
| CNAME | `resend._domainkey`       | _(Resend DKIM value)_                    | 3600 |
| TXT   | `_dmarc`                  | `v=DMARC1; p=quarantine; rua=mailto:dmarc@knokio.io` | 3600 |
| CNAME | `bounces`                 | _(Resend bounce domain — if applicable)_ | 3600 |

### 2.2 Verify propagation

Wait 30–60 minutes, then verify:

```bash
# MX
dig MX knokio.io +short

# SPF
dig TXT knokio.io +short | grep spf

# DKIM
dig TXT resend._domainkey.knokio.io +short

# DMARC
dig TXT _dmarc.knokio.io +short

# A record
dig A knokio.io +short
```

---

## Phase 3: Render Service

### 3.1 Create web service

1. Go to Render → **New** → **Web Service**
2. Connect the `bchevalier/unlisted` repository
3. Select the `main` branch
4. Render will auto-detect `render.yaml` — verify settings:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm run start`
   - **Health check:** `/api/reach/health`
5. Add custom domain: `knokio.io`

### 3.2 Set environment variables

In the Render dashboard, set all required environment variables:

```bash
# Core (REQUIRED)
NODE_ENV=production
APP_URL=https://knokio.io
NEXTAUTH_URL=https://knokio.io
NEXTAUTH_SECRET=<generate: openssl rand -base64 48>
DATABASE_URL=<neon connection string>
KEEPER_SESSION_SECRET=<generate: openssl rand -base64 48>
AUTH_ENCRYPTION_SECRET=<generate: openssl rand -base64 48>

# Email
RESEND_API_KEY=<from Resend dashboard>
AUTH_EMAIL_FROM=Knokio <no-reply@knokio.io>
INBOUND_EMAIL_WEBHOOK_SECRET=<generate: openssl rand -base64 48>

# Stripe (live mode)
STRIPE_SECRET_KEY=sk_live_<from Stripe dashboard>
STRIPE_PUBLISHABLE_KEY=pk_live_<from Stripe dashboard>
STRIPE_WEBHOOK_SECRET=whsec_<from Stripe webhook config>
STRIPE_PRICE_ID=price_<from Stripe product>

# Admin
ADMIN_EMAIL=admin@knokio.io
ADMIN_PASSWORD_HASH=<generate: node -e "require('bcryptjs').hash('YOUR_PASSWORD',12).then(h=>console.log(h))">
ADMIN_SESSION_SECRET=<generate: openssl rand -base64 48>

# Agent access
AGENT_SIGNUP_SECRET=<generate: openssl rand -base64 48>

# Observability
SENTRY_DSN=<from Sentry project settings>
LOG_LEVEL=info

# Safety
AUTH_DEBUG_RETURN_TOKENS=false

# Feature flags
ENABLE_REACH=true

# Cron auth
CRON_SECRET=<generate: openssl rand -base64 48>
```

> **Secret generation shortcut:**
> ```bash
> for name in NEXTAUTH_SECRET KEEPER_SESSION_SECRET AUTH_ENCRYPTION_SECRET \
>   INBOUND_EMAIL_WEBHOOK_SECRET ADMIN_SESSION_SECRET AGENT_SIGNUP_SECRET CRON_SECRET; do
>   echo "$name=$(openssl rand -base64 48)"
> done
> ```

### 3.3 Deploy

Render auto-deploys from `main`. To trigger manually:

1. Push to `main`: `git push origin main`
2. Or click **Manual Deploy** → **Deploy latest commit** in Render dashboard

### 3.4 Verify deployment

```bash
# Health check
curl -sf https://knokio.io/api/reach/health | jq

# Portal page
curl -sf -o /dev/null -w "%{http_code}" https://knokio.io/direct

# Signup page
curl -sf -o /dev/null -w "%{http_code}" https://knokio.io/direct/signup
```

---

## Phase 4: Cron Jobs

Render creates cron jobs from `render.yaml` automatically. Verify:

1. Go to Render dashboard → **Cron Jobs**
2. Confirm both exist:
   - `direct-request-expiry` — every 15 min
   - `reach-contract-expiry` — every 15 min
3. Set `APP_URL` and `CRON_SECRET` env vars on each cron job
4. Trigger a manual run and check logs for success

---

## Phase 5: Email Infrastructure

### 5.1 Resend domain verification

1. Go to Resend → **Domains** → **Add domain** → `knokio.io`
2. Add the DNS records Resend provides (SPF, DKIM — done in Phase 2)
3. Click **Verify** — wait for green status

### 5.2 Inbound email routing

1. Configure catch-all routing for `*@knokio.io`
2. Set webhook URL to: `https://knokio.io/api/direct/email/inbound`
3. Configure webhook authentication header with `INBOUND_EMAIL_WEBHOOK_SECRET`

### 5.3 Test email delivery

```bash
# Send a test email to a door alias (replace with real alias)
# Then check the inbox at /direct/inbox

# Verify outbound — create account and check for verification email
curl -X POST https://knokio.io/api/direct/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"changeme123456","name":"Test"}'
```

---

## Phase 6: Stripe Setup

### 6.1 Create live-mode product

1. Go to Stripe → **Products** → **Add product**
2. Create "Knokio Paid Door" with monthly pricing
3. Copy the `price_xxx` ID → set as `STRIPE_PRICE_ID`

### 6.2 Configure webhook

1. Go to Stripe → **Developers** → **Webhooks** → **Add endpoint**
2. URL: `https://knokio.io/api/direct/billing/webhook`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
4. Copy signing secret → set as `STRIPE_WEBHOOK_SECRET`

### 6.3 Test checkout

1. Create an account on production
2. Navigate to Settings → Upgrade
3. Complete checkout with a real card (or use Stripe test clock for staging)
4. Verify subscription appears in DB and Stripe dashboard

---

## Phase 7: Smoke Test

Run the automated launch validator:

```bash
npx tsx scripts/validate-launch.ts https://knokio.io
```

Then manually verify:

- [ ] Create account → verify email → log in
- [ ] Submit a request via form → appears in inbox
- [ ] Submit a request via email → appears in inbox
- [ ] Accept a request → knocker sees contact details
- [ ] Admin login → dashboard loads
- [ ] Stripe upgrade → plan changes

---

## Phase 8: Go Live

1. Merge `wip` → `main` (after all checks pass):
   ```bash
   git checkout main
   git merge wip
   git push origin main
   ```
2. Render auto-deploys from `main`
3. Run final smoke test
4. Begin pilot invites (see `docs/Pilot-Invite-Workflow.md`)

---

## Rollback

If something goes wrong:

```bash
# 1. Disable auto-deploy in Render dashboard
# 2. Revert to last known good commit
git revert HEAD
git push origin main

# 3. Or redeploy a specific commit from Render dashboard

# 4. If DB migration caused issues
npx prisma migrate resolve --rolled-back <migration_name>
```

For full rollback procedures, see `docs/Incident-Response.md`.

---

_Complete the `docs/Production-Enablement.md` sign-off table after all phases are done._
