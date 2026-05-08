# MVP 8+ Sprint Schedule — 2026-03-22

Start time: 16:50 Pacific/Auckland
End time: 17:50 Pacific/Auckland
Cadence: 12 slots × 5 minutes
Reporting: progress update in chat after each slot

## Chunk 1 — Direct demo/config page
### Slot 1 — 16:50–16:55
- Implement base Direct demo/config page structure
- Add system sections: door setup, categories, rules, requester view, keeper view

### Slot 2 — 16:55–17:00
- Consolidate copy and ICP relevance
- Make Free vs Paid distinctions clearer inside the page

### Slot 3 — 17:00–17:05
- Consolidate visuals, sanity-check layout, lint/screenshot if feasible

## Chunk 2 — Paid entitlement enforcement
### Slot 4 — 17:05–17:10
- Remove public PAID selection paths
- Block direct FREE → PAID self-switch where billing entitlement is absent

### Slot 5 — 17:10–17:15
- Consolidate server-side entitlement logic
- Audit route/UI loopholes

### Slot 6 — 17:15–17:20
- Consolidate with tests/lint and verify paid-only behavior remains gated

## Chunk 3 — Free-tier abuse hardening
### Slot 7 — 17:20–17:25
- Implement strongest missing free-tier safeguards first (signup domain restrictions, explicit constraints where feasible)

### Slot 8 — 17:25–17:30
- Consolidate guardrail logic and align with plan matrix / abuse doc

### Slot 9 — 17:30–17:35
- Consolidate with tests/lint and capture remaining gaps

## Chunk 4 — ICP landing / Direct messaging polish
### Slot 10 — 17:35–17:40
- Update landing + Direct messaging for creators / influencers / advisors / public-facing professionals

### Slot 11 — 17:40–17:45
- Consolidate examples and remove vague language

### Slot 12 — 17:45–17:50
- Final consolidation, consistency pass, lint, screenshots, and summary of remaining follow-ups
