import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthValidationError, confirmTwoFactorSetup } from '../../../../../../../features/direct/server/auth';
import { getKeeperSessionFromRequest } from '../../../../../../../lib/keeper-auth';

export async function POST(request: Request) {
  const session = getKeeperSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const result = await confirmTwoFactorSetup(session.userId, payload);
    return NextResponse.json({ ok: true, recoveryCodes: result.recoveryCodes });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }

    if (error instanceof AuthValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    console.error(error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
