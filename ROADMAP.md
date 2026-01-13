# Knokio — V1 Roadmap (Direct Only)

This roadmap defines the full scope of Knokio V1.
It focuses exclusively on **Knokio (Direct)** with **email proxy support**.

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

---

## 1. Data Model & Schema

- [ ] Define `users` table
- [ ] Define `doors` table
- [ ] Define `door_settings` table
- [ ] Define `categories` table
- [ ] Define `category_fields` table
- [ ] Define `email_aliases` table
- [ ] Define `requests` table
- [ ] Define `request_events` table
- [ ] Define `payments` table
- [ ] Define `admin_users` table
- [ ] Create database migrations
- [ ] Seed default categories and fields
- [ ] Integrate ORM models into application

---

## 2. Knokio Door (URL-based Entry)

- [ ] Generate unique door slugs
- [ ] Implement door enable / disable logic
- [ ] Create public door route (`/u/:slug`)
- [ ] Render door branding and trust copy
- [ ] Display enabled categories on door page
- [ ] Handle invalid or disabled doors gracefully

---

## 3. Dynamic Request Form

- [ ] Render category selector
- [ ] Render dynamic form fields from schema
- [ ] Support text input fields
- [ ] Support textarea fields
- [ ] Support number fields
- [ ] Support URL fields
- [ ] Implement client-side validation
- [ ] Implement server-side validation
- [ ] Submit request payload to backend
- [ ] Store request with `pending` status
- [ ] Enforce per-door request caps
- [ ] Enforce per-category required fields

---

## 4. Receiver Configuration

- [ ] Create settings page shell
- [ ] Enable / disable categories
- [ ] Configure required fields per category
- [ ] Configure per-category request caps
- [ ] Configure global request caps
- [ ] Configure contact reveal method (email or redirect URL)
- [ ] Display warnings when email proxy is disabled for a category

---

## 5. Request Inbox & Lifecycle

- [ ] List requests by status (pending, accepted, declined, expired)
- [ ] Paginate request list
- [ ] Display request detail view
- [ ] Show structured request data
- [ ] Implement accept action
- [ ] Reveal contact details on accept
- [ ] Record accept event
- [ ] Implement decline action
- [ ] Record decline event
- [ ] Auto-expire stale requests via background job
- [ ] Record expiration events

---

## 6. Knocker Experience

- [ ] Generate secure request access tokens
- [ ] Create knocker status page (`/r/:token`)
- [ ] Display current request state
- [ ] Display contact details on acceptance
- [ ] Display declined / expired states with clear messaging
- [ ] Prevent knocker replies or threading

---

## 7. Email Proxy (Inbound Email → Request)

- [ ] Configure inbound email domain (`@knokio.io`)
- [ ] Enable catch-all email routing
- [ ] Create inbound email webhook endpoint
- [ ] Verify inbound email authenticity
- [ ] Parse sender address
- [ ] Parse recipient address (alias)
- [ ] Parse subject as request title
- [ ] Parse email body as request message
- [ ] Strip quoted replies and signatures
- [ ] Reject CC/BCC emails
- [ ] Reject emails with attachments
- [ ] Map email alias to door
- [ ] Create request from email content
- [ ] Enforce caps for email-submitted requests
- [ ] Detect required-field categories
- [ ] Send auto-reply requesting form completion when required
- [ ] Generate one-time form completion links
- [ ] Rate-limit inbound email per sender

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

- [ ] Define free vs paid plan limits
- [ ] Configure Stripe products and prices
- [ ] Implement Stripe Checkout flow
- [ ] Handle subscription creation webhook
- [ ] Handle subscription cancellation webhook
- [ ] Sync subscription status to user account
- [ ] Enforce plan-based feature limits
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

- Knokio Reach
- User discovery or browsing
- Messaging or chat threads
- Scheduling or calendar integration
- Reputation or ratings
- Teams or organizations
- AI-based moderation or matching

---

End of roadmap.
