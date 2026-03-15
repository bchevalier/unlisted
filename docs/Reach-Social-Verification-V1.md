# Knokio Reach — Social Verification V1 Spec

> **Status:** Finalized (scaffold implemented, provider adapters pending)
> **Owner:** Chawd / John Mikato
> **Last updated:** 2026-03-15

---

## 1. Goals

1. **Prove social account ownership** — Let creators/influencers verify they control their social handles via a low-friction, privacy-respecting challenge flow.
2. **Expose verified audience signals** — Store follower counts so marketing partners can target verified creators with higher confidence inside Reach contracts.
3. **Enable trust-layered targeting** — Number of verified platforms and audience size become ranking signals for paid Reach offers (influencer product placement, advisory access).
4. **Maintain privacy defaults** — Collect only the minimum data needed; never store OAuth tokens in the verification table; display audience ranges instead of exact counts on any public matching surface.

### Non-goals (V1)

- Automated periodic re-verification (manual re-verify via `force: true`).
- Creator-facing UI for account linking (API-only in V1; UI is a follow-on).
- Embedding or vector-matching on social content.
- Cross-referencing multiple actors claiming the same social handle.

---

## 2. Scope Boundaries — Direct vs Reach Isolation

| Guardrail | How this feature complies |
|-----------|--------------------------|
| **Bounded contexts** | All code lives under `lib/reach/social-verifications.ts`, routes under `/api/reach/actors/:handle/social-verifications/*`. Zero imports into Direct modules. |
| **Feature flag** | Gated by `ENABLE_REACH`. When `false`, all social-verification endpoints return `403`. Direct is unaffected. |
| **UX separation** | No social-verification concepts appear in Direct flows. Direct door settings, inbox, or knocker pages are unchanged. |
| **Trust separation** | Social verification data is stored in a Reach-only table (`ReachSocialVerification`). Direct privacy defaults (contact reveal, caps, blocklist) are never weakened. |
| **Release gates** | Social verification changes are blocked if Direct clarity/safety KPIs regress. |

---

## 3. Data Model

### `ReachSocialVerification` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | `cuid` PK | |
| `actorId` | FK → `ReachActor` | Cascade delete |
| `platform` | `ReachSocialPlatform` enum | `YOUTUBE \| INSTAGRAM \| TIKTOK \| FACEBOOK \| X` |
| `status` | `ReachSocialVerificationStatus` enum | `PENDING \| VERIFIED \| FAILED` |
| `handle` | `String` | Normalized (lowercase, no `@` prefix) |
| `platformUserId` | `String?` | Platform-native user ID (from adapter) |
| `profileUrl` | `String?` | Full profile URL |
| `challengeToken` | `String` | 24-byte hex, internal use only |
| `challengePhrase` | `String` | Public marker, e.g. `knokio-AB12CD` |
| `followerCount` | `Int?` | Updated on successful verification |
| `followerCountUpdatedAt` | `DateTime?` | Timestamp of last follower sync |
| `bioSnapshot` | `String?` | Truncated to 3 000 chars |
| `failureReason` | `String?` | Human-readable failure detail |
| `verifiedAt` | `DateTime?` | Set on first successful verification |
| `lastCheckedAt` | `DateTime?` | Updated on every verify attempt |
| `metadata` | `Json?` | `{ verificationMethod, createdVia }` |
| `createdAt` | `DateTime` | Auto |
| `updatedAt` | `DateTime` | Auto |

**Indexes:**
- `(actorId, platform, status)` — query verified platforms per actor
- `(actorId, platform, handle)` — unique constraint, prevents duplicate links

**Migration:** `prisma/migrations/20260314142000_add_reach_social_verifications/`

---

## 4. API Contracts

All routes under `/api/reach/actors/:handle/social-verifications`.
Auth: standard Reach auth (session cookie for humans, `Bearer knk_…` for headless actors).

**Rate limiting:** Two layers protect every endpoint:
1. **IP-level** — shared Reach limiters (`reachReadLimiter` for GET, `reachWriteLimiter` for POST/DELETE). Applied before auth.
2. **Actor-level** — per-actor sliding-window limits applied after auth:
   - Create: 10 requests/hour (`REACH_SOCIAL_CREATE_LIMIT`)
   - Verify: 20 requests/hour (`REACH_SOCIAL_VERIFY_LIMIT`)
   - Delete: 20 requests/hour (`REACH_SOCIAL_DELETE_LIMIT`)

Exceeded limits return `429 Too Many Requests` with `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers. Successful responses include the same `X-RateLimit-*` headers for quota visibility.

### 4.1 List verifications

```
GET /api/reach/actors/:handle/social-verifications
```

- **Authz:** `ACTOR_READ`
- **Response:** `{ ok, verifications[] }`
- Sorted by `verifiedAt DESC`, then `createdAt DESC`.

### 4.2 Create challenge

```
POST /api/reach/actors/:handle/social-verifications
```

- **Authz:** `ACTOR_UPDATE`
- **Body:**
  ```json
  {
    "platform": "YOUTUBE",
    "handle": "@mychannel",
    "profileUrl": "https://youtube.com/@mychannel"   // optional
  }
  ```
- **Response (201):**
  ```json
  {
    "ok": true,
    "verification": {
      "id": "clx...",
      "platform": "YOUTUBE",
      "handle": "mychannel",
      "profileUrl": "...",
      "status": "PENDING",
      "challengePhrase": "knokio-AB12CD",
      "instructions": "Add \"knokio-AB12CD\" to your YOUTUBE profile bio, then run verification.",
      "createdAt": "..."
    }
  }
  ```
- **Errors:** `ACTOR_NOT_FOUND (404)`, `INVALID_HANDLE (400)`, `HANDLE_ALREADY_LINKED (409)`

### 4.3 Verify challenge

```
POST /api/reach/actors/:handle/social-verifications/:verificationId/verify
```

- **Authz:** `ACTOR_UPDATE`
- **Body (optional):**
  ```json
  {
    "force": false,
    "bioTextOverride": "..." // dev-only, see §8
  }
  ```
- **Response:** Updated verification record with `status`, `followerCount`, `failureReason`, etc.
- **Errors:** `VERIFICATION_NOT_FOUND (404)`, `PLATFORM_NOT_CONFIGURED (412)`, `PROVIDER_ADAPTER_NOT_IMPLEMENTED (501)`

### 4.4 Delete verification

```
DELETE /api/reach/actors/:handle/social-verifications/:verificationId
```

- **Authz:** `ACTOR_UPDATE`
- **Response:** `{ ok: true }`
- **Errors:** `VERIFICATION_NOT_FOUND (404)`

---

## 5. Verification States & Lifecycle

```
                   ┌──────────┐
       POST create │          │
      ─────────────► PENDING  │
                   │          │
                   └────┬─────┘
                        │
                POST verify
                        │
              ┌─────────┴─────────┐
              │                   │
        phrase found         phrase missing
              │                   │
       ┌──────▼──────┐    ┌──────▼──────┐
       │  VERIFIED   │    │   FAILED    │
       └──────┬──────┘    └──────┬──────┘
              │                  │
        POST verify          POST verify
        (force:true)         (retry)
              │                  │
              ▼                  ▼
        re-verified        VERIFIED or FAILED
```

**Key rules:**
- A `VERIFIED` record skips re-check unless `force: true`.
- A `FAILED` record can be retried (calls verify again with same challenge).
- Deletion is always available regardless of status.
- There is no `EXPIRED` status in V1; stale PENDING records are the actor's responsibility to clean up or retry.

---

## 6. Failure Modes

| Failure | HTTP | Code | Behavior |
|---------|------|------|----------|
| IP or actor rate limit exceeded | 429 | `IP_RATE_LIMIT` | `Retry-After` header; `X-RateLimit-*` headers |
| Actor not found or inactive | 404 | `ACTOR_NOT_FOUND` | Reject with clear error |
| Invalid handle (empty after normalization) | 400 | `INVALID_HANDLE` | Reject |
| Duplicate platform+handle for actor | 409 | `HANDLE_ALREADY_LINKED` | Reject; actor must delete old record first |
| Verification record not found / wrong actor | 404 | `VERIFICATION_NOT_FOUND` | Reject |
| Platform env vars not configured | 412 | `PLATFORM_NOT_CONFIGURED` | Lists missing vars; adapter never called |
| Adapter not implemented yet | 501 | `PROVIDER_ADAPTER_NOT_IMPLEMENTED` | Explicit scaffold error; expected in V1 |
| Platform API rate limit / transient failure | 502 | *(future)* | Adapter should throw with retry guidance |
| Challenge phrase not found in bio | 200 | — | `status: FAILED`, `failureReason` set |
| Zod validation failure | 400 | — | Returns `issues` array |
| Unexpected server error | 500 | — | Logged + error tracking capture |

---

## 7. Privacy & Security

### Data minimization
- Store only: handle, platform user ID, profile URL, bio snapshot (truncated), follower count.
- **No OAuth tokens** stored in `ReachSocialVerification`.
- `challengeToken` is internal-only; never returned to the client after creation (only `challengePhrase` is returned).

### Bio snapshot handling
- Truncated to 3 000 characters.
- Used only for verification audit trail; not displayed publicly.

### Follower count exposure
- Exact counts stored internally for ranking.
- Any public-facing surface (matching, search) **must** use range-based display (e.g. "10K–50K") — enforced at the presentation layer.

### Access control
- All endpoints require authenticated Reach actor.
- RBAC permissions: `ACTOR_READ` for listing, `ACTOR_UPDATE` for create/verify/delete.
- Org delegation supported via standard Reach authz (`resolveAuthz`).

### Feature isolation
- Entire module disabled when `ENABLE_REACH=false`.
- No cross-table joins with Direct domain tables.
- Cascade delete: removing a `ReachActor` removes all their verification records.

### Dev-only override
- `SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE=true` permits `bioTextOverride` in verify payload.
- **Must be `false` in production.** Enforced by env convention (`.env.example` defaults to `false`).

---

## 8. Targeting Integration (V1)

### When is a creator "socially targetable"?

A Reach actor is eligible for social-signal-based targeting when:
1. At least one `ReachSocialVerification` has `status = VERIFIED`.
2. The actor's linked door settings have `openToNonTargetedPaidReach = true`.

### Ranking signals (recommended V1 ordering)

| Signal | Weight hint | Rationale |
|--------|-------------|-----------|
| Number of verified platforms | High | Breadth of social proof |
| Maximum follower count | High | Audience reach |
| Follower sync freshness | Medium | Data recency |
| Door plan (PAID preferred) | Low | Commitment signal |

### Integration point
Targeting filters will be added to Reach contracts / search APIs in a follow-on task. V1 lays the data foundation only.

---

## 9. Rollout Phases

### Phase 1 — Scaffold (✅ Complete)
- Data model + migration deployed.
- API endpoints implemented with full authz.
- Unit tests covering create, list, verify (bio override), fail, delete.
- Dev fallback (`bioTextOverride`) enabled for local testing.
- Provider env placeholders in `.env.example`.

### Phase 2 — Provider Adapters
- Implement OAuth + profile-fetch adapters per platform.
- Priority order: **YouTube → Instagram → X → TikTok → Facebook**.
- Each adapter: fetch profile bio, extract follower count, return `ProviderProfileResult`.
- Add integration tests per adapter (mocked API responses).

### Phase 3 — Follower Refresh
- Scheduled background job to re-verify and refresh `followerCount` for `VERIFIED` records.
- Configurable refresh interval (default: weekly).
- Stale-data threshold: mark follower count as "stale" after 30 days without refresh.

### Phase 4 — Targeting Filters
- Expose verified social signals in Reach contract search/proposal APIs.
- Add range-based audience display to any matching surfaces.
- Enable marketing-partner-side filtering by platform, audience range, verification count.

### Phase 5 — Creator UI
- Reach settings page: link/unlink social accounts.
- Visual verification status per platform.
- Show challenge phrase, copy-to-clipboard, verify button.

---

## 10. Acceptance Criteria

### Scaffold (Phase 1) — all met ✅

- [ ] `ReachSocialVerification` table exists with correct schema and indexes.
- [ ] `POST .../social-verifications` creates a PENDING record with challenge phrase.
- [ ] Duplicate `(actorId, platform, handle)` is rejected with 409.
- [ ] Handle normalization strips `@`, lowercases, extracts from URLs.
- [ ] `POST .../verify` with matching `bioTextOverride` sets status to VERIFIED.
- [ ] `POST .../verify` with non-matching bio sets status to FAILED with reason.
- [ ] `POST .../verify` without platform env vars returns 412 `PLATFORM_NOT_CONFIGURED`.
- [ ] `POST .../verify` with env vars but no adapter returns 501 `PROVIDER_ADAPTER_NOT_IMPLEMENTED`.
- [ ] Already-VERIFIED record skips re-check unless `force: true`.
- [ ] `DELETE .../social-verifications/:id` removes the record.
- [ ] `GET .../social-verifications` lists all records for the actor.
- [ ] All endpoints respect `ENABLE_REACH` feature flag (403 when disabled).
- [ ] All endpoints enforce RBAC (`ACTOR_READ` / `ACTOR_UPDATE`).
- [ ] Unit tests pass: create, duplicate reject, list, verify success, verify fail, platform not configured, delete.
- [ ] No imports from Direct modules; no Direct schema changes.
- [ ] Env placeholders added to `.env.example`.
- [ ] `bioTextOverride` only accepted when `SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE=true`.

### Provider Adapters (Phase 2) — pending

- [ ] At least one real platform adapter (YouTube) fetches bio + follower count.
- [ ] Adapter respects platform rate limits and returns structured errors.
- [ ] Integration tests with mocked API responses pass.

### Follower Refresh (Phase 3) — pending

- [ ] Background job refreshes VERIFIED records on configurable schedule.
- [ ] Stale threshold correctly marks outdated follower data.

### Targeting (Phase 4) — pending

- [ ] Contract search API supports filtering by verified social signals.
- [ ] Follower counts displayed as ranges, not exact values, on public surfaces.

---

## 11. Test Coverage

Existing tests: `lib/reach/social-verifications.test.ts`

| Test case | Status |
|-----------|--------|
| Creates challenge for active actor | ✅ |
| Rejects duplicate platform handle | ✅ |
| Lists verifications for actor | ✅ |
| Verifies with bio override (dev mode) | ✅ |
| Marks FAILED when challenge missing | ✅ |
| Returns PLATFORM_NOT_CONFIGURED | ✅ |
| Deletes verification record | ✅ |

---

## 12. File Map

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | `ReachSocialVerification` model + enums |
| `prisma/migrations/20260314142000_add_reach_social_verifications/` | Migration SQL |
| `lib/reach/social-verifications.ts` | Core logic: create, list, verify, delete |
| `lib/reach/social-verifications.test.ts` | Unit tests |
| `app/api/reach/actors/[handle]/social-verifications/route.ts` | GET + POST handlers |
| `app/api/reach/actors/[handle]/social-verifications/[verificationId]/route.ts` | DELETE handler |
| `app/api/reach/actors/[handle]/social-verifications/[verificationId]/verify/route.ts` | POST verify handler |
| `.env.example` | Platform credential placeholders |
| `docs/Reach.md` | Reach pilot guide (references social verification section) |

---

## Appendix: Environment Variables

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `ENABLE_REACH` | Yes | `true` | Master feature flag |
| `YOUTUBE_CLIENT_ID` | Per-platform | — | YouTube adapter |
| `YOUTUBE_CLIENT_SECRET` | Per-platform | — | YouTube adapter |
| `YOUTUBE_API_KEY` | Per-platform | — | YouTube Data API |
| `META_APP_ID` | Per-platform | — | Instagram + Facebook |
| `META_APP_SECRET` | Per-platform | — | Instagram + Facebook |
| `TIKTOK_CLIENT_KEY` | Per-platform | — | TikTok adapter |
| `TIKTOK_CLIENT_SECRET` | Per-platform | — | TikTok adapter |
| `X_CLIENT_ID` | Per-platform | — | X (Twitter) adapter |
| `X_CLIENT_SECRET` | Per-platform | — | X (Twitter) adapter |
| `X_API_BEARER_TOKEN` | Per-platform | — | X read-only API |
| `REACH_SOCIAL_CREATE_LIMIT` | No | `10` | Max challenge creations per actor per window |
| `REACH_SOCIAL_CREATE_WINDOW_SECONDS` | No | `3600` | Sliding window for create limit |
| `REACH_SOCIAL_VERIFY_LIMIT` | No | `20` | Max verify attempts per actor per window |
| `REACH_SOCIAL_VERIFY_WINDOW_SECONDS` | No | `3600` | Sliding window for verify limit |
| `REACH_SOCIAL_DELETE_LIMIT` | No | `20` | Max deletes per actor per window |
| `REACH_SOCIAL_DELETE_WINDOW_SECONDS` | No | `3600` | Sliding window for delete limit |
| `SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE` | No | `false` | Dev-only; **must be `false` in prod** |
