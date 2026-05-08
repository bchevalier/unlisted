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
- billing source of truth now lives in `BILLING.md` for future pricing/model alignment work

## What was closed since the previous audit

The previous UI/helper coverage gaps are now covered:

- `/direct/login`, `/direct/verify-email`, and `/direct/reset-password` page tests were added
- isolated tests were added for login/password-recovery/reset-password/verify-email forms and the two-factor panel
- isolated tests were added for `request-actions`, `direct-walkthrough-banner`, and `logout-button`
- dedicated unit tests were added for `auth-security`, `digest`, `abuse-reports`, `session`, `security`, and `door`

## Remaining hardening gaps

No remaining tracked Direct hardening gaps were found in this audit pass.

Confirmed in this pass:

- `features/direct/server/auth.ts`, `requests.ts`, `admin.ts`, and `admin-session.ts` now have dedicated unit coverage
- `app/api/direct/**/route.ts` has matching route-level regression coverage
- Direct page-level gaps are closed, including the request-detail surface covered by `app/direct/inbox/request-detail.test.ts`
- `npm run test:all` remains green after the final backend coverage additions

## Follow-up recommendation

Treat the current build as **reviewable, demoable, and fully tracked against the current Direct MVP hardening backlog**.

If new work is added, it should come from new product scope or newly discovered regressions rather than the previous coverage backlog.
