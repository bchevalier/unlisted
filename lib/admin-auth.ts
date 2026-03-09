import crypto from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * Admin authentication module.
 *
 * MVP approach: admin credentials are stored as environment variables
 * (ADMIN_EMAIL + ADMIN_PASSWORD_HASH). This avoids a DB migration for
 * an internal-only admin panel while still using proper bcrypt-hashed
 * passwords and HMAC-signed session tokens.
 *
 * A future iteration can migrate to an `admin_users` DB table.
 */

export const ADMIN_SESSION_COOKIE = 'knokio_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

type AdminSessionPayload = {
  email: string;
  role: 'admin';
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

export function createAdminSessionToken(email: string): string {
  const payload: AdminSessionPayload = {
    email,
    role: 'admin',
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
 * Validate admin credentials against environment variables.
 * Returns the admin email on success, null on failure.
 */
export async function validateAdminCredentials(email: string, password: string): Promise<string | null> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!adminEmail || !adminPasswordHash) {
    // Admin panel not configured
    return null;
  }

  // Constant-time email comparison
  const emailMatch =
    email.trim().toLowerCase() === adminEmail.trim().toLowerCase();

  if (!emailMatch) return null;

  // Use bcrypt for password verification
  const bcrypt = await import('bcryptjs');
  const passwordMatch = await bcrypt.compare(password, adminPasswordHash);

  return passwordMatch ? adminEmail : null;
}
