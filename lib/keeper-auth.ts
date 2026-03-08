import crypto from 'node:crypto';
import { cookies } from 'next/headers';

export const KEEPER_SESSION_COOKIE = 'knokio_keeper_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type KeeperSessionPayload = {
  userId: string;
  email: string;
  exp: number;
};

function getSessionSecret(): string {
  const secret = process.env.KEEPER_SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error('KEEPER_SESSION_SECRET (or NEXTAUTH_SECRET) must be set and >= 32 chars');
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
  const secret = getSessionSecret();
  return base64url(crypto.createHmac('sha256', secret).update(data).digest());
}

export function createKeeperSessionToken(userId: string, email: string): string {
  const payload: KeeperSessionPayload = {
    userId,
    email,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  };

  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyKeeperSessionToken(token: string | null | undefined): KeeperSessionPayload | null {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = sign(encodedPayload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);

  if (left.length !== right.length) {
    return null;
  }

  const isMatch = crypto.timingSafeEqual(left, right);

  if (!isMatch) {
    return null;
  }

  let payload: KeeperSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf8')) as KeeperSessionPayload;
  } catch {
    return null;
  }

  if (!payload.userId || !payload.email || !payload.exp) {
    return null;
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

export async function getKeeperSessionFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(KEEPER_SESSION_COOKIE)?.value;
  return verifyKeeperSessionToken(token);
}

export function getKeeperSessionFromRequest(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  const entries = cookieHeader.split(';').map((entry) => entry.trim().split('='));
  const cookieValue = entries.find(([key]) => key === KEEPER_SESSION_COOKIE)?.[1];
  if (!cookieValue) {
    return null;
  }

  return verifyKeeperSessionToken(decodeURIComponent(cookieValue));
}

export const keeperSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_TTL_SECONDS
};
