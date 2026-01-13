# Database provisioning

Knokio uses managed PostgreSQL.

## Recommended provider

Neon is the default choice because it has a $0 starter tier, scales linearly with usage, and supports pooled connections (good for web runtimes) plus direct connections (needed for migrations).

## Required environment variables

- `DATABASE_URL`: pooled connection string (Neon host typically contains `-pooler`).
- `DIRECT_URL`: non-pooled connection string used by Prisma migrations (Neon host does not contain `-pooler`).

## Steps

1. Create a Neon project for development.
2. Create a separate Neon project for production.
3. In each project, copy both the pooled URL (`DATABASE_URL`) and the non-pooled URL (`DIRECT_URL`).
4. For local dev, set both in `.env.local`.
5. For Render, set both in the service environment variables.

## Notes

- Keep dev/prod isolated to avoid data leaks.
- Use pooled for runtime queries and direct for migrations to avoid connection and proxy issues.
