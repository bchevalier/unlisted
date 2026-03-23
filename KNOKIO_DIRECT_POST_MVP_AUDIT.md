# Knokio Direct Post-MVP Audit

Date: 2026-03-24

## Current assessment

Knokio Direct is in a reviewer-ready **8+/10 MVP** state for the core Direct loop:

- landing/demo flow is clear and Direct-first
- signup shows useful presets and a launch path
- public door, inbox, request detail, and settings are visually/systemically coherent
- deterministic demo fixtures exist for signup launch, public door, inbox, and request detail
- canonical screenshots and a regression checklist exist
- screenshot capture is self-contained (`start/reset/capture/stop`)
- Direct route-level auth, billing, request lifecycle, keeper-control, and operational webhook coverage now exists
- auth/recovery pages, auth/control widgets, reusable Direct UI helpers, and most server helpers now have direct tests
- `npm run test:all` is currently green

## What was closed since the previous audit

The previous UI/helper coverage gaps are now covered:

- `/direct/login`, `/direct/verify-email`, and `/direct/reset-password` page tests were added
- isolated tests were added for login/password-recovery/reset-password/verify-email forms and the two-factor panel
- isolated tests were added for `request-actions`, `direct-walkthrough-banner`, and `logout-button`
- dedicated unit tests were added for `auth-security`, `digest`, `abuse-reports`, `session`, `security`, and `door`

## Remaining hardening gaps

The current gaps are now very narrow and concentrated in the last untested Direct backend modules:

1. **Core auth orchestration still lacks dedicated unit coverage**
   - `features/direct/server/auth.ts`
   - this remains one of the most important internal modules because signup/login/verification/2FA flows all converge here

2. **Core request orchestration still lacks dedicated unit coverage**
   - `features/direct/server/requests.ts`
   - route coverage is now broad, but the shared request engine is still large and behavior-dense enough to justify direct helper coverage

3. **Admin/authz helper modules still lack dedicated coverage**
   - `features/direct/server/admin.ts`
   - `features/direct/server/admin-session.ts`
   - these are smaller than `auth.ts` / `requests.ts`, but they are still uncovered backend surfaces

## Follow-up recommendation

Treat the current build as **reviewable and demoable now**. The next chunk should focus on the final uncovered backend modules:

- direct unit coverage for `auth.ts`
- direct unit coverage for `requests.ts`
- direct unit coverage for `admin.ts` and `admin-session.ts`

These follow-ups are now tracked back in `KNOKIO_DIRECT_MVP_TODO_8_PLUS.md` as the next unchecked tasks.
