# SECURITY.md — Knokio Security & Privacy Architecture

## Purpose

Define the security choices that protect user privacy, especially against database leak scenarios.

---

## Core security objective

**Minimize linkability between a real user identity and their Knokio personal configuration/data.**

Important nuance:
- We optimize for **correlation resistance** and **blast-radius reduction**.
- If every system + every key is fully compromised, absolute unlinkability is impossible.
- Goal: make matching identity ↔ private Knokio data hard, expensive, and operationally unlikely.

---

## Threat model (priority)

### In scope
- SQL dump leak of product database
- Partial credential leak (read-only token, app logs)
- Insider overreach on operational tooling
- Exfiltration of selected tables/backups

### High-risk event
- attacker tries to map a person to:
  - their door config,
  - private contact-reveal settings,
  - request history,
  - sensitive profile preferences.

---

## Security decisions (approved)

## 1) Identity/Data separation

Split data domains:

1. **Identity domain**
   - login/auth data (email, auth providers, session metadata)

2. **Product domain**
   - doors, settings, requests, routing, events, aliases

**Rule:** product tables must not directly depend on raw user account identifiers (email/userId from auth provider).

---

## 2) Opaque keeper identifier

Use a non-derivable, random identifier in product data:
- `keeperPublicId` (or equivalent opaque principal key)

Properties:
- random high-entropy token (UUIDv7/ULID/random 128-bit+)
- no embedded semantics (no email, no timestamp leakage if avoidable)
- never exposed as a stable public lookup surface beyond required workflow scope

---

## 3) Minimal identity-link table

Maintain identity↔keeper mapping in a **minimal, isolated mapping store**:
- separate DB/schema/service when possible
- strictly limited access paths
- encryption-at-rest plus restricted runtime access

**Rule:** most product queries must not require joining with identity mapping.

---

## 4) Selective field encryption (application-level)

Encrypt sensitive values before persistence (envelope pattern):
- contact reveal values (email/URL/private endpoints)
- sensitive alias metadata
- optional high-sensitivity request metadata

Store:
- ciphertext + metadata (key version, nonce)
- never plaintext in logs

---

## 5) Key management

- Keep data-encryption keys outside application DB (KMS/HSM-backed)
- support key rotation with versioned encryption metadata
- separate key scopes by data class when feasible

---

## 6) Access control & runtime isolation

- separate DB roles for app/runtime/admin/jobs
- least-privilege permissions by service
- deny direct broad read access for support tools
- mandatory authz checks on every admin endpoint

---

## 7) Logging and observability hygiene

- redact PII and secrets by default
- avoid logging raw request bodies containing personal data
- include structured security events for audits
- preserve immutable request event history (who/what/when)

---

## 8) Data minimization

- collect only required fields per workflow
- explicit retention windows for request payloads/logs
- support deletion/anonymization workflows

---

## 9) Network and infra controls

- TLS everywhere (inbound and service-to-service)
- restricted backup access + encryption
- IP allowlists / private network paths for admin planes when possible

---

## 10) Leak-response posture

- incident runbook for credential and data leak events
- rapid key/token rotation procedures
- scoped user notification policy by impact class

---

## Direct/Reach security constraint

Reach must not weaken Direct privacy defaults.

- no public profile browsing by default
- no automatic private contact disclosure
- Reach experiments must pass abuse/security gates before wider rollout

---

## Implementation plan (phased)

## Phase S1 — immediate hardening
- [ ] introduce `keeperPublicId` principal in schema
- [ ] remove direct identity linkage from product tables
- [ ] add isolated identity-mapping table/service boundary
- [ ] add secret redaction policy to logs

## Phase S2 — cryptographic hardening
- [ ] encrypt reveal/contact sensitive fields at app layer
- [ ] add key versioning + rotation workflow
- [ ] add encrypted backup verification process

## Phase S3 — governance & response
- [ ] finalize retention/anonymization policy
- [ ] formalize incident runbook and drill
- [ ] add periodic access review for admin/service roles

---

## Verification metrics

Track these to evaluate privacy posture quality:
- % of product tables without direct identity keys
- # of sensitive fields encrypted at app layer
- mean time to rotate compromised credentials/keys
- % of logs passing PII redaction checks
- # of privileged principals with read access to identity mapping

---

## Non-negotiable principles

1. **Reachable without searchable**
2. **Private by default**
3. **Least privilege everywhere**
4. **No fabricated security claims**
