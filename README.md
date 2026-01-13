# Knokio

Knokio is a privacy-first way to be reachable without being exposed.

It replaces public contact details (email, DMs, contact forms) with a single, controlled entry point — a **door** — that lets people reach you **only on your terms**.

Knokio is not a social network, not a marketplace, and not an inbox.
It is a filtering layer between you and the outside world.

---

## The problem

Public contact details create three problems:

1. **Noise**  
   Anyone can reach you, regardless of relevance or intent.

2. **Lack of structure**  
   Important requests arrive mixed with low-effort or incomplete ones.

3. **No control**  
   Ignoring messages feels rude, replying takes time, and spam keeps coming.

Most people either:
- expose themselves and get overwhelmed, or
- hide completely and miss good opportunities.

Knokio exists to sit in between.

---

## What Knokio does

Knokio gives you a single **public door** you can share instead of your email or DMs.

Behind that door:
- requests are structured
- limits are enforced
- silence is an acceptable outcome
- nothing is public or browsable

You decide:
- what types of requests you accept
- what information is required
- how many requests you receive
- how (and if) your contact details are revealed

---

## How it works (high level)

**Terminology**
- **Keepers** are door owners (previously referred to as Hosts).
- **Knockers** are people who submit requests through a door.

### 1. You create a Knokio door
You get:
- a shareable link (e.g. `knokio.io/u/you`)
- an optional email handle (e.g. `you@knokio.io`)

This replaces public contact details.

---

### 2. You define your rules
For each type of request, you can configure:
- whether it’s accepted
- where to forward the request
- what information is required
- optional limits (per week, per category)
- whether and how to auto-reply

Simple requests can stay simple.
Serious requests can require structure.

---

### 3. Someone knocks
A Knocker:
- emails your Knokio address **or**
- fills the form

Their message becomes a **request**, not a conversation.

---

### 4. You decide
Each request can be:
- **forwarded** → to different emails based on request categorization
- **declined**
- **auto-replied** -> regardless of whether the request was forwarded or declined

No back-and-forth.
No obligation to reply.
No exposure.

---

## What Knokio is *not*

- ❌ Not a social network  
- ❌ Not a directory  
- ❌ Not a marketplace  
- ❌ Not a messaging app  
- ❌ Not designed for browsing people  

There are no profiles to search.
There is no discovery.
Access is always explicit and intentional.

---

## Why email is supported (but controlled)

Knokio can act as an **email-shaped door**.

Emails sent to `you@knokio.io`:
- do not land in an inbox
- do not create threads
- are converted into structured requests

If a request requires specific information, Knokio automatically asks the sender to complete a form instead.

Email lowers friction — Knokio keeps control.

---

## Who Knokio is for

Knokio is useful for people who:
- receive unsolicited inbound
- care about their time
- want to stay accessible without being public

Examples:
- creators
- investors
- consultants
- executives
- academics
- public figures
- anyone tired of noisy inboxes

---

## Core principles

- **Consent over access**
- **Intent over volume**
- **Silence is an answer**
- **No browsing, no stalking**
- **Private by default**

---

## Status

This repository currently focuses on **Knokio (Direct)** only.

Networked features and routing are intentionally out of scope until the core door works reliably.

## Environment configuration

Knokio relies on a `.env.local` file for local testing while the `.env.example` file documents the required keys (see `lib/env.ts`). The loader enforces `APP_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` (32+ chars), `DATABASE_URL` (pooled), and `DIRECT_URL` (non-pooled, for migrations). Don’t commit secrets—use the same keys in your deployment provider (Render supports encrypted variables and starts at $0 before you scale).

## Deployment environment

Render provides a $0 starter tier that scales linearly as traffic grows. The `render.yaml` blueprint sets up the web service with required env vars and a production build. Create a Render service from this repo, then add the same secrets defined in `.env.example`.

### Render Blueprint (recommended)

- In Render: New → Blueprint, select this repo and deploy from `render.yaml`.
- Set env vars in the created service: `APP_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `DATABASE_URL` (and keep `NODE_ENV=production`).
- Use Neon pooled for `DATABASE_URL` and non-pooled for `DIRECT_URL`.
- If you previously created a non-blueprint Web Service, delete it (or ignore it) to avoid Render using its default `yarn install; yarn build` pipeline.

## Database provisioning

Managed PostgreSQL is required. The default recommendation is Neon for a $0 starter tier with linear scaling and pooled connections. See `docs/Database.md`.

---

## License

 TBD
