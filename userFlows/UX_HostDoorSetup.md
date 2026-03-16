# UX Flow — Host Door Setup

## Objective
Allow a Host to configure how they can be contacted by creating and managing Doors.

Two types of Doors exist:
- Non-form Doors (email-only, low friction)
- Form Doors (structured, per category)

## Actors
- Host
- Knokio system

## Preconditions
- Host is authenticated
- Host has a default generic door

## Concepts
- A Host can have:
  - One generic (non-form) door
  - One door per form-based category
- Each door maps to a unique email handle when email is enabled

## Flow Steps

### A. Viewing Doors
1. Host navigates to “My Doors”
2. Host sees:
   - Generic door (default)
   - Zero or more category doors
3. Each door shows:
   - Status (enabled / disabled)
   - Contact method (email, form)
   - Associated handle (if applicable)

---

### B. Non-form Door (Generic Door)
1. Host selects the generic door
2. Host sees:
   - Email handle (e.g. `name@knokio.io`)
   - Weekly cap
   - Forward-to email address (default = signup email)
3. Host may:
   - Change forwarding email
   - Lower the cap
   - Disable the door

Behavior:
- Emails sent to the handle become requests
- No additional fields required

---

### C. Form Door (Per Category)
1. Host clicks “Add a door for a category”
2. Host selects a category (e.g. Advice, Hiring, Press)
3. Host defines:
   - Required fields
   - Optional price (paid request)
   - Cap for this door
4. System creates:
   - A new door
   - A unique email handle (optional)
5. Host is warned:
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
- Host disables email on a form door → form-only
- Host changes forwarding email → applies immediately

## Acceptance Criteria
- Host can clearly understand what each door does
- Host can create, update, and disable doors safely
- Email behavior is predictable and explicit
