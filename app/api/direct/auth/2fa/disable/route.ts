import { NextResponse } from 'next/server';
import { disableTwoFactor } from '../../../../../../features/direct/server/auth';
import { captureException } from '../../../../../../lib/error-tracking';
import { getKeeperSessionFromRequest } from '../../../../../../lib/keeper-auth';
import { logger } from '../../../../../../lib/logger';

const log = logger('auth:2fa-disable');

export async function POST(request: Request) {
  const session = getKeeperSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await disableTwoFactor(session.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error('2FA disable failed', { error, userId: session.userId });
    await captureException(error, { component: 'auth:2fa-disable', userId: session.userId });
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
