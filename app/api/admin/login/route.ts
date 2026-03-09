import { NextResponse } from 'next/server';
import {
  createAdminSessionToken,
  validateAdminCredentials,
  adminSessionCookieOptions,
  ADMIN_SESSION_COOKIE,
} from '../../../../lib/admin-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const adminEmail = await validateAdminCredentials(email, password);

    if (!adminEmail) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = createAdminSessionToken(adminEmail);

    const response = NextResponse.json({ ok: true, email: adminEmail });
    response.cookies.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions);

    return response;
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
