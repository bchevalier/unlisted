# Knokio Door (URL Entry)

## Objective
Provide a public, shareable entry point (“door”) for receiving requests.

## Scope
- Door creation
- Door enable/disable
- Public door route

## Behavior
- Each user has exactly one door
- Door is accessible via a unique slug
- Disabled doors reject requests gracefully

## Constraints
- No authentication required to view door
- No discovery or browsing
- No user profile exposed

## Deliverables
- `/u/:slug` route
- Door resolution logic
- Error states (invalid, disabled)

## Acceptance Criteria
- Door URL works when shared
- Disabled doors cannot accept requests
- No sensitive user data is leaked
