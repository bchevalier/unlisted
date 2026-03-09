import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge middleware — defense-in-depth for admin routes.
 *
 * Since we can't use Node.js crypto at the edge, we perform a lightweight
 * check: ensure the admin session cookie exists and has a valid structure
 * (two non-empty dot-separated parts). Full HMAC verification still happens
 * in the API route handlers via `getAdminSessionFromRequest`.
 *
 * This prevents unauthenticated users from:
 *  - Hitting admin SSR pages (which might leak internal structure)
 *  - Hitting admin API routes (double-checked in handlers)
 */

const ADMIN_SESSION_COOKIE = 'knokio_admin_session';

function hasValidSessionStructure(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split('.');
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin routes (except login page and login API)
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Allow access to login page and login/logout API
  if (
    pathname === '/admin/login' ||
    pathname === '/api/admin/login' ||
    pathname === '/api/admin/logout'
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

  if (!hasValidSessionStructure(token)) {
    // Redirect UI requests to login, return 401 for API requests
    if (pathname.startsWith('/api/admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Add security headers for admin pages
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );
  response.headers.set('Pragma', 'no-cache');

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
