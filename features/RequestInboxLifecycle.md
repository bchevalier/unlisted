# Request Inbox & Lifecycle

## Objective
Allow receivers to review and decide on incoming requests.

## Scope
- Inbox list
- Request detail
- Accept / decline / expire

## States
- pending
- accepted
- declined
- expired

## Constraints
- No messaging
- No replies
- No edits after submission

## Deliverables
- Inbox UI
- State transition logic
- Background expiry job

## Acceptance Criteria
- Requests transition correctly
- Contact revealed only on accept
- Expired requests are immutable
