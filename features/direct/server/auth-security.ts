import crypto from 'node:crypto';
import { AuthActionType, AuthTokenType } from '@prisma/client';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { db } from '../../../lib/db';

const EMAIL_VERIFICATION_TTL_MINUTES = 60 * 24;
const PASSWORD_RESET_TTL_MINUTES = 60;
const TWO_FACTOR_CHALLENGE_TTL_MINUTES = 10;
const TOTP_ISSUER = 'Knokio';

function requiredSecret() {
  const secret = process.env.AUTH_ENCRYPTION_SECRET ?? process.env.KEEPER_SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_ENCRYPTION_SECRET (or KEEPER_SESSION_SECRET/NEXTAUTH_SECRET) must be 32+ chars');
  }

  return secret;
}

function authEncryptionKey() {
  return crypto.createHash('sha256').update(requiredSecret()).digest();
}

function base64urlEncode(value: Buffer | string): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64urlDecode(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const key = authEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${base64urlEncode(iv)}.${base64urlEncode(tag)}.${base64urlEncode(encrypted)}`;
}

export function decryptSecret(ciphertext: string): string {
  const [ivPart, tagPart, dataPart] = ciphertext.split('.');
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error('Invalid ciphertext payload');
  }

  const iv = base64urlDecode(ivPart);
  const tag = base64urlDecode(tagPart);
  const encrypted = base64urlDecode(dataPart);

  const decipher = crypto.createDecipheriv('aes-256-gcm', authEncryptionKey(), iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function hashIPAddress(ipAddress: string) {
  return crypto.createHash('sha256').update(ipAddress).digest('hex');
}

export function generateOpaqueToken(bytes = 32) {
  return base64urlEncode(crypto.randomBytes(bytes));
}

export function extractClientIP(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }

  const realIp = request.headers.get('x-real-ip');
  return realIp?.trim() || null;
}

export async function recordAuthAttempt(input: {
  action: AuthActionType;
  ipAddress?: string | null;
  email?: string | null;
  success: boolean;
}) {
  await db.authAttempt.create({
    data: {
      action: input.action,
      ipHash: input.ipAddress ? hashIPAddress(input.ipAddress) : null,
      email: input.email?.toLowerCase() ?? null,
      success: input.success
    }
  });
}

export async function enforceAuthRateLimit(input: {
  action: AuthActionType;
  ipAddress?: string | null;
  maxByIp: number;
  ipWindowMinutes: number;
  email?: string | null;
  maxByEmail?: number;
  emailWindowMinutes?: number;
}) {
  const checks: Promise<void>[] = [];

  if (input.ipAddress) {
    const ipAddress = input.ipAddress;

    checks.push(
      (async () => {
        const since = new Date(Date.now() - input.ipWindowMinutes * 60 * 1000);
        const count = await db.authAttempt.count({
          where: {
            action: input.action,
            ipHash: hashIPAddress(ipAddress),
            createdAt: { gte: since }
          }
        });

        if (count >= input.maxByIp) {
          throw new Error('Too many attempts from this IP. Try again later.');
        }
      })()
    );
  }

  if (input.email && input.maxByEmail && input.emailWindowMinutes) {
    const email = input.email.toLowerCase();
    const maxByEmail = input.maxByEmail;
    const emailWindowMinutes = input.emailWindowMinutes;

    checks.push(
      (async () => {
        const since = new Date(Date.now() - emailWindowMinutes * 60 * 1000);
        const count = await db.authAttempt.count({
          where: {
            action: input.action,
            email,
            createdAt: { gte: since }
          }
        });

        if (count >= maxByEmail) {
          throw new Error('Too many attempts for this email. Try again later.');
        }
      })()
    );
  }

  await Promise.all(checks);
}

async function createAuthToken(input: {
  userId: string;
  type: AuthTokenType;
  ttlMinutes: number;
}) {
  const token = generateOpaqueToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + input.ttlMinutes * 60 * 1000);

  await db.authToken.create({
    data: {
      userId: input.userId,
      type: input.type,
      tokenHash,
      expiresAt
    }
  });

  return token;
}

export async function createEmailVerificationToken(userId: string) {
  await db.authToken.deleteMany({
    where: {
      userId,
      type: AuthTokenType.EMAIL_VERIFICATION,
      consumedAt: null
    }
  });

  return createAuthToken({
    userId,
    type: AuthTokenType.EMAIL_VERIFICATION,
    ttlMinutes: EMAIL_VERIFICATION_TTL_MINUTES
  });
}

export async function consumeEmailVerificationToken(token: string) {
  const tokenHash = hashToken(token);

  const authToken = await db.authToken.findUnique({
    where: {
      type_tokenHash: {
        type: AuthTokenType.EMAIL_VERIFICATION,
        tokenHash
      }
    },
    select: {
      id: true,
      userId: true,
      consumedAt: true,
      expiresAt: true
    }
  });

  if (!authToken || authToken.consumedAt || authToken.expiresAt < new Date()) {
    return null;
  }

  await db.$transaction([
    db.authToken.update({
      where: { id: authToken.id },
      data: { consumedAt: new Date() }
    }),
    db.user.update({
      where: { id: authToken.userId },
      data: { emailVerifiedAt: new Date() }
    })
  ]);

  return authToken.userId;
}

export async function createPasswordResetToken(userId: string) {
  await db.authToken.deleteMany({
    where: {
      userId,
      type: AuthTokenType.PASSWORD_RESET,
      consumedAt: null
    }
  });

  return createAuthToken({
    userId,
    type: AuthTokenType.PASSWORD_RESET,
    ttlMinutes: PASSWORD_RESET_TTL_MINUTES
  });
}

export async function consumePasswordResetToken(token: string) {
  const tokenHash = hashToken(token);

  const authToken = await db.authToken.findUnique({
    where: {
      type_tokenHash: {
        type: AuthTokenType.PASSWORD_RESET,
        tokenHash
      }
    },
    select: {
      id: true,
      userId: true,
      consumedAt: true,
      expiresAt: true
    }
  });

  if (!authToken || authToken.consumedAt || authToken.expiresAt < new Date()) {
    return null;
  }

  await db.authToken.update({
    where: { id: authToken.id },
    data: { consumedAt: new Date() }
  });

  return authToken.userId;
}

export async function createTwoFactorChallengeToken(userId: string) {
  await db.authToken.deleteMany({
    where: {
      userId,
      type: AuthTokenType.TWO_FACTOR_CHALLENGE,
      consumedAt: null
    }
  });

  return createAuthToken({
    userId,
    type: AuthTokenType.TWO_FACTOR_CHALLENGE,
    ttlMinutes: TWO_FACTOR_CHALLENGE_TTL_MINUTES
  });
}

export async function consumeTwoFactorChallengeToken(token: string) {
  const tokenHash = hashToken(token);

  const authToken = await db.authToken.findUnique({
    where: {
      type_tokenHash: {
        type: AuthTokenType.TWO_FACTOR_CHALLENGE,
        tokenHash
      }
    },
    select: {
      id: true,
      userId: true,
      consumedAt: true,
      expiresAt: true
    }
  });

  if (!authToken || authToken.consumedAt || authToken.expiresAt < new Date()) {
    return null;
  }

  await db.authToken.update({
    where: { id: authToken.id },
    data: { consumedAt: new Date() }
  });

  return authToken.userId;
}

export function generateTotpSetup(email: string) {
  const secret = generateSecret();
  const otpauthUrl = generateURI({
    strategy: 'totp',
    issuer: TOTP_ISSUER,
    label: email,
    secret,
    algorithm: 'sha1',
    digits: 6,
    period: 30
  });

  return { secret, otpauthUrl };
}

export function verifyTotpCode(secret: string, code: string) {
  return verifySync({
    strategy: 'totp',
    token: code,
    secret,
    algorithm: 'sha1',
    digits: 6,
    period: 30,
    epochTolerance: 1
  });
}

export function generateRecoveryCodes(count = 8) {
  const rawCodes: string[] = [];

  for (let i = 0; i < count; i += 1) {
    const code = crypto
      .randomBytes(5)
      .toString('hex')
      .slice(0, 10)
      .toUpperCase();
    rawCodes.push(code);
  }

  return {
    plain: rawCodes,
    hashes: rawCodes.map((code) => hashToken(code))
  };
}

export function hashRecoveryCode(code: string) {
  return hashToken(code.trim().toUpperCase());
}
