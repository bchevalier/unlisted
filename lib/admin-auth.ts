import crypto from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * Admin authentication module.
 *
 * Supports two credential sources (checked in order):
 *  1. **DB-backed**: `admin_users` table (AdminUser model)
 *  2. **Env-var bootstrap**: ADMIN_EMAIL + ADMIN_PASSWORD_HASH env vars
 *
 * The env-var path allows bootstrapping the first admin without DB access.
 * Once an `admin_users` row exists for the same email, the DB record takes
 * precedence (including its `disabled` flag and `role`).
 */

export const ADMIN_SESSION_COOKIE = 'knokio_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN';

type AdminSessionPayload = {
  email: string;
  role: 'admin';
  adminRole?: AdminRole;
  exp: number;
};

function getAdminSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.KEEPER_SESSION_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error('ADMIN_SESSION_SECRET (or KEEPER_SESSION_SECRET) must be set and >= 32 chars');
  }
  return secret;
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function sign(data: string): string {
  const secret = getAdminSecret();
  return base64url(crypto.createHmac('sha256', secret).update(data).digest());
}

export function createAdminSessionToken(email: string, adminRole?: AdminRole): string {
  const payload: AdminSessionPayload = {
    email,
    role: 'admin',
    ...(adminRole ? { adminRole } : {}),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(token: string | null | undefined): AdminSessionPayload | null {
  if (!token) return null;

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expected = sign(encodedPayload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);

  if (left.length !== right.length) return null;
  if (!crypto.timingSafeEqual(left, right)) return null;

  let payload: AdminSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf8')) as AdminSessionPayload;
  } catch {
    return null;
  }

  if (!payload.email || payload.role !== 'admin' || !payload.exp) return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}

export async function getAdminSessionFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSessionToken(token);
}

export function getAdminSessionFromRequest(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const entries = cookieHeader.split(';').map((entry) => entry.trim().split('='));
  const cookieValue = entries.find(([key]) => key === ADMIN_SESSION_COOKIE)?.[1];
  if (!cookieValue) return null;

  return verifyAdminSessionToken(decodeURIComponent(cookieValue));
}

export const adminSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/admin',
  maxAge: SESSION_TTL_SECONDS,
};

/**
 * Result of a successful admin credential validation.
 */
export type AdminValidationResult = {
  email: string;
  role: AdminRole;
  source: 'db' | 'env';
  adminUserId?: string;
};

/**
 * Validate admin credentials.
 *
 * Checks DB (`admin_users` table) first. If no DB match, falls back to
 * the ADMIN_EMAIL + ADMIN_PASSWORD_HASH env vars (bootstrap path).
 *
 * Returns validation result on success, null on failure.
 */
export async function validateAdminCredentials(
  email: string,
  password: string
): Promise<AdminValidationResult | null> {
  const bcrypt = await import('bcryptjs');
  const normalizedEmail = email.trim().toLowerCase();

  // --- 1. Try DB-backed admin_users ---
  try {
    const { db } = await import('./db');
    const dbAdmin = await db.adminUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (dbAdmin) {
      if (dbAdmin.disabled) return null;

      const passwordMatch = await bcrypt.compare(password, dbAdmin.passwordHash);
      if (!passwordMatch) return null;

      // Update last login timestamp (fire-and-forget)
      db.adminUser
        .update({
          where: { id: dbAdmin.id },
          data: { lastLoginAt: new Date() },
        })
        .catch(() => {
          /* non-critical */
        });

      return {
        email: dbAdmin.email,
        role: dbAdmin.role as AdminRole,
        source: 'db',
        adminUserId: dbAdmin.id,
      };
    }
  } catch {
    // DB unavailable — fall through to env-var path
  }

  // --- 2. Fallback: env-var bootstrap ---
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!adminEmail || !adminPasswordHash) return null;

  const emailMatch = normalizedEmail === adminEmail.trim().toLowerCase();
  if (!emailMatch) return null;

  const passwordMatch = await bcrypt.compare(password, adminPasswordHash);
  if (!passwordMatch) return null;

  return {
    email: adminEmail,
    role: 'SUPER_ADMIN',
    source: 'env',
  };
}
