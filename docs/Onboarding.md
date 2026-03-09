# Onboarding Copy — Knokio Direct

This document contains the production onboarding copy for Keeper signup, first-door setup, and first-knock guidance. Use it as source-of-truth for UI text.

---

## 1. Signup page

### Headline
**Create your Knokio door**

### Sub-headline
Stay reachable without the inbox chaos. Set up your door in under two minutes.

### Form labels
- **Name** — How you want to appear to people who knock
- **Email** — Used for login and notifications (never shown publicly)
- **Password** — At least 12 characters

### CTA button
**Create my door →**

### Social auth prompt
Or sign up with Google / Apple / LinkedIn

### Footer
Already have an account? [Sign in](/direct/login)

---

## 2. Post-signup — Email verification

### Subject line
Verify your Knokio email

### Body
Hi {{name}},

Thanks for creating your Knokio door. Please verify your email to activate your account:

[Verify my email →]

This link expires in 24 hours. If you didn't sign up for Knokio, you can ignore this email.

---

## 3. First-door setup wizard (post-verification)

### Step 1 — Choose your door slug

**Pick your Knokio address**

Your public door link: `knokio.io/u/{{slug}}`
Your email door: `{{slug}}@knokio.io`

People use this to reach you instead of your personal email. Choose something recognisable.

_Field: slug (auto-suggested from name)_

### Step 2 — Choose your plan

**Free door**
- Up to 10 pending requests per week
- Basic categories (General, Collaboration, Media)
- Perfect for personal use

**Paid door** — $XX/month
- Unlimited inbound capacity
- Paid reach categories (product placements, advisory access)
- Priority notifications
- Best for creators, consultants, and public figures

_CTA: Start with Free / Upgrade to Paid_

### Step 3 — Set your categories

**What kind of requests do you want to receive?**

Toggle the categories you'd like enabled. You can customise required fields and caps later in Settings.

- ☑ General inquiry
- ☐ Collaboration
- ☐ Media / press
- ☐ Hiring / recruiting
- ☐ Product placement _(Paid plan)_
- ☐ Advisory / consulting _(Paid plan)_

### Step 4 — Where should accepted requests go?

**Your reveal method**

When you accept a request, the knocker sees your contact info. Choose what to reveal:

- **Email** — share your email address (can be different from login)
- **Redirect URL** — send them to a booking page, calendar link, or any URL

_CTA: Save & open my door →_

### Completion screen

**Your door is live 🚪**

Share your Knokio address anywhere you'd put a public email:

```
knokio.io/u/{{slug}}
{{slug}}@knokio.io
```

- Put it in your bio
- Add it to your website
- Use it on business cards
- Replace "DM me" with "Knock on Knokio"

[Go to your inbox →](/direct/inbox?slug={{slug}})

---

## 4. First knock received — Keeper notification

### Subject line
New knock on your Knokio door

### Body
Hi {{name}},

Someone just knocked on your door ({{slug}}):

**Category:** {{category}}
**Subject:** {{subject}}

[View request →]({{inboxUrl}})

You can accept, decline, or let it expire. No pressure to respond — silence is a valid answer on Knokio.

---

## 5. Knocker-side copy

### Door page header
**Knock on {{keeperName}}'s door**

This is a private request — not a public message. {{keeperName}} will review your request and decide whether to respond.

### After submission
**Your knock was received ✓**

{{keeperName}} will review your request. You can check its status anytime:

[Check status →](/r/{{token}})

There's no guarantee of a response — that's by design. Knokio protects people's attention.

### Status page states

- **Pending** — Your request is in the queue. The door owner will review it when they're ready.
- **Accepted** — Great news! Your request was accepted. Contact details are below.
- **Declined** — This request was declined. No further details are provided.
- **Expired** — This request expired without a response. You may try again later.

---

## 6. Empty state copy

### Empty inbox
**No knocks yet**

Share your door link to start receiving requests:
`knokio.io/u/{{slug}}`

### No categories enabled
**Enable at least one category**

People can't knock if there's nothing to knock about. Head to Settings to enable request categories.

---

## 7. Key messaging principles

1. **Door, not inbox.** Always frame Knokio as a door — not another inbox or messaging app.
2. **Silence is OK.** Reinforce that not responding is acceptable and expected.
3. **Privacy first.** Never suggest that a Keeper's real contact info is visible by default.
4. **Structured, not conversational.** Requests are one-shot submissions, not threads.
5. **Control language.** Use "accept/decline" not "reply/ignore". Use "knock" not "message".
