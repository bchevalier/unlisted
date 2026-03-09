# Admin Panel — Knokio Direct

The admin panel provides internal tools for managing users, doors, requests, and abuse reports.

## Access

- **URL:** `/admin` (redirects to `/admin/login` if unauthenticated)
- **Auth:** cookie-based session with HMAC-signed tokens (8-hour TTL)

## Authentication

Admin auth supports two credential sources, checked in order:

### 1. Database-backed (`admin_users` table)

Admin users stored in the `admin_users` table with bcrypt-hashed passwords. Supports roles (`SUPER_ADMIN`, `ADMIN`) and disable/enable flags.

### 2. Environment variable bootstrap

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` for zero-DB-migration bootstrapping. The env-var admin is treated as `SUPER_ADMIN`.

Generate a password hash:

```bash
node -e "require('bcryptjs').hash('your-password', 12).then(h => console.log(h))"
```

If a DB record exists for the same email, the DB record takes precedence (including its `disabled` flag).

## Roles

| Role | Capabilities |
|------|-------------|
| `SUPER_ADMIN` | Full access + manage admin users (create, disable, delete) |
| `ADMIN` | View/manage users, doors, requests, abuse reports |

## Security

- **Edge middleware** blocks unauthenticated access to all `/admin` and `/api/admin` routes (except login/logout)
- **Login rate limiting** — per-IP sliding window (5 attempts/15 min window, lockout escalation)
- **Audit logging** — all admin actions logged to structured JSON (console + in-memory ring buffer)
- **Input validation** — entity IDs validated as CUID/UUID before DB queries
- **Security headers** — `X-Frame-Options: DENY`, `no-store` caching, strict referrer policy
- **Self-protection** — admins cannot disable or delete their own account

## Pages

| Route | Description |
|-------|-------------|
| `/admin` | Dashboard with summary stats |
| `/admin/users` | User list with search |
| `/admin/users/[userId]` | User detail + disable/enable actions |
| `/admin/doors` | Door list with suspend actions |
| `/admin/requests` | Request list with view/delete actions |
| `/admin/requests/[requestId]` | Request detail + events + metadata |
| `/admin/abuse-reports` | Abuse report queue |

## API Routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/admin/login` | Public | Admin login |
| `POST` | `/api/admin/logout` | Session | Clear admin session |
| `GET` | `/api/admin/stats` | Session | Dashboard stats |
| `GET` | `/api/admin/users` | Session | List users |
| `GET/PATCH` | `/api/admin/users/[userId]` | Session | View/update user |
| `GET` | `/api/admin/doors` | Session | List doors |
| `PATCH` | `/api/admin/doors/[doorId]` | Session | Suspend/unsuspend door |
| `GET` | `/api/admin/requests` | Session | List requests |
| `GET/DELETE` | `/api/admin/requests/[requestId]` | Session | View/delete request |
| `GET` | `/api/admin/abuse-reports` | Session | List abuse reports |
| `GET` | `/api/admin/admin-users` | Session | List admin users |
| `POST` | `/api/admin/admin-users` | SUPER_ADMIN | Create admin user |
| `PATCH` | `/api/admin/admin-users/[adminId]` | SUPER_ADMIN | Update admin user |
| `DELETE` | `/api/admin/admin-users/[adminId]` | SUPER_ADMIN | Delete admin user |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_EMAIL` | No* | Bootstrap admin email |
| `ADMIN_PASSWORD_HASH` | No* | Bootstrap admin bcrypt hash |
| `ADMIN_SESSION_SECRET` | No | Session signing secret (falls back to `KEEPER_SESSION_SECRET`) |

\* At least one of DB admin users or env vars must be configured for admin access.

## Database Schema

```sql
CREATE TABLE "admin_users" (
    "id"             TEXT PRIMARY KEY,
    "email"          TEXT UNIQUE NOT NULL,
    "password_hash"  TEXT NOT NULL,
    "role"           "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "disabled"       BOOLEAN NOT NULL DEFAULT false,
    "last_login_at"  TIMESTAMP(3),
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL
);
```
