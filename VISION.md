# VISION.md — Knokio

## One-line vision

**Knokio is the private reachability layer for the AI era:** a system where **anyone can reach anyone** (human or agent) through structured, consent-based doors.

---

## Why now

The old contact model (email, DMs, forms) was built for human-to-human communication at human speed.

That model breaks when:
- inbound volume explodes,
- AI agents generate outreach at machine speed,
- humans become harder to reach without being overwhelmed,
- and high-value work depends on uniquely human capabilities.

As automation grows, many tasks will be handled by AI systems. But AI still needs humans for things machines cannot independently provide or verify.

---

## Core thesis

In an AI-native economy, human value is often tied to **uniqueness**, including:
- **Location** (being somewhere specific)
- **Ownership / access** (assets, systems, devices, property)
- **Credentials / permissions** (licenses, authority, compliance)
- **Connections / trust graph** (who knows whom)
- **Contextual judgment** (taste, nuance, social and legal accountability)

Knokio should make this uniqueness **reachable on the human’s terms**.

---

## Interaction model (universal reach)

Knokio supports four first-class flows:

1. **Human → Human**
   - modern replacement for public emails/DMs
   - structured requests, explicit consent, no inbox chaos

2. **Human → AI Agent**
   - humans can request actions/services from agents
   - capability-aware intake, policy-bound execution

3. **AI Agent → Human**
   - agents can request human tasks requiring uniqueness
   - verifiable intent, scoped access, clear compensation/terms

4. **AI Agent → AI Agent**
   - machine-to-machine coordination through policy doors
   - authenticated calls, typed contracts, auditable outcomes

**Principle:** Reachability is universal, access is never default.

---

## Product principles

- **Privacy-first by default** — no public inboxes, no open contact graph
- **Consent over access** — every route is policy-gated
- **Structured intent over chat noise** — requests, not threads
- **Programmable trust** — verifiable identity, claims, and permissions
- **Silence is valid** — no social pressure to reply
- **No discovery by default** — explicit links, explicit intent

---

## What Knokio becomes

Knokio evolves from a “door” into a **consent and routing protocol** for people and agents.

### Core building blocks

- **Doors**: public entry points with private policy
- **Request contracts**: typed payloads and required fields
- **Policy engine**: who can knock, with what evidence, at what rate
- **Identity layer**: human and agent identity + provenance
- **Attestations**: credentials, ownership proofs, role proofs
- **Execution hooks**: webhook/API handoffs for agents and tools
- **Audit trail**: immutable event history for accountability

---

## AI-agent-native requirements

To fully support agent workflows, Knokio should add:

- machine-readable door schemas (agent-discoverable via explicit links)
- agent auth (keys/tokens/signatures) with operator attribution
- capability declarations (what an agent can do / request)
- negotiation metadata (budget, SLA, urgency, confidence)
- verifiable task completion receipts
- safe escalation from agent → human when policy requires

---

## Scope strategy

### Phase 1 (current): Knokio Direct
- human-facing door
- structured inbound requests
- filtering, limits, forward/decline/auto-reply

### Phase 2: Agent Reach
- agent identities and auth
- AI↔human and AI↔AI request contracts
- policy + attestations + auditable handoffs

### Phase 3: Networked Knokio
- interoperable routing between doors
- richer trust primitives and reputation signals (privacy-preserving)
- marketplace-like utility **without** becoming a social feed or public directory

---

## Success signals

- higher signal-to-noise on inbound
- faster decision latency (accept/decline)
- lower contact-detail exposure rate
- successful completion rate for human-unique tasks requested by agents
- trust and safety incidents kept low as machine traffic scales

---

## Guardrails (non-negotiable)

- no surveillance-style identity graph
- no public scraping/discovery of people
- no dark patterns to force response
- no uncontrolled agent spam
- no hidden delegation without attribution

---

## Living document

This file is the product north star.

We should update it whenever:
- scope expands,
- core assumptions change,
- or new AI-agent interaction patterns emerge.
