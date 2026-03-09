import { NextResponse } from 'next/server';
import {
  createAdminSessionToken,
  validateAdminCredentials,
  adminSessionCookieOptions,
  ADMIN_SESSION_COOKIE,
} from '../../../../lib/admin-auth';
import {
  checkLoginRateLimit,
  recordLoginAttempt,
  clearLoginRateLimit,
  getClientIp,
} from '../../../../lib/admin-rate-limit';
import { logAdminAction } from '../../../../lib/admin-audit';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    // Rate limit check
    const rateCheck = checkLoginRateLimit(ip);
    if (!rateCheck.allowed) {
      logAdminAction({
        adminEmail: 'unknown',
        action: 'login_rate_limited',
        targetType: 'auth',
        targetId: ip,
        details: { retryAfterSeconds: rateCheck.retryAfterSeconds },
        ip,
      });
      return NextResponse.json(
        { error: 'Too many login attempts. Try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateCheck.retryAfterSeconds) },
        }
      );
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Record the attempt before validation
    recordLoginAttempt(ip);

    const adminEmail = await validateAdminCredentials(email, password);

    if (!adminEmail) {
      logAdminAction({
        adminEmail: typeof email === 'string' ? email : 'unknown',
        action: 'login_failed',
        targetType: 'auth',
        targetId: ip,
        ip,
      });
      // Generic error message — don't reveal whether email or password was wrong
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Success — clear rate limit for this IP
    clearLoginRateLimit(ip);

    logAdminAction({
      adminEmail,
      action: 'login_success',
      targetType: 'auth',
      targetId: adminEmail,
      ip,
    });

    const token = createAdminSessionToken(adminEmail);

    const response = NextResponse.json({ ok: true, email: adminEmail });
    response.cookies.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions);

    return response;
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
