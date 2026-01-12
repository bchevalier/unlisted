# UX Flow — Knocker Contact via Email

## Objective
Allow a Knocker to contact a Keeper using an email-shaped interaction,
while preserving Knokio’s rules and structure.

## Actors
- Knocker
- Knokio system
- Keeper

## Preconditions
- Keeper has an email-enabled door
- Knocker has the email handle (e.g. `keeper@knokio.io`)

## Flow Steps

1. Knocker sends an email to `keeper@knokio.io`
2. Knokio receives the email via inbound proxy
3. System parses:
   - Sender email
   - Subject
   - Body
4. System identifies the target door

---

### Case A — Door has no required fields
5. System creates a `pending` request
6. Keeper receives a “New request” notification
7. Knocker receives no immediate reply

---

### Case B — Door requires form input
5. System sends an automatic reply:
   - Explains that more information is required
   - Provides a one-time form link
6. Knocker completes the form
7. System creates a `pending` request

---

## What the Knocker Experiences
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
- Knocker is guided politely, not blocked
