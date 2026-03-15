# EVALUATION.md — Knokio Success Measurement

## Purpose

This framework defines how we evaluate Knokio across:
1. **Current-state shipping quality** (what can/can’t ship now)
2. **Product outcomes** (Direct + Reach impact over time)

We measure success against the two pillar goals:
1. **Attention protection** (Direct)
2. **Reach compression** (Reach)

And the unifying mission:
- **intentional coordination at scale with human uniqueness preserved.**

---

## Decision objective (for implementation)

### Optimize for

**Maximize long-term reputation by never violating trust constraints.**

Practical interpretation:
- Trust is immediate and product-level (privacy, safety, predictability, control).
- Reputation is cumulative and market-level (what users/partners say about Knokio over time).
- Reputation can only be earned sustainably if trust is never traded away.

---

## Hard constraints (non-negotiable, pass/fail)

If any hard constraint fails, the change is **not shippable** until fixed.

1. **Direct/Reach isolation is preserved**
   - Reach changes must not degrade Direct clarity, privacy, or trust posture.
2. **Privacy-first defaults remain intact**
   - No public discovery; no accidental contact-data exposure.
3. **Security invariants hold**
   - No secret leakage, auth checks intact, rate limits and webhook verification preserved.
4. **Operational safety holds**
   - Env guardrails enforced, migrations safe, feature flags behave predictably.
5. **Evidence-based quality gates pass**
   - Lint/type/tests pass for impacted scope; build status is known and accurately reported.
6. **Truthfulness in status reporting**
   - Never claim checks passed unless they were actually executed.

---

## Soft constraints (optimize with trade-offs)

These guide prioritization after hard constraints are satisfied:

1. Delivery speed and iteration tightness
2. Code simplicity/maintainability
3. Test depth beyond baseline coverage
4. Performance and reliability margin
5. Cost efficiency (infra + provider/API spend)
6. Documentation clarity and operational readiness

---

## Release scoring (execution scorecard)

After hard constraints pass, score the change from 0–100:

- **User value impact** (0–30)
- **Trust/privacy impact** (0–25)
- **Correctness confidence** (0–20)
- **Maintainability** (0–15)
- **Speed/cost efficiency** (0–10)

Decision thresholds:
- **Ship:** all hard constraints pass + score ≥ 75
- **Ship behind flag:** all hard pass + score 60–74 + explicit follow-up tasks
- **Do not ship:** any hard fail or score < 60

---

## KPI stack

## 1) North-star metrics

### NSM-Direct: Attention ROI Index
Measures how much useful outcome users get per unit of attention spent.

Example operational proxy:
- `Attention ROI = Accepted high-intent requests / Time spent triaging inbound`

Target direction: **up and to the right**.

### NSM-Reach: Path Compression Index
Measures how many hops/time are required to reach the right human/agent.

Example operational proxy:
- `Path Compression = Baseline median hops ÷ Knokio median hops`
- `Time-to-right-counterparty (TTRC)` as secondary metric

Target direction: fewer hops, lower TTRC.

---

## 2) Pillar metrics

### Direct (noise reduction)
- Inbound signal-to-noise ratio
- % inbound filtered before human review
- Median triage time per request
- Accept / decline / silent-close distribution
- Contact-detail exposure rate
- User-reported overwhelm score (survey)

### Reach (global coordination)
- Median path length to qualified counterparty
- Time-to-first-qualified-response
- Match/route success rate
- % one-hop successful coordination events
- Cross-border coordination success rate

### AI↔human uniqueness loop
- # tasks requested by agents requiring human uniqueness
- Completion rate of uniqueness tasks
- Median time to completion
- Cost per completed uniqueness task
- Repeat-request rate from agent operators

---

## 3) GTM metrics by strategy lane

### Lane A (AI agents)
- Activated agent accounts
- API/integration activation rate
- Agent-originated request volume
- Paid conversion from agent operators

### Lane B (influencers/creators)
- Doors created from creator campaigns
- % creators adding door in bio
- inbound reduction testimonial rate
- referral rate to peer creators

### Lane C (safety orgs)
- org pilot count
- moderation workload reduction
- harmful inbound interception rate
- renewal/expansion rate

### Lane D (expat channels)
- community activation count
- cross-border request success
- local ambassador/referral growth

### Lane E (viral spin-offs)
- weekly active users per spin-off
- profile completion uplift
- conversion from spin-off to core Knokio usage

---

## 4) Funnel metrics (common)

- Visit → door creation conversion
- Door creation → first request received
- First request → first decision (accept/decline)
- First decision → repeat usage (D7/D30)
- Free → paid conversion
- Retention by cohort and segment

---

## 5) Trust, safety, and quality metrics

- Abuse/spam incidence per 1,000 requests
- False positive filtering rate
- False negative harmful-content rate
- Policy violation rate
- Median support resolution time
- Net trust score (survey)

---

## 6) Experimentation framework

Every major test must define:
- hypothesis
- metric(s) impacted
- minimum detectable effect
- success threshold
- decision date (ship/iterate/kill)

Default experiment horizon: 2–4 weeks.

---

## 7) Operating cadence

- **Weekly:** growth + activation + trust dashboard review
- **Biweekly:** lane-level strategy review and resource rebalance
- **Monthly:** KPI deep dive + messaging and product adjustments
- **Quarterly:** reset targets and retire low-leverage initiatives

---

## 8) Scorecard format (RAG)

Each key metric gets Red/Amber/Green status:
- **Green:** on or above target
- **Amber:** within 10–15% of target
- **Red:** below threshold or negative trend for 2+ periods

Any metric that stays red for 2 cycles triggers an action plan.

---

## 9) Success definition (strategic)

Knokio is succeeding when all are true:
1. Users report materially lower noise and higher attention ROI.
2. The effective coordination distance between parties is collapsing.
3. AI systems reliably hire and coordinate with humans for unique-value tasks.
4. Growth scales without sacrificing consent, trust, or safety.

---

## 10) Per-PR evaluation template (copy/paste)

Use this for every non-trivial PR before merge.

```md
### PR Evaluation — <title>

- PR/Branch: <link or name>
- Scope: Direct | Reach | Shared Infra
- Risk level: Low | Medium | High
- Date:
- Evaluator:

#### A) Hard constraints (must all pass)

- [ ] Direct/Reach isolation preserved
- [ ] Privacy-first defaults preserved
- [ ] Security invariants preserved (auth/rate limits/webhooks/secrets)
- [ ] Operational safety preserved (env guards/migrations/feature flags)
- [ ] Evidence-based quality gates passed for impacted scope
- [ ] Status reporting is truthful and evidence-backed

If any unchecked item remains, decision = **DO NOT SHIP**.

#### B) Quality evidence

- Lint: PASS | FAIL | N/A
- Typecheck: PASS | FAIL | N/A
- Unit/integration tests: PASS | FAIL | N/A
- Build: PASS | FAIL | N/A
- E2E (Playwright headless):
  - Chromium: PASS | FAIL | N/A
  - Firefox (after Chromium passes): PASS | FAIL | N/A
- Screenshots/evidence captured if needed: YES | NO | N/A

Evidence links:
- <logs/screenshots/CI links>

#### C) Soft scoring (0–100)

- User value impact (0–30):
- Trust/privacy impact (0–25):
- Correctness confidence (0–20):
- Maintainability (0–15):
- Speed/cost efficiency (0–10):

Total score:

#### D) Decision

- [ ] SHIP (hard pass + score >= 75)
- [ ] SHIP BEHIND FLAG (hard pass + score 60–74 + follow-ups)
- [ ] DO NOT SHIP (any hard fail or score < 60)

#### E) Follow-ups (required for flagged ship)

1. <task> — owner: <name> — due: <date>
2. <task> — owner: <name> — due: <date>

#### F) Notes

- Tradeoffs accepted:
- Explicitly deferred risks:
- Rollback plan:
```
