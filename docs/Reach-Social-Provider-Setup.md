# Reach Social Verification — Provider Setup Guide

This guide covers how to obtain and configure API credentials for each social platform supported by Knokio Reach's social verification system.

> **Prerequisite:** Familiarity with the social verification flow described in `docs/Reach-Social-Verification-V1.md`.

---

## How it works

When an actor initiates social verification, Knokio:

1. Generates a unique challenge phrase (e.g., `knokio-A1B2C3D4`)
2. Asks the actor to place it in their profile bio
3. Calls the platform adapter to fetch the profile and check for the phrase
4. Stores verification status + follower count for targeting

Each adapter checks its platform-specific env vars **at call time**. If credentials are missing, the adapter returns `PLATFORM_NOT_CONFIGURED` (HTTP 412) — not a crash.

---

## YouTube

**Adapter status:** ✅ Implemented

### Setup

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create a new project (or use an existing one)
3. Enable **YouTube Data API v3** in the [API Library](https://console.cloud.google.com/apis/library/youtube.googleapis.com)
4. Create an **API key** (restrict to YouTube Data API v3 only for safety)
5. Set the env var:

```env
YOUTUBE_API_KEY=AIza...your-key
```

### Quota & Rate Limits

- Default quota: **10,000 units/day**
- `channels.list` call: **1 unit per request**
- At normal usage, this supports ~10,000 verification checks/day
- Monitor usage at [Google Cloud Console → APIs & Services → Dashboard](https://console.cloud.google.com/apis/dashboard)

### Handle Formats

The adapter accepts these formats and normalizes them:

| Input | Resolved as |
|-------|-------------|
| `@mkbhd` | Handle lookup via `forHandle` |
| `mkbhd` | Handle lookup via `forHandle` |
| `https://youtube.com/@mkbhd` | Extracted → handle lookup |
| `https://youtube.com/channel/UCBcRF18a7Qf58cCRy5xuWwQ` | Channel ID lookup |
| `UCBcRF18a7Qf58cCRy5xuWwQ` | Channel ID lookup (24 chars starting with UC) |

---

## X (Twitter)

**Adapter status:** ✅ Implemented

### Setup

1. Go to the [X Developer Portal](https://developer.x.com/en/portal/)
2. Create a project and an app
3. In the app settings, go to **Keys and tokens**
4. Generate a **Bearer Token** (app-only authentication)
5. Set the env var:

```env
X_API_BEARER_TOKEN=AAAA...your-bearer-token
```

### Quota & Rate Limits

- User lookup by username: **300 requests per 15 minutes** (app-only auth)
- The adapter respects `Retry-After` headers on 429 responses
- Free tier has limited access; Essential or Basic tier recommended

### Handle Formats

| Input | Resolved as |
|-------|-------------|
| `@elonmusk` | Username lookup |
| `elonmusk` | Username lookup |
| `https://x.com/elonmusk` | Extracted → username lookup |
| `https://twitter.com/elonmusk` | Extracted → username lookup |

---

## Instagram

**Adapter status:** ⚠️ Scaffolded (requires OAuth token exchange — not yet automated)

### Current Limitation

Instagram's API requires a **user access token** obtained through OAuth. V1 uses a static token from env for testing. Production will require per-actor OAuth token storage.

### Setup (Testing)

1. Create a [Meta App](https://developers.facebook.com/apps/)
2. Add the **Instagram API** (or Instagram Basic Display) product
3. Generate a user access token via the Graph API Explorer or test flow
4. Set the env vars:

```env
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
INSTAGRAM_USER_ACCESS_TOKEN=your-test-user-token
```

### Quota & Rate Limits

- Standard API rate limits apply (200 calls/hour per user token)
- Token expires after 60 days (long-lived) or 1 hour (short-lived)
- The adapter detects expired tokens (error code 190) and returns a clear error

### Handle Formats

| Input | Resolved as |
|-------|-------------|
| `@creator` | Username via `/me` endpoint |
| `creator` | Username via `/me` endpoint |
| `https://instagram.com/creator` | Extracted → username |

### Important Note

The Instagram adapter verifies that the returned username matches the claimed handle. If the token belongs to a different user, verification will fail with `PROVIDER_HANDLE_MISMATCH`.

---

## TikTok

**Adapter status:** 🚧 Scaffolded (returns PLATFORM_NOT_CONFIGURED)

### What's Needed

1. Create a [TikTok Developer App](https://developers.tiktok.com/)
2. Submit for app review (required for user info access)
3. Implement OAuth Login Kit flow for user authorization
4. Env vars when ready:

```env
TIKTOK_CLIENT_KEY=your-client-key
TIKTOK_CLIENT_SECRET=your-client-secret
```

### Timeline

TikTok adapter implementation is P1 priority. The scaffolded adapter will return a `412` with a clear message until credentials and OAuth flow are wired.

---

## Facebook

**Adapter status:** 🚧 Scaffolded (returns PLATFORM_NOT_CONFIGURED)

### What's Needed

1. Use the same [Meta App](https://developers.facebook.com/apps/) as Instagram
2. Add Facebook Login product
3. Request Page access tokens for Page verification
4. Personal profiles have very limited API access; Pages are the primary target

```env
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
```

### Timeline

Facebook adapter implementation is P1 priority. Shares the Meta App with Instagram.

---

## Dev Mode: Bio Override

For local development without any platform credentials, set:

```env
SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE=true
```

This allows passing `bioTextOverride` in the verify request body to simulate what the platform API would return.

**⚠️ This MUST be `false` (or unset) in production.** The server will refuse to start if `NODE_ENV=production` and `SOCIAL_VERIFICATION_ALLOW_BIO_OVERRIDE=true`.

---

## Adding a New Platform

To add a new social platform adapter:

1. Create `lib/reach/social-adapters/<platform>.ts` implementing `SocialAdapter`
2. Create `lib/reach/social-adapters/<platform>.test.ts` with mocked API responses
3. Register the adapter in `lib/reach/social-adapters/index.ts`
4. Add env var requirements to `PLATFORM_ENV_REQUIREMENTS` in `types.ts`
5. Add env vars to `.env.example` with setup comments
6. Document the setup in this file
7. Run `npm test` to verify no regressions

---

*Last updated: 2026-03-15*
