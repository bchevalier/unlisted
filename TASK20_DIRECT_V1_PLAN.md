# TASK20 — Knokio Direct V1 Paid + Verification Rollout Plan (20 slots / 2h)

## Objective
Implement V1 for paid Knokio Direct behavior:

1. Requester verification (basic + org)
2. Keeper-defined quotes (private, policy-gated visibility)
3. Keeper toggle for receiving non-targeted paid offers via Knokio Reach
4. Keeper privacy control: restrict quote visibility to verified orgs
   - If disabled, non-org requesters can view quote when basic verification passes
   - Non-orgs must still pass basic ID verification

## V1 Scope Decisions (implementation constraints)
- No full external KYC in V1.
- Verification is request-scoped and deterministic from submitted identity/org inputs.
- Quotes are not publicly shown on door page; only visible from request-status token page when policy allows.

## Data model target
Add to `Request`:
- `requesterType`: INDIVIDUAL | ORGANIZATION
- `requesterOrgName`: nullable string
- `requesterOrgWebsite`: nullable string
- `requesterRoleTitle`: nullable string
- `requesterVerificationStatus`: UNVERIFIED | BASIC_VERIFIED | ORG_VERIFIED
- `requesterVerificationReason`: nullable string
- `keeperQuoteAmountCents`: nullable int
- `keeperQuoteCurrency`: nullable string (default USD when populated)
- `keeperQuoteNote`: nullable string

Add to `DoorSettings`:
- `paidQuoteAmountCents`: nullable int
- `paidQuoteCurrency`: nullable string
- `paidQuoteNote`: nullable string
- `quoteVisibleToVerifiedOrgsOnly`: boolean default false
- `openToNonTargetedPaidReach`: boolean default false

## Verification policy (V1)
- BASIC_VERIFIED:
  - senderEmail exists and is valid
  - sender domain is not a blocked free/disposable domain list
- ORG_VERIFIED:
  - BASIC_VERIFIED
  - requesterType = ORGANIZATION
  - companyName + companyWebsite + roleTitle provided
  - sender email domain matches website registrable domain
  - domain has DNS (MX preferred, fallback A/AAAA)

## Quote visibility policy
On `/r/[token]` page:
- Show quote only when request status is ACCEPTED and request has quote snapshot.
- If `quoteVisibleToVerifiedOrgsOnly = true`:
  - show only if requesterVerificationStatus = ORG_VERIFIED
- Else:
  - show if requesterVerificationStatus in {BASIC_VERIFIED, ORG_VERIFIED}

## Keeper settings UX
In Direct settings:
- Quote amount (cents or dollars input mapped safely)
- Quote currency
- Quote note
- Toggle: Restrict quote visibility to verified orgs
  - helper text clarifies: otherwise visible to non-orgs that pass basic verification
- Toggle: Open to non-targeted paid Reach offers

## Form UX (public door)
Add fields:
- Requester type: Individual/Organization
- For org: company name, company website, role title
- Require sender email for paid doors (to support verification)

## Implementation slot map
1-10: implementation + tests complete by slot 10.
11-20: verification hardening, bug fixing, docs, full checks.

## Definition of done
- Prisma schema + migration added
- APIs updated: form request create, settings save, request accept flow
- UI updated: door form, settings panel, request status page, keeper request detail
- Quote snapshot captured on acceptance from keeper settings
- Verification status stored and displayed
- Tests added/updated and passing
- Lint + typecheck + tests + build pass
- Commit + push to `wip`
