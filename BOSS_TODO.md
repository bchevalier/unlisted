# BOSS_TODO.md

## What I need from you (John)

### 1) Secrets / API keys
- [ ] `OPENAI_API_KEY` (for embeddings + memory tooling + agent ops)
  - Temporary placeholder to use now: `OPENAI_API_KEY=OPENAI_API_KEY_PLACEHOLDER`
- [ ] `GOOGLE_API_KEY` (optional, if we want Google-based embeddings/models)
- [ ] `VOYAGE_API_KEY` (optional, if we want Voyage embeddings fallback)
- [ ] `AGENT_SIGNUP_SECRET` (32+ chars)
- [ ] `KEEPER_SESSION_SECRET` (32+ chars)
- [ ] `AUTH_ENCRYPTION_SECRET` (32+ chars)

### 2) Auth providers (production credentials)
- [ ] Google OAuth app (`GOOGLE_OAUTH_CLIENT_ID`)
- [ ] Apple Sign In app (`APPLE_CLIENT_ID` + team config if required)
- [ ] LinkedIn OAuth app (`LINKEDIN_CLIENT_ID`)
- [ ] Privy app (`PRIVY_APP_ID`, `PRIVY_APP_SECRET`)

### 3) Email delivery / sender identities
- [ ] Confirm sender email/domain for auth emails (verification/reset)
- [ ] Resend API key (`RESEND_API_KEY`)
- [ ] Domain verification (SPF/DKIM) for production email reliability

### 4) Payments & billing direction
- [ ] Confirm payment rollout order:
  1. Stripe primary (default)
  2. Crypto optional rail
- [ ] Confirm stablecoins: `USDC` + `USDT`
- [ ] Confirm first chain: `Base`
- [ ] Confirm whether to add Solana in phase 2 and trigger criteria

### 5) Reach pilot inputs
- [ ] Define first 2-3 pilot counterparties (AI operators/org teams)
- [ ] Approve Reach policy defaults (allow/deny/route/escalate rules)
- [ ] Confirm pilot success metrics thresholds (one-hop success, time-to-qualified-counterparty)

### 6) Legal/compliance basics
- [ ] Confirm privacy/terms owner and drafting workflow
- [ ] Confirm risk tolerance for crypto payments (non-custodial phase)
- [ ] Confirm minimum logging/audit retention requirements

### 7) Product decisions to lock now
- [ ] Final ICP wording for paid Direct doors:
  - Influencer product placement
  - Paid advisory/expert access
- [ ] Confirm if LinkedIn should be visible in default signup UI at launch
- [ ] Confirm whether agent login (no captcha) should be enabled now (agent signup already added)
