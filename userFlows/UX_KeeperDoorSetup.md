# UX Flow — Keeper Door Setup

## Objective
Allow a Keeper to configure how they can be contacted by creating and managing Doors.

Two types of Doors exist:
- Non-form Doors (email-only, low friction)
- Form Doors (structured, per category)

## Actors
- Keeper
- Knokio system

## Preconditions
- Keeper is authenticated
- Keeper has a default generic door

## Concepts
- A Keeper can have:
  - One generic (non-form) door
  - One door per form-based category
- Each door maps to a unique email handle when email is enabled

## Flow Steps

### A. Viewing Doors
1. Keeper navigates to “My Doors”
2. Keeper sees:
   - Generic door (default)
   - Zero or more category doors
3. Each door shows:
   - Status (enabled / disabled)
   - Contact method (email, form)
   - Associated handle (if applicable)

---

### B. Non-form Door (Generic Door)
1. Keeper selects the generic door
2. Keeper sees:
   - Email handle (e.g. `name@knokio.io`)
   - Weekly cap
   - Forward-to email address (default = signup email)
3. Keeper may:
   - Change forwarding email
   - Lower the cap
   - Disable the door

Behavior:
- Emails sent to the handle become requests
- No additional fields required

---

### C. Form Door (Per Category)
1. Keeper clicks “Add a door for a category”
2. Keeper selects a category (e.g. Advice, Hiring, Press)
3. Keeper defines:
   - Required fields
   - Optional price (paid request)
   - Cap for this door
4. System creates:
   - A new door
   - A unique email handle (optional)
5. Keeper is warned:
   - “Email will require form completion for this door”

Behavior:
- Email → auto-reply → form
- Form submission → request

---

## Key UX Principles
- One door = one clear behavior
- No ambiguous routing
- Email never bypasses form requirements

## Edge Cases
- Keeper disables email on a form door → form-only
- Keeper changes forwarding email → applies immediately

## Acceptance Criteria
- Keeper can clearly understand what each door does
- Keeper can create, update, and disable doors safely
- Email behavior is predictable and explicit
