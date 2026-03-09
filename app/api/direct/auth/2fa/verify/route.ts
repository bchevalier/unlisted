import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthValidationError, verifyTwoFactorLogin } from '../../../../../../features/direct/server/auth';
import {
  createKeeperSessionToken,
  KEEPER_SESSION_COOKIE,
  keeperSessionCookieOptions
} from '../../../../../../lib/keeper-auth';
import { logger } from '../../../../../../lib/logger';
import { captureException } from '../../../../../../lib/error-tracking';

const log = logger('auth:2fa-verify');

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const keeper = await verifyTwoFactorLogin(payload);

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

    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }

    if (error instanceof AuthValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    log.error('2FA verification failed', { error });
    await captureException(error, { component: 'auth:2fa-verify' });
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
