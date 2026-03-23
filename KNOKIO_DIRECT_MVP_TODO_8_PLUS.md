# KNOKIO_DIRECT_MVP_TODO_8_PLUS.md

Purpose: drive Knokio Direct to a solid 8+/10 MVP with explicit implementation chunks suitable for pomodoro automation.

## Rules for the pomodoro scheduler
- Always pick the next unchecked item.
- Implement the item.
- Add/update tests for the new behavior.
- Run `npm run test:all`.
- Fix failures caused by the new work before marking the item done.
- Avoid tests that require paid external APIs.
- Use local/dummy requests and fixtures where needed.
- If all items are complete:
  1. audit missing tests and add new unchecked test tasks
  2. reassess whether MVP is 8+/10; if not, add new 4h tasks
  3. reassess implementation against constraints/optimization goals; if not good enough, add new 4h tasks
  4. if everything is complete, report completion to John

## Chunk 1 — Direct demo/config proof-of-value
- [x] Replace the current Direct explainer-first page flow with a stronger demo/config-first flow.
- [x] Add a realistic door system mock that shows categories, required fields, routing, caps, auto-reply, and ignore behavior.
- [x] Add tests covering the new Direct demo/config page rendering and core visible states.

## Chunk 2 — Paid entitlement enforcement
- [x] Remove public `PAID` selection from signup flows and provider-auth provisioning.
- [x] Block free→paid plan switching unless billing entitlement is active server-side.
- [x] Add tests proving paid-only behavior cannot be unlocked without valid entitlement.

## Chunk 3 — Free-tier abuse hardening
- [x] Reject disposable/temporary email domains at keeper signup.
- [x] Explicitly enforce Free-plan constraints in code paths (single free door/form surface, no team access assumptions documented in code).
- [x] Add tests for free-tier abuse guardrails and signup rejection behavior.

## Chunk 4 — ICP-focused messaging polish
- [x] Refocus landing + Direct copy toward creators, influencers, advisors, and public-facing professionals while staying open to broader ICPs.
- [x] Make serious-outreach / paid-lane framing feel like a high-intent filter rather than a vanity paywall.
- [x] Add/update tests for the revised copy-driven states where feasible.

## Chunk 5 — Trust, proof, and UX consistency
- [x] Tighten trust/privacy/system language across Direct surfaces.
- [x] Make the door/request/inbox visual system more coherent across demo, public door, and settings.
- [x] Add tests or screenshots/scripts to verify these surfaces remain coherent.

## Chunk 6 — Activation quality
- [x] Improve first-run activation/default presets for top ICPs.
- [x] Make the default Direct setup feel immediately useful before deep customization.
- [x] Add tests for setup defaults/presets if implemented.

## Chunk 7 — First-run proof of value
- [x] Add a post-signup success/launch surface that shows the created door, seeded categories, and immediate next actions (open door, inbox, settings).
- [x] Add an end-to-end/server integration test proving a chosen preset creates the expected first-door headline and categories.
- [x] Add a first-run checklist/banner so a new keeper can immediately verify that Direct is protecting the inbox as intended.

## Chunk 8 — Shared preset system + anti-drift cleanup
- [x] Extract client-facing preset metadata into a single shared source of truth used by signup, provider signup, and demo/config surfaces.
- [x] Reuse the same preset source in Direct demo/config copy so activation defaults and marketing examples cannot drift apart.
- [x] Add tests that UI preset labels/copy stay aligned with server preset configuration.

## Chunk 9 — Demo inbox proof-of-value
- [x] Make the demo inbox visibly show accepted, auto-replied, ignored/capped, and paid-intent-filtered requests.
- [x] Add screenshot/scripted smoke coverage for Direct landing, signup, settings, public door, and inbox coherence.
- [x] Tighten the inbox/request detail language so the filtering/routing value is immediately obvious in demos.

## Chunk 10 — End-to-end proof that Direct works
- [x] Add a scripted end-to-end smoke test that submits a dummy request through the public door and verifies it appears in the keeper inbox with the expected routing state.
- [x] Add a dummy-data fixture path for accepted, auto-replied, awaiting-completion, and paid-intent requests so demos do not depend on ad hoc data.
- [x] Add a deterministic demo reset script so local demos always start from a known good state.

## Chunk 11 — Paid upgrade UX + trust clarity
- [x] Make the upgrade path visibly billing-authoritative in the UI (no ambiguity about how Paid unlocks).
- [x] Add clear guardrail copy in settings for what Free protects and what Paid unlocks.
- [x] Add tests proving paid-only controls are either disabled or clearly gated in the UI when entitlement is absent.

## Chunk 12 — Final 8+/10 polish + regression confidence
- [x] Add a concise walkthrough/demo banner connecting signup → public door → inbox → settings so first-time reviewers understand the whole loop.
- [x] Capture/update canonical screenshots for Direct landing, signup launch state, public door, settings, and inbox proof-of-value.
- [x] Add one final top-level regression checklist doc for MVP review/signoff.

## Chunk 13 — Post-MVP hardening audit follow-ups
- [x] Add route tests for billing status / checkout / portal and settings plan endpoints so billing-authoritative behavior is protected at the HTTP layer.
- [x] Add stable request-detail regression coverage for demo-fixture and live-request states so inbox → detail proof-of-value cannot drift.
- [ ] Make canonical screenshot capture self-contained (start/reset/capture/stop) so review evidence does not depend on a manually running dev server.
- [ ] Add route tests for Direct login / logout / session / email verification / password reset paths to close the remaining auth regression gap.
