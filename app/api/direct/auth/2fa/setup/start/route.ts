import { NextResponse } from 'next/server';
import { AuthValidationError, startTwoFactorSetup } from '../../../../../../../features/direct/server/auth';
import { getKeeperSessionFromRequest } from '../../../../../../../lib/keeper-auth';

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

    console.error(error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
