# KNOKIO_DIRECT_ABUSE_GUARDRAILS.md

## Purpose

Document how free users could abuse Knokio Direct, what guardrails exist or should exist, and whether each guardrail is currently implemented in the MVP codebase.

This document is intentionally blunt.

It separates:
- **Implemented** — present in the current codebase
- **Partial** — some protection exists, but it does not fully solve the abuse path
- **Not implemented** — required policy/product rule exists only as intent, not enforcement

---

## Executive summary

Knokio Direct already has meaningful protection against **public inbound abuse**:
- Turnstile support
- honeypot fields
- IP/sender rate limits
- weekly caps on free doors
- per-door blocklist
- abuse reporting
- admin suspension / disable tools
- email verification for password login
- optional 2FA

However, the most important **free-tier monetization / entitlement abuse** protections are **not fully enforced yet**.

### Biggest current gaps

1. **A user can currently select `PAID` at signup**
   - password signup supports `plan: FREE | PAID`
   - provider signup supports `plan: FREE | PAID`
   - this means a user can provision a paid-style door without proven billing entitlement

2. **A keeper can currently switch their door from FREE → PAID in settings without a billing gate**
   - the plan update route accepts `PAID`
   - the server updates the plan and removes caps
   - there is no hard entitlement check in that path

3. **"1 free account per user" is only partially enforced**
   - one account per email: yes
   - one account per human/device/payment identity: no
   - a determined user can still create multiple free accounts with multiple emails/provider identities

4. **Disposable email signup is not blocked**
   - email verification exists
   - but there is no disposable-domain rejection during signup

5. **"1 form-type door per free user" is not implemented as an explicit plan rule**
   - today, the schema only supports one door per user for everyone
   - this incidentally prevents extra free doors
   - but the entitlement is not modeled explicitly yet

---

## Status legend

- **Implemented** = enforced today in code
- **Partial** = some enforcement, but loopholes remain
- **Not implemented** = policy exists only on paper / desired future rule

---

## Abuse matrix

| Abuse vector | Why it matters | Guardrail | Status | Notes |
|---|---|---|---|---|
| Create many free accounts with the same email | Free-tier farming, repeated trials, inbox/door sprawl | Unique user email | **Implemented** | `User.email @unique` prevents duplicate account per email. |
| Create many free accounts with different emails | Sybil abuse, free-tier farming | Strong identity binding beyond email | **Not implemented** | No phone/card/ID/device-level anti-Sybil control. |
| Create free accounts with disposable inboxes | Makes multi-account farming cheap | Block disposable domains at signup | **Not implemented** | Disposable/free-domain logic exists for requester verification, not keeper signup enforcement. |
| Bot/automated signup flood | Resource exhaustion, spam accounts | Signup rate limits + honeypot | **Implemented** | IP/email auth attempt limits plus hidden-field trap exist on signup/login. |
| Log in to unverified account and operate it | Lets low-trust accounts become active | Email verification required before password login | **Implemented** | Password login rejects unverified email. |
| Compromise keeper account and abuse settings | Hijack door, exfiltrate or misuse inbound | Optional 2FA | **Implemented** | Helpful, but optional, so not universal. |
| Free user self-upgrades to paid at signup | Revenue leakage, cap bypass, entitlement abuse | Enforce billing-backed plan assignment | **Not implemented / open gap** | Current signup flows allow `PAID`. |
| Free user self-upgrades to paid later in settings | Revenue leakage, uncapped usage without paying | Enforce billing-backed plan switch | **Not implemented / open gap** | Current settings API allows FREE ↔ PAID directly. |
| Free user creates more than one Direct door | Door farming, free-tier expansion | Entitlement: max 1 door on Free | **Partial** | Current schema allows only one door total per user, but not as explicit Free-plan logic. |
| Free user creates more than one form-type door | Form spam surface expansion | Entitlement: max 1 form-type door on Free | **Partial** | Only one door exists today, so effectively prevented, but not modeled as plan rule. |
| Free user gets team/shared operator access | Shared account abuse, hidden seat expansion | No team access on Free | **Implemented** | Team/workspace model does not exist yet. |
| Free user uses paid-request lane without paying | Monetization leakage, mispositioned product | Paid request lane gated to paid entitlements | **Partial / risky** | Core quote/payment fields exist; plan gating is conceptually there, but because plan switching is weak, entitlement can be bypassed. |
| Free user receives uncapped inbound | Can use free tier as unlimited inbox | Free weekly caps | **Implemented** | Free doors get weekly door and category caps. |
| Free user bypasses per-category throttles | Concentrates abusive/high-volume flow into a single lane | Category weekly caps | **Implemented** | Free categories have weekly caps. |
| Same sender repeatedly floods a free door via form | Spam / harassment | Per-door sender rate limit | **Implemented** | Sender email is rate-limited for form submissions. |
| Same IP floods one door via form | Bot spam, low-signal floods | Per-door IP rate limit | **Implemented** | One IP is throttled per door. |
| Same IP fans out across many doors | Network-level spray attack | Global IP rate limit | **Implemented** | Protects against multi-door fanout from one IP. |
| Bot submits public forms automatically | Spam / noisy inboxes | Turnstile + honeypot | **Implemented, with caveat** | Turnstile is enforced when configured; if not configured, it fails open for dev/CI. |
| Sender evades structured intake by emailing instead of using the form | Avoids required fields / category structure | Email completion flow | **Implemented** | If required fields exist, email requests are held pending completion via one-time form link. |
| Sender abuses inbound email with CC/BCC or attachments | Harder moderation, parsing abuse, cost | Reject CC/BCC and attachments | **Implemented** | Inbound email route rejects those payloads. |
| Same sender repeatedly floods free door by email | Inbox abuse | Email sender rate limit | **Implemented** | Per-sender inbound email limit exists for free doors. |
| Blocked sender continues to submit | Persistent harasser bypasses keeper choice | Per-door blocklist | **Implemented** | Blocklist checked before form/email/completion acceptance. |
| Free user or knocker abuses the abuse-report feature itself | Report spam, moderation noise | Abuse-report rate limit + dedupe | **Implemented** | Rate-limited per IP and duplicate reports are rejected. |
| Malicious requests continue after complaint | Safety issue, trust erosion | Admin review + suspend door / disable user / delete requests | **Implemented** | Admin tools exist for review and enforcement. |
| Requester claims fake organization legitimacy | Social engineering / misrepresentation | Deterministic requester verification | **Implemented (request-level only)** | Email/domain/org checks classify requests as UNVERIFIED/BASIC/ORG_VERIFIED; not full KYC. |
| Requester uses free/disposable email to appear trustworthy | Low-signal / spam disguised as legit | Free/disposable domain detection | **Implemented for requester scoring only** | Helps classify inbound, but does not block keeper signup abuse. |
| User grabs sensitive/common slugs (`admin`, `support`, `knokio`, etc.) | Brand abuse, phishing, confusion | Reserved slug blocklist + random collision suffixes | **Implemented** | Reserved route/product/infrastructure slugs are blocked. |
| Free user scripts agent signup endpoint | Hidden bulk signup path | Shared secret required | **Implemented** | Agent signup requires `x-agent-signup-secret`; not public self-serve. |

---

## Detailed guardrails

## 1. Account farming

### Abuse path
A determined user creates many free accounts to multiply door capacity, dodge caps, or farm free features.

### Current protections
- unique email per account
- signup IP rate limits
- signup email rate limits
- honeypot field on signup
- email verification for password-based login

### What is still missing
- one-account-per-human enforcement
- disposable email rejection at signup
- stronger anti-Sybil heuristics (device fingerprinting, phone verification, risk scoring, manual review flags)

### Status
**Partial**

---

## 2. Free → Paid entitlement abuse

### Abuse path
A user signs up as `PAID` or flips plan to `PAID` without actually paying, gaining uncapped or paid-only behavior.

### Current protections
- Stripe billing plumbing exists
- billing portal / checkout / webhook routes exist

### Problem
The plan assignment path is still too permissive:
- signup can request `PAID`
- provider auth can request `PAID`
- settings can switch to `PAID`

That means entitlement is not yet strictly tied to billing state.

### Required fix
- server must refuse `PAID` unless billing/subscription status grants it
- public signup should provision only `FREE`
- upgrade to `PAID` should happen only after successful checkout/webhook confirmation
- manual plan toggle should be removed or admin-only in non-dev environments

### Status
**Not implemented / critical gap**

---

## 3. Extra doors / form surfaces on free

### Abuse path
A free user tries to create multiple public door surfaces, increasing free-tier capacity and abuse surface.

### Current protections
- current schema is effectively one user → one door
- there is no team/workspace or multi-door system yet

### Important nuance
This is currently prevented mostly by **schema limitation**, not by explicit plan entitlement logic.

So today:
- one free door: effectively yes
- one form-type door: effectively yes

But future multi-door support would need explicit quota enforcement.

### Status
**Partial (incidentally enforced by current schema)**

---

## 4. Public inbound spam / flooding

### Abuse path
Bots or abusive users hammer public doors with junk requests.

### Current protections
- Cloudflare Turnstile support on public forms
- hidden honeypot field
- per-door IP rate limit
- global IP rate limit across doors
- per-sender email rate limit
- weekly free-door caps
- per-category caps
- per-door blocklist

### Status
**Implemented**

### Caveat
Turnstile verification is skipped when Turnstile is not configured, which is helpful for local dev but should not be true in production.

---

## 5. Email-channel bypass abuse

### Abuse path
A sender uses email to bypass required fields, spam controls, or structure.

### Current protections
- alias resolution to a single door
- reject CC/BCC
- reject attachments
- strip quoted replies/signatures
- sender rate limit on inbound email for free doors
- if required fields exist, request becomes `AWAITING_COMPLETION`
- one-time completion link is generated
- completion step re-checks blocklist and free caps

### Status
**Implemented**

---

## 6. Harassment / persistent unwanted contact

### Abuse path
A sender keeps targeting the same keeper even after being rejected or reported.

### Current protections
- per-door blocklist
- abuse report button
- abuse report storage for admin review
- admin suspend door
- admin disable user
- admin delete abusive requests

### Status
**Implemented**

### What may still be needed later
- faster keeper-side one-click hard block from inbox views
- domain-level / IP-level persistent threat actions
- automated escalations for repeated abuse reports

---

## 7. Fake trust signals / false legitimacy

### Abuse path
A requester tries to look like a legitimate organization or serious commercial lead without actually being one.

### Current protections
- request-scoped verification status
- free/disposable domain detection
- org verification requires org details + matching domain + DNS checks

### Status
**Implemented (lightweight, not full identity assurance)**

### Important nuance
This helps routing and interpretation; it is not KYC and should not be treated as strong proof of identity.

---

## 8. Keeper account takeover / weak auth

### Abuse path
A compromised keeper account can be used to exfiltrate or manipulate inbound.

### Current protections
- password hashing
- email verification before password login
- password reset flow
- optional TOTP 2FA + recovery codes
- auth rate limiting

### Status
**Implemented**

### Caveat
2FA is optional, so high-risk keepers are not automatically protected.

---

## What is actually enforced today vs what is only planned

## Enforced today
- unique email per account
- one door per user (schema-level)
- no team access model
- signup/login rate limiting
- signup/login honeypot
- verified-email gate for password login
- optional 2FA
- reserved slug protection
- public form Turnstile support
- public form honeypot
- per-door IP rate limit
- global IP rate limit
- per-sender form rate limit
- per-sender email rate limit
- free weekly door caps
- free weekly category caps
- blocklist checks
- abuse reporting rate limit and dedupe
- admin suspend/disable/delete controls
- inbound email CC/BCC/attachment rejection
- required-field completion flow for email submissions

## Not safely enforced yet
- one free account per real human
- disposable email rejection at keeper signup
- billing-backed enforcement for PAID entitlements
- explicit plan-based multi-door quota system for future multiple-door support
- explicit "one form-type door max on free" entitlement logic

---

## Recommended next fixes (priority order)

### P0 — must fix before serious rollout
1. **Remove `PAID` from public signup flows**
2. **Block FREE → PAID changes unless subscription status is active/trialing**
3. **Make plan assignment billing-authoritative server-side**
4. **Audit UI so public users cannot self-provision paid entitlements**

### P1 — important free-tier abuse hardening
5. **Reject disposable email domains at keeper signup**
6. **Add anti-Sybil heuristics for repeated free-account creation**
7. **Add admin/risk flags for suspicious signup clusters**

### P2 — future-proofing for multi-door system
8. **Model door quotas as entitlements, not schema accidents**
9. **Explicitly enforce `maxDoors`, `maxFormDoors`, `teamAccessAllowed` by plan**
10. **Add tests proving free-plan quota enforcement**

---

## Bottom line

Knokio Direct is already reasonably protected against **public inbound spam and abuse**.

The weakest part today is not the public form edge.
It is the **plan/entitlement edge**.

So if the question is:

> "Can free users abuse the free tier today?"

The answer is:
- **Yes, in the entitlement sense, there are still important loopholes.**
- **Yes, in the multi-account sense, a determined user can still farm free accounts.**
- **But a lot of the public-facing spam/harassment protections are already in place.**
