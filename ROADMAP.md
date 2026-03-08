# Knokio — V1 Roadmap (Direct + Reach Pilot)

This roadmap defines the full scope of Knokio V1.
It ships **Knokio Direct** as the protected core while running **Knokio Reach** as a parallel pilot track, with strict isolation guardrails.
Direct accepts both **structured form requests** and **email-shaped requests** via Knokio email aliases.

Each checkbox represents a discrete task suitable for an AI agent.
Tasks should be checked only when implemented and verified.

---

## 0. Project Foundations

- [x] Initialize repository (TypeScript, linting, formatting)
- [x] Configure environment variables and secrets management
- [x] Set up deployment environment
- [x] Provision managed PostgreSQL database
- [x] Configure database migration tooling
- [x] Set up basic authentication (signup, login, sessions)
- [x] Add Direct/Reach feature flags and runtime isolation for parallel testing

---

## 1. Data Model & Schema

- [x] Define `users` table
- [x] Define `doors` table
- [x] Define `door_settings` table
- [x] Define `categories` table
- [x] Define `category_fields` table
- [x] Define `email_aliases` table
- [x] Define `requests` table
- [x] Define `request_events` table
- [ ] Define `payments` table
- [ ] Define `admin_users` table
- [x] Create database migrations
- [x] Seed default categories and fields
- [x] Integrate ORM models into application

---

## 2. Knokio Door (URL-based Entry)

- [ ] Generate unique door slugs
- [x] Implement door enable / disable logic
- [x] Create public door route (`/u/:slug`)
- [x] Render door branding and trust copy
- [x] Display enabled categories on door page
- [x] Handle invalid or disabled doors gracefully

---

## 3. Dynamic Request Form

- [x] Render category selector
- [x] Render dynamic form fields from schema
- [x] Support text input fields
- [x] Support textarea fields
- [x] Support number fields
- [x] Support URL fields
- [x] Implement client-side validation
- [x] Implement server-side validation
- [x] Submit request payload to backend
- [x] Store request with `pending` status
- [x] Enforce per-door request caps
- [x] Enforce per-category required fields

---

## 4. Receiver Configuration

- [x] Create settings page shell
- [x] Enable / disable categories
- [x] Configure required fields per category
- [x] Configure per-category request caps
- [x] Configure global request caps
- [x] Configure contact reveal method (email or redirect URL)
- [ ] Display warnings when email proxy is disabled for a category

---

## 5. Request Inbox & Lifecycle

- [x] List requests by status (pending, accepted, declined, expired)
- [ ] Paginate request list
- [ ] Display request detail view
- [x] Show structured request data
- [x] Implement accept action
- [x] Reveal contact details on accept
- [x] Record accept event
- [x] Implement decline action
- [x] Record decline event
- [ ] Auto-expire stale requests via background job
- [ ] Record expiration events

---

## 6. Knocker Experience

- [x] Generate secure request access tokens
- [x] Create knocker status page (`/r/:token`)
- [x] Display current request state
- [x] Display contact details on acceptance
- [x] Display declined / expired states with clear messaging
- [x] Prevent knocker replies or threading

---

## 7. Email Proxy (Inbound Email → Request)

- [ ] Configure inbound email domain (`@knokio.io`)
- [ ] Enable catch-all email routing
- [x] Create inbound email webhook endpoint
- [x] Verify inbound email authenticity
- [x] Parse sender address
- [x] Parse recipient address (alias)
- [x] Parse subject as request title
- [x] Parse email body as request message
- [x] Strip quoted replies and signatures
- [x] Reject CC/BCC emails
- [x] Reject emails with attachments
- [x] Map email alias to door
- [x] Create request from email content
- [x] Enforce caps for email-submitted requests
- [ ] Detect required-field categories
- [ ] Send auto-reply requesting form completion when required
- [ ] Generate one-time form completion links
- [x] Rate-limit inbound email per sender

---

## 8. Outbound Notifications

- [ ] Configure outbound email provider
- [ ] Create email templates (new request)
- [ ] Create email templates (request accepted)
- [ ] Create email templates (request expired)
- [ ] Send notification on new request
- [ ] Send notification on request acceptance
- [ ] Send notification on expiration
- [ ] Implement optional digest notifications
- [ ] Respect user notification preferences

---

## 9. Subscription & Entitlements (Model A)

- [x] Define free vs paid plan limits
- [x] Implement manual free/paid plan switching in Direct settings (pre-Stripe)
- [ ] Configure Stripe products and prices
- [ ] Implement Stripe Checkout flow
- [ ] Handle subscription creation webhook
- [ ] Handle subscription cancellation webhook
- [ ] Sync subscription status to user account
- [x] Enforce plan-based feature limits
- [ ] Display billing status in settings
- [ ] Link to Stripe customer portal

---

## 10. Abuse Prevention & Safety

- [ ] Implement IP-based rate limiting
- [ ] Implement sender-based rate limiting
- [ ] Add blocklist per door
- [ ] Prevent blocked senders from submitting requests
- [ ] Add abuse report button
- [ ] Store abuse reports for admin review
- [ ] Add CAPTCHA or bot protection on public entry

---

## 11. Admin Tools

- [ ] Implement admin authentication
- [ ] Create admin dashboard shell
- [ ] List users and doors
- [ ] View individual requests
- [ ] Suspend a door
- [ ] Disable a user account
- [ ] Delete abusive requests
- [ ] Inspect request events and metadata

---

## 11R. Reach Pilot (Parallel Track)

- [ ] Create Reach client routes and navigation isolation (`/reach/*`)
- [ ] Keep Reach behind feature flags by default
- [ ] Implement Reach request contracts (human↔human, human↔AI, AI↔human, AI↔AI)
- [ ] Implement policy-based automatic routing (no human admin intervention in normal flow)
- [ ] Add optional human override/escalation only for policy exceptions
- [ ] Add org/system integrations (API-first inbound + outbound hooks)
- [ ] Add Reach pilot metrics (path length, time-to-qualified-counterparty, one-hop success)
- [ ] Run limited pilots with AI operators and organization ops teams

---

## 12. Observability & Hardening

- [ ] Configure error tracking
- [ ] Add structured logging
- [ ] Add request lifecycle metrics
- [ ] Verify webhook signature handling
- [ ] Sanitize all user inputs
- [ ] Review token entropy and expiry rules
- [ ] Add basic integration tests
- [ ] Perform load sanity check (500 users)
- [ ] Verify failure modes for email ingestion

---

## 13. Launch Readiness

- [ ] Write onboarding copy
- [ ] Write public FAQ
- [ ] Write privacy and terms documents
- [ ] Verify email deliverability
- [ ] Perform final end-to-end test
- [ ] Enable production environment
- [ ] Invite first pilot users

---

## Scope Guardrails

The following are explicitly out of scope for V1:

- Open/public user discovery or browsing (Reach stays opt-in and policy-gated)
- Messaging or chat threads
- Scheduling or calendar integration
- Reputation or ratings
- Full team/organization workspace UX
- AI-based moderation or matching autonomy without human policy controls

---

End of roadmap.
