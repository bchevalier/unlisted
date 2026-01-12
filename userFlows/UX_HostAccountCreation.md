# UX Flow — Host Account Creation

## Objective
Allow a user to create a Knokio account and become a Host with minimal friction,
while clearly explaining what Knokio does and does not do.

## Actors
- User (future Host)
- Knokio system

## Preconditions
- User is not authenticated
- User arrives from landing page or invitation link

## Flow Steps

1. User clicks “Create your Knokio”
2. User is shown a short explanation:
   - “Knokio lets you be reachable without being exposed”
   - “Requests are not conversations”
   - “You always decide whether to respond”
3. User signs up using:
   - email + password OR
   - magic link
4. System creates:
   - User account
   - Default Host profile
   - One default Door (generic, no form)
5. User is redirected to onboarding screen

## Key UX Principles
- No jargon (no “requests lifecycle”, no “inbound caps” yet)
- Emphasize control and reversibility
- No obligation to configure everything now

## Edge Cases
- Email already exists → login flow
- Magic link expired → resend option

## Acceptance Criteria
- User can create an account in < 60 seconds
- User lands inside Knokio with a usable default door
- User understands that Knokio replaces public contact details
