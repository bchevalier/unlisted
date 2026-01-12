# Project Foundations

## Objective
Set up a stable, production-ready foundation for Knokio V1.

This feature establishes the baseline environment required for all other features.

## Scope
- Repository initialization
- Environment configuration
- Deployment
- Database provisioning
- Authentication

## Requirements
- TypeScript-based web application
- Server-rendered or hybrid framework (Next.js or equivalent)
- Managed PostgreSQL database
- Environment separation (dev / prod)
- Secure secret handling

## Constraints
- No business logic here
- No UI beyond auth flows
- No feature flags or experiments

## Deliverables
- Running application skeleton
- Authentication working end-to-end
- Database reachable from app
- Migration tooling functional

## Acceptance Criteria
- App boots locally and in production
- Users can sign up, log in, log out
- Database migrations can be applied and rolled back
- Secrets are not hardcoded

## Technical decisions
- Framework: Next.js 14+ with App Router (RSC + server actions where appropriate) for SSR/hybrid rendering and clean routing for door URLs.
- Language/runtime: TypeScript in strict mode on Node.js 20 LTS.
- Database: Managed PostgreSQL (Neon or Supabase Postgres) with separate dev/prod projects and connection pooling.
- ORM + migrations: Prisma for schema definition and migrations; use `prisma migrate` for apply/rollback in CI/CD.
- Auth: Auth.js (NextAuth) with email + password credentials, Argon2 hashing, and a PostgreSQL adapter; sessions stored in DB (no JWT-only auth).
- Validation: Zod for shared client/server validation of auth forms and API payloads.
- Secrets/config: `.env.local` for dev, platform-managed secrets for prod; no secrets in repo.
- Deployment: Vercel for web app hosting; separate managed Postgres; use preview deployments for PRs.
- Tooling: ESLint + Prettier, TypeScript build checks in CI; basic health check endpoint.
