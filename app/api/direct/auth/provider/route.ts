import { AuthActionType, AuthProvider } from '@prisma/client';
import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import {
  AuthValidationError,
  authenticateKeeperWithExternalIdentity
} from '../../../../../features/direct/server/auth';
import {
  enforceAuthRateLimit,
  extractClientIP,
  recordAuthAttempt
} from '../../../../../features/direct/server/auth-security';
import { captureException } from '../../../../../lib/error-tracking';
import {
  createKeeperSessionToken,
  KEEPER_SESSION_COOKIE,
  keeperSessionCookieOptions
} from '../../../../../lib/keeper-auth';
import { extractEmailDomain, isDisposableDomain } from '../../../../../features/direct/server/verification';
import { logger } from '../../../../../lib/logger';
import { verifyProviderToken } from '../../../../../lib/provider-auth';

const log = logger('auth:provider');

const providerAuthSchema = z.object({
  provider: z
    .nativeEnum(AuthProvider)
    .refine((provider) => provider !== AuthProvider.PASSWORD, {
      message: 'Provider must be GOOGLE, APPLE, LINKEDIN, or PRIVY'
    }),
  token: z.string().trim().min(1),
  website: z.string().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  desiredSlug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/).optional(),
  preset: z.enum(['CREATOR', 'ADVISOR', 'PUBLIC_FACING']).default('CREATOR')
});

export async function POST(request: Request) {
  const ipAddress = extractClientIP(request);
  const payload = await request.json().catch(() => ({}));

  try {
    await enforceAuthRateLimit({
      action: AuthActionType.LOGIN,
      ipAddress,
      maxByIp: 30,
      ipWindowMinutes: 15
    });

    const parsed = providerAuthSchema.parse(payload);
    if (typeof parsed.website === 'string' && parsed.website.trim().length > 0) {
      await recordAuthAttempt({
        action: AuthActionType.LOGIN,
        ipAddress,
        success: false
      });

      return NextResponse.json({ ok: false, error: 'Invalid login attempt' }, { status: 400 });
    }

    const verifiedIdentity = await verifyProviderToken({
      provider: parsed.provider,
      token: parsed.token
    });

    const verifiedEmailDomain = verifiedIdentity.email ? extractEmailDomain(verifiedIdentity.email) : null;
    if (verifiedEmailDomain && isDisposableDomain(verifiedEmailDomain)) {
      await recordAuthAttempt({
        action: AuthActionType.LOGIN,
        ipAddress,
        email: verifiedIdentity.email,
        success: false
      });

      return NextResponse.json(
        { ok: false, error: 'Temporary or disposable email addresses are not allowed for Direct signups' },
        { status: 400 }
      );
    }

    const keeper = await authenticateKeeperWithExternalIdentity({
      provider: verifiedIdentity.provider,
      providerSubject: verifiedIdentity.providerSubject,
      email: verifiedIdentity.email,
      emailVerified: verifiedIdentity.emailVerified,
      walletAddress: verifiedIdentity.walletAddress,
      name: parsed.name ?? verifiedIdentity.name,
      desiredSlug: parsed.desiredSlug,
      preset: parsed.preset,
      plan: 'FREE'
    });

    const response = NextResponse.json({
      ok: true,
      keeper: {
        email: keeper.email,
        doorSlug: keeper.doorSlug,
        doorPlan: keeper.doorPlan
      }
    });

    const token = createKeeperSessionToken(keeper.id, keeper.email);
    response.cookies.set(KEEPER_SESSION_COOKIE, token, keeperSessionCookieOptions);

    await recordAuthAttempt({
      action: AuthActionType.LOGIN,
      ipAddress,
      email: keeper.email,
      success: true
    });

    return response;
  } catch (error) {
    const email = typeof payload?.email === 'string' ? payload.email.toLowerCase() : null;
    await recordAuthAttempt({
      action: AuthActionType.LOGIN,
      ipAddress,
      email,
      success: false
    });

    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }

    if (error instanceof AuthValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    log.error('Provider auth failed unexpectedly', { error });
    await captureException(error, { component: 'auth:provider' });
    const message = error instanceof Error ? error.message : 'Provider authentication failed';
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}
