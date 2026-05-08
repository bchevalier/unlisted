# BILLING.md

Source of truth for Knokio Direct billing and monetization rules.

Status: **product billing spec / target model**. The current implementation still contains older Free/Paid entitlement plumbing in parts of the app and Stripe integration. When copy, roadmap tasks, or implementation behavior diverge, this file wins.

---

## 1. Direct subscription model

Knokio Direct uses a **single simple plan**.

### Direct
- **$5 / month**
- **All Direct features unlocked**
- Includes **50 handled inbound requests per month**
- Each handled inbound includes **up to 1 system auto-reply / completion email** if needed

This model is intentionally simple:
- no visible Starter / Pro / Enterprise feature gating for Direct core
- no separate auto-reply meter shown as a standalone product tier
- usage scales with actual handled inbound rather than with locked features

---

## 2. Usage billing for Direct

### Billable unit

The billable unit is:

- **1 handled inbound request**

A handled inbound request is a **unique inbound contact attempt that Knokio actually processes into the request lifecycle** after first-pass filtering and validation.

### Included with that billable unit

One handled inbound request includes:
- intake validation
- category/routing evaluation
- spam / low-signal checks
- request creation / lifecycle entry
- status tracking
- **up to 1 system auto-reply** if triggered
  - acknowledgment reply
  - completion-link email
  - other first-pass automated response directly tied to that inbound

### What does NOT count as billable usage

The following do **not** count toward usage:
- blocked spam rejected before request creation
- sender attempts blocked by rate limits or blocklists
- CAPTCHA / Turnstile failures
- malformed or invalid submissions rejected before processing
- duplicate webhook retries / provider retries for the same inbound
- internal keeper notifications / digests
- auth emails (verify email, password reset, etc.)
- billing emails
- admin actions
- inbox reads, settings reads, or status page views

### Direct usage price ladder

After the included 50 handled inbound requests each month:

- **51–250:** **$0.05** per handled inbound
- **251–1,000:** **$0.035** per handled inbound
- **1,001–5,000:** **$0.02** per handled inbound
- **5,001–10,000:** **$0.01** per handled inbound
- **10,000+:** custom / enterprise pricing

### Monthly usage caps

Direct should support a configurable monthly overage cap.

Recommended default:
- **$25** overage cap per month

Recommended optional caps:
- $10
- $25
- $50
- $100
- custom / unlimited

Recommended behavior at cap:
- stop accepting new handled inbound for the rest of the billing cycle
- show a polite capacity / try-again-later message to the sender
- warn the keeper at approximately 70%, 90%, and 100% of cap usage

---

## 3. Pay-to-contact billing

Knokio Direct also supports a separate **pay-to-contact** billing path for categories where the keeper wants requesters to pay for access.

This is distinct from the base Direct subscription and usage billing.

### Core rule

- the **keeper specifies the requester-facing gross price**
- the **minimum price is $2.00**
- Knokio keeps the greater of:
  - **$0.50**, or
  - **10% of the gross price**

### Formula

For a gross requester cost `P`:

- **platform fee** = `max($0.50, 10% of P)`
- **keeper net** = `P - platform fee`

### Examples

- **$2.00** contact price
  - platform fee = **$0.50**
  - keeper net = **$1.50**

- **$5.00** contact price
  - platform fee = **$0.50**
  - keeper net = **$4.50**

- **$10.00** contact price
  - platform fee = **$1.00**
  - keeper net = **$9.00**

- **$100.00** contact price
  - platform fee = **$10.00**
  - keeper net = **$90.00**

### Display rules

For pay-to-contact categories:
- requester sees the **gross requester cost** before payment
- keeper sees both:
  - the **gross requester cost** they configured
  - the **expected net payout** after Knokio fees

### Relationship to Direct usage billing

Unless explicitly changed in a future revision:
- a pay-to-contact request **still counts as 1 handled inbound** for Direct usage metering if Knokio actually processes it
- the requester-side contact payment **does not replace** the keeper's base subscription / usage billing

Reason:
- the platform is doing both jobs
  - protecting and processing inbound for the keeper
  - handling a requester payment flow and economic split

If this feels too punitive in practice, it can be revised later — but any change must be recorded here.

---

## 4. Product copy guidance

Preferred public framing:

- **Knokio Direct — $5/month**
- **All features included**
- **50 handled inbound requests included each month**
- **Pay only for additional usage**

Small-print clarification:

- handled inbound includes up to one automatic reply if needed
- blocked spam / rejected abuse traffic do not count toward usage

For pay-to-contact copy:
- keeper sets the price
- requester sees the gross amount before paying
- Knokio keeps at least $0.50 and 10%

---

## 5. Implementation notes

### Source-of-truth event

The billing ledger should support a dedicated event for handled inbound, e.g.:

- `INBOUND_HANDLED`

with enough metadata to prove:
- request id
- door / account id
- month bucket
- whether usage was included or paid
- whether an auto-reply was sent
- whether the request was pay-to-contact
- computed unit price / amount

### Deduplication rule

Never bill twice for the same inbound because of:
- provider retries
- webhook retries
- idempotency races
- completion / follow-up emails tied to the same original handled inbound

### Current implementation gap

As of this spec:
- parts of the codebase still present older Free/Paid or Starter/Pro/Enterprise assumptions
- Stripe/billing plumbing exists, but product-facing billing should converge on the single-plan + usage model defined here

---

## 6. Related documents

The following docs should reference this file rather than redefining billing independently:
- `README.md`
- `ROADMAP.md`
- `docs/FAQ.md`
- `docs/Onboarding.md`
- `KNOKIO_DIRECT_MVP_TODO_8_PLUS.md`
- `KNOKIO_DIRECT_MVP_REGRESSION_CHECKLIST.md`
T.md`
LIST.md`

LIST.md`
