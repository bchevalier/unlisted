# Production Enablement Checklist

Step-by-step checklist for enabling the Knokio production environment. Complete these items before opening the service to pilot users.

---

## 1. Infrastructure

### 1.1 Hosting
- [ ] Render web service created from `render.yaml`
- [ ] Build command succeeds: `npm ci && npm run build`
- [ ] Start command succeeds: `npm run start`
- [ ] Health check endpoint responds: `GET /api/reach/health`
- [ ] Auto-deploy from `main` branch enabled
- [ ] Custom domain configured: `knokio.io`
- [ ] SSL/TLS certificate provisioned and active

### 1.2 Database
- [ ] Neon PostgreSQL instance provisioned
- [ ] Connection pooling enabled (recommended for serverless)
- [ ] `DATABASE_URL` set in Render environment
- [ ] Migrations applied: `npx prisma migrate deploy`
- [ ] Database accessible from Render service
- [ ] Backup schedule confirmed (Neon automatic backups)

### 1.3 Cron jobs
- [ ] `direct-request-expiry` cron deployed (every 15 min)
- [ ] `reach-contract-expiry` cron deployed (every 15 min)
- [ ] `CRON_SECRET` set and matches between cron and web service
- [ ] Verify cron hits the correct `APP_URL`

---

## 2. Environment variables

All variables from `.env.example` must be set in the production provider. Critical ones:

### Required
- [ ] `NODE_ENV=production`
- [ ] `APP_URL=https://knokio.io`
- [ ] `NEXTAUTH_URL=https://knokio.io`
- [ ] `NEXTAUTH_SECRET` — 32+ character random secret
- [ ] `DATABASE_URL` — production Neon connection string
- [ ] `KEEPER_SESSION_SECRET` — 32+ character random secret
- [ ] `AUTH_ENCRYPTION_SECRET` — 32+ character random secret

### Email
- [ ] `RESEND_API_KEY` — production Resend key
- [ ] `AUTH_EMAIL_FROM=Knokio <no-reply@knokio.io>`
- [ ] `NOTIFICATION_EMAIL_FROM` — set if different from `AUTH_EMAIL_FROM`
- [ ] `INBOUND_EMAIL_WEBHOOK_SECRET` — shared secret for inbound email auth

### Billing
- [ ] `STRIPE_SECRET_KEY` — live mode key
- [ ] `STRIPE_PUBLISHABLE_KEY` — live mode key
- [ ] `STRIPE_WEBHOOK_SECRET` — from Stripe webhook dashboard
- [ ] `STRIPE_PRICE_ID` — live mode price ID

### Admin
- [ ] `ADMIN_EMAIL` — bootstrap target email for first admin promotion
- [ ] `ADMIN_SESSION_SECRET` — 32+ character random secret
- [ ] Run `npm run admin:bootstrap` once after creating the regular user account
- [ ] `ADMIN_PASSWORD_HASH` only if using legacy env-only fallback (deprecated)

### Auth providers (optional but recommended)
- [ ] `GOOGLE_OAUTH_CLIENT_ID`
- [ ] `APPLE_CLIENT_ID`
- [ ] `LINKEDIN_CLIENT_ID`

### Bot protection (optional)
- [ ] `TURNSTILE_SITE_KEY`
- [ ] `TURNSTILE_SECRET_KEY`

### Observability
- [ ] `ERROR_TRACKING_PROVIDER` — `none|sentry|bugsink|glitchtip`
- [ ] `ERROR_TRACKING_DSN` (or legacy `SENTRY_DSN`) for external provider mode
- [ ] `SENTRY_RELEASE` — set to build SHA or version tag (when using Sentry-compatible providers)
- [ ] `SENTRY_TRACES_SAMPLE_RATE=0.1` (when using Sentry-compatible providers)
- [ ] `LOG_LEVEL=info`

### Agent/machine access
- [ ] `AGENT_SIGNUP_SECRET` — 32+ character random secret
- [ ] `AUTH_DEBUG_RETURN_TOKENS=false` — must be false in production

---

## 3. DNS

- [ ] A/CNAME record: `knokio.io` → Render service
- [ ] MX record: `knokio.io` → email provider
- [ ] TXT record: SPF (`v=spf1 include:resend.com ~all`)
- [ ] CNAME: DKIM selector → Resend DKIM record
- [ ] TXT record: DMARC (`v=DMARC1; p=quarantine; rua=mailto:dmarc@knokio.io`)
- [ ] CNAME: bounces subdomain → Resend bounce domain (if applicable)
- [ ] DNS propagation verified (allow 24–48 hours)

---

## 4. Email infrastructure

- [ ] Resend domain verification complete
- [ ] Inbound email catch-all routing configured
- [ ] Inbound webhook URL points to `https://knokio.io/api/direct/email/inbound`
- [ ] Webhook authentication active (`INBOUND_EMAIL_WEBHOOK_SECRET`)
- [ ] Run deliverability check: all checks pass (MX, SPF, DKIM, DMARC)
- [ ] Send test email to `@knokio.io` — request appears in inbox
- [ ] Send notification from app — lands in inbox (not spam)

---

## 5. Stripe billing

- [ ] Stripe account activated for live payments
- [ ] Product and price created in live mode
- [ ] Webhook endpoint configured: `https://knokio.io/api/direct/billing/webhook`
- [ ] Webhook events enabled: `checkout.session.completed`, `customer.subscription.deleted`
- [ ] Webhook signing secret set as `STRIPE_WEBHOOK_SECRET`
- [ ] Test checkout flow with live Stripe (use a real card or Stripe test clock)
- [ ] Verify subscription creation webhook fires and updates DB
- [ ] Verify cancellation webhook fires and reverts plan

---

## 6. Security hardening

- [ ] All secrets are unique, random, 32+ characters
- [ ] `AUTH_DEBUG_RETURN_TOKENS=false` in production
- [ ] No `.env.local` or secrets committed to git
- [ ] Session cookies: `secure=true`, `httpOnly=true`, `sameSite=lax`
- [ ] CSRF protection active on all mutation endpoints
- [ ] Rate limiting active on auth, form, and email endpoints
- [ ] Admin panel protected by separate auth + session
- [ ] Webhook signature verification active (Stripe + inbound email)
- [ ] Error tracking configured (or explicitly set to logs-only mode) with PII redaction

---

## 7. Observability

- [ ] Error tracking provider configured (Sentry/Bugsink/GlitchTip) or `ERROR_TRACKING_PROVIDER=none`
- [ ] Structured logging active (`LOG_LEVEL=info`)
- [ ] Key routes instrumented with logger and error tracking
- [ ] Health endpoint responding: `GET /api/reach/health`
- [ ] Cron job success/failure visible in Render logs
- [ ] DMARC aggregate reports configured

---

## 8. Smoke test

After all above items are complete, run these quick checks:

- [ ] `https://knokio.io` loads — portal page renders
- [ ] `/direct` loads — Direct client page renders
- [ ] Create a new account — full signup flow works
- [ ] Submit a request via form — appears in inbox
- [ ] Submit a request via email — appears in inbox
- [ ] Accept a request — knocker notified, contact revealed
- [ ] Admin login — dashboard loads with data
- [ ] Stripe upgrade — checkout completes, plan updates

---

## 9. Rollback plan

If critical issues are discovered after enablement:

1. **Disable auto-deploy** in Render to prevent new deployments
2. **Revert to last known good commit**: `git revert` or redeploy previous SHA
3. **Disable inbound email** by removing webhook URL from email provider
4. **Put door in maintenance mode** if needed (disable all doors via admin)
5. **Notify affected pilot users** if data integrity is at risk

---

## Sign-off

| Item | Owner | Date | Done? |
|------|-------|------|-------|
| Infrastructure | | | |
| Environment variables | | | |
| DNS | | | |
| Email infrastructure | | | |
| Stripe billing | | | |
| Security hardening | | | |
| Observability | | | |
| Smoke test | | | |

**Production enabled:** [ ] YES / [ ] NO

---

_Complete this checklist before inviting pilot users. See `docs/Pilot-Invite-Workflow.md` for the next step._
