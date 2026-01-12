# Email Proxy (Inbound Email)

## Objective
Allow email to act as a controlled entry into Knokio.

## Scope
- Catch-all email ingestion
- Alias mapping
- Email → request conversion
- Auto-reply escalation

## Behavior
- Email never creates threads
- Email respects same rules as forms
- Required fields trigger form request

## Constraints
- No attachments
- No CC/BCC
- No replies allowed

## Deliverables
- Inbound webhook
- Parser
- Auto-reply system

## Acceptance Criteria
- Emails create valid requests
- Rules enforced identically
- Abuse vectors mitigated
