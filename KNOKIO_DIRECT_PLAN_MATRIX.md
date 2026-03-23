# KNOKIO_DIRECT_PLAN_MATRIX.md

## Purpose

Define the Knokio Direct plan structure for MVP and near-term expansion.

This matrix should help answer:
- what a Free user gets
- what a Paid user gets
- what safeguards prevent free-tier abuse
- what should and should not be shown in the Direct landing/demo/config experience

---

## Product framing

Knokio Direct is a **controlled inbound system**.

It is not just:
- a contact form
- a public inbox
- a messaging tool

It gives a user one or more **doors** that turn inbound into structured requests and lets the system:
- categorize
- reroute
- cap
- auto-reply
- auto-ignore
- protect private contact details

---

## MVP design implication

For MVP, a potential Direct user should ideally land on a **demo/configuration-style page** that shows what Direct can do in practice.

The page should make visible:
- what a door looks like
- what a requester sees
- what categories/required fields look like
- what routing/filtering/caps can do
- what Free vs Paid unlocks

This is important because Knokio is stronger as a **system you configure** than as a generic marketing page.

---

## Plan principles

1. **Free must be genuinely useful**
   - enough value to prove the product works
   - enough control to solve a real inbound problem

2. **Free must not be easy to abuse**
   - low-friction spam farms / multi-account gaming / unlimited door creation must be blocked

3. **Paid should feel like expanded control, not artificial pain**
   - more capacity
   - more doors
   - more rerouting flexibility
   - paid-request lane / serious-intent filtering

4. **Direct should stay simple at MVP**
   - avoid overcomplicated pricing logic
   - make differences legible in one glance

---

## Recommended MVP plan tiers

### Tier 1 — Free
Best for:
- individuals testing Direct
- users with modest inbound
- people who want baseline protection and controlled reachability

### Tier 2 — Paid
Best for:
- creators / influencers
- advisors / consultants
- public-facing operators
- users with serious or commercial inbound
- users who need more than one door or more advanced routing

---

## Direct plan matrix

| Capability | Free | Paid |
|---|---:|---:|
| Direct account | 1 | 1 |
| Intended user type | Solo individual | Solo individual or pro user |
| Number of Direct doors | 1 | Multiple |
| Form-type doors | 1 max | Multiple |
| Email-shaped door / Knokio address | 1 | 1+ / expanded support |
| Public door page | Yes | Yes |
| Structured request intake | Yes | Yes |
| Required fields by category | Basic | Advanced / more flexible |
| Request categories | Basic set | Expanded / more configurable |
| Routing rules | Basic | Expanded |
| Auto-reply rules | Basic | Expanded |
| Auto-ignore / discard logic | Basic safeguards only | Configurable |
| Caps on inbound volume | Yes | Removed or much higher |
| Serious-intent paid request lane | No or limited | Yes |
| Receive payment per request | No | Yes |
| Extra rerouting options | No | Yes |
| Team access / shared operators | No | No for MVP / future paid+ |
| Advanced analytics | No | Later / optional |
| API / integrations | No | Later / optional |
| Priority support | No | Optional future |

---

## Recommended MVP interpretation of matrix

### Free should include
- 1 Direct account
- 1 door
- 1 form-type door max
- basic categories
- basic required fields
- basic routing
- basic caps
- silence as an answer
- private contact protection

This makes Free a real product, not a crippled trial.

### Paid should include
- extra doors
- uncapped or materially higher inbound limits
- more rerouting options
- stronger category/field/rule control
- paid request lane
- per-request payment support

This makes Paid feel like:
- more capacity
- more control
- better monetization of attention

---

## Free-tier anti-abuse safeguards

These should be treated as product rules, not optional nice-to-haves.

### Account-level safeguards
- **1 Direct account per free user**
- verified email required
- anti-bot checks on signup
- auth rate limits
- optional identity heuristics / manual review flags for suspicious signups

### Door-level safeguards
- **1 form-type door max for free**
- no unlimited door creation on free
- no team/shared operator access on free
- no paid request lane on free

### Inbound-level safeguards
- capped request volume on free
- per-sender rate limits
- abuse-report flow
- blocklist support
- anti-attachment / anti-threading constraints where applicable
- category-required-field enforcement before delivery

### Platform-level safeguards
- detect multi-account abuse signals
- reserve the right to throttle or suspend suspicious free accounts
- manual review path for obvious spam farming / automation abuse

---

## Strong recommendation on team access

For MVP:
- **No team access on Free**
- **No team access in core Paid MVP either unless truly needed**

Reason:
- team features increase complexity fast
- create account-sharing / abuse edge cases
- distract from the core solo-user inbound control story

Recommendation:
- keep Direct MVP primarily **solo-first**
- revisit team/shared inbox after single-user value is clearly validated

---

## Paid request lane guidance

The paid-request lane should be positioned carefully.

It should feel like:
- a way to filter for seriousness
- a way to protect time
- a commercial or premium access lane
- optional, not mandatory

It should **not** feel like:
- paying to say hello
- a vanity paywall
- a confusing extra step for normal inbound

Good ICPs for this:
- influencers receiving brand/product inquiries
- experts offering paid advisory access
- creators filtering business outreach
- public-facing professionals with high-noise inbound

---

## UX implications for the demo/config page

The demo/config page should visibly show:

1. **Door setup**
   - door name
   - intake type
   - categories
   - required fields

2. **Rule setup**
   - caps
   - rerouting
   - auto-reply
   - ignore / reject paths

3. **Plan boundaries**
   - clearly label what Free includes
   - clearly label what Paid unlocks

4. **Paid request mode**
   - shown as an optional advanced lane
   - explained as intent-filtering, not monetization gimmickry

---

## Suggested MVP copy direction

### Free
"Start with one protected door and basic controls."

### Paid
"Open more doors, remove caps, and route serious requests with more control."

### Paid request lane
"Charge when a request should signal real intent before it gets your time."

---

## Open questions

1. Does Free include 1 email-shaped Knokio address in addition to 1 form-type door, or are these the same underlying door?
2. Should paid request capability be fully Paid-only, or should Free users be able to preview it without enabling it live?
3. Should Paid be one tier at MVP, or two paid tiers later (`Pro`, `Business`)?
4. Are inbound caps hard-stop only, or should they degrade into queueing / auto-reply behavior?

---

## Recommended MVP decision summary

### Free
- 1 Direct account
- 1 door
- 1 form-type door max
- basic controls
- capped inbound
- no team access
- no paid request lane

### Paid
- more doors
- uncapped or much higher inbound
- extra rerouting / automation options
- paid request lane
- receive payment per request
- still solo-first at MVP

This keeps the product:
- simple
- useful
- harder to abuse
- monetizable
- aligned with the strongest Direct use cases
