# Knokio Reach — Pilot Execution Evidence Format

This document defines the structured format for capturing evidence that Reach pilot runs were executed correctly. Every onboarding, daily check, incident, and graduation must produce a corresponding evidence record.

---

## Evidence File

Evidence is stored in `pilot-evidence/reach-pilot-log.jsonl` — one JSON object per line. Each record has a common envelope plus event-specific fields.

### Common Envelope

```json
{
  "version": "1",
  "eventType": "<EVENT_TYPE>",
  "timestamp": "<ISO-8601>",
  "recordedBy": "<admin-name-or-system>",
  "pilotId": "reach-v1-pilot",
  "handle": "<actor-handle>",
  "data": { ... }
}
```

### Event Types

| Event Type | When | Required Fields in `data` |
|---|---|---|
| `PRE_FLIGHT` | Before first onboarding | `validateResult`, `smokeResult`, `serverUrl` |
| `BASELINE_METRICS` | Before first onboarding | `snapshot` (full metrics output) |
| `ACTOR_REGISTERED` | Actor created | `actorType`, `operatorName`, `registeredBy` |
| `CONFIG_COMPLETE` | Policies + webhooks set | `policiesCount`, `webhookVerified`, `webhookUrl` |
| `DAILY_CHECK` | Daily during supervised period | `day`, `contractsReceived`, `contractsFulfilled`, `webhookDeliveryRate`, `issues` |
| `INCIDENT` | Escalation triggered | `severity` (`P0`–`P3`), `description`, `action`, `resolved` |
| `METRICS_SNAPSHOT` | Any time | `snapshot` (full metrics output) |
| `GRADUATION` | Operator passes criteria | `daysSupervised`, `contractsProcessed`, `oneHopRate`, `allCriteriaPassed` |
| `ROLLBACK` | Reach disabled for safety | `reason`, `affectedActors`, `restoredAt` |
| `PILOT_CLOSE` | Pilot phase concludes | `totalParticipants`, `graduated`, `summary` |

---

## Example Records

### Pre-flight check
```json
{
  "version": "1",
  "eventType": "PRE_FLIGHT",
  "timestamp": "2026-03-09T22:00:00Z",
  "recordedBy": "system",
  "pilotId": "reach-v1-pilot",
  "handle": null,
  "data": {
    "validateResult": "PASS",
    "smokeResult": "PASS",
    "serverUrl": "https://knokio.io",
    "checksPasssed": 10,
    "checksFailed": 0
  }
}
```

### Actor registered
```json
{
  "version": "1",
  "eventType": "ACTOR_REGISTERED",
  "timestamp": "2026-03-10T09:00:00Z",
  "recordedBy": "john",
  "pilotId": "reach-v1-pilot",
  "handle": "acme-summarizer",
  "data": {
    "actorType": "AI_AGENT",
    "operatorName": "Acme AI Labs",
    "registeredBy": "john",
    "operatorUrl": "https://acme.example.com",
    "modelId": "gpt-4o",
    "agreedWeeklyCap": 100
  }
}
```

### Daily check
```json
{
  "version": "1",
  "eventType": "DAILY_CHECK",
  "timestamp": "2026-03-12T09:00:00Z",
  "recordedBy": "john",
  "pilotId": "reach-v1-pilot",
  "handle": "acme-summarizer",
  "data": {
    "day": 2,
    "contractsReceived": 8,
    "contractsFulfilled": 7,
    "contractsRejected": 0,
    "contractsExpired": 1,
    "webhookDeliveryRate": 100,
    "oneHopSuccessRate": 87.5,
    "medianTimeToCounterpartySec": 12,
    "pathLengthMedian": 2,
    "issues": "none"
  }
}
```

### Incident
```json
{
  "version": "1",
  "eventType": "INCIDENT",
  "timestamp": "2026-03-14T15:30:00Z",
  "recordedBy": "john",
  "pilotId": "reach-v1-pilot",
  "handle": "acme-summarizer",
  "data": {
    "severity": "P2",
    "description": "Webhook endpoint returning 502 for 15 minutes",
    "action": "Paused inbound traffic, notified operator",
    "resolved": true,
    "resolvedAt": "2026-03-14T16:00:00Z",
    "rootCause": "Operator infrastructure maintenance window"
  }
}
```

### Graduation
```json
{
  "version": "1",
  "eventType": "GRADUATION",
  "timestamp": "2026-03-17T09:00:00Z",
  "recordedBy": "john",
  "pilotId": "reach-v1-pilot",
  "handle": "acme-summarizer",
  "data": {
    "daysSupervised": 7,
    "contractsProcessed": 42,
    "oneHopRate": 85.7,
    "medianTimeToCounterpartySec": 8,
    "pathLengthMedian": 2,
    "abuseReports": 0,
    "webhookDeliveryRate": 99.2,
    "allCriteriaPassed": true
  }
}
```

---

## Evidence Tooling

### Append an evidence record

```bash
./scripts/reach-pilot-evidence.sh <event-type> <handle> [key=value ...]
```

Example:
```bash
./scripts/reach-pilot-evidence.sh DAILY_CHECK acme-summarizer \
  day=3 contractsReceived=12 contractsFulfilled=11 \
  webhookDeliveryRate=100 issues=none
```

### View evidence log

```bash
# All records
cat pilot-evidence/reach-pilot-log.jsonl | jq .

# Filter by handle
cat pilot-evidence/reach-pilot-log.jsonl | jq 'select(.handle == "acme-summarizer")'

# Filter by event type
cat pilot-evidence/reach-pilot-log.jsonl | jq 'select(.eventType == "DAILY_CHECK")'

# Count events
wc -l pilot-evidence/reach-pilot-log.jsonl
```

### Generate evidence summary

```bash
./scripts/reach-pilot-evidence.sh --summary
```

---

## Retention

- Evidence logs are kept for the full duration of the pilot plus 90 days.
- Logs are committed to the repo under `pilot-evidence/` (no secrets — only handles and metrics).
- After retention, logs can be archived or deleted.

---

## Compliance Notes

- Evidence records never contain API keys, passwords, or PII beyond actor handles.
- Webhook URLs are recorded to aid debugging but contain no auth tokens.
- Incident records track what happened and what action was taken.
- All timestamps are UTC ISO-8601.

---

_See also: [Reach-Pilot-Onboarding.md](./Reach-Pilot-Onboarding.md) for the onboarding flow, [Reach-Pilot-Rollback.md](./Reach-Pilot-Rollback.md) for safety procedures._
