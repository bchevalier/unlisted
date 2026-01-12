# UX Flow — Requester Contact via Email

## Objective
Allow a Requester to contact a Host using an email-shaped interaction,
while preserving Knokio’s rules and structure.

## Actors
- Requester
- Knokio system
- Host

## Preconditions
- Host has an email-enabled door
- Requester has the email handle (e.g. `host@knokio.io`)

## Flow Steps

1. Requester sends an email to `host@knokio.io`
2. Knokio receives the email via inbound proxy
3. System parses:
   - Sender email
   - Subject
   - Body
4. System identifies the target door

---

### Case A — Door has no required fields
5. System creates a `pending` request
6. Host receives a “New request” notification
7. Requester receives no immediate reply

---

### Case B — Door requires form input
5. System sends an automatic reply:
   - Explains that more information is required
   - Provides a one-time form link
6. Requester completes the form
7. System creates a `pending` request

---

## What the Requester Experiences
- No conversation thread
- No back-and-forth
- Clear expectation that silence is possible

## Constraints
- No attachments allowed
- CC/BCC emails rejected
- Replies to auto-emails are ignored

## Acceptance Criteria
- Email reliably becomes a request
- Required fields are never bypassed
- Requester is guided politely, not blocked
