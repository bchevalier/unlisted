import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthValidationError, loginKeeper } from '../../../../../features/direct/server/auth';
import {
  createKeeperSessionToken,
  KEEPER_SESSION_COOKIE,
  keeperSessionCookieOptions
} from '../../../../../lib/keeper-auth';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const user = await loginKeeper(payload);

    const response = NextResponse.json({
      ok: true,
      keeper: {
        email: user.email,
        doorSlug: user.doorSlug
      }
    });

    const token = createKeeperSessionToken(user.id, user.email);
    response.cookies.set(KEEPER_SESSION_COOKIE, token, keeperSessionCookieOptions);

    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: 'Invalid payload', issues: error.issues }, { status: 400 });
    }

    if (error instanceof AuthValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    console.error(error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
