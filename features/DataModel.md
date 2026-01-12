# Data Model & Schema

## Objective
Define and implement the canonical data schema for Knokio V1.

## Scope
- Tables
- Relations
- Constraints
- Migrations
- Seeds

## Core Entities
- User
- Door
- DoorSettings
- Category
- CategoryField
- EmailAlias
- Request
- RequestEvent
- Payment
- AdminUser

## Constraints
- Normalize data (no JSON blobs unless justified)
- Explicit foreign keys
- Soft deletes where appropriate
- Immutable audit events

## Deliverables
- Database schema
- ORM models
- Migration scripts
- Seed data for default categories

## Acceptance Criteria
- Schema supports all V1 flows
- Requests are auditable via events
- Email aliases are uniquely mappable
- No orphaned records possible
