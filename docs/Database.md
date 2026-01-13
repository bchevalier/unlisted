# Database provisioning

Knokio uses managed PostgreSQL.

## Recommended provider

Neon is the default choice because it has a $0 starter tier, scales linearly with usage, and supports pooled connections for serverless/edge-friendly apps.

## Steps

1. Create a Neon project for development.
2. Create a separate Neon project for production.
3. Copy the connection string into `DATABASE_URL` in `.env.local` for dev.
4. Set `DATABASE_URL` in the deployment provider for production.

## Notes

- Keep dev/prod isolated to avoid data leaks.
- Use the pooled connection string for production to avoid connection limits.
