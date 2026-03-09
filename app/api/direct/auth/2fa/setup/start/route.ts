import { NextResponse } from 'next/server';
import { AuthValidationError, startTwoFactorSetup } from '../../../../../../../features/direct/server/auth';
import { getKeeperSessionFromRequest } from '../../../../../../../lib/keeper-auth';
import { logger } from '../../../../../../../lib/logger';
import { captureException } from '../../../../../../../lib/error-tracking';

const log = logger('auth:2fa-setup');

export async function POST(request: Request) {
  const session = getKeeperSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const setup = await startTwoFactorSetup(session.userId);
    return NextResponse.json({
      ok: true,
      setup: {
        secret: setup.secret,
        otpauthUrl: setup.otpauthUrl
      }
    });
  } catch (error) {
    if (error instanceof AuthValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    log.error('2FA setup start failed', { error });
    await captureException(error, { component: 'auth:2fa-setup', userId: session.userId });
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
