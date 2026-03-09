import { AuthActionType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthValidationError, loginKeeper } from '../../../../../features/direct/server/auth';
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
import { logger } from '../../../../../lib/logger';

const log = logger('auth:login');

export async function POST(request: Request) {
  const ipAddress = extractClientIP(request);
  const payload = await request.json().catch(() => ({}));
  const email = typeof payload?.email === 'string' ? payload.email.toLowerCase() : null;

  try {
    await enforceAuthRateLimit({
      action: AuthActionType.LOGIN,
      ipAddress,
      maxByIp: 20,
      ipWindowMinutes: 15,
      email,
      maxByEmail: 10,
      emailWindowMinutes: 15
    });

    if (typeof payload?.website === 'string' && payload.website.trim().length > 0) {
      await recordAuthAttempt({
        action: AuthActionType.LOGIN,
        ipAddress,
        email,
        success: false
      });
      return NextResponse.json({ ok: false, error: 'Invalid login attempt' }, { status: 400 });
    }

    const result = await loginKeeper(payload);

    await recordAuthAttempt({
      action: AuthActionType.LOGIN,
      ipAddress,
      email,
      success: true
    });

    if (result.status === 'requires_two_factor') {
      return NextResponse.json({
        ok: true,
        requiresTwoFactor: true,
        challengeToken: result.challengeToken,
        email: result.email
      });
    }

    const response = NextResponse.json({
      ok: true,
      requiresTwoFactor: false,
      keeper: {
        email: result.keeper.email,
        doorSlug: result.keeper.doorSlug,
        doorPlan: result.keeper.doorPlan
      }
    });

    const token = createKeeperSessionToken(result.keeper.id, result.keeper.email);
    response.cookies.set(KEEPER_SESSION_COOKIE, token, keeperSessionCookieOptions);

    return response;
  } catch (error) {
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
      const status = error.message === 'Email verification required' ? 403 : 401;
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          emailVerificationRequired: error.message === 'Email verification required'
        },
        { status }
      );
    }

    log.error('Login failed unexpectedly', { error, email });
    await captureException(error, { component: 'auth:login', userId: email ?? undefined });
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ ok: false, error: message }, { status: 429 });
  }
}
