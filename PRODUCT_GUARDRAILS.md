# PRODUCT_GUARDRAILS.md — Direct/Reach Separation

## Purpose

Ensure Knokio Reach can evolve without degrading Knokio Direct’s product clarity, privacy, or trust profile.

---

## Non-negotiable rule

**Knokio Direct is a protected core.**
Reach is additive, optional, and must never weaken Direct’s core promise.

---

## 1) Product clarity guardrails

### Entry by intent
Use explicit intent-based entry points from the root portal (`knokio.io`):
- “I want to protect my inbound” → Direct client journey
- “I want to find/reach the right human or agent” → Reach client journey

### UI separation
- Keep Direct and Reach navigation clearly labeled.
- Avoid mixing Reach controls into Direct setup screens.
- Direct onboarding must complete with no Reach dependencies.

### Messaging separation
- Direct message: noise reduction + privacy + control.
- Reach message: one-hop coordination + policy-bound routing.

---

## 2) Trust & security guardrails

- Privacy defaults are inherited from Direct and cannot be relaxed by Reach.
- No public profile browsing/searchability by default.
- Private contact info is never exposed without explicit workflow consent.
- Reach experiments must pass abuse/rate-limit checks before rollout.
- All cross-party interactions are auditable.

---

## 3) Technical guardrails

- Bounded contexts in code: `features/direct/*` and `features/reach/*`.
- Separate API surfaces for Direct vs Reach.
- Feature flags around all Reach-facing features.
- No hard runtime dependency from Direct paths to Reach services.
- Separate telemetry dimensions to isolate impact.

---

## 4) Release guardrails

A Reach release is blocked if any Direct KPI regresses beyond threshold:

- signal-to-noise ratio
- median triage time
- contact exposure rate
- trust/safety incident rate
- user-reported clarity score

---

## 5) Operating model

- Keep Direct roadmap ownership explicit and protected.
- Run Reach as staged experiments (alpha → limited beta → broad release).
- Review Direct KPI deltas weekly when Reach experiments are active.

---

## Decision principle

If a Reach initiative increases complexity in Direct without improving Direct outcomes, do not ship it.
