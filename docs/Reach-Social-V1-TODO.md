# Knokio Reach Social V1 — Prioritized TODO

> **Created:** 2026-03-15
> **Status:** Active
> **Context:** Phase 1 scaffold is complete (data model, API, tests, dev fallback). This TODO covers Phases 2–5 plus launch readiness.

---

## P0 — Must-have for V1 launch

These items block any real-world social verification usage.

### P0-1: YouTube provider adapter

**What:** Implement `fetchProviderProfile` for YouTube using YouTube Data API v3.
- Fetch channel by handle/custom URL via `channels.list` (part: `snippet,statistics`)
- Extract: `bioText` from `snippet.description`, `followerCount` from `statistics.subscriberCount`, `platformUserId` from channel ID, `profileUrl`
- Handle vanity URLs vs channel IDs vs `@handle` format
- Respect YouTube API quota (10,000 units/day default); cache where possible

**Files:**
- New: `lib/reach/social-adapters/youtube.ts`
- New: `lib/reach/social-adapters/youtube.test.ts`
- Edit: `lib/reach/social-verifications.ts` (wire adapter into `fetchProviderProfile`)

**Acceptance criteria:**
- [ ] `fetchProviderProfile('YOUTUBE', ...)` returns `ProviderProfileResult` with bio, follower count, platform user ID
- [ ] Handle normalization covers `@handle`, `/channel/UCxxx`, `/c/CustomName`, full URL
- [ ] API errors (quota, 404, network) throw structured errors with retry guidance
- [ ] Rate limit headers are respected (back off on 403/429)
- [ ] Unit tests pass with mocked YouTube API responses (success, not found, quota exceeded)

**Test checkpoint:** `npx vitest run lib/reach/social-adapters/youtube.test.ts` green

---

### P0-2: Instagram provider adapter

**What:** Implement adapter using Meta Graph API (Instagram Basic Display or Business API).
- Fetch profile by username via `/me?fields=id,username,biography,followers_count`
- Requires user access token (short-lived → long-lived exchange)
- Extract: `bioText` from `biography`, `followerCount` from `followers_count`

**Files:**
- New: `lib/reach/social-adapters/instagram.ts`
- New: `lib/reach/social-adapters/instagram.test.ts`

**Acceptance criteria:**
- [ ] Returns `ProviderProfileResult` with bio and follower count
- [ ] Handles token expiry gracefully (clear error, not silent failure)
- [ ] Handles private accounts (bio may be available, followers may not)
- [ ] Unit tests with mocked Graph API responses

**Test checkpoint:** `npx vitest run lib/reach/social-adapters/instagram.test.ts` green

---

### P0-3: X (Twitter) provider adapter

**What:** Implement adapter using X API v2 with Bearer token (app-only auth).
- Fetch user by username via `GET /2/users/by/username/:username?user.fields=description,public_metrics`
- Extract: `bioText` from `description`, `followerCount` from `public_metrics.followers_count`

**Files:**
- New: `lib/reach/social-adapters/x.ts`
- New: `lib/reach/social-adapters/x.test.ts`

**Acceptance criteria:**
- [ ] Returns `ProviderProfileResult` with bio and follower count
- [ ] Handles suspended/not-found accounts with clear error codes
- [ ] Respects X rate limits (300 requests/15min for app-only)
- [ ] Unit tests with mocked X API v2 responses

**Test checkpoint:** `npx vitest run lib/reach/social-adapters/x.test.ts` green

---

### P0-4: Adapter dispatch + integration wiring

**What:** Replace the `fetchProviderProfile` scaffold throw with real adapter dispatch.
- Create `lib/reach/social-adapters/index.ts` registry mapping platform → adapter
- Each adapter implements a common `SocialAdapter` interface
- `fetchProviderProfile` calls the registered adapter; falls through to `PROVIDER_ADAPTER_NOT_IMPLEMENTED` for unwired platforms

**Files:**
- New: `lib/reach/social-adapters/index.ts`
- New: `lib/reach/social-adapters/types.ts` (shared `SocialAdapter` interface, `ProviderProfileResult`)
- Edit: `lib/reach/social-verifications.ts` (import + dispatch)

**Acceptance criteria:**
- [ ] `SocialAdapter` interface defined: `fetchProfile(input: ProviderVerificationInput): Promise<ProviderProfileResult>`
- [ ] Registry maps `YOUTUBE`, `INSTAGRAM`, `X` to real adapters; `TIKTOK`, `FACEBOOK` return `501`
- [ ] Existing tests still pass (no regressions)
- [ ] Integration test: end-to-end create → verify flow with mocked adapter

**Test checkpoint:** `npm test` all green, `npx tsc --noEmit` clean

---

### P0-5: Production env safety for bio override

**What:** Add startup assertion that `SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE` is not `true` when `NODE_ENV=production`.
- Fail-fast at boot if misconfigured
- Log warning in development when override is enabled

**Files:**
- Edit: `lib/env.ts` or new `lib/reach/social-env-check.ts`

**Acceptance criteria:**
- [x] Server refuses to start if `NODE_ENV=production` and `SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE=true`
- [x] Warning logged in dev mode when override is enabled (existing `assertBioOverrideSafe` in social-verifications.ts)
- [x] Unit test covers both assertion paths

**Test checkpoint:** Manual verification + unit test ✅

---

### P0-6: End-to-end verification flow smoke test

**What:** Script or test that runs the full create → place challenge → verify → confirm VERIFIED flow against a mocked adapter.
- Validates the entire lifecycle including error paths (bad handle, duplicate, failed verification, force re-verify)
- Can be run as part of CI or manually before deploy

**Files:**
- New: `lib/reach/social-verifications.integration.test.ts` or extend existing test file

**Acceptance criteria:**
- [ ] Happy path: create PENDING → verify → VERIFIED with follower count stored
- [ ] Failure path: create PENDING → verify with wrong bio → FAILED → retry → VERIFIED
- [ ] Duplicate rejection: second create for same platform+handle → 409
- [ ] Force re-verify: VERIFIED + `force:true` → re-checks and updates follower count
- [ ] Delete: any status → deleted
- [ ] Feature flag: `ENABLE_REACH=false` → 403 on all endpoints

**Test checkpoint:** `npx vitest run lib/reach/social-verifications.integration.test.ts` green

---

## P1 — Important for credible launch, not blocking day-1

### P1-1: TikTok provider adapter

**What:** Implement adapter using TikTok API (Login Kit + User Info endpoint).
- Fetch user info via authorized endpoint
- Extract bio and follower count
- TikTok API access requires app review; may need sandbox mode for V1

**Files:**
- New: `lib/reach/social-adapters/tiktok.ts`
- New: `lib/reach/social-adapters/tiktok.test.ts`

**Acceptance criteria:**
- [ ] Returns `ProviderProfileResult` or clear `PLATFORM_NOT_CONFIGURED` if credentials missing
- [ ] Unit tests with mocked responses
- [ ] Registered in adapter dispatch

**Test checkpoint:** Adapter test green

---

### P1-2: Facebook provider adapter

**What:** Implement adapter using Meta Graph API for Facebook Pages/profiles.
- Fetch page/profile by ID via Graph API
- Extract bio/about and follower/fan count

**Files:**
- New: `lib/reach/social-adapters/facebook.ts`
- New: `lib/reach/social-adapters/facebook.test.ts`

**Acceptance criteria:**
- [ ] Returns `ProviderProfileResult` for Pages (profiles may have limited API access)
- [ ] Unit tests with mocked responses
- [ ] Registered in adapter dispatch

**Test checkpoint:** Adapter test green

---

### P1-3: Follower refresh background job (Phase 3)

**What:** Scheduled job that re-verifies VERIFIED records and refreshes `followerCount`.
- Configurable interval (default: weekly)
- Batch processing with rate limit awareness per platform
- Mark follower data as stale after 30 days without refresh
- Skip actors whose doors are inactive

**Files:**
- New: `lib/reach/social-refresh.ts`
- New: `lib/reach/social-refresh.test.ts`
- New: `app/api/reach/social-verifications/refresh/route.ts` (cron endpoint)
- Edit: `render.yaml` (add cron service)

**Acceptance criteria:**
- [ ] Job processes VERIFIED records older than refresh interval
- [ ] Follower count updated; `followerCountUpdatedAt` refreshed
- [ ] Respects platform rate limits (processes in batches with delays)
- [ ] Stale records (>30 days) flagged in query results
- [ ] Job is idempotent (safe to run concurrently)
- [ ] Cron endpoint requires `CRON_SECRET` auth
- [ ] Unit tests cover batch processing and staleness logic

**Test checkpoint:** `npx vitest run lib/reach/social-refresh.test.ts` green

---

### P1-4: Targeting filter integration (Phase 4 foundation)

**What:** Expose verified social signals in Reach contract search/proposal APIs.
- Add query filters: `minVerifiedPlatforms`, `minFollowerCount`, `platforms[]`
- Ranking signals: verified platform count, max follower count, data freshness
- Follower counts displayed as ranges on any external-facing response

**Files:**
- Edit: `lib/reach/contracts.ts` or new `lib/reach/social-targeting.ts`
- New: `lib/reach/social-targeting.test.ts`
- Edit: relevant Reach API routes

**Acceptance criteria:**
- [ ] Contract search supports filtering by verified social signals
- [ ] Follower counts are bucketed into ranges (e.g., `1K-10K`, `10K-50K`, `50K-100K`, `100K-500K`, `500K+`) on external responses
- [ ] Actors with no verifications are excluded from social-signal queries (not penalized in general queries)
- [ ] Unit tests cover filter combinations and range bucketing

**Test checkpoint:** `npx vitest run lib/reach/social-targeting.test.ts` green

---

### P1-5: API rate limiting for social verification endpoints ✅

**What:** Add rate limits specific to social verification endpoints to prevent abuse.
- Limit challenge creation: max 10 per actor per hour
- Limit verify attempts: max 20 per actor per hour
- Limit deletes: max 20 per actor per hour
- IP-level defense-in-depth on all endpoints (reachReadLimiter / reachWriteLimiter)
- Use existing rate limit infrastructure

**Files:**
- Edit: `lib/reach/rate-limit.ts` (new limiter instances)
- Edit: `lib/reach/index.ts` (exports)
- Edit: all social verification route handlers (3 files)
- Edit: `lib/reach/rate-limit.test.ts` (new tests)
- Edit: `.env.example` (env var docs)

**Acceptance criteria:**
- [x] Rate limits enforced per actor (create 10/hr, verify 20/hr, delete 20/hr)
- [x] IP-level rate limits on all endpoints (read + write)
- [x] 429 response with `Retry-After` header when exceeded
- [x] Rate limit config sourced from env vars with sensible defaults
- [x] `X-RateLimit-*` headers on success responses
- [x] Auth-failure tracking via `reachAuthLimiter`
- [x] Existing rate limit tests pattern followed
- [x] All tests pass, types clean

**Test checkpoint:** `npx vitest run lib/reach/rate-limit.test.ts` — 19/19 green ✅

---

### P1-6: Docs update for provider setup

**What:** Document how to obtain and configure API credentials for each supported platform.
- Step-by-step for YouTube, Instagram, X (and TikTok/Facebook when ready)
- Include API quota/rate limit notes
- Include sandbox/test mode instructions

**Files:**
- New: `docs/Reach-Social-Provider-Setup.md`
- Edit: `docs/Reach-Social-Verification-V1.md` (link to setup guide)

**Acceptance criteria:**
- [ ] Each supported platform has setup instructions with screenshots or links
- [ ] Quota and rate limit information documented
- [ ] `.env.example` comments reference the setup guide

---

## P2 — Nice-to-have / follow-on

### P2-1: Creator UI for social account linking (Phase 5)

**What:** Reach settings page where creators can link/unlink social accounts visually.
- Show verification status per platform (pending/verified/failed)
- Copy challenge phrase to clipboard
- One-click verify button
- Visual badges for verified platforms

**Files:**
- New: `app/reach/settings/social/page.tsx`
- New: `components/reach/SocialVerificationCard.tsx`
- New: `components/reach/SocialVerificationList.tsx`

**Acceptance criteria:**
- [ ] Creator can initiate verification for any supported platform
- [ ] Challenge phrase displayed with copy button
- [ ] Verify button triggers verification and shows result
- [ ] Delete/unlink button available for any status
- [ ] Visual status indicators (pending spinner, verified checkmark, failed warning)
- [ ] Responsive layout, consistent with existing Reach UI

---

### P2-2: Duplicate handle detection across actors

**What:** Detect when multiple actors claim the same social handle on the same platform.
- Not blocked in V1 (spec explicitly defers this)
- Add a query/admin view to surface potential conflicts
- Optional: soft warning at challenge creation time

**Files:**
- New: `lib/reach/social-duplicate-detection.ts`
- Edit: admin dashboard if relevant

**Acceptance criteria:**
- [ ] Admin can query for duplicate `(platform, handle)` across actors
- [ ] Warning (not block) surfaced at challenge creation if handle is verified by another actor
- [ ] No changes to existing create flow behavior (still allows duplicates across actors)

---

### P2-3: Verification expiry / staleness policy

**What:** Define and enforce expiry rules for PENDING verifications.
- Auto-expire PENDING records older than 7 days (configurable)
- Add `EXPIRED` status or delete stale records
- Background job piggybacks on follower refresh cron

**Acceptance criteria:**
- [ ] PENDING records older than threshold are cleaned up
- [ ] Cleanup is logged for audit
- [ ] Configurable threshold via env var

---

### P2-4: Social verification in Reach metrics

**What:** Add social verification metrics to the Reach pilot metrics endpoint.
- Total verifications by platform and status
- Verification success rate
- Average time from challenge creation to verification
- Follower distribution across verified actors

**Files:**
- Edit: `lib/reach/metrics.ts`
- Edit: metrics API route

**Acceptance criteria:**
- [ ] New metrics surfaced in `/api/reach/metrics` response
- [ ] Metrics dashboard (`/reach/metrics`) shows social verification stats
- [ ] Unit tests for new metric computations

---

### P2-5: Webhook events for social verification lifecycle

**What:** Fire webhook events when social verifications change status.
- Events: `social_verification.created`, `social_verification.verified`, `social_verification.failed`, `social_verification.deleted`
- Uses existing webhook delivery infrastructure

**Acceptance criteria:**
- [ ] Events dispatched to registered webhooks
- [ ] Event payload includes platform, handle, status, follower count (for verified)
- [ ] Delivery logged like contract events
- [ ] Unit tests with mock webhook delivery

---

## Launch Readiness Checklist

Before shipping social verification to real users:

- [ ] **P0 complete:** At least YouTube + one other adapter (Instagram or X) working end-to-end
- [ ] **Env safety:** Bio override blocked in production (P0-5)
- [ ] **Smoke test green:** Full lifecycle test passes (P0-6)
- [x] **Rate limits:** Social verification endpoints rate-limited (P1-5)
- [ ] **Docs:** Provider setup guide complete for shipped adapters (P1-6)
- [ ] **Feature flag:** `ENABLE_REACH=false` still cleanly disables everything
- [ ] **Direct isolation:** Zero imports from social verification into Direct modules
- [ ] **Lint/type/test:** `npm run lint && npx tsc --noEmit && npm test` all green
- [ ] **Build:** `npm run build` succeeds
- [ ] **Privacy review:** Confirm only range-based follower display on any public surface
- [ ] **Secrets review:** No platform API keys committed; all in env vars
- [ ] **Render deploy:** Env vars configured in Render dashboard for shipped platforms

---

## Execution Order (recommended)

```
P0-5 (env safety)  ─┐
P0-4 (adapter types) ├── can be parallel
P0-1 (YouTube)      ─┘
       │
P0-2 (Instagram)  ── after adapter dispatch is wired
P0-3 (X/Twitter)  ── after adapter dispatch is wired
       │
P0-6 (integration test)
       │
P1-5 (rate limits)
P1-6 (docs)
       │
P1-1 (TikTok)    ─┐
P1-2 (Facebook)   ├── can be parallel, lower priority
P1-3 (refresh job) │
P1-4 (targeting)  ─┘
       │
P2-* (follow-on)
```

---

*End of TODO.*
