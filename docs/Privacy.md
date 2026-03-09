# Knokio — Privacy Policy

**Effective date:** March 2026
**Last updated:** March 2026

---

## 1. Introduction

Knokio ("we", "us", "our") operates the Knokio service at knokio.io. This Privacy Policy explains what data we collect, how we use it, and your rights regarding your information.

Knokio is built on a core principle: **private by default**. We collect only what is necessary to operate the service, and we never sell or share your data with third parties for advertising or profiling purposes.

---

## 2. What we collect

### 2.1 Account data (Keepers)
When you create a Knokio account, we collect:
- **Email address** — for authentication, notifications, and account recovery
- **Name** — displayed on your door (as you configure it)
- **Authentication credentials** — password hash, or OAuth tokens from Google/Apple/LinkedIn
- **Optional 2FA data** — TOTP secrets and recovery codes (encrypted at rest)

### 2.2 Door configuration
- Door slug (your public address)
- Email alias settings
- Enabled categories and custom fields
- Request caps and notification preferences
- Contact reveal settings (email or redirect URL)

### 2.3 Request data (Knockers)
When someone submits a request through a door, we collect:
- **Sender email** — for status notifications and rate limiting
- **Sender name** — as provided in the form
- **Request content** — subject, message, and any required field values
- **IP address** — for rate limiting and abuse prevention (not stored long-term)

### 2.4 Email data
Emails sent to `@knokio.io` addresses are processed as follows:
- Sender address, subject, and plain-text body are extracted
- The email is converted into a structured request
- Original email content is not stored in raw form after processing
- Attachments are rejected and not stored
- CC/BCC emails are rejected

### 2.5 Payment data
If you subscribe to a paid plan, payment is processed by Stripe. We do not store credit card numbers. We store:
- Stripe customer ID and subscription ID
- Plan type and billing status
- Payment event metadata (amount, date, status)

### 2.6 Technical data
- Browser type and version (from standard HTTP headers)
- Pages visited and actions taken (for error tracking and debugging)
- Timestamps of account actions
- Error logs (with PII redacted)

---

## 3. How we use your data

We use collected data only for:

| Purpose | Data used |
|---------|-----------|
| Operating your door | Door config, categories, caps |
| Delivering requests | Request content, sender email |
| Authenticating you | Email, password hash, OAuth tokens, 2FA data |
| Sending notifications | Email address, notification preferences |
| Preventing abuse | IP addresses, sender emails, rate-limit counters |
| Processing payments | Stripe customer/subscription IDs |
| Debugging and reliability | Error logs, technical data |

We do **not** use your data for:
- Advertising or ad targeting
- Selling to third parties
- Building user profiles for external services
- Training AI models on your content
- Public indexing or search

---

## 4. What we never do

- **No public directory.** Knokio has no people search, no profile browsing, no discovery index.
- **No contact exposure by default.** Your email and personal details are hidden until you explicitly accept a request and choose to reveal them.
- **No data monetisation.** We do not sell, licence, or share your data with advertisers, data brokers, or marketing platforms.
- **No tracking across sites.** We do not use cross-site tracking pixels or third-party analytics that follow you elsewhere.

---

## 5. Data sharing

We share data only in these limited circumstances:

- **Stripe** — payment processing (governed by [Stripe's privacy policy](https://stripe.com/privacy))
- **Email provider (Resend)** — outbound notification delivery (governed by [Resend's privacy policy](https://resend.com/legal/privacy-policy))
- **Error tracking (Sentry)** — application error reports with PII redacted (governed by [Sentry's privacy policy](https://sentry.io/privacy/))
- **Law enforcement** — if legally compelled by valid legal process
- **Safety** — if necessary to prevent imminent harm to a person

We will notify affected users of law enforcement requests unless legally prohibited from doing so.

---

## 6. Data retention

| Data type | Retention |
|-----------|-----------|
| Account data | Until you delete your account |
| Door configuration | Until you delete your door or account |
| Request data | 90 days after resolution (accepted/declined/expired), then anonymised |
| Rate-limit counters | Cleared within 24 hours |
| IP addresses | Not stored beyond the rate-limit window |
| Error logs | 30 days |
| Payment records | As required by financial regulations (typically 7 years) |

---

## 7. Your rights

Depending on your jurisdiction, you may have the right to:

- **Access** your personal data
- **Correct** inaccurate data
- **Delete** your account and associated data
- **Export** your data in a portable format
- **Object** to specific processing
- **Withdraw consent** where processing is consent-based

To exercise any of these rights, contact us at **privacy@knokio.io**.

We will respond within 30 days (or sooner where required by law).

---

## 8. Security

We protect your data through:
- Encrypted connections (TLS) for all traffic
- Hashed passwords (bcrypt)
- Encrypted sensitive fields at the application layer
- Session cookies with secure, httpOnly, sameSite attributes
- Rate limiting and abuse prevention on all public endpoints
- Structured logging with automatic PII redaction
- Regular security review of access controls

For more detail, see our internal security architecture in SECURITY.md (not published publicly; available on request for auditors).

---

## 9. Cookies

Knokio uses only **essential cookies**:

| Cookie | Purpose | Duration |
|--------|---------|----------|
| Session cookie | Authentication | Session (cleared on logout) |
| CSRF token | Form security | Session |

We do not use advertising cookies, analytics cookies, or third-party tracking cookies.

---

## 10. Children

Knokio is not intended for users under 16 years of age. We do not knowingly collect data from children. If we learn that we have collected data from a child under 16, we will delete it promptly.

---

## 11. International transfers

Knokio infrastructure is hosted in the United States (via Render and Neon). If you access Knokio from outside the US, your data may be transferred to and processed in the US. We use industry-standard safeguards for international data transfers.

---

## 12. Changes to this policy

We may update this policy from time to time. Material changes will be communicated via email to registered users and noted on this page. The "Last updated" date at the top reflects the most recent revision.

---

## 13. Contact

For privacy questions or data requests:

**Email:** privacy@knokio.io

---

_This policy applies to the Knokio service operated at knokio.io._
