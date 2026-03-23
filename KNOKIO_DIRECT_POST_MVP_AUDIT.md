# Knokio Direct Post-MVP Audit

Date: 2026-03-23

## Current assessment

Knokio Direct is now in a reviewer-ready **8+/10 MVP** state for the core demo and proof-of-value loop:

- landing/demo flow is clear and Direct-first
- signup shows useful presets and a launch path
- public door, inbox, and settings are visually/systemically coherent
- deterministic demo fixtures exist for inbox, request detail, signup launch, and public door
- canonical screenshots and a regression checklist exist
- `npm run test:all` is currently green

## Why the work is not truly “finished” yet

The remaining gaps are less about core product clarity and more about **release hardening / regression confidence**:

1. **Route-level billing/settings coverage is still thin**
   - billing status / checkout / portal routes exist
   - settings plan route exists
   - current protection is stronger in server tests than in route tests

2. **Request-detail regression coverage is weaker than inbox-level coverage**
   - inbox proof-of-value is covered well
   - request-detail proof-of-value still deserves its own stable regression pass

3. **Canonical screenshot capture still assumes a running app**
   - the capture flow is deterministic
   - but it is not fully self-contained yet (start/reset/capture/stop in one command)

4. **Auth route regression coverage is incomplete for MVP signoff depth**
   - signup/provider routes are covered
   - login/logout/session/email verification/password reset still need direct route-level regression protection

## Follow-up recommendation

Treat the current Direct build as **reviewable and demoable now**, but continue with one more hardening chunk focused on:

- route-level auth/billing/settings regression coverage
- request-detail regression coverage
- self-contained evidence capture

These follow-ups are now tracked back in `KNOKIO_DIRECT_MVP_TODO_8_PLUS.md` as the next unchecked tasks.
