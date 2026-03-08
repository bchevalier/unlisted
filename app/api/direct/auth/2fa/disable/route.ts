import { NextResponse } from 'next/server';
import { disableTwoFactor } from '../../../../../../features/direct/server/auth';
import { getKeeperSessionFromRequest } from '../../../../../../lib/keeper-auth';

export async function POST(request: Request) {
  const session = getKeeperSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  await disableTwoFactor(session.userId);
  return NextResponse.json({ ok: true });
}
