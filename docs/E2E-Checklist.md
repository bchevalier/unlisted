# Final End-to-End Test Checklist

This checklist covers every critical user flow in Knokio Direct for launch validation. Each item should be tested against a production-like environment (production DB, real email delivery, real Stripe keys).

---

## Prerequisites

- [ ] Production database provisioned and migrated
- [ ] Environment variables set in production provider (Render)
- [ ] Resend domain verified and DNS records propagated
- [ ] Stripe products/prices created in live mode
- [ ] Inbound email provider configured with catch-all + webhook
- [ ] `INBOUND_EMAIL_WEBHOOK_SECRET` set in production
- [ ] `CRON_SECRET` set and cron jobs configured

---

## A. Keeper account lifecycle

### A1. Signup
- [ ] Create account with email + password
- [ ] Verify email verification email arrives (check spam folder)
- [ ] Click verification link — account is activated
- [ ] Door is created with chosen slug
- [ ] Door is accessible at `/u/<slug>`
- [ ] Email alias `<slug>@knokio.io` is created

### A2. Social auth signup
- [ ] Sign up with Google — account created, door created
- [ ] Sign up with Apple — account created, door created
- [ ] Sign up with LinkedIn — account created, door created

### A3. Login
- [ ] Log in with email + password
- [ ] Log in with Google
- [ ] Log in with Apple
- [ ] Log in with LinkedIn
- [ ] Session cookie is set correctly
- [ ] Redirect to inbox after login

### A4. Password recovery
- [ ] Request password reset — email arrives
- [ ] Click reset link — can set new password
- [ ] Log in with new password

### A5. Two-factor authentication
- [ ] Enable 2FA — QR code displayed
- [ ] Scan with authenticator app — 2FA active
- [ ] Log in with 2FA — prompted for TOTP code
- [ ] Use recovery code — login succeeds
- [ ] Disable 2FA — login no longer requires code

### A6. Account settings
- [ ] Update display name
- [ ] Change notification preferences
- [ ] View billing status (free plan)

---

## B. Door configuration

### B1. Basic setup
- [ ] Door slug is live and accessible
- [ ] Door page shows Keeper name and enabled categories
- [ ] Disabled categories are hidden from door page
- [ ] Invalid slugs show 404

### B2. Category management
- [ ] Enable/disable categories in Settings
- [ ] Configure required fields per category
- [ ] Set per-category request caps
- [ ] Set global request cap

### B3. Contact reveal
- [ ] Set reveal method to email — verify email is shown on acceptance
- [ ] Set reveal method to redirect URL — verify redirect works
- [ ] Change reveal method — new method applies to next acceptance

### B4. Door disable
- [ ] Disable door — `/u/<slug>` shows disabled state
- [ ] Requests cannot be submitted to disabled door
- [ ] Re-enable door — submissions work again

---

## C. Request submission (form)

### C1. Basic submission
- [ ] Visit `/u/<slug>` — door page loads
- [ ] Select category — dynamic form renders
- [ ] Fill required fields — submit succeeds
- [ ] Request appears in Keeper inbox as "pending"
- [ ] Knocker gets status check link
- [ ] Keeper receives notification email

### C2. Validation
- [ ] Submit with missing required fields — error shown
- [ ] Submit with invalid email — error shown
- [ ] Submit with invalid URL field — error shown

### C3. Rate limiting
- [ ] Submit requests up to IP rate limit — subsequent requests blocked
- [ ] Submit requests up to sender rate limit — subsequent requests blocked

### C4. Bot protection
- [ ] Turnstile CAPTCHA appears (when configured)
- [ ] Honeypot field rejects bot submissions

### C5. Cap enforcement
- [ ] Submit requests up to category cap — subsequent requests blocked
- [ ] Submit requests up to global cap — subsequent requests blocked
- [ ] Wait for cap window reset — submissions work again

---

## D. Request submission (email)

### D1. Basic email → request
- [ ] Send email to `<slug>@knokio.io`
- [ ] Request appears in Keeper inbox
- [ ] Subject becomes request title
- [ ] Body becomes request message (quotes/signatures stripped)

### D2. Required fields trigger
- [ ] Send email to door with required-field category
- [ ] Auto-reply arrives with form completion link
- [ ] Complete form — request moves to "pending"
- [ ] Keeper notified

### D3. Rejection cases
- [ ] Email with attachment — rejected silently
- [ ] Email with CC — rejected silently
- [ ] Email to non-existent alias — rejected
- [ ] Email to disabled door — rejected
- [ ] Email from blocklisted sender — rejected

### D4. Rate limiting
- [ ] Exceed sender rate limit — subsequent emails rejected
- [ ] Exceed door cap — subsequent emails rejected

---

## E. Request lifecycle

### E1. Accept flow
- [ ] View pending request in inbox
- [ ] Click accept — request status changes to "accepted"
- [ ] Knocker receives acceptance notification email
- [ ] Knocker status page shows contact details
- [ ] Accept event recorded in request events

### E2. Decline flow
- [ ] Click decline on pending request
- [ ] Request status changes to "declined"
- [ ] Knocker status page shows declined state (no reason given)
- [ ] Decline event recorded

### E3. Expiry flow
- [ ] Leave request pending past expiry period
- [ ] Cron job runs — request status changes to "expired"
- [ ] Knocker receives expiry notification email
- [ ] Knocker status page shows expired state
- [ ] Expiry event recorded

### E4. Blocklist
- [ ] Add sender to blocklist from request
- [ ] Same sender cannot submit new requests
- [ ] Blocked sender sees no indication of block

---

## F. Knocker experience

- [ ] Status page loads with correct request state
- [ ] Pending state shows "in queue" message
- [ ] Accepted state shows contact details
- [ ] Declined state shows appropriate message
- [ ] Expired state shows appropriate message
- [ ] Invalid/expired token shows error
- [ ] No reply or threading available

---

## G. Billing (Stripe)

### G1. Upgrade flow
- [ ] Click upgrade in Settings
- [ ] Stripe Checkout opens with correct price
- [ ] Complete payment — subscription created
- [ ] Door plan changes to "paid"
- [ ] Paid categories become available
- [ ] Billing status shows active subscription

### G2. Cancellation
- [ ] Cancel subscription from Settings or Stripe portal
- [ ] Subscription remains active until period end
- [ ] After period end, door reverts to free plan
- [ ] Paid category requests are no longer accepted

### G3. Webhook handling
- [ ] `checkout.session.completed` — subscription activated
- [ ] `customer.subscription.deleted` — plan reverted
- [ ] Invalid webhook signature — request rejected

---

## H. Admin tools

- [ ] Admin login works with configured credentials
- [ ] Dashboard shows user/door/request counts
- [ ] Can list and view users
- [ ] Can list and view doors
- [ ] Can view individual requests and events
- [ ] Can suspend a door
- [ ] Can disable a user account
- [ ] Can delete abusive requests
- [ ] Abuse reports are visible and reviewable

---

## I. Abuse and safety

- [ ] Abuse report button works on request page
- [ ] Report is stored and visible in admin
- [ ] IP rate limiting triggers on excessive requests
- [ ] Sender rate limiting triggers on excessive requests
- [ ] Blocklist prevents further submissions
- [ ] CAPTCHA (when enabled) prevents automated submissions

---

## J. Cross-cutting

### J1. Error handling
- [ ] 404 pages render correctly
- [ ] API errors return appropriate status codes
- [ ] Error tracking captures errors (Sentry)
- [ ] Structured logs are emitted correctly

### J2. Security
- [ ] All pages served over HTTPS
- [ ] Session cookies are secure, httpOnly, sameSite
- [ ] CSRF protection on forms
- [ ] Webhook signature verification active
- [ ] Admin endpoints require authentication
- [ ] No secrets in client-side bundles

### J3. Performance
- [ ] Door page loads in < 2 seconds
- [ ] Inbox loads in < 2 seconds with 50+ requests
- [ ] Form submission completes in < 3 seconds

---

## Sign-off

| Area | Tester | Date | Pass? |
|------|--------|------|-------|
| A. Account lifecycle | | | |
| B. Door configuration | | | |
| C. Form submission | | | |
| D. Email submission | | | |
| E. Request lifecycle | | | |
| F. Knocker experience | | | |
| G. Billing | | | |
| H. Admin tools | | | |
| I. Abuse & safety | | | |
| J. Cross-cutting | | | |

**Overall:** [ ] PASS / [ ] FAIL

---

_This checklist should be completed before enabling production traffic._
