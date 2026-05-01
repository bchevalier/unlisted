# Knokio Direct MVP Regression Checklist

Purpose: final review/signoff checklist for the current Direct MVP 8+/10 pass.

Billing source of truth:
- `BILLING.md`

## 1) Refresh the deterministic demo state

Run these before review so every surface starts from the same known state:

```bash
npm run demo:reset
npm run screenshots:direct
npm run test:all
```

## 2) Canonical screenshot set

Canonical capture output lives under:

- `artifacts/canonical/direct/manifest.json`
- `artifacts/canonical/direct/direct-landing.png`
- `artifacts/canonical/direct/direct-signup-launch.png`
- `artifacts/canonical/direct/direct-public-door.png`
- `artifacts/canonical/direct/direct-settings.png`
- `artifacts/canonical/direct/direct-inbox-proof-of-value.png`

Use the manifest as the source of truth for the exact captured URLs.

## 3) Surface-by-surface review gates

### Direct landing
- [ ] Hero makes the Direct promise clear in one glance.
- [ ] Demo/config-first system walkthrough appears before lower-priority explainer content.
- [ ] Reviewer walkthrough banner clearly connects signup → public door → inbox → settings.
- [ ] Demo links point to deterministic fixture-backed surfaces.

### Signup launch state
- [ ] Signup explains privacy + structured inbound clearly.
- [ ] Preset launch preview feels useful before deep customization.
- [ ] Launch-state fixture shows created door, categories, first-run checklist, and next actions.

### Public door
- [ ] Door copy reinforces private-inbox protection.
- [ ] Request intake is structured before inbox delivery.
- [ ] Demo public door is fixture-backed and stable for review.

### Inbox proof of value
- [ ] Inbox visibly shows accepted, auto-replied, awaiting-completion, and paid-intent-filtered requests.
- [ ] Outcome summary explains what Direct filtered or routed for the keeper.
- [ ] Reviewer walkthrough banner is visible here too.

### Settings
- [ ] Settings explains how Direct protects the inbox.
- [ ] Billing / pricing copy matches `BILLING.md`.
- [ ] Billing card and usage surfaces make the handled-inbound model clear.
- [ ] Pay-to-contact configuration shows both gross requester price and expected keeper net.

## 4) Trust / abuse / plan checks

- [ ] Free signup/provider flows cannot self-provision Paid.
- [ ] Free → Paid switching remains blocked unless billing entitlement is active.
- [ ] Disposable email signups remain blocked.
- [ ] Direct remains solo-only and single-door in the current MVP contract.
- [ ] Paid is framed as control/capacity/high-intent filtering, not a vanity paywall.

## 5) Automated gates

These must pass before signoff:

- [ ] `npm run test:all`
- [ ] `npm run screenshots:direct`

## 6) Signoff summary

- [ ] Direct landing is reviewer-ready.
- [ ] Signup launch path is reviewer-ready.
- [ ] Public door is reviewer-ready.
- [ ] Inbox proof-of-value is reviewer-ready.
- [ ] Settings / billing / guardrails are reviewer-ready.
- [ ] Canonical screenshots are current.
- [ ] MVP can be presented as an 8+/10 Direct-first review build.
