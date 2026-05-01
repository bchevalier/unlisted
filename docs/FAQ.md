# Knokio — Public FAQ

Frequently asked questions about Knokio and how it works.

---

## General

### What is Knokio?
Knokio is a privacy-first way to be reachable without being exposed. Instead of sharing your email or DMs publicly, you share a Knokio door — a single, controlled entry point that lets people reach you only on your terms.

### Is Knokio a messaging app?
No. Knokio is not a messenger, not a social network, and not an inbox. It's a filtering layer between you and the outside world. People submit structured requests through your door. You decide what happens next.

### Who is Knokio for?
Anyone who receives unsolicited inbound and wants to stay reachable without the noise. Typical users include creators, consultants, investors, executives, academics, public figures, and anyone tired of noisy inboxes.

### Is Knokio free?
Knokio Direct is not positioned as a “free tool.” It is a premium inbound control product with a low-friction way to start. In the current offer, you can start with a 1 month free trial and no credit card, then upgrade as your inbound volume or category needs grow.

---

## For door owners (Keepers)

### What is a "door"?
A door is your public Knokio entry point. You get a shareable link (e.g., `knokio.io/u/you`) and an optional email handle (`you@knokio.io`). People use these to reach you instead of your personal contact details.

### What happens when someone knocks?
Their message becomes a structured request — not a conversation. You receive a notification, review the request in your inbox, and choose to accept, decline, or let it expire silently.

### Do I have to respond to every knock?
No. Silence is a valid outcome on Knokio. There's no read receipt, no social pressure, and no obligation to reply. You're in control.

### What does "accept" do?
When you accept a request, the knocker sees the contact information you've configured — either an email address or a redirect URL (like a booking page). Your private details are never exposed automatically.

### Can I block someone?
Yes. You can add senders to your door's blocklist. Blocked senders cannot submit new requests, and they won't know they've been blocked.

### Can I limit how many requests I receive?
Yes. You can set weekly caps per category and globally. Once the cap is reached, new requests are held until the next period.

### What categories of requests are available?
Default categories include General Inquiry, Collaboration, Media/Press, and Hiring. Commercial categories like Product Placement and Advisory/Consulting can also be enabled, including optional pay-to-contact pricing when appropriate. You can enable or disable any category in Settings.

### Is my email address visible to knockers?
Only if you choose to reveal it. When you accept a request, the knocker sees whatever contact method you've configured. Your login email is never exposed.

---

## For people reaching out (Knockers)

### How do I contact someone on Knokio?
Visit their door link (e.g., `knokio.io/u/someone`) and fill out the request form, or email their Knokio address (e.g., `someone@knokio.io`). Your message becomes a structured request.

### What happens after I submit a request?
You receive a link to check the status of your request. The door owner will review it and can accept, decline, or let it expire. There's no guarantee of a response.

### Can I send follow-up messages?
No. Knokio requests are one-shot submissions, not conversations. If you need to send a new request, you can submit another one (subject to rate limits).

### Why was my request declined?
Door owners can decline requests without providing a reason. This is by design — Knokio protects people's attention and does not require explanations.

### What does "expired" mean?
If the door owner doesn't act on your request within the configured timeframe, it expires automatically. You may submit a new request if you'd like.

### Can I send attachments?
No. Requests submitted via email with attachments are automatically rejected. Keep your request concise and text-based.

---

## Privacy & security

### Does Knokio sell my data?
No. Knokio does not sell, share, or monetise user data. See our [Privacy Policy](/privacy) for full details.

### Is Knokio searchable or browsable?
No. There is no people directory, no profile search, and no discovery feature. Access to a door requires the exact link or email address. Knokio is designed so you can be reachable without being searchable.

### How does Knokio protect my privacy?
- Your personal contact details are never publicly visible
- Door owners control exactly what is revealed and when
- There are no public profiles to browse or scrape
- Request data is structured and access-controlled
- All sessions are encrypted and cookie-secured

### Can someone find my Knokio door without the link?
No. Doors are not indexed or discoverable. Someone needs your exact door URL or email alias to reach you.

### What data does Knokio collect?
Knokio collects the minimum data required to operate: your email (for auth), your door configuration, and request content submitted through your door. See our [Privacy Policy](/privacy) for specifics.

---

## Email

### What is a Knokio email alias?
Each door gets an email address like `you@knokio.io`. Emails to this address don't land in a traditional inbox — they're converted into structured Knokio requests.

### Do emails to my Knokio address create a thread?
No. Each email creates a one-shot request. There are no threads, no replies, and no back-and-forth.

### What if the email requires more information?
If the matching category has required fields, Knokio automatically replies to the sender with a link to complete a structured form. The request stays pending until the form is completed.

### Are CC/BCC emails accepted?
No. For privacy and clarity, emails with CC or BCC recipients are automatically rejected.

---

## Billing

### How does Knokio pricing work?
Knokio Direct uses a single-plan + usage model:
- **$5/month**
- **50 handled inbound requests included each month**
- **All Direct features unlocked**
- additional handled inbound billed on a declining usage ladder

The source of truth for billing rules is `BILLING.md`.

Billing is handled securely through Stripe.

### Can I cancel my paid plan?
Yes. You can cancel anytime from your Settings page or through the Stripe customer portal. Your paid access remains active until the end of the billing period, after which your door falls back to the non-paid baseline state configured for your account.

### Do knockers pay to submit requests?
They can, if the keeper enables a pay-to-contact category.

In that case:
- the keeper sets the pay-to-contact request cost
- the minimum price is **$2**
- Knokio keeps the greater of **$0.50** or **10%**

See `BILLING.md` for the exact pay-to-contact fee rule.

---

## Technical

### What browsers are supported?
Knokio works in all modern browsers (Chrome, Firefox, Safari, Edge). No browser extensions or plugins required.

### Is there a mobile app?
Not currently. Knokio is web-based and works on mobile browsers.

### Is there an API?
Knokio provides API endpoints for agent-based signup and programmatic interaction. See our developer documentation for details.

---

_Last updated: March 2026_
provides API endpoints for agent-based signup and programmatic interaction. See our developer documentation for details.

---

_Last updated: March 2026_
