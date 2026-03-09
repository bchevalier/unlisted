# Pilot Invite Workflow

This document defines how to invite, onboard, and manage the first batch of pilot users for Knokio Direct.

---

## 1. Goals

- Onboard 10–20 pilot users (design partners)
- Validate core Direct flows in production (signup → door → knock → triage → reveal)
- Collect structured feedback on UX clarity, trust, and usefulness
- Identify bugs and edge cases before broader launch
- Build first case studies and testimonials

---

## 2. Pilot user criteria

Target users who:
- Receive meaningful unsolicited inbound (DMs, emails, contact forms)
- Care about their time and attention
- Are willing to provide candid feedback
- Represent at least 2 of the core ICPs:
  - Creators / influencers
  - Consultants / advisors
  - Founders / executives
  - Public figures / academics
  - Safety-sensitive orgs

### Disqualified
- Users who won't generate inbound traffic (can't validate the product)
- Users unwilling to share feedback

---

## 3. Invite flow

### 3.1 Pre-invite outreach

Send a personal message (email, DM, or direct conversation) with:

**Subject:** Would you try Knokio? (private pilot)

**Body:**
> Hi {{name}},
>
> I'm building Knokio — a privacy-first way to be reachable without inbox chaos. Instead of sharing your email publicly, you share a Knokio door that filters and structures inbound for you.
>
> I'd love to have you as one of our first pilot users. It takes about 2 minutes to set up:
>
> 1. Create your door at knokio.io/direct/signup
> 2. Share your door link (knokio.io/u/you) instead of your email
> 3. Review requests in your inbox — accept, decline, or let them expire
>
> You'd be helping us validate the product before public launch. I'll personally support you through setup and want your honest feedback.
>
> Interested?

### 3.2 Signup methods

Pilot users can sign up through any supported method:

**Option A: Self-signup**
- User visits `knokio.io/direct/signup`
- Creates account with email/password or social auth
- No invite code required (production is open but unpublicised)

**Option B: Agent-provisioned account**
- For users who prefer a pre-configured experience
- Use the agent signup API:
  ```bash
  curl -X POST https://knokio.io/api/direct/auth/agent/signup \
    -H "Content-Type: application/json" \
    -H "x-agent-signup-secret: $AGENT_SIGNUP_SECRET" \
    -d '{
      "email": "pilot@example.com",
      "name": "Pilot User",
      "password": "<generated>",
      "doorSlug": "pilot",
      "doorPlan": "FREE"
    }'
  ```
- Send the user their credentials and door link

### 3.3 Post-signup welcome

Send within 24 hours of account creation:

**Subject:** Your Knokio door is ready 🚪

**Body:**
> Hi {{name}},
>
> Your Knokio door is live:
>
> 🔗 **Door link:** knokio.io/u/{{slug}}
> 📧 **Email door:** {{slug}}@knokio.io
>
> **Quick setup tips:**
> - Put your door link in your bio, website, or email signature
> - Replace "DM me" or "email me" with your Knokio link
> - Check your inbox at knokio.io/direct/inbox to review requests
>
> **Your plan:** {{plan}} ({{planDescription}})
>
> **Need help?** Reply to this email or message me directly. I'm here to help you get the most out of it.
>
> I'll check in after your first week to hear how it's going.

---

## 4. Pilot support

### 4.1 Dedicated support channel
- Direct communication channel with each pilot user (email, DM, or Slack)
- Response SLA: < 24 hours for bugs, < 48 hours for feedback

### 4.2 Weekly check-in
After the first week, send:

**Subject:** How's your Knokio door going?

**Body:**
> Hi {{name}},
>
> You've been using Knokio for a week — how's it going?
>
> Quick questions (just reply inline):
>
> 1. How many knocks have you received?
> 2. Was the setup clear and easy?
> 3. Did anything confuse you or feel wrong?
> 4. Would you recommend Knokio to someone? Why or why not?
> 5. What's the one thing you'd change?
>
> Your feedback directly shapes the product. Thanks for being an early user.

### 4.3 Issue tracking
- Log all pilot feedback in a dedicated tracking doc or issue tracker
- Tag issues as: `bug`, `ux-confusion`, `feature-request`, `positive-signal`
- Prioritise fixes that block the core flow: signup → door → knock → triage → reveal

---

## 5. Success metrics

Track these during the pilot period (target: 4 weeks):

| Metric | Target | How to measure |
|--------|--------|----------------|
| Signup completion rate | > 90% | Invited vs. created accounts |
| Door activation rate | > 80% | Accounts with ≥ 1 public door link shared |
| Knock received rate | > 50% | Doors with ≥ 1 request received |
| Triage rate | > 60% | Requests accepted or declined (not expired) |
| NPS / satisfaction | > 7/10 | Feedback survey |
| Bugs found (P0/P1) | < 3 | Issue tracker |
| Time to first knock | < 7 days | Request timestamp - signup timestamp |

---

## 6. Feedback collection

### Structured survey (end of pilot)

Send at end of 4-week pilot:

**Subject:** Knokio pilot feedback (5 min survey)

**Questions:**
1. How would you describe Knokio to a friend? (open text)
2. How clear was the difference between your door and your regular inbox? (1–10)
3. Did you feel in control of your inbound? (1–10)
4. Did you trust that your contact details were private? (1–10)
5. What category of requests did you receive most? (select)
6. What was the most useful thing about Knokio? (open text)
7. What was the most frustrating thing? (open text)
8. Would you keep using Knokio after the pilot? (yes/no/maybe)
9. Would you pay for Knokio? If so, how much per month? (open text)
10. Can we use your feedback as a testimonial? (yes/no)

### Unstructured feedback
- Capture any spontaneous feedback from support conversations
- Note specific quotes that capture user sentiment
- Document before/after stories (e.g., "I used to get 50 DMs/day, now I review 5 structured requests")

---

## 7. Graduation criteria

A pilot user graduates to a regular user when:
- [ ] They have used Knokio for ≥ 2 weeks
- [ ] They have received and triaged ≥ 3 requests
- [ ] They have provided feedback (survey or informal)
- [ ] No blocking bugs remain in their flow

The pilot phase ends when:
- [ ] ≥ 10 users have graduated
- [ ] All P0/P1 bugs are resolved
- [ ] NPS is ≥ 7/10
- [ ] Core flow (signup → door → knock → triage → reveal) works reliably

---

## 8. Post-pilot actions

After the pilot concludes:

1. **Fix** all bugs and UX issues surfaced during the pilot
2. **Update** onboarding copy and FAQ based on real confusion points
3. **Write** 2–3 case studies from pilot user stories
4. **Decide** whether to open broader access or run another pilot batch
5. **Update** pricing based on willingness-to-pay data
6. **Thank** pilot users with a personal message and early-user recognition

---

_This workflow feeds into the broader GTM plan in STRATEGY.md. The pilot is Phase 1 (0–30 days) of the launch plan._
