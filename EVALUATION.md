# EVALUATION.md — Knokio Success Measurement

## Purpose

This framework defines how we evaluate Knokio across product, go-to-market, and mission outcomes.

We measure success against the two pillar goals:
1. **Attention protection** (Direct)
2. **Reach compression** (Reach)

And the unifying mission:
- **intentional coordination at scale with human uniqueness preserved.**

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
