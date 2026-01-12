# UX Flow — Knocker Contact via Form (Optional Payment)

## Objective
Allow a Knocker to submit a structured request via a form,
with optional direct payment when required by the Keeper.

## Actors
- Knocker
- Knokio system
- Keeper
- Payment provider (Stripe)

## Preconditions
- Keeper has a form-based door
- Knocker has access to the door URL or email escalation link

## Flow Steps

1. Knocker opens the door link
2. Knocker selects the relevant category
3. System displays the form:
   - Required fields
   - Optional explanation text
   - Price (if applicable)

---

### Case A — Free Request
4. Knocker fills in the form
5. Knocker submits
6. System creates a `pending` request
7. Keeper is notified

---

### Case B — Paid Request
4. Knocker fills in the form
5. Knocker proceeds to payment
6. Payment is authorized (not captured)
7. System creates a `pending` request
8. Keeper is notified

---

### Keeper Decision
9. Keeper reviews the request
10. Keeper chooses:
    - Accept → payment is captured, contact revealed
    - Decline / Ignore → payment is released, request expires

---

## UX Principles
- Payment is clearly tied to *consideration*, not response
- No tipping, no negotiation
- One action, one decision

## Edge Cases
- Payment authorization fails → request not created
- Keeper never responds → request expires, no charge

## Acceptance Criteria
- Knocker understands what they’re paying for
- No payment is captured without Keeper acceptance
- Flow feels fair and transparent to both sides
