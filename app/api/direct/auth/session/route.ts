import { NextResponse } from 'next/server';
import { getKeeperSessionFromRequest } from '../../../../../lib/keeper-auth';

export async function GET(request: Request) {
  const session = getKeeperSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ ok: true, authenticated: false });
  }

  return NextResponse.json({
    ok: true,
    authenticated: true,
    keeper: {
      userId: session.userId,
      email: session.email
    }
  });
}
