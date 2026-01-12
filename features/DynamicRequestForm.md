# Dynamic Request Form

## Objective
Collect structured requests based on receiver-defined rules.

## Scope
- Category selection
- Dynamic field rendering
- Validation
- Submission

## Behavior
- Fields are defined by category schema
- Validation occurs client and server-side
- Requests are created in `pending` state

## Constraints
- No conditional logic trees
- Supported field types only
- No partial submissions

## Deliverables
- Form renderer
- Validation logic
- Submit endpoint

## Acceptance Criteria
- Required fields enforced
- Invalid submissions rejected
- Requests stored correctly
